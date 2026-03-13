import type { OutlookEvent } from '../types';

/**
 * Convertit une valeur DTSTART/DTEND ICS en date ISO YYYY-MM-DD locale.
 *
 * Formats supportés :
 *   DTSTART;VALUE=DATE:20260315          → all-day, retourne '2026-03-15' tel quel
 *   DTSTART:20260315T090000Z             → UTC, converti en date locale
 *   DTSTART;TZID=Europe/Paris:20260315T090000  → avec TZID, utilise Intl si possible
 */
function parseDtValue(raw: string): { date: string; allDay: boolean; time?: string } {
    // Séparer la clé de la valeur (ex: "DTSTART;VALUE=DATE:20260315")
    const colonIdx = raw.lastIndexOf(':');
    const key = raw.slice(0, colonIdx).toUpperCase();
    const val = raw.slice(colonIdx + 1).trim();

    // All-day : valeur sans heure (8 chiffres)
    if (/^\d{8}$/.test(val)) {
        return {
            date: `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`,
            allDay: true,
        };
    }

    // Datetime avec ou sans Z (UTC) ou avec TZID
    // Format : YYYYMMDDTHHMMSS[Z]
    const dtMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (dtMatch) {
        const [, yy, mm, dd, hh, mi, ss, isUTC] = dtMatch;
        let dateObj: Date;

        if (isUTC === 'Z') {
            // UTC → locale
            dateObj = new Date(Date.UTC(
                parseInt(yy), parseInt(mm) - 1, parseInt(dd),
                parseInt(hh), parseInt(mi), parseInt(ss)
            ));
        } else if (key.includes('TZID=')) {
            // Extraire le TZID et utiliser Intl
            const tzidMatch = key.match(/TZID=([^;:]+)/);
            const tzid = tzidMatch ? tzidMatch[1] : 'Europe/Paris';
            try {
                // Construire une date dans la timezone donnée
                const isoStr = `${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
                dateObj = new Date(
                    new Intl.DateTimeFormat('en-US', {
                        timeZone: tzid,
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false,
                    }).format(new Date(isoStr + '+00:00'))
                );
                // Fallback si Intl échoue → traiter comme heure locale
                if (isNaN(dateObj.getTime())) {
                    dateObj = new Date(`${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
                }
            } catch {
                dateObj = new Date(`${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
            }
        } else {
            // Pas de TZID, pas de Z → heure locale
            dateObj = new Date(`${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
        }

        const y = dateObj.getFullYear();
        const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const hr = String(dateObj.getHours()).padStart(2, '0');
        const mn = String(dateObj.getMinutes()).padStart(2, '0');
        return { date: `${y}-${mo}-${d}`, allDay: false, time: `${hr}:${mn}` };
    }

    // Fallback : prendre les 8 premiers chiffres
    const fallback = val.replace(/\D/g, '').slice(0, 8);
    if (fallback.length === 8) {
        return {
            date: `${fallback.slice(0, 4)}-${fallback.slice(4, 6)}-${fallback.slice(6, 8)}`,
            allDay: false,
        };
    }

    return { date: new Date().toISOString().slice(0, 10), allDay: false };
}

/**
 * Décode les caractères d'échappement ICS (\n, \,, \;, \\)
 */
function decodeIcsText(text: string): string {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

/**
 * Gère le line-folding ICS (continuation avec espace ou tab en début de ligne suivante)
 */
function unfoldLines(icsContent: string): string {
    return icsContent.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

/**
 * Parse un contenu ICS et retourne la liste des OutlookEvent.
 * Ignore les RRULE (récurrences) — affiche uniquement les occurrences présentes.
 */
export function parseIcs(icsContent: string): OutlookEvent[] {
    const unfolded = unfoldLines(icsContent);
    const lines = unfolded.split('\n');
    const events: OutlookEvent[] = [];

    let inEvent = false;
    let current: Partial<OutlookEvent> & { dtStartRaw?: string; dtEndRaw?: string } = {};

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === 'BEGIN:VEVENT') {
            inEvent = true;
            current = {};
            continue;
        }

        if (trimmed === 'END:VEVENT') {
            inEvent = false;
            if (current.uid && current.title && current.dtStartRaw) {
                // Filtrer les événements générés par To-DoX (anti-doublons)
                if (current.uid.startsWith('todox-')) {
                    current = {};
                    continue;
                }
                const startParsed = parseDtValue(current.dtStartRaw);
                const start = startParsed.date;
                const startTime = startParsed.time;
                let end = start;
                let endTime: string | undefined;
                if (current.dtEndRaw) {
                    const endParsed = parseDtValue(current.dtEndRaw);
                    end = endParsed.date;
                    endTime = endParsed.time;
                }
                events.push({
                    uid: current.uid,
                    title: current.title,
                    start,
                    end,
                    allDay: startParsed.allDay,
                    startTime,
                    endTime,
                    location: current.location,
                });
            }
            continue;
        }

        if (!inEvent) continue;

        // Extraire la clé (peut contenir des paramètres type DTSTART;VALUE=DATE)
        const firstColon = trimmed.indexOf(':');
        if (firstColon === -1) continue;
        const keyPart = trimmed.slice(0, firstColon).toUpperCase();
        const value = trimmed.slice(firstColon + 1);

        if (keyPart === 'UID') {
            current.uid = value;
        } else if (keyPart === 'SUMMARY') {
            current.title = decodeIcsText(value);
        } else if (keyPart.startsWith('DTSTART')) {
            current.dtStartRaw = trimmed;
        } else if (keyPart.startsWith('DTEND')) {
            current.dtEndRaw = trimmed;
        } else if (keyPart === 'LOCATION') {
            current.location = decodeIcsText(value) || undefined;
        }
        // RRULE ignoré en v1
    }

    return events;
}
