# 🗺️ Roadmap To-DoX

Document de suivi des améliorations et évolutions de l'application To-DoX.

**Dernière mise à jour :** 12 février 2026
**Version actuelle :** 2.0.1 (en développement)
**Prochaine version :** 2.0.2 (planifiée)

---

## 📊 Vue d'ensemble

| Catégorie | Total | TODO | En cours | Terminé |
|-----------|-------|------|----------|---------|
| 🎯 Prioritaires | 3 | 0 | 0 | 3 |
| 🚀 Techniques | 3 | 2 | 0 | 1 |
| 🌟 UX/Polish | 4 | 2 | 0 | 2 |
| 🔧 Quick Wins | 3 | 2 | 0 | 1 |
| **TOTAL** | **13** | **6** | **0** | **7** |

**Légende :**
- 🔲 TODO
- 🔄 EN COURS
- ✅ TERMINÉ
- 🔥 Priorité Haute
- ⭐ Priorité Moyenne
- 💡 Priorité Basse

---

## 🎯 Améliorations Prioritaires

### 1. Raccourcis clavier globaux ⌨️
**Statut :** ✅ TERMINÉ (11 février 2026)
**Priorité :** 🔥 Haute
**Estimation :** 2-3h → **Réalisé en 3h** (avec code review + corrections)
**Impact :** ⭐⭐⭐⭐⭐

**Description :**
Système complet de raccourcis clavier pour accélérer le workflow utilisateur.

**Raccourcis implémentés :**
- ✅ `Ctrl+N` : Focus sur QuickAdd (nouvelle tâche)
- ✅ `Ctrl+F` : Afficher et focus sur la recherche
- ✅ `Ctrl+E` : Export rapide JSON
- ✅ `Escape` : Fermer modaux/panels/recherche
- ✅ `Ctrl+Shift+A` : Ouvrir panneau Archives tâches
- ✅ `Ctrl+Shift+P` : Ouvrir panneau Projets
- ✅ `F1` : Afficher l'aide des raccourcis

**Fichiers créés :**
- `src/contexts/ShortcutsContext.tsx` : Context pour callbacks
- `src/hooks/useKeyboardShortcuts.ts` : Hook principal + config défaut
- `src/hooks/useClickOutside.ts` : Hook réutilisable (bonus DRY)
- `src/components/ShortcutsHelpPanel.tsx` : Modal d'aide avec catégories
- `src/components/SearchInput.tsx` : Input recherche avec focus programmatique

**Fichiers modifiés :**
- `src/ToDoX.tsx` : Orchestration des raccourcis
- `src/components/QuickAddPremium.tsx` : Pattern forwardRef + hook useClickOutside
- `src/components/KanbanHeaderPremium.tsx` : Bouton aide + SearchInput conditionnel

**Fonctionnalités bonus :**
- 🔍 Recherche conditionelle (Ctrl+F pour afficher, Esc pour masquer) → Gain de place
- 🎯 Bouton d'aide visible (icône "?" cyan) avec tooltip "Aide (F1)"
- 🍎 Compatible macOS (Cmd au lieu de Ctrl via metaKey)
- 🎨 Modal d'aide avec catégories (UI, Navigation, Actions)
- ✨ Strict matching des modificateurs (pas de faux positifs)
- 🔄 Code review complet (4 bugs corrigés, code optimisé)

**Notes techniques :**
- Hook `useClickOutside` remplace 44 lignes de code dupliqué
- Pattern forwardRef + useImperativeHandle pour focus programmatique
- useMemo pour éviter race conditions dans useEffect
- Désactivation dans inputs (sauf F1 et Escape)
- Prévention conflits navigateur avec preventDefault()

---

### 2. Notifications desktop natives 🔔
**Statut :** ✅ TERMINÉ (12 février 2026)
**Priorité :** 🔥 Haute
**Estimation :** 4-6h → **Réalisé en 5h**
**Impact :** ⭐⭐⭐⭐⭐

**Description :**
Système complet de notifications desktop natives utilisant l'API Electron Notification.

**Fonctionnalités implémentées :**
- ✅ Notifications groupées par catégorie (1 notif au lieu de 10)
- ✅ **Échéances** : Tâches demain (J-1), aujourd'hui (J0), en retard (J négatif)
- ✅ **Tâches stagnantes** : >3 jours sans mouvement en "doing"
- ✅ Intervalle de vérification configurable (5-120 min, défaut: 30 min)
- ✅ Mode "Ne pas déranger" avec plage horaire (ex: 22h-8h)
- ✅ Son optionnel sur les notifications
- ✅ Permission demandée au premier lancement
- ✅ Bouton test pour vérifier la configuration
- ✅ Cache 24h pour éviter les doublons

**Fichiers créés :**
- `src/hooks/useNotifications.ts` : Hook principal avec logique de vérification
- `src/components/settings/NotificationsPanel.tsx` : Panneau de configuration complet
- `src/types.ts` : Interface `NotificationSettings`

**Fichiers modifiés :**
- `electron.js` : Handlers IPC `send-notification` et `request-notification-permission`
- `preload.js` : API Electron exposée pour notifications
- `src/store/useStore.ts` : État `notificationSettings` avec actions
- `src/hooks/useDataPersistence.ts` : Persistence des préférences
- `src/ToDoX.tsx` : Intégration du hook et du panneau
- `src/components/KanbanHeaderPremium.tsx` : Bouton "Notifications"

**Fonctionnalités bonus :**
- 📊 Notifications groupées : max 5 tâches affichées + "... et X autres"
- 🎯 Tags uniques par catégorie pour éviter duplications
- 🔄 Reset automatique du cache toutes les 24h
- 💡 Calcul des jours ouvrés avec `businessDayDelta`
- 🖱️ Clic sur notification = focus sur l'app

**Notes techniques :**
- Vérification périodique via `setInterval` (configurable)
- Quiet hours avec gestion du passage de minuit
- Notifications natives Electron avec icône et tag
- Persistence dans localStorage + Electron storage

---

### 3. Vue Timeline/Gantt 📊
**Statut :** 🔲 TODO
**Priorité :** ⭐ Moyenne
**Estimation :** 8-12h
**Impact :** ⭐⭐⭐⭐

**Description :**
Ajouter une vue alternative au Kanban pour visualiser les tâches sur une ligne de temps.

**Fonctionnalités :**
- 📅 Vue hebdomadaire/mensuelle
- 🔗 Visualisation des dépendances (si implémentées plus tard)
- 🎨 Couleur par projet ou par utilisateur
- 🖱️ Drag & drop pour modifier les dates

**Fichiers concernés :**
- `src/components/TimelineView.tsx` : **Existe déjà !** À compléter
- `src/components/ViewSwitcher.tsx` : **Existe déjà !** À brancher
- `src/ToDoX.tsx` : Intégrer le basculement de vue
- `src/hooks/useTimelineData.ts` : Hook pour formater les données

**Bibliothèques possibles :**
- `react-calendar-timeline` (recommandé)
- `@toast-ui/react-calendar`
- Custom avec D3.js (plus complexe)

**Notes :**
- Les composants `TimelineView.tsx` et `ViewSwitcher.tsx` existent déjà dans src/components/
- Probablement commencés puis laissés de côté → priorité à finaliser

---

## 🚀 Améliorations Techniques

### 4. Tests E2E avec Playwright 🧪
**Statut :** 🔲 TODO
**Priorité :** 🔥 Haute
**Estimation :** 8-10h (setup + premiers tests)
**Impact :** ⭐⭐⭐⭐⭐

**Description :**
Mettre en place des tests end-to-end pour valider les flows critiques de l'application.

**Installation :**
```bash
npm install -D @playwright/test
npx playwright install
```

**Tests à créer :**
1. **CRUD Tâches**
   - ✅ Créer une tâche
   - ✅ Modifier une tâche
   - ✅ Déplacer entre colonnes (drag & drop)
   - ✅ Archiver/Désarchiver
   - ✅ Supprimer

2. **Filtres et recherche**
   - ✅ Filtrer par projet
   - ✅ Recherche texte
   - ✅ Filtrer par utilisateur

3. **Import/Export**
   - ✅ Export JSON
   - ✅ Import JSON avec validation

4. **Persistence**
   - ✅ Sauvegarde automatique
   - ✅ Rechargement des données au démarrage

**Fichiers concernés :**
- `tests/e2e/` : Nouveau dossier
- `playwright.config.ts` : Configuration Playwright
- `.github/workflows/test.yml` : Intégrer dans CI

**Notes :**
- Utiliser `test.describe.serial()` pour tests dépendants
- Capturer screenshots en cas d'échec
- Tester sur Electron avec `_electron.launch()`

---

### 5. Storybook pour UI Components 📚
**Statut :** 🔲 TODO
**Priorité :** ⭐ Moyenne
**Estimation :** 6-8h (setup + premières stories)
**Impact :** ⭐⭐⭐⭐

**Description :**
Documenter visuellement les composants UI pour faciliter le développement et la maintenance.

**Installation :**
```bash
npx storybook@latest init
```

**Stories à créer :**
- `TaskCard.stories.tsx` : Tous les états (todo, doing, review, done, avec/sans deadline, etc.)
- `ProjectCard.stories.tsx` : Collapsed/Expanded, vide/rempli
- `QuickAddPremium.stories.tsx` : Focus/Blur, avec suggestions
- `Modal.stories.tsx` : Toutes les variantes de modaux
- `Autocomplete.stories.tsx` : Avec/sans données, loading state

**Fichiers concernés :**
- `src/stories/` : Nouveau dossier pour les stories
- `.storybook/` : Configuration Storybook
- `package.json` : Scripts Storybook

**Addons recommandés :**
- `@storybook/addon-a11y` : Test accessibilité
- `@storybook/addon-interactions` : Tests d'interactions
- `storybook-dark-mode` : Toggle dark mode

**Notes :**
- Utiliser `msw` pour mocker les données Electron
- Documenter les props dans les stories
- Configurer Storybook avec Tailwind CSS

---

### 6. Error Boundaries React 🛡️
**Statut :** ✅ TERMINÉ (12 février 2026)
**Priorité :** 🔥 Haute
**Estimation :** 3-4h → **Réalisé en 2h30**
**Impact :** ⭐⭐⭐⭐

**Description :**
Système complet d'Error Boundaries pour capturer et gérer les erreurs React gracieusement.

**Fonctionnalités implémentées :**
- ✅ Error Boundary React avec componentDidCatch
- ✅ Logging automatique des erreurs dans `logs/errors.log`
- ✅ UI de secours (ErrorScreen) avec design cohérent
- ✅ Bouton "Réessayer" pour reset l'error boundary
- ✅ Bouton "Signaler le bug" avec pré-remplissage GitHub issue
- ✅ Détails techniques expandables (Stack Trace + Component Stack)
- ✅ Suggestions d'actions pour l'utilisateur
- ✅ Nommage des boundaries pour identifier la source de l'erreur
- ✅ Composant de test (ErrorTestButton) pour validation

**Fichiers créés :**
- `src/components/ErrorBoundary.tsx` : Composant class avec componentDidCatch
- `src/components/ErrorScreen.tsx` : UI friendly avec actions et détails
- `src/components/ErrorTestButton.tsx` : Composant de test (à supprimer en prod)
- `docs/ERROR_BOUNDARIES_GUIDE.md` : Guide complet pour réutilisation

**Fichiers modifiés :**
- `electron.js` : Handler IPC `log-error` pour écrire dans logs/errors.log
- `preload.js` : API `logError` et `openExternalUrl` exposées
- `src/types.ts` : Interface `ErrorLog` et extension `ElectronAPI`
- `src/ToDoX.tsx` : Boundaries autour de KanbanBoard et Modals

**Architecture :**
```
<ErrorBoundary name="AppRoot">
  <App>
    <ErrorBoundary name="KanbanBoard">
      <KanbanBoard />
    </ErrorBoundary>
    <ErrorBoundary name="Modals">
      {/* Tous les modaux et panels */}
    </ErrorBoundary>
  </App>
</ErrorBoundary>
```

**Fonctionnalités bonus :**
- 📁 Logs organisés dans `userData/logs/errors.log`
- 🎨 Design moderne avec gradients et blur effects
- 📋 Format de log structuré avec timestamps et boundary name
- 🔗 Pré-remplissage automatique des GitHub issues
- 💡 Suggestions contextuelles pour l'utilisateur
- 📖 Guide complet de réutilisation (10+ pages de documentation)

**Notes techniques :**
- Class component requis (Error Boundaries pas supportés en hooks)
- Capture uniquement les erreurs de rendu, pas les event handlers
- Logging avec stack trace complet + component stack
- Boundaries stratégiquement placées (app, modaux, features critiques)

---

## 🌟 Améliorations UX/Polish

### 7. Animations avec Framer Motion ✨
**Statut :** ✅ TERMINÉ (12 février 2026)
**Priorité :** 💡 Basse
**Estimation :** 4-6h → **Réalisé en 3h**
**Impact :** ⭐⭐⭐

**Description :**
Micro-animations fluides et professionnelles ajoutées à tous les composants clés de l'application.

**Animations implémentées :**
- ✅ **TaskCard** : Slide-in à la création (opacity 0→1, y: 20→0)
- ✅ **ProjectCard** : Smooth collapse/expand avec AnimatePresence (height: 0↔auto)
- ✅ **Modaux** : Fade in/out + scale (0.95→1) avec backdrop blur
- ✅ **UpdateNotification** : Slide from top (y: -20→0) pour tous les états
- ✅ **AnimatePresence** : Animations de sortie fluides sur tous les composants

**Fichiers modifiés :**
- `src/components/TaskCard.tsx` : motion.div avec initial/animate/exit
- `src/components/ProjectCard.tsx` : AnimatePresence + motion.div pour collapse
- `src/components/ui/Modal.tsx` : AnimatePresence + double motion (backdrop + contenu)
- `src/components/UpdateNotification.tsx` : motion.div pour toutes les notifications

**Architecture :**
```tsx
// TaskCard - Slide-in entrance
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
/>

// ProjectCard - Smooth collapse
<AnimatePresence initial={false}>
  {!isCollapsed && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    />
  )}
</AnimatePresence>

// Modal - Fade + scale
<AnimatePresence>
  {isOpen && (
    <motion.div /* backdrop */
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div /* content */
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      />
    </motion.div>
  )}
</AnimatePresence>
```

**Timings et performances :**
- TaskCard : 200ms (entrance rapide)
- ProjectCard : 300ms (collapse/expand smooth)
- Modaux : 200ms (feedback instantané)
- Notifications : 300ms (slide doux)
- Toutes les animations utilisent `ease-out` pour un ressenti naturel

**Notes techniques :**
- Drag & drop HTML5 natif préservé (pas de whileHover sur TaskCard)
- AnimatePresence utilisé pour gérer les sorties proprement
- Portal-based modals compatibles avec animations
- Pas de `prefers-reduced-motion` implémenté (à ajouter si nécessaire)
- Bundle size : +1.3KB gzipped (framer-motion déjà en dépendance)

---

### 8. Système de tags flexibles 🏷️
**Statut :** 🔲 TODO
**Priorité :** ⭐ Moyenne
**Estimation :** 6-8h
**Impact :** ⭐⭐⭐⭐

**Description :**
Ajouter un système de tags en complément des projets pour une organisation plus flexible.

**Fonctionnalités :**
- 🏷️ Tags multiples par tâche (`#urgent`, `#client`, `#bug`)
- 🎨 Couleurs personnalisables par tag
- 🔍 Filtrage par tags (AND/OR)
- ⚡ Autocomplete dans QuickAdd avec `#`

**Fichiers concernés :**
- `src/types.ts` : Ajouter `tags?: string[]` à `Task`
- `src/store/useStore.ts` : Ajouter `availableTags: Tag[]`
- `src/components/TaskCard.tsx` : Afficher les tags
- `src/components/TagsPanel.tsx` : Nouveau panneau de gestion
- `src/hooks/useFilters.ts` : Ajouter filtrage par tags

**Structure de données :**
```typescript
interface Tag {
  name: string;
  color: string; // Hex color
  icon?: string; // Lucide icon name
}
```

**Notes :**
- Les tags doivent être case-insensitive
- Auto-créer les tags lors de l'ajout d'une tâche
- Suggérer tags populaires dans l'autocomplete

---

### 9. Commentaires et historique d'activité 💬
**Statut :** 🔲 TODO
**Priorité :** ⭐ Moyenne
**Estimation :** 10-12h
**Impact :** ⭐⭐⭐⭐

**Description :**
Ajouter un fil de commentaires et un historique des modifications pour chaque tâche.

**Fonctionnalités :**
- 💬 Fil de commentaires par tâche
- 📜 Historique des modifications (qui, quand, quoi)
- @️⃣ Mentions d'utilisateurs
- 📎 Formatage Markdown dans commentaires

**Fichiers concernés :**
- `src/types.ts` : Ajouter types `Comment` et `ActivityLog`
- `src/store/useStore.ts` : Actions `addComment`, `logActivity`
- `src/components/TaskComments.tsx` : Nouveau composant
- `src/components/ActivityTimeline.tsx` : Nouveau composant
- `src/components/TaskEditPanel.tsx` : Intégrer les onglets

**Structure de données :**
```typescript
interface Comment {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  createdAt: string;
  mentions?: string[]; // userIds mentionnés
}

interface ActivityLog {
  id: string;
  taskId: string;
  userId: string;
  action: 'created' | 'updated' | 'moved' | 'commented';
  changes?: Record<string, { old: any; new: any }>;
  timestamp: string;
}
```

**Notes :**
- Utiliser `marked` pour parser le Markdown
- Détecter les mentions avec regex `/@(\w+)/g`
- Limiter historique à 100 dernières activités par tâche
- Exporter commentaires dans l'export JSON

---

### 10. Liens de fichiers intelligents et édition de notes 📎
**Statut :** ✅ TERMINÉ (12 février 2026)
**Priorité :** ⭐ Moyenne
**Estimation :** 3-4h → **Réalisé en 3h**
**Impact :** ⭐⭐⭐⭐

**Description :**
Détection automatique des chemins de fichiers dans les notes et sous-tâches, avec édition rapide des notes.

**Fonctionnalités implémentées :**
- ✅ Détection automatique des chemins de fichiers (regex avancée)
- ✅ Support des chemins avec espaces entre guillemets : `"Z:\B - AFFAIRES\file.pdf"`
- ✅ Support des chemins sans espaces : `C:\dev\project\file.txt`
- ✅ Chemins Unix/relatifs : `/path/file`, `./src/file.ts`
- ✅ Chemins UNC : `\\server\share\file`
- ✅ Rendu visuel distinctif : badge bleu avec icône `ExternalLink`
- ✅ Ouverture au clic via `window.electronAPI.openFolder`
- ✅ Édition rapide des notes : clic sur l'encart ou icône crayon
- ✅ Notes affichées **au-dessus** des sous-tâches
- ✅ Raccourcis : Ctrl+Enter pour sauvegarder, Echap pour annuler

**Fichiers créés/modifiés :**
- `src/components/SubtaskList.tsx` :
  - Fonction `parseFilePaths()` exportée pour réutilisation
  - Détection et rendu des liens dans les sous-tâches
- `src/components/TaskCard.tsx` :
  - Import de `parseFilePaths` et icônes `ExternalLink`, `Edit3`
  - État `isEditingNotes`, `localNotes`, ref `notesTextareaRef`
  - Section notes avec édition inline et liens cliquables
  - Réorganisation : Notes → Sous-tâches

**Regex avancée :**
```regex
"([a-zA-Z]:[^"]+|\/[^"]+|\.\.?\/[^"]+|\\\\[^"]+)"|
(?:[a-zA-Z]:\\(?:[^\s\\/:*?"<>|]+\\)*[^\s\\/:*?"<>|]+(?:\.[a-zA-Z0-9]+)?)|
(?:\/(?:[^\s/]+\/)*[^\s/]+)|(?:\.\.?\/(?:[^\s/]+\/)*[^\s/]+)|
(?:\\\\[^\s\\]+\\[^\s\\]+(?:\\[^\s\\]+)*)
```

**Exemples d'utilisation :**
```
Notes: Voir le plan ici: "Z:\B - AFFAIRES\115 - EGIS\plan.pdf"
Sous-tâche: Config dans C:\dev\config.json
```

**Fonctionnalités bonus :**
- 💡 Tooltip "Astuce: Utilisez des guillemets pour les chemins avec espaces"
- 🎨 Style cohérent (badge bleu monospace + hover effect)
- 🔄 Synchronisation automatique des états locaux avec la tâche
- ✨ Auto-focus du textarea lors de l'édition
- 🛡️ Validation des chemins (doit contenir `\`, `/` ou extension)

**Notes techniques :**
- Pattern forwardRef non nécessaire (composant inline)
- Utilisation de `whitespace-pre-wrap` pour préserver formatage
- `stopPropagation()` pour éviter conflits avec drag & drop
- Fonction réutilisable entre Notes et Subtasks

---

## 🔧 Quick Wins

### 11. Thèmes personnalisables 🎨
**Statut :** 🔲 TODO
**Priorité :** 💡 Basse
**Estimation :** 3-4h
**Impact :** ⭐⭐⭐

**Description :**
Remplacer le dark mode forcé par un système de thèmes personnalisables.

**Fonctionnalités :**
- 🌙 Thème clair/sombre/auto (système)
- 🎨 Couleurs d'accent personnalisables
- 💾 Sauvegarde des préférences

**Fichiers concernés :**
- `electron.js` : Retirer `nativeTheme.themeSource = 'dark'`
- `src/hooks/useTheme.ts` : Nouveau hook
- `src/components/settings/ThemePanel.tsx` : Panneau de config
- `tailwind.config.js` : Variables CSS pour couleurs

**Implémentation :**
```typescript
// useTheme.ts
const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

useEffect(() => {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.classList.toggle('dark', prefersDark.matches);
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}, [theme]);
```

**Notes :**
- Utiliser CSS variables pour les couleurs d'accent
- Sauvegarder dans localStorage
- Proposer 3-4 thèmes prédéfinis + custom

---

### 12. Changelog intégré dans UpdateNotification 📝
**Statut :** ✅ TERMINÉ (12 février 2026)
**Priorité :** 💡 Basse
**Estimation :** 2-3h → **Réalisé en 1h30**
**Impact :** ⭐⭐⭐

**Description :**
Affichage du changelog directement dans la notification de mise à jour avec support Markdown.

**Fonctionnalités implémentées :**
- ✅ Récupération automatique du changelog depuis electron-updater (GitHub Releases)
- ✅ Parser Markdown basique intégré (sans dépendance externe)
- ✅ Bouton expand/collapse "Voir les notes de version"
- ✅ Zone scrollable avec max-height (max 48 lignes)
- ✅ Lien "Toutes les versions" vers GitHub releases
- ✅ Support complet du Markdown : titres (##), gras (**), italique (*), code (`), listes (-)
- ✅ Design cohérent avec le reste de l'UI (bg-white/10, scrollbar custom)

**Fichiers modifiés :**
- `src/components/UpdateNotification.tsx` :
  - Fonction `parseMarkdown()` pour conversion Markdown → HTML
  - État `changelogExpanded` pour expand/collapse
  - Section changelog dans notification "Mise à jour disponible"
  - Bouton "Toutes les versions" avec icône ExternalLink

**Architecture :**
```tsx
// Parser Markdown sans dépendance externe
function parseMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // ... autres règles
}

// Dans UpdateNotification
{hasChangelog && (
  <button onClick={() => setChangelogExpanded(!changelogExpanded)}>
    {changelogExpanded ? <ChevronUp /> : <ChevronDown />}
    {changelogExpanded ? 'Masquer' : 'Voir'} les notes de version
  </button>
  {changelogExpanded && (
    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(releaseNotes) }} />
  )}
)}
```

**Fonctionnalités bonus :**
- 🎨 Design soigné avec Tailwind CSS
- 📱 Responsive et scrollable
- 🔗 Lien cliquable vers GitHub releases
- 🚀 Aucune dépendance npm supplémentaire (parser custom)
- ⚡ Performant (parseMarkdown simple et rapide)

**Notes techniques :**
- electron-updater fournit déjà `releaseNotes` dans UpdateInfo
- Parser custom plus léger que `marked` (12kb vs 50kb)
- Utilise `dangerouslySetInnerHTML` (sécurisé car source GitHub officiel)
- Compatible avec tous les formats de changelog Markdown GitHub

---

### 13. Build multi-plateforme dans CI 🌍
**Statut :** 🔲 TODO
**Priorité :** ⭐ Moyenne
**Estimation :** 2-3h
**Impact :** ⭐⭐⭐⭐

**Description :**
Modifier le workflow GitHub Actions pour builder Windows, macOS et Linux en parallèle.

**Implémentation :**
```yaml
# .github/workflows/release.yml
jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build:electron
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Fichiers concernés :**
- `.github/workflows/release.yml`

**Notes :**
- Retirer `working-directory: smart-todo` (n'existe plus)
- Utiliser `secrets.GITHUB_TOKEN` pour publish
- macOS nécessite certificat pour notarization (optionnel)

---

## 📝 Notes de développement

### Prochaines priorités suggérées (ordre)
1. ✅ **Raccourcis clavier** → Quick win, impact maximal (v2.0.1)
2. ✅ **Notifications desktop** → Feature très demandée (v2.0.1)
3. ✅ **Liens de fichiers et édition notes** → UX améliorée (v2.0.1)
4. ✅ **Error Boundaries** → Sécurité et stabilité (v2.0.1)
5. ✅ **Changelog UpdateNotification** → UX transparente sur les mises à jour (v2.0.1)
6. ✅ **Animations Framer Motion** → Micro-animations professionnelles (v2.0.1)
7. 🔜 **Tests E2E** → Sécurise les releases futures (v2.0.2)
8. 🔜 **Vue Timeline** → Finaliser ce qui est commencé (v2.0.2)

### Versions futures
- **v2.0.1** : ✅ Raccourcis clavier + Notifications desktop + Liens de fichiers + Édition notes rapide + Error Boundaries + Changelog UpdateNotification + Animations Framer Motion (en développement, prête à builder)
- **v2.0.2** : Tests E2E + Vue Timeline (planifiée)
- **v2.0.3** : Tags + Storybook (planifiée)
- **v2.1.0** : Commentaires + Activité (planifiée)
- **v2.2.0** : Thèmes personnalisables + Build multi-plateforme CI (planifiée)

### Dépendances à anticiper
```json
{
  "framer-motion": "^11.x",
  "marked": "^12.x",
  "react-calendar-timeline": "^0.28.x",
  "@playwright/test": "^1.x",
  "storybook": "^8.x"
}
```

---

**Bon développement ! 🚀**
