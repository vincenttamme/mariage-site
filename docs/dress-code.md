# Simulateur de tenue — configuration simplifiée

Le simulateur présent sur `infos.html#dress-code` est un composant statique sans backend ni CMS. Il affiche exactement **une silhouette** et un seul ensemble vestimentaire à la fois.

## Parcours

1. Choisir une présentation visuelle : **Femme** (robe longue) ou **Homme** (costume).
2. Choisir une couleur dans les pastilles autorisées : le tissu principal change immédiatement.
3. Faire pivoter horizontalement la silhouette au doigt, à la souris ou avec les flèches du clavier.

Il n'y a ni rôle à choisir, ni comparateur, ni configuration de vêtements, ni zoom.

## Palette

Modifier `dress-code/config.js` : les données `colors` contiennent `id`, `label`, `hex`, `status` et `demonstration`; `defaultColorId` fixe la couleur initiale. La palette actuelle est **purement démonstrative** et n'a pas valeur de recommandation officielle.

Les familles `white` (blanc, ivoire et apparentés) et `burgundy` (bordeaux et apparentés) sont systématiquement non sélectionnables. Le contrôle se fait dans `dress-code/colors.js`, indépendamment de l'apparence CSS. Les pastilles bloquées restent visibles et désactivées.

**Attention :** les seuils OKLCH sont une approximation visuelle pour des couleurs numériques. Ils ne constituent pas un contrôle fiable de la teinte d'un tissu réel sous toutes les lumières.

## Modèles

`config.models` contient la correspondance entre le modèle `dress` et `long-dress.glb`, et entre `suit` et `suit.glb`. Les matériaux `clothing` sont isolés : les textures de peau, de cheveux et de chaussures restent inchangées. Les deux GLB réutilisés sont des assets MakeHuman/MPFB sous CC0, actuellement **provisoires et non photoréalistes**. Les fichiers de collection inutilisés restent disponibles dans le dépôt pour traçabilité artistique, mais ne sont pas chargés par le simulateur.

## Publication

Le site est servi directement à partir de sa racine GitHub Pages. La scène utilise `dress-code/scene.bundle.js`, qui doit être régénéré à chaque modification de `scene.js` via `npm run build`.

```sh
npm ci
npm run check
npm run test:browser
```

La CI de la branche régénère et commit le bundle si nécessaire. Sans cette étape, le navigateur utiliserait une ancienne version du moteur malgré le JavaScript mis à jour.

## Qualité

Vérifier le résultat avec et sans WebGL aux largeurs 1440, 768, 390 et 320 px, en particulier le cadrage complet de la robe et du costume, le nuancier visible, les interactions tactiles verticales (défilement de la page), les flèches du clavier et le changement de personnage lors d'un chargement réseau lent.

Les traitements 3D reprennent le cache par URL et les procédures de libération des ressources du moteur précédent. Les deux modèles sont chargés à la demande, pas en même temps.
