/**
 * Script de migration one-shot : data.json → PostgreSQL
 *
 * Usage :
 *   cd scripts
 *   DATABASE_URL="postgresql://todox:todox_dev@localhost:5432/todox" \
 *   ADMIN_EMAIL="ton@email.com" \
 *   ADMIN_PASSWORD="motdepasse" \
 *   npx ts-node migrate-json-to-pg.ts [/chemin/vers/data.json]
 *
 * Par défaut, cherche ~/OneDrive - CEA/DATA/To-Do-X/data.json
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const prisma = new PrismaClient();

interface OldTask {
  id: string;
  title: string;
  project: string;
  due?: string | null;
  priority?: 'low' | 'med' | 'high';
  status?: 'todo' | 'doing' | 'review' | 'done';
  createdBy?: string;
  assignedTo?: string[];
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number | null;
  notes?: string;
  archived?: boolean;
  archivedAt?: number | null;
  subtasks?: any[];
  favorite?: boolean;
  deletedAt?: number | null;
  ganttDays?: any[];
  order?: number;
  recurrence?: any;
  reviewers?: string[];
  reviewValidatedBy?: string;
  reviewValidatedAt?: number;
  reviewRejectedBy?: string;
  reviewRejectedAt?: number;
  rejectionComment?: string;
  movedToReviewBy?: string;
  movedToReviewAt?: number;
  convertedFromSubtask?: any;
  parentTaskId?: string;
}

interface OldUser {
  id: string;
  name: string;
  email: string;
}

interface OldComment {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  createdAt: number;
  deletedAt?: number | null;
}

interface OldTimeEntry {
  id: string;
  project: string;
  date: string;
  hours: number;
  userId: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredData {
  tasks?: OldTask[];
  users?: OldUser[];
  comments?: Record<string, OldComment[]>;
  timeEntries?: OldTimeEntry[];
  projectHistory?: string[];
  projectColors?: Record<string, number>;
  directories?: Record<string, string>;
  notificationSettings?: any;
  themeSettings?: any;
  outlookConfig?: any;
  templates?: any[];
  savedReports?: any[];
}

function toDate(ts?: number | null): Date | null {
  if (!ts) return null;
  return new Date(ts);
}

const STATUS_MAP: Record<string, string> = {
  todo: 'TODO',
  doing: 'DOING',
  review: 'REVIEW',
  done: 'DONE',
};

const PRIORITY_MAP: Record<string, string> = {
  low: 'LOW',
  med: 'MED',
  high: 'HIGH',
};

async function main() {
  const defaultPath = path.join(os.homedir(), 'OneDrive - CEA', 'DATA', 'To-Do-X', 'data.json');
  const dataPath = process.argv[2] ?? defaultPath;

  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Fichier introuvable : ${dataPath}`);
    console.error('   Passe le chemin en argument : npx ts-node migrate-json-to-pg.ts /chemin/data.json');
    process.exit(1);
  }

  console.log(`📂 Lecture de ${dataPath}...`);
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data: StoredData = JSON.parse(raw);

  // ── 1. Créer/migrer les utilisateurs ─────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('❌ ADMIN_EMAIL et ADMIN_PASSWORD requis (variables d\'environnement)');
    process.exit(1);
  }

  const userIdMap: Record<string, string> = {}; // ancien id → nouveau id Prisma

  console.log('\n👥 Migration des utilisateurs...');
  const adminHash = await bcrypt.hash(adminPassword, 12);

  // L'utilisateur admin (toi) — premier de la liste ou créé si vide
  const oldUsers = data.users ?? [];
  for (const oldUser of oldUsers) {
    const isAdmin = oldUser.email === adminEmail;
    const existing = await prisma.user.findUnique({ where: { email: oldUser.email } });
    let newUser;
    if (existing) {
      newUser = existing;
      console.log(`  ↩  ${oldUser.email} existe déjà`);
    } else {
      const tempPassword = isAdmin ? adminHash : await bcrypt.hash('ChangeMe123!', 12);
      newUser = await prisma.user.create({
        data: {
          id: oldUser.id, // conserver l'ID pour les références
          name: oldUser.name,
          email: oldUser.email,
          password: tempPassword,
        },
      });
      console.log(`  ✓  ${oldUser.email}${isAdmin ? ' (admin)' : ' (mot de passe temporaire: ChangeMe123!)'}`);
    }
    userIdMap[oldUser.id] = newUser.id;
  }

  // Si aucun utilisateur dans le JSON, créer l'admin
  if (oldUsers.length === 0) {
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: { name: 'Admin', email: adminEmail, password: adminHash },
    });
    userIdMap['__admin__'] = adminUser.id;
    console.log(`  ✓  Admin créé : ${adminEmail}`);
  }

  const fallbackUserId = Object.values(userIdMap)[0];

  // ── 2. Migrer les tâches ──────────────────────────────────────────────────
  const tasks = data.tasks ?? [];
  console.log(`\n📋 Migration de ${tasks.length} tâches...`);

  // Première passe : tâches sans parentTaskId
  const rootTasks = tasks.filter(t => !t.parentTaskId);
  const childTasks = tasks.filter(t => t.parentTaskId);

  const migrateTask = async (oldTask: OldTask) => {
    const createdById = (oldTask.createdBy && userIdMap[oldTask.createdBy]) ?? fallbackUserId;
    const status = STATUS_MAP[oldTask.status ?? 'todo'] as any;
    const priority = PRIORITY_MAP[oldTask.priority ?? 'med'] as any;

    await prisma.task.upsert({
      where: { id: oldTask.id },
      update: {},
      create: {
        id: oldTask.id,
        title: oldTask.title,
        project: oldTask.project.toUpperCase(),
        due: oldTask.due ?? null,
        priority,
        status,
        notes: oldTask.notes ?? '',
        archived: oldTask.archived ?? false,
        archivedAt: toDate(oldTask.archivedAt),
        favorite: oldTask.favorite ?? false,
        deletedAt: toDate(oldTask.deletedAt),
        subtasks: (oldTask.subtasks ?? []) as any,
        ganttDays: (oldTask.ganttDays ?? []) as any,
        recurrence: oldTask.recurrence ?? null,
        assignedTo: oldTask.assignedTo ?? [],
        reviewers: oldTask.reviewers ?? [],
        order: oldTask.order ?? 0,
        reviewValidatedBy: oldTask.reviewValidatedBy ?? null,
        reviewValidatedAt: toDate(oldTask.reviewValidatedAt),
        reviewRejectedBy: oldTask.reviewRejectedBy ?? null,
        reviewRejectedAt: toDate(oldTask.reviewRejectedAt),
        rejectionComment: oldTask.rejectionComment ?? null,
        movedToReviewBy: oldTask.movedToReviewBy ?? null,
        movedToReviewAt: toDate(oldTask.movedToReviewAt),
        convertedFromSubtask: (oldTask.convertedFromSubtask ?? null) as any,
        parentTaskId: oldTask.parentTaskId ?? null,
        createdById,
        createdAt: toDate(oldTask.createdAt) ?? new Date(),
        updatedAt: toDate(oldTask.updatedAt) ?? new Date(),
        completedAt: toDate(oldTask.completedAt),
      },
    });
  };

  for (const t of rootTasks) await migrateTask(t);
  for (const t of childTasks) await migrateTask(t);
  console.log(`  ✓  ${tasks.length} tâches migrées`);

  // ── 3. Migrer les commentaires ────────────────────────────────────────────
  const allComments = Object.values(data.comments ?? {}).flat();
  console.log(`\n💬 Migration de ${allComments.length} commentaires...`);
  for (const c of allComments) {
    const userId = userIdMap[c.userId] ?? fallbackUserId;
    await prisma.comment.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        text: c.text,
        taskId: c.taskId,
        userId,
        createdAt: toDate(c.createdAt) ?? new Date(),
        deletedAt: toDate(c.deletedAt),
      },
    });
  }
  console.log(`  ✓  ${allComments.length} commentaires migrés`);

  // ── 4. Migrer les pointages ───────────────────────────────────────────────
  const timeEntries = data.timeEntries ?? [];
  console.log(`\n⏱  Migration de ${timeEntries.length} pointages...`);
  for (const e of timeEntries) {
    const userId = userIdMap[e.userId] ?? fallbackUserId;
    await prisma.timeEntry.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        project: e.project.toUpperCase(),
        date: e.date,
        hours: e.hours,
        note: e.note ?? null,
        userId,
        createdAt: toDate(e.createdAt) ?? new Date(),
        updatedAt: toDate(e.updatedAt) ?? new Date(),
      },
    });
  }
  console.log(`  ✓  ${timeEntries.length} pointages migrés`);

  // ── 5. Migrer les settings globaux ───────────────────────────────────────
  console.log('\n⚙️  Migration des paramètres...');
  const settingsToMigrate: Record<string, any> = {
    projectHistory: data.projectHistory ?? [],
    projectColors: data.projectColors ?? {},
    directories: data.directories ?? {},
    ...(data.notificationSettings ? { notificationSettings: data.notificationSettings } : {}),
    ...(data.themeSettings ? { themeSettings: data.themeSettings } : {}),
    ...(data.outlookConfig ? { outlookConfig: data.outlookConfig } : {}),
  };

  for (const [key, value] of Object.entries(settingsToMigrate)) {
    await prisma.appSettings.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
    console.log(`  ✓  ${key}`);
  }

  console.log('\n✅ Migration terminée avec succès !');
  console.log('\n⚠️  Rappel : les utilisateurs importés (hors admin) ont le mot de passe temporaire "ChangeMe123!"');
  console.log('   Demande-leur de le changer après leur première connexion.');
}

main()
  .catch(e => { console.error('❌ Erreur de migration:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
