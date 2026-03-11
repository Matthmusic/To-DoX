# 📋 Spec — Workflow de Révision & Centre de Notifications

**Statut :** ✅ Implémenté en v2.1.0
**Date :** 27 février 2026
**Version livrée :** v2.1.0

---

## 🎯 Résumé des décisions

| Sujet | Décision |
|-------|----------|
| Colonnes Kanban | **3 colonnes** : À faire / En cours / À réviser |
| Colonne "Fait" | Supprimée du Kanban → nouvelle vue **"Terminées"** |
| Validation | **1 seule suffit**, premier à cliquer "Valider" |
| Qui voit "Valider" | **Tout le monde** (pas uniquement les réviseurs) |
| Réviseurs | Multi-sélection, peuvent être déjà assignés |
| Bypass review | Glisser directement en "Terminées" reste possible |
| Notifications | **In-app** (cloche + badge) **+ desktop** |
| Corrections | Bouton "Demander corrections" avec commentaire obligatoire |
| Stagnation review | Alerte visuelle + notif si en "À réviser" > 3 jours |

---

## 1. Nouveau Kanban — 3 colonnes

### Avant / Après

```
AVANT : À faire │ En cours │ À réviser │ Fait
APRÈS : À faire │ En cours │ À réviser
                                         → vue "Terminées" (toggle header)
```

### Changements dans constants.ts

```typescript
export const STATUSES: StatusDef[] = [
  { id: "todo",   label: "À faire",   Icon: ClipboardList, kanban: true  },
  { id: "doing",  label: "En cours",  Icon: Loader2,       kanban: true  },
  { id: "review", label: "À réviser", Icon: SearchCheck,   kanban: true  },
  { id: "done",   label: "Terminé",   Icon: CheckCircle2,  kanban: false }, // caché du Kanban
];
```

`KanbanBoard` filtre : `STATUSES.filter(s => s.kanban)` → 3 colonnes.

---

## 2. Nouveaux champs sur Task (types.ts)

```typescript
interface Task {
  // ... champs existants inchangés ...

  // ── Workflow review ───────────────────────────────────────────
  reviewers?: string[];          // IDs des réviseurs désignés
  reviewValidatedBy?: string;    // ID de celui qui a cliqué "Valider"
  reviewValidatedAt?: string;    // ISO timestamp de validation
  reviewRejectedBy?: string;     // ID de celui qui a demandé corrections
  reviewRejectedAt?: string;     // ISO timestamp du rejet
  rejectionComment?: string;     // Commentaire obligatoire au rejet
}
```

---

## 3. Nouvelles notifications in-app (types.ts)

```typescript
type AppNotifType =
  | 'review_requested'   // Quelqu'un t'a assigné comme réviseur
  | 'review_validated'   // Une tâche a été validée
  | 'review_rejected'    // Corrections demandées sur une tâche
  | 'review_stale';      // Tâche en révision depuis > 3 jours

interface AppNotification {
  id: string;
  type: AppNotifType;
  taskId: string;
  taskTitle: string;
  fromUserId: string;    // Qui a déclenché l'action
  toUserId: string;      // Destinataire
  message: string;       // Texte affiché dans la cloche
  createdAt: string;     // ISO
  readAt?: string;       // ISO — undefined = non lu
}
```

Stockées dans `StoredData` → `notifications: AppNotification[]`
(ou fichier séparé `notifications.json` comme `comments.json`)

---

## 4. Workflow complet — états et transitions

### 4.1 Déplacement vers "À réviser"

```
moveTask(taskId, 'review')
    │
    ├─ task.reviewers est vide ?
    │       └─ Ouvrir <ReviewerPickerDialog>
    │              └─ Utilisateur sélectionne 1..N réviseurs
    │                     └─ store.setReviewers(taskId, reviewers[])
    │
    └─ Pour chaque réviseur :
           ├─ addNotification({ type: 'review_requested', toUserId: reviewer, ... })
           └─ fireDesktopNotif("Tu as une tâche à réviser : [titre]")
```

### 4.2 Clic "Valider" (visible par tous)

```
validateTask(taskId)
    │
    ├─ task.status → 'done'
    ├─ task.reviewValidatedBy = currentUser.id
    ├─ task.reviewValidatedAt = now()
    ├─ task.completedAt = now()          ← déjà géré par updateTask()
    │
    └─ Pour chaque assigné (task.assignedTo) :
           ├─ addNotification({ type: 'review_validated', toUserId: assigné, ... })
           └─ fireDesktopNotif("✅ [titre] a été validée")
```

### 4.3 Clic "Demander corrections"

```
requestCorrections(taskId, comment: string)
    │
    ├─ Ouvrir <CorrectionCommentDialog> (textarea, commentaire obligatoire)
    │
    ├─ task.status → 'doing'
    ├─ task.reviewRejectedBy = currentUser.id
    ├─ task.reviewRejectedAt = now()
    ├─ task.rejectionComment = comment
    │   └─ Crée aussi un vrai commentaire dans comments (visible dans le fil)
    │
    └─ Pour chaque assigné (task.assignedTo) :
           ├─ addNotification({ type: 'review_rejected', toUserId: assigné, ... })
           └─ fireDesktopNotif("↩️ Corrections demandées sur [titre]")
```

### 4.4 Rouvrir depuis "Terminées"

```
reopenTask(taskId)
    │
    ├─ task.status → 'doing'
    ├─ task.reviewValidatedBy = undefined
    ├─ task.reviewValidatedAt = undefined
    └─ (pas de notification — action volontaire)
```

### 4.5 Bypass (passage direct en "Terminées" sans review)

```
moveTask(taskId, 'done')
    │
    └─ Pas de popup, pas de notification review
       (flow normal, déjà géré par updateTask())
```

---

## 5. Stagnation en "À réviser"

Même logique que la stagnation en "En cours" (>3 jours).

- `TaskCard` en status `review` : badge orange ⚠️ si `updatedAt` > 3 jours
- `useNotifications.ts` : ajouter un check pour `review` stagnant → `review_stale`
- Notif envoyée aux **réviseurs désignés** (pas à tous)

Message : *"[titre] attend une révision depuis 3 jours"*

---

## 6. Composants UI à créer / modifier

### 6.1 Nouveaux composants

**`<ReviewerPickerDialog>`**
- Déclenché quand on déplace en "À réviser" sans réviseurs
- Liste des utilisateurs avec cases à cocher (multi-select)
- Bouton "Confirmer" (désactivé si aucun sélectionné)
- Bouton "Passer sans réviseur" (bypass silencieux)

**`<CorrectionCommentDialog>`**
- Textarea "Pourquoi des corrections sont-elles nécessaires ?"
- Validation requise (min. 10 caractères)
- Bouton "Envoyer"

**`<NotificationDropdown>`**
- Déclenché par clic sur la cloche dans `TitleBar`
- Liste scrollable des `AppNotification` du `currentUser`
- Format par item : `[icône type] [message] · [temps relatif]`
- Clic sur item → ferme dropdown + ouvre `TaskEditPanel` sur la tâche concernée
- Bouton "Tout marquer comme lu"
- Badge rouge sur la cloche = count des `readAt === undefined`

**`<TermineesView>`**
*(nouvelle vue, même niveau que `DashboardView` et `TimelineView`)*

```
┌─────────────────────────────────────────────┐
│  Terminées    [Filtrer par projet ▼]  [🗃️ Archiver sélection]
├─────────────────────────────────────────────┤
│  ☐  PROJET A                                │
│     ├─ [✓] Tâche X  · validée par Matthieu · 26 fév  [Rouvrir]  │
│     └─ [✓] Tâche Y  · validée par William  · 25 fév  [Rouvrir]  │
│                                             │
│  ☐  PROJET B                                │
│     └─ [✓] Tâche Z  · bypass direct        · 24 fév  [Rouvrir]  │
└─────────────────────────────────────────────┘
```

- Groupé par projet (comme le Kanban)
- Tri : par date de validation décroissante
- Cases à cocher pour sélection multiple → bouton "Archiver la sélection"
- "Rouvrir" → `reopenTask()` → task repasse en `doing`
- Filtre rapide par projet via dropdown

### 6.2 Composants modifiés

**`TaskCard`** (status = `review`)
- Ajouter en bas de carte :
  ```
  [✅ Valider]  [↩️ Demander corrections]
  ```
- Badge stagnation review (même style que doing)
- Afficher les avatars des réviseurs désignés (petits, en bas à gauche)

**`TaskEditPanel`**
- Nouveau champ "Réviseurs" : multi-select `<UserMultiSelect>` (réutiliser le composant assignés)
- Section "Historique de révision" :
  - Validée par [nom] le [date]
  - Ou : Corrections demandées par [nom] le [date] + affichage du commentaire

**`TitleBar`**
- Ajouter icône `Bell` (Lucide) à droite du bouton de recherche
- Badge rouge (Tailwind `absolute top-0 right-0`) avec le count non lu
- Clic → toggle `<NotificationDropdown>`

**`KanbanHeaderPremium`**
- Ajouter `'terminées'` dans le type de vue : `'kanban' | 'timeline' | 'dashboard' | 'terminées'`
- Nouveau bouton dans le toggle de vue : `CheckCircle2` icon + label "Terminées"

**`KanbanBoard`**
- Filtrer les colonnes : `STATUSES.filter(s => s.kanban)` → 3 colonnes

---

## 7. Modifications du Store (useStore.ts)

### Nouveaux champs de state

```typescript
appNotifications: AppNotification[];
```

### Nouvelles actions

```typescript
// Révision
setReviewers(taskId: string, reviewers: string[]): void
validateTask(taskId: string): void          // → status done + notifs
requestCorrections(taskId: string, comment: string): void  // → status doing + notifs
reopenTask(taskId: string): void            // → status doing, reset review fields

// Notifications in-app
addNotification(notif: Omit<AppNotification, 'id' | 'createdAt'>): void
markNotificationRead(notifId: string): void
markAllNotificationsRead(userId: string): void
clearReadNotifications(userId: string): void
setAppNotifications(notifs: AppNotification[]): void
```

### Modification de updateTask()

Quand `status` change vers `review` :
- Si `task.reviewers` est défini et non vide → déclencher les notifs (dans l'action `validateTask` et non dans `updateTask` directement)

---

## 8. Persistence (useDataPersistence.ts)

Deux options :
- **Option A (simple)** : ajouter `notifications: AppNotification[]` dans `data.json`
- **Option B (propre)** : fichier `notifications.json` séparé comme `comments.json`

→ **Option B recommandée** pour éviter d'alourdir `data.json` avec des notifs accumulées.

Règle de nettoyage : supprimer les notifs lues de plus de 30 jours au chargement.

---

## 9. Messages de notification

| Type | Message in-app | Notif desktop |
|------|---------------|---------------|
| `review_requested` | "🔍 [fromUser] t'a assigné comme réviseur sur **[titre]**" | "Tu as une tâche à réviser" |
| `review_validated` | "✅ **[titre]** a été validée par [fromUser]" | "Tâche validée : [titre]" |
| `review_rejected` | "↩️ [fromUser] demande des corrections sur **[titre]**" | "Corrections demandées : [titre]" |
| `review_stale` | "⏰ **[titre]** attend une révision depuis 3 jours" | "Révision en attente : [titre]" |

---

## 10. Ordre d'implémentation suggéré

```
Étape 1 — Types & Store (sans UI)
  ├─ types.ts : Task review fields + AppNotification
  ├─ useStore.ts : validateTask(), requestCorrections(), reopenTask(), setReviewers()
  ├─ useStore.ts : addNotification(), markNotificationRead(), etc.
  └─ useDataPersistence.ts : chargement/sauvegarde notifications.json

Étape 2 — Kanban 3 colonnes
  ├─ constants.ts : flag kanban: boolean sur STATUSES
  └─ KanbanBoard.tsx : filter STATUSES

Étape 3 — TaskCard review actions
  ├─ Boutons "Valider" + "Demander corrections"
  ├─ Badge stagnation review
  └─ Avatars réviseurs

Étape 4 — Dialogs
  ├─ ReviewerPickerDialog
  └─ CorrectionCommentDialog

Étape 5 — Centre de notifications
  ├─ TitleBar : Bell icon + badge
  └─ NotificationDropdown

Étape 6 — Vue "Terminées"
  ├─ TermineesView.tsx
  └─ KanbanHeaderPremium : 4ème bouton toggle

Étape 7 — TaskEditPanel
  ├─ Champ réviseurs
  └─ Section historique de révision

Étape 8 — Tests & polish
  ├─ Tests store : validateTask, requestCorrections, reopenTask
  ├─ Tests notifications
  └─ Storybook stories
```

---

## 11. Impact sur les features existantes

| Feature | Impact |
|---------|--------|
| Drag & drop | Gérer le drop sur la nouvelle zone "Terminées" (drop → bypass direct) |
| Filtres | Filtre statut : "Terminées" devient une option supplémentaire |
| Recherche | Les tâches terminées doivent être cherchables depuis la vue "Terminées" |
| CRs / Rapports | La période "terminées cette semaine" = tasks validées dans la semaine |
| Archive | L'archive reste le cimetière final (depuis "Terminées" → archiver) |
| Récurrence | Tâche récurrente validée → clone créé comme avant (status `todo`) |
| Export JSON/CSV | Inclure les nouveaux champs review dans l'export |

---

**Prêt à implémenter ! 🚀**
