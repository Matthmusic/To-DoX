# Backend parité fonctionnelle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le backend multi-tenant Postgres (sous-projet 1, déjà mergé) à trois domaines manquants — templates de sous-tâches, rapports sauvegardés, configuration Outlook/ICS — et activer `NotificationSetting`, qui existe dans le schéma depuis le sous-projet 1 mais n'a jamais eu de routes.

**Architecture:** Aucune nouvelle décision d'architecture — extension du schéma Prisma existant, réutilisation intégrale du client scopé par organisation (`src/lib/prismaClient.ts`) et du middleware JWT (`requireAuth`) déjà en place. `TaskTemplate`/`SavedReport` suivent le motif `Project` (org-scopés). `OutlookConfig` suit le motif déjà établi par `NotificationSetting` (singleton par utilisateur, pas de colonne organisation propre).

**Tech Stack:** Express, Prisma, PostgreSQL 16, vitest + supertest (identique au sous-projet 1).

**Spec:** [docs/superpowers/specs/2026-09-10-backend-parite-fonctionnelle-design.md](../specs/2026-09-10-backend-parite-fonctionnelle-design.md)

## Global Constraints

- `TaskTemplate` et `SavedReport` rejoignent `ORG_SCOPED_MODELS` dans `src/lib/prismaClient.ts` — scopés automatiquement sur `findFirst/findFirstOrThrow/findMany/update/updateMany/delete/deleteMany/count/aggregate/groupBy`, jamais sur `create` (organizationId explicite requis). `findUnique`/`findUniqueOrThrow`/`upsert` restent interdits dessus.
- `OutlookConfig` (comme `NotificationSetting`, déjà en place) n'entre **pas** dans `ORG_SCOPED_MODELS` — pas de colonne organisation propre, `userId` est la clé primaire. Les routes n'acceptent jamais d'id utilisateur dans l'URL ou le corps de la requête, elles opèrent toujours sur `req.userId`. Comme ce modèle est hors `ORG_SCOPED_MODELS`, `findUnique`/`upsert` ne sont PAS bloqués dessus par l'extension — les utiliser directement est correct et volontaire ici (le seul cas du projet où ces méthodes sont sûres, car la PK est déjà la limite d'isolation exacte requise).
- JWT (`requireAuth`) exigé sur toutes les routes de ce plan.
- Tous les messages d'erreur en français.
- Sémantique PATCH sur les `PUT` : seuls les champs présents dans le corps sont modifiés.
- `DELETE` sur `templates`/`saved-reports` = suppression définitive (`deleteMany`, pas de soft-delete) — le frontend actuel ne restaure jamais un template ou un rapport supprimé.
- Tests d'intégration contre une vraie base Postgres (pas de mocks), suivant exactement les conventions déjà en place (`tests/helpers/testDb.ts` : `rawDb`/`resetDb`, `tests/helpers/auth.ts` : `tokenFor`).
- `npm run build` ET `npm test` doivent passer avant chaque commit (règle établie pendant le sous-projet 1 après qu'un oubli ait laissé passer une régression de build non détectée par les tests seuls).

---

### Task 1: Schéma (TaskTemplate, SavedReport, OutlookConfig) + scoping + infrastructure de test

**Files:**
- Modify: `todox-backend/prisma/schema.prisma`
- Modify: `todox-backend/src/lib/prismaClient.ts`
- Modify: `todox-backend/tests/helpers/testDb.ts`
- Modify: `todox-backend/tests/prismaClient.test.ts`

**Interfaces:**
- Produces: modèles Prisma `TaskTemplate`, `SavedReport`, `OutlookConfig` (client généré) — consommés par les Tasks 2-6.
- Produces: `ORG_SCOPED_MODELS` étendu avec `'TaskTemplate'`, `'SavedReport'` — consommé implicitement par toutes les routes des Tasks 2-3 via `db.taskTemplate.*`/`db.savedReport.*`.

- [ ] **Step 1: Ajouter les modèles au schéma Prisma**

Ajouter dans `todox-backend/prisma/schema.prisma`, après le modèle `NotificationSetting` (fin de fichier) :

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

Ajouter les relations inverses dans le modèle `Organization` (après `timeEntries TimeEntry[]`) :

```prisma
  taskTemplates TaskTemplate[]
  savedReports  SavedReport[]
```

Ajouter les relations inverses dans le modèle `User` (après `notificationsFrom AppNotification[] @relation("NotifFrom")`) :

```prisma
  generatedReports SavedReport[]
  outlookConfig    OutlookConfig?
```

- [ ] **Step 2: Générer et appliquer la migration**

Run: `npx prisma migrate dev --name add_templates_reports_outlook`
Expected: migration créée et appliquée sur `todox` et `todox_test` (le script applique automatiquement les deux si `DATABASE_URL`/`DATABASE_URL_TEST` sont bien configurés dans `.env` — sinon appliquer manuellement sur `todox_test` : `DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy`).

- [ ] **Step 3: Étendre `ORG_SCOPED_MODELS`**

Dans `todox-backend/src/lib/prismaClient.ts`, ligne 4 :

```ts
const ORG_SCOPED_MODELS = new Set([
  'User', 'Task', 'Project', 'Comment', 'AppNotification', 'TimeEntry',
  'TaskTemplate', 'SavedReport',
]);
```

- [ ] **Step 4: Étendre `resetDb()`**

Dans `todox-backend/tests/helpers/testDb.ts`, ajouter au tableau de `resetDb()` (avant `rawDb.project.deleteMany()`, puisque `TaskTemplate`/`SavedReport` référencent `Organization` comme `Project` — l'ordre suit les dépendances de clé étrangère déjà respecté par le fichier) :

```ts
export async function resetDb() {
  await rawDb.$transaction([
    rawDb.appNotification.deleteMany(),
    rawDb.comment.deleteMany(),
    rawDb.timeEntry.deleteMany(),
    rawDb.taskAssignment.deleteMany(),
    rawDb.subtask.deleteMany(),
    rawDb.task.deleteMany(),
    rawDb.savedReport.deleteMany(),
    rawDb.taskTemplate.deleteMany(),
    rawDb.project.deleteMany(),
    rawDb.outlookConfig.deleteMany(),
    rawDb.notificationSetting.deleteMany(),
    rawDb.user.deleteMany(),
    rawDb.organization.deleteMany(),
  ]);
}
```

- [ ] **Step 5: Écrire les tests de scoping pour les nouveaux modèles org-scopés**

Ajouter à la fin de `todox-backend/tests/prismaClient.test.ts`, avant la dernière accolade fermante du `describe` :

```ts
  it('scopes findMany to the organization for TaskTemplate', async () => {
    const orgA = await rawDb.organization.create({ data: { name: 'Org A' } });
    const orgB = await rawDb.organization.create({ data: { name: 'Org B' } });
    const userA = await rawDb.user.create({
      data: { organizationId: orgA.id, email: 'tpl-a@test.com', name: 'A', passwordHash: 'x' },
    });
    await rawDb.taskTemplate.create({ data: { organizationId: orgA.id, name: 'Modèle A' } });
    await rawDb.taskTemplate.create({ data: { organizationId: orgB.id, name: 'Modèle B' } });

    const seenByOrgA = await requestContext.run(
      { userId: userA.id, organizationId: orgA.id, role: 'member' },
      async () => db.taskTemplate.findMany({})
    );

    expect(seenByOrgA).toHaveLength(1);
    expect(seenByOrgA[0].name).toBe('Modèle A');
  });

  it('does not scope OutlookConfig (no organizationId column, userId is the isolation boundary)', async () => {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email: 'oc@test.com', name: 'U', passwordHash: 'x' },
    });
    await rawDb.outlookConfig.create({ data: { userId: user.id, icsUrl: 'https://example.com/cal.ics' } });

    // findUnique is blocked on org-scoped models, but must work here — this IS the
    // documented exception (OutlookConfig is not in ORG_SCOPED_MODELS).
    const found = await requestContext.run(
      { userId: user.id, organizationId: org.id, role: 'member' },
      async () => db.outlookConfig.findUnique({ where: { userId: user.id } })
    );

    expect(found?.icsUrl).toBe('https://example.com/cal.ics');
  });
```

- [ ] **Step 6: Run — vérifier le succès**

Run: `npm test` (suite complète)
Expected: tous les fichiers PASS, y compris les 2 nouveaux tests.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/prismaClient.ts tests/helpers/testDb.ts tests/prismaClient.test.ts
git commit -m "feat: schema TaskTemplate/SavedReport/OutlookConfig + scoping"
```

---

### Task 2: Routes templates

**Files:**
- Create: `todox-backend/src/routes/templates.ts`
- Modify: `todox-backend/src/app.ts`
- Test: `todox-backend/tests/routes/templates.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest` (sous-projet 1), `rawDb`/`resetDb` (Task 1), `tokenFor` (sous-projet 1).
- Produces routes : `GET /api/templates`, `POST /api/templates`, `DELETE /api/templates/:id`.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/templates.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('templates routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  let userCounter = 0;
  async function setupOrgWithUser() {
    const org = await rawDb.organization.create({ data: { name: `Org${userCounter}` } });
    const email = `u${userCounter}@test.com`;
    userCounter++;
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email, name: 'U', role: 'member', passwordHash: 'x' },
    });
    return { org, token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }) };
  }

  it('creates a template and lists it', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Chantier standard', subtaskTitles: ['Devis', 'Commande', 'Pose'] });
    expect(created.status).toBe(201);
    expect(created.body.subtaskTitles).toEqual(['Devis', 'Commande', 'Pose']);

    const list = await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a template with no name', async () => {
    const { token } = await setupOrgWithUser();
    const res = await request(createApp())
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ subtaskTitles: ['X'] });
    expect(res.status).toBe(400);
  });

  it('deletes a template', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A supprimer' });

    const deleted = await request(app)
      .delete(`/api/templates/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const list = await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });

  it('only lists templates from the caller organization', async () => {
    const { token: tokenA } = await setupOrgWithUser();
    const { org: orgB } = await setupOrgWithUser();
    await rawDb.taskTemplate.create({ data: { organizationId: orgB.id, name: 'Autre org' } });

    const res = await request(createApp()).get('/api/templates').set('Authorization', `Bearer ${tokenA}`);
    expect(res.body).toHaveLength(0);
  });

  it('cannot delete a template from another organization', async () => {
    const { token: tokenA } = await setupOrgWithUser();
    const { org: orgB } = await setupOrgWithUser();
    const foreign = await rawDb.taskTemplate.create({ data: { organizationId: orgB.id, name: 'Autre org' } });

    const res = await request(createApp())
      .delete(`/api/templates/${foreign.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/templates`
Expected: FAIL — route introuvable.

- [ ] **Step 3: Implémenter `src/routes/templates.ts`**

```ts
// todox-backend/src/routes/templates.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatTemplate(t: { id: string; name: string; subtaskTitles: string[] }) {
  return { id: t.id, name: t.name, subtaskTitles: t.subtaskTitles };
}

router.get('/', async (_req: AuthedRequest, res) => {
  const templates = await db.taskTemplate.findMany({ orderBy: { name: 'asc' } });
  res.json(templates.map(formatTemplate));
});

router.post('/', async (req: AuthedRequest, res) => {
  const { name, subtaskTitles } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: 'name est requis' });
  }
  const template = await db.taskTemplate.create({
    data: {
      organizationId: req.organizationId!,
      name,
      subtaskTitles: Array.isArray(subtaskTitles) ? subtaskTitles : [],
    },
  });
  res.status(201).json(formatTemplate(template));
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const result = await db.taskTemplate.deleteMany({ where: { id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ error: 'Modèle non trouvé' });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import templatesRoutes from './routes/templates';
// ...
app.use('/api/templates', templatesRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test`
Expected: tous les fichiers PASS.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/routes/templates.ts src/app.ts tests/routes/templates.test.ts
git commit -m "feat: routes templates (liste, creation, suppression)"
```

---

### Task 3: Routes rapports sauvegardés

**Files:**
- Create: `todox-backend/src/routes/savedReports.ts`
- Modify: `todox-backend/src/app.ts`
- Test: `todox-backend/tests/routes/savedReports.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest`, `rawDb`/`resetDb`, `tokenFor`.
- Produces routes : `GET /api/saved-reports`, `POST /api/saved-reports`, `DELETE /api/saved-reports/:id`.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/savedReports.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('saved reports routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  let userCounter = 0;
  async function setupOrgWithUser() {
    const org = await rawDb.organization.create({ data: { name: `Org${userCounter}` } });
    const email = `u${userCounter}@test.com`;
    userCounter++;
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email, name: 'U', role: 'member', passwordHash: 'x' },
    });
    return {
      org,
      userId: user.id,
      token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }),
    };
  }

  it('creates a report and lists it, tagged with the creating user', async () => {
    const { token, userId } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/saved-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodType: 'weekly_current',
        periodLabel: 'Semaine 37',
        taskCount: 5,
        reportText: 'Rapport hebdomadaire...',
      });
    expect(created.status).toBe(201);
    expect(created.body.generatedBy).toBe(userId);

    const list = await request(app).get('/api/saved-reports').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a report missing required fields', async () => {
    const { token } = await setupOrgWithUser();
    const res = await request(createApp())
      .post('/api/saved-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodType: 'weekly_current' });
    expect(res.status).toBe(400);
  });

  it('deletes a report', async () => {
    const { token } = await setupOrgWithUser();
    const app = createApp();

    const created = await request(app)
      .post('/api/saved-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodType: 'weekly_current', periodLabel: 'S37', taskCount: 1, reportText: 'X' });

    const deleted = await request(app)
      .delete(`/api/saved-reports/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
  });

  it('only lists reports from the caller organization', async () => {
    const { token: tokenA } = await setupOrgWithUser();
    const { org: orgB, userId: userIdB } = await setupOrgWithUser();
    await rawDb.savedReport.create({
      data: {
        organizationId: orgB.id,
        generatedById: userIdB,
        periodType: 'weekly_current',
        periodLabel: 'Autre org',
        taskCount: 0,
        reportText: 'X',
      },
    });

    const res = await request(createApp()).get('/api/saved-reports').set('Authorization', `Bearer ${tokenA}`);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/savedReports`
Expected: FAIL — route introuvable.

- [ ] **Step 3: Implémenter `src/routes/savedReports.ts`**

```ts
// todox-backend/src/routes/savedReports.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatReport(r: {
  id: string; generatedById: string; generatedAt: Date; periodType: string;
  periodLabel: string; taskCount: number; reportText: string;
}) {
  return {
    id: r.id,
    generatedBy: r.generatedById,
    generatedAt: r.generatedAt.getTime(),
    periodType: r.periodType,
    periodLabel: r.periodLabel,
    taskCount: r.taskCount,
    reportText: r.reportText,
  };
}

router.get('/', async (_req: AuthedRequest, res) => {
  const reports = await db.savedReport.findMany({ orderBy: { generatedAt: 'desc' } });
  res.json(reports.map(formatReport));
});

router.post('/', async (req: AuthedRequest, res) => {
  const { periodType, periodLabel, taskCount, reportText } = req.body ?? {};
  if (!periodType || !periodLabel || !reportText) {
    return res.status(400).json({ error: 'periodType, periodLabel et reportText sont requis' });
  }
  const report = await db.savedReport.create({
    data: {
      organizationId: req.organizationId!,
      generatedById: req.userId!,
      periodType,
      periodLabel,
      taskCount: taskCount ?? 0,
      reportText,
    },
  });
  res.status(201).json(formatReport(report));
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const result = await db.savedReport.deleteMany({ where: { id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ error: 'Rapport non trouvé' });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import savedReportsRoutes from './routes/savedReports';
// ...
app.use('/api/saved-reports', savedReportsRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test` puis `npm run build`
Expected: tout PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/routes/savedReports.ts src/app.ts tests/routes/savedReports.test.ts
git commit -m "feat: routes saved-reports (liste, creation, suppression)"
```

---

### Task 4: Routes configuration Outlook (singleton par utilisateur)

**Files:**
- Create: `todox-backend/src/routes/outlookConfig.ts`
- Modify: `todox-backend/src/app.ts`
- Test: `todox-backend/tests/routes/outlookConfig.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest`, `rawDb`/`resetDb`, `tokenFor`.
- Produces routes : `GET /api/outlook-config`, `PUT /api/outlook-config` — toujours sur `req.userId`, jamais de paramètre d'id dans l'URL.

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/outlookConfig.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('outlook config routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupUser(email: string) {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email, name: 'U', role: 'member', passwordHash: 'x' },
    });
    return { token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }), userId: user.id };
  }

  it('returns defaults when no config exists yet', async () => {
    const { token } = await setupUser('a@test.com');
    const res = await request(createApp()).get('/api/outlook-config').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, icsUrl: '', exportEnabled: false, lastSync: null });
  });

  it('creates then partially updates the config for the caller', async () => {
    const { token } = await setupUser('b@test.com');
    const app = createApp();

    const created = await request(app)
      .put('/api/outlook-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, icsUrl: 'https://example.com/cal.ics' });
    expect(created.body).toEqual({ enabled: true, icsUrl: 'https://example.com/cal.ics', exportEnabled: false, lastSync: null });

    const updated = await request(app)
      .put('/api/outlook-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ exportEnabled: true });
    expect(updated.body).toEqual({ enabled: true, icsUrl: 'https://example.com/cal.ics', exportEnabled: true, lastSync: null });
  });

  it('never exposes or lets a user modify another user config, even in the same organization', async () => {
    const { token: tokenA, userId: userIdA } = await setupUser('c@test.com');
    await rawDb.outlookConfig.create({ data: { userId: userIdA, enabled: true, icsUrl: 'https://a.example.com' } });
    const { token: tokenB } = await setupUser('d@test.com');

    const res = await request(createApp()).get('/api/outlook-config').set('Authorization', `Bearer ${tokenB}`);
    expect(res.body).toEqual({ enabled: false, icsUrl: '', exportEnabled: false, lastSync: null });
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/outlookConfig`
Expected: FAIL — route introuvable.

- [ ] **Step 3: Implémenter `src/routes/outlookConfig.ts`**

```ts
// todox-backend/src/routes/outlookConfig.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const DEFAULTS = { enabled: false, icsUrl: '', exportEnabled: false, lastSync: null as Date | null };

function formatConfig(c: { enabled: boolean; icsUrl: string; exportEnabled: boolean; lastSync: Date | null }) {
  return {
    enabled: c.enabled,
    icsUrl: c.icsUrl,
    exportEnabled: c.exportEnabled,
    lastSync: c.lastSync ? c.lastSync.getTime() : null,
  };
}

router.get('/', async (req: AuthedRequest, res) => {
  // findUnique is safe here (not org-scoped, unlike org-scoped models where it's
  // blocked) -- userId is already the exact isolation boundary this route needs.
  const config = await db.outlookConfig.findUnique({ where: { userId: req.userId! } });
  res.json(formatConfig(config ?? { userId: req.userId!, ...DEFAULTS }));
});

router.put('/', async (req: AuthedRequest, res) => {
  const { enabled, icsUrl, exportEnabled, lastSync } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (enabled !== undefined) data.enabled = enabled;
  if (icsUrl !== undefined) data.icsUrl = icsUrl;
  if (exportEnabled !== undefined) data.exportEnabled = exportEnabled;
  if (lastSync !== undefined) data.lastSync = lastSync ? new Date(lastSync) : null;

  const config = await db.outlookConfig.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...DEFAULTS, ...data },
    update: data,
  });
  res.json(formatConfig(config));
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import outlookConfigRoutes from './routes/outlookConfig';
// ...
app.use('/api/outlook-config', outlookConfigRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test` puis `npm run build`
Expected: tout PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/routes/outlookConfig.ts src/app.ts tests/routes/outlookConfig.test.ts
git commit -m "feat: route outlook-config (singleton par utilisateur)"
```

---

### Task 5: Routes réglages de notification (singleton par utilisateur)

**Files:**
- Create: `todox-backend/src/routes/notificationSettings.ts`
- Modify: `todox-backend/src/app.ts`
- Test: `todox-backend/tests/routes/notificationSettings.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`/`AuthedRequest`, `rawDb`/`resetDb`, `tokenFor`.
- Produces routes : `GET /api/notification-settings`, `PUT /api/notification-settings` — même motif que Task 4 (toujours `req.userId`).

- [ ] **Step 1: Écrire les tests**

```ts
// todox-backend/tests/routes/notificationSettings.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { rawDb, resetDb } from '../helpers/testDb';
import { tokenFor } from '../helpers/auth';

describe('notification settings routes', () => {
  beforeEach(resetDb);
  afterAll(async () => rawDb.$disconnect());

  async function setupUser(email: string) {
    const org = await rawDb.organization.create({ data: { name: 'Org' } });
    const user = await rawDb.user.create({
      data: { organizationId: org.id, email, name: 'U', role: 'member', passwordHash: 'x' },
    });
    return { token: tokenFor({ id: user.id, organizationId: org.id, role: 'member' }), userId: user.id };
  }

  const defaults = {
    enabled: true,
    deadlineNotifications: true,
    staleTaskNotifications: true,
    checkInterval: 30,
    quietHoursEnabled: false,
    quietHoursStart: '20:00',
    quietHoursEnd: '08:00',
    sound: true,
    soundFile: 'default.mp3',
    ganttNotifications: false,
  };

  it('returns schema defaults when no settings exist yet', async () => {
    const { token } = await setupUser('a@test.com');
    const res = await request(createApp()).get('/api/notification-settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(defaults);
  });

  it('partially updates settings for the caller', async () => {
    const { token } = await setupUser('b@test.com');
    const app = createApp();

    const updated = await request(app)
      .put('/api/notification-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkInterval: 15, soundFile: 'chime.mp3' });
    expect(updated.body).toEqual({ ...defaults, checkInterval: 15, soundFile: 'chime.mp3' });
  });

  it('never exposes or lets a user modify another user settings', async () => {
    const { token: tokenA, userId: userIdA } = await setupUser('c@test.com');
    await rawDb.notificationSetting.create({ data: { userId: userIdA, checkInterval: 5 } });
    const { token: tokenB } = await setupUser('d@test.com');

    const res = await request(createApp()).get('/api/notification-settings').set('Authorization', `Bearer ${tokenB}`);
    expect(res.body.checkInterval).toBe(30);
  });
});
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- routes/notificationSettings`
Expected: FAIL — route introuvable.

- [ ] **Step 3: Implémenter `src/routes/notificationSettings.ts`**

```ts
// todox-backend/src/routes/notificationSettings.ts
import { Router } from 'express';
import { db } from '../lib/prismaClient';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const DEFAULTS = {
  enabled: true,
  deadlineNotifications: true,
  staleTaskNotifications: true,
  checkInterval: 30,
  quietHoursEnabled: false,
  quietHoursStart: '20:00',
  quietHoursEnd: '08:00',
  sound: true,
  soundFile: 'default.mp3',
  ganttNotifications: false,
};

type SettingsShape = typeof DEFAULTS;

function formatSettings(s: SettingsShape) {
  return {
    enabled: s.enabled,
    deadlineNotifications: s.deadlineNotifications,
    staleTaskNotifications: s.staleTaskNotifications,
    checkInterval: s.checkInterval,
    quietHoursEnabled: s.quietHoursEnabled,
    quietHoursStart: s.quietHoursStart,
    quietHoursEnd: s.quietHoursEnd,
    sound: s.sound,
    soundFile: s.soundFile,
    ganttNotifications: s.ganttNotifications,
  };
}

router.get('/', async (req: AuthedRequest, res) => {
  const settings = await db.notificationSetting.findUnique({ where: { userId: req.userId! } });
  res.json(formatSettings(settings ?? DEFAULTS));
});

router.put('/', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULTS) as Array<keyof SettingsShape>) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const settings = await db.notificationSetting.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...DEFAULTS, ...data },
    update: data,
  });
  res.json(formatSettings(settings));
});

export default router;
```

- [ ] **Step 4: Monter le router dans `src/app.ts`**

```ts
// ajout dans todox-backend/src/app.ts
import notificationSettingsRoutes from './routes/notificationSettings';
// ...
app.use('/api/notification-settings', notificationSettingsRoutes);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test` puis `npm run build`
Expected: tout PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/routes/notificationSettings.ts src/app.ts tests/routes/notificationSettings.test.ts
git commit -m "feat: route notification-settings (singleton par utilisateur)"
```

---

### Task 6: Extension du script de migration

**Files:**
- Modify: `todox-backend/scripts/migrateCore.ts`
- Modify: `todox-backend/scripts/migrate-from-json.ts`
- Modify: `todox-backend/tests/migrateCore.test.ts`

**Interfaces:**
- Consumes: `mapUser()` (interne à `migrate()`, sous-projet 1), modèles `TaskTemplate`/`SavedReport`/`OutlookConfig` (Task 1).
- Produces: `MigrationReport` étendu avec `templatesCreated`, `savedReportsCreated`, `outlookConfigsCreated`.

- [ ] **Step 1: Écrire le test étendu**

Modifier `todox-backend/tests/migrateCore.test.ts` : dans le test existant `'migrates users, projects, tasks, subtasks and comments from a legacy data.json shape'`, ajouter au `rawData` d'entrée (avant la fermeture de l'objet) :

```ts
      templates: [{ id: 'tpl-1', name: 'Modèle standard', subtaskTitles: ['Devis', 'Pose'] }],
      savedReports: [
        {
          id: 'rep-1',
          generatedAt: 1730000200000,
          generatedBy: 'matthieu',
          periodType: 'weekly_current',
          periodLabel: 'Semaine 37',
          taskCount: 3,
          reportText: 'Rapport...',
        },
      ],
      outlookConfigs: {
        matthieu: { enabled: true, icsUrl: 'https://example.com/cal.ics', exportEnabled: false, lastSync: null },
      },
```

Et étendre les assertions après l'appel à `migrate()` :

```ts
    expect(report.templatesCreated).toBe(1);
    expect(report.savedReportsCreated).toBe(1);
    expect(report.outlookConfigsCreated).toBe(1);

    const templates = await rawDb.taskTemplate.findMany({ where: { organizationId: report.organizationId } });
    expect(templates).toHaveLength(1);
    expect(templates[0].subtaskTitles).toEqual(['Devis', 'Pose']);

    const reports = await rawDb.savedReport.findMany({ where: { organizationId: report.organizationId } });
    expect(reports).toHaveLength(1);
    expect(reports[0].periodLabel).toBe('Semaine 37');

    const configs = await rawDb.outlookConfig.findMany({});
    expect(configs).toHaveLength(1);
    expect(configs[0].icsUrl).toBe('https://example.com/cal.ics');
```

- [ ] **Step 2: Run — vérifier l'échec**

Run: `npm test -- migrateCore`
Expected: FAIL — `report.templatesCreated` est `undefined`.

- [ ] **Step 3: Étendre `MigrationReport` et `migrate()`**

Dans `todox-backend/scripts/migrateCore.ts`, étendre l'interface (ligne 18-27) :

```ts
export interface MigrationReport {
  organizationId: string;
  usersCreated: number;
  projectsCreated: number;
  tasksCreated: number;
  timeEntriesCreated: number;
  commentsCreated: number;
  templatesCreated: number;
  savedReportsCreated: number;
  outlookConfigsCreated: number;
  tempPasswords: Array<{ email: string; password: string }>;
  unmappedUserIds: string[];
}
```

Ajouter, juste avant le bloc `if (unmappedUserIds.size > 0)` (après la boucle `timeEntries`) :

```ts
      let templatesCreated = 0;
      for (const tpl of rawData.templates ?? []) {
        await tx.taskTemplate.create({
          data: {
            organizationId: org.id,
            name: tpl.name,
            subtaskTitles: Array.isArray(tpl.subtaskTitles) ? tpl.subtaskTitles : [],
          },
        });
        templatesCreated++;
      }

      let savedReportsCreated = 0;
      for (const r of rawData.savedReports ?? []) {
        await tx.savedReport.create({
          data: {
            organizationId: org.id,
            generatedById: mapUser(r.generatedBy),
            generatedAt: r.generatedAt ? new Date(r.generatedAt) : new Date(),
            periodType: r.periodType,
            periodLabel: r.periodLabel,
            taskCount: r.taskCount ?? 0,
            reportText: r.reportText ?? '',
          },
        });
        savedReportsCreated++;
      }

      // upsert (pas create) : deux anciens ids non-mappes peuvent retomber sur le
      // meme utilisateur admin par defaut (voir mapUser ci-dessus) ; OutlookConfig
      // a `userId` comme cle primaire, un create en double ferait echouer toute
      // la migration sur une contrainte d'unicite pour un cas de donnees deja
      // degrade (config d'un utilisateur non reconnu).
      let outlookConfigsCreated = 0;
      for (const [oldUserId, cfgRaw] of Object.entries(rawData.outlookConfigs ?? {})) {
        const cfg = cfgRaw as { enabled?: boolean; icsUrl?: string; exportEnabled?: boolean; lastSync?: number | null };
        const userId = mapUser(oldUserId);
        await tx.outlookConfig.upsert({
          where: { userId },
          create: {
            userId,
            enabled: !!cfg.enabled,
            icsUrl: cfg.icsUrl ?? '',
            exportEnabled: !!cfg.exportEnabled,
            lastSync: cfg.lastSync ? new Date(cfg.lastSync) : null,
          },
          update: {
            enabled: !!cfg.enabled,
            icsUrl: cfg.icsUrl ?? '',
            exportEnabled: !!cfg.exportEnabled,
            lastSync: cfg.lastSync ? new Date(cfg.lastSync) : null,
          },
        });
        outlookConfigsCreated++;
      }
```

Puis étendre l'objet retourné (bloc `return { ... }` en fin de fonction) :

```ts
      return {
        organizationId: org.id,
        usersCreated: userIdMap.size,
        projectsCreated: projectIdByName.size,
        tasksCreated,
        timeEntriesCreated,
        commentsCreated,
        templatesCreated,
        savedReportsCreated,
        outlookConfigsCreated,
        tempPasswords,
        unmappedUserIds: [...unmappedUserIds],
      };
```

- [ ] **Step 4: Mettre à jour le résumé du CLI**

Dans `todox-backend/scripts/migrate-from-json.ts`, remplacer la ligne du résumé (actuellement `console.log(\`✅ ${report.usersCreated} utilisateurs, ...\`)`) par :

```ts
  console.log(`✅ ${report.usersCreated} utilisateurs, ${report.projectsCreated} projets, ${report.tasksCreated} tâches, ${report.timeEntriesCreated} saisies de temps, ${report.commentsCreated} commentaires`);
  console.log(`✅ ${report.templatesCreated} modèles, ${report.savedReportsCreated} rapports sauvegardés, ${report.outlookConfigsCreated} configurations Outlook`);
```

- [ ] **Step 5: Run — vérifier le succès**

Run: `npm test` puis `npm run build`
Expected: tout PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrateCore.ts scripts/migrate-from-json.ts tests/migrateCore.test.ts
git commit -m "feat: migration templates, rapports sauvegardes, config Outlook"
```

---

## Suite

Une fois ce plan exécuté (revue de tâche + revue finale de branche, comme le sous-projet 1), le backend couvre 100% des domaines de données du frontend actuel. La spec de bascule transparente ([docs/superpowers/specs/2026-09-10-transparent-backend-cutover-design.md](../specs/2026-09-10-transparent-backend-cutover-design.md)) peut alors passer par `writing-plans` à son tour.
