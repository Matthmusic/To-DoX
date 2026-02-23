# 🗺️ Roadmap To-DoX

Document de suivi des améliorations et évolutions de l'application To-DoX.

**Dernière mise à jour :** 20 février 2026
**Version actuelle :** 2.0.8

---

## 📊 Vue d'ensemble

| Catégorie | Total | Terminé |
|-----------|-------|---------|
| 🎯 Prioritaires | 3 | 3 |
| 🚀 Techniques | 2 | 2 |
| 🌟 UX/Polish | 3 | 3 |
| 🔧 Quick Wins | 2 | 2 |
| ✨ v2.0.8 — Roadmap II | 5 | 5 |
| **TOTAL** | **15** | **15** |

**Légende :**
- ✅ TERMINÉ
- 🔥 Priorité Haute
- ⭐ Priorité Moyenne
- 💡 Priorité Basse

---

## ✨ v2.0.8 — Roadmap II (20 février 2026)

### F. Drag & drop manuel Kanban 🖱️
**Statut :** ✅ TERMINÉ (20 février 2026)
**Priorité :** 🔥 Haute
**Impact :** ⭐⭐⭐⭐⭐

**Description :**
Réordonnancement manuel des tâches dans les colonnes Kanban par drag & drop.
Les favoris restent épinglés en haut de colonne (sort: favori DESC → order ASC → deadline).

**Fonctionnalités :**
- ✅ Indicateur visuel (ligne bleue) au-dessus/en-dessous de la cible pendant le drag
- ✅ Champ `order` sur la tâche (multiple de 1000, réassignation propre à chaque drop)
- ✅ Drop sur colonne = changement de statut ; drop sur tâche = réordonnancement
- ✅ Logique groupe : on trie les tâches du même projet+statut pour insérer au bon endroit

**Fichiers modifiés :**
- `src/types.ts` : `order?: number` sur `Task`
- `src/store/useStore.ts` : action `reorderTask(draggedId, targetId, position)`
- `src/hooks/useDragAndDrop.ts` : réécriture complète avec `DropIndicator`, `handleDragOverTask`, `handleDropOnTask`, `handleDragLeaveTask`
- `src/hooks/useFilters.ts` : tri favori DESC → order ASC → businessDayDelta
- `src/components/TaskCard.tsx` : rendu des indicateurs de drop (lignes bleues)
- `src/components/ProjectCard.tsx`, `KanbanBoard.tsx`, `ToDoX.tsx` : passage des props

---

### C. Récurrence des tâches 🔄
**Statut :** ✅ TERMINÉ (20 février 2026)
**Priorité :** ⭐ Moyenne
**Impact :** ⭐⭐⭐⭐

**Description :**
Quand une tâche récurrente est passée en "Terminé", une nouvelle occurrence est automatiquement créée avec la prochaine échéance calculée.

**Types de récurrence :**
- ✅ Quotidien (`daily`) : +1 jour
- ✅ Hebdomadaire (`weekly`) : +7 jours
- ✅ Mensuel (`monthly`) : +1 mois calendaire

**Fonctionnalités :**
- ✅ Sélecteur UI dans TaskEditPanel (4 boutons : Aucune / Quotidien / Hebdo / Mensuel)
- ✅ Clone automatique : statut = `todo`, sous-tâches réinitialisées, `order: 0`
- ✅ Champ `endsAt` optionnel pour arrêter la récurrence à une date

**Fichiers modifiés :**
- `src/types.ts` : `RecurrenceType`, `Recurrence`, `recurrence?: Recurrence` sur `Task`
- `src/store/useStore.ts` : logique de clone dans `updateTask` (quand status → `done`)
- `src/utils/taskMigration.ts` : `normalizeRecurrence`
- `src/components/TaskEditPanel.tsx` : sélecteur récurrence UI

---

### J. Compte-rendus mensuels + historique 📄
**Statut :** ✅ TERMINÉ (20 février 2026)
**Priorité :** ⭐ Moyenne
**Impact :** ⭐⭐⭐⭐

**Description :**
La modale de CR (anciennement "hebdomadaire") supporte désormais les CRs mensuels et sauvegarde automatiquement chaque CR généré dans l'app pour archivage.

**Fonctionnalités :**
- ✅ 5 périodes de CR : Semaine en cours, Semaine précédente, 2 semaines, **Mois en cours**, **Mois précédent**
- ✅ Auto-sauvegarde dans le store à chaque export PDF
- ✅ Historique des CRs avec titre, date, période et nombre de tâches
- ✅ Bouton "Voir" pour recharger un CR sauvegardé, bouton "Supprimer"
- ✅ Header renommé "Compte Rendu" (généraliste)

**Fichiers modifiés :**
- `src/types.ts` : `SavedReport`, `StoredData.savedReports`
- `src/store/useStore.ts` : `savedReports`, `saveReport`, `deleteReport`, `setSavedReports`
- `src/utils.ts` : `getCurrentMonthRange()`, `getPreviousMonthRange()`
- `src/components/WeeklyReportModal.tsx` : support mensuel + historique
- `src/hooks/useDataPersistence.ts` : persistence `savedReports`

---

### I. Templates de tâches 📋
**Statut :** ✅ TERMINÉ (20 février 2026)
**Priorité :** ⭐ Moyenne
**Impact :** ⭐⭐⭐

**Description :**
Système de templates réutilisables : sauvegarder une tâche comme template depuis le panneau d'édition, puis l'utiliser depuis QuickAdd.

**Fonctionnalités :**
- ✅ Bouton "Enregistrer comme template" dans TaskEditPanel (icône BookmarkPlus violet)
- ✅ Dropdown templates dans QuickAdd (icône LayoutTemplate, visible seulement si templates existent)
- ✅ Clic sur un template → création immédiate de la tâche + ses sous-tâches
- ✅ Bouton × pour supprimer un template directement depuis le dropdown

**Fichiers modifiés :**
- `src/types.ts` : `TaskTemplate`, `StoredData.templates`
- `src/store/useStore.ts` : `templates`, `addTemplate`, `deleteTemplate`, `createTaskFromTemplate`, `setTemplates`
- `src/components/TaskEditPanel.tsx` : bouton "Enregistrer comme template"
- `src/components/QuickAddPremium.tsx` : dropdown templates
- `src/hooks/useDataPersistence.ts` : persistence `templates`

---

### E. Dashboard KPIs 📊
**Statut :** ✅ TERMINÉ (20 février 2026)
**Priorité :** ⭐ Moyenne
**Impact :** ⭐⭐⭐⭐

**Description :**
Vue Dashboard accessible depuis le toggle de vue (Kanban / Timeline / Dashboard).
Affiche des KPIs et graphiques CSS-based pour visualiser l'état des tâches.

**Blocs affichés :**
- ✅ **5 cartes KPI** : Total actives, En cours (doing+review), Terminées cette semaine, En retard, Favoris actifs
- ✅ **Par statut** : barres de progression par statut (todo/doing/review/done)
- ✅ **Par priorité** : distribution haute/moyenne/basse des tâches non terminées
- ✅ **Tendance 4 semaines** : graphique en barres des tâches terminées par semaine
- ✅ **Par projet** : barres de complétion par projet (top 8), couleurs cohérentes avec le Kanban
- ✅ **Par utilisateur** : distribution et taux de complétion par assigné

**Fichiers créés :**
- `src/components/DashboardView.tsx` : composant principal

**Fichiers modifiés :**
- `src/components/KanbanHeaderPremium.tsx` : ajout bouton Dashboard + type `'dashboard'`
- `src/components/index.ts` : export `DashboardView`
- `src/ToDoX.tsx` : rendu conditionnel + type étendu

---

## 🎯 Améliorations Prioritaires (v2.0.1 – v2.0.7)

### 1. Raccourcis clavier globaux ⌨️
**Statut :** ✅ TERMINÉ (11 février 2026)

Système complet de raccourcis clavier : `Ctrl+N`, `Ctrl+F`, `Ctrl+E`, `Escape`, `Ctrl+Shift+A`, `Ctrl+Shift+P`, `F1`.
Panneau d'aide `ShortcutsHelpPanel`, contexte `ShortcutsContext`, hook `useKeyboardShortcuts`.

---

### 2. Notifications desktop natives 🔔
**Statut :** ✅ TERMINÉ (12 février 2026)

Notifications groupées par catégorie (échéances, tâches stagnantes). Mode "Ne pas déranger" configurable. Son optionnel. Cache 24h.

---

### 3. Vue Timeline/Gantt 📅
**Statut :** ✅ TERMINÉ (17 février 2026)

Vue Gantt avec affichage 4 semaines / mois. Navigation libre. Tooltip détaillé au clic sur les barres (ouvre TaskEditPanel). Multi-utilisateurs par jour. Filtrage par projet.

---

## 🚀 Améliorations Techniques

### 4. Storybook pour UI Components 📚
**Statut :** ✅ TERMINÉ (17 février 2026)

21 fichiers stories (~60 stories). Mock `window.electronAPI`, seed Zustand, Tailwind actif.
`npm run storybook` (port 6006) / `npm run build-storybook`.

---

### 6. Error Boundaries React 🛡️
**Statut :** ✅ TERMINÉ (12 février 2026)

Boundaries sur KanbanBoard + Modaux. Écran d'erreur friendly. Logging dans `userData/logs/errors.log`. Bouton "Signaler le bug" → GitHub issue pré-rempli.

---

## 🌟 Améliorations UX/Polish

### 7. Animations Framer Motion ✨
**Statut :** ✅ TERMINÉ (12 février 2026)

Slide-in TaskCard (200ms), collapse/expand ProjectCard (300ms), fade+scale modaux (200ms), slide UpdateNotification (300ms).

---

### 8. Commentaires sur les tâches 💬
**Statut :** ✅ TERMINÉ (17 février 2026)

Fil de commentaires par tâche avec mentions `@user`. Notifications aux mentionnés à leur connexion. Soft-delete. Panneau dans TaskEditPanel.

---

### 10. Liens de fichiers intelligents 📎
**Statut :** ✅ TERMINÉ (12 février 2026)

Détection automatique des chemins (regex avancée). Badge bleu cliquable. Support chemins avec espaces. Édition rapide des notes (Ctrl+Enter / Escape).

---

## 🔧 Quick Wins

### 11. Changelog dans UpdateNotification 📝
**Statut :** ✅ TERMINÉ (12 février 2026)

Parser Markdown custom. Bouton expand/collapse "Voir les notes de version". Lien GitHub releases.

---

### 13. Build multi-plateforme CI 🌍
**Statut :** ✅ TERMINÉ (17 février 2026)

Workflow GitHub Actions matrix : Windows (NSIS x64) + macOS (DMG+ZIP x64/arm64) + Linux (AppImage+DEB x64). `fail-fast: false`.

---

## 📝 Versions

| Version | Date | Contenu |
|---------|------|---------|
| v2.0.1 | 12 fév 2026 | Raccourcis clavier, Notifications, Liens fichiers, Error Boundaries, Changelog, Animations |
| v2.0.2 | 15 fév 2026 | Améliorations diverses |
| v2.0.3 | 17 fév 2026 | Storybook, Timeline/Gantt, Build CI multi-plateforme |
| v2.0.7 | 18 fév 2026 | Commentaires tâches, Thèmes, Corbeille tâches |
| v2.0.8 | 20 fév 2026 | Drag & drop manuel, Récurrence, CR mensuel, Templates, Dashboard KPIs |

---

**Bon développement ! 🚀**
