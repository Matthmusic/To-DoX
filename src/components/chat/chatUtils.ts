import type { ChatConversation, User } from '../../types';

/** Ajoute une opacité à une couleur hex (#RRGGBB → #RRGGBBAA). */
export function withOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}

/** Nom affiché d'une conversation : l'autre personne, ou « # PROJET ». */
export function conversationTitle(conv: ChatConversation, users: User[], currentUser: string | null): string {
  if (conv.type === 'project') return `# ${conv.project ?? ''}`;
  const otherId = conv.participantIds.find((id) => id !== currentUser);
  return users.find((u) => u.id === otherId)?.name ?? 'Utilisateur inconnu';
}

/** Heure courte pour la liste : « 14:05 » aujourd'hui, « hier », sinon « 12/10 ». */
export function shortTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** Séparateur de jour dans le fil : « Aujourd'hui », « Hier », « lundi 12 octobre ». */
export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
