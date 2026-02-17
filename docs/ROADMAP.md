# 🗺️ Roadmap To-DoX

Document de suivi des améliorations et évolutions de l'application To-DoX.

**Dernière mise à jour :** 17 février 2026
**Version actuelle :** 2.0.2
**Prochaine version :** 2.0.3 (planifiée)

---

## 📊 Vue d'ensemble

| Catégorie | Total | TODO | En cours | Terminé |
|-----------|-------|------|----------|---------|
| 🎯 Prioritaires | 3 | 0 | 0 | 3 |
| 🚀 Techniques | 2 | 0 | 0 | 2 |
| 🌟 UX/Polish | 3 | 1 | 0 | 2 |
| 🔧 Quick Wins | 2 | 0 | 0 | 2 |
| **TOTAL** | **10** | **1** | **0** | **9** |

> **Timeline :** implémentée (vue 4 semaines/mois, navigation libre, carte au clic) mais non encore marquée TERMINÉ dans la liste ci-dessous — en attente de validation.

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

### 4. Storybook pour UI Components 📚
**Statut :** ✅ TERMINÉ (17 février 2026)
**Priorité :** ⭐ Moyenne
**Estimation :** 6-8h → **Réalisé en ~3h**
**Impact :** ⭐⭐⭐⭐

**Description :**
Documentation visuelle des composants UI avec Storybook 10 + Vite.

**Commandes :**
```bash
npm run storybook         # Dev server (port 6006)
npm run build-storybook   # Build statique → storybook-static/
```

**Stories créées (21 fichiers, ~60 stories) :**
- ✅ `TaskCard.stories.tsx` : 6 états (todo, doing+deadline, stagnante, review en retard, done, priorité basse)
- ✅ `ProjectCard.stories.tsx` : 5 variantes (déplié, replié, doing, review, vide)
- ✅ `Modal.stories.tsx` : 5 variantes (avec titre, large, sans titre, scrollable, fermée)
- ✅ `Autocomplete.stories.tsx` : 3 cas (objets, chaînes, vide)
- ✅ `QuickAddPremium.stories.tsx` : vue par défaut
- ✅ `CircularProgressBadge.stories.tsx` : 5 états (0%, 33%, 75%, 100%, sélectionné)
- ✅ `DatePickerModal.stories.tsx` : 2 variantes
- ✅ `DropdownMenu.stories.tsx` : 3 variantes (settings, actions, items seuls)
- ✅ `SearchInput.stories.tsx` : 2 variantes + focus programmatique
- ✅ `ProjectAutocomplete.stories.tsx` : 4 variantes
- ✅ `SubtaskList.stories.tsx` : 4 états (1/3, 2/2, 0/4, sans sous-tâches)
- ✅ `TaskEditPanel.stories.tsx` : 5 états de tâche
- ✅ `ShortcutsHelpPanel.stories.tsx` : panel complet + version allégée
- ✅ `ErrorScreen.stories.tsx` : avec erreur, sans nom boundary, null
- ✅ `GlassModal.stories.tsx` : GlassModal (sm/md/lg), GlassPanel (4 glows), GlassCard
- ✅ `LoginModal.stories.tsx` : sélection utilisateur
- ✅ `UserProfile.stories.tsx` : 3 états (connecté, non connecté, autre user)
- ✅ `WeeklyReportModal.stories.tsx` : 3 états (avec tâches, vide, sans user)
- ✅ `UpdateNotification.stories.tsx` : 3 états (pas de MAJ, MAJ dispo, téléchargée)
- ✅ `Settings.stories.tsx` : 7 panneaux (Notifications, ProjectDirs, ProjectsList, Storage×2, Themes, Users)
- ✅ `Archive.stories.tsx` : 4 cas (tâches archivées, vide, projets archivés, vide)

**Fichiers créés :**
- `.storybook/main.ts` : Config framework `@storybook/react-vite`, viteFinal pour override `base`
- `.storybook/preview.ts` : Mock `window.electronAPI`, seed Zustand store, import CSS
- `src/stories/mockData.ts` : 6 tâches de démo couvrant tous les cas visuels
- `src/stories/*.stories.tsx` : 5 fichiers de stories

**Architecture :**
- Mock `window.electronAPI` global dans `preview.ts` (toutes les méthodes sont des no-ops)
- Store Zustand seedé via `useStore.setState()` dans un décorateur global
- `index.css` importé → Tailwind + CSS variables du thème Cyberpunk Dark actives
- `base: '/'` overridé dans `viteFinal` (le projet utilise `'./'` pour Electron)

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

### 8. Commentaires et historique d'activité 💬
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

### 11. Changelog intégré dans UpdateNotification 📝
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
**Statut :** ✅ TERMINÉ (17 février 2026)
**Priorité :** ⭐ Moyenne
**Estimation :** 2-3h → **Réalisé en 15min**
**Impact :** ⭐⭐⭐⭐

**Description :**
Workflow GitHub Actions pour builder Windows, macOS et Linux en parallèle sur push de tag `v*`.

**Implémentation :**
```yaml
# .github/workflows/release.yml
jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest, script: electron:build:win
          - os: macos-latest, script: electron:build:mac
          - os: ubuntu-latest, script: electron:build:linux
    runs-on: ${{ matrix.os }}
    defaults:
      run:
        working-directory: To-DoX
    steps:
      - actions/checkout@v4
      - actions/setup-node@v4 (node 20, cache npm)
      - npm ci
      - npm run ${{ matrix.script }}
        env: GH_TOKEN, CSC_IDENTITY_AUTO_DISCOVERY: false
```

**Fichiers créés :**
- `.github/workflows/release.yml`

**Artifacts produits :**
- Windows : installeur NSIS x64
- macOS : DMG + ZIP (x64 + arm64)
- Linux : AppImage + DEB (x64)

**Notes :**
- `fail-fast: false` : les 3 OS buildent indépendamment
- `CSC_IDENTITY_AUTO_DISCOVERY: false` : skip code signing macOS (pas de certificat Apple)
- `permissions: contents: write` requis pour publier sur GitHub Releases
- `working-directory: To-DoX` car le projet est dans un sous-dossier du dépôt

---

## 📝 Notes de développement

### Prochaines priorités suggérées (ordre)
1. ✅ **Raccourcis clavier** → Quick win, impact maximal (v2.0.1)
2. ✅ **Notifications desktop** → Feature très demandée (v2.0.1)
3. ✅ **Liens de fichiers et édition notes** → UX améliorée (v2.0.1)
4. ✅ **Error Boundaries** → Sécurité et stabilité (v2.0.1)
5. ✅ **Changelog UpdateNotification** → UX transparente sur les mises à jour (v2.0.1)
6. ✅ **Animations Framer Motion** → Micro-animations professionnelles (v2.0.1)
7. 🔜 **Storybook** → Documentation visuelle des composants (v2.0.3)
8. 🔜 **Vue Timeline** → Finaliser ce qui est commencé (v2.0.3)

### Versions futures
- **v2.0.1** : ✅ Raccourcis clavier + Notifications desktop + Liens de fichiers + Édition notes rapide + Error Boundaries + Changelog UpdateNotification + Animations Framer Motion
- **v2.0.2** : ✅ En cours
- **v2.0.3** : Storybook + Vue Timeline (planifiée)
- **v2.1.0** : Commentaires + Activité (planifiée)
- **v2.2.0** : ✅ Build multi-plateforme CI

### Dépendances à anticiper
```json
{
  "framer-motion": "^11.x",
  "react-calendar-timeline": "^0.28.x",
  "storybook": "^8.x"
}
```

---

**Bon développement ! 🚀**
