# 🛡️ Guide d'implémentation des Error Boundaries

Guide complet pour implémenter un système d'Error Boundaries dans vos applications React/Electron.

**Dernière mise à jour :** 12 février 2026
**Testé avec :** React 18+, Electron 33+, TypeScript 5+

---

## 📋 Table des matières

1. [Qu'est-ce qu'un Error Boundary ?](#quest-ce-quun-error-boundary)
2. [Pourquoi les utiliser ?](#pourquoi-les-utiliser)
3. [Architecture du système](#architecture-du-système)
4. [Implémentation étape par étape](#implémentation-étape-par-étape)
5. [Code à copier](#code-à-copier)
6. [Intégration dans votre app](#intégration-dans-votre-app)
7. [Bonnes pratiques](#bonnes-pratiques)
8. [Dépannage](#dépannage)

---

## Qu'est-ce qu'un Error Boundary ?

Un **Error Boundary** est un composant React qui capture les erreurs JavaScript dans son arbre de composants enfants, les enregistre, et affiche une interface de secours au lieu de planter toute l'application.

### Ce qu'il capture ✅

- Erreurs dans le rendu des composants
- Erreurs dans les méthodes lifecycle
- Erreurs dans les constructeurs de composants enfants
- Erreurs dans les event handlers (avec try/catch manuel)

### Ce qu'il NE capture PAS ❌

- Erreurs dans les event handlers (nécessite try/catch)
- Code asynchrone (setTimeout, promises, etc.)
- Erreurs côté serveur (SSR)
- Erreurs dans l'Error Boundary lui-même

---

## Pourquoi les utiliser ?

### Sans Error Boundary 🚫
```
Erreur → Écran blanc → Utilisateur frustré → Perte de données → Mauvaise expérience
```

### Avec Error Boundary ✅
```
Erreur → UI de secours friendly → Bouton "Réessayer" → Rapport de bug → Récupération possible
```

**Avantages :**
- 🛡️ **Stabilité** : L'app ne plante plus complètement
- 🐛 **Débogage** : Logs automatiques dans un fichier
- 💡 **UX** : Interface claire expliquant le problème
- 📊 **Analytics** : Suivi des erreurs en production
- 🔄 **Récupération** : Bouton "Réessayer" pour tenter de récupérer

---

## Architecture du système

```
┌─────────────────────────────────────────┐
│           App.tsx / Main.tsx            │
│  ┌───────────────────────────────────┐  │
│  │   <ErrorBoundary name="Root">     │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   Votre application         │  │  │
│  │  │                             │  │  │
│  │  │  <ErrorBoundary name="X">   │  │  │
│  │  │    <Component X />          │  │  │
│  │  │  </ErrorBoundary>           │  │  │
│  │  │                             │  │  │
│  │  │  <ErrorBoundary name="Y">   │  │  │
│  │  │    <Component Y />          │  │  │
│  │  │  </ErrorBoundary>           │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
           │
           │ Erreur détectée
           ▼
┌─────────────────────────────────────────┐
│       ErrorScreen (UI de secours)       │
│  ┌───────────────────────────────────┐  │
│  │  🚨 Oups ! Une erreur est survenue  │
│  │                                    │  │
│  │  [Réessayer] [Signaler le bug]    │  │
│  │                                    │  │
│  │  [▼ Voir les détails techniques]  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
           │
           │ Log
           ▼
┌─────────────────────────────────────────┐
│     logs/errors.log (Electron)          │
│  - Message                              │
│  - Stack trace                          │
│  - Component stack                      │
│  - Timestamp                            │
│  - Boundary name                        │
└─────────────────────────────────────────┘
```

---

## Implémentation étape par étape

### Étape 1 : Ajouter les types TypeScript

**Fichier : `src/types.ts` (ou créer un nouveau)**

```typescript
export interface ErrorLog {
  message: string;
  stack: string;
  componentStack: string;
  timestamp: string;
  boundary: string;
}

// Si vous utilisez Electron
export interface ElectronAPI {
  // ... vos autres APIs
  logError: (errorLog: ErrorLog) => Promise<{ success: boolean; logPath: string }>;
  openExternalUrl: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
```

### Étape 2 : Créer le composant ErrorScreen

**Fichier : `src/components/ErrorScreen.tsx`**

Voir section [Code à copier](#code-à-copier) ci-dessous pour le code complet.

### Étape 3 : Créer le composant ErrorBoundary

**Fichier : `src/components/ErrorBoundary.tsx`**

Voir section [Code à copier](#code-à-copier) ci-dessous pour le code complet.

### Étape 4 : Configurer Electron (optionnel)

Si vous utilisez Electron, ajoutez le handler IPC pour logger les erreurs.

**Fichier : `electron.js` ou `main.js`**

```javascript
const { app, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

// Handler pour logger les erreurs
ipcMain.handle('log-error', async (_event, errorLog) => {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    const logFile = path.join(logsDir, 'errors.log');

    // Créer le dossier logs s'il n'existe pas
    await fs.mkdir(logsDir, { recursive: true });

    // Formater l'erreur
    const formattedError = `
================================================================================
[${errorLog.timestamp}] ${errorLog.boundary}
================================================================================
Message: ${errorLog.message}

Stack Trace:
${errorLog.stack}

Component Stack:
${errorLog.componentStack}
================================================================================

`;

    // Ajouter au fichier de log
    await fs.appendFile(logFile, formattedError, 'utf8');

    return { success: true, logPath: logFile };
  } catch (err) {
    console.error('Failed to write error log:', err);
    return { success: false, error: err.message };
  }
});

// Handler pour ouvrir des URLs externes
ipcMain.handle('open-external-url', async (_event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
});
```

**Fichier : `preload.js`**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... vos autres APIs
  logError: (errorLog) => ipcRenderer.invoke('log-error', errorLog),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
});
```

### Étape 5 : Intégrer dans votre application

**Fichier : `src/App.tsx` ou `src/main.tsx`**

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary name="AppRoot">
      <YourApp />
    </ErrorBoundary>
  );
}

export default App;
```

---

## Code à copier

### ErrorScreen.tsx (complet)

```tsx
/**
 * 🚨 ERROR SCREEN COMPONENT
 * Interface utilisateur friendly affichée quand une erreur est capturée
 * Propose des actions: Réessayer, Signaler le bug, Voir les détails
 */

import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ErrorScreenProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
  boundaryName?: string;
}

export function ErrorScreen({ error, errorInfo, onReset, boundaryName }: ErrorScreenProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleReportBug = () => {
    const title = encodeURIComponent(`[Bug] ${error?.message || 'Erreur inconnue'}`);
    const body = encodeURIComponent(
      `**Description de l'erreur**\\n\\n` +
      `Boundary: ${boundaryName || 'Unknown'}\\n` +
      `Message: ${error?.message || 'N/A'}\\n\\n` +
      `**Stack Trace**\\n\`\`\`\\n${error?.stack || 'N/A'}\\n\`\`\`\\n\\n` +
      `**Component Stack**\\n\`\`\`\\n${errorInfo?.componentStack || 'N/A'}\\n\`\`\`\\n\\n` +
      `**Version**\\n[Votre App] v1.0.0\\n\\n` +
      `**Étapes pour reproduire**\\n1. ...\\n2. ...\\n3. ...`
    );

    // IMPORTANT: Remplacez par l'URL de votre repo GitHub
    const issueUrl = `https://github.com/VOTRE_USERNAME/VOTRE_REPO/issues/new?title=${title}&body=${body}`;

    if (window.electronAPI?.openExternalUrl) {
      window.electronAPI.openExternalUrl(issueUrl);
    } else {
      window.open(issueUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#1a1f35] to-[#0a0e1a] p-6">
      <div className="max-w-2xl w-full">
        {/* Card d'erreur principale */}
        <div className="rounded-2xl border border-red-500/30 bg-[#161b2e]/90 backdrop-blur-xl p-8 shadow-2xl">
          {/* Icône et titre */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                Oups ! Une erreur est survenue
              </h1>
              <p className="text-slate-400 text-sm">
                {boundaryName ? `Dans: ${boundaryName}` : 'Une erreur inattendue s\'est produite'}
              </p>
            </div>
          </div>

          {/* Message d'erreur */}
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-300 font-mono text-sm">
              {error?.message || 'Erreur inconnue'}
            </p>
          </div>

          {/* Suggestions */}
          <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <h3 className="text-blue-300 font-bold text-sm mb-2">💡 Suggestions :</h3>
            <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside">
              <li>Cliquez sur "Réessayer" pour tenter de récupérer</li>
              <li>Rafraîchissez la page si le problème persiste (Ctrl+R)</li>
              <li>Vérifiez vos données dans les paramètres</li>
              <li>Signalez le bug pour nous aider à l'améliorer</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
            <button
              onClick={handleReportBug}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
            >
              <Bug className="w-4 h-4" />
              Signaler le bug
            </button>
          </div>

          {/* Toggle détails */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDetails ? 'Masquer les détails' : 'Voir les détails techniques'}
          </button>

          {/* Détails techniques */}
          {showDetails && (
            <div className="mt-4 p-4 rounded-lg bg-black/50 border border-white/10 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {/* Stack trace */}
                {error?.stack && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">Stack Trace</h4>
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                  </div>
                )}

                {/* Component stack */}
                {errorInfo?.componentStack && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">Component Stack</h4>
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info supplémentaire */}
        <p className="text-center text-slate-500 text-xs mt-4">
          L'erreur a été enregistrée automatiquement. Vos données sont toujours en sécurité.
        </p>
      </div>
    </div>
  );
}
```

### ErrorBoundary.tsx (complet)

```tsx
/**
 * 🛡️ ERROR BOUNDARY COMPONENT
 * Capture les erreurs React et affiche une UI de secours
 * Au lieu d'un écran blanc, l'utilisateur voit un message d'erreur friendly
 */

import React, { Component, ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  name?: string; // Nom de la boundary pour identifier d'où vient l'erreur
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Mettre à jour le state pour afficher l'UI de secours
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Logger l'erreur
    console.error('❌ Error Boundary caught an error:', error, errorInfo);

    // Sauvegarder l'errorInfo dans le state
    this.setState({ errorInfo });

    // Logger dans un fichier via Electron
    if (window.electronAPI?.logError) {
      const errorLog = {
        message: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        timestamp: new Date().toISOString(),
        boundary: this.props.name || 'unnamed',
      };

      window.electronAPI.logError(errorLog).catch((err) => {
        console.error('Failed to log error to file:', err);
      });
    }

    // Callback personnalisé si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Utiliser le fallback personnalisé si fourni
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Sinon utiliser l'écran d'erreur par défaut
      return (
        <ErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          boundaryName={this.props.name}
        />
      );
    }

    return this.props.children;
  }
}
```

---

## Intégration dans votre app

### Stratégie de placement

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    // 🛡️ Boundary racine : capture toutes les erreurs
    <ErrorBoundary name="AppRoot">
      <Header />

      {/* 🛡️ Boundary pour le contenu principal */}
      <ErrorBoundary name="MainContent">
        <MainContent />
      </ErrorBoundary>

      {/* 🛡️ Boundary pour les modales/panels */}
      <ErrorBoundary name="Modals">
        {showModal && <Modal />}
        {showPanel && <Panel />}
      </ErrorBoundary>

      <Footer />
    </ErrorBoundary>
  );
}
```

### Où placer les boundaries ?

✅ **BON** - Placer autour de :
- Routes principales (`<Router>`, `<Routes>`)
- Composants lourds/complexes
- Features indépendantes
- Modales et panels
- Lazy-loaded components

❌ **MAUVAIS** - Ne PAS placer autour de :
- Chaque petit composant (overkill)
- Composants très simples (Button, Input)
- L'Error Boundary lui-même

---

## Bonnes pratiques

### 1. Nommez vos boundaries

```tsx
// ❌ Mauvais
<ErrorBoundary>
  <Component />
</ErrorBoundary>

// ✅ Bon
<ErrorBoundary name="UserProfile">
  <UserProfile />
</ErrorBoundary>
```

### 2. Loggez les erreurs

```tsx
<ErrorBoundary
  name="Dashboard"
  onError={(error, errorInfo) => {
    // Envoyer à un service d'analytics (Sentry, LogRocket, etc.)
    analytics.logError({
      message: error.message,
      stack: error.stack,
      component: errorInfo.componentStack,
    });
  }}
>
  <Dashboard />
</ErrorBoundary>
```

### 3. Personnalisez l'UI de secours

```tsx
<ErrorBoundary
  name="CriticalFeature"
  fallback={
    <div className="error-fallback">
      <h1>Cette fonctionnalité est temporairement indisponible</h1>
      <button onClick={() => window.location.reload()}>
        Recharger la page
      </button>
    </div>
  }
>
  <CriticalFeature />
</ErrorBoundary>
```

### 4. Testez vos boundaries

Créez un composant de test :

```tsx
// TestErrorButton.tsx
function TestErrorButton() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Test error for Error Boundary');
  }

  return (
    <button onClick={() => setShouldThrow(true)}>
      Throw Test Error
    </button>
  );
}

// Usage
<ErrorBoundary name="Test">
  <TestErrorButton />
</ErrorBoundary>
```

### 5. Gérez les erreurs asynchrones

Les Error Boundaries ne capturent PAS les erreurs async. Utilisez try/catch :

```tsx
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    // Logger l'erreur manuellement
    if (window.electronAPI?.logError) {
      window.electronAPI.logError({
        message: error.message,
        stack: error.stack || '',
        componentStack: 'Async operation',
        timestamp: new Date().toISOString(),
        boundary: 'AsyncFetch',
      });
    }
    throw error; // Re-throw pour afficher une erreur dans l'UI
  }
}
```

---

## Dépannage

### L'ErrorScreen ne s'affiche pas

**Problème :** L'app affiche un écran blanc au lieu de l'ErrorScreen.

**Solutions :**
1. Vérifiez que l'ErrorBoundary entoure bien le composant qui lance l'erreur
2. Vérifiez qu'il n'y a pas d'erreur dans ErrorScreen lui-même
3. Ouvrez la console pour voir les logs

### Les erreurs ne sont pas loggées dans le fichier

**Problème :** Pas de fichier `logs/errors.log` créé.

**Solutions :**
1. Vérifiez que le handler IPC est bien configuré dans `electron.js`
2. Vérifiez que `preload.js` expose bien `logError`
3. Testez avec : `window.electronAPI.logError({ ... })`
4. Vérifiez les permissions d'écriture dans `app.getPath('userData')`

### Le bouton "Signaler le bug" ne fonctionne pas

**Problème :** Rien ne se passe au clic sur "Signaler le bug".

**Solutions :**
1. Remplacez l'URL GitHub dans `ErrorScreen.tsx` par la vôtre
2. Vérifiez que `openExternalUrl` est bien configuré
3. Testez dans la console : `window.electronAPI.openExternalUrl('https://google.com')`

### Les icônes ne s'affichent pas

**Problème :** Erreur `Cannot find module 'lucide-react'`.

**Solution :**
```bash
npm install lucide-react
# ou
yarn add lucide-react
# ou
pnpm add lucide-react
```

---

## Dépendances requises

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Checklist d'implémentation

- [ ] Créer `src/types.ts` avec `ErrorLog` interface
- [ ] Créer `src/components/ErrorScreen.tsx`
- [ ] Créer `src/components/ErrorBoundary.tsx`
- [ ] Installer `lucide-react` (pour les icônes)
- [ ] (Electron) Ajouter handler `log-error` dans `electron.js`
- [ ] (Electron) Ajouter handler `open-external-url` dans `electron.js`
- [ ] (Electron) Exposer APIs dans `preload.js`
- [ ] Wrapper l'app racine dans `<ErrorBoundary name="AppRoot">`
- [ ] Ajouter boundaries autour des features critiques
- [ ] Remplacer l'URL GitHub dans `ErrorScreen.tsx`
- [ ] Tester avec un composant qui lance une erreur volontaire
- [ ] Vérifier que le fichier `logs/errors.log` est créé
- [ ] Tester le bouton "Réessayer"
- [ ] Tester le bouton "Signaler le bug"
- [ ] (Production) Retirer les composants de test

---

## Ressources

- [React Error Boundaries (docs officielles)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Electron IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [lucide-react (icônes)](https://lucide.dev/)

---

## Licence

Ce code est libre d'utilisation. Pas de restrictions. ✨

**Happy coding! 🚀**
