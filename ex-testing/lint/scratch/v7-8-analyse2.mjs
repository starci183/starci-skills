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
  const reasons = {};
  const eff = {};
  for (const r of Object.values(doc.records ?? {})) {
    eff[r.effectiveState ?? '(null)'] = (eff[r.effectiveState ?? '(null)'] ?? 0) + 1;
    if (r.suspensionReason) {
      const key = r.suspensionReason.startsWith('appliesTo-newer:') ? 'appliesTo-newer:*' : r.suspensionReason;
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
  }
  console.log(`=== ${name}`);
  console.log(`  effectiveState distribution: ${JSON.stringify(eff)}`);
  console.log(`  suspensionReason distribution: ${JSON.stringify(reasons)}`);
  const t = doc.tally ?? {};
  console.log(`  tally.overall: ${JSON.stringify(t.overall)}  gaps=${(t.gaps ?? []).length} unbuiltModuleGaps=${t.unbuiltModuleGaps}`);
  console.log(`  frontier entries: ${(doc.frontier ?? []).length}`);
  console.log(`  files in _derived: ${fs.readdirSync(path.join(workRoot, '_derived')).join(', ')}`);
}
