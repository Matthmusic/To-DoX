import { useCallback, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Printer, FileDown, CheckCircle2, Loader2, FileText } from "lucide-react";
import useStore from "../store/useStore";
import { STATUSES } from "../constants";
import { formatTimestampToDate, getCurrentWeekRange, getPreviousWeekRange } from "../utils";
import type { Task, SubtaskProgress } from "../types";
import { useTheme } from "../hooks/useTheme";

interface WeeklyReportModalProps {
    onClose: () => void;
}

// Projets exclus du rapport
const EXCLUDED_PROJECTS = ["DEV", "PERSO"];

export function WeeklyReportModal({ onClose }: WeeklyReportModalProps) {
    const { tasks, currentUser, projectColors } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const secondaryColor = activeTheme.palette.secondary;

    // State pour la sélection des tâches
    const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({});
    const [reportText, setReportText] = useState("");
    const [showReport, setShowReport] = useState(false);
    const [reportPeriod, setReportPeriod] = useState<'current' | 'previous' | 'both' | null>(null);

    // Plages de dates
    const currentWeek = useMemo(() => getCurrentWeekRange(), []);
    const previousWeek = useMemo(() => getPreviousWeekRange(), []);

    // Récupère les tâches pour une période donnée
    const getWeeklyTasks = useCallback((allTasks: Task[], range: { start: Date; end: Date }, isCurrentWeek: boolean = false) => {
        // Filtre de base partagé (sans condition sur archived)
        const baseFilter = (t: Task) =>
            !t.deletedAt &&
            !EXCLUDED_PROJECTS.includes(t.project) &&
            (t.createdBy === currentUser || t.assignedTo.includes(currentUser || ''));

        // Tâches terminées : on inclut aussi celles archivées (elles ont été faites dans le timing)
        const completed = allTasks.filter(t =>
            baseFilter(t) &&
            t.status === "done" &&
            t.completedAt &&
            t.completedAt >= range.start.getTime() &&
            t.completedAt <= range.end.getTime()
        );

        // Tâches restantes : on exclut les archivées (elles ne sont plus actives)
        const active = allTasks.filter(t => baseFilter(t) && !t.archived);
        const remaining = isCurrentWeek
            ? active.filter(t => t.status !== "done")
            : active.filter(t =>
                t.status !== "done" &&
                t.createdAt >= range.start.getTime() &&
                t.createdAt <= range.end.getTime()
            );

        return { completed, remaining };
    }, [currentUser]);

    // Tâches de la semaine en cours (inclut TOUTES les tâches restantes, même d'avant)
    const currentWeekTasks = useMemo(() => getWeeklyTasks(tasks, currentWeek, true), [tasks, currentWeek, getWeeklyTasks]);

    // Tâches de la semaine précédente (uniquement les tâches créées cette semaine-là)
    const previousWeekTasks = useMemo(() => getWeeklyTasks(tasks, previousWeek, false), [tasks, previousWeek, getWeeklyTasks]);

    // Initialiser la sélection avec toutes les tâches cochées par défaut
    useMemo(() => {
        const initial: Record<string, boolean> = {};
        [...currentWeekTasks.completed, ...currentWeekTasks.remaining,
         ...previousWeekTasks.completed, ...previousWeekTasks.remaining].forEach(t => {
            initial[t.id] = true;
        });
        setSelectedTasks(initial);
    }, [currentWeekTasks, previousWeekTasks]);

    // Toggle une tâche individuelle
    const toggleTask = (taskId: string) => {
        setSelectedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    // Sélectionner/Désélectionner toutes les tâches d'une période
    const toggleAll = (period: 'current' | 'previous', isCompleted: boolean) => {
        const tasksToToggle = period === 'current'
            ? (isCompleted ? currentWeekTasks.completed : currentWeekTasks.remaining)
            : (isCompleted ? previousWeekTasks.completed : previousWeekTasks.remaining);

        const allSelected = tasksToToggle.every(t => selectedTasks[t.id]);

        setSelectedTasks(prev => {
            const newSelection = { ...prev };
            tasksToToggle.forEach(t => {
                newSelection[t.id] = !allSelected;
            });
            return newSelection;
        });
    };

    // Groupe les tâches par projet
    const groupByProject = (taskList: Task[]) => {
        const grouped: Record<string, Task[]> = {};
        taskList.forEach(task => {
            const proj = task.project || "Sans projet";
            if (!grouped[proj]) grouped[proj] = [];
            grouped[proj].push(task);
        });
        return grouped;
    };

    // Calcule la progression des sous-tâches
    const getSubtaskProgress = (task: Task): SubtaskProgress => {
        if (!task.subtasks || task.subtasks.length === 0) {
            return { completed: 0, total: 0, percentage: 0 };
        }
        const completed = task.subtasks.filter(st => st.completed).length;
        const total = task.subtasks.length;
        const percentage = Math.round((completed / total) * 100);
        return { completed, total, percentage };
    };

    // Compte le nombre de tâches sélectionnées
    const selectedCount = useMemo(() => {
        return Object.values(selectedTasks).filter(Boolean).length;
    }, [selectedTasks]);

    // Génère le texte pour une section de semaine
    const generateWeekSection = (
        completed: Task[],
        remaining: Task[],
        weekRange: { startStr: string; endStr: string },
        isCurrentWeek: boolean
    ): string => {
        let text = "";
        const title = isCurrentWeek ? "SEMAINE EN COURS" : "SEMAINE PRÉCÉDENTE";

        text += `\n${"=".repeat(80)}\n`;
        text += `${title} (${weekRange.startStr} - ${weekRange.endStr})\n`;
        text += `${"=".repeat(80)}\n\n`;

        // Tâches terminées
        const selectedCompleted = completed.filter(t => selectedTasks[t.id]);
        if (selectedCompleted.length > 0) {
            text += `TÂCHES TERMINÉES (${selectedCompleted.length})\n`;
            text += `${"-".repeat(80)}\n\n`;

            const groupedCompleted = groupByProject(selectedCompleted);
            Object.keys(groupedCompleted).sort().forEach(project => {
                text += `📁 ${project}\n\n`;
                groupedCompleted[project].forEach(task => {
                    const dateStr = task.completedAt ? formatTimestampToDate(task.completedAt) : "";
                    text += `  ✓ [${dateStr}] ${task.title}\n`;

                    if (task.subtasks && task.subtasks.length > 0) {
                        task.subtasks.forEach(st => {
                            const checkbox = st.completed ? "[X]" : "[ ]";
                            text += `      ${checkbox} ${st.title}\n`;
                        });
                    }

                    if (task.notes) {
                        text += `      Notes: ${task.notes}\n`;
                    }
                    text += "\n";
                });
            });
        }

        // Tâches restantes
        const selectedRemaining = remaining.filter(t => selectedTasks[t.id]);
        if (selectedRemaining.length > 0) {
            text += `\nTÂCHES RESTANTES (${selectedRemaining.length})\n`;
            text += `${"-".repeat(80)}\n\n`;

            const groupedRemaining = groupByProject(selectedRemaining);
            Object.keys(groupedRemaining).sort().forEach(project => {
                text += `📁 ${project}\n\n`;
                groupedRemaining[project].forEach(task => {
                    const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
                    const prioritySymbol = task.priority === "high" ? "🔴" : task.priority === "med" ? "🟡" : "🟢";

                    text += `  ${prioritySymbol} [${statusLabel}] ${task.title}\n`;

                    if (task.subtasks && task.subtasks.length > 0) {
                        const progress = getSubtaskProgress(task);
                        text += `      Progression: ${progress.completed}/${progress.total} (${progress.percentage}%)\n`;
                        task.subtasks.forEach(st => {
                            const checkbox = st.completed ? "[X]" : "[ ]";
                            text += `      ${checkbox} ${st.title}\n`;
                        });
                    }

                    if (task.notes) {
                        text += `      Notes: ${task.notes}\n`;
                    }
                    text += "\n";
                });
            });
        }

        if (selectedCompleted.length === 0 && selectedRemaining.length === 0) {
            text += "Aucune tâche sélectionnée pour cette période.\n";
        }

        return text;
    };

    // Génère le rapport complet
    const generateReport = (period: 'current' | 'previous' | 'both') => {
        let text = "COMPTE RENDU HEBDOMADAIRE\n";
        text += `Généré le ${formatTimestampToDate(Date.now())}\n`;

        if (period === 'current' || period === 'both') {
            text += generateWeekSection(
                currentWeekTasks.completed,
                currentWeekTasks.remaining,
                currentWeek,
                true
            );
        }

        if (period === 'previous' || period === 'both') {
            text += generateWeekSection(
                previousWeekTasks.completed,
                previousWeekTasks.remaining,
                previousWeek,
                false
            );
        }

        setReportText(text);
        setReportPeriod(period);
        setShowReport(true);
    };

    // Mapping des couleurs de projets vers RGB pour le PDF
    const getProjectColor = (project: string): [number, number, number] => {
        const colorIndex = projectColors[project];
        const colors: Array<[number, number, number]> = [
            [59, 130, 246],   // blue
            [34, 211, 238],   // cyan
            [52, 211, 153],   // emerald
            [250, 204, 21],   // yellow
            [251, 146, 60],   // orange
            [251, 113, 133],  // rose
            [192, 132, 252],  // purple
            [129, 140, 248],  // indigo
            [148, 163, 184],  // slate
        ];
        return colors[colorIndex] || [148, 163, 184]; // slate par défaut
    };

    // Exporte en PDF
    const exportToPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const lineHeight = 7;
        let y = margin;

        // Fonction pour vérifier et gérer les sauts de page
        const checkPageBreak = (additionalSpace: number = lineHeight) => {
            if (y + additionalSpace > pageHeight - margin) {
                doc.addPage();
                y = margin;

                // Footer avec numéro de page
                const pageNum = doc.getCurrentPageInfo().pageNumber;
                doc.setFontSize(9);
                doc.setFont("helvetica", "italic");
                doc.setTextColor(100, 100, 100);
                doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            }
        };

        // Fonction pour ajouter du texte avec gestion des sauts de page
        const addText = (text: string, fontSize: number, fontStyle: 'normal' | 'bold' | 'italic' = 'normal', indent: number = 0, color?: [number, number, number]) => {
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", fontStyle);
            if (color) {
                doc.setTextColor(color[0], color[1], color[2]);
            } else {
                doc.setTextColor(0, 0, 0);
            }

            const maxWidth = pageWidth - 2 * margin - indent;
            const lines = doc.splitTextToSize(text, maxWidth);

            lines.forEach((line: string) => {
                checkPageBreak();
                doc.text(line, margin + indent, y);
                y += lineHeight;
            });

            doc.setTextColor(0, 0, 0);
        };


        // Titre principal
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("Compte Rendu Hebdomadaire", margin, y);
        y += 10;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Généré le ${formatTimestampToDate(Date.now())}`, margin, y);
        y += 15;

        // Ligne de séparation
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // Générer le contenu selon la période
        const sections: Array<{
            completed: Task[];
            remaining: Task[];
            range: { startStr: string; endStr: string };
            title: string;
        }> = [];

        if (reportPeriod === 'current' || reportPeriod === 'both') {
            sections.push({
                completed: currentWeekTasks.completed,
                remaining: currentWeekTasks.remaining,
                range: currentWeek,
                title: "SEMAINE EN COURS"
            });
        }

        if (reportPeriod === 'previous' || reportPeriod === 'both') {
            sections.push({
                completed: previousWeekTasks.completed,
                remaining: previousWeekTasks.remaining,
                range: previousWeek,
                title: "SEMAINE PRÉCÉDENTE"
            });
        }

        sections.forEach((section, sectionIndex) => {
            // Titre de section
            if (sectionIndex > 0) {
                y += 10;
            }

            addText(`${section.title} (${section.range.startStr} - ${section.range.endStr})`, 14, "bold");
            y += 5;

            // Tâches terminées
            const selectedCompleted = section.completed.filter(t => selectedTasks[t.id]);
            if (selectedCompleted.length > 0) {
                addText(`Tâches terminées (${selectedCompleted.length})`, 12, "bold");
                y += 3;

                const groupedCompleted = groupByProject(selectedCompleted);
                Object.keys(groupedCompleted).sort().forEach(project => {
                    // Titre du projet en couleur
                    const projectColor = getProjectColor(project);
                    addText(`>> ${project}`, 11, "bold", 0, projectColor);
                    y += 1;

                    groupedCompleted[project].forEach(task => {
                        checkPageBreak(lineHeight * 2);
                        const dateStr = task.completedAt ? formatTimestampToDate(task.completedAt) : "";

                        // Calculer la hauteur totale de la tâche (avec sous-tâches et notes)
                        let taskHeight = lineHeight;
                        if (task.subtasks && task.subtasks.length > 0) {
                            taskHeight += task.subtasks.length * 6;
                        }
                        if (task.notes) {
                            const noteLines = doc.splitTextToSize(`Notes: ${task.notes}`, pageWidth - 2 * margin - 15);
                            taskHeight += noteLines.length * 6;
                        }

                        // Encart vert clair pour la tâche terminée
                        doc.setFillColor(240, 253, 244); // Vert très clair
                        doc.roundedRect(margin + 3, y - 5, pageWidth - 2 * margin - 6, taskHeight + 4, 2, 2, 'F');

                        // Bordure verte
                        doc.setDrawColor(34, 197, 94); // Vert
                        doc.setLineWidth(0.3);
                        doc.roundedRect(margin + 3, y - 5, pageWidth - 2 * margin - 6, taskHeight + 4, 2, 2, 'S');

                        // Titre de la tâche à gauche
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(0, 0, 0);
                        const checkmark = String.fromCharCode(10003); // ✓ en UTF-8
                        const taskTitle = `${checkmark} [${dateStr}] ${task.title}`;
                        doc.text(taskTitle, margin + 5, y);

                        // Badge de priorité aligné à droite
                        const priorityColors: Record<string, { bg: [number, number, number], text: [number, number, number], label: string }> = {
                            high: { bg: [254, 226, 226], text: [185, 28, 28], label: 'HAUTE' },
                            med: { bg: [254, 243, 199], text: [180, 83, 9], label: 'MOYENNE' },
                            low: { bg: [220, 252, 231], text: [21, 128, 61], label: 'BASSE' }
                        };
                        const priority = priorityColors[task.priority];

                        // Calculer la position pour aligner à droite
                        doc.setFontSize(8);
                        doc.setFont("helvetica", "bold");
                        const badgeWidth = doc.getTextWidth(priority.label) + 4;
                        const badgeX = pageWidth - margin - badgeWidth - 3;

                        // Dessiner le badge
                        doc.setFillColor(priority.bg[0], priority.bg[1], priority.bg[2]);
                        doc.roundedRect(badgeX, y - 4, badgeWidth, 5, 1, 1, 'F');
                        doc.setTextColor(priority.text[0], priority.text[1], priority.text[2]);
                        doc.text(priority.label, badgeX + 2, y - 0.5);
                        doc.setTextColor(0, 0, 0);

                        y += lineHeight;

                        // Sous-tâches
                        if (task.subtasks && task.subtasks.length > 0) {
                            task.subtasks.forEach(st => {
                                checkPageBreak();
                                const checkbox = st.completed ? "[X]" : "[ ]";
                                doc.setFontSize(9);
                                doc.setTextColor(100, 100, 100);
                                doc.text(`    ${checkbox} ${st.title}`, margin + 10, y);
                                y += 6;
                                doc.setTextColor(0, 0, 0);
                            });
                        }

                        // Notes
                        if (task.notes) {
                            checkPageBreak();
                            doc.setFontSize(9);
                            doc.setFont("helvetica", "italic");
                            doc.setTextColor(120, 120, 120);
                            const noteLines = doc.splitTextToSize(`Notes: ${task.notes}`, pageWidth - 2 * margin - 15);
                            noteLines.forEach((line: string) => {
                                checkPageBreak();
                                doc.text(line, margin + 10, y);
                                y += 6;
                            });
                            doc.setTextColor(0, 0, 0);
                            doc.setFont("helvetica", "normal");
                        }

                        // Réinitialiser les couleurs
                        doc.setDrawColor(0, 0, 0);
                        doc.setFillColor(255, 255, 255);

                        y += 2;
                    });
                    y += 3;
                });
            }

            // Tâches restantes
            const selectedRemaining = section.remaining.filter(t => selectedTasks[t.id]);
            if (selectedRemaining.length > 0) {
                y += 5;
                addText(`Tâches restantes (${selectedRemaining.length})`, 12, "bold");
                y += 3;

                const groupedRemaining = groupByProject(selectedRemaining);
                Object.keys(groupedRemaining).sort().forEach(project => {
                    // Titre du projet en couleur
                    const projectColor = getProjectColor(project);
                    addText(`>> ${project}`, 11, "bold", 0, projectColor);
                    y += 1;

                    groupedRemaining[project].forEach(task => {
                        checkPageBreak(lineHeight * 3);
                        const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;

                        // Titre de la tâche à gauche
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(0, 0, 0);
                        const maxTitleWidth = pageWidth - 2 * margin - 60; // Reserve 60 pour les badges
                        const titleLines = doc.splitTextToSize(task.title, maxTitleWidth);
                        doc.text(titleLines[0], margin + 5, y); // Afficher seulement la première ligne

                        // Préparer les badges pour alignement à droite
                        doc.setFontSize(8);
                        doc.setFont("helvetica", "bold");

                        // Calculer les largeurs des badges
                        const priorityColors: Record<string, { bg: [number, number, number], text: [number, number, number], label: string }> = {
                            high: { bg: [254, 226, 226], text: [185, 28, 28], label: 'HAUTE' },
                            med: { bg: [254, 243, 199], text: [180, 83, 9], label: 'MOYENNE' },
                            low: { bg: [220, 252, 231], text: [21, 128, 61], label: 'BASSE' }
                        };
                        const priority = priorityColors[task.priority];
                        const priorityWidth = doc.getTextWidth(priority.label) + 4;

                        const statusColors: Record<string, { bg: [number, number, number], text: [number, number, number] }> = {
                            todo: { bg: [229, 231, 235], text: [55, 65, 81] },
                            doing: { bg: [219, 234, 254], text: [30, 64, 175] },
                            review: { bg: [254, 249, 195], text: [161, 98, 7] },
                            done: { bg: [220, 252, 231], text: [21, 128, 61] }
                        };
                        const status = statusColors[task.status] || statusColors.todo;
                        const statusWidth = doc.getTextWidth(statusLabel) + 4;

                        // Calculer les positions en partant de la droite
                        const priorityX = pageWidth - margin - priorityWidth;
                        const statusX = priorityX - statusWidth - 2;

                        // Dessiner badge de statut
                        doc.setFillColor(status.bg[0], status.bg[1], status.bg[2]);
                        doc.roundedRect(statusX, y - 4, statusWidth, 5, 1, 1, 'F');
                        doc.setTextColor(status.text[0], status.text[1], status.text[2]);
                        doc.text(statusLabel, statusX + 2, y - 0.5);

                        // Dessiner badge de priorité
                        doc.setFillColor(priority.bg[0], priority.bg[1], priority.bg[2]);
                        doc.roundedRect(priorityX, y - 4, priorityWidth, 5, 1, 1, 'F');
                        doc.setTextColor(priority.text[0], priority.text[1], priority.text[2]);
                        doc.text(priority.label, priorityX + 2, y - 0.5);

                        doc.setTextColor(0, 0, 0);
                        y += lineHeight;

                        // Sous-tâches avec barre de progression
                        if (task.subtasks && task.subtasks.length > 0) {
                            const progress = getSubtaskProgress(task);

                            // Barre de progression
                            checkPageBreak(10);
                            const barWidth = 40;
                            const barHeight = 3;
                            const progressWidth = (progress.percentage / 100) * barWidth;

                            // Fond de la barre
                            doc.setFillColor(229, 231, 235);
                            doc.roundedRect(margin + 10, y - 3, barWidth, barHeight, 0.5, 0.5, 'F');

                            // Progression
                            if (progressWidth > 0) {
                                const progressColor = progress.percentage === 100 ? [34, 197, 94] : [59, 130, 246];
                                doc.setFillColor(progressColor[0], progressColor[1], progressColor[2]);
                                doc.roundedRect(margin + 10, y - 3, progressWidth, barHeight, 0.5, 0.5, 'F');
                            }

                            // Texte de progression
                            doc.setFontSize(8);
                            doc.setTextColor(100, 100, 100);
                            doc.text(`${progress.completed}/${progress.total} (${progress.percentage}%)`, margin + 10 + barWidth + 2, y - 0.5);
                            doc.setTextColor(0, 0, 0);
                            y += 6;

                            // Liste des sous-tâches
                            task.subtasks.forEach(st => {
                                checkPageBreak();
                                const checkbox = st.completed ? "[X]" : "[ ]";
                                doc.setFontSize(9);
                                doc.setTextColor(st.completed ? 100 : 0, st.completed ? 100 : 0, st.completed ? 100 : 0);
                                doc.text(`    ${checkbox} ${st.title}`, margin + 10, y);
                                y += 6;
                                doc.setTextColor(0, 0, 0);
                            });
                        }

                        // Notes
                        if (task.notes) {
                            checkPageBreak();
                            doc.setFontSize(9);
                            doc.setFont("helvetica", "italic");
                            doc.setTextColor(120, 120, 120);
                            const noteLines = doc.splitTextToSize(`Notes: ${task.notes}`, pageWidth - 2 * margin - 15);
                            noteLines.forEach((line: string) => {
                                checkPageBreak();
                                doc.text(line, margin + 10, y);
                                y += 6;
                            });
                            doc.setTextColor(0, 0, 0);
                            doc.setFont("helvetica", "normal");
                        }

                        y += 3;
                    });
                    y += 3;
                });
            }

            if (selectedCompleted.length === 0 && selectedRemaining.length === 0) {
                addText("Aucune tâche sélectionnée pour cette période.", 10, "italic");
            }
        });

        // Footer sur la dernière page
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text(`Page ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        // Télécharger
        const fileName = `CR_To-Do-X_${formatTimestampToDate(Date.now()).replace(/\//g, "-")}.pdf`;
        doc.save(fileName);
    };

    // Impression avec dialogue natif
    const printToPDF = () => {
        // Si Electron est disponible, utiliser l'API native
        if (window.electronAPI?.printHtml) {
            // Créer un HTML formaté pour l'impression
            let html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 2cm;
                            font-size: 12pt;
                            line-height: 1.6;
                        }
                        h1 {
                            font-size: 20pt;
                            border-bottom: 2px solid #333;
                            padding-bottom: 10px;
                            margin-bottom: 20px;
                        }
                        h2 {
                            font-size: 16pt;
                            margin-top: 30px;
                            margin-bottom: 15px;
                            color: #2563eb;
                        }
                        h3 {
                            font-size: 14pt;
                            margin-top: 20px;
                            margin-bottom: 10px;
                        }
                        .project {
                            font-weight: bold;
                            margin-top: 15px;
                            margin-bottom: 5px;
                            color: #1e40af;
                        }
                        .task {
                            margin-left: 20px;
                            margin-bottom: 10px;
                        }
                        .subtask {
                            margin-left: 40px;
                            font-size: 11pt;
                            color: #555;
                        }
                        .notes {
                            margin-left: 40px;
                            font-style: italic;
                            color: #666;
                            font-size: 11pt;
                        }
                        @media print {
                            body { margin: 1.5cm; }
                            .page-break { page-break-before: always; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Compte Rendu Hebdomadaire</h1>
                    <p><strong>Généré le ${formatTimestampToDate(Date.now())}</strong></p>
            `;

            const sections: Array<{
                completed: Task[];
                remaining: Task[];
                range: { startStr: string; endStr: string };
                title: string;
            }> = [];

            if (reportPeriod === 'current' || reportPeriod === 'both') {
                sections.push({
                    completed: currentWeekTasks.completed,
                    remaining: currentWeekTasks.remaining,
                    range: currentWeek,
                    title: "SEMAINE EN COURS"
                });
            }

            if (reportPeriod === 'previous' || reportPeriod === 'both') {
                sections.push({
                    completed: previousWeekTasks.completed,
                    remaining: previousWeekTasks.remaining,
                    range: previousWeek,
                    title: "SEMAINE PRÉCÉDENTE"
                });
            }

            sections.forEach((section, index) => {
                if (index > 0) {
                    html += '<div class="page-break"></div>';
                }

                html += `<h2>${section.title} (${section.range.startStr} - ${section.range.endStr})</h2>`;

                // Tâches terminées
                const selectedCompleted = section.completed.filter(t => selectedTasks[t.id]);
                if (selectedCompleted.length > 0) {
                    html += `<h3>Tâches terminées (${selectedCompleted.length})</h3>`;
                    const groupedCompleted = groupByProject(selectedCompleted);

                    Object.keys(groupedCompleted).sort().forEach(project => {
                        html += `<div class="project">📁 ${project}</div>`;
                        groupedCompleted[project].forEach(task => {
                            const dateStr = task.completedAt ? formatTimestampToDate(task.completedAt) : "";
                            html += `<div class="task">✓ [${dateStr}] ${task.title}</div>`;

                            if (task.subtasks && task.subtasks.length > 0) {
                                task.subtasks.forEach(st => {
                                    const checkbox = st.completed ? "✓" : "☐";
                                    html += `<div class="subtask">${checkbox} ${st.title}</div>`;
                                });
                            }

                            if (task.notes) {
                                html += `<div class="notes">Notes: ${task.notes}</div>`;
                            }
                        });
                    });
                }

                // Tâches restantes
                const selectedRemaining = section.remaining.filter(t => selectedTasks[t.id]);
                if (selectedRemaining.length > 0) {
                    html += `<h3>Tâches restantes (${selectedRemaining.length})</h3>`;
                    const groupedRemaining = groupByProject(selectedRemaining);

                    Object.keys(groupedRemaining).sort().forEach(project => {
                        html += `<div class="project">📁 ${project}</div>`;
                        groupedRemaining[project].forEach(task => {
                            const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
                            const prioritySymbol = task.priority === "high" ? "🔴" : task.priority === "med" ? "🟡" : "🟢";
                            html += `<div class="task">${prioritySymbol} [${statusLabel}] ${task.title}</div>`;

                            if (task.subtasks && task.subtasks.length > 0) {
                                const progress = getSubtaskProgress(task);
                                html += `<div class="subtask">Progression: ${progress.completed}/${progress.total} (${progress.percentage}%)</div>`;
                                task.subtasks.forEach(st => {
                                    const checkbox = st.completed ? "✓" : "☐";
                                    html += `<div class="subtask">${checkbox} ${st.title}</div>`;
                                });
                            }

                            if (task.notes) {
                                html += `<div class="notes">Notes: ${task.notes}</div>`;
                            }
                        });
                    });
                }

                if (selectedCompleted.length === 0 && selectedRemaining.length === 0) {
                    html += '<p><em>Aucune tâche sélectionnée pour cette période.</em></p>';
                }
            });

            html += '</body></html>';
            window.electronAPI.printHtml(html);
        } else {
            // Fallback: ouvrir une nouvelle fenêtre pour imprimer
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write('<html><head><title>Compte Rendu</title>');
                printWindow.document.write('<style>body{font-family:Arial;margin:2cm;font-size:12pt;line-height:1.6;}h1{font-size:20pt;border-bottom:2px solid #333;padding-bottom:10px;}h2{font-size:16pt;margin-top:30px;color:#2563eb;}pre{white-space:pre-wrap;}</style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write('<h1>Compte Rendu Hebdomadaire</h1>');
                printWindow.document.write(`<p><strong>Généré le ${formatTimestampToDate(Date.now())}</strong></p>`);
                printWindow.document.write('<pre>' + reportText + '</pre>');
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    // Rendu de la vue rapport
    if (showReport) {
        return (
            <div
                className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl border-2 border-theme-primary shadow-2xl flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                        backgroundColor: 'var(--bg-secondary)',
                        opacity: 0.98
                    }}
                >
                    {/* Gradient de bordure animé */}
                    <div
                        className="absolute inset-0 rounded-3xl opacity-50 pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(to bottom right, ${primaryColor}33, transparent, ${secondaryColor}33)`
                        }}
                    />

                    {/* Effet shimmer sur les bords */}
                    <div className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none">
                        <div
                            className="absolute top-0 left-0 right-0 h-px"
                            style={{
                                backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`
                            }}
                        />
                        <div
                            className="absolute bottom-0 left-0 right-0 h-px"
                            style={{
                                backgroundImage: `linear-gradient(to right, transparent, ${secondaryColor}, transparent)`
                            }}
                        />
                    </div>

                    {/* Header */}
                    <div className="relative z-10 flex items-center justify-between p-6 border-b border-theme-primary">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6" style={{ color: primaryColor }} />
                            <h3
                                className="text-xl font-black bg-clip-text text-transparent"
                                style={{
                                    backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
                                }}
                            >
                                Compte Rendu Généré
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowReport(false)}
                                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-white/10"
                            >
                                Retour
                            </button>
                            <button
                                onClick={printToPDF}
                                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all"
                                style={{
                                    borderColor: `${secondaryColor}30`,
                                    backgroundColor: `${secondaryColor}10`,
                                    color: `${secondaryColor}cc`
                                }}
                            >
                                <Printer className="w-4 h-4" />
                                Imprimer
                            </button>
                            <button
                                onClick={exportToPDF}
                                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-lg transition-all hover:scale-105 hover:brightness-110"
                                style={{
                                    backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                                    boxShadow: `0 10px 15px -3px ${primaryColor}30`
                                }}
                            >
                                <FileDown className="w-4 h-4" />
                                Exporter en PDF
                            </button>
                        </div>
                    </div>

                    {/* Contenu du rapport */}
                    <div className="relative z-10 flex-1 overflow-y-auto p-6">
                        <pre className="font-mono text-sm text-slate-200 whitespace-pre-wrap">
                            {reportText}
                        </pre>
                    </div>
                </div>
            </div>
        );
    }

    // Rendu de la vue de sélection
    return (
        <div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-6xl max-h-[90vh] rounded-3xl border-2 border-theme-primary shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    backgroundColor: 'var(--bg-secondary)',
                    opacity: 0.98
                }}
            >
                {/* Gradient de bordure animé */}
                <div
                    className="absolute inset-0 rounded-3xl opacity-50 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(to bottom right, ${primaryColor}33, transparent, ${secondaryColor}33)`
                    }}
                />

                {/* Effet shimmer sur les bords */}
                <div className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none">
                    <div
                        className="absolute top-0 left-0 right-0 h-px"
                        style={{
                            backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`
                        }}
                    />
                    <div
                        className="absolute bottom-0 left-0 right-0 h-px"
                        style={{
                            backgroundImage: `linear-gradient(to right, transparent, ${secondaryColor}, transparent)`
                        }}
                    />
                </div>

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between p-6 border-b border-theme-primary">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6" style={{ color: primaryColor }} />
                        <h3
                            className="text-xl font-black bg-clip-text text-transparent"
                            style={{
                                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
                            }}
                        >
                            Compte Rendu Hebdomadaire
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-100 transition-all hover:bg-white/10"
                    >
                        Fermer
                    </button>
                </div>

                {/* Contenu */}
                <div className="relative z-10 flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Semaine en cours */}
                        <div
                            className="rounded-2xl border p-5"
                            style={{
                                borderColor: `${primaryColor}33`,
                                backgroundColor: `${primaryColor}0d`
                            }}
                        >
                            <h4 className="text-lg font-bold mb-4" style={{ color: primaryColor }}>
                                Semaine en cours ({currentWeek.startStr} - {currentWeek.endStr})
                            </h4>

                            {/* Tâches terminées */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Tâches terminées ({currentWeekTasks.completed.length})
                                    </h5>
                                    <button
                                        onClick={() => toggleAll('current', true)}
                                        className="text-xs transition-colors"
                                        style={{ color: primaryColor }}
                                    >
                                        {currentWeekTasks.completed.every(t => selectedTasks[t.id]) ? "Désélectionner" : "Tout sélectionner"}
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {Object.entries(groupByProject(currentWeekTasks.completed)).map(([project, projectTasks]) => (
                                        <div key={project} className="mb-3">
                                            <div className="text-xs font-semibold text-slate-300 mb-1">📁 {project}</div>
                                            {projectTasks.map(task => (
                                                <label key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTasks[task.id] || false}
                                                        onChange={() => toggleTask(task.id)}
                                                        className="mt-0.5 rounded border-white/20"
                                                    />
                                                    <div className="flex-1 text-xs text-slate-200">
                                                        <div className="font-medium">{task.title}</div>
                                                        {task.subtasks && task.subtasks.length > 0 && (
                                                            <div className="text-slate-400 mt-1">
                                                                {task.subtasks.length} sous-tâches
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                    {currentWeekTasks.completed.length === 0 && (
                                        <div className="text-xs text-slate-400 italic">Aucune tâche terminée</div>
                                    )}
                                </div>
                            </div>

                            {/* Tâches restantes */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-orange-300 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4" />
                                        Tâches restantes ({currentWeekTasks.remaining.length})
                                    </h5>
                                    <button
                                        onClick={() => toggleAll('current', false)}
                                        className="text-xs transition-colors"
                                        style={{ color: primaryColor }}
                                    >
                                        {currentWeekTasks.remaining.every(t => selectedTasks[t.id]) ? "Désélectionner" : "Tout sélectionner"}
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {Object.entries(groupByProject(currentWeekTasks.remaining)).map(([project, projectTasks]) => (
                                        <div key={project} className="mb-3">
                                            <div className="text-xs font-semibold text-slate-300 mb-1">📁 {project}</div>
                                            {projectTasks.map(task => {
                                                const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
                                                return (
                                                    <label key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTasks[task.id] || false}
                                                            onChange={() => toggleTask(task.id)}
                                                            className="mt-0.5 rounded border-white/20"
                                                        />
                                                        <div className="flex-1 text-xs text-slate-200">
                                                            <div className="font-medium">{task.title}</div>
                                                            <div className="text-slate-400 mt-1">
                                                                {statusLabel}
                                                                {task.subtasks && task.subtasks.length > 0 && (
                                                                    <> • {task.subtasks.length} sous-tâches</>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {currentWeekTasks.remaining.length === 0 && (
                                        <div className="text-xs text-slate-400 italic">Aucune tâche restante</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Semaine précédente */}
                        <div
                            className="rounded-2xl border p-5"
                            style={{
                                borderColor: `${secondaryColor}33`,
                                backgroundColor: `${secondaryColor}0d`
                            }}
                        >
                            <h4 className="text-lg font-bold mb-4" style={{ color: secondaryColor }}>
                                Semaine précédente ({previousWeek.startStr} - {previousWeek.endStr})
                            </h4>

                            {/* Tâches terminées */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Tâches terminées ({previousWeekTasks.completed.length})
                                    </h5>
                                    <button
                                        onClick={() => toggleAll('previous', true)}
                                        className="text-xs transition-colors"
                                        style={{ color: secondaryColor }}
                                    >
                                        {previousWeekTasks.completed.every(t => selectedTasks[t.id]) ? "Désélectionner" : "Tout sélectionner"}
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {Object.entries(groupByProject(previousWeekTasks.completed)).map(([project, projectTasks]) => (
                                        <div key={project} className="mb-3">
                                            <div className="text-xs font-semibold text-slate-300 mb-1">📁 {project}</div>
                                            {projectTasks.map(task => (
                                                <label key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTasks[task.id] || false}
                                                        onChange={() => toggleTask(task.id)}
                                                        className="mt-0.5 rounded border-white/20"
                                                    />
                                                    <div className="flex-1 text-xs text-slate-200">
                                                        <div className="font-medium">{task.title}</div>
                                                        {task.subtasks && task.subtasks.length > 0 && (
                                                            <div className="text-slate-400 mt-1">
                                                                {task.subtasks.length} sous-tâches
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                    {previousWeekTasks.completed.length === 0 && (
                                        <div className="text-xs text-slate-400 italic">Aucune tâche terminée</div>
                                    )}
                                </div>
                            </div>

                            {/* Tâches restantes */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-orange-300 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4" />
                                        Tâches restantes ({previousWeekTasks.remaining.length})
                                    </h5>
                                    <button
                                        onClick={() => toggleAll('previous', false)}
                                        className="text-xs transition-colors"
                                        style={{ color: secondaryColor }}
                                    >
                                        {previousWeekTasks.remaining.every(t => selectedTasks[t.id]) ? "Désélectionner" : "Tout sélectionner"}
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {Object.entries(groupByProject(previousWeekTasks.remaining)).map(([project, projectTasks]) => (
                                        <div key={project} className="mb-3">
                                            <div className="text-xs font-semibold text-slate-300 mb-1">📁 {project}</div>
                                            {projectTasks.map(task => {
                                                const statusLabel = STATUSES.find(s => s.id === task.status)?.label || task.status;
                                                return (
                                                    <label key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTasks[task.id] || false}
                                                            onChange={() => toggleTask(task.id)}
                                                            className="mt-0.5 rounded border-white/20"
                                                        />
                                                        <div className="flex-1 text-xs text-slate-200">
                                                            <div className="font-medium">{task.title}</div>
                                                            <div className="text-slate-400 mt-1">
                                                                {statusLabel}
                                                                {task.subtasks && task.subtasks.length > 0 && (
                                                                    <> • {task.subtasks.length} sous-tâches</>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {previousWeekTasks.remaining.length === 0 && (
                                        <div className="text-xs text-slate-400 italic">Aucune tâche restante</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer avec boutons de génération */}
                <div className="relative z-10 border-t border-theme-primary p-6">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-300">
                            <span className="font-semibold" style={{ color: primaryColor }}>{selectedCount}</span> tâches sélectionnées
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => generateReport('current')}
                                disabled={selectedCount === 0}
                                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    borderColor: `${primaryColor}30`,
                                    backgroundColor: `${primaryColor}10`,
                                    color: `${primaryColor}cc`
                                }}
                            >
                                <FileText className="w-4 h-4" />
                                CR Semaine en cours
                            </button>
                            <button
                                onClick={() => generateReport('previous')}
                                disabled={selectedCount === 0}
                                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    borderColor: `${secondaryColor}30`,
                                    backgroundColor: `${secondaryColor}10`,
                                    color: `${secondaryColor}cc`
                                }}
                            >
                                <FileText className="w-4 h-4" />
                                CR Semaine précédente
                            </button>
                            <button
                                onClick={() => generateReport('both')}
                                disabled={selectedCount === 0}
                                className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-black text-white shadow-lg transition-all hover:scale-105 hover:brightness-110 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                                style={{
                                    backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                                    boxShadow: `0 10px 15px -3px ${primaryColor}30`
                                }}
                            >
                                <FileText className="w-4 h-4" />
                                CR Complet (2 semaines)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
