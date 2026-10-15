# Jev: control your Mac by voice

You say a command. Jev does it in a fraction of a second.

> "open Brave" · "go to LinkedIn" · "click Jobs" · "new tab" · "scroll down" · "click Wi-Fi" · "double click report.pdf" · "clique sur Accueil"

It works in two ways:
- **Opening and keys (code):** your sentence is matched against fixed phrasings, your installed apps and known websites (no screen read, ~0.1 s).
- **Everything on screen (Jev):** [Jev](https://docs.typesafe.ai), a fast classifier, decides which element you mean, whether you say its exact name or not ("clique sur Accueil", "clique sur notification", "click jobs" on a French page, "clique sur le premier job"), and also understands loose commands ("fire up Brave", "mets la page à jour"). It only chooses among things that exist, and when it isn't sure, nothing happens. Without a Jev key, or when Jev can't be reached, the code clicks by exact name instead.

You never have to correct it or say "I meant…": it either does what you meant or does nothing.

## How it works

```
you speak ─► Apple on-device speech recognition (told your app, site and on-screen names)
           ─► level 1, matched in code: a key, a scroll, an app, or a website
           ─► anything about the screen: Jev picks what you meant (one call, ~0.27 s, sent while
               you're still speaking); the code's exact-name match is the fallback
           ─► the action runs ─► short chime
```

**Reading the screen:** apps describe their windows to macOS (the Accessibility tree VoiceOver uses), and in browsers Jev reads the page itself. So it sees exact names (buttons, links, tabs, rows, checkboxes), not pixels. Type `see` to print everything it reads on the current screen.

| Part | What | Cost |
|---|---|---|
| Ears | Apple on-device speech recognition | free |
| Matching | `src/fixed.js` (level 1) and `src/click.js` (level 2), in English and French | free |
| Eyes | macOS Accessibility, plus in-page reading for browsers | free |
| Understanding | Jev, for every command about the screen | ~$0.0001 per command |
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

### Clicking by name (the code, without Jev)
Without a Jev key, or if Jev can't be reached, clicks go by exact name:
- **Say the name as written.** Case, accents, "the … button/tab/link", counters ("Messages 3", "Inbox 1,234 unread"), "&" vs "and" and "Wi‑Fi" vs "wifi" don't matter.
- **The start of a long name works** when only one name starts that way: "click Easy Apply" → "Easy Apply to Data Scientist at …".
- **Several with that name:** Jev asks "Which one: first, second…?" (top to bottom). Answer "the second one", "2", "deuxième" or "last".
- **Not there:** Jev looks again for about a second (a page still loading), then says "I don't see …". Nothing is clicked.
- **Open dialogs first:** a pop-up's buttons win over the page behind it.
- **"open X":** an app or website named X comes first ("open Messages" is the app); say "click Messages" for something on screen.
- **By voice it's fast:** the screen is read while you speak, and Jev is asked as soon as your words settle.

### Jev: what you meant
For every command about the screen, one Jev call answers several questions at once (in parallel, ~0.27 s): what kind of action, which element on screen, which app, site or key, and two safety checks. The code tells Jev which element has exactly the name you said, but Jev decides. In voice mode the call is made while you're still speaking, so the answer is usually ready when you stop, and a sure, safe click runs before the end-of-speech silence.

- **Understands:** singular/plural, French ↔ English ("click inbox" on a French Gmail), synonyms ("postuler" → "Candidature simplifiée"), misheard words ("blue tooth"), positions ("le premier job"), and apps, sites or keys said differently ("mets la page à jour", "emmène-moi sur LinkedIn").
- **Never a wild guess:** it only chooses things that exist. It acts only when it's clearly sure, and never on something merely associated with what you said ("click lemon" won't click the Yellow button). Otherwise, nothing happens.
- **No key, no Jev:** without `jevKey` in `~/.jev/config.json`, only the exact levels run.
- **A growing dataset:** every command Jev resolves is saved, with the screen's names, in `~/.jev/dataset/understood.jsonl` (on your Mac only), to replay and measure later.
- **Measured:** `npm run eval:jev` runs 256 commands against the real Jev: 127 said loosely (`test/understand-cases.js`) and 129 with the exact name (`test/click-cases.js`). Latest: **251 right, 5 nothing, 0 wrong**. That includes all 129 exact names, and 20 commands that must do nothing (traps like "clique sur banane" next to a Yellow button).

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

Settings live in `~/.jev/config.json`: `jevKey` (optional, turns on Jev), `browser`, `sandbox`, `locale` (e.g. `fr-FR`), `voice`, `rate`, `silence`, `early` (ms before a command runs while you speak; 0 = wait for the silence).

## Tests

```sh
npm test                  # offline: phrasings, click names, commander, sandbox
node scripts/capture.js <name> [url | app]   # save the current screen as a test fixture (kept out of git)
node scripts/eval-jev.js [category]          # the "what was meant" dataset against the real Jev (needs a key)
npm run test:integration  # native helper against bin/JevFixture.app (needs Accessibility)
```

## Layout

```
src/fixed.js      level 1: phrasings, apps, websites
src/click.js      level 2: click by name
src/understand.js Jev: what was meant, when the code finds nothing
src/jev.js        Jev client
src/commander.js  one command → one action
src/commands.js   keys, websites, chaining
src/desktop.js    bridge to the native helper (+ src/web.js for pages in browsers)
src/sandbox.js    file sandbox
src/cli.js        the jev command
native/           Swift helper: accessibility, input, speech recognition
```
