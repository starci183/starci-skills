#!/usr/bin/env node
// read-digest.mjs - the READ step of the op loop (knowledge/op-gate.yaml) and its digest (schema starci/read-digest@1).
//
//   node scripts/gates/read-digest.mjs --root <app> --touch <file>... [--read <file>...] [--knowledge <file>...] [--out <file>]
//
// For the files a slice will touch it prints, and records with their sha256, exactly what the slice must read before coding:
//   - the slot map: `hfs explain <path> --json` of each touched file (its slot, tier, allowed imports, rules);
//   - the pattern files (knowledge/patterns/...) of each file kind, from op-gate.yaml `kinds` (family `always` plus the longest
//     listed slot prefix);
//   - the example files of the same slots in the example app (op-gate.yaml `examples`), matched by the slot's explain pattern.
// `--read` adds any other file the slice read (app-relative); `--knowledge` adds runtime knowledge files (knowledge/..., a
// deciding or authoring op's READ: the patterns, catalogs and rules its decision cites), role `knowledge`. A deciding op that
// writes no file yet may give --knowledge alone. The op attaches the digest to its report; `api settle` re-reads it
// (scripts/kernel/gate-settle.mjs) and refuses a done whose digest is missing or names no pattern file for a touched kind.
// Exit 0 recorded, 2 the digest could not be built (a touched path hfs cannot explain is recorded with slot null, not an error).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs';
import { hfsEntry } from './gate.mjs';

export const DIGEST_SCHEMA = 'starci/read-digest@1';
export const OP_GATE_SCHEMA = 'starci/op-gate@1';
export const OP_GATE_FILE = 'knowledge/op-gate.yaml';
export const PATTERN_ROOT = 'knowledge/patterns';
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXAMPLES_PER_SLOT = 2;
const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/)[0];
const USAGE = 'usage: read-digest.mjs --root <app> --touch <file>... [--read <file>...] [--knowledge <file>...] [--out <file>]';
export const KNOWLEDGE_ROOT = 'knowledge';

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

/**
 * The pattern files (runtime-relative, knowledge/patterns/...) a slot owes: its family's `always` files plus those of the
 * longest dotted prefix listed under `slots`. A null slot (hfs could not explain the path) owes no named file; its judgment
 * asks for any pattern file instead.
 */
export function patternsForSlot(slot, doc = loadOpGate()) {
  if (!slot) return [];
  const family = doc.kinds[String(slot).split('.')[0]];
  if (!family) return [];
  const parts = String(slot).split('.');
  let own = [];
  for (let n = parts.length; n > 0; n -= 1) {
    const prefix = parts.slice(0, n).join('.');
    if (family.slots?.[prefix]) { own = family.slots[prefix]; break; }
  }
  return [...new Set([...(family.always ?? []), ...own])].map((rel) => `${PATTERN_ROOT}/${rel}`);
}

/**
 * Whether a digest covers the touched kinds: {status: 'pass'|'missing'|'no-pattern', detail, uncovered[]}. `kinds` is
 * [{path, slot}] as the runtime resolved them itself; each kind needs at least one of its pattern files in the digest (a kind
 * with no known slot needs any pattern file).
 */
export function judgeReadDigest(digest, kinds, doc = loadOpGate()) {
  if (!digest || digest.schema !== DIGEST_SCHEMA || !Array.isArray(digest.files))
    return { status: 'missing', detail: `no READ digest (schema ${DIGEST_SCHEMA}) is attached to the report`, uncovered: [] };
  const named = new Set(digest.files.filter((f) => typeof f?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(f.sha256)).map((f) => posixPath(f.path)));
  const anyPattern = [...named].some((p) => p.startsWith(`${PATTERN_ROOT}/`));
  const uncovered = [];
  for (const kind of kinds) {
    const owed = patternsForSlot(kind.slot, doc);
    const covered = owed.length ? owed.some((p) => named.has(p)) : anyPattern;
    if (!covered) uncovered.push({ path: kind.path, slot: kind.slot ?? null, owed });
  }
  if (!kinds.length && !anyPattern && digest.touched?.length) uncovered.push({ path: null, slot: null, owed: [] });
  return uncovered.length
    ? { status: 'no-pattern', detail: `the READ digest names no pattern file for ${uncovered.map((u) => `${u.path ?? 'the slice'} (${u.slot ?? 'unknown kind'})`).join(', ')}`, uncovered }
    : { status: 'pass', detail: null, uncovered: [] };
}

/**
 * Whether a deciding or authoring op's digest proves its READ (op-gate.yaml proofs.read-knowledge): {status: 'pass'|'missing'|
 * 'no-knowledge', detail}. It needs at least one knowledge file (a pattern or a --knowledge file) with a well-formed sha256, and
 * every file it touched carries an entry of the slot map (the hfs slot of each written record).
 */
export function judgeKnowledgeDigest(digest) {
  if (!digest || digest.schema !== DIGEST_SCHEMA || !Array.isArray(digest.files))
    return { status: 'missing', detail: `no READ digest (schema ${DIGEST_SCHEMA}) is attached to the report` };
  const read = digest.files.filter((f) => typeof f?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(f.sha256) && posixPath(String(f.path ?? '')).startsWith(`${KNOWLEDGE_ROOT}/`));
  if (!read.length) return { status: 'no-knowledge', detail: 'the READ digest names no knowledge file (knowledge/patterns/** or a --knowledge file) with its sha256: the decision cites no standard' };
  const mapped = new Set((Array.isArray(digest.slotMap) ? digest.slotMap : []).map((m) => posixPath(String(m?.path ?? ''))));
  const unmapped = (Array.isArray(digest.touched) ? digest.touched : []).map((t) => posixPath(String(t))).filter((t) => !mapped.has(t));
  if (unmapped.length) return { status: 'no-knowledge', detail: `the READ digest has no hfs slot entry for ${unmapped.slice(0, 5).join(', ')}` };
  return { status: 'pass', detail: null };
}

/**
 * `hfs explain` of each path through the app's own hfs: in-process through its hfs-check library when it loads, else one
 * `hfs explain <path> --json` per path. A path hfs cannot explain answers {path, status: 'unexplained'} (slot null).
 */
export async function explainPaths(root, files, hfs = hfsEntry(root)) {
  let explainPath = null;
  try { ({ explainPath } = await import(pathToFileURL(path.join(hfs.dir, 'runtime', 'scripts', 'lib', 'hfs-check.mjs')).href)); } catch { explainPath = null; }
  return files.map((file) => {
    if (explainPath) {
      try { return explainPath({ repoRoot: root, input: file }); } catch (error) { return { path: file, status: 'unexplained', reason: firstLine(error?.message ?? error) }; }
    }
    const run = spawnSync(process.execPath, [hfs.bin, 'explain', file, '--repo', root, '--json'], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    try { return JSON.parse(run.stdout); } catch { return { path: file, status: 'unexplained', reason: firstLine(run.stderr || run.stdout) }; }
  });
}

/** The kinds of the touched files as the runtime resolves them: [{path, slot}]. */
export async function kindsOf(root, files, hfs = hfsEntry(root)) {
  const explained = await explainPaths(root, files, hfs);
  return files.map((file, i) => ({ path: file, slot: explained[i]?.slot ?? null }));
}

/** The example files of a slot: files of the example side its explain pattern matches (`<name>` spans one segment). */
export function examplesForSlot(explained, doc = loadOpGate(), base = runtimeRoot) {
  const family = String(explained?.slot ?? '').split('.')[0];
  const side = doc.examples?.[family];
  if (!side || !explained?.pattern) return [];
  const sideRoot = path.join(base, side);
  if (!fs.existsSync(sideRoot)) return [];
  const pattern = posixPath(explained.pattern);
  const expression = new RegExp(`^${pattern.split('/').map((seg) => seg.replace(/<[^>]+>/g, '\u0000').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u0000/g, '[^/]+')).join('/')}${pattern.endsWith('/') ? '' : '$'}`);
  return walkFiles(sideRoot, { sorted: true, exclude: (name, full, entry) => entry.isDirectory() && ['node_modules', '.git', 'dist'].includes(name) })
    .map((file) => posixPath(path.relative(sideRoot, file)))
    // An app's explain pattern may carry the side folder (be/src/...) or not (src/...): both spell the same slot.
    .filter((rel) => expression.test(rel) || expression.test(`${path.posix.basename(posixPath(side))}/${rel}`))
    .slice(0, EXAMPLES_PER_SLOT)
    .map((rel) => `${side}/${rel}`);
}

/** The digest of a slice: what it must read, each file with its sha256. */
export async function buildReadDigest({ root, touch, read = [], knowledge = [], doc = loadOpGate(), hfs = hfsEntry(root), base = runtimeRoot }) {
  const touched = [...new Set((touch ?? []).map((f) => posixPath(path.isAbsolute(f) ? path.relative(root, f) : f)))].sort();
  const explained = await explainPaths(root, touched, hfs);
  const slotMap = touched.map((file, i) => {
    const e = explained[i] ?? {};
    return { path: file, slot: e.slot ?? null, status: e.status, pattern: e.pattern ?? null, tier: e.tier ?? null, allowedImports: e.allowedImports ?? null, rules: e.rules ?? [] };
  });
  const files = new Map();
  const add = (rel, role, from) => { if (!files.has(rel) && fs.existsSync(path.join(from, rel))) files.set(rel, { path: rel, role, sha256: sha256File(path.join(from, rel)) }); };
  for (const kind of slotMap) {
    for (const pattern of patternsForSlot(kind.slot, doc)) add(pattern, 'pattern', base);
    for (const example of examplesForSlot(kind, doc, base)) add(example, 'example', base);
  }
  for (const extra of read) add(posixPath(extra), 'read', path.isAbsolute(extra) ? '' : root);
  for (const rel of knowledge) {
    const clean = posixPath(path.isAbsolute(rel) ? path.relative(base, rel) : rel);
    if (!clean.startsWith(`${KNOWLEDGE_ROOT}/`) || !fs.existsSync(path.join(base, clean))) throw new Error(`--knowledge ${rel} is not a file under the runtime's ${KNOWLEDGE_ROOT}/`);
    add(clean, clean.startsWith(`${PATTERN_ROOT}/`) ? 'pattern' : 'knowledge', base);
  }
  return { schema: DIGEST_SCHEMA, at: new Date().toISOString(), root: posixPath(path.resolve(root)), touched, slotMap, files: [...files.values()] };
}

export function parseDigestArgs(argv) {
  const opts = { root: null, touch: [], read: [], knowledge: [], out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--touch' || arg === '--read' || arg === '--knowledge') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[arg.slice(2)].push(argv[++i]); }
    else if (arg === '--root' || arg === '--out') { if (argv[i + 1] === undefined) throw new Error(`${arg} needs a value; ${USAGE}`); opts[arg.slice(2)] = argv[++i]; }
    else throw new Error(`unknown argument ${arg}; ${USAGE}`);
  }
  if (!opts.touch.length && !opts.knowledge.length) throw new Error(`--touch or --knowledge names at least one file; ${USAGE}`);
  return opts;
}

if (isMain(import.meta.url)) {
  try {
    const opts = parseDigestArgs(process.argv.slice(2));
    const digest = await buildReadDigest({ root: path.resolve(opts.root ?? process.cwd()), touch: opts.touch, read: opts.read, knowledge: opts.knowledge });
    const text = `${JSON.stringify(digest, null, 2)}\n`;
    if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
    process.stdout.write(text);
  } catch (error) {
    process.stderr.write(`read-digest: ${error.message}\n`);
    process.exitCode = 2;
  }
}
