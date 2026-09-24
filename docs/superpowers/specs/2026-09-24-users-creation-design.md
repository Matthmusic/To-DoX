# Création d'utilisateurs depuis To-DoX — design

Date : 2026-09-24 · Périmètre : frontend `To-DoX/` uniquement (aucun changement backend, aucun redéploiement du LXC 104).

## Objectif

Un administrateur peut créer un vrai compte utilisateur depuis « Gestion des utilisateurs » : le compte est créé sur le serveur, persiste, et la personne peut ensuite se connecter depuis son propre poste.

Aujourd'hui, « Ajouter » ne crée qu'un brouillon local (`uid()`), jamais envoyé au serveur ; le poll `fetchUsers` de 10 s l'écrase, d'où le bandeau ⚠️ du panneau.

## Décisions validées

- Le mot de passe initial est **saisi par l'admin** dans le formulaire ; la personne le change ensuite dans Compte (fonction déjà livrée).
- Rôle toujours `member` (pas de case administrateur dans ce lot).
- Édition et suppression d'utilisateurs **hors périmètre** (pas de `PUT`/`DELETE` backend ; question produit ouverte sur le sort des tâches d'un utilisateur supprimé).
- Pas de durcissement serveur du mot de passe minimum dans ce lot (nécessiterait un déploiement manuel sur le LXC).

## Contexte technique constaté

- Backend : `POST /api/users` (admin uniquement) exige `email`, `name`, `password` ; renvoie 409 si l'email existe, 403 si non-admin. Aucune longueur minimale imposée à la création (seul `change-password` exige 8 caractères).
- Store : l'action `createUser(data)` existe déjà (appelle l'API puis `setUsers([...users, created])`) mais ne renvoie rien et n'est utilisée nulle part dans l'UI.
- `User.role` (`'admin' | 'member'`) est fourni par `GET /api/users` et conservé par `normalizeUsers`.
- Écran de login : la liste des comptes vient de `users`, initialisé à `FIXED_USERS` ; la synchro (`useApiSync`) ne démarre qu'avec un `authToken`. Sur un poste neuf, un utilisateur créé par l'admin n'apparaît donc **pas** dans la liste.

## Conception

### 1. Formulaire « Ajouter un utilisateur » (`UsersPanel.tsx`)

- Nouveau champ « Mot de passe initial » (masqué, bouton afficher/masquer). Minimum 8 caractères, constante `MIN_PASSWORD_LENGTH` partagée avec `AccountPanel` (à extraire dans un module commun plutôt que dupliquer).
- Validation avant envoi : nom non vide, email valide, mot de passe ≥ 8.
- Actif seulement si l'utilisateur connecté a `role === 'admin'` ; sinon le bloc est remplacé par une note « Seuls les administrateurs peuvent ajouter des utilisateurs ». Le contrôle réel reste le 403 du serveur.

### 2. Flux de données

1. Clic sur Ajouter → validation → `createUser({ name, email, password })`.
2. `createUser` est modifié pour **renvoyer l'utilisateur créé** (`Promise<User>`).
3. Le panneau ajoute cet utilisateur à son brouillon `localUsers`, sinon « Enregistrer » (`setUsers(localUsers)`) le retirerait du store jusqu'au poll suivant.
4. Le formulaire se vide seulement en cas de succès ; pendant l'appel, le bouton est désactivé (pas de double création).

### 3. Erreurs

Capturées autour de `createUser` et affichées via `alertModal` avec le message serveur : 409 « Email déjà utilisé », 403 droits insuffisants, réseau indisponible. En cas d'échec, les champs saisis sont conservés.

### 4. Connexion du nouvel utilisateur (écran de login)

Ajout d'un accès « Mon nom n'est pas dans la liste » sur `LoginModal` : formulaire email + mot de passe → `login(email, password)`. En cas de succès : token sauvegardé sous l'id serveur (`backendUser.id`), `setAuthToken`, `setCurrentUser(backendUser.id)`, `setLocalAuthUserId(backendUser.id)`. La synchro démarre ensuite et remplit la liste des utilisateurs pour les connexions suivantes. Les 10 comptes existants gardent le parcours actuel (clic sur le nom, puis mot de passe).

### 5. Bandeau d'avertissement

Reformulé pour ne concerner que la modification et la suppression, qui restent locales. L'ajout n'est plus concerné.

## Tests

- `UsersPanel` : appelle `createUser` avec nom, email et mot de passe ; rejette un mot de passe < 8 caractères ; affiche l'erreur serveur (409) sans vider le formulaire ; masque le formulaire pour un non-admin ; l'utilisateur créé reste dans la liste après « Enregistrer ».
- Store : `createUser` renvoie l'utilisateur créé et l'ajoute à `users`.
- `LoginModal` : le parcours « Autre compte » appelle `login` avec l'email saisi et renseigne token/utilisateur avec l'id serveur.
- Vérification finale : typecheck, suite de tests complète, build.

## Hors périmètre / suites possibles

Édition et suppression d'utilisateurs (nécessitent `PUT`/`DELETE` backend), case administrateur, minimum de mot de passe côté serveur, changement de mot de passe imposé à la première connexion.
