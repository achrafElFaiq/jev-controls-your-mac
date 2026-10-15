#!/usr/bin/env node
// jev            voice mode: say commands, Jev does them
// jev --text     type commands instead (Jev still speaks when it needs to)
// jev run "…"    run one command and exit (prints timings as JSON)
// jev setup      macOS permissions
// jev doctor     check that everything is ready
// Say or type "see" to list what's on screen (debugging).
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Commander, listScreen } from './commander.js';
import { loadConfig } from './config.js';
import { Desktop } from './desktop.js';
import { Sandbox } from './sandbox.js';
import { Speaker } from './speaker.js';
import { normalize, splitCommands } from './commands.js';
import { speechHints } from './fixed.js';

const STOP = /^(stop|cancel|never ?mind|arrête|stop it)\b/i;
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const command = args.find((a) => !a.startsWith('--')) ?? 'voice';
const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

// A short sound instead of a spoken "done": faster to hear, doesn't block the mic.
const chime = (sound = 'Tink') => execFile('afplay', ['-v', '0.6', `/System/Library/Sounds/${sound}.aiff`], () => {});

async function doctor({ prompt = false } = {}) {
  const config = await loadConfig();
  const desktop = new Desktop();
  const perms = await desktop.permissions(prompt);
  desktop.close();
  const row = (ok, label, hint) => console.log(`${ok ? c.green('✓') : c.red('✗')} ${label}${ok ? '' : c.dim(`  → ${hint}`)}`);
  row(perms.accessibility, 'Accessibility permission', 'System Settings → Privacy & Security → Accessibility → enable your terminal app');
  row(perms.microphone !== 'denied', `Microphone (${perms.microphone})`, 'System Settings → Privacy & Security → Microphone');
  row(perms.speech !== 'denied', `Speech recognition (${perms.speech})`, 'System Settings → Privacy & Security → Speech Recognition');
  return perms.accessibility;
}

async function setup() {
  console.log('Requesting permissions (accept the macOS prompts)…');
  await doctor({ prompt: true });
}

/** Next line the user says or types. */
class InputQueue {
  constructor() { this.waiters = []; this.items = []; }
  push(text) { const w = this.waiters.shift(); w ? w(text) : this.items.push(text); }
  next() { return this.items.length ? Promise.resolve(this.items.shift()) : new Promise((r) => this.waiters.push(r)); }
  get waiting() { return this.waiters.length > 0; }
}

function createCommander({ config, desktop, speaker, answers }) {
  const ui = {
    say: async (text) => { console.log(c.cyan(`jev: ${text}`)); await speaker.speak(text); },
    ask: async (question) => { console.log(c.cyan(`jev: ${question}`)); await speaker.speak(question); return answers.next(); },
    log: (_kind, text) => console.log(c.dim(`  ${text}`)),
    show: (lines) => console.log(c.dim(lines.join('\n'))),
  };
  return new Commander({ desktop, ui, config });
}

const timing = (r) => `[${r.status} · ${r.op ?? 'unknown'} · ${(r.totalMs / 1000).toFixed(2)}s · action ${(r.actionMs / 1000).toFixed(2)}s]`;

async function interactive({ voice }) {
  const config = await loadConfig();
  if (!(await doctor())) {
    console.log(c.red('\nFix the items above first (jev setup).'));
    process.exit(1);
  }
  const desktop = new Desktop();
  if (config.sandbox) {
    await new Sandbox({ root: config.sandbox }).ensure();
    console.log(c.dim(`Files: Jev may only change files in ${config.sandbox}`));
  }
  const speaker = new Speaker({
    voice: config.voice,
    rate: config.rate,
    mute: flag('quiet'),
    onIdle: () => voice && desktop.listenReset().catch(() => {}), // drop what the mic heard of our own voice
  });
  const answers = new InputQueue();
  const commander = createCommander({ config, desktop, speaker, answers });
  commander.installedApps();

  let running = Promise.resolve();
  let busy = false;
  const onUtterance = (text) => {
    text = text.trim();
    if (!text) return;
    if (STOP.test(text)) {
      speaker.stop();
      if (answers.waiting) answers.push('no');
      console.log(c.bold(`you: ${text}`));
      return;
    }
    if (voice && speaker.speaking) return;
    console.log(c.bold(`you: ${text}`));
    if (answers.waiting) return answers.push(text);
    running = running.then(async () => {
      busy = true;
      try { await runOne(text); } finally { busy = false; }
    });
  };
  const runOne = async (text) => {
    // "see": print everything Jev can act on right now.
    if (/^(see|:see|debug see)$/i.test(text)) {
      commander.invalidate();
      console.log(c.dim(listScreen(await commander.prefetch()).join('\n')));
      return;
    }
    for (const r of await commander.handle(text)) {
      console.log(c.dim(`  ${timing(r)}`));
      if (r.status === 'done') chime();
    }
  };

  if (voice) {
    // A command that more words can't change ("open Brave", "click Jobs" when exactly one
    // Jobs is on screen) runs as soon as the words stop changing for `early` ms, without
    // waiting for the end-of-speech silence. Set "early": 0 to turn off.
    const earlyMs = config.early ?? 300;
    let earlyTimer = null;
    let ranEarly = null; // { text, at }: the end of that sentence must not run it again
    let partial = null; // { text, at } while the user is speaking
    const considerEarly = () => {
      clearTimeout(earlyTimer);
      if (!partial || earlyMs <= 0 || answers.waiting) return;
      const { text } = partial;
      if (!commander.fixedNow(text) && !commander.clickNow(text)) return;
      earlyTimer = setTimeout(() => {
        ranEarly = { text: normalize(text), at: Date.now() };
        partial = null;
        desktop.listenReset().catch(() => {});
        stdout.write('\r\x1b[2K');
        onUtterance(text);
      }, Math.max(0, earlyMs - (Date.now() - partial.at)));
    };
    desktop.on('partial', ({ text }) => {
      if (speaker.speaking) return;
      stdout.write(`\r\x1b[2K${c.dim(text)}`);
      partial = { text, at: Date.now() };
      // Read the screen while the user is still talking, unless it's a fixed command.
      if (!commander.fixed(text)) commander.prefetch();
      considerEarly();
    });
    // Names on screen are words the recognizer should expect ("Candidature simplifiée").
    const baseHints = speechHints(await commander.installedApps());
    let lastHints = '';
    commander.onScreen = (screen) => {
      if (partial) considerEarly(); // the screen arrived after the last words
      const labels = [...new Set((screen.elements ?? []).map((e) => e.label).filter((l) => l && l.length <= 40))].slice(0, 150);
      const key = labels.join('|');
      if (key === lastHints) return;
      lastHints = key;
      desktop.request('listen_hints', { hints: [...labels, ...baseHints] }).catch(() => {});
    };
    // Keep the screen read fresh while idle, so names are known before the next command.
    setInterval(() => { if (!busy && !partial && !speaker.speaking) commander.prefetch(); }, 4000).unref();
    desktop.on('utterance', ({ text }) => {
      clearTimeout(earlyTimer);
      partial = null;
      stdout.write('\r\x1b[2K');
      // The same sentence, finished after it already ran early: run only what came after.
      if (ranEarly && Date.now() - ranEarly.at < 3000) {
        const parts = splitCommands(text);
        const same = normalize(parts[0]) === ranEarly.text;
        ranEarly = null;
        if (same) {
          if (parts.length > 1) onUtterance(parts.slice(1).join(' then '));
          return;
        }
      }
      onUtterance(text);
    });
    desktop.on('listen_error', ({ error }) => console.log(c.red(`mic: ${error}`)));
    await desktop.listen(true, { locale: config.locale, silence: config.silence, hints: baseHints });
    commander.prefetch();
    console.log(c.green('Listening. Say a command. Ctrl+C to quit.'));
    chime('Pop');
  } else {
    console.log(c.green('Type a command. "see" lists what\'s on screen. Ctrl+C quits.'));
  }
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  rl.on('line', onUtterance);
  rl.on('close', () => { if (!voice) running.then(() => { desktop.close(); process.exit(0); }); });
  process.on('SIGINT', () => { speaker.stop(); desktop.close(); process.exit(0); });
}

async function runOnce(text) {
  const config = await loadConfig();
  const desktop = new Desktop();
  if (config.sandbox) await new Sandbox({ root: config.sandbox }).ensure();
  const answers = new InputQueue();
  answers.next = async () => (flag('yes') ? 'yes' : 'no');
  const commander = createCommander({ config, desktop, speaker: new Speaker({ mute: true }), answers });
  const results = await commander.handle(text);
  desktop.close();
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.every((r) => r.status === 'done') ? 0 : 1);
}

switch (command) {
  case 'setup': await setup(); break;
  case 'doctor': process.exit((await doctor()) ? 0 : 1);
  case 'run': await runOnce(args.filter((a) => !a.startsWith('--')).slice(1).join(' ')); break;
  case 'voice': await interactive({ voice: !flag('text') }); break;
  default: console.log('Usage: jev [--text] [--quiet] | jev run "<command>" [--yes] | jev setup | jev doctor');
}
