import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell, MessageCircle, CheckCheck, Trash2,
    CheckCircle2, RotateCcw, Eye, Clock, AtSign,
    ChevronRight, Sparkles,
} from "lucide-react";
import useStore from "../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from "../hooks/useTheme";
import type { AppNotification, Task } from "../types";
import { getInitials } from "../utils";

// ── Utilitaires ───────────────────────────────────────────────────────────────

const TAB_WIDTH_MIN = 48;
const TAB_WIDTH_MAX = 96;

/** Calcule la largeur du tab = 2/3 du gap entre .kanban-row et le bord de l'écran côté
 *  où le panneau est ancré (droite par défaut, gauche si notificationPanelSide === 'left'). */
function computeTabWidth(side: 'left' | 'right'): number {
    const kanbanRow = document.querySelector('.kanban-row');
    if (!kanbanRow) return 64;
    const rect = kanbanRow.getBoundingClientRect();
    const gap = side === 'left' ? rect.left : window.innerWidth - rect.right;
    const w = Math.round(gap * (2 / 3));
    return Math.min(TAB_WIDTH_MAX, Math.max(TAB_WIDTH_MIN, w));
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
}

/** Ajoute une opacité hex à une couleur hex (#RRGGBB → #RRGGBBAA) */
function withOpacity(hex: string, opacity: number): string {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `${hex}${alpha}`;
}

function getNotifIcon(type: AppNotification["type"]) {
    const cls = "h-3.5 w-3.5";
    switch (type) {
        case "review_requested": return <Eye className={`${cls} text-violet-300`} />;
        case "review_validated": return <CheckCircle2 className={`${cls} text-emerald-300`} />;
        case "review_rejected":  return <RotateCcw className={`${cls} text-amber-300`} />;
        case "review_stale":     return <Clock className={`${cls} text-orange-300`} />;
        case "comment_mention":  return <AtSign className={`${cls} text-cyan-300`} />;
        case "comment_added":    return <MessageCircle className={`${cls} text-sky-300`} />;
    }
}

// ── Composant principal ───────────────────────────────────────────────────────

export function RightSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'notifs' | 'messages'>('notifs');

    const { currentUser, users, tasks, comments, appNotifications, notificationPanelSide, markNotificationRead, markAllNotificationsRead, markNotificationsByTypeRead, deleteNotificationForUser, setHighlightedTaskId, setHighlightedCommentId } = useStore(useShallow((s) => ({ currentUser: s.currentUser, users: s.users, tasks: s.tasks, comments: s.comments, appNotifications: s.appNotifications, notificationPanelSide: s.notificationPanelSide, markNotificationRead: s.markNotificationRead, markAllNotificationsRead: s.markAllNotificationsRead, markNotificationsByTypeRead: s.markNotificationsByTypeRead, deleteNotificationForUser: s.deleteNotificationForUser, setHighlightedTaskId: s.setHighlightedTaskId, setHighlightedCommentId: s.setHighlightedCommentId })));
    const isLeft = notificationPanelSide === 'left';

    const [tabWidth, setTabWidth] = useState(() => computeTabWidth(notificationPanelSide));

    // Largeur totale quand ouvert : contenu 33vw (280–560px) + tab strip
    const expandedWidth = Math.min(Math.max(280, window.innerWidth * 0.33), 560) + tabWidth;

    const containerRef = useRef<HTMLDivElement>(null);

    // Recalcul responsive : observe .kanban-row + resize fenêtre
    useEffect(() => {
        const update = () => setTabWidth(computeTabWidth(notificationPanelSide));

        // Observer le kanban-row (ses dimensions changent à chaque resize/ajout de colonne)
        const kanbanRow = document.querySelector('.kanban-row');
        let ro: ResizeObserver | null = null;
        if (kanbanRow) {
            ro = new ResizeObserver(update);
            ro.observe(kanbanRow);
        }
        window.addEventListener('resize', update);
        // Premier calcul légèrement différé pour laisser le layout se stabiliser
        const t = setTimeout(update, 100);

        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', update);
            clearTimeout(t);
        };
    }, [notificationPanelSide]);

    // Fermeture au clic en dehors
    useEffect(() => {
        if (!isOpen) return;
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const { activeTheme } = useTheme();
    const { primary, bgPrimary, bgSecondary, borderPrimary, textMuted } = activeTheme.palette;

    // ── Notifications (cloche) ────────────────────────────────────────────────
    const myNotifs = useMemo(() =>
        appNotifications
            .filter(n => n.toUserId === currentUser && !(n.deletedBy ?? []).includes(currentUser ?? ''))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 50),
        [appNotifications, currentUser]
    );
    // Badge cloche = révisions uniquement (les comments ont leur propre badge)
    const unreadCount = myNotifs.filter(n => !n.readAt && !n.type.startsWith('comment_')).length;

    // ── Compteurs messages (depuis appNotifications) ───────────────────────────
    // Badges de l'icône message dérivés des notifications : précis et synchro multi-user
    const { unreadMsgCount, unreadMentionCount } = useMemo(() => {
        if (!currentUser) return { unreadMsgCount: 0, unreadMentionCount: 0 };
        const mine = appNotifications.filter(
            n => n.toUserId === currentUser &&
                !(n.deletedBy ?? []).includes(currentUser) &&
                !n.readAt
        );
        return {
            unreadMsgCount: mine.filter(n => n.type === 'comment_added').length,
            unreadMentionCount: mine.filter(n => n.type === 'comment_mention').length,
        };
    }, [appNotifications, currentUser]);

    // ── Messages feed (pour l'affichage dans le panneau) ─────────────────────
    const messageFeed = useMemo(() => {
        if (!currentUser) return [];

        const relevantTaskIds = new Set(
            tasks
                .filter(t =>
                    t.createdBy === currentUser ||
                    t.assignedTo.includes(currentUser) ||
                    (t.reviewers ?? []).includes(currentUser)
                )
                .map(t => t.id)
        );

        const taskById = new Map(tasks.map(t => [t.id, t]));
        const currentUserName = users.find(u => u.id === currentUser)?.name;

        const feed: Array<{
            commentId: string;
            task: Task;
            authorId: string;
            authorName: string;
            text: string;
            createdAt: number;
            mentionsMe: boolean;
        }> = [];

        for (const [taskId, taskComments] of Object.entries(comments)) {
            if (!relevantTaskIds.has(taskId)) continue;
            const task = taskById.get(taskId);
            if (!task) continue;

            for (const c of taskComments) {
                if (c.deletedAt || c.userId === currentUser) continue; // on masque ses propres comments
                const author = users.find(u => u.id === c.userId);
                feed.push({
                    commentId: c.id,
                    task,
                    authorId: c.userId,
                    authorName: author?.name ?? c.userId,
                    text: c.text,
                    createdAt: c.createdAt,
                    mentionsMe: !!currentUserName && c.text.includes(`@${currentUserName}`),
                });
            }
        }

        return feed.sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);
    }, [comments, tasks, currentUser, users]);

    // ── Shake animation — deux rythmes indépendants ───────────────────────────
    const [shakingBell, setShakingBell] = useState(false);
    const [shakingMsg, setShakingMsg] = useState(false);
    const bellShakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const msgShakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cloche : shake toutes les 5s si notifs révision non lues
    useEffect(() => {
        if (unreadCount === 0) return;
        const interval = setInterval(() => {
            setShakingBell(true);
            bellShakeRef.current = setTimeout(() => setShakingBell(false), 700);
        }, 5000);
        return () => { clearInterval(interval); if (bellShakeRef.current) clearTimeout(bellShakeRef.current); };
    }, [unreadCount]);

    // Message : shake toutes les 3s si mentions non lues, toutes les 5s si simple commentaire
    useEffect(() => {
        const hasMention = unreadMentionCount > 0;
        const hasMsg = unreadMsgCount > 0;
        if (!hasMention && !hasMsg) return;
        const interval = setInterval(() => {
            setShakingMsg(true);
            msgShakeRef.current = setTimeout(() => setShakingMsg(false), 700);
        }, hasMention ? 3000 : 5000);
        return () => { clearInterval(interval); if (msgShakeRef.current) clearTimeout(msgShakeRef.current); };
    }, [unreadMentionCount, unreadMsgCount]);

    const handleTabClick = (tab: 'notifs' | 'messages') => {
        if (tab === 'messages' && currentUser) {
            // Marquer les notifications de commentaires comme lues à l'ouverture
            markNotificationsByTypeRead(['comment_added', 'comment_mention'], currentUser);
        }
        if (isOpen && activeTab === tab) {
            setIsOpen(false);
        } else {
            setActiveTab(tab);
            setIsOpen(true);
        }
    };

    const handleNotifClick = (notif: (typeof myNotifs)[number]) => {
        markNotificationRead(notif.id);
        if (!tasks.find(t => t.id === notif.taskId)) return;
        setHighlightedTaskId(notif.taskId);
        setIsOpen(false);
        setShakingBell(false);
    };

    const handleMessageClick = (item: (typeof messageFeed)[number]) => {
        setHighlightedTaskId(item.task.id);
        setHighlightedCommentId(item.commentId);
        setIsOpen(false);
        setShakingMsg(false);
    };

    // ── Styles dérivés du thème ───────────────────────────────────────────────
    // Plus lumineux en mode réduit pour mieux ressortir sur le fond kanban
    const panelBg = isOpen
        ? `linear-gradient(135deg, ${withOpacity(bgPrimary, 0.82)} 0%, ${withOpacity(bgSecondary, 0.88)} 100%)`
        : `linear-gradient(135deg, ${withOpacity(bgSecondary, 0.72)} 0%, ${withOpacity(primary, 0.10)} 100%)`;

    return (
        /*
         * L'élément racine est le SEUL élément glassmorphique — il contient à la fois le
         * panneau (flex-1) et la bande de tab (fixe). Ancré à droite par défaut
         * (flex-row-reverse : la bande de tab, première dans le DOM, se retrouve à droite
         * visuellement) ou à gauche (flex-row normal) selon notificationPanelSide -- réglable
         * depuis le menu ☰ (voir KanbanHeaderPremium). overflow-hidden garde la
         * bande de tab toujours visible tandis que le panneau est masqué quand réduit.
         */
        <motion.div
            ref={containerRef}
            className={`fixed top-1/2 -translate-y-1/2 z-[8000] flex overflow-hidden shadow-2xl ${isLeft ? 'left-0 flex-row rounded-r-3xl' : 'right-0 flex-row-reverse rounded-l-3xl'}`}
            animate={{ width: isOpen ? expandedWidth : tabWidth }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
                height: '80vh',
                minHeight: 400,
                maxHeight: 1000,
                background: panelBg,
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                // borderPrimary est déjà une chaîne rgba() avec sa propre opacité (voir
                // les presets de thème) -- withOpacity() attend un hex brut et lui
                // accolait un suffixe alpha invalide, ce qui rendait la déclaration
                // border entière invalide (donc ignorée) pour tous les thèmes.
                border: `1px solid ${borderPrimary}`,
                borderRight: isLeft ? undefined : 'none',
                borderLeft: isLeft ? 'none' : undefined,
                boxShadow: `${isLeft ? '20px' : '-20px'} 0 60px rgba(0,0,0,0.45), inset 1px 0 0 ${withOpacity(primary, 0.08)}`,
            }}
        >
            {/* Accent top */}
            <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(to right, transparent, ${withOpacity(primary, 0.4)}, transparent)` }} />

            {/* ── Bande de tab (toujours visible) ─────────────────────────────── */}
            <div
                className="shrink-0 flex flex-col relative"
                style={{ width: tabWidth }}
            >
                {/* Ligne d'accent verticale (côté qui fait face au panneau de contenu) */}
                <div className={`absolute top-8 bottom-8 w-px pointer-events-none ${isLeft ? 'right-0' : 'left-0'}`}
                    style={{ background: `linear-gradient(to bottom, transparent, ${withOpacity(primary, 0.25)}, transparent)` }} />

                {/* Zone HAUTE — Notifications (occupe 50% de la hauteur) */}
                <button
                    className="flex-1 flex items-center justify-center transition-all duration-200 relative"
                    onClick={() => handleTabClick('notifs')}
                    title="Notifications"
                    aria-label="Notifications"
                    style={{
                        background: isOpen && activeTab === 'notifs'
                            ? `radial-gradient(ellipse at 70% 50%, ${withOpacity(primary, 0.10)} 0%, transparent 70%)`
                            : 'transparent',
                    }}
                >
                    <motion.div
                        className="relative"
                        animate={shakingBell && unreadCount > 0 ? {
                            rotate: [0, -12, 12, -8, 8, -4, 4, 0],
                            scale: [1, 1.15, 1.15, 1.1, 1.1, 1.05, 1.05, 1],
                        } : { rotate: 0, scale: 1 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                        <Bell
                            className="h-[22px] w-[22px] transition-all duration-200"
                            style={{
                                color: (activeTab === 'notifs' && isOpen) || unreadCount > 0
                                    ? primary
                                    : withOpacity(primary, 0.30),
                                filter: (activeTab === 'notifs' && isOpen) || (!isOpen && unreadCount > 0)
                                    ? `drop-shadow(0 0 7px ${withOpacity(primary, 0.85)})`
                                    : 'none',
                            }}
                        />
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-2 -right-2.5 flex items-center justify-center min-w-[15px] h-[15px] rounded-full text-[7px] font-black text-white px-0.5"
                                style={{ backgroundColor: primary, boxShadow: `0 2px 6px ${withOpacity(primary, 0.6)}` }}
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </motion.div>
                </button>

                {/* Séparateur horizontal entre les deux zones */}
                <div className="mx-4 h-px shrink-0"
                    style={{ background: withOpacity(primary, 0.15) }} />

                {/* Zone BASSE — Messages (occupe 50% de la hauteur) */}
                <button
                    className="flex-1 flex items-center justify-center transition-all duration-200 relative"
                    onClick={() => handleTabClick('messages')}
                    title="Messages"
                    aria-label="Messages"
                    style={{
                        background: isOpen && activeTab === 'messages'
                            ? `radial-gradient(ellipse at 70% 50%, ${withOpacity(primary, 0.10)} 0%, transparent 70%)`
                            : 'transparent',
                    }}
                >
                    <motion.div
                        className="relative"
                        animate={shakingMsg && (unreadMsgCount > 0 || unreadMentionCount > 0) ? {
                            x: [0, -5, 5, -4, 4, -2, 2, 0],
                            scale: [1, 1.12, 1.12, 1.08, 1.08, 1.04, 1.04, 1],
                        } : { x: 0, scale: 1 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                        <MessageCircle
                            className="h-[22px] w-[22px] transition-all duration-200"
                            style={{
                                color: (activeTab === 'messages' && isOpen) || unreadMsgCount > 0 || unreadMentionCount > 0
                                    ? primary
                                    : withOpacity(primary, 0.30),
                                filter: (activeTab === 'messages' && isOpen) || (!isOpen && (unreadMsgCount > 0 || unreadMentionCount > 0))
                                    ? `drop-shadow(0 0 7px ${withOpacity(primary, 0.85)})`
                                    : 'none',
                            }}
                        />
                        {/* Badge rouge top-left : @mentions urgentes */}
                        {unreadMentionCount > 0 && (
                            <span
                                className="absolute -top-2 -left-2.5 flex items-center justify-center min-w-[15px] h-[15px] rounded-full bg-rose-500 text-[7px] font-black text-white px-0.5"
                                style={{ boxShadow: '0 2px 6px rgba(244,63,94,0.7)' }}
                            >
                                {unreadMentionCount > 9 ? '9+' : unreadMentionCount}
                            </span>
                        )}
                        {/* Badge thème top-right : commentaires sans mention */}
                        {unreadMsgCount > 0 && (
                            <span
                                className="absolute -top-2 -right-2.5 flex items-center justify-center min-w-[15px] h-[15px] rounded-full text-[7px] font-black text-white px-0.5"
                                style={{ backgroundColor: primary, boxShadow: `0 2px 6px ${withOpacity(primary, 0.6)}` }}
                            >
                                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                            </span>
                        )}
                    </motion.div>
                </button>
            </div>

            {/* ── Panneau de contenu (à gauche, se déploie) ─────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            key="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, delay: 0.08 }}
                            className="flex flex-col h-full"
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2 px-4 pt-5 pb-3 shrink-0">
                                <Sparkles className="h-3.5 w-3.5" style={{ color: withOpacity(primary, 0.7) }} />
                                <span className="text-[12.5px] font-bold tracking-widest uppercase" style={{ color: textMuted }}>
                                    Centre d'activité
                                </span>
                            </div>

                            {/* Tabs pills */}
                            <div className="flex items-center gap-2 px-4 pb-4 shrink-0">
                                {(['notifs', 'messages'] as const).map(tab => {
                                    const isActive = activeTab === tab;
                                    const count = tab === 'notifs' ? unreadCount : (unreadMsgCount + unreadMentionCount);
                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all duration-200"
                                            style={isActive
                                                ? {
                                                    color: primary,
                                                    background: withOpacity(primary, 0.12),
                                                    boxShadow: `inset 0 1px 0 ${withOpacity(primary, 0.15)}, 0 1px 8px rgba(0,0,0,0.3)`,
                                                }
                                                : { color: withOpacity(primary, 0.35) }
                                            }
                                        >
                                            {tab === 'notifs' ? <Bell className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                                            {tab === 'notifs' ? 'Notifications' : 'Messages'}
                                            {count > 0 && (
                                                <span
                                                    className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] font-black text-white px-1"
                                                    style={{ backgroundColor: primary, boxShadow: `0 2px 8px ${withOpacity(primary, 0.5)}` }}
                                                >
                                                    {count > 9 ? '9+' : count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                                {activeTab === 'notifs' && unreadCount > 0 && currentUser && (
                                    <button
                                        onClick={() => markAllNotificationsRead(currentUser)}
                                        // h-9 (36px) plutôt que le 44px recommandé (WCAG 2.5.5) : la rangée de
                                        // pills à côté fait ~36px de haut (px-3 py-1.5 + texte 12.5px) -- passer
                                        // ce bouton à 44px le ferait dépasser visuellement de la rangée. Reste un
                                        // gain réel par rapport aux 28px d'origine.
                                        className="ml-auto flex items-center justify-center h-9 w-9 rounded-full shrink-0 transition-all duration-200"
                                        style={{
                                            color: primary,
                                            background: withOpacity(primary, 0.18),
                                            border: `1px solid ${withOpacity(primary, 0.6)}`,
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = withOpacity(primary, 0.28))}
                                        onMouseLeave={e => (e.currentTarget.style.background = withOpacity(primary, 0.18))}
                                        title="Tout marquer comme lu"
                                        aria-label="Tout marquer comme lu"
                                    >
                                        <CheckCheck className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Séparateur */}
                            <div className="mx-4 mb-1 h-px shrink-0"
                                style={{ background: `linear-gradient(to right, transparent, ${withOpacity(primary, 0.2)}, transparent)` }} />

                            {/* Contenu scrollable */}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[rgba(var(--overlay-rgb),0.1)] px-2 py-2">

                                {/* ── Notifications ──────────────────────────── */}
                                {activeTab === 'notifs' && (
                                    <div className="flex flex-col gap-1.5">
                                        {myNotifs.length === 0 ? (
                                            <EmptyState icon={<Bell className="h-8 w-8" />} label="Aucune notification" primary={primary} textMuted={textMuted} />
                                        ) : myNotifs.map(notif => {
                                            const notifProject = tasks.find(t => t.id === notif.taskId)?.project;
                                            return (
                                            <div
                                                key={notif.id}
                                                role="button"
                                                tabIndex={0}
                                                className="group relative flex items-start gap-3 rounded-2xl px-3 py-3 cursor-pointer transition-all duration-200"
                                                style={{
                                                    borderLeft: `2px solid ${!notif.readAt ? withOpacity(primary, 0.6) : 'transparent'}`,
                                                    background: !notif.readAt ? withOpacity(primary, 0.06) : 'transparent',
                                                }}
                                                onClick={() => handleNotifClick(notif)}
                                                onKeyDown={e => {
                                                    // Le trash inline est un <button> imbriqué -- cette ligne ne peut donc pas
                                                    // être un vrai <button> (imbrication interdite en HTML). role="button" +
                                                    // ce handler la rendent quand même activable au clavier (Entrée/Espace),
                                                    // comme la ligne "Messages" ci-dessous qui n'a pas ce problème.
                                                    // e.target !== e.currentTarget : ignore les Entrée/Espace qui remontent
                                                    // depuis le bouton supprimer, sinon Entrée sur ce bouton déclencherait
                                                    // AUSSI l'ouverture de la tâche (double action).
                                                    if (e.target !== e.currentTarget) return;
                                                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotifClick(notif); }
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = withOpacity(primary, 0.08))}
                                                onMouseLeave={e => (e.currentTarget.style.background = !notif.readAt ? withOpacity(primary, 0.06) : 'transparent')}
                                                onFocus={e => (e.currentTarget.style.background = withOpacity(primary, 0.08))}
                                                onBlur={e => (e.currentTarget.style.background = !notif.readAt ? withOpacity(primary, 0.06) : 'transparent')}
                                            >
                                                <div className="mt-0.5 shrink-0 p-1.5 rounded-xl" style={{ background: withOpacity(primary, 0.08) }}>
                                                    {getNotifIcon(notif.type)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    {notifProject && (
                                                        <span className="text-[11.5px] block truncate font-medium" style={{ color: withOpacity(primary, 0.85) }}>
                                                            {notifProject}
                                                        </span>
                                                    )}
                                                    <p
                                                        className={`text-[12.5px] leading-snug mt-0.5 ${!notif.readAt ? 'font-semibold' : ''}`}
                                                        style={{ color: !notif.readAt ? 'rgba(var(--overlay-rgb),0.90)' : textMuted }}
                                                    >
                                                        {notif.message}
                                                    </p>
                                                    <span className="text-[11.5px] mt-1 block" style={{ color: textMuted }}>
                                                        {timeAgo(notif.createdAt)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {!notif.readAt && (
                                                        <div className="h-1.5 w-1.5 rounded-full"
                                                            style={{ backgroundColor: primary, boxShadow: `0 0 6px ${withOpacity(primary, 0.7)}` }} />
                                                    )}
                                                    {currentUser && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); deleteNotificationForUser(notif.id, currentUser); }}
                                                            // p-3.5 (44px avec l'icône 16px) au lieu de p-2 (32px) : la carte de
                                                            // notification est assez haute pour l'accueillir sans déséquilibrer
                                                            // la mise en page, contrairement au bouton "tout marquer comme lu"
                                                            // ci-dessus qui doit rester aligné avec une rangée plus basse.
                                                            className="p-3.5 rounded-xl text-[rgba(var(--overlay-rgb),0.15)] hover:text-rose-400 hover:bg-rose-400/10 transition opacity-0 group-hover:opacity-100"
                                                            aria-label="Supprimer cette notification"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ── Messages ───────────────────────────────── */}
                                {activeTab === 'messages' && (
                                    <div className="flex flex-col gap-1.5">
                                        {messageFeed.length === 0 ? (
                                            <EmptyState icon={<MessageCircle className="h-8 w-8" />} label="Aucun message" primary={primary} textMuted={textMuted} />
                                        ) : messageFeed.map(item => (
                                            <button
                                                key={item.commentId}
                                                onClick={() => handleMessageClick(item)}
                                                className="group relative w-full text-left flex items-start gap-3 rounded-2xl px-3 py-3 transition-all duration-200"
                                                style={{
                                                    borderLeft: `2px solid ${item.mentionsMe ? withOpacity(primary, 0.7) : 'transparent'}`,
                                                    background: item.mentionsMe ? withOpacity(primary, 0.05) : 'transparent',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = withOpacity(primary, 0.08))}
                                                onMouseLeave={e => (e.currentTarget.style.background = item.mentionsMe ? withOpacity(primary, 0.05) : 'transparent')}
                                            >
                                                <div
                                                    className="shrink-0 h-7 w-7 rounded-xl flex items-center justify-center text-[11.5px] font-black"
                                                    style={{
                                                        background: withOpacity(primary, 0.12),
                                                        color: primary,
                                                        boxShadow: `inset 0 0 0 1px ${withOpacity(primary, 0.25)}`,
                                                    }}
                                                >
                                                    {getInitials(item.authorName)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <span className="text-[10.5px] font-bold uppercase tracking-wider truncate max-w-[60px]" style={{ color: withOpacity(primary, 0.5) }}>
                                                            {item.task.project}
                                                        </span>
                                                        <ChevronRight className="h-2.5 w-2.5 shrink-0" style={{ color: withOpacity(primary, 0.2) }} />
                                                        <span className="text-[11.5px] truncate" style={{ color: textMuted }}>
                                                            {item.task.title}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <span className="text-[12.5px] font-semibold" style={{ color: 'rgba(var(--overlay-rgb),0.65)' }}>
                                                            {item.authorName}
                                                        </span>
                                                        <span className="text-[10.5px]" style={{ color: textMuted }}>
                                                            {timeAgo(item.createdAt)}
                                                        </span>
                                                        {item.mentionsMe && (
                                                            <span
                                                                className="text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none"
                                                                style={{
                                                                    color: primary,
                                                                    background: withOpacity(primary, 0.15),
                                                                    border: `1px solid ${withOpacity(primary, 0.3)}`,
                                                                }}
                                                            >
                                                                @vous
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-[12.5px] leading-relaxed line-clamp-2" style={{ color: textMuted }}>
                                                        {item.text}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Accent bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(to right, transparent, ${withOpacity(primary, 0.2)}, transparent)` }} />
        </motion.div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, label, primary, textMuted }: { icon: React.ReactNode; label: string; primary: string; textMuted: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div style={{ color: withOpacity(primary, 0.3) }}>{icon}</div>
            <span className="text-xs tracking-wide" style={{ color: textMuted }}>{label}</span>
        </div>
    );
}
