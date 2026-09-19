import path from 'node:path';
import fs from 'node:fs';
import {parseYaml} from '../../../core/yaml.mjs';

const root = 'D:/Repositories/starci-academy-backend/.claude';
const trees = {
  'todo-be': path.join(root, 'examples/todo-app-backend/.starciwork'),
  'ec-be': path.join(root, 'examples/ecommerce-app-be/.starciwork'),
};
// Mirrors example-derive.mjs's own two tally filters: a record is tallied only if it has a feature
// AND bucketOf(effectiveState) is non-null (done|suspended|blocked|todo).
const BUCKET = s => (s === 'done' ? 'done' : s === 'suspended' ? 'stale' : s === 'blocked' ? 'blocked' : s === 'todo' ? 'todo' : null);

for (const [name, workRoot] of Object.entries(trees)) {
  const doc = parseYaml(fs.readFileSync(path.join(workRoot, '_derived/index.yaml'), 'utf8'));
  const withState = [], droppedUnvocab = [], droppedNoFeature = [];
  for (const [id, r] of Object.entries(doc.records ?? {})) {
    if (r.effectiveState === null || r.effectiveState === undefined) continue;
    withState.push(id);
    if (!BUCKET(r.effectiveState)) droppedUnvocab.push(`${id} [${r.effectiveState}] feature=${r.feature}`);
    else if (!r.feature) droppedNoFeature.push(`${id} [${r.effectiveState}]`);
  }
  const tallied = withState.length - droppedUnvocab.length - droppedNoFeature.length;
  console.log(`=== ${name}`);
  console.log(`  records with a lifecycle state: ${withState.length}`);
  console.log(`  tally.total as written: ${doc.tally.overall.total}`);
  console.log(`  -> would be tallied: ${tallied}`);
  console.log(`  dropped, state outside derive's vocabulary (bucketOf => null): ${droppedUnvocab.length}`);
  for (const d of droppedUnvocab) console.log(`      ${d}`);
  console.log(`  dropped, no feature (outside features/**): ${droppedNoFeature.length}`);
  for (const d of droppedNoFeature) console.log(`      ${d}`);
}
