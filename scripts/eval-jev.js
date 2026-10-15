#!/usr/bin/env node
// Runs the "what was meant" dataset (test/understand-cases.js) against the real Jev and
// scores it. Nothing is clicked: it only checks what would be chosen.
//
//   node scripts/eval-jev.js            all cases
//   node scripts/eval-jev.js synonym    one category
//
// A wrong action is worse than none: "wrong" counts cases where something else would have
// been clicked or opened; "unsure" counts cases where nothing would happen.
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { matchFixed } from '../src/fixed.js';
import { findTargets, parseClick } from '../src/click.js';
import { understand } from '../src/understand.js';
import { SCREENS } from '../test/public-screens.js';
import { APPS, CASES as MEANT } from '../test/understand-cases.js';
import { ASK, CASES as EXACT } from '../test/click-cases.js';

const config = await loadConfig();
if (!config.jevKey) {
  console.log('No Jev key (jevKey in ~/.jev/config.json).');
  process.exit(1);
}
// The exact-name clicks of level 2 count too: Jev decides those as well. A few were written
// for the code alone (which can't translate); with Jev, the right answer is the translation.
const WITH_JEV = {
  'click Emplois': { click: 'Offres d’emploi, 0 nouvelle notification' }, 'click Jobs': { click: 'Offres d’emploi, 0 nouvelle notification' },
  'click Inbox': { click: 'Boîte de réception 12365 messages non lus' }, 'click Compose': { click: 'Nouveau message' },
  'click Subscriptions': { click: 'Abonnements' }, 'click Siri': { click: 'Apple Intelligence & Siri' },
  'click report dot pdf': { click: 'report.pdf PDF Document 13 October 2026 at 10:02' }, 'click disabled one': [null, 'disabled'],
  'open Messages': [{ open_app: 'Messages' }, { click: 'Messages, 2 nouvelles notifications' }],
};
const exact = EXACT.map(([screen, said, label]) => ['exact', screen, said, WITH_JEV[said] ?? (label === ASK ? 'ask' : label == null ? null : { click: label })]);
const only = process.argv[2];
const cases = [...MEANT, ...exact].filter(([cat]) => !only || cat === only);
// Several elements behind Jev's choice, as the app narrows them: dialog, in view, row over cell.
const sameNamed = (list = []) => {
  let l = list;
  if (l.length > 1 && l.some((e) => e.inDialog)) l = l.filter((e) => e.inDialog);
  if (l.length > 1 && l.some((e) => !e.offscreen)) l = l.filter((e) => !e.offscreen);
  const rows = new Set(l.filter((e) => /Row/.test(e.role)).map((e) => e.label));
  return rows.size ? l.filter((e) => !(/Cell/.test(e.role) && rows.has(e.label))) : l;
};
const show = (x) => (x == null ? 'nothing' : typeof x === 'string' ? x : Array.isArray(x) ? x.map(show).join(' or ') : Object.entries(x).map(([k, v]) => `${k} ${v}`).join(''));

async function decide([cat, screen, said, expected]) {
  const fixed = matchFixed(said, { apps: APPS, browser: config.browser });
  if (fixed) return { cat, screen, said, expected, by: 'code', got: { [fixed.op]: fixed.app ?? fixed.site ?? fixed.key ?? fixed.scroll } };
  // As in the app: Jev decides everything about the screen; when it isn't sure, one element
  // with exactly the name said is clicked by the code.
  const click = parseClick(said);
  const found = click ? findTargets(click.targets, SCREENS[screen]) : { matches: [], exact: false };
  const d = await understand({ command: said, screen: { app: 'Brave Browser', elements: SCREENS[screen] }, apps: APPS, config, isClick: !!click?.explicit, exact: found.exact ? found.matches : [] });
  if (!d.op && found.exact && found.matches.length === 1) return { cat, screen, said, expected, by: 'code', got: { click: found.matches[0].label }, ms: Math.round(d.ms) };
  const several = d.op === 'click' && sameNamed(d.elements).length > 1;
  const got = !d.op ? null : several ? 'ask' : d.op === 'click' && d.element.disabled ? 'disabled' : d.op === 'click' ? { click: d.element.label } : { [d.op]: d[{ open_app: 'app', open_site: 'site', key: 'key', scroll: 'scroll' }[d.op]] };
  return { cat, screen, said, expected, by: 'jev', got, score: Math.round(d.score * 100) / 100, here: d.same == null ? null : `same ${d.same.toFixed(2)}, associated ${d.associated.toFixed(2)}`, ms: Math.round(d.ms), top: d.top };
}

const results = [];
for (let i = 0; i < cases.length; i += 8) results.push(...(await Promise.all(cases.slice(i, i + 8).map(decide))));
// An expected value can list several acceptable answers: [{ open_site: … }, { open_app: … }].
// "ask" (several with that name): asking, or Jev picking one of them, are both fine.
for (const r of results) {
  const ok = [r.expected].flat().some((e) => show(r.got) === show(e)) || (r.expected === 'ask' && r.got?.click && SCREENS[r.screen].filter((e) => findTargets(parseClick(r.said).targets, [e]).matches.length).some((e) => e.label === r.got.click));
  r.verdict = ok ? 'right' : r.got == null ? 'unsure' : 'wrong';
}

const cats = [...new Set(results.map((r) => r.cat))];
console.log('\ncategory      cases  right  unsure  wrong');
for (const c of [...cats, 'all']) {
  const rs = results.filter((r) => c === 'all' || r.cat === c);
  const n = (v) => rs.filter((r) => r.verdict === v).length;
  console.log(`${c.padEnd(13)} ${String(rs.length).padStart(5)}  ${String(n('right')).padStart(5)}  ${String(n('unsure')).padStart(6)}  ${String(n('wrong')).padStart(5)}`);
}
const ms = results.filter((r) => r.ms).map((r) => r.ms).sort((a, b) => a - b);
if (ms.length) console.log(`\nJev time (parallel calls): median ${ms[ms.length >> 1]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
for (const v of ['wrong', 'unsure']) {
  const rs = results.filter((r) => r.verdict === v);
  if (!rs.length) continue;
  console.log(`\n${v}:`);
  for (const r of rs) console.log(`  [${r.cat}/${r.screen}] "${r.said}" → ${show(r.got)}${r.score != null ? ` (${r.score}${r.here != null ? `, ${r.here}` : ''})` : ''}; expected ${show(r.expected)}${r.top?.length ? `\n      top: ${r.top.map((t) => `${t.choice} ${t.p}`).join(' · ')}` : ''}`);
}
const dir = new URL('../eval/results/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(`jev-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, dir), JSON.stringify(results, null, 1));
