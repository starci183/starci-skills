#!/usr/bin/env node
// pack.mjs — context cutting as a function (wave m7).
//
// Context assembly is a deterministic function:
// `buildContext({ opId: <id> })` returns the mandatory read list,
// the brief's declared reads with placeholders flagged, the resolved owned
// write set and the actual files it currently holds on disk — plus a rendered
// packet.md, the exact text the op must be told to read, in load order.
//
// Consumed two ways:
//   - CLI (this file's main): materializes a packet on demand; tests/repo/context-pack.spec.mjs
//     drives it as a process.
//   - Library: scripts/kernel/dispatch-op.mjs imports buildContext/renderPromptReads
//     so the [Op] prompt carries the resolved MANDATORY READS list, not just
//     "read CONTEXT.md".
//
// Internal entry: spawned by scripts/kernel/dispatch-op.mjs; not invoked directly.
// Args: --op <id> [--records a,b] [--state <.starciwork>]
//       [--repo <path>] [--out <file>] [--json]
//
//   --repo    runtime/skill root to resolve against (default: this repo —
//             the directory holding CONTEXT.md, modules/, knowledge/)
//   --out     write the rendered packet markdown to <file> (default: stdout)
//   --json    print the context object only (default: JSON + rendered text)
//
// Exit codes: 0 ok · 1 unknown op / unreadable brief · 2 bad args.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { mergeOpShared, opSharedOf, resolveOpContract } from '../lib/op-shared.mjs';
import { ownedRecordPaths } from '../work/record-ownership.mjs';
import { clipLine } from '../lib/clip.mjs';
import { underWorktrees } from '../lib/worktree-exclude.mjs';
import { isMain } from '../lib/is-main.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { opCli } from '../lib/cli-arg.mjs';
import { declaredReadTokens, resolveReadReference } from './read-refs.mjs';
import { EXAMPLE_CATALOG_FILE, exampleSourcePaths } from '../lib/example-refs.mjs';

const DEFAULT_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';
const DISPATCH_CONTRACT = 'modules/kernel/dispatch.yaml';
const FILE_CAP = 200;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);

const walk = dir => (fs.existsSync(dir) ? walkFiles(dir) : []);

/** Bounded file listing under one owned dir — cap is enforced by the caller
 *  across all dirs; `budget` is how many more files may still be collected. */
function listFiles(abs, budget) {
  const out = [];
  const visit = dir => {
    if (out.length >= budget) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= budget) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !underWorktrees(abs, p)) visit(p); }
      else if (e.isFile()) out.push(p);
    }
  };
  visit(abs);
  return out;
}

const briefRelOf = op => `modules/ops/ops/${op}.yaml`;

/** First sentence-ish of a folded yaml purpose string — the packet stays short. */
function summarize(text, max = 160) { return clipLine(text, max); }

/** Resolve one declared read token and file its hits/misses on `acc` (the mandatory list dedupes by absolute path). */
const addReadReference = (token, why, mustExist, acc) => {
  let result = resolveReadReference(token, acc.roots);
  // Only an explicitly declared catalog READ expands the contained current
  // source/compiler/test union. Keep the original READ identity on every hash.
  if (token === EXAMPLE_CATALOG_FILE && result.resolved.length === 1 && !result.missing.length) {
    try {
      const expanded = exampleSourcePaths(acc.rt).map((relative) => resolveReadReference(relative, acc.roots));
      result = { ...result, resolved: [...result.resolved, ...expanded.flatMap((row) => row.resolved)],
        missing: expanded.flatMap((row) => row.missing), truncated: expanded.some((row) => row.truncated) };
    } catch (error) {
      result = { ...result, kind: 'invalid', resolved: [], missing: [token], error: 'read-failed' };
      acc.notes.push(`declared catalog READ refused: ${error.message}`);
    }
  }
  acc.missing.push(...result.missing);
  if (result.rootKind === 'source' || mustExist || result.kind === 'invalid') acc.requiredMissing.push(...result.missing);
  if (result.truncated) { acc.readsTruncated = true; acc.requiredMissing.push(`truncated:${token}`); }
  for (const row of result.resolved) {
    const filed = acc.mandatory.find((entry) => entry.absolute === row.absolute);
    if (!filed) acc.mandatory.push({ ...row, why });
    // One file/hash can satisfy several declarations. Retain each original
    // READ provenance so an earlier explicit source cannot erase catalog duty.
    else if (!filed.why.split('\n').includes(why)) filed.why += `\n${why}`;
  }
  return result;
};

/** The brief's reads/context declarations as {id, path, why, resolved, placeholders} rows. */
const declaredReadList = (declared, contextDecl, addReference) => {
  const declaredReads = [];
  for (const entry of [...declared, ...contextDecl]) {
    const why = summarize(entry?.purpose?.en ?? entry?.purpose ?? '');
    const resolved = [];
    const placeholders = [];
    for (const token of declaredReadTokens(entry?.path)) {
      const result = addReference(token, `brief read [${entry.id ?? '?'}] — ${why}`, entry?.mustExist === true);
      resolved.push(...result.resolved.map((row) => row.path));
      if (!result.resolved.length && !result.missing.length) placeholders.push(token);
    }
    declaredReads.push({ id: entry?.id ?? null, path: summarize(entry?.path, 200), why, resolved, placeholders });
  }
  return declaredReads;
};

/** brief-declared knowledge:/docs: refs that exist on disk join the mandatory list. */
const addDeclaredRefs = (briefDoc, addReference) => {
  for (const field of ['knowledge', 'docs']) {
    const refs = briefDoc?.[field];
    const list = Array.isArray(refs) ? refs : [refs].filter((r) => typeof r === 'string');
    for (const ref of list) {
      const rel = String(ref?.path ?? ref).replaceAll('\\', '/');
      if (rel) for (const token of declaredReadTokens(rel)) addReference(token, `brief-declared ${field} ref`, true);
    }
  }
};

/** The files the owned write set currently holds on disk, repo-relative, capped at fileCap. */
const ownedFileList = (ownedPaths, repoBase, fileCap) => {
  const ownedFiles = [];
  let truncated = false;
  for (const o of ownedPaths) {
    const abs = o.abs ?? path.join(repoBase, o.path);
    if (!fs.existsSync(abs)) continue;
    const files = fs.statSync(abs).isDirectory()
      ? listFiles(abs, fileCap + 1 - ownedFiles.length)
      : [abs];
    for (const f of files) ownedFiles.push(path.relative(repoBase, f).replaceAll('\\', '/'));
    if (ownedFiles.length > fileCap) { ownedFiles.length = fileCap; truncated = true; break; }
  }
  return { ownedFiles, truncated };
};

/**
 * Resolve a record list to owned paths — same ownership resolution
 * dispatch-op.mjs uses (example-ownership helpers over the .starciwork tree).
 * Pass `ownedPaths` to reuse an already-resolved set (dispatch-op does).
 */
function resolveOwnedPaths(records, stateDir, preResolved) {
  if (preResolved) return { ownedPaths: preResolved, missing: [] };
  if (!stateDir) {
    return { ownedPaths: [], missing: [],
      note: 'no --state given — owned_paths empty; the kernel must fill them before a real dispatch' };
  }
  const workRoot = path.resolve(stateDir);
  if (!fs.existsSync(workRoot)) return { ownedPaths: [], missing: [], error: `state dir missing: ${workRoot}` };
  return ownedRecordPaths(records, workRoot, { walk, withAbs: true });
}

/**
 * The whole context cut for one op. Returns:
 *   { op, root, mandatory: [{path, why}], declaredReads: [{id, path, why,
 *     resolved, placeholders}], ownedPaths, ownedFiles, truncated, missing,
 *     notes }
 * `mandatory` is the load-ordered concrete read list; `declaredReads` keeps
 * the brief's template/repo-ref/instance tokens the agent must resolve itself.
 */
export function buildContext({
  op, records = [], stateDir = null, root = DEFAULT_ROOT, skillRoot = null,
  briefDoc = null, ownedPaths = null, fileCap = FILE_CAP, params = {}, mode, appRoot = null, allowSelect = true,
} = {}) {
  const rt = path.resolve(skillRoot ?? root ?? DEFAULT_ROOT);
  const briefRel = briefRelOf(op);
  const briefAbs = path.join(rt, briefRel);
  if (!briefDoc) {
    if (!fs.existsSync(briefAbs)) return { op, error: `unknown op '${op}' — no brief at ${briefRel}` };
    briefDoc = parseYaml(fs.readFileSync(briefAbs, 'utf8'));
  }
  // `shared:` markers in the brief expand to the modules/ops/_common.yaml fragments
  // (scripts/lib/op-shared.mjs); callers that already merged see an idempotent no-op.
  briefDoc = mergeOpShared(briefDoc, opSharedOf(briefAbs));
  const selected = resolveOpContract(briefDoc, { params, ...(mode === undefined ? {} : { mode }), allowSelect });
  if (!selected.ok) return { op, error: selected.detail, reason: selected.reason };
  briefDoc = selected.contract;

  const missing = [], requiredMissing = [], notes = [], mandatory = [];
  const roots = { sourceRoot: rt, stateDir, appRoot: appRoot ?? (stateDir ? path.dirname(path.resolve(stateDir)) : null), params };
  const acc = { roots, rt, mandatory, missing, requiredMissing, notes, readsTruncated: false };
  const addReference = (token, why, mustExist = false) => addReadReference(token, why, mustExist, acc);
  const addMandatory = (rel, why) => addReference(rel, why, true);

  // 1-3: the fixed spine every op reads first, in load order.
  addMandatory('CONTEXT.md', "the runtime's load order");
  addMandatory(briefRel, 'your contract — it declares your reads, writes, steps, proofs and blockers');
  addMandatory(VERDICT_CONTRACT, 'what your return must look like');
  addMandatory('modules/ops/_common.yaml', 'the shared evidence and path contract');

  // 4: the brief's own reads/context declarations — concrete files join the
  // mandatory list in declared order; template/repo/instance tokens stay as
  // declared refs the agent resolves against its bound records.
  const declaredReads = declaredReadList(
    Array.isArray(briefDoc?.reads) ? briefDoc.reads : [],
    Array.isArray(briefDoc?.context) ? briefDoc.context : [], addReference);

  // 5: the packet contract (short) — the op should know what a dispatch grants.
  addMandatory(DISPATCH_CONTRACT, 'the packet contract — what this dispatch grants and forbids (read the packet + nonGoals blocks)');

  // 6: brief-declared knowledge:/docs: refs that exist on disk.
  addDeclaredRefs(briefDoc, addReference);

  // 7: owned write set + the files it currently holds (bounded).
  const owned = resolveOwnedPaths(records, stateDir, ownedPaths);
  if (owned.note) notes.push(owned.note);
  if (owned.error) notes.push(owned.error);
  missing.push(...owned.missing.map(r => `record:${r}`));

  // Owned dirs resolve against the repository root that owns the .starciwork
  // (dirname of the state dir); with no state they are runtime-root-relative.
  const repoBase = stateDir ? path.dirname(path.resolve(stateDir)) : rt;
  const { ownedFiles, truncated } = ownedFileList(owned.ownedPaths, repoBase, fileCap);

  return {
    op, root: rt, mode: selected.mode,
    mandatory, declaredReads, requiredMissing: [...new Set(requiredMissing)], readsTruncated: acc.readsTruncated,
    ownedPaths: owned.ownedPaths.map(({ abs, ...rest }) => rest),
    ownedFiles, truncated, missing, notes,
  };
}

/** The DECLARED READS section lines: one per unresolved placeholder token. */
const placeholderLines = (context) => {
  const withPlaceholders = context.declaredReads.filter(d => d.placeholders.length);
  if (!withPlaceholders.length) return [];
  const lines = ['', 'DECLARED READS — resolve <placeholders> against your bound records/state before reading:'];
  for (const d of withPlaceholders) {
    for (const t of d.placeholders) lines.push(`  - [${d.id ?? '?'}] ${t}${d.why ? ' — ' + d.why : ''}`);
  }
  return lines;
};

/** The rendered packet — the exact text the op must be told to read, in load
 *  order. Written to --out or embedded in the dispatch prompt. */
function renderPacket(context) {
  if (context.error) return `CONTEXT PACKET — op ${context.op}\nERROR: ${context.error}`;
  const lines = [`CONTEXT PACKET — op ${context.op}`, ''];
  lines.push('MANDATORY READS — read in this order before any action:');
  context.mandatory.forEach((m, i) => lines.push(`  ${i + 1}. ${m.absolute ?? m.path} — ${m.why}`));
  lines.push(...placeholderLines(context));
  lines.push('', 'OWNED WRITE SET — only these paths may be modified:');
  if (context.ownedPaths.length) {
    for (const o of context.ownedPaths) lines.push(`  - ${o.path}  (record ${o.record}, via ${o.via}${o.exists ? '' : ', MISSING-ON-DISK'})`);
  } else lines.push('  (none bound — writes stay inside the brief write-ceiling)');
  if (context.ownedFiles.length) {
    lines.push('', `OWNED FILES ON DISK — ${context.ownedFiles.length} shown${context.truncated ? ', truncated at ' + FILE_CAP : ''}:`);
    for (const f of context.ownedFiles) lines.push(`  - ${f}`);
  }
  if (context.missing.length) {
    lines.push('', 'MISSING / UNRESOLVED — report as a blocker if the brief needed them:', ...context.missing.map((m) => `  - ${m}`));
  }
  for (const n of context.notes) lines.push('', `note: ${n}`);
  return lines.join('\n');
}

/** Compact block for embedding inside an op prompt (dispatch-op.mjs buildPrompt). */
export function renderPromptReads(context) {
  if (context.error) return [`MANDATORY READS: unresolved — ${context.error}`];
  const lines = ['MANDATORY READS — read in this order before any action:'];
  context.mandatory.forEach((m, i) => lines.push(`  ${i + 1}. ${m.absolute ?? m.path} — ${m.why}`));
  const ph = context.declaredReads.filter(d => d.placeholders.length);
  if (ph.length) {
    lines.push('  declared reads (resolve <placeholders> against bound records/state):');
    for (const d of ph) for (const t of d.placeholders) lines.push(`    - [${d.id ?? '?'}] ${t}`);
  }
  if (context.ownedFiles.length) {
    lines.push(`  owned files on disk: ${context.ownedFiles.length}${context.truncated ? ' (truncated at ' + FILE_CAP + ')' : ''} — full list in the packet`);
  }
  if (context.missing.length) {
    lines.push('  MISSING / UNRESOLVED inputs — resolve or report before action:');
    for (const missing of context.missing) lines.push(`    - ${missing}`);
  }
  if (context.readsTruncated) lines.push('  READ expansion is incomplete; execution must not proceed.');
  return lines;
}

const { usage, parseArgs } = opCli(`Internal entry: spawned by scripts/kernel/dispatch-op.mjs; not invoked directly.
args: --op <id>
    [--records a,b] [--state <.starciwork dir>] [--repo <runtime root>]
    [--out <packet file>] [--json]`, {
  '--repo': (o, take) => { o.repo = take(); },
  '--out': (o, take) => { o.out = take(); },
});

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.op) usage(2);
  const context = buildContext({ op: args.op, records: args.records, stateDir: args.state, root: args.repo });
  if (context.error) { console.error(context.error); process.exit(1); }
  const packet = renderPacket(context);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, `${packet}\n`);
  }
  if (args.json) { console.log(JSON.stringify({ context, packet }, null, 2)); return; }
  console.log(JSON.stringify(context, null, 2));
  console.log(packet);
  if (args.out) console.log(`packet written: ${args.out}`);
}

const invokedAsScript = isMain(import.meta.url);
if (invokedAsScript) main();
