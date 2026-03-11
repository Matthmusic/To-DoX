# 🚀 Guide de Déploiement To-DoX

## Procédure COMPLÈTE et UNIQUE pour déployer une nouvelle version

### ⚠️ IMPORTANT : Cette procédure est la SEULE à suivre. Ne pas improviser !

## 📋 Checklist avant déploiement

- [ ] Tous les changements sont testés localement
- [ ] Aucune erreur dans la console
- [ ] L'app fonctionne en mode dev (`npm run dev:electron`)

## 🎯 Procédure de déploiement (ÉTAPE PAR ÉTAPE)

### 1. Mettre à jour la version dans package.json

```bash
cd "c:\DEV\TO DO X\To-DoX"
```

Ouvrir `package.json` et modifier la ligne :
```json
"version": "2.X.X"  // Incrémenter selon SemVer
```

**Règles SemVer :**
- `2.1.0 → 2.1.1` : Bug fix / correction
- `2.1.0 → 2.2.0` : Nouvelle fonctionnalité
- `2.0.0 → 3.0.0` : Breaking change

### 2. Commiter le changement de version

```bash
git add To-DoX/package.json
git commit -m "chore: bump version to 2.X.X"
```

### 3. Commiter les modifications du code

```bash
git add .
git commit -m "feat: description de la nouvelle feature

✨ Nouvelle fonctionnalité : Titre

## Ajouts
- Feature 1
- Feature 2

## Modifications
- Modif 1

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 4. Créer et pousser le tag

```bash
# Créer le tag (ATTENTION : préfixe v obligatoire)
git tag -a v2.X.X -m "Release v2.X.X - Nom de la release"

# Pousser TOUT vers GitHub
git push origin main
git push origin v2.X.X
```

### 5. Attendre le workflow GitHub Actions

- Aller sur https://github.com/Matthmusic/To-DoX/actions
- Vérifier que le workflow "Release To-DoX" se lance
- Attendre la fin (environ 5-10 minutes)
- La release sera créée automatiquement sur https://github.com/Matthmusic/To-DoX/releases

## 🔥 Script automatisé (à venir)

Un script `deploy.sh` sera créé pour automatiser tout ça en une seule commande.

## ❌ Ce qu'il NE FAUT PAS faire

- ❌ Ne JAMAIS créer le tag avant de commiter le changement de version
- ❌ Ne JAMAIS oublier le préfixe `v` dans le tag
- ❌ Ne JAMAIS builder localement pour la release (le workflow s'en charge)
- ❌ Ne JAMAIS utiliser `--force` sauf si tu as vraiment merdé

## 🆘 En cas de problème

### J'ai oublié de mettre à jour package.json

```bash
# Modifier package.json manuellement
git add To-DoX/package.json
git commit --amend --no-edit

# Recréer le tag
git tag -d v2.X.X
git tag -a v2.X.X -m "Release v2.X.X - Nom"

# Push forcé (ATTENTION)
git push --force origin main
git push --force origin v2.X.X
```

### Le workflow ne se déclenche pas

1. Vérifier que le tag commence par `v`
2. Vérifier que le tag existe sur GitHub : https://github.com/Matthmusic/To-DoX/tags
3. Vérifier le workflow : https://github.com/Matthmusic/To-DoX/actions

### Le build échoue

1. Consulter les logs du workflow
2. Vérifier que `package.json` contient la bonne version
3. Vérifier que le code compile localement (`npm run build`)

## 📝 Notes

- Les releases sont automatiquement signées
- Les mises à jour sont distribuées via electron-updater
- Les utilisateurs reçoivent une notification automatique
