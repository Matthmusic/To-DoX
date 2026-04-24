import { useState, useEffect } from 'react';
import { Minus, Square, X, Eye, EyeOff } from 'lucide-react';
import logoSvg from '../assets/To Do X.svg';
import { UserProfile } from './UserProfile';
import { useTheme } from '../hooks/useTheme';
import useStore from '../store/useStore';
import { VIP_USERS, FIXED_USERS } from '../constants';
import { getInitials } from '../utils';
import citationsData from '../assets/citations_bureau_etudes_elec_btp_400.json';

/** Retourne la citation du jour (stable sur toute la journée, change à minuit) */
function getDailyQuote(): { citation: string; categorie: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const idx = dayOfYear % citationsData.citations.length;
    return citationsData.citations[idx];
}

interface TitleBarProps {
    onTaskClick?: (taskId: string) => void;
}

export function TitleBar({ onTaskClick: _onTaskClick }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showFullQuote, setShowFullQuote] = useState(false);
  const dailyQuote = getDailyQuote();
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
      <div className="flex min-w-0 shrink items-center gap-3 px-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
          <div className="flex min-w-0 items-center gap-1 overflow-hidden" style={{ marginLeft: '50px' }}>
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

      {/* Centre : citation du jour */}
      <div className="flex-[2] flex items-center justify-center min-w-0 px-4 relative overflow-hidden">
        <button
          onClick={() => setShowFullQuote(v => !v)}
          className="max-w-full flex items-center gap-1.5 group overflow-hidden"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title={dailyQuote.citation}
        >
          <span
            className="text-[11px] italic whitespace-nowrap transition-colors"
            style={{
              color: 'rgba(255,255,255,0.88)',
              textShadow: '0 1px 8px rgba(0,0,0,0.45)',
            }}
          >
            « {dailyQuote.citation} »
          </span>
        </button>

        {/* Tooltip pleine citation au clic */}
        {showFullQuote && (
          <>
            <div
              className="fixed inset-0 z-[9999]"
              onClick={() => setShowFullQuote(false)}
            />
            <div
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-[10000] rounded-2xl border px-4 py-3 shadow-2xl text-center"
              style={{
                width: 'min(480px, 90vw)',
                background: `linear-gradient(135deg, ${activeTheme.palette.bgPrimary}ee, ${activeTheme.palette.bgSecondary}ee)`,
                borderColor: `${activeTheme.palette.primary}30`,
                backdropFilter: 'blur(24px)',
              }}
            >
              <p
                className="text-[12px] italic leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                « {dailyQuote.citation} »
              </p>
              <span
                className="mt-2 block text-[9px] uppercase tracking-widest font-semibold"
                style={{ color: `${activeTheme.palette.primary}80` }}
              >
                {dailyQuote.categorie.replace(/_/g, ' ')}
              </span>
            </div>
          </>
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
