# To-DoX — Backend : parité fonctionnelle (sous-projet 2/4)

Date : 2026-09-10
Statut : validé en brainstorming, en attente de plan d'implémentation
Dépend de : sous-projet 1 (fait — backend multi-tenant Postgres, mergé)
Bloque : [docs/superpowers/specs/2026-09-10-transparent-backend-cutover-design.md](2026-09-10-transparent-backend-cutover-design.md) (la bascule ne peut pas avoir lieu tant que ce sous-projet n'est pas terminé)

## Contexte

Le sous-projet 1 a livré un backend Postgres multi-tenant couvrant tasks/subtasks/projets/commentaires/notifications/time entries. Trois domaines de données persistés aujourd'hui côté frontend (localStorage + `data.json` OneDrive) n'ont pas d'équivalent backend : templates de sous-tâches, rapports sauvegardés, et configuration Outlook/ICS. Un quatrième point existe déjà dans le schéma mais n'a jamais eu de routes : `NotificationSetting` (créé au sous-projet 1, jamais exposé — trou connu, noté dans la revue finale de branche).

Cette spec couvre ces quatre domaines, en réutilisant intégralement l'architecture déjà posée et validée par le sous-projet 1 : Postgres + Prisma, client scopé par organisation (`src/lib/prismaClient.ts`), authentification JWT (`requireAuth`), mêmes conventions (erreurs en français, sémantique PATCH, tests d'intégration contre une vraie base). Aucune nouvelle décision d'architecture — uniquement une extension du schéma et de l'API existants.

## Objectifs

- Templates et rapports sauvegardés migrés vers le backend, org-scopés comme les projets (données partagées par toute l'équipe, confirmé par la lecture du store actuel — aucun champ propriétaire).
- Configuration Outlook/ICS synchronisée entre postes d'un même utilisateur (juste les 4 champs de réglage — `enabled`/`icsUrl`/`exportEnabled`/`lastSync` — pas la logique de génération/service du fichier .ics, qui reste 100% locale côté Electron).
- `NotificationSetting` enfin exposé via API, fermant le trou laissé par le sous-projet 1.
- Script de migration étendu pour couvrir ces quatre domaines à partir des données `data.json` existantes.

## Non-objectifs

- Toute logique de génération/service de fichier ICS côté serveur — reste entièrement dans `electron.js` (le backend ne stocke que le réglage, jamais le contenu du calendrier).
- Système de templates avancé (catégories, partage entre organisations, versions) — on migre le modèle actuel tel quel (nom + liste de titres de sous-tâches), rien de plus.
- Modification du format ou du contenu des rapports générés — le backend stocke le texte déjà généré côté client, ne le regénère pas.

## Modèle de données

Trois nouveaux modèles Prisma, plus l'ajout des relations manquantes sur `Organization`/`User` pour les nouveaux modèles org-scopés :

```prisma
model TaskTemplate {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  subtaskTitles  String[]     @default([]) @map("subtask_titles")

  @@index([organizationId])
  @@map("task_templates")
}

model SavedReport {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  generatedById  String       @map("generated_by")
  generatedBy    User         @relation(fields: [generatedById], references: [id])
  generatedAt    DateTime     @default(now()) @map("generated_at")
  periodType     String       @map("period_type")
  periodLabel    String       @map("period_label")
  taskCount      Int          @map("task_count")
  reportText     String       @map("report_text")

  @@index([organizationId])
  @@map("saved_reports")
}

model OutlookConfig {
  userId        String    @id @map("user_id")
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled       Boolean   @default(false)
  icsUrl        String    @default("") @map("ics_url")
  exportEnabled Boolean   @default(false) @map("export_enabled")
  lastSync      DateTime? @map("last_sync")

  @@map("outlook_configs")
}
```

`OutlookConfig` suit exactement le motif déjà établi par `NotificationSetting` (déjà dans le schéma, inchangé par cette spec) : pas de colonne `organizationId` propre, `userId` comme clé primaire — chaque utilisateur ne lit/écrit jamais que sa propre ligne, donc aucune surface d'isolation cross-org ou cross-user à protéger, contrairement à `Subtask` au sous-projet 1 qui avait besoin du motif `where` composé.

`TaskTemplate` et `SavedReport` suivent le motif `Project` : org-scopés automatiquement en lecture par l'extension Prisma existante, `organizationId` explicite requis sur `create`.

## Surface API

```
GET    /api/templates
POST   /api/templates
DELETE /api/templates/:id

GET    /api/saved-reports
POST   /api/saved-reports
DELETE /api/saved-reports/:id

GET    /api/outlook-config          (config du user courant, pas d'id dans l'URL)
PUT    /api/outlook-config          (upsert du user courant)

GET    /api/notification-settings   (idem, motif singleton par utilisateur)
PUT    /api/notification-settings
```

Toutes les routes exigent JWT (`requireAuth`), erreurs en français, sémantique PATCH sur les `PUT`. Les `DELETE` sur `templates`/`saved-reports` sont des suppressions définitives (`delete`, pas `update` avec `deletedAt`) — contrairement à `Task`/`Comment` au sous-projet 1, le frontend actuel ne restaure jamais un template ou un rapport supprimé, pas de soft-delete à répliquer ici. Les routes `outlook-config` et `notification-settings` n'acceptent aucun paramètre d'identifiant utilisateur dans l'URL — elles opèrent toujours sur `req.userId`, ce qui élimine par construction tout risque d'accès à la configuration d'un autre utilisateur (pas de `{ id, userId }` à vérifier, il n'y a qu'un seul enregistrement possible par utilisateur).

## Migration

`scripts/migrateCore.ts` (sous-projet 1) gagne trois blocs supplémentaires, suivant le même motif que les blocs existants (tasks, comments, timeEntries) : lire `rawData.templates`, `rawData.savedReports`, `rawData.outlookConfigs` (déjà présents dans le type `StoredData` du frontend), créer les lignes correspondantes avec `mapUser()` pour les références utilisateur (`generatedBy`, la clé de `outlookConfigs`). `NotificationSetting` n'a pas d'équivalent dans `data.json` aujourd'hui (jamais persisté côté ancien système) — pas de migration nécessaire pour ce modèle, les utilisateurs migrés démarrent avec les valeurs par défaut du schéma.

## Tests

Même exigence que le sous-projet 1 : tests d'intégration contre une vraie base Postgres (pas de mocks), test d'isolation cross-organisation pour `templates`/`saved-reports` (motif déjà établi par `projects.test.ts`), test confirmant qu'un utilisateur ne peut jamais lire/modifier la config Outlook ou les réglages de notification d'un autre utilisateur (même organisation ou non) pour `outlook-config`/`notification-settings`.

## Suite

Une fois ce sous-projet terminé (spécifié, implémenté, revu comme le sous-projet 1 — plan détaillé, tâches, revue de branche complète), la spec de bascule transparente (`2026-09-10-transparent-backend-cutover-design.md`) peut passer en implémentation.
