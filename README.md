# Jev: control your Mac by voice

You say a command. Jev does it in a fraction of a second.

> "open Brave" · "go to LinkedIn" · "click Jobs" · "new tab" · "scroll down" · "click Wi-Fi" · "double click report.pdf" · "clique sur Accueil"

This version has **no model of any kind**. Everything is plain code:
- **Level 1:** your sentence is matched against fixed phrasings, your installed apps and known websites (no screen read, ~0.1 s).
- **Level 2:** "click <name>" finds the thing with that name on screen and clicks it.

Anything else does nothing: "Sorry, I didn't get that." It never guesses.

## How it works

```
you speak ─► Apple on-device speech recognition (told your app, site and on-screen names)
           ─► level 1, matched in code: a key, a scroll, an app, or a website
           ─► level 2, "click <name>": the names on screen, compared as text
           ─► the action runs ─► short chime
```

**Reading the screen:** apps describe their windows to macOS (the Accessibility tree VoiceOver uses), and in browsers Jev reads the page itself. So it sees exact names (buttons, links, tabs, rows, checkboxes), not pixels. Type `see` to print everything it reads on the current screen.

| Part | What | Cost |
|---|---|---|
| Ears | Apple on-device speech recognition | free |
| Matching | `src/fixed.js` (level 1) and `src/click.js` (level 2), in English and French | free |
| Eyes | macOS Accessibility, plus in-page reading for browsers | free |
| Hands | native keystrokes, app launching, browser tabs | free |
| Voice | a chime when done; macOS `say` for "didn't get that" | free |

## What you can say

| Kind | Examples |
|---|---|
| Open or switch to an app | "open VS Code", "launch Safari", "switch to Finder", "open the calculator", "ouvre Brave", "lance Spotify" |
| Go to a website | "go to LinkedIn", "open gmail", "go to my inbox", "go to example dot com slash jobs", "va sur YouTube" |
| Keys | "press enter", "escape", "copy", "paste", "undo", "save", "select all", "new tab", "close tab", "reopen closed tab", "next tab", "reload", "go back", "zoom in", "quit", "nouvel onglet", "actualise la page" |
| Scroll | "scroll down", "scroll up", "descends", "remonte" |
| Click by name | "click Jobs", "press Save", "open Inbox", "click the Settings tab", "double click report.pdf", "right click Desktop", "tick Remember me", "clique sur Accueil" |

- **Chains:** "open Brave then go to LinkedIn", "ouvre Brave puis va sur LinkedIn".
- **Already open:** "go to Gmail" switches to the Gmail tab if one is open.
- **App or website:** "open Spotify" opens the app; "go to Spotify" opens the website.
- **Fast by voice:** a command runs 0.3 s after your words stop changing, without waiting for the end-of-speech silence. Commands that more words could change ("scroll" → "scroll up", "go to Google" → "go to Google Docs") and "quit" wait for the end of the sentence.

### Clicking by name
- **Say the name as written.** Case, accents, "the … button/tab/link", counters ("Messages 3", "Inbox 1,234 unread"), "&" vs "and" and "Wi‑Fi" vs "wifi" don't matter.
- **The start of a long name works** when only one name starts that way: "click Easy Apply" → "Easy Apply to Data Scientist at …".
- **Several with that name:** Jev asks "Which one: first, second…?" (top to bottom). Answer "the second one", "2", "deuxième" or "last".
- **Not there:** Jev looks again for about a second (a page still loading), then says "I don't see …". Nothing is clicked.
- **Open dialogs first:** a pop-up's buttons win over the page behind it.
- **"open X":** an app or website named X comes first ("open Messages" is the app); say "click Messages" for something on screen.
- **By voice it's fast:** the screen is read while you speak, and a click with exactly one match runs 0.3 s after your words stop changing (unless another name continues it, like "Save" and "Save as draft", or it can't be undone).

Test sets: `test/fixed.test.js` (level 1, 210 phrases) and `test/click.test.js` (level 2, 125 commands on screens modeled on LinkedIn, Gmail, YouTube, System Settings, Finder and a form). Voice test sheets: `scenarios/voice-test.md` and `scenarios/voice-test-level2.md`.

## Safety

- **Files are sandboxed:** keys that change things (paste, cut, undo, save, backspace) are refused in Finder or a code editor outside `~/Desktop/Jev Sandbox`, and in standalone terminals.
- **Buttons that can't be undone ask first** (send, submit, pay, delete, apply, publish…), unless your own words said so ("click Send" is its own confirmation).
- **Unknown commands do nothing**, and so do names that aren't on screen.
- **Keystrokes never go into the terminal running Jev.**

## Setup

```sh
npm run build            # Swift helper + test app (needs Xcode Command Line Tools)
node src/cli.js setup    # macOS permission prompts
node src/cli.js doctor   # everything ✓
```

Grant **Accessibility** to your terminal app (System Settings → Privacy & Security → Accessibility). For scrolling web pages, turn on **View → Developer → Allow JavaScript from Apple Events** in Brave (also in Chrome, Edge, Arc and Safari).

## Use

```sh
node src/cli.js            # voice
node src/cli.js --text     # type commands (handy for testing)
node src/cli.js run "open the calculator"   # one command, prints timings
```

In `--text` mode, Jev acts on the window you used just before clicking into the terminal.

Each command prints its timing, e.g. `[done · open_app · 0.09s · action 0.05s]`. Every command is logged in `~/.jev/logs/<date>.jsonl`. Set `"log": false` to turn this off.

Settings live in `~/.jev/config.json`: `browser`, `sandbox`, `locale` (e.g. `fr-FR`), `voice`, `rate`, `silence`, `early` (ms before a command runs while you speak; 0 = wait for the silence).

## Tests

```sh
npm test                  # offline: phrasings, click names, commander, sandbox
node scripts/capture.js <name> [url | app]   # save the current screen as a test fixture (kept out of git)
npm run test:integration  # native helper against bin/JevFixture.app (needs Accessibility)
```

## Layout

```
src/fixed.js      level 1: phrasings, apps, websites
src/click.js      level 2: click by name
src/commander.js  one command → one action
src/commands.js   keys, websites, chaining
src/desktop.js    bridge to the native helper (+ src/web.js for pages in browsers)
src/sandbox.js    file sandbox
src/cli.js        the jev command
native/           Swift helper: accessibility, input, speech recognition
```
