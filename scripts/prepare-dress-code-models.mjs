/**
 * Build static, posed glTF 2.0 characters from CC0 MakeHuman assets.
 * Run with node --import tsx, since HumanForge's generator runtime is TypeScript:
 *   node --import tsx ../scripts/prepare-dress-code-models.mjs <humanforge-checkout> <output-directory>
 * Pinned source revision and provenance are recorded in dress-code/models/SOURCES.md.
 * This is an offline preparation tool; neither HumanForge nor these dependencies ship in the site.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const source = resolve(process.argv[2] ?? '.asset-tools/humanforge');
const output = resolve(process.argv[3] ?? 'dress-code/models');
const requireTool = createRequire(join(source, 'package.json'));
const { Texture, Vector3, Quaternion, Color } = requireTool('three');
const { Document, NodeIO } = requireTool('@gltf-transform/core');
const { KHRMeshQuantization } = requireTool('@gltf-transform/extensions');
const { dedup, prune, quantize, weld, getBounds } = requireTool('@gltf-transform/functions');
const sharp = requireTool('sharp');
const { HumanAvatar, loadHumanPackage } = await import(pathToFileURL(join(source, 'src/human/runtime.ts')).href);
const assetDir = join(source, 'assets/human');
const pkg = await loadHumanPackage('local://human', {
  fetch: async (url) => {
    const bytes = readFileSync(join(assetDir, url.replace('local://human/', '')));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  },
  loadTexture: async (url) => {
    const tex = new Texture();
    tex.userData.sourcePath = join(assetDir, url.replace('local://human/', ''));
    return tex;
  },
});

const looks = [
  { id: 'suit', title: 'Costume en laine', outfit: 'toigo_male_suit_3', color: '#4E6370', roughness: .8,
    config: { gender: 1, age: .25, muscle: .5, weight: .48, height: .62, proportions: .5, african: .1, asian: .1, caucasian: .8, skin: 'young_caucasian_male', hair: 'short02', hairColor: '#30251d' }, pose: 0 },
  { id: 'long-dress', title: 'Robe longue satinée', outfit: 'toigo_halter_dress_with_fluted_skirt', color: '#818C75', roughness: .42,
    config: { gender: 0, age: .21, muscle: .4, weight: .46, height: .5, proportions: .5, african: .75, asian: .05, caucasian: .2, skin: 'young_african_female', hair: 'ponytail01', hairColor: '#201b16' }, pose: 1 },
  { id: 'short-dress', title: 'Robe courte en soie', outfit: 'toigo_halter_dress_knee_length', color: '#B9958B', roughness: .55,
    config: { gender: 0, age: .25, muscle: .35, weight: .63, height: .4, proportions: .5, african: .05, asian: .85, caucasian: .1, skin: 'young_asian_female', hair: 'toigo_curled_under_bob', hairColor: '#29201b' }, pose: 2 },
  { id: 'tailored-suit', title: 'Ensemble tailleur', outfit: 'toigo_female_suit_2', color: '#687982', roughness: .78,
    config: { gender: 0, age: .52, muscle: .38, weight: .58, height: .47, proportions: .5, african: .15, asian: .05, caucasian: .8, skin: 'middleage_caucasian_female', hair: 'short01', hairColor: '#63564d' }, pose: 3 },
];

function aimBone(avatar, suffix, direction) {
  const bone = avatar.bones.find(b => b.name.endsWith(`:${suffix}`));
  if (!bone) throw new Error(`Missing bone ${suffix}`);
  avatar.group.updateMatrixWorld(true);
  const worldQ = bone.getWorldQuaternion(new Quaternion());
  const oldDirection = new Vector3(0, 1, 0).applyQuaternion(worldQ).normalize();
  const change = new Quaternion().setFromUnitVectors(oldDirection, new Vector3(...direction).normalize());
  const targetQ = change.multiply(worldQ);
  const parentQ = bone.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  bone.quaternion.copy(parentQ.invert().multiply(targetQ));
  avatar.group.updateMatrixWorld(true);
}

function pose(avatar, variant) {
  const armSpread = [.13, .19, .19, .17][variant];
  aimBone(avatar, 'LeftArm', [armSpread, -.98, -.025]);
  aimBone(avatar, 'RightArm', [-armSpread - .015, -.98, .015]);
  aimBone(avatar, 'LeftForeArm', [.025, -.99, .11 + variant * .01]);
  aimBone(avatar, 'RightForeArm', [-.045, -.99, .10]);
  const head = avatar.bones.find(b => b.name.endsWith(':Head'));
  head.rotateY([.018, -.035, .035, -.018][variant]);
  head.rotateZ([-.01, .015, -.02, .01][variant]);
  avatar.setExpression('mouthSmile', .08);
  avatar.group.updateMatrixWorld(true);
  avatar.bones[0].updateMatrixWorld(true);
}

async function embeddedTexture(doc, sourceTexture, clothing = false, normal = false, kind = '', dress = false) {
  if (!sourceTexture?.userData.sourcePath) return null;
  let input = sharp(readFileSync(sourceTexture.userData.sourcePath));
  const metadata = await input.metadata();
  const hasAlpha = metadata.hasAlpha && !normal;
  if (clothing && !normal) {
    // Remove the source hue, retaining a restrained luminance pattern and sewn detail.
    // The GLB's clothing material then supplies the independently editable fabric colour.
    const neutral = await input.grayscale().normalise().toBuffer();
    input = sharp(neutral).linear(dress ? .04 : .25, dress ? 244 : 190).toColourspace('srgb');
  }
  if (kind === 'shoes' && !normal) input = sharp(await input.grayscale().toBuffer()).linear(.45, 0).toColourspace('srgb');
  const size = kind === 'skin' || clothing ? 1024 : ['eyes', 'eyebrows', 'eyelashes', 'teeth', 'tongue'].includes(kind) ? 256 : 512;
  input = input.resize({ width: normal ? 512 : size, withoutEnlargement: true });
  const data = hasAlpha ? await input.png({ compressionLevel: 9 }).toBuffer() : await input.jpeg({ quality: normal ? 88 : 88, chromaSubsampling: '4:4:4' }).toBuffer();
  return doc.createTexture().setMimeType(hasAlpha ? 'image/png' : 'image/jpeg').setImage(data);
}

mkdirSync(output, { recursive: true });
const inventory = [];
for (const look of looks) {
  const avatar = new HumanAvatar(pkg);
  avatar.textureSize = '1k';
  await avatar.setConfig({ ...look.config, clothes: [look.outfit, 'shoes04'], eyes: 'brownlight', skinTint: '#ffffff' });
  pose(avatar, look.pose);
  let bareAnkleAvatar;
  if (look.id === 'short-dress') {
    bareAnkleAvatar = new HumanAvatar(pkg);
    bareAnkleAvatar.textureSize = '1k';
    await bareAnkleAvatar.setConfig({ ...look.config, clothes: [look.outfit], eyes: 'brownlight', skinTint: '#ffffff' });
    pose(bareAnkleAvatar, look.pose);
  }
  const doc = new Document();
  Object.assign(doc.getRoot().getAsset(), { version: '2.0', generator: 'Wedding dress-code offline MakeHuman export', copyright: 'CC0-1.0 MakeHuman Community, MPFB2, Margaret Toigo; see SOURCES.md' });
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const buffer = doc.createBuffer();
  const scene = doc.createScene(look.id);
  const meshes = [];
  avatar.group.traverse(m => {
    if (!m.isMesh || !m.visible || m.userData.softPass) return;
    // The floor-length gown conceals footwear entirely; omit buried shoe geometry.
    if (look.id === 'long-dress' && m.name.startsWith('clothes-shoes')) return;
    if (m.name === 'body' && bareAnkleAvatar) {
      bareAnkleAvatar.group.traverse(b => { if (b.isMesh && b.name === 'body') meshes.push(b); });
    } else meshes.push(m);
  });
  let triangles = 0;
  for (const m of meshes) {
    const isClothes = m.name === `clothes-${look.outfit}`;
    const name = isClothes ? 'clothing' : m.name === 'body' ? 'skin' : m.name.startsWith('clothes-shoes') ? 'shoes' : m.name.split('-')[0];
    const sourceMat = m.material;
    const material = doc.createMaterial(name)
      .setBaseColorFactor(isClothes ? [...new Color(look.color).toArray(), 1] : [...sourceMat.color.toArray(), sourceMat.opacity ?? 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(isClothes ? look.roughness : (name === 'hair' ? .82 : sourceMat.roughness))
      .setDoubleSided(sourceMat.side === 2);
    const tex = await embeddedTexture(doc, sourceMat.map, isClothes, false, name, look.id.includes('dress'));
    const normal = await embeddedTexture(doc, sourceMat.normalMap, false, true);
    if (tex) material.setBaseColorTexture(tex);
    if (normal) material.setNormalTexture(normal).setNormalScale(isClothes ? .6 : 1);
    if (sourceMat.alphaTest > 0) material.setAlphaMode('MASK').setAlphaCutoff(.35);
    else if (sourceMat.transparent) material.setAlphaMode('BLEND');
    const sourceGeo = m.geometry;
    const geo = sourceGeo.clone();
    geo.morphAttributes = {};
    geo.morphTargetsRelative = false;
    const positions = new Float32Array(sourceGeo.attributes.position.count * 3);
    const v = new Vector3();
    for (let i = 0; i < sourceGeo.attributes.position.count; i++) {
      m.getVertexPosition(i, v);
      v.applyMatrix4(m.matrixWorld);
      positions.set(v.toArray(), i * 3);
    }
    geo.attributes.position.array.set(positions);
    geo.computeVertexNormals();
    const primitive = doc.createPrimitive().setMaterial(material);
    primitive.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer));
    primitive.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.normal.array)).setBuffer(buffer));
    if (geo.attributes.uv) {
      primitive.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(geo.attributes.uv.array)).setBuffer(buffer));
    }
    let index = sourceGeo.index?.array;
    if (name === 'shoes' && look.id === 'short-dress' && index) {
      const kept = [];
      for (let k = 0; k < index.length; k += 3) {
        const y = (positions[index[k] * 3 + 1] + positions[index[k + 1] * 3 + 1] + positions[index[k + 2] * 3 + 1]) / 3;
        if (y < .105) kept.push(index[k], index[k + 1], index[k + 2]);
      }
      index = Uint32Array.from(kept);
    }
    if (name === 'skin' && look.id === 'short-dress' && index) {
      // Trim only hidden thigh faces; preserve hands, exposed knees and calves.
      const skirt = meshes.find(mesh => mesh.name === `clothes-${look.outfit}`);
      const skirtPos = skirt.geometry.attributes.position;
      let hem = Infinity;
      for (let k = 0; k < skirtPos.count; k++) hem = Math.min(hem, skirtPos.getY(k));
      const joints = sourceGeo.attributes.skinIndex, weights = sourceGeo.attributes.skinWeight;
      const thighBones = new Set(avatar.bones.map((b, n) => /(?:Left|Right)UpLeg$/.test(b.name) ? n : -1));
      const hidden = vertex => {
        if (positions[vertex * 3 + 1] <= hem + .025) return false;
        let thighWeight = 0;
        for (let k = 0; k < 4; k++) if (thighBones.has(joints.array[vertex * 4 + k])) thighWeight += weights.array[vertex * 4 + k];
        return thighWeight > .55;
      };
      const kept = [];
      for (let k = 0; k < index.length; k += 3) {
        const ids = [index[k], index[k + 1], index[k + 2]];
        const buriedInShoe = ids.every(vertex => positions[vertex * 3 + 1] < .09);
        if (!buriedInShoe && !ids.every(hidden)) kept.push(...ids);
      }
      index = Uint32Array.from(kept);
    }
    if (index) primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buffer));
    triangles += (index?.length ?? sourceGeo.attributes.position.count) / 3;
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
    geo.dispose();
  }
  await doc.transform(weld(), dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const bytes = await io.writeBinary(doc);
  writeFileSync(join(output, `${look.id}.glb`), bytes);
  const bounds = getBounds(scene);
  inventory.push({ id: look.id, label: look.title, bytes: bytes.byteLength, triangles, height: bounds.max[1] - bounds.min[1], width: bounds.max[0] - bounds.min[0], bounds, sourceRevision: '2226df1f50a04c5a8e1c02ea33780d28337dfbb1', clothingMaterials: ['clothing'], appearance: look.config, outfit: look.outfit, provisional: true });
  console.log(`${look.id}: ${bytes.byteLength} bytes, ${triangles} triangles`);
  avatar.dispose();
  bareAnkleAvatar?.dispose();
}
writeFileSync(join(output, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
