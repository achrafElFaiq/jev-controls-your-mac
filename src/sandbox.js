// File sandbox: Jev may only create, change or delete files inside one folder
// (default ~/Desktop/Jev Sandbox). Web browsing and apps are not restricted.
//
// Jev works through the GUI, so this can't be an OS-level sandbox. Instead every
// modifying action is checked first:
//   - text it types (terminal commands, "Go to folder" paths, file names) must not
//     reference paths outside the sandbox
//   - in Finder, the open folder and the selected items must be inside the sandbox
//   - in an IDE, the open project must be inside the sandbox
//   - standalone terminals (Terminal, iTerm) are off-limits
// The benchmark additionally watches your real folders to catch anything that slips through.
import { mkdir, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';

export const DEFAULT_SANDBOX = join(homedir(), 'Desktop', 'Jev Sandbox');
const IDES = new Set(['Code', 'Visual Studio Code', 'Cursor', 'PyCharm', 'Xcode', 'Zed', 'Sublime Text', 'IntelliJ IDEA', 'WebStorm']);
const TERMINALS = new Set(['Terminal', 'iTerm2', 'iTerm', 'Warp', 'Ghostty', 'Alacritty', 'kitty']);

export class Sandbox {
  constructor({ root = DEFAULT_SANDBOX, desktop } = {}) {
    this.root = normalize(resolve(expand(root)));
    this.desktop = desktop;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  /** Inside the sandbox (the root itself counts only when allowRoot). */
  contains(path, { allowRoot = true } = {}) {
    const p = normalize(resolve(expand(path)));
    return (allowRoot && p === this.root) || p.startsWith(this.root + '/');
  }

  /** Reason the text can't be typed, or null. Catches paths and commands that escape. */
  checkText(text) {
    if (!text) return null;
    if (/(^|[\s;&|(])sudo\s/.test(text)) return 'uses sudo';
    for (const p of pathsIn(text)) {
      if (p.includes('..')) return `uses a relative "${p}" path that could leave the sandbox`;
      if ((p.startsWith('/') || p.startsWith('~')) && !this.contains(p)) return `refers to ${p}, outside ${this.root}`;
    }
    return null;
  }

  /**
   * Reason a modifying action in the front app isn't allowed, or null.
   * `screen` is the agent's last look: { app, window }.
   */
  async checkContext(screen) {
    if (TERMINALS.has(screen.app)) return `${screen.app} is outside the sandbox rules; use the terminal inside the IDE, in a project under ${this.root}`;
    if (screen.app === 'Finder') return this.checkFinder();
    if (IDES.has(screen.app)) return this.checkIde(screen.window);
    return null;
  }

  async checkFinder() {
    const out = await this.desktop.request('applescript', {
      source: `tell application "Finder"
        set out to ""
        if (count of Finder windows) > 0 then set out to POSIX path of (target of front Finder window as alias)
        repeat with i in (get selection)
          set out to out & linefeed & "sel:" & POSIX path of (i as alias)
        end repeat
        return out
      end tell`,
    }).catch(() => null);
    if (out === null) return null; // couldn't ask Finder; the benchmark's file watch still applies
    const [folder, ...selected] = out.split('\n').filter(Boolean);
    if (folder && !folder.startsWith('sel:') && !this.contains(folder)) return `Finder is showing ${folder}, outside ${this.root}`;
    for (const s of selected.map((l) => l.replace(/^sel:/, ''))) {
      if (!this.contains(s, { allowRoot: false })) return `the selected item ${s} is outside the sandbox`;
    }
    return null;
  }

  async checkIde(windowTitle = '') {
    // IDE titles show the project folder name, e.g. "app.py — my-project — Visual Studio Code".
    const projects = (await readdir(this.root, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
    const sandboxName = this.root.split('/').pop();
    const ok = [sandboxName, ...projects].some((name) => windowTitle.includes(name));
    return ok ? null : `the IDE window "${windowTitle}" isn't a project inside ${this.root}`;
  }
}

function expand(p) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

/** Path-like tokens in typed text, including quoted paths with spaces. */
export function pathsIn(text) {
  const paths = [];
  const quoted = /(["'])((?:~|\.\.|\/)[^"']*)\1/g;
  let rest = text.replace(quoted, (_m, _q, p) => { paths.push(p); return ' '; });
  for (const token of rest.split(/[\s;&|()<>]+/)) {
    const t = token.replace(/\\ /g, ' ');
    if (t === '~' || t.startsWith('~/') || t.startsWith('/') || t.startsWith('../') || t === '..') paths.push(t);
  }
  // Absolute paths only count when they point into the real file system, so web text like
  // "/login" or "1/2" isn't mistaken for a file path.
  return paths.filter((p) => p.startsWith('~') || p.includes('..') || (isAbsolute(p) && FS_ROOTS.test(p)));
}

const FS_ROOTS = /^\/($|(Users|Volumes|private|System|Library|Applications|etc|tmp|var|opt|usr|bin|sbin|dev|cores|Network|home)(\/|$))/;
