import { useEffect, useMemo } from 'react';
import type { ShortcutsContextValue } from '../contexts/ShortcutsContext';

/**
 * Configuration d'un raccourci clavier
 */
export interface ShortcutConfig {
  /** Touche principale (ex: 'n', 'f', 'Escape') */
  key: string;

  /** Nécessite Ctrl ou Cmd (macOS) */
  ctrl?: boolean;

  /** Nécessite Shift */
  shift?: boolean;

  /** Description pour l'aide utilisateur */
  description: string;

  /** Catégorie pour groupement dans l'UI */
  category: 'navigation' | 'actions' | 'ui';

  /** Callback à exécuter */
  action: () => void;

  /** Désactiver quand input actif? (default: true sauf pour Escape) */
  disableInInput?: boolean;
}

/**
 * Hook personnalisé pour gérer les raccourcis clavier globaux
 *
 * Pattern établi dans To-DoX:
 * - useEffect avec cleanup pour addEventListener/removeEventListener
 * - Vérification du contexte (input actif, modal ouvert, etc.)
 * - Support cross-platform (Ctrl sur Windows, Cmd sur macOS)
 *
 * @param shortcuts - Configuration des raccourcis à activer
 * @param enabled - Activer ou désactiver les raccourcis (default: true)
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'n', ctrl: true, description: 'Nouvelle tâche', category: 'actions', action: () => {...} },
 *   { key: 'Escape', description: 'Fermer', category: 'ui', action: () => {...}, disableInInput: false },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Vérifier si un input est actif (pour éviter d'interférer avec la saisie)
      const target = event.target as HTMLElement;
      const isInputActive =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Trouver le raccourci correspondant
      for (const shortcut of shortcuts) {
        // Vérifier la touche
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) continue;

        // Vérifier les modificateurs (strict matching)
        // Si ctrl requis → vérifier qu'il est pressé
        // Si ctrl NON requis → vérifier qu'il n'est PAS pressé
        const ctrlMatch = shortcut.ctrl
          ? (event.ctrlKey || event.metaKey)  // Meta = Cmd sur macOS
          : !(event.ctrlKey || event.metaKey);
        const shiftMatch = shortcut.shift
          ? event.shiftKey
          : !event.shiftKey;

        if (!ctrlMatch || !shiftMatch) continue;

        // Vérifier si on doit désactiver dans les inputs
        const shouldDisableInInput = shortcut.disableInInput !== false;
        if (isInputActive && shouldDisableInInput) continue;

        // Raccourci trouvé ! Exécuter l'action
        event.preventDefault(); // Empêcher le comportement par défaut du navigateur
        shortcut.action();
        return; // Ne déclencher qu'un seul raccourci
      }
    };

    // Installer le listener global
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup: retirer le listener au démontage
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

/**
 * Hook simplifié pour utiliser les raccourcis définis dans le contexte
 *
 * Configure les 7 raccourcis standard de To-DoX
 *
 * @param callbacks - Callbacks pour les actions des raccourcis
 * @param isModalOpen - État d'ouverture des modaux (pour désactiver certains raccourcis)
 *
 * @example
 * ```tsx
 * useDefaultShortcuts(shortcutsCallbacks, isAnyModalOpen);
 * ```
 */
export function useDefaultShortcuts(callbacks: ShortcutsContextValue, isModalOpen = false) {
  const {
    focusQuickAdd,
    focusSearch,
    openExport,
    closeModals,
    openArchives,
    openProjects,
    openHelp,
  } = callbacks;

  // Mémoiser la config pour éviter de recréer l'array à chaque render
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    // === UI ===
    {
      key: 'n',
      ctrl: true,
      description: 'Focus sur QuickAdd (nouvelle tâche)',
      category: 'ui',
      action: focusQuickAdd,
      disableInInput: true,
    },
    {
      key: 'f',
      ctrl: true,
      description: 'Focus sur la recherche',
      category: 'ui',
      action: focusSearch,
      disableInInput: true,
    },
    {
      key: 'Escape',
      description: 'Fermer les modaux/panels',
      category: 'ui',
      action: closeModals,
      disableInInput: false, // Escape fonctionne toujours
    },

    // === NAVIGATION ===
    {
      key: 'a',
      ctrl: true,
      shift: true,
      description: 'Ouvrir les archives',
      category: 'navigation',
      action: openArchives,
      disableInInput: true,
    },
    {
      key: 'p',
      ctrl: true,
      shift: true,
      description: 'Ouvrir la liste des projets',
      category: 'navigation',
      action: openProjects,
      disableInInput: true,
    },
    {
      key: 'F1',
      description: 'Afficher l\'aide des raccourcis',
      category: 'navigation',
      action: openHelp,
      disableInInput: false, // F1 fonctionne partout
    },

    // === ACTIONS ===
    {
      key: 'e',
      ctrl: true,
      description: 'Exporter les données',
      category: 'actions',
      action: openExport,
      disableInInput: true,
    },
  ], [focusQuickAdd, focusSearch, openExport, closeModals, openArchives, openProjects, openHelp]);

  useKeyboardShortcuts(shortcuts, !isModalOpen);

  // Retourner la config pour le panel d'aide
  return { shortcuts };
}
