// v8-4 scratch: survey the live shapes of the fields the cross-record checks read.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';

const root = path.resolve(process.cwd());
const trees = ['.starciwork'].length
  ? ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.resolve(root, p))
  : [];

const shape = v => Array.isArray(v) ? `[${v.length ? shape(v[0]) : ''}]` : (v && typeof v === 'object') ? `{${Object.keys(v).join(',')}}` : typeof v;

const fieldHits = new Map();
const catalogues = [];
for (const workRoot of trees) {
  console.log(`\n===== ${path.relative(root, workRoot)} =====`);
  const files = walk(workRoot).filter(f => f.endsWith('.yaml'));
  for (const file of files) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel.startsWith('_derived/') || rel.includes('/assets/')) continue;
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!doc || typeof doc !== 'object') continue;
    if (doc.schema === 'work/catalog') {
      catalogues.push({workRoot: path.relative(root, workRoot), rel, catalog: doc});
      console.log(`CATALOG ${rel}: ${JSON.stringify(doc).slice(0, 700)}`);
    }
    for (const f of ['acceptanceCriteria', 'requiresProof', 'composes', 'conflictsWith', 'proves', 'tension', 'closedBy', 'directory', 'files', 'acRule', 'ac', 'state', 'schema']) {
      if (!(f in doc)) continue;
      const key = `${doc.schema ?? '(no schema)'}.${f}`;
      if (!fieldHits.has(key)) fieldHits.set(key, []);
      fieldHits.get(key).push({rel, value: doc[f], shape: shape(doc[f])});
    }
  }
}
console.log('\n===== field shapes =====');
for (const [key, hits] of [...fieldHits.entries()].sort()) {
  const shapes = new Set(hits.map(h => h.shape));
  console.log(`${key}: ${hits.length} occurrence(s), shapes: ${[...shapes].join(' | ')}`);
  for (const h of hits.slice(0, 3)) console.log(`   ${h.rel}: ${JSON.stringify(h.value).slice(0, 320)}`);
}

// layout of an ac/ subtree and a fr/br subtree
console.log('\n===== tree layout sample (first feature of each tree) =====');
for (const workRoot of trees) {
  const feats = fs.readdirSync(path.join(workRoot, 'features')).filter(d => fs.statSync(path.join(workRoot, 'features', d)).isDirectory());
  console.log(`${path.relative(root, workRoot)} features: ${feats.join(', ')}`);
  const f0 = path.join(workRoot, 'features', feats[0]);
  console.log(walk(f0).map(f => '   ' + path.relative(workRoot, f).replaceAll('\\', '/')).join('\n'));
}
