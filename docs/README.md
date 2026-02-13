# Documentation To-DoX

Bienvenue dans la documentation complète du projet To-DoX.

## 🗺️ Roadmap

**[ROADMAP.md](ROADMAP.md)** - Feuille de route et améliorations futures
- 13 améliorations planifiées organisées par priorité
- Système de suivi de progression (TODO/EN COURS/TERMINÉ)
- Estimations de temps et impact pour chaque feature
- Planification des versions futures (v2.1.0, v2.2.0, v3.0.0)

## 📚 Structure de la documentation

### 🚀 [deployment/](deployment/)
Documentation relative au déploiement et aux releases de l'application.

- **[DEPLOIEMENT.md](deployment/DEPLOIEMENT.md)** - Procédure complète de déploiement étape par étape
- **[RELEASE.md](deployment/RELEASE.md)** - Guide de création de releases et système de mise à jour automatique
- **[OPTIMISATIONS.md](deployment/OPTIMISATIONS.md)** - Optimisations CI/CD et workflow GitHub Actions

### ⚙️ [setup/](setup/)
Guides de configuration initiale et d'installation du projet.

- **[ELECTRON_SETUP.md](setup/ELECTRON_SETUP.md)** - Configuration Electron avec auto-updater et système de sécurité
- **[MULTI_USER_SETUP.md](setup/MULTI_USER_SETUP.md)** - Configuration multi-utilisateurs avec accès réseau partagé (Z:)

### 🔄 [migration/](migration/)
Guides de migration vers différentes architectures backend.

- **[SERVER_MIGRATION.md](migration/SERVER_MIGRATION.md)** - Migration vers backend Node.js + Express + PostgreSQL (1502 lignes)
- **[SERVER_MIGRATION_JSON.md](migration/SERVER_MIGRATION_JSON.md)** - Migration vers backend avec base JSON

### 📦 [archive/](archive/)
Documentation historique des refactorings et améliorations passées.

- **[REFACTORING.md](archive/REFACTORING.md)** - Rapport du refactoring majeur (extraction hooks et composants)
- **[RESPONSIVE_IMPROVEMENTS.md](archive/RESPONSIVE_IMPROVEMENTS.md)** - Améliorations responsive
- **[HEADER_PREMIUM_GUIDE.md](archive/HEADER_PREMIUM_GUIDE.md)** - Développement du header premium
- **[FRONTEND_IMPROVEMENTS.md](archive/FRONTEND_IMPROVEMENTS.md)** - Améliorations frontend générales

## 📖 Documentation principale

### Documentation à la racine du projet

- **[../README.md](../README.md)** - Documentation utilisateur finale
  - Installation et utilisation
  - Fonctionnalités principales
  - Technologies utilisées

- **[../CLAUDE.md](../CLAUDE.md)** - Documentation développeur complète (316 lignes)
  - Architecture du projet
  - Stack technique
  - Conventions de code
  - Patterns et hooks
  - Guide complet pour les développeurs

## 🗂️ Organisation

```
docs/
├── README.md              # Ce fichier (index de la documentation)
├── ROADMAP.md             # 🗺️ Feuille de route et améliorations futures
├── deployment/            # 🚀 Déploiement et releases
│   ├── DEPLOIEMENT.md
│   ├── RELEASE.md
│   └── OPTIMISATIONS.md
├── setup/                 # ⚙️ Configuration initiale
│   ├── ELECTRON_SETUP.md
│   └── MULTI_USER_SETUP.md
├── migration/             # 🔄 Migration backend
│   ├── SERVER_MIGRATION.md
│   └── SERVER_MIGRATION_JSON.md
└── archive/               # 📦 Historique
    ├── README.md
    ├── REFACTORING.md
    ├── RESPONSIVE_IMPROVEMENTS.md
    ├── HEADER_PREMIUM_GUIDE.md
    └── FRONTEND_IMPROVEMENTS.md
```

## 🎯 Par où commencer ?

### Je suis un nouvel utilisateur
👉 Commencez par [../README.md](../README.md)

### Je suis un développeur qui rejoint le projet
👉 Lisez [../CLAUDE.md](../CLAUDE.md) puis explorez les dossiers selon vos besoins

### Je veux déployer une nouvelle version
👉 Suivez [deployment/DEPLOIEMENT.md](deployment/DEPLOIEMENT.md)

### Je veux configurer le multi-utilisateurs
👉 Consultez [setup/MULTI_USER_SETUP.md](setup/MULTI_USER_SETUP.md)

### Je veux migrer vers un backend serveur
👉 Choisissez entre [migration/SERVER_MIGRATION.md](migration/SERVER_MIGRATION.md) (PostgreSQL) ou [migration/SERVER_MIGRATION_JSON.md](migration/SERVER_MIGRATION_JSON.md) (JSON)

### Je veux comprendre l'historique du projet
👉 Explorez [archive/](archive/)

### Je veux contribuer ou voir les améliorations prévues
👉 Consultez [ROADMAP.md](ROADMAP.md)

## 🔧 Scripts utiles

Le projet inclut un script PowerShell de déploiement automatisé :

```powershell
# À la racine du projet
.\deploy.ps1 -Version "1.4.1" -Message "Description de la release"
```

Voir [deployment/DEPLOIEMENT.md](deployment/DEPLOIEMENT.md) pour plus de détails.

## 📝 Maintenance de la documentation

Cette documentation est organisée de manière thématique :
- **deployment/** : Tout ce qui concerne la mise en production
- **setup/** : Tout ce qui concerne la configuration initiale
- **migration/** : Tout ce qui concerne les changements d'architecture
- **archive/** : Historique et décisions passées

Lors de l'ajout de nouvelle documentation :
1. Identifiez la catégorie appropriée
2. Placez le fichier dans le bon dossier
3. Mettez à jour ce README si nécessaire

---

*Dernière mise à jour : 2026-02-11*
