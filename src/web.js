// Web pages in browsers. Brave and other Chromium browsers don't expose page content to
// the Accessibility API unless a screen reader is running, so for the front tab Jev runs
// small scripts in the page (through AppleScript) to list elements and act on them.
// Requires, once per browser: View > Developer > Allow JavaScript from Apple Events
// (Safari: Settings > Advanced > Show features for web developers, then Develop > Allow JavaScript from Apple Events).

export const BROWSERS = new Set(['Brave Browser', 'Google Chrome', 'Microsoft Edge', 'Arc', 'Chromium', 'Vivaldi', 'Safari']);

// ---- functions below run inside the page; they must be self-contained ----

function pageSnapshot(maxElements, maxText) {
  const SELECTOR = 'a[href], button, input, textarea, select, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=menuitemcheckbox], [role=option], [role=checkbox], [role=radio], [role=switch], [role=combobox], [role=searchbox], [role=textbox], [role=row], [role=treeitem], [contenteditable=""], [contenteditable=true], [onclick]';
  window.__jevNextId = window.__jevNextId || 1;
  const clean = (t, n) => (t || '').replace(/\s+/g, ' ').trim().slice(0, n || 80);
  // Rendered at all (anywhere on the page, not only in view).
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0;
  };
  // Pixels between the element and the visible part of the page (0 = on screen).
  const distance = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom < 0 ? -r.bottom : r.top > innerHeight ? r.top - innerHeight : 0;
  };
  // An open modal dialog makes everything behind it irrelevant: its elements come first.
  const dialogs = [...document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog], [aria-modal=true]')].filter(shown);
  const dialog = dialogs.at(-1);
  const labelOf = (el) => {
    const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    const labelled = (el.getAttribute('aria-labelledby') || '').split(' ').map((id) => document.getElementById(id)?.innerText || '').join(' ');
    return clean(el.getAttribute('aria-label') || labelled || byFor?.innerText || el.closest('label')?.innerText
      || el.innerText || (el.type === 'submit' || el.type === 'button' ? el.value : '') || el.getAttribute('placeholder')
      || el.getAttribute('title') || el.getAttribute('alt') || el.querySelector('img')?.alt || el.getAttribute('name') || '', 120);
  };
  const roleOf = (el) => {
    const r = el.getAttribute('role');
    const map = { button: 'AXButton', link: 'AXLink', tab: 'AXTab', menuitem: 'AXMenuItem', menuitemcheckbox: 'AXMenuItem', option: 'AXMenuItem', checkbox: 'AXCheckBox', radio: 'AXRadioButton', switch: 'AXCheckBox', combobox: 'AXComboBox', searchbox: 'AXSearchField', textbox: 'AXTextArea', row: 'AXRow', treeitem: 'AXRow' };
    if (r && map[r]) return map[r];
    const tag = el.tagName;
    if (tag === 'A') return 'AXLink';
    if (tag === 'SELECT') return 'AXPopUpButton';
    if (tag === 'TEXTAREA' || el.isContentEditable) return 'AXTextArea';
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox') return 'AXCheckBox';
      if (t === 'radio') return 'AXRadioButton';
      if (t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return 'AXButton';
      if (t === 'file') return 'AXFileUpload';
      if (t === 'password') return 'AXSecureTextField';
      if (t === 'search') return 'AXSearchField';
      return 'AXTextField';
    }
    return 'AXButton';
  };

  // The whole page, ordered: open dialog first, then what's on screen, then by distance.
  // Jev can pick something further down; acting on it scrolls it into view.
  const found = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.disabled || el.type === 'hidden') continue;
    // File inputs are usually hidden behind a styled button; keep them.
    if (el.type !== 'file' && !shown(el)) continue;
    found.push({ el, rank: (dialog && !dialog.contains(el) ? 1e7 : 0) + distance(el) });
  }
  found.sort((a, b) => a.rank - b.rank);

  const elements = [];
  for (const { el } of found.slice(0, maxElements)) {
    if (!el.dataset.jev) el.dataset.jev = String(window.__jevNextId++);
    const role = roleOf(el);
    const item = { id: `w${el.dataset.jev}`, role, label: labelOf(el) };
    if (el.getAttribute('placeholder')) item.placeholder = clean(el.getAttribute('placeholder'), 40);
    if (role === 'AXTextField' || role === 'AXTextArea' || role === 'AXSearchField' || role === 'AXComboBox') {
      const v = el.isContentEditable ? el.innerText : el.value;
      if (v) item.value = clean(v, 60);
    }
    if (role === 'AXPopUpButton') item.value = clean(el.selectedOptions?.[0]?.text, 40);
    if (role === 'AXCheckBox' || role === 'AXRadioButton') item.value = (el.checked || el.getAttribute('aria-checked') === 'true') ? '1' : '0';
    if (el === document.activeElement) item.focused = true;
    if (el.getAttribute('aria-selected') === 'true') item.selected = true;
    const d = distance(el);
    if (d > 0) item.offscreen = el.getBoundingClientRect().top > 0 ? 'below' : 'above';
    if (dialog && dialog.contains(el)) item.inDialog = true;
    // Position on the page, to tell same-named elements apart ("the second one").
    const r = el.getBoundingClientRect();
    item.pos = [Math.round(r.left + scrollX), Math.round(r.top + scrollY)];
    elements.push(item);
  }

  let text = '';
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode() && text.length < maxText) {
    const node = walker.currentNode;
    const t = node.textContent.trim();
    const p = node.parentElement;
    if (!t || !p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName)) continue;
    const r = p.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.width === 0) continue;
    text += t.replace(/\s+/g, ' ') + '\n';
  }
  return JSON.stringify({ url: location.href, title: document.title, elements, text: text.slice(0, maxText) });
}

function pageScroll(direction) {
  const amount = { up: -0.8, down: 0.8 }[direction];
  if (amount) scrollBy({ top: innerHeight * amount, behavior: 'instant' });
  else if (direction === 'left' || direction === 'right') scrollBy({ left: (direction === 'left' ? -0.8 : 0.8) * innerWidth, behavior: 'instant' });
  const max = document.documentElement.scrollHeight - innerHeight;
  return JSON.stringify({ result: `scrolled ${direction} (${max > 0 ? Math.round((scrollY / max) * 100) : 100}% down the page)` });
}

function pageText(maxChars) {
  const main = document.querySelector('main, [role=main], article') || document.body;
  return (main.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, maxChars);
}

function pageAction(action) {
  const el = document.querySelector(`[data-jev="${String(action.id).replace(/^w/, '')}"]`);
  if (!el) return JSON.stringify({ error: `Element ${action.id} is gone; take a new look at the page` });
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const rect = el.getBoundingClientRect();
  // Screen point of the element's centre, for native clicks (file pickers, right/double click).
  const chromeTop = window.outerHeight - window.innerHeight;
  const point = { x: window.screenX + rect.left + rect.width / 2, y: window.screenY + chromeTop + rect.top + rect.height / 2 };
  const fire = (type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));

  switch (action.name) {
    case 'describe':
      return JSON.stringify({ point, type: el.type || '', tag: el.tagName.toLowerCase(),
        options: el.tagName === 'SELECT' ? [...el.options].map((o) => o.text.trim()).filter(Boolean) : null });
    case 'click':
      el.focus?.();
      fire('mousedown'); fire('mouseup');
      el.click();
      return JSON.stringify({ result: 'clicked', point });
    case 'set_text': {
      el.focus();
      if (el.isContentEditable) {
        if (!action.append) { const range = document.createRange(); range.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); }
        document.execCommand('insertText', false, action.text);
      } else {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const value = action.append ? el.value + action.text : action.text;
        setter ? setter.call(el, value) : (el.value = value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return JSON.stringify({ result: 'set', point });
    }
    case 'select': {
      const want = String(action.option).toLowerCase();
      const opt = [...(el.options || [])].find((o) => o.text.trim().toLowerCase() === want) || [...(el.options || [])].find((o) => o.text.toLowerCase().includes(want));
      if (!opt) return JSON.stringify({ error: `No option matching "${action.option}"` });
      el.value = opt.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return JSON.stringify({ result: `selected ${opt.text.trim()}` });
    }
    default:
      return JSON.stringify({ error: `Unknown page action ${action.name}` });
  }
}

// ---- Node side ----

const call = (fn, ...args) => `(${fn})(${args.map((a) => JSON.stringify(a)).join(',')})`;

export const isBrowser = (app) => BROWSERS.has(app);
export const isWebId = (id) => typeof id === 'string' && id.startsWith('w');

export class Web {
  constructor(desktop) { this.desktop = desktop; }

  async run(app, js) {
    return this.desktop.request('web_js', { app, js }, 20_000);
  }

  async snapshot(app, { maxElements = 200, maxText = 2000 } = {}) {
    return JSON.parse(await this.run(app, call(pageSnapshot, maxElements, maxText)));
  }

  async readText(app, maxChars = 15000) {
    return this.run(app, call(pageText, maxChars));
  }

  async scroll(app, direction) {
    return JSON.parse(await this.run(app, call(pageScroll, direction))).result;
  }

  async action(app, action) {
    const out = JSON.parse(await this.run(app, call(pageAction, action)));
    if (out.error) throw new Error(out.error);
    return out;
  }
}
