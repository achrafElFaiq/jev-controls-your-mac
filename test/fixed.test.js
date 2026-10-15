// Level 1 test set: every phrasing must give exactly this action, and every out-of-scope
// command must give nothing (it then goes to Jev, which sees the screen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extendable, matchFixed } from '../src/fixed.js';

const APPS = ['Activity Monitor', 'App Store', 'Brave Browser', 'Calculator', 'Calendar', 'CapCut', 'ChatGPT', 'Claude', 'Cursor', 'Discord',
  'Docker', 'Figma', 'Finder', 'Firefox', 'Google Docs', 'Google Drive', 'Home', 'Mail', 'Maps', 'Messages', 'Microsoft Excel', 'Microsoft Teams',
  'Microsoft Word', 'Music', 'Notes', 'Notion', 'Obsidian', 'Photos', 'Preview', 'PyCharm', 'QuickTime Player', 'Reminders', 'Safari', 'Spotify',
  'System Settings', 'Telegram', 'Terminal', 'TextEdit', 'Visual Studio Code', 'WhatsApp', 'iTerm'];
const ctx = { apps: APPS, browser: 'Brave Browser' };

const key = (k) => ({ op: 'key', key: k });
const scroll = (d) => ({ op: 'scroll', scroll: d });
const app = (a) => ({ op: 'open_app', app: a });
const site = (s) => ({ op: 'open_site', site: s });

const EXPECTED = {
  // Keys (English)
  'press enter': key('enter'), 'Enter.': key('enter'), 'hit return': key('enter'), 'press the enter key': null, 'enter key': key('enter'),
  'escape': key('escape'), 'press escape': key('escape'), 'esc': key('escape'),
  'tab': key('tab'), 'next field': key('tab'), 'previous field': key('shift_tab'), 'shift tab': key('shift_tab'),
  'copy': key('copy'), 'Copy that.': key('copy'), 'copy this please': key('copy'),
  'paste': key('paste'), 'paste it': key('paste'), 'paste here': key('paste'),
  'cut': key('cut'), 'undo': key('undo'), 'undo that': key('undo'), 'redo': key('redo'),
  'select all': key('select_all'), 'select everything': key('select_all'),
  'save': key('save'), 'save the file': key('save'), 'Save it.': key('save'),
  'find in page': key('find'),
  'new tab': key('new_tab'), 'open a new tab': key('new_tab'), 'Open new tab.': key('new_tab'),
  'close tab': key('close_tab'), 'close this tab': key('close_tab'), 'close the tab': key('close_tab'),
  'reopen closed tab': key('reopen_tab'), 'reopen the last tab': key('reopen_tab'),
  'next tab': key('next_tab'), 'previous tab': key('previous_tab'),
  'reload': key('reload'), 'refresh': key('reload'), 'refresh the page': key('reload'), 'reload page': key('reload'),
  'go back': key('back'), 'back': key('back'), 'previous page': key('back'), 'go forward': key('forward'),
  'address bar': key('address_bar'), 'go to the address bar': key('address_bar'),
  'new window': key('new_window'), 'open a new window': key('new_window'),
  'zoom in': key('zoom_in'), 'zoom out': key('zoom_out'),
  'arrow down': key('down'), 'up arrow': key('up'), 'left arrow': key('left'), 'press right': key('right'),
  'page down': key('page_down'), 'page up': key('page_up'), 'backspace': key('backspace'), 'space bar': key('space'),
  'minimize': key('minimize'), 'minimize the window': key('minimize'),
  'quit': key('quit_app'), 'quit the app': key('quit_app'), 'open spotlight': key('spotlight'),
  'please press enter': key('enter'), 'hey jev, new tab': key('new_tab'), 'can you refresh the page': key('reload'), 'go back please': key('back'),
  // Keys (French)
  'entrée': key('enter'), 'appuie sur entrée': key('enter'), 'échap': key('escape'), 'copie': key('copy'), 'colle': key('paste'),
  'coupe': key('cut'), 'annule ça': key('undo'), 'tout sélectionner': key('select_all'), 'enregistre': key('save'),
  'nouvel onglet': key('new_tab'), 'ouvre un nouvel onglet': key('new_tab'), "ferme l'onglet": key('close_tab'), 'onglet suivant': key('next_tab'),
  'onglet précédent': key('previous_tab'), 'actualise la page': key('reload'), 'recharge': key('reload'), 'retour': key('back'),
  'page précédente': key('back'), 'nouvelle fenêtre': key('new_window'), "quitte l'application": key('quit_app'), "s'il te plaît, copie": key('copy'),
  // Scrolling
  'scroll down': scroll('down'), 'scroll': scroll('down'), 'Scroll down a bit.': scroll('down'), 'scroll up': scroll('up'), 'go down': scroll('down'),
  'go up': scroll('up'), 'descends': scroll('down'), 'remonte': scroll('up'), 'défile vers le bas': scroll('down'), 'fais défiler vers le haut': scroll('up'),
  // Apps
  'open Brave': app('Brave Browser'), 'open brave browser': app('Brave Browser'), 'launch Safari': app('Safari'), 'open VS Code': app('Visual Studio Code'),
  'open visual studio code': app('Visual Studio Code'), 'start Spotify': app('Spotify'), 'open the calculator': app('Calculator'),
  'switch to Finder': app('Finder'), 'open Finder': app('Finder'), 'go back to Visual Studio Code': app('Visual Studio Code'),
  'open Word': app('Microsoft Word'), 'open excel': app('Microsoft Excel'), 'open microsoft teams': app('Microsoft Teams'),
  'open settings': app('System Settings'), 'open system preferences': app('System Settings'), 'open the terminal': app('Terminal'),
  'open notes': app('Notes'), 'open the notes app': app('Notes'), 'open textedit': app('TextEdit'), 'open text edit': app('TextEdit'),
  'open discord': app('Discord'), 'open cursor': app('Cursor'), 'open obsidian': app('Obsidian'), 'open pycharm': app('PyCharm'),
  'open quicktime': app('QuickTime Player'), 'open activity monitor': app('Activity Monitor'), 'open the app store': app('App Store'),
  'open Claude': app('Claude'), 'open ChatGPT': app('ChatGPT'), 'open WhatsApp': app('WhatsApp'), 'open the browser': app('Brave Browser'),
  'switch to iTerm': app('iTerm'), 'open telegram': app('Telegram'), 'open preview': app('Preview'), 'open messages': app('Messages'),
  'ouvre Brave': app('Brave Browser'), 'lance Spotify': app('Spotify'), 'ouvre la calculatrice': app('Calculator'),
  "ouvre l'application Notes": app('Notes'), 'ouvre les réglages': app('System Settings'), 'passe sur Finder': app('Finder'),
  'open spotify please': app('Spotify'), 'can you open discord': app('Discord'),
  // Websites
  'go to LinkedIn': site('linkedin.com'), 'go to linked in': site('linkedin.com'), 'open LinkedIn': site('linkedin.com'),
  'go to Gmail': site('mail.google.com'), 'open gmail': site('mail.google.com'), 'go to my inbox': site('mail.google.com'),
  'go to YouTube': site('youtube.com'), 'open youtube': site('youtube.com'), 'go to GitHub': site('github.com'),
  'go to Claude': site('claude.ai'), 'go to ChatGPT': site('chatgpt.com'), 'go to Spotify': site('open.spotify.com'), 'go to Notion': site('notion.so'),
  'go to Twitter': site('x.com'), 'go to Reddit': site('reddit.com'), 'go to Hacker News': site('news.ycombinator.com'),
  'go to Welcome to the Jungle': site('welcometothejungle.com'), 'go to google': site('google.com'), 'go to Google Docs': site('docs.google.com'),
  'go to google drive': site('drive.google.com'), 'go to Stack Overflow': site('stackoverflow.com'), 'go to Wikipedia': site('wikipedia.org'),
  'take me to amazon': site('amazon.fr'), 'visit indeed': site('indeed.com'), 'go to the LinkedIn website': site('linkedin.com'),
  'go to example dot com': site('example.com'), 'go to example dot com slash jobs': site('example.com/jobs'), 'open news.ycombinator.com': site('news.ycombinator.com'),
  'va sur LinkedIn': site('linkedin.com'), 'va sur YouTube': site('youtube.com'), 'ouvre Gmail': site('mail.google.com'), 'aller sur Indeed': site('indeed.com'),
  'go to leboncoin': site('leboncoin.fr'), 'open google flights': site('google.com/travel/flights'),
  // Out of scope: on-screen things, folders, tabs, typing, several steps, nonsense → Jev.
  'click new chat': null, 'open the first email': null, 'click the first job': null, 'open the Nova folder': null, 'open my Jev Sandbox': null,
  'open kickoff.txt': null, 'switch to the Gmail tab': null, 'go to the Finder window': null, 'type hello world': null,
  'type Alex Martin in the name field': null, 'choose France in the country menu': null, 'read this': null, 'what can you see': null,
  'open a new chat on Claude': null, 'search for AI engineer jobs in Paris': null, 'reply to the first email': null, 'open my profile': null,
  'open home': null, 'open desktop': null, 'open downloads': null, 'open the blue button': null, 'go to the jobs tab': null,
  'mumble': null, '': null, 'open': null, 'go to': null, 'press the red button': null, 'press': null, 'open xyzzy': null,
  'delete this file': null, 'apply to the first one': null, 'filter the dates to the last 3 days': null, 'clique sur Trouver un job': null,
};

test(`level 1 test set (${Object.keys(EXPECTED).length} phrases)`, () => {
  const wrong = [];
  for (const [phrase, expected] of Object.entries(EXPECTED)) {
    const got = matchFixed(phrase, ctx);
    if (JSON.stringify(got) !== JSON.stringify(expected)) wrong.push(`${JSON.stringify(phrase)} → ${JSON.stringify(got)} (expected ${JSON.stringify(expected)})`);
  }
  assert.deepEqual(wrong, []);
});

test('screen first and folders: a name on screen or in the sandbox is not opened as an app', () => {
  assert.equal(matchFixed('open messages', { ...ctx, avoid: ['Messages'] }), null);
  assert.equal(matchFixed('open notes', { ...ctx, avoid: ['Notes'] }), null);
  // "go to <site>" stays the website even with a link of that name on screen.
  assert.deepEqual(matchFixed('go to linkedin', { ...ctx, avoid: ['LinkedIn'] }), site('linkedin.com'));
});

test('extendable: commands whose meaning more words could change', () => {
  for (const c of ['scroll', 'go to google', 'open google', 'open microsoft']) assert.ok(extendable(c, ctx), c);
  for (const c of ['open brave', 'copy', 'new tab', 'go to linkedin', 'press enter', 'scroll down']) assert.ok(!extendable(c, ctx), c);
});
