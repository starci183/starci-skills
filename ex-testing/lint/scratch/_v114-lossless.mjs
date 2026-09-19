import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../core/yaml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const runs = [
  'examples/todo-app-backend/.starciwork/features/task/uat/create/runs/20260919T112844Z-5c10a673',
  'examples/todo-app-backend/.starciwork/features/recur/uat/make-recurring/runs/20260919T143618Z-5c10a673',
  'examples/todo-app-backend/.starciwork/features/recur/uat/make-recurring/runs/20260919T144405Z-5c10a673',
  'examples/todo-app-backend/.starciwork/features/login/uat/sign-in/runs/20260918T174721Z-023dd8d9',
  'examples/ecommerce-app-be/.starciwork/features/checkout/uat/place-order/runs/20260919T155312Z-5c10a673',
  'examples/ecommerce-app-be/.starciwork/features/identity/uat/sign-in/runs/20260919T152145Z-5c10a673',
];
let ok = 0, bad = 0;
for (const run of runs) {
  const doc = parseYaml(fs.readFileSync(path.join(root, run, 'manifest.yaml'), 'utf8'));
  for (const [name, folded] of Object.entries(doc.files ?? {})) {
    let orig;
    try {
      orig = execFileSync('git', ['show', `HEAD:${run}/${name}`], {encoding: 'utf8', cwd: root});
    } catch { console.log(`${run} ${name}: no git baseline`); continue; }
    const same = name.endsWith('.json')
      ? JSON.stringify(JSON.parse(orig)) === JSON.stringify(folded)
      : orig.replace(/\r\n/g, '\n') === folded;
    if (same) ok++;
    else { bad++; console.log(`DIFFERS: ${run}/${name}`); }
  }
}
console.log(`lossless folds: ${ok}; mismatches: ${bad}`);
