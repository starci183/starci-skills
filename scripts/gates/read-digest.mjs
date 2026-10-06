// read-digest.mjs - the READ step of the op loop (knowledge/op-gate.yaml) and its digest (schema starci/read-digest@1).
//
//   starci gate read --root <app> --touch <file>... [--read <file>...] [--knowledge <file>...] [--out <file>]   (entry: scripts/cli/gate-read.mjs)
//
// For the files a slice will touch it prints, and records with their sha256, exactly what the slice must read before coding:
//   - the slot map: `starci app explain <path> --json` of each touched file (its slot, tier, allowed imports, rules);
//   - the pattern files (knowledge/patterns/...) of each file kind: the family's `always` files (op-gate.yaml `kinds`) plus
//     the topics of the longest dotted slot prefix the derived slot->topic map knows (slotTopicMap, from each topic's own
//     `slots` field in index.yaml reading order);
//   - every source of the stable example IDs cited by those topics, resolved through the actual app catalog.
// `--read` adds any other file the slice read (app-relative); `--knowledge` adds contained knowledge files or declared common law (a
// deciding or authoring op's READ: the patterns, catalogs and declared common law its decision cites), role `knowledge`. A deciding op that
// writes no file yet may give --knowledge alone. The op attaches the digest to its report; `starci kernel settle` re-reads it
// (scripts/kernel/gate-settle.mjs). Every applicable pattern/common input and matching example must carry its current hash. The entry adds, inside an op, every required
// ref of that op's filed READ (`filed`, filedRequiredReads in scripts/lib/filed-reads.mjs): --touch adds slot files, never removes one.
// A digest records supplied inputs, not comprehension.
// A touched path hfs cannot explain is recorded with slot null, not an error.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { posixPath, sameResolvedPath, samePath, insidePath } from '../lib/path-key.mjs';
import { exampleSourcePaths } from '../lib/example-refs.mjs';
import { hfsEntry } from '../lib/package-at.mjs';

export const DIGEST_SCHEMA = 'starci/read-digest@1';
const OP_GATE_SCHEMA = 'starci/op-gate@1';
const OP_GATE_FILE = 'knowledge/op-gate.yaml';
const PATTERN_ROOT = 'knowledge/patterns';
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/)[0];
const KNOWLEDGE_ROOT = 'knowledge';

let cache = null;
/** The op-gate document, read once per process; `file` bypasses the cache (a spec's own document). */
export function loadOpGate({ base = runtimeRoot, file = null } = {}) {
  if (!file && cache?.base === base) return cache.doc;
  const doc = parseYaml(fs.readFileSync(file ?? path.join(base, OP_GATE_FILE), 'utf8'));
  if (doc?.schema !== OP_GATE_SCHEMA) throw new Error(`${file ?? OP_GATE_FILE}: schema must be ${OP_GATE_SCHEMA}`);
  for (const key of ['enforcedOps', 'gate', 'digest', 'examples', 'kinds']) if (doc[key] == null) throw new Error(`${file ?? OP_GATE_FILE}: ${key} is required`);
  if (!file) cache = { base, doc };
  return doc;
}

/** The ops held to the loop at settle. */
export const loopOps = (doc = loadOpGate()) => new Set(doc.enforcedOps);

let topicMapCache = null;
/**
 * The slot -> pattern-topic map, derived from the topics' own `slots` fields (knowledge/patterns/<family>/<topic>.yaml) -
 * the one derivation; no list in op-gate.yaml repeats it. A slot's topics come in the reading order of its family's
 * index.yaml `topics` registry; a topic file no index names sorts after the registered ones by path. Returns
 * Map<slotId, [family/topic.yaml, ...]>.
 */
export function slotTopicMap({ base = runtimeRoot } = {}) {
  if (topicMapCache?.base === base) return topicMapCache.map;
  const root = path.join(base, PATTERN_ROOT);
  const declared = [];
  const families = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : [];
  families.forEach((entry, familyRank) => {
    if (!entry.isDirectory()) return;
    const files = fs.readdirSync(path.join(root, entry.name)).filter((f) => f.endsWith('.yaml'));
    const order = files.includes('index.yaml')
      ? (parseYaml(fs.readFileSync(path.join(root, entry.name, 'index.yaml'), 'utf8')).topics ?? []).map((t) => t.path).filter(Boolean)
      : [];
    const rank = new Map(order.map((file, i) => [file, i]));
    for (const file of files) {
      if (file === 'index.yaml') continue;
      const doc = parseYaml(fs.readFileSync(path.join(root, entry.name, file), 'utf8'));
      for (const slot of doc?.slots ?? []) declared.push({ slot, rel: `${entry.name}/${file}`, familyRank, rank: rank.get(file) ?? rank.size });
    }
  });
  const map = new Map();
  declared.sort((a, b) => a.familyRank - b.familyRank || a.rank - b.rank || a.rel.localeCompare(b.rel));
  for (const d of declared) {
    if (!map.has(d.slot)) map.set(d.slot, []);
    map.get(d.slot).push(d.rel);
  }
  topicMapCache = { base, map };
  return map;
}

/**
 * The pattern files (runtime-relative, knowledge/patterns/...) a slot owes: its family's `always` files plus those of the
 * longest dotted prefix of the slot the derived map knows (slotTopicMap). A null slot (hfs could not explain the path)
 * owes no named file; its judgment asks for any pattern file instead.
 */
export function patternsForSlot(slot, doc = loadOpGate(), map = slotTopicMap()) {
  if (!slot) return [];
  const family = doc.kinds[String(slot).split('.')[0]];
  if (!family) return [];
  const parts = String(slot).split('.');
  let own = [];
  for (let n = parts.length; n > 0; n -= 1) {
    const prefix = parts.slice(0, n).join('.');
    if (map.has(prefix)) { own = map.get(prefix); break; }
  }
  return [...new Set([...(family.always ?? []), ...own])].map((rel) => `${PATTERN_ROOT}/${rel}`);
}

/** The checks of one digest entry: an invalid detail string, or null when it records fine into named/canonical. */
const fileVerdict = (file, { root, digest, base, named, canonical }) => {
  if (typeof file?.path !== 'string' || !/^[0-9a-f]{64}$/.test(String(file.sha256 ?? '')))
    return 'the READ digest contains an input without a path and exact sha256';
  const rel = posixPath(file.path), from = file.role === 'read' ? root ?? digest.root : base;
  if (!from || !['read', 'pattern', 'example', 'knowledge'].includes(file.role))
    return `the READ input ${rel} has no supported root or role`;
  const absolute = path.resolve(from, file.path);
  const within = path.relative(path.resolve(from), absolute);
  if (file.role !== 'read' && (within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within)))
    return `the canonical READ input ${rel} is outside the runtime`;
  try {
    if (!fs.statSync(absolute).isFile() || sha256File(absolute) !== file.sha256)
      return `the READ input ${rel} changed since it was recorded`;
  } catch { return `the READ input ${rel} is no longer readable`; }
  if (named.has(rel)) return `the READ input ${rel} is recorded more than once`;
  named.set(rel, file.sha256);
  if (file.role !== 'read') canonical.add(rel);
  return null;
};

/** The kinds of the slice uncovered by the digest; each owed pattern also becomes required. */
const sliceUncovered = (kinds, touched, named, required, base, doc) => {
  const uncovered = [];
  for (const kind of kinds) {
    const owed = patternsForSlot(kind.slot ?? 'app', doc, slotTopicMap({ base }));
    for (const rel of owed) required.set(rel, sha256File(path.join(base, rel)));
    const covered = owed.every((rel) => named.has(rel));
    if (!touched.has(kind.path) || !covered) uncovered.push({ path: kind.path, slot: kind.slot ?? null, owed });
  }
  return uncovered;
};

/**
 * Whether READ covers the current slice and canonical inputs. `kinds` comes from the target's slot owner, not the digest.
 * Every applicable pattern and the common files declared by op-gate are required; `expected` also binds matching examples selected by the
 * READ producer. Extra reads remain allowed, but every recorded input must still exist with its recorded hash.
 */
export function judgeReadDigest(digest, kinds, doc = loadOpGate(), { root = null, base = runtimeRoot, expected = null } = {}) {
  if (digest?.schema !== DIGEST_SCHEMA || !Array.isArray(digest?.files))
    return { status: 'missing', detail: `no READ digest (schema ${DIGEST_SCHEMA}) is attached to the report`, uncovered: [] };
  const invalid = (detail, uncovered = []) => ({ status: 'no-pattern', detail, uncovered });
  if (root && (typeof digest.root !== 'string' || !sameResolvedPath(digest.root, root)))
    return invalid('the READ digest belongs to another target root');
  const named = new Map();
  const canonical = new Set();
  for (const file of digest.files) {
    const detail = fileVerdict(file, { root, digest, base, named, canonical });
    if (detail) return invalid(detail);
  }
  if (!Array.isArray(doc.digest.required) || !doc.digest.required.length)
    return invalid('knowledge/op-gate.yaml declares no required common READ inputs');
  const required = new Map([
    ...doc.digest.required.map((rel) => [rel, sha256File(path.join(base, rel))]),
    ...(expected?.files ?? []).map((file) => [file.path, file.sha256]),
  ]);
  const touched = new Set((digest.touched ?? []).map(posixPath));
  const uncovered = sliceUncovered(kinds, touched, named, required, base, doc);
  const missing = [...required].filter(([rel, hash]) => named.get(rel) !== hash || !canonical.has(rel)).map(([rel]) => rel);
  if (missing.length) uncovered.push({ path: null, slot: null, owed: missing });
  return uncovered.length ? invalid(`the READ digest does not cover the current slice and all required inputs: ${missing.join(', ') || uncovered.map((u) => u.path).join(', ')}`, uncovered)
    : { status: 'pass', detail: null, uncovered: [] };
}

/**
 * Whether a deciding or authoring op's digest proves its READ (op-gate.yaml proofs.read-knowledge): {status: 'pass'|'missing'|
 * 'no-knowledge', detail}. It needs at least one knowledge file (a pattern or a --knowledge file) with a well-formed sha256, and
 * every file it touched carries an entry of the slot map (the hfs slot of each written record).
 */
export function judgeKnowledgeDigest(digest, doc = loadOpGate()) {
  if (digest?.schema !== DIGEST_SCHEMA || !Array.isArray(digest?.files))
    return { status: 'missing', detail: `no READ digest (schema ${DIGEST_SCHEMA}) is attached to the report` };
  const read = digest.files.filter((f) => typeof f?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(f.sha256) && (posixPath(String(f.path ?? '')).startsWith(`${KNOWLEDGE_ROOT}/`) || (doc.digest.required ?? []).includes(posixPath(String(f.path ?? '')))));
  if (!read.length) return { status: 'no-knowledge', detail: 'the READ digest names no declared canonical knowledge with its sha256: the decision cites no standard' };
  const mapped = new Set((Array.isArray(digest.slotMap) ? digest.slotMap : []).map((m) => posixPath(String(m?.path ?? ''))));
  const unmapped = (Array.isArray(digest.touched) ? digest.touched : []).map((t) => posixPath(String(t))).filter((t) => !mapped.has(t));
  if (unmapped.length) return { status: 'no-knowledge', detail: `the READ digest has no hfs slot entry for ${unmapped.slice(0, 5).join(', ')}` };
  return { status: 'pass', detail: null };
}

/**
 * `starci app explain` of each path through the app's own hfs: in-process through its hfs-check library when it loads, else one
 * `starci app explain <path> --json` per path. A path hfs cannot explain answers {path, status: 'unexplained'} (slot null).
 */
async function explainPaths(root, files, hfs = hfsEntry(root)) {
  let explainPath = null;
  try { ({ explainPath } = await import(pathToFileURL(path.join(hfs.dir, 'runtime', 'scripts', 'hfs', 'check.mjs')).href)); } catch { explainPath = null; }
  return files.map((file) => {
    if (explainPath) {
      try { return explainPath({ repoRoot: root, input: file }); } catch (error) { return { path: file, status: 'unexplained', reason: firstLine(error?.message ?? error) }; }
    }
    const run = runNode([hfs.bin, 'app', 'explain', file, '--json'], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    try { return JSON.parse(run.stdout); } catch { return { path: file, status: 'unexplained', reason: firstLine(run.stderr || run.stdout) }; }
  });
}

/** The kinds of the touched files as the runtime resolves them: [{path, slot}]. */
export async function kindsOf(root, files, hfs = hfsEntry(root)) {
  const explained = await explainPaths(root, files, hfs);
  return files.map((file, i) => ({ path: file, slot: explained[i]?.slot ?? null }));
}

/** All actual source files indexed by the selected topics' stable example IDs. */
function examplesForSlot(explained, doc = loadOpGate(), base = runtimeRoot) {
  const ids = new Set(), direct = new Set();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.relatedExamples)) for (const ref of value.relatedExamples) {
      if (typeof ref !== 'string') throw new Error('a topic example reference must be a stable ID or concrete Source path');
      (ref.includes('/') ? direct : ids).add(ref);
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') collect(child);
  };
  for (const topic of patternsForSlot(explained?.slot ?? 'app', doc, slotTopicMap({ base })))
    collect(parseYaml(fs.readFileSync(path.join(base, topic), 'utf8')));
  return [...(ids.size ? exampleSourcePaths(base, ids, { file: doc.examples.catalog }) : []), ...direct];
}

/** One digest entry: the contained regular file at `rel`, or a throw when it is not. */
const digestFile = (files, rel, role, from) => {
  if (files.has(rel)) return;
  const file = path.resolve(from, rel);
  if (!fs.lstatSync(file).isFile() || (role !== 'read' && (path.isAbsolute(rel) || rel.includes(':')
    || rel.split('/').some((part) => !part || part === '.' || part === '..') || !insidePath(from, file)
    || !samePath(fs.realpathSync.native(file), file) || !insidePath(fs.realpathSync.native(from), fs.realpathSync.native(file)))))
    throw new Error(`READ input ${rel} is not a contained regular file`);
  if (role !== 'read') {
    let at = path.parse(file).root;
    for (const segment of file.slice(at.length).split(path.sep).filter(Boolean)) {
      at = path.join(at, segment);
      if (fs.lstatSync(at).isSymbolicLink() || !samePath(fs.realpathSync.native(at), at)) throw new Error(`linked READ input: ${rel}`);
    }
  }
  files.set(rel, { path: rel, role, sha256: sha256File(file) });
};

/** The digest role of a filed required ref by its path shape. */
const filedRole = (rel) => {
  if (rel.startsWith(`${PATTERN_ROOT}/`)) return 'pattern';
  if (/^(?:knowledge|docs)\//.test(rel)) return 'knowledge';
  return 'example';
};

/** A --knowledge entry: declared canonical knowledge, contained and normal, or a throw. */
const addKnowledge = (files, rel, doc, base) => {
  const clean = posixPath(path.isAbsolute(rel) ? path.relative(base, rel) : rel);
  if ((!clean.startsWith(`${KNOWLEDGE_ROOT}/`) && !(doc.digest.required ?? []).includes(clean))
    || clean.split('/').some((part) => !part || part === '.' || part === '..') || !insidePath(base, path.resolve(base, clean))) throw new Error(`--knowledge ${rel} is not declared canonical knowledge`);
  digestFile(files, clean, clean.startsWith(`${PATTERN_ROOT}/`) ? 'pattern' : 'knowledge', base);
};

/** The digest of a slice: what it must read, each file with its sha256. */
export async function buildReadDigest({ root, touch, read = [], knowledge = [], filed = null, doc = loadOpGate(), hfs = hfsEntry(root), base = runtimeRoot }) {
  const touched = [...new Set((touch ?? []).map((f) => posixPath(path.isAbsolute(f) ? path.relative(root, f) : f)))].sort(byCodeUnit);
  const explained = await explainPaths(root, touched, hfs);
  const slotMap = touched.map((file, i) => {
    const e = explained[i] ?? {};
    return { path: file, slot: e.slot ?? null, status: e.status, pattern: e.pattern ?? null, tier: e.tier ?? null, allowedImports: e.allowedImports ?? null, rules: e.rules ?? [] };
  });
  const files = new Map();
  const add = (rel, role, from) => digestFile(files, rel, role, from);
  for (const rel of doc.digest.required ?? []) add(rel, 'knowledge', base);
  add(doc.examples.catalog, 'example', base);
  // A deciding READ with no coded slice owes the explicitly declared catalog,
  // including its compiler and test inputs; a coded slice selects its topics below.
  if (!touched.length) for (const example of exampleSourcePaths(base, null, { file: doc.examples.catalog })) add(example, 'example', base);
  for (const kind of slotMap) {
    for (const pattern of patternsForSlot(kind.slot ?? 'app', doc, slotTopicMap({ base }))) add(pattern, 'pattern', base);
    for (const example of examplesForSlot(kind, doc, base)) add(example, 'example', base);
  }
  for (const extra of read) add(posixPath(extra), 'read', path.isAbsolute(extra) ? '' : root);
  // The op's filed READ owns its required refs: --touch adds slot files, it never removes one of these.
  for (const rel of [...filed ?? []].sort(byCodeUnit)) add(rel, filedRole(rel), base);
  for (const rel of knowledge) addKnowledge(files, rel, doc, base);
  return { schema: DIGEST_SCHEMA, at: new Date().toISOString(), root: posixPath(path.resolve(root)), touched, slotMap, files: [...files.values()] };
}
