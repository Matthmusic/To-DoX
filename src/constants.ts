import {
    CheckCircle2,
    ClipboardList,
    Loader2,
    SearchCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Clé de stockage localStorage (conservée pour compatibilité avec anciennes données)
export const STORAGE_KEY = "smart_todo_v1";

export interface StatusDef {
    id: 'todo' | 'doing' | 'review' | 'done';
    label: string;
    Icon: LucideIcon;
    color?: string;
}

// Statuts des tâches
export const STATUSES: StatusDef[] = [
    { id: "todo", label: "À faire", Icon: ClipboardList },
    { id: "doing", label: "En cours", Icon: Loader2 },
    { id: "review", label: "À réviser", Icon: SearchCheck },
    { id: "done", label: "Fait", Icon: CheckCircle2 },
];

export interface PriorityDef {
    id: 'low' | 'med' | 'high';
    label: string;
}

// Priorités des tâches
export const PRIORITIES: PriorityDef[] = [
    { id: "low", label: "Basse" },
    { id: "med", label: "Moyenne" },
    { id: "high", label: "Haute" },
];

export interface ProjectColor {
    border: string;
    bg: string;
    text: string;
    ring: string;
    glow: string;
}

// Couleurs de projet pour les badges
export const PROJECT_COLORS: ProjectColor[] = [
    { border: "border-blue-400/40", bg: "bg-blue-400/15", text: "text-blue-200", ring: "ring-blue-400/60", glow: "shadow-blue-500/30" },
    { border: "border-cyan-400/40", bg: "bg-cyan-400/15", text: "text-cyan-200", ring: "ring-cyan-400/60", glow: "shadow-cyan-500/30" },
    { border: "border-emerald-400/40", bg: "bg-emerald-400/15", text: "text-emerald-200", ring: "ring-emerald-400/60", glow: "shadow-emerald-500/30" },
    { border: "border-yellow-400/40", bg: "bg-yellow-400/15", text: "text-yellow-200", ring: "ring-yellow-400/60", glow: "shadow-yellow-500/30" },
    { border: "border-orange-400/40", bg: "bg-orange-400/15", text: "text-orange-200", ring: "ring-orange-400/60", glow: "shadow-orange-500/30" },
    { border: "border-rose-400/40", bg: "bg-rose-400/15", text: "text-rose-200", ring: "ring-rose-400/60", glow: "shadow-rose-500/30" },
    { border: "border-purple-400/40", bg: "bg-purple-400/15", text: "text-purple-200", ring: "ring-purple-400/60", glow: "shadow-purple-500/30" },
    { border: "border-indigo-400/40", bg: "bg-indigo-400/15", text: "text-indigo-200", ring: "ring-indigo-400/60", glow: "shadow-indigo-500/30" },
    { border: "border-slate-400/40", bg: "bg-slate-400/15", text: "text-slate-200", ring: "ring-slate-400/60", glow: "shadow-slate-500/30" },
];

// Liste FIXE des utilisateurs (commune à tous)
// Cette liste n'est PAS sauvegardée dans data.json et n'est pas modifiable via l'interface
export const FIXED_USERS = [
    { id: "matthieu", name: "Matthieu Maurel", email: "matthieu.maurel@conception-ea.fr" },
    { id: "william", name: "William Cresson", email: "william.cresson@conception-ea.fr" },
    { id: "matteo", name: "Matteo Voltarel", email: "matteo.voltarel@conception-ea.fr" },
    { id: "sandro", name: "Sandro Menardi", email: "sandro.menardi@conception-ea.fr" },
    { id: "jerome", name: "Jerome Voltarel", email: "jerome.voltarel@conception-ea.fr" },
    { id: "laurent", name: "Laurent Marques", email: "laurent.marques@conception-ea.fr" },
    { id: "sakina", name: "Sakina Benhed", email: "contact@conception-ea.fr" },
    { id: "frederic", name: "Fédéric Menardi", email: "frederic.menardi@conception-ea.fr" },
    { id: "dominique", name: "Dominique Bichon", email: "etudes06@conception-ea.fr" },
    { id: "stephane", name: "Stephane Bayle", email: "etudes@conception-ea.fr" },
    { id: "unassigned", name: "Non assigné", email: "" }, // Gardé pour compatibilité avec anciennes données
];

