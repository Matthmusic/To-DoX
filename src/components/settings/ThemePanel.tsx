import { createPortal } from 'react-dom';
import { X, Palette } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../types';

interface ThemePanelProps {
  onClose: () => void;
}

export function ThemePanel({ onClose }: ThemePanelProps) {
  const {
    activeTheme,
    presetThemes,
    customThemes,
    setActiveTheme,
  } = useTheme();

  const allThemes = [...presetThemes, ...customThemes];
  const darkThemes = allThemes.filter(t => t.mode === 'dark');
  const lightThemes = allThemes.filter(t => t.mode === 'light');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-theme-primary rounded-2xl shadow-2xl"
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          backgroundColor: 'var(--bg-secondary)',
          opacity: 0.98
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-theme-primary bg-theme-secondary/95 backdrop-blur-sm">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-theme-primary to-theme-secondary bg-clip-text text-transparent flex items-center gap-2">
            <Palette className="w-6 h-6 text-theme-primary" />
            Thèmes et Apparence
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-theme-primary bg-white/5 text-theme-muted hover:text-theme-primary hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Section Thèmes */}
          <section>
            <h3 className="text-lg font-bold text-theme-primary mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-theme-primary" />
              Thèmes
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {darkThemes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isActive={activeTheme.id === theme.id}
                  onClick={() => setActiveTheme(theme.id)}
                />
              ))}
            </div>
          </section>

          {/* Section Thèmes Clairs - Désactivée */}
          {lightThemes.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-theme-primary mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-400" />
                Thèmes Clairs
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {lightThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={activeTheme.id === theme.id}
                    onClick={() => setActiveTheme(theme.id)}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Carte de prévisualisation d'un thème
 */
interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}

function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border transition-all text-left
        ${isActive
          ? 'border-theme-accent bg-theme-primary/20 shadow-lg shadow-[var(--color-primary)]/20 ring-2 ring-[var(--border-accent)]'
          : 'border-theme-primary bg-white/5 hover:bg-white/10 hover:border-theme-accent'
        }
      `}
    >
      {/* Preview des couleurs */}
      <div className="flex gap-1 mb-3">
        <div
          className="w-8 h-8 rounded border border-theme-primary"
          style={{ backgroundColor: theme.palette.primary }}
        />
        <div
          className="w-8 h-8 rounded border border-theme-primary"
          style={{ backgroundColor: theme.palette.secondary }}
        />
        <div
          className="flex-1 rounded border border-theme-primary"
          style={{ backgroundColor: theme.palette.bgSecondary }}
        />
      </div>

      {/* Nom */}
      <div className="text-sm font-bold text-theme-primary">{theme.name}</div>

      {/* Badge personnalisé */}
      {theme.custom && (
        <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-theme-secondary/20 text-theme-secondary border border-theme-secondary/30">
          Personnalisé
        </span>
      )}

      {/* Badge actif */}
      {isActive && (
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-theme-primary shadow-lg shadow-[var(--color-primary)]/50" />
      )}
    </button>
  );
}
