// v8-3 scratch: for one record, print the withdrawal clauses of the newest revision and every older
// revision's string leaves that are close to them, so a "not verbatim" refusal can be read by eye.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';

const repoDir = 'D:/Repositories/starci-academy-backend/.claude';
const specPath = process.argv[2];
const git = (args, input) => {
  const run = spawnSync('git', args, {cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 28, input});
  return run.status === 0 ? run.stdout : null;
};

const text = git(['log', '--follow', '--format=\x1f%H', '--name-status', '-z', '-n', '60', '--', specPath]);
const byPath = new Map();
let commit = null;
const fields = (text ?? '').split('\0');
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
  (byPath.get(listed) ?? byPath.set(listed, []).get(listed)).push({commit, status, blobPath: listed,
    from: paths.length > 1 ? paths[0] : null, crossing: status === 'R' || status === 'C'});
}
const entries = [];
let current = specPath;
const walked = new Set();
while (current && !walked.has(current)) {
  walked.add(current);
  const list = byPath.get(current) ?? [];
  if (!list.length) break;
  entries.push(...list);
  current = list.at(-1).crossing ? list.at(-1).from : null;
}

const specs = [...new Set(['HEAD:' + specPath, ...entries.map(e => `${e.commit}:${e.blobPath}`)])];
const blobs = new Map();
const run = spawnSync('git', ['cat-file', '--batch'], {cwd: repoDir,
  input: Buffer.from(specs.map(s => s + '\n').join(''), 'utf8'), maxBuffer: 1 << 28});
const buf = run.stdout ?? Buffer.alloc(0);
let cursor = 0;
for (const spec of specs) {
  const end = buf.indexOf(0x0a, cursor);
  if (end < 0) break;
  const header = buf.subarray(cursor, end).toString('utf8');
  cursor = end + 1;
  const parts = header.split(' ');
  if (parts.length === 3 && parts[1] === 'blob') {
    const size = Number(parts[2]);
    blobs.set(spec, buf.subarray(cursor, cursor + size).toString('utf8'));
    cursor += size + 1;
  } else blobs.set(spec, null);
}

const leaves = (node, trail, out) => {
  if (typeof node === 'string') out.push([trail, node]);
  else if (Array.isArray(node)) node.forEach((item, i) => leaves(item, `${trail}[${i}]`, out));
  else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => leaves(v, trail ? `${trail}.${k}` : k, out));
  return out;
};
const normalise = value => value.replace(/\s+/g, ' ').trim();

const seen = new Set();
const revisions = [];
const worktree = fs.readFileSync(path.join(repoDir.replaceAll('/', path.sep), ...specPath.split('/')), 'utf8');
for (const [label, source] of [['WORKTREE', worktree], ['HEAD', blobs.get('HEAD:' + specPath)],
  ...entries.map((e, i) => [`${e.commit.slice(0, 8)} ${e.status}`, blobs.get(`${e.commit}:${e.blobPath}`)])]) {
  if (!source) continue;
  let data;
  try { data = parseYaml(source); } catch { continue; }
  const key = JSON.stringify(data);
  if (seen.has(key)) continue;
  seen.add(key);
  revisions.push([label, data]);
}
console.log(`revisions: ${revisions.length}`);
const clauses = (revisions[0][1]?.change?.withdraws ?? []);
for (const clause of clauses) {
  console.log(`\nWITHDRAWN CLAUSE: ${JSON.stringify(clause)}`);
  const exact = [];
  const folded = [];
  for (const [label, data] of revisions.slice(1)) {
    for (const [trail, value] of leaves(data, '', [])) {
      if (trail.startsWith('change.')) continue;
      if (value.trim() === clause.trim()) exact.push(`${label} ${trail}`);
      else if (normalise(value) === normalise(clause)) folded.push(`${label} ${trail}`);
      else if (normalise(value).includes(normalise(clause)) || normalise(clause).includes(normalise(value))) {
        folded.push(`${label} ${trail} (containment) ${JSON.stringify(value.slice(0, 160))}`);
      }
    }
  }
  console.log(`  exact verbatim elsewhere: ${exact.join(' | ') || '(none)'}`);
  console.log(`  whitespace-folded/contained: ${folded.slice(0, 4).join(' | ') || '(none)'}`);
}
