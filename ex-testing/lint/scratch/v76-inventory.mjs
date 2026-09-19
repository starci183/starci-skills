import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';
import {loadRecords, readWorkspace, resolveOwnedDirs, hashOwnedDirs} from '../../../scripts/example-ownership.mjs';

const workRoot = path.resolve(process.argv[2] ?? 'examples/todo-app-backend/.starciwork');
const records = loadRecords(workRoot, walk);
const ws = readWorkspace(workRoot);

const out = [];
for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
  const rel = path.relative(workRoot, file).replaceAll('\\', '/');
  if (!rel.endsWith('/evidence.yaml')) continue;
  const nodeDir = path.dirname(rel);
  const segments = nodeDir.split('/');
  if (segments[0] !== 'features') continue;
  const family = segments[2];
  if (family === 'ui' || family === 'uat') continue;
  const ev = parseYaml(fs.readFileSync(file, 'utf8'));
  const recFile = path.join(path.dirname(file), 'index.yaml');
  const rec = fs.existsSync(recFile) ? parseYaml(fs.readFileSync(recFile, 'utf8')) : null;
  const recordDigest = crypto.createHash('sha256').update(fs.readFileSync(recFile)).digest('hex');
  const entry = records.get(ev.record);
  const dirs = entry ? resolveOwnedDirs(ev.record, entry, records, ws, workRoot) : [];
  const fresh = entry ? hashOwnedDirs(dirs) : null;
  out.push({
    node: nodeDir,
    id: ev.record,
    schema: rec?.schema,
    state: rec?.state,
    repository: rec?.repository ?? null,
    staleFlag: ev.stale === true,
    outcome: ev.outcome,
    recordDigestMismatch: recordDigest !== ev.recordDigest,
    currentRecordDigest: recordDigest,
    codeDigestMismatch: (fresh?.digest ?? null) !== (ev.codeDigest?.digest ?? null),
    freshCodeDigest: fresh?.digest ?? null,
    capturedCodeDigest: ev.codeDigest?.digest ?? null,
    ownedDirs: dirs.map(d => d.rel + (fs.existsSync(d.abs) ? '' : ' [MISSING]')),
    assertions: (Array.isArray(ev.assertions) ? ev.assertions : []).map(a => ({id: a.id, command: a.command, exit: a.exit, outcome: a.outcome})),
    hasRun: ev.run ?? null,
    provenance: ev.provenance ?? null,
  });
}
out.sort((a, b) => a.node.localeCompare(b.node));
console.log(JSON.stringify({workRoot: rel2(workRoot), total: out.length, records: records.size, ws: ws?.repositories ?? null, files: out}, null, 2));
function rel2(p) { return path.relative(path.resolve('.'), p).replaceAll('\\', '/'); }
