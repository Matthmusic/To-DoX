import type { Task } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<string, string> = {
    todo:   'rgba(59,130,246,0.65)',
    doing:  'rgba(34,211,238,0.65)',
    review: 'rgba(234,179,8,0.65)',
    done:   'rgba(34,197,94,0.45)',
};
export const STATUS_BORDER: Record<string, string> = {
    todo:   '#3b82f6',
    doing:  '#22d3ee',
    review: '#eab308',
    done:   '#22c55e',
};
export const STATUS_LABEL: Record<string, string> = {
    todo: 'À faire', doing: 'En cours', review: 'Revue', done: 'Terminé',
};
export const PRIORITY_COLOR: Record<string, string> = {
    high: '#ef4444',
    med:  '#f59e0b',
    low:  '#22c55e',
};

// Palette séparée pour les avatars utilisateurs (plus vibrante)
export const USER_PALETTE = [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b',
    '#f87171', '#60a5fa', '#fb923c', '#e879f9',
    '#818cf8', '#2dd4bf',
];
export const MONTH_FR    = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
export const DAY_SHORT   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

export type ViewMode = '1week' | '2weeks' | 'rolling' | '1month' | '2months';

// Layout constants
export const SIDE_W = 380;
// Largeur minimale par colonne (plancher si l'espace disponible est insuffisant)
export const MIN_COL_W: Record<ViewMode, number> = { '1week': 60, '2weeks': 40, 'rolling': 40, '1month': 22, '2months': 18 };

// ── Row types for flat rendering ──────────────────────────────────────────

export type ProjectRow = {
    type: 'project';
    project: string;
    color: string;
    count: number;
    barStartIdx: number;
    barEndIdx: number;
    barLeftCapped: boolean;
    barRightCapped: boolean;
};
export type TaskRow = { type: 'task'; task: Task; project: string; isLast: boolean };
export type FlatRow = ProjectRow | TaskRow;

// Active cell popover state
export interface ActiveCell {
    taskId: string;
    date: string;
    rect: DOMRect;
}

// Drag-to-range state
export interface DragState {
    taskId: string;
    startDate: string;
    currentDate: string;
    /** toujours 'add' — la suppression se fait via le popover */
    mode: 'add';
    /** userIds hérités de la cellule source (si elle était planifiée) */
    sourceUserIds?: string[];
    startRect: DOMRect;
    /** Ctrl enfoncé au mousedown → sélection multiple */
    ctrlKey: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getMondayOf(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
}

export function formatShortDate(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${parseInt(d)} ${MONTH_SHORT[parseInt(m) - 1]}`;
}

export function addDaysIso(iso: string, n: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISO(d);
}

export function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash |= 0;
    }
    return USER_PALETTE[Math.abs(hash) % USER_PALETTE.length];
}

export function getUserInitials(user: { name: string }): string {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return user.name.substring(0, 2).toUpperCase();
}

/** ISO week number (01–53) */
export function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return String(Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)).padStart(2, '0');
}
