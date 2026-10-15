#!/usr/bin/env node
// Saves what Jev reads on the current screen as a test fixture, without personal details.
//
//   node scripts/capture.js <name> [url]
//
// With a url, it is opened in the browser first; with an app name, that app is brought to the front. The screen goes to test/screens/<name>.json.
// Personal details are removed: your name, email addresses, long numbers, the contents of
// text fields, and in mail apps the email rows themselves (sender and subject).
import { writeFile, mkdir } from 'node:fs/promises';
import { Desktop } from '../src/desktop.js';
import { loadConfig } from '../src/config.js';

const [name, target] = process.argv.slice(2);
if (!name) {
  console.log('Usage: node scripts/capture.js <name> [url | app name]');
  process.exit(1);
}
const config = await loadConfig();
const desktop = new Desktop();
const url = /^https?:/.test(target ?? '') ? target : null;
if (target && !url) {
  await desktop.openApp(target);
  await new Promise((r) => setTimeout(r, 1500));
}
let screen;
// The browser must be the app in front: Jev reads the front app.
if (url) {
  await desktop.openUrl(url, config.browser);
  await desktop.activateApp(config.browser);
}
// Wait until the new tab is in front and loaded (its address and some elements), up to 20 s.
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, url ? 1000 : 0));
  screen = await desktop.snapshot({ maxElements: 200 });
  const host = url && new URL(url).hostname.replace(/^www\./, '');
  if (!url || (screen.url?.includes(host) && screen.elements.filter((e) => typeof e.id === 'string').length > 10)) break;
}
// A moment more for content that loads after the page itself.
if (url) {
  await new Promise((r) => setTimeout(r, 2000));
  screen = await desktop.snapshot({ maxElements: 200 });
}
desktop.close();
if (url && !screen.url?.includes(new URL(url).hostname.replace(/^www\./, ''))) throw new Error(`${url} didn't load in time; nothing saved`);

const nameWords = String(config.name || '').split(/\s+/).filter((w) => w.length > 1);
const isMail = /mail\.google|outlook/.test(screen.url ?? '') || screen.app === 'Mail';
let rows = 0;
const redact = (text) => {
  let t = String(text ?? '');
  if (config.name) t = t.replace(new RegExp(config.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'User Name');
  for (const w of nameWords) t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), 'User');
  return t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'someone@example.com').replace(/\d[\d\s.-]{7,}\d/g, '0000000');
};

const elements = screen.elements.map((e) => {
  const item = { id: e.id, role: e.role, label: redact(e.label) };
  // Email rows hold the sender and subject: kept only as "Email 1", "Email 2"…
  if (isMail && /Row/.test(e.role)) item.label = `Email ${++rows}`;
  if (/CheckBox|RadioButton/.test(e.role) && e.value != null) item.value = e.value;
  for (const k of ['placeholder', 'disabled', 'selected', 'inDialog', 'offscreen', 'pos', 'frame']) if (e[k] != null) item[k] = k === 'placeholder' ? redact(e[k]) : e[k];
  return item;
});
const page = screen.url ? new URL(screen.url) : null;
const out = { app: screen.app, url: page ? `${page.origin}${page.pathname}` : undefined, elements };
await mkdir(new URL('../test/screens/', import.meta.url), { recursive: true });
await writeFile(new URL(`../test/screens/${name}.json`, import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${name}: ${screen.app}${out.url ? ` ${out.url}` : ''}, ${elements.length} elements`);
