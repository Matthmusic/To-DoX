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
                <div
                    className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border-2 border-theme-primary bg-theme-secondary/98 shadow-[0_20px_70px_rgba(0,0,0,0.6)] overflow-hidden"
                    style={{ backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)' }}
                >
                    {/* Effet vitre teintée - Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />

                    {/* Reflet lumineux en haut */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

                    {/* Content avec z-index pour être au-dessus de l'overlay */}
                    <div className="relative z-10">
                        {children}
                    </div>
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
            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-theme-primary transition hover:bg-white/10 ${className}`}
        >
            {Icon && <Icon className="h-4 w-4 text-theme-secondary" />}
            <span>{label}</span>
        </button>
    );
}
