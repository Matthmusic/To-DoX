import { forwardRef, useRef, useImperativeHandle } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Composant de recherche avec focus programmatique
 *
 * Pattern: forwardRef + useImperativeHandle pour exposer la méthode focus()
 * Permet aux raccourcis clavier de focus cet input via ref
 *
 * Usage:
 * ```tsx
 * const searchRef = useRef<{ focus: () => void }>(null);
 * // ... dans le raccourci Ctrl+F:
 * searchRef.current?.focus();
 *
 * <SearchInput
 *   ref={searchRef}
 *   value={filterSearch}
 *   onChange={setFilterSearch}
 * />
 * ```
 */
export const SearchInput = forwardRef<{ focus: () => void }, SearchInputProps>(
  ({ value, onChange, placeholder = "Rechercher...", className = "" }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    // Exposer la méthode focus() pour les raccourcis clavier
    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    const handleClear = () => {
      onChange('');
      inputRef.current?.focus(); // Garder le focus après clear
    };

    return (
      <div className={`relative flex items-center ${className}`}>
        {/* Icône de recherche */}
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />

        {/* Input principal */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-10 py-2 text-sm text-slate-100 placeholder-slate-400 transition focus:border-cyan-400/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
        />

        {/* Bouton clear (seulement si value non vide) */}
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 rounded-full p-1 transition hover:bg-white/10"
            type="button"
            aria-label="Effacer la recherche"
          >
            <X className="h-3.5 w-3.5 text-slate-400 hover:text-white" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
