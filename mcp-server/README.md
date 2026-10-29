# To-DoX MCP

Serveur [MCP](https://modelcontextprotocol.io) qui permet à Claude (Claude Desktop, Claude Code…) de piloter To-DoX : lire et modifier le Kanban, gérer les révisions, et remplir les feuilles d'heures.

Il passe par **la même API backend que l'app** (connexion avec ton compte To-DoX). Les changements apparaissent dans l'app au prochain rafraîchissement automatique (~10 s).

## Intégration automatique (recommandé)

Depuis la version de bureau de To-DoX : **Menu → Claude (IA) → Connecter Claude** (l'assistant s'ouvre aussi tout seul au premier démarrage). To-DoX :

- ajoute l'entrée `todox` dans `claude_desktop_config.json` (les autres serveurs MCP sont conservés, une sauvegarde `.todox-backup` est faite) ;
- lance le serveur avec son propre exécutable (`ELECTRON_RUN_AS_NODE=1`) : **pas besoin d'installer Node.js** ;
- partage sa session (URL du backend + jeton) via `claude-mcp-session.json` dans son dossier de données : **pas de mot de passe dans la config de Claude**. Se reconnecter dans To-DoX suffit si la session expire ; se déconnecter coupe l'accès de Claude.

Ensuite : quitter complètement Claude, le rouvrir, et tester (« Qu'est-ce que j'ai à faire cette semaine dans To-DoX ? »).

Le backend peut tourner n'importe où (serveur, conteneurs Docker…) : le serveur MCP tourne sur le poste de l'utilisateur et appelle la même API que l'app.

## Installation manuelle (sans l'app de bureau)

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Trois variables d'environnement :

| Variable | Rôle |
|---|---|
| `TODOX_API_URL` | URL du backend To-DoX (même valeur que `VITE_API_URL` de l'app, ex. `http://192.168.1.141:3001`) |
| `TODOX_EMAIL` | Email de ton compte To-DoX |
| `TODOX_PASSWORD` | Mot de passe To-DoX |

(`TODOX_TOKEN` peut remplacer email + mot de passe si tu as déjà un JWT, mais il ne sera pas renouvelé à expiration.)

### Claude Desktop

Fichier `%APPDATA%\Claude\claude_desktop_config.json` (Windows) ou `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) :

```json
{
  "mcpServers": {
    "todox": {
      "command": "node",
      "args": ["C:\\chemin\\vers\\To-DoX\\mcp-server\\dist\\index.js"],
      "env": {
        "TODOX_API_URL": "http://192.168.1.141:3001",
        "TODOX_EMAIL": "prenom.nom@exemple.fr",
        "TODOX_PASSWORD": "••••••"
      }
    }
  }
}
```

Redémarre Claude Desktop : les outils « todox » apparaissent dans le menu des connecteurs.

### Claude Code

```bash
claude mcp add todox --env TODOX_API_URL=http://192.168.1.141:3001 --env TODOX_EMAIL=prenom.nom@exemple.fr --env TODOX_PASSWORD=xxx -- node /chemin/vers/To-DoX/mcp-server/dist/index.js
```

## Outils disponibles

**Kanban**
- `whoami`, `list_users`, `list_projects`
- `list_tasks` — filtres statut, projet, personne, texte, échéance
- `get_task` — détail avec sous-tâches et commentaires
- `create_task` — avec sous-tâches et récurrence optionnelles
- `update_task` — titre, projet, échéance, priorité, statut (déplacer une carte), notes, affectation
- `archive_task`, `delete_task`
- `add_subtasks`, `update_subtask` (cocher, renommer, supprimer), `add_comment`

**Révisions**
- `set_reviewers` (option `submit` pour passer en révision), `validate_task`, `request_corrections`
- `list_my_reviews`, `list_notifications`

**Feuilles d'heures**
- `get_timesheet` — heures par projet × jour (semaine en cours par défaut, `week: "previous"`, une date, ou `from`/`to`)
- `set_time_entries` — saisie en lot ; mode `set` (remplace) ou `add` (additionne) ; `hours: 0` supprime
- `get_activity` — ce que tu as fait jour par jour (tâches terminées, révisions, sous-tâches, commentaires) pour proposer une répartition des heures

## Exemples de demandes

- « Qu'est-ce que j'ai à faire cette semaine ? »
- « Crée une tâche "Note de calcul TGBT" sur le projet ACME pour vendredi, assignée à Julie, avec les sous-tâches bilan de puissance et schéma unifilaire »
- « Passe la tâche note de calcul en révision avec Julie comme réviseuse »
- « Remplis ma feuille d'heures de la semaine dernière à partir de mon activité, 7 h par jour, et montre-moi la proposition avant d'enregistrer »
- « Mets 3 h sur ACME et 4 h sur DIVERS pour aujourd'hui »

## Notes

- Le serveur agit **en ton nom** : les saisies d'heures sont toujours les tiennes (lecture possible pour un autre utilisateur via `user`).
- Les titres et noms de projets sont mis en MAJUSCULES, comme dans l'app.
- Passer une tâche récurrente en « done » crée l'occurrence suivante (même logique que l'app).
- Le mot de passe est stocké en clair dans la config du client MCP : protège ce fichier.
