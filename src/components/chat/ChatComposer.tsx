import { useMemo, useState, useRef } from 'react';
import { Send, Link2, X, SquareCheckBig } from 'lucide-react';
import useStore from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../hooks/useTheme';
import { withOpacity } from './chatUtils';

interface ChatComposerProps {
  /** Projet du salon : ses tâches sont proposées en premier pour « Lier une tâche » */
  project: string | null;
  onSend: (text: string, taskId: string | null) => Promise<void>;
}

/** Zone de saisie : Entrée envoie, Maj+Entrée va à la ligne. */
export function ChatComposer({ project, onSend }: ChatComposerProps) {
  const { tasks } = useStore(useShallow((s) => ({ tasks: s.tasks })));
  const { activeTheme } = useTheme();
  const { primary, textMuted } = activeTheme.palette;

  const [text, setText] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const linkedTask = taskId ? tasks.find((t) => t.id === taskId) : null;

  const candidates = useMemo(() => {
    const q = taskQuery.trim().toUpperCase();
    return tasks
      .filter((t) => !t.archived && !t.deletedAt)
      .filter((t) => !q || t.title.toUpperCase().includes(q) || t.project.includes(q))
      // Tâches du projet du salon d'abord, puis les plus récentes
      .sort((a, b) => Number(b.project === project) - Number(a.project === project) || b.updatedAt - a.updatedAt)
      .slice(0, 8);
  }, [tasks, taskQuery, project]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(value, taskId);
      setText('');
      setTaskId(null);
      inputRef.current?.focus();
    } catch {
      setError("Message non envoyé. Vérifiez la connexion et réessayez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shrink-0 px-3 pb-3 pt-2 relative">
      {pickerOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl p-2 shadow-2xl z-10"
          style={{ background: activeTheme.palette.bgSecondary, border: `1px solid ${withOpacity(primary, 0.3)}` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <input autoFocus value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)}
              placeholder="Rechercher une tâche…" aria-label="Rechercher une tâche à lier"
              className="flex-1 min-w-0 rounded-lg bg-transparent px-2 py-1.5 text-[12px] outline-none"
              style={{ border: '1px solid rgba(var(--overlay-rgb),0.15)', color: 'rgba(var(--overlay-rgb),0.9)' }} />
            <button onClick={() => setPickerOpen(false)} aria-label="Fermer" className="p-1 rounded-lg hover:bg-[rgba(var(--overlay-rgb),0.08)]" style={{ color: textMuted }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto flex flex-col">
            {candidates.length === 0 && <span className="px-2 py-1.5 text-[11.5px]" style={{ color: textMuted }}>Aucune tâche trouvée</span>}
            {candidates.map((t) => (
              <button key={t.id} onClick={() => { setTaskId(t.id); setPickerOpen(false); setTaskQuery(''); inputRef.current?.focus(); }}
                className="rounded-lg px-2 py-1.5 text-left text-[12px] truncate hover:bg-[rgba(var(--overlay-rgb),0.08)]"
                style={{ color: 'rgba(var(--overlay-rgb),0.85)' }}>
                <b style={{ color: primary }}>{t.project}</b> · {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {linkedTask && (
        <div className="mb-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px]" style={{ background: withOpacity(primary, 0.12), color: primary }}>
          <SquareCheckBig className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate flex-1"><b>{linkedTask.project}</b> · {linkedTask.title}</span>
          <button onClick={() => setTaskId(null)} aria-label="Retirer la tâche liée"><X className="h-3 w-3" /></button>
        </div>
      )}

      <div className="flex items-end gap-1.5 rounded-2xl px-2 py-1.5"
        style={{ background: 'rgba(var(--overlay-rgb),0.05)', border: `1px solid ${withOpacity(primary, 0.22)}` }}>
        <button onClick={() => setPickerOpen((v) => !v)} title="Lier une tâche" aria-label="Lier une tâche"
          className="p-1.5 rounded-lg shrink-0 transition-colors hover:bg-[rgba(var(--overlay-rgb),0.08)]"
          style={{ color: taskId ? primary : textMuted }}>
          <Link2 className="h-4 w-4" />
        </button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Écrire un message…"
          aria-label="Message"
          className="flex-1 min-w-0 resize-none bg-transparent py-1.5 text-[12.5px] outline-none max-h-32"
          style={{ color: 'rgba(var(--overlay-rgb),0.9)', fieldSizing: 'content' } as React.CSSProperties}
        />
        <button onClick={submit} disabled={!text.trim() || sending} title="Envoyer (Entrée)" aria-label="Envoyer"
          className="p-1.5 rounded-lg shrink-0 text-white transition-opacity disabled:opacity-40"
          style={{ background: primary }}>
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-[11.5px] text-rose-400">{error}</p>}
    </div>
  );
}
