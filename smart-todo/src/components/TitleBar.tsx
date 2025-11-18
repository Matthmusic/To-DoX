import { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import iconPng from '../assets/icon.png';

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
      className="flex h-8 items-center justify-between bg-[#020817] border-b border-white/5 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo et titre */}
      <div className="flex items-center gap-2 px-3">
        <img
          src={iconPng}
          alt="To-DoX"
          className="h-4 w-4"
        />
        <span className="text-xs text-slate-300 font-medium">To-DoX</span>
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
