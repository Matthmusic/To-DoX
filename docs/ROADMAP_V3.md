# 🗺️ Roadmap To-DoX — v2.1 → v3.0

Document de planification des prochaines évolutions de l'application To-DoX.

**Dernière mise à jour :** 27 février 2026
**Version actuelle :** 2.0.10
**Roadmap précédente :** [ROADMAP.md](ROADMAP.md) (v2.0.8 — tout terminé ✅)

---

## 📊 Vue d'ensemble

| Phase | Version | Thème | Items | Priorité |
|-------|---------|-------|-------|----------|
| 1 | v2.1.0 | Qualité & Polish | 8 | 🔥 Haute |
| 2 | v2.2.0 | Productivité | 7 | 🔥 Haute |
| 3 | v2.3.0 | Suivi avancé | 7 | ⭐ Moyenne |
| 4 | v3.0.0 | Collaboration temps réel | 6 | 💡 Long terme |

**Légende :**
- ✅ TERMINÉ
- 🔥 Priorité Haute
- ⭐ Priorité Moyenne
- 💡 Priorité Basse / Long terme
- 🐛 Correctif / dette technique

---

## ⚡ Phase 1 — v2.1.0 : Qualité & Polish

*Corrections de dette technique + gains UX immédiats sans restructuration majeure.*

---

### 1.1 🐛 Consolidation des couleurs Timeline/Kanban

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐

**Problème :** `TimelineView.tsx` maintient sa propre palette `PROJECT_PALETTE` qui duplique `PROJECT_COLORS` de `constants.ts`. Risque de désync si l'on ajoute des couleurs.

**Solution :**
- Supprimer `PROJECT_PALETTE` dans `TimelineView.tsx`
- Réutiliser `PROJECT_COLORS` + `getProjectColor()` depuis `utils.ts`
- Unifier la palette à 9 couleurs partout dans l'app

**Fichiers :** `src/components/TimelineView.tsx`, `src/constants.ts`, `src/utils.ts`

---

### 1.2 🐛 Nettoyage des console.log non gardés

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐

**Problème :** ~31 `console.log/error/warn` dans le codebase. Certains non gardés par `isDev`, ce qui pollue la console en production.

**Solution :**
- Auditer et wrapper tous les logs dans un helper `devLog()` existant ou `if (import.meta.env.DEV)`
- Ajouter règle ESLint `no-console` en `warn` pour éviter la régression

**Fichiers :** `src/hooks/useDataPersistence.ts` (principal), règle dans `.eslintrc`

---

### 1.3 🐛 Tests unitaires pour les hooks critiques

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐⭐

**Couverture actuelle :** ~25% du codebase. Les chemins critiques suivants sont non testés :
- `useDataPersistence.ts` — logique de migration + sauvegarde
- `useDragAndDrop.ts` — calcul de position `reorderTask()`
- Système de commentaires (addComment, deleteComment, mentions)
- Système de templates (createTaskFromTemplate)
- Logique de récurrence (clone automatique à la complétion)
- Calcul des périodes de CR (getCurrentWeekRange, getCurrentMonthRange)

**Solution :** Ajouter des fichiers `.test.ts` pour chaque hook critique. Mocker `window.electronAPI` et le file system via `vi.mock()`.

**Nouveaux fichiers :**
- `src/hooks/useDataPersistence.test.ts`
- `src/store/comments.test.ts`
- `src/store/templates.test.ts`
- `src/utils/recurrence.test.ts`

---

### 1.4 ✨ Couleurs de projet personnalisables

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** La couleur d'un projet est déterminée par un hash automatique sur son nom. L'utilisateur ne peut pas choisir manuellement.

**Solution :**
- Ajouter un sélecteur de couleur dans `ProjectsListPanel` (9 swatches de la palette)
- Persister le choix dans `projectColors` (déjà dans le store ✅, juste exposer l'UI)
- Clic droit sur un badge de projet → "Changer la couleur"

**Fichiers :** `src/components/settings/ProjectsListPanel.tsx`, `src/components/ProjectCard.tsx`

---

### 1.5 ✨ Tri par colonne (priorité, date, ordre personnalisé)

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** Le tri est fixe (favori DESC → order ASC → businessDayDelta). Impossible de trier par priorité ou date.

**Solution :**
- Ajouter un menu déroulant de tri dans l'en-tête de chaque colonne ou dans `KanbanHeaderPremium`
- Modes : Manuel (ordre actuel), Par priorité (high→med→low), Par échéance (croissant), Par date de création
- Persisté dans `localStorage` (préférence UX, pas dans data.json)

**Fichiers :** `src/hooks/useFilters.ts`, `src/components/KanbanBoard.tsx`, `src/store/useStore.ts`

---

### 1.6 ✨ Compteur de tâches sur projets repliés

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐

**Problème actuel :** Quand une `ProjectCard` est repliée, on perd la visibilité sur le nombre de tâches cachées.

**Solution :**
- Afficher un badge `(N tâches)` à droite du titre du projet quand la carte est repliée
- Badge coloré en rouge si des tâches sont en retard dans le groupe

**Fichiers :** `src/components/ProjectCard.tsx`

---

### 1.7 ✨ Export CSV des tâches

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐

**Problème actuel :** L'export est uniquement en JSON (format interne). Impossible d'ouvrir dans Excel/Sheets.

**Solution :**
- Ajouter un bouton "Exporter CSV" dans le panneau de projets ou dans le header
- Colonnes : Titre, Projet, Statut, Priorité, Assigné, Échéance, Créé le, Notes
- Filtre optionnel : toutes les tâches OU seulement les actives

**Fichiers :** `src/utils.ts` (helper `tasksToCSV()`), `src/components/KanbanHeaderPremium.tsx`

---

### 1.8 ✨ Opérations en masse sur les tâches (multi-sélection)

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** Impossible de déplacer, archiver ou réassigner plusieurs tâches en même temps.

**Solution :**
- Mode de sélection multiple activé par `Ctrl+Clic` sur une TaskCard
- Barre d'actions flottante en bas d'écran quand ≥1 tâche sélectionnée
- Actions disponibles : Changer le statut, Changer la priorité, Réassigner, Archiver, Supprimer
- Sélection via case à cocher visible au survol

**Fichiers :** `src/ToDoX.tsx`, `src/components/TaskCard.tsx`, `src/store/useStore.ts` (action `bulkUpdateTasks()`)

---

## 🚀 Phase 2 — v2.2.0 : Productivité

*Nouvelles fonctionnalités qui améliorent le flux de travail quotidien.*

---

### 2.1 ✨ Filtres sauvegardés / vues personnalisées

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐⭐⭐

**Description :**
Permettre de sauvegarder une combinaison de filtres (projet, statut, priorité, assigné, période) sous un nom personnalisé, accessible en un clic.

**Fonctionnalités :**
- Bouton "Sauvegarder cette vue" dans `KanbanHeaderPremium`
- Liste déroulante des vues sauvegardées avec suppression
- Vue rapide "Mon travail" : tâches assignées à `currentUser` et en cours/review
- Persisté dans `localStorage`

**Fichiers :** `src/store/useStore.ts`, `src/hooks/useFilters.ts`, `src/components/KanbanHeaderPremium.tsx`

---

### 2.2 ✨ Recherche full-text dans les notes et commentaires

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** La recherche (`Ctrl+F`) ne cherche que dans le titre et le nom du projet.

**Solution :**
- Étendre la recherche aux champs : notes, contenu des commentaires, titres des sous-tâches
- Surlignage (highlight) des occurrences trouvées dans les cartes et panneaux
- Option "Chercher partout" vs "Titre uniquement" dans la barre de recherche

**Fichiers :** `src/hooks/useFilters.ts`, `src/components/TaskCard.tsx`, `src/components/TaskEditPanel.tsx`

---

### 2.3 ✨ Markdown dans les notes

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐

**Description :**
Les notes des tâches supportent déjà les liens de fichiers. Étendre avec un rendu Markdown léger.

**Fonctionnalités :**
- Rendu Markdown en lecture : **gras**, *italique*, `code`, listes, liens URL
- Basculer entre mode édition (textarea) et mode rendu (aperçu) via un bouton toggle
- Conserver la détection des chemins de fichiers Windows (`C:\...`) ✅ déjà en place
- Bibliothèque recommandée : `marked` ou `micromark` (légère, ~5 KB)

**Fichiers :** `src/components/TaskEditPanel.tsx`, `src/components/TaskCard.tsx`

---

### 2.4 ✨ Templates de projet (multi-tâches)

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** Les templates créent une seule tâche. Impossible de créer un projet entier (ensemble de tâches liées) depuis un template.

**Solution :**
- Nouveau type `ProjectTemplate` : liste de `TaskTemplate` ordonnés
- Interface de création de template de projet dans `ProjectsListPanel`
- Création depuis QuickAdd → "Nouveau projet depuis template"
- Chaque tâche créée hérite du projet et des métadonnées du template

**Fichiers :** `src/types.ts`, `src/store/useStore.ts`, `src/components/settings/ProjectsListPanel.tsx`, `src/components/QuickAddPremium.tsx`

---

### 2.5 ✨ Navigation clavier dans le Kanban

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐

**Description :**
Permettre de naviguer entre les tâches et de les déplacer sans souris.

**Raccourcis proposés :**
- `↑/↓` : naviguer entre les tâches d'une colonne
- `←/→` : passer à la colonne précédente/suivante
- `Enter` : ouvrir le panneau d'édition de la tâche focalisée
- `Ctrl+←/→` : déplacer la tâche vers le statut précédent/suivant
- `Ctrl+Shift+F` : marquer/démarquer comme favori

**Fichiers :** `src/hooks/useKeyboardShortcuts.ts`, `src/components/TaskCard.tsx`, `src/components/ShortcutsHelpPanel.tsx`

---

### 2.6 ✨ Mode focus (colonnes masquables)

**Priorité :** 💡 Basse — **Impact :** ⭐⭐⭐

**Description :**
Permettre de masquer temporairement certaines colonnes pour se concentrer sur les tâches actives.

**Fonctionnalités :**
- Bouton de masquage par colonne (œil barré dans l'en-tête de colonne)
- Raccourci pour masquer rapidement la colonne "Fait" (souvent encombrante)
- Persisté dans `localStorage` (préférence)

**Fichiers :** `src/components/KanbanBoard.tsx`, `src/store/useStore.ts`

---

### 2.7 ✨ Icône système (system tray) avec QuickAdd

**Priorité :** 💡 Basse — **Impact :** ⭐⭐⭐

**Description :**
Icône dans la barre système (notification area Windows / menu bar macOS) pour accès rapide.

**Fonctionnalités :**
- Clic gauche → afficher/masquer la fenêtre principale
- Clic droit → menu contextuel : "Nouvelle tâche rapide", "Voir les tâches du jour", "Quitter"
- Badge sur l'icône avec le nombre de tâches en retard
- Raccourci global système pour afficher la fenêtre (`Ctrl+Alt+T`)

**Fichiers :** `electron.js` (nouveau `Tray` + `Menu`), `preload.js`

---

## 🔬 Phase 3 — v2.3.0 : Suivi Avancé

*Fonctionnalités pour les équipes et la gestion de projet sérieuse.*

---

### 3.1 ✨ Suivi du temps (Time Tracking)

**Priorité :** 🔥 Haute — **Impact :** ⭐⭐⭐⭐⭐

**Description :**
Enregistrer le temps passé sur chaque tâche pour les bilans et la facturation.

**Fonctionnalités :**
- Bouton chronomètre ▶️ sur chaque `TaskCard` → démarre/arrête un timer
- Champs `estimatedHours` et `actualHours` sur les tâches
- Historique des sessions de temps dans `TaskEditPanel` (date, durée, utilisateur)
- Dashboard : temps total par projet, par utilisateur, par semaine
- Export dans les CRs : "Temps passé" par tâche

**Nouveaux types :**
```typescript
interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;  // ISO
  endedAt: string | null;
  durationMinutes: number;
}
```

**Fichiers :** `src/types.ts`, `src/store/useStore.ts`, `src/components/TaskCard.tsx`, `src/components/TaskEditPanel.tsx`, `src/components/DashboardView.tsx`

---

### 3.2 ✨ Dépendances entre tâches

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐⭐

**Description :**
Modéliser les relations de blocage entre tâches.

**Fonctionnalités :**
- Champ `dependsOn: string[]` (IDs des tâches bloquantes) sur `Task`
- Indicateur visuel sur les `TaskCard` bloquées (icône cadenas + tooltip)
- Avertissement si l'on tente de passer une tâche en "doing" avec des dépendances non terminées
- Vue des dépendances dans `TaskEditPanel` (liste des tâches liées, cliquables)
- Dans la `TimelineView` : flèches de dépendance entre les barres Gantt

**Fichiers :** `src/types.ts`, `src/store/useStore.ts`, `src/components/TaskCard.tsx`, `src/components/TaskEditPanel.tsx`, `src/components/TimelineView.tsx`

---

### 3.3 ✨ Historique des modifications (Audit Log)

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐

**Description :**
Tracer qui a changé quoi et quand sur chaque tâche.

**Fonctionnalités :**
- Nouveau tableau `history: HistoryEntry[]` dans `TaskEditPanel`
- Entrées générées automatiquement par `updateTask()` sur les champs surveillés : statut, priorité, assigné, titre, échéance
- Format : `"Matthieu → Statut : doing → review (27 fév 2026 14:32)"`
- Stocké dans un fichier `history.json` séparé (ne pas alourdir `data.json`)
- Consultation depuis le panneau d'édition, onglet "Historique"

**Nouveau type :**
```typescript
interface HistoryEntry {
  id: string;
  taskId: string;
  userId: string;
  changedAt: string;  // ISO
  field: string;
  oldValue: string;
  newValue: string;
}
```

**Fichiers :** `src/types.ts`, `src/store/useStore.ts`, `electron.js` (nouveau fichier history.json), `src/hooks/useDataPersistence.ts`, `src/components/TaskEditPanel.tsx`

---

### 3.4 ✨ Dashboard amélioré — Burndown & Vélocité

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐⭐

**Description :**
Compléter `DashboardView` avec des métriques d'équipe avancées.

**Nouveaux blocs :**
- **Burndown chart** : tâches restantes vs tâches idéales sur la semaine/le sprint
- **Vélocité** : nombre moyen de tâches terminées par semaine (rolling 8 semaines)
- **Cycle time** : délai moyen entre création et complétion par projet
- **Taux d'overdue** : proportion de tâches passées sans être terminées à l'échéance
- **Dashboard widgets déplaçables** : réorganiser les blocs par drag & drop (optionnel)

**Fichiers :** `src/components/DashboardView.tsx`

---

### 3.5 ✨ Timeline interactive (créer/modifier directement)

**Priorité :** ⭐ Moyenne — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** La timeline est en lecture seule (clic → ouvre TaskEditPanel). On ne peut pas glisser une barre pour changer la date.

**Solution :**
- Drag horizontal d'une barre Gantt → met à jour la date `due`
- Resize de la barre (poignée droite) → modifie `ganttDays`
- Double-clic sur une cellule vide → QuickAdd pré-rempli avec la date et le projet
- Indicateur "aujourd'hui" (ligne rouge verticale)

**Fichiers :** `src/components/TimelineView.tsx`, `src/store/useStore.ts`

---

### 3.6 ✨ Récurrence avancée

**Priorité :** 💡 Basse — **Impact :** ⭐⭐⭐

**Problème actuel :** Seulement 3 types (`daily`, `weekly`, `monthly`). Pas de contrôle fin.

**Solution :**
- Récurrence personnalisée : "Tous les N jours/semaines/mois"
- Récurrence basée sur le jour de la semaine : "Chaque lundi et jeudi"
- Exception d'occurrence : "Sauter la prochaine occurrence" sans désactiver la récurrence
- Fin de récurrence : déjà `endsAt` ✅ — ajouter aussi "Après N occurrences"

**Nouveau sous-type :**
```typescript
interface Recurrence {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;          // ex: 2 = tous les 2 jours
  daysOfWeek?: number[];      // ex: [1, 4] = lundi et jeudi
  endsAt?: string;
  maxOccurrences?: number;
  occurrenceCount?: number;   // compteur interne
  nextSkip?: boolean;         // sauter la prochaine
}
```

**Fichiers :** `src/types.ts`, `src/store/useStore.ts`, `src/components/TaskEditPanel.tsx`

---

### 3.7 ✨ Gestion des utilisateurs configurable

**Priorité :** 💡 Basse — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** `FIXED_USERS` dans `constants.ts` est une liste hardcodée de 10 membres de Conception-EA. Impossible d'ajouter/supprimer des utilisateurs sans recompiler l'app.

**Solution :**
- Migrer les utilisateurs vers `data.json` (déjà prévu dans `StoredData.users`) ✅
- Interface complète dans `UsersPanel` : ajout, modification, suppression
- Photo de profil optionnelle (URL ou initiales colorées)
- Rôle optionnel (`admin`, `member`, `viewer`)
- Conserver `FIXED_USERS` comme liste initiale au premier démarrage (migration automatique)

**Fichiers :** `src/constants.ts`, `src/types.ts`, `src/store/useStore.ts`, `src/components/settings/UsersPanel.tsx`, `src/hooks/useDataPersistence.ts`

---

## 🌐 Phase 4 — v3.0.0 : Collaboration Temps Réel

*Évolution architecturale majeure. Nécessite l'activation du backend Express.*

---

### 4.1 💡 Synchronisation temps réel (WebSocket)

**Priorité :** 💡 Long terme — **Impact :** ⭐⭐⭐⭐⭐

**Problème actuel :** La synchronisation est basée sur les fichiers (data.json partagé via réseau). Conflits possibles, latence élevée.

**Solution :**
- Activer le backend Express (`todox-backend/`) comme serveur central
- WebSocket (socket.io) pour broadcaster les changements en temps réel
- Stratégie de merge : `updatedAt` + CRDT léger pour les conflits
- Mode offline-first : les changements locaux sont mis en queue et rejoués à la reconnexion
- Indicateur de connexion en temps réel dans `TitleBar`

**Fichiers backend :** `todox-backend/src/index.ts`, nouveau `todox-backend/src/ws.ts`
**Fichiers frontend :** `src/hooks/useDataPersistence.ts`, nouveau `src/hooks/useRealtimeSync.ts`

---

### 4.2 💡 Feed d'activité de l'équipe

**Priorité :** 💡 Long terme — **Impact :** ⭐⭐⭐⭐

**Description :**
Panneau dédié listant les actions récentes de tous les membres : "Matthieu a terminé [Tâche X]", "William a commenté [Tâche Y]".

**Fonctionnalités :**
- Timeline d'activité avec avatars et horodatage relatif ("il y a 5 min")
- Filtre par utilisateur ou par projet
- Notifications push pour les activités concernant mes tâches
- Alimenté par `history.json` (Phase 3.3) + WebSocket (Phase 4.1)

**Fichiers :** `src/components/ActivityFeedPanel.tsx` (nouveau), `src/ToDoX.tsx`

---

### 4.3 💡 Intégration backend Express complète

**Priorité :** 💡 Long terme — **Impact :** ⭐⭐⭐⭐⭐

**Problème actuel :** Le backend Express existe (`todox-backend/`) mais n'est pas intégré au frontend Electron — les deux fonctionnent en silo.

**Solution :**
- Option dans `StoragePanel` : "Mode local (fichiers)" vs "Mode serveur (réseau)"
- En mode serveur, toutes les opérations du store passent par l'API REST
- Authentification légère (token JWT côté Electron, stocké en keychain)
- Synchronisation bidirectionnelle : les changements offline sont rejoués à la connexion
- Migration automatique local → serveur (import de data.json vers la base SQLite)

**Fichiers backend :** `todox-backend/src/routes/tasks.ts`, `todox-backend/src/routes/projects.ts`
**Fichiers frontend :** `src/hooks/useDataPersistence.ts`, `src/components/settings/StoragePanel.tsx`

---

### 4.4 💡 Notifications email / résumé quotidien

**Priorité :** 💡 Long terme — **Impact :** ⭐⭐⭐

**Description :**
Envoyer des résumés par email pour les utilisateurs qui ne sont pas devant leur poste.

**Fonctionnalités :**
- Résumé quotidien (7h00) : tâches dues aujourd'hui, retards, mentions récentes
- Notification immédiate si mentionné dans un commentaire
- Configuration SMTP dans les paramètres (ou SendGrid)
- Opt-in par utilisateur

**Fichiers backend :** nouveau `todox-backend/src/services/mailer.ts`

---

### 4.5 💡 Application web (mode navigateur complet)

**Priorité :** 💡 Long terme — **Impact :** ⭐⭐⭐⭐

**Problème actuel :** Le build web existe mais les fonctionnalités Electron (`window.electronAPI`) ne sont pas disponibles → de nombreuses features sont absentes en mode web.

**Solution :**
- Abstraire toutes les dépendances Electron derrière un adapter pattern
- `ElectronAdapter` → appels IPC
- `WebAdapter` → appels REST API + localStorage
- Build web déployable (Vite → `dist/`) avec feature flags automatiques
- PWA optionnel (installable depuis Chrome/Edge)

**Fichiers :** `src/adapters/ElectronAdapter.ts` (nouveau), `src/adapters/WebAdapter.ts` (nouveau), refactoring de `window.electronAPI` usages

---

### 4.6 💡 Application mobile compagnon (React Native)

**Priorité :** 💡 Long terme — **Impact :** ⭐⭐⭐

**Description :**
Application mobile légère pour consulter et mettre à jour les tâches en déplacement. Nécessite le backend (Phase 4.3).

**Fonctionnalités V1 :**
- Vue "Mes tâches" (filtrées sur l'utilisateur connecté)
- Changer le statut d'une tâche (swipe)
- Ajouter un commentaire
- Notifications push pour les mentions et les échéances

**Stack proposée :** React Native + Expo (partage de types avec le projet principal)

---

## 🐛 Dette Technique à Adresser

| # | Problème | Urgence | Fichier(s) |
|---|---------|---------|------------|
| T1 | Couleurs Timeline dupliquées | 🔥 | `TimelineView.tsx` |
| T2 | console.log non guardés | ⭐ | `useDataPersistence.ts` + ~30 fichiers |
| T3 | Test coverage <25% | 🔥 | Hooks critiques non testés |
| T4 | GitHub Actions `working-directory: smart-todo` legacy | 🔥 | `.github/workflows/release.yml` |
| T5 | `onClick: _onClick` désactivé dans TaskCard | 💡 | `TaskCard.tsx:33` |
| T6 | Calculs de dates sans timezone explicite | ⭐ | `utils.ts` (multiples helpers) |
| T7 | FIXED_USERS hardcodés (non modifiables sans recompilation) | ⭐ | `constants.ts` |

---

## 📝 Ordre de développement suggéré

```
1. T4 — Corriger le workflow CI (5 min) 🔥
2. 1.1 — Consolidation couleurs           🔥
3. 1.2 — Nettoyage console.log            ⭐
4. 1.3 — Tests unitaires hooks critiques  🔥
5. 1.4 — Couleurs projet personnalisables 🔥
6. 1.5 — Tri par colonne                  🔥
7. 1.6 — Compteur tâches repliées         ⭐ (quick win 30 min)
8. 1.8 — Multi-sélection tâches           ⭐
9. 2.1 — Filtres sauvegardés / "Mon travail" 🔥
10. 2.2 — Recherche full-text             🔥
11. 1.7 — Export CSV                      ⭐
12. 2.3 — Markdown dans les notes         ⭐
13. 3.7 — Utilisateurs configurables      💡
14. 3.1 — Time tracking                   🔥
15. 3.2 — Dépendances entre tâches        ⭐
...
```

---

## 📦 Versions planifiées

| Version | Contenu principal | Cible |
|---------|------------------|-------|
| v2.1.0 | Phase 1 : Qualité & Polish (1.1–1.8) | Mars 2026 |
| v2.2.0 | Phase 2 : Productivité (2.1–2.7) | Avril 2026 |
| v2.3.0 | Phase 3 : Suivi Avancé (3.1–3.7) | Juin 2026 |
| v3.0.0 | Phase 4 : Collaboration temps réel | 2026–2027 |

---

**Bon développement ! 🚀**
