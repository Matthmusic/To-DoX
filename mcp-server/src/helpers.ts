import type { Task, TimeEntry, User } from './types.js';

// ── Dates ────────────────────────────────────────────────────────────────────
// Toutes les dates sont en heure LOCALE (YYYY-MM-DD) : une saisie d'heures du
// lundi doit rester le lundi, quel que soit le fuseau.

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Lundi → dimanche de la semaine contenant `iso`. */
export function weekRange(iso: string): { from: string; to: string } {
  const d = parseISODate(iso);
  const offset = (d.getDay() + 6) % 7; // lundi = 0
  const from = addDays(iso, -offset);
  return { from, to: addDays(from, 6) };
}

/** Liste des dates de `from` à `to` incluses. */
export function dateSpan(from: string, to: string): string[] {
  const out: string[] = [];
  for (let cur = from; cur <= to && out.length < 400; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

const DAY_NAMES = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export function dayLabel(iso: string): string {
  return `${DAY_NAMES[parseISODate(iso).getDay()]} ${iso}`;
}

/**
 * Résout une période : `week` = "current" | "previous" | "next" | une date
 * (semaine qui la contient) ; sinon `from`/`to` explicites ; défaut = semaine courante.
 */
export function resolvePeriod(
  opts: { week?: string; from?: string; to?: string },
  now: Date = new Date()
): { from: string; to: string } {
  const today = todayISO(now);
  if (opts.from || opts.to) {
    const from = opts.from ?? opts.to!;
    const to = opts.to ?? opts.from!;
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) throw new Error('Dates attendues au format YYYY-MM-DD');
    return from <= to ? { from, to } : { from: to, to: from };
  }
  const w = opts.week ?? 'current';
  if (w === 'current') return weekRange(today);
  if (w === 'previous') return weekRange(addDays(today, -7));
  if (w === 'next') return weekRange(addDays(today, 7));
  if (ISO_DATE.test(w)) return weekRange(w);
  throw new Error(`Semaine invalide : "${w}" (attendu current, previous, next ou YYYY-MM-DD)`);
}

// ── Utilisateurs ─────────────────────────────────────────────────────────────

/**
 * Résout une référence utilisateur : "me", id, email ou nom (insensible à la casse,
 * correspondance exacte d'abord, puis partielle si elle est unique).
 */
export function resolveUser(ref: string, users: User[], me: User): User {
  const q = ref.trim().toLowerCase();
  if (q === 'me' || q === 'moi') return me;
  const exact = users.find(
    (u) => u.id === ref || u.email.toLowerCase() === q || u.name.toLowerCase() === q
  );
  if (exact) return exact;
  const partial = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(`Utilisateur ambigu "${ref}" : ${partial.map((u) => u.name).join(', ')}`);
  }
  throw new Error(`Utilisateur introuvable : "${ref}". Utilise list_users pour voir l'annuaire.`);
}

export function userName(id: string, users: User[]): string {
  return users.find((u) => u.id === id)?.name ?? id;
}

// ── Tâches ───────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'À faire',
  doing: 'En cours',
  review: 'En révision',
  done: 'Terminé',
};

export function isLive(t: Task): boolean {
  return !t.deletedAt;
}

/** Vue compacte d'une tâche pour les réponses MCP. */
export function summarizeTask(t: Task, users: User[]) {
  const doneSubs = t.subtasks?.filter((s) => s.completed).length ?? 0;
  return {
    id: t.id,
    title: t.title,
    project: t.project,
    status: t.status,
    priority: t.priority,
    due: t.due,
    assignedTo: t.assignedTo.map((id) => userName(id, users)),
    ...(t.reviewers?.length ? { reviewers: t.reviewers.map((id) => userName(id, users)) } : {}),
    ...(t.subtasks?.length ? { subtasks: `${doneSubs}/${t.subtasks.length}` } : {}),
    ...(t.favorite ? { favorite: true } : {}),
    ...(t.archived ? { archived: true } : {}),
    ...(t.recurrence ? { recurrence: t.recurrence.type } : {}),
  };
}

/** Date d'échéance de la prochaine occurrence d'une tâche récurrente (null si terminée). */
export function nextRecurrenceDue(t: Task, now: number = Date.now()): string | null {
  if (!t.recurrence) return null;
  const { type, endsAt } = t.recurrence;
  if (endsAt && now >= endsAt) return null;
  const base = t.due && ISO_DATE.test(t.due) ? t.due : todayISO(new Date(now));
  if (type === 'daily') return addDays(base, 1);
  if (type === 'weekly') return addDays(base, 7);
  const d = parseISODate(base);
  d.setMonth(d.getMonth() + 1);
  return toISODate(d);
}

// ── Feuilles d'heures ────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Tableau projet × jour + totaux, pour l'affichage d'une feuille d'heures. */
export function buildTimesheet(entries: TimeEntry[], from: string, to: string) {
  const days = dateSpan(from, to);
  const byProject: Record<string, Record<string, number>> = {};
  const byDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const notes: Array<{ project: string; date: string; note: string }> = [];

  for (const e of entries) {
    byProject[e.project] ??= {};
    byProject[e.project][e.date] = round2((byProject[e.project][e.date] ?? 0) + e.hours);
    if (e.date in byDay) byDay[e.date] = round2(byDay[e.date] + e.hours);
    if (e.note) notes.push({ project: e.project, date: e.date, note: e.note });
  }

  const projects = Object.keys(byProject)
    .sort()
    .map((project) => ({
      project,
      total: round2(Object.values(byProject[project]).reduce((a, b) => a + b, 0)),
      days: byProject[project],
    }));

  return {
    period: { from, to },
    total: round2(projects.reduce((a, p) => a + p.total, 0)),
    byDay: Object.fromEntries(days.map((d) => [dayLabel(d), byDay[d]])),
    projects,
    ...(notes.length ? { notes } : {}),
  };
}
