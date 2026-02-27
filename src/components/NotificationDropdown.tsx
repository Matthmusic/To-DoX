import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCircle2, RotateCcw, Eye, Clock, CheckCheck } from "lucide-react";
import useStore from "../store/useStore";
import type { AppNotification } from "../types";

interface NotificationDropdownProps {
    onClose: () => void;
    onTaskClick: (taskId: string) => void;
    anchorRef: React.RefObject<HTMLElement | null>;
}

function getNotifIcon(type: AppNotification["type"]) {
    switch (type) {
        case "review_requested": return <Eye className="h-3.5 w-3.5 text-violet-400" />;
        case "review_validated": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
        case "review_rejected":  return <RotateCcw className="h-3.5 w-3.5 text-amber-400" />;
        case "review_stale":     return <Clock className="h-3.5 w-3.5 text-orange-400" />;
    }
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
}

export function NotificationDropdown({ onClose, onTaskClick, anchorRef }: NotificationDropdownProps) {
    const { currentUser, appNotifications, markNotificationRead, markAllNotificationsRead } = useStore();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const myNotifs = appNotifications
        .filter(n => n.toUserId === currentUser)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);

    const unreadCount = myNotifs.filter(n => !n.readAt).length;

    // Centré horizontalement, positionné sous l'ancre
    const pos = anchorRef.current?.getBoundingClientRect();
    const top = pos ? pos.bottom + 8 : 48;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                dropdownRef.current?.contains(e.target as Node) ||
                anchorRef.current?.contains(e.target as Node)
            ) return;
            onClose();
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose, anchorRef]);

    return createPortal(
        <div
            ref={dropdownRef}
            className="fixed z-[99998] w-[min(calc(100vw-1rem),24rem)] max-h-[480px] flex flex-col rounded-2xl border border-white/15 bg-[#0f1629] shadow-2xl backdrop-blur-xl overflow-hidden"
            style={{ top, left: '50%', transform: 'translateX(-50%)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-bold text-white">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && currentUser && (
                    <button
                        onClick={() => markAllNotificationsRead(currentUser)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-white"
                        title="Tout marquer comme lu"
                    >
                        <CheckCheck className="h-3 w-3" />
                        Tout lire
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {myNotifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
                        <Bell className="h-8 w-8 opacity-30" />
                        <span className="text-sm">Aucune notification</span>
                    </div>
                ) : (
                    myNotifs.map(notif => (
                        <button
                            key={notif.id}
                            onClick={() => {
                                markNotificationRead(notif.id);
                                onTaskClick(notif.taskId);
                                onClose();
                            }}
                            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 border-b border-white/5 ${!notif.readAt ? "bg-white/[0.03]" : ""}`}
                        >
                            <div className="mt-0.5 flex-shrink-0">
                                {getNotifIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs leading-snug ${!notif.readAt ? "text-white font-semibold" : "text-slate-300"}`}>
                                    {notif.message}
                                </p>
                                <span className="text-[10px] text-slate-500 mt-0.5 block">
                                    {timeAgo(notif.createdAt)}
                                </span>
                            </div>
                            {!notif.readAt && (
                                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-violet-400" />
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>,
        document.body
    );
}
