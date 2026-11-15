import { dressCodeConfig } from './config.js';
import { evaluateColor, isCompliant } from './colors.js';

/** @typedef {import('./config.js').DressCodeConfig} DressCodeConfig */
/** @typedef {import('./config.js').Participant} Participant */
/**
 * @typedef {object} Comparison
 * @property {boolean} available
 * @property {Participant[]} compliant
 * @property {Participant[]} alternative
 * @property {{id: string, from: string, to: string}[]} changes
 * @property {string} reason
 */

/** @param {Participant} participant @param {DressCodeConfig} config */
function validateParticipant(participant, config) {
  if (!config.models.some((model) => model.id === participant.modelId)) throw new RangeError('Cette tenue ne figure pas dans la collection.');
  if (!config.colors.some((color) => color.id === participant.colorId)) throw new RangeError('Cette couleur ne figure pas dans la palette.');
  evaluateColor(participant.colorId, participant.role, config);
}

/** @param {Participant[]} composition @param {DressCodeConfig} config */
function validateComposition(composition, config) {
  const ids = new Set();
  for (const participant of composition) {
    if (!participant.id || ids.has(participant.id)) throw new RangeError('Chaque silhouette doit posséder un identifiant unique.');
    ids.add(participant.id);
    validateParticipant(participant, config);
  }
}

/** @param {DressCodeConfig} [config] @returns {Participant[]} */
export function createComposition(config = dressCodeConfig) {
  validateComposition(config.characters, config);
  return config.characters.map((participant) => ({ ...participant }));
}

/** @param {DressCodeConfig} [config] @returns {Participant[]} */
export function resetComposition(config = dressCodeConfig) {
  return createComposition(config);
}

/**
 * @param {Participant[]} composition
 * @param {string} id
 * @param {Partial<Pick<Participant, 'role'|'modelId'|'colorId'>>} patch
 * @param {DressCodeConfig} config
 * @returns {Participant[]}
 */
function updateParticipant(composition, id, patch, config) {
  validateComposition(composition, config);
  if (!composition.some((participant) => participant.id === id)) throw new RangeError('Cette silhouette ne figure pas dans le groupe.');
  return composition.map((participant) => {
    if (participant.id !== id) return participant;
    const updated = { ...participant, ...patch };
    validateParticipant(updated, config);
    return updated;
  });
}

/**
 * Forbidden colors remain previewable so guests can understand the comparison.
 * Their status never changes; the UI must show evaluateColor() alongside them.
 * @param {Participant[]} composition
 * @param {string} id
 * @param {string} colorId
 * @param {DressCodeConfig} [config]
 * @returns {Participant[]}
 */
export function changeColor(composition, id, colorId, config = dressCodeConfig) {
  if (!config.colors.some((color) => color.id === colorId)) throw new RangeError('Cette couleur ne figure pas dans la palette.');
  return updateParticipant(composition, id, { colorId }, config);
}

/** @param {Participant[]} composition @param {string} id @param {string} role @param {DressCodeConfig} [config] @returns {Participant[]} */
export function changeRole(composition, id, role, config = dressCodeConfig) {
  return updateParticipant(composition, id, { role }, config);
}

/** @param {Participant[]} composition @param {string} id @param {string} modelId @param {DressCodeConfig} [config] @returns {Participant[]} */
export function changeModel(composition, id, modelId, config = dressCodeConfig) {
  return updateParticipant(composition, id, { modelId }, config);
}

/**
 * Build two snapshots with identical participants, roles and garments.
 * The current composition is preserved. The compliant snapshot replaces only
 * noncompliant colors. The alternative keeps existing forbidden colors, or adds
 * one explicitly forbidden palette color when the current group has none.
 * No arbitrary fallback is invented when configuration makes comparison impossible.
 * @param {Participant[]} composition
 * @param {DressCodeConfig} [config]
 * @returns {Comparison}
 */
export function createComparison(composition, config = dressCodeConfig) {
  validateComposition(composition, config);
  const compliant = composition.map((participant) => ({ ...participant }));
  const alternative = composition.map((participant) => ({ ...participant }));

  for (const participant of compliant) {
    if (isCompliant(evaluateColor(participant.colorId, participant.role, config))) continue;
    const replacement = config.colors.find((color) => isCompliant(evaluateColor(color.id, participant.role, config)));
    if (!replacement) {
      return { available: false, compliant: [], alternative: [], changes: [], reason: 'Aucune alternative autorisée n’est encore définie pour ce rôle.' };
    }
    participant.colorId = replacement.id;
  }

  const alreadyForbidden = alternative.some((participant) => evaluateColor(participant.colorId, participant.role, config).status === 'forbidden');
  if (!alreadyForbidden) {
    let introduced = false;
    for (const participant of alternative) {
      const forbidden = config.colors.find((color) => evaluateColor(color.id, participant.role, config).status === 'forbidden');
      if (!forbidden) continue;
      participant.colorId = forbidden.id;
      introduced = true;
      break;
    }
    if (!introduced) {
      return { available: false, compliant: [], alternative: [], changes: [], reason: 'Aucune couleur interdite n’est définie pour les rôles de ce groupe.' };
    }
  }

  return {
    available: true,
    compliant,
    alternative,
    changes: alternative.flatMap((participant, index) => participant.colorId === compliant[index].colorId ? [] : [{
      id: participant.id,
      from: participant.colorId,
      to: compliant[index].colorId,
    }]),
    reason: '',
  };
}
