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
    textMuted: '#64748b',    // slate-500

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
 */
const LIGHT_MINIMAL: Theme = {
  id: 'light-minimal',
  name: 'Light Minimal',
  mode: 'light',
  custom: false,
  palette: {
    primary: '#0ea5e9',      // sky-500
    secondary: '#8b5cf6',    // violet-500

    bgPrimary: '#f8fafc',    // slate-50
    bgSecondary: '#ffffff',
    bgTertiary: '#f1f5f9',   // slate-100

    textPrimary: '#0f172a',  // slate-900
    textSecondary: '#334155', // slate-700
    textMuted: '#94a3b8',    // slate-400

    borderPrimary: 'rgba(0, 0, 0, 0.1)',
    borderAccent: 'rgba(14, 165, 233, 0.4)',

    gradientFrom: 'rgba(248, 250, 252, 1)',
    gradientVia: 'rgba(226, 232, 240, 0.5)',
    gradientTo: 'rgba(241, 245, 249, 0.8)',
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
  // LIGHT_MINIMAL, // Désactivé
];

/**
 * Thème par défaut (actuel)
 */
export const DEFAULT_THEME = CYBERPUNK_DARK;
