// v7-3 lane helper: where do the absolute machine paths (v6-4 Q6) actually live? Count files per tree
// per family, so the handoff to the lane that owns them names a precise set instead of a gesture.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..', 'examples');
const walk = d => fs.readdirSync(d, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

for (const tree of ['todo-app-backend', 'ecommerce-app-be']) {
  const workRoot = path.join(root, tree, '.starciwork');
  const byFamily = new Map();
  let hits = 0;
  for (const file of walk(workRoot)) {
    if (!/\.(yaml|md|txt)$/.test(file)) continue;
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel.startsWith('_derived/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    const n = (text.match(/[A-Za-z]:[\/\\]Users[\/\\]/g) ?? []).length;
    if (!n) continue;
    hits += n;
    const fam = rel.startsWith('brand/') ? 'brand' : rel.startsWith('_resources/') ? '_resources'
      : rel.startsWith('features/') ? `features/*/${rel.split('/')[2]}/**` : rel.split('/')[0];
    byFamily.set(fam, (byFamily.get(fam) ?? 0) + n);
  }
  console.log(`\n${tree}: ${hits} absolute-path occurrence(s) outside _derived/`);
  for (const [fam, n] of [...byFamily.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${fam}`);
  console.log(`  _resources/**: ${byFamily.get('_resources') ?? 0}  <- v7-3 owned scope`);
}
