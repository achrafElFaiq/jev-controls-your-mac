// Settings, tokens and memory live in ~/.jev (override with JEV_HOME).
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_SANDBOX } from './sandbox.js';

export const HOME = process.env.JEV_HOME || join(homedir(), '.jev');

export const DEFAULTS = {
  jevKey: '',
  jevModel: 'jev-latest',
  // Your name as it appears on sites, so "my profile" / "my name" can be found.
  name: '',
  // Language model (ChatGPT plan) used only when a command needs several steps or writing.
  model: 'gpt-6-luna',
  effort: 'low',
  minConfidence: 0.35,
  maxElements: 200,
  locale: 'en-US',
  voice: '',
  rate: 200,
  silence: 0.9,
  // Files may only be changed inside this folder (set to false to remove the limit).
  sandbox: DEFAULT_SANDBOX,
  // Browser used for "go to <website>" when no browser is in front.
  browser: 'Brave Browser',
  // Jev price in $ per million input tokens (TypeSafe's published price), for cost metrics.
  jevPricePerMTok: 0.042,
};

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(join(HOME, name), 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(name, data, secret = false) {
  await mkdir(HOME, { recursive: true });
  const path = join(HOME, name);
  await writeFile(path, JSON.stringify(data, null, 2));
  if (secret) await chmod(path, 0o600);
}

export async function loadConfig() {
  const config = { ...DEFAULTS, ...(await readJson('config.json', {})) };
  if (process.env.JEV_API_KEY) config.jevKey = process.env.JEV_API_KEY;
  return config;
}

export const saveConfig = (config) => writeJson('config.json', config, true);
export const loadAuth = () => readJson('auth.json', null);
export const saveAuth = (auth) => writeJson('auth.json', auth, true);

export async function loadMemory() {
  try {
    return await readFile(join(HOME, 'memory.txt'), 'utf8');
  } catch {
    return '';
  }
}

export async function saveMemory(text) {
  await mkdir(HOME, { recursive: true });
  await writeFile(join(HOME, 'memory.txt'), text);
}
