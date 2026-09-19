// v8-3 scratch verifier: for one record path, list every reachable revision (bulk + --follow), and report
// where a quoted clause appears in each - including scalar fields, which check-work-history deliberately
// ignores when sourcing a withdrawal. Used to confirm or refute the check's WITHDRAWS_NOT_VERBATIM refusals.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';

const repoDir = 'D:/Repositories/starci-academy-backend/.claude';
const specPath = process.argv[2];
const clause = process.argv[3] ?? '';
const limit = Number(process.argv[4] ?? 50);

const git = (args, encoding = 'utf8') => {
  const run = spawnSync('git', args, {cwd: repoDir, encoding, maxBuffer: 1 << 28});
  return run.status === 0 ? run.stdout : null;
};

const walk = follow => {
  const text = git(['log', ...(follow ? ['--follow'] : ['--first-parent']), '--format=\x1f%H', '--name-status',
    '-z', '-n', String(limit), '--', follow ? specPath : specPath.replace(/\/index\.yaml$/, '')]);
  if (!text) return [];
  const byPath = new Map();
  let commit = null;
  const fields = text.split('\0');
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f === '') continue;
    if (f.replace(/^\s+/, '').startsWith('\x1f')) { commit = f.slice(f.indexOf('\x1f') + 1).trim(); continue; }
    if (!commit) continue;
    const cleaned = f.replace(/^[\s\x00-\x1f]+/, '').replace(/\r$/, '');
    const joined = /^([ACDMRTUXB]\d*)[\t](.+)$/.exec(cleaned);
    const status = joined ? joined[1][0] : /^[ACDMRTUXB]\d*$/.test(cleaned) ? cleaned[0] : null;
    if (!status) continue;
    const paths = joined ? [joined[2]] : [fields[++i]];
    if (status === 'R' || status === 'C') paths.push(fields[++i]);
    const listed = paths.at(-1)?.replace(/^\s+/, '');
    if (!listed) continue;
    const arr = byPath.get(listed) ?? [];
    arr.push({commit, status, blobPath: listed, from: paths.length > 1 ? paths[0] : null,
      crossing: status === 'R' || status === 'C'});
    byPath.set(listed, arr);
  }
  if (!follow) {
    console.log(`bulk listing entries for ${specPath}:`, JSON.stringify((byPath.get(specPath) ?? []).map(e => e.commit.slice(0, 8))));
    return byPath.get(specPath) ?? [];
  }
  const entries = [];
  const seenPaths = new Set();
  let current = specPath;
  while (current && !seenPaths.has(current)) {
    seenPaths.add(current);
    const list = byPath.get(current) ?? [];
    if (!list.length) break;
    entries.push(...list);
    current = list.at(-1).crossing ? list.at(-1).from : null;
  }
  return entries;
};

const entries = walk(true);
console.log(`--follow lineage entries: ${entries.length}`);
const specs = ['HEAD:' + specPath, ...entries.map(e => `${e.commit}:${e.blobPath}`)];
const input = Buffer.from([...new Set(specs)].map(s => s + '\n').join(''), 'utf8');
const run = spawnSync('git', ['cat-file', '--batch'], {cwd: repoDir, input, maxBuffer: 1 << 28});
const bytes = run.stdout;
const blobs = new Map();
let cursor = 0;
for (const spec of [...new Set(specs)]) {
  const end = bytes.indexOf(0x0a, cursor);
  if (end < 0) break;
  const header = bytes.subarray(cursor, end).toString('utf8');
  cursor = end + 1;
  const parts = header.split(' ');
  if (parts.length === 3 && parts[1] === 'blob') {
    const size = Number(parts[2]);
    blobs.set(spec, bytes.subarray(cursor, cursor + size));
    cursor += size + 1;
  } else blobs.set(spec, null);
}

const seen = new Set();
const lines = [];
const push = (label, blob) => {
  if (!blob) { lines.push(`${label}: (no blob)`); return; }
  let data;
  try { data = parseYaml(blob.toString('utf8')); } catch { lines.push(`${label}: (unparseable)`); return; }
  const key = canonical(data);
  const dup = seen.has(key);
  seen.add(key);
  const where = [];
  const hunt = (node, trail) => {
    if (typeof node === 'string') { if (clause && node.includes(clause)) where.push(trail); return; }
    if (Array.isArray(node)) return node.forEach((item, i) => hunt(item, `${trail}[${i}]`));
    if (node && typeof node === 'object') return Object.entries(node).forEach(([k, v]) => hunt(v, trail ? `${trail}.${k}` : k));
  };
  hunt(data, '');
  lines.push(`${label}: rev=${data?.change?.rev ?? '(none)'} kind=${data?.change?.kind ?? '(none)'} `
    + `withdraws=${(data?.change?.withdraws ?? []).length} statements=${(data?.statements ?? []).length}`
    + ` dup=${dup} clauseAt=${where.join('|') || '(nowhere)'}`);
};
const canonical = value => JSON.stringify(value);
push(`WORKTREE`, fs.readFileSync(path.join(repoDir.replaceAll('/', path.sep), ...specPath.split('/'))));
for (const [i, e] of entries.entries()) push(`${i} ${e.commit.slice(0, 8)} ${e.status}`, blobs.get(`${e.commit}:${e.blobPath}`));
console.log(lines.join('\n'));
