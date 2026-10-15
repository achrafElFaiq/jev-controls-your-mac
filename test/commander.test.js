import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Commander } from '../src/commander.js';
import { splitCommands, urlCandidates } from '../src/commands.js';

const ELEMENTS = [
  { id: 'w1', role: 'AXLink', label: 'Jobs', pos: [400, 10] },
  { id: 'w2', role: 'AXLink', label: 'Messaging 3', pos: [500, 10] },
  { id: 'w3', role: 'AXButton', label: 'Reply', pos: [100, 300] },
  { id: 'w4', role: 'AXButton', label: 'Reply', pos: [100, 600] },
  { id: 'w5', role: 'AXButton', label: 'Send', pos: [100, 700] },
  { id: 'w6', role: 'AXButton', label: 'Easy Apply to Data Scientist at Synapsys', pos: [100, 200] },
  { id: 'w7', role: 'AXCheckBox', label: 'Remember me', value: '1', pos: [100, 800] },
  { id: 'w8', role: 'AXButton', label: 'Delete account', pos: [100, 900] },
  { id: 9, role: 'AXMenuBarItem', label: 'File' },
];

function fakeDesktop(app = 'Brave Browser', elements = ELEMENTS) {
  const log = [];
  let snapshots = 0;
  return {
    log,
    elements,
    get snapshots() { return snapshots; },
    snapshot: async function () { snapshots++; return { app, window: '', elements: this.elements }; },
    press: async (id, mode) => log.push(['press', id, mode]),
    frontmost: async () => ({ app }),
    request: async (cmd) => (cmd === 'installed_apps' ? ['Brave Browser', 'Finder', 'Spotify', 'Visual Studio Code'] : ''),
    windows: async () => [
      { app: 'Brave Browser', kind: 'tab', window: 1, tab: 3, title: 'Inbox - Gmail', url: 'https://mail.google.com/mail/u/0/' },
      { app: 'Finder', kind: 'window', window: 0, title: 'Jev Sandbox' },
    ],
    focusWindow: async (w) => log.push(['focusWindow', w.app, w.title]),
    keys: async (keys, front) => log.push(['keys', keys, front]),
    scroll: async (dir) => log.push(['nativeScroll', dir]),
    web: { scroll: async (_app, dir) => log.push(['scroll', dir]) },
    openApp: async (name) => log.push(['openApp', name]),
    openUrl: async (url, browser) => log.push(['openUrl', url, browser]),
  };
}

function setup({ answers = [], app, elements } = {}) {
  const desktop = fakeDesktop(app, elements);
  const said = [];
  const asked = [];
  const ui = { say: async (t) => said.push(t), ask: async (q) => { asked.push(q); return answers.shift() ?? 'no'; }, log: () => {} };
  const commander = new Commander({ desktop, ui, config: { browser: 'Brave Browser', log: false, sandbox: false } });
  commander.ui.show = () => {};
  return { commander, desktop, said, asked };
}

test('apps, websites, keys and scrolling run straight away, without reading the screen', async () => {
  const { commander, desktop } = setup();
  for (const cmd of ['open VS Code', 'go to LinkedIn', 'press enter', 'scroll up', 'new tab', 'ouvre le Finder']) {
    const [r] = await commander.handle(cmd);
    assert.equal(r.status, 'done', cmd);
  }
  assert.equal(desktop.snapshots, 0);
  assert.deepEqual(desktop.log, [
    ['openApp', 'Visual Studio Code'], ['openUrl', 'https://linkedin.com', 'Brave Browser'], ['keys', 'return', 'Brave Browser'],
    ['scroll', 'up'], ['keys', 'cmd+t', 'Brave Browser'], ['openApp', 'Finder'],
  ]);
});

test('anything else does nothing and says so', async () => {
  const { commander, desktop, said } = setup();
  for (const cmd of ['type hello', 'mumble', 'what can you see']) {
    const [r] = await commander.handle(cmd);
    assert.equal(r.status, 'failed', cmd);
  }
  assert.deepEqual(desktop.log, []);
  assert.ok(said.every((s) => /didn't get that/.test(s)));
});

test('several commands in one sentence run in order, and stop at the first that fails', async () => {
  const { commander, desktop } = setup();
  const results = await commander.handle('open brave then go to linkedin');
  assert.equal(results.length, 2);
  assert.deepEqual(desktop.log.map((l) => l[0]), ['openApp', 'openUrl']);
  const stopped = await setup().commander.handle('mumble then new tab');
  assert.equal(stopped.length, 1);
});

test('going to a site that is already open switches to its tab', async () => {
  const { commander, desktop } = setup();
  await commander.handle('go to gmail');
  assert.deepEqual(desktop.log, [['focusWindow', 'Brave Browser', 'Inbox - Gmail']]);
});

test('a tab that closed since the list was read: the site is opened instead', async () => {
  const { commander, desktop } = setup();
  desktop.focusWindow = async () => { throw new Error('gone'); };
  await commander.handle('go to gmail');
  assert.deepEqual(desktop.log, [['openUrl', 'https://mail.google.com', 'Brave Browser']]);
});

test('websites open in the browser in front, or the default browser', async () => {
  const { commander, desktop } = setup({ app: 'Finder' });
  await commander.handle('go to youtube');
  assert.deepEqual(desktop.log, [['openUrl', 'https://youtube.com', 'Brave Browser']]);
});

test('scrolling outside a browser uses the native scroll', async () => {
  const { commander, desktop } = setup({ app: 'Finder' });
  await commander.handle('scroll down');
  assert.deepEqual(desktop.log, [['nativeScroll', 'down']]);
});

test('quit runs when the user said quit', async () => {
  const { commander, desktop, asked } = setup();
  await commander.handle('quitte l application');
  assert.deepEqual(asked, []);
  assert.deepEqual(desktop.log, [['keys', 'cmd+q', 'Brave Browser']]);
});

test('early run only when more words cannot change the meaning', async () => {
  const { commander } = setup();
  commander.apps = ['Brave Browser', 'Finder', 'Google Docs', 'Visual Studio Code'];
  assert.ok(commander.fixedNow('open Brave'));
  assert.ok(commander.fixedNow('copy'));
  assert.equal(commander.fixedNow('scroll'), null, '"scroll" may become "scroll up"');
  assert.equal(commander.fixedNow('go to google'), null, 'may become "go to google docs"');
  assert.equal(commander.fixedNow('quit'), null, 'quitting always waits for the end');
});

test('spoken addresses and chained commands', () => {
  assert.deepEqual(urlCandidates('go to example dot com slash jobs'), ['example.com/jobs']);
  assert.deepEqual(splitCommands('open Brave then go to LinkedIn'), ['open Brave', 'go to LinkedIn']);
  assert.deepEqual(splitCommands('ouvre Brave puis va sur LinkedIn'), ['ouvre Brave', 'va sur LinkedIn']);
});

// ---- Level 2: click by name ----

test('click by name: exact names, counters, kind words, French', async () => {
  for (const [cmd, id] of [['click Jobs', 'w1'], ['click the Jobs tab', 'w1'], ['open messaging', 'w2'], ['clique sur Jobs', 'w1'], ['press the Jobs link', 'w1']]) {
    const { commander, desktop } = setup();
    const [r] = await commander.handle(cmd);
    assert.equal(r.status, 'done', cmd);
    assert.deepEqual(desktop.log, [['press', id, undefined]], cmd);
  }
});

test('click by the start of a long name, when only one name starts that way', async () => {
  const { commander, desktop } = setup();
  await commander.handle('click easy apply');
  assert.deepEqual(desktop.log, [['press', 'w6', undefined]]);
});

test('two things with the same name: asks which, top to bottom', async () => {
  const { commander, desktop, asked } = setup({ answers: ['the second one'] });
  await commander.handle('click reply');
  assert.match(asked[0], /There are 2 reply\. Which one: first, second\?/);
  assert.deepEqual(desktop.log, [['press', 'w4', undefined]]);
  const b = setup({ answers: ['banana'] });
  const [r] = await b.commander.handle('click reply');
  assert.equal(r.status, 'failed');
  assert.deepEqual(b.desktop.log, []);
});

test('not on screen: looks again a few times, then says so without clicking', async () => {
  const { commander, desktop, said } = setup();
  const [r] = await commander.handle('click banana');
  assert.equal(r.status, 'failed');
  assert.ok(desktop.snapshots >= 4);
  assert.match(said[0], /I don't see banana/);
  assert.deepEqual(desktop.log, []);
});

test('a name that appears while the page loads is found on a second look', async () => {
  const { commander, desktop } = setup({ elements: [] });
  setTimeout(() => { desktop.elements = ELEMENTS; }, 300);
  const [r] = await commander.handle('click jobs');
  assert.equal(r.status, 'done');
  assert.deepEqual(desktop.log, [['press', 'w1', undefined]]);
});

test('buttons that cannot be undone: saying the word is the confirmation, otherwise ask', async () => {
  const a = setup();
  await a.commander.handle('click send');
  assert.deepEqual(a.asked, []);
  assert.deepEqual(a.desktop.log, [['press', 'w5', undefined]]);
  const b = setup({ elements: [{ id: 'w1', role: 'AXButton', label: 'Envoyer la candidature', pos: [0, 0] }], answers: ['no'] });
  await b.commander.handle('click la candidature');
  assert.equal(b.asked.length, 0, 'no match: "la candidature" is not the start of the name');
  const c = setup({ elements: [{ id: 'w1', role: 'AXButton', label: 'Submit application', pos: [0, 0] }], answers: ['no'] });
  await c.commander.handle('press submit application');
  assert.deepEqual(c.asked, [], 'the user said submit');
});

test('a risky name the user did not say asks first', async () => {
  const { commander, desktop, asked } = setup({ elements: [{ id: 'w1', role: 'AXButton', label: 'Continue and pay', pos: [0, 0] }], answers: ['no'] });
  await commander.handle('click continue');
  assert.match(asked[0], /That's "Continue and pay"\. Do it\?/);
  assert.deepEqual(desktop.log, [], 'the user said no');
  const d = setup({ elements: [{ id: 'w1', role: 'AXButton', label: 'Post now', pos: [0, 0] }], answers: ['no'] });
  await d.commander.handle('click post now');
  assert.deepEqual(d.asked, [], 'the user said post');
  const e = setup({ elements: [{ id: 'w1', role: 'AXButton', label: 'Continue to payment', pos: [0, 0] }], answers: ['no'] });
  await e.commander.handle('click continue');
  assert.deepEqual(e.desktop.log, [['press', 'w1', undefined]], 'payment is not in the risky list; "pay" is a whole word');
});

test('double and right click, tick and untick', async () => {
  const a = setup();
  await a.commander.handle('double click jobs');
  await a.commander.handle('right click jobs');
  assert.deepEqual(a.desktop.log, [['press', 'w1', 'double'], ['press', 'w1', 'right']]);
  const b = setup();
  await b.commander.handle('tick remember me');
  assert.deepEqual(b.desktop.log, [], 'already ticked');
  await b.commander.handle('untick remember me');
  assert.deepEqual(b.desktop.log, [['press', 'w7', undefined]]);
});

test('menu bar items only when nothing in the window has the name', async () => {
  const { commander, desktop } = setup();
  await commander.handle('click file');
  assert.deepEqual(desktop.log, [['press', 9, undefined]]);
});

test('level 1 comes first: keys and apps never read the screen', async () => {
  const { commander, desktop } = setup();
  await commander.handle('press enter');
  await commander.handle('select all');
  await commander.handle('open brave');
  assert.equal(desktop.snapshots, 0);
});

test('without a Jev answer, no early click', async () => {
  const { commander } = setup();
  assert.equal(commander.clickNow('click jobs'), false, 'no Jev answer yet');
});

// ---- Jev: decides every command about the screen ----

function withJev(decide, opts = {}) {
  const calls = [];
  const s = setup(opts);
  s.commander.jev = true;
  s.commander.understandFn = async ({ command, screen }) => {
    calls.push(command);
    const d = decide(command, screen);
    return { score: 0.9, top: [], action: d?.op ?? 'none', ...d, op: d?.op ?? null };
  };
  return { ...s, calls };
}
const byLabel = (l) => ELEMENTS.find((e) => e.label === l);

test('Jev decides exact names too', async () => {
  const { commander, desktop, calls } = withJev(() => ({ op: 'click', element: byLabel('Jobs') }));
  await commander.handle('click jobs');
  assert.deepEqual(calls, ['click jobs']);
  assert.deepEqual(desktop.log, [['press', 'w1', undefined]]);
});

test('Jev not sure, but one element has exactly that name: clicked by the code', async () => {
  const { commander, desktop } = withJev(() => null);
  const [r] = await commander.handle('click jobs');
  assert.equal(r.path, 'click');
  assert.deepEqual(desktop.log, [['press', 'w1', undefined]]);
});

test('Jev unreachable: the exact-name code takes over', async () => {
  const s2 = setup();
  s2.commander.jev = true;
  s2.commander.understandFn = async () => { throw new Error('network down'); };
  const [r] = await s2.commander.handle('click jobs');
  assert.equal(r.status, 'done');
  assert.deepEqual(s2.desktop.log, [['press', 'w1', undefined]]);
});

test('early run: once Jev answered for these words on this screen, sure and safe', async () => {
  const { commander } = withJev((cmd) => (cmd === 'clique sur offres' ? { op: 'click', element: byLabel('Jobs') } : { op: 'click', element: byLabel('Send') }));
  commander.lastActionAt = 0;
  await commander.prefetch();
  commander.speculate('clique sur offres');
  assert.equal(commander.clickNow('clique sur offres'), false, 'answer not back yet');
  await commander.speculation.promise;
  assert.equal(commander.clickNow('clique sur offres'), true);
  assert.equal(commander.clickNow('clique sur offres d emploi'), false, 'other words');
  commander.speculate('click send');
  await commander.speculation.promise;
  assert.equal(commander.clickNow('click send'), false, 'cannot be undone: waits for the end');
});

test('no exact name: Jev picks what was meant, without asking', async () => {
  const { commander, desktop, calls, asked } = withJev(() => ({ op: 'click', element: byLabel('Messaging 3') }));
  const [r] = await commander.handle('clique sur mes messages');
  assert.equal(r.status, 'done');
  assert.equal(r.path, 'jev');
  assert.deepEqual(calls, ['clique sur mes messages']);
  assert.deepEqual(asked, []);
  assert.deepEqual(desktop.log, [['press', 'w2', undefined]]);
});

test('not a click at all: Jev can open an app, go to a site, press a key or scroll', async () => {
  const decisions = { 'fire up brave': { op: 'open_app', app: 'Brave Browser' }, 'mets youtube': { op: 'open_site', site: 'youtube.com' }, 'mets la page a jour': { op: 'key', key: 'reload' }, 'va plus bas': { op: 'scroll', scroll: 'down' } };
  const { commander, desktop } = withJev((cmd) => decisions[cmd]);
  for (const cmd of Object.keys(decisions)) assert.equal((await commander.handle(cmd))[0].status, 'done', cmd);
  assert.deepEqual(desktop.log, [['openApp', 'Brave Browser'], ['openUrl', 'https://youtube.com', 'Brave Browser'], ['keys', 'cmd+r', 'Brave Browser'], ['scroll', 'down']]);
});

test('Jev not sure: nothing happens, no question', async () => {
  const { commander, desktop, asked, said, calls } = withJev(() => null);
  const [r] = await commander.handle('achete un billet pour lyon');
  assert.equal(r.status, 'failed');
  assert.equal(calls.length, 1, 'not about the screen: asked once, no second look');
  assert.deepEqual(desktop.log, []);
  assert.deepEqual(asked, []);
  assert.match(said[0], /didn't get that/);
});

test('a click Jev is not sure about: looks again (page loading), then "I don\'t see"; Jev only again if the screen changed', async () => {
  const { commander, desktop, calls, said } = withJev(() => null);
  await commander.handle('click banana');
  assert.equal(calls.length, 1, 'same screen: Jev asked once');
  assert.match(said[0], /I don't see banana/);
  assert.deepEqual(desktop.log, []);
});

test('Jev down: the command fails cleanly', async () => {
  const s = setup();
  s.commander.jev = true;
  s.commander.understandFn = async () => { throw new Error('Jev request failed (500)'); };
  const [r] = await s.commander.handle('mets la page a jour');
  assert.equal(r.status, 'failed');
  assert.deepEqual(s.desktop.log, []);
});

test('a button that cannot be undone, picked by Jev, still asks first', async () => {
  const { commander, desktop, asked } = withJev(() => ({ op: 'click', element: byLabel('Delete account') }), { answers: ['no'] });
  await commander.handle('click the red one at the bottom');
  assert.match(asked[0], /Delete account/);
  assert.deepEqual(desktop.log, []);
});

test('the answer asked while speaking is reused: one Jev call, ready early', async () => {
  const { commander, calls } = withJev(() => ({ op: 'click', element: byLabel('Jobs') }));
  commander.lastActionAt = 0;
  await commander.prefetch();
  commander.speculate('clique sur offres');
  const [r] = await commander.handle('clique sur offres');
  assert.equal(calls.length, 1);
  assert.equal(r.understood.early, true);
});

test('no Jev key: Jev never runs', async () => {
  const s = setup();
  let called = false;
  s.commander.understandFn = async () => { called = true; };
  await s.commander.handle('clique sur mes messages');
  await s.commander.handle('fire up brave');
  assert.equal(called, false);
});
