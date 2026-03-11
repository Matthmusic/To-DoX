import type { Task, AppNotification, Comment } from '../types';

const now = Date.now();
const day = 86400000;
const min = 60_000;

/** Taches de demo pour toutes les stories Storybook */
export const mockTasks: Task[] = [
  // TODO
  {
    id: 'task-1',
    title: 'Reviser les specs techniques du module authentification',
    project: 'PROJET ALPHA',
    status: 'todo',
    priority: 'high',
    due: null,
    createdBy: 'matthieu',
    assignedTo: ['matthieu', 'william'],
    createdAt: now - day * 3,
    updatedAt: now - day,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'task-5',
    title: 'Corriger le bug de synchronisation OneDrive',
    project: 'PROJET ALPHA',
    status: 'todo',
    priority: 'low',
    due: null,
    createdBy: 'laurent',
    assignedTo: [],
    createdAt: now - day,
    updatedAt: now - day,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  // DOING
  {
    id: 'task-2',
    title: 'Integrer les retours client sur le dashboard',
    project: 'PROJET ALPHA',
    status: 'doing',
    priority: 'med',
    due: new Date(now + day * 2).toISOString().split('T')[0],
    createdBy: 'william',
    assignedTo: ['matthieu'],
    createdAt: now - day * 7,
    updatedAt: now - day * 5,
    completedAt: null,
    notes: 'Voir les commentaires dans le doc partage.',
    archived: false,
    archivedAt: null,
    subtasks: [
      { id: 'sub-1', title: 'Modifier les graphiques', completed: true, createdAt: now, completedAt: now, completedBy: 'matthieu' },
      { id: 'sub-2', title: 'Mettre a jour les filtres', completed: false, createdAt: now, completedAt: null, completedBy: null },
      { id: 'sub-3', title: 'Tester sur mobile', completed: false, createdAt: now, completedAt: null, completedBy: null },
    ],
    favorite: true,
    deletedAt: null,
  },
  {
    id: 'task-6',
    title: 'Migrer la base de donnees vers PostgreSQL',
    project: 'PROJET BETA',
    status: 'doing',
    priority: 'high',
    due: new Date(now + day * 7).toISOString().split('T')[0],
    createdBy: 'sandro',
    assignedTo: ['sandro', 'matteo'],
    createdAt: now - day * 10,
    updatedAt: now - day * 8,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [
      { id: 'sub-6', title: 'Ecrire les scripts de migration', completed: true, createdAt: now, completedAt: now, completedBy: 'sandro' },
      { id: 'sub-7', title: 'Tester en staging', completed: false, createdAt: now, completedAt: null, completedBy: null },
      { id: 'sub-8', title: 'Valider avec le client', completed: false, createdAt: now, completedAt: null, completedBy: null },
      { id: 'sub-9', title: 'Deployer en production', completed: false, createdAt: now, completedAt: null, completedBy: null },
    ],
    favorite: false,
    deletedAt: null,
  },
  // REVIEW
  {
    id: 'task-3',
    title: 'Audit des performances de l API REST',
    project: 'PROJET BETA',
    status: 'review',
    priority: 'high',
    due: new Date(now - day).toISOString().split('T')[0],
    createdBy: 'matthieu',
    assignedTo: ['sandro'],
    createdAt: now - day * 14,
    updatedAt: now - day * 2,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [
      { id: 'sub-4', title: 'Mesurer les temps de reponse', completed: true, createdAt: now, completedAt: now, completedBy: 'sandro' },
      { id: 'sub-5', title: 'Identifier les bottlenecks', completed: true, createdAt: now, completedAt: now, completedBy: 'sandro' },
    ],
    favorite: false,
    deletedAt: null
  },
  // DONE
  {
    id: 'task-4',
    title: 'Deploiement en production v2.0',
    project: 'REFONTE UI',
    status: 'done',
    priority: 'high',
    due: null,
    createdBy: 'matthieu',
    assignedTo: ['matthieu', 'william', 'matteo'],
    createdAt: now - day * 30,
    updatedAt: now - day,
    completedAt: now - day,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
    reviewValidatedBy: 'william',
    reviewValidatedAt: now - day,
  },
];

/** Utilisateurs de demo */
export const mockUsers = [
  { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
  { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
  { id: 'sandro', name: 'Sandro Menardi', email: 'sandro@test.fr' },
  { id: 'matteo', name: 'Matteo Voltarel', email: 'matteo@test.fr' },
  { id: 'laurent', name: 'Laurent Marques', email: 'laurent@test.fr' },
];

/** Notifications de demo */
export const mockNotifications: AppNotification[] = [
  {
    id: 'n-1',
    type: 'review_requested',
    taskId: 'task-3',
    taskTitle: 'Audit des performances de l API REST',
    fromUserId: 'sandro',
    toUserId: 'matthieu',
    message: 'Sandro vous demande de reviser Audit des performances',
    createdAt: now - 5 * min,
  },
  {
    id: 'n-2',
    type: 'review_validated',
    taskId: 'task-4',
    taskTitle: 'Deploiement en production v2.0',
    fromUserId: 'william',
    toUserId: 'matthieu',
    message: 'William a valide votre tache Deploiement en production v2.0',
    createdAt: now - 2 * 60 * min,
    readAt: now - 60 * min,
  },
  {
    id: 'n-3',
    type: 'review_rejected',
    taskId: 'task-1',
    taskTitle: 'Reviser les specs techniques',
    fromUserId: 'laurent',
    toUserId: 'matthieu',
    message: 'Laurent demande des corrections sur Reviser les specs techniques',
    createdAt: now - 24 * 60 * min,
  },
];

/** Commentaires de demo */
export const mockComments: Record<string, Comment[]> = {
  'task-2': [
    {
      id: 'c-1',
      taskId: 'task-2',
      userId: 'william',
      text: 'Les maquettes sont OK, il faudra aussi revoir les tooltips.',
      createdAt: now - 30 * min,
      deletedAt: null,
    },
    {
      id: 'c-2',
      taskId: 'task-2',
      userId: 'matthieu',
      text: '@William Cresson Note, je m en occupe demain.',
      createdAt: now - 10 * min,
      deletedAt: null,
    },
  ],
  'task-3': [
    {
      id: 'c-3',
      taskId: 'task-3',
      userId: 'sandro',
      text: 'Le rapport complet est dans le dossier partage. @Matthieu Maurel merci de valider.',
      createdAt: now - 2 * day,
      deletedAt: null,
    },
  ],
};
