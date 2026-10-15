import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sandbox, pathsIn } from '../src/sandbox.js';

const root = mkdtempSync(join(tmpdir(), 'jev-sandbox-'));
mkdirSync(join(root, 'my-project'));
test.after(() => rmSync(root, { recursive: true, force: true }));

function finderDesktop(answer) {
  return { request: async (cmd) => { assert.equal(cmd, 'applescript'); return answer; } };
}

test('paths inside the sandbox are allowed, outside and the root itself (for items) are not', () => {
  const s = new Sandbox({ root });
  assert.ok(s.contains(join(root, 'a.txt')));
  assert.ok(s.contains(root));
  assert.ok(!s.contains(root, { allowRoot: false }));
  assert.ok(!s.contains(`${root}-evil/a.txt`), 'prefix trick');
  assert.ok(!s.contains(join(homedir(), 'Documents')));
});

test('typed text that points outside the sandbox is refused', () => {
  const s = new Sandbox({ root });
  assert.equal(s.checkText('python3 app.py'), null);
  assert.equal(s.checkText(`cd "${root}/my-project" && ls`), null);
  assert.equal(s.checkText('https://example.com/login'), null, 'URLs are not paths');
  assert.equal(s.checkText('/login'), null, 'web paths are not file paths');
  assert.match(s.checkText('rm -rf ~/Documents'), /outside/);
  assert.match(s.checkText('cat /etc/passwd'), /outside/);
  assert.match(s.checkText('cd ../..'), /relative/);
  assert.match(s.checkText('sudo rm x'), /sudo/);
  assert.match(s.checkText("open '/Users/someone/My Files/x.txt'"), /outside/);
});

test('pathsIn finds quoted paths with spaces', () => {
  assert.deepEqual(pathsIn(`cp "/Users/a/Jev Sandbox/x" ~/y`), ['/Users/a/Jev Sandbox/x', '~/y']);
});

test('Finder: the open folder and selected items must be inside', async () => {
  assert.equal(await new Sandbox({ root, desktop: finderDesktop(`${root}/\nsel:${root}/a.txt`) }).checkContext({ app: 'Finder' }), null);
  assert.match(await new Sandbox({ root, desktop: finderDesktop(`${homedir()}/Documents/`) }).checkContext({ app: 'Finder' }), /outside/);
  assert.match(await new Sandbox({ root, desktop: finderDesktop(`${root}/\nsel:${homedir()}/Desktop/a.txt`) }).checkContext({ app: 'Finder' }), /selected item/);
  assert.match(await new Sandbox({ root, desktop: finderDesktop(`${homedir()}/Desktop/\nsel:${root}`) }).checkContext({ app: 'Finder' }), /outside/, 'the sandbox folder itself cannot be renamed or deleted');
});

test('IDE windows must show a project inside the sandbox; standalone terminals are refused', async () => {
  const s = new Sandbox({ root });
  assert.equal(await s.checkContext({ app: 'Code', window: 'app.py — my-project — Visual Studio Code' }), null);
  assert.match(await s.checkContext({ app: 'Code', window: 'index.ts — work-repo — Visual Studio Code' }), /isn't a project/);
  assert.match(await s.checkContext({ app: 'Terminal', window: 'zsh' }), /Terminal/);
  assert.equal(await s.checkContext({ app: 'Brave Browser', window: 'Gmail' }), null, 'web is not restricted');
});
