// Level 2 test set: "click <name>" on screens modeled on real ones (names as the apps and
// sites really write them, neutral content). Each case must click exactly the expected
// element, ask "which one?" when several share the name, or find nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { findTargets, nameOf, ordinal, parseClick } from '../src/click.js';

let n = 0;
const el = (role, label, extra = {}) => ({ id: `e${++n}`, role: `AX${role}`, label, pos: [0, n * 20], ...extra });

const SCREENS = {
  linkedin: [
    el('Link', 'Passer au contenu principal'), el('SearchField', 'Décrivez l’emploi que vous recherchez'),
    el('Link', 'Accueil, 0 nouvelle notification'), el('Link', 'Réseau, 0 nouvelle notification'), el('Link', 'Offres d’emploi, 0 nouvelle notification'),
    el('Link', 'Messages, 2 nouvelles notifications'), el('Link', 'Notifications, 5 nouvelles notifications'), el('Button', 'Vous'), el('Button', 'Pour les entreprises'),
    el('Link', 'Préférences'), el('Link', 'Suivi des emplois'), el('Link', 'Mes Infos Carrières'),
    el('Link', 'Data Scientist IA F/H (offre d’emploi vérifiée) Data Scientist IA F/H Exemple SA Paris'),
    el('Button', 'Ignorer l’offre d’emploi Data Scientist IA F/H'), el('Button', 'Plus d’options'), el('Button', 'Plus d’options'),
    el('Link', 'AI Engineer (H/F) – Lille & Paris'), el('Button', 'Candidature simplifiée'), el('Link', 'Tout voir'),
  ],
  gmail: [
    el('Button', 'Menu principal'), el('SearchField', 'Rechercher dans les messages'), el('Button', 'Paramètres'), el('Button', 'Nouveau message'),
    el('Link', 'Boîte de réception 12365 messages non lus'), el('Link', 'Messages suivis'), el('Link', 'En attente'), el('Link', 'Messages envoyés'),
    el('Link', 'Brouillons 3 messages non lus'), el('Link', 'Achats 327 messages non lus contient un menu'), el('Link', 'Candidature contient un menu'),
    el('Button', 'Plus de libellés'), el('CheckBox', 'Sélectionner', { value: '0' }), el('Button', 'Actualiser'),
    el('Tab', 'Principale, 2 nouveaux messages,'), el('Tab', 'Promotions, 5 nouveaux messages,'), el('Tab', 'Réseaux sociaux'),
    el('Row', 'Email 1'), el('Row', 'Email 2'), el('Button', 'Préc.'), el('Button', 'Suiv.'),
  ],
  youtube: [
    el('Button', 'Guide'), el('Link', 'Accueil YouTube'), el('SearchField', 'Rechercher'), el('Button', 'Search'), el('Button', 'Effectuer une recherche vocale'),
    el('Button', 'Créer'), el('Button', 'Notifications'), el('Button', 'Menu du compte'), el('Link', 'Accueil'), el('Link', 'Shorts'), el('Link', 'Abonnements'),
    el('Tab', 'Tous'), el('Tab', 'Musique'), el('Tab', 'Jeux vidéo'), el('Tab', 'En direct'), el('Button', 'Autres actions'), el('Button', 'Autres actions'), el('Button', 'Autres actions'),
    el('Link', 'How to Invest at Every Salary 23 minutes'), el('Link', 'Top 5 Most Successful Products'), el('Button', 'Suivant'),
  ],
  settings: [
    el('MenuButton', 'Back'), el('MenuButton', 'Forward'), el('SearchField', ''),
    ...['Wi‑Fi', 'Bluetooth', 'Network', 'Battery', 'General', 'Accessibility', 'Appearance', 'Apple Intelligence & Siri', 'Desktop & Dock', 'Displays',
      'Notifications', 'Sound', 'Focus', 'Screen Time', 'Privacy & Security', 'Touch ID & Password', 'Keyboard'].flatMap((l) => [el('Row', l), el('Cell', l)]),
    el('Button', 'About'), el('Button', 'Software Update'), el('Button', 'Storage'), el('Button', 'Date & Time'), el('Button', 'Language & Region'),
    el('MenuBarItem', 'System Settings'), el('MenuBarItem', 'Edit'), el('MenuBarItem', 'View'), el('MenuBarItem', 'Window'), el('MenuBarItem', 'Help'),
  ],
  finder: [
    el('Button', 'New Folder'), el('Button', 'Quick Look'), el('Button', 'Delete'), el('Button', 'Share'), el('SearchField', 'Search'),
    ...['Recents clock', 'Applications', 'Downloads Arrow Down Circle', 'Desktop', 'Documents document', 'iCloud Drive iCloud', 'AirDrop', 'Trash trash'].flatMap((l) => [el('Row', l), el('Cell', l)]),
    el('Button', 'back'), el('Button', 'forward'),
    el('Row', 'report.pdf PDF Document 13 October 2026 at 10:02'), el('Row', 'notes.txt Plain Text 12 October 2026 at 09:15'),
    el('Row', 'photo 2 PNG image 28 September 2026 at 22:04'), el('Row', 'photo 25 PNG image 28 September 2026 at 22:04'),
    el('Row', 'Invoice PDF Document 2 October 2026'), el('Row', 'Invoice March PDF Document 2 October 2026'),
    el('MenuBarItem', 'File'), el('MenuBarItem', 'Edit'), el('MenuBarItem', 'Go'),
  ],
  form: [
    el('TextField', 'First name'), el('TextField', 'Email'), el('CheckBox', 'Remember me', { value: '1' }), el('CheckBox', 'I accept the terms', { value: '0' }),
    el('RadioButton', 'Monthly'), el('RadioButton', 'Yearly'), el('Button', 'Save'), el('Button', 'Save as draft'), el('Button', 'Cancel'), el('Button', 'Next'),
    el('Button', 'Close', { inDialog: true }), el('Button', 'Close'), el('Button', 'Accept all cookies', { inDialog: true }), el('Button', 'Reject all', { inDialog: true }),
    el('Link', 'Privacy policy'), el('Link', 'Privacy policy', { offscreen: 'below' }), el('Button', 'Disabled one', { disabled: true }),
  ],
};

const label = (screen, l) => SCREENS[screen].find((e) => e.label === l);
const ASK = Symbol('ask');

// [screen, what's said, expected: a label (click it), ASK (several: ask which), or null (nothing)]
const CASES = [
  // LinkedIn (French site)
  ['linkedin', 'click Accueil', 'Accueil, 0 nouvelle notification'], ['linkedin', 'click Réseau', 'Réseau, 0 nouvelle notification'],
  ['linkedin', "click Offres d'emploi", 'Offres d’emploi, 0 nouvelle notification'], ['linkedin', 'click the Offres d’emploi tab', 'Offres d’emploi, 0 nouvelle notification'],
  ['linkedin', 'open Messages', 'Messages, 2 nouvelles notifications'], ['linkedin', 'click notifications', 'Notifications, 5 nouvelles notifications'],
  ['linkedin', 'click Vous', 'Vous'], ['linkedin', 'clique sur Préférences', 'Préférences'], ['linkedin', 'click suivi des emplois', 'Suivi des emplois'],
  ['linkedin', 'click Candidature simplifiée', 'Candidature simplifiée'], ['linkedin', 'click candidature simplifiee', 'Candidature simplifiée'],
  ['linkedin', 'click the Candidature simplifiée button', 'Candidature simplifiée'], ['linkedin', 'appuie sur Candidature simplifiée', 'Candidature simplifiée'],
  ['linkedin', 'click Data Scientist IA', 'Data Scientist IA F/H (offre d’emploi vérifiée) Data Scientist IA F/H Exemple SA Paris'],
  ['linkedin', 'click AI Engineer', 'AI Engineer (H/F) – Lille & Paris'], ['linkedin', 'click tout voir', 'Tout voir'],
  ['linkedin', 'click plus d’options', ASK], ['linkedin', 'click Pour les entreprises', 'Pour les entreprises'],
  ['linkedin', 'click Emplois', null], ['linkedin', 'click Jobs', null], ['linkedin', 'click banana', null],
  // Gmail (French)
  ['gmail', 'click Nouveau message', 'Nouveau message'], ['gmail', 'click boîte de réception', 'Boîte de réception 12365 messages non lus'],
  ['gmail', 'click messages envoyés', 'Messages envoyés'], ['gmail', 'click Brouillons', 'Brouillons 3 messages non lus'], ['gmail', 'click Achats', 'Achats 327 messages non lus contient un menu'],
  ['gmail', 'click Candidature', 'Candidature contient un menu'], ['gmail', 'click en attente', 'En attente'], ['gmail', 'click messages suivis', 'Messages suivis'],
  ['gmail', 'click Paramètres', 'Paramètres'], ['gmail', 'click Actualiser', 'Actualiser'], ['gmail', 'click Promotions', 'Promotions, 5 nouveaux messages,'],
  ['gmail', 'click the Principale tab', 'Principale, 2 nouveaux messages,'], ['gmail', 'click Réseaux sociaux', 'Réseaux sociaux'], ['gmail', 'click plus de libellés', 'Plus de libellés'],
  ['gmail', 'click Suiv', 'Suiv.'], ['gmail', 'click menu principal', 'Menu principal'], ['gmail', 'tick Sélectionner', 'Sélectionner'],
  ['gmail', 'click Email 1', 'Email 1'], ['gmail', 'click Email', ASK], ['gmail', 'click Inbox', null], ['gmail', 'click Compose', null],
  // YouTube (French)
  ['youtube', 'click Shorts', 'Shorts'], ['youtube', 'click Abonnements', 'Abonnements'], ['youtube', 'click Accueil', 'Accueil'],
  ['youtube', 'click Musique', 'Musique'], ['youtube', 'click the Jeux vidéo tab', 'Jeux vidéo'], ['youtube', 'click en direct', 'En direct'], ['youtube', 'click Tous', 'Tous'],
  ['youtube', 'click Créer', 'Créer'], ['youtube', 'click notifications', 'Notifications'], ['youtube', 'click menu du compte', 'Menu du compte'], ['youtube', 'click Guide', 'Guide'],
  ['youtube', 'click Suivant', 'Suivant'], ['youtube', 'click how to invest at every salary', 'How to Invest at Every Salary 23 minutes'],
  ['youtube', 'click Top 5 Most Successful Products', 'Top 5 Most Successful Products'], ['youtube', 'click autres actions', ASK],
  ['youtube', 'click search', 'Search'], ['youtube', 'click effectuer une recherche vocale', 'Effectuer une recherche vocale'], ['youtube', 'click Subscriptions', null],
  // System Settings
  ['settings', 'click Wi-Fi', 'Wi‑Fi'], ['settings', 'click wifi', 'Wi‑Fi'], ['settings', 'click Bluetooth', 'Bluetooth'], ['settings', 'open Network', 'Network'],
  ['settings', 'click Battery', 'Battery'], ['settings', 'click General', 'General'], ['settings', 'click Appearance', 'Appearance'], ['settings', 'click Displays', 'Displays'],
  ['settings', 'click Desktop and Dock', 'Desktop & Dock'], ['settings', 'click Desktop & Dock', 'Desktop & Dock'], ['settings', 'click Privacy & Security', 'Privacy & Security'],
  ['settings', 'click Screen Time', 'Screen Time'], ['settings', 'click Sound', 'Sound'], ['settings', 'click Keyboard', 'Keyboard'], ['settings', 'click Focus', 'Focus'],
  ['settings', 'click Notifications', 'Notifications'], ['settings', 'click Software Update', 'Software Update'], ['settings', 'click Storage', 'Storage'],
  ['settings', 'click About', 'About'], ['settings', 'click Date & Time', 'Date & Time'], ['settings', 'click Back', 'Back'], ['settings', 'click Edit', 'Edit'],
  ['settings', 'click Apple Intelligence & Siri', 'Apple Intelligence & Siri'], ['settings', 'click Siri', null],
  // Finder
  ['finder', 'click Downloads', 'Downloads Arrow Down Circle'], ['finder', 'click Desktop', 'Desktop'], ['finder', 'click Documents', 'Documents document'],
  ['finder', 'click Applications', 'Applications'], ['finder', 'click Recents', 'Recents clock'], ['finder', 'click Trash', 'Trash trash'], ['finder', 'click AirDrop', 'AirDrop'],
  ['finder', 'click iCloud Drive', 'iCloud Drive iCloud'], ['finder', 'click New Folder', 'New Folder'], ['finder', 'click Quick Look', 'Quick Look'],
  ['finder', 'double click report.pdf', 'report.pdf PDF Document 13 October 2026 at 10:02'], ['finder', 'click report dot pdf', null],
  ['finder', 'select notes.txt', 'notes.txt Plain Text 12 October 2026 at 09:15'], ['finder', 'click photo 2', 'photo 2 PNG image 28 September 2026 at 22:04'],
  ['finder', 'click photo 25', 'photo 25 PNG image 28 September 2026 at 22:04'], ['finder', 'click Invoice', ASK], ['finder', 'click invoice march', 'Invoice March PDF Document 2 October 2026'],
  ['finder', 'click File', 'File'], ['finder', 'click Go', 'Go'], ['finder', 'click Delete', 'Delete'], ['finder', 'right click Desktop', 'Desktop'],
  // A form with a dialog
  ['form', 'click Save', 'Save'], ['form', 'click save as draft', 'Save as draft'], ['form', 'click Cancel', 'Cancel'], ['form', 'click next', 'Next'],
  ['form', 'click Close', 'Close'], ['form', 'click accept all cookies', 'Accept all cookies'], ['form', 'click Accept', 'Accept all cookies'], ['form', 'click reject all', 'Reject all'],
  ['form', 'tick remember me', 'Remember me'], ['form', 'check I accept the terms', 'I accept the terms'], ['form', 'select Yearly', 'Yearly'], ['form', 'click monthly', 'Monthly'],
  ['form', 'click privacy policy', 'Privacy policy'], ['form', 'click first name', 'First name'], ['form', 'click the email field', 'Email'], ['form', 'click disabled one', null],
  ['form', 'please click the Save button', 'Save'], ['form', 'can you press next', 'Next'], ['form', 'tap Cancel', 'Cancel'], ['form', 'hit save', 'Save'],
];

test(`level 2 test set (${CASES.length} commands on ${Object.keys(SCREENS).length} screens)`, () => {
  const wrong = [];
  for (const [screen, said, expected] of CASES) {
    const c = parseClick(said);
    const { matches } = c ? findTargets(c.targets, SCREENS[screen]) : { matches: [] };
    const got = matches.length > 1 ? ASK : matches[0] ?? null;
    const want = expected === ASK || expected === null ? expected : label(screen, expected);
    if (want === undefined) wrong.push(`${screen}: no element "${expected}" in the screen`);
    else if (got !== want) wrong.push(`${screen} | ${said} → ${got === ASK ? `ask (${matches.map((m) => m.label).join(' / ')})` : got?.label ?? 'nothing'} (expected ${want === ASK ? 'ask' : want?.label ?? 'nothing'})`);
  }
  assert.deepEqual(wrong, []);
});

test('the open dialog wins over the page behind it; in view wins over further down', () => {
  assert.equal(findTargets('close', SCREENS.form).matches.length, 1);
  assert.ok(findTargets('close', SCREENS.form).matches[0].inDialog);
  assert.ok(!findTargets('privacy policy', SCREENS.form).matches[0].offscreen);
});

test('parsing: verbs, click kinds, tick state, kind words', () => {
  assert.deepEqual(parseClick('double click report.pdf'), { target: 'report pdf', targets: ['report pdf'], mode: 'double', state: undefined });
  assert.deepEqual(parseClick('clic droit sur Bureau'), { target: 'bureau', targets: ['bureau'], mode: 'right', state: undefined });
  assert.deepEqual(parseClick('untick remember me'), { target: 'remember me', targets: ['remember me'], mode: undefined, state: false });
  assert.deepEqual(parseClick('coche la case Accepter'), { target: 'accepter', targets: ['case accepter', 'accepter'], mode: undefined, state: true });
  assert.equal(parseClick('mumble'), null);
  assert.equal(parseClick('click'), null);
  assert.equal(nameOf('Offres d’emploi, 0 nouvelle notification'), 'offres d emploi');
});

test('which one: ordinals in English and French', () => {
  const cases = [['first', 0], ['the second one', 1], ['2', 1], ['third', 2], ['deuxième', 1], ['le premier', 0], ['the last one', 2], ['one', 0], ['banana', null], ['fifth', null]];
  for (const [reply, want] of cases) assert.equal(ordinal(reply, 3), want, reply);
});

// Real screens captured on this Mac with scripts/capture.js (kept out of git: they hold
// personal content). Run when present.
const LOCAL = new URL('./screens/', import.meta.url);
const REAL = [
  ['linkedin-jobs', 'click Accueil'], ['linkedin-jobs', "click Offres d'emploi"], ['linkedin-jobs', 'click Messages'], ['linkedin-jobs', 'click Préférences'],
  ['linkedin-jobs', 'click Tout voir'], ['gmail-inbox', 'click Nouveau message'], ['gmail-inbox', 'click Boîte de réception'], ['gmail-inbox', 'click Messages envoyés'],
  ['gmail-inbox', 'click Brouillons'], ['gmail-inbox', 'click Promotions'], ['youtube-home', 'click Shorts'], ['youtube-home', 'click Abonnements'],
  ['system-settings', 'click Wi-Fi'], ['system-settings', 'click Bluetooth'], ['system-settings', 'click Appearance'], ['finder', 'click Downloads'], ['finder', 'click Desktop'],
];
test('real screens from this Mac: each name is found exactly once', { skip: !existsSync(LOCAL) && 'no captured screens' }, () => {
  const files = new Set(readdirSync(LOCAL).map((f) => f.replace(/\.json$/, '')));
  const wrong = [];
  for (const [file, said] of REAL) {
    if (!files.has(file)) continue;
    const { elements } = JSON.parse(readFileSync(new URL(`${file}.json`, LOCAL), 'utf8'));
    const { matches } = findTargets(parseClick(said).targets, elements);
    if (matches.length !== 1) wrong.push(`${file} | ${said} → ${matches.length} matches${matches.length ? `: ${matches.map((m) => `${m.role} "${m.label}"`).join(' / ')}` : ''}`);
  }
  assert.deepEqual(wrong, []);
});
