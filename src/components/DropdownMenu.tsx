import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DropdownMenuProps {
    icon: LucideIcon;
    label: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Composant Dropdown réutilisable
 */
export function DropdownMenu({ icon: Icon, label, children, className = "" }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`rounded-2xl px-4 py-2 font-semibold transition inline-flex items-center gap-2 ${className}`}
            >
                <Icon className="h-4 w-4" />
                {label}
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-white/10 bg-[#0b1124] shadow-2xl overflow-hidden">
                    {children}
                </div>
            )}
        </div>
    );
}

interface DropdownItemProps {
    icon?: LucideIcon;
    label: string;
    onClick?: () => void;
    className?: string;
}

/**
 * Item de dropdown
 */
export function DropdownItem({ icon: Icon, label, onClick, className = "" }: DropdownItemProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-slate-200 transition hover:bg-white/10 ${className}`}
        >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{label}</span>
        </button>
    );
}
