import { create } from 'zustand';
import type { ActivityLog } from '../types';
import { fetchActivity } from '../services/activityApi';
import useStore from './useStore';

const PAGE_SIZE = 100;
const SEEN_KEY = 'todox_activity_seen_at';

function readSeenAt(): number {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}

/**
 * Journal d'activité des projets où l'utilisateur est assigné. Chargé à la connexion du
 * flux temps réel (useChatSync), puis alimenté en direct par les événements « activity ».
 */
interface ActivityState {
  /** null = inconnu ; false = serveur sans journal */
  available: boolean | null;
  projects: string[];
  logs: ActivityLog[];
  /** Filtre de projet (null = tous mes projets) */
  project: string | null;
  hasMore: boolean;
  loading: boolean;
  /** Dernière consultation de l'onglet (pour le badge « nouveau ») */
  seenAt: number;

  load: () => Promise<void>;
  loadOlder: () => Promise<void>;
  setProject: (project: string | null) => void;
  receive: (log: ActivityLog) => void;
  markSeen: () => void;
  reset: () => void;
}

const useActivityStore = create<ActivityState>((set, get) => ({
  available: null,
  projects: [],
  logs: [],
  project: null,
  hasMore: false,
  loading: false,
  seenAt: readSeenAt(),

  load: async () => {
    const token = useStore.getState().authToken;
    if (!token) return;
    set({ loading: true });
    try {
      const page = await fetchActivity(token, { project: get().project });
      set({ available: true, projects: page.projects, logs: page.logs, hasMore: page.logs.length >= PAGE_SIZE });
    } catch (e) {
      if ((e as { status?: number }).status === 404) set({ available: false });
    } finally {
      set({ loading: false });
    }
  },

  loadOlder: async () => {
    const token = useStore.getState().authToken;
    const { logs, project } = get();
    if (!token || logs.length === 0) return;
    const page = await fetchActivity(token, { project, before: logs[logs.length - 1].createdAt });
    set((s) => ({ logs: [...s.logs, ...page.logs.filter((l) => !s.logs.some((x) => x.id === l.id))], hasMore: page.logs.length >= PAGE_SIZE }));
  },

  setProject: (project) => {
    set({ project, logs: [] });
    get().load().catch(() => {});
  },

  receive: (log) => {
    const { projects, project, logs } = get();
    const me = useStore.getState().currentUser;
    const details = log.details as { added?: string[] };
    // On vient d'être assigné sur un nouveau projet : on recharge pour l'inclure.
    if (!projects.includes(log.project)) {
      if (log.type === 'assignees_changed' && me && details.added?.includes(me)) get().load().catch(() => {});
      return;
    }
    if (project && log.project !== project) return;
    if (logs.some((l) => l.id === log.id)) return;
    set({ logs: [log, ...logs] });
  },

  markSeen: () => {
    const now = Date.now();
    try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* stockage indisponible */ }
    set({ seenAt: now });
  },

  reset: () => set({ available: null, projects: [], logs: [], project: null, hasMore: false }),
}));

/** Nombre d'entrées faites par les autres depuis la dernière consultation. */
export function selectUnseenCount(s: ActivityState): number {
  const me = useStore.getState().currentUser;
  return s.logs.filter((l) => l.createdAt > s.seenAt && l.userId !== me).length;
}

export default useActivityStore;
