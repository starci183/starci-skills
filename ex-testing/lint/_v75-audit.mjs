// v7-5 lane audit: tree roots, catalog<->dirs, assets payloads. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../core/yaml.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.join(root, p));

const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

for (const workRoot of trees) {
  console.log(`\n=== ${path.relative(root, workRoot).replaceAll('\\', '/')}`);
  console.log('-- root entries --');
  for (const e of fs.readdirSync(workRoot, {withFileTypes: true})) {
    const p = path.join(workRoot, e.name);
    let extra = '';
    if (e.isDirectory()) {
      const n = walk(p).length;
      extra = ` (dir, ${n} file${n === 1 ? '' : 's'})`;
    } else {
      extra = ` (${fs.statSync(p).size} bytes)`;
    }
    console.log(`   ${e.isDirectory() ? 'd' : 'f'} ${e.name}${extra}`);
  }

  const catalogFile = path.join(workRoot, 'index.yaml');
  const catalog = parseYaml(fs.readFileSync(catalogFile, 'utf8'));
  const catalogIds = (catalog.features ?? []).map(f => f.id);
  const catalogDirs = (catalog.features ?? []).map(f => f.directory);
  const actualDirs = fs.readdirSync(path.join(workRoot, 'features'), {withFileTypes: true})
    .filter(e => e.isDirectory()).map(e => e.name).sort();
  console.log('-- catalog --');
  console.log(`   schema=${catalog.schema} id=${catalog.id}`);
  console.log(`   entries(${catalogIds.length}): ${catalogIds.join(', ')}`);
  console.log(`   directories: ${catalogDirs.join(', ')}`);
  console.log(`   actual features/* dirs(${actualDirs.length}): ${actualDirs.join(', ')}`);
  const missingDir = catalogDirs.filter(d => !fs.existsSync(path.join(workRoot, d.replaceAll('/', path.sep))));
  const unlisted = actualDirs.filter(f => !catalogDirs.includes(`features/${f}`));
  const orphanIds = catalogIds.filter(id => !actualDirs.includes(id));
  console.log(`   entry->missing dir: ${missingDir.length ? missingDir.join(', ') : 'none'}`);
  console.log(`   dir not listed: ${unlisted.length ? unlisted.join(', ') : 'none'}`);
  console.log(`   catalog id with no dir: ${orphanIds.length ? orphanIds.join(', ') : 'none'}`);

  console.log('-- feature node index.yaml --');
  for (const f of actualDirs) {
    const file = path.join(workRoot, 'features', f, 'index.yaml');
    if (!fs.existsSync(file)) { console.log(`   ${f}: NO index.yaml`); continue; }
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    const entry = (catalog.features ?? []).find(x => x.id === f);
    const ok = doc.id === f && doc.schema === 'work/feature' && entry;
    console.log(`   ${f}: ${ok ? 'ok' : 'MISMATCH'} schema=${doc.schema} id=${doc.id} catalogEntry=${entry ? 'yes' : 'NO'}`);
  }

  console.log('-- yaml under assets/ --');
  for (const file of walk(path.join(workRoot, 'features')).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (!rel.includes('/assets/')) continue;
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    console.log(`   ${rel}: schema=${doc?.schema ?? '(none)'} id=${doc?.id ?? '(none)'} state=${doc?.state ?? '(none)'}`);
  }

  console.log('-- non-yaml files that are not assets/run/binary payloads --');
  for (const file of walk(workRoot)) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (/^(index\.yaml|workspace\.yaml|\.gitignore|ledger-anchor\.json)$/.test(rel)) continue;
    if (rel.startsWith('features/') && !rel.endsWith('index.yaml') && !rel.endsWith('evidence.yaml')
      && !rel.endsWith('accounts.yaml') && !rel.endsWith('fixtures.yaml') && !rel.endsWith('.md')) continue;
    if (rel.startsWith('_derived/') || rel.startsWith('_resources/') || rel.startsWith('brand/')) continue;
    console.log(`   ${rel}`);
  }
}

console.log('\n=== _resources custody (flag only) ===');
for (const workRoot of trees) {
  const dir = path.join(workRoot, '_resources');
  if (!fs.existsSync(dir)) { console.log(`${path.relative(root, workRoot)}: no _resources`); continue; }
  for (const file of walk(dir).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    console.log(`   ${rel}: id=${doc.id} kind=${doc.kind} schema=${doc.schema}`);
    for (const k of ['realm', 'repository', 'environment', 'target', 'origins', 'probes']) {
      if (doc[k] != null) console.log(`      ${k}: ${JSON.stringify(doc[k])}`);
    }
  }
  console.log(`   workspace.yaml: ${fs.readFileSync(path.join(workRoot, 'workspace.yaml'), 'utf8').replace(/\n/g, ' | ')}`);
}
