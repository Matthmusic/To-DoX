import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Loader2,
  SearchCheck,
  User,
  MoreHorizontal,
  FileText,
  FileDown,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { jsPDF } from "jspdf";
import ToDoXLogo from "./assets/To Do X.svg";

// Import des constantes et utilitaires
import {
  STORAGE_KEY,
  STATUSES,
  PRIORITIES,
  KANBAN_COLUMNS,
  PROJECT_COLORS,
  EXCLUDED_PROJECTS,
  DEFAULT_USERS,
  DEMO_TASKS,
} from "./constants";
import {
  isDev,
  devLog,
  devError,
  devWarn,
  uid,
  getProjectColor,
  businessDaysBetween,
  toFileURL,
  classNames,
  formatDateFull,
  formatDateShort,
  getCurrentWeekRange,
  getPreviousWeekRange,
  todayISO,
  addDaysISO,
} from "./utils";
import { Autocomplete } from "./components/Autocomplete";
import { ProjectAutocomplete } from "./components/ProjectAutocomplete";
import { QuickAdd } from "./components/QuickAdd";

/**
 * To Do X — Application Kanban minimaliste et intelligente
 * - Kanban colonnes: À faire, En cours, À réviser, ✅ Fait
 * - Ajout rapide (titre, projet, échéance, priorité)
 * - Indicateurs visuels: J- / En retard, badge "âš  À relancer" si >3j sans mouvement en "En cours"
 * - Filtres (recherche, projet, priorité, statut)
 * - Statistiques par projet (progress bar)
 * - Drag & drop natif entre colonnes
 * - Persistance localStorage + Export/Import JSON
 * - **NOUVEAU**: Lien vers le **dossier projet** (file://) via un mapping Projet â†’ Chemin
 *   • Bouton "Ouvrir dossier" sur chaque tâche (si chemin défini)
 *   • Panneau "Dossiers projets" pour gérer les chemins par projet
 * - Aucune dépendance externe; Tailwind pour le style (fourni par l'environnement)
 */





export default function ToDoX() {
  const [storagePath, setStoragePath] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [tasks, setTasks] = useState(() => {
    // Initialisation temporaire depuis localStorage (pour compatibilité)
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed?.tasks ?? [];
      } catch {}
    }
    // Tâches de démo importées depuis constants.js
    return DEMO_TASKS;
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

  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [showDirPanel, setShowDirPanel] = useState(false);
  const [showArchivePanel, setShowArchivePanel] = useState(false);
  const [showTaskArchivePanel, setShowTaskArchivePanel] = useState(false);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [showStoragePanel, setShowStoragePanel] = useState(false);
  const [showWeeklyReportPanel, setShowWeeklyReportPanel] = useState(false);

  const projects = useMemo(() => {
    const s = new Set(tasks.filter((t) => !t.archived).map((t) => t.project).filter(Boolean));
    return ["all", ...[...s]];
  }, [tasks]);

  // Charger le chemin de stockage et les données au démarrage
  useEffect(() => {
    async function initStorage() {
      // Si on est dans Electron, utiliser le système de fichiers
      if (window.electronAPI?.isElectron) {
        try {
          // Récupérer le chemin de stockage (localStorage pour config)
          let savedPath = localStorage.getItem('storage_path');

          if (!savedPath) {
            // Première utilisation : obtenir le chemin OneDrive par défaut
            savedPath = await window.electronAPI.getStoragePath();
            localStorage.setItem('storage_path', savedPath);
          }

          setStoragePath(savedPath);

          // Charger les données depuis le fichier
          const filePath = savedPath + '/data.json';
          const result = await window.electronAPI.readData(filePath);

          if (result.success && result.data) {
            // Charger les données depuis le fichier
            if (result.data.tasks) {
              // Migration : ajouter completedAt aux tâches "done" qui n'ont pas ce champ
              // Migration : ajouter subtasks aux tâches qui n'ont pas ce champ
              // Migration : ajouter archived aux tâches qui n'ont pas ce champ
              const migratedTasks = result.data.tasks.map(task => {
                const migrated = { ...task };

                // Migration completedAt
                if (task.status === "done" && !task.completedAt) {
                  migrated.completedAt = task.updatedAt || task.createdAt || Date.now();
                }

                // Migration subtasks
                if (!task.subtasks) {
                  migrated.subtasks = [];
                }

                // Migration archived
                if (task.archived === undefined) {
                  migrated.archived = false;
                  migrated.archivedAt = null;
                }

                return migrated;
              });

              const completedAtCount = migratedTasks.filter((t, i) => t.completedAt !== result.data.tasks[i]?.completedAt).length;
              const subtasksCount = migratedTasks.filter((t, i) => !result.data.tasks[i]?.subtasks).length;

              if (completedAtCount > 0) {
                devLog(`✅ Migration: ${completedAtCount} tâche(s) "done" ont reçu un completedAt`);
              }
              if (subtasksCount > 0) {
                devLog(`✅ Migration: ${subtasksCount} tâche(s) ont reçu le champ subtasks`);
              }

              setTasks(migratedTasks);
            }
            if (result.data.directories) setDirectories(result.data.directories);
            if (result.data.projectHistory) setProjectHistory(result.data.projectHistory);
            if (result.data.users) setUsers(result.data.users);
          } else if (result.success && !result.data) {
            // Fichier n'existe pas : migrer depuis localStorage si disponible
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              try {
                const parsed = JSON.parse(localData);
                if (parsed.tasks) {
                  // Migration : ajouter completedAt aux tâches "done" qui n'ont pas ce champ
                  const migratedTasks = parsed.tasks.map(task => {
                    if (task.status === "done" && !task.completedAt) {
                      return { ...task, completedAt: task.updatedAt || task.createdAt || Date.now() };
                    }
                    return task;
                  });
                  const migratedCount = migratedTasks.filter((t, i) => t.completedAt !== parsed.tasks[i]?.completedAt).length;
                  if (migratedCount > 0) {
                    devLog(`✅ Migration: ${migratedCount} tâche(s) "done" ont reçu un completedAt`);
                  }
                  setTasks(migratedTasks);
                }
                if (parsed.directories) setDirectories(parsed.directories);
                if (parsed.projectHistory) setProjectHistory(parsed.projectHistory);
                if (parsed.users) setUsers(parsed.users);

                // Sauvegarder immédiatement dans le fichier
                await window.electronAPI.saveData(filePath, parsed);
                devLog('✅ Données migrées depuis localStorage vers OneDrive');
              } catch (err) {
                devError('Erreur lors de la migration:', err);
              }
            }
          }
        } catch (error) {
          devError('Erreur lors du chargement:', error);
        }
      }
      setIsLoadingData(false);
    }

    initStorage();
  }, []);

  // Sauvegarder automatiquement les données
  useEffect(() => {
    if (isLoadingData) return; // Ne pas sauvegarder pendant le chargement initial

    const saveData = async () => {
      const payload = { tasks, directories, projectHistory, users };

      // Toujours sauvegarder dans localStorage (fallback)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      // Si on est dans Electron, sauvegarder aussi dans le fichier
      if (window.electronAPI?.isElectron && storagePath) {
        try {
          const filePath = storagePath + '/data.json';
          const result = await window.electronAPI.saveData(filePath, payload);
          if (!result.success) {
            devError('Erreur lors de la sauvegarde:', result.error);
          }
        } catch (error) {
          devError('Erreur lors de la sauvegarde:', error);
        }
      }
    };

    saveData();
  }, [tasks, directories, projectHistory, users, storagePath, isLoadingData]);

  // Archivage automatique des tâches terminées à minuit
  useEffect(() => {
    function autoArchive() {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0); // Minuit suivant

      const msUntilMidnight = midnight.getTime() - now.getTime();

      const timeoutId = setTimeout(() => {
        // Archiver toutes les tâches "done" non archivées
        setTasks((xs) =>
          xs.map((t) =>
            t.status === "done" && !t.archived
              ? { ...t, archived: true, archivedAt: Date.now() }
              : t
          )
        );

        // Replanifier pour le prochain minuit
        autoArchive();
      }, msUntilMidnight);

      return () => clearTimeout(timeoutId);
    }

    const cleanup = autoArchive();
    return cleanup;
  }, []);

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
      archived: false,
      archivedAt: null,
    };
    addToProjectHistory(projectName);
    setTasks((xs) => [t, ...xs]);
  }

  function updateTask(id, patch) {
    if (patch.project) {
      addToProjectHistory(patch.project);
    }

    // Gérer le champ completedAt quand le statut change
    const updatedPatch = { ...patch };
    if (patch.status === "done") {
      updatedPatch.completedAt = Date.now();
    } else if (patch.status && patch.status !== "done") {
      updatedPatch.completedAt = null;
    }

    setTasks((xs) =>
      xs.map((t) => (t.id === id ? { ...t, ...updatedPatch, updatedAt: Date.now() } : t))
    );
  }

  function removeTask(id) {
    setTasks((xs) => xs.filter((t) => t.id !== id));
  }

  function moveTask(id, status) {
    updateTask(id, { status });
  }

  function archiveTask(id) {
    setTasks((xs) =>
      xs.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: Date.now() } : t))
    );
  }

  function unarchiveTask(id) {
    setTasks((xs) =>
      xs.map((t) => (t.id === id ? { ...t, archived: false, archivedAt: null } : t))
    );
  }

  // ============ GESTION DES SOUS-TÂCHES ============

  // Ajouter une sous-tâche à une tâche
  function addSubtask(taskId, subtaskTitle) {
    if (!subtaskTitle.trim()) return;

    setTasks((xs) =>
      xs.map((t) => {
        if (t.id === taskId) {
          const newSubtask = {
            id: uid(),
            title: subtaskTitle.trim(),
            completed: false,
            createdAt: Date.now(),
            completedAt: null,
          };
          return {
            ...t,
            subtasks: [...(t.subtasks || []), newSubtask],
            updatedAt: Date.now(),
          };
        }
        return t;
      })
    );
  }

  // Toggle le statut d'une sous-tâche
  function toggleSubtask(taskId, subtaskId) {
    setTasks((xs) =>
      xs.map((t) => {
        if (t.id === taskId) {
          const updatedSubtasks = (t.subtasks || []).map((st) => {
            if (st.id === subtaskId) {
              const newCompleted = !st.completed;
              return {
                ...st,
                completed: newCompleted,
                completedAt: newCompleted ? Date.now() : null,
              };
            }
            return st;
          });
          return { ...t, subtasks: updatedSubtasks, updatedAt: Date.now() };
        }
        return t;
      })
    );
  }

  // Supprimer une sous-tâche
  function deleteSubtask(taskId, subtaskId) {
    setTasks((xs) =>
      xs.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: (t.subtasks || []).filter((st) => st.id !== subtaskId),
            updatedAt: Date.now(),
          };
        }
        return t;
      })
    );
  }

  // Éditer le titre d'une sous-tâche
  function updateSubtaskTitle(taskId, subtaskId, newTitle) {
    if (!newTitle.trim()) return;

    setTasks((xs) =>
      xs.map((t) => {
        if (t.id === taskId) {
          const updatedSubtasks = (t.subtasks || []).map((st) =>
            st.id === subtaskId ? { ...st, title: newTitle.trim() } : st
          );
          return { ...t, subtasks: updatedSubtasks, updatedAt: Date.now() };
        }
        return t;
      })
    );
  }

  // Réorganiser les sous-tâches (drag & drop)
  function reorderSubtasks(taskId, startIndex, endIndex) {
    setTasks((xs) =>
      xs.map((t) => {
        if (t.id === taskId) {
          const subtasks = [...(t.subtasks || [])];
          const [removed] = subtasks.splice(startIndex, 1);
          subtasks.splice(endIndex, 0, removed);
          return { ...t, subtasks, updatedAt: Date.now() };
        }
        return t;
      })
    );
  }

  // Calculer la progression des sous-tâches
  function getSubtaskProgress(task) {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const completed = task.subtasks.filter((st) => st.completed).length;
    const total = task.subtasks.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
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
    return tasks.filter((t) => {
      if (t.archived) return false; // Exclure les tâches archivées
      if (filterProject !== "all" && t.project !== filterProject) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterUser !== "all" && t.assignedTo !== filterUser) return false;
      return true;
    });
  }, [tasks, filterProject, filterPriority, filterStatus, filterUser]);

  const grouped = useMemo(() => {
    const by = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
    for (const t of filteredTasks) by[t.status]?.push(t);

    // Fonction de calcul des jours ouvrés (hors de la boucle de tri)
    const calcBusinessDays = (task) => {
      if (!task.due) return Infinity;
      const dueDate = new Date(task.due + "T00:00:00");
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (dueDate < now) {
        return -businessDaysBetween(dueDate, now);
      } else {
        return businessDaysBetween(now, dueDate);
      }
    };

    // Tri des tâches par jours ouvrés restants (ordre croissant = plus urgent en haut)
    for (const status in by) {
      by[status].sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1; // Sans échéance en bas
        if (!b.due) return -1;

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

  const archivedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.archived)
      .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)); // Plus récentes en premier
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
    const raw = JSON.stringify({ tasks, directories, projectHistory, users });
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `todox_${new Date().toISOString().slice(0, 10)}.json`;
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
        if (parsed?.projectHistory) {
          setProjectHistory((prev) => {
            // Fusionner l'historique en évitant les doublons
            const merged = [...prev];
            for (const project of parsed.projectHistory) {
              if (!merged.includes(project)) {
                merged.push(project);
              }
            }
            return merged;
          });
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
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              onClick={() => setShowWeeklyReportPanel(true)}
              className="rounded-2xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 px-4 py-2 font-semibold text-slate-900 shadow-lg shadow-blue-500/30 transition hover:brightness-110 inline-flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              CR semaine
            </button>
            <button
              onClick={exportJSON}
              className="rounded-2xl bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-500 px-4 py-2 font-semibold text-slate-900 shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
            >
              Export JSON
            </button>
            <label className="cursor-pointer rounded-2xl border border-white/20 px-4 py-2 text-center text-slate-200 transition hover:bg-[#1E3A8A]/60">
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
              Archives des projets
            </button>
            <button
              onClick={() => setShowTaskArchivePanel(true)}
              className="rounded-2xl border border-purple-400/40 bg-purple-400/10 px-4 py-2 text-purple-100 transition hover:bg-purple-400/20"
            >
              Archives des tâches
            </button>
            {window.electronAPI?.isElectron && (
              <button
                onClick={() => setShowStoragePanel(true)}
                className="rounded-2xl border border-indigo-400/40 bg-indigo-400/10 px-4 py-2 text-indigo-100 transition hover:bg-indigo-400/20"
              >
                Stockage
              </button>
            )}
          </div>
        </div>

        {/* Stats par projet */}
        <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
          {projectStats.map((p) => (
            <div
              key={p.project}
              onClick={() => {
                if (filterProject === p.project) {
                  setFilterProject("all"); // Désélectionner si déjà sélectionné
                } else {
                  setFilterProject(p.project); // Sélectionner ce projet
                }
              }}
              className={classNames(
                "rounded-xl border px-2 py-2 shadow-lg backdrop-blur-xl transition-all cursor-pointer",
                filterProject === p.project
                  ? "border-blue-400 bg-blue-400/20 ring-2 ring-blue-400/50"
                  : "border-white/10 bg-white/5",
                p.pct === 100 ? "hover:border-emerald-400/40 hover:shadow-emerald-400/20" :
                p.pct >= 70 ? "hover:border-cyan-400/40 hover:shadow-cyan-400/20" :
                p.pct >= 40 ? "hover:border-amber-400/40 hover:shadow-amber-400/20" :
                "hover:border-rose-400/40 hover:shadow-rose-400/20"
              )}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1.5 relative">
                <span className="font-semibold text-xs text-slate-100 truncate text-center flex-1">{p.project}</span>
                {p.pct === 100 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveProject(p.project);
                    }}
                    className="absolute right-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-100 transition hover:bg-amber-400/20"
                    title="Archiver ce projet"
                  >
                    Archiver
                  </button>
                )}
              </div>
              <div className="relative h-4 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-400 transition-all flex items-center justify-center"
                  style={{ width: `${p.pct}%` }}
                  aria-label={`${p.pct}%`}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {p.done}/{p.total} • {p.pct}%
                </span>
              </div>
            </div>
          ))}
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
                      onArchive={archiveTask}
                      projectDir={directories[t.project]}
                      projectHistory={projectHistory}
                      users={users}
                      onAddSubtask={addSubtask}
                      onToggleSubtask={toggleSubtask}
                      onDeleteSubtask={deleteSubtask}
                      onUpdateSubtaskTitle={updateSubtaskTitle}
                      onReorderSubtasks={reorderSubtasks}
                      getSubtaskProgress={getSubtaskProgress}
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

        {showTaskArchivePanel && (
          <TaskArchivePanel
            archivedTasks={archivedTasks}
            onUnarchive={unarchiveTask}
            onDelete={removeTask}
            onClose={() => setShowTaskArchivePanel(false)}
          />
        )}

        {showUsersPanel && (
          <UsersPanel
            users={users}
            setUsers={setUsers}
            onClose={() => setShowUsersPanel(false)}
          />
        )}

        {showStoragePanel && (
          <StoragePanel
            storagePath={storagePath}
            setStoragePath={setStoragePath}
            onClose={() => setShowStoragePanel(false)}
          />
        )}

        {showWeeklyReportPanel && (
          <WeeklyReportModal
            tasks={tasks}
            onClose={() => setShowWeeklyReportPanel(false)}
          />
        )}
      </div>
    </div>
  );
}


// ============ COMPOSANTS SOUS-TÂCHES ============

function SubtaskItem({ subtask, taskId, onToggle, onDelete, onUpdateTitle, isDragging }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editTitle.trim() && editTitle !== subtask.title) {
      onUpdateTitle(taskId, subtask.id, editTitle);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditTitle(subtask.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg bg-white/5 p-2 transition ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
      <input
        type="checkbox"
        checked={subtask.completed}
        onChange={() => onToggle(taskId, subtask.id)}
        className="h-4 w-4 rounded accent-emerald-400"
      />
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded bg-white/10 px-2 py-1 text-sm text-slate-100 outline-none focus:bg-white/20"
        />
      ) : (
        <span
          onDoubleClick={() => setIsEditing(true)}
          className={`flex-1 text-sm ${
            subtask.completed ? "text-slate-400 line-through" : "text-slate-200"
          } cursor-text`}
          title="Double-cliquer pour éditer"
        >
          {subtask.title}
        </span>
      )}
      <button
        onClick={() => onDelete(taskId, subtask.id)}
        className="rounded p-1 text-slate-400 transition hover:bg-red-500/20 hover:text-red-400"
        title="Supprimer"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function SubtaskList({ task, onAddSubtask, onToggleSubtask, onDeleteSubtask, onUpdateSubtaskTitle, onReorderSubtasks }) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleAdd = () => {
    if (newSubtaskTitle.trim()) {
      onAddSubtask(task.id, newSubtaskTitle);
      setNewSubtaskTitle("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    onReorderSubtasks(task.id, draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-300">Sous-tâches</span>
      </div>

      {/* Liste des sous-tâches */}
      <div className="space-y-1">
        {(task.subtasks || []).map((subtask, index) => (
          <div
            key={subtask.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
          >
            <SubtaskItem
              subtask={subtask}
              taskId={task.id}
              onToggle={onToggleSubtask}
              onDelete={onDeleteSubtask}
              onUpdateTitle={onUpdateSubtaskTitle}
              isDragging={draggedIndex === index}
            />
          </div>
        ))}
      </div>

      {/* Input pour ajouter une nouvelle sous-tâche */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ajouter une sous-tâche..."
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:bg-white/20"
        />
        <button
          onClick={handleAdd}
          disabled={!newSubtaskTitle.trim()}
          className="rounded-lg bg-blue-500 p-2 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="Ajouter"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onDragStart,
  onUpdate,
  onDelete,
  onArchive,
  projectDir,
  projectHistory,
  users,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateSubtaskTitle,
  onReorderSubtasks,
  getSubtaskProgress
}) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Progression des sous-tâches
  const subtaskProgress = useMemo(() => getSubtaskProgress(task), [task.subtasks]);
  const allSubtasksCompleted = subtaskProgress && subtaskProgress.completed === subtaskProgress.total && subtaskProgress.total > 0;

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

  const hoverTone = useMemo(() => {
    if (businessDays === null) return "hover:border-slate-300/40 hover:shadow-slate-400/20";
    if (businessDays < 0) return "hover:border-rose-400/60 hover:shadow-rose-500/30";
    if (businessDays < 3) return "hover:border-rose-400/60 hover:shadow-rose-500/30";
    if (businessDays <= 7) return "hover:border-amber-300/40 hover:shadow-amber-400/20";
    return "hover:border-emerald-200/40 hover:shadow-emerald-400/20";
  }, [businessDays]);

  return (
    <div
      className={classNames(
        "relative z-10 overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-4 text-slate-100 shadow-[0_15px_35px_rgba(2,4,20,0.45)] backdrop-blur-xl transition",
        businessDays !== null && businessDays < 3
          ? "border-rose-400/60 shadow-rose-500/20"
          : "",
        hoverTone
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
            <span className={classNames(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              getProjectColor(task.project).border,
              getProjectColor(task.project).bg,
              getProjectColor(task.project).text
            )}>
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
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/40 bg-blue-300/10 px-2 py-0.5 text-[11px] font-semibold text-blue-200">
                <User className="h-3 w-3" />
                {assignedUser.name}
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

          {/* Bouton Sous-tâches - Toujours visible */}
          <div className="mt-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-slate-100"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <CheckSquare className="h-4 w-4 text-blue-400" />
              <span>
                {subtaskProgress
                  ? `${subtaskProgress.completed}/${subtaskProgress.total} sous-tâches`
                  : "Sous-tâches"}
              </span>
            </button>

            {/* Barre de progression - Seulement si des sous-tâches existent */}
            {subtaskProgress && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={classNames(
                      "text-xs font-semibold",
                      subtaskProgress.percentage < 30
                        ? "text-rose-400"
                        : subtaskProgress.percentage < 70
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {subtaskProgress.percentage}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={classNames(
                      "h-full transition-all duration-300",
                      subtaskProgress.percentage < 30
                        ? "bg-gradient-to-r from-rose-500 to-rose-400"
                        : subtaskProgress.percentage < 70
                        ? "bg-gradient-to-r from-amber-500 to-amber-400"
                        : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    )}
                    style={{ width: `${subtaskProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Badge de suggestion si toutes les sous-tâches sont complétées */}
          {allSubtasksCompleted && task.status !== "done" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Toutes les sous-tâches sont terminées ! Vous pouvez passer cette tâche en "Fait".
            </div>
          )}
        </div>
        <Menu task={task} onUpdate={onUpdate} onDelete={onDelete} onArchive={onArchive} projectHistory={projectHistory} users={users} />
      </div>

      {task.notes && (
        <p className="mt-3 text-sm text-slate-200/90 whitespace-pre-wrap">{task.notes}</p>
      )}

      {/* Liste des sous-tâches (expansion inline) */}
      {isExpanded && (
        <SubtaskList
          task={task}
          onAddSubtask={onAddSubtask}
          onToggleSubtask={onToggleSubtask}
          onDeleteSubtask={onDeleteSubtask}
          onUpdateSubtaskTitle={onUpdateSubtaskTitle}
          onReorderSubtasks={onReorderSubtasks}
        />
      )}
    </div>
  );
}

function Menu({ task, onUpdate, onDelete, onArchive, projectHistory, users }) {
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

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="rounded-2xl border border-white/20 bg-white/5 px-2 py-1 text-sm text-slate-100 transition hover:bg-[#1E3A8A]/60"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
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
              <Autocomplete
                value={task.status}
                onChange={(val) => onUpdate(task.id, { status: val })}
                options={STATUSES}
                placeholder="Statut"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                getValue={(s) => s.id}
                getLabel={(s) => s.label}
              />

              <label className="mt-2 text-xs text-slate-400">Titre</label>
              <input
                type="text"
                value={task.title}
                onChange={(e) => onUpdate(task.id, { title: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />

              <label className="mt-2 text-xs text-slate-400">Projet</label>
              <ProjectAutocomplete
                value={task.project}
                onChange={(val) => onUpdate(task.id, { project: val })}
                projectHistory={projectHistory}
                placeholder="Projet"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] uppercase"
              />

              <label className="mt-2 text-xs text-slate-400">Échéance</label>
              <input
                type="date"
                value={task.due || ""}
                onChange={(e) => onUpdate(task.id, { due: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />

              <label className="mt-2 text-xs text-slate-400">Priorité</label>
              <Autocomplete
                value={task.priority}
                onChange={(val) => onUpdate(task.id, { priority: val })}
                options={PRIORITIES}
                placeholder="Priorité"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                getValue={(p) => p.id}
                getLabel={(p) => p.label}
              />

              <label className="mt-2 text-xs text-slate-400">Assigné à</label>
              <Autocomplete
                value={task.assignedTo || "unassigned"}
                onChange={(val) => onUpdate(task.id, { assignedTo: val })}
                options={users}
                placeholder="Assigné à"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                getValue={(u) => u.id}
                getLabel={(u) => u.name}
              />

              <label className="mt-2 text-xs text-slate-400">Notes</label>
              <textarea
                value={task.notes || ""}
                onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
                className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                rows={3}
              />

              {task.status === "done" && (
                <button
                  onClick={() => {
                    onArchive(task.id);
                    setOpen(false);
                  }}
                  className="mt-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-100 transition hover:bg-emerald-400/20"
                >
                  Archiver
                </button>
              )}

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
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-[#1E3A8A]/60"
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

function TaskArchivePanel({ archivedTasks, onUnarchive, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#050b1f] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Archives des tâches</h3>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-[#1E3A8A]/60"
          >
            Fermer
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Tâches archivées. Vous pouvez les désarchiver pour les remettre actives ou les supprimer définitivement.
        </p>
        <div className="mt-4 max-h-[70vh] space-y-3 overflow-auto pr-1">
          {archivedTasks.length === 0 && (
            <div className="text-sm text-slate-400">
              Aucune tâche archivée.
            </div>
          )}
          {archivedTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-100">{task.title}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      {task.project}
                    </span>
                    {task.priority && (
                      <span className={classNames(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide shadow-inner",
                        task.priority === "high" ? "bg-gradient-to-r from-rose-500 to-orange-400 text-slate-900" :
                        task.priority === "med" ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900" :
                        "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900"
                      )}>
                        {task.priority === "high" ? "Haute" : task.priority === "med" ? "Moyenne" : "Basse"}
                      </span>
                    )}
                    {task.archivedAt && (
                      <span className="text-xs text-slate-500">
                        Archivé le {new Date(task.archivedAt).toLocaleDateString()}
                      </span>
                    )}
                    {task.completedAt && (
                      <span className="text-xs text-emerald-400">
                        Terminé le {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{task.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUnarchive(task.id)}
                    className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    Désarchiver
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer définitivement la tâche "${task.title}" ?`)) {
                        onDelete(task.id);
                      }
                    }}
                    className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-sm text-rose-100 transition hover:bg-rose-400/20"
                  >
                    Supprimer
                  </button>
                </div>
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
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-[#1E3A8A]/60"
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
              Aucun projet encore. Ajoute des tâches avec un champ Â« Projet Â» pour voir la liste ici.
            </div>
          )}
          {projects.map((p) => (
            <div key={p} className="grid grid-cols-5 items-center gap-2">
              <div className="col-span-1 truncate text-sm font-medium text-slate-200" title={p}>
                {p}
              </div>
              <input
                className="col-span-4 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
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
            className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
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
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-[#1E3A8A]/60"
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
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm text-slate-100 disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  placeholder="Nom"
                />
              </div>
              <div className="col-span-6">
                <input
                  type="email"
                  value={user.email}
                  onChange={(e) => updateUser(user.id, "email", e.target.value.toLowerCase())}
                  disabled={user.id === "unassigned"}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm text-slate-100 disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
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
              className="col-span-4 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              placeholder="Nom complet"
            />
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="col-span-6 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
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
            className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
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

function WeeklyReportModal({ tasks, onClose }) {
  const [selectedTasks, setSelectedTasks] = useState(() => {
    // Par défaut, toutes les tâches sont sélectionnées
    const currentRange = getCurrentWeekRange();
    const previousRange = getPreviousWeekRange();
    const currentTasks = getWeeklyTasks(tasks, currentRange);
    const previousTasks = getWeeklyTasks(tasks, previousRange);

    const initialSelection = {};
    [...currentTasks.completed, ...currentTasks.remaining, ...previousTasks.completed, ...previousTasks.remaining].forEach(task => {
      initialSelection[task.id] = true;
    });
    return initialSelection;
  });

  const [reportText, setReportText] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState(null); // 'current', 'previous', ou 'both'

  const currentWeekRange = useMemo(() => getCurrentWeekRange(), []);
  const previousWeekRange = useMemo(() => getPreviousWeekRange(), []);
  const currentWeekTasks = useMemo(() => getWeeklyTasks(tasks, currentWeekRange), [tasks, currentWeekRange]);
  const previousWeekTasks = useMemo(() => getWeeklyTasks(tasks, previousWeekRange), [tasks, previousWeekRange]);

  // Fonction pour récupérer les tâches de la semaine
  function getWeeklyTasks(allTasks, range) {
    const completed = [];
    const remaining = [];
    const excludedProjects = ["DEV", "PERSO"];

    for (const task of allTasks) {
      // Filtrer les projets exclus
      if (excludedProjects.includes(task.project?.toUpperCase())) continue;

      // Tâches terminées durant la semaine (inclure les tâches archivées si elles ont été complétées pendant la période)
      if (task.status === "done" && task.completedAt) {
        const completedDate = new Date(task.completedAt);
        if (completedDate >= range.start && completedDate <= range.end) {
          completed.push(task);
        }
        continue; // Passer à la tâche suivante après avoir vérifié les tâches complétées
      }

      // Pour les tâches restantes, exclure celles qui sont archivées
      if (task.archived) continue;

      // Tâches restantes (créées avant la fin de la semaine et non terminées)
      if (task.status !== "done" && task.createdAt) {
        const createdDate = new Date(task.createdAt);
        if (createdDate <= range.end) {
          remaining.push(task);
        }
      }
    }

    return { completed, remaining };
  }

  // Toggle la sélection d'une tâche
  function toggleTask(taskId) {
    setSelectedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  }

  // Sélectionner/désélectionner toutes les tâches d'une période
  function toggleAll(period, isCompleted) {
    const weekTasks = period === 'current' ? currentWeekTasks : previousWeekTasks;
    const tasksToToggle = isCompleted ? weekTasks.completed : weekTasks.remaining;
    const allSelected = tasksToToggle.every(t => selectedTasks[t.id]);

    setSelectedTasks(prev => {
      const updated = { ...prev };
      tasksToToggle.forEach(task => {
        updated[task.id] = !allSelected;
      });
      return updated;
    });
  }

  // Fonction pour grouper les tâches par projet
  function groupByProject(tasks) {
    const grouped = {};
    tasks.forEach(task => {
      const project = task.project || "Sans projet";
      if (!grouped[project]) {
        grouped[project] = [];
      }
      grouped[project].push(task);
    });
    return grouped;
  }

  // Calculer la progression des sous-tâches (local)
  function getSubtaskProgress(task) {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const completed = task.subtasks.filter((st) => st.completed).length;
    const total = task.subtasks.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }

  // Helper pour générer une section de rapport (réduit la duplication)
  function generateWeekSection(completed, remaining, weekRange, isCurrentWeek) {
    const periodLabel = isCurrentWeek ? 'EN COURS' : 'PRÉCÉDENTE';
    let text = `📅 SEMAINE ${periodLabel} (${weekRange.startStr} au ${weekRange.endStr})\n\n`;

    // Tâches terminées
    text += `✅ Tâches terminées\n`;
    if (completed.length === 0) {
      text += isCurrentWeek ? "- Aucune tâche terminée cette semaine\n" : "- Aucune tâche terminée durant cette période\n";
    } else {
      const groupedCompleted = groupByProject(completed);
      Object.keys(groupedCompleted).sort().forEach(project => {
        text += `\n  [${project}]\n`;
        groupedCompleted[project].forEach(task => {
          const dueText = task.due ? ` (échéance : ${formatDateFull(task.due)})` : "";
          const progress = getSubtaskProgress(task);
          const progressText = progress ? ` (${progress.completed}/${progress.total} sous-tâches)` : "";
          text += `  - ${task.title}${dueText}${progressText}\n`;

          // Afficher les sous-tâches
          if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach(subtask => {
              const checkmark = subtask.completed ? "✓" : "○";
              text += `      ${checkmark} ${subtask.title}\n`;
            });
          }
        });
      });
    }

    // Tâches en cours / restantes
    text += `\n⏳ Tâches en cours / restantes\n`;
    if (remaining.length === 0) {
      text += "- Aucune tâche en cours\n";
    } else {
      const groupedRemaining = groupByProject(remaining);
      Object.keys(groupedRemaining).sort().forEach(project => {
        text += `\n  [${project}]\n`;
        groupedRemaining[project].forEach(task => {
          const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
          const dueText = task.due ? ` (échéance : ${formatDateFull(task.due)})` : "";
          const progress = getSubtaskProgress(task);
          const progressText = progress ? ` (${progress.completed}/${progress.total} sous-tâches)` : "";
          text += `  - ${task.title} – statut : ${statusLabel}${dueText}${progressText}\n`;

          // Afficher les sous-tâches
          if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach(subtask => {
              const checkmark = subtask.completed ? "✓" : "○";
              text += `      ${checkmark} ${subtask.title}\n`;
            });
          }
        });
      });
    }

    return text;
  }

  // Générer le texte du compte rendu
  function generateReport(period = 'both') {
    const currentCompleted = currentWeekTasks.completed.filter(t => selectedTasks[t.id]);
    const currentRemaining = currentWeekTasks.remaining.filter(t => selectedTasks[t.id]);
    const previousCompleted = previousWeekTasks.completed.filter(t => selectedTasks[t.id]);
    const previousRemaining = previousWeekTasks.remaining.filter(t => selectedTasks[t.id]);

    let text = `Compte rendu hebdomadaire\n\n`;

    // Semaine en cours
    if (period === 'current' || period === 'both') {
      text += generateWeekSection(currentCompleted, currentRemaining, currentWeekRange, true);
    }

    // Semaine précédente
    if (period === 'previous' || period === 'both') {
      if (period === 'both') text += `\n\n`;
      text += generateWeekSection(previousCompleted, previousRemaining, previousWeekRange, false);
    }

    setReportText(text);
    setReportPeriod(period);
    setShowReport(true);
  }

  // Formater une date en JJ/MM/AAAA
  function formatDateFull(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Copier dans le presse-papiers
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(reportText);
      alert("Compte rendu copié dans le presse-papiers !");
    } catch (err) {
      // Fallback pour les navigateurs ne supportant pas clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = reportText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert("Compte rendu copié dans le presse-papiers !");
      } catch (e) {
        alert("Erreur lors de la copie. Veuillez copier manuellement le texte.");
      }
      document.body.removeChild(textarea);
    }
  }

  // Exporter en PDF
  function exportToPDF() {
    const period = reportPeriod || 'both';
    const currentCompleted = currentWeekTasks.completed.filter(t => selectedTasks[t.id]);
    const currentRemaining = currentWeekTasks.remaining.filter(t => selectedTasks[t.id]);
    const previousCompleted = previousWeekTasks.completed.filter(t => selectedTasks[t.id]);
    const previousRemaining = previousWeekTasks.remaining.filter(t => selectedTasks[t.id]);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    // Fonction pour vérifier et ajouter une nouvelle page si nécessaire
    function checkAddPage(neededSpace = 15) {
      if (y + neededSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    }

    // Titre principal
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Bleu foncé
    doc.text("Compte Rendu Hebdomadaire", margin, y);
    y += 15;

    // Date de génération
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    doc.text(`Genere le ${dateStr}`, margin, y);
    y += 15;

    // ===== SEMAINE EN COURS =====
    if (period === 'current' || period === 'both') {
      checkAddPage(20);
      doc.setFontSize(16);
      doc.setTextColor(59, 130, 246); // Bleu
      doc.text(`SEMAINE EN COURS (${currentWeekRange.startStr} au ${currentWeekRange.endStr})`, margin, y);
      y += 10;

    // Tâches terminées - Semaine en cours
    checkAddPage(15);
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Vert
    doc.text("Taches terminees", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (currentCompleted.length === 0) {
      doc.text("Aucune tache terminee cette semaine", margin + 5, y);
      y += 7;
    } else {
      const groupedCompleted = groupByProject(currentCompleted);
      Object.keys(groupedCompleted).sort().forEach(project => {
        checkAddPage(10);
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(`[${project}]`, margin + 5, y);
        y += 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        groupedCompleted[project].forEach(task => {
          checkAddPage(10);
          const dueText = task.due ? ` (echeance : ${formatDateFull(task.due)})` : "";
          const progress = getSubtaskProgress(task);
          const progressText = progress ? ` (${progress.completed}/${progress.total} sous-taches)` : "";
          const text = `  - ${task.title}${dueText}${progressText}`;
          const lines = doc.splitTextToSize(text, maxWidth - 10);
          lines.forEach(line => {
            checkAddPage(7);
            doc.text(line, margin + 5, y);
            y += 7;
          });

          // Afficher les sous-tâches
          if (task.subtasks && task.subtasks.length > 0) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            task.subtasks.forEach(subtask => {
              checkAddPage(6);
              const checkmark = subtask.completed ? "[X]" : "[ ]";
              const subtaskText = `      ${checkmark} ${subtask.title}`;
              const subtaskLines = doc.splitTextToSize(subtaskText, maxWidth - 15);
              subtaskLines.forEach(line => {
                checkAddPage(6);
                doc.text(line, margin + 5, y);
                y += 6;
              });
            });
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
          }
        });
        y += 3;
      });
    }
    y += 5;

    // Tâches en cours - Semaine en cours
    checkAddPage(15);
    doc.setFontSize(12);
    doc.setTextColor(251, 191, 36); // Amber
    doc.text("Taches en cours / restantes", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (currentRemaining.length === 0) {
      doc.text("Aucune tache en cours", margin + 5, y);
      y += 7;
    } else {
      const groupedRemaining = groupByProject(currentRemaining);
      Object.keys(groupedRemaining).sort().forEach(project => {
        checkAddPage(10);
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(`[${project}]`, margin + 5, y);
        y += 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        groupedRemaining[project].forEach(task => {
          checkAddPage(10);
          const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
          const dueText = task.due ? ` (echeance : ${formatDateFull(task.due)})` : "";
          const progress = getSubtaskProgress(task);
          const progressText = progress ? ` (${progress.completed}/${progress.total} sous-taches)` : "";
          const text = `  - ${task.title} - statut : ${statusLabel}${dueText}${progressText}`;
          const lines = doc.splitTextToSize(text, maxWidth - 10);
          lines.forEach(line => {
            checkAddPage(7);
            doc.text(line, margin + 5, y);
            y += 7;
          });

          // Afficher les sous-tâches
          if (task.subtasks && task.subtasks.length > 0) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            task.subtasks.forEach(subtask => {
              checkAddPage(6);
              const checkmark = subtask.completed ? "[X]" : "[ ]";
              const subtaskText = `      ${checkmark} ${subtask.title}`;
              const subtaskLines = doc.splitTextToSize(subtaskText, maxWidth - 15);
              subtaskLines.forEach(line => {
                checkAddPage(6);
                doc.text(line, margin + 5, y);
                y += 6;
              });
            });
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
          }
        });
        y += 3;
      });
    }
      y += 10;
    }

    // ===== SEMAINE PRÉCÉDENTE =====
    if (period === 'previous' || period === 'both') {
      checkAddPage(20);
      doc.setFontSize(16);
      doc.setTextColor(147, 51, 234); // Violet
      doc.text(`SEMAINE PRECEDENTE (${previousWeekRange.startStr} au ${previousWeekRange.endStr})`, margin, y);
      y += 10;

    // Tâches terminées - Semaine précédente
    checkAddPage(15);
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Vert
    doc.text("Taches terminees", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (previousCompleted.length === 0) {
      doc.text("Aucune tache terminee durant cette periode", margin + 5, y);
      y += 7;
    } else {
      const groupedCompleted = groupByProject(previousCompleted);
      Object.keys(groupedCompleted).sort().forEach(project => {
        checkAddPage(10);
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(`[${project}]`, margin + 5, y);
        y += 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        groupedCompleted[project].forEach(task => {
          checkAddPage(10);
          const dueText = task.due ? ` (echeance : ${formatDateFull(task.due)})` : "";
          const progress = getSubtaskProgress(task);
          const progressText = progress ? ` (${progress.completed}/${progress.total} sous-taches)` : "";
          const text = `  - ${task.title}${dueText}${progressText}`;
          const lines = doc.splitTextToSize(text, maxWidth - 10);
          lines.forEach(line => {
            checkAddPage(7);
            doc.text(line, margin + 5, y);
            y += 7;
          });

          // Afficher les sous-tâches
          if (task.subtasks && task.subtasks.length > 0) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            task.subtasks.forEach(subtask => {
              checkAddPage(6);
              const checkmark = subtask.completed ? "[X]" : "[ ]";
              const subtaskText = `      ${checkmark} ${subtask.title}`;
              const subtaskLines = doc.splitTextToSize(subtaskText, maxWidth - 15);
              subtaskLines.forEach(line => {
                checkAddPage(6);
                doc.text(line, margin + 5, y);
                y += 6;
              });
            });
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
          }
        });
        y += 3;
      });
    }
    y += 5;

    // Tâches en cours - Semaine précédente
    checkAddPage(15);
    doc.setFontSize(12);
    doc.setTextColor(251, 191, 36); // Amber
    doc.text("Taches en cours / restantes", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (previousRemaining.length === 0) {
      doc.text("Aucune tache en cours", margin + 5, y);
      y += 7;
    } else {
      const groupedRemaining = groupByProject(previousRemaining);
      Object.keys(groupedRemaining).sort().forEach(project => {
        checkAddPage(10);
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(`[${project}]`, margin + 5, y);
        y += 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        groupedRemaining[project].forEach(task => {
          checkAddPage(10);
          const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
          const dueText = task.due ? ` (echeance : ${formatDateFull(task.due)})` : "";
          const progress = getSubtaskProgress(task);
          const progressText = progress ? ` (${progress.completed}/${progress.total} sous-taches)` : "";
          const text = `  - ${task.title} - statut : ${statusLabel}${dueText}${progressText}`;
          const lines = doc.splitTextToSize(text, maxWidth - 10);
          lines.forEach(line => {
            checkAddPage(7);
            doc.text(line, margin + 5, y);
            y += 7;
          });

          // Afficher les sous-tâches
          if (task.subtasks && task.subtasks.length > 0) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            task.subtasks.forEach(subtask => {
              checkAddPage(6);
              const checkmark = subtask.completed ? "[X]" : "[ ]";
              const subtaskText = `      ${checkmark} ${subtask.title}`;
              const subtaskLines = doc.splitTextToSize(subtaskText, maxWidth - 15);
              subtaskLines.forEach(line => {
                checkAddPage(6);
                doc.text(line, margin + 5, y);
                y += 6;
              });
            });
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
          }
        });
        y += 3;
      });
    }
    }

    // Footer sur chaque page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text("Genere avec To-DoX", pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    // Télécharger le PDF
    let filename;
    if (period === 'current') {
      filename = `CR_Semaine_en_cours_${currentWeekRange.startStr.replace(/\//g, '-')}_${currentWeekRange.endStr.replace(/\//g, '-')}.pdf`;
    } else if (period === 'previous') {
      filename = `CR_Semaine_precedente_${previousWeekRange.startStr.replace(/\//g, '-')}_${previousWeekRange.endStr.replace(/\//g, '-')}.pdf`;
    } else {
      filename = `CR_Complet_${previousWeekRange.startStr.replace(/\//g, '-')}_${currentWeekRange.endStr.replace(/\//g, '-')}.pdf`;
    }
    doc.save(filename);

    alert("PDF généré avec succès !");
  }

  const currentCompletedCount = currentWeekTasks.completed.filter(t => selectedTasks[t.id]).length;
  const currentRemainingCount = currentWeekTasks.remaining.filter(t => selectedTasks[t.id]).length;
  const previousCompletedCount = previousWeekTasks.completed.filter(t => selectedTasks[t.id]).length;
  const previousRemainingCount = previousWeekTasks.remaining.filter(t => selectedTasks[t.id]).length;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#050b1f] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-400" />
              Compte Rendu Hebdomadaire
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Semaine en cours et semaine précédente
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-[#1E3A8A]/60"
          >
            Fermer
          </button>
        </div>

        {!showReport ? (
          <>
            <div className="mt-6 space-y-8">
              {/* ===== SEMAINE EN COURS ===== */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-blue-200 border-b border-blue-400/30 pb-2">
                  📅 Semaine en cours ({currentWeekRange.startStr} au {currentWeekRange.endStr})
                </h3>

                {/* Tâches terminées - Semaine en cours */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-semibold text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Tâches terminées ({currentWeekTasks.completed.length})
                    </h4>
                    <button
                      onClick={() => toggleAll('current', true)}
                      className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
                    >
                      {currentWeekTasks.completed.every(t => selectedTasks[t.id]) ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {currentWeekTasks.completed.length === 0 ? (
                      <p className="text-sm text-slate-400">Aucune tâche terminée cette semaine.</p>
                    ) : (
                      (() => {
                        const grouped = groupByProject(currentWeekTasks.completed);
                        return Object.keys(grouped).sort().map(project => (
                          <div key={project} className="space-y-2">
                            <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide px-2">
                              {project}
                            </div>
                            {grouped[project].map(task => (
                              <label
                                key={task.id}
                                className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition ml-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!selectedTasks[task.id]}
                                  onChange={() => toggleTask(task.id)}
                                  className="mt-1 h-4 w-4 rounded accent-emerald-400"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-100">{task.title}</div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    {task.due && (
                                      <span>Échéance : {formatDateFull(task.due)}</span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>

                {/* Tâches restantes - Semaine en cours */}
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-semibold text-amber-200 flex items-center gap-2">
                      <Loader2 className="h-5 w-5" />
                      Tâches en cours / restantes ({currentWeekTasks.remaining.length})
                    </h4>
                    <button
                      onClick={() => toggleAll('current', false)}
                      className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-100 transition hover:bg-amber-400/20"
                    >
                      {currentWeekTasks.remaining.every(t => selectedTasks[t.id]) ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {currentWeekTasks.remaining.length === 0 ? (
                      <p className="text-sm text-slate-400">Aucune tâche en cours.</p>
                    ) : (
                      (() => {
                        const grouped = groupByProject(currentWeekTasks.remaining);
                        return Object.keys(grouped).sort().map(project => (
                          <div key={project} className="space-y-2">
                            <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide px-2">
                              {project}
                            </div>
                            {grouped[project].map(task => {
                              const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
                              return (
                                <label
                                  key={task.id}
                                  className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition ml-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!selectedTasks[task.id]}
                                    onChange={() => toggleTask(task.id)}
                                    className="mt-1 h-4 w-4 rounded accent-amber-400"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-slate-100">{task.title}</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                      <span>Statut : {statusLabel}</span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* ===== SEMAINE PRÉCÉDENTE ===== */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-purple-200 border-b border-purple-400/30 pb-2">
                  📅 Semaine précédente ({previousWeekRange.startStr} au {previousWeekRange.endStr})
                </h3>

                {/* Tâches terminées - Semaine précédente */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-semibold text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Tâches terminées ({previousWeekTasks.completed.length})
                    </h4>
                    <button
                      onClick={() => toggleAll('previous', true)}
                      className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
                    >
                      {previousWeekTasks.completed.every(t => selectedTasks[t.id]) ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {previousWeekTasks.completed.length === 0 ? (
                      <p className="text-sm text-slate-400">Aucune tâche terminée durant cette période.</p>
                    ) : (
                      (() => {
                        const grouped = groupByProject(previousWeekTasks.completed);
                        return Object.keys(grouped).sort().map(project => (
                          <div key={project} className="space-y-2">
                            <div className="text-xs font-semibold text-purple-300 uppercase tracking-wide px-2">
                              {project}
                            </div>
                            {grouped[project].map(task => (
                              <label
                                key={task.id}
                                className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition ml-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!selectedTasks[task.id]}
                                  onChange={() => toggleTask(task.id)}
                                  className="mt-1 h-4 w-4 rounded accent-emerald-400"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-100">{task.title}</div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    {task.due && (
                                      <span>Échéance : {formatDateFull(task.due)}</span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>

                {/* Tâches restantes - Semaine précédente */}
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-semibold text-amber-200 flex items-center gap-2">
                      <Loader2 className="h-5 w-5" />
                      Tâches en cours / restantes ({previousWeekTasks.remaining.length})
                    </h4>
                    <button
                      onClick={() => toggleAll('previous', false)}
                      className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-100 transition hover:bg-amber-400/20"
                    >
                      {previousWeekTasks.remaining.every(t => selectedTasks[t.id]) ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {previousWeekTasks.remaining.length === 0 ? (
                      <p className="text-sm text-slate-400">Aucune tâche en cours.</p>
                    ) : (
                      (() => {
                        const grouped = groupByProject(previousWeekTasks.remaining);
                        return Object.keys(grouped).sort().map(project => (
                          <div key={project} className="space-y-2">
                            <div className="text-xs font-semibold text-purple-300 uppercase tracking-wide px-2">
                              {project}
                            </div>
                            {grouped[project].map(task => {
                              const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
                              return (
                                <label
                                  key={task.id}
                                  className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition ml-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!selectedTasks[task.id]}
                                    onChange={() => toggleTask(task.id)}
                                    className="mt-1 h-4 w-4 rounded accent-amber-400"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-slate-100">{task.title}</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                      <span>Statut : {statusLabel}</span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-slate-400">
                {currentCompletedCount + currentRemainingCount + previousCompletedCount + previousRemainingCount} tâche(s) sélectionnée(s)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
                >
                  Annuler
                </button>
                <button
                  onClick={() => generateReport('current')}
                  disabled={currentCompletedCount + currentRemainingCount === 0}
                  className="rounded-2xl bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CR Semaine en cours
                </button>
                <button
                  onClick={() => generateReport('previous')}
                  disabled={previousCompletedCount + previousRemainingCount === 0}
                  className="rounded-2xl bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-purple-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CR Semaine précédente
                </button>
                <button
                  onClick={() => generateReport('both')}
                  disabled={currentCompletedCount + currentRemainingCount + previousCompletedCount + previousRemainingCount === 0}
                  className="rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CR Complet (2 semaines)
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Affichage du rapport généré */}
            <div className="mt-6">
              <div className="rounded-2xl border border-white/10 bg-[#0b1124] p-4">
                <pre className="text-sm text-slate-100 whitespace-pre-wrap font-mono leading-relaxed">
                  {reportText}
                </pre>
              </div>
            </div>

            {/* Boutons d'action pour le rapport */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
              >
                Retour
              </button>
              <button
                onClick={copyToClipboard}
                className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 inline-flex items-center gap-2"
              >
                Copier dans le presse-papiers
              </button>
              <button
                onClick={exportToPDF}
                className="rounded-2xl bg-gradient-to-r from-rose-400 via-pink-400 to-purple-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-pink-500/20 transition hover:brightness-110 inline-flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                Exporter en PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StoragePanel({ storagePath, setStoragePath, onClose }) {
  const [localPath, setLocalPath] = useState(storagePath || "");
  const [changeMessage, setChangeMessage] = useState("");

  async function chooseFolder() {
    if (!window.electronAPI?.chooseStorageFolder) return;

    const result = await window.electronAPI.chooseStorageFolder();
    if (result.success && result.path) {
      setLocalPath(result.path);
    }
  }

  function savePath() {
    if (!localPath) {
      alert("Veuillez choisir un dossier de stockage");
      return;
    }

    // Sauvegarder le nouveau chemin
    localStorage.setItem('storage_path', localPath);
    setStoragePath(localPath);
    setChangeMessage("⚠️ Le chemin a été modifié. Veuillez redémarrer l'application pour appliquer les changements.");

    // Fermer après 3 secondes
    setTimeout(() => {
      onClose();
    }, 3000);
  }

  async function openStorageFolder() {
    if (storagePath && window.electronAPI?.openFolder) {
      await window.electronAPI.openFolder(storagePath);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#050b1f] p-6 text-slate-100 shadow-[0_25px_60px_rgba(2,4,20,0.8)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Configuration du stockage</h3>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-[#1E3A8A]/60"
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/5 p-4">
            <h4 className="text-sm font-semibold text-indigo-200">☁️ Stockage OneDrive</h4>
            <p className="mt-2 text-sm text-slate-400">
              Vos données sont stockées dans OneDrive pour une synchronisation automatique entre vos appareils.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Chemin actuel : <code className="rounded bg-white/10 px-2 py-1">{storagePath || "Non défini"}</code>
            </p>
          </div>

          {changeMessage && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="text-sm text-amber-200">{changeMessage}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Changer le dossier de stockage</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                placeholder="C:\Users\...\OneDrive\To-Do-X"
              />
              <button
                onClick={chooseFolder}
                className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-slate-100 transition hover:bg-[#1E3A8A]/60"
              >
                Parcourir...
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-4">
            <h4 className="text-sm font-semibold text-rose-200">⚠️ Important</h4>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• Les sauvegardes automatiques sont créées dans le dossier <code className="rounded bg-white/10 px-1">backups/</code></li>
              <li>• Les 5 dernières sauvegardes sont conservées</li>
              <li>• Évitez de modifier les fichiers manuellement pendant l'utilisation</li>
              <li>• Si OneDrive est en mode "en ligne uniquement", la première ouverture peut être lente</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-2">
          <button
            onClick={openStorageFolder}
            className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Ouvrir le dossier
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
            >
              Annuler
            </button>
            <button
              onClick={savePath}
              className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


