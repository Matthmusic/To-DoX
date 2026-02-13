import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Callbacks pour les actions déclenchées par les raccourcis clavier
 *
 * Pattern: Injection de dépendances via Context pour éviter le prop drilling
 * Les callbacks sont fournis par le composant parent (ToDoX) qui a accès à l'état
 */
export interface ShortcutsContextValue {
  /** Focus sur le champ QuickAdd */
  focusQuickAdd: () => void;

  /** Focus sur le champ de recherche */
  focusSearch: () => void;

  /** Déclencher l'export de données */
  openExport: () => void;

  /** Fermer tous les modaux/panels ouverts */
  closeModals: () => void;

  /** Ouvrir le panel des archives */
  openArchives: () => void;

  /** Ouvrir le panel de gestion des projets */
  openProjects: () => void;

  /** Ouvrir le panel d'aide des raccourcis */
  openHelp: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

interface ShortcutsProviderProps {
  value: ShortcutsContextValue;
  children: ReactNode;
}

/**
 * Provider pour les callbacks de raccourcis clavier
 *
 * Usage:
 * ```tsx
 * <ShortcutsProvider value={{
 *   focusQuickAdd: () => quickAddRef.current?.focus(),
 *   focusSearch: () => searchRef.current?.focus(),
 *   // ...
 * }}>
 *   <App />
 * </ShortcutsProvider>
 * ```
 */
export function ShortcutsProvider({ value, children }: ShortcutsProviderProps) {
  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

/**
 * Hook pour accéder aux callbacks de raccourcis
 *
 * @throws Error si utilisé hors du ShortcutsProvider
 */
export function useShortcuts(): ShortcutsContextValue {
  const context = useContext(ShortcutsContext);

  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutsProvider');
  }

  return context;
}
