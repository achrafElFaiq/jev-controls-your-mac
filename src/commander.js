// Turns one spoken command into one action, in plain code: no model of any kind.
//
//   you say ──► matched against fixed phrasings, installed apps and known websites
//           ──► the action runs (~0.1 s) ──► chime
//
// Anything that isn't a known command does nothing: "Sorry, I didn't get that."
import { Sandbox } from './sandbox.js';
import { appendFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { HOME } from './config.js';
import { KEYS, MODIFYING_KEYS, RISKY_KEYS, placeCandidates, splitCommands } from './commands.js';
import { extendable, matchFixed } from './fixed.js';
import { isBrowser } from './web.js';

// A screen read is reused for this long (for the sandbox check and "see").
const CACHE_MS = 2500;
// The window/tab list changes rarely: reuse it for this long while refreshing in the background.
const WINDOWS_MS = 1500;
const UNKNOWN = "Sorry, I didn't get that.";
const DECLINED = 'Okay, I left it.';

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
  constructor({ desktop, ui, config, sandbox, apps = null }) {
    Object.assign(this, { desktop, ui, config });
    this.sandbox = sandbox ?? (config.sandbox ? new Sandbox({ root: config.sandbox, desktop }) : null);
    this.apps = apps;
    this.cache = null;
    this.windowCache = null;
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

  /** Reads the screen (when the user starts speaking, or for "see"). */
  prefetch() {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.promise;
    const promise = this.desktop.snapshot({ maxElements: this.config.maxElements ?? 200 }).catch((err) => ({ app: '', window: '', elements: [], text: '', error: err.message }));
    this.cache = { at: Date.now(), promise };
    return promise;
  }

  invalidate() { this.cache = null; }

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

  /** Runs everything the user said ("open Brave then go to LinkedIn" is two commands). */
  async handle(utterance) {
    // What the user actually said: only their words can count as "yes, quit".
    this.userWords = utterance;
    const results = [];
    for (const part of splitCommands(utterance)) {
      const r = await this.run(part);
      results.push(r);
      this.record(r);
      if (r.status !== 'done') break;
    }
    return results;
  }

  /** One line per command in ~/.jev/logs/<date>.jsonl, to measure accuracy and speed. */
  async record(r) {
    if (this.config.log === false) return;
    const dir = join(HOME, 'logs');
    const line = { at: new Date().toISOString(), command: r.command, status: r.status, op: r.op, target: r.target, error: r.error,
      totalMs: Math.round(r.totalMs ?? 0), actionMs: Math.round(r.actionMs ?? 0) };
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
      if (!f) return this.fail(m, t0, UNKNOWN);
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
