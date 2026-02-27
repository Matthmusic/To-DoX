# To-DoX

Une application Kanban intelligente et moderne pour la gestion de tâches, avec indicateurs visuels de priorité, deadlines, workflow de révision et support mobile complet.

![To-DoX Logo](src/assets/To%20Do%20X.svg)

## 🚀 Téléchargement

[![Download Latest Release](https://img.shields.io/github/v/release/Matthmusic/To-DoX?label=Télécharger&style=for-the-badge&logo=github)](https://github.com/Matthmusic/To-DoX/releases/latest)

**Version actuelle : 2.1.0**

Téléchargez simplement le fichier `.exe` depuis la [page des releases](https://github.com/Matthmusic/To-DoX/releases/latest) et lancez-le !

- ✅ Mises à jour automatiques intégrées
- ✅ Interface moderne et fluide
- ✅ Support mobile-first (≥ 375px)
- ✅ Aucune installation complexe requise

## ✨ Fonctionnalités

### 📋 Gestion de tâches Kanban
- **4 colonnes de statut** : À faire, En cours, À réviser, Fait
- **Drag & Drop natif** : Déplacez facilement vos tâches entre les colonnes
- **Ajout rapide** : Formulaire intuitif avec auto-détection `#projet` et `@utilisateur`
- **Tâches récurrentes** : Répétition quotidienne, hebdomadaire, mensuelle
- **Sous-tâches** : Décomposez vos tâches en étapes

### ✅ Vue "Terminées" ✨ **Nouveau dans v2.1.0**
- **Vue dédiée** aux tâches avec statut "Fait"
- **Tri et filtres** : par projet, priorité, date de complétion
- **Historique complet** avec indicateurs visuels de délai

### 📱 Interface responsive mobile-first ✨ **Nouveau dans v2.1.0**
- **Support complet ≥ 375px** — fonctionne sur smartphone et tablette
- **Barre mobile compacte** avec accès rapide aux vues et actions
- **Burger menu** : toutes les actions accessibles en un tap
- **Kanban tabulé** sur mobile : une colonne à la fois avec navigation par onglets
- **Modales adaptées** : GlassModal, TaskEditPanel et panneaux s'adaptent à l'écran

### 🔍 Workflow de révision
- **Demande de révision** : assignez une tâche en `review` à un collègue
- **Validation / Rejet** : le reviewer accepte ou renvoie en `doing`
- **Notifications in-app** : badge en temps réel sur la cloche de notifications
- **Stale review alert** : alerte si la révision n'a pas bougé depuis plus de 2 jours

### 🔔 Notifications intelligentes
- **Dropdown centré** dans la barre de titre Electron
- **Filtrage par utilisateur** : uniquement vos tâches assignées
- **Alertes deadlines** : notifications pour les échéances proches
- **Alertes tâches stagnantes** : avertissement si une tâche "En cours" stagne depuis 3 jours
- **Sons personnalisables** : 6 sons de notification différents
  - 💧 Goutte d'eau | 🎵 Accord musical | ✨ Pop-up | 🔔 Classique | 😮 Gasp UI | 📱 Message
- **Heures silencieuses** : plages horaires sans notifications

### 🎯 Indicateurs visuels intelligents
- **Échéances visuelles** : code couleur dynamique selon l'urgence (J-X, en retard)
- **Badge "⚠ À relancer"** : alerte automatique si une tâche est "En cours" sans mouvement depuis plus de 3 jours
- **Priorités colorées** : Haute (rouge-orange), Moyenne (jaune-ambre), Basse (vert-lime)
- **Badges de progression circulaires** : pourcentage de complétion par projet

### 📁 Organisation par projet
- **Badges circulaires** de progression dans le header, avec défilement horizontal
- **Filtrage par projet** : cliquez sur un badge pour filtrer les tâches
- **Liens vers dossiers projets** : ouvrez vos dossiers de travail directement depuis l'app
- **Couleurs de projet** : personnalisez la couleur de chaque projet

### 🎨 Thèmes et personnalisation
- **14 thèmes préinstallés** : du minimaliste au cyberpunk
- **TitleBar thématique** : la barre de titre suit les couleurs du thème actif
- **Animations glow** : effets lumineux adaptatifs selon le thème
- **"Floating Command Bar"** : header premium avec design glassmorphism

### 💾 Persistance et synchronisation
- **Dual-mode** : localStorage (web) ou fichier JSON (Electron — `~/OneDrive/DATA/To-Do-X/data.json`)
- **Sauvegarde auto** : debounce 1s + backups automatiques
- **Export/Import JSON** : sauvegardez et partagez vos données
- **Verrouillage fichier** : protection contre les écritures simultanées

### 💻 Interface moderne
- **Barre de titre personnalisée** : drag-to-move, contrôles Windows intégrés
- **Header "Command Bar"** : logo animé, badges de projets, accès rapide
- **Animations Framer Motion** : transitions fluides
- **Storybook** : bibliothèque de composants documentée

## 🛠️ Technologies utilisées

### Frontend
- ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white) — Hooks modernes et React Compiler
- ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white) — Sécurité du typage
- ![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white) — Build ultra-rapide
- ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white) — Design moderne et responsive
- ![Zustand](https://img.shields.io/badge/Zustand-5-FF6B35?style=flat) — State management léger
- ![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-EE4B96?style=flat) — Animations fluides

### Desktop
- ![Electron](https://img.shields.io/badge/Electron-32-47848F?style=flat&logo=electron&logoColor=white) — Application desktop multi-plateforme
- **electron-builder** — Packaging et distribution
- **electron-updater** — Mises à jour automatiques

### DevOps
- **GitHub Actions** — CI/CD automatisé
- **NSIS** — Installateur Windows personnalisé
- **Storybook** — Développement et documentation des composants

## 💻 Installation

### Pour les utilisateurs

**C'est simple !** Téléchargez le fichier `.exe` depuis la [page des releases](https://github.com/Matthmusic/To-DoX/releases/latest) et lancez-le.

- **Windows** : Double-cliquez sur le `.exe` téléchargé
- **macOS** : Téléchargez le `.dmg`, montez-le et glissez To-DoX dans Applications
- **Linux** : Téléchargez le `.AppImage` ou `.deb` selon votre distribution

L'application vérifie automatiquement les mises à jour au démarrage et vous notifie quand une nouvelle version est disponible.

## 📂 Structure du projet

```
To-DoX/
├── src/
│   ├── assets/           # Images et logos
│   ├── components/       # Composants React réutilisables
│   │   ├── settings/     # Panneaux de configuration
│   │   ├── ui/           # Composants UI génériques (GlassModal…)
│   │   └── archive/      # Panneaux d'archives
│   ├── hooks/            # Hooks personnalisés (useFilters, useDragAndDrop…)
│   ├── store/            # Store Zustand centralisé
│   ├── stories/          # Stories Storybook
│   ├── ToDoX.tsx         # Composant principal
│   └── types.ts          # Définitions TypeScript
├── docs/                 # Documentation complète
├── cast-service.js       # Service Chromecast/Google Home (infrastructure)
├── electron.js           # Application Electron
├── preload.js            # Preload script (sécurité)
├── package.json          # Configuration et dépendances
└── CLAUDE.md             # Documentation développeur complète
```

## 👨‍💻 Développement

```bash
# Mode développement (web uniquement)
npm run dev

# Mode développement Electron
npm run dev:electron

# Build production
npm run build

# Storybook
npm run storybook

# Tests
npm run test -- --run

# Release locale Windows
npm run electron:build:win
```

Consultez [CLAUDE.md](CLAUDE.md) pour l'architecture complète et les patterns de développement.

## ⚠️ Limitations connues

- **Stockage local** : données stockées localement. Exportez régulièrement via "Export JSON"
- **Multi-utilisateurs** : pour utilisation partagée, configurez un dossier OneDrive commun via "Stockage"

## Licence

Ce projet est sous licence libre. Vous êtes libre de l'utiliser, le modifier et le distribuer.

## Auteur

**Matthmusic**
- GitHub: [@Matthmusic](https://github.com/Matthmusic)
- Email: matthieu@maurelfamily.fr

---

Développé avec ❤️ par Matthmusic | Propulsé par React, Electron & Vite
