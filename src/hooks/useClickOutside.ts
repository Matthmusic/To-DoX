import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Hook pour détecter les clics en dehors d'éléments spécifiques
 *
 * Utile pour fermer automatiquement des dropdowns, popovers, modals, etc.
 * lorsque l'utilisateur clique ailleurs dans la page.
 *
 * @param refs - Tableau de refs à surveiller (ex: [dropdownRef, buttonRef])
 * @param handler - Callback appelé lors d'un clic en dehors
 * @param enabled - Active/désactive la détection (default: true)
 *
 * @example
 * ```tsx
 * const dropdownRef = useRef<HTMLDivElement>(null);
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 *
 * useClickOutside([dropdownRef, buttonRef], () => setIsOpen(false), isOpen);
 * ```
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  handler: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    function handleClickOutside(event: MouseEvent) {
      // Vérifier si le clic est à l'intérieur d'un des éléments
      const clickedInside = refs.some((ref) =>
        ref.current?.contains(event.target as Node)
      );

      // Si le clic est en dehors, appeler le handler
      if (!clickedInside) {
        handler();
      }
    }

    // Attacher l'événement
    document.addEventListener('mousedown', handleClickOutside);

    // Nettoyer l'événement
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [refs, handler, enabled]);
}
