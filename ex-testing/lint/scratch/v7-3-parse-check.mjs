// v7-3 lane helper: core/yaml.mjs throws on a bracketed plain scalar inside a flow mapping, and the
// gate crashes on that while scripts/example-ownership.mjs's loadRecords() silently SKIPS the file.
// So "the gate ran" is not enough: check that every file this lane edited still yields its record id
// through the swallowing parser the evidence/derive tooling uses.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {loadRecords, resolveOwnedDirs, missingOwnedDirs} from '../../../scripts/example-ownership.mjs';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const EDITED = [
  ['todo-app-backend', 'impl.task.todo-app-frontend.task-list'],
  ['todo-app-backend', 'impl.notify.todo-app-frontend.preferences'],
  ['todo-app-backend', 'impl.plan.todo-app-frontend.usage'],
  ['todo-app-backend', 'impl.recur.todo-app-frontend.schedule'],
  ['todo-app-backend', 'impl.share.todo-app-frontend.invite-screen'],
  ['todo-app-backend', 'impl.audit.todo-app-frontend.privacy'],
  ['todo-app-backend', 'impl.login.todo-app-frontend.sign-in'],
  ['todo-app-backend', 'identity.todo-app.demo'],
  ['todo-app-backend', 'environment.todo-app.dev'],
  ['todo-app-backend', 'fixture.todo-app.seed'],
];

let bad = 0;
for (const [tree, id] of EDITED) {
  const workRoot = path.join(root, 'examples', tree, '.starciwork');
  const workspaceDoc = parseYaml(fs.readFileSync(path.join(workRoot, 'workspace.yaml'), 'utf8'));
  const records = loadRecords(workRoot, f => fs.readdirSync(f, {withFileTypes: true})
    .flatMap(e => e.isDirectory() ? f2(path.join(f, e.name)) : [path.join(f, e.name)]));
  const rec = records.get(id);
  if (!rec) { console.log(`DROPPED  ${id} - loadRecords does not see it (unparseable or idless)`); bad++; continue; }
  const owned = resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot);
  const missing = missingOwnedDirs(owned);
  const file = ['index.yaml', 'resource.yaml'].map(n => path.join(rec.dir, n)).find(fs.existsSync);
  const raw = parseYaml(fs.readFileSync(file, 'utf8'));
  console.log(`PARSED   ${id.padEnd(42)} state=${String(raw.state).padEnd(5)} ownedDirs=${owned.length} missing=${missing.length ? missing.map(m => m.rel).join(', ') : 'none'}`);
  if (missing.length) bad++;
}
function f2(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? f2(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
console.log(bad ? `\n${bad} problem(s)` : '\nall edited records parse and every owned directory resolves');
