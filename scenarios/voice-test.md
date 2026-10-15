# Voice test: 200 sentences

Run `node src/cli.js`, then say each sentence and tick it when Jev does the right thing. Speech recognition is in English by default, so the French list needs `"locale": "fr-FR"` in `~/.jev/config.json` (restart Jev after changing it).

Note anything misheard (the grey text shows what Jev heard), anything slow, or anything wrong.

## 1. Apps

Each one opens or brings the app to the front.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 1 | open the calculator | opens Calculator | |
| 2 | open Calendar | opens Calendar | |
| 3 | switch to Finder | opens Finder | |
| 4 | open Notes | opens Notes | |
| 5 | open the notes app | opens Notes | |
| 6 | open Reminders | opens Reminders | |
| 7 | open Messages | opens Messages | |
| 8 | open Mail | opens Mail | |
| 9 | open Maps | opens Maps | |
| 10 | open Photos | opens Photos | |
| 11 | open Preview | opens Preview | |
| 12 | open TextEdit | opens TextEdit | |
| 13 | open text edit | opens TextEdit | |
| 14 | open System Settings | opens System Settings | |
| 15 | open settings | opens System Settings | |
| 16 | open system preferences | opens System Settings | |
| 17 | open the App Store | opens App Store | |
| 18 | open Activity Monitor | opens Activity Monitor | |
| 19 | open QuickTime | opens QuickTime Player | |
| 20 | open Music | opens Music | |
| 21 | launch Safari | opens Safari | |
| 22 | launch Firefox | opens Firefox | |
| 23 | start Spotify | opens Spotify | |
| 24 | open Spotify please | opens Spotify | |
| 25 | open Discord | opens Discord | |
| 26 | open Telegram | opens Telegram | |
| 27 | open WhatsApp | opens WhatsApp | |
| 28 | open Notion | opens Notion | |
| 29 | open Obsidian | opens Obsidian | |
| 30 | open Figma | opens Figma | |
| 31 | open VS Code | opens Visual Studio Code | |
| 32 | open Visual Studio Code | opens Visual Studio Code | |
| 33 | switch to Visual Studio Code | opens Visual Studio Code | |
| 34 | open Cursor | opens Cursor | |
| 35 | open PyCharm | opens PyCharm | |
| 36 | open Docker | opens Docker | |
| 37 | open the terminal | opens Terminal | |
| 38 | switch to iTerm | opens iTerm | |
| 39 | open Microsoft Word | opens Microsoft Word | |
| 40 | open Word | opens Microsoft Word | |
| 41 | open Excel | opens Microsoft Excel | |
| 42 | open Microsoft Teams | opens Microsoft Teams | |
| 43 | open Claude | opens Claude | |
| 44 | open ChatGPT | opens ChatGPT | |
| 45 | open CapCut | opens CapCut | |
| 46 | open iMovie | opens iMovie | |
| 47 | open GarageBand | opens GarageBand | |
| 48 | open Keynote | opens Keynote | |
| 49 | open Pages | opens Pages | |
| 50 | open Numbers | opens Numbers | |
| 51 | bring up the calculator | opens Calculator | |
| 52 | show me Finder | opens Finder | |
| 53 | go back to Finder | opens Finder | |
| 54 | can you open Discord | opens Discord | |
| 55 | hey Jev, open Brave | opens Brave Browser | |
| 56 | open Brave | opens Brave Browser | |
| 57 | open Brave Browser | opens Brave Browser | |
| 58 | open the browser | opens Brave Browser | |
| 59 | open the Contacts app | opens Contacts | |
| 60 | open Weather | opens Weather | |

## 2. Websites

Opens in Brave, or switches to the tab if the site is already open.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 61 | go to LinkedIn | opens linkedin.com | |
| 62 | go to linked in | opens linkedin.com | |
| 63 | open LinkedIn | opens linkedin.com | |
| 64 | go to Gmail | opens mail.google.com | |
| 65 | open Gmail | opens mail.google.com | |
| 66 | go to my inbox | opens mail.google.com | |
| 67 | go to YouTube | opens youtube.com | |
| 68 | open YouTube | opens youtube.com | |
| 69 | go to GitHub | opens github.com | |
| 70 | go to Google | opens google.com | |
| 71 | go to Google Docs | opens docs.google.com | |
| 72 | go to Google Drive | opens drive.google.com | |
| 73 | go to Google Sheets | opens sheets.google.com | |
| 74 | go to Google Calendar | opens calendar.google.com | |
| 75 | go to Google Maps | opens maps.google.com | |
| 76 | go to Google Translate | opens translate.google.com | |
| 77 | go to Google Flights | opens google.com/travel/flights | |
| 78 | go to Claude | opens claude.ai | |
| 79 | go to ChatGPT | opens chatgpt.com | |
| 80 | go to Perplexity | opens perplexity.ai | |
| 81 | go to Gemini | opens gemini.google.com | |
| 82 | go to Spotify | opens open.spotify.com | |
| 83 | go to Notion | opens notion.so | |
| 84 | go to Figma | opens figma.com | |
| 85 | go to Twitter | opens x.com | |
| 86 | go to X | opens x.com | |
| 87 | go to Reddit | opens reddit.com | |
| 88 | go to Hacker News | opens news.ycombinator.com | |
| 89 | go to Stack Overflow | opens stackoverflow.com | |
| 90 | go to Wikipedia | opens wikipedia.org | |
| 91 | go to Netflix | opens netflix.com | |
| 92 | go to Amazon | opens amazon.fr | |
| 93 | go to Instagram | opens instagram.com | |
| 94 | go to Facebook | opens facebook.com | |
| 95 | go to Outlook | opens outlook.live.com | |
| 96 | go to Indeed | opens indeed.com | |
| 97 | go to Welcome to the Jungle | opens welcometothejungle.com | |
| 98 | go to Leboncoin | opens leboncoin.fr | |
| 99 | go to Booking | opens booking.com | |
| 100 | take me to Amazon | opens amazon.fr | |
| 101 | visit Reddit | opens reddit.com | |
| 102 | navigate to GitHub | opens github.com | |
| 103 | go to the LinkedIn website | opens linkedin.com | |
| 104 | go to example dot com | opens example.com | |
| 105 | go to example dot com slash jobs | opens example.com/jobs | |
| 106 | go to wikipedia dot org | opens wikipedia.org | |

## 3. Browser keys

Best tried with Brave in front.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 107 | new tab | key: new tab | |
| 108 | open a new tab | key: new tab | |
| 109 | close tab | key: close tab | |
| 110 | reopen closed tab | key: reopen tab | |
| 111 | reopen the last tab | key: reopen tab | |
| 112 | next tab | key: next tab | |
| 113 | previous tab | key: previous tab | |
| 114 | reload | key: reload | |
| 115 | refresh | key: reload | |
| 116 | refresh the page | key: reload | |
| 117 | reload the page | key: reload | |
| 118 | go back | key: back | |
| 119 | back | key: back | |
| 120 | previous page | key: back | |
| 121 | go forward | key: forward | |
| 122 | address bar | key: address bar | |
| 123 | go to the address bar | key: address bar | |
| 124 | find in page | key: find | |
| 125 | new window | key: new window | |
| 126 | open a new window | key: new window | |
| 127 | zoom in | key: zoom in | |
| 128 | zoom out | key: zoom out | |

## 4. Keys

Harmless keys anywhere.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 129 | press enter | key: enter | |
| 130 | enter | key: enter | |
| 131 | hit return | key: enter | |
| 132 | escape | key: escape | |
| 133 | press escape | key: escape | |
| 134 | tab | key: tab | |
| 135 | next field | key: tab | |
| 136 | previous field | key: shift tab | |
| 137 | shift tab | key: shift tab | |
| 138 | select all | key: select all | |
| 139 | select everything | key: select all | |
| 140 | copy | key: copy | |
| 141 | copy that | key: copy | |
| 142 | arrow down | key: down | |
| 143 | arrow up | key: up | |
| 144 | left arrow | key: left | |
| 145 | right arrow | key: right | |
| 146 | page down | key: page down | |
| 147 | page up | key: page up | |
| 148 | space bar | key: space | |
| 149 | minimize the window | key: minimize | |
| 150 | open spotlight | key: spotlight | |
| 151 | escape please | key: escape | |
| 152 | press enter please | key: enter | |
| 153 | can you refresh the page | key: reload | |

## 5. Scrolling

On a long web page.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 154 | scroll down | scroll down | |
| 155 | scroll | scroll down | |
| 156 | scroll down a bit | scroll down | |
| 157 | scroll up | scroll up | |
| 158 | scroll up a bit | scroll up | |
| 159 | go down | scroll down | |
| 160 | go up | scroll up | |
| 161 | scroll the page down | scroll down | |

## 6. Chains

Several commands in one sentence.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 162 | open Brave then go to LinkedIn | opens Brave Browser, then opens linkedin.com | |
| 163 | open Brave then new tab | opens Brave Browser, then key: new tab | |
| 164 | go to YouTube then scroll down | opens youtube.com, then scroll down | |
| 165 | new tab then go to GitHub | key: new tab, then opens github.com | |
| 166 | switch to Finder then open Brave | opens Finder, then opens Brave Browser | |
| 167 | go to Reddit then scroll down then scroll up | opens reddit.com, then scroll down, then scroll up | |

## 7. Careful: these change or close things

Only try where it does no harm (an empty TextEdit window, a tab you don't need).

| # | Say | Expected | ✓ |
|---|---|---|---|
| 168 | paste | key: paste | |
| 169 | paste it | key: paste | |
| 170 | cut | key: cut | |
| 171 | undo | key: undo | |
| 172 | redo | key: redo | |
| 173 | save | key: save | |
| 174 | backspace | key: backspace | |
| 175 | quit the app | key: quit app | |

## 8. Should do nothing ("Sorry, I didn't get that")

Not supported yet: nothing should happen.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 176 | click the first job | — nothing | |
| 177 | click new chat | — nothing | |
| 178 | open the first email | — nothing | |
| 179 | type hello world | — nothing | |
| 180 | open the Nova folder | — nothing | |
| 181 | switch to the Gmail tab | — nothing | |
| 182 | open my profile | — nothing | |
| 183 | search for jobs in Paris | — nothing | |
| 184 | what can you see | — nothing | |
| 185 | read this | — nothing | |
| 186 | fire up Brave | — nothing | |
| 187 | open Doctolib | — nothing | |
| 188 | press command shift 4 | — nothing | |
| 189 | open home | — nothing | |
| 190 | open downloads | — nothing | |

## 9. French (set `"locale": "fr-FR"` first)

| # | Say | Expected | ✓ |
|---|---|---|---|
| 191 | ouvre Brave | opens Brave Browser | |
| 192 | lance Spotify | opens Spotify | |
| 193 | ouvre la calculatrice | opens Calculator | |
| 194 | ouvre l'application Notes | opens Notes | |
| 195 | ouvre les réglages | opens System Settings | |
| 196 | passe sur Finder | opens Finder | |
| 197 | va sur LinkedIn | opens linkedin.com | |
| 198 | va sur YouTube | opens youtube.com | |
| 199 | ouvre Gmail | opens mail.google.com | |
| 200 | aller sur Indeed | opens indeed.com | |
| 201 | nouvel onglet | key: new tab | |
| 202 | ouvre un nouvel onglet | key: new tab | |
| 203 | ferme l'onglet | key: close tab | |
| 204 | onglet suivant | key: next tab | |
| 205 | onglet précédent | key: previous tab | |
| 206 | actualise la page | key: reload | |
| 207 | recharge | key: reload | |
| 208 | retour | key: back | |
| 209 | page précédente | key: back | |
| 210 | nouvelle fenêtre | key: new window | |
| 211 | entrée | key: enter | |
| 212 | appuie sur entrée | key: enter | |
| 213 | échap | key: escape | |
| 214 | tout sélectionner | key: select all | |
| 215 | copie | key: copy | |
| 216 | descends | scroll down | |
| 217 | remonte | scroll up | |
| 218 | défile vers le bas | scroll down | |
| 219 | fais défiler vers le haut | scroll up | |
| 220 | ouvre Brave puis va sur LinkedIn | opens Brave Browser, then opens linkedin.com | |
