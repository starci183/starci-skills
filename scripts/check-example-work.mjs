import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The layout says an id mirrors its directory while remaining the identity. That sentence is only true if
 * something checks it: renaming `impl/todo-app` to `impl/todo-app-backend` left thirteen records whose id
 * still said `todo-app`, and the YAML gate accepted every one of them because each file parsed. A record
 * whose id does not match its place is the mismatch the layout forbids, and a ref to an id no record owns
 * is a dangling edge that reads as a satisfied dependency.
 *
 * Both are structural, so both are checked here rather than described in prose.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAMILIES = new Set(['br', 'ac', 'fr', 'nfr', 'data', 'journey', 'decision', 'sds', 'ui', 'impl', 'uat', 'contract', 'integration']);
const EXEMPT = new Set(['work/catalog', 'work/workspace', 'work/brand', 'work/feature', 'work/disposable-accounts', 'starci/application-stacks']);

const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

/** The id a record in this directory must carry: the innermost family, the feature, then the rest in order. */
const expectedId = segments => {
  const feature = segments[1];
  const rest = segments.slice(2, -1);
  const family = [...rest].reverse().find(segment => FAMILIES.has(segment));
  if (!family) return null;
  return [family, feature, ...rest.filter(segment => !FAMILIES.has(segment))].join('.');
};

const problems = [];
const records = new Map();
const refs = [];
const collect = (node, file, trail) => {
  if (typeof node === 'string') {
    if (/^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(node.trim())) refs.push({id: node.trim(), file, trail});
    return;
  }
  if (Array.isArray(node)) return node.forEach(item => collect(item, file, trail));
  if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) collect(value, file, trail ? `${trail}.${key}` : key);
};

for (const workRoot of walk(path.join(root, 'examples')).filter(file => file.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname)) {
  for (const file of walk(workRoot).filter(file => file.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    const shown = path.relative(root, file).replaceAll('\\', '/');
    const record = parseYaml(fs.readFileSync(file, 'utf8'));
    if (!record || typeof record !== 'object') continue;
    const segments = rel.split('/');

    if (rel.endsWith('/evidence.yaml')) {
      const sibling = parseYaml(fs.readFileSync(path.join(path.dirname(file), 'index.yaml'), 'utf8'));
      if (record.record !== sibling?.id) problems.push(`${shown}: evidence names ${record.record}, but the record beside it is ${sibling?.id}`);
      continue;
    }
    if (record.id) records.set(record.id, shown);
    if (segments[0] === 'features' && segments.length > 2 && !EXEMPT.has(record.schema)) {
      const want = expectedId(segments);
      if (want && record.id !== want) problems.push(`${shown}: id is ${record.id}, but its place says ${want}`);
      if (!want) problems.push(`${shown}: no record family in its path; ${[...FAMILIES].join(', ')} are the families`);
    }
    // blockedBy carries prose that names ids on purpose; it is a note, not an edge.
    collect({...record, blockedBy: undefined, description: undefined, responsibility: undefined}, shown, '');
  }
}

for (const ref of refs) if (!records.has(ref.id)) problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}, which no record owns`);

for (const problem of problems) console.log(`REFUSED ${problem}`);
console.log(`${records.size} record(s), ${refs.length} ref(s): ${problems.length ? `${problems.length} refused` : 'every id matches its place and every ref resolves'}`);
process.exitCode = problems.length ? 1 : 0;
