/**
 * Storybook — Variante C + TaskCardNew (réplique fidèle de TaskCard.tsx en style C1)
 *
 * C1 — "Band + Gradient"    : bande urgence + gradient fond · actions dans la bande · méta condensée
 * C2 — "Bande Enrichie"     : toute la méta dans la bande (priorité + deadline) · corps = titre seul
 * C3 — "Band + Footer Dock" : bande urgence + méta AVANT le titre · footer dock dédié pour les actions
 * TaskCardNew — Réplique complète de TaskCard.tsx : compact/full · user badges · notes · review · sous-tâches
 *
 * Ces composants sont autonomes (pas de store) — données inline.
 */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
    Star, FolderOpen, MessageCircle, MoreHorizontal, User,
    AlertTriangle, FileText, ClipboardList, CheckCircle2, RotateCcw,
    Eye, EyeOff,
} from 'lucide-react';

// ─── Types locaux (pas d'import store) ──────────────────────────────────────

type Priority = 'high' | 'med' | 'low';
type Status = 'todo' | 'doing' | 'review' | 'done';

interface MockTask {
    id: string;
    title: string;
    project: string;
    priority: Priority;
    status: Status;
    due: string | null;          // ISO date string
    remainingDays: number | null; // pré-calculé pour l'affichage
    notes: string | null;
    subtasks: { label: string; done: boolean }[];
    assignees: { initials: string; isCreator: boolean }[];
    commentCount: number;
    hasMention: boolean;
    favorite: boolean;
    stagnant: boolean;          // > 3j sans mouvement en doing/review
    completionDate: string | null;
    isReview: boolean;
    projectColorClass: string;
}

// ─── Données mock ────────────────────────────────────────────────────────────


// ─── Helpers communs ─────────────────────────────────────────────────────────

function priorityLabel(p: Priority) {
    return p === 'high' ? 'HAUTE' : p === 'med' ? 'MOY.' : 'BASSE';
}
function priorityClasses(p: Priority): { pill: string; dot: string } {
    if (p === 'high') return { pill: 'bg-rose-500/20 text-rose-300 border-rose-500/40', dot: 'bg-rose-400' };
    if (p === 'med') return { pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' };
    return { pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' };
}
function deadlineClasses(d: number | null) {
    if (d === null) return 'text-slate-500';
    if (d < 0) return 'text-rose-400';
    if (d < 3) return 'text-rose-400';
    if (d <= 7) return 'text-amber-400';
    return 'text-emerald-400';
}
function deadlineLabel(d: number | null, status: Status, completionDate: string | null) {
    if (status === 'done') return completionDate ? `✓ ${completionDate}` : '✓ Fait';
    if (d === null) return '';
    if (d < 0) return `J+${Math.abs(d)}`;
    if (d === 0) return 'Auj.';
    return `J-${d}`;
}
function urgencyGradient(d: number | null) {
    if (d === null) return 'from-slate-500/10 via-slate-500/5 to-transparent';
    if (d < 0) return 'from-rose-600/35 via-rose-500/15 to-transparent';
    if (d < 3) return 'from-rose-500/30 via-rose-500/10 to-transparent';
    if (d <= 7) return 'from-amber-400/25 via-amber-400/8 to-transparent';
    return 'from-emerald-400/25 via-emerald-400/8 to-transparent';
}

// Bande haute colorée (Variante C)
function urgencyBand(d: number | null): { bg: string; border: string; text: string; label: string } {
    if (d === null) return { bg: 'bg-slate-800/60', border: 'border-b border-slate-600/20', text: 'text-slate-500', label: 'SANS ÉCHÉANCE' };
    if (d < 0)      return { bg: 'bg-rose-950/80', border: 'border-b border-rose-500/50', text: 'text-rose-300', label: `EN RETARD · J+${Math.abs(d)}` };
    if (d === 0)    return { bg: 'bg-rose-950/70', border: 'border-b border-rose-400/50', text: 'text-rose-300', label: "AUJOURD'HUI" };
    if (d < 3)      return { bg: 'bg-rose-950/60', border: 'border-b border-rose-400/40', text: 'text-rose-300', label: `URGENT · J-${d}` };
    if (d <= 7)     return { bg: 'bg-amber-950/60', border: 'border-b border-amber-500/40', text: 'text-amber-300', label: `CETTE SEMAINE · J-${d}` };
    return { bg: 'bg-emerald-950/40', border: 'border-b border-emerald-500/20', text: 'text-emerald-400', label: `DANS ${d} JOURS` };
}


// ─── Composants partagés ─────────────────────────────────────────────────────

function AvatarPill({ initials, isCreator }: { initials: string; isCreator: boolean }) {
    return (
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold ${
            isCreator
                ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-200'
                : 'border-blue-300/40 bg-blue-300/15 text-blue-200'
        }`} title={isCreator ? 'Créateur' : 'Assigné'}>
            {initials}
        </span>
    );
}

function UnassignedAvatar() {
    return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500/30 bg-slate-700/20 text-slate-400">
            <User className="h-3 w-3" />
        </span>
    );
}

function ProgressBar({ pct }: { pct: number }) {
    return (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
                className={`h-full rounded-full transition-all duration-500 ${
                    pct === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : pct < 30 ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-400'
                }`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANTE C1 — "Band + Gradient"
//  Bande urgence identique à C.
//  Corps : gradient d'urgence en fond + actions (⭐ 📁) déplacées dans la bande.
//  Méta condensée : priorité + note + sous-tâches + avatars sur une ligne.
//  Progress bar sans texte — plus épurée.
// ════════════════════════════════════════════════════════════════════════════

function TaskCardVariantC1({ task }: { task: MockTask }) {
    const pCls = priorityClasses(task.priority);
    const completedSubs = task.subtasks.filter(s => s.done).length;
    const totalSubs = task.subtasks.length;
    const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const band = urgencyBand(task.remainingDays);
    const gradient = urgencyGradient(task.remainingDays);

    return (
        <div className={`relative mb-3 flex flex-col rounded-xl border border-white/8 bg-[#161b2e] overflow-hidden shadow-lg transition-all cursor-pointer hover:border-white/20 ${
            task.favorite ? 'ring-1 ring-amber-400/50' : ''
        }`}>
            {/* Gradient urgence en fond — style original (bg-gradient-to-br opacity-80) */}
            <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${gradient} opacity-80`} />

            {/* ── Bande couleur + actions intégrées ── */}
            <div className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 ${band.bg} ${band.border}`}>
                {/* ● Dot priorité H/M/B */}
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/15 ${
                    task.priority === 'high' ? 'bg-rose-500' :
                    task.priority === 'med'  ? 'bg-amber-400' : 'bg-emerald-400'
                }`} title={`Priorité ${priorityLabel(task.priority)}`} />
                {task.stagnant && <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />}
                <span className={`text-[9px] font-bold tracking-widest uppercase flex-1 ${band.text}`}>{band.label}</span>
                {task.commentCount > 0 && (
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${task.hasMention ? 'text-amber-400' : 'text-slate-500'}`}>
                        <MessageCircle className="h-3 w-3" />{task.commentCount}
                    </span>
                )}
                {/* Actions dans la bande */}
                <button className={`rounded p-0.5 transition ${task.favorite ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}>
                    <Star className="h-3.5 w-3.5" fill={task.favorite ? 'currentColor' : 'none'} />
                </button>
                <button className="rounded p-0.5 text-slate-600 transition hover:text-indigo-400">
                    <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-0.5 text-slate-500 hover:text-white transition">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* ── Corps ── */}
            <div className="relative z-10 flex flex-col gap-2 p-3">
                {/* Titre */}
                <h4 className="text-sm font-semibold text-white leading-snug line-clamp-2">{task.title}</h4>

                {/* Méta condensée : priorité + note + sous-tâches + spacer + avatars */}
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${pCls.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${pCls.dot}`} />
                        {priorityLabel(task.priority)}
                    </span>
                    {task.notes && (
                        <span className="text-amber-500/70" title="Note attachée">
                            <FileText className="h-3 w-3" />
                        </span>
                    )}
                    {totalSubs > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                            <ClipboardList className="h-3 w-3" />{completedSubs}/{totalSubs}
                        </span>
                    )}
                    <span className="flex-1" />
                    <div className="flex items-center -space-x-1">
                        {task.assignees.length === 0
                            ? <UnassignedAvatar />
                            : task.assignees.map((a, i) => <AvatarPill key={i} initials={a.initials} isCreator={a.isCreator} />)
                        }
                    </div>
                </div>

                {/* Review */}
                {task.isReview && (
                    <div className="flex gap-1.5">
                        <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/25">
                            <CheckCircle2 className="h-3 w-3" /> Valider
                        </button>
                        <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300 transition hover:bg-amber-500/25">
                            <RotateCcw className="h-3 w-3" /> Corrections
                        </button>
                    </div>
                )}

                {/* Progress bar épurée (sans texte) */}
                {totalSubs > 0 && <ProgressBar pct={pct} />}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANTE C2 — "Bande Enrichie"
//  La bande contient TOUT le contexte : label urgence + priorité + deadline.
//  Corps réduit au minimum : titre + avatars + progress.
//  Résultat : scan ultra-rapide en haut, corps = titre uniquement.
// ════════════════════════════════════════════════════════════════════════════

function TaskCardVariantC2({ task }: { task: MockTask }) {
    const pCls = priorityClasses(task.priority);
    const dlCls = deadlineClasses(task.remainingDays);
    const dlLabel = deadlineLabel(task.remainingDays, task.status, task.completionDate);
    const completedSubs = task.subtasks.filter(s => s.done).length;
    const totalSubs = task.subtasks.length;
    const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const band = urgencyBand(task.remainingDays);

    return (
        <div className={`relative mb-3 flex flex-col rounded-xl border border-white/8 bg-[#161b2e] overflow-hidden shadow-lg transition-all cursor-pointer hover:border-white/20 ${
            task.favorite ? 'ring-1 ring-amber-400/50' : ''
        }`}>
            {/* ── Bande enrichie : label + priorité + deadline + actions ── */}
            <div className={`flex items-center gap-1.5 px-3 py-2 ${band.bg} ${band.border}`}>
                {task.stagnant && <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />}
                <span className={`text-[9px] font-bold tracking-widest uppercase ${band.text}`}>{band.label}</span>
                {/* Priorité dans la bande */}
                <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${pCls.pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pCls.dot}`} />
                    {priorityLabel(task.priority)}
                </span>
                <span className="flex-1" />
                {/* Deadline dans la bande */}
                {dlLabel && (
                    <span className={`text-[10px] font-bold tabular-nums shrink-0 ${dlCls}`}>{dlLabel}</span>
                )}
                {task.commentCount > 0 && (
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold ml-1 ${task.hasMention ? 'text-amber-400' : 'text-slate-500'}`}>
                        <MessageCircle className="h-3 w-3" />{task.commentCount}
                    </span>
                )}
                {task.favorite && <Star className="h-3 w-3 text-amber-400 fill-amber-400 ml-0.5" />}
                <button className="rounded p-0.5 text-slate-500 hover:text-white transition ml-0.5">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* ── Corps minimal : titre + footer ── */}
            <div className="flex flex-col gap-2 p-3">
                {/* Titre avec plus d'espace (seul vrai contenu du corps) */}
                <h4 className="text-sm font-semibold text-white leading-snug line-clamp-3">{task.title}</h4>

                {/* Footer : avatars + note + sous-tâches + % */}
                <div className="flex items-center gap-1.5">
                    <div className="flex items-center -space-x-1">
                        {task.assignees.length === 0
                            ? <UnassignedAvatar />
                            : task.assignees.map((a, i) => <AvatarPill key={i} initials={a.initials} isCreator={a.isCreator} />)
                        }
                    </div>
                    {task.notes && (
                        <span className="text-amber-500/70" title="Note attachée">
                            <FileText className="h-3 w-3" />
                        </span>
                    )}
                    {totalSubs > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                            <ClipboardList className="h-3 w-3" />{completedSubs}/{totalSubs}
                        </span>
                    )}
                    <span className="flex-1" />
                    {totalSubs > 0 && (
                        <span className={`text-[9px] font-bold tabular-nums ${
                            pct === 100 ? 'text-emerald-400' : pct < 30 ? 'text-rose-400' : 'text-indigo-400'
                        }`}>{pct}%</span>
                    )}
                </div>

                {/* Review */}
                {task.isReview && (
                    <div className="flex gap-1.5">
                        <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/25">
                            <CheckCircle2 className="h-3 w-3" /> Valider
                        </button>
                        <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300 transition hover:bg-amber-500/25">
                            <RotateCcw className="h-3 w-3" /> Corrections
                        </button>
                    </div>
                )}

                {/* Progress */}
                {totalSubs > 0 && <ProgressBar pct={pct} />}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANTE C3 — "Band + Footer Dock"
//  Même bande urgence. Corps : méta AVANT le titre (scan priorité d'abord).
//  Footer dock dédié (border-t) : avatars + ⭐ + 📁 + ⋯
//  Séparation nette contenu / actions = carte la plus "complète".
// ════════════════════════════════════════════════════════════════════════════

function TaskCardVariantC3({ task }: { task: MockTask }) {
    const pCls = priorityClasses(task.priority);
    const completedSubs = task.subtasks.filter(s => s.done).length;
    const totalSubs = task.subtasks.length;
    const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const band = urgencyBand(task.remainingDays);

    return (
        <div className={`relative mb-3 flex flex-col rounded-xl border border-white/8 bg-[#161b2e] overflow-hidden shadow-lg transition-all cursor-pointer hover:border-white/20 ${
            task.favorite ? 'ring-1 ring-amber-400/50' : ''
        }`}>
            {/* ── Bande couleur (identique C base) ── */}
            <div className={`flex items-center gap-2 px-3 py-1.5 ${band.bg} ${band.border}`}>
                {task.stagnant && <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />}
                <span className={`text-[9px] font-bold tracking-widest uppercase flex-1 ${band.text}`}>{band.label}</span>
                {task.commentCount > 0 && (
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${task.hasMention ? 'text-amber-400' : 'text-slate-500'}`}>
                        <MessageCircle className="h-3 w-3" />{task.commentCount}
                    </span>
                )}
                <button className="rounded p-0.5 text-slate-500 hover:text-white transition">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* ── Corps : méta en premier, titre en second ── */}
            <div className="flex flex-col gap-2 p-3">
                {/* Ligne méta AVANT le titre : priorité + note + sous-tâches */}
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${pCls.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${pCls.dot}`} />
                        {priorityLabel(task.priority)}
                    </span>
                    {task.notes && (
                        <span className="flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-400">
                            <FileText className="h-2.5 w-2.5" /> note
                        </span>
                    )}
                    {totalSubs > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                            <ClipboardList className="h-3 w-3" />{completedSubs}/{totalSubs}
                        </span>
                    )}
                </div>

                {/* Titre */}
                <h4 className="text-sm font-semibold text-white leading-snug line-clamp-2">{task.title}</h4>

                {/* Review */}
                {task.isReview && (
                    <div className="flex gap-1.5">
                        <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/25">
                            <CheckCircle2 className="h-3 w-3" /> Valider
                        </button>
                        <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300 transition hover:bg-amber-500/25">
                            <RotateCcw className="h-3 w-3" /> Corrections
                        </button>
                    </div>
                )}

                {/* Progress */}
                {totalSubs > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="flex-1"><ProgressBar pct={pct} /></div>
                        <span className={`text-[9px] font-bold tabular-nums shrink-0 ${
                            pct === 100 ? 'text-emerald-400' : pct < 30 ? 'text-rose-400' : 'text-indigo-400'
                        }`}>{pct}%</span>
                    </div>
                )}
            </div>

            {/* ── Footer dock : avatars + actions ── */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/5">
                <div className="flex items-center -space-x-1">
                    {task.assignees.length === 0
                        ? <UnassignedAvatar />
                        : task.assignees.map((a, i) => <AvatarPill key={i} initials={a.initials} isCreator={a.isCreator} />)
                    }
                </div>
                <span className="flex-1" />
                <button className={`rounded p-1 transition ${task.favorite ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}>
                    <Star className="h-3.5 w-3.5" fill={task.favorite ? 'currentColor' : 'none'} />
                </button>
                <button className="rounded p-1 text-slate-600 transition hover:text-indigo-400">
                    <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 text-slate-500 transition hover:text-white">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  TASK CARD NEW — Réplique fidèle de TaskCard.tsx en style C1
//
//  Reprend TOUS les éléments du vrai composant :
//  · Bande urgence C1 : ● dot priorité + label + stagnation + 💬 + ⭐ + 📁 + ⋯
//  · Gradient fond original (bg-gradient-to-br opacity-80)
//  · Toggle compact/full (Eye/EyeOff)
//  · Titre en UPPERCASE + badge priorité pill H/M/B
//  · Mode compact : deadline + note + sous-tâches inline + avatars
//  · Mode full : méta (priorité + note + sous-tâches + deadline + avatars)
//               + note chip + barre de progression + boutons Valider/Corrections
// ════════════════════════════════════════════════════════════════════════════

function TaskCardNew({ task, defaultMode = 'full' }: { task: MockTask; defaultMode?: 'full' | 'compact' }) {
    const [mode, setMode] = useState<'full' | 'compact'>(defaultMode);
    const isCompact = mode === 'compact';

    const pCls = priorityClasses(task.priority);
    const completedSubs = task.subtasks.filter(s => s.done).length;
    const totalSubs = task.subtasks.length;
    const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const band = urgencyBand(task.remainingDays);
    const gradient = urgencyGradient(task.remainingDays);
    const dlCls = deadlineClasses(task.remainingDays);
    const dlLabel = deadlineLabel(task.remainingDays, task.status, task.completionDate);
    // Glow urgence (approximation du ring CSS de la vraie carte)
    const glowRing = task.remainingDays !== null && task.remainingDays < 0 ? 'ring-1 ring-rose-500/50' : '';

    return (
        <div className={`relative mb-3 flex flex-col rounded-2xl border border-white/5 bg-[#161b2e] overflow-hidden shadow-lg transition-all cursor-pointer hover:border-white/20 ${glowRing} ${task.favorite ? 'ring-1 ring-amber-400/40' : ''}`}>

            {/* ── Gradient fond — style original ── */}
            <div className={`absolute inset-0 pointer-events-none opacity-80 bg-gradient-to-br ${gradient}`} />

            {/* ── Bande urgence C1 — mode full uniquement ── */}
            {!isCompact && <div className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 ${band.bg} ${band.border}`}>
                {/* ● Dot priorité */}
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/15 ${
                    task.priority === 'high' ? 'bg-rose-500' :
                    task.priority === 'med'  ? 'bg-amber-400' : 'bg-emerald-400'
                }`} title={`Priorité ${priorityLabel(task.priority)}`} />
                {task.stagnant && (
                    <span title="Aucun mouvement depuis +3j">
                        <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />
                    </span>
                )}
                <span className={`text-[9px] font-bold tracking-widest uppercase flex-1 ${band.text}`}>{band.label}</span>
                {task.commentCount > 0 && (
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${task.hasMention ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`}>
                        <MessageCircle className="h-3 w-3" />{task.commentCount}
                    </span>
                )}
                <button onClick={(e) => e.stopPropagation()} className={`rounded p-0.5 transition ${task.favorite ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}>
                    <Star className="h-3.5 w-3.5" fill={task.favorite ? 'currentColor' : 'none'} />
                </button>
                <button onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-slate-600 transition hover:text-indigo-400">
                    <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-slate-500 transition hover:text-white">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>}

            {/* ── Corps ── */}
            <div className="relative z-10 flex flex-col gap-2 p-3">

                {/* ── Mode compact : tout sur UNE seule ligne ── */}
                {isCompact && (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMode('full'); }}
                            className="shrink-0 rounded p-0.5 text-slate-600 transition hover:text-slate-300"
                            title="Afficher le détail"
                        >
                            <EyeOff className="h-3.5 w-3.5" />
                        </button>
                        <h4 className="flex-1 truncate text-sm font-bold uppercase text-white leading-none min-w-0">
                            {task.title}
                        </h4>
                        {task.notes && (
                            <span className="shrink-0 text-amber-500/70" title="Note attachée">
                                <FileText className="h-3 w-3" />
                            </span>
                        )}
                        {totalSubs > 0 && <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{completedSubs}/{totalSubs}</span>}
                        {dlLabel && <span className={`text-[10px] font-bold tabular-nums shrink-0 ${dlCls}`}>{dlLabel}</span>}
                        <span className={`shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold leading-none ${pCls.pill}`}>
                            {task.priority === 'high' ? 'H' : task.priority === 'med' ? 'M' : 'B'}
                        </span>
                    </div>
                )}

                {/* ── Mode full : ligne titre ── */}
                {!isCompact && (
                    <div className="flex items-start gap-1.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMode('compact'); }}
                            className="shrink-0 mt-0.5 rounded p-0.5 text-slate-600 transition hover:text-slate-300"
                            title="Réduire la carte"
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </button>
                        <h4 className="flex-1 text-sm font-bold text-white leading-snug uppercase line-clamp-2">
                            {task.title}
                        </h4>
                        <span className={`shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold leading-none ${pCls.pill}`}>
                            {task.priority === 'high' ? 'H' : task.priority === 'med' ? 'M' : 'B'}
                        </span>
                    </div>
                )}

                {/* ── Mode full : contenu détaillé ── */}
                {!isCompact && (
                    <>
                        {/* Méta : priorité + note + sous-tâches + spacer + deadline + avatars */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {task.notes && (
                                <span className="text-amber-500/70" title="Note attachée">
                                    <FileText className="h-3 w-3" />
                                </span>
                            )}
                            {totalSubs > 0 && (
                                <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                                    <ClipboardList className="h-3 w-3" />{completedSubs}/{totalSubs}
                                </span>
                            )}
                            <span className="flex-1" />
                            <div className="flex items-center -space-x-1">
                                {task.assignees.length === 0
                                    ? <UnassignedAvatar />
                                    : task.assignees.map((a, i) => <AvatarPill key={i} initials={a.initials} isCreator={a.isCreator} />)
                                }
                            </div>
                        </div>

                        {/* Note chip (si notes — comme TaskNotesSection compacte) */}
                        {task.notes && (
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-1.5">
                                <p className="text-[9px] leading-relaxed text-amber-300/70 line-clamp-2">{task.notes}</p>
                            </div>
                        )}

                        {/* Barre de progression + % */}
                        {totalSubs > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="flex-1"><ProgressBar pct={pct} /></div>
                                <span className={`text-[9px] font-bold tabular-nums shrink-0 ${
                                    pct === 100 ? 'text-emerald-400' : pct < 30 ? 'text-rose-400' : 'text-indigo-400'
                                }`}>{pct}%</span>
                            </div>
                        )}

                        {/* Boutons révision (TaskReviewSection) */}
                        {task.isReview && (
                            <div className="flex gap-1.5">
                                <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/25">
                                    <CheckCircle2 className="h-3 w-3" /> Valider
                                </button>
                                <button className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300 transition hover:bg-amber-500/25">
                                    <RotateCcw className="h-3 w-3" /> Corrections
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}



// ════════════════════════════════════════════════════════════════════════════
//  COMPOSANTS DE MISE EN PAGE
// ════════════════════════════════════════════════════════════════════════════

/** Colonne Kanban desktop simulée */
function KanbanColumn({
    children, title, count, width = 270, accent = 'border-white/8',
}: {
    children: React.ReactNode; title: string; count: number; width?: number; accent?: string;
}) {
    return (
        <div className={`bg-[#111827] rounded-2xl border ${accent} shadow-xl flex flex-col shrink-0`} style={{ width }}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">{title}</span>
                <span className="ml-auto rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{count}</span>
            </div>
            <div className="p-2 flex flex-col">{children}</div>
        </div>
    );
}

void TaskCardVariantC1;
void TaskCardVariantC2;
void TaskCardVariantC3;
void KanbanColumn;


// ════════════════════════════════════════════════════════════════════════════
//  STORYBOOK META + EXPORTS
// ════════════════════════════════════════════════════════════════════════════

const meta: Meta = {
    title: 'Design/TaskCard — Variantes C',
    parameters: {
        layout: 'fullscreen',
        backgrounds: { default: 'dark', values: [{ name: 'dark', value: '#0d1117' }] },
    },
};
export default meta;
type Story = StoryObj;


// ════════════════════════════════════════════════════════════════════════════
//  STORIES — TASK CARD NEW · RÉPLIQUES Components/TaskCard
// ════════════════════════════════════════════════════════════════════════════

const TCN_TASKS: Record<string, MockTask> = {
    todo: {
        id: 'tcn1', title: 'Réviser les specs techniques du module authentification',
        project: 'PROJET ALPHA', priority: 'high', status: 'todo',
        due: null, remainingDays: null,
        notes: null, subtasks: [],
        assignees: [{ initials: 'MM', isCreator: true }, { initials: 'WC', isCreator: false }],
        commentCount: 0, hasMention: false, favorite: false, stagnant: false,
        completionDate: null, isReview: false,
        projectColorClass: 'text-indigo-300 bg-indigo-400/15 border-indigo-400/30',
    },
    lowprio: {
        id: 'tcn2', title: 'Corriger le bug de synchronisation OneDrive',
        project: 'PROJET ALPHA', priority: 'low', status: 'todo',
        due: null, remainingDays: null,
        notes: null, subtasks: [],
        assignees: [],
        commentCount: 0, hasMention: false, favorite: false, stagnant: false,
        completionDate: null, isReview: false,
        projectColorClass: 'text-indigo-300 bg-indigo-400/15 border-indigo-400/30',
    },
    doingDeadline: {
        id: 'tcn3', title: 'Intégrer les retours client sur le dashboard',
        project: 'PROJET ALPHA', priority: 'med', status: 'doing',
        due: '2026-03-26', remainingDays: 2,
        notes: 'Voir les commentaires dans le doc partagé.',
        subtasks: [
            { label: 'Modifier les graphiques', done: true },
            { label: 'Mettre à jour les filtres', done: false },
            { label: 'Tester sur mobile', done: false },
        ],
        assignees: [{ initials: 'MM', isCreator: true }],
        commentCount: 0, hasMention: false, favorite: true, stagnant: false,
        completionDate: null, isReview: false,
        projectColorClass: 'text-indigo-300 bg-indigo-400/15 border-indigo-400/30',
    },
    doingStale: {
        id: 'tcn4', title: 'Migrer la base de données vers PostgreSQL',
        project: 'PROJET BETA', priority: 'high', status: 'doing',
        due: '2026-03-31', remainingDays: 7,
        notes: null,
        subtasks: [
            { label: 'Dump base de données', done: true },
            { label: 'Configurer réplication', done: false },
            { label: 'Migrer les données', done: false },
            { label: 'Vérifier intégrité', done: false },
        ],
        assignees: [{ initials: 'SM', isCreator: true }, { initials: 'MV', isCreator: false }],
        commentCount: 2, hasMention: false, favorite: false, stagnant: true,
        completionDate: null, isReview: false,
        projectColorClass: 'text-violet-300 bg-violet-400/15 border-violet-400/30',
    },
    reviewOverdue: {
        id: 'tcn5', title: "Audit des performances de l'API REST",
        project: 'PROJET BETA', priority: 'high', status: 'review',
        due: '2026-03-23', remainingDays: -1,
        notes: null,
        subtasks: [
            { label: 'Analyser les endpoints lents', done: true },
            { label: 'Proposer des optimisations', done: true },
        ],
        assignees: [{ initials: 'SM', isCreator: true }],
        commentCount: 1, hasMention: false, favorite: false, stagnant: false,
        completionDate: null, isReview: true,
        projectColorClass: 'text-violet-300 bg-violet-400/15 border-violet-400/30',
    },
    done: {
        id: 'tcn6', title: 'Déploiement en production v2.0',
        project: 'REFONTE UI', priority: 'high', status: 'done',
        due: null, remainingDays: null,
        notes: null, subtasks: [],
        assignees: [
            { initials: 'MM', isCreator: true },
            { initials: 'WC', isCreator: false },
            { initials: 'MV', isCreator: false },
        ],
        commentCount: 0, hasMention: false, favorite: false, stagnant: false,
        completionDate: '23/03', isReview: false,
        projectColorClass: 'text-emerald-300 bg-emerald-400/15 border-emerald-400/30',
    },
};

export const TCN_Todo: Story = {
    name: 'À faire – haute priorité',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <TaskCardNew task={TCN_TASKS.todo} defaultMode="full" />
        </div>
    ),
};

export const TCN_LowPriority: Story = {
    name: 'Priorité basse – sans assigné',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <TaskCardNew task={TCN_TASKS.lowprio} defaultMode="full" />
        </div>
    ),
};

export const TCN_DoingDeadline: Story = {
    name: 'En cours – deadline J-2 + sous-tâches',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <TaskCardNew task={TCN_TASKS.doingDeadline} defaultMode="full" />
        </div>
    ),
};

export const TCN_DoingStale: Story = {
    name: 'En cours – stagnante 8 jours',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <TaskCardNew task={TCN_TASKS.doingStale} defaultMode="full" />
        </div>
    ),
};

export const TCN_ReviewOverdue: Story = {
    name: 'À réviser – en retard',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <TaskCardNew task={TCN_TASKS.reviewOverdue} defaultMode="full" />
        </div>
    ),
};

export const TCN_Done: Story = {
    name: 'Terminée – multi-assignés',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <TaskCardNew task={TCN_TASKS.done} defaultMode="full" />
        </div>
    ),
};

// ── Story dédiée : tâches doing avec toutes les variantes d'échéance ─────────

const DOING_DEADLINE_TASKS: MockTask[] = [
    {
        id: 'dd1', title: 'Migration base de données vers PostgreSQL 16',
        project: 'INFRA', priority: 'high', status: 'doing',
        due: '2026-03-20', remainingDays: -4,
        notes: 'Rollback prévu si erreur — voir runbook infra/db-migration.md',
        subtasks: [
            { label: 'Dump prod', done: true },
            { label: 'Upgrade staging', done: true },
            { label: 'Upgrade prod', done: false },
            { label: 'Vérifier indexes', done: false },
        ],
        assignees: [{ initials: 'MM', isCreator: true }, { initials: 'LR', isCreator: false }],
        commentCount: 5, hasMention: true, favorite: false, stagnant: false,
        completionDate: null, isReview: false,
        projectColorClass: 'text-orange-300 bg-orange-400/15 border-orange-400/30',
    },
    {
        id: 'dd2', title: 'Déployer le hotfix sécurité CVE-2026-1234',
        project: 'SECURITE', priority: 'high', status: 'doing',
        due: '2026-03-25', remainingDays: 1,
        notes: null,
        subtasks: [{ label: 'Patch', done: true }, { label: 'QA', done: false }],
        assignees: [{ initials: 'AB', isCreator: true }],
        commentCount: 2, hasMention: false, favorite: true, stagnant: false,
        completionDate: null, isReview: false,
        projectColorClass: 'text-rose-300 bg-rose-400/15 border-rose-400/30',
    },
    {
        id: 'dd3', title: 'Intégrer le SDK de paiement Stripe v3',
        project: 'BILLING', priority: 'med', status: 'doing',
        due: '2026-03-30', remainingDays: 6,
        notes: 'Webhooks à tester en sandbox avant prod',
        subtasks: [
            { label: 'Checkout', done: true },
            { label: 'Abonnements', done: true },
            { label: 'Remboursements', done: false },
        ],
        assignees: [{ initials: 'PC', isCreator: true }, { initials: 'MM', isCreator: false }],
        commentCount: 1, hasMention: false, favorite: false, stagnant: true,
        completionDate: null, isReview: false,
        projectColorClass: 'text-violet-300 bg-violet-400/15 border-violet-400/30',
    },
    {
        id: 'dd4', title: 'Rédiger les tests E2E du tunnel de commande',
        project: 'QA', priority: 'low', status: 'doing',
        due: '2026-04-10', remainingDays: 17,
        notes: null,
        subtasks: [
            { label: 'Scénario ajout panier', done: false },
            { label: 'Scénario paiement', done: false },
            { label: 'Scénario confirmation', done: false },
        ],
        assignees: [{ initials: 'SB', isCreator: true }],
        commentCount: 0, hasMention: false, favorite: false, stagnant: false,
        completionDate: null, isReview: false,
        projectColorClass: 'text-teal-300 bg-teal-400/15 border-teal-400/30',
    },
];

export const DoingWithDeadline: Story = {
    name: '✨ TaskCardNew — Doing + Deadlines (toutes urgences)',
    render: () => (
        <div className="min-h-screen bg-[#070c14] p-8">
            <p className="mb-6 text-[11px] font-mono text-slate-500 uppercase tracking-widest">
                En retard (J+4) · Urgent (J-1) · Proche (J-6) · OK (J-17)
            </p>
            <div className="flex gap-5 items-start flex-wrap">
                {DOING_DEADLINE_TASKS.map(t => (
                    <div key={t.id} style={{ width: 295 }}>
                        <TaskCardNew task={t} defaultMode="full" />
                    </div>
                ))}
            </div>
        </div>
    ),
};
