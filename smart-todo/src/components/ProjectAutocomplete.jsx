import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { classNames } from "../utils";

/**
 * Composant d'autocomplétion spécialisé pour les noms de projets
 * Filtre automatiquement les suggestions basées sur l'historique des projets
 * Convertit automatiquement la saisie en majuscules
 */
export function ProjectAutocomplete({ value, onChange, onBlur, projectHistory, placeholder, className }) {
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);

  const filteredSuggestions = useMemo(() => {
    if (!value) return projectHistory;
    const searchQuery = value.toUpperCase();
    return projectHistory.filter((projectName) => projectName.includes(searchQuery));
  }, [value, projectHistory]);

  useEffect(() => {
    if (!isSuggestionsOpen) return;

    function handleClickOutside(event) {
      if (
        wrapperRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
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

  function handleKeyDown(event) {
    if (!isSuggestionsOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedSuggestionIndex((index) => (index < filteredSuggestions.length - 1 ? index + 1 : index));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedSuggestionIndex((index) => (index > 0 ? index - 1 : -1));
    } else if (event.key === "Enter" && focusedSuggestionIndex >= 0) {
      event.preventDefault();
      onChange(filteredSuggestions[focusedSuggestionIndex]);
      setIsSuggestionsOpen(false);
      setFocusedSuggestionIndex(-1);
    } else if (event.key === "Escape") {
      setIsSuggestionsOpen(false);
      setFocusedSuggestionIndex(-1);
    }
  }

  function handleSuggestionSelect(suggestion) {
    onChange(suggestion);
    setIsSuggestionsOpen(false);
    setFocusedSuggestionIndex(-1);
  }

  function handleInputChange(event) {
    onChange(event.target.value.toUpperCase());
  }

  function handleInputFocus() {
    setIsSuggestionsOpen(true);
  }

  function handleInputBlur() {
    // Délai pour permettre le clic sur une suggestion
    setTimeout(() => {
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
            className="fixed z-[99999] max-h-48 overflow-auto rounded-2xl border border-white/15 bg-[#0b1124] shadow-2xl"
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
                onClick={() => handleSuggestionSelect(suggestion)}
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
