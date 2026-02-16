# To-DoX

Une application Kanban minimaliste et intelligente pour la gestion de tâches avec indicateurs visuels de priorité et deadlines.

![To-DoX Logo](src/assets/To%20Do%20X.svg)

## 🚀 Téléchargement

[![Download Latest Release](https://img.shields.io/github/v/release/Matthmusic/To-DoX?label=Télécharger&style=for-the-badge&logo=github)](https://github.com/Matthmusic/To-DoX/releases/latest)

**Version actuelle : 2.0.2**

Téléchargez simplement le fichier `.exe` depuis la [page des releases](https://github.com/Matthmusic/To-DoX/releases/latest) et lancez-le !

- ✅ Mises à jour automatiques intégrées
- ✅ Interface moderne et fluide
- ✅ Aucune installation complexe requise

## ✨ Fonctionnalités

### 📋 Gestion de tâches Kanban
- **4 colonnes de statut** : À faire, En cours, À réviser, Fait
- **Drag & Drop natif** : Déplacez facilement vos tâches entre les colonnes
- **Ajout rapide** : Formulaire intuitif pour créer des tâches avec titre, projet, échéance et priorité

### 🎯 Indicateurs visuels intelligents
- **Échéances visuelles** : Code couleur dynamique selon l'urgence (J-X, en retard)
- **Badge "⚠ À relancer"** : Alerte automatique si une tâche est "En cours" sans mouvement depuis plus de 3 jours
- **Priorités colorées** : Haute (rouge-orange), Moyenne (jaune-ambre), Basse (vert-lime)

### 📁 Organisation par projet
- **Statistiques par projet** : Barres de progression avec pourcentage de complétion
- **Liens vers dossiers projets** : Configuration de chemins locaux pour ouvrir rapidement les dossiers de travail via Electron
- **Filtrage avancé** : Recherche par titre, projet, notes, avec filtres combinables (projet, priorité, statut)

### 🔔 Notifications intelligentes ✨ **Nouveau dans v2.0.2**
- **Filtrage par utilisateur** : Recevez uniquement les notifications pour vos tâches assignées
- **Alertes deadlines** : Notifications automatiques pour les tâches qui approchent de leur échéance
- **Alertes tâches stagnantes** : Avertissement si une tâche "En cours" n'a pas bougé depuis 3 jours
- **Sons personnalisables** : Choisissez parmi 6 sons de notification différents
  - 💧 Goutte d'eau | 🎵 Accord musical | ✨ Pop-up | 🔔 Classique | 😮 Gasp UI | 📱 Message
- **Heures silencieuses** : Configurez des plages horaires sans notifications
- **Aperçu audio** : Testez les sons avant de choisir

### 🎨 Thèmes et personnalisation ✨ **Nouveau dans v2.0.2**
- **14 thèmes préinstallés** : Du minimaliste au cyberpunk
- **TitleBar thématique** : La barre de titre suit les couleurs du thème actif
- **Mode clair/sombre** : Basculez entre les modes selon vos préférences
- **Personnalisation complète** : Couleurs, bordures, opacités

### 💾 Persistance et export
- **Stockage local** : Sauvegarde automatique dans localStorage
- **Export/Import JSON** : Sauvegardez et partagez vos données facilement
- **Aucune dépendance backend** : Fonctionne entièrement en local

### 💻 Interface moderne
- **Barre de titre personnalisée** : Design cohérent avec contrôles Windows intégrés
- **Design fluide** : Animations et transitions soignées
- **Responsive** : S'adapte à toutes les tailles d'écran
- **Performance optimisée** : Compilation React et optimisations Vite

## 🛠️ Technologies utilisées

### Frontend
- ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white) - Hooks modernes et React Compiler
- ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white) - Sécurité du typage
- ![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white) - Build ultra-rapide
- ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white) - Design moderne et responsive

### Desktop
- ![Electron](https://img.shields.io/badge/Electron-39-47848F?style=flat&logo=electron&logoColor=white) - Application desktop multi-plateforme
- **electron-builder** - Packaging et distribution
- **electron-updater** - Mises à jour automatiques

### DevOps
- **GitHub Actions** - CI/CD automatisé
- **NSIS** - Installateur Windows personnalisé

## 💻 Installation

### Pour les utilisateurs

**C'est simple !** Téléchargez le fichier `.exe` depuis la [page des releases](https://github.com/Matthmusic/To-DoX/releases/latest) et lancez-le.

- **Windows** : Double-cliquez sur le `.exe` téléchargé
- **macOS** : Téléchargez le `.dmg`, montez-le et glissez To-DoX dans Applications
- **Linux** : Téléchargez le `.AppImage` ou `.deb` selon votre distribution

L'application vérifie automatiquement les mises à jour au démarrage et vous notifie quand une nouvelle version est disponible.

## Utilisation

### Créer une tâche
1. Remplissez le formulaire "Ajout rapide" avec :
   - Titre de la tâche
   - Code projet (ex: ACME-2025-001)
   - Date d'échéance
   - Priorité (Basse, Moyenne, Haute)
2. Cliquez sur "Ajouter"

### Déplacer une tâche
- **Par drag & drop** : Glissez-déposez la carte dans une autre colonne
- **Par le menu** : Cliquez sur ⋯ et changez le statut

### Modifier une tâche
1. Cliquez sur le bouton ⋯ sur la carte
2. Modifiez les champs (titre, projet, échéance, priorité, notes)
3. Les changements sont automatiquement sauvegardés

### Configurer les dossiers projets
1. Cliquez sur "Dossiers projets"
2. Saisissez le chemin local pour chaque projet :
   - Windows : `C:\Projets\MonProjet`
   - macOS/Linux : `/Users/toi/Projets/MonProjet`
3. Cliquez sur "Enregistrer"
4. Un bouton "Ouvrir dossier" apparaîtra sur les tâches concernées

### Filtrer les tâches
- Utilisez la barre de recherche pour chercher dans les titres, projets et notes
- Sélectionnez un projet spécifique dans le menu déroulant
- Filtrez par priorité ou statut
- Cliquez sur "Réinitialiser filtres" pour tout effacer

### Exporter/Importer
- **Export** : Cliquez sur "Export JSON" pour télécharger vos données
- **Import** : Cliquez sur "Import JSON" et sélectionnez un fichier JSON précédemment exporté

### Mises à jour automatiques (version desktop)

L'application Electron vérifie automatiquement les mises à jour au démarrage :
- Une notification apparaît quand une nouvelle version est disponible
- Vous pouvez télécharger et installer la mise à jour en un clic
- L'installation se fait au redémarrage de l'application
- Le système utilise GitHub Releases de manière sécurisée

## 📂 Structure du projet

```
To-DoX/
├── src/
│   ├── assets/           # Images et logos
│   ├── components/       # Composants React réutilisables
│   ├── hooks/            # Hooks personnalisés (useFilters, useDragAndDrop, etc.)
│   ├── store/            # Store Zustand centralisé
│   ├── ToDoX.tsx         # Composant principal
│   └── types.ts          # Définitions TypeScript
├── docs/                 # 📚 Documentation complète
│   ├── deployment/       # Guides de déploiement et releases
│   ├── setup/            # Configuration initiale
│   ├── migration/        # Guides de migration backend
│   └── archive/          # Historique des refactorings
├── electron.js           # Application Electron
├── preload.js            # Preload script (sécurité)
├── package.json          # Configuration et dépendances
├── README.md             # Ce fichier
└── CLAUDE.md             # Documentation développeur complète
```

## 👨‍💻 Documentation développeur

Vous êtes développeur et souhaitez contribuer au projet ? Consultez la documentation complète :

### Documentation principale
- **[CLAUDE.md](CLAUDE.md)** - Guide complet du développeur (architecture, patterns, hooks, store Zustand)
- **[docs/](docs/)** - Documentation organisée par thème

### Guides spécifiques
- **[Déploiement](docs/deployment/)** - Comment déployer une nouvelle version
- **[Setup](docs/setup/)** - Configuration Electron et multi-utilisateurs
- **[Migration](docs/migration/)** - Guides de migration backend (PostgreSQL, JSON)

### Commandes de développement

```bash
# Mode développement (web uniquement)
npm run dev

# Mode développement Electron
npm run dev:electron

# Build production
npm run build

# Build et package Electron
npm run build:electron

# Tests
npm run test

# Linter
npm run lint
```

## ⚠️ Limitations connues

- **Stockage local** : Les données sont stockées localement. Pensez à exporter régulièrement vos données importantes via "Export JSON"
- **Multi-utilisateurs** : Pour utilisation multi-utilisateurs, consultez [docs/setup/MULTI_USER_SETUP.md](docs/setup/MULTI_USER_SETUP.md)

## Licence

Ce projet est sous licence libre. Vous êtes libre de l'utiliser, le modifier et le distribuer.

## Auteur

**Matthmusic**
- GitHub: [@Matthmusic](https://github.com/Matthmusic)
- Email: matthieu@maurelfamily.fr

---

Développé avec ❤️ par Matthmusic | Propulsé par React, Electron & Vite
