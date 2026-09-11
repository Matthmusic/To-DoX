import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';
import useStore from '../store/useStore';
import { DEFAULT_THEME } from '../themes/presets';

// Clé dédiée localStorage (réglage local au poste, non synchronisé via le backend —
// voir CLAUDE.md, Common Pitfall #11).
const THEME_KEY = 'theme_settings';
const initial = useStore.getInitialState();

beforeEach(() => {
    localStorage.clear();
    useStore.setState({ ...initial, themeSettings: { ...initial.themeSettings } });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useTheme — persistance locale (localStorage)', () => {
    it('restores a theme already saved in localStorage on mount', async () => {
        const saved = {
            mode: 'light' as const,
            activeThemeId: 'ocean-dark',
            customThemes: [],
            customAccentColor: '#ff0000',
        };
        localStorage.setItem(THEME_KEY, JSON.stringify(saved));

        const { result } = renderHook(() => useTheme());
        // Le chargement restaure le thème via un effet (setThemeSettings), ce qui
        // déclenche un second rendu asynchrone.
        await act(async () => {});

        expect(useStore.getState().themeSettings).toEqual(saved);
        expect(result.current.mode).toBe('light');
    });

    it('falls back to the store default when localStorage data is corrupt', async () => {
        localStorage.setItem(THEME_KEY, '{ not valid json');

        renderHook(() => useTheme());
        await act(async () => {});

        expect(useStore.getState().themeSettings.activeThemeId).toBe(DEFAULT_THEME.id);
    });

    it('persists a theme change to localStorage', async () => {
        renderHook(() => useTheme());
        await act(async () => {});

        act(() => {
            useStore.getState().updateThemeSettings({ mode: 'light' });
        });

        const stored = JSON.parse(localStorage.getItem(THEME_KEY)!);
        expect(stored.mode).toBe('light');
    });

    it('does not overwrite a saved theme with the store default on initial mount', async () => {
        const saved = {
            mode: 'light' as const,
            activeThemeId: 'ocean-dark',
            customThemes: [],
            customAccentColor: undefined,
        };
        localStorage.setItem(THEME_KEY, JSON.stringify(saved));

        renderHook(() => useTheme());
        await act(async () => {});

        // La valeur en localStorage doit rester celle chargée, jamais la valeur par
        // défaut du store écrite avant la restauration.
        const stored = JSON.parse(localStorage.getItem(THEME_KEY)!);
        expect(stored.activeThemeId).toBe('ocean-dark');
    });
});
