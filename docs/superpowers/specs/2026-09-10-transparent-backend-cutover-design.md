# To-DoX — Bascule transparente vers le backend Postgres

Date : 2026-09-10
Statut : validé en brainstorming, en attente de plan d'implémentation
Dépend de : sous-projet 1 (fait, backend multi-tenant Postgres) et sous-projet 2 (templates/rapports/Outlook côté backend — **pas encore commencé, bloquant**)

## Contexte

Le sous-projet 1 a livré un backend Postgres multi-tenant complet pour tasks/subtasks/projets/commentaires/notifications/time entries, testé et mergé, mais **non branché au frontend** et **non déployé en production**. Le frontend To-DoX continue de persister via localStorage (web) et un fichier `data.json`/`comments.json` synchronisé par OneDrive (Electron), exactement comme décrit dans le diagnostic de fragilité qui a motivé tout ce chantier.

Cette spec décrit comment faire passer les 10 utilisateurs réels de l'équipe de l'ancien système au nouveau **sans qu'ils s'en rendent compte au quotidien**, ni perdre de données, ni casser de fonctionnalité au passage.

## Objectif

Une bascule où :
- Personne ne perd de données (migration à partir des vraies données OneDrive de production).
- Personne ne voit de régression fonctionnelle (rien ne bascule tant que tout n'est pas couvert côté backend).
- L'interaction quotidienne change le moins possible (l'écran "clique sur ton nom" reste l'écran "clique sur ton nom").
- Un problème découvert en conditions réelles n'affecte qu'un petit groupe volontaire, jamais tout le monde d'un coup.
- Il existe un filet de sécurité clair à chaque étape.

## Non-objectifs

- Construire le sous-projet 2 (templates/rapports/Outlook côté backend) — prérequis de cette spec, pas son contenu. Cette spec suppose qu'il est terminé avant que la Phase 1 ne commence pour de vrai.
- Dual-write vers OneDrive pendant une période de transition — explicitement écarté : ça réintroduirait la fragilité qu'on cherche à éliminer. Le filet de sécurité, c'est les sauvegardes Postgres (déjà en place, Task 12) et un `data.json` figé en lecture seule, pas un OneDrive activement maintenu en parallèle.
- Migration continue/synchronisation bidirectionnelle entre l'ancien et le nouveau système — la bascule est un événement ponctuel (avec une re-migration juste avant la promotion finale, voir Phase 4), pas un pont permanent entre les deux mondes.
- Authentification "entreprise" (SSO, 2FA, expiration agressive de session) — hors de portée pour une équipe de 10 personnes en interne ; peut être ajouté plus tard sans changer cette spec.

## Prérequis bloquants

1. **Sous-projet 2 terminé** — templates, rapports sauvegardés, configuration Outlook/ICS couverts côté backend (routes + schéma), au même niveau de qualité que le sous-projet 1 (revue de tâche + revue finale de branche).
2. **Backend réellement déployé** sur la LXC Proxmox dédiée (artefacts déjà écrits en Task 12 : `deploy/todox-backend.service`, `DEPLOY.md`) — actuellement seul Postgres tourne, pas encore le serveur Node.

Tant que ces deux prérequis ne sont pas remplis, rien dans cette spec ne s'exécute contre de vraies données ni de vrais utilisateurs.

## Architecture / séquence en 4 phases

### Phase 1 — Intégration frontend

Remplacement complet de la couche de persistance actuelle :
- **`src/services/api.ts`** (nouveau) — client HTTP typé pour toutes les routes backend (auth, tasks, subtasks, projects, comments, notifications, time-entries, et — une fois le sous-projet 2 fait — templates/rapports/Outlook), gestion du token JWT (lecture/écriture via le mécanisme décrit ci-dessous).
- **Écran de connexion** — réutilise la grille "clique sur ton nom" existante (`TitleBar.tsx`), n'ajoute qu'un prompt mot de passe conditionnel (voir section Authentification).
- **`src/store/useStore.ts`** — chaque action (`addTask`, `updateTask`, `setUsers`, etc.) appelle le client API au lieu de muter l'état localement puis compter sur les hooks de persistence pour sauvegarder ; la réponse de l'API devient la source de vérité pour la mise à jour du state.
- **Remplacement de `useDataPersistence.ts`** et ses 3 sous-hooks (`useLoadData`, `useSyncPolling`, `usePersistSave`) par un hook unique orienté API : chargement initial via `GET`, rafraîchissement périodique léger (5-10s, ou au retour de focus fenêtre — cohérent avec ce que la spec du sous-projet 1 décrit déjà pour le backend), plus de fichier local à lire/écrire.
- **Suppression d'OneDrive** — `electron.js` perd ses handlers IPC de fichiers (`get-storage-path`, `read-data`, `save-data`, `get-file-hash`) ; `StoragePanel.tsx` devient un écran de compte (URL du serveur, session, déconnexion) plutôt qu'un sélecteur de dossier.

Cette phase se développe et se teste normalement (TDD, revue de tâche) — elle ne touche à aucune donnée réelle tant que Phase 2 n'a pas eu lieu.

### Phase 2 — Migration des données réelles

Le script de migration existe déjà et est testé (sous-projet 1, Task 11) contre des données synthétiques. Cette phase l'exécute une première fois contre le VRAI `data.json`/`comments.json` de production (le fichier OneDrive réellement utilisé par l'équipe aujourd'hui), en lecture seule sur la source — rien n'est modifié côté OneDrive.

Sortie : une organisation, un compte par utilisateur réel avec mot de passe temporaire généré, toutes les tâches/commentaires/etc. migrés. Les mots de passe temporaires sont à communiquer individuellement (Slack en message privé, ou en personne) — jamais en clair par email, jamais laissés dans un log persistant.

### Phase 3 — Canal dev/beta

Build publié en canal `dev` (mécanisme déjà en place, voir `RELEASE-CHANNELS.md`), pointant vers le serveur de production réel avec les données fraîchement migrées. Utilisé en conditions réelles par toi (et 1-2 volontaires si tu veux) pendant quelques jours, pendant que **le reste de l'équipe continue sur la version stable actuelle (OneDrive), sans rien voir changer.**

C'est le cœur du "transparent" : tant que rien n'est promu en stable, la bascule n'existe que pour ceux qui ont explicitement choisi le canal dev. Aucun risque pour les autres.

### Phase 4 — Bascule finale

Pendant la Phase 3, l'équipe restée sur OneDrive continue à créer/modifier des tâches — ces changements ne sont pas dans les données migrées en Phase 2. Avant de promouvoir en stable :
1. Re-lancer le script de migration une dernière fois, à un instant précis annoncé à l'équipe (« bascule ce soir à 18h, sauvegardez ce que vous avez en cours »), pour capturer l'état le plus frais.
2. Publier la version stable (mécanisme de mise à jour existant — chaque poste la reçoit à son prochain lancement).
3. OneDrive n'est plus synchronisé activement après ce point — le `data.json` reste tel quel, figé, comme référence de secours.

## Authentification transparente

L'écran "clique sur ton nom" reste visuellement identique. La différence : cliquer sur un nom qui n'a pas encore de session valide sur CE poste ouvre un petit prompt mot de passe (un seul champ, pas un formulaire d'inscription — le compte existe déjà, créé par la migration). Une fois validé :
- Le token JWT est stocké via `safeStorage` d'Electron (chiffré par l'OS, pas en clair dans `localStorage`).
- Durée de vie longue (30-90 jours), renouvelée silencieusement à chaque usage de l'app tant qu'elle reste active. Le backend actuel émet des tokens avec `JWT_EXPIRATION` (`7d` par défaut) — atteindre 30-90 jours demande soit de relever cette valeur pour l'usage desktop, soit d'introduire un mécanisme de rafraîchissement silencieux ; **choix technique à trancher dans le plan d'implémentation**, pas une réouverture du sous-projet 1 (changement de configuration ou ajout mineur, pas une refonte de l'auth).
- Tant que la session est valide, cliquer sur son nom redevient instantané — aucun prompt.
- Si le token expire (rare) ou est révoqué côté serveur, retour au prompt mot de passe pour ce nom précis, sans affecter les autres profils déjà authentifiés sur le même poste.

Chaque poste partagé (s'il y en a) garde ses propres sessions par utilisateur — pas de session unique par machine.

## Filet de sécurité

- **`data.json` OneDrive** : jamais modifié par la migration (lecture seule), reste comme instantané de référence post-bascule. Plus synchronisé activement, donc il ne dérive pas silencieusement après coup — il représente fidèlement "l'état juste avant la bascule".
- **Sauvegardes Postgres** : `pg_dump` quotidien déjà en place sur la LXC Postgres (Task 12), rotation 14 jours. C'est la vraie continuité de service après la bascule, pas OneDrive.
- **Aucun engagement irréversible avant la promotion stable** : tant qu'on est en Phase 3 (canal dev), revenir en arrière consiste juste à ne pas promouvoir — personne d'autre n'a rien vu.
- **Après la promotion stable** : un problème bloquant découvert se traite comme n'importe quel bug de production (fix + nouvelle release stable), pas par un retour à OneDrive — ce chemin n'est pas maintenu comme option de rollback après la Phase 4, seulement pendant les Phases 1-3.

## Validation avant promotion stable (Phase 3 → Phase 4)

- Tests automatisés du frontend intégré (mocks du client API) + suite backend existante (98 tests actuels, sous-projet 1 seul) toujours verte.
- Usage réel de quelques jours en canal dev couvrant : création/modification/suppression de tâches, sous-tâches, commentaires, workflow de révision, pointage de temps, et — une fois le sous-projet 2 intégré — templates/rapports/Outlook.
- Vérification manuelle que le prompt mot de passe n'apparaît qu'une fois par poste par utilisateur.
- Vérification que la re-migration de Phase 4 ne duplique pas les données déjà migrées en Phase 2 (le script de migration crée toujours une nouvelle organisation — la Phase 4 doit soit réutiliser l'organisation de la Phase 2 en la vidant/remplaçant, soit le script doit gagner un mode "mise à jour" plutôt que "création". **Point à trancher dans le plan d'implémentation**, pas encore décidé ici.)

## Suite

Cette spec ne peut être implémentée avant que le sous-projet 2 soit terminé. Une fois ce préalable levé, elle passe par `writing-plans` pour un plan d'implémentation détaillé (probablement son propre découpage en tâches : client API, écran de connexion, remplacement des hooks, migration Phase 4, publication canal dev, promotion stable).
