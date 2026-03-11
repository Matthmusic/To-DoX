import { Palette } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { GlassModal } from '../ui/GlassModal';
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
  const primaryColor = activeTheme.palette.primary;

  return (
    <GlassModal
      isOpen={true}
      onClose={onClose}
      title={<><Palette className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Thèmes et Apparence</>}
      size="xl"
    >
      <div className="space-y-8">
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

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-6 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
        >
          Fermer
        </button>
      </div>
    </GlassModal>
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
