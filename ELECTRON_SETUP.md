# Configuration Electron pour To-DoX

## Ce qui a été configuré

To-DoX a été converti en application Electron avec système de mise à jour automatique, similaire à ListX.

### Fichiers créés/modifiés

1. **Fichiers Electron principaux**
   - `smart-todo/electron.js` - Point d'entrée principal Electron
   - `smart-todo/preload.js` - Script de preload pour la sécurité (contextBridge)
   - `smart-todo/src/hooks/useAutoUpdater.ts` - Hook React pour gérer les mises à jour
   - `smart-todo/src/components/UpdateNotification.tsx` - Composant de notification UI

2. **Configuration**
   - `smart-todo/package.json` - Scripts et configuration electron-builder
   - `smart-todo/vite.config.ts` - Configuration pour build Electron
   - `.github/workflows/release.yml` - Workflow GitHub Actions
   - `.gitignore` - Ajout des dossiers de build Electron

3. **Documentation**
   - `README.md` - Mis à jour avec instructions Electron
   - `RELEASE.md` - Guide de release
   - `ELECTRON_SETUP.md` - Ce fichier

### Dépendances installées

```json
{
  "electron": "^39.2.1",
  "electron-builder": "^26.0.12",
  "electron-updater": "^6.6.2",
  "concurrently": "^9.2.1",
  "wait-on": "^9.0.3",
  "cross-env": "^10.1.0"
}
```

## Comment utiliser

### Mode développement

**Version web (comme avant)** :
```bash
cd smart-todo
npm run dev
```
L'application s'ouvre sur http://localhost:5173

**Version Electron** :
```bash
cd smart-todo
npm run dev:electron
```
L'application desktop s'ouvre avec DevTools

### Créer un build local

```bash
cd smart-todo
npm run build:electron
```

Les fichiers sont générés dans `smart-todo/release/`

### Publier une release

1. Modifier la version dans `smart-todo/package.json`
2. Commit et push
3. Créer un tag :
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

Le workflow GitHub Actions :
- Build pour Windows, macOS, Linux
- Crée la release avec tous les installateurs
- Configure l'auto-update

## Système de mise à jour

### Fonctionnement

1. **Au démarrage** : L'app vérifie automatiquement les mises à jour (3s après le lancement)
2. **Notification** : Si une mise à jour existe, une notification apparaît en haut à droite
3. **Téléchargement** : L'utilisateur peut télécharger via le bouton "Télécharger"
4. **Installation** : Une fois téléchargée, l'utilisateur peut redémarrer pour installer

### Vérification manuelle

Un bouton version (ex: "v1.0.0") est toujours visible en bas à droite de l'app Electron pour vérifier manuellement.

### Sécurité

- Communication via `contextBridge` (isolation du contexte)
- Vérification des signatures via GitHub
- Pas d'accès direct à Node.js depuis le renderer

## Architecture de sécurité

```
┌─────────────────────────────────────┐
│   Renderer Process (React)          │
│   - Pas d'accès direct à Node.js    │
│   - Interface via window.electronAPI│
└──────────────┬──────────────────────┘
               │
        contextBridge (preload.js)
               │
┌──────────────▼──────────────────────┐
│   Main Process (electron.js)        │
│   - Accès complet à Node.js         │
│   - Gestion des mises à jour        │
│   - Communication IPC               │
└─────────────────────────────────────┘
```

## Plateformes supportées

- **Windows** : Windows 10/11 (x64)
- **macOS** : macOS 10.13+ (Intel x64 + Apple Silicon arm64)
- **Linux** : Ubuntu/Debian (x64)

## Prochaines étapes

1. **Créer une icône** : Ajouter `smart-todo/src/assets/icon.png` (512x512px)
2. **Tester le build** : `npm run build:electron`
3. **Première release** : Suivre les instructions dans `RELEASE.md`

## Différences avec la version web

- Fenêtre native (pas de barre d'adresse)
- Ouverture de dossiers locaux fonctionnelle
- Notifications système possibles
- Mises à jour automatiques
- Meilleure performance
- Fonctionne hors ligne

## Ressources

- [Documentation Electron](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [electron-updater](https://www.electron.build/auto-update)
- [Exemple ListX](https://github.com/Matthmusic/ListX)
