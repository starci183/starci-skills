// contract-changes-store.mjs — where the contract-change registry lives on disk.
//
// One file per entry: modules/kernel/contract-changes/<id>.yaml holds ONE change as a plain map (keys documented in
// modules/kernel/contract-changes-format.yaml). A new file per entry never conflicts between lanes. There is no
// single-file list. Readers go through readContractChangesDoc / readContractChangesDocAt only.
import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../lib/git.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

export const CONTRACT_CHANGES_SCHEMA = 'starci/contract-changes@1';
/** One file per entry: <dir>/<id>.yaml. */
export const CONTRACT_CHANGES_DIR = 'modules/kernel/contract-changes';

const norm = (p) => String(p ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
/** A registry path: an entry file under the directory. */
export const isContractChangesPath = (rel) => { const f = norm(rel); return f.startsWith(`${CONTRACT_CHANGES_DIR}/`) && /\.ya?ml$/.test(f); };
/** The entry file of change `id` (runtime-relative). */
export const entryFileOf = (id) => `${CONTRACT_CHANGES_DIR}/${id}.yaml`;

const plainMap = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Merge the entry files [{rel, text}] into one {schema, changes[]} document plus problems[]. An entry file whose
 * id is not its file name is a problem.
 */
export function mergeContractChanges({ entries = [] }) {
  const problems = [];
  const changes = [];
  for (const { rel, text } of [...entries].sort((a, b) => a.rel.localeCompare(b.rel))) {
    let doc;
    try { doc = parseYaml(text); } catch (error) { problems.push(`${rel} unreadable: ${String(error?.message ?? error).slice(0, 200)}`); continue; }
    const stem = path.posix.basename(rel).replace(/\.ya?ml$/, '');
    if (!plainMap(doc)) { problems.push(`${rel} is not a map`); continue; }
    if (typeof doc.id !== 'string' || doc.id.trim() !== stem) { problems.push(`${rel}: id must be its file name (${stem})`); continue; }
    changes.push(doc);
  }
  return { doc: { schema: CONTRACT_CHANGES_SCHEMA, changes }, problems };
}

/** The registry of the tree at `root`: {doc: {schema, changes[]}, problems[]} (absent registry: no changes). */
export function readContractChangesDoc(root, { dir = path.join(root, CONTRACT_CHANGES_DIR) } = {}) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)); } catch { /* absent */ }
  const entries = names.map((n) => { try { return { rel: `${CONTRACT_CHANGES_DIR}/${n}`, text: fs.readFileSync(path.join(dir, n), 'utf8') }; } catch { return null; } }).filter(Boolean);
  return mergeContractChanges({ entries });
}

const gitRun = (cwd, args, input = undefined) => {
  const r = runGit(args, { cwd, input, maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? String(r.stdout ?? '') : null;
};

/** The registry at git revision `rev` of the repository at `cwd` (one ls-tree and one cat-file --batch). Null when git cannot read the revision. */
export function readContractChangesDocAt(cwd, rev) {
  if (gitRun(cwd, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]) == null) return null;
  const listed = gitRun(cwd, ['ls-tree', '-r', '--name-only', rev, '--', `${CONTRACT_CHANGES_DIR}/`]) ?? '';
  const rels = listed.split(/\r?\n/).map(norm).filter(isContractChangesPath);
  const want = rels;
  if (!want.length) return mergeContractChanges({ entries: [] });
  const out = gitRun(cwd, ['cat-file', '--batch'], want.map((f) => `${rev}:${f}`).join('\n') + '\n');
  if (out == null) return null;
  const buf = Buffer.from(out, 'utf8');
  const texts = [];
  let at = 0;
  for (let i = 0; i < want.length; i += 1) {
    const nl = buf.indexOf(10, at);
    if (nl < 0) break;
    const header = buf.subarray(at, nl).toString('utf8');
    at = nl + 1;
    if (/ missing$/.test(header)) { texts.push(null); continue; }
    const size = Number(header.split(' ')[2]);
    texts.push(buf.subarray(at, at + size).toString('utf8'));
    at += size + 1;
  }
  return mergeContractChanges({ entries: rels.map((rel, i) => ({ rel, text: texts[i] })).filter((e) => e.text != null) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { doc, problems } = readContractChangesDoc(root);
  console.log(JSON.stringify({ changes: doc.changes.length, problems }));
  if (problems.length) process.exitCode = 1;
}
