import type { Task } from '../types';

/**
 * Encode les caractères spéciaux ICS dans un texte (SUMMARY, DESCRIPTION, etc.)
 */
function escapeIcsText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Formate une date ISO YYYY-MM-DD en valeur ICS all-day (YYYYMMDD)
 */
function dateToIcsAllDay(iso: string): string {
    return iso.replace(/-/g, '');
}

/**
 * Avance une date ISO de N jours
 */
function addDays(iso: string, n: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

/**
 * Génère un VEVENT all-day pour une plage de dates.
 * uid unique par tâche + date de début.
 */
function makeVEvent(uid: string, summary: string, start: string, end: string, description?: string): string {
    const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DTSTART;VALUE=DATE:${dateToIcsAllDay(start)}`,
        `DTEND;VALUE=DATE:${dateToIcsAllDay(end)}`,
        'STATUS:CONFIRMED',
    ];
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push('END:VEVENT');
    return lines.join('\r\n');
}

/**
 * Regroupe un tableau de dates ISO triées en plages contiguës.
 * Ex : ['2026-03-10','2026-03-11','2026-03-13'] → [{start:'2026-03-10', end:'2026-03-12'}, {start:'2026-03-13', end:'2026-03-14'}]
 */
function groupContiguousDates(sortedDates: string[]): Array<{ start: string; end: string }> {
    if (sortedDates.length === 0) return [];

    const ranges: Array<{ start: string; end: string }> = [];
    let rangeStart = sortedDates[0];
    let prev = sortedDates[0];

    for (let i = 1; i < sortedDates.length; i++) {
        const curr = sortedDates[i];
        const prevDate = new Date(prev + 'T00:00:00');
        const currDate = new Date(curr + 'T00:00:00');
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
        if (diffDays === 1) {
            prev = curr;
        } else {
            ranges.push({ start: rangeStart, end: addDays(prev, 1) });
            rangeStart = curr;
            prev = curr;
        }
    }
    ranges.push({ start: rangeStart, end: addDays(prev, 1) });
    return ranges;
}

/**
 * Génère les VEVENT Timeline pour un utilisateur donné.
 *
 * Règle d'affectation par jour :
 *   - Si ganttDay.userIds contient currentUserId → inclus
 *   - Si ganttDay.userIds est vide/undefined → on regarde task.assignedTo
 *     (comportement "tout le monde sur ce jour" → inclus si l'user est dans assignedTo)
 */
function ganttVEventsForUser(task: Task, currentUserId: string): string[] {
    if (!task.ganttDays || task.ganttDays.length === 0) return [];

    const myDates = task.ganttDays
        .filter(g => {
            if (!g.userIds || g.userIds.length === 0) {
                // Pas d'affectation spécifique → tous les assignedTo sont concernés
                return task.assignedTo.includes(currentUserId);
            }
            return g.userIds.includes(currentUserId);
        })
        .map(g => g.date)
        .sort();

    if (myDates.length === 0) return [];

    const summary = `[${task.project}] ${task.title}`;
    const description = task.notes || undefined;

    return groupContiguousDates(myDates).map(({ start, end }) =>
        makeVEvent(
            `todox-gantt-${task.id}-${start}@todox`,
            summary,
            start,
            end,
            description,
        )
    );
}

/**
 * Génère un VEVENT d'échéance pour une tâche (due date) — événement sur 1 jour.
 * Préfixé par 📅 pour se distinguer visuellement dans Outlook.
 */
function dueVEvent(task: Task): string {
    const summary = `📅 [${task.project}] ${task.title}`;
    return makeVEvent(
        `todox-due-${task.id}@todox`,
        summary,
        task.due!,
        addDays(task.due!, 1),
        task.notes || undefined,
    );
}

/**
 * Génère un fichier VCALENDAR personnalisé pour l'utilisateur courant :
 *
 *  1. Jours Timeline (ganttDays) où l'utilisateur est affecté — événements all-day
 *     groupés en plages contiguës. C'est le contenu principal.
 *
 *  2. Échéances (due date) des tâches dont l'utilisateur est dans assignedTo — 1 jour
 *     chacune, préfixées 📅.
 *
 * Les tâches archivées, supprimées et terminées sont exclues.
 *
 * @param tasks        Toutes les tâches du store
 * @param currentUserId  ID de l'utilisateur connecté (null → calendrier vide)
 */
export function generateIcs(tasks: Task[], currentUserId: string | null): string {
    const vEvents: string[] = [];

    if (currentUserId) {
        const activeTasks = tasks.filter(
            t => !t.archived && !t.deletedAt && t.status !== 'done'
        );

        for (const task of activeTasks) {
            // 1. Jours Timeline affectés à l'utilisateur
            vEvents.push(...ganttVEventsForUser(task, currentUserId));

            // 2. Échéance si l'utilisateur est assigné à cette tâche
            if (task.due && task.assignedTo.includes(currentUserId)) {
                vEvents.push(dueVEvent(task));
            }
        }
    }

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//To-DoX//To-DoX//FR',
        'X-WR-CALNAME:To-DoX — Mon planning',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...vEvents,
        'END:VCALENDAR',
    ];

    return lines.join('\r\n') + '\r\n';
}
