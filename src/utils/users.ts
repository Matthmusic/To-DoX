import { FIXED_USERS } from '../constants';
import type { User } from '../types';

/** Defaults are only for data predating the editable directory. */
export function normalizeUsers(value: unknown): User[] {
  if (!Array.isArray(value)) return FIXED_USERS.map(user => ({ ...user }));
  const byId = new Map<string, User>();
  for (const user of value) {
    if (!user || typeof user.id !== 'string' || !user.id.trim() || typeof user.name !== 'string' || !user.name.trim()) continue;
    byId.set(user.id, { id: user.id, name: user.name.trim(), email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : '' });
  }
  byId.set('unassigned', { id: 'unassigned', name: 'Non assigné', email: '' });
  return [...byId.values()];
}
