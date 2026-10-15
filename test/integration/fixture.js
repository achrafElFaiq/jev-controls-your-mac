// Launches bin/JevFixture.app and exposes its recorded state.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BINARY = fileURLToPath(new URL('../../bin/JevFixture.app/Contents/MacOS/JevFixture', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchFixture(desktop) {
  if (!existsSync(BINARY)) throw new Error('Fixture not built, run "npm run build"');
  const statePath = join(tmpdir(), `jev-fixture-${process.pid}-${Date.now()}.json`);
  const proc = spawn(BINARY, [], { env: { ...process.env, JEV_FIXTURE_STATE: statePath }, stdio: 'ignore' });

  const state = () => (existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null);
  for (let i = 0; i < 50 && !state(); i++) await sleep(100);
  await focus();

  async function focus() {
    for (let i = 0; i < 20; i++) {
      await desktop.activateApp('JevFixture').catch(() => {});
      if ((await desktop.frontmost()).app === 'JevFixture') return;
      await sleep(150);
    }
    throw new Error('Could not bring JevFixture to the front');
  }

  /** Polls until the predicate holds on the recorded state (UI updates are async). */
  async function waitFor(predicate, ms = 3000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = state();
      if (s && predicate(s)) return s;
      await sleep(50);
    }
    return state();
  }

  return {
    state,
    waitFor,
    focus,
    close() {
      proc.kill();
      rmSync(statePath, { force: true });
    },
  };
}
