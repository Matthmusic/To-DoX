# Icône de l'application

## Fichier requis

Placez une icône nommée `icon.png` dans ce dossier pour l'application Electron.

## Spécifications

- **Format** : PNG avec transparence
- **Dimensions** : 512x512 pixels (ou 1024x1024 pour meilleure qualité)
- **Fond** : Transparent
- **Contenu** : Logo To-DoX

## Conversions automatiques

electron-builder convertira automatiquement `icon.png` vers :
- `.ico` pour Windows
- `.icns` pour macOS
- `.png` (différentes tailles) pour Linux

## Recommandations de design

1. Utilisez des formes simples et reconnaissables
2. Évitez les détails trop fins (l'icône sera affichée en petite taille)
3. Privilégiez des couleurs vives et contrastées
4. Testez l'icône sur fond clair et fond sombre

## Création rapide

Vous pouvez utiliser le logo SVG existant `To DoX (500 x 250 px).svg` comme base :

1. Ouvrir le SVG dans un éditeur (Inkscape, Figma, Illustrator)
2. Adapter le format carré (512x512px)
3. Centrer le contenu
4. Exporter en PNG avec transparence
5. Sauvegarder comme `icon.png`

## Alternative temporaire

Si vous n'avez pas d'icône personnalisée, vous pouvez :
1. Télécharger une icône générique de checklist/todo depuis [Flaticon](https://www.flaticon.com)
2. Ou utiliser un générateur comme [favicon.io](https://favicon.io/)
3. S'assurer qu'elle est libre de droits ou sous licence appropriée

## Vérification

Pour tester votre icône :
```bash
npm run build:electron
```

L'icône sera visible dans le fichier généré et dans la barre des tâches/dock.
