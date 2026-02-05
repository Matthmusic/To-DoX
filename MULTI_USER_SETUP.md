# Configuration multi-utilisateurs To-DoX

## Système mis en place

To-DoX utilise maintenant un **accès direct sécurisé** aux fichiers JSON partagés sur le serveur `Z:\F - UTILITAIRES\TODOX`.

### Protections implémentées

✅ **1. Verrouillage de fichier** (File Locking)
- Utilise `proper-lockfile` pour verrouiller le fichier pendant les écritures
- Empêche 2 utilisateurs d'écrire simultanément
- Timeout de 5 secondes si le fichier est verrouillé

✅ **2. Atomic Write** (Écriture atomique)
- Écriture dans un fichier temporaire `.tmp`
- Renommage atomique pour remplacer l'ancien fichier
- Évite la corruption de fichier

✅ **3. Auto-reload toutes les 10 secondes**
- To-DoX vérifie automatiquement si le fichier a changé
- Recharge les données si un autre utilisateur a fait des modifications
- Synchronisation quasi-temps-réel

✅ **4. Détection de conflits**
- Hash MD5 du fichier pour détecter les modifications
- Si quelqu'un modifie le fichier pendant que vous travaillez :
  - Vous recevez une alerte avant la sauvegarde
  - Choix : **écraser** ou **recharger** les données du serveur

---

## Configuration requise

### 1. Créer le dossier partagé

Sur le serveur (ou votre PC si vous hébergez le partage) :

```
Z:\F - UTILITAIRES\TODOX
```

**Permissions Windows** :
- Lecture/Écriture pour tous les utilisateurs qui doivent accéder à To-DoX
- Partage réseau configuré avec les droits appropriés

### 2. Mapper le lecteur Z: sur chaque poste client

Sur chaque poste utilisateur :

1. Ouvrir **Explorateur de fichiers**
2. Clic droit sur **Ce PC** → **Connecter un lecteur réseau**
3. Choisir la lettre **Z:**
4. Chemin réseau : `\\NOM_SERVEUR\F - UTILITAIRES\TODOX` (adapter selon votre serveur)
5. Cocher **Se reconnecter à l'ouverture de session**

### 3. Lancer To-DoX

- Première fois : To-DoX va créer automatiquement le fichier `data.json` dans `Z:\F - UTILITAIRES\TODOX`
- Ensuite : To-DoX chargera les données depuis ce fichier partagé

---

## Structure des fichiers sur Z:

```
Z:\F - UTILITAIRES\TODOX\
├── data.json                    # Fichier principal partagé
├── data.json.lock               # Fichier de verrouillage temporaire
└── backups\                     # Backups automatiques
    ├── backup-2026-01-30T14-30-00.json
    ├── backup-2026-01-30T14-20-00.json
    ├── backup-2026-01-30T14-10-00.json
    ├── backup-2026-01-30T14-00-00.json
    └── backup-2026-01-30T13-50-00.json
```

**Note** : Les 5 derniers backups sont conservés automatiquement.

---

## Comment tester le système multi-utilisateurs

### Test 1 : Lancement simultané

1. Lancer To-DoX sur **Poste 1**
2. Lancer To-DoX sur **Poste 2**
3. Sur Poste 1, créer une tâche "Test 1"
4. **Attendre 10 secondes** max
5. Sur Poste 2, la tâche "Test 1" doit apparaître automatiquement

### Test 2 : Sauvegarde simultanée

1. Sur Poste 1, créer une tâche "Tâche A"
2. **En même temps**, sur Poste 2, créer une tâche "Tâche B"
3. Les deux tâches doivent être sauvegardées correctement grâce au verrouillage

### Test 3 : Détection de conflit

1. Sur Poste 1, **déconnecter le réseau** (Wi-Fi OFF ou câble débranché)
2. Sur Poste 1, créer plusieurs tâches en mode déconnecté
3. Sur Poste 2, créer d'autres tâches pendant ce temps
4. Sur Poste 1, **reconnecter le réseau**
5. Modifier une tâche sur Poste 1
6. **Une alerte de conflit doit apparaître** proposant d'écraser ou de recharger

---

## Comportement attendu

### Scénario normal

```
User A modifie une tâche
    ↓
Verrouillage du fichier (0.1s)
    ↓
Sauvegarde atomique
    ↓
Libération du verrou
    ↓
User B reçoit l'update dans les 10s
```

### Scénario avec conflit

```
User A lit data.json (hash: ABC123)
User B lit data.json (hash: ABC123)
    ↓
User A modifie et sauve (hash: DEF456)
    ↓
User B essaie de sauver
    ↓
Détection: hash actuel (DEF456) ≠ hash lu (ABC123)
    ↓
🚨 ALERTE CONFLIT
    ↓
User B choisit:
  [Écraser] → Remplace les modifs de A
  [Recharger] → Abandonne ses modifs et recharge
```

---

## Dépannage

### Problème : "Impossible d'accéder à Z:\\"

**Solution** :
1. Vérifier que le lecteur Z: est bien mappé
2. Dans l'explorateur, aller à `Z:\F - UTILITAIRES\TODOX`
3. Si erreur, reconfigurer le lecteur réseau

### Problème : "Lock timeout" ou "Impossible d'acquérir le verrou"

**Cause** : Un autre utilisateur est en train de sauvegarder, ou un verrou est resté bloqué.

**Solution** :
1. Attendre quelques secondes et réessayer
2. Si le problème persiste, supprimer le fichier `Z:\F - UTILITAIRES\TODOX\data.json.lock`

### Problème : Les changements des autres n'apparaissent pas

**Vérifications** :
1. L'auto-reload est activé (toutes les 10 secondes)
2. Le fichier `data.json` est bien partagé sur Z:
3. Les deux utilisateurs pointent bien vers le même fichier

### Problème : Conflits fréquents

**Causes possibles** :
- Latence réseau élevée
- Auto-reload désactivé ou trop lent

**Solution** :
- Réduire l'intervalle d'auto-reload (modifier `10000` ms dans `useDataPersistence.ts`)
- Améliorer la connectivité réseau

---

## Limites du système

### Nombre d'utilisateurs simultanés

**Recommandé** : 5-10 utilisateurs maximum

**Raison** :
- Le verrouillage fonctionne bien pour un petit nombre d'utilisateurs
- Au-delà, risque de contentions et timeouts fréquents
- Si besoin de plus d'utilisateurs → migrer vers le **backend API avec PostgreSQL/JSON** (voir `SERVER_MIGRATION.md`)

### Pas d'authentification

Tous les utilisateurs ayant accès à `Z:\` peuvent :
- Lire toutes les tâches
- Modifier toutes les tâches
- Supprimer toutes les tâches

**Si besoin d'authentification** : utiliser le backend API (voir `SERVER_MIGRATION_JSON.md`)

### Synchronisation quasi-temps-réel (10s)

Les changements ne sont **pas instantanés** mais apparaissent dans les 10 secondes.

**Pour du temps-réel instantané** : utiliser le backend API + WebSockets (évolution future)

---

## Migration depuis OneDrive

Si vous aviez des données sur OneDrive, vous pouvez les migrer :

### Méthode 1 : Copie manuelle

1. Aller dans `C:\Users\VotreNom\OneDrive - CEA\DATA\To-Do-X\`
2. Copier le fichier `data.json`
3. Coller dans `Z:\F - UTILITAIRES\TODOX\`

### Méthode 2 : Au premier lancement

To-DoX va automatiquement créer un nouveau fichier vide sur Z:.

Si vous avez des données importantes sur OneDrive :
1. Faire une sauvegarde manuelle de `OneDrive - CEA\DATA\To-Do-X\data.json`
2. Copier le contenu dans le nouveau fichier sur Z:

---

## Évolutions futures possibles

1. **Réduire l'intervalle d'auto-reload** : 5s au lieu de 10s
2. **Notifications visuelles** : Badge pour indiquer quand les données sont rechargées
3. **Backend API** : Authentification + permissions + temps réel
4. **Mode hors ligne** : Queue de modifications à synchroniser à la reconnexion
5. **Logs d'audit** : Qui a modifié quoi et quand

---

**Système prêt à l'emploi ! 🎉**

Pour toute question, consultez les fichiers :
- `SERVER_MIGRATION_JSON.md` : Backend API avec base JSON
- `SERVER_MIGRATION.md` : Backend API avec PostgreSQL
