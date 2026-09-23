/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  base: './', // Important pour Electron
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Sépare les libs tierces stables (rarement modifiées) du code applicatif
        // (modifié à chaque release). L'app est distribuée via auto-updater Electron
        // avec des releases fréquentes -- sans ce découpage, chaque mise à jour force
        // un re-téléchargement complet des ~1 Mo de vendor code qui n'a pourtant pas
        // changé. Ne réduit pas le poids du premier chargement (ce code est
        // nécessaire dès l'affichage du Kanban, la vue par défaut) ; améliore le cache
        // sur les mises à jour suivantes.
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Les worktrees Claude Code (.claude/worktrees/**) contiennent une copie
    // complète du repo — sans cette exclusion, vitest fait tourner chaque
    // test en double (et lint hérite du même souci, voir eslint.config.mjs).
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
})
