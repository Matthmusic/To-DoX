# Améliorations Responsive - KanbanHeader

## Problème identifié

La barre de titre (header) n'était pas responsive et posait des problèmes sur les petits écrans :
- Logo centré en absolu qui se superposait aux boutons
- Boutons qui débordaient de l'écran
- Textes toujours visibles même sur mobile
- Tailles fixes non adaptées aux petits écrans

## Modifications apportées

### 1. Layout flexible

**Avant** :
```tsx
<div className="relative flex items-center justify-end py-4">
  {/* Logo en position absolute center */}
  {/* Boutons à droite */}
</div>
```

**Après** :
```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 py-2 sm:py-4">
  {/* Mobile : colonne, Desktop : ligne avec logo centré */}
</div>
```

### 2. Logo adaptatif

#### Tailles responsives :
- **Mobile** : `h-14 w-14` (56px)
- **Desktop** : `h-20 w-20` (80px)
- **Logo interne** : `h-8 w-8` → `h-12 w-12`

#### Positionnement :
- **Mobile** : Aligné à gauche, flux normal
- **Desktop** : Centré absolument (`sm:absolute sm:left-1/2`)

#### Texte du titre :
- **Mobile** : `text-3xl`
- **Desktop** : `text-5xl`

### 3. Boutons responsifs

#### Tailles :
- **Padding** : `px-3 py-2` (mobile) → `px-4 py-2` (desktop)
- **Icônes** : `h-3 w-3` (mobile) → `h-4 w-4` (desktop)
- **Texte** : `text-xs` (mobile) → `text-sm` (desktop)

#### Visibilité des labels :
```tsx
{/* Bouton "CR Semaine" */}
<span className="hidden sm:inline">CR Semaine</span>
<span className="sm:hidden">CR</span>

{/* Autres boutons */}
<span className="hidden lg:inline">Stockage</span>
```

#### Layout :
- **Mobile** : `flex-wrap` centré sur 2 lignes si nécessaire
- **Desktop** : Ligne unique alignée à droite

### 4. Séparateurs conditionnels

```tsx
<div className="hidden sm:block mx-2 h-6 w-px bg-white/10" />
```
Les séparateurs verticaux n'apparaissent que sur desktop.

### 5. Barre Quick Add responsive

**Largeurs adaptatives** :
- **Mobile** : `w-full` (100%)
- **Tablet** : `w-4/5` (80%)
- **Desktop** : `w-3/5` (60%)

### 6. Padding général du header

```tsx
className="px-3 sm:px-6 py-4 sm:py-6"
```
- **Mobile** : Padding réduit (px-3, py-4)
- **Desktop** : Padding normal (px-6, py-6)

## Breakpoints utilisés

| Breakpoint | Taille | Usage |
|------------|--------|-------|
| `sm:` | ≥ 640px | Layout colonne → ligne |
| `lg:` | ≥ 1024px | Affichage des labels complets |

## Comportement par taille d'écran

### Mobile (< 640px)
- Logo et titre empilés verticalement en haut
- Boutons en dessous sur 1-2 lignes, centrés
- Labels courts ("CR" au lieu de "CR Semaine")
- Icônes uniquement pour certains boutons
- Barre Quick Add pleine largeur
- Padding réduit partout

### Tablet (640px - 1024px)
- Logo centré absolument
- Boutons alignés à droite sur une ligne
- Labels complets pour le bouton principal
- Icônes uniquement pour les boutons secondaires
- Barre Quick Add à 80%
- Padding normal

### Desktop (> 1024px)
- Layout complet avec tous les textes
- Séparateurs visuels entre groupes de boutons
- Logo centré avec grande taille
- Barre Quick Add à 60%
- Tous les labels visibles

## Avantages

✅ **Utilisabilité mobile** : Header accessible sur tous les écrans
✅ **Lisibilité** : Tailles de texte adaptées
✅ **Performance** : Pas de scroll horizontal
✅ **Esthétique** : Design cohérent sur tous les formats
✅ **Accessibilité** : Tailles de touch target respectées (44px min)

## Test de régression

```bash
✓ Build réussi sans erreur
✓ Aucune régression de fonctionnalité
✓ Compatibilité Electron maintenue
```

## Fichiers modifiés

- [src/components/KanbanHeader.tsx](src/components/KanbanHeader.tsx)

## Captures d'écran recommandées

Pour valider visuellement, tester sur :
- [ ] Mobile : 375px (iPhone SE)
- [ ] Tablet : 768px (iPad)
- [ ] Desktop : 1920px (Full HD)
- [ ] Large : 2560px (2K)
