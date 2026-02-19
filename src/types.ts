// Types pour les tâches To-DoX

/**
 * Mode de thème de l'application
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Palette de couleurs pour un thème
 */
export interface ThemePalette {
  // Couleurs principales
  primary: string;      // Couleur d'accent principale (ex: cyan)
  secondary: string;    // Couleur d'accent secondaire (ex: purple)

  // Backgrounds
  bgPrimary: string;    // Fond principal de l'app
  bgSecondary: string;  // Fond des cartes/panels
  bgTertiary: string;   // Fond des inputs/selects

  // Texte
  textPrimary: string;  // Texte principal
  textSecondary: string; // Texte secondaire
  textMuted: string;    // Texte désactivé

  // Bordures
  borderPrimary: string; // Bordures principales
  borderAccent: string;  // Bordures accentuées

  // Gradients (pour les backgrounds)
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
}

/**
 * Définition complète d'un thème
 */
export interface Theme {
  id: string;           // Identifiant unique (ex: "cyberpunk", "ocean")
  name: string;         // Nom affiché (ex: "Cyberpunk Dark")
  mode: 'light' | 'dark'; // Mode du thème (pas auto, c'est pour les thèmes prédéfinis)
  palette: ThemePalette;
  custom: boolean;      // true si c'est un thème personnalisé par l'utilisateur
}

/**
 * Configuration du système de thèmes (persistée)
 */
export interface ThemeSettings {
  mode: ThemeMode;           // Mode actuel (light/dark/auto)
  activeThemeId: string;     // ID du thème actif (ex: "cyberpunk")
  customThemes: Theme[];     // Thèmes personnalisés créés par l'utilisateur
  customAccentColor?: string; // Couleur d'accent custom (hex) - override si définie
}

/**
 * Interface pour l'API Electron exposée via preload
 */
export interface StoredData {
  tasks?: Task[];
  directories?: Directories;
  projectHistory?: string[];
  projectColors?: Record<string, number>;
  users?: User[];
  notificationSettings?: NotificationSettings;
  themeSettings?: ThemeSettings;
  comments?: Record<string, Comment[]>;
  pendingMentions?: Record<string, PendingMention[]>;
}

export interface ElectronAPI {
  isElectron: boolean;
  getStoragePath: () => Promise<string>;
  readData: (path: string) => Promise<{ success: boolean; data: StoredData; error?: string }>;
  saveData: (path: string, data: StoredData) => Promise<{ success: boolean; error?: string }>;
  getFileHash: (path: string) => Promise<{ success: boolean; hash: string | null; error?: string }>;
  chooseStorageFolder: () => Promise<{ success: boolean; path?: string }>;
  openFolder: (path: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  printHtml: (html: string) => Promise<void>;
  checkForUpdates: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  getSoundUrl: (soundFile: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onUpdateError: (callback: (error: { message: string }) => void) => void;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  selectProjectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; name?: string }>;
  sendNotification: (title: string, body: string, tag?: string) => Promise<void>;
  requestNotificationPermission: () => Promise<boolean>;
  logError: (errorLog: ErrorLog) => Promise<{ success: boolean; logPath?: string; error?: string }>;
  setNativeTheme: (source: 'light' | 'dark' | 'system') => Promise<boolean>;
  getSystemTheme: () => Promise<'light' | 'dark'>;
  onSystemThemeChanged: (callback: (data: { shouldUseDarkColors: boolean }) => void) => void;
}

export interface ErrorLog {
  message: string;
  stack: string;
  componentStack: string;
  timestamp: string;
  boundary: string;
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
 * Jour de travail planifié pour la vue Gantt
 */
export interface GanttDay {
  date: string;       // ISO YYYY-MM-DD
  userIds?: string[]; // Utilisateurs assignés pour ce jour (multi-affectation)
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
  ganttDays?: GanttDay[]; // Jours de travail planifiés, pour la vue Gantt
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

/**
 * Commentaire sur une tâche
 */
export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  createdAt: number;
  deletedAt: number | null; // Soft-delete pour sync multi-user
}

/**
 * Mention en attente de notification (pour alerter un utilisateur quand il se connecte)
 */
export interface PendingMention {
  commentId: string;
  taskId: string;
  taskTitle: string;
  fromUserId: string;
  fromUserName: string;
}

/**
 * Configuration des notifications desktop
 */
export interface NotificationSettings {
  enabled: boolean; // Activer/désactiver les notifications
  deadlineNotifications: boolean; // Notifier échéances dans 24h
  staleTaskNotifications: boolean; // Notifier tâches "à relancer" (>3j en doing)
  checkInterval: number; // Intervalle de vérification en minutes (défaut: 30)
  quietHoursEnabled: boolean; // Mode "Ne pas déranger"
  quietHoursStart: string; // Heure de début (format "HH:MM")
  quietHoursEnd: string; // Heure de fin (format "HH:MM")
  sound: boolean; // Son sur les notifications
  soundFile: string; // Fichier audio à jouer (nom du fichier dans src/sounds)
  ganttNotifications?: boolean; // Notifier les journées Gantt planifiées pour aujourd'hui
}
