// _tinkle6-fix-nodekinds.mjs — repair route.nodeKinds where the append script's
// inline-regex missed block-sequence nodeKinds. Parses each file properly and
// rewrites only the `  nodeKinds: ...` line inside the route: block.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../core/yaml.mjs';

const opsDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'modules', 'ops', 'ops');
let fixed = 0;
for (const f of fs.readdirSync(opsDir).filter(f => f.endsWith('.yaml'))) {
  const file = path.join(opsDir, f);
  const text = fs.readFileSync(file, 'utf8');
  const doc = parseYaml(text);
  const nk = doc.nodeKinds ?? [];
  const wanted = `  nodeKinds: [${nk.join(', ')}]`;
  // replace the nodeKinds line that sits inside the route: block (last one in file)
  const lines = text.split('\n');
  const ri = lines.findIndex(l => l === 'route:');
  if (ri < 0) { console.log(`${f}: no route block`); continue; }
  const li = lines.findIndex((l, i) => i > ri && /^  nodeKinds:/.test(l));
  if (li < 0) { console.log(`${f}: no route.nodeKinds`); continue; }
  if (lines[li] !== wanted) { lines[li] = wanted; fs.writeFileSync(file, lines.join('\n')); fixed++; }
}
console.log(`fixed ${fixed}`);
