import path from 'node:path';
import fs from 'node:fs';
import {parseYaml} from '../../../core/yaml.mjs';

const root = 'D:/Repositories/starci-academy-backend/.claude';
const trees = {
  'todo-be': path.join(root, 'examples/todo-app-backend/.starciwork'),
  'ec-be': path.join(root, 'examples/ecommerce-app-be/.starciwork'),
};

for (const [name, workRoot] of Object.entries(trees)) {
  const doc = parseYaml(fs.readFileSync(path.join(workRoot, '_derived/index.yaml'), 'utf8'));
  const records = doc.records ?? {};
  const ids = Object.keys(records);
  const kindCount = {};
  let withUsedBy = 0;
  for (const id of ids) {
    const ub = records[id].usedBy ?? {};
    if (Object.keys(ub).length) withUsedBy++;
    for (const [k, v] of Object.entries(ub)) kindCount[k] = (kindCount[k] ?? 0) + v.length;
  }
  const unclass = doc.unclassifiedEdges ?? [];
  const fieldCount = {};
  for (const e of unclass) fieldCount[e.field] = (fieldCount[e.field] ?? 0) + 1;

  const provesEdges = unclass.filter(e => e.field === 'proves' || e.field.endsWith('.proves'));
  const provesTargets = new Set(provesEdges.map(e => e.target));
  // Does any proves target carry a "proves" reverse-edge bucket in usedBy? (expected: never)
  const targetsWithProvesBucket = [...provesTargets].filter(t => Array.isArray(records[t]?.usedBy?.proves));
  // And are those targets reachable at all in usedBy under any kind?
  const targetsWithAnyUsedBy = [...provesTargets].filter(t => Object.keys(records[t]?.usedBy ?? {}).length > 0);

  console.log(`\n=== ${name} ===`);
  console.log(`records in derived index: ${ids.length}`);
  console.log(`records with a non-empty usedBy: ${withUsedBy}`);
  console.log(`usedBy edge kinds (edges total): ${JSON.stringify(kindCount)}`);
  console.log(`unclassifiedEdges: ${unclass.length} total; by field: ${JSON.stringify(fieldCount)}`);
  console.log(`proves edges filed unclassified: ${provesEdges.length}, naming ${provesTargets.size} distinct targets`);
  console.log(`  of those targets, carrying a usedBy.proves bucket: ${targetsWithProvesBucket.length}`);
  console.log(`  of those targets, carrying ANY usedBy bucket: ${targetsWithAnyUsedBy.length} / ${provesTargets.size}`);
  const provenByKinds = Object.entries(kindCount).filter(([k]) => k.toLowerCase().includes('proven'));
  console.log(`classified provenBy-family buckets: ${JSON.stringify(provenByKinds)}`);
  for (const [id, r] of Object.entries(records)) {
    const kinds = Object.keys(r.usedBy ?? {});
    if (kinds.some(k => k.startsWith('provenBy') || k === 'contractProvider' || k === 'contractConsumer')) {
      console.log(`  ${id} <- ${JSON.stringify(Object.fromEntries(Object.entries(r.usedBy).filter(([k]) => /proven|contract/.test(k))))}`);
    }
  }
}
