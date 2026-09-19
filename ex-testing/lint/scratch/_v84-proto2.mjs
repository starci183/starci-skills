// v8-4 scratch: resolve the ambiguities the first prototype surfaced.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';

const root = path.resolve(process.cwd());
const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.resolve(root, p));

for (const workRoot of trees) {
  console.log(`\n########## ${path.relative(root, workRoot)}`);
  const catalog = parseYaml(fs.readFileSync(path.join(workRoot, 'index.yaml'), 'utf8'));
  for (const entry of catalog.features ?? []) {
    const f = path.join(workRoot, entry.directory, 'index.yaml');
    const doc = fs.existsSync(f) ? parseYaml(fs.readFileSync(f, 'utf8')) : null;
    console.log(`CATALOG ${entry.id}: dirField="${entry.directory}" dirTailMatchesId=${entry.directory.endsWith('/' + entry.id)}`);
    console.log(`   catalog.desc : ${JSON.stringify(entry.description)}`);
    console.log(`   feat.title   : ${JSON.stringify(doc?.title)}`);
    console.log(`   feat.desc    : ${JSON.stringify(doc?.description)?.slice(0, 120)}`);
  }
  // every policy-decision: what does it reference?
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    if (doc?.schema === 'work/policy-decision') {
      console.log(`DECISION ${path.relative(workRoot, file).replaceAll('\\', '/')} outcome=${doc.outcome} state=${doc.state} keys=[${Object.keys(doc)}]`);
      console.log(`   tension=${JSON.stringify(doc.tension?.records ?? null)}`);
      console.log(`   blocks=${JSON.stringify(doc.blocks ?? null)}`);
      console.log(`   options=${JSON.stringify((doc.options ?? []).map(o => ({id: o.id, keys: Object.keys(o)})))}`);
    }
  }
  // the both-done conflicts, in full
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(doc?.conflictsWith) && doc.state === 'done') {
      for (const e of doc.conflictsWith) console.log(`CONFLICT ${doc.id} (${doc.state}) -> ${e.record} rev=${e.rev ?? '(none)'} because: ${String(e.because).slice(0, 400)}`);
    }
  }
  // brand shape
  const brandFile = path.join(workRoot, 'brand', 'index.yaml');
  if (fs.existsSync(brandFile)) console.log(`BRAND keys: ${Object.keys(parseYaml(fs.readFileSync(brandFile, 'utf8'))).join(', ')}`);
  // which schemas carry requiresProof anywhere in this tree, and which schemas exist
  const bySchema = new Map();
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel.startsWith('_derived/') || rel.endsWith('/evidence.yaml') || rel.includes('/assets/') || rel.includes('/runs/')) continue;
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    if (!doc?.schema) continue;
    if (!bySchema.has(doc.schema)) bySchema.set(doc.schema, {n: 0, withProof: 0, done: 0, states: new Set()});
    const s = bySchema.get(doc.schema);
    s.n++; if (doc.requiresProof) s.withProof++; if (doc.state === 'done') s.done++; s.states.add(doc.state ?? '(none)');
  }
  for (const [schema, s] of [...bySchema.entries()].sort()) {
    console.log(`SCHEMA ${schema}: n=${s.n} done=${s.done} withRequiresProof=${s.withProof} states=[${[...s.states].join(',')}]`);
  }
}

// what does the aggregate work schema say requiresProof kinds are, per record schema?
const agg = fs.readFileSync(path.join(root, 'schemas', 'work.schema.yaml'), 'utf8');
console.log('\n===== schemas/work.schema.yaml requiresProof mentions =====');
const lines = agg.split(/\r?\n/);
lines.forEach((l, i) => { if (/requiresProof|^\s{2}\w[\w-]*:$|proofKinds|const: work\//.test(l)) console.log(`${i + 1}: ${l.slice(0, 120)}`); });
