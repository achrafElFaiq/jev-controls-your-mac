// Level 2 test set: "click <name>" on screens modeled on real ones (names as the apps and
// sites really write them, neutral content). Each case must click exactly the expected
// element, ask "which one?" when several share the name, or find nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { findTargets, nameOf, ordinal, parseClick } from '../src/click.js';
import { SCREENS } from './public-screens.js';
import { ASK, CASES } from './click-cases.js';

const label = (screen, l) => SCREENS[screen].find((e) => e.label === l);
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
  assert.deepEqual(parseClick('double click report.pdf'), { target: 'report pdf', targets: ['report pdf'], mode: 'double', state: undefined, explicit: true });
  assert.deepEqual(parseClick('clic droit sur Bureau'), { target: 'bureau', targets: ['bureau'], mode: 'right', state: undefined, explicit: true });
  assert.deepEqual(parseClick('untick remember me'), { target: 'remember me', targets: ['remember me'], mode: undefined, state: false, explicit: true });
  assert.deepEqual(parseClick('coche la case Accepter'), { target: 'accepter', targets: ['case accepter', 'accepter'], mode: undefined, state: true, explicit: true });
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
