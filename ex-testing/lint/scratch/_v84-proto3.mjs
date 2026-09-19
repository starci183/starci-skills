// v8-4 scratch: schema-declared vocabulary, proves edge kinds, out-of-enum states.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';

const root = path.resolve(process.cwd());
for (const f of fs.readdirSync(path.join(root, 'schemas')).filter(n => /^work-.*\.schema\.yaml$/.test(n))) {
  const d = parseYaml(fs.readFileSync(path.join(root, 'schemas', f), 'utf8'));
  const props = d?.properties ? Object.keys(d.properties) : [];
  console.log(`${f.padEnd(44)} const=${JSON.stringify(d?.properties?.schema?.const)} requiresProof=${props.includes('requiresProof')} proves=${props.includes('proves')} stateEnum=${JSON.stringify(d?.$defs?.state?.enum ?? null)} acceptanceCriteria=${props.includes('acceptanceCriteria')} conflictsWith=${props.includes('conflictsWith')} closedBy=${props.includes('closedBy')}`);
}

const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'];
const targets = new Map();
for (const t of trees) {
  const workRoot = path.resolve(root, t);
  const recs = new Map();
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const r = path.relative(workRoot, file).replaceAll('\\', '/');
    if (r.startsWith('_derived/') || r.endsWith('/evidence.yaml') || r.includes('/assets/') || r.includes('/runs/')) continue;
    let d; try { d = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (d && d.id) recs.set(d.id, {schema: d.schema, state: d.state, data: d, rel: r});
  }
  for (const [id, rec] of recs) {
    for (const p of (Array.isArray(rec.data.proves) ? rec.data.proves : [])) {
      const tg = recs.get(p);
      const key = `${rec.schema} -> ${tg ? tg.schema : '(missing)'}`;
      targets.set(key, (targets.get(key) ?? 0) + 1);
      if (tg?.schema === 'work/acceptance-criterion') console.log(`AC TARGET: ${t} ${id} proves ${p}`);
    }
    if (rec.data.state != null && !['todo', 'done'].includes(rec.data.state)) {
      console.log(`ODD STATE: ${t} ${rec.rel} ${rec.schema} state=${JSON.stringify(rec.data.state)}`);
    }
  }
}
console.log('--- proves edge kinds ---');
for (const [k, v] of [...targets.entries()].sort()) console.log(`${k}: ${v}`);
