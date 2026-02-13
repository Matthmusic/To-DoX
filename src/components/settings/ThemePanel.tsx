import { createPortal } from 'react-dom';
import { X, Palette, Monitor, Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useState } from 'react';
import type { Theme, ThemeMode } from '../../types';

interface ThemePanelProps {
  onClose: () => void;
}

export function ThemePanel({ onClose }: ThemePanelProps) {
  const {
    mode,
    activeTheme,
    effectiveMode,
    presetThemes,
    customThemes,
    customAccentColor,
    setMode,
    setActiveTheme,
    setCustomAccent,
  } = useTheme();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(customAccentColor || '#06b6d4');

  const modes: { id: ThemeMode; label: string; icon: typeof Sun; description: string }[] = [
    // { id: 'light', label: 'Clair', icon: Sun, description: 'Mode clair permanent' }, // Désactivé
    { id: 'dark', label: 'Sombre', icon: Moon, description: 'Mode sombre permanent' },
    { id: 'auto', label: 'Auto', icon: Monitor, description: 'Suit le thème système' },
  ];

  const allThemes = [...presetThemes, ...customThemes];
  const darkThemes = allThemes.filter(t => t.mode === 'dark');
  const lightThemes = allThemes.filter(t => t.mode === 'light');

  const handleApplyCustomColor = () => {
    setCustomAccent(tempColor);
    setShowColorPicker(false);
  };

  const handleResetCustomColor = () => {
    setCustomAccent(undefined);
    setShowColorPicker(false);
  };

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
                <Sun className="w-5 h-5 text-amber-400" />
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

          {/* Section Couleur d'Accent Personnalisée */}
          <section>
            <h3 className="text-lg font-bold text-theme-primary mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-theme-secondary" />
              Couleur d'accent personnalisée
            </h3>
            <div className="p-4 rounded-xl bg-white/5 border border-theme-primary space-y-3">
              <p className="text-sm text-theme-secondary">
                Personnalisez la couleur principale du thème actif
              </p>

              {showColorPicker ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={tempColor}
                      onChange={(e) => setTempColor(e.target.value)}
                      className="w-16 h-16 rounded-lg border-2 border-theme-primary cursor-pointer"
                    />
                    <input
                      type="text"
                      value={tempColor}
                      onChange={(e) => setTempColor(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-theme-tertiary border border-theme-primary text-theme-primary"
                      placeholder="#06b6d4"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyCustomColor}
                      className="flex-1 px-4 py-2 rounded-lg bg-theme-primary text-white font-semibold hover:opacity-80"
                    >
                      Appliquer
                    </button>
                    <button
                      onClick={handleResetCustomColor}
                      className="px-4 py-2 rounded-lg bg-white/10 text-theme-secondary hover:bg-white/20"
                    >
                      Réinitialiser
                    </button>
                    <button
                      onClick={() => setShowColorPicker(false)}
                      className="px-4 py-2 rounded-lg bg-white/10 text-theme-secondary hover:bg-white/20"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowColorPicker(true)}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-theme-primary to-theme-secondary text-white font-bold hover:opacity-80"
                >
                  {customAccentColor ? '🎨 Modifier la couleur' : '✨ Choisir une couleur'}
                </button>
              )}

              {customAccentColor && !showColorPicker && (
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className="w-6 h-6 rounded border border-theme-primary"
                    style={{ backgroundColor: customAccentColor }}
                  />
                  <span className="text-theme-secondary">Couleur active: {customAccentColor}</span>
                </div>
              )}
            </div>
          </section>
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
