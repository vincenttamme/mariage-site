import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dressCodeConfig } from '../dress-code/config.js';
import { normalizeHex, hexToOklch, classifyColorFamilies, evaluateColor, isAllowedColor, defaultAllowedColor, selectAllowedColor } from '../dress-code/colors.js';

test('color syntax is normalized without accepting arbitrary input', () => {
  assert.equal(normalizeHex('#fFf'), '#FFFFFF');
  assert.equal(normalizeHex(' #72aB34 '), '#72AB34');
  for (const value of ['', 'white', '#FFFF', '#FFFFFF00', '#GGGGGG']) {
    assert.throws(() => normalizeHex(value), TypeError);
  }
});

test('white and burgundy families include forbidden near-shades', () => {
  for (const value of ['#FFFFFF', '#F5F5F0', '#FAF0E6', '#FFFFF0', '#F0EAD6']) {
    assert.ok(classifyColorFamilies(value).includes('white'), value);
  }
  for (const value of ['#800020', '#4A061A', '#722F37', '#49182F', '#981F44']) {
    assert.ok(classifyColorFamilies(value).includes('burgundy'), value);
  }
  assert.ok(Math.abs(hexToOklch('#FFFFFF').l - 1) < 1e-6);
});

test('only named allowed palette swatches can be selected', () => {
  for (const color of dressCodeConfig.colors) {
    const result = evaluateColor(color.id);
    assert.equal(result.hex, normalizeHex(color.hex));
    const expected = color.status === 'allowed' && !result.families.includes('white') && !result.families.includes('burgundy');
    assert.equal(isAllowedColor(color.id), expected);
    if (expected) assert.equal(selectAllowedColor(color.id), color.id);
    else assert.throws(() => selectAllowedColor(color.id), RangeError);
  }
  assert.throws(() => selectAllowedColor('#FFFFFF'), RangeError);
  assert.throws(() => selectAllowedColor('not-a-color'), RangeError);
});

test('family restrictions cannot be bypassed by a misconfigured allowed color', () => {
  const config = structuredClone(dressCodeConfig);
  config.colors.find((color) => color.id === 'white').status = 'allowed';
  config.colors.find((color) => color.id === 'burgundy').status = 'allowed';
  assert.equal(evaluateColor('white', config).status, 'forbidden');
  assert.equal(evaluateColor('burgundy', config).status, 'forbidden');
  assert.throws(() => selectAllowedColor('white', config), RangeError);
});

test('default selection falls back to the first allowed swatch', () => {
  const config = structuredClone(dressCodeConfig);
  assert.equal(defaultAllowedColor(config), 'sage');
  config.defaultColorId = 'white';
  assert.equal(defaultAllowedColor(config), 'sage');
  config.colors.forEach((color) => { color.status = 'forbidden'; });
  assert.throws(() => defaultAllowedColor(config), RangeError);
});

test('two existing garments are fixed to the two presentation options', () => {
  assert.deepEqual(dressCodeConfig.characters.map(({id,modelId}) => ({id,modelId})), [
    { id: 'femme', modelId: 'dress' }, { id: 'homme', modelId: 'suit' },
  ]);
  assert.equal(new Set(dressCodeConfig.models.map((model) => model.id)).size, 2);
  assert.ok(!('roles' in dressCodeConfig));
  assert.ok(!('globalRules' in dressCodeConfig));
  assert.ok(!('officialRecommended' in dressCodeConfig.palette));
});
