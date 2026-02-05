# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

To-DoX is an Electron-based desktop Kanban task management application with intelligent visual indicators for priorities and deadlines. The app features automatic updates via GitHub releases and OneDrive synchronization for data persistence.

**Tech Stack:**
- React 19 with TypeScript (strict mode)
- Zustand for state management
- Vite 7 for build tooling
- Electron 39 for desktop packaging
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
- `users: User[]` - User list for task assignment
- `collapsedProjects: Record<string, boolean>` - UI state for collapsed project cards (keyed as `${status}_${project}`)
- `storagePath: string | null` - OneDrive storage path
- `isLoadingData: boolean` - Loading state flag

**Store Actions Pattern:**
- Simple setters: `setTasks()`, `setDirectories()`, `setProjectColors()`, `setProjectColor()`, `setUsers()`, etc.
- Task operations: `addTask()`, `updateTask()`, `removeTask()`, `moveTask()`, `archiveTask()`, `unarchiveTask()`
- Subtask operations: `addSubtask()`, `toggleSubtask()`, `deleteSubtask()`, `updateSubtaskTitle()`, `reorderSubtasks()`
- Project operations: `addToProjectHistory()`, `toggleProjectCollapse()`, `archiveProject()`, `unarchiveProject()`, `deleteArchivedProject()`

**CRITICAL RULE:** Always use store actions instead of direct state manipulation. Never call `setTasks()` manually to modify tasks - use specific actions like `updateTask()` which handle side effects (e.g., updating `completedAt` when status changes to "done", updating `updatedAt` timestamps).

### Data Persistence Layer

The app has **dual persistence**: localStorage (browser) + Electron file system (desktop).

**Persistence Flow:**

The [useDataPersistence](src/hooks/useDataPersistence.ts) hook manages all persistence:

1. **Initial Load** (on mount):
   - Try localStorage first (web compatibility)
   - If Electron, read from `storagePath/data.json`
   - Migrate old data if needed (add `subtasks`, `archived`, `completedAt`, etc.)
   - Restore `collapsedProjects` state from localStorage

2. **Auto-Save** (on state change):
   - Debounced save on every state change (1 second delay)
   - Save to localStorage immediately
   - If Electron, save to `storagePath/data.json` with automatic backups
   - Backups keep 5 most recent timestamped files in `backups/` subdirectory

**Default Storage Path:** `~/OneDrive - CEA/DATA/To-Do-X/data.json` (user-configurable via Settings)

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
- `KanbanHeaderPremium` - Top header with filters, search, and action buttons
- `ProjectCard` - Groups tasks by project within each status column (collapsible)
- `TaskCard` - Individual task display with drag support, priority badges, deadline indicators
- `QuickAddPremium` - Inline task creation form in header with autocomplete
- `ActiveProjectsBar` - Project statistics with progress bars
- `TaskEditPanel` - Right-click context menu for editing tasks
- `TitleBar` - Custom title bar with window controls (minimize, maximize, close)
- `UpdateNotification` - Auto-update notification UI

**Modal/Panel Components:**
- `WeeklyReportModal` - Weekly completion report with PDF export
- `ProjectArchivePanel` - Archived projects management
- `TaskArchivePanel` - Archived tasks management
- `ProjectDirs` - Configure project folder paths
- `ProjectsListPanel` - Project management and color assignment
- `UsersPanel` - User management
- `StoragePanel` - Storage location configuration
- `ConfirmModalHost` - Global confirmation modal system

### Electron Integration

**IPC Communication Pattern:**
- [electron.js](electron.js) defines IPC handlers via `ipcMain.handle()`
- [preload.js](preload.js) exposes safe API to renderer via `contextBridge`
- React components access via `window.electronAPI`

**Available APIs:**
- **File system:** `readData()`, `saveData()`, `getStoragePath()`, `chooseStorageFolder()`
- **Folder operations:** `openFolder()`, `selectProjectFolder()`
- **Window controls:** `windowMinimize()`, `windowMaximize()`, `windowClose()`, `windowIsMaximized()`
- **Updates:** `checkForUpdates()`, `downloadUpdate()`, `installUpdate()`, `getAppVersion()`
- **Print:** `printHtml()` - Creates hidden window for native print dialog

**Auto-Update Flow:**
1. Check on app start (3s delay)
2. Emit `update-available` event to renderer
3. User clicks "Download" → `downloadUpdate()`
4. Progress tracked via `download-progress` event
5. On complete → `update-downloaded` event
6. User clicks "Install" → `installUpdate()` (quits and installs)

### Custom Hooks

**[useFilters.ts](src/hooks/useFilters.ts)** - Filtering and grouping logic
- Manages filter state (project, status, priority, user, search)
- Computes `filteredTasks` based on all active filters
- Computes `grouped` object (tasks grouped by status → project)

**[useDataPersistence.ts](src/hooks/useDataPersistence.ts)** - Data loading and saving
- Initial load from localStorage and Electron file system
- Auto-save with debouncing
- Data migration for old formats

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
- `Task` - Main task interface with subtasks, timestamps, archive state
- `TaskData` - DTO for creating new tasks (partial fields)
- `Subtask` - Subtask with completion state
- `User` - User with id, name, email
- `StoredData` - Top-level persistence shape
- `ElectronAPI` - Complete Electron bridge type definition
- `Directories` - Type alias for `Record<string, string>`
- `ProjectStats` - Project statistics for progress display
- `ArchivedProject` - Archived project metadata

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

// Confirmation dialog
const confirmed = await confirmModal("Delete this task?");
if (confirmed) {
  // proceed
}

// Alert dialog
await alertModal("Task deleted!");
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
- **Dark mode:** Forced dark theme via `nativeTheme.themeSource = 'dark'` in electron.js
- **Custom title bar:** Uses frameless window with custom controls in TitleBar component
