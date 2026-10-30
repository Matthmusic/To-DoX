import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/activityApi', () => ({
  fetchActivity: vi.fn(async () => ({ projects: ['NORD', 'SUD'], logs: [] })),
}));

import useActivityStore, { selectUnseenCount } from './useActivityStore';
import useStore from './useStore';
import { fetchActivity } from '../services/activityApi';
import { describeActivity } from '../components/activity/activityText';
import type { ActivityLog } from '../types';

const log = (over: Partial<ActivityLog> = {}): ActivityLog => ({
  id: 'a1', userId: 'bob', taskId: 't1', taskTitle: 'T', project: 'NORD', type: 'task_created', details: {}, createdAt: 100, ...over,
});

describe('useActivityStore', () => {
  beforeEach(async () => {
    useActivityStore.getState().reset();
    useActivityStore.setState({ seenAt: 0 });
    useStore.setState({ currentUser: 'me', authToken: 'tok' });
    await useActivityStore.getState().load();
    vi.mocked(fetchActivity).mockClear();
  });

  it('ajoute en tête les événements de mes projets, une seule fois', () => {
    useActivityStore.getState().receive(log({ id: 'a1', createdAt: 1 }));
    useActivityStore.getState().receive(log({ id: 'a2', createdAt: 2 }));
    useActivityStore.getState().receive(log({ id: 'a2', createdAt: 2 }));
    expect(useActivityStore.getState().logs.map((l) => l.id)).toEqual(['a2', 'a1']);
  });

  it('ignore les autres projets, sauf si on vient d\'y être assigné', () => {
    useActivityStore.getState().receive(log({ project: 'AUTRE' }));
    expect(useActivityStore.getState().logs).toHaveLength(0);
    expect(fetchActivity).not.toHaveBeenCalled();
    useActivityStore.getState().receive(log({ project: 'AUTRE', type: 'assignees_changed', details: { added: ['me'] } }));
    expect(fetchActivity).toHaveBeenCalled();
  });

  it('respecte le filtre de projet', () => {
    useActivityStore.setState({ project: 'SUD' });
    useActivityStore.getState().receive(log({ project: 'NORD' }));
    expect(useActivityStore.getState().logs).toHaveLength(0);
  });

  it('compte les nouveautés des autres depuis la dernière consultation', () => {
    useActivityStore.getState().receive(log({ id: 'x', userId: 'bob', createdAt: 50 }));
    useActivityStore.getState().receive(log({ id: 'y', userId: 'me', createdAt: 60 }));
    expect(selectUnseenCount(useActivityStore.getState())).toBe(1);
    useActivityStore.getState().markSeen();
    expect(selectUnseenCount(useActivityStore.getState())).toBe(0);
  });
});

describe('describeActivity', () => {
  const users = [{ id: 'bob', name: 'Bob Durand', email: '' }];
  it('décrit les changements en français', () => {
    expect(describeActivity(log({ type: 'status_changed', details: { from: 'todo', to: 'doing' } }), users))
      .toBe('a déplacé la tâche : À faire → En cours');
    expect(describeActivity(log({ type: 'subtask_checked', details: { title: 'Plan' } }), users)).toBe('a coché « Plan »');
    expect(describeActivity(log({ type: 'assignees_changed', details: { added: ['bob'], removed: [] } }), users)).toBe('a assigné Bob Durand');
    expect(describeActivity(log({ type: 'priority_changed', details: { from: 'med', to: 'high' } }), users))
      .toBe('a changé la priorité : Moyenne → Haute');
  });
});
