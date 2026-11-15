/**
 * Configuration métier du simulateur. Les modèles n'imposent aucune règle.
 * Les teintes de démonstration ne constituent pas la palette officielle.
 *
 * Une règle cible UNE propriété : colorId, familyId ou hex.
 * Les règles d'un rôle étendent les règles globales par défaut.
 * mode: 'override' remplace explicitement les listes de règles globales.
 * Une exception de rôle est la seule façon d'assouplir une interdiction :
 * { familyId: 'white', status: 'allowed', message: 'Votre explication.' }
 * Aucune exception n'est activée, y compris pour les mariés.
 */

/** @typedef {'recommended'|'allowed'|'reserved'|'forbidden'} ComplianceStatus */
/** @typedef {{colorId?: string, familyId?: string, hex?: string}} RuleSelector */
/** @typedef {RuleSelector & {status: ComplianceStatus, message?: string}} RuleException */
/** @typedef {{recommended: RuleSelector[], allowed: RuleSelector[], reserved: RuleSelector[], forbidden: RuleSelector[]}} RuleLists */
/** @typedef {RuleLists & {mode: 'extend'|'override', exceptions: RuleException[]}} RoleRules */
/** @typedef {{id: string, label: string, rules: RoleRules, messages: Partial<Record<ComplianceStatus, string>>}} DressRole */
/** @typedef {{id: string, label: string, hex: string, status: ComplianceStatus, demonstration: boolean}} DressColor */
/** @typedef {{lightness: [number, number], chroma: [number, number], hue?: [number, number]}} ColorRange */
/** @typedef {{id: string, label: string, ranges: ColorRange[]}} ColorFamily */
/** @typedef {{id: string, label: string, role: string, modelId: string, colorId: string}} Participant */
/** @typedef {{id: string, label: string, url: string|null, clothingMaterials: string[], height?: number, provisional: boolean, source: string|null, license: string|null}} ClothingModel */
/**
 * @typedef {object} DressCodeConfig
 * @property {string} title
 * @property {string} subtitle
 * @property {{label: string, description: string, officialRecommended: string[]}} palette
 * @property {Record<ComplianceStatus, {label: string, icon: string, message: string}>} statuses
 * @property {ColorFamily[]} families
 * @property {RuleLists} globalRules
 * @property {DressRole[]} roles
 * @property {DressColor[]} colors
 * @property {ClothingModel[]} models
 * @property {Participant[]} characters
 */

/** @returns {RoleRules} */
const inheritedRules = () => ({
  mode: 'extend',
  recommended: [],
  allowed: [],
  reserved: [],
  forbidden: [],
  exceptions: [],
});

/** @type {DressCodeConfig} */
export const dressCodeConfig = {
  title: 'Trouvez votre tenue idéale',
  subtitle: 'Explorez notre palette de couleurs et imaginez votre tenue pour célébrer cette journée avec nous.',
  palette: {
    label: 'Palette de démonstration',
    description: 'Ces couleurs permettent d’essayer le simulateur. La palette conseillée par Léa et Vincent sera précisée plus tard.',
    officialRecommended: [],
  },
  statuses: {
    recommended: {
      label: 'Recommandée',
      icon: '★',
      message: 'Cette couleur s’accorde parfaitement avec notre dress code.',
    },
    allowed: {
      label: 'Autorisée',
      icon: '✓',
      message: 'Cette couleur convient pour notre mariage.',
    },
    reserved: {
      label: 'Réservée',
      icon: '◇',
      message: 'Cette couleur est réservée à certains membres du cortège.',
    },
    forbidden: {
      label: 'Interdite',
      icon: '⊘',
      message: 'Nous préférons éviter cette couleur pour notre mariage. Découvrez les alternatives proposées.',
    },
  },
  // Bornes inclusives en OKLCH. La teinte peut traverser 360° : [340, 24].
  // Ces seuils sont des choix explicites, ajustables, et couverts par des tests.
  // Ils ne prétendent pas identifier le tissu réel sous tous les éclairages.
  families: [
    {
      id: 'white',
      label: 'Blanc, blanc cassé et ivoire',
      ranges: [{ lightness: [0.93, 1], chroma: [0, 0.035] }],
    },
    {
      id: 'burgundy',
      label: 'Bordeaux et rouge vin',
      ranges: [{ lightness: [0.16, 0.57], chroma: [0.045, 0.20], hue: [340, 24] }],
    },
  ],
  globalRules: {
    recommended: [],
    allowed: [],
    reserved: [],
    forbidden: [{ familyId: 'white' }, { familyId: 'burgundy' }],
  },
  roles: [
    { id: 'invites', label: 'Invités', rules: inheritedRules(), messages: {} },
    { id: 'maries', label: 'Mariés', rules: inheritedRules(), messages: {} },
    { id: 'temoins', label: 'Témoins', rules: inheritedRules(), messages: {} },
    { id: 'honneur', label: 'Demoiselles / garçons d’honneur', rules: inheritedRules(), messages: {} },
    { id: 'famille', label: 'Famille proche', rules: inheritedRules(), messages: {} },
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
  // Seuls des modèles dont la licence autorise la diffusion peuvent être ajoutés.
  // Un modèle sans URL reste indisponible ; il n'est pas remplacé par un mannequin.
  models: [
    { id: 'suit', label: 'Costume en laine', url: new URL('./models/suit.glb', import.meta.url).href, clothingMaterials: ['clothing'], height: 1.82, provisional: true, source: 'https://github.com/abdulrehman043/humanforge/tree/2226df1f50a04c5a8e1c02ea33780d28337dfbb1', license: 'CC0-1.0' },
    { id: 'dress', label: 'Robe longue satinée', url: new URL('./models/long-dress.glb', import.meta.url).href, clothingMaterials: ['clothing'], height: 1.66, provisional: true, source: 'https://github.com/abdulrehman043/humanforge/tree/2226df1f50a04c5a8e1c02ea33780d28337dfbb1', license: 'CC0-1.0' },
    { id: 'short-dress', label: 'Robe courte en soie', url: new URL('./models/short-dress.glb', import.meta.url).href, clothingMaterials: ['clothing'], height: 1.50, provisional: true, source: 'https://github.com/abdulrehman043/humanforge/tree/2226df1f50a04c5a8e1c02ea33780d28337dfbb1', license: 'CC0-1.0' },
    { id: 'tailored-suit', label: 'Ensemble tailleur', url: new URL('./models/tailored-suit.glb', import.meta.url).href, clothingMaterials: ['clothing'], height: 1.61, provisional: true, source: 'https://github.com/abdulrehman043/humanforge/tree/2226df1f50a04c5a8e1c02ea33780d28337dfbb1', license: 'CC0-1.0' },
  ],
  characters: [
    { id: 'lea', label: 'Silhouette 1', role: 'maries', modelId: 'dress', colorId: 'rose' },
    { id: 'vincent', label: 'Silhouette 2', role: 'maries', modelId: 'suit', colorId: 'navy' },
    { id: 'temoin', label: 'Silhouette 3', role: 'temoins', modelId: 'tailored-suit', colorId: 'sage' },
    { id: 'honneur', label: 'Silhouette 4', role: 'honneur', modelId: 'dress', colorId: 'blue' },
    { id: 'famille', label: 'Silhouette 5', role: 'famille', modelId: 'short-dress', colorId: 'lavender' },
    { id: 'invite', label: 'Silhouette 6', role: 'invites', modelId: 'suit', colorId: 'ochre' },
  ],
};
