// Level 2: click something visible by saying its name ("click Jobs", "press Save",
// "clique sur Accueil"). Plain text comparison with the names on screen: no model.
// Several things with that name → the caller asks which one; none → nothing is clicked.
import { normalize } from './commands.js';

// "click", "press", "open"… and the click kind. Matched on normalized text (no accents).
const VERB = /^(?:(?:please|can you|could you|hey jev|jev|s il te plait|stp)\s+)*(?:(double|right)\s+(?:click|clique|clic|tap)(?:\s+on|\s+sur)?|(?:clic|clique|click)\s+(droit|double)(?:\s+sur)?|(click|clique|clic|tap|press|hit|push|select|open|choose|pick|tick|check|uncheck|untick|toggle|appuie|appuyer|ouvre|ouvrir|selectionne|choisis|coche|decoche)(?:\s+on|\s+sur)?)\s+/;
const ARTICLE = /^(?:the|a|an|this|that|le|la|les|l|un|une|ce|cette|sur)\s+/;
// Words naming the kind of thing ("the Jobs tab", "le bouton Envoyer"), not part of its name.
const KIND = '(?:button|link|tab|icon|menu|checkbox|check box|box|option|item|entry|row|toggle|switch|field|text field|input|bouton|lien|onglet|icone|case|case a cocher|champ|element)';
const KIND_AFTER = new RegExp(`\\s+${KIND}$`);
const KIND_BEFORE = new RegExp(`^${KIND}\\s+`);
const CLOSER = /\s+(?:please|for me|now|s il te plait|stp|on the screen|on screen|a l ecran)$/;
// What sites add after a name: counters ("Messaging 3", "Inbox 1,234 unread messages",
// "Offres d’emploi, 0 nouvelle notification") and hints for screen readers ("contient un menu").
const COUNTER = /(?:\s+\d[\d\s]*(?:\s+(?:new|unread|messages?|notifications?|items?|nouveaux?|nouvelles?|non|lus?|elements?))*)+$/;
const HINT = /\s+(?:has a menu|contains a menu|contient un menu|has popup|collapsed|expanded|selected|selectionne)$/;

/** Name as compared: normalized, without trailing counters or screen-reader hints. */
export const nameOf = (label) => {
  let n = normalize(label);
  for (let i = 0; i < 2; i++) n = n.replace(HINT, '').replace(COUNTER, '').trim();
  return n;
};

/**
 * Parses a click command. Returns null when it isn't one, otherwise
 * { target, targets, mode, state }: targets are the names to look for, in order; mode is undefined, 'double' or 'right'; state is true/false for
 * "tick"/"untick" (else undefined).
 */
export function parseClick(command) {
  const c = normalize(command);
  const v = VERB.exec(c);
  if (!v) return null;
  const mode = v[1] ?? (v[2] === 'droit' ? 'right' : v[2]);
  // The name as said ("Menu principal"), then without kind words ("the Jobs tab" → "jobs").
  let raw = c.slice(v[0].length).replace(CLOSER, '');
  for (let i = 0; i < 2; i++) raw = raw.replace(ARTICLE, '');
  let t = raw;
  for (let i = 0; i < 2; i++) t = t.replace(ARTICLE, '').replace(KIND_AFTER, '').replace(KIND_BEFORE, '');
  raw = raw.trim();
  t = t.trim();
  // "tick"/"untick": the checkbox state wanted (left alone if it's already that way).
  const verb = v[3] ?? '';
  const state = /^(uncheck|untick|decoche)$/.test(verb) ? false : /^(tick|check|coche)$/.test(verb) ? true : undefined;
  // "click", "clique sur", "tick"…: certainly something on screen. "open", "select"… may also
  // mean an app or a website.
  const explicit = !!mode || /^(click|clique|clic|tap|press|hit|push|appuie|appuyer|tick|check|uncheck|untick|coche|decoche)$/.test(verb);
  return t ? { target: t, targets: [...new Set([raw, t])], mode, state, explicit } : null;
}

// Menu bar items ("File", "Edit") only count when nothing in the window has that name.
const isMenuBar = (e) => /MenuBarItem/.test(e.role);

/** Top to bottom, left to right, for "first", "second"… */
export function byPosition(a, b) {
  const pa = a.frame ?? a.pos ?? [0, 0];
  const pb = b.frame ?? b.pos ?? [0, 0];
  return Math.abs(pa[1] - pb[1]) > 8 ? pa[1] - pb[1] : pa[0] - pb[0];
}

/**
 * The elements a target names, best first:
 *   1. same name ("Jobs" = "Jobs", "Messaging 3" = "messaging", "Wi‑Fi" = "wifi", "&" = "and",
 *      "notification" = "Notifications")
 *   2. otherwise a name that starts with the target's words ("Easy Apply" → "Easy Apply to Data Scientist")
 * When several remain, the ones in an open dialog, then the ones in view, win.
 * Returns { matches, exact }.
 */
export function findTargets(target, elements = []) {
  // Several ways to read the name ("menu principal", "principal"): the first one found wins.
  if (Array.isArray(target)) {
    for (const t of target) {
      const found = findTargets(t, elements);
      if (found.matches.length) return found;
    }
    return { matches: [], exact: false };
  }
  const labelled = elements.filter((e) => e.label && !e.disabled);
  const pick = (list) => {
    const window = list.filter((e) => !isMenuBar(e));
    return window.length ? window : list;
  };
  // "&" and "and" are the same when spoken ("Desktop & Dock"), and so are "Wi‑Fi" and "wifi",
  // and singular and plural (silent in French: "notification" = "Notifications").
  const loose = (t) => t.replace(/\b(and|et)\b/g, ' ').replace(/(\w{3,}?)[sx]\b/g, '$1').replace(/\s+/g, '');
  const said = loose(target);
  let matches = pick(labelled.filter((e) => nameOf(e.label) === target || normalize(e.label) === target));
  if (!matches.length) matches = pick(labelled.filter((e) => loose(nameOf(e.label)) === said || loose(normalize(e.label)) === said));
  const exact = matches.length > 0;
  if (!exact && target.length >= 4) matches = pick(labelled.filter((e) => nameOf(e.label).startsWith(`${target} `)));
  // A list row and its cell are one thing on screen (Finder, System Settings): keep the row.
  const rows = new Set(matches.filter((e) => /Row/.test(e.role)).map((e) => e.label));
  if (rows.size) matches = matches.filter((e) => !(/Cell/.test(e.role) && rows.has(e.label)));
  if (matches.length > 1 && matches.some((e) => e.inDialog)) matches = matches.filter((e) => e.inDialog);
  if (matches.length > 1 && matches.some((e) => !e.offscreen)) matches = matches.filter((e) => !e.offscreen);
  return { matches: [...matches].sort(byPosition), exact };
}

/** True when another name on screen continues the target ("Save" → "Save as draft"). */
export function continued(target, elements = []) {
  return elements.some((e) => e.label && nameOf(e.label).startsWith(`${target} `));
}

const ORDINALS = [
  /\b(1|first|premier|premiere)\b|^(the )?(one|un|une)$/, /\b(2|two|second|deuxieme|seconde?|deux)\b/, /\b(3|three|third|troisieme|trois)\b/,
  /\b(4|four|fourth|quatrieme|quatre)\b/, /\b(5|five|fifth|cinquieme|cinq)\b/,
];

/** "the second one", "2", "deuxième" → index; "last" → the last; anything else → null. */
export function ordinal(reply, count) {
  const r = normalize(reply);
  if (/\b(last|dernier|derniere)\b/.test(r)) return count - 1;
  const i = ORDINALS.findIndex((re) => re.test(r));
  return i >= 0 && i < count ? i : null;
}
