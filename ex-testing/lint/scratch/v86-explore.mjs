// Scratch explorer for lane v8-6: what artifact paths do the live trees declare, and do they exist?
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';

const HOST = path.resolve(import.meta.dirname, '..', '..', '..');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.join(HOST, p));
const FILEISH = /(^|\/)[\w.\-]+[.][A-Za-z0-9]{1,5}$/;
const hits = new Map(); // keyTrail -> {count, missing, samples}
const note = (trail, abs, shown) => {
  const entry = hits.get(trail) ?? {count: 0, missing: 0, samples: []};
  entry.count += 1;
  if (!fs.existsSync(abs)) { entry.missing += 1; if (entry.samples.length < 6) entry.samples.push(shown); }
  hits.set(trail, entry);
};

const visit = (node, trail, baseForRel, baseForRepo, shown) => {
  if (typeof node === 'string') {
    const s = node.trim();
    if (!s || s.includes(' ') || s.includes('*')) return;
    if (/^[a-z]+:\/\//i.test(s) || s.startsWith('http') || s.startsWith('postgres')) return;
    if (!FILEISH.test(s) && !s.includes('/')) return;
    if (!FILEISH.test(s)) return;
    if (s.startsWith('examples/') || s.startsWith('knowledge/')) {
      note(trail, path.join(HOST, s), s);
      return;
    }
    if (s.startsWith('.starcistacks/')) {
      note(trail, path.join(baseForRepo, s), s);
      return;
    }
    if (s.startsWith('/') || s.startsWith('\\')) return;
    if (/^[A-Za-z]:/.test(s)) return;
    note(trail, path.join(baseForRel, s), s);
    return;
  }
  if (Array.isArray(node)) return node.forEach((item, i) => visit(item, `${trail}[]`, baseForRel, baseForRepo, shown));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) visit(v, trail ? `${trail}.${k}` : k, baseForRel, baseForRepo, shown);
  }
};

for (const workRoot of trees) {
  const repoRoot = path.dirname(workRoot);
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!doc || typeof doc !== 'object') continue;
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    visit(doc, `${path.basename(rel)}<${doc.schema ?? '?'}>`, path.dirname(file), repoRoot, rel);
  }
}

const lines = [...hits.entries()]
  .map(([trail, v]) => `${String(v.count).padStart(4)} decl, ${String(v.missing).padStart(4)} missing  ${trail}`)
  .sort((a, b) => (Number(b.match(/(\d+) decl/)[1]) - Number(a.match(/(\d+) decl/)[1])));
console.log(lines.join('\n'));
console.log('\n--- missing samples ---');
for (const [trail, v] of hits) if (v.missing) console.log(`${trail}: ${v.missing}/${v.count}\n  ${v.samples.join('\n  ')}`);
