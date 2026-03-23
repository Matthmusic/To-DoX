# Pistes d'amélioration — To-DoX

**Analyse réalisée le :** 17 mars 2026
**Dernière mise à jour :** 23 mars 2026
**Version analysée :** 2.1.18
**Couverture :** architecture, composants, hooks, store, tests, performance

---

## Résumé rapide

| Aspect | Score | Notes |
|---|---|---|
| Type safety | ✅ 9/10 | TypeScript strict, pas de `any`, unions discriminés |
| Architecture store | 🟡 6/10 | 65+ actions, effets de bord dans `updateTask` |
| Taille des composants | ❌ 4/10 | 6 composants > 400 lignes, `TimelineView` à 1638 |
| Qualité des hooks | 🟡 6/10 | `useDataPersistence` est un God Hook (466 lignes) |
| Couverture de tests | ❌ 2/10 | ~5% de couverture, chemins critiques non testés |
| Gestion des erreurs | 🟡 5/10 | Inconsistante, pas de recovery |
| Performance | 🟡 5/10 | Polling 2s, sérialisation complète à chaque changement |
| Responsive | ✅ 8/10 | Mobile-first, breakpoints clairs |

---

## Implémenté depuis l'analyse initiale

### ✅ Clic droit sur en-tête projet → nouvelle tâche
Mini menu contextuel (portal) au curseur sur l'en-tête de `ProjectCard`. Ouvre le QuickAdd avec le projet prérempli via `triggerOpenWithProject` prop sur `KanbanHeaderPremium` + méthode `prefillProject()` exposée par `QuickAddPremium` via `useImperativeHandle`.

### ✅ Auto-assignation des réviseurs
`setReviewers()` dans le store auto-ajoute les réviseurs à `assignedTo` s'ils n'y sont pas déjà. Les placeholders `'unassigned'` sont nettoyés proprement.

### ✅ Pastilles utilisateurs unifiées dans TaskCard
- Créateur + assignés dédupliqués : si quelqu'un est les deux, une seule pastille **verte** (plus de doublon bleu)
- Réviseurs : pastille existante (verte/bleue) avec **contour violet**
- Ordre des boutons inversé : `[users] [★] [📁] [💬] [⋯]` — favoris et dossier toujours à position fixe

### ✅ Bug `convertSubtaskBack` corrigé
Deux bugs silencieux corrigés dans `src/store/useStore.ts` :
- Parent **archivé** → la tâche était supprimée sans être reconvertie. Fix : reconversion autorisée vers parent archivé + message info.
- Parent **supprimé/introuvable** → même bug destructeur. Fix : la tâche n'est pas touchée + `alertModal` explicite.
- Type de retour `void` → `'ok' | 'parent_deleted' | 'parent_not_found'` pour feedback UI.

### ✅ Vue compacte des TaskCard
Bouton `Eye/EyeOff` à gauche du titre. En mode compact, tout tient sur une seule ligne : `[👁] [titre tronqué...] [● priorité] [⚠?] [📄?] [2/5?] [J-3] | [⋯]`. État persisté en localStorage sous la clé `todox_compact_cards` (Set d'IDs).

---

## Priorité haute — Dette technique réelle

### 1. Découper `useDataPersistence.ts` (466 lignes, "God Hook")

**Fichier :** `src/hooks/useDataPersistence.ts`

Le hook fait trop de choses dans un seul fichier : chargement initial + migrations, polling 2s sur `data.json`, debounced save avec 3 timers distincts, et merge ad-hoc de 5 types de données différents (tasks, comments, timeEntries, appNotifications, pendingMentions).

**Découpage proposé :**
- `useLoadData` — chargement initial + application des migrations
- `useSyncPolling` — auto-reload quand `data.json` change sur disque
- `usePersistSave` — sauvegarde debounced vers localStorage + fichier Electron

**Problème de performance associé :** le polling s'exécute toutes les 2s et déclenche `JSON.stringify` sur l'intégralité du state même si rien n'a changé. Un hash de contenu (`length + lastModified`) éviterait la sérialisation inutile.

---

### 2. Exploser les composants géants

Le CLAUDE.md fixe la limite à 300 lignes — 6 composants la dépassent largement.

| Composant | Lignes | Découpage suggéré |
|---|---|---|
| `TimelineView.tsx` | 1638 | `GanttCanvas`, `TimelineNav`, `MobileTimeline`, `TimelineToolbar` |
| `WeeklyReportModal.tsx` | 1237 | Extraire logique PDF/chart dans utils |
| `TimesheetView.tsx` | 990 | `TimesheetTable`, `TimesheetRow`, `TimesheetSummary` |
| `TaskCard.tsx` | ~870 | `TaskCardHeader`, `TaskCardFooter`, `UserPopover`, `SubtaskCollapsible` |
| `DashboardView.tsx` | 692 | Extraire calculs de stats dans hooks |
| `KanbanHeaderPremium.tsx` | 664 | Extraire le burger menu mobile en composant dédié |

**Note sur `TaskCard`** : maintenant ~870 lignes après ajouts récents (compact view, unified badges). Un `useReducer` remplacerait avantageusement les 10+ `useState` locaux.

---

### 3. Tests critiques manquants

Couverture actuelle : ~5% (4 fichiers de test). Chemins sans aucun test :

- **Review workflow** : chaîne complète `setReviewers` → auto-assign → `validateTask` / `requestCorrections` → `AppNotification`
- **`convertSubtaskBack`** : les 3 cas (parent actif, archivé, supprimé) — les bugs corrigés méritent des tests de non-régression
- **Récurrence** : logique dans `updateTask()` qui crée une nouvelle tâche à la complétion
- **Persistence** : que se passe-t-il si `data.json` est corrompu ou tronqué ?
- **Merge de données** : logique de `mergeTasksByUpdatedAt()` sur des cas limites
- **Drag & drop** : `reorderTask()` sur des positions edge case (début, fin, seul élément)

---

## Priorité moyenne — Qualité du code

### 4. Trop d'effets de bord dans `updateTask()`

**Fichier :** `src/store/useStore.ts` lignes 248-323

Une seule action fait : mettre à jour `updatedAt`, déclencher les notifs review si `status='review'` et reviewers définis, **et** créer une nouvelle tâche si récurrence active. Ces 3 responsabilités mélangées rendent l'action difficile à tester isolément.

**Suggestion :** extraire la logique de récurrence dans `handleTaskCompletion()`, appelée explicitement depuis `updateTask()` quand `status` passe à `'done'`.

---

### 5. Double système de notifications (pendingMentions + AppNotification)

**Fichier :** `src/store/useStore.ts`, `src/hooks/useDataPersistence.ts`

`addComment()` crée simultanément une entrée dans `pendingMentions` (legacy) ET dans `appNotifications` pour le même événement. `pendingMentions` devrait être retiré si `AppNotification` couvre maintenant tous les cas.

---

### 6. Error boundaries locaux manquants

Il n'y a qu'un `ErrorBoundary` global au niveau `App`. Une erreur dans `TimelineView` ou `WeeklyReportModal` plante toute l'application.

**Composants prioritaires :** `TimelineView`, `WeeklyReportModal`, `TimesheetView`, `DashboardView`, `TaskEditPanel`.

---

### 7. Duplication de palette dans TimelineView

**Fichier :** `src/components/TimelineView.tsx`

`TimelineView` maintient sa propre `PROJECT_PALETTE` locale qui duplique `PROJECT_COLORS` de `constants.ts`. Solution : supprimer `PROJECT_PALETTE` et utiliser `getProjectColor()` depuis `utils.ts`.

---

### 8. Console.log non gardés en production

~31 `console.log/error/warn` dans le codebase non protégés par `import.meta.env.DEV`. Le helper `devLog()` existe dans `utils.ts` mais n'est pas utilisé partout.

**Solution rapide :** activer la règle ESLint `no-console: warn`.

---

## Priorité basse — Améliorations futures

### 9. Virtualisation des longues listes

Si les projets grossissent (100+ tâches), `TimelineView` et `KanbanBoard` seront lents. `@tanstack/react-virtual` règlerait ça proprement.

### 10. IDs typés (branded types)

`taskId`, `userId`, `commentId` sont tous des `string` nus. Un typage nominal (`type TaskId = string & { __brand: 'TaskId' }`) éviterait les confusions accidentelles entre identifiants.

### 11. Gestion des utilisateurs moins rigide

`FIXED_USERS` dans `constants.ts` + emails `@conception-ea.fr` hardcodés = friction si le contexte change. Un écran "Gérer les utilisateurs" dans les Settings rendrait l'app généralisable.

### 12. Détection de corruption de `data.json`

Si le fichier est tronqué ou invalide, la persistence échoue silencieusement. Un hash de validation + bannière d'erreur dans l'UI serait un filet de sécurité utile.

### 13. Clarifier le rôle du backend

`todox-backend/` est présenté comme optionnel mais son rôle est flou si les données restent en localStorage/OneDrive. Soit on l'investit (sync multi-device), soit on le documente comme prototype non maintenu.

---

## Ce qu'il ne faut PAS changer

- **Architecture Zustand avec actions nommées** — c'est le bon pattern pour cette échelle
- **Stack** (React 19 + Vite + Tailwind + TypeScript) — cohérent et moderne
- **Dual-mode persistence** — l'idée est solide, c'est l'implémentation qui peut être affinée
- **Pattern custom events** (`todox:openTask`) — simple et efficace
- **Hooks spécialisés** (`useFilters`, `useDragAndDrop`, `useKeyboardShortcuts`) — bien découpés

---

## Fichiers clés de référence

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/store/useStore.ts` | ~887 | Store centralisé Zustand |
| `src/types.ts` | 406 | Interfaces TypeScript |
| `src/hooks/useDataPersistence.ts` | 466 | Persistence localStorage + Electron |
| `src/components/TimelineView.tsx` | 1638 | Vue Gantt + Timeline |
| `src/components/WeeklyReportModal.tsx` | 1237 | Rapport hebdomadaire PDF |
| `src/components/TimesheetView.tsx` | 990 | Feuilles de temps |
| `src/components/TaskCard.tsx` | ~870 | Carte tâche Kanban |
| `src/components/KanbanHeaderPremium.tsx` | 664 | Header principal |
| `src/utils.ts` | 262 | Utilitaires date, couleurs, IDs |
| `src/constants.ts` | 109 | Constantes app (statuts, users, sons) |
