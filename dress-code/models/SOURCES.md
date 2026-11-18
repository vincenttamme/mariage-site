# Modèles 3D : sources, licences et limites

## Statut visuel

**Collection provisoire, non photoréaliste.** Ces modèles comportent une véritable anatomie maillée, des textures de peau, des vêtements volumétriques et des matériaux distincts. Ils ne représentent pas Léa, Vincent ou leurs proches. Les visages, les cheveux, le drapé et les chaussures ne constituent pas encore le résultat photographique souhaité pour la version définitive.

Les proportions, carnations, âges et morphologies sont variés. Chaque rôle peut recevoir n’importe lequel des modèles : le code du simulateur n’impose aucune restriction vestimentaire liée au genre. Le rendu utilise des poses statiques différentes ; il ne simule pas les mouvements des tissus.

## Origine et droits

Les fichiers distribués sont des adaptations d’assets **CC0 1.0** du projet MakeHuman, préparés à partir du paquet compilé de [HumanForge](https://github.com/abdulrehman043/humanforge), révision exacte `2226df1f50a04c5a8e1c02ea33780d28337dfbb1`. Le paquet déclare les licences et auteurs par élément dans son fichier `LICENSE.ASSETS.md`, conservé ici sous `UPSTREAM-ASSETS.md`. Le code de HumanForge est sous licence MIT (texte intégral dans `LICENSE-HUMANFORGE-MIT.txt`), mais seul son résultat CC0 est livré au navigateur ; aucun runtime HumanForge ne fait partie du site.

Sources primaires et preuves de licence :

- [Licence des assets MakeHuman](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md) et [FAQ officielle](https://www.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html).
- [Licence des assets MPFB2](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.ASSETS.md). Copie intégrale dans `LICENSE-CC0.txt`.
- [Pack officiel dress01](https://static.makehumancommunity.org/assets/assetpacks/dress01.html), variante CC0.
- [Pack officiel suits01](https://static.makehumancommunity.org/assets/assetpacks/suits01.html), variante CC0.
- [Pack officiel hair01](https://static.makehumancommunity.org/assets/assetpacks/hair01.html), variante CC0.
- [Catalogue système MakeHuman](https://www.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html).

CC0 permet notamment la modification et la redistribution des fichiers dans un hébergement Web statique. Aucune ressource Renderpeople ni modèle soumis à une licence propriétaire ou non vérifiée n’est inclus.

| Fichier | Vêtement source | Auteur du vêtement | Coiffure | Licence |
| --- | --- | --- | --- | --- |
| `suit.glb` | `toigo_male_suit_3` — [source](http://www.makehumancommunity.org/node/1733) | Margaret Toigo | `short02`, équipe MakeHuman | CC0-1.0 |
| `long-dress.glb` | `toigo_halter_dress_with_fluted_skirt` — [source](http://www.makehumancommunity.org/node/1855) | Margaret Toigo | `ponytail01`, équipe MakeHuman | CC0-1.0 |
| `short-dress.glb` | `toigo_halter_dress_knee_length` — [source](http://www.makehumancommunity.org/node/1853) | Margaret Toigo | `toigo_curled_under_bob` — [source](http://www.makehumancommunity.org/node/1677), Margaret Toigo | CC0-1.0 |
| `tailored-suit.glb` | `toigo_female_suit_2` — [source](http://www.makehumancommunity.org/node/1739) | Margaret Toigo | `short01`, équipe MakeHuman | CC0-1.0 |

Les corps, morphologies, squelettes de préparation et poids proviennent de MakeHuman/MPFB2. Les textures de peau, yeux, sourcils, cils, dents, langue et chaussures `shoes04` proviennent du paquet système CC0. Les peaux utilisées sont `young_caucasian_male`, `young_african_female`, `young_asian_female` et `middleage_caucasian_female` ; ces identifiants techniques sont ceux des sources, pas des catégories proposées au public.

## Adaptations réalisées

Le script `scripts/prepare-dress-code-models.mjs` prépare les fichiers hors ligne :

1. Il configure quatre morphologies adultes et ajuste les vêtements à chacune.
2. Il abaisse les bras, ajuste légèrement les avant-bras et la tête, puis fige la pose dans la géométrie.
3. Il réduit les motifs colorés d’origine en une base textile neutre. Les volumes, coutures, cartes normales disponibles et propriétés de rugosité sont conservés ; la réduction des imprimés permet de lire la couleur choisie.
4. Il isole le matériau recolorable nommé exactement `clothing`. La peau, les cheveux, les yeux et les chaussures ne changent pas de couleur avec la tenue.
5. Il retire les parties de cuisses cachées qui traversaient la robe courte, les chaussures entièrement cachées sous la robe longue et les chaussettes hautes de la robe courte. Les chevilles visibles de cette dernière sont restaurées.
6. Il réduit les textures : peau et vêtement jusqu’à 1 024 px, cheveux et chaussures jusqu’à 512 px, petits détails du visage jusqu’à 256 px. Les cartes normales restent à 512 px ; JPEG est utilisé pour les textures opaques, PNG pour les éléments qui exigent un canal alpha.
7. Il soude et déduplique les données, supprime les données devenues inutiles et quantifie la géométrie (`KHR_mesh_quantization`, pris en charge par GLTFLoader sans décodeur supplémentaire).

Les fichiers sont autonomes : aucune texture distante, appel à un fournisseur, clé API ou requête à un service de modèles n’est nécessaire pendant la visite. Les rigs et morph targets de création ne sont pas livrés. Les quatre fichiers totalisent **6 341 260 octets** ; le chargement de plusieurs personnages utilisant un même modèle réutilise le fichier en cache.

| Modèle | Octets | Triangles | Hauteur du fichier | Largeur |
| --- | ---: | ---: | ---: | ---: |
| Costume | 1 587 252 | 47 806 | 1,819 m | 0,545 m |
| Robe longue | 1 387 396 | 40 462 | 1,655 m | 1,069 m |
| Robe courte | 1 600 492 | 39 926 | 1,495 m | 0,457 m |
| Ensemble tailleur | 1 766 120 | 48 216 | 1,608 m | 0,469 m |

`inventory.json` conserve les mesures non arrondies, les paramètres de génération et la révision source. Ces mesures décrivent les fichiers réellement créés. Elles ne constituent pas une mesure de fluidité ou de chargement sur un téléphone.

## Reproduction hors ligne de la préparation

Les dépendances de préparation sont facultatives et isolées du site. La construction normale du site réutilise les GLB livrés et ne régénère pas les personnages.

Depuis la racine du dépôt, sur un environnement disposant de Git et de Node.js :

```sh
mkdir -p .asset-tools

git clone https://github.com/abdulrehman043/humanforge.git .asset-tools/humanforge
git -C .asset-tools/humanforge checkout 2226df1f50a04c5a8e1c02ea33780d28337dfbb1

npm install --prefix .asset-tools --no-save --no-audit --no-fund three@0.186.1 tsx@4.23.15 @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 sharp@0.35.5 fflate@0.8.3

cd .asset-tools
node --import tsx ../scripts/prepare-dress-code-models.mjs ./humanforge ../dress-code/models
```

Les archives originales MakeHuman ne sont pas téléchargées par ce script : les assets compilés CC0 sont déjà présents dans la révision source indiquée. Après toute modification de morphologie ou de tenue, inspecter de nouveau les modèles de face, de dos et de profil pour vérifier les intersections et les matériaux. Les couleurs intégrées aux GLB sont des teintes de travail destinées à l’aperçu hors ligne ; le simulateur les remplace par la composition définie dans `dress-code/config.js` avant affichage.

## Ressources encore nécessaires pour atteindre la direction artistique définitive

Il faut une petite collection de personnages de qualité photographie de mode, avec visages et cheveux mieux définis, coupes plus contemporaines et véritables plis de vêtements. Au minimum : un costume complet, une robe longue, une robe courte et un ensemble tailleur, sur des silhouettes adultes variées. Préférer des poses statiques naturelles et une apparence cohérente d’un modèle à l’autre.

Chaque remplacement doit fournir : un GLB optimisé, des matériaux distincts peau/cheveux/vêtements/chaussures/accessoires, un tissu neutre recolorable avec ses cartes PBR, des dimensions cohérentes et une licence autorisant explicitement la distribution des fichiers dans ce site et son dépôt. La qualité du modèle doit être validée dans le vrai rendu WebGL, et pas uniquement dans une image promotionnelle du fournisseur. Cette étape artistique reste ouverte ; les modèles présents ne la déclarent pas accomplie.
