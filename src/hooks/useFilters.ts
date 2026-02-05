import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { STATUSES } from '../constants';
import { businessDayDelta } from '../utils';

/**
 * Hook pour gérer les filtres et le regroupement des tâches
 * @param tasks - Liste des tâches à filtrer
 * @param currentUser - ID de l'utilisateur actuellement connecté (filtrage automatique)
 */
export function useFilters(tasks: Task[], currentUser: string | null = null) {
    const [filterProject, setFilterProject] = useState("all");
    const [filterSearch, setFilterSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterUser, setFilterUser] = useState("all");

    // Liste des projets uniques
    const projects = useMemo(() => {
        const s = new Set(tasks.filter((t) => !t.archived && !t.deletedAt).map((t) => t.project).filter((p): p is string => !!p));
        return ["all", ...[...s].sort()];
    }, [tasks]);

    // Tâches filtrées
    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            if (t.archived || t.deletedAt) return false;

            // Filtre automatique par utilisateur connecté
            // Afficher: tâches assignées à toi OU créées par toi
            if (currentUser && currentUser !== "unassigned") {
                const isAssigned = t.assignedTo.includes(currentUser);
                const isCreator = t.createdBy === currentUser;
                // Ne pas afficher si ni assigné ni créateur
                if (!isAssigned && !isCreator) return false;
            }

            if (filterProject !== "all" && t.project !== filterProject) return false;
            if (filterStatus !== "all" && t.status !== filterStatus) return false;
            if (filterPriority !== "all" && t.priority !== filterPriority) return false;
            if (filterUser !== "all" && !t.assignedTo.includes(filterUser)) return false;

            if (filterSearch) {
                const term = filterSearch.toLowerCase();
                const inTitle = t.title.toLowerCase().includes(term);
                const inNotes = t.notes && t.notes.toLowerCase().includes(term);
                const inProject = t.project && t.project.toLowerCase().includes(term);
                if (!inTitle && !inNotes && !inProject) return false;
            }
            return true;
        });
    }, [tasks, filterProject, filterStatus, filterPriority, filterUser, filterSearch, currentUser]);

    // Regroupement par statut et projet avec tri
    const grouped = useMemo(() => {
        const byStatusAndProject: Record<string, Record<string, Task[]>> = {};
        STATUSES.forEach((s) => { byStatusAndProject[s.id] = {}; });

        for (const t of filteredTasks) {
            const projectName = t.project || "Sans projet";
            if (!byStatusAndProject[t.status][projectName]) {
                byStatusAndProject[t.status][projectName] = [];
            }
            byStatusAndProject[t.status][projectName].push(t);
        }

        // Tri des tâches par favoris puis échéance
        for (const status in byStatusAndProject) {
            for (const project in byStatusAndProject[status]) {
                byStatusAndProject[status][project].sort((a, b) => {
                    const favDiff = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
                    if (favDiff !== 0) return favDiff;

                    const daysA = businessDayDelta(a.due || "");
                    const daysB = businessDayDelta(b.due || "");

                    if (!Number.isFinite(daysA) && !Number.isFinite(daysB)) return 0;
                    if (!Number.isFinite(daysA)) return 1;
                    if (!Number.isFinite(daysB)) return -1;

                    return daysA - daysB;
                });
            }

            // Tri des projets par nom
            const projectsList = Object.keys(byStatusAndProject[status]).sort();
            const sorted: Record<string, Task[]> = {};
            projectsList.forEach(p => sorted[p] = byStatusAndProject[status][p]);
            byStatusAndProject[status] = sorted;
        }

        return byStatusAndProject;
    }, [filteredTasks]);

    const resetFilters = () => {
        setFilterProject("all");
        setFilterSearch("");
        setFilterStatus("all");
        setFilterPriority("all");
        setFilterUser("all");
    };

    return {
        // States
        filterProject,
        filterSearch,
        filterStatus,
        filterPriority,
        filterUser,
        projects,
        filteredTasks,
        grouped,
        // Setters
        setFilterProject,
        setFilterSearch,
        setFilterStatus,
        setFilterPriority,
        setFilterUser,
        resetFilters,
    };
}
