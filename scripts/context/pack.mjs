#!/usr/bin/env node
// pack.mjs — context cutting as a function (wave m7).
//
// Context assembly is a deterministic function:
// `node scripts/context/pack.mjs --op <id>` returns the mandatory read list,
// the brief's declared reads with placeholders flagged, the resolved owned
// write set and the actual files it currently holds on disk — plus a rendered
// packet.md, the exact text the op must be told to read, in load order.
//
// Consumed two ways:
//   - CLI (this file's main): materializes a packet on demand; tests/context-pack.spec.mjs
//     drives it as a process.
//   - Library: scripts/route/dispatch-op.mjs imports buildContext/renderPromptReads
//     so the [Op] prompt carries the resolved MANDATORY READS list, not just
//     "read CONTEXT.md".
//
// CLI:
//   node scripts/context/pack.mjs --op <id> [--records a,b] [--state <.starciwork>]
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
import { loadRecords, readWorkspace, resolveOwnedDirs } from '../example/example-ownership.mjs';

const DEFAULT_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';
const DISPATCH_CONTRACT = 'modules/kernel/dispatch.yaml';
const FILE_CAP = 200;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);

const walk = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : []);

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
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) visit(p); }
      else if (e.isFile()) out.push(p);
    }
  };
  visit(abs);
  return out;
}

const briefRelOf = op => `modules/ops/ops/${op}.yaml`;

/** First sentence-ish of a folded yaml purpose string — the packet stays short. */
function summarize(text, max = 160) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** A declared read path may carry several refs: `a.mjs + b/*.mjs +\n c.json`. */
function readTokens(rawPath) {
  return String(rawPath ?? '').split(/[+\n]/).map(s => s.trim()).filter(Boolean);
}

/**
 * Classify one declared-read token and, when it names concrete files under the
 * runtime root (or the state dir), resolve it. Returns
 *   {token, kind, resolved:[relPaths], missing:[relPaths]}
 * kinds: file | glob | state | repo-ref | template | prose | instance
 *   file     concrete relative path — existence checked under root
 *   glob     concrete prefix + '*' — expanded under root (bounded)
 *   state    .starciwork-relative — resolved under --state when given
 *   repo-ref `repository:<id>/...` — bound to the target repo at runtime,
 *            not resolvable from the skill tree (declared only)
 *   template carries a `<placeholder>` — resolved by the agent against the
 *            bound records (declared only)
 *   prose    free-text fragment inside a declared path (declared only)
 *   instance `N/...`, `E/...` — per-op-instance node/evidence paths (declared)
 */
function resolveReadToken(token, { root, stateDir }) {
  const rel = token.replaceAll('\\', '/');
  if (/^repository:/.test(rel)) return { token, kind: 'repo-ref', resolved: [], missing: [] };
  if (/</.test(rel)) return { token, kind: 'template', resolved: [], missing: [] };
  // Prose fragments ride inside declared paths ("the slice's existing
  // regression suite and its real runner") — declared, never a missing path.
  if (/\s/.test(rel)) return { token, kind: 'prose', resolved: [], missing: [] };
  if (/^(N|E)\//.test(rel)) return { token, kind: 'instance', resolved: [], missing: [] };
  if (rel === '.starciwork' || rel.startsWith('.starciwork/')) {
    if (!stateDir) return { token, kind: 'state', resolved: [], missing: [] };
    const abs = path.join(path.resolve(stateDir), rel.replace(/^\.starciwork\/?/, ''));
    return fs.existsSync(abs)
      ? { token, kind: 'state', resolved: [rel], missing: [] }
      : { token, kind: 'state', resolved: [], missing: [rel] };
  }
  if (rel.includes('*')) {
    // Expand a simple glob under root: walk the concrete prefix dir (skipping
    // node_modules/dist/.next), keep matches, bound at 50.
    const prefix = rel.split('*')[0].replace(/\/[^/]*$/, '').replace(/\/$/, '');
    const base = prefix ? path.join(root, prefix) : root;
    const hits = listFiles(base, 500)
      .map(f => path.relative(root, f).replaceAll('\\', '/'))
      .filter(f => globMatch(rel, f))
      .slice(0, 50);
    return hits.length
      ? { token, kind: 'glob', resolved: hits, missing: [] }
      : { token, kind: 'glob', resolved: [], missing: [rel] };
  }
  return fs.existsSync(path.join(root, rel))
    ? { token, kind: 'file', resolved: [rel], missing: [] }
    : { token, kind: 'file', resolved: [], missing: [rel] };
}

/** Minimal glob match: `*` matches any run of non-`/`-or-`/` chars. */
function globMatch(pattern, rel) {
  const rx = new RegExp(`^${pattern.split('*').map(escapeRx).join('[^]*')}$`);
  return rx.test(rel);
}
const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const recordsById = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const ownedPaths = [];
  const missing = [];
  for (const rid of records) {
    const rec = recordsById.get(rid);
    if (!rec) { missing.push(rid); continue; }
    for (const d of resolveOwnedDirs(rid, rec, recordsById, workspaceDoc, workRoot)) {
      ownedPaths.push({ record: rid, path: d.rel.replaceAll('\\', '/'), via: d.via, exists: fs.existsSync(d.abs), abs: d.abs });
    }
  }
  return { ownedPaths, missing };
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
  briefDoc = null, ownedPaths = null, fileCap = FILE_CAP,
} = {}) {
  const rt = path.resolve(skillRoot ?? root ?? DEFAULT_ROOT);
  const briefRel = briefRelOf(op);
  const briefAbs = path.join(rt, briefRel);
  if (!briefDoc) {
    if (!fs.existsSync(briefAbs)) return { op, error: `unknown op '${op}' — no brief at ${briefRel}` };
    briefDoc = parseYaml(fs.readFileSync(briefAbs, 'utf8'));
  }

  const missing = [];
  const notes = [];
  const mandatory = [];
  const addMandatory = (rel, why) => {
    const abs = path.join(rt, rel);
    if (fs.existsSync(abs)) mandatory.push({ path: rel, why });
    else missing.push(rel);
  };

  // 1-3: the fixed spine every op reads first, in load order.
  addMandatory('CONTEXT.md', "the runtime's load order");
  addMandatory(briefRel, 'your contract — it declares your reads, writes, steps, proofs and blockers');
  addMandatory(VERDICT_CONTRACT, 'what your return must look like');

  // 4: the brief's own reads/context declarations — concrete files join the
  // mandatory list in declared order; template/repo/instance tokens stay as
  // declared refs the agent resolves against its bound records.
  const declaredReads = [];
  const declared = Array.isArray(briefDoc?.reads) ? briefDoc.reads : [];
  const contextDecl = Array.isArray(briefDoc?.context) ? briefDoc.context : [];
  for (const entry of [...declared, ...contextDecl]) {
    const why = summarize(entry?.purpose?.en ?? entry?.purpose ?? '');
    const resolved = [];
    const placeholders = [];
    for (const token of readTokens(entry?.path)) {
      const r = resolveReadToken(token, { root: rt, stateDir });
      if (r.resolved.length) resolved.push(...r.resolved);
      else if (r.missing.length) missing.push(...r.missing);
      else placeholders.push(token);
    }
    for (const rel of resolved) {
      if (!mandatory.some(m => m.path === rel)) mandatory.push({ path: rel, why: `brief read [${entry.id ?? '?'}] — ${why}` });
    }
    declaredReads.push({ id: entry?.id ?? null, path: summarize(entry?.path, 200), why, resolved, placeholders });
  }

  // 5: the packet contract (short) — the op should know what a dispatch grants.
  addMandatory(DISPATCH_CONTRACT, 'the packet contract — what this dispatch grants and forbids (read the packet + nonGoals blocks)');

  // 6: brief-declared knowledge:/docs: refs that exist on disk.
  for (const field of ['knowledge', 'docs']) {
    const refs = briefDoc?.[field];
    const list = Array.isArray(refs) ? refs : typeof refs === 'string' ? [refs] : [];
    for (const ref of list) {
      const rel = String(ref?.path ?? ref).replaceAll('\\', '/');
      if (rel && fs.existsSync(path.join(rt, rel)) && !mandatory.some(m => m.path === rel)) {
        mandatory.push({ path: rel, why: `brief-declared ${field} ref` });
      }
    }
  }

  // 7: owned write set + the files it currently holds (bounded).
  const owned = resolveOwnedPaths(records, stateDir, ownedPaths);
  if (owned.note) notes.push(owned.note);
  if (owned.error) notes.push(owned.error);
  missing.push(...owned.missing.map(r => `record:${r}`));

  // Owned dirs resolve against the repository root that owns the .starciwork
  // (dirname of the state dir); with no state they are runtime-root-relative.
  const repoBase = stateDir ? path.dirname(path.resolve(stateDir)) : rt;
  const ownedFiles = [];
  let truncated = false;
  for (const o of owned.ownedPaths) {
    const abs = o.abs ?? path.join(repoBase, o.path);
    if (!fs.existsSync(abs)) continue;
    const files = fs.statSync(abs).isDirectory()
      ? listFiles(abs, fileCap + 1 - ownedFiles.length)
      : [abs];
    for (const f of files) ownedFiles.push(path.relative(repoBase, f).replaceAll('\\', '/'));
    if (ownedFiles.length > fileCap) { ownedFiles.length = fileCap; truncated = true; break; }
  }

  return {
    op, root: rt,
    mandatory, declaredReads,
    ownedPaths: owned.ownedPaths.map(({ abs, ...rest }) => rest),
    ownedFiles, truncated, missing, notes,
  };
}

/** The rendered packet — the exact text the op must be told to read, in load
 *  order. Written to --out or embedded in the dispatch prompt. */
function renderPacket(context) {
  if (context.error) return `CONTEXT PACKET — op ${context.op}\nERROR: ${context.error}`;
  const lines = [`CONTEXT PACKET — op ${context.op}`, ''];
  lines.push('MANDATORY READS — read in this order before any action:');
  context.mandatory.forEach((m, i) => lines.push(`  ${i + 1}. ${m.path} — ${m.why}`));
  const withPlaceholders = context.declaredReads.filter(d => d.placeholders.length);
  if (withPlaceholders.length) {
    lines.push('', 'DECLARED READS — resolve <placeholders> against your bound records/state before reading:');
    for (const d of withPlaceholders) {
      for (const t of d.placeholders) lines.push(`  - [${d.id ?? '?'}] ${t}${d.why ? ` — ${d.why}` : ''}`);
    }
  }
  lines.push('', 'OWNED WRITE SET — only these paths may be modified:');
  if (context.ownedPaths.length) {
    for (const o of context.ownedPaths) lines.push(`  - ${o.path}  (record ${o.record}, via ${o.via}${o.exists ? '' : ', MISSING-ON-DISK'})`);
  } else lines.push('  (none bound — writes stay inside the brief write-ceiling)');
  if (context.ownedFiles.length) {
    lines.push('', `OWNED FILES ON DISK — ${context.ownedFiles.length} shown${context.truncated ? `, truncated at ${FILE_CAP}` : ''}:`);
    for (const f of context.ownedFiles) lines.push(`  - ${f}`);
  }
  if (context.missing.length) {
    lines.push('', 'MISSING / UNRESOLVED — report as a blocker if the brief needed them:');
    for (const m of context.missing) lines.push(`  - ${m}`);
  }
  for (const n of context.notes) lines.push('', `note: ${n}`);
  return lines.join('\n');
}

/** Compact block for embedding inside an op prompt (dispatch-op.mjs buildPrompt). */
export function renderPromptReads(context) {
  if (context.error) return [`MANDATORY READS: unresolved — ${context.error}`];
  const lines = ['MANDATORY READS — read in this order before any action:'];
  context.mandatory.forEach((m, i) => lines.push(`  ${i + 1}. ${m.path} — ${m.why}`));
  const ph = context.declaredReads.filter(d => d.placeholders.length);
  if (ph.length) {
    lines.push('  declared reads (resolve <placeholders> against bound records/state):');
    for (const d of ph) for (const t of d.placeholders) lines.push(`    - [${d.id ?? '?'}] ${t}`);
  }
  if (context.ownedFiles.length) {
    lines.push(`  owned files on disk: ${context.ownedFiles.length}${context.truncated ? ` (truncated at ${FILE_CAP})` : ''} — full list in the packet`);
  }
  return lines;
}

function usage(code) {
  console.error(`use: node scripts/context/pack.mjs --op <id>
    [--records a,b] [--state <.starciwork dir>] [--repo <runtime root>]
    [--out <packet file>] [--json]`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { records: [] };
  const take = () => {
    const v = argv[++parseArgs.i];
    if (v === undefined) usage(2);
    return v;
  };
  for (parseArgs.i = 0; parseArgs.i < argv.length; parseArgs.i++) {
    const k = argv[parseArgs.i];
    if (k === '--op') a.op = take();
    else if (k === '--records') a.records.push(...take().split(','));
    else if (k === '--state') a.state = take();
    else if (k === '--repo') a.repo = take();
    else if (k === '--out') a.out = take();
    else if (k === '--json') a.json = true;
    else if (k === '--help' || k === '-h') usage(0);
    else usage(2);
  }
  a.records = [...new Set(a.records.map(s => s.trim()).filter(Boolean))];
  return a;
}

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

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) main();
