// v7-3 lane helper: for every work/implementation record of a frontend repository in both example
// trees, print each owners[].path with whether that directory exists under the resolved repo root,
// and what a real route-looking sibling would be. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';

const examplesRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'examples');

for (const tree of ['todo-app-backend', 'ecommerce-app-be']) {
  const workRoot = path.join(examplesRoot, tree, '.starciwork');
  const ws = parseYaml(fs.readFileSync(path.join(workRoot, 'workspace.yaml'), 'utf8'));
  const repos = ws.repositories ?? [];
  console.log(`\n=== ${tree} (workspace.yaml project=${ws.project}) ===`);
  for (const r of repos) console.log(`  repositories: role=${r.role} name=${r.name}`);
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml') && !f.endsWith('evidence.yaml'))) {
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!data || data.schema !== 'work/implementation') continue;
    const entry = repos.find(r => r?.name === data.repository);
    const role = entry ? entry.role : '(no workspace entry)';
    const repoRoot = entry && entry.role !== 'be'
      ? path.join(examplesRoot, data.repository)
      : path.join(examplesRoot, tree);
    const dirRel = path.relative(workRoot, path.dirname(file)).replaceAll('\\', '/');
    console.log(`\n  ${data.id}  [state=${data.state} repository=${data.repository} role=${role}]`);
    console.log(`    impl dir: ${dirRel}`);
    if (!entry) console.log(`    !! repository "${data.repository}" is not a repositories[] name in workspace.yaml`);
    const dirSays = dirRel.split('/')[3];
    if (dirSays && dirSays !== data.repository) console.log(`    !! impl directory segment "${dirSays}" != repository "${data.repository}"`);
    for (const o of data.owners ?? []) {
      const abs = path.join(repoRoot, o.path);
      const exists = fs.existsSync(abs) && fs.statSync(abs).isDirectory();
      console.log(`    ${exists ? 'OK    ' : 'MISSING'} role=${o.role} path=${o.path}`);
      if (!exists) {
        const parent = path.dirname(abs);
        const siblings = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
        console.log(`             parent ${path.relative(examplesRoot, parent).replaceAll('\\', '/')} has: ${siblings.join(', ') || '(absent)'}`);
      }
    }
  }
}
