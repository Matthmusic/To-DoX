import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { classNames } from "../utils";

interface ProjectAutocompleteProps {
    value: string;
    onChange: (val: string) => void;
    onBlur?: (val?: string) => void;
    projectHistory: string[];
    placeholder?: string;
    className?: string;
}

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
}

/**
 * Composant d'autocomplétion spécialisé pour les noms de projets
 * Filtre automatiquement les suggestions basées sur l'historique des projets
 * Convertit automatiquement la saisie en majuscules
 */
export function ProjectAutocomplete({ value, onChange, onBlur, projectHistory = [], placeholder, className }: ProjectAutocompleteProps) {
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
    const skipNextBlurRef = useRef(false);

    const filteredSuggestions = useMemo(() => {
        if (!value) return projectHistory;
        const searchQuery = value.toUpperCase();
        return projectHistory.filter((projectName) => projectName.includes(searchQuery));
    }, [value, projectHistory]);

    useEffect(() => {
        if (!isSuggestionsOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                wrapperRef.current?.contains(event.target as Node) ||
                dropdownRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setIsSuggestionsOpen(false);
            setFocusedSuggestionIndex(-1);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isSuggestionsOpen]);

    useEffect(() => {
        if (!isSuggestionsOpen) {
            setDropdownPosition(null);
        }
    }, [isSuggestionsOpen]);

    useLayoutEffect(() => {
        if (!isSuggestionsOpen) return;

        function updateDropdownPosition() {
            if (!inputRef.current) return;
            const inputRect = inputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: inputRect.bottom + 4,
                left: inputRect.left,
                width: inputRect.width,
            });
        }

        updateDropdownPosition();
        window.addEventListener("resize", updateDropdownPosition);
        window.addEventListener("scroll", updateDropdownPosition, true);
        return () => {
            window.removeEventListener("resize", updateDropdownPosition);
            window.removeEventListener("scroll", updateDropdownPosition, true);
        };
    }, [isSuggestionsOpen]);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (!isSuggestionsOpen) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setFocusedSuggestionIndex((index) => (index < filteredSuggestions.length - 1 ? index + 1 : index));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setFocusedSuggestionIndex((index) => (index > 0 ? index - 1 : -1));
        } else if (event.key === "Enter" && focusedSuggestionIndex >= 0) {
            event.preventDefault();
            const selectedSuggestion = filteredSuggestions[focusedSuggestionIndex];
            skipNextBlurRef.current = true;
            onChange(selectedSuggestion);
            setIsSuggestionsOpen(false);
            setFocusedSuggestionIndex(-1);
            if (onBlur) {
                setTimeout(() => onBlur(selectedSuggestion), 0);
            }
        } else if (event.key === "Escape") {
            setIsSuggestionsOpen(false);
            setFocusedSuggestionIndex(-1);
        }
    }

    function handleSuggestionSelect(suggestion: string) {
        skipNextBlurRef.current = true;
        onChange(suggestion);
        setIsSuggestionsOpen(false);
        setFocusedSuggestionIndex(-1);
        // Appeler onBlur immédiatement avec la nouvelle valeur
        if (onBlur) {
            setTimeout(() => onBlur(suggestion), 0);
        }
    }

    function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        onChange(event.target.value.toUpperCase());
    }

    function handleInputFocus() {
        setIsSuggestionsOpen(true);
    }

    function handleInputBlur() {
        // Délai pour permettre le clic sur une suggestion
        setTimeout(() => {
            if (skipNextBlurRef.current) {
                skipNextBlurRef.current = false;
                return;
            }
            if (onBlur) onBlur();
        }, 150);
    }

    return (
        <div ref={wrapperRef} className="relative">
            <input
                ref={inputRef}
                type="text"
                className={className}
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
            />
            {isSuggestionsOpen &&
                filteredSuggestions.length > 0 &&
                dropdownPosition &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className="fixed z-[99999] max-h-[36rem] overflow-auto rounded-b-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                        }}
                    >
                        {filteredSuggestions.map((suggestion, suggestionIndex) => (
                            <div
                                key={suggestion}
                                className={classNames(
                                    "cursor-pointer px-3 py-2 text-sm text-slate-100 transition",
                                    suggestionIndex === focusedSuggestionIndex ? "bg-[#1E3A8A]" : "hover:bg-[#1E3A8A]/60"
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleSuggestionSelect(suggestion);
                                }}
                                onMouseEnter={() => setFocusedSuggestionIndex(suggestionIndex)}
                            >
                                {suggestion}
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
}
