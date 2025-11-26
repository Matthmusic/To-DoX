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
  getValue = (option) => option,
  getLabel = (option) => option,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const triggerButtonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);

  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClickOutside(event) {
      if (
        wrapperRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsDropdownOpen(false);
      setFocusedOptionIndex(-1);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) {
      setDropdownPosition(null);
    }
  }, [isDropdownOpen]);

  useLayoutEffect(() => {
    if (!isDropdownOpen) return;

    function updateDropdownPosition() {
      if (!triggerButtonRef.current) return;
      const buttonRect = triggerButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: buttonRect.bottom + 4,
        left: buttonRect.left,
        width: buttonRect.width,
      });
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isDropdownOpen]);

  function handleKeyDown(event) {
    if (!isDropdownOpen) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setIsDropdownOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedOptionIndex((index) => (index < options.length - 1 ? index + 1 : index));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedOptionIndex((index) => (index > 0 ? index - 1 : 0));
    } else if (event.key === "Enter" && focusedOptionIndex >= 0) {
      event.preventDefault();
      onChange(getValue(options[focusedOptionIndex]));
      setIsDropdownOpen(false);
      setFocusedOptionIndex(-1);
    } else if (event.key === "Escape") {
      setIsDropdownOpen(false);
      setFocusedOptionIndex(-1);
    }
  }

  function handleOptionSelect(option) {
    onChange(getValue(option));
    setIsDropdownOpen(false);
    setFocusedOptionIndex(-1);
  }

  function toggleDropdown() {
    setIsDropdownOpen(!isDropdownOpen);
  }

  const selectedOption = options.find((option) => getValue(option) === value);
  const displayLabel = selectedOption ? getLabel(selectedOption) : placeholder;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerButtonRef}
        type="button"
        className={className}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
      >
        {displayLabel}
      </button>
      {isDropdownOpen &&
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
            {options.map((option, optionIndex) => (
              <div
                key={getValue(option)}
                className={classNames(
                  "cursor-pointer px-3 py-2 text-sm text-slate-100 transition",
                  optionIndex === focusedOptionIndex ? "bg-[#1E3A8A]" : "hover:bg-[#1E3A8A]/60"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleOptionSelect(option);
                }}
                onMouseEnter={() => setFocusedOptionIndex(optionIndex)}
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
