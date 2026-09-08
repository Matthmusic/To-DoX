# Canaux de publication CEA

## Comportement

- **Stable** : version `2.3.0`, tag `v2.3.0`. Seul canal proposé par les mises à jour automatiques et le catalogue par défaut.
- **Bêta** : `2.3.0-beta.1` (ou `-rc.1`). Visible uniquement après sélection dans CEA Appstore.
- **Développement** : `2.3.0-dev.1` (ou `-alpha.1`, `-nightly.1`). Installation manuelle dans CEA Appstore.

Les installations expérimentales ne vérifient pas les mises à jour intégrées. Pour changer de version, choisir le canal dans la fiche CEA Appstore puis cliquer sur **Installer cette version**. Le choix du sélecteur ne déclenche ni téléchargement ni abonnement aux notifications.

## Publier

Depuis le dossier contenant le `package.json` de l'application :

```sh
npm version 2.3.0-dev.1 --no-git-tag-version
node scripts/release-channel.cjs
```

Vérifier les changements de `package.json` et du lockfile, exécuter les tests et le build propres au projet, puis committer. Créer et pousser le tag correspondant (`v2.3.0-dev.1`) pour lancer la CI existante. Ne jamais réutiliser un tag déjà publié.

La CI vérifie l'égalité tag/version avant de construire. Les préversions portent le drapeau GitHub `prerelease` et ne deviennent pas la release `latest`. Les fichiers de mise à jour de leur canal (`beta.yml`, `dev.yml`, etc.) sont joints avec les installateurs. Le manifeste `cea-app.json` fournit les métadonnées ; CEA Appstore choisit désormais l'installateur stable depuis les releases, pas depuis la version du manifeste sur `main`.

Pour une publication manuelle hors CI, définir `EP_PRE_RELEASE=true` pour une préversion avant de lancer electron-builder avec publication. Ne pas forcer `releaseType: "release"` dans la configuration. Vérifier ensuite le statut « Pre-release » sur GitHub.

## Retour stable et déploiement initial

Le retour stable remplace l'installation courante. Sauvegarder les données avec les outils de l'application avant de changer de canal ; le store ne peut pas garantir la compatibilité des formats de données ni créer une sauvegarde métier universelle.

Déployer d'abord la nouvelle version stable de CEA Appstore. Chaque application reçoit la règle de mise à jour à sa prochaine publication ; les binaires déjà installés ne sont pas modifiés par un changement des sources. Vérifier une préversion sur un poste de test avant diffusion. Aucun tag, push, publication ou installateur n'est déclenché par la préparation locale de cette fonctionnalité.
