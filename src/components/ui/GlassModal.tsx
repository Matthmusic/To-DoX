/**
 * 🪟 GLASS MODAL COMPONENT
 * Modal glassmorphism premium avec animations Framer Motion
 * Design: Effet verre dépoli cyberpunk avec gradient mesh
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { backdropVariants, modalVariants } from '../../utils/animations';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw]'
};

export function GlassModal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  className = ''
}: GlassModalProps) {
  const { activeTheme } = useTheme();
  const primaryColor = activeTheme.palette.primary;
  const secondaryColor = activeTheme.palette.secondary;

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop avec blur */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeOnBackdrop ? onClose : undefined}
            className="fixed inset-0 z-50 bg-black/60"
            style={{ backdropFilter: 'blur(12px)' }}
          >
            {/* Gradient mesh d'ambiance */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
          </motion.div>

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className={`
                relative w-full ${sizeClasses[size]} pointer-events-auto
                ${className}
              `}
            >
              {/* Glass Card avec bordures lumineuses */}
              <div
                className="relative overflow-hidden rounded-3xl border-2 border-theme-primary bg-theme-secondary shadow-2xl"
                style={{
                  backdropFilter: 'blur(40px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                  backgroundColor: 'var(--bg-secondary)',
                  opacity: 0.98
                }}
              >
                {/* Gradient de bordure animé */}
                <div
                  className="absolute inset-0 rounded-3xl opacity-50 pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(to bottom right, ${primaryColor}33, transparent, ${secondaryColor}33)`
                  }}
                />

                {/* Effet shimmer sur les bords */}
                <div className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none">
                  <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{
                      backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`
                    }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{
                      backgroundImage: `linear-gradient(to right, transparent, ${secondaryColor}, transparent)`
                    }}
                  />
                </div>

                {/* Header */}
                {(title || showCloseButton) && (
                  <div className="relative flex items-center justify-between px-8 py-6 border-b border-theme-primary">
                    {title && (
                      <h2
                        className="text-2xl font-bold bg-clip-text text-transparent"
                        style={{
                          backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
                        }}
                      >
                        {title}
                      </h2>
                    )}
                    {showCloseButton && (
                      <motion.button
                        onClick={onClose}
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        className="ml-auto flex items-center justify-center w-10 h-10 rounded-full border border-theme-primary bg-white/5 text-theme-muted hover:text-theme-primary hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="relative px-8 py-6 text-theme-primary">
                  {children}
                </div>

                {/* Glow effect au survol */}
                <div className="absolute inset-0 rounded-3xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_60px_rgba(0,229,255,0.1)]" />
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * 🎨 GLASS PANEL COMPONENT
 * Panel glassmorphism pour layouts secondaires
 */
interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  glow?: 'cyan' | 'purple' | 'amber' | 'emerald';
}

export function GlassPanel({ children, className = '', glow = 'cyan' }: GlassPanelProps) {
  const glowColors = {
    cyan: 'hover:shadow-[0_0_40px_rgba(0,229,255,0.3)]',
    purple: 'hover:shadow-[0_0_40px_rgba(183,148,246,0.3)]',
    amber: 'hover:shadow-[0_0_40px_rgba(251,191,36,0.3)]',
    emerald: 'hover:shadow-[0_0_40px_rgba(52,211,153,0.3)]'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`
        relative overflow-hidden rounded-2xl border border-theme-primary
        bg-theme-secondary/60 backdrop-blur-xl shadow-xl
        transition-shadow duration-300
        ${glowColors[glow]}
        ${className}
      `}
    >
      {/* Gradient subtil */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}

/**
 * 🎯 GLASS CARD COMPONENT
 * Petites cartes glassmorphism pour statistiques
 */
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = '', hoverable = true, onClick }: GlassCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverable ? { scale: 1.02, y: -4 } : undefined}
      whileTap={hoverable ? { scale: 0.98 } : undefined}
      className={`
        relative overflow-hidden rounded-xl border border-theme-primary
        bg-theme-secondary/80 backdrop-blur-lg shadow-lg
        p-6 cursor-${onClick ? 'pointer' : 'default'}
        transition-all duration-300
        ${className}
      `}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      {/* Content */}
      <div className="relative">
        {children}
      </div>

      {/* Glow on hover */}
      {hoverable && (
        <div className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_30px_rgba(0,229,255,0.15)]" />
        </div>
      )}
    </motion.div>
  );
}
