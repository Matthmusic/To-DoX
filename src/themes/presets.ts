import type { Theme } from '../types';

/**
 * THÈME CYBERPUNK DARK (Par défaut - Design actuel)
 * Thème sombre cyberpunk avec accents cyan et violet
 */
const CYBERPUNK_DARK: Theme = {
  id: 'cyberpunk-dark',
  name: 'Cyberpunk Dark',
  mode: 'dark',
  custom: false,
  palette: {
    primary: '#06b6d4',      // cyan-500
    secondary: '#a855f7',    // purple-500

    bgPrimary: '#050b1f',    // Fond actuel
    bgSecondary: '#0a0e1a',  // Cartes
    bgTertiary: '#0b1124',   // Inputs

    textPrimary: '#e2e8f0',  // slate-200
    textSecondary: '#cbd5e1', // slate-300
    textMuted: '#94a3b8',    // slate-400 — slate-500 tombait à 4.05:1 sur bgSecondary (< seuil AA 4.5:1)

    borderPrimary: 'rgba(255, 255, 255, 0.1)',
    borderAccent: 'rgba(6, 182, 212, 0.4)', // cyan-500/40

    gradientFrom: 'rgba(11, 45, 66, 0.9)',  // Gradient actuel
    gradientVia: 'rgba(54, 20, 74, 0.85)',
    gradientTo: '#1a0f2c',
  }
};

/**
 * THÈME OCEAN DARK
 * Thème sombre avec tons bleu profond et teal
 */
const OCEAN_DARK: Theme = {
  id: 'ocean-dark',
  name: 'Ocean Deep',
  mode: 'dark',
  custom: false,
  palette: {
    primary: '#3b82f6',      // blue-500
    secondary: '#14b8a6',    // teal-500

    bgPrimary: '#0a1628',    // Bleu très foncé
    bgSecondary: '#0f1f3a',
    bgTertiary: '#1e3a5f',

    textPrimary: '#e0f2fe',  // sky-100
    textSecondary: '#bae6fd',
    textMuted: '#7dd3fc',

    borderPrimary: 'rgba(59, 130, 246, 0.15)',
    borderAccent: 'rgba(59, 130, 246, 0.5)',

    gradientFrom: 'rgba(15, 23, 42, 1)',
    gradientVia: 'rgba(30, 58, 95, 0.8)',
    gradientTo: 'rgba(20, 184, 166, 0.3)',
  }
};

/**
 * THÈME FOREST DARK
 * Thème sombre avec tons vert nature et lime
 */
const FOREST_DARK: Theme = {
  id: 'forest-dark',
  name: 'Forest Night',
  mode: 'dark',
  custom: false,
  palette: {
    primary: '#10b981',      // emerald-500
    secondary: '#84cc16',    // lime-500

    bgPrimary: '#0a1f0f',
    bgSecondary: '#0f2e1a',
    bgTertiary: '#1a3d26',

    textPrimary: '#d1fae5',  // emerald-100
    textSecondary: '#a7f3d0',
    textMuted: '#6ee7b7',

    borderPrimary: 'rgba(16, 185, 129, 0.15)',
    borderAccent: 'rgba(16, 185, 129, 0.5)',

    gradientFrom: 'rgba(10, 31, 15, 1)',
    gradientVia: 'rgba(26, 61, 38, 0.8)',
    gradientTo: 'rgba(132, 204, 22, 0.2)',
  }
};

/**
 * THÈME SUNSET DARK
 * Thème sombre avec tons orange et rose chauds
 */
const SUNSET_DARK: Theme = {
  id: 'sunset-dark',
  name: 'Sunset Glow',
  mode: 'dark',
  custom: false,
  palette: {
    primary: '#f97316',      // orange-500
    secondary: '#ec4899',    // pink-500

    bgPrimary: '#1f0a0a',
    bgSecondary: '#2e1010',
    bgTertiary: '#3d1a1a',

    textPrimary: '#fed7aa',  // orange-200
    textSecondary: '#fbbf24',
    textMuted: '#fb923c',

    borderPrimary: 'rgba(249, 115, 22, 0.15)',
    borderAccent: 'rgba(249, 115, 22, 0.5)',

    gradientFrom: 'rgba(31, 10, 10, 1)',
    gradientVia: 'rgba(61, 26, 26, 0.9)',
    gradientTo: 'rgba(236, 72, 153, 0.3)',
  }
};

/**
 * THÈME NEON PURPLE
 * Thème sombre avec tons violet néon et magenta
 */
const NEON_PURPLE: Theme = {
  id: 'neon-purple',
  name: 'Neon Purple',
  mode: 'dark',
  custom: false,
  palette: {
    primary: '#a855f7',      // purple-500
    secondary: '#ec4899',    // pink-500

    bgPrimary: '#0f0a1f',    // Violet très foncé
    bgSecondary: '#1a0f2e',
    bgTertiary: '#2a1a3f',

    textPrimary: '#f3e8ff',  // purple-50
    textSecondary: '#e9d5ff',
    textMuted: '#c084fc',

    borderPrimary: 'rgba(168, 85, 247, 0.15)',
    borderAccent: 'rgba(168, 85, 247, 0.5)',

    gradientFrom: 'rgba(15, 10, 31, 1)',
    gradientVia: 'rgba(42, 26, 63, 0.9)',
    gradientTo: 'rgba(236, 72, 153, 0.3)',
  }
};

/**
 * THÈME CRIMSON NIGHT
 * Thème sombre avec tons rouge profond et bordeaux
 */
const CRIMSON_NIGHT: Theme = {
  id: 'crimson-night',
  name: 'Crimson Night',
  mode: 'dark',
  custom: false,
  palette: {
    primary: '#ef4444',      // red-500
    secondary: '#f59e0b',    // amber-500

    bgPrimary: '#1a0505',    // Rouge très foncé
    bgSecondary: '#2d0a0a',
    bgTertiary: '#3d1414',

    textPrimary: '#fee2e2',  // red-100
    textSecondary: '#fecaca',
    textMuted: '#fca5a5',

    borderPrimary: 'rgba(239, 68, 68, 0.15)',
    borderAccent: 'rgba(239, 68, 68, 0.5)',

    gradientFrom: 'rgba(26, 5, 5, 1)',
    gradientVia: 'rgba(61, 20, 20, 0.9)',
    gradientTo: 'rgba(245, 158, 11, 0.2)',
  }
};

/**
 * THÈME LIGHT MINIMAL
 * Thème clair épuré avec tons sky et violet
 *
 * Réactivé -- la version précédente utilisait primary/secondary aux mêmes teintes que le
 * thème sombre (sky-500/violet-500) et textMuted en slate-400 : correct sur fond sombre,
 * mais ces teintes tombent sous 4.5:1 (AA) une fois posées sur fond blanc. Remontées d'un
 * cran (sky-700/violet-600) -- valeurs vérifiées ci-dessous.
 *
 * Fonds retravaillés (tous les thèmes clairs ci-dessous) -- version initiale bgPrimary/
 * bgTertiary quasi blancs sur les 6 thèmes clairs, jugée "moche, que du fond blanc" :
 * chaque thème porte maintenant une vraie teinte de fond (bgPrimary/bgTertiary), à l'image
 * des thèmes sombres où bgPrimary/bgSecondary/bgTertiary sont chacun nettement colorés.
 * bgSecondary (cartes) reste proche du blanc pour ne pas brouiller les badges colorés posés
 * dessus. Conséquence : textMuted (slate-500, 4.76:1 sur blanc) tombait sous 4.5:1 une fois
 * posé sur les bgTertiary plus saturés -- remonté à slate-600 sur les 6 thèmes clairs
 * (≥4.89:1 vérifié sur le bgTertiary le plus sombre, Golden Hour).
 */
const LIGHT_MINIMAL: Theme = {
  id: 'light-minimal',
  name: 'Light Minimal',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#0369a1',      // sky-700 -- 5.93:1 sur blanc (sky-500 d'origine : 2.77:1, sous le seuil AA)
    secondary: '#7c3aed',    // violet-600 -- 5.70:1 sur blanc

    bgPrimary: '#f1f5f9',    // slate-100
    bgSecondary: '#f8fafc',  // slate-50 (cartes)
    bgTertiary: '#e2e8f0',   // slate-200 (inputs)

    textPrimary: '#0f172a',  // slate-900 -- 17.85:1 sur blanc
    textSecondary: '#334155', // slate-700 -- 10.35:1 sur blanc
    textMuted: '#475569',    // slate-600 -- 6.15:1 sur bgTertiary (slate-500 : 3.86:1, sous le seuil sur ce fond plus saturé)

    borderPrimary: 'rgba(0, 0, 0, 0.1)',
    borderAccent: 'rgba(3, 105, 161, 0.4)',

    gradientFrom: 'rgba(224, 242, 254, 0.6)',  // sky-100
    gradientVia: 'rgba(237, 233, 254, 0.5)',   // violet-100
    gradientTo: 'rgba(241, 245, 249, 0.9)',    // slate-100
  }
};

/**
 * THÈME DAYLIGHT AMBER
 * Second thème clair -- tons chauds ambre/indigo sur fond papier, pour une alternative
 * au Light Minimal (froid, sky/violet). Mêmes teintes de texte neutres (déjà vérifiées
 * à 4.5:1+ sur blanc pour Light Minimal ci-dessus) -- seuls le fond et les accents changent.
 */
const DAYLIGHT_AMBER: Theme = {
  id: 'daylight-amber',
  name: 'Daylight Amber',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#b45309',      // amber-700 -- 4.68:1 sur bgPrimary (amber-500 : 3.19:1 sur blanc, sous le seuil AA)
    secondary: '#4f46e5',    // indigo-600 -- 5.73:1 sur bgPrimary

    bgPrimary: '#fef6ea',    // crème ambré
    bgSecondary: '#fffbf5',  // blanc chaud (cartes)
    bgTertiary: '#f5deb8',   // beige soutenu (inputs)

    textPrimary: '#0f172a',  // slate-900 -- 17.85:1 sur blanc
    textSecondary: '#334155', // slate-700 -- 10.35:1 sur blanc
    textMuted: '#475569',    // slate-600 -- 5.78:1 sur bgTertiary

    borderPrimary: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(180, 83, 9, 0.4)',

    gradientFrom: 'rgba(254, 243, 199, 0.6)',  // amber-100
    gradientVia: 'rgba(224, 231, 255, 0.5)',   // indigo-100
    gradientTo: 'rgba(254, 246, 234, 0.9)',    // crème ambré
  }
};

/**
 * THÈME MEADOW LIGHT
 * Troisième thème clair -- tons émeraude/sarcelle sur fond papier menthe, pour compléter
 * Light Minimal (froid, sky/violet) et Daylight Amber (chaud, ambre/indigo) par une
 * option "nature" qui manquait côté clair (le pendant clair de Forest Night côté sombre).
 * Secondaire d'abord posé en rose-600 : duo vert/rose jugé "très moche" (effet Noël,
 * clash plutôt que palette nature) -- remplacé par teal-700, analogue à l'émeraude
 * (prairie + mare) au lieu d'être son quasi-complémentaire.
 * Contrastes vérifiés : emerald-700 4.87:1 et teal-700 4.86:1 sur bgPrimary (seuil AA 4.5:1) ;
 * mêmes teintes de texte neutres que les deux autres thèmes clairs (déjà vérifiées ≥4.5:1).
 */
const MEADOW_LIGHT: Theme = {
  id: 'meadow-light',
  name: 'Meadow Light',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#047857',      // emerald-700 -- 4.87:1 sur bgPrimary
    secondary: '#0f766e',    // teal-700 -- 4.86:1 sur bgPrimary

    bgPrimary: '#e3f6ea',    // sauge clair
    bgSecondary: '#f2fbf6',  // blanc menthe (cartes)
    bgTertiary: '#c8ecd9',   // menthe soutenu (inputs)

    textPrimary: '#0f172a',  // slate-900 -- 17.85:1 sur blanc
    textSecondary: '#334155', // slate-700 -- 10.35:1 sur blanc
    textMuted: '#475569',    // slate-600 -- 5.94:1 sur bgTertiary

    borderPrimary: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(4, 120, 87, 0.4)',

    gradientFrom: 'rgba(209, 250, 229, 0.6)',  // emerald-100
    gradientVia: 'rgba(204, 251, 241, 0.5)',   // teal-100
    gradientTo: 'rgba(227, 246, 234, 0.9)',    // sauge clair
  }
};

/**
 * THÈME OCEAN BREEZE LIGHT
 * Quatrième thème clair -- bleu/cyan froid, pendant clair d'Ocean Deep.
 * Contrastes vérifiés : blue-700 5.75:1, cyan-700 4.74:1 sur bgPrimary.
 */
const OCEAN_BREEZE_LIGHT: Theme = {
  id: 'ocean-breeze-light',
  name: 'Ocean Breeze',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#1d4ed8',      // blue-700 -- 5.75:1 sur bgPrimary
    secondary: '#0e7490',    // cyan-700 -- 4.74:1 sur bgPrimary

    bgPrimary: '#e6f3fc',    // ciel clair
    bgSecondary: '#f2f9fd',  // blanc bleuté (cartes)
    bgTertiary: '#c3e2f7',   // bleu soutenu (inputs)

    textPrimary: '#0f172a',  // slate-900 -- 17.85:1 sur blanc
    textSecondary: '#334155', // slate-700 -- 10.35:1 sur blanc
    textMuted: '#475569',    // slate-600 -- 5.61:1 sur bgTertiary

    borderPrimary: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(29, 78, 216, 0.4)',

    gradientFrom: 'rgba(219, 234, 254, 0.6)',  // blue-100
    gradientVia: 'rgba(207, 250, 254, 0.5)',   // cyan-100
    gradientTo: 'rgba(230, 243, 252, 0.9)',    // ciel clair
  }
};

/**
 * THÈME BLOSSOM LIGHT
 * Cinquième thème clair -- rose/violet, pendant clair de Neon Purple.
 * Contrastes vérifiés : pink-700 5.07:1, purple-600 4.72:1 sur bgPrimary.
 */
const BLOSSOM_LIGHT: Theme = {
  id: 'blossom-light',
  name: 'Blossom Light',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#be185d',      // pink-700 -- 5.07:1 sur bgPrimary
    secondary: '#9333ea',    // purple-600 -- 4.72:1 sur bgPrimary

    bgPrimary: '#fbecf5',    // lavande-rose clair
    bgSecondary: '#fdf4f9',  // blanc rosé (cartes)
    bgTertiary: '#f0c9e2',   // rose soutenu (inputs)

    textPrimary: '#0f172a',  // slate-900 -- 17.85:1 sur blanc
    textSecondary: '#334155', // slate-700 -- 10.35:1 sur blanc
    textMuted: '#475569',    // slate-600 -- 5.11:1 sur bgTertiary

    borderPrimary: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(190, 24, 93, 0.4)',

    gradientFrom: 'rgba(252, 231, 243, 0.6)',  // pink-100
    gradientVia: 'rgba(243, 232, 255, 0.5)',   // purple-100
    gradientTo: 'rgba(251, 236, 245, 0.9)',    // lavande-rose clair
  }
};

/**
 * THÈME GOLDEN HOUR LIGHT
 * Sixième thème clair -- orange/rouge chaud, pendant clair de Crimson Night / Sunset Glow.
 * Duo monochromatique chaud (orange→rouge) plutôt qu'un complémentaire, pour éviter tout
 * risque de clash (cf. Meadow Light v1, vert/rose jugé "très moche").
 * Contrastes vérifiés : orange-700 4.66:1, red-700 5.82:1 sur bgPrimary.
 */
const GOLDEN_HOUR_LIGHT: Theme = {
  id: 'golden-hour-light',
  name: 'Golden Hour',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#c2410c',      // orange-700 -- 4.66:1 sur bgPrimary
    secondary: '#b91c1c',    // red-700 -- 5.82:1 sur bgPrimary

    bgPrimary: '#fef1e2',    // pêche clair
    bgSecondary: '#fff5ec',  // blanc chaud (cartes)
    bgTertiary: '#f6c79a',   // pêche soutenu (inputs)

    textPrimary: '#0f172a',  // slate-900 -- 17.85:1 sur blanc
    textSecondary: '#334155', // slate-700 -- 10.35:1 sur blanc
    textMuted: '#475569',    // slate-600 -- 4.89:1 sur bgTertiary

    borderPrimary: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(194, 65, 12, 0.4)',

    gradientFrom: 'rgba(255, 237, 213, 0.6)',  // orange-100
    gradientVia: 'rgba(254, 226, 226, 0.5)',   // red-100
    gradientTo: 'rgba(254, 241, 226, 0.9)',    // pêche clair
  }
};

/**
 * Liste de tous les thèmes prédéfinis
 */
export const PRESET_THEMES: Theme[] = [
  CYBERPUNK_DARK,
  OCEAN_DARK,
  FOREST_DARK,
  SUNSET_DARK,
  NEON_PURPLE,
  CRIMSON_NIGHT,
  LIGHT_MINIMAL,
  DAYLIGHT_AMBER,
  MEADOW_LIGHT,
  OCEAN_BREEZE_LIGHT,
  BLOSSOM_LIGHT,
  GOLDEN_HOUR_LIGHT,
];

/**
 * Thème par défaut (actuel)
 */
export const DEFAULT_THEME = CYBERPUNK_DARK;
