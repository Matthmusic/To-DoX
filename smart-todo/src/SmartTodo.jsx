import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Loader2,
  SearchCheck,
} from "lucide-react";
import ToDoXLogo from "./assets/To Do X.svg";

/**
 * Smart To‑Do — single-file React component
 * - Kanban colonnes: À faire, En cours, À réviser, ✅ Fait
 * - Ajout rapide (titre, projet, échéance, priorité)
 * - Indicateurs visuels: J- / En retard, badge "⚠ À relancer" si >3j sans mouvement en "En cours"
 * - Filtres (recherche, projet, priorité, statut)
 * - Statistiques par projet (progress bar)
 * - Drag & drop natif entre colonnes
 * - Persistance localStorage + Export/Import JSON
 * - **NOUVEAU**: Lien vers le **dossier projet** (file://) via un mapping Projet → Chemin
 *   • Bouton "Ouvrir dossier" sur chaque tâche (si chemin défini)
 *   • Panneau "Dossiers projets" pour gérer les chemins par projet
 * - Aucune dépendance externe; Tailwind pour le style (fourni par l'environnement)
 */

const STATUSES = [
  { id: "todo", label: "À faire", Icon: ClipboardList },
  { id: "doing", label: "En cours", Icon: Loader2 },
  { id: "review", label: "À réviser", Icon: SearchCheck },
  { id: "done", label: "Fait", Icon: CheckCircle2 },
];

const PRIORITIES = [
  { id: "low", label: "Basse" },
  { id: "med", label: "Moyenne" },
  { id: "high", label: "Haute" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function daysBetween(a, b) {
  const ms = 1000 * 60 * 60 * 24;
  return Math.floor((b - a) / ms);
}

/**
 * Calcule le nombre de jours ouvrés entre deux dates (exclut samedi et dimanche)
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @returns {number} Nombre de jours ouvrés
 */
function businessDaysBetween(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = dimanche, 6 = samedi
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function toFileURL(path) {
  if (!path) return null;
  // Normaliser : Windows C:\Projets\AGDV -> file:///C:/Projets/AGDV
  let p = path.trim();
  if (/^[a-zA-Z]:\\/.test(p)) {
    p = p.replace(/\\/g, "/");
    return "file:///" + encodeURI(p);
  }
  // Déjà un chemin Unix absolu
  if (p.startsWith("/")) return "file://" + encodeURI(p);
  // Si l'utilisateur colle déjà un file://
  if (p.startsWith("file://")) return p;
  return null;
}

const STORAGE_KEY = "smart_todo_v1";

// Utilisateurs par défaut
const DEFAULT_USERS = [
  { id: "unassigned", name: "Non assigné", email: "" },
];

export default function SmartTodo() {
  const [tasks, setTasks] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed?.tasks ?? [];
      } catch {}
    }
    // Demo de départ
    const demo = [
      {
        id: uid(),
        title: "Préparer plan CFO niveau -1",
        project: "ACME-2025-001",
        due: addDaysISO(3),
        priority: "med",
        status: "doing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        notes: "Attente retour client pour perçages",
      },
      {
        id: uid(),
        title: "Dossier DOE — schémas CFA",
        project: "ACME-2025-001",
        due: addDaysISO(1),
        priority: "high",
        status: "review",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        notes: "",
      },
      {
        id: uid(),
        title: "Création gabarits DWG",
        project: "INTERNE",
        due: addDaysISO(10),
        priority: "low",
        status: "todo",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        notes: "",
      },
    ];
    return demo;
  });

  const [directories, setDirectories] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed?.directories ?? {};
      } catch {}
    }
    return {};
  });

  const [projectHistory, setProjectHistory] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed?.projectHistory ?? [];
      } catch {}
    }
    return [];
  });

  const [users, setUsers] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed?.users ?? DEFAULT_USERS;
      } catch {}
    }
    return DEFAULT_USERS;
  });

  const [filterText, setFilterText] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [showDirPanel, setShowDirPanel] = useState(false);
  const [showArchivePanel, setShowArchivePanel] = useState(false);
  const [showUsersPanel, setShowUsersPanel] = useState(false);

  const projects = useMemo(() => {
    const s = new Set(tasks.filter((t) => !t.archived).map((t) => t.project).filter(Boolean));
    return ["all", ...[...s]];
  }, [tasks]);

  useEffect(() => {
    const payload = JSON.stringify({ tasks, directories, projectHistory, users });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [tasks, directories, projectHistory, users]);

  function addToProjectHistory(projectName) {
    if (!projectName || projectName === "DIVERS") return;
    setProjectHistory((history) => {
      const filtered = history.filter((p) => p !== projectName);
      return [projectName, ...filtered]; // Ajouter en premier
    });
  }

  function addTask(data) {
    const projectName = (data.project?.trim() || "Divers").toUpperCase();
    const t = {
      id: uid(),
      title: data.title?.trim() || "Sans titre",
      project: projectName,
      due: data.due || todayISO(),
      priority: data.priority || "med",
      status: data.status || "todo",
      assignedTo: data.assignedTo || "unassigned",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: data.notes || "",
    };
    addToProjectHistory(projectName);
    setTasks((xs) => [t, ...xs]);
  }

  function updateTask(id, patch) {
    if (patch.project) {
      addToProjectHistory(patch.project);
    }
    setTasks((xs) =>
      xs.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t))
    );
  }

  function removeTask(id) {
    setTasks((xs) => xs.filter((t) => t.id !== id));
  }

  function moveTask(id, status) {
    updateTask(id, { status });
  }

  function archiveProject(projectName) {
    setTasks((xs) =>
      xs.map((t) =>
        t.project === projectName
          ? { ...t, archived: true, archivedAt: Date.now() }
          : t
      )
    );
  }

  function unarchiveProject(projectName) {
    setTasks((xs) =>
      xs.map((t) =>
        t.project === projectName && t.archived
          ? { ...t, archived: false, archivedAt: null }
          : t
      )
    );
  }

  function deleteArchivedProject(projectName) {
    setTasks((xs) => xs.filter((t) => !(t.project === projectName && t.archived)));
  }

  const filteredTasks = useMemo(() => {
    const q = filterText.toLowerCase();
    return tasks.filter((t) => {
      if (t.archived) return false; // Exclure les tâches archivées
      if (
        q &&
        !(
          t.title.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
        )
      )
        return false;
      if (filterProject !== "all" && t.project !== filterProject) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterUser !== "all" && t.assignedTo !== filterUser) return false;
      return true;
    });
  }, [tasks, filterText, filterProject, filterPriority, filterStatus, filterUser]);

  const grouped = useMemo(() => {
    const by = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
    for (const t of filteredTasks) by[t.status]?.push(t);

    // Tri des tâches par jours ouvrés restants (ordre croissant = plus urgent en haut)
    for (const status in by) {
      by[status].sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1; // Sans échéance en bas
        if (!b.due) return -1;

        const calcBusinessDays = (task) => {
          const dueDate = new Date(task.due + "T00:00:00");
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          if (dueDate < now) {
            return -businessDaysBetween(dueDate, now);
          } else {
            return businessDaysBetween(now, dueDate);
          }
        };

        const daysA = calcBusinessDays(a);
        const daysB = calcBusinessDays(b);

        return daysA - daysB; // Ordre croissant : les plus urgents en premier
      });
    }

    return by;
  }, [filteredTasks]);

  const projectStats = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (t.archived) continue; // Exclure les tâches archivées
      const key = t.project || "Divers";
      const obj = map.get(key) || { total: 0, done: 0, completedAt: null };
      obj.total += 1;
      if (t.status === "done") {
        obj.done += 1;
        // Enregistrer la date de complétion la plus récente
        if (!obj.completedAt || t.updatedAt > obj.completedAt) {
          obj.completedAt = t.updatedAt;
        }
      }
      map.set(key, obj);
    }
    return [...map.entries()].map(([project, v]) => ({
      project,
      total: v.total,
      done: v.done,
      pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
      completedAt: v.pct === 100 ? v.completedAt : null, // Date de complétion à 100%
    }));
  }, [tasks]);

  const archivedProjects = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.archived) continue; // Seulement les tâches archivées
      const key = t.project || "Divers";
      const obj = map.get(key) || { total: 0, done: 0, archivedAt: t.archivedAt };
      obj.total += 1;
      if (t.status === "done") obj.done += 1;
      map.set(key, obj);
    }
    return [...map.entries()].map(([project, v]) => ({
      project,
      total: v.total,
      done: v.done,
      pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
      archivedAt: v.archivedAt,
    }));
  }, [tasks]);

  // Archivage automatique après 2 jours pour les projets à 100%
  useEffect(() => {
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const projectsToArchive = projectStats.filter(p => {
      if (p.pct !== 100 || !p.completedAt) return false;
      const daysSinceCompletion = now - p.completedAt;
      return daysSinceCompletion >= TWO_DAYS;
    });

    if (projectsToArchive.length > 0) {
      setTasks((xs) =>
        xs.map((t) => {
          const shouldArchive = projectsToArchive.some(p => p.project === t.project);
          return shouldArchive && !t.archived
            ? { ...t, archived: true, archivedAt: Date.now() }
            : t;
        })
      );
    }
  }, [projectStats]);

  // Drag & drop (HTML5)
  const dragData = useRef(null);
  function onDragStart(e, taskId) {
    dragData.current = { taskId };
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e, status) {
    e.preventDefault();
    const d = dragData.current;
    if (d?.taskId) moveTask(d.taskId, status);
    dragData.current = null;
  }

  function allowDrop(e) {
    e.preventDefault();
  }

  function exportJSON() {
    const raw = JSON.stringify({ tasks, directories, users });
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart_todo_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed?.tasks) setTasks(parsed.tasks);
        if (parsed?.directories) {
          setDirectories((prev) => ({ ...prev, ...parsed.directories }));
        }
        if (parsed?.users) {
          // Fusionner les utilisateurs importés avec les existants
          setUsers((prev) => {
            const merged = [...prev];
            for (const importedUser of parsed.users) {
              if (!merged.find(u => u.id === importedUser.id)) {
                merged.push(importedUser);
              }
            }
            return merged;
          });
        }
      } catch (err) {
        alert("Fichier invalide");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen w-full bg-[#030513] text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(18,113,255,0.18),_transparent_45%),radial-gradient(circle_at_20%_20%,_rgba(0,255,173,0.15),_transparent_35%),radial-gradient(circle_at_80%_0,_rgba(255,0,214,0.12),_transparent_40%)] blur-3xl opacity-90 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-[1920px] space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <img
              src={ToDoXLogo}
              alt="To DoX"
              className="h-20 w-auto drop-shadow-[0_12px_40px_rgba(16,185,129,0.35)]"
            />
            <p className="text-sm text-gray-600 mt-1">
              Kanban minimaliste • deadlines visuelles • auto‑flags d'inactivité (3j)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              onClick={exportJSON}
              className="rounded-2xl bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-500 px-4 py-2 font-semibold text-slate-900 shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
            >
              Export JSON
            </button>
            <label className="cursor-pointer rounded-2xl border border-white/20 px-4 py-2 text-center text-slate-200 transition hover:bg-white/10">
              Import JSON
              <input type="file" accept="application/json" className="hidden" onChange={onImport} />
            </label>
            <button
              onClick={() => setShowUsersPanel(true)}
              className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Utilisateurs
            </button>
            <button
              onClick={() => setShowDirPanel(true)}
              className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Dossiers projets
            </button>
            <button
              onClick={() => setShowArchivePanel(true)}
              className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-amber-100 transition hover:bg-amber-400/20"
            >
              Archives
            </button>
          </div>
        </div>

        {/* Stats par projet */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectStats.map((p) => (
            <div
              key={p.project}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_rgba(2,4,20,0.45)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">{p.project}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {p.done}/{p.total} ({p.pct}%)
                  </span>
                  {p.pct === 100 && (
                    <button
                      onClick={() => archiveProject(p.project)}
                      className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs text-amber-100 transition hover:bg-amber-400/20"
                      title="Archiver ce projet"
                    >
                      Archiver
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-400 transition-all"
                  style={{ width: `${p.pct}%` }}
                  aria-label={`${p.pct}%`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Zone filtres & actions */}
        <div className="mt-6">
          <Toolbar
            filterText={filterText}
            setFilterText={setFilterText}
            filterProject={filterProject}
            setFilterProject={setFilterProject}
            filterPriority={filterPriority}
            setFilterPriority={setFilterPriority}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterUser={filterUser}
            setFilterUser={setFilterUser}
            projects={projects}
            users={users}
          />
        </div>

        {/* Formulaire d'ajout rapide */}
        <QuickAdd onAdd={addTask} projectHistory={projectHistory} users={users} />

        {/* Kanban */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STATUSES.map((col) => {
            const StatusIcon = col.Icon;
            return (
              <div
                key={col.id}
                className="relative z-0 flex min-h-[320px] flex-col rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_45px_rgba(2,4,20,0.55)] backdrop-blur-xl"
                onDrop={(e) => onDrop(e, col.id)}
                onDragOver={allowDrop}
              >
                <div className="mb-3 flex items-center gap-2">
                  <StatusIcon className="h-4 w-4 text-slate-200" />
                  <h2 className="font-semibold tracking-tight text-slate-100">{col.label}</h2>
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                    {grouped[col.id]?.length || 0}
                  </span>
                </div>

                <div className="flex-1 space-y-3">
                  {(grouped[col.id] || []).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onDragStart={onDragStart}
                      onUpdate={updateTask}
                      onDelete={removeTask}
                      projectDir={directories[t.project]}
                      projectHistory={projectHistory}
                      users={users}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {showDirPanel && (
          <ProjectDirs
            projects={projects.filter((p) => p !== "all")}
            directories={directories}
            setDirectories={setDirectories}
            onClose={() => setShowDirPanel(false)}
          />
        )}

        {showArchivePanel && (
          <ArchivePanel
            archivedProjects={archivedProjects}
            onUnarchive={unarchiveProject}
            onDelete={deleteArchivedProject}
            onClose={() => setShowArchivePanel(false)}
          />
        )}

        {showUsersPanel && (
          <UsersPanel
            users={users}
            setUsers={setUsers}
            onClose={() => setShowUsersPanel(false)}
          />
        )}
      </div>
    </div>
  );
}

function ProjectAutocomplete({ value, onChange, projectHistory, placeholder, className }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  const suggestions = useMemo(() => {
    if (!value) return projectHistory;
    const q = value.toUpperCase();
    return projectHistory.filter((p) => p.includes(q));
  }, [value, projectHistory]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e) {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      onChange(suggestions[focusedIndex]);
      setShowSuggestions(false);
      setFocusedIndex(-1);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setFocusedIndex(-1);
    }
  }

  function selectSuggestion(suggestion) {
    onChange(suggestion);
    setShowSuggestions(false);
    setFocusedIndex(-1);
  }

  function clearField() {
    onChange("");
    setShowSuggestions(false);
    setFocusedIndex(-1);
  }

  return (
    <div ref={wrapperRef} className="relative flex gap-1">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        onClick={clearField}
        className="rounded-xl border border-white/20 bg-white/5 px-2 text-slate-100 transition hover:bg-white/10"
        title="Nouveau projet"
      >
        +
      </button>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-2xl border border-white/15 bg-[#0b1124] shadow-2xl">
          {suggestions.map((suggestion, idx) => (
            <div
              key={suggestion}
              className={classNames(
                "cursor-pointer px-3 py-2 text-sm text-slate-100 transition",
                idx === focusedIndex
                  ? "bg-emerald-400/20"
                  : "hover:bg-white/10"
              )}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setFocusedIndex(idx)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAdd({ onAdd, projectHistory, users }) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [due, setDue] = useState(addDaysISO(3));
  const [priority, setPriority] = useState("med");
  const [assignedTo, setAssignedTo] = useState("unassigned");

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title, project, due, priority, assignedTo });
    setTitle("");
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_45px_rgba(2,4,20,0.45)] backdrop-blur-xl md:grid-cols-7"
    >
      <input
        type="text"
        className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
        placeholder="Titre de la tâche"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <ProjectAutocomplete
        value={project}
        onChange={setProject}
        projectHistory={projectHistory}
        placeholder="Projet (ex: ACME-2025-001)"
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70 uppercase"
      />
      <input
        type="date"
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <select
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      >
        {PRIORITIES.map((p) => (
          <option key={p.id} value={p.id}>
            Priorité {p.label}
          </option>
        ))}
      </select>
      <select
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
        value={assignedTo}
        onChange={(e) => setAssignedTo(e.target.value)}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-4 py-2 font-semibold text-slate-900 transition hover:opacity-90"
      >
        Ajouter
      </button>
    </form>
  );
}

function Toolbar({
  filterText,
  setFilterText,
  filterProject,
  setFilterProject,
  filterPriority,
  setFilterPriority,
  filterStatus,
  setFilterStatus,
  filterUser,
  setFilterUser,
  projects,
  users,
}) {
  function resetAll() {
    setFilterText("");
    setFilterProject("all");
    setFilterPriority("all");
    setFilterStatus("all");
    setFilterUser("all");
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_rgba(2,4,20,0.45)] backdrop-blur-xl">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          >
            {projects.map((p) => (
              <option key={p} value={p}>
                {p === "all" ? "Tous les projets" : p}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          >
            <option value="all">Toutes priorités</option>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                Priorité {p.label}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          >
            <option value="all">Tous statuts</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          >
            <option value="all">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Recherche (titre, projet, notes)"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="flex-1 min-w-[240px] rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
          />
          <button
            onClick={resetAll}
            className="rounded-2xl border border-white/20 px-4 py-2 text-slate-100 transition hover:bg-white/10"
          >
            Réinitialiser filtres
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onDragStart, onUpdate, onDelete, projectDir, projectHistory, users }) {
  const dueDays = useMemo(() => {
    if (!task.due) return null;
    const d = new Date(task.due + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return daysBetween(now, d);
  }, [task.due]);

  // Calcul des jours ouvrés restants (hors weekends)
  const businessDays = useMemo(() => {
    if (!task.due) return null;
    const dueDate = new Date(task.due + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (dueDate < now) {
      // En retard : calculer les jours ouvrés négatifs
      return -businessDaysBetween(dueDate, now);
    } else {
      // À venir : calculer les jours ouvrés jusqu'à l'échéance
      return businessDaysBetween(now, dueDate);
    }
  }, [task.due]);

  const inactive = useMemo(() => {
    // Badge si > 3j sans update et statut = doing
    if (task.status !== "doing") return false;
    const now = Date.now();
    return now - (task.updatedAt || task.createdAt) > 3 * 24 * 60 * 60 * 1000;
  }, [task.status, task.updatedAt, task.createdAt]);

  const fileUrl = useMemo(() => toFileURL(projectDir), [projectDir]);

  const assignedUser = useMemo(() => {
    return users.find(u => u.id === task.assignedTo) || users.find(u => u.id === "unassigned");
  }, [task.assignedTo, users]);

  const priorityTone = useMemo(() => {
    if (task.priority === "high") return "bg-gradient-to-r from-rose-500 to-orange-400 text-slate-900";
    if (task.priority === "med") return "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900";
    return "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900";
  }, [task.priority]);
  const urgencyTone = useMemo(() => {
    // Utilisation des jours ouvrés pour déterminer la couleur
    if (businessDays === null) return "from-slate-500/10 via-slate-500/5 to-transparent";

    // En retard (jours ouvrés négatifs) : rouge intense
    if (businessDays < 0) return "from-rose-600/40 via-rose-500/20 to-transparent";

    // Moins de 3 jours ouvrés : ROUGE
    if (businessDays < 3) return "from-rose-500/35 via-rose-500/15 to-transparent";

    // Entre 3 et 7 jours ouvrés : JAUNE/ORANGE
    if (businessDays <= 7) return "from-amber-400/30 via-amber-400/10 to-transparent";

    // Plus de 7 jours ouvrés : VERT
    return "from-emerald-400/30 via-emerald-400/10 to-transparent";
  }, [businessDays]);

  return (
    <div
      className={classNames(
        "relative z-10 overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-4 text-slate-100 shadow-[0_15px_35px_rgba(2,4,20,0.45)] backdrop-blur-xl transition",
        businessDays !== null && businessDays < 3
          ? "border-rose-400/60 shadow-rose-500/20"
          : "hover:border-emerald-200/40 hover:shadow-emerald-400/20"
      )}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
    >
      <div className={classNames("absolute inset-0 pointer-events-none opacity-80 bg-gradient-to-br", urgencyTone)} />
      <div className="relative z-10 flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-tight text-lg">{task.title}</h3>
            {inactive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-200/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                <AlertTriangle className="h-3 w-3" />
                À relancer
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              {task.project}
            </span>
            {task.priority && (
              <span
                className={classNames(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide shadow-inner",
                  priorityTone
                )}
              >
                {task.priority === "high" ? "Haute" : task.priority === "med" ? "Moyenne" : "Basse"}
              </span>
            )}
            {assignedUser && assignedUser.id !== "unassigned" && (
              <span className="rounded-full border border-blue-300/40 bg-blue-300/10 px-2 py-0.5 text-[11px] font-semibold text-blue-200">
                👤 {assignedUser.name}
              </span>
            )}
            {task.due && (
              <span className="ml-auto text-[11px] font-semibold">
                {businessDays < 0 && <span className="text-rose-200">En retard ({-businessDays} j ouvrés)</span>}
                {businessDays === 0 && <span className="text-amber-200">Échéance aujourd'hui</span>}
                {businessDays > 0 && (
                  <span className={classNames(
                    businessDays < 3 ? "text-rose-200" :
                    businessDays <= 7 ? "text-amber-200" :
                    "text-emerald-200"
                  )}>
                    J-{businessDays} ouvrés
                  </span>
                )}
              </span>
            )}
          </div>
          {fileUrl ? (
            <div className="mt-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-2xl border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20"
                title={projectDir}
              >
                <FolderOpen className="h-4 w-4" />
                Ouvrir dossier projet
              </a>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-slate-400">Aucun dossier défini pour ce projet.</div>
          )}
        </div>
        <Menu task={task} onUpdate={onUpdate} onDelete={onDelete} projectHistory={projectHistory} users={users} />
      </div>

      {task.notes && (
        <p className="mt-3 text-sm text-slate-200/90 whitespace-pre-wrap">{task.notes}</p>
      )}
    </div>
  );
}

function Menu({ task, onUpdate, onDelete, projectHistory, users }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function closeOnClick(e) {
      if (!open) return;
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("mousedown", closeOnClick);
    return () => document.removeEventListener("mousedown", closeOnClick);
  }, [open]);

  useEffect(() => {
    function updateCoords() {
      if (!open || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth || 256;
      const menuHeight = menuRef.current?.offsetHeight || 400;
      const padding = 16;

      // Position horizontale : aligné à droite du bouton, mais reste dans l'écran
      let left = rect.right - menuWidth;
      left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));

      // Position verticale : sous le bouton par défaut, au-dessus si pas assez de place
      let top = rect.bottom + 8;

      // Si le menu déborde en bas de l'écran, l'afficher au-dessus du bouton
      if (top + menuHeight + padding > window.innerHeight) {
        top = rect.top - menuHeight - 8;

        // Si même au-dessus ça déborde, le coller en haut de l'écran
        if (top < padding) {
          top = padding;
        }
      }

      setPosition({ top, left });
    }
    updateCoords();
    if (!open) return;
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true);
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open]);

  function changeStatus(e) {
    onUpdate(task.id, { status: e.target.value });
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="rounded-2xl border border-white/20 bg-white/5 px-2 py-1 text-sm text-slate-100 transition hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-64 max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1124] p-3 text-slate-100 shadow-2xl backdrop-blur"
            style={{ top: position.top, left: position.left }}
          >
            <div className="grid gap-2">
              <label className="text-xs text-slate-400">Statut</label>
              <select
                value={task.status}
                onChange={changeStatus}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>

              <label className="mt-2 text-xs text-slate-400">Titre</label>
              <input
                type="text"
                value={task.title}
                onChange={(e) => onUpdate(task.id, { title: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              />

              <label className="mt-2 text-xs text-slate-400">Projet</label>
              <ProjectAutocomplete
                value={task.project}
                onChange={(val) => onUpdate(task.id, { project: val })}
                projectHistory={projectHistory}
                placeholder="Projet"
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60 uppercase"
              />

              <label className="mt-2 text-xs text-slate-400">Échéance</label>
              <input
                type="date"
                value={task.due || ""}
                onChange={(e) => onUpdate(task.id, { due: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              />

              <label className="mt-2 text-xs text-slate-400">Priorité</label>
              <select
                value={task.priority}
                onChange={(e) => onUpdate(task.id, { priority: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              <label className="mt-2 text-xs text-slate-400">Assigné à</label>
              <select
                value={task.assignedTo || "unassigned"}
                onChange={(e) => onUpdate(task.id, { assignedTo: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <label className="mt-2 text-xs text-slate-400">Notes</label>
              <textarea
                value={task.notes || ""}
                onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                rows={3}
              />

              <button
                onClick={() => onDelete(task.id)}
                className="mt-2 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-rose-100 transition hover:bg-rose-400/20"
              >
                Supprimer
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ArchivePanel({ archivedProjects, onUnarchive, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#050b1f] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Archives</h3>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-white/10"
          >
            Fermer
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Projets archivés. Vous pouvez les désarchiver pour les remettre actifs ou les supprimer définitivement.
        </p>
        <div className="mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1">
          {archivedProjects.length === 0 && (
            <div className="text-sm text-slate-400">
              Aucun projet archivé.
            </div>
          )}
          {archivedProjects.map((p) => (
            <div
              key={p.project}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-100">{p.project}</span>
                  <span className="ml-3 text-sm text-slate-400">
                    {p.done}/{p.total} ({p.pct}%)
                  </span>
                  {p.archivedAt && (
                    <span className="ml-3 text-xs text-slate-500">
                      Archivé le {new Date(p.archivedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUnarchive(p.project)}
                    className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    Désarchiver
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer définitivement le projet "${p.project}" et toutes ses tâches ?`)) {
                        onDelete(p.project);
                      }
                    }}
                    className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-sm text-rose-100 transition hover:bg-rose-400/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-rose-400 transition-all"
                  style={{ width: `${p.pct}%` }}
                  aria-label={`${p.pct}%`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectDirs({ projects, directories, setDirectories, onClose }) {
  const [local, setLocal] = useState(() => ({ ...directories }));

  function setPath(project, path) {
    setLocal((x) => ({ ...x, [project]: path }));
  }

  function save() {
    setDirectories(local);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#050b1f] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Dossiers projets</h3>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-white/10"
          >
            Fermer
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Saisis le chemin local du dossier pour chaque projet. Exemples :
          <br />
          Windows : <code className="rounded bg-white/10 px-1 text-xs">C:\Projets\AGDV</code>
          <br />
          macOS/Linux : <code className="rounded bg-white/10 px-1 text-xs">/Users/toi/Projets/AGDV</code>
        </p>
        <div className="mt-4 max-h-[50vh] space-y-3 overflow-auto pr-1">
          {projects.length === 0 && (
            <div className="text-sm text-slate-400">
              Aucun projet encore. Ajoute des tâches avec un champ « Projet » pour voir la liste ici.
            </div>
          )}
          {projects.map((p) => (
            <div key={p} className="grid grid-cols-5 items-center gap-2">
              <div className="col-span-1 truncate text-sm font-medium text-slate-200" title={p}>
                {p}
              </div>
              <input
                className="col-span-4 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                placeholder="Chemin du dossier (file system)"
                value={local[p] || ""}
                onChange={(e) => setPath(p, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            onClick={save}
            className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
          >
            Enregistrer
          </button>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Note : selon le navigateur, l'ouverture de liens <code>file://</code> peut être restreinte. Pour un usage 100% fiable,
          ouvre cette app en local (ex: <strong>file:///</strong> via un bundler dev) ou empaquette-la avec Electron/Tauri.
        </p>
      </div>
    </div>
  );
}

function UsersPanel({ users, setUsers, onClose }) {
  const [localUsers, setLocalUsers] = useState(() => [...users]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");

  function addUser() {
    if (!newUserName.trim()) {
      alert("Le nom de l'utilisateur est requis");
      return;
    }
    if (!newUserEmail.trim() || !newUserEmail.includes("@")) {
      alert("Un email valide est requis");
      return;
    }

    const newUser = {
      id: uid(),
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
    };

    setLocalUsers([...localUsers, newUser]);
    setNewUserName("");
    setNewUserEmail("");
  }

  function removeUser(userId) {
    if (userId === "unassigned") {
      alert("Impossible de supprimer l'utilisateur par défaut");
      return;
    }
    if (window.confirm("Supprimer cet utilisateur ?")) {
      setLocalUsers(localUsers.filter(u => u.id !== userId));
    }
  }

  function updateUser(userId, field, value) {
    setLocalUsers(localUsers.map(u =>
      u.id === userId ? { ...u, [field]: value } : u
    ));
  }

  function save() {
    // Validation des emails
    for (const user of localUsers) {
      if (user.id !== "unassigned" && (!user.email || !user.email.includes("@"))) {
        alert(`L'utilisateur "${user.name}" doit avoir un email valide`);
        return;
      }
    }
    setUsers(localUsers);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#050b1f] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gestion des utilisateurs</h3>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-white/10"
          >
            Fermer
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Gérez les utilisateurs qui peuvent être assignés aux tâches. L'email sera utilisé pour les relances futures.
        </p>

        {/* Liste des utilisateurs existants */}
        <div className="mt-4 max-h-[40vh] space-y-3 overflow-auto pr-1">
          {localUsers.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="col-span-4">
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => updateUser(user.id, "name", e.target.value)}
                  disabled={user.id === "unassigned"}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm text-slate-100 disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                  placeholder="Nom"
                />
              </div>
              <div className="col-span-6">
                <input
                  type="email"
                  value={user.email}
                  onChange={(e) => updateUser(user.id, "email", e.target.value.toLowerCase())}
                  disabled={user.id === "unassigned"}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm text-slate-100 disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                  placeholder="email@exemple.com"
                />
              </div>
              <div className="col-span-2">
                {user.id !== "unassigned" && (
                  <button
                    onClick={() => removeUser(user.id)}
                    className="w-full rounded-xl border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-xs text-rose-100 transition hover:bg-rose-400/20"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ajout d'un nouvel utilisateur */}
        <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          <h4 className="text-sm font-semibold text-emerald-200">Ajouter un utilisateur</h4>
          <div className="mt-3 grid grid-cols-12 gap-2">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="col-span-4 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              placeholder="Nom complet"
            />
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="col-span-6 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              placeholder="email@exemple.com"
            />
            <button
              onClick={addUser}
              className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110"
            >
              Ajouter
            </button>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            onClick={save}
            className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function addDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
