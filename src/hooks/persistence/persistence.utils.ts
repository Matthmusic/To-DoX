import type { StoreState } from '../../store/useStore';
import type { Comment, TaskTemplate, TimeEntry } from '../../types';

/** Snapshot complet du store passé en param (évite les appels useStore() dans les sous-hooks) */
export type StoreSnapshot = StoreState;

/** Refs partagées entre les 3 hooks de persistence */
export interface PersistenceRefs {
    lastFileHash: { current: string | null };
    lastCommentsHash: { current: string | null };
    lastKnownFileTimeEntries: { current: TimeEntry[] };
}

/**
 * Migration silencieuse des templates vers le nouveau format (sous-tâches uniquement).
 * Les anciens champs (title, project, priority, assignedTo, notes) sont ignorés.
 */
export function migrateTemplate(raw: unknown): TaskTemplate {
    const t = raw as Record<string, unknown>;
    return {
        id: (t.id as string) || crypto.randomUUID(),
        name: (t.name as string) || 'Template',
        subtaskTitles: Array.isArray(t.subtaskTitles) ? t.subtaskTitles as string[] : [],
    };
}

/**
 * Merge deux états de commentaires (fichier vs local) avec soft-delete.
 * Règles :
 *  - Un commentaire local absent du fichier est conservé (pas encore sauvegardé)
 *  - Une suppression locale (deletedAt ≠ null) gagne sur la version non-supprimée du fichier
 *  - Le fichier a priorité dans tous les autres cas
 */
export function mergeComments(
    local: Record<string, Comment[]>,
    fromFile: Record<string, Comment[]>
): Record<string, Comment[]> {
    const merged: Record<string, Comment[]> = { ...fromFile };
    for (const taskId of Object.keys(local)) {
        const file = fromFile[taskId] || [];
        const loc = local[taskId] || [];
        const byId = new Map<string, Comment>();
        for (const c of file) byId.set(c.id, c);
        for (const c of loc) {
            const existing = byId.get(c.id);
            if (!existing) {
                byId.set(c.id, c); // commentaire local pas encore dans le fichier
            } else if (c.deletedAt !== null && existing.deletedAt === null) {
                byId.set(c.id, c); // suppression locale gagne
            }
        }
        merged[taskId] = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
    }
    return merged;
}
