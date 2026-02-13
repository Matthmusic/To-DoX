# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [2.1.1] - 2025-02-13

### 🐛 Corrections
- **TitleBar thématique** : La barre de titre suit maintenant les thèmes actifs
  - Fond et bordures adaptés au thème
  - Logo coloré avec la couleur primaire du thème
  - Icônes de contrôle avec hover states thématiques
- **Corrections TypeScript** : Nettoyage des erreurs de compilation
  - Suppression des props non supportées sur Autocomplete
  - Suppression des imports et variables non utilisées

---

## [2.1.0] - 2025-02-13

### ✨ Nouvelles fonctionnalités

#### 🔔 Système de notifications amélioré
- **Filtrage par utilisateur** : Les notifications ne s'affichent que pour les tâches assignées à l'utilisateur connecté
- **Activation après connexion** : Les notifications démarrent automatiquement après la sélection du compte utilisateur
- **Sélection du son** : 6 sons de notification au choix
  - 💧 Goutte d'eau
  - 🎵 Accord musical
  - ✨ Pop-up
  - 🔔 Classique (par défaut)
  - 😮 Gasp UI
  - 📱 Message
- **Aperçu audio** : Bouton de test pour écouter chaque son avant de choisir
- **Son personnalisé** : Chaque utilisateur peut choisir son son préféré

### 🔧 Améliorations
- Meilleure expérience utilisateur dans le panneau de notifications
- Interface de sélection de son intuitive avec radio buttons
- Gestion intelligente du cache de notifications (réinitialisation toutes les 24h)

### 🐛 Corrections
- Les notifications ne se déclenchent plus avant la connexion utilisateur
- Amélioration de la gestion des erreurs lors de la lecture audio

---

## [2.0.1] - 2025-02-XX

### 🔧 Améliorations
- Améliorations de stabilité
- Corrections de bugs mineurs

---

## [2.0.0] - 2025-01-XX

### ✨ Nouvelles fonctionnalités
- Système multi-utilisateurs
- Gestion des permissions et des rôles
- Interface utilisateur repensée

---

## Légende des types de changements

- ✨ **Nouvelles fonctionnalités** : Ajout de nouvelles capacités
- 🔧 **Améliorations** : Amélioration de fonctionnalités existantes
- 🐛 **Corrections** : Correction de bugs
- ⚠️ **Dépréciations** : Fonctionnalités marquées comme obsolètes
- 🔥 **Suppressions** : Fonctionnalités supprimées
- 🔒 **Sécurité** : Corrections de vulnérabilités de sécurité
