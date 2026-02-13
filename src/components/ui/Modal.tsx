import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        className={classNames(
                            "w-full rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#0f1629] to-[#0b1124] p-6 text-slate-100 shadow-[0_25px_60px_rgba(79,70,229,0.3),0_10px_30px_rgba(0,0,0,0.5)] relative max-h-[90vh] overflow-y-auto ring-1 ring-white/5",
                            width,
                            className
                        )}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                        <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
                            {title && (
                                <h3 className="text-xl font-semibold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                    {title}
                                </h3>
                            )}
                            <button
                                onClick={onClose}
                                className="rounded-full p-2 transition-all hover:bg-gradient-to-br hover:from-indigo-500/20 hover:to-purple-500/20 text-slate-400 hover:text-white hover:scale-110 hover:rotate-90"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
