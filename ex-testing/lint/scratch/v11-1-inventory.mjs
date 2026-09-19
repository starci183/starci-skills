import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';

const root = path.resolve(process.cwd());
const workRoot = path.join(root, 'examples/todo-app-backend/.starciwork');
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ID_RE = /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const files = walk(workRoot);
const rel = f => path.relative(workRoot, f).replaceAll('\\', '/');

// 1. ac records inventory
const acs = files.filter(f => /\/ac\/[^/]+\/index\.yaml$/.test(f.replaceAll('\\', '/')));
console.log('AC RECORDS:', acs.length);
const acFields = new Set();
const acList = [];
for (const f of acs) {
  const d = parseYaml(fs.readFileSync(f, 'utf8'));
  for (const k of Object.keys(d)) acFields.add(k);
  const dirFiles = fs.readdirSync(path.dirname(f));
  if (dirFiles.length > 1) console.log('  EXTRA FILES in', rel(path.dirname(f)), dirFiles);
  acList.push({id: d.id, file: f, parentDir: path.dirname(path.dirname(path.dirname(f)))});
}
console.log('ac field union:', [...acFields].join(','));

// 2. parents
const parents = new Map();
for (const a of acList) {
  if (parents.has(a.parentDir)) continue;
  const idx = path.join(a.parentDir, 'index.yaml');
  const d = parseYaml(fs.readFileSync(idx, 'utf8'));
  parents.set(a.parentDir, d);
}
console.log('\nPARENTS:', parents.size);
for (const [p, d] of [...parents.entries()].sort()) {
  console.log(' ', d.id, '| keys:', Object.keys(d).join(','), '| acField:', JSON.stringify(d.acceptanceCriteria ?? d.acceptance ?? null), '| evidence:', fs.existsSync(path.join(p, 'evidence.yaml')));
}

// 3. whole-string ac.* refs anywhere in any yaml (gate semantics)
console.log('\nWHOLE-STRING ac.* REFS:');
const refLines = [];
for (const f of files.filter(f => f.endsWith('.yaml'))) {
  let doc; try { doc = parseYaml(fs.readFileSync(f, 'utf8')); } catch { continue; }
  const collect = (node, trail) => {
    if (typeof node === 'string') { const s = node.trim(); if (ID_RE.test(s) && s.startsWith('ac.')) refLines.push(`${rel(f)} :: ${trail} :: ${s}`); return; }
    if (Array.isArray(node)) return node.forEach(i => collect(i, trail));
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) collect(v, trail ? trail + '.' + k : k);
  };
  collect(doc, '');
}
console.log(refLines.join('\n'));
console.log('total whole-string ac refs:', refLines.length);

// 4. all substring occurrences of ac.<id> in ALL files (incl. non-yaml)
console.log('\nSUBSTRING ac.* OCCURRENCES BY FILE:');
const acIds = new Set(acList.map(a => a.id));
const byFile = new Map();
for (const f of files) {
  if (f.includes(`${path.sep}node_modules${path.sep}`)) continue;
  let text; try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (!text.includes('ac.')) continue;
  let count = 0;
  for (const id of acIds) { const n = text.split(id).length - 1; count += n; }
  // also catch ac ids not in our set (foreign tree refs?)
  const foreign = (text.match(/ac\.[a-z0-9-]+(\.[a-z0-9-]+)+/g) ?? []).filter(m => !acIds.has(m));
  byFile.set(rel(f), {count, foreign: [...new Set(foreign)]});
}
for (const [f, v] of [...byFile.entries()].sort()) console.log(' ', f, '| hits:', v.count, v.foreign.length ? '| FOREIGN: ' + v.foreign.join(',') : '');

// 5. baseline: which done records dep on edited parents or ac ids
const baselineFile = path.join(workRoot, '_derived/deep-baseline.json');
if (fs.existsSync(baselineFile)) {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const parentIds = new Set([...parents.values()].map(d => d.id));
  const broken = ['impl.plan.todo-app-backend.plan', 'impl.share.todo-app-backend.invitations'];
  console.log('\nBASELINE generatedAt:', baseline.generatedAt);
  console.log('baseline has broken impl ids:', broken.map(b => b + '=' + (b in (baseline.records ?? {}))).join(', '));
  const depOnParents = [], depOnAcs = [];
  for (const [id, e] of Object.entries(baseline.records ?? {})) {
    const deps = Object.keys(e.deps ?? {});
    if (deps.some(d => parentIds.has(d))) depOnParents.push(id);
    if (deps.some(d => acIds.has(d))) depOnAcs.push(id);
  }
  console.log('baseline records deping on PARENT ids:', depOnParents.length);
  for (const id of depOnParents) console.log('   ', id);
  console.log('baseline records deping on AC ids:', depOnAcs.length);
  for (const id of depOnAcs) console.log('   ', id);
}
