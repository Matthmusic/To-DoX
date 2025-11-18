# To DoX

Une application Kanban minimaliste et intelligente pour la gestion de tâches avec indicateurs visuels de priorité et deadlines.

![To DoX Logo](smart-todo/src/assets/To%20DoX%20(500%20x%20250%20px).svg)

## Fonctionnalités

### Gestion de tâches Kanban
- **6 colonnes de statut** : Backlog, À faire, En cours, En revue, Fait, Bloqué
- **Drag & Drop natif** : Déplacez facilement vos tâches entre les colonnes
- **Ajout rapide** : Formulaire intuitif pour créer des tâches avec titre, projet, échéance et priorité

### Indicateurs visuels intelligents
- **Échéances visuelles** : Code couleur dynamique selon l'urgence (J-X, en retard)
- **Badge "À relancer"** : Alerte automatique si une tâche est "En cours" sans mouvement depuis plus de 3 jours
- **Priorités colorées** : Haute (rouge-orange), Moyenne (jaune-ambre), Basse (vert-lime)

### Organisation par projet
- **Statistiques par projet** : Barres de progression avec pourcentage de complétion
- **Liens vers dossiers projets** : Configuration de chemins locaux pour ouvrir rapidement les dossiers de travail
- **Filtrage avancé** : Recherche par titre, projet, notes, avec filtres combinables (projet, priorité, statut)

### Persistance et export
- **Stockage local** : Sauvegarde automatique dans localStorage
- **Export/Import JSON** : Sauvegardez et partagez vos données facilement
- **Aucune dépendance backend** : Fonctionne entièrement en local

## Technologies utilisées

- **React 19** avec hooks modernes
- **Vite** pour le build ultra-rapide
- **TypeScript** pour la sécurité du typage
- **Tailwind CSS** pour un design moderne et responsive
- **Lucide React** pour les icônes
- **localStorage API** pour la persistance
- **Electron** pour l'application desktop multi-plateforme
- **electron-updater** pour les mises à jour automatiques

## Installation

### Téléchargement de l'application (recommandé)

Téléchargez la dernière version de To-DoX directement depuis la [page des releases](https://github.com/Matthmusic/To-DoX/releases) :

- **Windows** : Téléchargez le fichier `.exe` et exécutez l'installateur
- **macOS** : Téléchargez le fichier `.dmg`, montez-le et glissez To-DoX dans Applications
- **Linux** : Téléchargez le fichier `.AppImage` ou `.deb` selon votre distribution

L'application vérifie automatiquement les mises à jour au démarrage et vous notifie quand une nouvelle version est disponible.

### Installation pour développeurs

#### Prérequis
- Node.js 20+
- npm ou yarn

#### Étapes

1. Clonez le dépôt :
```bash
git clone https://github.com/Matthmusic/To-DoX.git
cd To-DoX/smart-todo
```

2. Installez les dépendances :
```bash
npm install
```

3. Lancez l'application en mode développement :

**Version web** :
```bash
npm run dev
# Ouvrez http://localhost:5173 dans votre navigateur
```

**Version Electron** :
```bash
npm run dev:electron
# L'application desktop s'ouvre automatiquement
```

## Scripts disponibles

### Développement
- `npm run dev` : Lance le serveur de développement web avec hot-reload
- `npm run dev:electron` : Lance l'application Electron en mode développement
- `npm run lint` : Vérifie le code avec ESLint

### Production
- `npm run build` : Compile l'application web pour la production
- `npm run build:electron` : Compile l'application Electron (toutes plateformes)
- `npm run electron:build:win` : Build pour Windows et publie sur GitHub
- `npm run electron:build:mac` : Build pour macOS et publie sur GitHub
- `npm run electron:build:linux` : Build pour Linux et publie sur GitHub
- `npm run preview` : Prévisualise la version de production web

## Créer une release

Pour publier une nouvelle version :

1. Mettez à jour la version dans [smart-todo/package.json](smart-todo/package.json)
2. Commitez les changements
3. Créez un tag Git et poussez-le :
```bash
git tag v1.0.0
git push origin v1.0.0
```

Le workflow GitHub Actions se déclenche automatiquement et :
- Build l'application pour Windows, macOS et Linux
- Crée une release GitHub avec les installateurs
- Configure l'auto-update pour les utilisateurs existants

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

## Personnalisation

### Modifier les statuts
Éditez le tableau `STATUSES` dans [smart-todo/src/SmartTodo.jsx:30-36](smart-todo/src/SmartTodo.jsx#L30-L36)

### Modifier les priorités
Éditez le tableau `PRIORITIES` dans [smart-todo/src/SmartTodo.jsx:39-43](smart-todo/src/SmartTodo.jsx#L39-L43)

### Ajuster le délai d'alerte "À relancer"
Modifiez la valeur (en millisecondes) dans [smart-todo/src/SmartTodo.jsx:557](smart-todo/src/SmartTodo.jsx#L557)
```javascript
// Actuellement : 3 jours = 3 * 24 * 60 * 60 * 1000
```

## Structure du projet

```
To-DoX/
├── smart-todo/
│   ├── src/
│   │   ├── assets/           # Images et logos
│   │   ├── App.tsx           # Composant racine
│   │   ├── SmartTodo.jsx     # Composant principal (logique métier)
│   │   ├── main.tsx          # Point d'entrée
│   │   └── index.css         # Styles globaux
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
└── README.md
```

## Limitations connues

- **Liens `file://`** : Selon le navigateur, l'ouverture de liens `file://` peut être restreinte pour des raisons de sécurité. Pour une utilisation optimale :
  - Utilisez un bundler en mode dev local
  - Ou empaquetez l'application avec Electron/Tauri
- **Stockage local** : Les données sont stockées dans le localStorage du navigateur. Pensez à exporter régulièrement vos données importantes.

## Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence libre. Vous êtes libre de l'utiliser, le modifier et le distribuer.

## Auteur

**Matthmusic**
- GitHub: [@Matthmusic](https://github.com/Matthmusic)
- Email: matthieu@maurelfamily.fr

## Roadmap

- [ ] Mode sombre/clair
- [ ] Notifications pour les échéances proches
- [ ] Synchronisation cloud (optionnelle)
- [ ] Application mobile (PWA)
- [ ] Raccourcis clavier
- [ ] Historique des modifications
- [ ] Sous-tâches
- [ ] Pièces jointes

---

Développé avec par Matthmusic | Propulsé par React & Vite
