// When the code finds nothing for what was said, Jev works out what was meant, in one
// call (~0.25 s): which action (click, open an app, go to a site, a key, scroll) and its
// target, chosen only among things that exist (on-screen elements, installed apps, known
// sites, keys). It never writes text and never invents a target.
//
//   "clique sur notification"   → Link "Notifications, 5 nouvelles notifications"
//   "click jobs"                → Link "Offres d'emploi"
//   "clique sur le premier job" → the first job card
//   "fire up Brave"             → open Brave Browser
import { ask as defaultAsk } from './jev.js';
import { KEYS, SITES, normalize, urlCandidates } from './commands.js';

// Jev's choice is used only when P(action) × P(target) reaches this; otherwise nothing happens.
export const MIN_SCORE = 0.4;
const MIN_TARGET = 0.4;
// After "click …" the thing is meant to be on screen, so the element is judged among the
// elements only (leaving out Jev's "none"), unless Jev is this sure that nothing matches…
const SURE_NONE = 0.75;
// …and only when Jev itself gives the element at least this (a low share of a small
// remainder is noise, not a choice)…
const MIN_RAW = 0.2;
// …and the chosen element must be well ahead of the next one (×1.5), or very likely.
const LEAD = 1.5;
const CLEAR = 0.8;
// An element is never chosen when Jev says the command names something only associated
// with it, or not the same thing. Measured on test/understand-cases.js: traps score
// 0.91–0.95 on "associated", real matches said differently 0.27–0.58; and "same thing" is
// 0.30 or more for every real match.
const ASSOCIATED = 0.75;
const SAME = 0.25;
const MAX_ELEMENTS = 200;

const ACTIONS = {
  click: 'Click, press, open or select something visible on screen: a button, link, tab, menu, row, file, video or checkbox',
  open_app: 'Open, launch or switch to an application on the computer',
  open_site: 'Go to a website',
  key: 'A keyboard action: new tab, close tab, reload, go back, copy, paste, undo, enter, escape, zoom…',
  scroll: 'Scroll the page or window up or down',
  none: 'Anything else: dictating text to type into a field, a question, several steps at once, or nothing here fits',
};
// Which answer each action needs.
const TARGET = { click: 'element', open_app: 'app', open_site: 'site', key: 'key', scroll: 'scroll' };

/** One line per element: what Jev chooses between. */
export function describe(e) {
  let line = `${e.role.replace(/^AX/, '')} "${e.label}"`;
  if (e.placeholder && e.placeholder !== e.label) line += ` placeholder="${e.placeholder}"`;
  if (e.disabled) line += ' (disabled)';
  if (e.inDialog) line += ' (in the open dialog)';
  if (e.offscreen) line += e.offscreen === 'below' ? ' (further down the page)' : ' (further up the page)';
  return line;
}

const prob = (a) => a?.probabilities?.[a.choice] ?? a?.confidence ?? 0;

/**
 * The element answer judged among the elements only: P(element) / (1 − P(none)). Kept as
 * "none" when Jev is sure nothing matches, or when no element is clearly ahead.
 */
export function amongElements(answer) {
  const probs = answer.probabilities ?? { [answer.choice]: answer.confidence ?? 0 };
  const pNone = probs.none ?? 0;
  const ranked = Object.entries(probs).filter(([k]) => k !== 'none').sort((x, y) => y[1] - x[1]);
  if (pNone >= SURE_NONE || !ranked.length) return { ...answer, choice: 'none', probabilities: { ...probs } };
  const rest = 1 - pNone;
  const [[best, p], second] = ranked;
  const share = p / rest;
  const ahead = p >= MIN_RAW && (share >= CLEAR || !second || p >= second[1] * LEAD);
  return { ...answer, choice: ahead ? best : 'none', probabilities: { ...probs, [best]: share } };
}

/**
 * Asks Jev what `command` means on this screen. Returns { op, element | app | site | key |
 * scroll, score, top } with op null when Jev isn't sure enough; `top` lists its three best
 * guesses for the main question (for logs and the dataset). For a click, `elements` holds
 * every element with the chosen name (several → the caller asks which one).
 *
 * `isClick`: the user said "click"/"clique sur"…, so only the element is in question.
 * `exact`: elements whose name is exactly what was said (found by the code): Jev is told,
 * and still decides.
 */
export async function understand({ command, screen, apps = [], config, isClick = false, exact = [], ask = defaultAsk }) {
  // One choice per name: a list row and its cell, or two "Close" buttons, are one option for
  // Jev (otherwise its answer is split between them); the code picks among them afterwards.
  const groups = new Map();
  for (const e of (screen.elements ?? []).filter((x) => x.label)) {
    const name = normalize(e.label);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(e);
  }
  const named = [...groups.values()].slice(0, MAX_ELEMENTS);
  const said = new Set(exact);
  const elementChoices = Object.fromEntries(named.map((g, i) => [`e${i}`, `${describe(g.find((e) => !/Cell/.test(e.role)) ?? g[0])}${g.some((e) => said.has(e)) ? ' — the name the user said' : ''}`]));
  const spoken = urlCandidates(command);
  const sites = Object.fromEntries([...spoken.map((u) => [u, `the address ${u}`]), ...Object.entries(SITES).filter(([u]) => !spoken.includes(u))]);
  const none = { none: 'none of these' };
  const page = screen.url ? ` — ${new URL(screen.url).hostname.replace(/^www\./, '')}` : screen.window ? ` — ${screen.window}` : '';

  const t0 = performance.now();
  const a = await ask({
    apiKey: config.jevKey,
    model: config.jevModel,
    state: { command, screen: `${screen.app ?? ''}${page}`, on_screen: named.map((g) => g[0].label).join(' | ') },
    questions: {
      action: { type: 'choice', instructions: 'What does the `command` ask the computer to do?', criteria: ACTIONS },
      element: {
        type: 'choice',
        instructions: 'The user is looking at this screen and names one of its elements. Which element does the `command` mean? The user often names it differently than it is written: in another language than the page (English for a French page or the reverse), singular instead of plural, a synonym or common name for it ("inbox", "starred", "jobs"), a misheard word, or a description such as its position ("the first job"). Prefer an element named with the same words over one that only mentions them. Elements are listed in reading order.',
        criteria: { ...elementChoices, none: 'none of these: the command is about something that is not on this screen' },
      },
      // Guards against leaps of association ("lemon" → the Yellow button): asked as two
      // opposite yes/no questions, which separate them far better than one.
      same_thing: {
        type: 'noul',
        instructions: 'Is the thing the `command` names literally one of the elements in `on_screen`, possibly translated, abbreviated, pluralized, misheard or called by a synonym (as a person would call that same button or link)?',
      },
      associated_only: {
        type: 'noul',
        instructions: 'Does the `command` name something that is NOT itself on the screen, but only shares a property (a color, a shape, a category, an idea) with one of the elements in `on_screen`? For example a fruit for a color button, the sky for a Blue button.',
      },
      app: { type: 'choice', instructions: 'Which application does the `command` want to open or switch to?', criteria: { ...Object.fromEntries(apps.slice(0, 240).map((n) => [n, null])), ...none } },
      site: { type: 'choice', instructions: 'Which website or address does the `command` want to go to?', criteria: { ...sites, ...none } },
      key: { type: 'choice', instructions: 'Which keyboard action does the `command` ask for?', criteria: { ...Object.fromEntries(Object.entries(KEYS).map(([k, [d]]) => [k, d])), ...none } },
      scroll: { type: 'choice', instructions: 'Which way does the `command` want to scroll?', criteria: { down: 'down', up: 'up', none: 'not scrolling' } },
    },
  });
  const ms = performance.now() - t0;

  // The action and its target are judged together: a clear target makes a so-so action good
  // enough. When the user said "click", the action is known.
  const actions = isClick ? { click: 1 } : a.action?.probabilities ?? { [a.action?.choice]: a.action?.confidence ?? 0 };
  if (isClick && a.element) a.element = amongElements(a.element);
  // Not on this screen: no element is chosen, however close one looks.
  const notHere = (a.associated_only?.noul ?? 0) >= ASSOCIATED || (a.same_thing?.noul ?? 1) < SAME;
  if (a.element && notHere) a.element = { ...a.element, choice: 'none' };
  let best = { op: null, score: 0 };
  for (const [op, p] of Object.entries(actions)) {
    const head = TARGET[op];
    if (!head) continue;
    const arg = a[head];
    if (!arg || arg.choice === 'none' || prob(arg) < MIN_TARGET) continue;
    const score = p * prob(arg);
    if (score > best.score) best = { op, score };
  }
  const label = (head, key) => (head === 'element' && key !== 'none' ? elementChoices[key] : key);
  const head = TARGET[best.op] ?? 'element';
  const top = Object.entries(a[head]?.probabilities ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, p]) => ({ choice: label(head, k), p: Math.round(p * 100) / 100 }));
  const result = { op: best.score >= MIN_SCORE ? best.op : null, score: best.score, top, ms, action: a.action?.choice, same: a.same_thing?.noul, associated: a.associated_only?.noul };
  if (!result.op) return result;
  const choice = a[TARGET[result.op]].choice;
  if (result.op === 'click') {
    result.elements = named[Number(choice.slice(1))];
    result.element = result.elements[0];
  }
  else result[TARGET[result.op]] = choice;
  return result;
}
