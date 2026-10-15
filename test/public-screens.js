// Screens modeled on real ones: names as LinkedIn, Gmail, YouTube, System Settings and
// Finder really write them (French sites, English macOS), with neutral content.
let n = 0;
const el = (role, label, extra = {}) => ({ id: `e${++n}`, role: `AX${role}`, label, pos: [0, n * 20], ...extra });

export const SCREENS = {
  linkedin: [
    el('Link', 'Passer au contenu principal'), el('SearchField', 'Décrivez l’emploi que vous recherchez'),
    el('Link', 'Accueil, 0 nouvelle notification'), el('Link', 'Réseau, 0 nouvelle notification'), el('Link', 'Offres d’emploi, 0 nouvelle notification'),
    el('Link', 'Messages, 2 nouvelles notifications'), el('Link', 'Notifications, 5 nouvelles notifications'), el('Button', 'Vous'), el('Button', 'Pour les entreprises'),
    el('Link', 'Préférences'), el('Link', 'Suivi des emplois'), el('Link', 'Mes Infos Carrières'),
    el('Link', 'Data Scientist IA F/H (offre d’emploi vérifiée) Data Scientist IA F/H Exemple SA Paris'),
    el('Button', 'Ignorer l’offre d’emploi Data Scientist IA F/H'), el('Button', 'Plus d’options'), el('Button', 'Plus d’options'),
    el('Link', 'AI Engineer (H/F) – Lille & Paris'), el('Button', 'Candidature simplifiée'), el('Link', 'Tout voir'),
  ],
  gmail: [
    el('Button', 'Menu principal'), el('SearchField', 'Rechercher dans les messages'), el('Button', 'Paramètres'), el('Button', 'Nouveau message'),
    el('Link', 'Boîte de réception 12365 messages non lus'), el('Link', 'Messages suivis'), el('Link', 'En attente'), el('Link', 'Messages envoyés'),
    el('Link', 'Brouillons 3 messages non lus'), el('Link', 'Achats 327 messages non lus contient un menu'), el('Link', 'Candidature contient un menu'),
    el('Button', 'Plus de libellés'), el('CheckBox', 'Sélectionner', { value: '0' }), el('Button', 'Actualiser'),
    el('Tab', 'Principale, 2 nouveaux messages,'), el('Tab', 'Promotions, 5 nouveaux messages,'), el('Tab', 'Réseaux sociaux'),
    el('Row', 'Email 1'), el('Row', 'Email 2'), el('Button', 'Préc.'), el('Button', 'Suiv.'),
  ],
  youtube: [
    el('Button', 'Guide'), el('Link', 'Accueil YouTube'), el('SearchField', 'Rechercher'), el('Button', 'Search'), el('Button', 'Effectuer une recherche vocale'),
    el('Button', 'Créer'), el('Button', 'Notifications'), el('Button', 'Menu du compte'), el('Link', 'Accueil'), el('Link', 'Shorts'), el('Link', 'Abonnements'),
    el('Tab', 'Tous'), el('Tab', 'Musique'), el('Tab', 'Jeux vidéo'), el('Tab', 'En direct'), el('Button', 'Autres actions'), el('Button', 'Autres actions'), el('Button', 'Autres actions'),
    el('Link', 'How to Invest at Every Salary 23 minutes'), el('Link', 'Top 5 Most Successful Products'), el('Button', 'Suivant'),
  ],
  settings: [
    el('MenuButton', 'Back'), el('MenuButton', 'Forward'), el('SearchField', ''),
    ...['Wi‑Fi', 'Bluetooth', 'Network', 'Battery', 'General', 'Accessibility', 'Appearance', 'Apple Intelligence & Siri', 'Desktop & Dock', 'Displays',
      'Notifications', 'Sound', 'Focus', 'Screen Time', 'Privacy & Security', 'Touch ID & Password', 'Keyboard'].flatMap((l) => [el('Row', l), el('Cell', l)]),
    // Appearance pane: accent colors.
    ...['Blue', 'Purple', 'Pink', 'Red', 'Orange', 'Yellow', 'Green', 'Graphite', 'Multicolor'].map((c) => el('Button', c)),
    el('Button', 'About'), el('Button', 'Software Update'), el('Button', 'Storage'), el('Button', 'Date & Time'), el('Button', 'Language & Region'),
    el('MenuBarItem', 'System Settings'), el('MenuBarItem', 'Edit'), el('MenuBarItem', 'View'), el('MenuBarItem', 'Window'), el('MenuBarItem', 'Help'),
  ],
  finder: [
    el('Button', 'New Folder'), el('Button', 'Quick Look'), el('Button', 'Delete'), el('Button', 'Share'), el('SearchField', 'Search'),
    ...['Recents clock', 'Applications', 'Downloads Arrow Down Circle', 'Desktop', 'Documents document', 'iCloud Drive iCloud', 'AirDrop', 'Trash trash'].flatMap((l) => [el('Row', l), el('Cell', l)]),
    el('Button', 'back'), el('Button', 'forward'),
    el('Row', 'report.pdf PDF Document 13 October 2026 at 10:02'), el('Row', 'notes.txt Plain Text 12 October 2026 at 09:15'),
    el('Row', 'photo 2 PNG image 28 September 2026 at 22:04'), el('Row', 'photo 25 PNG image 28 September 2026 at 22:04'),
    el('Row', 'Invoice PDF Document 2 October 2026'), el('Row', 'Invoice March PDF Document 2 October 2026'),
    el('MenuBarItem', 'File'), el('MenuBarItem', 'Edit'), el('MenuBarItem', 'Go'),
  ],
  form: [
    el('TextField', 'First name'), el('TextField', 'Email'), el('CheckBox', 'Remember me', { value: '1' }), el('CheckBox', 'I accept the terms', { value: '0' }),
    el('RadioButton', 'Monthly'), el('RadioButton', 'Yearly'), el('Button', 'Save'), el('Button', 'Save as draft'), el('Button', 'Cancel'), el('Button', 'Next'),
    el('Button', 'Close', { inDialog: true }), el('Button', 'Close'), el('Button', 'Accept all cookies', { inDialog: true }), el('Button', 'Reject all', { inDialog: true }),
    el('Link', 'Privacy policy'), el('Link', 'Privacy policy', { offscreen: 'below' }), el('Button', 'Disabled one', { disabled: true }),
  ],
};
