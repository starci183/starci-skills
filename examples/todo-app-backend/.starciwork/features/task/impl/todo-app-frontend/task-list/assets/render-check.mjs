/**
 * Runs the real render checks from checks/render.mjs over every running-page capture beside this
 * script: `palette-off-brand` and `primary-absent` on the PNG bytes, `entity-list-in-card` on the
 * adjacent HTML markup. The shared `runRenderChecks` entry point cannot be used here as-is because
 * its brand reader expects the kernel's work/node@2 record shape while this example tree's brand is a
 * work/brand record - so this harness feeds the same check functions the same parsed brand document
 * directly, with the same starci card classes, and reports the real outcomes unchanged.
 *
 * Usage: node render-check.mjs  (exit 1 when any check fails; skips are reported, never passes)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const assetsDir = path.dirname(fileURLToPath(import.meta.url));

/** Walks up from `from` until a directory containing `marker` is found - never a guessed absolute. */
const findUp = (from, marker) => {
  let dir = from;
  while (true) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`render-check found no ${marker} above ${from}`);
    dir = parent;
  }
};
const workRoot = findUp(assetsDir, path.join('brand', 'index.yaml'));
const repoRoot = findUp(assetsDir, path.join('checks', 'render.mjs'));
const { parseYaml } = await import(pathToFileURL(path.join(repoRoot, 'core', 'yaml.mjs')));
const { decodePng, checkPalette, checkEntityListInCard } = await import(pathToFileURL(path.join(repoRoot, 'checks', 'render.mjs')));

const brand = parseYaml(fs.readFileSync(path.join(workRoot, 'brand', 'index.yaml'), 'utf8')).brand;

const captures = fs.readdirSync(assetsDir)
  .filter(name => /^list-.*\.png$/.test(name))
  .sort();
if (!captures.length) throw new Error('render-check: no list-*.png captures beside this script - run capture.mjs first');

let failures = 0;
for (const name of captures) {
  const pngPath = path.join(assetsDir, name);
  const htmlPath = pngPath.replace(/\.png$/, '.html');
  let png = null;
  try {
    png = decodePng(fs.readFileSync(pngPath));
  } catch (error) {
    console.log(`FAIL ${name}: unreadable PNG (${String(error.message ?? error)})`);
    failures += 1;
    continue;
  }
  for (const result of checkPalette({ png, brand })) {
    if (result.outcome === 'fail') failures += 1;
    console.log(`${result.outcome.toUpperCase()} ${name} ${result.id}: ${result.detail}`);
  }
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
  const structure = checkEntityListInCard(html, { family: 'starci' });
  if (structure.outcome === 'fail') failures += 1;
  console.log(`${structure.outcome.toUpperCase()} ${name} ${structure.id}: ${structure.detail}`);
}
console.log(failures ? `render-check: ${failures} failing check(s)` : `render-check: ${captures.length} captures, no failing check`);
process.exit(failures ? 1 : 0);
