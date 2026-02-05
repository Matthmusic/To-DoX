---
description: Déployer une nouvelle version de To-DoX sur GitHub avec release automatique
---

# 🚀 Déploiement To-DoX

Tu vas déployer une nouvelle version de To-DoX en suivant EXACTEMENT cette procédure :

## Étapes à suivre (DANS L'ORDRE)

1. **Demander la nouvelle version** au user (format: 1.X.X)
   - Si c'est un bug fix : incrémenter le PATCH (1.4.0 → 1.4.1)
   - Si c'est une nouvelle feature : incrémenter le MINOR (1.4.0 → 1.5.0)
   - Si c'est un breaking change : incrémenter le MAJOR (1.4.0 → 2.0.0)

2. **Demander le message de release** (courte description)

3. **Lire le package.json** pour vérifier la version actuelle

4. **Mettre à jour package.json** avec la nouvelle version

5. **Commiter le changement de version** :
   ```bash
   git add package.json
   git commit -m "chore: bump version to X.X.X"
   ```

6. **Commiter les autres changements** s'il y en a :
   ```bash
   git add .
   git commit -m "feat: [message du user]

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

7. **Créer le tag** (AVEC le préfixe v) :
   ```bash
   git tag -a vX.X.X -m "Release vX.X.X - [message]"
   ```

8. **Pousser vers GitHub** :
   ```bash
   git push origin main
   git push origin vX.X.X
   ```

9. **Confirmer au user** que :
   - Le tag a été poussé
   - Le workflow va se lancer
   - La release sera disponible sur https://github.com/Matthmusic/To-DoX/releases dans 5-10 minutes

## ⚠️ RÈGLES IMPORTANTES

- TOUJOURS mettre à jour package.json AVANT de créer le tag
- TOUJOURS utiliser le préfixe `v` dans le tag
- NE JAMAIS utiliser `--force` sauf si explicitement demandé
- TOUJOURS vérifier qu'il n'y a pas de fichiers .claude dans le commit

## En cas d'erreur

Si tu as oublié de mettre à jour package.json :
1. Mettre à jour package.json
2. `git add package.json`
3. `git commit --amend --no-edit`
4. `git tag -d vX.X.X`
5. `git tag -a vX.X.X -m "Release vX.X.X - [message]"`
6. `git push --force origin main`
7. `git push --force origin vX.X.X`
