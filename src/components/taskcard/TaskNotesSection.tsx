import { useEffect, useRef, useState } from "react";
import { Paperclip, Edit3, ExternalLink } from "lucide-react";
import useStore from "../../store/useStore";
import { alertModal } from "../../utils/confirm";
import { LinkedTextContent } from "../LinkedTextContent";
import {
    getPathDisplayName,
    hasSupportedLinkDropPayload,
    insertDroppedText,
    parseFilePaths,
    resolveDroppedLinkFromDataTransfer,
} from "../../utils/taskLinks";
import type { Task } from "../../types";

interface TaskNotesSectionProps {
    task: Task;
    updateTask: (id: string, patch: Partial<Task>) => void;
}

/** Section notes d'une tâche : édition inline, drag-drop de fichiers, parsing de chemins */
export function TaskNotesSection({ task, updateTask }: TaskNotesSectionProps) {
    const storagePath = useStore((state) => state.storagePath);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [localNotes, setLocalNotes] = useState(task.notes || "");
    const [notesDropTarget, setNotesDropTarget] = useState(false);
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // stateRef : capture les valeurs latest sans re-créer le listener natif
    const stateRef = useRef({ isEditingNotes, localNotes, storagePath, task, updateTask, setLocalNotes, setNotesDropTarget });
    useEffect(() => { stateRef.current = { isEditingNotes, localNotes, storagePath, task, updateTask, setLocalNotes, setNotesDropTarget }; });

    // Synchroniser localNotes avec task.notes
    useEffect(() => {
        setLocalNotes(task.notes || "");
    }, [task.notes]);

    // Auto-focus + auto-resize le textarea lors de l'édition
    useEffect(() => {
        if (isEditingNotes && notesTextareaRef.current) {
            const ta = notesTextareaRef.current;
            ta.focus();
            ta.style.height = 'auto';
            ta.style.height = Math.max(100, ta.scrollHeight) + 'px';
        }
    }, [isEditingNotes]);

    const handleSaveNotes = () => {
        if (localNotes !== task.notes) {
            updateTask(task.id, { notes: localNotes });
        }
        setIsEditingNotes(false);
    };

    const handleNotesKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setLocalNotes(task.notes || "");
            setIsEditingNotes(false);
        }
        if (e.key === "Enter" && e.ctrlKey) {
            handleSaveNotes();
        }
    };

    // Listener natif sur le conteneur — React onDrop ne reçoit pas les drops OLE Outlook en Electron
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const nativeDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const s = stateRef.current;
            s.setNotesDropTarget(false);
            console.log('[NATIVE DROP notes]', e.dataTransfer?.files?.length, e.dataTransfer?.files?.[0]?.name);
            if (!e.dataTransfer) return;
            let cursorStart: number | undefined;
            let cursorEnd: number | undefined;
            if (s.isEditingNotes && notesTextareaRef.current) {
                cursorStart = notesTextareaRef.current.selectionStart ?? s.localNotes.length;
                cursorEnd   = notesTextareaRef.current.selectionEnd   ?? s.localNotes.length;
            }
            const resolution = await resolveDroppedLinkFromDataTransfer(
                e.dataTransfer as Pick<DataTransfer, 'files' | 'getData'>,
                { storagePath: s.storagePath }
            );
            if (!resolution) return;
            if ('error' in resolution) { await alertModal(resolution.error); return; }
            const newNotes = insertDroppedText(s.localNotes, resolution.insertedText, { start: cursorStart, end: cursorEnd });
            s.setLocalNotes(newNotes);
            s.updateTask(s.task.id, { notes: newNotes });
        };
        el.addEventListener('drop', nativeDrop);
        return () => el.removeEventListener('drop', nativeDrop);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div ref={containerRef} className="rounded-lg bg-white/5 border border-white/10 p-3 hover:border-amber-400/30 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase">Notes</span>
                </div>
                {!isEditingNotes && task.notes && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsEditingNotes(true); }}
                        className="p-1 rounded hover:bg-amber-400/20 text-amber-400 transition"
                        title="Éditer les notes"
                    >
                        <Edit3 className="h-3 w-3" />
                    </button>
                )}
            </div>

            {isEditingNotes ? (
                <div className="space-y-2">
                    <textarea
                        ref={notesTextareaRef}
                        value={localNotes}
                        onChange={(e) => {
                            setLocalNotes(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.max(100, e.target.scrollHeight) + 'px';
                        }}
                        onBlur={handleSaveNotes}
                        onKeyDown={handleNotesKeyDown}
                        onDragOver={(e) => {
                            if (!hasSupportedLinkDropPayload(e.dataTransfer)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setNotesDropTarget(true);
                        }}
                        onDragLeave={() => setNotesDropTarget(false)}
                        className={`w-full min-h-[100px] rounded-lg border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/15 resize-y transition ${notesDropTarget ? 'border-blue-400/60 bg-blue-400/10' : 'bg-white/10 border-amber-400/30'}`}
                        placeholder="Ajouter des notes... (Ctrl+Enter pour sauvegarder, Echap pour annuler)"
                    />
                    <div className="flex gap-2 text-xs text-slate-300">
                        <span>💡 Astuce: Utilisez des guillemets pour les chemins avec espaces</span>
                    </div>
                </div>
            ) : task.notes ? (
                <div
                    onClick={(e) => { e.stopPropagation(); if (window.getSelection()?.toString()) return; setIsEditingNotes(true); }}
                    onDragOver={(e) => {
                        if (!hasSupportedLinkDropPayload(e.dataTransfer)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setNotesDropTarget(true);
                    }}
                    onDragLeave={() => setNotesDropTarget(false)}
                    className={`text-sm text-slate-300 whitespace-pre-wrap leading-relaxed cursor-pointer hover:text-white transition rounded-lg p-1 select-text ${notesDropTarget ? 'border border-blue-400/60 bg-blue-400/10' : ''}`}
                    title="Cliquer pour éditer · Déposer un fichier pour insérer son chemin"
                >
                    <LinkedTextContent text={task.notes} />
                    {false && parseFilePaths(task.notes).map((part, idx) =>
                        part.type === 'url' ? (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.electronAPI?.openExternalUrl) {
                                        window.electronAPI.openExternalUrl(part.content);
                                    } else {
                                        window.open(part.content, '_blank', 'noopener,noreferrer');
                                    }
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(part.content);
                                }}
                                className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 transition border border-emerald-500/30 text-xs"
                                title={`Ouvrir : ${part.content}\nClic droit : copier`}
                            >
                                <ExternalLink className="h-3 w-3" />
                                {part.content.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 50)}{part.content.replace(/^https?:\/\//, '').length > 50 ? '…' : ''}
                            </button>
                        ) : part.type === 'path' ? (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.electronAPI?.openFolder) {
                                        window.electronAPI.openFolder(part.content);
                                    } else {
                                        alert(`Chemin détecté: ${part.content}\n(Disponible uniquement en mode Electron)`);
                                    }
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(part.content);
                                }}
                                className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition border border-blue-500/30 font-mono text-xs"
                                title={part.content}
                            >
                                <ExternalLink className="h-3 w-3" />
                                {getPathDisplayName(part.content)}
                            </button>
                        ) : (
                            <span key={idx}>{part.content}</span>
                        )
                    )}
                </div>
            ) : (
                <div
                    onClick={(e) => { e.stopPropagation(); setIsEditingNotes(true); }}
                    onDragOver={(e) => {
                        if (!hasSupportedLinkDropPayload(e.dataTransfer)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setNotesDropTarget(true);
                    }}
                    onDragLeave={() => setNotesDropTarget(false)}
                    className={`min-h-[40px] flex items-center rounded-lg border border-dashed px-3 py-2 text-xs italic cursor-pointer transition ${notesDropTarget ? 'border-blue-400/60 bg-blue-400/10 text-blue-300' : 'border-white/10 text-slate-500 hover:text-amber-400 hover:border-amber-400/30'}`}
                    title="Cliquer pour écrire · Déposer un fichier ou dossier"
                >
                    {notesDropTarget ? 'Déposer pour ajouter le chemin...' : 'Ajouter une note ou un fichier/dossier...'}
                </div>
            )}
        </div>
    );
}
