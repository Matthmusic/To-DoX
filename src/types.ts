// Types pour les tâches To-DoX

/**
 * Interface pour l'API Electron exposée via preload
 */
export interface StoredData {
  tasks?: Task[];
  directories?: Directories;
  projectHistory?: string[];
  projectColors?: Record<string, number>;
  users?: User[];
}

export interface ElectronAPI {
  isElectron: boolean;
  getStoragePath: () => Promise<string>;
  readData: (path: string) => Promise<{ success: boolean; data: StoredData; error?: string }>;
  saveData: (path: string, data: StoredData) => Promise<{ success: boolean; error?: string }>;
  getFileHash: (path: string) => Promise<{ success: boolean; hash: string | null; error?: string }>;
  chooseStorageFolder: () => Promise<{ success: boolean; path?: string }>;
  openFolder: (path: string) => Promise<void>;
  printHtml: (html: string) => Promise<void>;
  checkForUpdates: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onUpdateError: (callback: (error: { message: string }) => void) => void;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  selectProjectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; name?: string }>;
}

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Sous-tâche d'une tâche
 */
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

/**
 * Structure d'une tâche
 */
export interface Task {
  id: string;
  title: string;
  project: string;
  due: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'doing' | 'review' | 'done';
  createdBy: string; // ID de l'utilisateur qui a créé la tâche
  assignedTo: string[]; // IDs des utilisateurs affectés (affectation multiple)
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  notes: string;
  archived: boolean;
  archivedAt: number | null;
  subtasks: Subtask[];
  favorite: boolean;
  deletedAt: number | null;
}

/**
 * Données pour créer une nouvelle tâche
 */
export interface TaskData {
  title: string;
  project?: string;
  due?: string;
  priority?: 'low' | 'med' | 'high';
  status?: 'todo' | 'doing' | 'review' | 'done';
  createdBy?: string; // ID de l'utilisateur créateur
  assignedTo?: string[]; // IDs des utilisateurs affectés (affectation multiple)
  notes?: string;
  folderPath?: string;
}

/**
 * Utilisateur de l'application
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Statistiques d'un projet
 */
export interface ProjectStats {
  project: string;
  total: number;
  done: number;
  pct: number;
  completedAt: number | null;
}

/**
 * Projet archivé
 */
export interface ArchivedProject {
  project: string;
  total: number;
  done: number;
  pct: number;
  archivedAt: number | null;
}

/**
 * Progression des sous-tâches
 */
export interface SubtaskProgress {
  completed: number;
  total: number;
  percentage: number;
}

/**
 * Mapping projet -> chemin de dossier
 */
export type Directories = Record<string, string>;
