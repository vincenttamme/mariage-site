/**
 * Configuration du simulateur destiné uniquement aux invités.
 * Les teintes proposées ci-dessous sont une démonstration, pas une palette officielle.
 * Pour changer la palette, modifier uniquement colors et defaultColorId.
 *
 * @typedef {{id:string,label:string,hex:string,status:'allowed'|'forbidden',demonstration:boolean}} DressColor
 * @typedef {{id:string,label:string,ranges:{lightness:[number,number],chroma:[number,number],hue?:[number,number]}[]}} ColorFamily
 * @typedef {{id:string,label:string,url:string|null,clothingMaterials:string[],height?:number,provisional:boolean,source:string|null,license:string|null}} ClothingModel
 * @typedef {{id:string,label:string,modelId:string}} DressCharacter
 * @typedef {{title:string,subtitle:string,palette:{label:string,description:string},forbiddenMessage:string,defaultColorId:string,families:ColorFamily[],colors:DressColor[],models:ClothingModel[],characters:DressCharacter[]}} DressCodeConfig
 */

/** @type {DressCodeConfig} */
export const dressCodeConfig = {
  title: 'Imaginez votre tenue',
  subtitle: 'Découvrez les couleurs pour notre mariage.',
  palette: {
    label: 'Palette de démonstration',
    description: 'Ces couleurs sont proposées pour essayer le simulateur. La palette officielle sera précisée plus tard.',
  },
  forbiddenMessage: 'Le blanc et le bordeaux ne font pas partie des couleurs autorisées.',
  defaultColorId: 'sage',
  // Les familles ci-dessous verrouillent les teintes proches du blanc et du bordeaux,
  // même si une nouvelle pastille était marquée « allowed » par erreur.
  families: [
    { id: 'white', label: 'Blanc, blanc cassé et ivoire', ranges: [{ lightness: [0.93, 1], chroma: [0, 0.035] }] },
    { id: 'burgundy', label: 'Bordeaux et rouge vin', ranges: [{ lightness: [0.16, 0.57], chroma: [0.045, 0.20], hue: [340, 24] }] },
  ],
  colors: [
    { id: 'sage', label: 'Vert sauge', hex: '#81947A', status: 'allowed', demonstration: true },
    { id: 'blue', label: 'Bleu grisé', hex: '#728CA3', status: 'allowed', demonstration: true },
    { id: 'rose', label: 'Rose poudré', hex: '#BA8491', status: 'allowed', demonstration: true },
    { id: 'ochre', label: 'Ocre doux', hex: '#B68A55', status: 'allowed', demonstration: true },
    { id: 'navy', label: 'Bleu nuit', hex: '#34465C', status: 'allowed', demonstration: true },
    { id: 'lavender', label: 'Mauve grisé', hex: '#9989A8', status: 'allowed', demonstration: true },
    { id: 'white', label: 'Blanc', hex: '#FFFFFF', status: 'forbidden', demonstration: false },
    { id: 'ivory', label: 'Ivoire', hex: '#FFFFF0', status: 'forbidden', demonstration: false },
    { id: 'burgundy', label: 'Bordeaux', hex: '#800020', status: 'forbidden', demonstration: false },
    { id: 'wine', label: 'Rouge vin', hex: '#722F37', status: 'forbidden', demonstration: false },
  ],
  // Les deux GLB existants conservent leurs matériaux PBR et leur licence CC0.
  models: [
    {
      id: 'dress', label: 'Robe longue', url: new URL('./models/long-dress.glb', import.meta.url).href,
      clothingMaterials: ['clothing'], height: 1.66, provisional: true,
      source: 'https://github.com/abdulrehman043/humanforge/tree/2226df1f50a04c5a8e1c02ea33780d28337dfbb1',
      license: 'CC0-1.0',
    },
    {
      id: 'suit', label: 'Costume', url: new URL('./models/suit.glb', import.meta.url).href,
      clothingMaterials: ['clothing'], height: 1.82, provisional: true,
      source: 'https://github.com/abdulrehman043/humanforge/tree/2226df1f50a04c5a8e1c02ea33780d28337dfbb1',
      license: 'CC0-1.0',
    },
  ],
  // « Femme » et « Homme » sont des présentations visuelles, pas des règles vestimentaires.
  characters: [
    { id: 'femme', label: 'Femme', modelId: 'dress' },
    { id: 'homme', label: 'Homme', modelId: 'suit' },
  ],
};
