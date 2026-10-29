import { describe, it, expect } from 'vitest';
import { buildTimesheet, nextRecurrenceDue, resolvePeriod, resolveUser, weekRange } from './helpers.js';
import type { Task, TimeEntry, User } from './types.js';

const users: User[] = [
  { id: 'u1', name: 'Matthieu', email: 'm@x.fr' },
  { id: 'u2', name: 'Julie Martin', email: 'julie@x.fr' },
  { id: 'u3', name: 'Julien Petit', email: 'jp@x.fr' },
];

describe('weekRange / resolvePeriod', () => {
  it('renvoie lundi → dimanche', () => {
    expect(weekRange('2026-10-29')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(weekRange('2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(weekRange('2026-10-26')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });

  it('gère current / previous / from-to', () => {
    const now = new Date(2026, 9, 29);
    expect(resolvePeriod({}, now)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(resolvePeriod({ week: 'previous' }, now)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(resolvePeriod({ from: '2026-10-30', to: '2026-10-01' }, now)).toEqual({ from: '2026-10-01', to: '2026-10-30' });
    expect(() => resolvePeriod({ week: 'demain' }, now)).toThrow();
  });
});

describe('resolveUser', () => {
  it('résout me, email, nom exact et partiel unique', () => {
    expect(resolveUser('me', users, users[0]).id).toBe('u1');
    expect(resolveUser('JULIE@x.fr', users, users[0]).id).toBe('u2');
    expect(resolveUser('julie martin', users, users[0]).id).toBe('u2');
    expect(resolveUser('petit', users, users[0]).id).toBe('u3');
  });

  it('refuse un nom ambigu ou inconnu', () => {
    expect(() => resolveUser('jul', users, users[0])).toThrow(/ambigu/);
    expect(() => resolveUser('bob', users, users[0])).toThrow(/introuvable/);
  });
});

describe('nextRecurrenceDue', () => {
  const base = { due: '2026-01-31', recurrence: { type: 'monthly' } } as Task;
  it('calcule la prochaine échéance', () => {
    expect(nextRecurrenceDue({ ...base, recurrence: { type: 'daily' } })).toBe('2026-02-01');
    expect(nextRecurrenceDue({ ...base, recurrence: { type: 'weekly' } })).toBe('2026-02-07');
    expect(nextRecurrenceDue({ ...base, due: '2026-03-15' })).toBe('2026-04-15');
  });
  it('null si pas de récurrence ou terminée', () => {
    expect(nextRecurrenceDue({ ...base, recurrence: undefined })).toBeNull();
    expect(nextRecurrenceDue({ ...base, recurrence: { type: 'daily', endsAt: 1 } }, 2)).toBeNull();
  });
});

describe('buildTimesheet', () => {
  it('totalise par projet et par jour', () => {
    const e = (project: string, date: string, hours: number): TimeEntry =>
      ({ id: date + project, project, date, hours, userId: 'u1', createdAt: 0, updatedAt: 0 });
    const sheet = buildTimesheet([e('A', '2026-10-26', 3.5), e('B', '2026-10-26', 4), e('A', '2026-10-27', 0.25)], '2026-10-26', '2026-10-27');
    expect(sheet.total).toBe(7.75);
    expect(sheet.byDay).toEqual({ 'lun 2026-10-26': 7.5, 'mar 2026-10-27': 0.25 });
    expect(sheet.projects.map((p) => [p.project, p.total])).toEqual([['A', 3.75], ['B', 4]]);
  });
});
