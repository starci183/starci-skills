// contract-changes-store.mjs — where the contract-change registry lives on disk (lane land-throughput, 2026-09-28).
//
// One file per entry: modules/kernel/contract-changes/<id>.yaml holds ONE change as a plain map (the same keys a
// `changes:` item of the old registry had). Every lane used to append to the tail of the single
// modules/kernel/contract-changes.yaml, so each land invalidated every queued lane (24 commits in 10 h touched it).
// A new file per entry never conflicts.
//
// Transition: the old file stays readable. Its `changes:` list is read too, and an entry there wins over a
// directory file of the same id (a lane branched before the migration appends or edits there; its union merge
// keeps the text). `node scripts/kernel/contract-changes-store.mjs --migrate` moves whatever sits in the old list
// into the directory. Readers go through readContractChangesDoc / readContractChangesDocAt only.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

export const CONTRACT_CHANGES_SCHEMA = 'starci/contract-changes@1';
/** The old single-file registry: read during the transition, never written by new work. */
export const CONTRACT_CHANGES_FILE = 'modules/kernel/contract-changes.yaml';
/** One file per entry: <dir>/<id>.yaml. */
export const CONTRACT_CHANGES_DIR = 'modules/kernel/contract-changes';

const norm = (p) => String(p ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
/** A registry path: the old file or an entry file. */
export const isContractChangesPath = (rel) => { const f = norm(rel); return f === CONTRACT_CHANGES_FILE || (f.startsWith(`${CONTRACT_CHANGES_DIR}/`) && /\.ya?ml$/.test(f)); };
/** The entry file of change `id` (runtime-relative). */
export const entryFileOf = (id) => `${CONTRACT_CHANGES_DIR}/${id}.yaml`;

const plainMap = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Merge the old list and the entry files into one {schema, changes[]} document plus problems[]. `legacy` is the
 * old file's text (null when absent), `entries` [{rel, text}] the entry files. An old-list entry wins over an
 * entry file of the same id; an entry file whose id is not its file name is a problem.
 */
export function mergeContractChanges({ legacy = null, entries = [] }) {
  const problems = [];
  let legacyDoc = null;
  if (legacy != null) {
    try { legacyDoc = parseYaml(legacy); } catch (error) { problems.push(`${CONTRACT_CHANGES_FILE} unreadable: ${String(error?.message ?? error).slice(0, 200)}`); }
  }
  if (legacyDoc != null && legacyDoc?.schema !== CONTRACT_CHANGES_SCHEMA) problems.push(`schema must be ${CONTRACT_CHANGES_SCHEMA}`);
  const old = Array.isArray(legacyDoc?.changes) ? legacyDoc.changes : [];
  const oldIds = new Set(old.map((c) => (plainMap(c) && typeof c.id === 'string' ? c.id.trim() : null)).filter(Boolean));
  const fromDir = [];
  for (const { rel, text } of [...entries].sort((a, b) => a.rel.localeCompare(b.rel))) {
    let doc;
    try { doc = parseYaml(text); } catch (error) { problems.push(`${rel} unreadable: ${String(error?.message ?? error).slice(0, 200)}`); continue; }
    const stem = path.posix.basename(rel).replace(/\.ya?ml$/, '');
    if (!plainMap(doc)) { problems.push(`${rel} is not a map`); continue; }
    if (typeof doc.id !== 'string' || doc.id.trim() !== stem) { problems.push(`${rel}: id must be its file name (${stem})`); continue; }
    if (oldIds.has(stem)) continue;   // the old list's entry is the newer word during the transition
    fromDir.push(doc);
  }
  return { doc: { schema: CONTRACT_CHANGES_SCHEMA, changes: [...fromDir, ...old] }, problems };
}

/** The registry of the tree at `root`: {doc: {schema, changes[]}, problems[]} (absent registry: no changes). */
export function readContractChangesDoc(root, { legacyFile = path.join(root, CONTRACT_CHANGES_FILE), dir = path.join(root, CONTRACT_CHANGES_DIR) } = {}) {
  let legacy = null;
  try { legacy = fs.readFileSync(legacyFile, 'utf8'); } catch { /* absent */ }
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)); } catch { /* absent */ }
  const entries = names.map((n) => { try { return { rel: `${CONTRACT_CHANGES_DIR}/${n}`, text: fs.readFileSync(path.join(dir, n), 'utf8') }; } catch { return null; } }).filter(Boolean);
  return mergeContractChanges({ legacy, entries });
}

const gitRun = (cwd, args, input = undefined) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, input, maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? String(r.stdout ?? '') : null;
};

/** The registry at git revision `rev` of the repository at `cwd` (one ls-tree and one cat-file --batch). Null when git cannot read the revision. */
export function readContractChangesDocAt(cwd, rev) {
  if (gitRun(cwd, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]) == null) return null;
  const listed = gitRun(cwd, ['ls-tree', '-r', '--name-only', rev, '--', `${CONTRACT_CHANGES_DIR}/`]) ?? '';
  const rels = listed.split(/\r?\n/).map(norm).filter((f) => isContractChangesPath(f) && f !== CONTRACT_CHANGES_FILE);
  const want = [CONTRACT_CHANGES_FILE, ...rels];
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
  return mergeContractChanges({ legacy: texts[0] ?? null, entries: rels.map((rel, i) => ({ rel, text: texts[i + 1] })).filter((e) => e.text != null) });
}

/* ------------------------------------------------------------ migration */

/**
 * Split the old file's `changes:` list into one text block per entry, as the entry file would hold it (the
 * `  - ` item marker and the 4-space item indent removed). Returns {header, blocks[{id, text}], rest} where
 * `header` is everything up to and including the `changes:` line.
 */
export function splitLegacy(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const at = lines.findIndex((l) => /^changes:\s*(#.*)?$/.test(l));
  if (at < 0) return { header: text, blocks: [], rest: '' };
  const header = lines.slice(0, at + 1).join('\n');
  const blocks = [];
  let cur = null;
  for (const line of lines.slice(at + 1)) {
    if (/^ {2}- /.test(line)) { cur = { lines: [line.replace(/^ {2}- /, '')] }; blocks.push(cur); continue; }
    if (!cur) continue;
    cur.lines.push(line.startsWith('    ') ? line.slice(4) : line.replace(/^ {1,3}(?=#)/, ''));
  }
  return { header, blocks: blocks.map((b) => { const t = `${b.lines.join('\n').replace(/\s+$/, '')}\n`; return { id: parseYaml(t)?.id, text: t }; }) };
}

/**
 * Move every entry of the old list into its own file under the directory of `root`; the old file keeps its
 * header and an empty `changes:`. A block whose own text does not parse back to the same entry is refused.
 * Returns {moved[], kept[]} (kept: ids already in the directory with a different body, left in the old list).
 */
export function migrateLegacy(root, { write = true } = {}) {
  const file = path.join(root, CONTRACT_CHANGES_FILE);
  const text = fs.readFileSync(file, 'utf8');
  const parsed = parseYaml(text)?.changes ?? [];
  const { header, blocks } = splitLegacy(text);
  if (blocks.length !== parsed.length) throw Error(`split ${blocks.length} blocks but the list has ${parsed.length} entries`);
  const dir = path.join(root, CONTRACT_CHANGES_DIR);
  const moved = [], kept = [];
  blocks.forEach((b, i) => {
    if (JSON.stringify(parseYaml(b.text)) !== JSON.stringify(parsed[i])) throw Error(`entry ${i} (${b.id}) does not round-trip as its own file`);
    if (typeof b.id !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,79}$/.test(b.id)) throw Error(`entry ${i} has no slug id`);
    const target = path.join(dir, `${b.id}.yaml`);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== b.text) { kept.push(b); return; }
    moved.push(b);
  });
  if (write) {
    fs.mkdirSync(dir, { recursive: true });
    for (const b of moved) fs.writeFileSync(path.join(dir, `${b.id}.yaml`), b.text);
    const rest = kept.map((b) => b.text.replace(/\n$/, '').split('\n').map((l, j) => (j === 0 ? `  - ${l}` : l ? `    ${l}` : l)).join('\n'));
    fs.writeFileSync(file, `${header}\n${rest.length ? `${rest.join('\n')}\n` : ''}`);
  }
  return { moved: moved.map((b) => b.id), kept: kept.map((b) => b.id) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  if (process.argv.includes('--migrate')) {
    const r = migrateLegacy(root, { write: !process.argv.includes('--dry-run') });
    console.log(JSON.stringify(r));
  } else {
    const { doc, problems } = readContractChangesDoc(root);
    console.log(JSON.stringify({ changes: doc.changes.length, problems }));
    if (problems.length) process.exitCode = 1;
  }
}
