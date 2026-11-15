import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dressCodeConfig } from '../dress-code/config.js';
import { normalizeHex, hexToHsl, hexToOklch, classifyColorFamilies, evaluateColor, isCompliant } from '../dress-code/colors.js';

test('hex normalization accepts case and shorthand, rejects malformed/alpha/non-color values', () => {
  assert.equal(normalizeHex('#fFf'), '#FFFFFF');
  assert.equal(normalizeHex(' #72aB34 '), '#72AB34');
  for (const value of ['', 'white', '#12', '#FFFF', '#FFFFFF00', '#GGGGGG', '#fff; color:red']) {
    assert.throws(() => normalizeHex(value), TypeError);
  }
  assert.throws(() => normalizeHex(/** @type {any} */ (null)), TypeError);
});

test('perceptual measurements preserve standard black, white and red reference values', () => {
  assert.deepEqual(hexToHsl('#FF0000'), { h: 0, s: 1, l: 0.5 });
  assert.deepEqual(hexToHsl('#808080'), { h: 0, s: 0, l: 128 / 255 });
  assert.equal(hexToOklch('#000000').l, 0);
  assert.ok(Math.abs(hexToOklch('#FFFFFF').l - 1) < 1e-6);
  assert.ok(Math.abs(hexToOklch('#FF0000').l - 0.627955) < 1e-6);
});

test('white family includes pure white, off-white, ivory and near-white shades', () => {
  for (const color of ['#FFFFFF', '#fff', '#F5F5F0', '#FAF0E6', '#FFFFF0', '#F0EAD6', '#FFFEED']) {
    assert.deepEqual(classifyColorFamilies(color), ['white'], color);
  }
});

test('pale but distinctly colored fabrics and light gray are not automatically white', () => {
  for (const color of ['#D9EBF5', '#FFF1AA', '#FFCCCC', '#DDDDDD', '#FFFDDD']) {
    assert.deepEqual(classifyColorFamilies(color), [], color);
    assert.equal(evaluateColor(color, 'invites').status, 'allowed', color);
  }
});

test('white lightness and chroma boundaries are covered on adjacent sRGB values', () => {
  assert.deepEqual(classifyColorFamilies('#E7E7E7'), []);
  assert.deepEqual(classifyColorFamilies('#E8E8E8'), ['white']);
  assert.deepEqual(classifyColorFamilies('#FFFFE5'), ['white']);
  assert.deepEqual(classifyColorFamilies('#FFFFE4'), []);
});

test('burgundy family includes classic, dark, wine and purple-tinted burgundy', () => {
  for (const color of ['#800020', '#4A061A', '#722F37', '#49182F', '#981F44', '#50183C', '#30000D', '#220008']) {
    assert.deepEqual(classifyColorFamilies(color), ['burgundy'], color);
  }
});

test('dark red, purple, brown, black and pink are not automatically burgundy', () => {
  for (const color of ['#8B0000', '#600000', '#591F4B', '#663300', '#000000', '#C44A6D', '#7A5A5F']) {
    assert.deepEqual(classifyColorFamilies(color), [], color);
  }
});

test('burgundy hue boundaries include one side and exclude adjacent out-of-range hues', () => {
  assert.deepEqual(classifyColorFamilies('#800014'), ['burgundy']);
  assert.deepEqual(classifyColorFamilies('#800013'), []);
  assert.deepEqual(classifyColorFamilies('#50183C'), ['burgundy']);
  assert.deepEqual(classifyColorFamilies('#591F4A'), []);
});

test('family thresholds are inclusive, adjustable and separate from business permission', () => {
  const config = structuredClone(dressCodeConfig);
  const measured = hexToOklch('#D9EBF5');
  config.families[0].ranges = [{ lightness: [measured.l, measured.l], chroma: [measured.c, measured.c], hue: [measured.h, measured.h] }];
  assert.deepEqual(classifyColorFamilies('#D9EBF5', config), ['white']);
  assert.equal(evaluateColor('#D9EBF5', 'invites', config).status, 'forbidden');
  config.globalRules.forbidden = [];
  assert.equal(evaluateColor('#D9EBF5', 'invites', config).status, 'allowed');
});

test('all five roles inherit both confirmed forbidden families, including the couple', () => {
  for (const role of dressCodeConfig.roles) {
    for (const color of ['white', 'ivory', 'burgundy', 'wine', '#F7F7F4', '#4A061A']) {
      const result = evaluateColor(color, role.id);
      assert.equal(result.status, 'forbidden', `${role.id}: ${color}`);
      assert.ok(result.icon);
      assert.ok(result.message.includes('Nous préférons éviter'));
    }
  }
});

test('catalog statuses and ordinary allowed lists cannot bypass forbidden family rules', () => {
  const config = structuredClone(dressCodeConfig);
  config.colors[6].status = 'allowed';
  config.roles[1].rules.allowed.push({ familyId: 'white' });
  assert.equal(evaluateColor('white', 'maries', config).status, 'forbidden');
});

test('role exceptions are explicit, scoped and can carry a custom French explanation', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[1].rules.exceptions.push({ familyId: 'white', status: 'allowed', message: 'Le blanc est autorisé pour ce rôle.' });
  assert.equal(evaluateColor('white', 'maries', config).status, 'allowed');
  assert.equal(evaluateColor('ivory', 'maries', config).message, 'Le blanc est autorisé pour ce rôle.');
  assert.equal(evaluateColor('white', 'invites', config).status, 'forbidden');
  assert.equal(evaluateColor('burgundy', 'maries', config).status, 'forbidden');
});

test('specific exceptions outrank family exceptions and conflicting peers fail restrictive', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[1].rules.exceptions.push(
    { familyId: 'white', status: 'allowed' },
    { colorId: 'ivory', status: 'reserved' },
    { colorId: 'ivory', status: 'forbidden' },
  );
  assert.equal(evaluateColor('white', 'maries', config).status, 'allowed');
  assert.equal(evaluateColor('ivory', 'maries', config).status, 'forbidden');
  config.roles[1].rules.exceptions.reverse();
  assert.equal(evaluateColor('ivory', 'maries', config).status, 'forbidden');
});

test('explicit role override replaces global rule lists but not catalog restrictions', () => {
  const config = structuredClone(dressCodeConfig);
  config.globalRules.reserved.push({ colorId: 'blue' });
  assert.equal(evaluateColor('blue', 'maries', config).status, 'reserved');
  config.roles[1].rules.mode = 'override';
  assert.equal(evaluateColor('blue', 'maries', config).status, 'allowed');
  assert.equal(evaluateColor('#FAFAFA', 'maries', config).status, 'allowed');
  assert.equal(evaluateColor('white', 'maries', config).status, 'forbidden');
});

test('reserved colors stay noncompliant until the role has an explicit exception', () => {
  const config = structuredClone(dressCodeConfig);
  config.globalRules.reserved.push({ colorId: 'blue' });
  assert.equal(isCompliant(evaluateColor('blue', 'invites', config)), false);
  config.roles[2].rules.exceptions.push({ colorId: 'blue', status: 'allowed' });
  assert.equal(isCompliant(evaluateColor('blue', 'temoins', config)), true);
});

test('a demonstration color never becomes an official recommendation through any rule', () => {
  const config = structuredClone(dressCodeConfig);
  config.palette.officialRecommended.push('sage');
  config.globalRules.recommended.push({ colorId: 'sage' });
  config.roles[0].rules.exceptions.push({ colorId: 'sage', status: 'recommended', message: 'Un message officiel.' });
  const result = evaluateColor('sage', 'invites', config);
  assert.equal(result.status, 'allowed');
  assert.equal(result.source, 'demonstration');
  assert.notEqual(result.message, 'Un message officiel.');
  config.colors[0].demonstration = false;
  assert.equal(evaluateColor('sage', 'invites', config).status, 'recommended');
});

test('French text, icons and role-specific explanations accompany every status', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[0].messages.allowed = 'Cette couleur est possible pour les invités.';
  const result = evaluateColor('sage', 'invites', config);
  assert.equal(result.label, 'Autorisée');
  assert.equal(result.icon, '✓');
  assert.equal(result.message, 'Cette couleur est possible pour les invités.');
  for (const display of Object.values(config.statuses)) {
    assert.ok(display.label && display.icon && display.message);
  }
});

test('invalid colors, roles and ambiguous rule selectors cannot silently grant permission', () => {
  assert.throws(() => evaluateColor('white', 'unknown-role'), RangeError);
  assert.throws(() => evaluateColor('not-a-color', 'invites'), RangeError);
  assert.throws(() => evaluateColor('#INVALID', 'invites'), TypeError);
  const config = structuredClone(dressCodeConfig);
  config.globalRules.allowed.push({ colorId: 'white', familyId: 'white' });
  assert.throws(() => evaluateColor('white', 'invites', config), TypeError);
});

test('classification and exceptions do not mutate shared configuration', () => {
  const config = structuredClone(dressCodeConfig);
  config.roles[1].rules.exceptions.push({ familyId: 'white', status: 'allowed' }, { hex: '#FFFFF0', status: 'reserved' });
  const before = JSON.stringify(config);
  for (const role of config.roles) for (const color of config.colors) evaluateColor(color.id, role.id, config);
  assert.equal(JSON.stringify(config), before);
  assert.notEqual(config.roles[0].rules.allowed, config.roles[1].rules.allowed);
});
