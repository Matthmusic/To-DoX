import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames } from "../../utils";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string; // Pour le conteneur interne
    width?: string; // ex: "max-w-3xl"
}

export function Modal({ isOpen, onClose, title, children, className, width = "max-w-3xl" }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
            onClick={onClose}
        >
            <div
                className={classNames(
                    "w-full rounded-3xl border border-white/10 bg-[#0b1124] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)] relative max-h-[90vh] overflow-y-auto",
                    width,
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 flex items-center justify-between">
                    {title && <h3 className="text-xl font-semibold">{title}</h3>}
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 transition hover:bg-white/10 text-slate-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}
