# Mise En Place Backend To-DoX Sur Serveur Perso

Guide pratique pour toi (operateur) et pour une IA de code (execution par tickets).

Ce document part de l'etat actuel du repo:
- Backend present dans `todox-backend/` (Express + SQLite).
- Front Electron encore base sur `data.json` / `comments.json`.
- Script de migration JSON -> SQLite deja present.

## 1. Objectif

Passer d'un stockage fichier partage (JSON reseau) a une architecture backend centralisee:

1. Serveur Linux perso (Ubuntu recommande)
2. API Node.js (Express) derriere Nginx + HTTPS
3. Base SQLite dans un premier temps
4. Front To-DoX qui lit/ecrit via API
5. Plan de securisation progressif jusqu'a auth JWT

## 2. Architecture cible

```text
To-DoX Electron clients
        |
        | HTTPS
        v
Nginx (443) -> Node/Express (localhost:3001) -> SQLite (todox.db)
```

Important:
- Ne pas exposer le port `3001` sur Internet.
- Exposer uniquement `443` (et `80` pour challenge certbot + redirection).
- L'auth actuelle `X-User-Id` est acceptable en LAN prive temporairement, pas en public.

## 3. Etat Actuel Du Code (As-Is)

Backend:
- `todox-backend/src/index.ts`: API exposee sur `PORT` (defaut 3001), routes `/api/tasks` et `/api/projects`.
- `todox-backend/src/db.ts`: SQLite `better-sqlite3`, schema cree au demarrage, `WAL` active.
- `todox-backend/src/middleware.ts`: controle utilisateur via header `X-User-Id`.
- `todox-backend/migrate.ts`: migration d'un `data.json` vers SQLite.

Frontend:
- `To-DoX/src/hooks/useDataPersistence.ts`: persistance `localStorage` + Electron `readData/saveData`.
- Pas de client API central pour `/api/tasks` et `/api/projects` dans le front actuel.

## 4. Prerequis

## 4.1 Infra

1. Un serveur Linux accessible SSH (Ubuntu 22.04/24.04).
2. Un nom de domaine ou sous-domaine (`api.ton-domaine.fr`) pointant vers le serveur.
3. Ports ouverts:
   - `22` (SSH)
   - `80` (HTTP pour certbot)
   - `443` (HTTPS)

## 4.2 Poste Operateur

1. Acces git au repo.
2. Acces au fichier historique `data.json` a migrer.
3. Optionnel: acces VPN si tu veux garder l'API privee.

## 5. Roadmap Execution (ordre recommande)

## 5.1 Phase A - Bootstrap serveur (infra de base)

Objectif: serveur stable et minimalement durci.

Commandes:

```bash
sudo apt update
sudo apt install -y git nginx ufw fail2ban
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Creer un utilisateur technique:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Definition of done:
- `node -v` OK
- `nginx -v` OK
- UFW actif et profil Nginx applique

## 5.2 Phase B - Deploy backend actuel

Objectif: API fonctionnelle en local serveur.

```bash
sudo mkdir -p /opt/todox
sudo chown -R $USER:$USER /opt/todox
cd /opt/todox
git clone <URL_DU_REPO> app
cd app/todox-backend
npm ci
npm run build
```

Test local:

```bash
PORT=3001 DB_PATH=/opt/todox/app/todox-backend/todox.db node dist/index.js
```

Dans une autre session:

```bash
curl http://127.0.0.1:3001/api/health
curl -H "X-User-Id: matthieu" http://127.0.0.1:3001/api/tasks
```

Definition of done:
- `/api/health` repond
- `/api/tasks` repond avec `X-User-Id` valide

## 5.3 Phase C - Migration JSON -> SQLite

Objectif: injecter les donnees historiques dans la base serveur.

1. Copier `data.json` sur le serveur (ex: `/opt/todox/import/data.json`).
2. Faire une sauvegarde avant migration.

```bash
mkdir -p /opt/todox/import
cp /chemin/source/data.json /opt/todox/import/data.json
cp /opt/todox/import/data.json /opt/todox/import/data.backup.$(date +%F-%H%M%S).json
```

3. Lancer migration:

```bash
cd /opt/todox/app/todox-backend
npm run migrate -- "/opt/todox/import/data.json"
```

4. Verification rapide (option sqlite3 cli):

```bash
sudo apt install -y sqlite3
sqlite3 /opt/todox/app/todox-backend/todox.db "select count(*) from tasks;"
sqlite3 /opt/todox/app/todox-backend/todox.db "select count(*) from subtasks;"
```

Definition of done:
- Nb taches migratees coherent avec ton JSON
- Pas d'erreur SQL

## 5.4 Phase D - Service PM2

Objectif: process resilient au reboot/crash.

```bash
sudo npm i -g pm2
cd /opt/todox/app/todox-backend
PORT=3001 DB_PATH=/opt/todox/app/todox-backend/todox.db pm2 start dist/index.js --name todox-backend
pm2 save
pm2 startup
```

Checks:

```bash
pm2 status
pm2 logs todox-backend --lines 100
```

Definition of done:
- `pm2 status` = process online
- redemarrage serveur -> process remonte

## 5.5 Phase E - Nginx + HTTPS

Objectif: endpoint public securise via reverse proxy.

Nginx site `/etc/nginx/sites-available/todox-api`:

```nginx
server {
    listen 80;
    server_name api.ton-domaine.fr;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activation:

```bash
sudo ln -s /etc/nginx/sites-available/todox-api /etc/nginx/sites-enabled/todox-api
sudo nginx -t
sudo systemctl reload nginx
```

Certificat:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.ton-domaine.fr
```

Definition of done:
- `https://api.ton-domaine.fr/api/health` repond
- Certificat valide

## 5.6 Phase F - Securite applicative minimale

Objectif: reduire les risques avant ouverture large.

Actions immediates:
1. Ne pas ouvrir 3001 en direct (uniquement localhost).
2. Limiter CORS a ton front (pas `app.use(cors())` global permissif).
3. Ajouter rate-limit (si API publique).
4. Journaliser les acces (nginx + pm2 logs).

Action importante:
- Remplacer `X-User-Id` par auth JWT/login avant utilisation Internet.

Definition of done:
- CORS strict
- Pas d'endpoint metier accessible sans auth cible

## 5.7 Phase G - Integration frontend vers API

Objectif: ne plus dependre de `data.json` comme source principale.

Plan:
1. Creer `To-DoX/src/services/api.ts` avec:
   - `tasksAPI` (`getAll`, `create`, `update`, `delete`, subtasks)
   - `projectsAPI` (`metadata`, `history`, `color`, `directory`)
2. Introduire un flag de mode:
   - `local-file` (comportement actuel)
   - `server-api` (nouveau)
3. Modifier `useDataPersistence.ts`:
   - en mode API: charger via API, sauvegarder via API
   - garder fallback local temporaire
4. Injecter header auth (au minimum `X-User-Id` tant que JWT pas en place).

Definition of done:
- Creation/modification/suppression tache visible sur tous les clients via API
- Plus de dependance au partage `Z:\...` en mode `server-api`

## 5.8 Phase H - Backups + exploitation

Objectif: run en production sans surprise.

Backup quotidien SQLite:

```bash
mkdir -p /opt/todox/backups
cp /opt/todox/app/todox-backend/todox.db /opt/todox/backups/todox-$(date +%F-%H%M%S).db
```

Conserver 14 backups:

```bash
ls -1t /opt/todox/backups/todox-*.db | tail -n +15 | xargs -r rm -f
```

Crontab (tous les jours a 02:30):

```bash
crontab -e
# 30 2 * * * /bin/bash -lc 'cp /opt/todox/app/todox-backend/todox.db /opt/todox/backups/todox-$(date +\%F-\%H\%M\%S).db && ls -1t /opt/todox/backups/todox-*.db | tail -n +15 | xargs -r rm -f'
```

Definition of done:
- Backup auto actif
- Test de restauration fait au moins 1 fois

## 6. Workflow IA De Code (ticketisable)

Utilise cette sequence pour un agent IA:

### Ticket 1 - Hardening backend minimal

Scope:
1. Ajouter config CORS par variable d'env.
2. Ajouter `.env.example` backend.
3. Documenter lancement local/prod.

DoD:
- `npm run build` passe
- `curl /api/health` OK

### Ticket 2 - Couche API frontend

Scope:
1. Creer `src/services/api.ts`.
2. Implementer client tasks/projects.
3. Ajouter gestion d'erreurs standard.

DoD:
- Front compile
- GET tasks et GET projects metadata fonctionnent

### Ticket 3 - Switch mode persistance

Scope:
1. Ajouter flag mode (`server-api` vs `local-file`).
2. Brancher `useDataPersistence.ts` sur API en mode serveur.
3. Conserver fallback local.

DoD:
- Mode local inchange
- Mode API operationnel

### Ticket 4 - Auth solide (JWT)

Scope:
1. Ajouter routes auth (`/api/auth/login`, `/api/auth/me`).
2. Remplacer middleware `X-User-Id`.
3. Adapter client front.

DoD:
- Routes metier protegees
- Session valide/invalide bien geree

### Ticket 5 - Stabilisation prod

Scope:
1. Scripts backup/restore.
2. Nginx final + certbot auto-renew.
3. Monitoring basic (`pm2`, logs, alertes simples).

DoD:
- Procedure rollback ecrite
- Smoke test prod vert

## 7. Prompts Prets Pour IA

Prompt A (backend hardening):

```text
Dans ce repo, modifie todox-backend pour:
1) CORS strict base sur ALLOWED_ORIGINS env
2) Ajouter .env.example avec PORT, DB_PATH, ALLOWED_ORIGINS
3) Mettre a jour la doc du backend
Contraintes: conserver comportement actuel des routes, TypeScript strict, pas de regression build.
```

Prompt B (frontend API mode):

```text
Dans To-DoX, implemente un mode server-api:
1) Creer src/services/api.ts pour /api/tasks et /api/projects
2) Ajouter un flag de mode dans le store
3) Modifier useDataPersistence.ts pour charger/sauver via API en mode server-api
4) Garder mode local-file existant intact
Ajoute tests minimaux si possible.
```

Prompt C (JWT):

```text
Ajoute une authentification JWT dans todox-backend:
1) routes /api/auth/login et /api/auth/me
2) middleware verifyJWT
3) remplacer requireUser base sur X-User-Id
4) adapter le front pour envoyer Authorization: Bearer <token>
Conserver compatibilite de schema des tasks/projets.
```

## 8. Tests De Validation (Smoke Tests)

## 8.1 API

```bash
curl https://api.ton-domaine.fr/api/health
curl -H "X-User-Id: matthieu" https://api.ton-domaine.fr/api/tasks
```

## 8.2 Front

1. Creer une tache depuis client A.
2. Verifier apparition sur client B (rechargement ou sync selon implementation).
3. Modifier statut + sous-tache.
4. Verifier persistance apres restart backend.

## 8.3 Resilience

1. Redemarrer serveur.
2. Verifier `pm2 status`.
3. Verifier `/api/health`.
4. Restaurer un backup en environnement de test.

## 9. Rollback

En cas de souci en prod:

1. Stopper bascule front vers API (revenir mode `local-file`).
2. Restaurer DB depuis dernier backup valide.
3. Redemarrer backend PM2.
4. Controler endpoints health + routes metier.

Commandes utiles:

```bash
pm2 restart todox-backend
pm2 logs todox-backend --lines 200
sudo systemctl reload nginx
```

## 10. Risques Connus

1. Auth actuelle `X-User-Id` insuffisante sur Internet public.
2. SQLite correct pour petite equipe, mais migration PostgreSQL a prevoir si charge forte.
3. Migration front partielle possible si mode hybride mal controle.
4. CORS permissif par defaut si non corrige.

## 11. Checklist Finale

1. Serveur durci (UFW, fail2ban, user non-root)
2. API en service PM2
3. Nginx reverse proxy + HTTPS
4. Donnees migrees JSON -> SQLite
5. Backups automatiques testes
6. Front branche sur API en mode serveur
7. Auth durcie (JWT) avant exposition publique large
8. Runbook incident + rollback disponible

---

Version initiale: 2026-03-10
