import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  SearchCheck,
} from "lucide-react";

// Clé de stockage localStorage
export const STORAGE_KEY = "smart_todo_v1";

// Statuts des tâches
export const STATUSES = [
  { id: "todo", label: "À faire", Icon: ClipboardList },
  { id: "doing", label: "En cours", Icon: Loader2 },
  { id: "review", label: "À réviser", Icon: SearchCheck },
  { id: "done", label: "Fait", Icon: CheckCircle2 },
];

// Priorités des tâches
export const PRIORITIES = [
  { id: "low", label: "Basse" },
  { id: "med", label: "Moyenne" },
  { id: "high", label: "Haute" },
];

// Colonnes du kanban
export const KANBAN_COLUMNS = [
  { id: "todo", label: "À faire", Icon: ClipboardList },
  { id: "doing", label: "En cours", Icon: Loader2 },
  { id: "review", label: "À réviser", Icon: SearchCheck },
  { id: "done", label: "✅ Fait", Icon: CheckCircle2 },
];

// Couleurs de projet pour les badges
export const PROJECT_COLORS = [
  { border: "border-blue-400/40", bg: "bg-blue-400/15", text: "text-blue-200" },
  { border: "border-purple-400/40", bg: "bg-purple-400/15", text: "text-purple-200" },
  { border: "border-pink-400/40", bg: "bg-pink-400/15", text: "text-pink-200" },
  { border: "border-cyan-400/40", bg: "bg-cyan-400/15", text: "text-cyan-200" },
  { border: "border-emerald-400/40", bg: "bg-emerald-400/15", text: "text-emerald-200" },
  { border: "border-amber-400/40", bg: "bg-amber-400/15", text: "text-amber-200" },
  { border: "border-orange-400/40", bg: "bg-orange-400/15", text: "text-orange-200" },
  { border: "border-rose-400/40", bg: "bg-rose-400/15", text: "text-rose-200" },
  { border: "border-indigo-400/40", bg: "bg-indigo-400/15", text: "text-indigo-200" },
  { border: "border-teal-400/40", bg: "bg-teal-400/15", text: "text-teal-200" },
];

// Projets exclus du compte-rendu hebdomadaire
export const EXCLUDED_PROJECTS = ["DEV", "PERSO"];

// Configuration des utilisateurs par défaut
export const DEFAULT_USERS = [
  { id: "unassigned", name: "Non assigné", email: "" },
];

// Données démo pour l'initialisation
export const DEMO_TASKS = [
  {
    id: "1",
    title: "Configuration environnement dev",
    project: "Setup",
    status: "done",
    due: "2024-01-15",
    priority: "med",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: Date.now(),
    assignedTo: "unassigned",
    notes: "",
    archived: false,
    archivedAt: null,
    subtasks: [],
  },
  {
    id: "2",
    title: "Créer maquettes UI",
    project: "Design",
    status: "doing",
    due: "2024-01-20",
    priority: "high",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    assignedTo: "unassigned",
    notes: "",
    archived: false,
    archivedAt: null,
    subtasks: [],
  },
  {
    id: "3",
    title: "Création gabarits DWG",
    project: "BE",
    status: "todo",
    due: "2024-02-01",
    priority: "low",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    assignedTo: "unassigned",
    notes: "",
    archived: false,
    archivedAt: null,
    subtasks: [],
  },
];
