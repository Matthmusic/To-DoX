/** Mode d'affichage d'une carte de tâche — persisté par tâche dans localStorage. */
export type CardMode = 'full' | 'compact';

const CARD_MODES_KEY = "todox_card_modes";

export function getCardMode(id: string): CardMode {
    try {
        const legacy = new Set<string>(JSON.parse(localStorage.getItem("todox_compact_cards") || "[]"));
        const modes: Record<string, CardMode> = JSON.parse(localStorage.getItem(CARD_MODES_KEY) || "{}");
        const saved = modes[id];
        if (saved === 'compact' || saved === 'full') return saved;
        if (legacy.has(id)) return 'compact';
        return 'full';
    } catch { return 'full'; }
}

export function saveCardMode(id: string, mode: CardMode) {
    try {
        const modes: Record<string, CardMode> = JSON.parse(localStorage.getItem(CARD_MODES_KEY) || "{}");
        modes[id] = mode;
        localStorage.setItem(CARD_MODES_KEY, JSON.stringify(modes));
    } catch { /* ignore */ }
}
