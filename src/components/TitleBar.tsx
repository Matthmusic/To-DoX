import { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import logoSvg from '../assets/To Do X.svg';
import { UserProfile } from './UserProfile';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

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
      className="fixed top-0 left-0 right-0 z-[9999] flex h-8 items-center justify-between bg-[#020817] border-b border-white/5 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo et titre */}
      <div className="flex items-center gap-3 px-3">
        <img
          src={logoSvg}
          alt="To-DoX"
          className="h-5 w-auto drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] brightness-0 invert"
          style={{ filter: 'brightness(0) saturate(100%) invert(66%) sepia(73%) saturate(2234%) hue-rotate(157deg) brightness(95%) contrast(101%)' }}
        />
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <UserProfile />
        </div>
      </div>

      {/* Boutons de contrôle */}
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="h-8 w-12 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Réduire"
        >
          <Minus className="h-3.5 w-3.5 text-slate-300" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-12 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label={isMaximized ? 'Restaurer' : 'Maximiser'}
        >
          <Square className="h-3 w-3 text-slate-300" />
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-12 flex items-center justify-center hover:bg-red-600 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4 text-slate-300" />
        </button>
      </div>
    </div>
  );
}
