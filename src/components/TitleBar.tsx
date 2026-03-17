import { useRef, useState, useEffect } from 'react';
import { Minus, Square, X, Bell, Eye, EyeOff } from 'lucide-react';
import logoSvg from '../assets/To Do X.svg';
import { UserProfile } from './UserProfile';
import { NotificationDropdown } from './NotificationDropdown';
import { useTheme } from '../hooks/useTheme';
import useStore from '../store/useStore';
import { VIP_USERS, FIXED_USERS } from '../constants';
import { getInitials } from '../utils';

interface TitleBarProps {
    onTaskClick?: (taskId: string) => void;
}

export function TitleBar({ onTaskClick }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { activeTheme } = useTheme();
  const { currentUser, viewAsUser, appNotifications, setCurrentUser, setViewAsUser } = useStore();
  const isCurrentUserVip = currentUser ? VIP_USERS.includes(currentUser) : false;
  const visibleTabs = (() => {
    const base = isCurrentUserVip
      ? FIXED_USERS.filter(u => u.id !== 'unassigned')
      : FIXED_USERS.filter(u => u.id === currentUser && u.id !== 'unassigned');
    return [...base].sort((a, b) => {
      if (a.id === currentUser) return -1;
      if (b.id === currentUser) return 1;
      return 0;
    });
  })();

  const unreadCount = appNotifications.filter(n => n.toUserId === currentUser && !n.readAt && !(n.deletedBy ?? []).includes(currentUser ?? '')).length;

  useEffect(() => {
    // Vérifier l'état initial
    if (window.electronAPI?.isElectron) {
      window.electronAPI.windowIsMaximized().then(setIsMaximized);
    }
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.windowMinimize();
  };

  const handleMaximize = async () => {
    if (window.electronAPI) {
      const maximized = await window.electronAPI.windowMaximize();
      setIsMaximized(maximized);
    }
  };

  const handleClose = () => {
    window.electronAPI?.windowClose();
  };

  // N'afficher la barre de titre que dans Electron
  if (!window.electronAPI?.isElectron) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex h-8 items-center justify-between select-none"
      style={{
        WebkitAppRegion: 'drag',
        backgroundColor: activeTheme.palette.bgSecondary,
        borderBottom: `1px solid ${activeTheme.palette.borderPrimary}`
      } as React.CSSProperties}
    >
      {/* Logo + UserProfile + onglets VIP */}
      <div className="flex items-center gap-3 px-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <img
          src={logoSvg}
          alt="To-DoX"
          className="h-6 w-auto"
          style={{
            filter: `drop-shadow(0 0 8px ${activeTheme.palette.primary}66)`,
            WebkitAppRegion: 'drag',
            pointerEvents: 'none'
          } as React.CSSProperties}
        />
        <UserProfile />

        {/* 50px de séparation puis onglets côte à côte */}
        {visibleTabs.length > 0 && (
          <div className="flex items-center gap-1" style={{ marginLeft: '50px' }}>
            {visibleTabs.map(user => {
              const isMyTab = currentUser === user.id;
              const isViewing = viewAsUser === user.id;
              // Tab actif : ma session OU je visionne ce user
              const isActive = isMyTab && !viewAsUser;
              const unread = appNotifications.filter(n => n.toUserId === user.id && !n.readAt && !(n.deletedBy ?? []).includes(user.id)).length;
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    if (isMyTab) {
                      // Clic sur mon propre onglet : toggle ma session, efface viewAs
                      setViewAsUser(null);
                      setCurrentUser(isActive ? null : user.id);
                    } else {
                      // Clic sur un autre user : vue en tant que (pas changer la session)
                      setViewAsUser(isViewing ? null : user.id);
                    }
                  }}
                  title={isMyTab ? user.name : `Vue en tant que ${user.name}`}
                  className="relative h-6 px-1.5 flex items-center gap-1 rounded transition-all"
                  style={isActive
                    ? { backgroundColor: `${activeTheme.palette.primary}30`, color: activeTheme.palette.primary, fontWeight: 700 }
                    : isViewing
                      ? { backgroundColor: '#f59e0b22', color: '#f59e0b', fontWeight: 700 }
                      : { color: activeTheme.palette.textSecondary }}
                  onMouseEnter={(e) => { if (!isActive && !isViewing) e.currentTarget.style.backgroundColor = `${activeTheme.palette.primary}15`; }}
                  onMouseLeave={(e) => { if (!isActive && !isViewing) e.currentTarget.style.backgroundColor = isViewing ? '#f59e0b22' : 'transparent'; }}
                >
                  {isViewing && <Eye className="h-2.5 w-2.5" />}
                  <span className="text-[10px] font-semibold leading-none">{getInitials(user.name)}</span>
                  {unread > 0 && (
                    <span className="flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[7px] font-bold text-white leading-none">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full" style={{ backgroundColor: activeTheme.palette.primary }} />
                  )}
                  {isViewing && (
                    <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  )}
                </button>
              );
            })}
            {/* Badge "Vue en tant que" quand viewAsUser est actif */}
            {viewAsUser && (() => {
              const viewedUser = FIXED_USERS.find(u => u.id === viewAsUser);
              return viewedUser ? (
                <div className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}>
                  <Eye className="h-2.5 w-2.5" />
                  <span>{viewedUser.name}</span>
                  <button onClick={() => setViewAsUser(null)} className="ml-0.5 opacity-70 hover:opacity-100">
                    <EyeOff className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Centre : Bell notifications */}
      <div className="flex-1 flex items-center justify-center">
        <button
          ref={bellRef}
          onClick={() => setShowNotifDropdown(v => !v)}
          className="relative h-8 w-8 flex items-center justify-center transition-colors"
          style={{ color: 'rgba(255,255,255,0.75)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${activeTheme.palette.primary}20`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {showNotifDropdown && (
          <NotificationDropdown
            onClose={() => setShowNotifDropdown(false)}
            onTaskClick={(taskId) => {
              setShowNotifDropdown(false);
              if (onTaskClick) {
                onTaskClick(taskId);
              } else {
                window.dispatchEvent(new CustomEvent('todox:openTask', { detail: { taskId } }));
              }
            }}
            anchorRef={bellRef as React.RefObject<HTMLElement>}
          />
        )}
      </div>

      {/* Boutons de contrôle */}
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="h-8 w-12 flex items-center justify-center transition-colors"
          style={{
            color: activeTheme.palette.textSecondary
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${activeTheme.palette.primary}20`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Réduire"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-12 flex items-center justify-center transition-colors"
          style={{
            color: activeTheme.palette.textSecondary
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${activeTheme.palette.primary}20`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label={isMaximized ? 'Restaurer' : 'Maximiser'}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-12 flex items-center justify-center transition-colors"
          style={{
            color: activeTheme.palette.textSecondary
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dc2626';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = activeTheme.palette.textSecondary;
          }}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
