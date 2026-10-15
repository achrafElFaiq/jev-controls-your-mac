// Bridge to the native helper (bin/jevhelper), which does the Accessibility,
// input and speech work. Requests and events are JSON lines over stdio.
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Web, isBrowser, isWebId } from './web.js';

export const HELPER_PATH = fileURLToPath(new URL('../bin/jevhelper', import.meta.url));

export class Desktop extends EventEmitter {
  constructor(path = HELPER_PATH) {
    super();
    if (!existsSync(path)) throw new Error('Native helper not built, run "npm run build"');
    this.proc = spawn(path, [], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.pending = new Map();
    this.web = new Web(this);
    this.browser = null; // browser app whose page elements were in the last snapshot
    this.nextId = 1;
    createInterface({ input: this.proc.stdout }).on('line', (line) => this.onLine(line));
    this.proc.on('exit', (code) => {
      for (const { reject } of this.pending.values()) reject(new Error(`Helper exited (${code})`));
      this.pending.clear();
      this.emit('exit', code);
    });
  }

  onLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.event) return this.emit(msg.event, msg);
    const p = this.pending.get(msg.rid);
    if (!p) return;
    this.pending.delete(msg.rid);
    msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
  }

  request(cmd, args = {}, timeoutMs = 15_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Helper timed out on ${cmd}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      // `rid` is the request id; `args.id` (an element id) must never overwrite it.
      this.proc.stdin.write(JSON.stringify({ ...args, cmd, rid: id }) + '\n');
    });
  }

  /**
   * Elements and visible text of the front window. In browsers, the page's own elements
   * (ids like "w12") come first, followed by the browser's buttons and tabs.
   */
  async snapshot(opts = {}) {
    const native = await this.request('snapshot', opts);
    this.browser = null;
    if (!isBrowser(native.app)) return native;
    try {
      const page = await this.web.snapshot(native.app, { maxElements: opts.maxElements ?? 200 });
      this.browser = native.app;
      const chrome = native.elements.filter((e) => e.role !== 'AXMenuBarItem').slice(0, 40);
      return { ...native, url: page.url, elements: [...page.elements, ...chrome], text: `Page: ${page.title} (${page.url})\n${page.text}` };
    } catch (err) {
      return { ...native, text: `(Can't read the web page: ${err.message})\n${native.text}` };
    }
  }

  async readText() {
    const front = await this.frontmost();
    if (isBrowser(front.app)) {
      try {
        return { app: front.app, window: '', text: await this.web.readText(front.app) };
      } catch {}
    }
    return this.request('read_text');
  }

  async press(id, mode) {
    if (!isWebId(id)) return this.request('press', { id, mode });
    const target = await this.web.action(this.browser, { name: 'describe', id });
    // File pickers and right/double clicks need a real mouse click.
    if (target.type === 'file' || mode === 'double' || mode === 'right') {
      await this.request('click_at', { ...target.point, app: this.browser, count: mode === 'double' ? 2 : 1, right: mode === 'right' });
      return mode ? `${mode}-clicked` : 'clicked';
    }
    return (await this.web.action(this.browser, { name: 'click', id })).result;
  }

  async setText(id, text, append = false) {
    if (!isWebId(id)) return this.request('set_text', { id, text, append });
    return (await this.web.action(this.browser, { name: 'set_text', id, text, append })).result;
  }

  /** Options of a dropdown (native pop-up or HTML <select>), or null for custom dropdowns. */
  async options(id) {
    if (isWebId(id)) return (await this.web.action(this.browser, { name: 'describe', id })).options;
    return this.request('options', { id }).catch(() => null);
  }

  async select(id, option) {
    if (!isWebId(id)) return this.request('select', { id, option });
    return (await this.web.action(this.browser, { name: 'select', id, option })).result;
  }
  // `app` (optional): the app that must be in front, or the helper refuses to send input.
  type(text, app) { return this.request('type', { text, app }); }
  keys(keys, app) { return this.request('keys', { keys, app }); }
  async scroll(direction, id, app) {
    // In browsers, scroll the page itself (works wherever the mouse happens to be).
    if (this.browser && (isWebId(id) || id === undefined)) {
      try { return await this.web.scroll(this.browser, direction); } catch {}
    }
    return this.request('scroll', { direction, id: isWebId(id) ? undefined : id, app });
  }
  openApp(name) { return this.request('open_app', { name }); }
  openUrl(url, app) { return this.request('open_url', { url, app }); }
  activateApp(name) { return this.request('activate_app', { name }); }
  frontmost() { return this.request('frontmost'); }
  runningApps() { return this.request('running_apps'); }
  permissions(prompt = false) { return this.request('permissions', { prompt }, 180_000); }
  listen(on, opts = {}) { return this.request('listen', { on, ...opts }); }
  listenReset() { return this.request('listen_reset'); }
  // Every open window and browser tab, on all screens.
  windows() { return this.request('windows', {}, 20_000); }
  focusWindow(entry) { return this.request('focus_window', entry); }

  close() {
    this.proc.stdin.end();
    this.proc.kill();
  }
}
