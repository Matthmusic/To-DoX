import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';
import useStore from '../store/useStore';
import { DEFAULT_THEME } from '../themes/presets';

// useTheme() lit les valeurs/setters du thème courant, sans effet de bord -- voir
// useThemeEffects.test.ts pour le chargement/l'application DOM/la persistance
// (extraits de ce hook pour n'être exécutés qu'une seule fois par app, pas une fois par
// composant appelant useTheme(), ~24 dans le code actuel).
const initial = useStore.getInitialState();

beforeEach(() => {
    localStorage.clear();
    useStore.setState({ ...initial, themeSettings: { ...initial.themeSettings } });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useTheme — valeurs et setters', () => {
    it('returns the default theme and mode when the store has no override', () => {
        const { result } = renderHook(() => useTheme());

        expect(result.current.mode).toBe(initial.themeSettings.mode);
        expect(result.current.activeTheme.id).toBe(DEFAULT_THEME.id);
    });

    it('setActiveTheme updates the store', () => {
        const { result } = renderHook(() => useTheme());

        act(() => { result.current.setActiveTheme('ocean-dark'); });

        expect(useStore.getState().themeSettings.activeThemeId).toBe('ocean-dark');
    });

    it('setMode updates the store', () => {
        const { result } = renderHook(() => useTheme());

        act(() => { result.current.setMode('light'); });

        expect(useStore.getState().themeSettings.mode).toBe('light');
    });

    it('addCustomTheme / removeCustomTheme round-trip through the store', () => {
        const { result } = renderHook(() => useTheme());
        const custom = { ...DEFAULT_THEME, id: 'my-custom', name: 'Custom' };

        act(() => { result.current.addCustomTheme(custom); });
        expect(useStore.getState().themeSettings.customThemes.map(t => t.id)).toContain('my-custom');

        act(() => { result.current.removeCustomTheme('my-custom'); });
        expect(useStore.getState().themeSettings.customThemes.map(t => t.id)).not.toContain('my-custom');
    });

    it('regression: calling useTheme() alone does NOT touch the DOM or localStorage -- that is useThemeEffects()\'s job now', async () => {
        // C'est le coeur de la correction perf : avant l'extraction de useThemeEffects,
        // chacun des ~24 composants appelant useTheme() ré-exécutait aussi l'effet
        // d'application DOM + la persistance localStorage. Ce test fige que useTheme()
        // seul (sans useThemeEffects()) ne fait plus aucune des deux.
        const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        renderHook(() => useTheme());
        await act(async () => {});

        expect(setPropertySpy).not.toHaveBeenCalled();
        expect(setItemSpy).not.toHaveBeenCalledWith('theme_settings', expect.anything());
    });
});
