import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useThemeEffects } from './useTheme';
import useStore from '../store/useStore';
import { DEFAULT_THEME } from '../themes/presets';

// Clé dédiée localStorage (réglage local au poste, non synchronisé via le backend —
// voir CLAUDE.md, Common Pitfall #11). Ces tests couvrent les EFFETS (chargement,
// application DOM, persistance) -- extraits de useTheme() vers useThemeEffects() pour
// n'être exécutés qu'une seule fois par app plutôt qu'une fois par composant appelant
// useTheme() (~24 dans le code actuel), qui n'ont besoin que des valeurs/setters, pas
// de ré-exécuter ces effets à chaque montage.
const THEME_KEY = 'theme_settings';
const initial = useStore.getInitialState();

beforeEach(() => {
    localStorage.clear();
    useStore.setState({ ...initial, themeSettings: { ...initial.themeSettings } });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useThemeEffects — persistance locale (localStorage)', () => {
    it('restores a theme already saved in localStorage on mount', async () => {
        const saved = {
            mode: 'light' as const,
            activeThemeId: 'ocean-dark',
            customThemes: [],
            customAccentColor: '#ff0000',
        };
        localStorage.setItem(THEME_KEY, JSON.stringify(saved));

        renderHook(() => useThemeEffects());
        // Le chargement restaure le thème via un effet (setThemeSettings), ce qui
        // déclenche un second rendu asynchrone.
        await act(async () => {});

        expect(useStore.getState().themeSettings).toEqual(saved);
    });

    it('falls back to the store default when localStorage data is corrupt', async () => {
        localStorage.setItem(THEME_KEY, '{ not valid json');

        renderHook(() => useThemeEffects());
        await act(async () => {});

        expect(useStore.getState().themeSettings.activeThemeId).toBe(DEFAULT_THEME.id);
    });

    it('persists a theme change to localStorage', async () => {
        renderHook(() => useThemeEffects());
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

        renderHook(() => useThemeEffects());
        await act(async () => {});

        // La valeur en localStorage doit rester celle chargée, jamais la valeur par
        // défaut du store écrite avant la restauration.
        const stored = JSON.parse(localStorage.getItem(THEME_KEY)!);
        expect(stored.activeThemeId).toBe('ocean-dark');
    });

    it('applies the CSS variables to the DOM on mount', async () => {
        renderHook(() => useThemeEffects());
        await act(async () => {});

        expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe(DEFAULT_THEME.palette.bgPrimary);
    });

    it('regression: only ONE useThemeEffects instance should apply the DOM per theme change (no duplicate work)', async () => {
        // Avant l'extraction de useThemeEffects, useTheme() (appelé par ~24 composants)
        // exécutait ce même effet une fois par composant monté -- ce test fige le nombre
        // d'appels DOM attendu pour UNE seule instance du hook, afin qu'une régression qui
        // réintroduirait l'effet dans useTheme() (et donc le multiplierait par le nombre de
        // composants montés) soit détectée.
        const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

        renderHook(() => useThemeEffects());
        await act(async () => {});

        const callsAfterMount = setPropertySpy.mock.calls.length;
        expect(callsAfterMount).toBeGreaterThan(0);

        setPropertySpy.mockClear();
        act(() => {
            useStore.getState().updateThemeSettings({ mode: 'light' });
        });

        // Un seul déclenchement de l'effet doit produire un seul lot d'écritures CSS --
        // pas un multiple (qui indiquerait plusieurs instances de l'effet actives).
        expect(setPropertySpy.mock.calls.length).toBe(callsAfterMount);
    });
});
