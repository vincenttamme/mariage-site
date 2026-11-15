# Simulateur de tenues — vérifications et limites

## État de livraison

Le module fonctionnel est intégré à `infos.html#dress-code`. Le site conserve sa publication statique, sa navigation et son formulaire RSVP. La configuration n’active aucune exception pour les mariés et ne contient aucune palette officiellement recommandée.

**La validation artistique finale reste ouverte.** Les quatre GLB livrés sont des personnages anatomiques texturés avec de vrais vêtements et des matériaux séparés. Ils sont explicitement provisoires dans la configuration, l’interface et les crédits. Les visages, les cheveux, le tombé des tissus et certaines chaussures ne répondent pas encore à une exigence de photographie de mode. Les tests fonctionnels ne valident pas cette exigence.

## Commandes exécutées

| Vérification | Résultat observé |
| --- | --- |
| `npm run lint` | Réussite, aucun diagnostic ESLint |
| `npm run typecheck` | Réussite, aucun diagnostic TypeScript sur les modules JavaScript vérifiés |
| `npm test` | **37 tests réussis, 0 échec** |
| `npm run build` | Réussite, bundle du moteur et site statique produits |
| `git diff --cached --check` | Réussite ; les espaces des chaînes GLSL du bundle généré sont conservés et exclus de ce contrôle par `.gitattributes` |
| Scénarios Playwright de `tests/dress-code-browser.spec.js` | **7 scénarios réussis, 0 échec**, exécutés séparément dans cet environnement |

Les tests unitaires couvrent les valeurs de référence des conversions de couleurs, les familles blanc et bordeaux, les bornes adjacentes, les faux positifs, les cinq rôles, les exceptions et leur priorité, les recommandations de démonstration, l’immuabilité, la modification d’un seul personnage, les changements de rôle et de modèle, la réinitialisation et les variantes de comparaison. Quatre contrôles supplémentaires inspectent réellement les GLB : fichiers autonomes, extension supportée, matériaux vestimentaires séparés et métadonnées de licence.

### Scénarios navigateur

| Scénario | Vérifications principales |
| --- | --- |
| Parcours 3D et interactions | Chargement différé, six personnages et quatre modèles en cache, matériaux vestimentaires indépendants, sélection et recoloration isolée, rôle, comparaison avec un seul canevas, retour à la composition, clavier, focus, rotation, zoom, réinitialisation, absence de mutation de la configuration |
| Chargements concurrents | Réponses GLB volontairement retardées, changements rapides de tenue, conservation de la dernière demande et des six personnages |
| WebGL indisponible | Vue couleurs, sélection, recoloration, comparaison, exception de rôle configurée puis retour aux règles globales |
| Erreur réseau et reprise | Réponse 503 d’un modèle, repli fonctionnel, nouvelle tentative et conservation des choix |
| Retrait du composant | Suppression pendant une requête de modèle en cours, absence de canevas et d’effets tardifs après destruction |
| Site existant | Navigation mobile, accès au programme et au RSVP, champs remplissables, **aucune soumission du formulaire** |
| Adaptation aux écrans | Largeurs 320, 375, 390, 720, 768 et 1440 px, absence de débordement horizontal, variantes côte à côte ou bascule selon la largeur réelle de la scène |

Le premier scénario provoque aussi une **véritable perte de contexte** avec `WEBGL_lose_context` et vérifie que la vue couleurs conserve l’état. Il observe l’arrêt des images lorsque la scène est immobile et lorsqu’elle est hors écran.

La vérification visuelle ne se limite pas à compter les éléments DOM : les captures de la scène ont été décodées et contrôlées pour confirmer la présence de pixels des personnages. Les captures de comparaison ont été vérifiées à 320, 390, 768 et 1440 px.

### Environnement et reproductibilité

- Node.js 24.22.1, Linux, Playwright 1.65.1.
- Chromium 153 en mode sans interface, avec rendu logiciel SwiftShader.
- Dans cet environnement, le navigateur système ne peut pas créer les sockets dont il a besoin. Le téléchargement du navigateur Playwright officiel a également renvoyé une page d’indisponibilité. Les tests ont donc utilisé le paquet temporaire `@sparticuz/chromium@153.0.0`, installé **hors du dépôt**.
- Ce navigateur temporaire exige un processus Playwright neuf pour chaque scénario. Les sept scénarios ont tous réussi de cette manière ; le lancement groupé standard n’est pas présenté comme ayant réussi ici.
- La configuration accepte `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` et `PLAYWRIGHT_CHROMIUM_ARGS` pour un navigateur fourni par l’environnement. Elle ne contient aucun chemin local imposé.
- Les ressources HTTPS externes ont été neutralisées dans les tests pour éviter de dépendre des CDN du site. La police Arsenica locale est présente ; la police de corps peut donc utiliser sa police de repli dans les captures.

Dans un environnement Playwright habituel :

```sh
npm ci
npm run build
npx playwright install chromium --only-shell
npm run test:browser
```

Les captures de très grands éléments dépassant l’écran vidaient la surface WebGL avec ce navigateur temporaire. Les captures conservées portent sur la scène visible, après deux images navigateur. Le moteur n’a pas reçu d’option de conservation permanente du tampon pour contourner cette particularité des captures.

## Captures inspectées

Ces images proviennent du navigateur exécutant le site construit. Ce ne sont pas des rendus de présentation ajoutés à l’interface.

| Vue | Capture |
| --- | --- |
| Groupe, écran 1440 px | [dress-code-1440.png](previews/dress-code-1440.png) |
| Groupe, écran 768 px | [dress-code-768.png](previews/dress-code-768.png) |
| Groupe, écran 390 px | [dress-code-390.png](previews/dress-code-390.png) |
| Groupe, écran 320 px | [dress-code-320.png](previews/dress-code-320.png) |
| Comparaison, écran 1440 px | [dress-code-comparison-1440.png](previews/dress-code-comparison-1440.png) |
| Comparaison, écran 320 px | [dress-code-comparison-320.png](previews/dress-code-comparison-320.png) |

À 320 px, les six visages sont visibles, mais la tenue de la silhouette la plus petite, au second rang, est partiellement masquée par le costume du premier rang. La rotation aide à l’inspecter. La composition mobile mérite donc encore une retouche artistique avant validation finale.

## Poids mesurés

Valeurs issues des fichiers réellement livrés, sans inclure le reste du site :

| Ressource | Octets |
| --- | ---: |
| `suit.glb` | 1 587 252 |
| `long-dress.glb` | 1 387 396 |
| `short-dress.glb` | 1 600 492 |
| `tailored-suit.glb` | 1 766 120 |
| **Total des quatre modèles** | **6 341 260** |
| `scene.bundle.js` | 640 407 |
| `scene.bundle.js`, compression gzip locale | 163 932 |
| `simulator.js` | 23 694 |
| `simulator.css` | 14 681 |

Le poids gzip est une mesure locale du fichier compressé ; il ne prouve pas que l’hébergement active cette compression. Les quatre GLB sont réutilisés pour six participants. Les modèles utilisent des textures intégrées redimensionnées et la quantification géométrique ; aucun décodeur distant ni service de personnages n’est nécessaire à l’exécution.

Un relevé du rendu local a observé 124 appels de dessin, 545 086 triangles comptabilisés avec les passes d’ombres, 37 géométries, 45 textures, un pixel ratio de 1 et 26,1 ms pour une soumission CPU de rendu. Il s’agit d’un échantillon en rendu logiciel, **pas d’une fréquence d’images, d’une mesure GPU ou d’un résultat sur téléphone**. Le moteur rend à la demande et adapte son pixel ratio ; les tests ont effectivement constaté l’arrêt des images à l’arrêt et hors écran.

## Limites restant à valider

1. **Qualité des personnages.** Remplacer ou retravailler la collection provisoire avec des modèles de qualité mode, des coiffures plus fines, des visages plus crédibles, des drapés plus naturels et des matériaux textiles plus riches. Le contrat de matériaux et l’inventaire de remplacement sont documentés dans `dress-code/models/SOURCES.md`.
2. **Morphologies et vêtements.** Le sélecteur change un personnage habillé complet. Il ne permet pas encore d’ajuster chaque vêtement à chaque morphologie. Tous les modèles sont disponibles pour tous les rôles.
3. **Téléphones réels.** Aucun test sur téléphone physique de milieu de gamme, aucune mesure de chauffe, de batterie, de temps de chargement en réseau mobile ou de fréquence d’images GPU n’a été réalisé.
4. **Navigateurs et aides techniques.** Safari, iOS et Firefox n’ont pas été exécutés ici. Les contrôles au clavier, les libellés, les statuts, le focus et la réduction des mouvements ont été vérifiés, mais aucune certification WCAG ni campagne avec lecteur d’écran réel n’est revendiquée.
5. **Couleur et tissu.** L’éclairage, l’écran et la texture modifient la couleur perçue. Les seuils métier sont configurables et testés ; le simulateur n’est pas un outil de mesure physique d’un tissu.
6. **Palette officielle.** Elle reste volontairement vide tant que les mariés ne l’ont pas fournie. Les exemples sont étiquetés comme démonstration et n’obtiennent jamais le statut de recommandation officielle.

## Fichiers créés et modifiés

- `infos.html` : point d’intégration, feuille de style, module JavaScript et liens d’accès ; aucune réécriture du site.
- `.gitignore`, `.gitattributes` : dépendances et rapports locaux exclus ; identification du bundle généré.
- `dress-code/config.js`, `colors.js`, `composition.js` : données éditables, classification et règles, compositions immuables.
- `dress-code/simulator.js`, `simulator.css` : composant réutilisable et interface française, dont le repli 2D.
- `dress-code/scene.js`, `scene.bundle.js`, fichiers de licence Three.js : moteur 3D et bundle statique.
- `dress-code/models/` : quatre GLB, inventaire, sources, licences et page de crédits.
- `scripts/` : construction, serveur local et générateur facultatif de modèles.
- `tests/`, `playwright.config.js`, `eslint.config.js`, `tsconfig.json`, `package.json`, `package-lock.json` : vérification et outillage.
- `docs/dress-code.md`, ce rapport et `docs/previews/` : maintenance, intégration, résultats et preuves visuelles.

Les fichiers partagés `style.css`, `script.js`, `partials/header.html` et les fragments RSVP restent inchangés.
