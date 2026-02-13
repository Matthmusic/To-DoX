import { useEffect } from 'react';
import useStore from '../store/useStore';
import { PRESET_THEMES, DEFAULT_THEME } from '../themes/presets';
import type { Theme, ThemeMode } from '../types';

/**
 * Hook pour gérer le système de thèmes
 * Applique les variables CSS et gère le mode auto (détection système)
 */
export function useTheme() {
  const { themeSettings, updateThemeSettings } = useStore();

  // Obtenir le thème actif complet
  const getActiveTheme = (): Theme => {
    const preset = PRESET_THEMES.find(t => t.id === themeSettings.activeThemeId);
    const custom = themeSettings.customThemes.find(t => t.id === themeSettings.activeThemeId);
    return custom || preset || DEFAULT_THEME;
  };

  // Déterminer le mode effectif (résoudre "auto")
  const getEffectiveMode = (): 'light' | 'dark' => {
    if (themeSettings.mode === 'auto') {
      // Détecter le thème système
      if (window.electronAPI?.isElectron) {
        // Utiliser l'API Electron (plus fiable)
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        // Fallback web: utiliser prefers-color-scheme
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    }
    return themeSettings.mode;
  };

  // Appliquer le thème (mettre à jour les CSS variables + forcer recalcul du gradient)
  const applyTheme = (theme: Theme, customAccent?: string) => {
    console.log('[applyTheme] Applying theme:', theme.name, theme.palette);
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

    console.log('[applyTheme] Theme applied:', {
      name: theme.name,
      bgPrimary: palette.bgPrimary,
      textPrimary: palette.textPrimary,
    });

    // Retirer la classe après la transition
    setTimeout(() => {
      body.classList.remove('theme-transitioning');
    }, 300);
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

  // Appliquer le thème au montage et lors des changements
  useEffect(() => {
    const activeTheme = getActiveTheme();
    applyTheme(activeTheme, themeSettings.customAccentColor);
  }, [themeSettings.activeThemeId, themeSettings.customAccentColor, themeSettings.mode, themeSettings.customThemes]);

  // Écouter les changements du thème système (mode auto)
  useEffect(() => {
    if (themeSettings.mode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const activeTheme = getActiveTheme();
      applyTheme(activeTheme, themeSettings.customAccentColor);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSettings.mode, themeSettings.activeThemeId, themeSettings.customAccentColor]);

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
