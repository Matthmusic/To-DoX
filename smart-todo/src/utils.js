import { PROJECT_COLORS } from './constants';

// Helper pour les logs conditionnels (développement uniquement)
export const isDev = process.env.NODE_ENV === 'development';
export const devLog = (...args) => isDev && console.log(...args);
export const devError = (...args) => isDev && console.error(...args);
export const devWarn = (...args) => isDev && console.warn(...args);

/**
 * Génère un identifiant unique
 */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Génère une couleur de badge pour un projet basée sur son nom
 * Cache les résultats pour éviter les recalculs
 */
const projectColorCache = new Map();

export function getProjectColor(projectName) {
  // Vérifier le cache d'abord
  if (projectColorCache.has(projectName)) {
    return projectColorCache.get(projectName);
  }

  // Hash simple du nom du projet
  let hash = 0;
  for (let i = 0; i < projectName.length; i++) {
    hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const color = PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];

  // Mettre en cache le résultat
  projectColorCache.set(projectName, color);

  return color;
}

/**
 * Calcule le nombre de jours ouvrés entre deux dates (exclut samedi et dimanche)
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @returns {number} Nombre de jours ouvrés
 */
export function businessDaysBetween(startDate, endDate) {
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

/**
 * Convertit un chemin de fichier en URL file://
 */
export function toFileURL(path) {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  return `file:///${encodeURI(normalized)}`;
}

/**
 * Génère une classe CSS combinée conditionnellement
 */
export function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Formate une date en JJ/MM/AAAA
 */
export function formatDateFull(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Formate une date en JJ/MM
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

/**
 * Obtient la plage de dates de la semaine en cours
 */
export function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday,
    end: sunday,
    startStr: formatDateShort(monday.toISOString().split("T")[0]),
    endStr: formatDateShort(sunday.toISOString().split("T")[0]),
  };
}

/**
 * Obtient la plage de dates de la semaine précédente
 */
export function getPreviousWeekRange() {
  const currentWeek = getCurrentWeekRange();
  const previousMonday = new Date(currentWeek.start);
  previousMonday.setDate(currentWeek.start.getDate() - 7);

  const previousSunday = new Date(currentWeek.end);
  previousSunday.setDate(currentWeek.end.getDate() - 7);

  return {
    start: previousMonday,
    end: previousSunday,
    startStr: formatDateShort(previousMonday.toISOString().split("T")[0]),
    endStr: formatDateShort(previousSunday.toISOString().split("T")[0]),
  };
}

/**
 * Retourne la date du jour au format ISO (YYYY-MM-DD)
 */
export function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Ajoute n jours à la date actuelle et retourne au format ISO (YYYY-MM-DD)
 * @param {number} n - Nombre de jours à ajouter
 * @returns {string} Date au format YYYY-MM-DD
 */
export function addDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
