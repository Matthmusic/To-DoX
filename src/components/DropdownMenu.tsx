import React, { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
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
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    // Positionnement du panel via portal
    useEffect(() => {
        if (!isOpen) return;
        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            setPanelStyle({
                position: 'fixed',
                top: rect.bottom + 8,
                right: Math.max(8, window.innerWidth - rect.right),
                maxWidth: 'calc(100vw - 16px)',
                maxHeight: Math.max(120, window.innerHeight - rect.bottom - 24),
                zIndex: 9999,
            });
        };
        updatePosition();
        panelRef.current?.querySelector('button')?.focus();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, [isOpen]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                panelRef.current && !panelRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setIsOpen(!isOpen)}
                className={`rounded-2xl px-3 py-2 font-semibold transition inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
            >
                <Icon className="h-4 w-4" />
                {label}
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && createPortal(
                <div
                    ref={panelRef}
                    id={panelId}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            setIsOpen(false);
                            buttonRef.current?.focus();
                        }
                    }}
                    onClick={() => setIsOpen(false)}
                    className="min-w-[200px] rounded-2xl border-2 border-theme-primary bg-theme-secondary/98 shadow-[0_20px_70px_rgba(0,0,0,0.6)] overflow-y-auto"
                    style={{
                        ...panelStyle,
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                        backgroundColor: 'var(--bg-secondary)',
                    }}
                >
                    {/* Effet vitre teintée - Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--overlay-rgb),0.05)] via-transparent to-[rgba(var(--overlay-rgb),0.02)] pointer-events-none" />

                    {/* Reflet lumineux en haut */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--overlay-rgb),0.3)] to-transparent pointer-events-none" />

                    {/* Content */}
                    <div className="relative z-10">
                        {children}
                    </div>
                </div>,
                document.body
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
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-theme-primary transition hover:bg-[rgba(var(--overlay-rgb),0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${className}`}
        >
            {Icon && <Icon className="h-3.5 w-3.5 text-theme-secondary" />}
            <span className="text-sm">{label}</span>
        </button>
    );
}

/**
 * En-tête de section dans un dropdown
 */
export function DropdownSection({ label }: { label: string }) {
    return (
        <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        </div>
    );
}
