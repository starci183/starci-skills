/**
 * Lane v7-10 measurement: for every ecommerce ui-screen record, does each digest and each file path the
 * record asserts still match the bytes on disk? Read-only; reports, never rewrites.
 *
 * Two digest families are checked separately because they claim different things:
 *  - `ui.assets[].sha256` / `assets[].generation.promptPath`  — the record's own artifact custody.
 *  - `provenance.*.sha256` and `provenance.*.path` / `inputRefs[]` / `referencedImages[]` — a claim about
 *    an input that was read at draw time; drift there is history, drift in the first is a broken record.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/example-render-proof.mjs';

const host = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workRoot = path.join(host, 'examples', 'ecommerce-app-be', '.starciwork');

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const check = (label, relPath, expected, base = workRoot) => {
  const candidates = [path.resolve(base, relPath), path.resolve(workRoot, relPath), path.resolve(host, relPath)];
  const file = candidates.find(candidate => fs.existsSync(candidate) && fs.lstatSync(candidate).isFile());
  if (!file) return {label, path: relPath, verdict: 'MISSING'};
  if (!expected) return {label, path: relPath, verdict: 'OK'};
  return sha256(file) === expected
    ? {label, path: relPath, verdict: 'OK'}
    : {label, path: relPath, verdict: 'DIGEST_MISMATCH', expected, actual: sha256(file)};
};

const results = [];
for (const file of walk(workRoot).filter(f => f.endsWith('index.yaml')).sort()) {
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  if (doc?.schema !== 'work/ui-screen') continue;
  const dir = path.dirname(file);
  const rel = path.relative(workRoot, dir).replaceAll('\\', '/');
  const lines = [];
  lines.push(`\n=== ${doc.id} (${rel}) state=${doc.state} brand.rev=${doc.brand?.rev}`);
  for (const asset of doc.ui?.assets ?? []) {
    lines.push(`  ${JSON.stringify(check('ui.assets', asset.path, asset.sha256, dir))}`);
    if (asset.generation?.promptPath) {
      lines.push(`  ${JSON.stringify(check('ui.assets.generation.promptPath', asset.generation.promptPath, null, dir))}`);
    }
    for (const ref of asset.generation?.inputRefs ?? []) {
      lines.push(`  ${JSON.stringify(check('ui.assets.generation.inputRefs', ref, null, dir))}`);
    }
  }
  const prov = doc.ui?.provenance ?? {};
  const walkProv = (node, trail) => {
    if (Array.isArray(node)) { node.forEach((item, i) => walkProv(item, `${trail}[${i}]`)); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.path === 'string') {
      lines.push(`  ${JSON.stringify(check(`provenance.${trail}`, node.path, node.sha256 ?? null))}`);
    }
    for (const [key, value] of Object.entries(node)) if (typeof value === 'object') walkProv(value, trail ? `${trail}.${key}` : key);
  };
  walkProv(prov, '');
  for (const surface of doc.ui?.surfaces ?? []) lines.push(`  route: ${surface.route}`);
  results.push(lines.join('\n'));
}
console.log(results.join('\n'));
const bad = results.join('\n').match(/"verdict": "(?!OK|PRESENT)[A-Z_]+"/g) ?? [];
console.log(`\nnon-OK verdicts: ${bad.length ? [...new Set(bad)].join(', ') : 'none'}`);
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = 0;
