// Commands that don't depend on what's on screen (keys, scrolling, opening an app or a
// website), matched in code against a fixed list of phrasings. No model, no guessing:
// anything not matched exactly is not run.
import { KEYS, SITES, normalize, urlCandidates } from './commands.js';

// Phrasings per keyboard action, normalized (lowercase, no accents or punctuation).
// Only phrases that can't mean "click the button with that label" belong here.
export const KEY_PHRASES = {
  enter: ['enter', 'return', 'press enter', 'hit enter', 'press return', 'hit return', 'entree', 'touche entree', 'appuie sur entree', 'valide avec entree'],
  escape: ['escape', 'esc', 'press escape', 'hit escape', 'echap', 'echappe', 'touche echap', 'appuie sur echap'],
  tab: ['tab', 'press tab', 'hit tab', 'next field', 'go to the next field', 'tabulation', 'champ suivant'],
  shift_tab: ['shift tab', 'previous field', 'go to the previous field', 'champ precedent'],
  copy: ['copy', 'copy that', 'copy this', 'copy it', 'copie', 'copier', 'copie ca'],
  paste: ['paste', 'paste it', 'paste that', 'paste here', 'colle', 'coller', 'colle ici', 'colle ca'],
  cut: ['cut', 'cut that', 'cut this', 'cut it', 'coupe', 'couper', 'coupe ca'],
  undo: ['undo', 'undo that', 'undo it', 'annule ca', 'annule la derniere action'],
  redo: ['redo', 'redo that', 'refais', 'retablis', 'retablir'],
  select_all: ['select all', 'select everything', 'tout selectionner', 'selectionne tout'],
  save: ['save', 'save it', 'save this', 'save the file', 'enregistre', 'enregistrer', 'sauvegarde', 'sauvegarder'],
  find: ['find in page', 'find on page', 'search in the page', 'search the page', 'cherche dans la page', 'rechercher dans la page'],
  new_tab: ['new tab', 'open a new tab', 'open new tab', 'nouvel onglet', 'ouvre un nouvel onglet'],
  close_tab: ['close tab', 'close the tab', 'close this tab', 'ferme l onglet', 'ferme cet onglet', 'fermer l onglet'],
  reopen_tab: ['reopen tab', 'reopen the tab', 'reopen closed tab', 'reopen the closed tab', 'reopen the last tab', 'rouvre l onglet', 'rouvre le dernier onglet'],
  next_tab: ['next tab', 'go to the next tab', 'onglet suivant'],
  previous_tab: ['previous tab', 'go to the previous tab', 'onglet precedent'],
  reload: ['reload', 'refresh', 'reload the page', 'refresh the page', 'reload page', 'refresh page', 'actualise', 'actualise la page', 'recharge', 'recharge la page', 'rafraichis', 'rafraichis la page'],
  back: ['go back', 'back', 'previous page', 'go to the previous page', 'retour', 'page precedente', 'reviens en arriere', 'retourne en arriere'],
  forward: ['go forward', 'forward', 'avance', 'page suivante dans l historique'],
  address_bar: ['address bar', 'go to the address bar', 'focus the address bar', 'barre d adresse', 'va dans la barre d adresse'],
  new_window: ['new window', 'open a new window', 'open new window', 'nouvelle fenetre', 'ouvre une nouvelle fenetre'],
  zoom_in: ['zoom in', 'zoome', 'agrandis'],
  zoom_out: ['zoom out', 'dezoome', 'reduis le zoom'],
  up: ['arrow up', 'up arrow', 'press up', 'fleche du haut', 'fleche haut'],
  down: ['arrow down', 'down arrow', 'press down', 'fleche du bas', 'fleche bas'],
  left: ['arrow left', 'left arrow', 'press left', 'fleche de gauche', 'fleche gauche'],
  right: ['arrow right', 'right arrow', 'press right', 'fleche de droite', 'fleche droite'],
  page_down: ['page down', 'press page down'],
  page_up: ['page up', 'press page up'],
  backspace: ['backspace', 'press backspace', 'retour arriere'],
  space: ['space', 'spacebar', 'space bar', 'press space', 'espace', 'barre d espace'],
  minimize: ['minimize', 'minimize the window', 'minimize window', 'minimise', 'reduis la fenetre'],
  quit_app: ['quit', 'quit the app', 'quit app', 'quit this app', 'quit the application', 'quitte l application', 'quitte l app', 'quitter l application'],
  spotlight: ['spotlight', 'open spotlight'],
};

export const SCROLL_PHRASES = {
  down: ['scroll', 'scroll down', 'scroll down a bit', 'scroll down please', 'scroll the page down', 'scroll a bit', 'go down', 'scrolle', 'scrolle vers le bas', 'descends', 'defile', 'defile vers le bas', 'fais defiler', 'fais defiler vers le bas'],
  up: ['scroll up', 'scroll up a bit', 'scroll the page up', 'go up', 'scrolle vers le haut', 'remonte', 'monte', 'defile vers le haut', 'fais defiler vers le haut'],
};

// Polite openers, the assistant's name, trailing filler. Removed before matching.
const OPENERS = /^(?:(?:hey|ok|okay)\s+jev\s+|jev\s+|please\s+|can you\s+|could you\s+|would you\s+|now\s+|and\s+|s il te plait\s+|stp\s+|peux tu\s+|tu peux\s+)+/;
const CLOSERS = /(?:\s+(?:please|for me|now|s il te plait|stp|merci|key|button|touche))+$/;

// Verbs before an app or website. "switch to" also leads to apps; "go to" leans to websites.
const OPEN_VERB = /^(?:open(?: up)?|launch|start|run|bring up|show me|show|ouvre|ouvrir|lance|lancer|demarre|demarrer)\s+/;
const SWITCH_VERB = /^(?:switch to|switch over to|go back to|change to|passe sur|passe a|bascule sur|bascule vers|retourne sur)\s+/;
const GO_VERB = /^(?:go to|go on|go onto|take me to|navigate to|visit|browse to|head to|va sur|va a|aller sur|aller a|emmene moi sur|navigue vers)\s+/;
const ARTICLE = /^(?:the|my|le|la|les|l|mon|ma)\s+/;
const APP_WORD = /\s+(?:app|application|website|web site|site|page|homepage)$|^(?:app|application|site|appli)\s+/;
// Places that share a name with apps ("Home"): not opened as apps.
const PLACE_WORDS = new Set(['home', 'desktop', 'documents', 'downloads', 'applications', 'sandbox', 'jev sandbox']);

// Spoken names that don't match the app's name word for word.
const APP_ALIASES = {
  'vs code': 'Visual Studio Code', vscode: 'Visual Studio Code', 'visual studio': 'Visual Studio Code', 'code editor': 'Visual Studio Code',
  chrome: 'Google Chrome', brave: 'Brave Browser', edge: 'Microsoft Edge', finder: 'Finder',
  word: 'Microsoft Word', excel: 'Microsoft Excel', teams: 'Microsoft Teams', powerpoint: 'Microsoft PowerPoint', outlook: 'Microsoft Outlook',
  settings: 'System Settings', 'system preferences': 'System Settings', preferences: 'System Settings', reglages: 'System Settings', 'reglages systeme': 'System Settings', parametres: 'System Settings',
  calculatrice: 'Calculator', calendrier: 'Calendar', 'app store': 'App Store', appstore: 'App Store',
  quicktime: 'QuickTime Player', 'activity monitor': 'Activity Monitor', 'moniteur d activite': 'Activity Monitor',
  'text edit': 'TextEdit', textedit: 'TextEdit', 'voice memos': 'VoiceMemos', 'find my': 'FindMy', 'photo booth': 'Photo Booth',
  'pycharm': 'PyCharm', 'py charm': 'PyCharm', 'i term': 'iTerm', iterm: 'iTerm', 'i movie': 'iMovie', 'capcut': 'CapCut', 'cap cut': 'CapCut',
  'whats app': 'WhatsApp', whatsapp: 'WhatsApp', 'chat gpt': 'ChatGPT', chatgpt: 'ChatGPT',
  notes: 'Notes', 'apple notes': 'Notes', messages: 'Messages', imessage: 'Messages', 'apple music': 'Music', musique: 'Music',
  plans: 'Maps', photos: 'Photos', rappels: 'Reminders', contacts: 'Contacts', 'apple mail': 'Mail', 'mail app': 'Mail',
};

// Spoken names of websites: every name in SITES ("Gmail, Google mail"), plus the bare domain ("linkedin").
const SITE_ALIASES = {
  'linked in': 'linkedin.com', inbox: 'mail.google.com', gmail: 'mail.google.com', 'g mail': 'mail.google.com', 'my email': 'mail.google.com', 'my emails': 'mail.google.com', 'my inbox': 'mail.google.com',
  'you tube': 'youtube.com', 'git hub': 'github.com', twitter: 'x.com', 'hacker news': 'news.ycombinator.com', 'welcome to the jungle': 'welcometothejungle.com', wttj: 'welcometothejungle.com',
  'stack overflow': 'stackoverflow.com', 'le bon coin': 'leboncoin.fr', 'google flights': 'google.com/travel/flights',
};

const siteNames = (() => {
  const names = new Map(Object.entries(SITE_ALIASES));
  for (const [url, spoken] of Object.entries(SITES)) {
    for (const n of spoken.split(',')) names.set(normalize(n), url);
    names.set(normalize(url), url);
  }
  // The bare name of a plain domain ("linkedin" for linkedin.com, "spotify" for open.spotify.com),
  // never of a subdomain ("google" is google.com, not mail.google.com).
  for (const url of Object.keys(SITES)) {
    const host = url.split('/')[0].replace(/^(www|open|web)\./, '').split('.');
    if (host.length === 2 && host[0].length > 2 && !names.has(host[0])) names.set(host[0], url);
  }
  return names;
})();

const invert = (table) => {
  const map = new Map();
  for (const [name, phrases] of Object.entries(table)) for (const p of phrases) map.set(p, name);
  return map;
};
const keyByPhrase = invert(KEY_PHRASES);
const scrollByPhrase = invert(SCROLL_PHRASES);

/** The command reduced to its core: normalized, without "please", "hey Jev", "key"… */
export function clean(command) {
  return normalize(command).replace(OPENERS, '').replace(CLOSERS, '').trim();
}

/** Spoken name → installed app, by exact name, alias, or name without "Microsoft"/"Browser"… */
function appIndex(apps) {
  const index = new Map();
  const add = (spoken, app) => { const k = normalize(spoken); if (k && !index.has(k)) index.set(k, app); };
  for (const app of apps) add(app, app);
  for (const app of apps) {
    const n = normalize(app);
    add(n.replace(/^(microsoft|google|apple|adobe)\s+/, ''), app);
    add(n.replace(/\s+(browser|app)$/, ''), app);
    add(n.replace(/\s+/g, ''), app);
  }
  const installed = new Set(apps);
  for (const [spoken, app] of Object.entries(APP_ALIASES)) if (installed.has(app)) add(spoken, app);
  return index;
}

const cache = new WeakMap();

/**
 * A fixed command, or null when it isn't one (or isn't certain). Never guesses: every
 * result comes from an exact phrase, an installed app's name or a known website.
 *
 * @param context.apps     installed app names
 * @param context.browser  the browser "open the browser" means
 * @param context.avoid    names that would make an "open X" ambiguous (folders and files)
 * @returns {{op:'key', key} | {op:'scroll', scroll} | {op:'open_app', app} | {op:'open_site', site} | null}
 */
export function matchFixed(command, { apps = [], avoid = [], browser = null } = {}) {
  const c = clean(command);
  if (!c) return null;
  if (keyByPhrase.has(c)) return { op: 'key', key: keyByPhrase.get(c) };
  if (scrollByPhrase.has(c)) return { op: 'scroll', scroll: scrollByPhrase.get(c) };

  const verb = [[OPEN_VERB, 'open'], [SWITCH_VERB, 'switch'], [GO_VERB, 'go']].find(([re]) => re.test(c));
  if (!verb) return null;
  const rest = c.replace(verb[0], '');
  // A spoken address is a website whatever the verb ("open example dot com slash jobs").
  const urls = urlCandidates(command);
  if (urls.length === 1 && normalize(urls[0]) === normalize(rest.replace(/\s+(dot|point)\s+/g, ' ').replace(/\s+slash\s+/g, ' '))) return { op: 'open_site', site: urls[0] };

  const target = rest.replace(ARTICLE, '').replace(APP_WORD, '').replace(ARTICLE, '').trim();
  // "the Gmail tab", "the Finder window", "the Nova folder": not an app or a website.
  if (!target || /\b(tab|window|onglet|fenetre|folder|dossier|file|fichier)$/.test(target)) return null;
  if (browser && /^(browser|web browser|navigateur)$/.test(target)) return { op: 'open_app', app: browser };
  if (PLACE_WORDS.has(target)) return null;

  // The name as said ("my inbox", "app store"), then without articles and "app"/"site".
  const names = [...new Set([rest, rest.replace(ARTICLE, ''), target, target.replace(/\s+/g, '')])];
  const lookup = (map) => names.map((n) => map.get(n)).find(Boolean);
  const app = lookup(indexFor(apps));
  const site = lookup(siteNames);
  // "go to LinkedIn" is always the website; "open Notes" with a Notes folder isn't run.
  const goSite = site && verb[1] === 'go';
  if (!goSite && avoid.some((name) => normalize(name) === target)) return null;
  // Both an app and a website by that name (Spotify, Notion, ChatGPT): "go to" means the site.
  if (site && (goSite || !app)) return { op: 'open_site', site };
  if (app) return { op: 'open_app', app };
  return null;
}

const indexFor = (apps) => {
  if (!cache.has(apps)) cache.set(apps, appIndex(apps));
  return cache.get(apps);
};

/**
 * True when more words could still change what the command means: "go to google" may
 * become "go to google docs", "scroll" may become "scroll up". While speaking, such a
 * command waits for the end of the sentence instead of running early.
 */
export function extendable(command, { apps = [] } = {}) {
  const c = clean(command);
  const stem = c.replace(OPEN_VERB, '').replace(SWITCH_VERB, '').replace(GO_VERB, '').replace(ARTICLE, '');
  // A longer phrase only counts if it means something else ("copy that" is still copy).
  const longer = (map, start) => { for (const [n, v] of map) if (n.startsWith(`${start} `) && v !== map.get(start)) return true; return false; };
  return longer(keyByPhrase, c) || longer(scrollByPhrase, c) || longer(siteNames, stem) || longer(indexFor(apps), stem);
}

/** Words the speech recognizer should expect: app and website names, key phrases. */
export function speechHints(apps = []) {
  const sites = Object.values(SITES).flatMap((s) => s.split(',').map((x) => x.trim()));
  return [...new Set([...apps, ...sites, ...Object.keys(KEYS).map((k) => k.replace(/_/g, ' '))])].slice(0, 300);
}
