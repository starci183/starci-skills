// canon-parity.mjs — the canon parity verifier (contract change canon-parity-settle, 2026-09-28): the Kernel's
// "parity, no new findings" judgement of a canon cut slice, as code the runtime settler runs itself.
//
// A code.refactor cut slice (payload.cut + params.canonFamilies) whose worker reported `done` but whose declared
// checks are red or not re-verifiable does not wait on the Kernel when every red is repository residue outside
// the slice (a peer's moved seam, repo-wide debt, a sibling's edit on the shared checkout): the settler measures
// the slice itself, over its OWNED paths, against its admission base, and settles it only when ALL hold:
//
//   (a) canon-scan over the owned paths returns 0 findings              - the slice's own goal is met;
//   (b) the gate's lint half (scripts/gates/gate.mjs: starci app lint --changed over the owned files, per (file, rule) against the
//       admission base, read-only) reports no new finding and every tool ran  - nothing new, nothing unproven;
//   (c) every declared red / unavailable check is superseded by one of these owned-scope measurements (canon, lint,
//       typecheck, git diff --check) or re-runs exit 0 as a runtime check - so what stays red is FOREIGN residue,
//       located outside the owned paths (the checker's `outside` count, FOREIGN_RESIDUE notes);
//   (d) TypeScript: no NEW error versus base in any project that holds an owned file. The base is the SAME tree with
//       only the owned files put back to their base blobs (an in-memory overlay: no temp tree, no link), so the one
//       difference between the two programs is the slice's own diff. A new error anywhere in the program - in an
//       owned file or in a file importing one - is the slice's, never foreign.
//
// Anything else (no admission base, an uncovered red, an unverifiable claim, any new finding) goes to the Kernel with
// its reason - the gate is never weaker than before. Seams (specs): canon, lint, tsc, rerun, diffCheck, git.
import fs from 'node:fs';
import { sha256 } from '../../../engine/digest.mjs';
import path from 'node:path';
import { runNode } from '../../api/node/run-node.mjs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { catFile } from '../../api/git/cat-file.mjs'; import { revParseQuery } from '../../api/git/rev-parse-query.mjs'; import { lsTree } from '../../api/git/ls-tree.mjs';
import { containedPath, slash } from '../../lib/path-key.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

const selfFile = fileURLToPath(import.meta.url);
const PARITY_OPS = Object.freeze(['code.refactor']);
export const PARITY_REASONS = Object.freeze(['declared-check-red', 'check-not-reverifiable', 'nothing-reverifiable', 'rerun-red', 'cut-postcondition-red']);
export const PARITY_CHECKS = Object.freeze({ lint: 'canon-parity-lint', tsc: 'canon-parity-typecheck', diff: 'canon-parity-diff-check' });
/** `s` with every trailing `/` stripped — a `\/+$` match backtracks super-linearly, a loop does not. */
export const stripSlashes = (s) => { let t = s; while (t.endsWith('/')) t = t.slice(0, -1); return t; };
const keyOf = (p) => { const k = stripSlashes(slash(path.resolve(p))); return process.platform === 'win32' ? k.toLowerCase() : k; };
const trimOwned = (p) => {
  let s = slash(p);
  if (s.endsWith('/**/*')) s = s.slice(0, -5);
  else if (s.endsWith('/**')) s = s.slice(0, -3);
  return stripSlashes(s);
};

/** A slice the parity verifier may judge: a done code.refactor canon cut slice. */
export const parityEligible = (item) => item?.outcome === 'done' && PARITY_OPS.includes(item.op)
  && Boolean(item.payload?.cut) && Boolean(item.payload?.params?.canonFamilies);

/** The slice's admission base: the --base its checks (gate.mjs, canon-scan) measured against. */
export function sliceBaseOf(item) {
  for (const c of Array.isArray(item?.report?.checks) ? item.report.checks : []) {
    const m = /--base\s+([0-9a-f]{7,40})\b/i.exec(String(c?.command ?? ''));
    if (m) return m[1];
  }
  return null;
}

/**
 * The family a declared check measures, for (c): canon | lint | tsc | diff | null (uncovered). A family is covered
 * when the verifier re-measures it over the owned paths itself.
 */
/**
 * A declared command with its NODE_PATH assignment dropped (`NODE_PATH=... node ...`, PowerShell
 * `$env:NODE_PATH='...'; node ...`): workers set it only because the runtime's node_modules was missing (restored
 * 2026-09-28), and the re-run resolves the runtime's own dependencies. Any other prefix is left as is. Pure.
 */
export const withoutNodePath = (command) => String(command ?? '')
  .replace(/^\s*\$env:NODE_PATH\s*=\s*(?:'[^']*'|"[^"]*"|\S+)\s*;\s*/i, '')
  .replace(/^\s*NODE_PATH=(?:'[^']*'|"[^"]*"|\S+)\s+/, '');

export function checkFamilyOf(check) {
  const name = String(check?.name ?? ''), command = String(check?.command ?? '');
  if (/canon-scan\.mjs|\bstarci\s+gate\s+canon-scan\b/.test(command) || /(?:^|[-_.\s])canon(?:$|[-_.\s])/i.test(name)) return 'canon';
  if (/gate\.mjs|\bstarci\s+gate\s+run\b|\bstarci\s+app\s+lint\b|\bhfs\s+lint\b|\beslint\b/.test(command) || /code-patterns|(?:^|[-_.])lint(?:$|[-_.])|eslint/i.test(name)) return 'lint';
  if (/(?:^|[\s/\\])tsc(?:\.cmd)?(?:\s|$)/.test(command) || /(?:^|[-_.])tsc(?:$|[-_.])|type-?check/i.test(name)) return 'tsc';
  if (/^git\s+diff\b[^&|;]*--check\b/.test(command.trim())) return 'diff';
  // Exactly one file operand, never a flag (a preload flag would run code).
  if (/^node(?:\.exe)?\s+--check\s+[^\s&|;<>`$'"-][^\s&|;<>`$'"]*$/.test(command.trim())) return 'syntax';
  return null;
}
/** The `cd <dir> &&` head of a declared command, or null: quoted or bare, the dir never holds `&` and `&&` follows. */
const cdDirOf = (command) => {
  const m = /^\s*cd\s+(?:\/d\s+)?/i.exec(command);
  if (!m) return null;
  const rest = command.slice(m[0].length);
  const quoted = rest.startsWith('"');
  const end = quoted ? rest.indexOf('"', 1) : rest.indexOf('&');
  if (end <= 0) return null;
  const dir = rest.slice(quoted ? 1 : 0, end);
  if (dir === '' || dir.includes('&') || dir.includes('"')) return null;
  return rest.slice(quoted ? end + 1 : end).trimStart().startsWith('&&') ? dir : null;
};

/** The tsconfig of one declared typecheck command (`cd <dir> && ... tsc`, `tsc -p|--project <path>`), or null. */
const declaredProjectOf = (command, root) => {
  const p = /(?:^|\s)(?:-p|--project)\s+("?)([^"\s]+)\1/.exec(command)?.[2];
  const cd = cdDirOf(command);
  const base = cd ? path.resolve(root, cd.trim()) : root;
  let target = null;
  if (p) target = path.resolve(base, p);
  else if (cd) target = base;
  if (!target) return null;
  const file = /\.json$/i.test(target) ? target : path.join(target, 'tsconfig.json');
  return fs.existsSync(file) && keyOf(file).startsWith(`${keyOf(root)}/`) ? file : null;
};

/** tsconfig projects a declared typecheck named: `cd <dir> && ... tsc`, `tsc -p|--project <path>`. Absolute paths only. */
export function declaredProjectsOf(checks, root) {
  const out = [];
  for (const c of checks ?? []) {
    if (checkFamilyOf(c) !== 'tsc') continue;
    const file = declaredProjectOf(String(c?.command ?? ''), root);
    if (file) out.push(file);
  }
  return [...new Set(out)];
}

/* ------------------------------------------------------------ git */

export function git(call, root, args, { input = null, encoding = 'utf8', timeoutMs = 120_000 } = {}) {
  const r = call(args, { dir: root, encoding, ...(input == null ? {} : { input: Buffer.from(input) }),
    timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout, stderr: String(r.stderr ?? '') };
}

/** The owned files at the base commit: {rel (to root) -> content}. rels are root-relative posix paths. */
export function baseBlobsOf(root, base, ownedRels, { run = git } = {}) {
  const top = run(revParseQuery, root, ['--show-toplevel']);
  if (!top.ok) return { ok: false, reason: 'not a git checkout' };
  const gitRoot = String(top.stdout).trim();
  const prefix = slash(path.relative(gitRoot, root));
  const full = (rel) => (prefix ? `${prefix}/${rel}` : rel);
  const listed = run(lsTree, gitRoot, ['-r', '-z', '--full-name', '--name-only', base, '--', ...ownedRels.map(full)]);
  if (!listed.ok) return { ok: false, reason: `git ls-tree ${base}: ${listed.stderr.trim().slice(0, 200)}` };
  const names = String(listed.stdout).split('\0').filter(Boolean);
  const blobs = new Map();
  if (!names.length) return { ok: true, blobs };
  const batch = run(catFile, gitRoot, ['--batch'], { input: names.map((n) => `${base}:${n}`).join('\n') + '\n', encoding: null });
  if (!batch.ok) return { ok: false, reason: 'git cat-file --batch failed' };
  const buf = batch.stdout;
  let at = 0;
  for (const name of names) {
    const nl = buf.indexOf(0x0a, at);
    const header = buf.subarray(at, nl).toString('utf8');
    const size = Number(header.split(' ')[2]);
    if (!/ blob \d+$/.test(header)) return { ok: false, reason: `unexpected cat-file header for ${name}: ${header.slice(0, 80)}` };
    blobs.set(prefix ? name.slice(prefix.length + 1) : name, buf.subarray(nl + 1, nl + 1 + size).toString('utf8'));
    at = nl + 1 + size + 1;
  }
  return { ok: true, blobs };
}

/** Every file sameOrUnder the owned paths in the working tree (root-relative posix), links never followed. */
export function ownedFilesOf(root, ownedRels) {
  const out = [];
  const walk = (rel) => {
    let st;
    try { st = fs.lstatSync(path.join(root, rel)); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (st.isFile()) { out.push(rel); return; }
    if (!st.isDirectory()) return;
    for (const e of fs.readdirSync(path.join(root, rel)).sort()) {
      if (e === 'node_modules' || e === '.next' || e === '.git') continue;
      walk(`${rel}/${e}`);
    }
  };
  for (const rel of ownedRels) walk(rel);
  return [...new Set(out)].sort(byCodeUnit);
}

/* ------------------------------------------------------------ (d) typecheck parity */

const TS_SOURCE = /\.(?:[cm]?tsx?|[cm]?jsx?)$/i;
/** The nearest tsconfig.json above each file, inside root. */
function projectsOf(root, rels) {
  const out = new Set();
  const rootKey = keyOf(root);
  for (const rel of rels) {
    if (!TS_SOURCE.test(rel)) continue;
    let dir = path.dirname(path.join(root, rel));
    while (keyOf(dir).startsWith(rootKey)) {
      const f = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(f)) { out.add(path.resolve(f)); break; }
      if (keyOf(dir) === rootKey) break;
      dir = path.dirname(dir);
    }
  }
  return [...out].sort(byCodeUnit);
}

/**
 * Error diagnostics of one project, keyed by (file, code, message) with counts - line-free, so an error the slice
 * only moved is not new. `overlay` (Map root-rel -> content | undefined) replaces the owned files: present -> that
 * content, absent from the map but owned -> the file does not exist.
 */
function projectErrors(ts, root, configFile, { owned = null } = {}) {
  const cfg = ts.readConfigFile(configFile, ts.sys.readFile);
  if (cfg.error) throw new Error(`tsconfig unreadable: ${configFile}`);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(configFile));
  const options = { ...parsed.options, noEmit: true, incremental: false, composite: false };
  delete options.tsBuildInfoFile;
  const host = ts.createCompilerHost(options, true);
  let rootNames = parsed.fileNames;
  if (owned) {
    const ownedKey = (f) => { const k = keyOf(f); return owned.keys.has(k) ? k : null; };
    const baseOf = (f) => owned.base.get(keyOf(f));
    const { fileExists, readFile, getSourceFile } = host;
    host.fileExists = (f) => (ownedKey(f) ? baseOf(f) !== undefined : fileExists.call(host, f));
    host.readFile = (f) => (ownedKey(f) ? baseOf(f) : readFile.call(host, f));
    host.getSourceFile = (f, lang, onError, fresh) => {
      if (!ownedKey(f)) return getSourceFile.call(host, f, lang, onError, fresh);
      const text = baseOf(f);
      return text === undefined ? undefined : ts.createSourceFile(f, text, lang, true);
    };
    const projectDir = keyOf(path.dirname(configFile));
    const kept = rootNames.filter((f) => !ownedKey(f) || baseOf(f) !== undefined);
    const extra = [...owned.base.keys()].filter((k) => k.startsWith(`${projectDir}/`) && /\.(?:[cm]?tsx?)$/.test(k)
      && !kept.some((f) => keyOf(f) === k)).map((k) => owned.abs.get(k));
    rootNames = [...kept, ...extra];
  }
  const program = ts.createProgram({ rootNames, options, host, projectReferences: parsed.projectReferences });
  const counts = new Map();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (d.category !== ts.DiagnosticCategory.Error) continue;
    const file = d.file ? slash(path.relative(root, d.file.fileName)) : '<global>';
    const key = `${file}\0TS${d.code}\0${ts.flattenDiagnosticMessageText(d.messageText, '\n').replace(/\s+/g, ' ').trim()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { counts, files: program.getSourceFiles().length };
}

/**
 * (d): new TypeScript errors versus base in every project holding an owned file (plus the projects the slice's own
 * typecheck named). {ok, projects[], newErrors: [{project, file, code, message, owned, count, baseCount}], unavailable?}
 */
export function tscParity({ root, ownedRels, baseBlobs, extraProjects = [], ts: injected = null }) {
  let ts = injected;
  if (!ts) try { ts = createRequire(path.join(root, 'package.json'))('typescript'); }
  catch { return { ok: false, unavailable: 'typescript is not installed in the checked repository' }; }
  const current = ownedFilesOf(root, ownedRels);
  const projects = [...new Set([...projectsOf(root, [...current, ...baseBlobs.keys()]), ...extraProjects])].sort(byCodeUnit);
  if (!projects.length) return { ok: true, projects: [], newErrors: [], note: 'no TypeScript project holds an owned file' };
  const abs = new Map(), base = new Map(), keys = new Set();
  for (const rel of [...current, ...baseBlobs.keys()]) { const a = path.join(root, rel); keys.add(keyOf(a)); abs.set(keyOf(a), a); }
  for (const [rel, text] of baseBlobs) base.set(keyOf(path.join(root, rel)), text);
  const ownedSet = new Set([...current, ...baseBlobs.keys()]);
  const newErrors = [], measured = [];
  for (const project of projects) {
    const now = projectErrors(ts, root, project);
    const was = projectErrors(ts, root, project, { owned: { keys, base, abs } });
    let n = 0;
    for (const [key, count] of now.counts) {
      const baseCount = was.counts.get(key) ?? 0;
      if (count <= baseCount) continue;
      const [file, code, message] = key.split('\0');
      newErrors.push({ project: slash(path.relative(root, project)), file, code, message: message.slice(0, 240), owned: ownedSet.has(file), count, baseCount });
      n += 1;
    }
    measured.push({ project: slash(path.relative(root, project)), files: now.files, errors: [...now.counts.values()].reduce((a, b) => a + b, 0), baseErrors: [...was.counts.values()].reduce((a, b) => a + b, 0), newKeys: n });
  }
  return { ok: newErrors.length === 0, projects: measured, newErrors };
}

/* ------------------------------------------------------------ (b) lint parity through the gate */

/**
 * (b)+(c) for lint: the gate's lint half (scripts/gates/gate.mjs runLintGate: `starci app lint --changed` over the owned files,
 * judged per (file, rule) against the admission base read-only from git objects) in a child process. {ok, status, counts,
 * gating: [...], baseline}. status clean | findings | unavailable (a tool could not run: never green).
 */
export async function lintParity({ root, files, base, checker = null, timeoutMs = 1_200_000 }) {
  if (!files.length) return { ok: true, status: 'clean', counts: { new: 0, preexisting: 0 }, gating: [], note: 'no owned file' };
  const gated = await (checker ?? ((r, f, o) => lintInChild(r, f, { ...o, timeoutMs })))(root, files, { base });
  let status = 'unavailable';
  if (gated?.exit === 0) status = 'clean';
  else if (gated?.exit === 1) status = 'findings';
  const gating = [...(gated?.errors ?? []).map((message) => ({ code: 'GATE_TOOL_FAILED', message: String(message) })),
    ...(gated?.findings ?? []).map((f) => ({ code: `${f.engine}/${f.rule}`, file: f.path ?? null, line: f.line ?? null, message: f.message }))];
  return { ok: status === 'clean', status, counts: { new: (gated?.findings ?? []).length, preexisting: gated?.preexisting ?? 0 }, gating,
    baseline: { method: 'gate', status: status === 'unavailable' ? 'unavailable' : 'measured', base } };
}

/**
 * The gate's lint half in a child process of its own. In-process it would share the ESM cache with the settler's canon-scan:
 * the target's eslint.config would then hold the canon plugin module canon-scan imported. The file list goes through a temp
 * file (never a command line). Resolves to runLintGate's {exit, findings, preexisting, errors}.
 */
function lintInChild(root, files, { base, timeoutMs = 1_200_000, env = process.env } = {}) {
  const dir = path.join(os.tmpdir(), 'starci-settler');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `parity-lint-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ root, files, base }));
  try {
    const r = runNode([selfFile, '--lint-child', file], { timeout: timeoutMs, env, maxBuffer: 256 * 1024 * 1024 });
    const line = String(r.stdout ?? '').trim().split(/\r?\n/).pop() ?? '';
    try {
      return JSON.parse(line);
    } catch {
      const why = String(r.stderr || r.error?.message || `exit ${r.status}`).slice(0, 300);
      return { exit: 2, findings: [], errors: [`the parity lint child printed no result: ${why}`] };
    }
  } finally { try { fs.rmSync(file, { force: true }); } catch { /* temp */ } }
}

/* ------------------------------------------------------------ the verdict (canon-parity-verdict.mjs) */

export { canonParityVerdict } from './canon-parity-verdict.mjs';

/** The one checkout the slice's owned paths resolve into, and the owned paths relative to it. */
export async function resolveOwnedRoot(item, { repo }) {
  const { ownedPathPlacements } = await import('../target-repo.mjs');
  const owned = item.payload.owned_paths ?? [];
  const places = ownedPathPlacements({ op: item.op, payload: item.payload, ownedPaths: owned, repo });
  const bases = [...new Set(places.map((p) => p.base && path.resolve(p.base)).filter(Boolean))];
  if (!owned.length || places.some((p) => p.unresolved || !p.base) || bases.length !== 1) return { ok: false, why: 'owned paths do not resolve into one checkout' };
  return { ok: true, root: bases[0], ownedRels: [...new Set(places.map((p) => trimOwned(p.path)).filter((p) => p && p !== '.'))] };
}

/**
 * Bind cached non-green refusals to the admission base and length-framed owned paths/content, normalizing CRLF.
 * A Latin-1 round trip preserves arbitrary bytes; an unreadable input disables reuse instead of caching a guess.
 */
export async function parityFingerprint(item, { repo, resolveRoot = resolveOwnedRoot } = {}) {
  const where = await resolveRoot(item, { repo });
  if (!where.ok) return null;
  const frame = (value) => { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value)); return Buffer.concat([Buffer.from(`${bytes.length}:`), bytes]); };
  const frames = [frame(sliceBaseOf(item))];
  try {
    for (const rel of ownedFilesOf(where.root, where.ownedRels)) {
      const bytes = Buffer.from(fs.readFileSync(path.join(where.root, rel)).toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
      frames.push(frame(rel), frame(bytes));
    }
  } catch { return null; }
  return sha256(Buffer.concat(frames));
}
// The lint child: node canon-parity.mjs --lint-child <job.json> -> one JSON line, runLintGate's result.
if (isMain(import.meta.url) && process.argv[2] === '--lint-child') {
  // The parent wrote the job file under the OS temp dir; a path anywhere else is not its job.
  const job = JSON.parse(fs.readFileSync(containedPath(os.tmpdir(), process.argv[3], { label: '--lint-child job file' }), 'utf8'));
  const { runLintGate } = await import('../../gates/gate.mjs');
  const out = await runLintGate({ root: job.root, base: job.base, files: job.files });
  process.stdout.write(`${JSON.stringify({ exit: out.exit, findings: out.findings.slice(0, 500), preexisting: out.preexisting, errors: out.errors })}\n`);
}
