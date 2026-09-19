/** v7-14: census of impl records and the evidence fields that decide whether an index.yaml edit shows up as a refusal. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';

const HOST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const walk = (dir, names) => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory()
  ? walk(path.join(dir, e.name), names)
  : (names.includes(e.name) ? [path.join(dir, e.name)] : []));

const todo = walk(path.join(HOST, 'examples/todo-app-backend/.starciwork/features'), ['index.yaml']);
const ec = walk(path.join(HOST, 'examples/ecommerce-app-be/.starciwork/features'), ['index.yaml']);
const impl = [...todo, ...ec].map(f => path.relative(HOST, f).replaceAll('\\', '/')).filter(f => f.includes('/impl/'));
const byRepo = {};
for (const f of impl) {
  const seg = f.split('/');
  const repo = seg[seg.lastIndexOf('impl') + 1];
  byRepo[repo] = (byRepo[repo] ?? 0) + 1;
}
console.log(`impl records total ${impl.length}: ${JSON.stringify(byRepo)}`);

const gate = fs.readFileSync(path.join(HOST, 'ex-testing/lint/scratch/v7-14/gate-final.txt'), 'utf8').trim().split(/\r?\n/);
const refused = new Set(gate.filter(l => /recordDigest /.test(l)).map(l => l.replace(/^REFUSED /, '').split(':')[0]));
const mine = fs.readFileSync(path.join(HOST, 'ex-testing/lint/scratch/v7-14/fix-apply.txt'), 'utf8').split(/\r?\n/)
  .filter(l => l.startsWith('# ')).map(l => l.slice(2).split(' ')[0]).filter(f => !f.endsWith('workspace.yaml'));
console.log(`\nmy edited records: ${mine.length}`);
for (const f of mine) {
  const ev = path.join(HOST, path.dirname(f), 'evidence.yaml');
  if (!fs.existsSync(ev)) { console.log(`  no-evidence      ${f}`); continue; }
  const doc = parseYaml(fs.readFileSync(ev, 'utf8'));
  const has = 'recordDigest' in (doc ?? {});
  console.log(`  ${(refused.has(f.replace(/^examples/, 'examples')) || refused.has(path.relative(HOST, ev).replaceAll('\\', '/'))) ? 'refused  ' : has ? 'accepted?' : 'no-field '} ${f}`);
}
