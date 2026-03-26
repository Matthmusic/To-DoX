import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { getInitials } from "../../utils";
import type { Task, User } from "../../types";

interface TaskReviewSectionProps {
    task: Task;
    reviewerUsers: (User | undefined)[];
    currentUser: string | null;
    validateTask: (taskId: string) => void;
    requestCorrections: (taskId: string, message: string) => void;
}

/** Section workflow de révision : avatars réviseurs + boutons Valider / Corrections */
export function TaskReviewSection({
    task,
    reviewerUsers,
    currentUser,
    validateTask,
    requestCorrections,
}: TaskReviewSectionProps) {
    const [showCorrectionInput, setShowCorrectionInput] = useState(false);
    const [correctionText, setCorrectionText] = useState("");

    if (task.status !== "review") return null;

    return (
        <div onClick={e => e.stopPropagation()} className="space-y-2 px-1">
            {/* Avatars des réviseurs désignés */}
            {reviewerUsers.length > 0 && (
                <div className="flex items-center gap-1.5 py-1 px-0.5">
                    <span className="text-[10px] text-slate-400">Réviseurs :</span>
                    {reviewerUsers.map(user => {
                        if (!user) return null;
                        const isMe = user.id === currentUser;
                        return (
                            <span
                                key={user.id}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold transition-all ${
                                    isMe
                                        ? "border-violet-400 bg-violet-400/30 text-violet-100 ring-2 ring-violet-400 animate-pulse"
                                        : "border-violet-400/40 bg-violet-400/15 text-violet-200"
                                }`}
                                title={isMe ? `${user.name} (vous — révision en attente)` : user.name}
                            >
                                {getInitials(user.name)}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Boutons d'action — visibles uniquement pour les réviseurs désignés */}
            {currentUser && (task.reviewers || []).includes(currentUser) && (
                !showCorrectionInput ? (
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                validateTask(task.id);
                            }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 hover:text-emerald-200"
                            title="Valider cette tâche"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Valider
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowCorrectionInput(true);
                            }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25 hover:text-amber-200"
                            title="Demander des corrections"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Corrections
                        </button>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <textarea
                            autoFocus
                            value={correctionText}
                            onChange={e => setCorrectionText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Escape') { setShowCorrectionInput(false); setCorrectionText(""); }
                                if (e.key === 'Enter' && e.ctrlKey && correctionText.trim().length >= 5) {
                                    requestCorrections(task.id, correctionText.trim());
                                    setShowCorrectionInput(false);
                                    setCorrectionText("");
                                }
                            }}
                            placeholder="Motif des corrections... (Ctrl+Enter pour envoyer)"
                            className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 placeholder-amber-400/50 focus:outline-none focus:border-amber-400 resize-none"
                            rows={2}
                        />
                        <div className="flex gap-1.5">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (correctionText.trim().length < 5) return;
                                    requestCorrections(task.id, correctionText.trim());
                                    setShowCorrectionInput(false);
                                    setCorrectionText("");
                                }}
                                disabled={correctionText.trim().length < 5}
                                className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Envoyer
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowCorrectionInput(false); setCorrectionText(""); }}
                                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
