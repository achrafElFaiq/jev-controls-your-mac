// Level 2: "click <name>" said with the name as written, on the public screens. Used by
// test/click.test.js (exact matching in code) and scripts/eval-jev.js (Jev deciding).
export const ASK = Symbol('ask');

// [screen, what's said, expected: a label (click it), ASK (several: ask which), or null (nothing)]
export const CASES = [
  // LinkedIn (French site)
  ['linkedin', 'click Accueil', 'Accueil, 0 nouvelle notification'], ['linkedin', 'click Réseau', 'Réseau, 0 nouvelle notification'],
  ['linkedin', "click Offres d'emploi", 'Offres d’emploi, 0 nouvelle notification'], ['linkedin', 'click the Offres d’emploi tab', 'Offres d’emploi, 0 nouvelle notification'],
  ['linkedin', 'open Messages', 'Messages, 2 nouvelles notifications'], ['linkedin', 'click notifications', 'Notifications, 5 nouvelles notifications'],
  ['linkedin', 'click Vous', 'Vous'], ['linkedin', 'clique sur Préférences', 'Préférences'], ['linkedin', 'click suivi des emplois', 'Suivi des emplois'],
  ['linkedin', 'click Candidature simplifiée', 'Candidature simplifiée'], ['linkedin', 'click candidature simplifiee', 'Candidature simplifiée'],
  ['linkedin', 'click the Candidature simplifiée button', 'Candidature simplifiée'], ['linkedin', 'appuie sur Candidature simplifiée', 'Candidature simplifiée'],
  ['linkedin', 'click Data Scientist IA', 'Data Scientist IA F/H (offre d’emploi vérifiée) Data Scientist IA F/H Exemple SA Paris'],
  ['linkedin', 'click AI Engineer', 'AI Engineer (H/F) – Lille & Paris'], ['linkedin', 'click tout voir', 'Tout voir'],
  ['linkedin', 'click plus d’options', ASK], ['linkedin', 'click Pour les entreprises', 'Pour les entreprises'],
  ['linkedin', 'click Emplois', null], ['linkedin', 'clique sur notification', 'Notifications, 5 nouvelles notifications'], ['linkedin', 'clique sur offre d’emploi', 'Offres d’emploi, 0 nouvelle notification'], ['linkedin', 'click Jobs', null], ['linkedin', 'click banana', null],
  // Gmail (French)
  ['gmail', 'click Nouveau message', 'Nouveau message'], ['gmail', 'click boîte de réception', 'Boîte de réception 12365 messages non lus'],
  ['gmail', 'click messages envoyés', 'Messages envoyés'], ['gmail', 'click Brouillons', 'Brouillons 3 messages non lus'], ['gmail', 'click Achats', 'Achats 327 messages non lus contient un menu'],
  ['gmail', 'click Candidature', 'Candidature contient un menu'], ['gmail', 'click en attente', 'En attente'], ['gmail', 'click messages suivis', 'Messages suivis'],
  ['gmail', 'click Paramètres', 'Paramètres'], ['gmail', 'click Actualiser', 'Actualiser'], ['gmail', 'click Promotions', 'Promotions, 5 nouveaux messages,'],
  ['gmail', 'click the Principale tab', 'Principale, 2 nouveaux messages,'], ['gmail', 'click Réseaux sociaux', 'Réseaux sociaux'], ['gmail', 'click plus de libellés', 'Plus de libellés'],
  ['gmail', 'click Suiv', 'Suiv.'], ['gmail', 'click menu principal', 'Menu principal'], ['gmail', 'tick Sélectionner', 'Sélectionner'],
  ['gmail', 'click Email 1', 'Email 1'], ['gmail', 'click Email', ASK], ['gmail', 'click Inbox', null], ['gmail', 'click Compose', null],
  // YouTube (French)
  ['youtube', 'click Shorts', 'Shorts'], ['youtube', 'click Abonnements', 'Abonnements'], ['youtube', 'click Accueil', 'Accueil'],
  ['youtube', 'click Musique', 'Musique'], ['youtube', 'click the Jeux vidéo tab', 'Jeux vidéo'], ['youtube', 'click en direct', 'En direct'], ['youtube', 'click Tous', 'Tous'],
  ['youtube', 'click Créer', 'Créer'], ['youtube', 'click notifications', 'Notifications'], ['youtube', 'click menu du compte', 'Menu du compte'], ['youtube', 'click Guide', 'Guide'],
  ['youtube', 'click Suivant', 'Suivant'], ['youtube', 'click how to invest at every salary', 'How to Invest at Every Salary 23 minutes'],
  ['youtube', 'click Top 5 Most Successful Products', 'Top 5 Most Successful Products'], ['youtube', 'click autres actions', ASK],
  ['youtube', 'click search', 'Search'], ['youtube', 'click effectuer une recherche vocale', 'Effectuer une recherche vocale'], ['youtube', 'click Subscriptions', null], ['youtube', 'clique sur abonnement', 'Abonnements'], ['youtube', 'clique sur jeu vidéo', 'Jeux vidéo'],
  // System Settings
  ['settings', 'click Wi-Fi', 'Wi‑Fi'], ['settings', 'click wifi', 'Wi‑Fi'], ['settings', 'click Bluetooth', 'Bluetooth'], ['settings', 'open Network', 'Network'],
  ['settings', 'click Battery', 'Battery'], ['settings', 'click General', 'General'], ['settings', 'click Appearance', 'Appearance'], ['settings', 'click Displays', 'Displays'],
  ['settings', 'click Desktop and Dock', 'Desktop & Dock'], ['settings', 'click Desktop & Dock', 'Desktop & Dock'], ['settings', 'click Privacy & Security', 'Privacy & Security'],
  ['settings', 'click Screen Time', 'Screen Time'], ['settings', 'click Sound', 'Sound'], ['settings', 'click Keyboard', 'Keyboard'], ['settings', 'click Focus', 'Focus'],
  ['settings', 'click Notifications', 'Notifications'], ['settings', 'click Software Update', 'Software Update'], ['settings', 'click Storage', 'Storage'],
  ['settings', 'click About', 'About'], ['settings', 'click Date & Time', 'Date & Time'], ['settings', 'click Back', 'Back'], ['settings', 'click Edit', 'Edit'],
  ['settings', 'click Apple Intelligence & Siri', 'Apple Intelligence & Siri'], ['settings', 'click Siri', null],
  // Finder
  ['finder', 'click Downloads', 'Downloads Arrow Down Circle'], ['finder', 'click Desktop', 'Desktop'], ['finder', 'click Documents', 'Documents document'],
  ['finder', 'click Applications', 'Applications'], ['finder', 'click Recents', 'Recents clock'], ['finder', 'click Trash', 'Trash trash'], ['finder', 'click AirDrop', 'AirDrop'],
  ['finder', 'click iCloud Drive', 'iCloud Drive iCloud'], ['finder', 'click New Folder', 'New Folder'], ['finder', 'click Quick Look', 'Quick Look'],
  ['finder', 'double click report.pdf', 'report.pdf PDF Document 13 October 2026 at 10:02'], ['finder', 'click report dot pdf', null],
  ['finder', 'select notes.txt', 'notes.txt Plain Text 12 October 2026 at 09:15'], ['finder', 'click photo 2', 'photo 2 PNG image 28 September 2026 at 22:04'],
  ['finder', 'click photo 25', 'photo 25 PNG image 28 September 2026 at 22:04'], ['finder', 'click Invoice', ASK], ['finder', 'click invoice march', 'Invoice March PDF Document 2 October 2026'],
  ['finder', 'click File', 'File'], ['finder', 'click Go', 'Go'], ['finder', 'click Delete', 'Delete'], ['finder', 'right click Desktop', 'Desktop'],
  // A form with a dialog
  ['form', 'click Save', 'Save'], ['form', 'click save as draft', 'Save as draft'], ['form', 'click Cancel', 'Cancel'], ['form', 'click next', 'Next'],
  ['form', 'click Close', 'Close'], ['form', 'click accept all cookies', 'Accept all cookies'], ['form', 'click Accept', 'Accept all cookies'], ['form', 'click reject all', 'Reject all'],
  ['form', 'tick remember me', 'Remember me'], ['form', 'check I accept the terms', 'I accept the terms'], ['form', 'select Yearly', 'Yearly'], ['form', 'click monthly', 'Monthly'],
  ['form', 'click privacy policy', 'Privacy policy'], ['form', 'click first name', 'First name'], ['form', 'click the email field', 'Email'], ['form', 'click disabled one', null],
  ['form', 'please click the Save button', 'Save'], ['form', 'can you press next', 'Next'], ['form', 'tap Cancel', 'Cancel'], ['form', 'hit save', 'Save'],
];
