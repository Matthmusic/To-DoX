import React, { useState } from "react";
import { PRIORITIES } from "../constants";
import { addDaysISO } from "../utils";
import { Autocomplete } from "./Autocomplete";
import { ProjectAutocomplete } from "./ProjectAutocomplete";

/**
 * Formulaire d'ajout rapide de tâches
 * Permet de créer une nouvelle tâche avec titre, projet, échéance, priorité et assignation
 */
export function QuickAdd({ onAdd, projectHistory, users }) {
  const [taskTitle, setTaskTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [dueDate, setDueDate] = useState(addDaysISO(3));
  const [taskPriority, setTaskPriority] = useState("med");
  const [assignedUserId, setAssignedUserId] = useState("unassigned");

  function handleSubmit(event) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    onAdd({
      title: taskTitle,
      project: projectName,
      due: dueDate,
      priority: taskPriority,
      assignedTo: assignedUserId,
    });
    setTaskTitle("");
  }

  function handleTitleChange(event) {
    setTaskTitle(event.target.value);
  }

  function handleDueDateChange(event) {
    setDueDate(event.target.value);
  }

  return (
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
      <ProjectAutocomplete
        value={projectName}
        onChange={setProjectName}
        projectHistory={projectHistory}
        placeholder="Projet"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] uppercase"
      />
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
  );
}
