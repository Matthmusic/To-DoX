import { GlassModal } from "./ui/GlassModal";
import { Keyboard, Zap, Navigation, Layers } from "lucide-react";
import type { ShortcutConfig } from "../hooks/useKeyboardShortcuts";

interface ShortcutsHelpPanelProps {
  onClose: () => void;
  shortcuts: ShortcutConfig[];
}

/**
 * Panel d'aide affichant tous les raccourcis clavier disponibles
 *
 * Design: Utilise GlassModal pour cohérence avec l'UI existante
 * Groupement par catégorie (UI, Navigation, Actions)
 */
export function ShortcutsHelpPanel({ onClose, shortcuts }: ShortcutsHelpPanelProps) {
  // Grouper les raccourcis par catégorie
  const groupedShortcuts = {
    ui: shortcuts.filter((s) => s.category === 'ui'),
    navigation: shortcuts.filter((s) => s.category === 'navigation'),
    actions: shortcuts.filter((s) => s.category === 'actions'),
  };

  // Icônes par catégorie
  const categoryIcons = {
    ui: Layers,
    navigation: Navigation,
    actions: Zap,
  };

  // Labels des catégories
  const categoryLabels = {
    ui: 'Interface',
    navigation: 'Navigation',
    actions: 'Actions',
  };

  /**
   * Formatte l'affichage d'un raccourci avec les touches visuelles
   */
  const renderShortcutKeys = (shortcut: ShortcutConfig) => {
    const keys: string[] = [];

    if (shortcut.ctrl) keys.push('Ctrl');
    if (shortcut.shift) keys.push('Shift');
    keys.push(shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase());

    return (
      <div className="flex items-center gap-1">
        {keys.map((key, idx) => (
          <span key={idx} className="flex items-center">
            <kbd className="rounded-lg border border-white/20 bg-slate-800 px-2.5 py-1 text-xs font-mono text-cyan-300 shadow-sm">
              {key}
            </kbd>
            {idx < keys.length - 1 && <span className="mx-1 text-xs text-slate-500">+</span>}
          </span>
        ))}
      </div>
    );
  };

  /**
   * Rend une catégorie de raccourcis
   */
  const renderCategory = (category: 'ui' | 'navigation' | 'actions') => {
    const items = groupedShortcuts[category];
    if (items.length === 0) return null;

    const Icon = categoryIcons[category];

    return (
      <div key={category} className="space-y-3">
        {/* Header de catégorie */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Icon className="h-4 w-4 text-cyan-400" />
          <h4 className="text-sm font-semibold text-slate-300">{categoryLabels[category]}</h4>
        </div>

        {/* Liste des raccourcis */}
        <div className="space-y-2">
          {items.map((shortcut, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/5"
            >
              <span className="text-sm text-slate-200">{shortcut.description}</span>
              {renderShortcutKeys(shortcut)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <GlassModal isOpen={true} onClose={onClose} title="Raccourcis Clavier" size="md">
      <div className="space-y-6">
        {/* Introduction */}
        <div className="flex items-center gap-2 text-slate-300">
          <Keyboard className="h-5 w-5 text-cyan-400" />
          <p className="text-sm">
            Utilisez ces raccourcis pour naviguer rapidement dans To-DoX
          </p>
        </div>

        {/* Catégories */}
        {renderCategory('ui')}
        {renderCategory('navigation')}
        {renderCategory('actions')}

        {/* Footer avec astuce */}
        <div className="mt-6 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-center">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-cyan-400">Astuce :</span> Sur macOS, utilisez{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300">Cmd</kbd> au lieu de{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300">Ctrl</kbd>
          </p>
        </div>
      </div>
    </GlassModal>
  );
}
