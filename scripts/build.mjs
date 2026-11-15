import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dressCodeConfig } from '../dress-code/config.js';

// Keep a checked-in browser bundle: GitHub Pages can still publish the root as-is.
await build({
  entryPoints: ['dress-code/scene.js'],
  outfile: 'dress-code/scene.bundle.js',
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'external',
  logLevel: 'info',
});
await cp('node_modules/three/LICENSE', 'dress-code/LICENSE-THREE.txt');

const assetSummary = [];
for (const model of dressCodeConfig.models) {
  if (!model.url || !model.clothingMaterials.length) {
    throw new Error(`Modèle incomplet dans la configuration : ${model.id}`);
  }
  const path = fileURLToPath(new URL(model.url, import.meta.url));
  const { size } = await stat(path);
  assetSummary.push({ modèle: model.id, Mo: +(size / 1_000_000).toFixed(2) });
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const staticDirectories = new Set(['media', 'fonts', 'partials', 'dress-code']);
const staticFiles = new Set(['style.css', 'script.js', 'CNAME', '.nojekyll', 'favicon.png']);
for (const entry of await readdir('.', { withFileTypes: true })) {
  if (staticDirectories.has(entry.name) || staticFiles.has(entry.name) || /\.(html|ics)$/.test(entry.name)) {
    await cp(entry.name, `dist/${entry.name}`, { recursive: true });
  }
}
console.table(assetSummary);
console.log('Site statique prêt dans dist/. Les fichiers à la racine restent directement publiables.');
