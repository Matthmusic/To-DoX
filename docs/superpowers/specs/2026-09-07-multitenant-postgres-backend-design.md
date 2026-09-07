# To-DoX — Fondation backend multi-tenant (sous-projet 1/4)

Date : 2026-09-07
Statut : validé en brainstorming, en attente de plan d'implémentation

## Contexte

To-DoX persiste aujourd'hui ses données dans un fichier JSON partagé
(`data.json` + `comments.json`) sur un dossier OneDrive
(`OneDrive - CEA/DATA/To-Do-X/`), avec polling 2s + merge par
`updatedAt` côté client (voir [To-DoX/src/hooks/persistence/](../../../src/hooks/persistence/)).
Ce mécanisme est fragile en usage simultané (collision silencieuse sur
une même tâche, dépendance au comportement de synchro OneDrive) et
OneDrive n'est plus d'actualité pour ce projet.

Un squelette de backend existe déjà (`todox-backend/`, Express +
better-sqlite3) mais n'est branché nulle part dans le frontend, et ne
couvre qu'une fraction du modèle de données actuel (pas de
commentaires, notifications, time entries, workflow de révision...).

## Objectifs de ce sous-projet

1. Remplacer entièrement la persistance fichier/OneDrive par une vraie
   base de données servie via une API HTTP.
2. Poser un modèle multi-tenant (`organizations` → `users`) et une
   vraie authentification (login/mot de passe + rôles), en vue d'une
   éventuelle commercialisation future — sans construire l'appareil
   commercial lui-même (facturation, inscription publique, admin
   multi-organisations) maintenant.
3. Auto-héberger sur le serveur local de l'utilisateur, à coût 0€
   garanti, avec accès distant possible via un tunnel gratuit.
4. Réduire structurellement le risque de perte de données en usage
   concurrent (voir section Concurrence).

## Non-objectifs (hors périmètre de ce sous-projet)

- **Templates de sous-tâches, rapports sauvegardés, configuration
  Outlook/ICS** — restent sur l'ancien mécanisme pour l'instant,
  migrés dans le sous-projet 2 (parité fonctionnelle).
- **UI d'administration multi-organisations, facturation, inscription
  publique en self-service** — sous-projet 4, pas construit ici. Le
  schéma pose `organization_id` partout pour ne pas fermer la porte,
  mais une seule organisation (celle de l'utilisateur) existe en
  pratique à l'issue de ce sous-projet.
- **Synchronisation temps réel (WebSocket/SSE)** — v1 utilise du
  polling léger ; passer en push est une amélioration ultérieure
  indépendante.
- **Verrouillage optimiste (champ `version`/ETag) sur les tâches** —
  YAGNI tant que le cas réel (deux personnes modifiant le même champ
  à la même seconde) n'est pas observé en pratique.
- **Mode hors-ligne / cache local avec file d'attente de sync** —
  l'app nécessitera une connexion au serveur pour fonctionner ; pas de
  repli local si le serveur est injoignable.

## Architecture

```
┌───────────────────────────────┐
│  To-DoX Electron (client)     │
│  React + Zustand              │
│  Écran de connexion           │
│  Client API (fetch + JWT)     │
└───────────────┬────────────────┘
                │ HTTPS (direct sur LAN, via tunnel si distant)
                │ Authorization: Bearer <JWT>
                ▼
┌──────────────────────────────────────────────┐
│  Serveur local (machine de l'utilisateur)     │
│                                                │
│  ┌──────────────────────────────────────┐    │
│  │ todox-backend (Express + Prisma)      │    │
│  │  /api/auth/*                          │    │
│  │  /api/tasks/*  /api/projects/*        │    │
│  │  /api/comments/*  /api/notifications/*│    │
│  │  /api/time-entries/*  /api/users/*    │    │
│  │  Middleware JWT + scoping organisation│    │
│  └────────────────┬───────────────────────┘   │
│                    │ SQL (Prisma Client)        │
│  ┌────────────────▼───────────────────────┐   │
│  │ PostgreSQL 16 (conteneur Docker)        │   │
│  │ volume Docker persistant                │   │
│  │ pg_dump quotidien → dossier backups     │   │
│  └──────────────────────────────────────────┘  │
│                                                │
│  docker-compose.yml (postgres + backend)      │
│  restart: always (survit reboot/crash)        │
│  Tailscale (accès distant gratuit, sans port  │
│  ouvert ni hébergement payant)                │
└────────────────────────────────────────────────┘
```

Un seul process backend a autorité sur les données : plus de fichier
partagé, plus de course entre écritures concurrentes de plusieurs
clients.

## Modèle de données

Schéma Prisma (remplace `todox-backend/src/db.ts` et son SQL brut).
Types alignés sur [To-DoX/src/types.ts](../../../src/types.ts).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  plan      String   @default("internal") // posé pour usage futur, non exploité en v1
  createdAt DateTime @default(now()) @map("created_at")

  users     User[]
  tasks     Task[]
  projects  Project[]
  comments  Comment[]
  notifications AppNotification[]
  timeEntries   TimeEntry[]

  @@map("organizations")
}

model User {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String       @unique
  passwordHash   String       @map("password_hash")
  name           String
  role           String       @default("member") // 'admin' | 'member'
  createdAt      DateTime     @default(now()) @map("created_at")

  createdTasks     Task[]            @relation("TaskCreator")
  taskAssignments  TaskAssignment[]
  comments         Comment[]
  notifSettings    NotificationSetting?
  timeEntries      TimeEntry[]
  notificationsTo  AppNotification[] @relation("NotifTo")
  notificationsFrom AppNotification[] @relation("NotifFrom")

  @@index([organizationId])
  @@map("users")
}

model Project {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String       // UPPERCASE, comme aujourd'hui (addTask())
  color          Int?
  directory      String?
  sortOrder      Int          @default(0) @map("sort_order") // remplace projectHistory

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("projects")
}

model Task {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  title          String
  project        String       // dénormalisé (nom UPPERCASE), comme le frontend actuel
  due            String?      // YYYY-MM-DD
  priority       String       @default("med")  // 'low' | 'med' | 'high'
  status         String       @default("todo") // 'todo' | 'doing' | 'review' | 'done'
  notes          String       @default("")
  archived       Boolean      @default(false)
  archivedAt     DateTime?    @map("archived_at")
  favorite       Boolean      @default(false)
  deletedAt      DateTime?    @map("deleted_at") // soft-delete, comme aujourd'hui
  order          Int?
  parentTaskId   String?      @map("parent_task_id")

  createdById    String       @map("created_by")
  createdBy      User         @relation("TaskCreator", fields: [createdById], references: [id])
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  completedAt    DateTime?    @map("completed_at")

  // Workflow de révision
  reviewers          String[]  @default([]) // IDs users, stocké en tableau Postgres natif
  reviewValidatedBy  String?   @map("review_validated_by")
  reviewValidatedAt  DateTime? @map("review_validated_at")
  reviewRejectedBy   String?   @map("review_rejected_by")
  reviewRejectedAt   DateTime? @map("review_rejected_at")
  rejectionComment   String?   @map("rejection_comment")
  movedToReviewBy    String?   @map("moved_to_review_by")
  movedToReviewAt    DateTime? @map("moved_to_review_at")

  // Récurrence (JSON simple, structure stable et petite)
  recurrence     Json?

  assignments    TaskAssignment[]
  subtasks       Subtask[]
  comments       Comment[]
  notifications  AppNotification[]

  @@index([organizationId, status])
  @@index([organizationId, project])
  @@map("tasks")
}

model TaskAssignment {
  taskId String @map("task_id")
  userId String @map("user_id")
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([taskId, userId])
  @@map("task_assignments")
}

model Subtask {
  id           String    @id @default(uuid())
  taskId       String    @map("task_id")
  task         Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  title        String
  completed    Boolean   @default(false)
  completedAt  DateTime? @map("completed_at")
  completedBy  String?   @map("completed_by")
  assignedTo   String[]  @default([])
  startDate    String?   @map("start_date")
  endDate      String?   @map("end_date")
  sortOrder    Int       @default(0) @map("sort_order")

  @@index([taskId, sortOrder])
  @@map("subtasks")
}

model Comment {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  taskId         String       @map("task_id")
  task           Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId         String       @map("user_id")
  user           User         @relation(fields: [userId], references: [id])
  text           String
  createdAt      DateTime     @default(now()) @map("created_at")
  deletedAt      DateTime?    @map("deleted_at") // soft-delete

  @@index([taskId])
  @@map("comments")
}

model AppNotification {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  type           String       // AppNotifType
  taskId         String       @map("task_id")
  task           Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskTitle      String       @map("task_title") // dénormalisé, comme aujourd'hui
  fromUserId     String       @map("from_user_id")
  fromUser       User         @relation("NotifFrom", fields: [fromUserId], references: [id])
  toUserId       String       @map("to_user_id")
  toUser         User         @relation("NotifTo", fields: [toUserId], references: [id])
  message        String
  createdAt      DateTime     @default(now()) @map("created_at")
  readAt         DateTime?    @map("read_at")

  @@index([organizationId, toUserId])
  @@map("app_notifications")
}

model TimeEntry {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String       @map("user_id")
  user           User         @relation(fields: [userId], references: [id])
  project        String
  date           String       // YYYY-MM-DD
  hours          Float
  note           String?
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@index([organizationId, userId, date])
  @@map("time_entries")
}

model NotificationSetting {
  userId                  String  @id @map("user_id")
  user                    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled                 Boolean @default(true)
  deadlineNotifications   Boolean @default(true)  @map("deadline_notifications")
  staleTaskNotifications  Boolean @default(true)  @map("stale_task_notifications")
  checkInterval           Int     @default(30)    @map("check_interval")
  quietHoursEnabled       Boolean @default(false) @map("quiet_hours_enabled")
  quietHoursStart         String  @default("20:00") @map("quiet_hours_start")
  quietHoursEnd           String  @default("08:00") @map("quiet_hours_end")
  sound                   Boolean @default(true)
  soundFile               String  @default("default.mp3") @map("sound_file")
  ganttNotifications      Boolean @default(false) @map("gantt_notifications")

  @@map("notification_settings")
}
```

Notes de conception :
- `organizationId` est présent sur toutes les tables métier (sauf
  celles rattachées indirectement via `taskId`/`userId`, où le scoping
  se fait par jointure). Un middleware Prisma (`$extends` ou
  `$use` selon la version) injecte systématiquement le filtre
  `organizationId` déduit du JWT sur chaque requête — objectif :
  qu'il soit *impossible* d'oublier ce filtre dans une route, pas
  seulement une discipline à respecter manuellement.
- `deletedAt`/soft-delete est conservé pour `Task` et `Comment` (déjà
  le pattern actuel, il continue de bien fonctionner en environnement
  multi-client).
- Les tableaux (`reviewers`, `assignedTo`) utilisent le type array
  natif Postgres plutôt qu'une table de jointure, pour rester proches
  du modèle actuel et éviter une explosion de tables de liaison pour
  des champs à faible cardinalité.

## Authentification & autorisation

- Login par email + mot de passe (bcrypt), JWT signé (`JWT_SECRET`
  dans `.env`), envoyé en `Authorization: Bearer` par le client.
- Deux rôles : `admin` (peut créer/désactiver des utilisateurs de son
  organisation) et `member`. Pas de notion d'utilisateur multi-
  organisation en v1.
- Le client Electron stocke le token via `localStorage` (comme le
  brouillon existant dans `SERVER_MIGRATION.md`) ; ré-authentification
  automatique si le token est expiré → écran de connexion.
- Migration : chaque compte issu de `FIXED_USERS` reçoit un mot de
  passe temporaire généré aléatoirement, à changer au premier login
  (flow "mot de passe à changer" simple, pas d'email transactionnel en
  v1 — le mot de passe temporaire est communiqué de vive voix/Slack
  par l'utilisateur qui fait la migration).

## Surface API (v1)

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/change-password

GET    /api/users                       (de mon organisation)
POST   /api/users                       (admin uniquement)

GET    /api/projects
PUT    /api/projects/:name/color
PUT    /api/projects/:name/directory
PUT    /api/projects/:name/order

GET    /api/tasks?archived=&status=
POST   /api/tasks
PUT    /api/tasks/:id                   (PATCH sémantique : ne touche
                                          que les champs fournis)
DELETE /api/tasks/:id                   (soft-delete)
POST   /api/tasks/:id/subtasks
PUT    /api/tasks/:id/subtasks/:subId
DELETE /api/tasks/:id/subtasks/:subId
PATCH  /api/tasks/:id/subtasks/reorder

GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments
DELETE /api/comments/:id                (soft-delete)

GET    /api/notifications
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/read-all

GET    /api/time-entries?from=&to=
POST   /api/time-entries
PUT    /api/time-entries/:id
DELETE /api/time-entries/:id
```

Toutes les routes (sauf `/auth/login`) exigent un JWT valide ; le
middleware en extrait `userId`, `organizationId`, `role`.

## Concurrence & synchronisation

Le point de départ de ce projet : le fichier JSON partagé perdait
silencieusement des modifications en cas d'édition simultanée de la
même tâche (voir diagnostic initial de cette conversation). Avec un
backend qui fait autorité :

- Chaque `PUT /api/tasks/:id` ne modifie que les champs présents dans
  le corps de la requête (déjà le comportement du backend actuel,
  conservé) → si A change `status` et B change `priority` à la même
  seconde, **les deux persistent**, chacun via sa propre transaction
  SQL atomique. Le cas où deux personnes modifient *le même champ* en
  même temps reste tranché en dernier-écrit-gagne, mais en quelques
  millisecondes via une transaction Postgres, plus sur une fenêtre de
  plusieurs secondes sur un fichier réseau.
- Les autres clients voient les changements via un polling léger
  (`GET /api/tasks` toutes les 5-10s, ou au retour de focus fenêtre) —
  pas de WebSocket en v1.
- Pas de verrouillage optimiste (`version`/ETag) en v1 : YAGNI tant
  que des conflits réels de "même champ, même instant" ne sont pas
  observés en usage.

## Gestion des erreurs

- Serveur injoignable / réseau coupé → bandeau d'erreur explicite
  dans l'UI ("Impossible de joindre le serveur"), pas de mode dégradé
  hors-ligne en v1 (voir Non-objectifs).
- Token expiré/invalide (401) → déconnexion automatique, retour à
  l'écran de connexion.
- Erreurs de validation (400) → message d'erreur remonté tel quel
  dans les modals existantes (`alertModal`).

## Déploiement

- `docker-compose.yml` à la racine de `todox-backend/` avec deux
  services : `postgres` (image officielle, volume nommé persistant)
  et `backend` (build de `todox-backend`), tous deux en
  `restart: always`.
- Backup : job cron (ou tâche planifiée Windows) exécutant
  `pg_dump` quotidien vers un dossier local, rotation sur les 14
  derniers jours (remplace le mécanisme actuel de 5 backups JSON
  timestampés dans `electron.js`).
- Accès distant : Tailscale installé sur le serveur local et sur les
  postes clients qui en ont besoin — le client Electron pointe alors
  sur l'IP Tailscale du serveur (`VITE_API_URL`), sans port ouvert sur
  la box/le pare-feu, sans coût.

## Migration des données existantes

Script ponctuel (`todox-backend/scripts/migrate-from-json.ts`) :
1. Lit le `data.json` + `comments.json` OneDrive actuels.
2. Crée une `Organization` (ex. "Conception EA").
3. Crée un `User` par entrée de `FIXED_USERS` (hors `unassigned`),
   avec mot de passe temporaire aléatoire.
4. Importe tasks, subtasks, assignments, comments, appNotifications,
   timeEntries, projectColors/directories/projectHistory →
   `Project`.
5. Rapport de fin : nombre d'éléments migrés par type, mots de passe
   temporaires générés (à communiquer manuellement).

## Suppression d'OneDrive

Fichiers impactés (constatés par recherche dans le repo) :
- [To-DoX/electron.js](../../../electron.js) — retrait de
  `getDefaultOneDrivePath()` et des handlers IPC `get-storage-path`,
  `read-data`, `save-data`, `get-file-hash` (le process Electron ne
  gère plus de fichier de données du tout).
- [To-DoX/src/hooks/useDataPersistence.ts](../../../src/hooks/useDataPersistence.ts)
  et les 3 sous-hooks (`useLoadData`, `useSyncPolling`,
  `usePersistSave`) — remplacés par un client API + polling.
- [To-DoX/src/components/settings/StoragePanel.tsx](../../../src/components/settings/StoragePanel.tsx)
  — devient un écran de compte/connexion (URL du serveur, session).
- `To-DoX/cea-app.json`, `README.md`, `docs/BUGS_A_CORRIGER.md`,
  `docs/IMPROVEMENTS.md`, stories Storybook, `.storybook/preview.ts`
  — références cosmétiques/doc à nettoyer en fin de sous-projet.
- Ce `CLAUDE.md` (racine et `To-DoX/CLAUDE.md`) — sections
  "Persistence" et "Default OneDrive path" à réécrire une fois le
  sous-projet livré.

## Tests

- Backend : tests de routes (vitest + supertest) contre une base
  Postgres de test (conteneur Docker dédié en CI et en local),
  couvrant en priorité le scoping par organisation (un user d'une
  org ne doit jamais voir/modifier les données d'une autre) et la
  sémantique PATCH partielle sur les tâches.
- Frontend : les tests existants du store (`useStore.test.ts`) qui
  supposent une mutation synchrone directe devront être adaptés — les
  actions (`addTask`, `updateTask`, ...) appellent désormais l'API et
  mettent à jour le state de façon asynchrone ; mock du client API
  dans les tests plutôt que mock de `window.electronAPI`.

## Suite (hors périmètre, sous-projets suivants)

2. **Parité fonctionnelle** — templates, rapports sauvegardés, config
   Outlook/ICS migrés vers l'API.
3. **Déploiement affiné** — durcissement du Docker Compose, monitoring
   basique, documentation d'exploitation.
4. **Appareil commercial** — UI d'administration multi-organisations,
   facturation, inscription publique en self-service.
