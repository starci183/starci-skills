/** v7-14 final verification: machine paths, repository/dir consistency, gate-visible owner resolution. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
import {readWorkspace, repoRootFor, resolveOwnedDirs, loadRecords} from '../../../../scripts/example-ownership.mjs';

const HOST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const TREES = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'];
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory()
  ? (['_derived', '_local'].includes(e.name) ? [] : walk(path.join(d, e.name)))
  : [path.join(d, e.name)]);

const abs = [];
const repoValues = new Map();
const dirMismatch = [];
const unresolvable = [];
const docs = [];
for (const rel of TREES) {
  const workRoot = path.join(HOST, rel);
  const workspaceDoc = readWorkspace(workRoot);
  const records = loadRecords(workRoot, walk);
  for (const f of walk(workRoot)) {
    if (!f.endsWith('.yaml')) continue;
    const rrel = path.relative(HOST, f).replaceAll('\\', '/');
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.match(/[A-Za-z]:[\\/](?:Users|Program Files)[^\s"',\]]*/g) ?? []) {
      abs.push(`${rrel.endsWith('evidence.yaml') ? 'payload' : 'RECORD'}  ${rrel}  ${m}`);
    }
    let data;
    try { data = parseYaml(text); } catch (e) { abs.push(`PARSE   ${rrel}  ${e.message}`); continue; }
    if (!data || typeof data !== 'object') continue;
    docs.push({rrel, data});
    if (typeof data.repository === 'string') {
      repoValues.set(data.repository, (repoValues.get(data.repository) ?? 0) + 1);
      const seg = rrel.split('/');
      const i = seg.lastIndexOf('impl');
      if (i >= 0 && seg[i + 1] && seg[i + 1] !== data.repository) dirMismatch.push(`${rrel}: field=${data.repository} dir=${seg[i + 1]}`);
    }
    if (data.schema === 'work/implementation' && typeof data.repository === 'string') {
      const root = repoRootFor(workRoot, data.repository, workspaceDoc);
      if (!fs.existsSync(root)) unresolvable.push(`${rrel}: repository ${data.repository} resolves to missing ${path.relative(HOST, root)}`);
    }
  }
  const ws = parseYaml(fs.readFileSync(path.join(workRoot, 'workspace.yaml'), 'utf8'));
  console.log(`\n${rel} workspace repositories: ${ws.repositories.map(r => `${r.role}:${r.name}`).join(' ')}`);
  for (const r of ws.repositories) {
    const target = repoRootFor(workRoot, r.name, ws);
    console.log(`  ${r.role} ${r.name} -> ${path.relative(HOST, target).replaceAll('\\', '/')}  exists=${fs.existsSync(target)}`);
  }
}

console.log(`\nmachine-absolute paths remaining: ${abs.length}`);
const byKind = {};
for (const a of abs) byKind[a.split(/\s+/)[0]] = (byKind[a.split(/\s+/)[0]] ?? 0) + 1;
console.log(JSON.stringify(byKind));
for (const a of abs.filter(x => x.startsWith('RECORD') || x.startsWith('PARSE'))) console.log('  ' + a);
console.log(`impl directory/field mismatches: ${dirMismatch.length}`);
for (const m of dirMismatch) console.log('  ' + m);
console.log(`repository values in use: ${[...repoValues.entries()].map(([k, v]) => `${k}(${v})`).join(' ')}`);
console.log(`impl records whose repository resolves to a missing directory: ${unresolvable.length}`);
for (const u of unresolvable) console.log('  ' + u);
