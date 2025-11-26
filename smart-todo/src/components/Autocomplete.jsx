import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { classNames } from "../utils";

/**
 * Composant Autocomplete réutilisable avec dropdown positionné en portal
 * Supporte la navigation au clavier et le clic en dehors pour fermer
 */
export function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
  className,
  renderOption,
  getValue = (x) => x,
  getLabel = (x) => x,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);

  useEffect(() => {
    if (!showDropdown) return;

    function handleClickOutside(event) {
      if (
        wrapperRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }
      setShowDropdown(false);
      setFocusedIndex(-1);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) {
      setDropdownPosition(null);
    }
  }, [showDropdown]);

  useLayoutEffect(() => {
    if (!showDropdown) return;

    function updatePosition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showDropdown]);

  function handleKeyDown(e) {
    if (!showDropdown) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setShowDropdown(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => (i < options.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      onChange(getValue(options[focusedIndex]));
      setShowDropdown(false);
      setFocusedIndex(-1);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setFocusedIndex(-1);
    }
  }

  function selectOption(option) {
    onChange(getValue(option));
    setShowDropdown(false);
    setFocusedIndex(-1);
  }

  const selectedOption = options.find((opt) => getValue(opt) === value);
  const displayValue = selectedOption ? getLabel(selectedOption) : placeholder;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={() => setShowDropdown(!showDropdown)}
        onKeyDown={handleKeyDown}
      >
        {displayValue}
      </button>
      {showDropdown &&
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
            {options.map((option, idx) => (
              <div
                key={getValue(option)}
                className={classNames(
                  "cursor-pointer px-3 py-2 text-sm text-slate-100 transition",
                  idx === focusedIndex ? "bg-[#1E3A8A]" : "hover:bg-[#1E3A8A]/60"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectOption(option);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                {renderOption ? renderOption(option) : getLabel(option)}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
