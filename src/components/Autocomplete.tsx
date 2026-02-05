import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { classNames } from "../utils";

interface AutocompleteProps<T, V = unknown> {
    value: V; // The value selected (e.g. ID or string)
    onChange: (value: V) => void;
    options: T[];
    placeholder?: string;
    className?: string;
    renderOption?: (option: T) => React.ReactNode;
    getValue?: (option: T) => V;
    getLabel?: (option: T) => string;
    maxHeightRef?: React.RefObject<HTMLElement | null>;
    maxHeight?: number;
}

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
}

/**
 * Composant Autocomplete réutilisable avec dropdown positionné en portal
 * Supporte la navigation au clavier et le clic en dehors pour fermer
 */
export function Autocomplete<T, V = unknown>({
    value,
    onChange,
    options,
    placeholder,
    className,
    renderOption,
    getValue = (option: T) => option as unknown as V,
    getLabel = (option: T) => String(option),
    maxHeightRef,
    maxHeight = 576,
}: AutocompleteProps<T, V>) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
    const [maxHeightPx, setMaxHeightPx] = useState(maxHeight);

    useEffect(() => {
        if (!isDropdownOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                wrapperRef.current?.contains(event.target as Node) ||
                dropdownRef.current?.contains(event.target as Node)
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
            setMaxHeightPx(maxHeight);
        }
    }, [isDropdownOpen, maxHeight]);

    useLayoutEffect(() => {
        if (!isDropdownOpen) return;

        function updateDropdownPosition() {
            if (!triggerButtonRef.current) return;
            const buttonRect = triggerButtonRef.current.getBoundingClientRect();
            const top = buttonRect.bottom + 4;
            setDropdownPosition({
                top,
                left: buttonRect.left,
                width: buttonRect.width,
            });
            let nextMaxHeight = maxHeight;
            if (maxHeightRef?.current) {
                const bottom = maxHeightRef.current.getBoundingClientRect().bottom;
                nextMaxHeight = Math.max(120, Math.min(maxHeight, bottom - top - 8));
            }
            setMaxHeightPx(nextMaxHeight);
        }

        updateDropdownPosition();
        window.addEventListener("resize", updateDropdownPosition);
        window.addEventListener("scroll", updateDropdownPosition, true);
        return () => {
            window.removeEventListener("resize", updateDropdownPosition);
            window.removeEventListener("scroll", updateDropdownPosition, true);
        };
    }, [isDropdownOpen, maxHeight, maxHeightRef]);

    function handleKeyDown(event: React.KeyboardEvent) {
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
            onChange(getValue!(options[focusedOptionIndex]));
            setIsDropdownOpen(false);
            setFocusedOptionIndex(-1);
        } else if (event.key === "Escape") {
            setIsDropdownOpen(false);
            setFocusedOptionIndex(-1);
        }
    }

    function handleOptionSelect(option: T) {
        onChange(getValue!(option));
        setIsDropdownOpen(false);
        setFocusedOptionIndex(-1);
    }

    function toggleDropdown() {
        setIsDropdownOpen(!isDropdownOpen);
    }

    const selectedOption = options.find((option) => getValue!(option) === value);
    const displayLabel = selectedOption ? getLabel!(selectedOption) : placeholder;

    return (
        <div ref={wrapperRef} className="relative">
            <button
                ref={triggerButtonRef}
                type="button"
                className={classNames("flex items-center justify-between gap-2", className)}
                onClick={toggleDropdown}
                onKeyDown={handleKeyDown}
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {isDropdownOpen &&
                dropdownPosition &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className="fixed z-[99999] overflow-auto rounded-b-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                            maxHeight: maxHeightPx,
                        }}
                    >
                        {options.map((option, optionIndex) => (
                            <div
                                key={String(getValue!(option))}
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
                                {renderOption ? renderOption(option) : getLabel!(option)}
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
}
