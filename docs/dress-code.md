# Simulateur de tenues — guide de maintenance

Le module est intégré à `infos.html#dress-code`, accessible depuis « Imaginer ma tenue » et la FAQ « L’esprit des tenues ». Il fonctionne sur un hébergement statique, sans compte, API, base de données ni service 3D distant.

**État artistique : provisoire.** Les personnages sont de vrais modèles anatomiques texturés, sous CC0, avec des vêtements distincts. Les visages, coiffures et drapés n’atteignent pas encore la qualité photographique demandée. L’interface le signale explicitement. Le remplacement des modèles est indépendant des règles et de l’interface. Voir `dress-code/models/SOURCES.md` pour les sources, les licences et l’inventaire des ressources encore nécessaires.

## Audit et choix d’intégration

Audit effectué sur `main@cec950d60336b389c4c4e4f958d875a11356b8ea` :

- Site de Léa et Vincent, domaine `leaetvincent.fr`, constitué de pages HTML statiques.
- En-tête, pied de page et formulaire RSVP chargés depuis `partials/` par `script.js`.
- Aucun framework, aucune bibliothèque 3D, aucun modèle 3D et aucune chaîne de construction préexistante.
- Présence de `.nojekyll` et de `CNAME` : la publication du dossier racine doit continuer à fonctionner directement.
- Identité existante conservée : Arsenica pour les titres, Mulish pour le texte, fond ivoire, encre prune et détails champagne.
- La FAQ « L’esprit des tenues » existe déjà sur Infos pratiques : cette page reçoit le simulateur.
- Le formulaire RSVP, les galeries, les vidéos, le programme, la navigation et leurs scripts sont conservés.
- Les couleurs du décor du site ne deviennent pas des recommandations vestimentaires. La palette de démonstration reste distincte de la palette officielle, actuellement vide.
- Les cinq rôles demandés sont représentés par six silhouettes. Aucun modèle n’est réservé à un rôle ou à un genre.
- Le blanc et le bordeaux restent interdits pour tous les rôles ; aucune exception n’est préactivée pour les mariés.

Le module adopte une composition de studio : personnages au centre, choix à droite sur grand écran, puis sous la scène sur mobile. La comparaison occupe toute la largeur. L’enjeu visuel est de voir l’harmonie du groupe après avoir changé une seule tenue.

## Modifier les couleurs

Tout se trouve dans **`dress-code/config.js`**, lu directement par le navigateur. Une modification de la palette ne demande pas de reconstruire Three.js.

Chaque couleur possède un identifiant stable, un nom français, une valeur hexadécimale, un statut et un indicateur de démonstration :

```js
{
  id: 'sage',
  label: 'Vert sauge',
  hex: '#81947A',
  status: 'allowed',
  demonstration: true,
}
```

Les statuts possibles sont `recommended`, `allowed`, `reserved` et `forbidden`. Ils correspondent à « Recommandée », « Autorisée », « Réservée » et « Interdite ». Les textes et icônes sont dans `statuses`.

Pour publier la future palette officielle :

1. Ajouter ou modifier les couleurs dans `colors`, en conservant les identifiants déjà utilisés dans `characters`.
2. Mettre `demonstration: false` uniquement pour les couleurs réellement validées par les mariés.
3. Ajouter les identifiants des couleurs recommandées dans `palette.officialRecommended`, ou utiliser les règles de recommandation du rôle concerné.
4. Adapter `palette.label` et `palette.description` pour annoncer la vraie palette.
5. Exécuter `npm test` et vérifier le rendu. Une couleur de démonstration ne peut jamais recevoir le statut « Recommandée », même si elle figure par erreur dans une liste de recommandations.

Ne pas supprimer une couleur encore utilisée par une composition initiale. Les interdictions restent prioritaires sur les simples listes de couleurs autorisées ou recommandées.

## Règles, familles et exceptions

`families` contient des plages **OKLCH explicites et ajustables**. Ces mesures servent uniquement à reconnaître une famille. Les règles métier de `globalRules` et `roles` déterminent ensuite le statut.

| Famille | Luminosité L | Chroma C | Teinte H |
| --- | --- | --- | --- |
| Blanc, blanc cassé, ivoire | 0,93 à 1 | 0 à 0,035 | Toutes |
| Bordeaux et rouge vin | 0,16 à 0,57 | 0,045 à 0,20 | 340° à 360°, puis 0° à 24° |

Les bornes sont inclusives. Ce sont des seuils de travail testés, pas une mesure objective de la couleur d’un tissu en conditions réelles. Les tests couvrent les blancs proches, des rouges bordeaux connus, des valeurs adjacentes aux seuils, et des contre-exemples : bleu ou jaune clair, rose, gris, rouge sombre, violet et brun.

Une règle cible exactement une propriété : `{ colorId: 'white' }`, `{ familyId: 'white' }` ou `{ hex: '#FFFFFF' }`.

Par défaut, chaque rôle utilise `mode: 'extend'` et ajoute ses règles aux règles globales. `mode: 'override'` remplace explicitement les listes globales pour ce rôle, mais ne supprime pas les interdictions portées par le catalogue des couleurs.

**Pour autoriser une couleur réservée ou interdite à un rôle, ajouter une exception explicite.** L’exemple suivant est une instruction de configuration : il n’est pas activé dans le site livré.

```js
// Dans roles, pour le rôle concerné, et uniquement après décision des mariés :
rules: {
  mode: 'extend',
  recommended: [], allowed: [], reserved: [], forbidden: [],
  exceptions: [
    {
      familyId: 'white',
      status: 'allowed',
      message: 'Cette couleur est autorisée pour ce rôle.',
    },
  ],
}
```

Une exception exacte (`colorId` ou `hex`) prime sur une exception de famille. Entre exceptions de même précision, le statut le plus restrictif prime. Une restriction ne disparaît pas parce qu’une couleur figure aussi dans une liste `allowed`. Les rôles, couleurs ou modèles inconnus provoquent une erreur explicite au lieu de recevoir une exemption implicite.

Les couleurs interdites restent sélectionnables pour la visualisation : elles gardent toujours leur statut et leur explication. Le comparateur remplace les couleurs non conformes dans sa variante conforme. La variante « à éviter » conserve les choix interdits existants ou introduit un exemple réellement interdit pour le rôle concerné. Les modèles, rôles, cadrages et éclairages restent comparables ; votre composition initiale est préservée. Si la configuration ne permet pas de créer ces deux variantes, un message l’explique.

## Modifier le groupe ou les modèles

`characters` définit la composition initiale. Exemple :

```js
{ id: 'invite', label: 'Silhouette 6', role: 'invites', modelId: 'suit', colorId: 'ochre' }
```

Les identifiants des personnages doivent être uniques. Le nombre de silhouettes peut changer. Le moteur calcule leur disposition à partir des dimensions des modèles, avec deux rangées décalées dans les vues étroites.

`models` définit les GLB, leur hauteur, le nom des matériaux recolorables, leur provenance et leur statut artistique. Une URL calculée avec `new URL('./models/mon-modele.glb', import.meta.url).href` continue à fonctionner si le site est publié dans un sous-dossier.

Chaque fichier livré expose un matériau `clothing`. Il inclut les parties principales de la tenue, chemise comprise pour les costumes. La peau, les cheveux, les yeux et les chaussures ont d’autres matériaux. Les textures et géométries sont partagées entre les instances ; les matériaux vestimentaires sont clonés par personnage. Changer une tenue ne recolore donc pas les autres personnages.

Le sélecteur « Silhouette et tenue » choisit un modèle habillé complet. Il ne transfère pas encore un vêtement entre toutes les morphologies. Tous les modèles restent sélectionnables pour tous les rôles.

Après remplacement d’un GLB, vérifier ses matériaux, ses dimensions et sa licence de redistribution. Le moteur refuse de recolorer un fichier dont les matériaux configurés sont introuvables. Les modèles actuels utilisent `KHR_mesh_quantization`, des textures intégrées de taille réduite et des poses figées ; ils n’exigent pas de décodeur distant.

## Intégrer le module ailleurs

Copier le dossier `dress-code/` puis ajouter ces trois éléments dans une page servie en HTTP(S) :

```html
<link rel="stylesheet" href="./dress-code/simulator.css">
<wedding-dress-code></wedding-dress-code>
<script type="module" src="./dress-code/simulator.js"></script>
```

Le composant hérite des variables typographiques et chromatiques du site, avec des valeurs de repli. Ses styles sont limités à `.dc-simulator` et `.dc-section`. Pour un site sans les styles de Léa et Vincent, définir les variables `--font-body`, `--font-serif`, `--bg-main` et `--text-ink-primary` sur le conteneur si souhaité.

Pour un montage manuel avec une configuration distincte :

```js
import { mountDressCode } from './dress-code/simulator.js';
import { dressCodeConfig } from './dress-code/config.js';

const instance = mountDressCode(document.querySelector('#mon-simulateur'), dressCodeConfig);
// Lorsque votre application retire cette vue :
instance.destroy();
```

La balise personnalisée appelle automatiquement `destroy()` lorsqu’elle est retirée du DOM. Le dossier peut être servi tel quel : ni import map, ni CDN Three.js, ni compilation côté visiteur. L’ouverture directe en `file://` n’est pas une méthode de test adaptée aux modules JavaScript et aux fragments HTML du site.

## Développement et publication statique

Node.js 22 ou plus récent :

```sh
npm ci
npm run dev
```

Puis ouvrir `http://127.0.0.1:4173/infos.html#dress-code`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:browser
```

`npm run build` compile uniquement le moteur Three.js vers `dress-code/scene.bundle.js`, conserve ses mentions de licence et copie les fichiers du site dans `dist/`. Le bundle est versionné pour maintenir la publication statique de la racine sans changer l’hébergement existant. Après une modification de `scene.js`, reconstruire et versionner le bundle mis à jour. Les modifications de configuration, d’interface et de CSS sont directement lisibles par le navigateur.

Les outils et dépendances de génération des personnages sont facultatifs. Ils ne sont pas nécessaires à la construction normale ; voir `dress-code/models/SOURCES.md` pour la reproduction de ces assets.

## Chargement, accessibilité et limites

Le moteur est importé uniquement à proximité de la scène. Avec l’économie de données du navigateur, le visiteur choisit de charger la 3D. Les personnages arrivent progressivement ; un GLB partagé n’est téléchargé qu’une fois par scène. Le pixel ratio est plafonné et peut baisser lors d’interactions coûteuses. Aucun mouvement automatique n’est imposé. Les images sont calculées à la demande, suspendues hors écran et lorsque l’onglet est masqué.

La comparaison utilise un seul contexte WebGL : deux cadrages scindés sur grand écran, un sélecteur de variante en vue étroite. Les boutons de rotation, zoom et sélection, les listes natives et les noms/statuts textuels offrent les mêmes fonctions essentielles au clavier. Le composant respecte la réduction des mouvements. L’information n’est jamais portée uniquement par une couleur.

Sans WebGL, après erreur de chargement ou perte de contexte, les palettes, rôles, statuts et comparaisons restent utilisables dans la vue couleurs. Les choix sont conservés, et la 3D peut être relancée. Une vue couleurs peut également être choisie volontairement.

Les résultats de vérification réellement exécutés, les captures inspectées et les limites de mesure figurent dans `docs/dress-code-verification.md`. Aucune performance sur téléphone réel n’est présumée à partir du poids des fichiers ou de tests automatisés sur ordinateur.
