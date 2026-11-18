import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dressCodeConfig } from '../dress-code/config.js';

for (const model of dressCodeConfig.models) {
  test(`delivered GLB ${model.id} is self-contained and separates clothing from skin`, async () => {
    const bytes = await readFile(new URL(model.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.readUInt32LE(16), 0x4E4F534A);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.ok(json.meshes.length > 0);
    assert.ok(json.buffers.every((buffer) => !buffer.uri), 'Geometry must be embedded.');
    assert.ok(json.images.every((image) => !image.uri && Number.isInteger(image.bufferView)), 'Textures must be embedded.');
    assert.ok((json.extensionsRequired || []).every((extension) => extension === 'KHR_mesh_quantization'), 'Only supported decoder-free extensions may be required.');
    const materialNames = json.materials.map((material) => material.name);
    for (const name of model.clothingMaterials) assert.ok(materialNames.includes(name), `Missing recolorable material ${name}`);
    assert.ok(materialNames.includes('skin'));
    assert.ok(materialNames.includes('hair'));
    assert.ok(!model.clothingMaterials.includes('skin'));
    assert.ok(!model.clothingMaterials.includes('hair'));
    assert.equal(model.license, 'CC0-1.0');
    assert.equal(model.provisional, true, 'Do not silently certify the current collection as final photographic assets.');
  });
}
