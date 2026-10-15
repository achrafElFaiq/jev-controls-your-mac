import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Commander } from '../src/commander.js';
import { splitCommands, urlCandidates } from '../src/commands.js';

function fakeDesktop(app = 'Brave Browser') {
  const log = [];
  let snapshots = 0;
  return {
    log,
    get snapshots() { return snapshots; },
    snapshot: async () => { snapshots++; return { app, window: '', elements: [] }; },
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

function setup({ answers = [], app } = {}) {
  const desktop = fakeDesktop(app);
  const said = [];
  const asked = [];
  const ui = { say: async (t) => said.push(t), ask: async (q) => { asked.push(q); return answers.shift() ?? 'no'; }, log: () => {} };
  const commander = new Commander({ desktop, ui, config: { browser: 'Brave Browser', log: false, sandbox: false } });
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
  for (const cmd of ['click new chat', 'open the first email', 'type hello', 'mumble']) {
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
