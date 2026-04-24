# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

To-DoX is an Electron-based desktop Kanban task management application with intelligent visual indicators for priorities and deadlines. The app features automatic updates via GitHub releases and OneDrive synchronization for data persistence with real-time multi-user sync.

**Tech Stack:**
- React 19 with TypeScript (strict mode)
- Zustand for state management
- Vite 7 for build tooling
- Electron 32 for desktop packaging
- Tailwind CSS 3 for styling
- Vitest for testing
- React Compiler (Babel plugin) for optimization

## Development Commands

```bash
# Development
npm run dev              # Start Vite dev server only (web mode)
npm run dev:electron     # Start Vite + Electron in development mode (recommended)

# Build
npm run build            # TypeScript compilation + Vite production build
npm run build:electron   # Build + package with electron-builder

# Platform-specific builds (with GitHub auto-publish)
npm run electron:build:win    # Windows (NSIS installer)
npm run electron:build:mac    # macOS (DMG + ZIP)
npm run electron:build:linux  # Linux (AppImage + DEB)

# Quality
npm run lint             # ESLint check
npm run test             # Run all tests with Vitest
npm run test -- --run    # Run tests once (no watch mode)
npm run test -- --ui     # Run tests with UI interface

# Preview
npm run preview          # Preview production build
```

## Architecture

### State Management (Zustand Store)

The application uses a **centralized Zustand store** located in [src/store/useStore.ts](src/store/useStore.ts). This is the single source of truth for all application state.

**Key State:**
- `tasks: Task[]` - All tasks in the app (including archived)
- `directories: Directories` - Project name → folder path mappings
- `projectHistory: string[]` - Recently used project names (for autocomplete)
- `projectColors: Record<string, number>` - Project → color index mapping
- `users: User[]` - User list (always FIXED_USERS, not stored in data.json)
- `currentUser: string | null` - ID of currently logged-in user (saved in `current_user_id` localStorage key)
- `viewAsUser: string | null` - "View as" filter (transient, not persisted)
- `collapsedProjects: Record<string, boolean>` - UI state for collapsed project cards (keyed as `${status}_${project}`)
- `storagePath: string | null` - OneDrive storage path
- `isLoadingData: boolean` - Loading state flag
- `saveError: string | null` - Last save error message (shown in UI)
- `notificationSettings: NotificationSettings` - Desktop notification configuration
- `themeSettings: ThemeSettings` - Theme system (mode + palette + custom themes)
- `comments: Record<string, Comment[]>` - Task comments, keyed by taskId
- `templates: TaskTemplate[]` - Reusable subtask templates
- `savedReports: SavedReport[]` - Saved weekly/monthly reports (CRs)
- `appNotifications: AppNotification[]` - In-app notifications (review workflow + mentions)
- `timeEntries: TimeEntry[]` - Timesheet entries
- `outlookConfig: OutlookConfig` - Outlook/ICS config for current user (derived from `outlookConfigs`)
- `outlookConfigs: Record<string, OutlookConfig>` - Per-user Outlook configs (persisted)
- `outlookEvents: OutlookEvent[]` - Imported Outlook events (transient, not persisted)
- `highlightedTaskId: string | null` - Task to highlight after notification click (transient)
- `pendingReviewDialogTaskId: string | null` - Reviewer assignment dialog state (transient)

**Store Actions Pattern:**
- Simple setters: `setTasks()`, `setDirectories()`, `setProjectColors()`, `setProjectColor()`, `setUsers()`, `setCurrentUser()`, `setViewAsUser()`, etc.
- Task operations: `addTask()`, `updateTask()`, `removeTask()`, `moveTask()`, `archiveTask()`, `unarchiveTask()`, `reorderTask()`
- Task hierarchy: `setTaskParent()`, `convertSubtaskBack()`
- Subtask operations: `addSubtask()`, `toggleSubtask()`, `deleteSubtask()`, `updateSubtaskTitle()`, `assignSubtask()`, `unassignSubtask()`, `setSubtaskDates()`, `reorderSubtasks()`
- Comment operations: `addComment()`, `deleteComment()`
- Project operations: `addToProjectHistory()`, `toggleProjectCollapse()`, `archiveProject()`, `unarchiveProject()`, `deleteArchivedProject()`, `renameProject()`, `moveProject()`
- Template operations: `addTemplate()`, `deleteTemplate()`, `applyTemplateToTask()`
- Report operations: `saveReport()`, `deleteReport()`
- Review workflow: `setReviewers()`, `validateTask()`, `requestCorrections()`, `reopenTask()`
- Notifications: `addAppNotification()`, `markNotificationRead()`, `markAllNotificationsRead()`, `deleteNotificationForUser()`
- Timesheet: `upsertTimeEntry()`, `deleteTimeEntry()`
- Outlook: `setOutlookConfig()`, `setOutlookConfigs()`, `setOutlookEvents()`
- Theme: `setThemeSettings()`, `updateThemeSettings()`

**CRITICAL RULE:** Always use store actions instead of direct state manipulation. Never call `setTasks()` manually to modify tasks — use specific actions like `updateTask()` which handle side effects (e.g., updating `completedAt` when status changes to "done", updating `updatedAt` timestamps, spawning recurring task clone).

### Data Persistence Layer

The app has **dual persistence**: localStorage (browser) + Electron file system (desktop).

**Persistence is split across 3 specialized hooks** orchestrated by [useDataPersistence.ts](src/hooks/useDataPersistence.ts):

```
useDataPersistence (orchestrator)
  ├── useLoadData     — initial load from localStorage → Electron data.json (merge by updatedAt)
  ├── useSyncPolling  — poll data.json + comments.json every 2s, merge on hash change
  └── usePersistSave  — debounced save (100ms) to localStorage + Electron
```

**Separate persistence files in Electron:**
- `storagePath/data.json` — tasks, configs, templates, reports, timeEntries, outlookConfigs (shared via OneDrive)
- `storagePath/comments.json` — comments only (separate file for performance, soft-delete for sync)
- `localStorage['theme_settings']` — theme per-machine (NOT in data.json, intentionally local)
- `localStorage['current_user_id']` — logged-in user ID (local per-machine)
- `localStorage[STORAGE_KEY]` — full payload mirror for web fallback

**Sync strategy (multi-user via shared OneDrive):**
- On load: `mergeTasksByUpdatedAt(localTasks, fileTasks)` — most-recent `updatedAt` wins
- Poll every 2s: hash comparison via `getFileHash()` — only re-read if file changed
- Comments: soft-delete merge — local deletion wins over file's non-deleted version
- TimeEntries: union by `id`, most-recent `updatedAt` wins
- Theme is never synced (per-machine preference)

**Default Storage Path:** `~/OneDrive - CEA/DATA/To-Do-X/` (user-configurable via Settings)

### Component Architecture

**Main Component:** [ToDoX.tsx](src/ToDoX.tsx) - The primary orchestrator
- Manages all modal/panel visibility state
- Uses `useFilters` hook for filtering and grouping logic
- Uses `useDragAndDrop` hook for drag & drop operations
- Handles import/export functionality
- Renders the main Kanban board

**Kanban Rendering Pattern:**
```
STATUSES.map(status) →
  Column →
    grouped[status].map(project) →
      ProjectCard (collapsible) →
        tasks.map(task) →
          TaskCard
```

**Critical UI Components:**
- `KanbanBoard` - Main Kanban grid with drag & drop zones
- `KanbanHeaderPremium` - Top header with filters, search, and action buttons (burger menu on mobile)
- `ProjectCard` - Groups tasks by project within each status column (collapsible)
- `TaskCard` - Individual task display with drag support, priority badges, deadline indicators; Valider/Corrections review buttons
- `QuickAddPremium` - Inline task creation form in header with autocomplete
- `ActiveProjectsBar` - Project statistics with progress bars
- `TaskEditPanel` - Right-click context menu for editing tasks; Réviseurs field + revision history
- `TitleBar` - Custom title bar with window controls + notification bell badge + `NotificationDropdown`
- `UpdateNotification` - Auto-update notification UI
- `TermineesView` - Completed tasks view with Rouvrir/Archiver actions (toggled from header)
- `DashboardView` - Dashboard analytics view
- `TimesheetView` - Timesheet view (pointage d'heures par projet/jour)
- `TimelineView` - Gantt timeline view (list on mobile, Gantt chart on desktop)
- `NotificationDropdown` - App notification dropdown (rendered via portal)

**Modal/Panel Components:**
- `WeeklyReportModal` - Weekly/monthly completion report with PDF export (saved as `SavedReport`)
- `ProjectArchivePanel` - Archived projects management
- `TaskArchivePanel` - Archived tasks management
- `ProjectDirs` - Configure project folder paths
- `ProjectsListPanel` - Project management and color assignment
- `UsersPanel` - User management
- `StoragePanel` - Storage location configuration
- `ConfirmModalHost` - Global confirmation modal system
- `ShortcutsHelpPanel` - Keyboard shortcuts reference panel

### Electron Integration

**IPC Communication Pattern:**
- [electron.js](electron.js) defines IPC handlers via `ipcMain.handle()`
- [preload.js](preload.js) exposes safe API to renderer via `contextBridge`
- React components access via `window.electronAPI`

**Available APIs:**
- **File system:** `readData()`, `saveData()`, `getStoragePath()`, `chooseStorageFolder()`, `getFileHash()`
- **Folder operations:** `openFolder()`, `selectProjectFolder()`
- **Window controls:** `windowMinimize()`, `windowMaximize()`, `windowClose()`, `windowIsMaximized()`
- **Updates:** `checkForUpdates()`, `downloadUpdate()`, `installUpdate()`, `getAppVersion()`
- **Print:** `printHtml()` - Creates hidden window for native print dialog
- **Theme:** `setNativeTheme()`, `getSystemTheme()`, `onSystemThemeChanged()`
- **Notifications:** `sendNotification()`, `requestNotificationPermission()`, `getSoundUrl()`
- **Startup:** `getLoginItem()`, `setLoginItem()`
- **Outlook/ICS:** `outlook.fetchUrl()`, `outlook.writeIcs()`, `outlook.getIcsPath()`, `outlook.startHttpServer()`, `outlook.stopHttpServer()`, `outlook.getServerUrl()`, `outlook.saveDroppedMail()`
- **Cast (Chromecast):** `castDiscover()`, `castLaunch()`, `castGetReceiverUrl()`
- **Error logging:** `logError()` - writes to local log file

**Auto-Update Flow:**
1. Check on app start (3s delay)
2. Emit `update-available` event to renderer
3. User clicks "Download" → `downloadUpdate()`
4. Progress tracked via `download-progress` event
5. On complete → `update-downloaded` event
6. User clicks "Install" → `installUpdate()` (quits and installs)

### Custom Hooks

**[useDataPersistence.ts](src/hooks/useDataPersistence.ts)** - Persistence orchestrator
- Calls `useStore()` FIRST (before `useRef`) to maintain stable hook order
- Delegates to three sub-hooks in `src/hooks/persistence/`

**[src/hooks/persistence/](src/hooks/persistence/)** - Persistence sub-hooks
- `useLoadData` - Initial load: localStorage → migration → Electron data.json merge
- `useSyncPolling` - Auto-reload: polls data.json + comments.json every 2s via hash comparison
- `usePersistSave` - Auto-save: localStorage immediately, Electron debounced 100ms
- `persistence.utils.ts` - Shared: `mergeComments()`, `migrateTemplate()`, `PersistenceRefs` type

**[useFilters.ts](src/hooks/useFilters.ts)** - Filtering and grouping logic
- Manages filter state (project, status, priority, user, search)
- Computes `filteredTasks` based on all active filters
- Computes `grouped` object (tasks grouped by status → project)

**[useDragAndDrop.ts](src/hooks/useDragAndDrop.ts)** - Drag & drop logic
- Handles task drag & drop between columns
- Handles entire project drag & drop
- Uses refs for data storage (DataTransfer API is unreliable)

**[useAutoUpdater.ts](src/hooks/useAutoUpdater.ts)** - Electron update management
- Listens to update events from main process
- Manages update UI state
- Provides manual check for updates

### TypeScript Strict Mode

**Key Type Definitions ([src/types.ts](src/types.ts)):**
- `Task` - Main task interface; includes `subtasks`, `ganttDays`, `order`, `recurrence`, `parentTaskId`, `reviewers`, review timestamps
- `TaskData` - DTO for creating new tasks (partial fields)
- `Subtask` - Subtask with completion, assignment, and date range (for Gantt)
- `GanttDay` - Planned work day with assigned users
- `Recurrence` - Recurring task config (`daily | weekly | monthly`, optional `endsAt`)
- `User` - User with id, name, email
- `StoredData` - Top-level persistence shape
- `ElectronAPI` - Complete Electron bridge type definition
- `Directories` - Type alias for `Record<string, string>`
- `ProjectStats` - Project statistics for progress display
- `ArchivedProject` - Archived project metadata
- `Comment` - Task comment with soft-delete (`deletedAt: number | null`)
- `TaskTemplate` - Reusable subtask list template
- `SavedReport` - Saved weekly/monthly report with period metadata
- `AppNotification` / `AppNotifType` - In-app notification for review workflow and @mentions
- `TimeEntry` - Timesheet entry (project, date, hours, userId, updatedAt for sync)
- `OutlookConfig` / `OutlookEvent` - Outlook/ICS integration config and imported events
- `ThemeMode` / `ThemePalette` / `Theme` / `ThemeSettings` - Full theme system types
- `CastDevice` - Chromecast device info
- `ErrorLog` - Error report structure for `logError()`

**Strict Rules:**
- No `any` types (use proper generics)
- All store setters are stable (no need for exhaustive-deps in effects)
- Use type guards for conditional logic
- Status values: `'todo' | 'doing' | 'review' | 'done'`
- Priority values: `'low' | 'med' | 'high'`

### Component Patterns

**Autocomplete Generic Pattern:**
```tsx
<Autocomplete<SourceType, ValueType>
  value={currentValue}
  onChange={(val: ValueType) => setter(val)}
  options={sourceArray}
  getValue={(item: SourceType) => item.id}
  getLabel={(item: SourceType) => item.name}
/>
```

**Modal Pattern:**
All modals use React portals via `createPortal()` for proper z-index stacking. They render into `document.body`.

**Drag & Drop Pattern:**
Uses `useRef` to store drag data instead of DataTransfer API:
```typescript
const dragDataRef = useRef<{ type: 'task' | 'project', ... }>();
// Store data on dragStart
// Read data on drop
// Clear on drop complete
```

**Confirm Modal Pattern:**
Uses a global confirm modal system with promises:
```typescript
import { confirmModal, alertModal } from './utils/confirm';

const confirmed = await confirmModal("Supprimer cette tâche ?");
if (confirmed) { /* proceed */ }
await alertModal("Tâche supprimée !");
```

## Testing Strategy

**Test Files:**
- `utils.test.ts` - Pure utility functions
- `useStore.test.ts` - Zustand store integration tests
- `TaskCard.test.tsx` - Component rendering tests

**Running Specific Tests:**
```bash
npm run test -- utils.test.ts              # Single file
npm run test -- --grep "businessDayDelta"  # Pattern match
```

## Build & Deployment

### Production Build Output

- `dist/` - Vite production build (HTML, JS, CSS)
- `release/` - Electron packaged apps (platform-specific installers)

### electron-builder Configuration

Located in `package.json` under `build` key:

- **Windows:** NSIS installer with custom install directory option, x64 only
- **macOS:** DMG + ZIP for both x64 (Intel) and arm64 (Apple Silicon)
- **Linux:** AppImage + DEB for x64

**Auto-publish:** Set `publish.provider: "github"` in package.json. On build, electron-builder automatically uploads to GitHub Releases.

### GitHub Actions Workflow

**Important:** The [.github/workflows/release.yml](.github/workflows/release.yml) file references `working-directory: smart-todo`, but the actual project root is the current directory (To-DoX). This is a legacy configuration that should be updated if the workflow fails.

**Current workflow:**
- Trigger: Push tags matching `v*.*.*`
- Runs on: `windows-latest`
- Steps: Checkout → Setup Node 20 → Install deps → Build Windows

**For multi-platform releases:** The workflow currently only builds for Windows. To build for all platforms, add a matrix strategy (see [OPTIMISATIONS.md](OPTIMISATIONS.md)).

### Release Process

**Complete deployment steps (see [DEPLOIEMENT.md](DEPLOIEMENT.md)):**

1. Update version in `package.json` (follow SemVer)
2. Commit the version change: `git commit -m "chore: bump version to X.Y.Z"`
3. Commit any code changes
4. Create and push tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"` then `git push origin main && git push origin vX.Y.Z`
5. GitHub Actions workflow builds and publishes automatically
6. Release appears on GitHub Releases with installers

**CRITICAL:** Always prefix tags with `v` (e.g., `v1.8.16`, not `1.8.16`)

## Common Pitfalls

1. **Don't bypass store actions** - Always use `updateTask()`, never `setTasks(tasks.map(...))`
2. **Drag & drop must use refs** - DataTransfer doesn't work reliably across components
3. **Project names are UPPERCASE** - Convention enforced in `addTask()`
4. **Collapsed state keys** - Format is `${status}_${project}`, not just project name
5. **completedAt auto-update** - Handled by `updateTask()` when status → "done"
6. **OneDrive path hardcoded** - Default is `~/OneDrive - CEA/DATA/To-Do-X` but user can override in settings
7. **Working directory mismatch** - GitHub workflow references `smart-todo` but actual root is `To-DoX`
8. **Tag prefix required** - GitHub release workflow only triggers on tags starting with `v`
9. **Hidden elements still intercept clicks** - `overflow-visible` + `max-h-0 opacity-0` hides content visually but keeps it clickable. Always add `pointer-events-none` when hiding via `opacity-0`.
10. **CSS class `bg-theme-bg-secondary` does not exist** - Valid theme classes: `bg-theme-primary`, `bg-theme-secondary`, `bg-theme-tertiary`
11. **Theme is NOT synced via data.json** - `themeSettings` is saved in `localStorage['theme_settings']` only (per-machine). Never include it in the Electron save payload.
12. **Hook order in useDataPersistence** - `useStore()` must be called BEFORE `useRef` calls to maintain stable hook order (HMR compatibility).
13. **Comments are in comments.json, not data.json** - In Electron mode, comments live in a separate file. The `data.json` save payload explicitly excludes `comments`.
14. **outlookConfig vs outlookConfigs** - `outlookConfig` is the current user's config (derived, not persisted directly). `outlookConfigs` is the full per-user map that gets saved.

### Review Workflow

`status: 'review'` tasks are shown in the Kanban. Tasks with `status: 'done'` are **not** shown in the Kanban — they appear in `TermineesView` instead (controlled by `kanban: boolean` on `StatusDef` in `constants.ts`).

Review store actions auto-generate `AppNotification` entries and update task timestamps. `validateTask()` sets status → `'done'`, `requestCorrections()` sets status → `'doing'`, `reopenTask()` sets status → `'todo'`.

### Task Recurrence

When `updateTask()` transitions a task with `recurrence` to `status: 'done'`, it automatically creates a new `Task` clone with the next occurrence date, `status: 'todo'`, and all subtasks reset to `completed: false`.

### Task Hierarchy

Tasks can have a `parentTaskId` linking them to a parent task. `convertSubtaskBack()` converts a task back into a subtask on its parent. `setTaskParent()` sets or clears the parent link.

### Custom Event: `todox:openTask`

`TitleBar` dispatches `window.dispatchEvent(new CustomEvent('todox:openTask', { detail: { taskId } }))` when a notification is clicked. `ToDoX.tsx` listens for this event to open the `TaskEditPanel` for the corresponding task.

### Mobile Responsive Patterns

- Breakpoint: `md:` (768px). Pattern: `md:hidden` / `hidden md:flex`
- `KanbanBoard`: mobile tabs + single active column (`activeMobileTab` state)
- `TimelineView`: list view on mobile (`md:hidden`), Gantt on desktop (`hidden md:flex`)

## Code Style

- Use named exports for components (`export function ComponentName`)
- Tailwind utility classes for all styling (no CSS modules)
- Keep components under 300 lines - extract if larger
- Prefix event handlers with `handle` (e.g., `handleDragStart`)
- Use `useMemo` for expensive computations (filtering, grouping)
- Comment complex business logic (e.g., business day calculations, date formatting)
- Use React Compiler-compatible patterns (avoid manual memoization where possible)

## Project-Specific Notes

- **CEA-specific:** Default OneDrive path includes "OneDrive - CEA" which is organization-specific
- **French language:** UI is in French, keep all user-facing text in French
- **Icons:** Icon files are in [src/assets/](src/assets/) - PNG for macOS/Linux, ICO for Windows
- **Theme system:** Theme mode is dynamic (light/dark/auto). `setNativeTheme()` is called on theme change. Dark mode is no longer forced — `nativeTheme.themeSource` follows user's `ThemeSettings.mode`.
- **Custom title bar:** Uses frameless window with custom controls in TitleBar component
- **FIXED_USERS** in `src/constants.ts` is a hardcoded list — not stored in `data.json` and not editable via the UI. `users` in the store is always initialized from this constant.
