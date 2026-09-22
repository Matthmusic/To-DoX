import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { PRESET_THEMES, DEFAULT_THEME } from '../themes/presets';
import { devLog, devWarn } from '../utils';
import type { Theme, ThemeMode } from '../types';

const THEME_STORAGE_KEY = 'theme_settings';

/**
 * Applique le thème (variables CSS + forçage du recalcul du gradient). Utilitaire pur,
 * partagé par `useThemeEffects` (seul appelant des effets qui en dépendent).
 */
function applyTheme(theme: Theme, customAccent?: string) {
  devLog('[applyTheme] Applying theme:', theme.name, theme.palette);
  const root = document.documentElement;
  const body = document.body;
  const palette = theme.palette;

  // Ajouter classe de transition
  body.classList.add('theme-transitioning');

  // Override de la couleur primaire si accent custom défini
  const primary = customAccent || palette.primary;

  // Définir les variables CSS sur :root
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-secondary', palette.secondary);

  root.style.setProperty('--bg-primary', palette.bgPrimary);
  root.style.setProperty('--bg-secondary', palette.bgSecondary);
  root.style.setProperty('--bg-tertiary', palette.bgTertiary);

  root.style.setProperty('--text-primary', palette.textPrimary);
  root.style.setProperty('--text-secondary', palette.textSecondary);
  root.style.setProperty('--text-muted', palette.textMuted);

  root.style.setProperty('--border-primary', palette.borderPrimary);
  root.style.setProperty('--border-accent', palette.borderAccent);

  root.style.setProperty('--gradient-from', palette.gradientFrom);
  root.style.setProperty('--gradient-via', palette.gradientVia);
  root.style.setProperty('--gradient-to', palette.gradientTo);

  // FORCER LE RECALCUL DU GRADIENT (fix: gradients ne se recalculent pas auto avec CSS vars)
  // On applique le gradient directement avec les valeurs de la palette
  const backgroundGradient = `
    radial-gradient(1200px 700px at 15% 20%, ${palette.gradientFrom} 0%, transparent 60%),
    radial-gradient(900px 600px at 80% 30%, ${palette.gradientVia} 0%, transparent 65%),
    linear-gradient(120deg, ${palette.bgPrimary} 0%, ${palette.bgSecondary} 45%, ${palette.gradientTo} 100%)
  `;

  body.style.backgroundColor = palette.bgPrimary;
  body.style.backgroundImage = backgroundGradient;
  body.style.color = palette.textPrimary;

  // Appliquer aussi sur #root pour assurer la cohérence
  const rootDiv = document.getElementById('root');
  if (rootDiv) {
    rootDiv.style.backgroundColor = palette.bgPrimary;
    rootDiv.style.backgroundImage = backgroundGradient;
    rootDiv.style.color = palette.textPrimary;
  }

  devLog('[applyTheme] Theme applied:', {
    name: theme.name,
    bgPrimary: palette.bgPrimary,
    textPrimary: palette.textPrimary,
  });

  // Retirer la classe après la transition
  setTimeout(() => {
    body.classList.remove('theme-transitioning');
  }, 300);
}

function resolveActiveTheme(activeThemeId: string, customThemes: Theme[]): Theme {
  const preset = PRESET_THEMES.find(t => t.id === activeThemeId);
  const custom = customThemes.find(t => t.id === activeThemeId);
  return custom || preset || DEFAULT_THEME;
}

/**
 * Effets globaux du système de thèmes (chargement localStorage, application DOM,
 * écoute du thème système, persistance) -- à appeler UNE SEULE FOIS, au plus haut niveau
 * de l'app (voir App.tsx). `useTheme()` (ci-dessous), lui, est appelé dans ~24 composants
 * pour lire les valeurs courantes du thème -- avant cette séparation, chacun de ces 24
 * appels ré-exécutait aussi ces effets (mutations DOM + écriture localStorage) en double,
 * un vrai coût de performance à chaque re-render (constaté en usage réel : ralentissement
 * perceptible, surtout combiné au polling 4s de useApiSync qui redéclenche des re-renders
 * dans toute l'app).
 *
 * Le thème est un réglage local au poste (pas synchronisé via le backend) : il est
 * chargé/sauvegardé dans une clé localStorage dédiée, gérée uniquement ici.
 */
export function useThemeEffects() {
  const { themeSettings, setThemeSettings } = useStore();

  // Empêche l'effet d'application/sauvegarde d'écraser un thème sauvegardé par la
  // valeur par défaut du store lors du tout premier rendu, avant que l'effet de
  // chargement (ci-dessous) n'ait eu la chance de restaurer le thème sauvegardé.
  const hasRunApplyEffectRef = useRef(false);

  // Charger le thème sauvegardé localement (par poste) au montage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        setThemeSettings(JSON.parse(raw));
      }
    } catch {
      devWarn('[useTheme] Erreur parsing theme_settings, thème par défaut conservé');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Appliquer le thème au montage et lors des changements, puis persister
  // localement (localStorage) — sauf lors du tout premier passage, qui utilise
  // encore la valeur par défaut du store avant que l'effet de chargement
  // ci-dessus n'ait restauré un éventuel thème sauvegardé.
  useEffect(() => {
    const activeTheme = resolveActiveTheme(themeSettings.activeThemeId, themeSettings.customThemes);
    applyTheme(activeTheme, themeSettings.customAccentColor);

    if (!hasRunApplyEffectRef.current) {
      hasRunApplyEffectRef.current = true;
      return;
    }
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeSettings));
  }, [themeSettings.activeThemeId, themeSettings.customAccentColor, themeSettings.mode, themeSettings.customThemes]);

  // Écouter les changements du thème système (mode auto)
  useEffect(() => {
    if (themeSettings.mode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const activeTheme = resolveActiveTheme(themeSettings.activeThemeId, themeSettings.customThemes);
      applyTheme(activeTheme, themeSettings.customAccentColor);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSettings.mode, themeSettings.activeThemeId, themeSettings.customAccentColor]);
}

/**
 * Hook pour LIRE le thème courant et ses setters -- aucun effet de bord (voir
 * `useThemeEffects`, appelé une seule fois dans App.tsx pour ça). Peut être appelé depuis
 * n'importe quel composant sans coût de mutation DOM/localStorage supplémentaire.
 */
export function useTheme() {
  const { themeSettings, updateThemeSettings } = useStore();

  const getActiveTheme = (): Theme => resolveActiveTheme(themeSettings.activeThemeId, themeSettings.customThemes);

  // Déterminer le mode effectif (résoudre "auto")
  const getEffectiveMode = (): 'light' | 'dark' => {
    if (themeSettings.mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeSettings.mode;
  };

  // Changer le mode de thème
  const setMode = (mode: ThemeMode) => {
    updateThemeSettings({ mode });

    // Mettre à jour Electron nativeTheme si applicable
    if (window.electronAPI?.isElectron && window.electronAPI.setNativeTheme) {
      if (mode === 'auto') {
        window.electronAPI.setNativeTheme('system');
      } else {
        window.electronAPI.setNativeTheme(mode);
      }
    }
  };

  // Changer le thème actif
  const setActiveTheme = (themeId: string) => {
    updateThemeSettings({ activeThemeId: themeId });
  };

  // Définir une couleur d'accent personnalisée
  const setCustomAccent = (color: string | undefined) => {
    updateThemeSettings({ customAccentColor: color });
  };

  // Ajouter un thème personnalisé
  const addCustomTheme = (theme: Theme) => {
    const customThemes = [...themeSettings.customThemes, theme];
    updateThemeSettings({ customThemes });
  };

  // Supprimer un thème personnalisé
  const removeCustomTheme = (themeId: string) => {
    const customThemes = themeSettings.customThemes.filter(t => t.id !== themeId);
    updateThemeSettings({ customThemes });

    // Si le thème supprimé était actif, revenir au thème par défaut
    if (themeSettings.activeThemeId === themeId) {
      updateThemeSettings({ activeThemeId: DEFAULT_THEME.id });
    }
  };

  return {
    mode: themeSettings.mode,
    activeTheme: getActiveTheme(),
    effectiveMode: getEffectiveMode(),
    presetThemes: PRESET_THEMES,
    customThemes: themeSettings.customThemes,
    customAccentColor: themeSettings.customAccentColor,
    setMode,
    setActiveTheme,
    setCustomAccent,
    addCustomTheme,
    removeCustomTheme,
  };
}
