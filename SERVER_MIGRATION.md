# Guide de migration - Base de données serveur partagée

## Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│                    To-DoX Electron App (Client)              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Frontend                                        │  │
│  │  - Login/Logout UI                                     │  │
│  │  - API Client (fetch/axios)                            │  │
│  │  - Token storage (localStorage)                        │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + JWT Token
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js + Express Backend (Serveur)             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API REST                                              │  │
│  │  - /auth/login, /auth/register                         │  │
│  │  - /tasks (CRUD)                                       │  │
│  │  - /users (CRUD)                                       │  │
│  │  - /projects (CRUD)                                    │  │
│  │  - Middleware JWT verification                         │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL Queries
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Tables:                                               │  │
│  │  - users (id, email, password_hash, name)              │  │
│  │  - tasks (id, title, project, status, priority, ...)   │  │
│  │  - task_assignments (task_id, user_id)                 │  │
│  │  - projects (id, name, color, owner_id)                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Stack technique choisie

- **Frontend**: To-DoX Electron (React 19 + TypeScript)
- **Backend**: Node.js + Express + TypeScript
- **Base de données**: PostgreSQL 15+
- **ORM**: Prisma (type-safe, migrations automatiques)
- **Authentification**: JWT (jsonwebtoken) + bcrypt
- **Communication**: REST API (HTTPS)

---

## Étape 1: Installation du serveur PostgreSQL

### Sur Windows (votre serveur personnel)

1. **Télécharger PostgreSQL**:
   - Aller sur https://www.postgresql.org/download/windows/
   - Télécharger l'installeur officiel (version 15 ou 16)

2. **Installer PostgreSQL**:
   ```
   - Port par défaut: 5432
   - Mot de passe superuser (postgres): [CHOISIR UN MOT DE PASSE FORT]
   - Locale: French_France.UTF-8
   ```

3. **Créer la base de données To-DoX**:
   ```bash
   # Ouvrir pgAdmin ou psql
   psql -U postgres

   # Dans psql:
   CREATE DATABASE todox;
   CREATE USER todox_user WITH ENCRYPTED PASSWORD 'votre_mot_de_passe_fort';
   GRANT ALL PRIVILEGES ON DATABASE todox TO todox_user;
   \q
   ```

4. **Configuration réseau** (pour accès distant):
   - Éditer `C:\Program Files\PostgreSQL\15\data\postgresql.conf`:
     ```
     listen_addresses = '*'  # Écouter sur toutes les interfaces
     ```
   - Éditer `C:\Program Files\PostgreSQL\15\data\pg_hba.conf`:
     ```
     # IPv4 local connections:
     host    todox    todox_user    192.168.0.0/16    scram-sha-256
     ```
   - Redémarrer PostgreSQL: `services.msc` → PostgreSQL → Restart

---

## Étape 2: Création du backend Node.js + Express

### Structure du projet backend

```
todox-backend/
├── src/
│   ├── index.ts              # Point d'entrée Express
│   ├── config/
│   │   └── database.ts       # Configuration Prisma
│   ├── routes/
│   │   ├── auth.ts           # Routes authentification
│   │   ├── tasks.ts          # Routes tasks CRUD
│   │   ├── users.ts          # Routes users CRUD
│   │   └── projects.ts       # Routes projects
│   ├── middleware/
│   │   └── auth.ts           # Middleware JWT verification
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── taskController.ts
│   │   └── userController.ts
│   └── utils/
│       └── jwt.ts            # Helpers JWT
├── prisma/
│   ├── schema.prisma         # Schéma de la base de données
│   └── migrations/           # Migrations SQL
├── .env                      # Variables d'environnement
├── package.json
└── tsconfig.json
```

### Initialisation du projet

```bash
mkdir todox-backend
cd todox-backend
npm init -y

# Dépendances
npm install express cors dotenv bcrypt jsonwebtoken
npm install @prisma/client
npm install -D typescript @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken
npm install -D prisma ts-node nodemon

# Initialiser Prisma
npx prisma init
```

### Configuration `.env`

```env
# .env
DATABASE_URL="postgresql://todox_user:votre_mot_de_passe_fort@localhost:5432/todox"
JWT_SECRET="VOTRE_CLE_SECRETE_TRES_LONGUE_ET_ALEATOIRE_123456789"
JWT_EXPIRATION="7d"
PORT=3001
NODE_ENV="development"
```

### Schéma Prisma `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String    @map("password_hash")
  name          String
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  createdTasks  Task[]    @relation("CreatedTasks")
  assignedTasks TaskAssignment[]
  projects      Project[]

  @@map("users")
}

model Task {
  id            String     @id @default(uuid())
  title         String
  project       String
  status        String     // 'todo' | 'doing' | 'review' | 'done'
  priority      String     // 'low' | 'med' | 'high'
  deadline      String?
  notes         String?
  archived      Boolean    @default(false)
  completedAt   String?    @map("completed_at")
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  createdBy     String     @map("created_by")
  creator       User       @relation("CreatedTasks", fields: [createdBy], references: [id], onDelete: Cascade)

  assignments   TaskAssignment[]
  subtasks      Subtask[]

  @@index([project])
  @@index([status])
  @@index([createdBy])
  @@map("tasks")
}

model TaskAssignment {
  id        String   @id @default(uuid())
  taskId    String   @map("task_id")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId])
  @@index([taskId])
  @@index([userId])
  @@map("task_assignments")
}

model Subtask {
  id          String   @id @default(uuid())
  taskId      String   @map("task_id")
  title       String
  completed   Boolean  @default(false)
  order       Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")

  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@map("subtasks")
}

model Project {
  id          String   @id @default(uuid())
  name        String   @unique
  color       Int?
  directory   String?
  ownerId     String   @map("owner_id")
  archived    Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([name])
  @@index([ownerId])
  @@map("projects")
}
```

### Migration de la base de données

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Étape 3: Implémentation du backend

### `src/index.ts` - Point d'entrée Express

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import userRoutes from './routes/users';
import projectRoutes from './routes/projects';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 To-DoX Backend running on http://localhost:${PORT}`);
});
```

### `src/middleware/auth.ts` - Middleware JWT

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
};
```

### `src/routes/auth.ts` - Routes authentification

```typescript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: { email, passwordHash, name }
    });

    // Générer JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Générer JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me - Récupérer l'utilisateur connecté
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(403).json({ error: 'Token invalide' });
  }
});

export default router;
```

### `src/routes/tasks.ts` - Routes CRUD tasks

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

// GET /api/tasks - Récupérer toutes les tâches
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { archived: false },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        subtasks: { orderBy: { order: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transformer pour matcher le format frontend
    const transformedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      project: task.project,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      notes: task.notes,
      archived: task.archived,
      completedAt: task.completedAt,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdBy: task.createdBy,
      assignedTo: task.assignments.map(a => a.userId),
      subtasks: task.subtasks.map(s => ({
        id: s.id,
        title: s.title,
        completed: s.completed
      }))
    }));

    res.json(transformedTasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/tasks - Créer une nouvelle tâche
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, project, status, priority, deadline, notes, assignedTo } = req.body;
    const userId = req.userId!;

    // Validation
    if (!title || !project) {
      return res.status(400).json({ error: 'Titre et projet requis' });
    }

    // Créer la tâche
    const task = await prisma.task.create({
      data: {
        title,
        project: project.toUpperCase(),
        status: status || 'todo',
        priority: priority || 'med',
        deadline,
        notes,
        createdBy: userId,
        assignments: {
          create: (assignedTo || [userId]).map((userId: string) => ({
            userId
          }))
        }
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        subtasks: true
      }
    });

    res.status(201).json({
      id: task.id,
      title: task.title,
      project: task.project,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      notes: task.notes,
      archived: task.archived,
      completedAt: task.completedAt,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdBy: task.createdBy,
      assignedTo: task.assignments.map(a => a.userId),
      subtasks: []
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/tasks/:id - Mettre à jour une tâche
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, project, status, priority, deadline, notes, assignedTo } = req.body;

    // Vérifier que la tâche existe
    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      title,
      project: project?.toUpperCase(),
      status,
      priority,
      deadline,
      notes
    };

    // Auto-update completedAt when status changes to 'done'
    if (status === 'done' && existingTask.status !== 'done') {
      updateData.completedAt = new Date().toISOString();
    } else if (status !== 'done' && existingTask.status === 'done') {
      updateData.completedAt = null;
    }

    // Mettre à jour les assignments si fournis
    if (assignedTo) {
      // Supprimer les anciens assignments
      await prisma.taskAssignment.deleteMany({ where: { taskId: id } });
      // Créer les nouveaux
      updateData.assignments = {
        create: assignedTo.map((userId: string) => ({ userId }))
      };
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        subtasks: { orderBy: { order: 'asc' } }
      }
    });

    res.json({
      id: task.id,
      title: task.title,
      project: task.project,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      notes: task.notes,
      archived: task.archived,
      completedAt: task.completedAt,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdBy: task.createdBy,
      assignedTo: task.assignments.map(a => a.userId),
      subtasks: task.subtasks.map(s => ({
        id: s.id,
        title: s.title,
        completed: s.completed
      }))
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/tasks/:id - Supprimer une tâche
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/tasks/:id/subtasks - Ajouter une sous-tâche
router.post('/:id/subtasks', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Titre requis' });
    }

    // Récupérer le nombre de subtasks pour définir l'ordre
    const count = await prisma.subtask.count({ where: { taskId: id } });

    const subtask = await prisma.subtask.create({
      data: {
        taskId: id,
        title,
        order: count
      }
    });

    res.status(201).json({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.completed
    });
  } catch (error) {
    console.error('Create subtask error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

### `src/routes/users.ts` - Routes users

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/users - Liste tous les utilisateurs
router.get('/', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

### `package.json` - Scripts

```json
{
  "name": "todox-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:migrate": "npx prisma migrate dev",
    "prisma:generate": "npx prisma generate",
    "prisma:studio": "npx prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "@types/cors": "^2.8.13",
    "@types/express": "^4.17.17",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/node": "^20.4.2",
    "nodemon": "^3.0.1",
    "prisma": "^5.0.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.6"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

## Étape 4: Modification du frontend To-DoX

### Ajout de l'authentification

#### 1. Créer un service API client `src/services/api.ts`

```typescript
import type { Task, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Stockage du token JWT
let authToken: string | null = localStorage.getItem('todox_auth_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('todox_auth_token', token);
  } else {
    localStorage.removeItem('todox_auth_token');
  }
};

// Helper pour les requêtes authentifiées
const authFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expiré ou invalide
    setAuthToken(null);
    throw new Error('Session expirée, veuillez vous reconnecter');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || 'Erreur serveur');
  }

  return response;
};

// ============================================================================
// AUTH API
// ============================================================================

export interface LoginResponse {
  user: { id: string; name: string; email: string };
  token: string;
}

export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur de connexion');
    }

    const data: LoginResponse = await response.json();
    setAuthToken(data.token);
    return data;
  },

  register: async (email: string, password: string, name: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur d\'inscription');
    }

    const data: LoginResponse = await response.json();
    setAuthToken(data.token);
    return data;
  },

  me: async (): Promise<{ user: { id: string; name: string; email: string } }> => {
    const response = await authFetch('/auth/me');
    return response.json();
  },

  logout: () => {
    setAuthToken(null);
  },
};

// ============================================================================
// TASKS API
// ============================================================================

export const tasksAPI = {
  getAll: async (): Promise<Task[]> => {
    const response = await authFetch('/tasks');
    return response.json();
  },

  create: async (taskData: Partial<Task>): Promise<Task> => {
    const response = await authFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
    return response.json();
  },

  update: async (id: string, taskData: Partial<Task>): Promise<Task> => {
    const response = await authFetch(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    await authFetch(`/tasks/${id}`, { method: 'DELETE' });
  },

  addSubtask: async (taskId: string, title: string): Promise<{ id: string; title: string; completed: boolean }> => {
    const response = await authFetch(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    return response.json();
  },
};

// ============================================================================
// USERS API
// ============================================================================

export const usersAPI = {
  getAll: async (): Promise<User[]> => {
    const response = await authFetch('/users');
    return response.json();
  },
};
```

#### 2. Créer un composant Login `src/components/LoginPanel.tsx`

```typescript
import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { alertModal } from '../utils/confirm';

interface LoginPanelProps {
  onLoginSuccess: (user: { id: string; name: string; email: string }) => void;
}

export function LoginPanel({ onLoginSuccess }: LoginPanelProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegister) {
        const { user } = await authAPI.register(email, password, name);
        onLoginSuccess(user);
      } else {
        const { user } = await authAPI.login(email, password);
        onLoginSuccess(user);
      }
    } catch (error) {
      alertModal(error instanceof Error ? error.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-white mb-6">
          To-DoX
        </h1>
        <h2 className="text-xl font-semibold text-slate-300 text-center mb-6">
          {isRegister ? 'Créer un compte' : 'Connexion'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nom complet
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Jean Dupont"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="jean.dupont@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Chargement...' : (isRegister ? 'Créer mon compte' : 'Se connecter')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-purple-400 hover:text-purple-300 transition"
          >
            {isRegister ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 3. Modifier le store `src/store/useStore.ts`

```typescript
// Ajouter à l'interface StoreState:
interface StoreState {
  // ... existing state
  isAuthenticated: boolean;
  authenticatedUser: { id: string; name: string; email: string } | null;

  // Actions
  setAuthenticatedUser: (user: { id: string; name: string; email: string } | null) => void;
  logout: () => void;
}

// Dans la fonction create():
export const useStore = create<StoreState>((set, get) => ({
  // ... existing state
  isAuthenticated: false,
  authenticatedUser: null,

  // ... existing actions

  setAuthenticatedUser: (user) => set({
    authenticatedUser: user,
    isAuthenticated: !!user,
    currentUser: user?.id || null
  }),

  logout: () => {
    authAPI.logout();
    set({
      authenticatedUser: null,
      isAuthenticated: false,
      currentUser: null,
      tasks: [],
      users: [],
      directories: {},
      projectHistory: [],
      projectColors: {},
    });
  },
}));
```

#### 4. Modifier le composant principal `src/ToDoX.tsx`

```typescript
import { LoginPanel } from './components';
import { authAPI, tasksAPI, usersAPI } from './services/api';

export default function ToDoX() {
  const { isAuthenticated, authenticatedUser, setAuthenticatedUser, setTasks, setUsers, logout } = useStore();

  // Vérifier l'authentification au montage
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await authAPI.me();
        setAuthenticatedUser(user);

        // Charger les données depuis le serveur
        const [tasks, users] = await Promise.all([
          tasksAPI.getAll(),
          usersAPI.getAll()
        ]);

        setTasks(tasks);
        setUsers(users);
      } catch (error) {
        console.log('Non authentifié');
      }
    };

    checkAuth();
  }, []);

  // Afficher le login si non authentifié
  if (!isAuthenticated) {
    return <LoginPanel onLoginSuccess={setAuthenticatedUser} />;
  }

  // ... reste du composant inchangé
}
```

#### 5. Modifier le hook de persistence `src/hooks/useDataPersistence.ts`

```typescript
import { tasksAPI, usersAPI } from '../services/api';

export function useDataPersistence() {
  const { isAuthenticated, setTasks, setUsers } = useStore();

  // Ne charger les données que si authentifié
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      try {
        const [tasks, users] = await Promise.all([
          tasksAPI.getAll(),
          usersAPI.getAll()
        ]);

        setTasks(tasks);
        setUsers(users);
      } catch (error) {
        console.error('Erreur de chargement des données:', error);
      }
    };

    loadData();
  }, [isAuthenticated]);

  // SUPPRIMER l'auto-save localStorage - tout passe par l'API maintenant
  // Les actions du store (addTask, updateTask, etc.) appellent directement l'API
}
```

#### 6. Modifier les actions du store pour appeler l'API

```typescript
// Dans src/store/useStore.ts

addTask: (data) => {
  const currentUser = get().currentUser || "unassigned";
  const taskData = {
    ...data,
    createdBy: data.createdBy || currentUser,
    assignedTo: data.assignedTo || [currentUser],
  };

  // Appeler l'API au lieu de setTasks
  tasksAPI.create(taskData)
    .then(newTask => {
      set({ tasks: [...get().tasks, newTask] });
    })
    .catch(error => {
      console.error('Erreur création tâche:', error);
      alertModal('Erreur lors de la création de la tâche');
    });
},

updateTask: (id, updates) => {
  tasksAPI.update(id, updates)
    .then(updatedTask => {
      set({
        tasks: get().tasks.map(t => t.id === id ? updatedTask : t)
      });
    })
    .catch(error => {
      console.error('Erreur mise à jour tâche:', error);
      alertModal('Erreur lors de la mise à jour de la tâche');
    });
},

removeTask: (id) => {
  tasksAPI.delete(id)
    .then(() => {
      set({ tasks: get().tasks.filter(t => t.id !== id) });
    })
    .catch(error => {
      console.error('Erreur suppression tâche:', error);
      alertModal('Erreur lors de la suppression de la tâche');
    });
},
```

---

## Étape 5: Déploiement et sécurisation

### 1. Démarrer le backend

```bash
cd todox-backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

### 2. Configurer le frontend

Créer `.env` dans To-DoX:

```env
VITE_API_URL=http://localhost:3001/api
```

Pour production (après déploiement):

```env
VITE_API_URL=https://votre-serveur.com/api
```

### 3. Tester en local

1. Lancer le backend: `npm run dev` (dans todox-backend)
2. Lancer le frontend: `npm run dev:electron` (dans To-DoX)
3. Créer un compte utilisateur
4. Créer des tâches et tester la synchronisation

### 4. Sécurisation HTTPS (Production)

**Option 1: Reverse proxy Nginx** (recommandé)

```nginx
server {
    listen 443 ssl http2;
    server_name votre-serveur.com;

    ssl_certificate /etc/letsencrypt/live/votre-serveur.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-serveur.com/privkey.pem;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Option 2: Certificat Let's Encrypt**

```bash
# Installer certbot
sudo apt install certbot

# Générer certificat
sudo certbot certonly --standalone -d votre-serveur.com
```

### 5. Déploiement production backend

```bash
# Dans todox-backend
npm run build
npm start  # ou utiliser PM2 pour garder le process actif

# Avec PM2 (recommandé)
npm install -g pm2
pm2 start dist/index.js --name todox-backend
pm2 save
pm2 startup  # Configure PM2 pour redémarrer au boot
```

### 6. Build production frontend

```bash
cd To-DoX
npm run build:electron
```

Distribuer l'installer `.exe` avec la variable `VITE_API_URL` configurée pour pointer vers votre serveur.

---

## Étape 6: Migration des données existantes

### Script de migration `migrate-local-to-server.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function migrate() {
  // Lire le fichier data.json local
  const dataPath = path.join(process.env.HOME!, 'OneDrive - CEA', 'DATA', 'To-Do-X', 'data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log('Migration en cours...');

  // 1. Créer les utilisateurs
  const userMap: Record<string, string> = {};
  for (const user of data.users || []) {
    const createdUser = await prisma.user.create({
      data: {
        email: user.email || `${user.id}@temp.com`,
        name: user.name,
        passwordHash: 'TEMP_HASH_TO_RESET' // L'utilisateur devra réinitialiser son mot de passe
      }
    });
    userMap[user.id] = createdUser.id;
    console.log(`Utilisateur créé: ${user.name}`);
  }

  // 2. Migrer les tâches
  for (const task of data.tasks || []) {
    const createdTask = await prisma.task.create({
      data: {
        title: task.title,
        project: task.project,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
        notes: task.notes,
        archived: task.archived || false,
        completedAt: task.completedAt,
        createdBy: userMap[task.createdBy] || userMap[task.assignedTo?.[0]] || Object.values(userMap)[0],
        assignments: {
          create: (task.assignedTo || []).map((userId: string) => ({
            userId: userMap[userId] || Object.values(userMap)[0]
          }))
        },
        subtasks: {
          create: (task.subtasks || []).map((subtask: any, idx: number) => ({
            title: subtask.title,
            completed: subtask.completed,
            order: idx
          }))
        }
      }
    });
    console.log(`Tâche créée: ${task.title}`);
  }

  console.log('Migration terminée !');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Pour exécuter la migration:

```bash
cd todox-backend
npx ts-node migrate-local-to-server.ts
```

---

## Récapitulatif des commandes

### Backend (première installation)

```bash
cd todox-backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Frontend (développement)

```bash
cd To-DoX
npm run dev:electron
```

### Production

```bash
# Backend
cd todox-backend
npm run build
pm2 start dist/index.js --name todox-backend

# Frontend
cd To-DoX
npm run build:electron
```

---

## Prochaines étapes (optionnel)

1. **WebSockets pour synchronisation temps réel** : Socket.io
2. **Système de notifications** : Push notifications
3. **Mode hors ligne** : Service Workers + IndexedDB cache
4. **Gestion des rôles** : Admin, User, Guest
5. **Audit logs** : Historique des modifications
6. **Export PDF côté serveur** : Puppeteer ou PDFKit
7. **Backup automatique** : Cron job quotidien de la DB

---

## Support et dépannage

### Problème: "Cannot connect to database"

1. Vérifier que PostgreSQL est démarré:
   ```bash
   # Windows
   services.msc → PostgreSQL

   # Linux
   sudo systemctl status postgresql
   ```

2. Vérifier la variable `DATABASE_URL` dans `.env`

3. Tester la connexion:
   ```bash
   npx prisma studio
   ```

### Problème: "CORS error" dans le frontend

Vérifier la configuration CORS dans `src/index.ts`:

```typescript
app.use(cors({
  origin: 'http://localhost:5173', // Ajuster selon votre URL frontend
  credentials: true
}));
```

### Problème: "Token invalide"

Le JWT a peut-être expiré. Se reconnecter dans l'application.

Pour augmenter la durée de validité, modifier `.env`:

```env
JWT_EXPIRATION=30d  # 30 jours
```

---

## Ressources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Express Documentation](https://expressjs.com/)
- [JWT Best Practices](https://jwt.io/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Besoin d'aide ?** N'hésitez pas à me demander des clarifications sur n'importe quelle étape !
