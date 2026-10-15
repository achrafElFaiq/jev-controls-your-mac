import { test } from 'node:test';
import assert from 'node:assert/strict';
import { understand } from '../src/understand.js';

const screen = { app: 'Brave Browser', url: 'https://www.linkedin.com/jobs/', elements: [
  { id: 'w1', role: 'AXLink', label: 'Offres d’emploi, 0 nouvelle notification' },
  { id: 'w2', role: 'AXLink', label: 'Messages' },
  { id: 'w3', role: 'AXButton', label: '' },
  { id: 'w4', role: 'AXButton', label: 'Off', disabled: true },
] };
const config = { jevKey: 'k', jevModel: 'jev-latest' };
const answer = (o) => Object.fromEntries(Object.entries(o).map(([q, [choice, p]]) => [q, { choice, confidence: p, probabilities: { [choice]: p, none: 1 - p } }]));

test('one call with every question; every named element is offered, one choice per name', async () => {
  let sent;
  const ask = async (req) => { sent = req; return answer({ action: ['click', 0.9], element: ['e0', 0.8] }); };
  const d = await understand({ command: 'click jobs', screen, apps: ['Brave Browser'], config, ask });
  assert.deepEqual(Object.keys(sent.questions), ['action', 'element', 'same_thing', 'associated_only', 'app', 'site', 'key', 'scroll']);
  assert.equal(sent.state.on_screen, 'Offres d’emploi, 0 nouvelle notification | Messages | Off');
  assert.deepEqual(Object.keys(sent.questions.element.criteria), ['e0', 'e1', 'e2', 'none']);
  assert.equal(sent.questions.element.criteria.e2, 'Button "Off" (disabled)');
  assert.equal(sent.state.screen, 'Brave Browser — linkedin.com');
  assert.equal(d.op, 'click');
  assert.equal(d.element.id, 'w1');
});

test('the action and its target are judged together; below the bar nothing is chosen', async () => {
  const sure = await understand({ command: 'x', screen, config, ask: async () => answer({ action: ['open_site', 0.6], site: ['youtube.com', 0.95] }) });
  assert.deepEqual([sure.op, sure.site], ['open_site', 'youtube.com']);
  const unsure = await understand({ command: 'x', screen, config, ask: async () => answer({ action: ['click', 0.6], element: ['e1', 0.5] }) });
  assert.equal(unsure.op, null, '0.6 × 0.5 is below the bar');
  const none = await understand({ command: 'x', screen, config, ask: async () => answer({ action: ['none', 0.9], element: ['none', 0.9] }) });
  assert.equal(none.op, null);
});

test('after "click": judged among the elements, but never a low pick when Jev leans to "none"', async () => {
  const { amongElements } = await import('../src/understand.js');
  // "click starred" on Gmail: Messages suivis 0.23, none 0.73 → chosen.
  assert.equal(amongElements({ choice: 'none', probabilities: { none: 0.73, e1: 0.23, e2: 0.03 } }).choice, 'e1');
  // "clique sur apparence" on claude.ai: Customize 0.11, none 0.78 → nothing.
  assert.equal(amongElements({ choice: 'none', probabilities: { none: 0.78, e1: 0.11, e2: 0.01 } }).choice, 'none');
  // Two close candidates → nothing.
  assert.equal(amongElements({ choice: 'e1', probabilities: { none: 0.02, e1: 0.5, e2: 0.47 } }).choice, 'none');
  // Jev sure nothing matches → nothing.
  assert.equal(amongElements({ choice: 'none', probabilities: { none: 0.9, e1: 0.08 } }).choice, 'none');
});

test('an element only associated with what was said is never chosen ("lemon" → Yellow)', async () => {
  const ask = (same, associated) => async () => ({ ...answer({ action: ['click', 0.9], element: ['e0', 0.95] }), same_thing: { noul: same }, associated_only: { noul: associated } });
  assert.equal((await understand({ command: 'click lemon', screen, config, isClick: true, ask: ask(0.45, 0.95) })).op, null);
  assert.equal((await understand({ command: 'click jobs', screen, config, isClick: true, ask: ask(0.1, 0.2) })).op, null, 'not the same thing');
  assert.equal((await understand({ command: 'click jobs', screen, config, isClick: true, ask: ask(0.9, 0.1) })).op, 'click');
});
