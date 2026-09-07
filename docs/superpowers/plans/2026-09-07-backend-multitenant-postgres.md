# Backend multi-tenant Postgres — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le squelette `todox-backend` (Express + better-sqlite3, non branché) par une API multi-tenant complète (Postgres + Prisma + JWT) couvrant tasks/subtasks/projets/commentaires/notifications/time entries, auto-hébergeable à coût 0€.

**Architecture:** Express + Prisma Client (Postgres), auth JWT, scoping multi-tenant automatique via une extension Prisma + `AsyncLocalStorage` (impossible d'oublier le filtre `organizationId`). Un seul process backend fait autorité sur les données — plus de fichier partagé.

**Tech Stack:** Express, Prisma, PostgreSQL 16 (Docker), jsonwebtoken, bcryptjs, vitest + supertest.

**Spec:** [docs/superpowers/specs/2026-09-07-multitenant-postgres-backend-design.md](../specs/2026-09-07-multitenant-postgres-backend-design.md)

## Global Constraints

- Coût d'hébergement : 0€, auto-hébergé (pas d'AWS). Postgres 16 via Docker, `restart: always`.
- Toutes les tables métier avec colonne `organizationId` (`User`, `Task`, `Project`, `Comment`, `AppNotification`, `TimeEntry`) sont scopées **automatiquement** par le client Prisma étendu (`db` dans `src/lib/prismaClient.ts`) sur `findFirst/findMany/update/updateMany/delete/deleteMany/count` — **jamais** sur `create` (organizationId doit être passé explicitement dans `data`).
- `findUnique` est **interdit** sur les modèles org-scopés (l'extension le bloque avec une erreur explicite) — utiliser `findFirst`.
- Les modèles sans colonne `organizationId` propre (`Subtask`, `TaskAssignment`, `NotificationSetting`) se scopent **par leur parent** : vérifier d'abord que le `Task`/`User` parent appartient à l'org courante, puis systématiquement utiliser un `where` composé (`{ id, taskId }`, jamais `{ id }` seul) sur les mutations pour empêcher qu'un ID deviné d'une autre organisation soit modifié.
- JWT (`Authorization: Bearer <token>`) exigé sur toutes les routes sauf `POST /api/auth/login`, via le middleware `requireAuth`.
- Sémantique PATCH partout : les routes de mise à jour ne modifient que les champs présents dans le corps de la requête.
- Tous les messages d'erreur API sont en français, cohérent avec le reste du projet.
- Pas de WebSocket, pas de verrouillage optimiste, pas de mode hors-ligne (non-objectifs explicites de la spec).

---

### Task 1: Environnement de dev (Docker Postgres + Prisma + squelette Express testable)

**Files:**
- Create: `todox-backend/docker/init-multiple-dbs.sh`
- Create: `todox-backend/docker-compose.yml`
- Create: `todox-backend/.env.example`
- Create: `todox-backend/.env` (local, non commité — déjà dans `.gitignore`)
- Create: `todox-backend/prisma/schema.prisma`
- Create: `todox-backend/src/app.ts`
- Modify: `todox-backend/src/index.ts` (remplace le contenu existant)
- Modify: `todox-backend/package.json` (deps, scripts)
- Create: `todox-backend/vitest.config.ts`
- Create: `todox-backend/tests/setup.ts`
- Create: `todox-backend/tests/health.test.ts`
- Create: `todox-backend/tests/db.test.ts`
- Delete: `todox-backend/src/db.ts` (ancien SQLite, remplacé par Prisma)
- Delete: `todox-backend/src/middleware.ts` (ancien header X-User-Id, remplacé par JWT au Task 3)
- Delete: `todox-backend/migrate.ts` (ancien script SQLite, remplacé au Task 11)
- Delete: `todox-backend/src/routes/tasks.ts`, `todox-backend/src/routes/projects.ts` (réécrits Prisma aux Tasks 5-6)
- Delete: `todox-backend/todox.db`, `todox-backend/todox.db-shm`, `todox-backend/todox.db-wal` (déjà ignorés par git, à supprimer du disque)

**Interfaces:**
- Produces: `createApp(): express.Express` (exporté depuis `src/app.ts`, sans `.listen()` — consommé par toutes les tasks suivantes pour monter des routers, et par les tests via `supertest`).
- Produces: `PrismaClient` généré dans `node_modules/.prisma` (consommé par `src/lib/prismaClient.ts` au Task 3).

- [ ] **Step 1: Nettoyer l'ancien squelette et installer les nouvelles dépendances**

```bash
cd "C:\DEV\TO DO X\todox-backend"
rm -f src/db.ts src/middleware.ts migrate.ts src/routes/tasks.ts src/routes/projects.ts
rm -f todox.db todox.db-shm todox.db-wal
npm uninstall better-sqlite3 @types/better-sqlite3
npm install @prisma/client bcryptjs jsonwebtoken dotenv cors express
npm install -D prisma @types/bcryptjs @types/jsonwebtoken @types/cors @types/express @types/node typescript tsx vitest supertest @types/supertest
```

- [ ] **Step 2: Mettre à jour `package.json` (scripts)**

```json
{
  "name": "todox-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "postinstall": "prisma generate",
    "migrate": "tsx scripts/migrate-from-json.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Garder les `dependencies`/`devDependencies` telles qu'installées par npm à l'étape 1 (ne pas les retaper à la main, `npm install` a déjà mis à jour le fichier).

- [ ] **Step 3: Créer le script d'init Postgres (deux bases : dev + test)**

```bash
# todox-backend/docker/init-multiple-dbs.sh
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE todox_test;
EOSQL
```

- [ ] **Step 4: Créer `docker-compose.yml` (Postgres de dev) et démarrer le conteneur**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: todox
      POSTGRES_PASSWORD: todox_dev_password
      POSTGRES_DB: todox
    ports:
      - "5433:5432"
    volumes:
      - todox_pg_data:/var/lib/postgresql/data
      - ./docker/init-multiple-dbs.sh:/docker-entrypoint-initdb.d/init-multiple-dbs.sh

volumes:
  todox_pg_data:
```

Run: `docker compose up -d`
Expected: `docker compose ps` montre `postgres` avec le statut `running`/`healthy`.

- [ ] **Step 5: Créer `.env.example` et `.env`**

```env
# todox-backend/.env.example
DATABASE_URL="postgresql://todox:todox_dev_password@localhost:5433/todox"
DATABASE_URL_TEST="postgresql://todox:todox_dev_password@localhost:5433/todox_test"
JWT_SECRET="change-me-to-a-long-random-string"
JWT_EXPIRATION="7d"
PORT=3001
```

Copier ce fichier en `.env` (mêmes valeurs, c'est un environnement de dev local donc pas besoin de secrets différents à ce stade) :

```bash
cp .env.example .env
```

- [ ] **Step 6: Écrire le schéma Prisma complet**

```prisma
// todox-backend/prisma/schema.prisma
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
  plan      String   @default("internal")
  createdAt DateTime @default(now()) @map("created_at")

  users         User[]
  tasks         Task[]
  projects      Project[]
  comments      Comment[]
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
  role           String       @default("member")
  createdAt      DateTime     @default(now()) @map("created_at")

  createdTasks      Task[]                @relation("TaskCreator")
  taskAssignments   TaskAssignment[]
  comments          Comment[]
  notifSettings     NotificationSetting?
  timeEntries       TimeEntry[]
  notificationsTo   AppNotification[]     @relation("NotifTo")
  notificationsFrom AppNotification[]     @relation("NotifFrom")

  @@index([organizationId])
  @@map("users")
}

model Project {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  color          Int?
  directory      String?
  sortOrder      Int          @default(0) @map("sort_order")

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("projects")
}

model Task {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  title        String
  project      String
  due          String?
  priority     String    @default("med")
  status       String    @default("todo")
  notes        String    @default("")
  archived     Boolean   @default(false)
  archivedAt   DateTime? @map("archived_at")
  favorite     Boolean   @default(false)
  deletedAt    DateTime? @map("deleted_at")
  order        Int?
  parentTaskId String?   @map("parent_task_id")

  createdById String   @map("created_by")
  createdBy   User     @relation("TaskCreator", fields: [createdById], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  completedAt DateTime? @map("completed_at")

  reviewers         String[]  @default([])
  reviewValidatedBy String?   @map("review_validated_by")
  reviewValidatedAt DateTime? @map("review_validated_at")
  reviewRejectedBy  String?   @map("review_rejected_by")
  reviewRejectedAt  DateTime? @map("review_rejected_at")
  rejectionComment  String?   @map("rejection_comment")
  movedToReviewBy   String?   @map("moved_to_review_by")
  movedToReviewAt   DateTime? @map("moved_to_review_at")

  recurrence Json?

  assignments   TaskAssignment[]
  subtasks      Subtask[]
  comments      Comment[]
  notifications AppNotification[]

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
  id          String    @id @default(uuid())
  taskId      String    @map("task_id")
  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  title       String
  completed   Boolean   @default(false)
  createdAt   DateTime  @default(now()) @map("created_at")
  completedAt DateTime? @map("completed_at")
  completedBy String?   @map("completed_by")
  assignedTo  String[]  @default([])
  startDate   String?   @map("start_date")
  endDate     String?   @map("end_date")
  sortOrder   Int       @default(0) @map("sort_order")

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
  deletedAt      DateTime?    @map("deleted_at")

  @@index([taskId])
  @@map("comments")
}

model AppNotification {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  type           String
  taskId         String       @map("task_id")
  task           Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskTitle      String       @map("task_title")
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
  date           String
  hours          Float
  note           String?
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@index([organizationId, userId, date])
  @@map("time_entries")
}

model NotificationSetting {
  userId                 String  @id @map("user_id")
  user                   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled                Boolean @default(true)
  deadlineNotifications  Boolean @default(true) @map("deadline_notifications")
  staleTaskNotifications Boolean @default(true) @map("stale_task_notifications")
  checkInterval          Int     @default(30) @map("check_interval")
  quietHoursEnabled      Boolean @default(false) @map("quiet_hours_enabled")
  quietHoursStart        String  @default("20:00") @map("quiet_hours_start")
  quietHoursEnd          String  @default("08:00") @map("quiet_hours_end")
  sound                  Boolean @default(true)
  soundFile              String  @default("default.mp3") @map("sound_file")
  ganttNotifications     Boolean @default(false) @map("gantt_notifications")

  @@map("notification_settings")
}
```

- [ ] **Step 7: Générer la première migration**

Run: `npx prisma migrate dev --name init`
Expected: la commande crée `prisma/migrations/<timestamp>_init/`, applique le schéma sur la base `todox` (via `DATABASE_URL`), et affiche `Your database is now in sync with your schema.`

- [ ] **Step 8: Créer `src/app.ts` (factory Express sans `.listen()`)**

```ts
// todox-backend/src/app.ts
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
```

- [ ] **Step 9: Réécrire `src/index.ts`**

```ts
// todox-backend/src/index.ts
import 'dotenv/config';
import { createApp } from './app';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`To-DoX Backend — http://localhost:${PORT}`);
});
```

- [ ] **Step 10: Config vitest + setup**

```ts
// todox-backend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
  },
});
```

```ts
// todox-backend/tests/setup.ts
import 'dotenv/config';
```

- [ ] **Step 11: Écrire les tests (santé de l'app + branchement Prisma/Postgres)**

```ts
// todox-backend/tests/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

```ts
// todox-backend/tests/db.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });

describe('Prisma + Postgres wiring', () => {
  it('can create and read an organization', async () => {
    const org = await prisma.organization.create({ data: { name: 'Test Org' } });
    const found = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(found?.name).toBe('Test Org');
    await prisma.organization.delete({ where: { id: org.id } });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

`db.test.ts` cible `DATABASE_URL_TEST` (base `todox_test`) — il faut lui appliquer le schéma aussi :

Run: `npx prisma migrate deploy` avec `DATABASE_URL` temporairement pointé sur `todox_test`, ou plus simple : `DATABASE_URL="postgresql://todox:todox_dev_password@localhost:5433/todox_test" npx prisma migrate deploy`
Expected : migration appliquée sur `todox_test` aussi.

- [ ] **Step 12: Lancer les tests**

Run: `npm test`
Expected: 2 fichiers de test, tous PASS.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: environnement Postgres+Prisma+Express testable (remplace better-sqlite3)"
```

---

### Task 2: Utilitaires auth (hash mot de passe + JWT)

**Files:**
- Create: `todox-backend/src/lib/password.ts`
- Create: `todox-backend/src/lib/jwt.ts`
- Test: `todox-backend/tests/password.test.ts`
- Test: `todox-backend/tests/jwt.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` — consommés par Task 4 (auth routes) et Task 11 (migration).
- Produces: `TokenPayload { userId: string; organizationId: string; role: string }`, `signToken(payload: TokenPayload): string`, `verifyToken(token: string): TokenPayload` — consommés par Task 3 (middleware) et Task 4 (login).

- [ ] **Step 1: Écrire les tests des utilitaires mot de passe**

```ts
// todox-backend/tests/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';

describe('password utils', () => {
  it('hash produces a different string than the plain password', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
  });

  it('verifyPassword returns true for the correct password', async () => {
    const hash = await hashPassword('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
  });

  it('verifyPassword returns false for the wrong password', async () => {
    const hash = await hashPassword('secret123');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- password`
Expected: FAIL — `Cannot find module '../src/lib/password'`

- [ ] **Step 3: Implémenter `src/lib/password.ts`**

```ts
// todox-backend/src/lib/password.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run — vérifier le succès**

Run: `npm test -- password`
Expected: PASS (3 tests)

- [ ] **Step 5: Écrire les tests JWT**

```ts
// todox-backend/tests/jwt.test.ts
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../src/lib/jwt';

describe('jwt utils', () => {
  it('signToken then verifyToken round-trips the payload', () => {
    const payload = { userId: 'u1', organizationId: 'o1', role: 'member' };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.organizationId).toBe('o1');
    expect(decoded.role).toBe('member');
  });

  it('verifyToken throws on a tampered token', () => {
    const token = signToken({ userId: 'u1', organizationId: 'o1', role: 'member' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyToken(tampered)).toThrow();
  });
});
```

- [ ] **Step 6: Run — vérifier l'échec**

Run: `npm test -- jwt`
Expected: FAIL — `Cannot find module '../src/lib/jwt'`

- [ ] **Step 7: Implémenter `src/lib/jwt.ts`**

```ts
// todox-backend/src/lib/jwt.ts
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  organizationId: string;
  role: string;
}

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET manquant dans .env');
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRATION || '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
```

- [ ] **Step 8: Run — vérifier le succès**

Run: `npm test -- jwt`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/password.ts src/lib/jwt.ts tests/password.test.ts tests/jwt.test.ts
git commit -m "feat: utilitaires hash mot de passe + JWT"
```

---

### Task 3: Contexte de requête + client Prisma scopé par organisation + middleware auth

**Files:**
- Create: `todox-backend/src/lib/context.ts`
- Create: `todox-backend/src/lib/prismaClient.ts`
- Create: `todox-backend/src/middleware/auth.ts`
- Create: `todox-backend/src/middleware/requireAdmin.ts`
- Create: `todox-backend/tests/helpers/testDb.ts`
- Test: `todox-backend/tests/prismaClient.test.ts`
- Test: `todox-backend/tests/authMiddleware.test.ts`

**Interfaces:**
- Consumes: `TokenPayload`, `signToken`, `verifyToken` (Task 2).
- Produces: `requestContext: AsyncLocalStorage<RequestContext>`, `getContext(): RequestContext` — consommés par `prismaClient.ts` lui-même et disponibles pour toute logique métier qui a besoin du contexte hors `req`.
- Produces: `db` (client Prisma étendu, scoping automatique) — consommé par **toutes** les routes des Tasks 4 à 10.
- Produces: `requireAuth` (middleware Express, pose `req.userId/organizationId/role` + fait tourner la suite de la requête dans le contexte async) et `AuthedRequest` (type) — consommés par toutes les routes protégées.
- Produces: `requireAdmin` (middleware Express) — consommé par Task 4 (création d'utilisateurs).
- Produces: `resetDb(): Promise<void>`, `rawDb` (client Prisma non étendu, pointé sur `DATABASE_URL_TEST`) — consommés par les tests de toutes les tasks suivantes pour seed/cleanup.

- [ ] **Step 1: Écrire le test du contexte + de l'extension de scoping**

```ts
// todox-backend/tests/prismaClient.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { requestContext } from '../src/lib/context';
import { db } from '../src/lib/prismaClient';
import { rawDb, resetDb } from './helpers/testDb';

describe('org-scoped Prisma client', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await rawDb.$disconnect();
  });

  it('scopes findMany to the organization in the async context', async () => {
    const orgA = await rawDb.organization.create({ data: { name: 'Org A' } });
    const orgB = await rawDb.organization.create({ data: { name: 'Org B' } });
    const userA = await rawDb.user.create({
      data: { organizationId: orgA.id, email: 'a@test.com', name: 'A', passwordHash: 'x' },
    });
    await rawDb.task.create({
      data: { organizationId: orgA.id, title: 'Tâche A', project: 'X', createdById: userA.id },
    });
    const userB = await rawDb.user.create({
      data: { organizationId: orgB.id, email: 'b@test.com', name: 'B', passwordHash: 'x' },
    });
    await rawDb.task.create({
      data: { organizationId: orgB.id, title: 'Tâche B', project: 'X', createdById: userB.id },
    });

    const tasksSeenByOrgA = await requestContext.run(
      { userId: userA.id, organizationId: orgA.id, role: 'member' },
      () => db.task.findMany({})
    );

    expect(tasksSeenByOrgA).toHaveLength(1);
    expect(tasksSeenByOrgA[0].title).toBe('Tâche A');
  });

  it('rejects findUnique on an org-scoped model', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'u@test.com', name: 'U', passwordHash: 'x' },
    });

    await expect(
      requestContext.run({ userId: user.id, organizationId: org.id, role: 'member' }, () =>
        db.task.findUnique({ where: { id: 'whatever' } })
      )
    ).rejects.toThrow(/findUnique interdit/);
  });
});
```

- [ ] **Step 2: Créer le helper de test (`rawDb` + `resetDb`)**

```ts
// todox-backend/tests/helpers/testDb.ts
import { PrismaClient } from '@prisma/client';

export const rawDb = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });

export async function resetDb() {
  await rawDb.$transaction([
    rawDb.appNotification.deleteMany(),
    rawDb.comment.deleteMany(),
    rawDb.timeEntry.deleteMany(),
    rawDb.taskAssignment.deleteMany(),
    rawDb.subtask.deleteMany(),
    rawDb.task.deleteMany(),
    rawDb.project.deleteMany(),
    rawDb.notificationSetting.deleteMany(),
    rawDb.user.deleteMany(),
    rawDb.organization.deleteMany(),
  ]);
}
```

- [ ] **Step 3: Run — vérifier l'échec**

Run: `npm test -- prismaClient`
Expected: FAIL — `Cannot find module '../src/lib/context'` (ou `prismaClient`)

- [ ] **Step 4: Implémenter `src/lib/context.ts`**

```ts
// todox-backend/src/lib/context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  userId: string;
  organizationId: string;
  role: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx) {
    throw new Error('Aucun contexte de requête actif (hors middleware requireAuth ?)');
  }
  return ctx;
}
```

- [ ] **Step 5: Implémenter `src/lib/prismaClient.ts`**

```ts
// todox-backend/src/lib/prismaClient.ts
import { PrismaClient } from '@prisma/client';
import { requestContext } from './context';

const ORG_SCOPED_MODELS = new Set(['User', 'Task', 'Project', 'Comment', 'AppNotification', 'TimeEntry']);
const SCOPED_OPERATIONS = new Set(['findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count']);

const basePrisma = new PrismaClient();

export const db = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = requestContext.getStore();

        if (operation === 'findUnique' && ctx && ORG_SCOPED_MODELS.has(model as string)) {
          throw new Error(`findUnique interdit sur ${model} (scoping impossible) — utiliser findFirst`);
        }

        if (ctx && ORG_SCOPED_MODELS.has(model as string) && SCOPED_OPERATIONS.has(operation)) {
          (args as { where?: Record<string, unknown> }).where = {
            ...(args as { where?: Record<string, unknown> }).where,
            organizationId: ctx.organizationId,
          };
        }

        return query(args);
      },
    },
  },
});
```

- [ ] **Step 6: Run — vérifier le succès**

Run: `npm test -- prismaClient`
Expected: PASS (2 tests)

- [ ] **Step 7: Écrire le test du middleware auth**

```ts
// todox-backend/tests/authMiddleware.test.ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../src/middleware/auth';
import { signToken } from '../src/lib/jwt';

function buildTestApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ userId: (req as any).userId, organizationId: (req as any).organizationId });
  });
  return app;
}

describe('requireAuth', () => {
  it('rejects a request without a token', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('accepts a request with a valid token and exposes userId/organizationId', async () => {
    const token = signToken({ userId: 'u1', organizationId: 'o1', role: 'member' });
    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'u1', organizationId: 'o1' });
  });
});
```

- [ ] **Step 8: Run — vérifier l'échec**

Run: `npm test -- authMiddleware`
Expected: FAIL — `Cannot find module '../src/middleware/auth'`

- [ ] **Step 9: Implémenter `src/middleware/auth.ts` et `src/middleware/requireAdmin.ts`**

```ts
// todox-backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { requestContext } from '../lib/context';

export interface AuthedRequest extends Request {
  userId?: string;
  organizationId?: string;
  role?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.organizationId = payload.organizationId;
    req.role = payload.role;
    requestContext.run(
      { userId: payload.userId, organizationId: payload.organizationId, role: payload.role },
      next
    );
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}
```

```ts
// todox-backend/src/middleware/requireAdmin.ts
import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux administrateurs' });
  }
  next();
}
```

- [ ] **Step 10: Run — vérifier le succès**

Run: `npm test -- authMiddleware`
Expected: PASS (3 tests)

- [ ] **Step 11: Run l'ensemble de la suite**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/context.ts src/lib/prismaClient.ts src/middleware/ tests/prismaClient.test.ts tests/authMiddleware.test.ts tests/helpers/testDb.ts
git commit -m "feat: scoping multi-tenant automatique (Prisma extension) + middleware JWT"
```

---

### Task 4: Routes auth + users

**Files:**
- Create: `todox-backend/src/routes/auth.ts`
- Create: `todox-backend/src/routes/users.ts`
- Modify: `todox-backend/src/app.ts` (monte les deux routers)
- Create: `todox-backend/tests/helpers/auth.ts`
- Test: `todox-backend/tests/routes/auth.test.ts`
- Test: `todox-backend/tests/routes/users.test.ts`

**Interfaces:**
- Consumes: `db` (Task 3), `requireAuth`/`requireAdmin`/`AuthedRequest` (Task 3), `hashPassword`/`verifyPassword` (Task 2), `signToken` (Task 2), `rawDb`/`resetDb` (Task 3).
- Produces: `tokenFor(user): string` (helper de test) — consommé par les tests de toutes les tasks suivantes pour authentifier les requêtes supertest.
- Produces routes : `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password`, `GET /api/users`, `POST /api/users` (admin).

- [ ] **Step 1: Créer le helper de test pour générer un token**

```ts
// todox-backend/tests/helpers/auth.ts
import { signToken } from '../../src/lib/jwt';

export function tokenFor(user: { id: string; organizationId: string; role: string }) {
  return signToken({ userId: user.id, organizationId: user.organizationId, role: user.role });
}
```

- [ ] **Step 2: Écrire les tests des routes auth**

```ts
// todox-backend/tests/routes/auth.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { hashPassword } from '../../src/lib/password';
import { tokenFor } from '../helpers/auth';

describe('POST /api/auth/login', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  it('returns a token for valid credentials', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    await rawDb.user.create({
      data: {
        organizationId: org.id,
        email: 'a@test.com',
        name: 'A',
        role: 'member',
        passwordHash: await hashPassword('secret123'),
      },
    });

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'a@test.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('a@test.com');
  });

  it('rejects a wrong password', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    await rawDb.user.create({
      data: {
        organizationId: org.id,
        email: 'a@test.com',
        name: 'A',
        role: 'member',
        passwordHash: await hashPassword('secret123'),
      },
    });

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'a@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  it('returns the authenticated user', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'a@test.com', name: 'A', role: 'member', passwordHash: 'x' },
    });

    const res = await request(createApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor({ id: user.id, organizationId: org.id, role: 'member' })}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@test.com');
  });
});
```

- [ ] **Step 3: Écrire les tests des routes users**

```ts
// todox-backend/tests/routes/users.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('GET /api/users', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  it("only lists users from the caller's organization", async () => {
    const orgA = await rawDb.organization.create({ data: { name: 'Org A' } });
    const orgB = await rawDb.organization.create({ data: { name: 'Org B' } });
    const userA = await rawDb.user.create({
      data: { organizationId: orgA.id, email: 'a@test.com', name: 'A', role: 'member', passwordHash: 'x' },
    });
    await rawDb.user.create({
      data: { organizationId: orgB.id, email: 'b@test.com', name: 'B', role: 'member', passwordHash: 'x' },
    });

    const res = await request(createApp())
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor({ id: userA.id, organizationId: orgA.id, role: 'member' })}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe('a@test.com');
  });
});

describe('POST /api/users', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  it('rejects creation by a non-admin', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const member = await rawDb.user.create({
      data: { organizationId: org.id, email: 'm@test.com', name: 'M', role: 'member', passwordHash: 'x' },
    });

    const res = await request(createApp())
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor({ id: member.id, organizationId: org.id, role: 'member' })}`)
      .send({ email: 'new@test.com', name: 'New', password: 'secret123' });

    expect(res.status).toBe(403);
  });

  it('allows an admin to create a user in their organization', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const admin = await rawDb.user.create({
      data: { organizationId: org.id, email: 'admin@test.com', name: 'Admin', role: 'admin', passwordHash: 'x' },
    });

    const res = await request(createApp())
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor({ id: admin.id, organizationId: org.id, role: 'admin' })}`)
      .send({ email: 'new@test.com', name: 'New', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@test.com');
    expect(res.body.role).toBe('member');
  });
});
```

- [ ] **Step 4: Run — vérifier l'échec**

Run: `npm test -- routes/auth routes/users`
Expected: FAIL — routes non montées / modules introuvables.

- [ ] **Step 5: Implémenter `src/routes/auth.ts`**

```ts
// todox-backend/src/routes/auth.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  // Pas encore de contexte de requête à ce stade (requireAuth n'a pas tourné) :
  // ce findFirst n'est donc pas scopé par organisation, ce qui est voulu —
  // on ne connaît pas encore l'organisation de l'utilisateur qui se connecte.
  const user = await db.user.findFirst({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = signToken({ userId: user.id, organizationId: user.organizationId, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await db.user.findFirst({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau (8 caractères min) requis' });
  }

  const user = await db.user.findFirst({ where: { id: req.userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 6: Implémenter `src/routes/users.ts`**

```ts
// todox-backend/src/routes/users.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { hashPassword } from '../lib/password';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req: AuthedRequest, res) => {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.post('/', requireAdmin, async (req: AuthedRequest, res) => {
  const { email, name, password, role } = req.body ?? {};
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name et password sont requis' });
  }

  const existing = await db.user.findFirst({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email déjà utilisé' });
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      role: role === 'admin' ? 'admin' : 'member',
      passwordHash: await hashPassword(password),
      organizationId: req.organizationId!,
    },
  });

  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

export default router;
```

- [ ] **Step 7: Monter les routers dans `src/app.ts`**

```ts
// todox-backend/src/app.ts
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);

  return app;
}
```

- [ ] **Step 8: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 9: Commit**

```bash
git add src/routes/auth.ts src/routes/users.ts src/app.ts tests/routes/ tests/helpers/auth.ts
git commit -m "feat: routes auth (login/me/change-password) + users (list/create admin)"
```

---

### Task 5: Routes projects (couleur, dossier, ordre)

**Files:**
- Create: `todox-backend/src/routes/projects.ts`
- Modify: `todox-backend/src/app.ts` (monte le router)
- Test: `todox-backend/tests/routes/projects.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (Task 3), `rawDb`/`resetDb` (Task 3), `tokenFor` (Task 4).
- Produces routes : `GET /api/projects`, `PUT /api/projects/:name/color`, `PUT /api/projects/:name/directory`, `DELETE /api/projects/:name/directory`, `PUT /api/projects/:name/order`.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/projects.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('projects routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupOrgWithUser() {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'u@test.com', name: 'U', role: 'member', passwordHash: 'x' },
    });
    return { org, token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }) };
  }

  it('creates the project on first color update and lists it after', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const put = await request(app)
      .put('/api/projects/ACME/color')
      .set('Authorization', `Bearer ${token}`)
      .send({ color: 3 });
    expect(put.status).toBe(200);

    const list = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: 'ACME', color: 3 });
  });

  it('only lists projects from the caller organization', async () => {
    const { token: tokenA } = await setupOrgWithUser();
    const { org: orgB } = await setupOrgWithUser();
    await rawDb.project.create({ data: { organizationId: orgB.id, name: 'AUTRE' } });

    const res = await request(createApp()).get('/api/projects').set('Authorization', `Bearer ${tokenA}`);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/projects`
Expected: FAIL — module/route introuvable.

- [ ] **Step 3: Implémenter `src/routes/projects.ts`**

```ts
// todox-backend/src/routes/projects.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function upsertProject(organizationId: string, name: string) {
  const existing = await db.project.findFirst({ where: { name } });
  if (existing) return existing;
  return db.project.create({ data: { organizationId, name } });
}

router.get('/', async (_req, res) => {
  const projects = await db.project.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(projects);
});

router.put('/:name/color', async (req: AuthedRequest, res) => {
  const name = decodeURIComponent(req.params.name).toUpperCase();
  const { color } = req.body ?? {};
  const project = await upsertProject(req.organizationId!, name);
  await db.project.update({ where: { id: project.id }, data: { color } });
  res.json({ ok: true });
});

router.put('/:name/directory', async (req: AuthedRequest, res) => {
  const name = decodeURIComponent(req.params.name).toUpperCase();
  const { directory } = req.body ?? {};
  const project = await upsertProject(req.organizationId!, name);
  await db.project.update({ where: { id: project.id }, data: { directory } });
  res.json({ ok: true });
});

router.delete('/:name/directory', async (req: AuthedRequest, res) => {
  const name = decodeURIComponent(req.params.name).toUpperCase();
  const project = await upsertProject(req.organizationId!, name);
  await db.project.update({ where: { id: project.id }, data: { directory: null } });
  res.json({ ok: true });
});

router.put('/:name/order', async (req: AuthedRequest, res) => {
  const name = decodeURIComponent(req.params.name).toUpperCase();
  const { order } = req.body ?? {};
  const project = await upsertProject(req.organizationId!, name);
  await db.project.update({ where: { id: project.id }, data: { sortOrder: order ?? 0 } });
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import projectsRoutes from './routes/projects';
// ...
app.use('/api/projects', projectsRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/projects.ts src/app.ts tests/routes/projects.test.ts
git commit -m "feat: routes projects (couleur, dossier, ordre)"
```

---

### Task 6: Routes tasks (CRUD, sémantique PATCH, workflow de révision → notifications)

**Files:**
- Create: `todox-backend/src/routes/tasks.ts`
- Modify: `todox-backend/src/app.ts` (monte le router)
- Test: `todox-backend/tests/routes/tasks.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (Task 3), `rawDb`/`resetDb` (Task 3), `tokenFor` (Task 4).
- Produces: `formatTask(task): object` (exporté depuis `src/routes/tasks.ts`, usage interne à cette task uniquement — pas réimporté ailleurs dans ce plan).
- Produces routes : `GET /api/tasks`, `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`. `PUT` déclenche la création d'`AppNotification` lors des transitions du workflow de révision (`reviewers` posé, `reviewValidatedBy`/`reviewRejectedBy` posés).

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/tasks.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('tasks routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupOrgWithUser(email = 'u@test.com') {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email, name: 'U', role: 'member', passwordHash: 'x' },
    });
    return { org, user, token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }) };
  }

  it('creates a task and lists it back', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Écrire le plan', project: 'todox' });
    expect(created.status).toBe(201);
    expect(created.body.project).toBe('TODOX');

    const list = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });

  it('a PUT only changes the fields provided (semantique PATCH)', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Titre', project: 'X', priority: 'high' });

    const updated = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'doing' });

    expect(updated.body.status).toBe('doing');
    expect(updated.body.priority).toBe('high'); // inchangé
  });

  it('sets completedAt automatically when status becomes done', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Titre', project: 'X' });

    const updated = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' });

    expect(updated.body.completedAt).toBeTruthy();
  });

  it('creates a review_requested notification when reviewers are assigned', async () => {
    const { token: creatorToken } = await setupOrgWithUser('creator@test.com');
    const { org, user: reviewer } = await setupOrgWithUser('reviewer@test.com');
    const app = createApp();

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ title: 'À réviser', project: 'X' });

    await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ reviewers: [reviewer.id] });

    const notifs = await rawDb.appNotification.findMany({ where: { toUserId: reviewer.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('review_requested');
  });

  it('returns 404 for a task belonging to another organization', async () => {
    const { token: tokenA } = await setupOrgWithUser('a@test.com');
    const { token: tokenB } = await setupOrgWithUser('b@test.com');
    const app = createApp();

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Privée', project: 'X' });

    const res = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'doing' });

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/tasks`
Expected: FAIL — module/route introuvable.

- [ ] **Step 3: Implémenter `src/routes/tasks.ts`**

```ts
// todox-backend/src/routes/tasks.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res) => {
  const showArchived = req.query.archived === 'true';
  const tasks = await db.task.findMany({
    where: { archived: showArchived ? undefined : false, deletedAt: null },
    include: { assignments: true, subtasks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks.map(formatTask));
});

router.post('/', async (req: AuthedRequest, res) => {
  const { title, project, status, priority, due, notes, assignedTo, favorite } = req.body ?? {};
  if (!title || !project) {
    return res.status(400).json({ error: 'title et project sont requis' });
  }

  const userIds: string[] = assignedTo?.length ? assignedTo : [req.userId!];

  const task = await db.task.create({
    data: {
      organizationId: req.organizationId!,
      title,
      project: project.toUpperCase(),
      status: status || 'todo',
      priority: priority || 'med',
      due: due || null,
      notes: notes || '',
      favorite: !!favorite,
      createdById: req.userId!,
      assignments: { create: userIds.map((userId) => ({ userId })) },
    },
    include: { assignments: true, subtasks: true },
  });

  res.status(201).json(formatTask(task));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await db.task.findFirst({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

  const u = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (u.title !== undefined) data.title = u.title;
  if (u.project !== undefined) data.project = String(u.project).toUpperCase();
  if (u.status !== undefined) data.status = u.status;
  if (u.priority !== undefined) data.priority = u.priority;
  if (u.due !== undefined) data.due = u.due;
  if (u.notes !== undefined) data.notes = u.notes;
  if (u.favorite !== undefined) data.favorite = u.favorite;
  if (u.archived !== undefined) data.archived = u.archived;
  if (u.archivedAt !== undefined) data.archivedAt = u.archivedAt ? new Date(u.archivedAt) : null;
  if (u.deletedAt !== undefined) data.deletedAt = u.deletedAt ? new Date(u.deletedAt) : null;
  if (u.reviewers !== undefined) data.reviewers = u.reviewers;
  if (u.reviewValidatedBy !== undefined) data.reviewValidatedBy = u.reviewValidatedBy;
  if (u.reviewValidatedAt !== undefined) data.reviewValidatedAt = u.reviewValidatedAt ? new Date(u.reviewValidatedAt) : null;
  if (u.reviewRejectedBy !== undefined) data.reviewRejectedBy = u.reviewRejectedBy;
  if (u.reviewRejectedAt !== undefined) data.reviewRejectedAt = u.reviewRejectedAt ? new Date(u.reviewRejectedAt) : null;
  if (u.rejectionComment !== undefined) data.rejectionComment = u.rejectionComment;
  if (u.movedToReviewBy !== undefined) data.movedToReviewBy = u.movedToReviewBy;
  if (u.movedToReviewAt !== undefined) data.movedToReviewAt = u.movedToReviewAt ? new Date(u.movedToReviewAt) : null;

  if (u.status === 'done' && existing.status !== 'done' && u.completedAt === undefined) {
    data.completedAt = new Date();
  }
  if (u.status && u.status !== 'done' && existing.status === 'done' && u.completedAt === undefined) {
    data.completedAt = null;
  }
  if (u.completedAt !== undefined) data.completedAt = u.completedAt ? new Date(u.completedAt) : null;

  await db.task.update({ where: { id: existing.id }, data });

  if (u.assignedTo !== undefined) {
    await db.taskAssignment.deleteMany({ where: { taskId: existing.id } });
    await db.taskAssignment.createMany({
      data: (u.assignedTo as string[]).map((userId) => ({ taskId: existing.id, userId })),
    });
  }

  await createReviewNotifications(req, existing, u);

  const updated = await db.task.findFirst({
    where: { id: existing.id },
    include: { assignments: true, subtasks: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json(formatTask(updated!));
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await db.task.findFirst({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });
  await db.task.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
});

async function createReviewNotifications(
  req: AuthedRequest,
  existing: { id: string; title: string; createdById: string; reviewers: string[]; reviewValidatedBy: string | null; reviewRejectedBy: string | null },
  u: Record<string, unknown>
) {
  const notifs: Array<{ type: string; toUserId: string; message: string }> = [];

  if (u.reviewers !== undefined && JSON.stringify(u.reviewers) !== JSON.stringify(existing.reviewers)) {
    for (const reviewerId of u.reviewers as string[]) {
      notifs.push({ type: 'review_requested', toUserId: reviewerId, message: `Révision demandée sur "${existing.title}"` });
    }
  }
  if (u.reviewValidatedBy && !existing.reviewValidatedBy) {
    notifs.push({ type: 'review_validated', toUserId: existing.createdById, message: `Tâche "${existing.title}" validée` });
  }
  if (u.reviewRejectedBy && !existing.reviewRejectedBy) {
    notifs.push({ type: 'review_rejected', toUserId: existing.createdById, message: `Corrections demandées sur "${existing.title}"` });
  }

  if (notifs.length === 0) return;

  await db.appNotification.createMany({
    data: notifs.map((n) => ({
      organizationId: req.organizationId!,
      type: n.type,
      taskId: existing.id,
      taskTitle: existing.title,
      fromUserId: req.userId!,
      toUserId: n.toUserId,
      message: n.message,
    })),
  });
}

export function formatTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    project: task.project,
    due: task.due,
    priority: task.priority,
    status: task.status,
    createdBy: task.createdById,
    assignedTo: task.assignments?.map((a: any) => a.userId) ?? [],
    createdAt: task.createdAt.getTime(),
    updatedAt: task.updatedAt.getTime(),
    completedAt: task.completedAt ? task.completedAt.getTime() : null,
    notes: task.notes,
    archived: task.archived,
    archivedAt: task.archivedAt ? task.archivedAt.getTime() : null,
    favorite: task.favorite,
    deletedAt: task.deletedAt ? task.deletedAt.getTime() : null,
    reviewers: task.reviewers ?? [],
    reviewValidatedBy: task.reviewValidatedBy ?? undefined,
    reviewValidatedAt: task.reviewValidatedAt ? task.reviewValidatedAt.getTime() : undefined,
    reviewRejectedBy: task.reviewRejectedBy ?? undefined,
    reviewRejectedAt: task.reviewRejectedAt ? task.reviewRejectedAt.getTime() : undefined,
    rejectionComment: task.rejectionComment ?? undefined,
    movedToReviewBy: task.movedToReviewBy ?? undefined,
    movedToReviewAt: task.movedToReviewAt ? task.movedToReviewAt.getTime() : undefined,
    subtasks: (task.subtasks ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      completed: s.completed,
      createdAt: s.createdAt.getTime(),
      completedAt: s.completedAt ? s.completedAt.getTime() : null,
      completedBy: s.completedBy ?? null,
      assignedTo: s.assignedTo ?? [],
      startDate: s.startDate ?? null,
      endDate: s.endDate ?? null,
    })),
  };
}

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import tasksRoutes from './routes/tasks';
// ...
app.use('/api/tasks', tasksRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/tasks.ts src/app.ts tests/routes/tasks.test.ts
git commit -m "feat: routes tasks (CRUD, semantique PATCH, notifications de revision)"
```

---

### Task 7: Routes subtasks (CRUD + reorder)

**Files:**
- Create: `todox-backend/src/routes/subtasks.ts`
- Modify: `todox-backend/src/app.ts` (monte le router, imbriqué sous `/api/tasks/:taskId/subtasks`)
- Test: `todox-backend/tests/routes/subtasks.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (Task 3), `rawDb`/`resetDb` (Task 3), `tokenFor` (Task 4).
- Produces routes : `POST /api/tasks/:taskId/subtasks`, `PUT /api/tasks/:taskId/subtasks/:subId`, `DELETE /api/tasks/:taskId/subtasks/:subId`, `PATCH /api/tasks/:taskId/subtasks/reorder`.
- **Règle de scoping importante** (`Subtask` n'a pas de colonne `organizationId` propre) : chaque mutation vérifie d'abord que `taskId` appartient à l'organisation courante (`db.task.findFirst({ where: { id: taskId } })`, auto-scopé), **puis** cible la sous-tâche via `updateMany`/`deleteMany` avec un `where: { id: subId, taskId }` composé — jamais `{ id: subId }` seul, pour empêcher qu'un ID de sous-tâche deviné d'une autre tâche/organisation soit modifié.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/subtasks.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('subtasks routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupTask() {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'u@test.com', name: 'U', role: 'member', passwordHash: 'x' },
    });
    const task = await rawDb.task.create({
      data: { organizationId: org.id, title: 'Parent', project: 'X', createdById: user.id },
    });
    return { task, token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }) };
  }

  it('creates, completes and deletes a subtask', async () => {
    const { task, token } = await setupTask();
    const app = createApp();

    const created = await request(app)
      .post(`/api/tasks/${task.id}/subtasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Étape 1' });
    expect(created.status).toBe(201);

    const completed = await request(app)
      .put(`/api/tasks/${task.id}/subtasks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true });
    expect(completed.body.completed).toBe(true);
    expect(completed.body.completedAt).toBeTruthy();

    const deleted = await request(app)
      .delete(`/api/tasks/${task.id}/subtasks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
  });

  it('rejects updating a subtask that belongs to a different task', async () => {
    const { task: taskA, token: tokenA } = await setupTask();
    const { task: taskB, token: tokenB } = await setupTask();
    const app = createApp();

    const created = await request(app)
      .post(`/api/tasks/${taskA.id}/subtasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Étape 1' });

    // taskB appartient à une autre organisation ; on tente d'atteindre la
    // sous-tâche de taskA en passant taskB dans l'URL.
    const res = await request(app)
      .put(`/api/tasks/${taskB.id}/subtasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ completed: true });

    expect(res.status).toBe(404);
  });

  it('reorders subtasks', async () => {
    const { task, token } = await setupTask();
    const app = createApp();

    const s1 = await request(app).post(`/api/tasks/${task.id}/subtasks`).set('Authorization', `Bearer ${token}`).send({ title: 'A' });
    const s2 = await request(app).post(`/api/tasks/${task.id}/subtasks`).set('Authorization', `Bearer ${token}`).send({ title: 'B' });

    const reorder = await request(app)
      .patch(`/api/tasks/${task.id}/subtasks/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ order: [s2.body.id, s1.body.id] });
    expect(reorder.status).toBe(200);

    const list = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(list.body[0].subtasks.map((s: any) => s.id)).toEqual([s2.body.id, s1.body.id]);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/subtasks`
Expected: FAIL — module/route introuvable.

- [ ] **Step 3: Implémenter `src/routes/subtasks.ts`**

```ts
// todox-backend/src/routes/subtasks.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.post('/', async (req: AuthedRequest, res) => {
  const { taskId } = req.params;
  const { title } = req.body ?? {};
  if (!title) return res.status(400).json({ error: 'title est requis' });

  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

  const count = await db.subtask.count({ where: { taskId } });
  const subtask = await db.subtask.create({ data: { taskId, title, sortOrder: count } });
  await db.task.update({ where: { id: taskId }, data: {} });

  res.status(201).json({
    id: subtask.id,
    title: subtask.title,
    completed: subtask.completed,
    createdAt: subtask.createdAt.getTime(),
    completedAt: null,
  });
});

router.put('/:subId', async (req: AuthedRequest, res) => {
  const { taskId, subId } = req.params;
  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

  const { completed, title } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (completed !== undefined) {
    data.completed = completed;
    data.completedAt = completed ? new Date() : null;
  }
  if (title !== undefined) data.title = title;

  const result = await db.subtask.updateMany({ where: { id: subId, taskId }, data });
  if (result.count === 0) return res.status(404).json({ error: 'Sous-tâche non trouvée' });

  const subtask = await db.subtask.findFirst({ where: { id: subId, taskId } });
  await db.task.update({ where: { id: taskId }, data: {} });

  res.json({
    id: subtask!.id,
    title: subtask!.title,
    completed: subtask!.completed,
    createdAt: subtask!.createdAt.getTime(),
    completedAt: subtask!.completedAt ? subtask!.completedAt.getTime() : null,
  });
});

router.delete('/:subId', async (req: AuthedRequest, res) => {
  const { taskId, subId } = req.params;
  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

  const result = await db.subtask.deleteMany({ where: { id: subId, taskId } });
  if (result.count === 0) return res.status(404).json({ error: 'Sous-tâche non trouvée' });

  await db.task.update({ where: { id: taskId }, data: {} });
  res.status(204).send();
});

router.patch('/reorder', async (req: AuthedRequest, res) => {
  const { taskId } = req.params;
  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

  const { order } = req.body as { order: string[] };
  await Promise.all(
    order.map((subId, idx) => db.subtask.updateMany({ where: { id: subId, taskId }, data: { sortOrder: idx } }))
  );
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Monter le router (imbriqué) dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import subtasksRoutes from './routes/subtasks';
// ...
app.use('/api/tasks/:taskId/subtasks', subtasksRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/subtasks.ts src/app.ts tests/routes/subtasks.test.ts
git commit -m "feat: routes subtasks (CRUD + reorder, isolation par taskId)"
```

---

### Task 8: Routes comments

**Files:**
- Create: `todox-backend/src/routes/comments.ts`
- Modify: `todox-backend/src/app.ts` (monte le router)
- Test: `todox-backend/tests/routes/comments.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (Task 3), `rawDb`/`resetDb` (Task 3), `tokenFor` (Task 4).
- Produces routes : `GET /api/tasks/:taskId/comments`, `POST /api/tasks/:taskId/comments`, `DELETE /api/comments/:id` (soft-delete).

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/comments.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('comments routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupTask() {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'u@test.com', name: 'U', role: 'member', passwordHash: 'x' },
    });
    const task = await rawDb.task.create({
      data: { organizationId: org.id, title: 'T', project: 'X', createdById: user.id },
    });
    return { task, token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }) };
  }

  it('adds a comment then lists it', async () => {
    const { task, token } = await setupTask();
    const app = createApp();

    const posted = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Un commentaire' });
    expect(posted.status).toBe(201);

    const list = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].text).toBe('Un commentaire');
  });

  it('soft-deletes a comment', async () => {
    const { task, token } = await setupTask();
    const app = createApp();

    const posted = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'À supprimer' });

    const deleted = await request(app)
      .delete(`/api/comments/${posted.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const inDb = await rawDb.comment.findUnique({ where: { id: posted.body.id } });
    expect(inDb?.deletedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/comments`
Expected: FAIL — module/route introuvable.

- [ ] **Step 3: Implémenter `src/routes/comments.ts`**

```ts
// todox-backend/src/routes/comments.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatComment(c: { id: string; taskId: string; userId: string; text: string; createdAt: Date; deletedAt: Date | null }) {
  return {
    id: c.id,
    taskId: c.taskId,
    userId: c.userId,
    text: c.text,
    createdAt: c.createdAt.getTime(),
    deletedAt: c.deletedAt ? c.deletedAt.getTime() : null,
  };
}

router.get('/tasks/:taskId/comments', async (req: AuthedRequest, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

  const comments = await db.comment.findMany({ where: { taskId: req.params.taskId }, orderBy: { createdAt: 'asc' } });
  res.json(comments.map(formatComment));
});

router.post('/tasks/:taskId/comments', async (req: AuthedRequest, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text est requis' });

  const comment = await db.comment.create({
    data: { organizationId: req.organizationId!, taskId: req.params.taskId, userId: req.userId!, text },
  });
  res.status(201).json(formatComment(comment));
});

router.delete('/comments/:id', async (req: AuthedRequest, res) => {
  const comment = await db.comment.findFirst({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ error: 'Commentaire non trouvé' });

  await db.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

Les deux préfixes de `comments.ts` (`/tasks/:taskId/comments` et `/comments/:id`) sont déjà dans le fichier de routes — on le monte donc directement sous `/api` :

```ts
// ajout dans todox-backend/src/app.ts
import commentsRoutes from './routes/comments';
// ...
app.use('/api', commentsRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/comments.ts src/app.ts tests/routes/comments.test.ts
git commit -m "feat: routes comments (ajout, liste, soft-delete)"
```

---

### Task 9: Routes notifications

**Files:**
- Create: `todox-backend/src/routes/notifications.ts`
- Modify: `todox-backend/src/app.ts` (monte le router)
- Test: `todox-backend/tests/routes/notifications.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (Task 3), `rawDb`/`resetDb` (Task 3), `tokenFor` (Task 4). Les notifications elles-mêmes sont créées par Task 6 (`PUT /api/tasks/:id`) — cette task n'expose que la lecture et le marquage lu.
- Produces routes : `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/notifications.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('notifications routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupNotif() {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const fromUser = await rawDb.user.create({
      data: { organizationId: org.id, email: 'from@test.com', name: 'From', role: 'member', passwordHash: 'x' },
    });
    const toUser = await rawDb.user.create({
      data: { organizationId: org.id, email: 'to@test.com', name: 'To', role: 'member', passwordHash: 'x' },
    });
    const task = await rawDb.task.create({
      data: { organizationId: org.id, title: 'T', project: 'X', createdById: fromUser.id },
    });
    const notif = await rawDb.appNotification.create({
      data: {
        organizationId: org.id,
        type: 'review_requested',
        taskId: task.id,
        taskTitle: task.title,
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        message: 'Test',
      },
    });
    return { notif, token: tokenFor({ id: toUser.id, organizationId: org.id, role: 'member' }) };
  }

  it('lists notifications for the authenticated user', async () => {
    const { token } = await setupNotif();
    const res = await request(createApp()).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].readAt).toBeUndefined();
  });

  it('marks a single notification as read', async () => {
    const { notif, token } = await setupNotif();
    const app = createApp();

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(list.body[0].readAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/notifications`
Expected: FAIL — module/route introuvable.

- [ ] **Step 3: Implémenter `src/routes/notifications.ts`**

```ts
// todox-backend/src/routes/notifications.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatNotification(n: {
  id: string; type: string; taskId: string; taskTitle: string;
  fromUserId: string; toUserId: string; message: string; createdAt: Date; readAt: Date | null;
}) {
  return {
    id: n.id,
    type: n.type,
    taskId: n.taskId,
    taskTitle: n.taskTitle,
    fromUserId: n.fromUserId,
    toUserId: n.toUserId,
    message: n.message,
    createdAt: n.createdAt.getTime(),
    readAt: n.readAt ? n.readAt.getTime() : undefined,
  };
}

router.get('/', async (req: AuthedRequest, res) => {
  const notifications = await db.appNotification.findMany({
    where: { toUserId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(notifications.map(formatNotification));
});

router.patch('/:id/read', async (req: AuthedRequest, res) => {
  const result = await db.appNotification.updateMany({
    where: { id: req.params.id, toUserId: req.userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) return res.status(404).json({ error: 'Notification non trouvée' });
  res.json({ ok: true });
});

router.patch('/read-all', async (req: AuthedRequest, res) => {
  await db.appNotification.updateMany({
    where: { toUserId: req.userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import notificationsRoutes from './routes/notifications';
// ...
app.use('/api/notifications', notificationsRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/notifications.ts src/app.ts tests/routes/notifications.test.ts
git commit -m "feat: routes notifications (liste, marquage lu)"
```

---

### Task 10: Routes time entries

**Files:**
- Create: `todox-backend/src/routes/timeEntries.ts`
- Modify: `todox-backend/src/app.ts` (monte le router)
- Test: `todox-backend/tests/routes/timeEntries.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (Task 3), `rawDb`/`resetDb` (Task 3), `tokenFor` (Task 4).
- Produces routes : `GET /api/time-entries?from=&to=`, `POST /api/time-entries`, `PUT /api/time-entries/:id`, `DELETE /api/time-entries/:id`.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/timeEntries.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('time entries routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupUser() {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'u@test.com', name: 'U', role: 'member', passwordHash: 'x' },
    });
    return { token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }) };
  }

  it('creates a time entry and lists it', async () => {
    const { token } = await setupUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ project: 'acme', date: '2026-09-07', hours: 1.5 });
    expect(created.status).toBe(201);
    expect(created.body.project).toBe('ACME');

    const list = await request(app).get('/api/time-entries').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });

  it('updates hours on an existing entry', async () => {
    const { token } = await setupUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ project: 'ACME', date: '2026-09-07', hours: 1 });

    const updated = await request(app)
      .put(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hours: 2.5 });
    expect(updated.body.hours).toBe(2.5);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/timeEntries`
Expected: FAIL — module/route introuvable.

- [ ] **Step 3: Implémenter `src/routes/timeEntries.ts`**

```ts
// todox-backend/src/routes/timeEntries.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatEntry(e: {
  id: string; project: string; date: string; hours: number; userId: string;
  note: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: e.id,
    project: e.project,
    date: e.date,
    hours: e.hours,
    userId: e.userId,
    note: e.note ?? undefined,
    createdAt: e.createdAt.getTime(),
    updatedAt: e.updatedAt.getTime(),
  };
}

router.get('/', async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const entries = await db.timeEntry.findMany({
    where: { date: { gte: from || undefined, lte: to || undefined } },
    orderBy: { date: 'desc' },
  });
  res.json(entries.map(formatEntry));
});

router.post('/', async (req: AuthedRequest, res) => {
  const { project, date, hours, note } = req.body ?? {};
  if (!project || !date || hours === undefined) {
    return res.status(400).json({ error: 'project, date et hours sont requis' });
  }

  const entry = await db.timeEntry.create({
    data: {
      organizationId: req.organizationId!,
      userId: req.userId!,
      project: String(project).toUpperCase(),
      date,
      hours,
      note: note || null,
    },
  });
  res.status(201).json(formatEntry(entry));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const { hours, note, date } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (hours !== undefined) data.hours = hours;
  if (note !== undefined) data.note = note;
  if (date !== undefined) data.date = date;

  const result = await db.timeEntry.updateMany({ where: { id: req.params.id }, data });
  if (result.count === 0) return res.status(404).json({ error: 'Saisie non trouvée' });

  const entry = await db.timeEntry.findFirst({ where: { id: req.params.id } });
  res.json(formatEntry(entry!));
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const result = await db.timeEntry.deleteMany({ where: { id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ error: 'Saisie non trouvée' });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import timeEntriesRoutes from './routes/timeEntries';
// ...
app.use('/api/time-entries', timeEntriesRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/timeEntries.ts src/app.ts tests/routes/timeEntries.test.ts
git commit -m "feat: routes time entries (CRUD)"
```

---

### Task 11: Script de migration data.json → Postgres

**Files:**
- Create: `todox-backend/scripts/migrateCore.ts` (logique testable, prend les données déjà parsées)
- Create: `todox-backend/scripts/migrate-from-json.ts` (CLI mince : lit les fichiers, appelle `migrateCore`)
- Test: `todox-backend/tests/migrateCore.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (Task 2), `rawDb`/`resetDb` (Task 3).
- Produces: `migrate(prisma: PrismaClient, rawData: unknown, rawComments: Record<string, unknown[]>, orgName: string): Promise<MigrationReport>` où `MigrationReport = { organizationId: string; usersCreated: number; projectsCreated: number; tasksCreated: number; timeEntriesCreated: number; tempPasswords: Array<{ email: string; password: string }> }`.

- [ ] **Step 1: Écrire le test**

```ts
// todox-backend/tests/migrateCore.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { migrate } from '../scripts/migrateCore';
import { rawDb, resetDb } from './helpers/testDb';

describe('migrate', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  it('migrates users, projects, tasks, subtasks and comments from a legacy data.json shape', async () => {
    const rawData = {
      projectHistory: ['ACME'],
      projectColors: { ACME: 2 },
      directories: { ACME: 'C:\\Projets\\Acme' },
      tasks: [
        {
          id: 'legacy-1',
          title: 'Tâche historique',
          project: 'acme',
          status: 'doing',
          priority: 'high',
          createdBy: 'matthieu',
          assignedTo: ['matthieu', 'william'],
          createdAt: 1730000000000,
          subtasks: [{ title: 'Sous-étape', completed: true, completedAt: 1730000100000 }],
        },
      ],
      timeEntries: [
        { userId: 'matthieu', project: 'acme', date: '2026-08-01', hours: 3, createdAt: 1730000000000 },
      ],
    };
    const rawComments = {
      'legacy-1': [{ userId: 'william', text: 'Un commentaire', createdAt: 1730000050000, deletedAt: null }],
    };

    const report = await migrate(rawDb, rawData, rawComments, 'Conception EA');

    expect(report.usersCreated).toBe(10); // FIXED_USERS moins "unassigned"
    expect(report.projectsCreated).toBe(1);
    expect(report.tasksCreated).toBe(1);
    expect(report.timeEntriesCreated).toBe(1);
    expect(report.tempPasswords).toHaveLength(10);

    const task = await rawDb.task.findFirst({ where: { title: 'Tâche historique' }, include: { subtasks: true, assignments: true } });
    expect(task?.project).toBe('ACME');
    expect(task?.subtasks).toHaveLength(1);
    expect(task?.assignments).toHaveLength(2);

    const comments = await rawDb.comment.findMany({ where: { taskId: task!.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('Un commentaire');
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- migrateCore`
Expected: FAIL — `Cannot find module '../scripts/migrateCore'`

- [ ] **Step 3: Implémenter `scripts/migrateCore.ts`**

```ts
// todox-backend/scripts/migrateCore.ts
import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/lib/password';

const FIXED_USERS = [
  { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu.maurel@conception-ea.fr' },
  { id: 'william', name: 'William Cresson', email: 'william.cresson@conception-ea.fr' },
  { id: 'matteo', name: 'Matteo Voltarel', email: 'matteo.voltarel@conception-ea.fr' },
  { id: 'sandro', name: 'Sandro Menardi', email: 'sandro.menardi@conception-ea.fr' },
  { id: 'jerome', name: 'Jerome Voltarel', email: 'jerome.voltarel@conception-ea.fr' },
  { id: 'laurent', name: 'Laurent Marques', email: 'laurent.marques@conception-ea.fr' },
  { id: 'sakina', name: 'Sakina Benhed', email: 'contact@conception-ea.fr' },
  { id: 'frederic', name: 'Fédéric Menardi', email: 'frederic.menardi@conception-ea.fr' },
  { id: 'dominique', name: 'Dominique Bichon', email: 'etudes06@conception-ea.fr' },
  { id: 'stephane', name: 'Stephane Bayle', email: 'etudes@conception-ea.fr' },
];

export interface MigrationReport {
  organizationId: string;
  usersCreated: number;
  projectsCreated: number;
  tasksCreated: number;
  timeEntriesCreated: number;
  tempPasswords: Array<{ email: string; password: string }>;
}

export async function migrate(
  prisma: PrismaClient,
  rawData: any,
  rawComments: Record<string, any[]>,
  orgName: string
): Promise<MigrationReport> {
  const org = await prisma.organization.create({ data: { name: orgName } });

  const userIdMap = new Map<string, string>();
  const tempPasswords: Array<{ email: string; password: string }> = [];

  for (const [i, u] of FIXED_USERS.entries()) {
    const tempPassword = randomBytes(6).toString('hex');
    const created = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: u.email,
        name: u.name,
        role: i === 0 ? 'admin' : 'member',
        passwordHash: await hashPassword(tempPassword),
      },
    });
    userIdMap.set(u.id, created.id);
    tempPasswords.push({ email: u.email, password: tempPassword });
  }

  function mapUser(oldId: string | undefined): string {
    if (!oldId) return [...userIdMap.values()][0];
    return userIdMap.get(oldId) ?? [...userIdMap.values()][0];
  }

  const projectNames: string[] =
    rawData.projectHistory?.length
      ? rawData.projectHistory
      : [...new Set((rawData.tasks ?? []).map((t: any) => String(t.project || '').toUpperCase()))];

  const projectIdByName = new Map<string, string>();
  let order = 0;
  for (const name of projectNames) {
    if (!name) continue;
    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name,
        color: rawData.projectColors?.[name] ?? null,
        directory: rawData.directories?.[name] ?? null,
        sortOrder: order++,
      },
    });
    projectIdByName.set(name, project.id);
  }

  let tasksCreated = 0;
  for (const t of rawData.tasks ?? []) {
    const created = await prisma.task.create({
      data: {
        organizationId: org.id,
        title: t.title,
        project: String(t.project || '').toUpperCase(),
        due: t.due ?? null,
        priority: t.priority ?? 'med',
        status: t.status ?? 'todo',
        notes: t.notes ?? '',
        archived: !!t.archived,
        archivedAt: t.archivedAt ? new Date(t.archivedAt) : null,
        favorite: !!t.favorite,
        deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
        createdById: mapUser(t.createdBy),
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        reviewers: (t.reviewers ?? []).map(mapUser),
        assignments: { create: (t.assignedTo ?? [t.createdBy]).map((uid: string) => ({ userId: mapUser(uid) })) },
        subtasks: {
          create: (t.subtasks ?? []).map((s: any, idx: number) => ({
            title: s.title,
            completed: !!s.completed,
            completedAt: s.completedAt ? new Date(s.completedAt) : null,
            completedBy: s.completedBy ? mapUser(s.completedBy) : null,
            assignedTo: (s.assignedTo ?? []).map(mapUser),
            startDate: s.startDate ?? null,
            endDate: s.endDate ?? null,
            sortOrder: idx,
          })),
        },
      },
    });
    tasksCreated++;

    for (const c of rawComments[t.id] ?? []) {
      await prisma.comment.create({
        data: {
          organizationId: org.id,
          taskId: created.id,
          userId: mapUser(c.userId),
          text: c.text,
          createdAt: new Date(c.createdAt),
          deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
        },
      });
    }
  }

  let timeEntriesCreated = 0;
  for (const e of rawData.timeEntries ?? []) {
    await prisma.timeEntry.create({
      data: {
        organizationId: org.id,
        userId: mapUser(e.userId),
        project: String(e.project || '').toUpperCase(),
        date: e.date,
        hours: e.hours,
        note: e.note ?? null,
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
      },
    });
    timeEntriesCreated++;
  }

  return {
    organizationId: org.id,
    usersCreated: userIdMap.size,
    projectsCreated: projectIdByName.size,
    tasksCreated,
    timeEntriesCreated,
    tempPasswords,
  };
}
```

- [ ] **Step 4: Run — vérifier le succès**

Run: `npm test -- migrateCore`
Expected: PASS

- [ ] **Step 5: Implémenter le CLI mince `scripts/migrate-from-json.ts`**

```ts
// todox-backend/scripts/migrate-from-json.ts
import 'dotenv/config';
import * as fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { migrate } from './migrateCore';

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: npm run migrate -- <chemin vers data.json> [nom organisation]');
    process.exit(1);
  }
  const orgName = process.argv[3] || 'Conception EA';

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const commentsPath = jsonPath.replace(/data\.json$/, 'comments.json');
  const rawComments = fs.existsSync(commentsPath)
    ? JSON.parse(fs.readFileSync(commentsPath, 'utf-8')).comments ?? {}
    : {};

  const prisma = new PrismaClient();
  const report = await migrate(prisma, rawData, rawComments, orgName);

  console.log(`✅ Organisation créée : ${report.organizationId}`);
  console.log(`✅ ${report.usersCreated} utilisateurs, ${report.projectsCreated} projets, ${report.tasksCreated} tâches, ${report.timeEntriesCreated} saisies de temps`);
  console.log('\n📋 Mots de passe temporaires (à communiquer, changement obligatoire au premier login) :');
  for (const { email, password } of report.tempPasswords) {
    console.log(`   ${email} → ${password}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Migration échouée :', err);
  process.exit(1);
});
```

- [ ] **Step 6: Run l'ensemble de la suite**

Run: `npm test`
Expected: tous les fichiers PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/ tests/migrateCore.test.ts
git commit -m "feat: script de migration data.json -> Postgres (multi-tenant, mots de passe temporaires)"
```

---

### Task 12: Docker Compose de production + backups

**Files:**
- Create: `todox-backend/Dockerfile`
- Create: `todox-backend/docker-compose.prod.yml`
- Create: `todox-backend/.env.prod.example`
- Create: `todox-backend/scripts/backup.sh`

**Interfaces:**
- Consumes : l'image buildée par ce `Dockerfile` exécute `npm run build` puis `prisma migrate deploy` puis `node dist/index.js` — dépend donc de tout le code des Tasks 1 à 11 déjà en place.

- [ ] **Step 1: Écrire le `Dockerfile` (build multi-stage)**

```dockerfile
# todox-backend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

- [ ] **Step 2: Écrire `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: todox
    volumes:
      - todox_pg_data:/var/lib/postgresql/data
    networks: [todox_net]

  backend:
    build: .
    restart: always
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/todox
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRATION: 7d
      PORT: 3001
    ports:
      - "3001:3001"
    networks: [todox_net]

networks:
  todox_net:

volumes:
  todox_pg_data:
```

- [ ] **Step 3: Écrire `.env.prod.example`**

```env
POSTGRES_USER=todox
POSTGRES_PASSWORD=change-me-strong-password
JWT_SECRET=change-me-to-a-long-random-string
```

- [ ] **Step 4: Écrire le script de backup**

```bash
#!/bin/bash
# todox-backend/scripts/backup.sh
set -e
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$POSTGRES_USER" todox > "$BACKUP_DIR/todox_$DATE.sql"
ls -t "$BACKUP_DIR"/todox_*.sql | tail -n +15 | xargs -r rm
echo "Backup créé : $BACKUP_DIR/todox_$DATE.sql"
```

- [ ] **Step 5: Vérifier la config Docker Compose (sans démarrer)**

Run (avec un `.env.prod` de test copié depuis `.env.prod.example`) :
```bash
cp .env.prod.example .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod config
```
Expected: le YAML interpolé s'affiche sans erreur (variables résolues).

- [ ] **Step 6: Build + démarrage local de vérification**

Run:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl http://localhost:3001/api/health
```
Expected: `{"status":"ok",...}`. Puis arrêter : `docker compose -f docker-compose.prod.yml down`.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.prod.yml .env.prod.example scripts/backup.sh
git commit -m "feat: deploiement Docker Compose de production + backups pg_dump"
```

---

## Suite

Une fois ce plan exécuté : API complète, testée, vérifiable au `curl`/Postman sans toucher au frontend. Le plan suivant (« Intégration frontend + suppression OneDrive ») consommera cette API : client `src/services/api.ts`, écran de connexion, remplacement de `useDataPersistence.ts` et de ses sous-hooks, nettoyage d'`electron.js` et de `StoragePanel.tsx`. Il sera écrit séparément une fois ce plan-ci en cours ou terminé.
