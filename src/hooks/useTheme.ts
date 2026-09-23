import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { PRESET_THEMES, DEFAULT_THEME } from '../themes/presets';
import { devLog, devWarn } from '../utils';
import type { Theme, ThemeMode } from '../types';

const THEME_STORAGE_KEY = 'theme_settings';

/** "#RRGGBB" -> "R, G, B" (pour injection dans rgba(var(--x), alpha)). null si le format ne matche pas. */
function hexToRgbTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return [m[1], m[2], m[3]].map((h) => parseInt(h, 16)).join(', ');
}

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

  // Marqueur pour les surcharges CSS de src/index.css (voir la section "Surcharges thème
  // clair") -- de nombreux encadrés colorés (info/succès/erreur/avertissement) utilisent
  // des teintes claires (text-rose-100, text-blue-200...) pensées pour un fond sombre ;
  // illisibles telles quelles sur fond clair, corrigées via ce sélecteur plutôt qu'en
  // retouchant chaque occurrence une par une (200+ dans le code).
  root.classList.toggle('theme-light', theme.mode === 'light');

  // Override de la couleur primaire si accent custom défini
  const primary = customAccent || palette.primary;
  const primaryRgb = hexToRgbTriplet(primary) ?? '255, 255, 255';

  // Définir les variables CSS sur :root
  root.style.setProperty('--color-primary', primary);
  // Triplet RGB de l'accent -- pour les endroits qui ont besoin d'une opacité variable de
  // la couleur d'accent (ex. surbrillance de sélection dans les listes d'autocomplétion,
  // ex-#1E3A8A codé en dur, indépendant du thème -- voir /impeccable audit) via
  // bg-[rgba(var(--color-primary-rgb),0.6)] ; bg-[var(--color-primary)]/60 ne marche pas,
  // Tailwind ne peut pas décomposer l'opacité d'une valeur var() à la compilation.
  root.style.setProperty('--color-primary-rgb', primaryRgb);
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

  // Triplet RGB (sans "rgb()") pour les surcouches translucides ("verre dépoli" des
  // boutons/cartes/bordures, ex. l'ancien bg-white à 5% d'opacité) -- utilisé via
  // bg-[rgba(var(--overlay-rgb),0.05)] pour que cet effet reste blanc en thème sombre
  // et devienne un voile sombre cohérent en thème clair, au lieu d'un blanc figé qui
  // deviendrait invisible (ou pire, un halo clair parasite) sur un fond clair.
  root.style.setProperty('--overlay-rgb', theme.mode === 'dark' ? '255, 255, 255' : '15, 23, 42');

  // Paire d'ombres pour l'effet néomorphique des colonnes Kanban (double ombre
  // claire/sombre qui donne un relief doux par rapport au fond, sans bordure). L'ombre
  // "claire" vient de la couleur d'accent du thème en sombre (une lueur discrète plutôt
  // qu'un blanc plat) et du blanc pur en clair (où elle doit être visible = opacité
  // élevée) ; l'ombre "sombre" est un noir profond en sombre, un gris ardoise doux en
  // clair (un gris neutre paraîtrait sale sur un fond déjà très clair). Opacités
  // distinctes par thème, d'où des rgba() complets plutôt que de simples triplets RGB.
  root.style.setProperty('--neu-shadow-light', theme.mode === 'dark' ? `rgba(${primaryRgb}, 0.12)` : 'rgba(255, 255, 255, 0.85)');
  root.style.setProperty('--neu-shadow-dark', theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(100, 116, 139, 0.2)');

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
