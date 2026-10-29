import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TodoxClient } from '../api.js';
import { buildTimesheet, ISO_DATE, resolvePeriod, resolveUser, round2, toISODate } from '../helpers.js';
import type { Comment, Project, TimeEntry } from '../types.js';
import { fetchTasks, ok, safe } from './common.js';

const periodShape = {
  week: z
    .string()
    .optional()
    .describe('"current" (défaut), "previous", "next" ou une date YYYY-MM-DD (semaine lundi→dimanche qui la contient)'),
  from: z.string().regex(ISO_DATE).optional().describe('Début de période YYYY-MM-DD (prioritaire sur week)'),
  to: z.string().regex(ISO_DATE).optional().describe('Fin de période YYYY-MM-DD (incluse)'),
};

async function fetchEntries(client: TodoxClient, from: string, to: string, userId: string) {
  // Le backend renvoie les saisies de toute l'organisation : on filtre par utilisateur.
  const all = await client.get<TimeEntry[]>(`/api/time-entries?from=${from}&to=${to}`);
  return all.filter((e) => e.userId === userId && e.date >= from && e.date <= to);
}

export function registerTimesheetTools(server: McpServer, client: TodoxClient) {
  server.registerTool(
    'get_timesheet',
    {
      title: 'Feuille d\'heures',
      description:
        'Feuille d\'heures d\'une période : heures par projet et par jour, total par jour et total général. ' +
        'Par défaut : la mienne, semaine en cours.',
      inputSchema: { ...periodShape, user: z.string().optional().describe('"me" (défaut), id, email ou nom') },
      annotations: { readOnlyHint: true },
    },
    safe(async (a) => {
      const { from, to } = resolvePeriod(a);
      const [users, me] = await Promise.all([client.users(), client.currentUser()]);
      const user = a.user ? resolveUser(a.user, users, me) : me;
      const entries = await fetchEntries(client, from, to, user.id);
      return ok({ user: user.name, ...buildTimesheet(entries, from, to) });
    })
  );

  server.registerTool(
    'set_time_entries',
    {
      title: 'Pointer des heures',
      description:
        'Saisit mes heures sur un ou plusieurs couples projet/jour. ' +
        'mode "set" (défaut) remplace les heures existantes du projet ce jour-là ; mode "add" les additionne. ' +
        'hours=0 en mode "set" supprime la saisie. Heures décimales (1.5 = 1h30). ' +
        'Le projet est mis en MAJUSCULES ; vérifier son nom avec list_projects.',
      inputSchema: {
        entries: z
          .array(
            z.object({
              project: z.string().min(1),
              date: z.string().regex(ISO_DATE, 'Format attendu : YYYY-MM-DD'),
              hours: z.number().min(0).max(24),
              note: z.string().optional(),
            })
          )
          .min(1)
          .max(200),
        mode: z.enum(['set', 'add']).optional(),
      },
    },
    safe(async ({ entries, mode = 'set' }) => {
      const me = await client.currentUser();
      const dates = entries.map((e) => e.date).sort();
      const from = dates[0];
      const to = dates[dates.length - 1];
      const existing = await fetchEntries(client, from, to, me.id);

      // Fusionne les doublons de la requête (même projet + même jour)
      const wanted = new Map<string, { project: string; date: string; hours: number; note?: string }>();
      for (const e of entries) {
        const project = e.project.trim().toUpperCase();
        const key = `${project}|${e.date}`;
        const prev = wanted.get(key);
        wanted.set(key, {
          project,
          date: e.date,
          hours: round2((prev && mode === 'add' ? prev.hours : 0) + e.hours),
          note: e.note ?? prev?.note,
        });
      }

      const results: string[] = [];
      for (const w of wanted.values()) {
        const matches = existing.filter((e) => e.project === w.project && e.date === w.date);
        const current = round2(matches.reduce((a, e) => a + e.hours, 0));
        const target = round2(mode === 'add' ? current + w.hours : w.hours);
        const [first, ...dupes] = matches;
        // Le backend accepte plusieurs lignes pour un même projet/jour : on n'en garde qu'une.
        for (const d of dupes) await client.delete(`/api/time-entries/${d.id}`);

        if (target <= 0) {
          if (first) await client.delete(`/api/time-entries/${first.id}`);
          results.push(`${w.date} ${w.project} : supprimé`);
        } else if (first) {
          await client.put<TimeEntry>(`/api/time-entries/${first.id}`, {
            hours: target,
            ...(w.note !== undefined ? { note: w.note } : {}),
          });
          results.push(`${w.date} ${w.project} : ${current}h → ${target}h`);
        } else {
          await client.post<TimeEntry>('/api/time-entries', { project: w.project, date: w.date, hours: target, note: w.note });
          results.push(`${w.date} ${w.project} : ${target}h (nouveau)`);
        }
      }

      // Contrôles après saisie
      const after = await fetchEntries(client, from, to, me.id);
      const sheet = buildTimesheet(after, from, to);
      const warnings: string[] = [];
      for (const [day, total] of Object.entries(sheet.byDay)) if (total > 10) warnings.push(`${day} : ${total}h pointées`);
      const known = new Set([
        ...(await client.get<Project[]>('/api/projects')).map((p) => p.name),
        ...(await fetchTasks(client)).map((t) => t.project),
      ]);
      for (const w of wanted.values()) {
        if (w.hours > 0 && !known.has(w.project)) warnings.push(`Projet inconnu dans To-DoX : ${w.project} (faute de frappe ?)`);
      }
      return ok({ results, ...(warnings.length ? { warnings: [...new Set(warnings)] } : {}), timesheet: sheet });
    })
  );

  server.registerTool(
    'get_activity',
    {
      title: 'Activité de la période',
      description:
        'Ce que j\'ai fait sur une période, jour par jour et par projet : tâches terminées, passées en révision, ' +
        'sous-tâches cochées, commentaires écrits, plus les heures déjà pointées. ' +
        'Sert de base pour proposer ou compléter une feuille d\'heures.',
      inputSchema: { ...periodShape, user: z.string().optional().describe('"me" (défaut), id, email ou nom') },
      annotations: { readOnlyHint: true },
    },
    safe(async (a) => {
      const { from, to } = resolvePeriod(a);
      const [users, me, tasks, comments] = await Promise.all([
        client.users(),
        client.currentUser(),
        fetchTasks(client),
        client.get<Comment[]>('/api/comments'),
      ]);
      const user = a.user ? resolveUser(a.user, users, me) : me;
      const inRange = (ts: number | null | undefined) => {
        if (!ts) return null;
        const d = toISODate(new Date(ts));
        return d >= from && d <= to ? d : null;
      };

      const days: Record<string, Record<string, string[]>> = {};
      const push = (date: string, project: string, line: string) => {
        days[date] ??= {};
        (days[date][project] ??= []).push(line);
      };

      const taskById = new Map(tasks.map((t) => [t.id, t]));
      for (const t of tasks) {
        const mine = t.assignedTo.includes(user.id);
        const done = inRange(t.completedAt);
        if (done && mine) push(done, t.project, `Terminé : ${t.title}`);
        const review = t.movedToReviewBy === user.id ? inRange(t.movedToReviewAt) : null;
        if (review) push(review, t.project, `Soumis en révision : ${t.title}`);
        const validated = t.reviewValidatedBy === user.id ? inRange(t.reviewValidatedAt) : null;
        if (validated) push(validated, t.project, `Révision validée : ${t.title}`);
        for (const s of t.subtasks ?? []) {
          const d = s.completedBy === user.id ? inRange(s.completedAt) : null;
          if (d) push(d, t.project, `Sous-tâche : ${s.title} (${t.title})`);
        }
        const created = t.createdBy === user.id ? inRange(t.createdAt) : null;
        if (created) push(created, t.project, `Créé : ${t.title}`);
      }
      for (const c of comments) {
        const d = c.userId === user.id && !c.deletedAt ? inRange(c.createdAt) : null;
        const t = taskById.get(c.taskId);
        if (d && t) push(d, t.project, `Commentaire sur ${t.title} : ${c.text.slice(0, 120)}`);
      }

      const entries = await fetchEntries(client, from, to, user.id);
      const ongoing = tasks
        .filter((t) => !t.archived && t.status === 'doing' && t.assignedTo.includes(user.id))
        .map((t) => `${t.project} — ${t.title}`);

      return ok({
        user: user.name,
        period: { from, to },
        activityByDay: Object.fromEntries(Object.entries(days).sort(([x], [y]) => x.localeCompare(y))),
        tasksInProgress: ongoing,
        timesheet: buildTimesheet(entries, from, to),
      });
    })
  );
}
