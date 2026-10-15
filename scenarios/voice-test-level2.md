# Voice test: level 2 (click by name)

Run `node src/cli.js`. Go to the screen named in each section, then say each sentence and tick it when Jev clicks the right thing.

- **Say the name exactly as it is written on screen.** Small differences are fine: case, accents, "the … button/tab", counters like "(3)".
- **French names with English recognition:** Jev tells the recognizer the names it sees, which helps, but some may still be misheard. If many are, set `"locale": "fr-FR"` in `~/.jev/config.json` and restart.
- **Note what goes wrong:** the grey text shows what Jev heard; `[failed …]` shows why.

## LinkedIn Jobs

Say "go to LinkedIn", then "click Offres d'emploi" (or open linkedin.com/jobs).

| # | Say | Expected | ✓ |
|---|---|---|---|
| 1 | click Accueil | clicks button "Accueil, 0 nouvelle notification" | |
| 2 | click Offres d'emploi | clicks link "Offres d’emploi, 0 nouvelle notification" | |
| 3 | click Réseau | clicks link "Réseau, 0 nouvelle notification" | |
| 4 | click Messages | clicks link "Messages, 0 nouvelle notification" | |
| 5 | click Notifications | clicks link "Notifications, 0 nouvelle notification" | |
| 6 | click Vous | clicks button "Vous" | |
| 7 | click Préférences | clicks link "Préférences" | |
| 8 | click Suivi des emplois | clicks link "Suivi des emplois" | |
| 9 | click Mes Infos Carrières | clicks link "Mes Infos Carrières" | |
| 10 | click Tout voir | clicks link "Tout voir" | |
| 11 | click the Accueil tab | clicks button "Accueil, 0 nouvelle notification" | |
| 12 | open Messages | opens the Messages app (an app name comes first; say "click Messages" for the link) | |
| 13 | clique sur Accueil | clicks button "Accueil, 0 nouvelle notification" | |
| 14 | click Pour les entreprises | clicks button "Pour les entreprises" | |
| 15 | click Plus d’options | asks "Which one?" | |
| 16 | click Emplois | "I don't see …", nothing clicked | |
| 17 | click Jobs | "I don't see …", nothing clicked | |

## Gmail

Say "go to Gmail".

| # | Say | Expected | ✓ |
|---|---|---|---|
| 18 | click Nouveau message | clicks button "Nouveau message" | |
| 19 | escape | closes the new message window (level 1 key) | |
| 20 | click Boîte de réception | clicks link "Boîte de réception 12365 messages non lus" | |
| 21 | click Messages envoyés | clicks link "Messages envoyés" | |
| 22 | click Brouillons | clicks link "Brouillons 3 messages non lus" | |
| 23 | click Messages suivis | clicks link "Messages suivis" | |
| 24 | click En attente | clicks link "En attente" | |
| 25 | click Promotions | clicks tab "Promotions, 5 nouveaux messages," | |
| 26 | click Réseaux sociaux | clicks tab "Réseaux sociaux" | |
| 27 | click Principale | clicks tab "Principale, 2 nouveaux messages," | |
| 28 | click Paramètres | opens the settings panel | |
| 29 | escape | closes it | |
| 30 | click Actualiser | clicks button "Actualiser" | |
| 31 | click Plus de libellés | clicks button "Plus de libellés" | |
| 32 | click Menu principal | clicks button "Menu principal" | |
| 33 | click Inbox | "I don't see …", nothing clicked | |
| 34 | click Compose | "I don't see …", nothing clicked | |

## YouTube

Say "go to YouTube".

| # | Say | Expected | ✓ |
|---|---|---|---|
| 35 | click Shorts | clicks link "Shorts" | |
| 36 | go back | level 1 key | |
| 37 | click Abonnements | clicks link "Abonnements" | |
| 38 | click Accueil | clicks link "Accueil" | |
| 39 | click Musique | clicks tab "Musique" | |
| 40 | click Jeux vidéo | clicks tab "Jeux vidéo" | |
| 41 | click En direct | asks "Which one?" | |
| 42 | the first one | answer: the En direct tab (the other is a live video badge) | |
| 43 | click Tous | clicks tab "Tous" | |
| 44 | click Créer | opens a small menu | |
| 45 | escape | clicks it | |
| 46 | click Notifications | clicks button "Notifications" | |
| 47 | escape | clicks it | |
| 48 | click Guide | clicks button "Guide" | |
| 49 | click Autres actions | asks "Which one?" | |
| 50 | click Subscriptions | "I don't see …", nothing clicked | |

## System Settings

Say "open settings".

| # | Say | Expected | ✓ |
|---|---|---|---|
| 51 | click Wi-Fi | clicks row "Wi‑Fi" | |
| 52 | click wifi | clicks row "Wi‑Fi" | |
| 53 | click Bluetooth | clicks row "Bluetooth" | |
| 54 | click Network | clicks row "Network" | |
| 55 | click Battery | clicks row "Battery" | |
| 56 | click General | clicks row "General" | |
| 57 | click Appearance | clicks row "Appearance" | |
| 58 | click Displays | clicks row "Displays" | |
| 59 | click Desktop and Dock | clicks row "Desktop & Dock" | |
| 60 | click Privacy and Security | clicks row "Privacy & Security" | |
| 61 | click Screen Time | clicks row "Screen Time" | |
| 62 | click Sound | clicks row "Sound" | |
| 63 | click Keyboard | clicks row "Keyboard" | |
| 64 | click Focus | clicks row "Focus" | |
| 65 | click Notifications | clicks row "Notifications" | |
| 66 | click Accessibility | clicks row "Accessibility" | |
| 67 | click General | then: | |
| 68 | click About | clicks button "About" | |
| 69 | click Back | back to General | |
| 70 | click Software Update | clicks button "Software Update" | |
| 71 | click Back | back to General | |
| 72 | click Storage | clicks button "Storage" | |
| 73 | click Back | back to General | |
| 74 | click Siri | "I don't see …", nothing clicked | |

## Finder

Say "open Finder" (a window showing Downloads works best).

| # | Say | Expected | ✓ |
|---|---|---|---|
| 75 | click Downloads | clicks row "Downloads Arrow Down Circle" | |
| 76 | click Desktop | clicks row "Desktop" | |
| 77 | click Documents | clicks row "Documents document" | |
| 78 | click Applications | clicks row "Applications" | |
| 79 | click Recents | clicks row "Recents clock" | |
| 80 | click AirDrop | clicks row "AirDrop" | |
| 81 | click iCloud Drive | clicks row "iCloud Drive iCloud" | |
| 82 | click Downloads | then pick a file you see, e.g.: | |
| 83 | click voice-test.md | selects the file (use any file name you see) | |
| 84 | double click voice-test.md | opens it | |
| 85 | right click Desktop | opens the context menu | |
| 86 | escape | clicks it | |
| 87 | click New Folder | only in a folder you don't mind: creates "untitled folder" | |
| 88 | click Banana | "I don't see …", nothing clicked | |

## Browser buttons

Any page in Brave.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 89 | click Reload | clicks it | |
| 90 | click Back | clicks it | |
| 91 | click Forward | clicks it | |
| 92 | click Tab search | clicks it | |
| 93 | escape | clicks it | |
| 94 | click Show Sidebar | clicks it | |
| 95 | click Show Sidebar | hides it again | |
| 96 | click Extensions | clicks it | |
| 97 | escape | clicks it | |

## Which one?

On a page where a name appears several times.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 98 | click Plus d’options | on LinkedIn: Jev asks "There are N plus d options. Which one: first, second…?" | |
| 99 | second | answer: clicks the second one, top to bottom | |
| 100 | click Autres actions | on YouTube: asks | |
| 101 | the first one | clicks it | |
| 102 | click Autres actions | clicks it | |
| 103 | banana | answer it can't use: nothing clicked, "Okay, I left it." | |

## Asks before acting

Buttons that can't be undone ask first, unless you said the word.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 104 | click Envoyer | in a Gmail draft with no recipient: clicks, since you said "envoyer" (Gmail then complains about the missing recipient) | |
| 105 | click Supprimer | on a Gmail email you don't need: clicks, since you said "supprimer" | |

## Chains (levels 1 + 2)



| # | Say | Expected | ✓ |
|---|---|---|---|
| 106 | go to YouTube then click Shorts | clicks it | |
| 107 | open settings then click Bluetooth | clicks it | |
| 108 | open Finder then click Downloads | clicks it | |
| 109 | go to Gmail then click Brouillons | clicks it | |
| 110 | go to LinkedIn then click Notifications | clicks it | |

## Should say "I don't see …"

Names that aren't on the screen.

| # | Say | Expected | ✓ |
|---|---|---|---|
| 111 | click banana | "I don't see …", nothing clicked | |
| 112 | click the first job | none (level 4) | |
| 113 | click the blue button | none (level 4) | |
| 114 | click my profile | none (level 4) | |
