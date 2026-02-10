# Guide de migration - Base de données JSON partagée

## Architecture simplifiée

```
┌─────────────────────────────────────────────────────────────┐
│                    To-DoX Electron App (Client)              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Frontend                                        │  │
│  │  - Login/Logout UI                                     │  │
│  │  - API Client (fetch)                                  │  │
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
│  │  - fs.readFileSync/writeFileSync                       │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Lecture/Écriture
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Fichiers JSON (Database)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  data/                                                 │  │
│  │  ├── users.json      (utilisateurs + passwords)        │  │
│  │  ├── tasks.json      (toutes les tâches)               │  │
│  │  └── projects.json   (projets)                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Avantages de la base JSON

✅ **Simplicité**: Pas de serveur de base de données à installer
✅ **Lisibilité**: Fichiers JSON faciles à lire et modifier manuellement
✅ **Backup**: Simple copie des fichiers JSON
✅ **Déploiement**: Juste Node.js requis
✅ **Suffisant**: Pour 5-20 utilisateurs, largement adapté

## Limitations (acceptables pour To-DoX)

⚠️ **Concurrence**: Plusieurs écritures simultanées peuvent causer des conflits (rare avec peu d'utilisateurs)
⚠️ **Performance**: Moins rapide avec des milliers de tâches (acceptable < 10 000 tâches)
⚠️ **Requêtes complexes**: Pas de SQL pour des recherches avancées

---

## Étape 1: Structure du backend avec JSON

### Créer le projet backend

```bash
mkdir todox-backend
cd todox-backend
npm init -y

# Installer les dépendances
npm install express cors dotenv bcrypt jsonwebtoken uuid
npm install -D typescript @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken ts-node nodemon
```

### Structure des fichiers

```
todox-backend/
├── src/
│   ├── index.ts              # Point d'entrée Express
│   ├── db/
│   │   └── database.ts       # Gestionnaire JSON database
│   ├── routes/
│   │   ├── auth.ts           # Routes authentification
│   │   ├── tasks.ts          # Routes tasks CRUD
│   │   ├── users.ts          # Routes users
│   │   └── projects.ts       # Routes projects
│   ├── middleware/
│   │   └── auth.ts           # Middleware JWT
│   └── types/
│       └── index.ts          # Types TypeScript
├── data/                     # Base de données JSON
│   ├── users.json
│   ├── tasks.json
│   └── projects.json
├── .env
├── package.json
└── tsconfig.json
```

---

## Étape 2: Configuration

### `.env`

```env
JWT_SECRET="VOTRE_CLE_SECRETE_TRES_LONGUE_ET_ALEATOIRE_123456789"
JWT_EXPIRATION="7d"
PORT=3001
NODE_ENV="development"
DATA_DIR="./data"
```

### `package.json` - Scripts

```json
{
  "name": "todox-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "@types/cors": "^2.8.13",
    "@types/express": "^4.17.17",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/node": "^20.4.2",
    "@types/uuid": "^9.0.2",
    "nodemon": "^3.0.1",
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

## Étape 3: Types TypeScript

### `src/types/index.ts`

```typescript
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  priority: 'low' | 'med' | 'high';
  deadline?: string;
  notes?: string;
  archived: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo: string[];
  subtasks: Subtask[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Project {
  id: string;
  name: string;
  color?: number;
  directory?: string;
  ownerId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  users: User[];
  tasks: Task[];
  projects: Project[];
}
```

---

## Étape 4: Gestionnaire de base de données JSON

### `src/db/database.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { Database, User, Task, Project } from '../types';

const DATA_DIR = process.env.DATA_DIR || './data';

// S'assurer que le dossier data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fichiers JSON
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Initialiser les fichiers s'ils n'existent pas
function initFile(filePath: string, defaultData: any) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initFile(USERS_FILE, []);
initFile(TASKS_FILE, []);
initFile(PROJECTS_FILE, []);

// ============================================================================
// Helpers de lecture/écriture avec verrouillage simple
// ============================================================================

function readJSON<T>(filePath: string): T {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erreur lecture ${filePath}:`, error);
    return [] as T;
  }
}

function writeJSON<T>(filePath: string, data: T): void {
  try {
    // Écrire dans un fichier temporaire puis renommer (atomic write)
    const tempFile = `${filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, filePath);
  } catch (error) {
    console.error(`Erreur écriture ${filePath}:`, error);
    throw error;
  }
}

// ============================================================================
// API Database - USERS
// ============================================================================

export const db = {
  users: {
    getAll: (): User[] => {
      return readJSON<User[]>(USERS_FILE);
    },

    findById: (id: string): User | undefined => {
      const users = readJSON<User[]>(USERS_FILE);
      return users.find(u => u.id === id);
    },

    findByEmail: (email: string): User | undefined => {
      const users = readJSON<User[]>(USERS_FILE);
      return users.find(u => u.email === email);
    },

    create: (user: User): User => {
      const users = readJSON<User[]>(USERS_FILE);
      users.push(user);
      writeJSON(USERS_FILE, users);
      return user;
    },

    update: (id: string, updates: Partial<User>): User | null => {
      const users = readJSON<User[]>(USERS_FILE);
      const index = users.findIndex(u => u.id === id);
      if (index === -1) return null;

      users[index] = { ...users[index], ...updates };
      writeJSON(USERS_FILE, users);
      return users[index];
    },

    delete: (id: string): boolean => {
      const users = readJSON<User[]>(USERS_FILE);
      const filtered = users.filter(u => u.id !== id);
      if (filtered.length === users.length) return false;

      writeJSON(USERS_FILE, filtered);
      return true;
    }
  },

  // ============================================================================
  // API Database - TASKS
  // ============================================================================

  tasks: {
    getAll: (): Task[] => {
      return readJSON<Task[]>(TASKS_FILE);
    },

    findById: (id: string): Task | undefined => {
      const tasks = readJSON<Task[]>(TASKS_FILE);
      return tasks.find(t => t.id === id);
    },

    findByProject: (project: string): Task[] => {
      const tasks = readJSON<Task[]>(TASKS_FILE);
      return tasks.filter(t => t.project === project);
    },

    findByUser: (userId: string): Task[] => {
      const tasks = readJSON<Task[]>(TASKS_FILE);
      return tasks.filter(t =>
        t.createdBy === userId || t.assignedTo.includes(userId)
      );
    },

    create: (task: Task): Task => {
      const tasks = readJSON<Task[]>(TASKS_FILE);
      tasks.push(task);
      writeJSON(TASKS_FILE, tasks);
      return task;
    },

    update: (id: string, updates: Partial<Task>): Task | null => {
      const tasks = readJSON<Task[]>(TASKS_FILE);
      const index = tasks.findIndex(t => t.id === id);
      if (index === -1) return null;

      tasks[index] = {
        ...tasks[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      writeJSON(TASKS_FILE, tasks);
      return tasks[index];
    },

    delete: (id: string): boolean => {
      const tasks = readJSON<Task[]>(TASKS_FILE);
      const filtered = tasks.filter(t => t.id !== id);
      if (filtered.length === tasks.length) return false;

      writeJSON(TASKS_FILE, filtered);
      return true;
    }
  },

  // ============================================================================
  // API Database - PROJECTS
  // ============================================================================

  projects: {
    getAll: (): Project[] => {
      return readJSON<Project[]>(PROJECTS_FILE);
    },

    findById: (id: string): Project | undefined => {
      const projects = readJSON<Project[]>(PROJECTS_FILE);
      return projects.find(p => p.id === id);
    },

    findByName: (name: string): Project | undefined => {
      const projects = readJSON<Project[]>(PROJECTS_FILE);
      return projects.find(p => p.name === name);
    },

    create: (project: Project): Project => {
      const projects = readJSON<Project[]>(PROJECTS_FILE);
      projects.push(project);
      writeJSON(PROJECTS_FILE, projects);
      return project;
    },

    update: (id: string, updates: Partial<Project>): Project | null => {
      const projects = readJSON<Project[]>(PROJECTS_FILE);
      const index = projects.findIndex(p => p.id === id);
      if (index === -1) return null;

      projects[index] = {
        ...projects[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      writeJSON(PROJECTS_FILE, projects);
      return projects[index];
    },

    delete: (id: string): boolean => {
      const projects = readJSON<Project[]>(PROJECTS_FILE);
      const filtered = projects.filter(p => p.id !== id);
      if (filtered.length === projects.length) return false;

      writeJSON(PROJECTS_FILE, filtered);
      return true;
    }
  }
};
```

---

## Étape 5: Middleware JWT

### `src/middleware/auth.ts`

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

---

## Étape 6: Routes

### `src/routes/auth.ts`

```typescript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import type { User } from '../types';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    }

    // Vérifier si l'email existe déjà
    const existingUser = db.users.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user: User = {
      id: uuidv4(),
      email,
      passwordHash,
      name,
      createdAt: new Date().toISOString()
    };

    db.users.create(user);

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
    const user = db.users.findByEmail(email);
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
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = db.users.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(403).json({ error: 'Token invalide' });
  }
});

export default router;
```

### `src/routes/tasks.ts`

```typescript
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import type { Task } from '../types';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

// GET /api/tasks - Récupérer toutes les tâches non archivées
router.get('/', (req: AuthRequest, res) => {
  try {
    const tasks = db.tasks.getAll().filter(t => !t.archived);
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/tasks - Créer une nouvelle tâche
router.post('/', (req: AuthRequest, res) => {
  try {
    const { title, project, status, priority, deadline, notes, assignedTo } = req.body;
    const userId = req.userId!;

    // Validation
    if (!title || !project) {
      return res.status(400).json({ error: 'Titre et projet requis' });
    }

    const now = new Date().toISOString();

    const task: Task = {
      id: uuidv4(),
      title,
      project: project.toUpperCase(),
      status: status || 'todo',
      priority: priority || 'med',
      deadline,
      notes,
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      assignedTo: assignedTo || [userId],
      subtasks: []
    };

    db.tasks.create(task);

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/tasks/:id - Mettre à jour une tâche
router.put('/:id', (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que la tâche existe
    const existingTask = db.tasks.findById(id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    // Auto-update completedAt when status changes to 'done'
    if (updates.status === 'done' && existingTask.status !== 'done') {
      updates.completedAt = new Date().toISOString();
    } else if (updates.status !== 'done' && existingTask.status === 'done') {
      updates.completedAt = undefined;
    }

    // Uppercase project
    if (updates.project) {
      updates.project = updates.project.toUpperCase();
    }

    const updatedTask = db.tasks.update(id, updates);

    if (!updatedTask) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/tasks/:id - Supprimer une tâche
router.delete('/:id', (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const deleted = db.tasks.delete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

### `src/routes/users.ts`

```typescript
import express from 'express';
import { db } from '../db/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

// GET /api/users - Liste tous les utilisateurs
router.get('/', (req: AuthRequest, res) => {
  try {
    const users = db.users.getAll().map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt
    }));

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

---

## Étape 7: Point d'entrée Express

### `src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import userRoutes from './routes/users';

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'JSON'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 To-DoX Backend (JSON) running on http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${process.env.DATA_DIR || './data'}`);
});
```

---

## Étape 8: Démarrage et test

### Installation

```bash
cd todox-backend
npm install
```

### Lancement en développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

### Test avec curl

```bash
# Inscription
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Réponse: { "user": {...}, "token": "eyJhbG..." }

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Liste des tâches (avec token)
curl http://localhost:3001/api/tasks \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

---

## Étape 9: Modification du frontend To-DoX

Le frontend reste **exactement identique** au guide PostgreSQL (SERVER_MIGRATION.md étapes 4-5-6).

Les modifications à faire:

1. **Créer** `src/services/api.ts` (identique)
2. **Créer** `src/components/LoginPanel.tsx` (identique)
3. **Modifier** `src/store/useStore.ts` (identique)
4. **Modifier** `src/ToDoX.tsx` (identique)
5. **Modifier** `src/hooks/useDataPersistence.ts` (identique)

Le frontend ne voit **aucune différence** entre PostgreSQL et JSON - l'API REST est identique !

---

## Étape 10: Migration des données existantes

### Script de migration `migrate-to-json.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcrypt';

const SOURCE_PATH = path.join(process.env.HOME!, 'OneDrive - CEA', 'DATA', 'To-Do-X', 'data.json');
const DATA_DIR = './data';

async function migrate() {
  console.log('Migration vers JSON...');

  // Lire les données locales
  const localData = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf-8'));

  // Créer le dossier data
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Migrer les utilisateurs
  const users = [];
  for (const user of localData.users || []) {
    users.push({
      id: user.id,
      email: user.email || `${user.id}@temp.com`,
      name: user.name,
      passwordHash: await bcrypt.hash('ChangeMe123', 10), // Mot de passe temporaire
      createdAt: new Date().toISOString()
    });
    console.log(`User migré: ${user.name}`);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));

  // Migrer les tâches
  const tasks = (localData.tasks || []).map((task: any) => ({
    ...task,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
    archived: task.archived || false,
    assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo || task.createdBy],
    subtasks: task.subtasks || []
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'tasks.json'), JSON.stringify(tasks, null, 2));
  console.log(`${tasks.length} tâches migrées`);

  // Créer fichier projects vide
  fs.writeFileSync(path.join(DATA_DIR, 'projects.json'), JSON.stringify([], null, 2));

  console.log('✅ Migration terminée !');
  console.log('⚠️  Mot de passe par défaut pour tous les users: "ChangeMe123"');
  console.log('   Les utilisateurs doivent le changer au premier login');
}

migrate().catch(console.error);
```

Pour lancer la migration:

```bash
cd todox-backend
npx ts-node migrate-to-json.ts
```

---

## Étape 11: Déploiement sur votre serveur

### 1. Build production

```bash
npm run build
```

### 2. Copier sur le serveur

```bash
# Copier tout le projet sur votre serveur
scp -r todox-backend user@votre-serveur:/home/user/
```

### 3. Installer PM2 pour garder le serveur actif

```bash
# Sur le serveur
npm install -g pm2

# Lancer le backend
cd todox-backend
pm2 start dist/index.js --name todox-backend

# Sauvegarder la config PM2
pm2 save

# Démarrer au boot
pm2 startup
```

### 4. Configuration HTTPS (optionnel mais recommandé)

Utiliser un reverse proxy Nginx avec Let's Encrypt (voir SERVER_MIGRATION.md étape 5.4)

---

## Backup automatique

### Script `backup.sh`

```bash
#!/bin/bash
BACKUP_DIR="/backup/todox"
DATA_DIR="/home/user/todox-backend/data"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp -r $DATA_DIR $BACKUP_DIR/data_$DATE

# Garder seulement les 30 derniers backups
ls -t $BACKUP_DIR | tail -n +31 | xargs -I {} rm -rf $BACKUP_DIR/{}

echo "Backup créé: $BACKUP_DIR/data_$DATE"
```

Ajouter au crontab (backup quotidien à 2h du matin):

```bash
crontab -e

# Ajouter:
0 2 * * * /home/user/backup.sh
```

---

## Récapitulatif des commandes

### Installation

```bash
mkdir todox-backend
cd todox-backend
npm init -y
npm install express cors dotenv bcrypt jsonwebtoken uuid
npm install -D typescript @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken @types/uuid ts-node nodemon
```

### Développement

```bash
npm run dev
```

### Production

```bash
npm run build
pm2 start dist/index.js --name todox-backend
```

---

## Avantages de cette approche

✅ **Pas de PostgreSQL à installer**
✅ **Fichiers JSON lisibles et modifiables**
✅ **Backup simple** (copie des fichiers)
✅ **Migration facile** depuis vos données OneDrive
✅ **Suffisant pour 5-20 utilisateurs**
✅ **Migration vers PostgreSQL possible plus tard** (API identique)

---

## Quand passer à PostgreSQL ?

Migrer vers PostgreSQL si:
- Plus de 50 utilisateurs actifs
- Plus de 10 000 tâches
- Besoin de requêtes complexes (statistiques, rapports avancés)
- Problèmes de performance
- Besoin de transactions ACID garanties

La migration est simple car l'API REST est identique !

---

**C'est beaucoup plus simple non ? 😊**

Voulez-vous que je vous aide à créer le projet backend maintenant ?
