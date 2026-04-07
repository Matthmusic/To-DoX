import { useRef } from 'react';
import type { TimeEntry } from '../types';
import useStore from '../store/useStore';
import { useLoadData } from './persistence/useLoadData';
import { useSyncPolling } from './persistence/useSyncPolling';
import { usePersistSave } from './persistence/usePersistSave';
import { useApiLoad } from './persistence/useApiLoad';
import { useApiSave } from './persistence/useApiSave';
import { useRealtimeEvents } from './useRealtimeEvents';

/**
 * Hook orchestrateur pour la persistance des données.
 *
 * Mode API  (VITE_API_URL défini) :
 *   - useApiLoad  : chargement depuis le backend REST
 *   - useApiSave  : synchronisation optimiste des mutations vers l'API
 *
 * Mode local (pas de VITE_API_URL) :
 *   - useLoadData    : chargement localStorage + Electron data.json
 *   - useSyncPolling : auto-reload quand data.json change (poll 2 s)
 *   - usePersistSave : sauvegarde debounced localStorage + Electron
 *
 * Chaque hook vérifie son mode en interne — aucun hook conditionnel ici,
 * ce qui garantit un ordre stable entre les renders (compatibilité HMR).
 *
 * IMPORTANT: useStore() est appelé ICI en premier, AVANT les useRef.
 */
export function useDataPersistence() {
  const store = useStore();

  const lastFileHash = useRef<string | null>(null);
  const lastCommentsHash = useRef<string | null>(null);
  const lastKnownFileTimeEntries = useRef<TimeEntry[]>([]);
  const refs = { lastFileHash, lastCommentsHash, lastKnownFileTimeEntries };

  // Les deux groupes sont toujours appelés ; chacun sort immédiatement si ce
  // n'est pas son mode (IS_API_MODE côté API, !IS_API_MODE côté local).
  useApiLoad();
  useApiSave(store);
  useRealtimeEvents();
  useLoadData(refs);
  useSyncPolling(refs, store);
  usePersistSave(refs, store);
}
