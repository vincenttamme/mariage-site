import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dressCodeConfig } from '../dress-code/config.js';
import { evaluateColor, isCompliant } from '../dress-code/colors.js';
import { createComposition, changeColor, changeRole, changeModel, resetComposition, createComparison } from '../dress-code/composition.js';

test('initial group represents all five roles and starts with only allowed demonstration colors', () => {
  const composition = createComposition();
  assert.equal(composition.length, 6);
  assert.equal(new Set(composition.map((participant) => participant.role)).size, 5);
  assert.ok(composition.every((participant) => isCompliant(evaluateColor(participant.colorId, participant.role))));
  assert.notEqual(composition, dressCodeConfig.characters);
  assert.notEqual(composition[0], dressCodeConfig.characters[0]);
});

test('color changes affect only the selected character and preserve immutable originals', () => {
  const composition = createComposition();
  composition.forEach(Object.freeze);
  Object.freeze(composition);
  const before = structuredClone(composition);
  const updated = changeColor(composition, composition[1].id, 'blue');
  assert.equal(updated[1].colorId, 'blue');
  assert.notEqual(updated[1], composition[1]);
  for (const index of [0, 2, 3, 4, 5]) assert.equal(updated[index], composition[index]);
  assert.deepEqual(composition, before);
});

test('forbidden colors can be previewed while their prohibition remains explicit', () => {
  const composition = createComposition();
  const updated = changeColor(composition, composition[0].id, 'white');
  assert.equal(updated[0].colorId, 'white');
  assert.equal(evaluateColor(updated[0].colorId, updated[0].role).status, 'forbidden');
});

test('role changes preserve garment and color and immediately alter scoped compliance', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[1].rules.exceptions.push({ familyId: 'white', status: 'allowed' });
  let composition = createComposition(config);
  const selected = composition[5];
  composition = changeColor(composition, selected.id, 'white', config);
  assert.equal(evaluateColor(composition[5].colorId, composition[5].role, config).status, 'forbidden');
  const updated = changeRole(composition, selected.id, 'maries', config);
  assert.equal(updated[5].colorId, 'white');
  assert.equal(updated[5].modelId, selected.modelId);
  assert.equal(evaluateColor(updated[5].colorId, updated[5].role, config).status, 'allowed');
});

test('every configured garment can be assigned to every role without a gender restriction', () => {
  const composition = createComposition();
  for (const model of dressCodeConfig.models) {
    for (const participant of composition) {
      const updated = changeModel(composition, participant.id, model.id);
      assert.equal(updated.find((entry) => entry.id === participant.id)?.modelId, model.id);
    }
  }
});

test('reset restores the configured group without shared mutable objects', () => {
  let composition = createComposition();
  composition = changeColor(composition, composition[0].id, 'burgundy');
  composition = changeRole(composition, composition[0].id, 'invites');
  assert.notDeepEqual(composition, dressCodeConfig.characters);
  const reset = resetComposition();
  assert.deepEqual(reset, dressCodeConfig.characters);
  reset[0].colorId = 'white';
  assert.notEqual(reset[0].colorId, dressCodeConfig.characters[0].colorId);
});

test('unknown selections, roles, models and colors are rejected without modifying the group', () => {
  const composition = createComposition();
  const before = structuredClone(composition);
  assert.throws(() => changeColor(composition, 'absent', 'white'), RangeError);
  assert.throws(() => changeColor(composition, composition[0].id, '#FFFFFF'), RangeError);
  assert.throws(() => changeRole(composition, composition[0].id, 'absent'), RangeError);
  assert.throws(() => changeModel(composition, composition[0].id, 'absent'), RangeError);
  assert.deepEqual(composition, before);
});

test('comparison injects a forbidden example into an initially compliant group', () => {
  const composition = createComposition();
  const before = structuredClone(composition);
  const comparison = createComparison(composition);
  assert.equal(comparison.available, true);
  assert.deepEqual(comparison.compliant, composition);
  assert.ok(comparison.alternative.some((entry) => evaluateColor(entry.colorId, entry.role).status === 'forbidden'));
  assert.equal(comparison.changes.length, 1);
  assert.deepEqual(composition, before);
});

test('comparison repairs every forbidden/reserved item and preserves identical models/roles/framing data', () => {
  const config = structuredClone(dressCodeConfig);
  config.globalRules.reserved.push({ colorId: 'blue' });
  let composition = createComposition(config);
  composition = changeColor(composition, composition[0].id, 'white', config);
  composition = changeColor(composition, composition[4].id, 'burgundy', config);
  const comparison = createComparison(composition, config);
  assert.equal(comparison.available, true);
  assert.ok(comparison.compliant.every((entry) => isCompliant(evaluateColor(entry.colorId, entry.role, config))));
  assert.deepEqual(comparison.alternative, composition);
  comparison.compliant.forEach((entry, index) => {
    assert.deepEqual({ ...entry, colorId: '' }, { ...comparison.alternative[index], colorId: '' });
  });
  assert.ok(comparison.changes.length >= 3);
});

test('comparison honors role exceptions when choosing a forbidden demonstration', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[1].rules.exceptions.push({ familyId: 'white', status: 'allowed' }, { familyId: 'burgundy', status: 'allowed' });
  const comparison = createComparison(createComposition(config), config);
  assert.equal(comparison.available, true);
  assert.equal(comparison.alternative[0].colorId, config.characters[0].colorId);
  assert.equal(comparison.alternative[1].colorId, config.characters[1].colorId);
  assert.equal(evaluateColor(comparison.alternative[2].colorId, 'temoins', config).status, 'forbidden');
});

test('comparison is unavailable when configuration provides no compliant replacement', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[0].rules.forbidden.push(...config.colors.map((color) => ({ colorId: color.id })));
  const comparison = createComparison(createComposition(config), config);
  assert.equal(comparison.available, false);
  assert.ok(comparison.reason.includes('Aucune alternative autorisée'));
  assert.deepEqual(comparison.compliant, []);
});

test('comparison is unavailable if every participant is exempt from all configured forbiddens', () => {
  const config = structuredClone(dressCodeConfig);
  for (const role of config.roles) role.rules.exceptions.push({ familyId: 'white', status: 'allowed' }, { familyId: 'burgundy', status: 'allowed' });
  const comparison = createComparison(createComposition(config), config);
  assert.equal(comparison.available, false);
  assert.ok(comparison.reason.includes('Aucune couleur interdite'));
});

test('comparisons are deterministic and independent snapshots', () => {
  const composition = createComposition();
  const beforeConfig = JSON.stringify(dressCodeConfig);
  const first = createComparison(composition);
  const second = createComparison(composition);
  assert.deepEqual(first, second);
  first.compliant[0].colorId = 'white';
  assert.notEqual(first.compliant[0].colorId, second.compliant[0].colorId);
  assert.notEqual(first.compliant[0].colorId, composition[0].colorId);
  assert.equal(JSON.stringify(dressCodeConfig), beforeConfig);
});

test('duplicate participant identities and invalid configuration are rejected before rendering', () => {
  const config = structuredClone(dressCodeConfig);
  config.characters[1].id = config.characters[0].id;
  assert.throws(() => createComposition(config), RangeError);
  config.characters[1].id = 'unique';
  config.characters[1].colorId = 'absent';
  assert.throws(() => createComposition(config), RangeError);
});
