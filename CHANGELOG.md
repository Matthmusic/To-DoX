# Changelog To-DoX

Toutes les modifications notables sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) — Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [2.1.19] — 2026-03-23 (actuel)

### ✨ Ajouts
- **Vue compacte des TaskCard** : bouton `Eye/EyeOff` à gauche du titre pour réduire une carte à une seule ligne (titre + point priorité + date + indicateurs). État persisté en localStorage (`todox_compact_cards`).
- **Clic droit sur en-tête projet** : mini menu contextuel qui ouvre le QuickAdd avec le projet prérempli.

### 🔧 Améliorations
- **Auto-assignation des réviseurs** : ajouter un réviseur l'affecte automatiquement à la tâche s'il ne l'était pas déjà.
- **Pastilles utilisateurs unifiées** : créateur + assignés dédupliqués (plus de doublon si même personne), réviseurs signalés par un contour violet. Ordre des boutons stabilisé : `[users] [★] [📁] [💬] [⋯]`.

### 🐛 Corrections
- **`convertSubtaskBack` — parent archivé** : la tâche était supprimée silencieusement sans être reconvertie. Fix : reconversion autorisée vers parent archivé avec message informatif.
- **`convertSubtaskBack` — parent supprimé** : même bug destructeur silencieux. Fix : la tâche n'est plus touchée, `alertModal` explicite affiché.

---

## [2.1.9] — 2026-03-11

### ✨ Ajouts
- **Démarrage automatique avec Windows** : toggle dans Paramètres → Notifications pour lancer To-DoX au démarrage de Windows (`app.setLoginItemSettings`).
- **Templates dans sous-tâches** : bouton "Template" dans la liste des sous-tâches pour appliquer un template existant directement à une tâche.
- **Installeur : lancement après installation** : l'application démarre automatiquement à la fin de l'installation NSIS (`runAfterFinish: true`).

### 🔧 Améliorations
- Documentation CLAUDE.md enrichie (review workflow, notifications, mobile, pièges CSS).

---

## [2.1.8] — 2026-03-11

### ✨ Ajouts
- **Archives — projets déroulables** : chevron ›/⌄ sur chaque projet archivé pour voir la liste de ses tâches. Bouton "Désarchiver" individuel par tâche en plus du désarchivage global.
- **Raccourci Ctrl+N corrigé** : ouvre maintenant le panneau QuickAdd et le focus (était appliqué sur un élément caché).
- **Aide raccourcis mise à jour** : icône dans le titre, descriptions précises pour tous les raccourcis.

### 🔧 Améliorations
- `ProjectArchivePanel` : affichage des tâches avec statut (barré si terminé) et date d'archivage.

---

## [2.1.6] — 2026-03-xx

### ✨ Ajouts
- **Unification visuelle GlassModal** : tous les panneaux de paramètres (Thèmes, Notifications, Templates, Utilisateurs, Stockage, Dossiers, Projets) migrent vers `GlassModal` avec animations Framer Motion, shimmer, glow et header sticky.
- **Icône + titre gradient** dans chaque panneau de paramètres.
- **Fermeture automatique** de la dropdown Paramètres à l'ouverture d'une modale (propagation du clic).
- **Bouton Fermer** ajouté en bas du panneau Thèmes.
- **Stories Storybook** pour tous les panneaux de paramètres (avec données et état vide).

### 🔧 Améliorations
- Ordre du menu Paramètres : Thèmes → Notifications → Templates → Utilisateurs → Stockage.
- Section "Rapport CR" retirée du menu (doublon avec le bouton header).
- `GlassModal` : `title` passe de `string` à `React.ReactNode` (permet d'intégrer des icônes).

---

## [2.1.5] — 2026-03-xx

### 🐛 Corrections
- Corrections de stabilité diverses.

---

## [2.1.3 – 2.1.4] — 2026-03-xx

### 🐛 Corrections
- Corrections de bugs mineurs.
- Fix TypeScript : `Subtask.done` → `Subtask.completed` (erreur build dans `TermineesView`).

---

## [2.1.1 – 2.1.2] — 2026-03-xx

### 🐛 Corrections
- Corrections post-release v2.1.0.

---

## [2.1.0] — 2026-02-28

### ✨ Ajouts
- **Review workflow complet**
  - Nouvelle colonne **Review** dans le Kanban (todo → doing → review → done).
  - Boutons **Valider** / **Demander corrections** sur les `TaskCard` en review.
  - Champ **Réviseurs** dans `TaskEditPanel` avec avatars.
  - Action **Rouvrir** pour remettre une tâche terminée en révision.
  - Historique des révisions affiché dans le panneau d'édition.
- **Vue "Terminées" séparée**
  - Toggle dans le header pour basculer entre Kanban et vue Terminées.
  - Actions Rouvrir / Archiver directement dans cette vue.
- **Notifications in-app (AppNotifications)**
  - Cloche dans la `TitleBar` avec badge compteur non-lus.
  - Dropdown des notifications avec marquage lu/non-lu.
  - Clic sur une notification → ouvre la tâche via événement custom `todox:openTask`.
  - Persistées dans `localStorage` + `data.json`.
- **Responsive mobile**
  - Onglets mobiles sous le header pour naviguer entre les colonnes Kanban.
  - Colonne active unique sur mobile (breakpoint `md:` 768px).
  - Burger menu `☰/✕` avec les actions header condensées.
  - `TimelineView` : vue liste sur mobile, Gantt sur desktop.

---

## [2.0.9] — 2026-02-20

### ✨ Ajouts
- **Drag & drop manuel Kanban** : réordonnancement des tâches dans les colonnes. Indicateur visuel (ligne bleue). Champ `order` sur `Task`.
- **Récurrence des tâches** : `daily` / `weekly` / `monthly`. Clone automatique à la complétion. Champ `endsAt` optionnel.
- **Comptes-rendus mensuels** : 5 périodes de CR (semaine en cours/précédente, 2 semaines, mois en cours/précédent). Auto-sauvegarde dans le store. Historique des CRs consultable.
- **Templates de sous-tâches** : bouton "Enregistrer comme template" dans `TaskEditPanel`. Dropdown templates dans `QuickAdd`. Suppression directe depuis le dropdown.
- **Dashboard KPIs** : vue dédiée avec 5 cartes KPI, graphiques par statut/priorité/projet/utilisateur, tendance 4 semaines.

---

## [2.0.7 – 2.0.8] — 2026-02-18

### ✨ Ajouts
- **Vue Timeline/Gantt** : affichage 4 semaines/mois, navigation libre, tooltip au clic (ouvre `TaskEditPanel`), multi-utilisateurs par jour, filtrage par projet.
- **Commentaires sur les tâches** : fil de commentaires avec mentions `@user`. Notifications aux mentionnés. Soft-delete.
- **Système de thèmes** : hook `useTheme`, variables CSS dynamiques, plusieurs thèmes dark préconfigurés.
- **Storybook** : ~60 stories sur les composants UI principaux.
- **Build CI multi-plateforme** : GitHub Actions matrix Windows (NSIS) + macOS (DMG/ZIP x64/arm64) + Linux (AppImage/DEB).

---

## [2.0.1 – 2.0.6] — 2026-02-12 à 2026-02-17

### ✨ Ajouts
- **Raccourcis clavier globaux** : `Ctrl+N`, `Ctrl+F`, `Ctrl+E`, `Escape`, `Ctrl+Shift+A`, `Ctrl+Shift+P`, `F1`. Hook `useKeyboardShortcuts`, contexte `ShortcutsContext`, panneau d'aide `ShortcutsHelpPanel`.
- **Notifications desktop natives** : groupées par catégorie (échéances, tâches stagnantes). Mode "Ne pas déranger". Son optionnel (6 sons). Cache 24h.
- **Liens de fichiers intelligents** : détection auto des chemins Windows/macOS. Badge bleu cliquable. Support chemins avec espaces.
- **Error Boundaries React** : sur `KanbanBoard` et Modaux. Écran d'erreur friendly. Log dans `userData/logs/errors.log`. Bouton "Signaler" → GitHub issue pré-rempli.
- **Animations Framer Motion** : slide-in `TaskCard`, collapse/expand `ProjectCard`, fade+scale modaux, slide `UpdateNotification`.
- **Changelog dans `UpdateNotification`** : parser Markdown, expand/collapse "Notes de version".

---

## [2.0.0] — 2026-02-07

### ✨ Ajouts
- Restructuration complète du projet.
- **Synchronisation multi-utilisateurs** fiable via fichier partagé réseau (Z:\).
- **Sélecteur d'utilisateur** à la connexion.
- Interface principale entièrement repensée (KanbanHeaderPremium, TitleBar custom, design glassmorphism).

---

## Légende

| Symbole | Signification |
|---------|--------------|
| ✨ | Nouvelle fonctionnalité |
| 🔧 | Amélioration |
| 🐛 | Correction de bug |
| ⚠️ | Dépréciation |
| 🔥 | Suppression |
