# Jev: control your Mac by voice

You say a command. Jev does it in about a tenth of a second.

> "open Brave" · "go to LinkedIn" · "new tab" · "scroll down" · "go back" · "switch to Finder" · "ouvre Spotify" · "actualise la page"

This first version has **no model of any kind**. Your sentence is matched in plain code against a fixed list of phrasings, your installed apps and known websites. Anything it doesn't recognize does nothing: "Sorry, I didn't get that." It never guesses.

## How it works

```
you speak ─► Apple on-device speech recognition (told your app and site names)
           ─► matched in code: a key, a scroll, an app, or a website
           ─► the action runs ─► short chime
```

| Part | What | Cost |
|---|---|---|
| Ears | Apple on-device speech recognition | free |
| Matching | `src/fixed.js`: fixed phrasings in English and French | free |
| Hands | native keystrokes, app launching, browser tabs | free |
| Voice | a chime when done; macOS `say` for "didn't get that" | free |

## What you can say

| Kind | Examples |
|---|---|
| Open or switch to an app | "open VS Code", "launch Safari", "switch to Finder", "open the calculator", "ouvre Brave", "lance Spotify" |
| Go to a website | "go to LinkedIn", "open gmail", "go to my inbox", "go to example dot com slash jobs", "va sur YouTube" |
| Keys | "press enter", "escape", "copy", "paste", "undo", "save", "select all", "new tab", "close tab", "reopen closed tab", "next tab", "reload", "go back", "zoom in", "quit", "nouvel onglet", "actualise la page" |
| Scroll | "scroll down", "scroll up", "descends", "remonte" |

- **Chains:** "open Brave then go to LinkedIn", "ouvre Brave puis va sur LinkedIn".
- **Already open:** "go to Gmail" switches to the Gmail tab if one is open.
- **App or website:** "open Spotify" opens the app; "go to Spotify" opens the website.
- **Fast by voice:** a command runs 0.3 s after your words stop changing, without waiting for the end-of-speech silence. Commands that more words could change ("scroll" → "scroll up", "go to Google" → "go to Google Docs") and "quit" wait for the end of the sentence.

The full test set of phrasings is in `test/fixed.test.js`.

## Safety

- **Files are sandboxed:** keys that change things (paste, cut, undo, save, backspace) are refused in Finder or a code editor outside `~/Desktop/Jev Sandbox`, and in standalone terminals.
- **Unknown commands do nothing.**
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
npm test                  # offline: phrasings, commander, sandbox
npm run test:integration  # native helper against bin/JevFixture.app (needs Accessibility)
```

## Layout

```
src/fixed.js      what you can say: phrasings, apps, websites
src/commander.js  one command → one action
src/commands.js   keys, websites, chaining
src/desktop.js    bridge to the native helper (+ src/web.js for pages in browsers)
src/sandbox.js    file sandbox
src/cli.js        the jev command
native/           Swift helper: accessibility, input, speech recognition
```
