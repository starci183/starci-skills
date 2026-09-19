// v7-5 lane audit 2: references to the files being moved, ui states, impl dir/repository naming. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../core/yaml.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

console.log('=== references to DIRECTIONS.md / generation-receipts / direction-check (whole host) ===');
const needles = ['DIRECTIONS.md', 'directions.md', 'generation-receipts', 'direction-check'];
for (const file of walk(root).filter(f => /\.(yaml|yml|md|mjs|json|txt)$/.test(f) && !/[\\/](node_modules|\.git|dist|\.next)[\\/]/.test(f))) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (rel.startsWith('ex-testing/lint/_v75')) continue;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const hits = needles.filter(n => text.includes(n));
  if (!hits.length) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (hits.some(h => line.includes(h))) console.log(`   ${rel}:${i + 1}: ${line.trim().slice(0, 160)}`);
  });
}

console.log('\n=== ec ui record states ===');
for (const f of walk(path.join(root, 'examples/ecommerce-app-be/.starciwork/features'))) {
  const rel = path.relative(root, f).replaceAll('\\', '/');
  if (!/\/ui\/[^/]+\/index\.yaml$/.test(rel)) continue;
  const doc = parseYaml(fs.readFileSync(f, 'utf8'));
  console.log(`   ${rel}: schema=${doc.schema} id=${doc.id} state=${doc.state} assetsDeclared=${(doc.ui?.assets ?? []).length}`);
}

console.log('\n=== impl dir vs record repository (todo + ec) ===');
for (const tree of ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork']) {
  for (const f of walk(path.join(root, tree))) {
    const rel = path.relative(root, f).replaceAll('\\', '/');
    const m = rel.match(/features\/([^/]+)\/impl\/([^/]+)\/([^/]+)\/index\.yaml$/);
    if (!m) continue;
    const doc = parseYaml(fs.readFileSync(f, 'utf8'));
    const flag = doc.repository === m[2] ? 'ok' : 'MISMATCH';
    console.log(`   ${rel}: dir=${m[2]} repository=${doc.repository} state=${doc.state} [${flag}]`);
  }
}

console.log('\n=== _derived top-level keys (both trees) ===');
for (const tree of ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork']) {
  const dir = path.join(root, tree, '_derived');
  if (!fs.existsSync(dir)) continue;
  for (const f of walk(dir)) {
    const rel = path.relative(root, f).replaceAll('\\', '/');
    if (!f.endsWith('.yaml')) { console.log(`   ${rel}: (not yaml, ${fs.statSync(f).size} bytes)`); continue; }
    const doc = parseYaml(fs.readFileSync(f, 'utf8'));
    console.log(`   ${rel}: keys=[${Object.keys(doc ?? {}).join(', ')}] id=${doc?.id ?? '(none)'} schema=${doc?.schema ?? '(none)'}`);
  }
}
