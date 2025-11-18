# Guide de Release pour To-DoX

## Système de mise à jour automatique

To-DoX utilise **electron-updater** pour fournir des mises à jour automatiques via GitHub Releases, exactement comme ListX.

### Fonctionnement

1. **Vérification automatique** : L'application vérifie les mises à jour au démarrage
2. **Notification** : L'utilisateur est notifié quand une nouvelle version est disponible
3. **Téléchargement** : L'utilisateur peut télécharger la mise à jour en un clic
4. **Installation** : La mise à jour s'installe au redémarrage de l'application

### Workflow de Release

Le fichier [.github/workflows/release.yml](.github/workflows/release.yml) gère automatiquement :

- Build multi-plateforme (Windows, macOS, Linux)
- Création de la release GitHub
- Publication des installateurs
- Configuration de l'auto-update

### Créer une nouvelle release

1. **Mettre à jour la version** dans `smart-todo/package.json` :
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. **Commiter les changements** :
   ```bash
   git add smart-todo/package.json
   git commit -m "chore: bump version to 1.1.0"
   git push origin main
   ```

3. **Créer et pousser un tag** :
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

4. **Le workflow s'exécute automatiquement** :
   - Build pour Windows (`.exe`)
   - Build pour macOS (`.dmg`, `.zip`)
   - Build pour Linux (`.AppImage`, `.deb`)
   - Création de la release GitHub avec tous les fichiers
   - Les utilisateurs reçoivent automatiquement la notification de mise à jour

### Structure des releases

Chaque release contient :

- **Windows** : `To-DoX-Setup-1.1.0.exe`
- **macOS Intel** : `To-DoX-1.1.0-x64.dmg` et `.zip`
- **macOS Apple Silicon** : `To-DoX-1.1.0-arm64.dmg` et `.zip`
- **Linux** : `To-DoX-1.1.0.AppImage` et `To-DoX-1.1.0.deb`
- **Fichiers de mise à jour** : `latest.yml`, `latest-mac.yml`, `latest-linux.yml`

### Configuration electron-builder

La configuration dans `smart-todo/package.json` définit :

```json
{
  "build": {
    "appId": "com.matthmusic.todox",
    "publish": {
      "provider": "github",
      "owner": "Matthmusic",
      "repo": "To-DoX"
    }
  }
}
```

### Sécurité

- Les mises à jour sont signées automatiquement
- Vérification de l'intégrité via GitHub
- Communication sécurisée (HTTPS)

### Tests avant release

Avant de créer une release, testez localement :

```bash
cd smart-todo

# Version web
npm run dev

# Version Electron
npm run dev:electron

# Build local (sans publish)
npm run build:electron
```

### Notes importantes

- **Ne jamais** utiliser `--force` sur les tags
- **Toujours** tester la version avant de créer le tag
- Les versions doivent suivre [SemVer](https://semver.org/) : `MAJOR.MINOR.PATCH`
- Le préfixe `v` est obligatoire dans les tags (ex: `v1.0.0`)

### Ressources

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
