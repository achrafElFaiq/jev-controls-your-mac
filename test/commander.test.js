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

test('early click: only with a fresh screen, one exact match, nothing continuing it, nothing risky', async () => {
  const { commander } = setup({ elements: [...ELEMENTS, { id: 'w20', role: 'AXButton', label: 'Save', pos: [0, 0] }, { id: 'w21', role: 'AXButton', label: 'Save as draft', pos: [0, 0] }] });
  assert.equal(commander.clickNow('click jobs'), false, 'no screen read yet');
  commander.lastActionAt = 0;
  await commander.prefetch();
  assert.equal(commander.clickNow('click jobs'), true);
  assert.equal(commander.clickNow('click reply'), false, 'two of them');
  assert.equal(commander.clickNow('click save'), false, 'may become "save as draft"');
  assert.equal(commander.clickNow('click send'), false, 'cannot be undone');
  assert.equal(commander.clickNow('click easy apply'), false, 'not an exact name');
});
