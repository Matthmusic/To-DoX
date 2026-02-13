/**
 * 🎭 SYSTÈME D'ANIMATIONS PREMIUM
 * Variants Framer Motion réutilisables pour To-DoX
 * Design: Cyberpunk-élégant avec mouvements fluides
 */

import type { Variant } from 'framer-motion';

// Type pour les variants (objet avec des états nommés)
type Variants = Record<string, Variant>;

// ============================================
// 🌊 FADE ANIMATIONS
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
  }
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] }
  }
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] }
  }
};

// ============================================
// ✨ SCALE ANIMATIONS
// ============================================

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.34, 1.56, 0.64, 1] // Spring-like easing
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
  }
};

export const scaleInBounce: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 15
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 }
  }
};

// ============================================
// 🎪 SLIDE ANIMATIONS
// ============================================

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] }
  }
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: {
    opacity: 0,
    x: -100,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] }
  }
};

// ============================================
// 🌀 MODAL & BACKDROP ANIMATIONS
// ============================================

export const backdropVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  visible: {
    opacity: 1,
    backdropFilter: 'blur(12px)',
    transition: { duration: 0.3 }
  },
  exit: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
    transition: { duration: 0.2 }
  }
};

export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 50
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 }
  }
};

// ============================================
// 🎴 CARD ANIMATIONS
// ============================================

export const cardHover = {
  scale: 1.02,
  y: -4,
  boxShadow: '0 20px 60px rgba(0, 229, 255, 0.3)',
  transition: { duration: 0.2 }
};

export const cardTap = {
  scale: 0.98,
  transition: { duration: 0.1 }
};

export const cardDrag = {
  scale: 1.05,
  rotate: 2,
  boxShadow: '0 25px 80px rgba(0, 229, 255, 0.4)',
  transition: { duration: 0.2 }
};

// ============================================
// 📋 STAGGERED LISTS
// ============================================

export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

// ============================================
// 💫 GLOW ANIMATIONS (pour les effets cyber)
// ============================================

export const glowPulse = {
  boxShadow: [
    '0 0 20px rgba(0, 229, 255, 0.3)',
    '0 0 40px rgba(0, 229, 255, 0.6)',
    '0 0 20px rgba(0, 229, 255, 0.3)'
  ],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut'
  }
};

export const shimmer = {
  backgroundPosition: ['200% 0', '-200% 0'],
  transition: {
    duration: 8,
    repeat: Infinity,
    ease: 'linear'
  }
};

// ============================================
// 🎯 NOTIFICATION ANIMATIONS
// ============================================

export const notificationVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 400,
    scale: 0.8
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25
    }
  },
  exit: {
    opacity: 0,
    x: 400,
    scale: 0.9,
    transition: { duration: 0.3 }
  }
};

// ============================================
// 🌊 WAVE LOADER ANIMATION
// ============================================

export const waveVariants = {
  animate: {
    y: [0, -15, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

// ============================================
// 🎬 PAGE TRANSITIONS
// ============================================

export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
      when: 'beforeChildren',
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 1, 1]
    }
  }
};

// ============================================
// 🎨 TIMELINE SPECIFIC ANIMATIONS
// ============================================

export const timelineItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -60,
    scale: 0.9
  },
  visible: (custom: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: custom * 0.1,
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }),
  exit: {
    opacity: 0,
    x: 60,
    scale: 0.9,
    transition: { duration: 0.3 }
  }
};

export const timelineDotPulse = {
  scale: [1, 1.2, 1],
  opacity: [1, 0.8, 1],
  boxShadow: [
    '0 0 0 0 rgba(0, 229, 255, 0.7)',
    '0 0 0 10px rgba(0, 229, 255, 0)',
    '0 0 0 0 rgba(0, 229, 255, 0)'
  ],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut'
  }
};

// ============================================
// 📊 CHART ANIMATIONS
// ============================================

export const chartBarVariants: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: (custom: number) => ({
    scaleY: 1,
    opacity: 1,
    transition: {
      delay: custom * 0.1,
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1]
    }
  })
};

export const counterAnimation = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
};
