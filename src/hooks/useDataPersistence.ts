import { useRef } from 'react';
import type { TimeEntry } from '../types';
import useStore from '../store/useStore';
import { useLoadData } from './persistence/useLoadData';
import { useSyncPolling } from './persistence/useSyncPolling';
import { usePersistSave } from './persistence/usePersistSave';

/**
 * Hook orchestrateur pour la persistance des données (localStorage + Electron).
 *
 * Délègue à trois sous-hooks spécialisés :
 *  - useLoadData    — chargement initial + migrations
 *  - useSyncPolling — auto-reload quand data.json change sur disque (poll 2s)
 *  - usePersistSave — sauvegarde debounced vers localStorage + Electron
 *
 * IMPORTANT: useStore() est appelé ICI en premier, AVANT les useRef.
 * Cela garantit un ordre de hooks stable entre les renders (et compatibilité HMR).
 * Les sous-hooks reçoivent l'état du store en paramètre et n'appellent pas useStore().
 */
export function useDataPersistence() {
    // Store subscription FIRST — doit précéder les useRef pour un ordre stable
    const store = useStore();

    const lastFileHash = useRef<string | null>(null);
    const lastCommentsHash = useRef<string | null>(null);
    const lastKnownFileTimeEntries = useRef<TimeEntry[]>([]);
    const refs = { lastFileHash, lastCommentsHash, lastKnownFileTimeEntries };

    useLoadData(refs);
    useSyncPolling(refs, store);
    usePersistSave(refs, store);
}
