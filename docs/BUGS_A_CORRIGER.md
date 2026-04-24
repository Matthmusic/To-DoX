# Bugs & problèmes à corriger

> Généré suite à une analyse statique du code — 2026-03-27
> Classés par sévérité. À traiter dans cet ordre.

---

## CRITIQUE

### 1. `upsertTimeEntry` — logique `idx === -1` silencieusement incorrecte

**Fichier :** `src/store/useStore.ts` ~ligne 882
**Confiance : 85%**

Quand `hours <= 0` est passé pour un triplet `(project, date, userId)` qui n'existe pas encore, `findIndex` retourne `-1`. Le filtre `filter((_, i) => i !== -1)` ne supprime rien (tous les indices sont ≥ 0), la logique est donc silencieusement incorrecte.

**Fix :**
```ts
if (hours <= 0) {
    if (idx < 0) return state; // rien à supprimer
    return { timeEntries: state.timeEntries.filter((_, i) => i !== idx) };
}
```

---

### 2. `setTasks()` direct dans `AdminProjectsPanel` — violation règle critique du projet

**Fichier :** `src/components/settings/AdminProjectsPanel.tsx` ~ligne 124
**Confiance : 90%**

`deleteProjectEverywhere()` filtre les tâches et appelle `setTasks(nextTasks)` directement, en bypass de toutes les actions du store. Cela viole la règle principale du projet (CLAUDE.md : *"Never call setTasks() manually"*).

**Conséquences :**
- Pas de timestamp `updatedAt` mis à jour → le merge `mergeTasksByUpdatedAt` dans `useSyncPolling` peut faire réapparaître les tâches supprimées depuis un autre poste OneDrive
- Pas de soft-delete (`deletedAt` non positionné)
- Side effects du store non exécutés

**Fix :** Créer une action `deleteProjectTasks(projectName: string)` dans le store qui itère sur les tâches et appelle `updateTask()` ou implémente un soft-delete propre.

---

## IMPORTANT

### 3. Double notification `review_requested`

**Fichier :** `src/store/useStore.ts` ~lignes 297-315 et 789-798
**Confiance : 80%**

Deux chemins génèrent des notifications `review_requested` pour le même événement :
- `updateTask()` quand `patch.status === 'review'` notifie les réviseurs existants
- `setReviewers()` notifie à nouveau chaque réviseur après les avoir définis

Si `setReviewers()` est appelé juste après que la tâche passe en `'review'`, chaque réviseur reçoit 2 notifications identiques, qui sont persistées dans `data.json`.

**Fix :** Ajouter un guard dans `setReviewers()` pour ne pas notifier si la tâche est *déjà* en statut `'review'` depuis moins de N secondes, ou centraliser la notification uniquement dans `setReviewers()` en la retirant de `updateTask()`.

---

### 4. Memory leak — `URL.createObjectURL` jamais révoqué

**Fichier :** `src/ToDoX.tsx` ~ligne 255
**Confiance : 85%**

À chaque export JSON, un blob est créé via `URL.createObjectURL(blob)` mais jamais libéré. Dans une app Electron long-running avec des exports fréquents, cela génère une fuite mémoire progressive.

**Fix :**
```ts
link.click();
setTimeout(() => URL.revokeObjectURL(url), 100);
```

---

### 5. `console.log` bruts non-guardés laissés en production

**Fichiers :**
- `src/components/SubtaskList.tsx` lignes 226 et 495
- `src/components/TaskEditPanel.tsx` ligne 99
- `src/components/taskcard/TaskNotesSection.tsx` ligne 73

**Confiance : 95%**

Ces `console.log` s'exécutent en production, contrairement au reste du projet qui utilise `devLog()` / `devError()` (conditionnels au mode dev).

**Fix :** Remplacer par `devLog(...)` ou supprimer.

---

### 6. `migrateTask` perd `reviewValidatedBy` / `reviewValidatedAt`

**Fichier :** `src/utils/taskMigration.ts` ~ligne 100
**Confiance : 82%**

La fonction `migrateTask` reconstruit un objet `Task` complet mais n'inclut pas dans son `return` :
- `reviewValidatedBy`
- `reviewValidatedAt`

Ces champs sont définis dans `types.ts` et présents dans `data.json`, mais effacés silencieusement à chaque rechargement / migration (redémarrage Electron, reload `useSyncPolling`).

**Fix :** Ajouter dans le `return` de `migrateTask` :
```ts
reviewValidatedBy: raw.reviewValidatedBy,
reviewValidatedAt: raw.reviewValidatedAt,
```

---

### 7. Protection admin par string hardcodée côté client uniquement

**Fichier :** `src/components/settings/AdminProjectsPanel.tsx` ~ligne 31
**Confiance : 80%**

```ts
const isAdmin = currentUser === "matthieu"
```

N'importe quel utilisateur peut modifier son `currentUser` dans le localStorage et accéder aux fonctions destructives du panel admin (suppression de projets sur le fichier OneDrive partagé).

**Fix (moyen terme) :** Vérifier l'identité via un mécanisme côté Electron (IPC) plutôt que via la valeur localStorage. À minima, documenter ce risque dans le code.

---

## MINEUR

### 8. `reopenTask` laisse `movedToReviewBy` / `movedToReviewAt` persistés

**Fichier :** `src/store/useStore.ts` ~ligne 862
**Confiance : 72%**

`reopenTask` efface les champs `reviewValidated*` et `reviewRejected*` mais laisse `movedToReviewBy` et `movedToReviewAt` intacts, créant une incohérence dans les données persistées. L'impact UI est neutralisé par la condition `task.status === 'review'` dans `TaskCard`, mais les données sont incohérentes en phase `'doing'` post-réouverture.

**Fix :** Ajouter dans `reopenTask` :
```ts
movedToReviewAt: undefined,
movedToReviewBy: undefined,
```

---

## Récapitulatif

| # | Sévérité | Fichier | Résumé | Confiance |
|---|----------|---------|--------|-----------|
| 1 | CRITIQUE | `useStore.ts:882` | `upsertTimeEntry` — idx=-1 filtre rien | 85% |
| 2 | CRITIQUE | `AdminProjectsPanel.tsx:124` | `setTasks()` direct — bypass soft-delete | 90% |
| 3 | IMPORTANT | `useStore.ts:297,789` | Double notification `review_requested` | 80% |
| 4 | IMPORTANT | `ToDoX.tsx:255` | Memory leak `createObjectURL` non révoqué | 85% |
| 5 | IMPORTANT | 3 fichiers | `console.log` bruts en production | 95% |
| 6 | IMPORTANT | `taskMigration.ts:100` | `reviewValidatedBy/At` perdus à la migration | 82% |
| 7 | IMPORTANT | `AdminProjectsPanel.tsx:31` | Vérif admin côté client uniquement | 80% |
| 8 | MINEUR | `useStore.ts:862` | `reopenTask` laisse `movedToReviewBy/At` | 72% |
