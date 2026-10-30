import { getApiBaseUrl } from './api';
import type { ActivityLog } from '../types';

export interface ActivityPage {
  /** Projets où l'utilisateur a au moins une tâche assignée */
  projects: string[];
  /** Du plus récent au plus ancien */
  logs: ActivityLog[];
}

/**
 * Journal d'activité. fetch() direct (pas apiGet) : un serveur pas encore mis à jour
 * répond 404, ce qui doit seulement masquer l'onglet, sans afficher le bandeau d'erreur global.
 * Erreur levée : { status } (404 = journal indisponible sur ce serveur).
 */
export async function fetchActivity(token: string, opts: { project?: string | null; before?: number } = {}): Promise<ActivityPage> {
  const params = new URLSearchParams();
  if (opts.project) params.set('project', opts.project);
  if (opts.before) params.set('before', String(opts.before));
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`${getApiBaseUrl()}/api/activity${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw Object.assign(new Error(`Journal indisponible (${res.status})`), { status: res.status });
  return res.json() as Promise<ActivityPage>;
}
