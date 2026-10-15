// Drives the real native helper against the fixture app. Needs Accessibility
// permission for the terminal running the tests; skipped otherwise.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Desktop } from '../../src/desktop.js';
import { launchFixture } from './fixture.js';

const desktop = new Desktop();
const perms = await desktop.permissions();
const skip = perms.accessibility ? false : 'Accessibility permission not granted to this terminal (System Settings → Privacy & Security → Accessibility)';

let fixture;
before(async () => { if (!skip) fixture = await launchFixture(desktop); });
after(() => { fixture?.close(); desktop.close(); });

const find = (snap, role, pattern) => snap.elements.find((e) => e.role === role && pattern.test(e.label));

async function snap() {
  await fixture.focus();
  return desktop.snapshot();
}

test('snapshot lists the fixture controls with labels', { skip }, async () => {
  const s = await snap();
  assert.equal(s.app, 'JevFixture');
  assert.equal(s.window, 'Jev Fixture');
  for (const [role, label] of [
    ['AXTextField', /Name/], ['AXButton', /^Greet$/], ['AXCheckBox', /Subscribe/], ['AXPopUpButton', /Favorite color|Red/],
    ['AXButton', /Delete account/], ['AXButton', /Verify/], ['AXRow', /Indeed/],
  ]) {
    assert.ok(find(s, role, label), `missing ${role} ${label}: ${JSON.stringify(s.elements.map((e) => `${e.role} ${e.label}`))}`);
  }
  assert.match(s.text, /Inbox/);
});

test('snapshot is fast enough to run after every action', { skip }, async () => {
  const s = await snap();
  assert.ok(s.ms < 1000, `snapshot took ${s.ms}ms`);
});

test('element ids are stable across snapshots', { skip }, async () => {
  const a = find(await snap(), 'AXButton', /^Greet$/);
  const b = find(await snap(), 'AXButton', /^Greet$/);
  assert.equal(a.id, b.id);
});

test('set_text then press: greets by name', { skip }, async () => {
  const s = await snap();
  await desktop.setText(find(s, 'AXTextField', /Name/).id, 'Marion');
  await desktop.press(find(s, 'AXButton', /^Greet$/).id);
  const state = await fixture.waitFor((st) => st.greeting === 'Hello, Marion!');
  assert.equal(state.greeting, 'Hello, Marion!');
});

test('set_text replaces existing text unless appending', { skip }, async () => {
  const s = await snap();
  const field = find(s, 'AXTextField', /Name/).id;
  await desktop.setText(field, 'Alice');
  await desktop.setText(field, ' Smith', true);
  const state = await fixture.waitFor((st) => st.name === 'Alice Smith');
  assert.equal(state.name, 'Alice Smith');
});

test('press toggles a checkbox', { skip }, async () => {
  await desktop.press(find(await snap(), 'AXCheckBox', /Subscribe/).id);
  assert.equal((await fixture.waitFor((st) => st.subscribed)).subscribed, true);
});

test('select picks a pop-up option', { skip }, async () => {
  await desktop.select(find(await snap(), 'AXPopUpButton', /Favorite color|Red/).id, 'Blue');
  assert.equal((await fixture.waitFor((st) => st.color === 'Blue')).color, 'Blue');
});

test('clicking an inbox row opens the email and its text becomes readable', { skip }, async () => {
  await desktop.press(find(await snap(), 'AXRow', /Indeed/).id);
  assert.equal((await fixture.waitFor((st) => st.openedEmail === 'Indeed')).openedEmail, 'Indeed');
  const screen = await desktop.readText();
  assert.match(screen.text, /482913/);
});

test('typing a code and pressing Verify verifies', { skip }, async () => {
  const s = await snap();
  await desktop.setText(find(s, 'AXTextField', /Verification code/).id, '482913');
  await desktop.press(find(s, 'AXButton', /Verify/).id);
  assert.equal((await fixture.waitFor((st) => st.verified)).verified, true);
});

test('keys sends shortcuts to the front app', { skip }, async () => {
  const s = await snap();
  const field = find(s, 'AXTextField', /Name/).id;
  await desktop.setText(field, 'abc');
  await desktop.keys('cmd+a');
  await desktop.type('xyz');
  assert.equal((await fixture.waitFor((st) => st.name === 'xyz')).name, 'xyz');
});

test('unknown element ids fail with a clear error', { skip }, async () => {
  await assert.rejects(desktop.press(999999), /Unknown element/);
});

test('installed apps are listed for open_app matching', async () => {
  const apps = await desktop.request('installed_apps');
  assert.ok(apps.includes('Calculator'));
});
