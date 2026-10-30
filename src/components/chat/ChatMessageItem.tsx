import { useState } from 'react';
import { ListPlus, SquareCheckBig, Trash2, Check } from 'lucide-react';
import useStore from '../../store/useStore';
import useChatStore from '../../store/useChatStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../hooks/useTheme';
import { LinkedTextContent } from '../LinkedTextContent';
import type { ChatMessage } from '../../types';
import { withOpacity } from './chatUtils';

interface ChatMessageItemProps {
  message: ChatMessage;
  /** Premier message d'une série du même auteur : on affiche son nom */
  showAuthor: boolean;
  /** Projet du salon, pour pré-remplir « Créer une tâche » */
  defaultProject: string;
  onOpenTask: (taskId: string) => void;
}

export function ChatMessageItem({ message, showAuthor, defaultProject, onOpenTask }: ChatMessageItemProps) {
  const { users, currentUser, tasks, projectHistory, addTask } = useStore(useShallow((s) => ({
    users: s.users, currentUser: s.currentUser, tasks: s.tasks, projectHistory: s.projectHistory, addTask: s.addTask,
  })));
  const remove = useChatStore((s) => s.remove);
  const { activeTheme } = useTheme();
  const { primary, textMuted } = activeTheme.palette;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [taskForm, setTaskForm] = useState<{ title: string; project: string } | null>(null);
  const [taskCreated, setTaskCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = message.userId === currentUser;
  const authorName = users.find((u) => u.id === message.userId)?.name ?? 'Utilisateur inconnu';
  const linkedTask = message.taskId ? tasks.find((t) => t.id === message.taskId) : null;
  const time = new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const handleCreateTask = async () => {
    if (!taskForm || !taskForm.title.trim()) return;
    setBusy(true);
    try {
      await addTask({
        title: taskForm.title.trim(),
        project: taskForm.project.trim() || undefined,
        notes: `Créée depuis le chat — ${authorName} : ${message.text}`,
      });
      setTaskForm(null);
      setTaskCreated(true);
    } finally {
      setBusy(false);
    }
  };

  if (message.deletedAt) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'} px-3 py-0.5`}>
        <span className="text-[11.5px] italic" style={{ color: textMuted }}>Message supprimé</span>
      </div>
    );
  }

  const actionBtn = 'p-1.5 rounded-lg transition-colors hover:bg-[rgba(var(--overlay-rgb),0.08)]';

  return (
    <div className={`group flex flex-col ${mine ? 'items-end' : 'items-start'} px-3 ${showAuthor ? 'pt-2' : 'pt-0.5'}`}>
      {showAuthor && !mine && (
        <span className="text-[11px] font-semibold mb-0.5 px-1" style={{ color: withOpacity(primary, 0.85) }}>{authorName}</span>
      )}
      <div className={`flex items-end gap-1 max-w-[88%] ${mine ? 'flex-row-reverse' : ''}`}>
        <div className="rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed break-words whitespace-pre-wrap min-w-0"
          style={{
            background: mine ? withOpacity(primary, 0.2) : 'rgba(var(--overlay-rgb),0.06)',
            color: 'rgba(var(--overlay-rgb),0.9)',
            border: `1px solid ${mine ? withOpacity(primary, 0.3) : 'rgba(var(--overlay-rgb),0.08)'}`,
          }}>
          <LinkedTextContent text={message.text} />
          {message.taskId && (
            <button onClick={() => linkedTask && onOpenTask(linkedTask.id)} disabled={!linkedTask}
              className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[11.5px] transition-colors disabled:opacity-60"
              style={{ background: withOpacity(primary, 0.12), color: primary }}
              title={linkedTask ? 'Ouvrir la tâche' : undefined}>
              <SquareCheckBig className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {linkedTask ? <><b>{linkedTask.project}</b> · {linkedTask.title}</> : 'Tâche supprimée ou archivée'}
              </span>
            </button>
          )}
          <span className="block text-right text-[9.5px] mt-0.5" style={{ color: textMuted }}>{time}</span>
        </div>

        {/* Actions au survol */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" style={{ color: textMuted }}>
          <button className={actionBtn} title="Créer une tâche à partir de ce message" aria-label="Créer une tâche à partir de ce message"
            onClick={() => { setTaskCreated(false); setTaskForm({ title: message.text.split('\n')[0].slice(0, 120), project: defaultProject }); }}>
            <ListPlus className="h-3.5 w-3.5" />
          </button>
          {mine && (
            <button className={`${actionBtn} hover:text-rose-400`} title="Supprimer" aria-label="Supprimer le message" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="flex items-center gap-2 mt-1 text-[11.5px]" style={{ color: textMuted }}>
          Supprimer ce message ?
          <button className="font-semibold text-rose-400 hover:underline" onClick={() => { setConfirmDelete(false); remove(message.id).catch(() => {}); }}>Supprimer</button>
          <button className="hover:underline" onClick={() => setConfirmDelete(false)}>Annuler</button>
        </div>
      )}

      {taskForm && (
        <div className="mt-1.5 w-full max-w-[88%] rounded-xl p-2.5 flex flex-col gap-2"
          style={{ background: 'rgba(var(--overlay-rgb),0.05)', border: `1px solid ${withOpacity(primary, 0.25)}` }}>
          <span className="text-[11px] font-semibold" style={{ color: primary }}>Nouvelle tâche</span>
          <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            aria-label="Titre de la tâche" placeholder="Titre"
            className="rounded-lg bg-transparent px-2 py-1.5 text-[12px] outline-none" style={{ border: '1px solid rgba(var(--overlay-rgb),0.15)', color: 'rgba(var(--overlay-rgb),0.9)' }} />
          <input value={taskForm.project} onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value.toUpperCase() })}
            list={`chat-projects-${message.id}`} aria-label="Projet" placeholder="Projet (DIVERS par défaut)"
            className="rounded-lg bg-transparent px-2 py-1.5 text-[12px] outline-none" style={{ border: '1px solid rgba(var(--overlay-rgb),0.15)', color: 'rgba(var(--overlay-rgb),0.9)' }} />
          <datalist id={`chat-projects-${message.id}`}>
            {projectHistory.map((p) => <option key={p} value={p} />)}
          </datalist>
          <div className="flex justify-end gap-2 text-[11.5px]">
            <button className="px-2 py-1 hover:underline" style={{ color: textMuted }} onClick={() => setTaskForm(null)}>Annuler</button>
            <button disabled={busy || !taskForm.title.trim()} onClick={handleCreateTask}
              className="rounded-lg px-3 py-1 font-semibold text-white disabled:opacity-50" style={{ background: primary }}>
              Créer
            </button>
          </div>
        </div>
      )}
      {taskCreated && (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400"><Check className="h-3 w-3" /> Tâche créée</span>
      )}
    </div>
  );
}
