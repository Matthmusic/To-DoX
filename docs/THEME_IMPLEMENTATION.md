# 🎨 Suivi d'Implémentation - Système de Thèmes Personnalisables

**Date de début :** 12 février 2026
**Estimation :** 6-8h
**Version cible :** 2.0.2

---

## 📋 Vue d'ensemble

Implémentation d'un système complet de thèmes personnalisables avec :
- ✅ Choix du mode : light / dark / auto (suit le système)
- ✅ 5 thèmes prédéfinis (Cyberpunk, Ocean, Forest, Sunset, Light Minimal)
- ✅ Couleur d'accent personnalisable
- ✅ Persistence des préférences

---

## 🚀 Progression

| Étape | Statut | Temps estimé | Temps réel | Fichiers |
|-------|--------|--------------|------------|----------|
| **1. Infrastructure de base** | 🔄 En cours | 2-3h | - | 5 fichiers |
| **2. Hook et logique** | ⏳ À faire | 1-2h | - | 3 fichiers |
| **3. Composant UI** | ⏳ À faire | 2h | - | 2 fichiers |
| **4. Persistence** | ⏳ À faire | 1h | - | 1 fichier |

**Total : 0% complété**

---

## 📝 Étape 1 : Infrastructure de base (2-3h)

### Tâches

- [ ] **1.1 - Types TypeScript** (`src/types.ts`)
  - [ ] Ajouter `ThemeMode` type
  - [ ] Ajouter `ThemePalette` interface
  - [ ] Ajouter `Theme` interface
  - [ ] Ajouter `ThemeSettings` interface
  - [ ] Étendre `StoredData` avec `themeSettings?`
  - [ ] Étendre `ElectronAPI` avec les 3 nouvelles méthodes

- [ ] **1.2 - Thèmes prédéfinis** (`src/themes/presets.ts` - nouveau)
  - [ ] Créer le dossier `src/themes/`
  - [ ] Définir `CYBERPUNK_DARK` (thème actuel)
  - [ ] Définir `OCEAN_DARK`
  - [ ] Définir `FOREST_DARK`
  - [ ] Définir `SUNSET_DARK`
  - [ ] Définir `LIGHT_MINIMAL`
  - [ ] Exporter `PRESET_THEMES` array
  - [ ] Exporter `DEFAULT_THEME` constant

- [ ] **1.3 - Store Zustand** (`src/store/useStore.ts`)
  - [ ] Importer `DEFAULT_THEME` from presets
  - [ ] Ajouter `themeSettings: ThemeSettings` dans `StoreState` interface
  - [ ] Ajouter `setThemeSettings` setter
  - [ ] Ajouter `updateThemeSettings` updater
  - [ ] Initialiser state avec valeurs par défaut

- [ ] **1.4 - Variables CSS** (`src/index.css`)
  - [ ] Ajouter les 13 variables CSS dans `:root`
  - [ ] Modifier `body` pour utiliser `var(--bg-primary)` etc.
  - [ ] Ajouter classe `.theme-transitioning`
  - [ ] Ajouter classes utilitaires (`.bg-theme-primary`, etc.)

- [ ] **1.5 - Config Tailwind** (`tailwind.config.cjs`)
  - [ ] Étendre `theme.extend.colors` avec objet `theme`
  - [ ] Ajouter `theme.primary`, `theme.secondary`
  - [ ] Ajouter `theme.bg.*`, `theme.text.*`, `theme.border.*`

**Vérification Étape 1 :** ✅ Compilation TypeScript sans erreur

---

## 📝 Étape 2 : Hook et logique (1-2h)

### Tâches

- [ ] **2.1 - Hook useTheme** (`src/hooks/useTheme.ts` - nouveau)
  - [ ] Créer fonction `getActiveTheme()`
  - [ ] Créer fonction `getEffectiveMode()`
  - [ ] Créer fonction `applyTheme()`
  - [ ] Créer fonction `setMode()`
  - [ ] Créer fonction `setActiveTheme()`
  - [ ] Créer fonction `setCustomAccent()`
  - [ ] Créer fonction `addCustomTheme()`
  - [ ] Créer fonction `removeCustomTheme()`
  - [ ] Ajouter `useEffect` pour appliquer thème au montage
  - [ ] Ajouter `useEffect` pour écouter changements système (mode auto)

- [ ] **2.2 - Electron IPC** (`electron.js`)
  - [ ] Retirer ligne 53 : `nativeTheme.themeSource = 'dark';`
  - [ ] Ajouter handler `set-native-theme`
  - [ ] Ajouter handler `get-system-theme`
  - [ ] Ajouter listener `nativeTheme.on('updated')`

- [ ] **2.3 - Preload API** (`preload.js`)
  - [ ] Exposer `setNativeTheme` IPC
  - [ ] Exposer `getSystemTheme` IPC
  - [ ] Exposer `onSystemThemeChanged` listener

**Vérification Étape 2 :** ✅ Appliquer manuellement un thème via console

---

## 📝 Étape 3 : Composant UI (2h)

### Tâches

- [ ] **3.1 - ThemePanel** (`src/components/settings/ThemePanel.tsx` - nouveau)
  - [ ] Créer composant principal avec Portal
  - [ ] Section Mode (3 boutons Light/Dark/Auto)
  - [ ] Section Thèmes Sombres (grid de cartes)
  - [ ] Section Thèmes Clairs (grid de cartes)
  - [ ] Section Couleur d'accent custom (color picker)
  - [ ] Créer sous-composant `ThemeCard`

- [ ] **3.2 - Intégration Header** (`src/components/KanbanHeaderPremium.tsx`)
  - [ ] Ajouter state `showThemePanel`
  - [ ] Ajouter bouton "Thèmes" avec icône `Palette`
  - [ ] Render conditionnel de `ThemePanel`

- [ ] **3.3 - Appel du hook** (`src/ToDoX.tsx`)
  - [ ] Importer `useTheme`
  - [ ] Appeler `useTheme()` au début du composant

**Vérification Étape 3 :** ✅ Ouvrir panel, changer thème, voir couleurs changer en temps réel

---

## 📝 Étape 4 : Persistence (1h)

### Tâches

- [ ] **4.1 - useDataPersistence** (`src/hooks/useDataPersistence.ts`)
  - [ ] Ajouter `themeSettings` dans destructuring du store
  - [ ] Ajouter `setThemeSettings` dans destructuring
  - [ ] Charger `themeSettings` depuis localStorage (ligne ~80)
  - [ ] Charger `themeSettings` depuis Electron file (ligne ~130)
  - [ ] Inclure `themeSettings` dans payload de sauvegarde (ligne ~200)

**Vérification Étape 4 :** ✅ Changer thème, fermer app, rouvrir → thème conservé

---

## 🧪 Tests End-to-End

### Test 1 : Changement de mode ⏳
- [ ] Ouvrir l'app
- [ ] Cliquer sur "Thèmes"
- [ ] Changer mode (Light/Dark/Auto)
- [ ] ✅ Thème change instantanément

### Test 2 : Sélection de thème prédéfini ⏳
- [ ] Dans panel Thèmes
- [ ] Cliquer sur "Ocean Deep"
- [ ] ✅ Couleurs changent (fond bleu, accents bleu/teal)

### Test 3 : Couleur d'accent custom ⏳
- [ ] Section "Couleur d'accent personnalisée"
- [ ] Choisir couleur rouge (#ff0000)
- [ ] Cliquer "Appliquer"
- [ ] ✅ Couleur primaire change (badges, boutons, bordures)

### Test 4 : Persistence ⏳
- [ ] Changer vers "Forest Night"
- [ ] Définir accent custom (#00ff00)
- [ ] Fermer app
- [ ] Rouvrir app
- [ ] ✅ Thème Forest et couleur custom conservés

### Test 5 : Mode Auto ⏳
- [ ] Mettre mode sur "Auto"
- [ ] Changer thème système Windows (Dark ↔ Light)
- [ ] ✅ App détecte et applique le bon thème

---

## 📊 Statistiques

**Fichiers créés :** 0/3
- `src/themes/presets.ts`
- `src/hooks/useTheme.ts`
- `src/components/settings/ThemePanel.tsx`

**Fichiers modifiés :** 0/6
- `src/types.ts`
- `src/store/useStore.ts`
- `src/index.css`
- `tailwind.config.cjs`
- `electron.js`
- `preload.js`
- `src/hooks/useDataPersistence.ts`
- `src/ToDoX.tsx`
- `src/components/KanbanHeaderPremium.tsx`

**Lignes de code ajoutées :** ~0 / ~800 estimées

---

## 🐛 Problèmes rencontrés

_Aucun pour le moment_

---

## 📚 Ressources

- **Plan complet :** `C:\Users\Matthieu MAUREL\.claude\plans\sunny-sauteeing-yeti.md`
- **Roadmap principale :** `docs/ROADMAP.md` (section 11)
- **Documentation Electron nativeTheme :** https://www.electronjs.org/docs/latest/api/native-theme

---

**Dernière mise à jour :** 12 février 2026 - Début de l'implémentation
