# Archive - Documentation historique

Ce dossier contient la documentation historique des refactorings et améliorations passées du projet To-DoX.

## Fichiers archivés

### REFACTORING.md
Rapport complet du refactoring majeur qui a extrait la logique métier en hooks personnalisés :
- Création de `useFilters`, `useDataPersistence`, `useDragAndDrop`
- Extraction des composants `KanbanHeader` et `KanbanBoard`
- Réduction de ToDoX.tsx de 535 à 216 lignes (-60%)

**Date** : Refactoring effectué avant la version 2.0.0
**Impact** : Architecture actuelle du projet

---

### RESPONSIVE_IMPROVEMENTS.md
Documentation des améliorations responsive de l'interface utilisateur.

**Date** : Amélioration progressive de l'UI
**Impact** : Design responsive actuel

---

### HEADER_PREMIUM_GUIDE.md
Guide de développement du header premium avec filtres avancés et barre de projets actifs.

**Date** : Développement de l'interface premium
**Impact** : Header actuel de l'application

---

### FRONTEND_IMPROVEMENTS.md
Liste des améliorations frontend générales apportées au fil du temps.

**Date** : Améliorations continues
**Impact** : Interface utilisateur actuelle

---

## Pourquoi ces fichiers sont archivés ?

Ces documents décrivent des **travaux déjà effectués** et intégrés dans le projet. Ils sont conservés pour :
- 📚 **Référence historique** : Comprendre les décisions architecturales passées
- 🔍 **Traçabilité** : Savoir pourquoi certains choix ont été faits
- 📖 **Apprentissage** : Documenter les bonnes pratiques appliquées

## Documentation active

Pour la documentation à jour du projet, consultez :
- [README.md](../../README.md) - Documentation utilisateur
- [CLAUDE.md](../../CLAUDE.md) - Documentation développeur complète
- [DEPLOIEMENT.md](../../DEPLOIEMENT.md) - Guide de déploiement
- [RELEASE.md](../../RELEASE.md) - Processus de release

---

*Dernière mise à jour : 2026-02-10*
