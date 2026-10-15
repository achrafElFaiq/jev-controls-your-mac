// Turns one spoken command into one action, in plain code: no model of any kind.
//
//   you say ──► level 1: fixed phrasings, installed apps, known websites (no screen read)
//           ──► level 2: "click <name>": the names on screen, compared as text
//           ──► nothing found: Jev works out what was meant (one call, asked while you speak)
//           ──► the action runs ──► chime
//
// When Jev isn't sure either, nothing happens: "Sorry, I didn't get that."
import { Sandbox } from './sandbox.js';
import { understand as defaultUnderstand } from './understand.js';
import { byPosition, findTargets, ordinal, parseClick } from './click.js';
import { appendFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { HOME } from './config.js';
import { KEYS, MODIFYING_KEYS, RISKY_KEYS, normalize, placeCandidates, splitCommands } from './commands.js';
import { extendable, matchFixed } from './fixed.js';
import { isBrowser } from './web.js';

// A screen read is reused for this long, unless it was taken right after an action
// (pages keep changing for a moment after a click).
const CACHE_MS = 2500;
const SETTLE_MS = 800;
// When the name isn't on screen yet (a page still loading), look again this often, this many times.
const RETRY_MS = 400;
const RETRIES = 3;
// The window/tab list changes rarely: reuse it for this long while refreshing in the background.
const WINDOWS_MS = 1500;
const UNKNOWN = "Sorry, I didn't get that.";
const DECLINED = 'Okay, I left it.';

// Buttons whose click can't be undone: they ask first unless the user said that word.
export const CLICK_RISK = /\b(send|submit|pay|purchase|buy|order|checkout|delete|remove|trash|post|publish|transfer|book|reserve|subscribe|unsubscribe|sign up|register|apply|donate|confirm|envoyer|supprimer|payer|valider|postuler|commander|publier|acheter|reserver)\b/i;
const SAYS_RISKY = /\b(send|submit|post|publish|pay|purchase|buy|order|book|reserve|delete|remove|trash|subscribe|unsubscribe|sign up|register|apply|donate|confirm|envoie|envoyer|valide|valider|supprime|supprimer|paye|payer|postule|postuler|commande|commander|publie|publier|achete|acheter|reserve|reserver)/i;

const GROUPS = [
  ['Buttons', /Button|MenuButton|PopUpButton|Toggle|Switch|DisclosureTriangle/],
  ['Links', /Link/],
  ['Fields', /TextField|TextArea|SearchField|ComboBox|SecureTextField|FileUpload/],
  ['Checkboxes & options', /CheckBox|RadioButton|Slider|Incrementor/],
  ['Rows & items', /Row|Cell|MenuItem|Tab|DockItem/],
  ['Menu bar', /MenuBarItem/],
];

/** One line per element. */
export function describe(el) {
  let line = `${el.role.replace(/^AX/, '')} "${el.label}"`;
  if (el.placeholder) line += ` placeholder="${el.placeholder}"`;
  if (el.value) line += ` value="${el.value}"`;
  if (el.focused) line += ' (focused)';
  if (el.disabled) line += ' (disabled)';
  return line;
}

/** Everything on screen, grouped by kind, for the terminal (debugging). */
export function listScreen(screen) {
  const elements = screen.elements ?? [];
  const lines = [`${screen.app}${screen.url ? ` — ${screen.url}` : screen.window ? ` — ${screen.window}` : ''} — ${elements.length} elements`];
  const used = new Set();
  for (const [name, re] of [...GROUPS, ['Other', /./]]) {
    const group = elements.filter((e) => !used.has(e) && re.test(e.role));
    group.forEach((e) => used.add(e));
    if (group.length) lines.push(`${name} (${group.length}):`, ...group.map((e) => `   ${String(e.id).padEnd(5)} ${describe(e)}`));
  }
  return lines;
}

export class Commander {
  /**
   * @param deps.desktop  Desktop bridge
   * @param deps.ui       { say(text), ask(question) -> reply, log(kind, text) }
   * @param deps.config   { browser, sandbox, maxElements, log }
   */
  constructor({ desktop, ui, config, sandbox, apps = null, understand = defaultUnderstand }) {
    Object.assign(this, { desktop, ui, config, understandFn: understand });
    // Jev is used only when a key is set; without it, Jev never runs.
    this.jev = !!config.jevKey;
    // A Jev answer requested while the user was still speaking: { key, promise }.
    this.speculation = null;
    this.sandbox = sandbox ?? (config.sandbox ? new Sandbox({ root: config.sandbox, desktop }) : null);
    this.apps = apps;
    this.cache = null;
    this.lastActionAt = 0;
    this.windowCache = null;
    // The latest screen read, for deciding while the user is still speaking.
    this.lastScreen = null;
    // The sandbox's folder and file names: an "open X" that could mean one of these isn't
    // run, since it may not be the app or website the user meant.
    this.placeNames = [];
  }

  /** Open windows and browser tabs, from a list at most a moment old. */
  windows() {
    const refresh = () => {
      const promise = this.desktop.windows().catch(() => []);
      promise.then((list) => { this.windowCache = { at: Date.now(), list }; });
      return promise;
    };
    if (!this.windowCache) return (this.windowCache = { pending: refresh() }).pending;
    if (this.windowCache.pending) return this.windowCache.pending;
    if (Date.now() - this.windowCache.at > WINDOWS_MS) refresh();
    return Promise.resolve(this.windowCache.list);
  }

  /** Reads the screen (while the user speaks, for clicks, or for "see"). */
  prefetch() {
    const usable = this.cache && Date.now() - this.cache.at < CACHE_MS && this.cache.at - this.lastActionAt > SETTLE_MS;
    if (usable) return this.cache.promise;
    const at = Date.now();
    const promise = this.desktop.snapshot({ maxElements: this.config.maxElements ?? 200 }).catch((err) => ({ app: '', window: '', elements: [], text: '', error: err.message }));
    this.cache = { at, promise };
    promise.then((screen) => {
      if (screen.error) return;
      screen.readAt = at;
      this.lastScreen = { at, screen };
      this.onScreen?.(screen);
    });
    return promise;
  }

  invalidate() {
    this.cache = null;
    this.lastActionAt = Date.now();
  }

  /** A screen read taken after the last action settled, and recent: what's on screen now. */
  freshScreen() {
    const s = this.lastScreen;
    return s && Date.now() - s.at < CACHE_MS && s.at - this.lastActionAt > SETTLE_MS ? s.screen : null;
  }

  async installedApps() {
    this.apps ??= await this.desktop.request('installed_apps').catch(() => []);
    return this.apps;
  }

  refreshPlaces() {
    placeCandidates(this.sandbox?.root).then((places) => {
      this.placeNames = Object.keys(places).filter((p) => this.sandbox && p.startsWith(this.sandbox.root) && p !== this.sandbox.root).map((p) => basename(p).replace(/\.[^.]+$/, ''));
    }, () => {});
  }

  /** The command (key, scroll, open an app or a website) this is, or null. */
  fixed(command) {
    return matchFixed(command, { apps: this.apps ?? [], avoid: this.placeNames, browser: this.config.browser });
  }

  /**
   * A command that more words can't change ("open Brave", not "go to Google"): safe to
   * run while the user is still finishing the sentence. Quitting always waits.
   */
  fixedNow(command) {
    const f = this.fixed(command);
    return f && f.key !== 'quit_app' && !extendable(command, { apps: this.apps ?? [] }) ? f : null;
  }

  /**
   * A screen command that can run before the sentence ends: Jev already answered for these
   * exact words on the current screen, it's sure, it's one element, and it isn't a button
   * that can't be undone.
   */
  clickNow(command) {
    const spec = this.speculation;
    const screen = this.freshScreen();
    if (!spec || !screen || spec.key !== `${normalize(command)}|${screen.readAt}` || !spec.result?.op) return false;
    const d = spec.result;
    if (d.op !== 'click') return d.op !== 'key' || !RISKY_KEYS.has(d.key);
    return (d.elements ?? [d.element]).length === 1 && !CLICK_RISK.test(d.element.label);
  }

  /** Runs everything the user said ("open Brave then go to LinkedIn" is two commands). */
  async handle(utterance) {
    // What the user actually said: only their words can count as "yes, quit".
    this.userWords = utterance;
    const results = [];
    for (const part of splitCommands(utterance)) {
      const r = await this.run(part);
      results.push(r);
      await this.record(r);
      if (r.status !== 'done') break;
    }
    return results;
  }

  /** One line per command in ~/.jev/logs/<date>.jsonl, to measure accuracy and speed. */
  async record(r) {
    if (this.config.log === false) return;
    const dir = join(HOME, 'logs');
    const line = { at: new Date().toISOString(), command: r.command, status: r.status, path: r.path ?? (r.op ? 'fixed' : undefined), op: r.op, target: r.target, error: r.error,
      understood: r.understood, totalMs: Math.round(r.totalMs ?? 0), jevMs: r.jevMs ? Math.round(r.jevMs) : undefined, actionMs: Math.round(r.actionMs ?? 0) };
    await mkdir(dir, { recursive: true }).catch(() => {});
    await appendFile(join(dir, `${line.at.slice(0, 10)}.jsonl`), `${JSON.stringify(line)}\n`).catch(() => {});
  }

  /** One command → one action. */
  async run(command) {
    const t0 = performance.now();
    const m = { command, status: 'done', op: null, target: null, actionMs: 0 };
    try {
      await this.installedApps();
      this.refreshPlaces();
      const f = this.fixed(command);
      if (!f) return await this.runScreen(command, m, t0);
      Object.assign(m, { op: f.op, target: f.key ?? f.scroll ?? f.app ?? f.site });
      this.ui.log('action', `${m.op} → ${m.target}`);
      const ta = performance.now();
      const done = await this.execute(f, command);
      m.actionMs = performance.now() - ta;
      if (done !== true) return this.fail(m, t0, done);
      this.invalidate();
      m.totalMs = performance.now() - t0;
      return m;
    } catch (err) {
      return this.fail(m, t0, `Sorry, ${err.message}`);
    }
  }

  /**
   * Commands that need the screen. With a Jev key, Jev always decides what was meant (exact
   * name or not). The code's exact-name match is the fallback: when Jev is unreachable, or
   * when Jev isn't sure but exactly one element has the very name said. Nothing yet (a page
   * still loading)? Look again.
   */
  async runScreen(command, m, t0) {
    const click = parseClick(command);
    if (!click && !this.jev) return this.fail(m, t0, UNKNOWN);
    let asked = null;
    let jevDown = !this.jev;
    for (let i = 0; i <= RETRIES; i++) {
      if (i) {
        await new Promise((r) => setTimeout(r, RETRY_MS));
        this.cache = null;
      }
      const screen = await this.prefetch();
      m.screenMs = performance.now() - t0;
      const found = click ? findTargets(click.targets, screen.elements) : { matches: [], exact: false };
      // Jev again only if the screen changed since it last looked (a page that finished loading).
      const names = (screen.elements ?? []).map((e) => e.label).join('|');
      if (!jevDown && names !== asked) {
        asked = names;
        const d = await this.meaning(command, screen, m, found.exact ? found.matches : []);
        if (d?.op) return this.act(d, click, command, m, t0);
        if (d === null) jevDown = true;
        // Jev isn't sure, but one element has exactly the name said: that one.
        else if (found.exact && found.matches.length === 1) return this.click(found.matches[0], click, command, { ...m, path: 'click' }, t0);
        // Jev sure it's not about the screen ("buy a ticket"): no point looking again.
        else if (!click) break;
      }
      if (jevDown && found.matches.length) {
        m.path = 'click';
        let element = found.matches[0];
        if (found.matches.length > 1) {
          element = await this.whichOne(click.target, found.matches);
          if (!element) return this.fail(m, t0, DECLINED);
        }
        return this.click(element, click, command, m, t0);
      }
    }
    return this.fail(m, t0, click ? `I don't see ${click.target} on the screen.` : UNKNOWN);
  }

  /** What Jev understood, from the call made while the user spoke when it's for this screen. */
  async meaning(command, screen, m, exact = []) {
    const key = `${normalize(command)}|${screen.readAt}`;
    const spec = this.speculation?.key === key ? this.speculation.promise : null;
    const t = performance.now();
    const d = await (spec ?? this.ask(command, screen, exact)).catch((err) => {
      this.ui.log('jev', `Jev failed: ${err.message}`);
      return null;
    });
    m.path = 'jev';
    m.jevMs = (m.jevMs ?? 0) + (performance.now() - t);
    if (d) m.understood = { action: d.action, op: d.op, score: Math.round(d.score * 100) / 100, top: d.top, early: !!spec };
    if (d?.op) await this.remember(command, screen, d);
    return d;
  }

  ask(command, screen, exact) {
    const click = parseClick(command);
    // The elements named exactly as said, for Jev to know (it still decides).
    exact ??= click ? findTargets(click.targets, screen.elements).exact ? findTargets(click.targets, screen.elements).matches : [] : [];
    return this.understandFn({ command, screen, apps: this.apps ?? [], config: this.config, isClick: !!click?.explicit, exact });
  }

  /**
   * While the user is still speaking: if the words so far need Jev (no fixed command, no
   * exact name on screen), ask now, so the answer is ready when they stop.
   */
  speculate(command) {
    const screen = this.freshScreen();
    if (!this.jev || !screen || this.fixed(command)) return;
    const key = `${normalize(command)}|${screen.readAt}`;
    if (this.speculation?.key === key) return;
    const spec = { key, command: normalize(command), result: undefined };
    spec.promise = this.ask(command, screen);
    spec.promise.then((d) => { spec.result = d; this.onUnderstood?.(); }, () => {});
    this.speculation = spec;
  }

  /** Runs what Jev understood. */
  async act(d, click, command, m, t0) {
    if (d.op === 'click') {
      // Several elements with the name Jev chose: the open dialog, then what's in view, win;
      // still several → ask which, as for exact names.
      let list = d.elements ?? [d.element];
      if (list.length > 1 && list.some((e) => e.inDialog)) list = list.filter((e) => e.inDialog);
      if (list.length > 1 && list.some((e) => !e.offscreen)) list = list.filter((e) => !e.offscreen);
      const rows = new Set(list.filter((e) => /Row/.test(e.role)).map((e) => e.label));
      if (rows.size) list = list.filter((e) => !(/Cell/.test(e.role) && rows.has(e.label)));
      let element = list[0];
      if (list.length > 1) {
        element = await this.whichOne(element.label, list);
        if (!element) return this.fail(m, t0, DECLINED);
      }
      return this.click(element, click ?? {}, command, m, t0);
    }
    Object.assign(m, { op: d.op, target: d.key ?? d.scroll ?? d.app ?? d.site });
    this.ui.log('action', `${m.op} → ${m.target}`);
    const ta = performance.now();
    const done = await this.execute({ op: d.op, key: d.key, scroll: d.scroll, app: d.app, site: d.site }, command);
    m.actionMs = performance.now() - ta;
    return done === true ? this.finish(m, t0) : this.fail(m, t0, done);
  }

  /**
   * Builds the dataset of what Jev understood: one line per command in
   * ~/.jev/dataset/understood.jsonl, with the screen's names, to replay and measure later.
   */
  async remember(command, screen, d) {
    if (this.config.log === false) return;
    const line = {
      at: new Date().toISOString(), command, app: screen.app, url: screen.url && new URL(screen.url).hostname,
      chosen: d.element ? `${d.element.role.replace(/^AX/, '')} "${d.element.label}"` : d.app ?? d.site ?? d.key ?? d.scroll,
      op: d.op, score: Math.round(d.score * 100) / 100, top: d.top,
      screen: (screen.elements ?? []).filter((e) => e.label).slice(0, 200).map((e) => `${e.role.replace(/^AX/, '')} "${e.label}"`),
    };
    const dir = join(HOME, 'dataset');
    await mkdir(dir, { recursive: true }).catch(() => {});
    await appendFile(join(dir, 'understood.jsonl'), `${JSON.stringify(line)}\n`).catch(() => {});
  }

  /** Clicks an element (found by name or by Jev). */
  async click(element, { target, mode, state } = {}, command, m, t0) {
    m.op = 'click';
    target ??= element.label;
    m.target = `${element.role.replace(/^AX/, '')} "${element.label}"`;
    if (element.disabled) return this.fail(m, t0, `${element.label} is disabled.`);
    this.ui.log('action', `click → ${m.target}`);
    // A checkbox already in the asked state stays as it is.
    if (state !== undefined && /CheckBox|Switch/.test(element.role) && (element.value === '1') === state) return this.finish(m, t0);
    if (CLICK_RISK.test(element.label) && !SAYS_RISKY.test(this.userWords ?? command)) {
      if (!(await this.confirm(`That's "${element.label}". Do it?`))) return this.fail(m, t0, DECLINED);
    }
    const ta = performance.now();
    try {
      await this.desktop.press(element.id, mode);
    } catch (err) {
      // The page changed between reading and clicking: say so rather than clicking something else.
      if (/is gone|Unknown element/.test(err.message)) return this.fail(m, t0, `${target} moved before I could click it. Say it again.`);
      throw err;
    }
    m.actionMs = performance.now() - ta;
    return this.finish(m, t0);
  }

  finish(m, t0) {
    this.invalidate();
    m.totalMs = performance.now() - t0;
    return m;
  }

  /** Several things have that name: list them top to bottom and ask which. */
  async whichOne(target, matches) {
    const list = matches.slice(0, 5).sort(byPosition);
    const where = (e) => `${e.role.replace(/^AX/, '').toLowerCase()}${e.inDialog ? ' in the dialog' : ''}${e.offscreen ? ` further ${e.offscreen === 'below' ? 'down' : 'up'}` : ''}`;
    this.ui.show?.(list.map((e, i) => `   ${i + 1}. ${where(e)} "${e.label}"`));
    const reply = await this.ui.ask(`There are ${matches.length} ${target}. Which one: ${list.map((_, i) => ['first', 'second', 'third', 'fourth', 'fifth'][i]).join(', ')}?`);
    const i = ordinal(String(reply), list.length);
    return i == null ? null : list[i];
  }

  fail(m, t0, message) {
    m.status = 'failed';
    m.error = message;
    m.totalMs = performance.now() - t0;
    this.invalidate();
    this.ui.say(message);
    return m;
  }

  /** Returns true when done, or a short sentence explaining why not. */
  async execute(f, command) {
    const d = this.desktop;
    // The app the user is working in (the one behind the terminal, in text mode).
    const front = f.op === 'open_app' ? '' : (await d.frontmost().catch(() => ({ app: '' }))).app;

    switch (f.op) {
      case 'open_app':
        await d.openApp(f.app);
        return true;

      case 'open_site': {
        const url = /^https?:/.test(f.site) ? f.site : `https://${f.site}`;
        const host = new URL(url).hostname.replace(/^www\./, '');
        // Already open in a tab? Switch to it instead of opening the site again. A tab closed
        // since the list was read can't be focused: open the site instead.
        const open = (await this.windows()).find((w) => w.kind === 'tab' && w.url && new URL(w.url).hostname.replace(/^www\./, '').endsWith(host) && new URL(url).pathname === '/');
        if (!open || !(await d.focusWindow(open).then(() => true, () => false))) {
          await d.openUrl(url, isBrowser(front) ? front : this.config.browser);
        }
        return true;
      }

      case 'key': {
        // Keys that change things (paste, save, undo…) must stay inside the file sandbox.
        if (MODIFYING_KEYS.has(f.key) && this.sandbox) {
          const reason = this.sandbox.checkText(null) ?? (await this.sandbox.checkContext(await this.prefetch()));
          if (reason) return `I can't: ${reason}.`;
        }
        if (RISKY_KEYS.has(f.key) && !/\bquit/i.test(this.userWords ?? command)) {
          if (!(await this.confirm(`${KEYS[f.key][0]}?`))) return DECLINED;
        }
        await d.keys(KEYS[f.key][1], front);
        return true;
      }

      case 'scroll':
        // In browsers, scroll the page itself (the mouse may be anywhere).
        if (isBrowser(front) && (await d.web.scroll(front, f.scroll).then(() => true, () => false))) return true;
        await d.scroll(f.scroll, undefined, front);
        return true;

      default:
        return UNKNOWN;
    }
  }

  async confirm(question) {
    const reply = String(await this.ui.ask(question));
    return /^(yes|yeah|yep|sure|ok|okay|do it|go|go ahead|oui|ouais|vas-y)\b/i.test(reply.trim()) && !/\b(no|non|don'?t|stop|cancel)\b/i.test(reply);
  }
}
