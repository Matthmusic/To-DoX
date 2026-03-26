# Intégration Calendrier Outlook ↔ Timeline

## Principe

Synchronisation bidirectionnelle via fichiers ICS — aucune API Microsoft, aucun Azure AD requis.

- **Outlook → Timeline** : Outlook 365 publie le calendrier en URL ICS. To-DoX fetch cette URL et affiche les événements en lecture seule sur la timeline.
- **To-DoX → Outlook** : To-DoX génère un fichier `todox-tasks.ics` dans le dossier de stockage. L'utilisateur l'abonne dans Outlook ("Ajouter un calendrier Internet") — Outlook le rafraîchit automatiquement.

---

## Fichiers à créer

| Fichier | Rôle |
|---|---|
| `src/utils/icsParser.ts` | Parser les blocs VEVENT (DTSTART, DTEND, SUMMARY, UID, LOCATION) |
| `src/utils/icsGenerator.ts` | Générer un VCALENDAR depuis les tâches avec `due` ou `ganttDays` |
| `src/components/settings/OutlookPanel.tsx` | Panneau paramètres (pattern GlassModal comme NotificationsPanel) |
| `src/hooks/useOutlookSync.ts` | Fetch ICS au montage + toutes les 15 min, régénère le .ics export quand les tâches changent |

---

## Fichiers à modifier

| Fichier | Modification |
|---|---|
| `src/types.ts` | Types `OutlookConfig`, `OutlookEvent` + champ dans `StoredData` |
| `src/store/useStore.ts` | State `outlookConfig`, `outlookEvents` + actions `setOutlookConfig`, `setOutlookEvents` |
| `src/hooks/useDataPersistence.ts` | Persister `outlookConfig` dans data.json |
| `electron.js` | IPC : `outlook:fetch-url`, `outlook:write-ics`, `outlook:get-ics-path` |
| `preload.js` | Exposer `window.electronAPI.outlook.*` |
| `src/components/TimelineView.tsx` | Zone "Calendrier Outlook" en tête de grille (read-only) |
| `src/ToDoX.tsx` | Monter `useOutlookSync`, ajouter `<OutlookPanel>` |
| `src/components/KanbanHeaderPremium.tsx` | Entrée Outlook dans le menu Paramètres |

---

## Types

```typescript
// src/types.ts

interface OutlookConfig {
  enabled: boolean;
  icsUrl: string;           // URL publiée par Outlook (lecture)
  exportEnabled: boolean;   // Générer todox-tasks.ics (écriture)
  lastSync: number | null;
}

interface OutlookEvent {
  uid: string;
  title: string;
  start: string;    // YYYY-MM-DD
  end: string;      // YYYY-MM-DD (exclusif, comme DTEND en ICS)
  allDay: boolean;
  location?: string;
}

// Ajouter dans StoredData :
// outlookConfig?: OutlookConfig;
```

---

## Store

```typescript
// src/store/useStore.ts — nouveaux champs

// State
outlookConfig: OutlookConfig;          // persisté
outlookEvents: OutlookEvent[];         // transient (non persisté)

// Actions
setOutlookConfig: (patch: Partial<OutlookConfig>) => void;
setOutlookEvents: (events: OutlookEvent[]) => void;

// Valeur par défaut
const defaultOutlookConfig: OutlookConfig = {
  enabled: false,
  icsUrl: '',
  exportEnabled: false,
  lastSync: null,
};
```

---

## IPC Electron

```javascript
// electron.js

// Fetch une URL ICS (HTTPS GET)
ipcMain.handle('outlook:fetch-url', async (_, url) => {
  // utiliser https.get() natif Node.js
  // retourner { success, data: string } ou { success: false, error }
});

// Écrire le fichier todox-tasks.ics
ipcMain.handle('outlook:write-ics', async (_, path, content) => {
  // fs.writeFileSync(path, content, 'utf-8')
  // retourner { success }
});

// Obtenir le chemin de l'export ICS (basé sur storagePath)
ipcMain.handle('outlook:get-ics-path', async (_, storagePath) => {
  // retourner path.join(path.dirname(storagePath), 'todox-tasks.ics')
});
```

```javascript
// preload.js
outlook: {
  fetchUrl: (url) => ipcRenderer.invoke('outlook:fetch-url', url),
  writeIcs: (path, content) => ipcRenderer.invoke('outlook:write-ics', path, content),
  getIcsPath: (storagePath) => ipcRenderer.invoke('outlook:get-ics-path', storagePath),
}
```

---

## icsParser.ts

Champs VEVENT à extraire :

| Champ ICS | Mapping |
|---|---|
| `UID` | `uid` |
| `SUMMARY` | `title` |
| `DTSTART` | `start` → convertir en YYYY-MM-DD |
| `DTEND` | `end` → convertir en YYYY-MM-DD |
| `DTSTART;VALUE=DATE` | `allDay: true` |
| `LOCATION` | `location` |

Logique de conversion de date :
- `DTSTART:20260315T090000Z` → UTC → date locale
- `DTSTART;VALUE=DATE:20260315` → all-day, pas de conversion TZ
- `DTSTART;TZID=Europe/Paris:20260315T090000` → parser avec `Intl`

Événements récurrents (`RRULE`) : **ignorer en v1**, afficher uniquement les occurrences déjà expandées présentes dans le fichier.

---

## icsGenerator.ts

```
VCALENDAR
  VERSION:2.0
  PRODID:-//To-DoX//To-DoX//FR
  X-WR-CALNAME:To-DoX Tâches

  Pour chaque tâche avec due != null :
    VEVENT
      UID:todox-{task.id}@todox
      SUMMARY:[{task.project}] {task.title}
      DTSTART;VALUE=DATE:{task.due}
      DTEND;VALUE=DATE:{task.due + 1 jour}
      DESCRIPTION:{task.notes}
      STATUS:CONFIRMED | COMPLETED (si status=done)
    END:VEVENT

  Pour chaque tâche avec ganttDays (grouper les jours contigus) :
    → créer un VEVENT par plage continue de jours
END:VCALENDAR
```

---

## useOutlookSync.ts

```typescript
// Lecture (Outlook → To-DoX)
// - Au montage : fetch icsUrl si enabled
// - Interval 15 min : re-fetch
// - Met à jour outlookEvents + lastSync

// Écriture (To-DoX → Outlook)
// - useEffect sur tasks (debounce 2s)
// - Si exportEnabled : générer ICS + écrire via IPC
// - Stocker le chemin du fichier dans un state local pour l'afficher dans OutlookPanel
```

---

## OutlookPanel.tsx

```
┌─────────────────────────────────────────────┐
│ 📅  Intégration Outlook                      │
├─────────────────────────────────────────────┤
│ [⬛] Activer la synchronisation              │
│                                             │
│ ── IMPORTER DEPUIS OUTLOOK ─────────────── │
│                                             │
│ URL ICS publiée :                           │
│ [https://outlook.office365.com/...    ]     │
│                                             │
│ ℹ️  Outlook → Calendrier → Partager →       │
│     Publier → Copier l'URL ICS              │
│                                             │
│ [Synchroniser maintenant]                   │
│ ✓ Dernière sync : il y a 2 min — 8 events  │
│                                             │
│ ── EXPORTER VERS OUTLOOK ──────────────── │
│                                             │
│ [⬛] Exporter les tâches avec échéances     │
│                                             │
│ Fichier généré :                            │
│ C:\Users\...\To-Do-X\todox-tasks.ics        │
│ [📋 Copier le chemin]                       │
│                                             │
│ ℹ️  Outlook → Ajouter un calendrier →       │
│     Depuis Internet → coller le chemin     │
│     (format : file:///C:/Users/...)         │
└─────────────────────────────────────────────┘
```

Pattern : `GlassModal` avec animations Framer Motion, même structure que `NotificationsPanel.tsx`.

---

## Rendu dans TimelineView.tsx

- Section collapsible **"📅 Calendrier Outlook"** au-dessus des projets existants
- Visible uniquement si `outlookConfig.enabled && outlookEvents.length > 0`
- Chaque event = barre read-only **indigo semi-transparente** (`bg-indigo-500/30 border border-indigo-400/50`)
- Icône 🔒 à gauche pour indiquer la nature read-only
- Tooltip sur hover : titre, lieu, dates
- Badge dans le header de section : nombre d'events dans la période visible
- Pas de drag, pas de clic éditant

```
┌─── 📅 Calendrier Outlook (3) ──────────[⌄]──────────────────────────────────┐
│ Réunion équipe         │░░░░░░░░░│▓▓▓▓▓▓▓▓▓│░░░░░░░░░│░░░░░░░░│░░░░░░░░░   │
│ Point projet SIRIUS    │░░░░░░░░░│░░░░░░░░░│░░▓▓▓░░░░│░░░░░░░░│░░░░░░░░░   │
│ Formation sécurité     │░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│▓▓▓▓▓▓▓▓│░░░░░░░░░   │
└──────────────────────────────────────────────────────────────────────────────┘
┌─── PROJET ALPHA ──────────────────────────────────────────────────────────────┐
│ ...tâches existantes...                                                       │
```

---

## Ordre d'implémentation

1. **`src/types.ts`** — ajouter `OutlookConfig`, `OutlookEvent`, mettre à jour `StoredData`
2. **`src/store/useStore.ts`** — state + actions
3. **`src/hooks/useDataPersistence.ts`** — persist/restore `outlookConfig`
4. **`electron.js`** + **`preload.js`** — IPC handlers
5. **`src/utils/icsParser.ts`** + **`src/utils/icsGenerator.ts`** — logique métier
6. **`src/hooks/useOutlookSync.ts`** — orchestration
7. **`src/components/settings/OutlookPanel.tsx`** — UI
8. **`src/components/TimelineView.tsx`** — rendu des events
9. **`src/ToDoX.tsx`** + **`src/components/KanbanHeaderPremium.tsx`** — intégration finale

---

## Points d'attention

| Sujet | Décision |
|---|---|
| Timezones | Convertir DTSTART UTC → date locale ; DTSTART;VALUE=DATE → pas de conversion |
| Événements récurrents | Ignorer RRULE en v1 — afficher uniquement les occurrences présentes |
| Refresh | Fetch toutes les 15 min en arrière-plan, pas de spinner bloquant |
| Export debounce | Régénérer `todox-tasks.ics` avec debounce 2 s après chaque modif de tâche |
| Erreur réseau | Conserver les derniers events en mémoire si le fetch échoue (ne pas vider) |
| Chemin Windows | Utiliser `file:///C:/...` (3 slashes) pour que Outlook accepte l'URL locale |
| Performances | Filtrer les events hors de la fenêtre visible avant le rendu dans TimelineView |
