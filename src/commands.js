// The fixed vocabulary: keyboard actions, known websites, and helpers for reading what
// the user said.
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Keyboard actions: name → [description, key combo]. Phrasings are in fixed.js.
export const KEYS = {
  enter: ['press enter / return / submit the line', 'return'],
  escape: ['escape / cancel / close the popup', 'escape'],
  tab: ['tab / next field', 'tab'],
  shift_tab: ['previous field', 'shift+tab'],
  copy: ['copy', 'cmd+c'],
  paste: ['paste', 'cmd+v'],
  cut: ['cut', 'cmd+x'],
  undo: ['undo', 'cmd+z'],
  redo: ['redo', 'cmd+shift+z'],
  select_all: ['select all', 'cmd+a'],
  save: ['save', 'cmd+s'],
  find: ['find / search in page', 'cmd+f'],
  new_tab: ['new tab', 'cmd+t'],
  close_tab: ['close tab / close this', 'cmd+w'],
  reopen_tab: ['reopen closed tab', 'cmd+shift+t'],
  next_tab: ['next tab', 'ctrl+tab'],
  previous_tab: ['previous tab', 'ctrl+shift+tab'],
  reload: ['reload / refresh the page', 'cmd+r'],
  back: ['go back / previous page', 'cmd+['],
  forward: ['go forward / next page', 'cmd+]'],
  address_bar: ['go to the address bar', 'cmd+l'],
  new_window: ['new window', 'cmd+n'],
  zoom_in: ['zoom in', 'cmd+='],
  zoom_out: ['zoom out', 'cmd+-'],
  up: ['arrow up', 'up'],
  down: ['arrow down', 'down'],
  left: ['arrow left', 'left'],
  right: ['arrow right', 'right'],
  page_down: ['page down', 'pagedown'],
  page_up: ['page up', 'pageup'],
  backspace: ['delete the previous character', 'backspace'],
  space: ['space bar / play / pause', 'space'],
  minimize: ['minimize the window', 'cmd+m'],
  quit_app: ['quit the application', 'cmd+q'],
  spotlight: ['open spotlight search', 'cmd+space'],
};

// Keys that change or lose something; they need the sandbox check, and some a confirmation.
export const RISKY_KEYS = new Set(['quit_app']);
export const MODIFYING_KEYS = new Set(['paste', 'cut', 'undo', 'redo', 'save', 'backspace']);

// Websites by spoken name.
export const SITES = {
  'linkedin.com': 'LinkedIn', 'mail.google.com': 'Gmail, Google mail', 'google.com': 'Google search',
  'youtube.com': 'YouTube', 'github.com': 'GitHub', 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude',
  'drive.google.com': 'Google Drive', 'docs.google.com': 'Google Docs', 'sheets.google.com': 'Google Sheets',
  'calendar.google.com': 'Google Calendar', 'maps.google.com': 'Google Maps', 'google.com/travel/flights': 'Google Flights',
  'amazon.fr': 'Amazon', 'netflix.com': 'Netflix', 'x.com': 'X, Twitter', 'facebook.com': 'Facebook',
  'instagram.com': 'Instagram', 'web.whatsapp.com': 'WhatsApp', 'outlook.live.com': 'Outlook', 'notion.so': 'Notion',
  'figma.com': 'Figma', 'stackoverflow.com': 'Stack Overflow', 'wikipedia.org': 'Wikipedia', 'reddit.com': 'Reddit',
  'open.spotify.com': 'Spotify', 'indeed.com': 'Indeed', 'welcometothejungle.com': 'Welcome to the Jungle',
  'leboncoin.fr': 'Leboncoin', 'booking.com': 'Booking', 'perplexity.ai': 'Perplexity', 'gemini.google.com': 'Gemini',
  'translate.google.com': 'Google Translate', 'news.ycombinator.com': 'Hacker News',
};

/** Web addresses spoken in the sentence ("linkedin dot com", "example.org/jobs"). */
export function urlCandidates(utterance) {
  const text = utterance.toLowerCase().replace(/\s+dot\s+/g, '.').replace(/\s+point\s+/g, '.').replace(/\s+slash\s+/g, '/');
  return [...new Set((text.match(/\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|fr|org|net|io|ai|dev|co|app|edu|gov|me|so|uk|de|es|eu|info)(\/[^\s,]*)?/g) ?? []))];
}

/** Split "open Brave then go to LinkedIn" into separate commands. */
export function splitCommands(utterance) {
  return utterance.split(/\s*(?:,\s*)?\b(?:and then|then|after that|puis|ensuite|et puis)\b\s*/i).map((s) => s.trim()).filter(Boolean);
}

/** Folders and files the user may open by name: the sandbox tree plus the usual places. */
export async function placeCandidates(sandboxRoot, { depth = 3, max = 150 } = {}) {
  const home = homedir();
  const places = {
    [join(home, 'Desktop')]: 'Desktop folder',
    [join(home, 'Documents')]: 'Documents folder',
    [join(home, 'Downloads')]: 'Downloads folder',
    [home]: 'Home folder',
    '/Applications': 'Applications folder',
  };
  if (sandboxRoot) {
    places[sandboxRoot] = 'Jev Sandbox folder (the sandbox)';
    const walk = async (dir, level) => {
      if (level > depth || Object.keys(places).length >= max) return;
      for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
        const p = join(dir, e.name);
        places[p] = `${e.isDirectory() ? 'folder' : 'file'} ${e.name} (in ${dir === sandboxRoot ? 'the sandbox' : dir.split('/').pop()})`;
        if (e.isDirectory()) await walk(p, level + 1);
        if (Object.keys(places).length >= max) return;
      }
    };
    await walk(sandboxRoot, 1);
  }
  return places;
}

/** Lowercase, no accents or punctuation: for comparing what was said with on-screen labels. */
export const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
