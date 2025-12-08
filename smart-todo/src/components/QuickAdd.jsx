import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FolderPlus } from "lucide-react";
import { PRIORITIES } from "../constants";
import { addDaysISO } from "../utils";
import { Autocomplete } from "./Autocomplete";
import { ProjectAutocomplete } from "./ProjectAutocomplete";

/**
 * Modal de confirmation pour projet existant
 */
function ProjectExistsModal({ existingProject, newPath, onUseExisting, onCreateNew, onCancel }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1124] p-6 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Projet existant</h3>
        <p className="text-sm text-slate-300 mb-4">
          Un projet nommé <span className="font-semibold text-cyan-400">{existingProject}</span> existe déjà.
        </p>
        <p className="text-sm text-slate-400 mb-6">
          Voulez-vous utiliser ce projet existant ou créer un nouveau projet avec un suffixe ?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onUseExisting}
            className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Utiliser le projet existant
          </button>
          <button
            onClick={onCreateNew}
            className="w-full rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20"
          >
            Créer un nouveau projet (avec suffixe)
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Formulaire d'ajout rapide de tâches
 * Permet de créer une nouvelle tâche avec titre, projet, échéance, priorité et assignation
 */
export function QuickAdd({ onAdd, projectHistory, users, directories, onSetDirectory }) {
  const [taskTitle, setTaskTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [pendingFolderPath, setPendingFolderPath] = useState(null);
  const [dueDate, setDueDate] = useState(addDaysISO(3));
  const [taskPriority, setTaskPriority] = useState("med");
  const [assignedUserId, setAssignedUserId] = useState("unassigned");
  const [showExistsModal, setShowExistsModal] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    onAdd({
      title: taskTitle,
      project: projectName,
      due: dueDate,
      priority: taskPriority,
      assignedTo: assignedUserId,
      folderPath: pendingFolderPath,
    });
    setTaskTitle("");
    setPendingFolderPath(null);
  }

  function handleTitleChange(event) {
    setTaskTitle(event.target.value);
  }

  function handleDueDateChange(event) {
    setDueDate(event.target.value);
  }

  async function handleSelectFolder() {
    if (!window.electronAPI?.selectProjectFolder) {
      alert("Cette fonctionnalité nécessite l'application Electron");
      return;
    }

    const result = await window.electronAPI.selectProjectFolder();
    if (!result.success || result.canceled) return;

    const folderName = result.name.toUpperCase();
    const folderPath = result.path;

    // Vérifier si un projet avec ce nom existe déjà
    if (projectHistory.includes(folderName)) {
      setPendingProjectName(folderName);
      setPendingFolderPath(folderPath);
      setShowExistsModal(true);
    } else {
      // Nouveau projet : on l'utilise directement
      setProjectName(folderName);
      setPendingFolderPath(folderPath);
      onSetDirectory(folderName, folderPath);
    }
  }

  function handleUseExistingProject() {
    setProjectName(pendingProjectName);
    // Mettre à jour le chemin du projet existant
    if (pendingFolderPath) {
      onSetDirectory(pendingProjectName, pendingFolderPath);
    }
    setShowExistsModal(false);
    setPendingProjectName("");
  }

  function handleCreateNewProject() {
    // Trouver un suffixe disponible
    let suffix = 2;
    let newName = `${pendingProjectName} (${suffix})`;
    while (projectHistory.includes(newName)) {
      suffix++;
      newName = `${pendingProjectName} (${suffix})`;
    }
    setProjectName(newName);
    if (pendingFolderPath) {
      onSetDirectory(newName, pendingFolderPath);
    }
    setShowExistsModal(false);
    setPendingProjectName("");
  }

  function handleCancelModal() {
    setShowExistsModal(false);
    setPendingProjectName("");
    setPendingFolderPath(null);
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative z-10 mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-lg backdrop-blur-xl md:grid-cols-7"
      >
        <input
          type="text"
          className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
          placeholder="Titre de la tâche"
          value={taskTitle}
          onChange={handleTitleChange}
        />
        <div className="flex gap-1">
          <ProjectAutocomplete
            value={projectName}
            onChange={setProjectName}
            projectHistory={projectHistory}
            placeholder="Projet"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] uppercase"
          />
          <button
            type="button"
            onClick={handleSelectFolder}
            className="flex-shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-cyan-400"
            title="Sélectionner un dossier projet"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
        <input
          type="date"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
          value={dueDate}
          onChange={handleDueDateChange}
        />
        <Autocomplete
          value={taskPriority}
          onChange={setTaskPriority}
          options={PRIORITIES}
          placeholder="Priorité"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-left text-sm text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
          getValue={(priority) => priority.id}
          getLabel={(priority) => priority.label}
        />
        <Autocomplete
          value={assignedUserId}
          onChange={setAssignedUserId}
          options={users}
          placeholder="Assigné à"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-left text-sm text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
          getValue={(user) => user.id}
          getLabel={(user) => user.name}
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:opacity-90"
        >
          Ajouter
        </button>
      </form>

      {showExistsModal && (
        <ProjectExistsModal
          existingProject={pendingProjectName}
          newPath={pendingFolderPath}
          onUseExisting={handleUseExistingProject}
          onCreateNew={handleCreateNewProject}
          onCancel={handleCancelModal}
        />
      )}
    </>
  );
}
