import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Trash2, MessageSquare, AtSign } from 'lucide-react';
import useStore from '../store/useStore';
import { useTheme } from '../hooks/useTheme';

interface TaskCommentsProps {
    taskId: string;
}

const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];

function formatDate(ts: number): string {
    const d = new Date(ts);
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function getInitials(name: string): string {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

/** Rend le texte avec les @mentions en surbrillance */
function renderText(text: string, userNames: string[], primary: string) {
    // Trie par longueur décroissante pour éviter les correspondances partielles
    const sorted = [...userNames].sort((a, b) => b.length - a.length);
    const parts: { type: 'text' | 'mention'; content: string }[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        let found = false;
        for (const name of sorted) {
            const tag = `@${name}`;
            const idx = remaining.indexOf(tag);
            if (idx === 0) {
                parts.push({ type: 'mention', content: name });
                remaining = remaining.slice(tag.length);
                found = true;
                break;
            } else if (idx > 0) {
                parts.push({ type: 'text', content: remaining.slice(0, idx) });
                parts.push({ type: 'mention', content: name });
                remaining = remaining.slice(idx + tag.length);
                found = true;
                break;
            }
        }
        if (!found) {
            parts.push({ type: 'text', content: remaining });
            remaining = '';
        }
    }

    return parts.map((p, i) =>
        p.type === 'mention'
            ? <span key={i} className="font-bold rounded px-0.5" style={{ color: primary, backgroundColor: `${primary}20` }}>@{p.content}</span>
            : <span key={i}>{p.content}</span>
    );
}

export function TaskComments({ taskId }: TaskCommentsProps) {
    const { comments, addComment, deleteComment, users, currentUser } = useStore();
    const { activeTheme } = useTheme();
    const primary = activeTheme.palette.primary;

    const taskComments = (comments[taskId] || []).filter(c => !c.deletedAt);
    const userNames = users.map(u => u.name);

    const [text, setText] = useState('');
    const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = dropdown fermé
    const [mentionStart, setMentionStart] = useState(0); // position du @ dans le texte
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Auto-scroll vers le bas quand un commentaire est ajouté
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [taskComments.length]);

    function getUserName(userId: string): string {
        return users.find(u => u.id === userId)?.name || userId;
    }

    // Détection du @ dans le texte lors de la frappe
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        setText(val);

        // Chercher un @ avant le curseur non suivi d'espace
        const before = val.slice(0, cursor);
        const atMatch = before.match(/@([\w\s]*)$/);
        if (atMatch) {
            setMentionQuery(atMatch[1]);
            setMentionStart(cursor - atMatch[0].length);
        } else {
            setMentionQuery(null);
        }
    }, []);

    // Filtrer les utilisateurs selon la requête @
    const filteredUsers = mentionQuery !== null
        ? users.filter(u =>
            u.id !== currentUser &&
            u.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
          )
        : [];

    // Insérer la mention dans le texte
    function insertMention(userName: string) {
        const before = text.slice(0, mentionStart);
        const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
        const newText = `${before}@${userName} ${after}`;
        setText(newText);
        setMentionQuery(null);
        // Replace cursor après le nom inséré
        setTimeout(() => {
            if (textareaRef.current) {
                const pos = before.length + userName.length + 2;
                textareaRef.current.selectionStart = pos;
                textareaRef.current.selectionEnd = pos;
                textareaRef.current.focus();
            }
        }, 0);
    }

    function handleSubmit() {
        if (!text.trim()) return;
        addComment(taskId, text);
        setText('');
        setMentionQuery(null);
        textareaRef.current?.focus();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        // Fermer le dropdown sur Escape
        if (e.key === 'Escape' && mentionQuery !== null) {
            e.preventDefault();
            setMentionQuery(null);
            return;
        }
        // Sélectionner le premier utilisateur filtré sur Tab
        if (e.key === 'Tab' && filteredUsers.length > 0) {
            e.preventDefault();
            insertMention(filteredUsers[0].name);
            return;
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" style={{ color: primary }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: primary }}>
                    Commentaires
                </span>
                {taskComments.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${primary}20`, color: primary }}>
                        {taskComments.length}
                    </span>
                )}
            </div>

            {/* Liste des commentaires */}
            {taskComments.length > 0 && (
                <div ref={listRef} className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {taskComments.map(comment => {
                        const name = getUserName(comment.userId);
                        const isOwn = comment.userId === currentUser;
                        return (
                            <div key={comment.id} className="flex gap-2 group">
                                {/* Avatar */}
                                <div
                                    className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black border"
                                    style={{ backgroundColor: `${primary}20`, borderColor: `${primary}40`, color: primary }}
                                    title={name}
                                >
                                    {getInitials(name)}
                                </div>
                                {/* Bulle */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold text-white/70">{name}</span>
                                        <span className="text-[9px] text-white/30">{formatDate(comment.createdAt)}</span>
                                        {isOwn && (
                                            <button
                                                onClick={() => deleteComment(taskId, comment.id)}
                                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-white/25 hover:text-rose-400"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-white/80 leading-snug break-words bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                                        {renderText(comment.text, userNames, primary)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Input + @mention dropdown */}
            {currentUser && currentUser !== 'unassigned' ? (
                <div className="relative flex gap-2 items-end">
                    <div className="flex-1 relative">
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={handleTextChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ajouter un commentaire… Tapez @ pour mentionner"
                            rows={2}
                            className="w-full resize-none text-[11px] text-white/80 placeholder:text-white/25 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white/25 transition-colors"
                        />

                        {/* Dropdown @mention */}
                        {mentionQuery !== null && filteredUsers.length > 0 && (
                            <div
                                ref={dropdownRef}
                                className="absolute bottom-full left-0 mb-1 z-50 min-w-40 rounded-xl border border-white/10 bg-[#1a1f35] shadow-2xl overflow-hidden"
                            >
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5">
                                    <AtSign className="h-3 w-3" style={{ color: primary }} />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">Mentionner</span>
                                </div>
                                {filteredUsers.map((u, i) => (
                                    <button
                                        key={u.id}
                                        onMouseDown={e => { e.preventDefault(); insertMention(u.name); }}
                                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/5 transition-colors"
                                    >
                                        <div
                                            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black border flex-shrink-0"
                                            style={{ backgroundColor: `${primary}20`, borderColor: `${primary}40`, color: primary }}
                                        >
                                            {getInitials(u.name)}
                                        </div>
                                        <span className="text-[11px] font-semibold text-white/80">{u.name}</span>
                                        {i === 0 && (
                                            <span className="ml-auto text-[8px] text-white/25">Tab</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim()}
                        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                        style={{ backgroundColor: `${primary}20`, color: primary }}
                        onMouseEnter={e => { if (text.trim()) e.currentTarget.style.backgroundColor = `${primary}35`; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${primary}20`; }}
                        title="Envoyer (Ctrl+Entrée)"
                    >
                        <Send className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : (
                <p className="text-[10px] text-white/25 italic">Connectez-vous pour commenter</p>
            )}
        </div>
    );
}
