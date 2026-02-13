import { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import logoSvg from '../assets/To Do X.svg';
import { UserProfile } from './UserProfile';
import { useTheme } from '../hooks/useTheme';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const { activeTheme } = useTheme();

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
      {/* Logo et titre */}
      <div className="flex items-center gap-3 px-3">
        <img
          src={logoSvg}
          alt="To-DoX"
          className="h-5 w-auto"
          style={{
            filter: `drop-shadow(0 0 8px ${activeTheme.palette.primary}66)`,
            WebkitMaskImage: 'url(' + logoSvg + ')',
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            backgroundColor: activeTheme.palette.primary
          }}
        />
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <UserProfile />
        </div>
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
