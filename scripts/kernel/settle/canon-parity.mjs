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
import { checkVerdictOf } from './check-verdict.mjs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { catFile } from '../../api/git/cat-file.mjs'; import { diff as gitDiff } from '../../api/git/diff.mjs'; import { revParseQuery } from '../../api/git/rev-parse-query.mjs'; import { lsTree } from '../../api/git/ls-tree.mjs';
import { sameOrUnder } from '../../lib/path-key.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

const selfFile = fileURLToPath(import.meta.url);
const PARITY_OPS = Object.freeze(['code.refactor']);
export const PARITY_REASONS = Object.freeze(['declared-check-red', 'check-not-reverifiable', 'nothing-reverifiable', 'rerun-red', 'cut-postcondition-red']);
const PARITY_CHECKS = Object.freeze({ lint: 'canon-parity-lint', tsc: 'canon-parity-typecheck', diff: 'canon-parity-diff-check' });
const norm = (p) => String(p ?? '').replace(/\\/g, '/');
const keyOf = (p) => { const k = norm(path.resolve(p)).replace(/\/+$/, ''); return process.platform === 'win32' ? k.toLowerCase() : k; };
const trimOwned = (p) => norm(p).replace(/\/\*\*(?:\/\*)?$/, '').replace(/\/+$/, '');

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
/** The contract's record of a gate the owner switched off (code.refactor: specs.unit, exit 0, evidence "skipped: ..."): not a claim. */
const isSkipRecord = (check) => /^specs\./.test(String(check?.name ?? '')) && check?.exitCode === 0 && /^skipped:/i.test(String(check?.evidence ?? '').trim());

/** tsconfig projects a declared typecheck named: `cd <dir> && ... tsc`, `tsc -p|--project <path>`. Absolute paths only. */
export function declaredProjectsOf(checks, root) {
  const out = [];
  for (const c of checks ?? []) {
    if (checkFamilyOf(c) !== 'tsc') continue;
    const command = String(c?.command ?? '');
    const p = /(?:^|\s)(?:-p|--project)\s+("?)([^"\s]+)\1/.exec(command)?.[2];
    const cd = /^\s*cd\s+(?:\/d\s+)?("?)([^"&]+?)\1\s*&&/i.exec(command)?.[2];
    const base = cd ? path.resolve(root, cd.trim()) : root;
    const target = p ? path.resolve(base, p) : cd ? base : null;
    if (!target) continue;
    const file = /\.json$/i.test(target) ? target : path.join(target, 'tsconfig.json');
    if (fs.existsSync(file) && keyOf(file).startsWith(`${keyOf(root)}/`)) out.push(file);
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
  const prefix = norm(path.relative(gitRoot, root));
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
function ownedFilesOf(root, ownedRels) {
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
    const file = d.file ? norm(path.relative(root, d.file.fileName)) : '<global>';
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
      newErrors.push({ project: norm(path.relative(root, project)), file, code, message: message.slice(0, 240), owned: ownedSet.has(file), count, baseCount });
      n += 1;
    }
    measured.push({ project: norm(path.relative(root, project)), files: now.files, errors: [...now.counts.values()].reduce((a, b) => a + b, 0), baseErrors: [...was.counts.values()].reduce((a, b) => a + b, 0), newKeys: n });
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
  const status = gated?.exit === 0 ? 'clean' : gated?.exit === 1 ? 'findings' : 'unavailable';
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
    try { return JSON.parse(line); } catch { return { exit: 2, findings: [], errors: [`the parity lint child printed no result: ${String(r.stderr || r.error?.message || `exit ${r.status}`).slice(0, 300)}`] }; }
  } finally { try { fs.rmSync(file, { force: true }); } catch { /* temp */ } }
}

/* ------------------------------------------------------------ the verdict */

const brief = (issue) => `${issue.code}${issue.ruleId ? `/${issue.ruleId}` : ''}${issue.file ?? issue.path ? ` ${issue.file ?? issue.path}${issue.line ? `:${issue.line}` : ''}` : ''}${issue.newBecause ? ` (${issue.newBecause})` : ''}`;

/**
 * The parity verdict of one reported canon cut slice. {green, via: 'canon-parity', checks, reason?, detail?, parity}
 * `classify(check)` is the settler's classifyCheck; `rerun`/`canon` its seams; `lint`, `tsc`, `diffCheck`, `blobs` ours.
 */
export async function canonParityVerdict(item, { repo, settings, env = process.env, classify, rerun, canon, baseline = () => false,
  resolveRoot, lint = lintParity, tsc = tscParity, diffCheck = null, blobs = baseBlobsOf, now = Date.now, wireLegs = () => [],
  canonBase = canonBaseFindings, record = async () => {} } = {}) {
  const started = now();
  const hand = (reason, detail, parity = null) => ({ green: false, reason, detail: (Array.isArray(detail) ? detail : [detail]).filter(Boolean).map((d) => String(d).slice(0, 300)).slice(0, 8), ...(parity ? { parity } : {}) });
  // H7: a measurement that could not run is tooling, never the slice's red (scripts/kernel/settle/check-verdict.mjs).
  const unavailable = (reason, detail) => ({ ...hand(reason, detail), unavailable: true });
  const base = sliceBaseOf(item);
  if (!base) return hand('parity-no-base', 'no --base in the report checks');
  const where = await resolveRoot(item, { repo });
  if (!where.ok) return hand('parity-unresolved', where.why);
  const { root, ownedRels } = where;
  if (!git(catFile, root, ['-e', `${base}^{commit}`]).ok) return hand('parity-base-unknown', `admission base ${base} is not a commit in ${root}`);

  // (c) every declared check is an action, a baseline, covered by an owned-scope measurement, or re-runs green.
  const declared = Array.isArray(item.report?.checks) ? item.report.checks : [];
  const covered = { canon: [], lint: [], tsc: [], diff: [], syntax: [] };
  const reruns = [];
  const uncovered = [];
  for (const c of declared) {
    if (baseline(c) || isSkipRecord(c)) continue;
    const cls = classify({ ...c, command: withoutNodePath(c?.command) });
    const family = checkFamilyOf(c);
    if (family) { covered[family].push(c); continue; }
    if (cls.kind === 'action') { if (c?.exitCode !== 0 && c?.exitCode != null) uncovered.push(`${c.name}:${c.exitCode} (red action)`); continue; }
    if (cls.kind === 'runtime') { reruns.push({ check: c, ...cls }); continue; }
    uncovered.push(`${c?.name}:${c?.exitCode} (${cls.why ?? 'not re-verifiable'})`);
  }
  if (uncovered.length) return hand('parity-uncovered', uncovered);

  const checks = [];
  for (const c of reruns) {
    if (now() - started > settings.itemBudgetMs) return hand('verify-budget-exceeded', 'parity re-runs');
    const r = rerun(c, { repo, timeoutMs: settings.rerunTimeoutMs, env });
    await record({ name: String(c.check.name ?? c.rel), command: String(c.check.command), cwd: repo, phase: 'parity', runner: 'parity', ...r });
    const v = checkVerdictOf(r);
    if (v.verdict === 'unavailable') return unavailable('parity-checker-unavailable', `${c.check.name}:${r.exitCode} ${r.tail ?? ''}`);
    if (v.verdict === 'red') return hand('parity-rerun-red', `${c.check.name}:${r.exitCode} ${r.tail ?? ''}`);
    checks.push({ name: String(c.check.name ?? c.rel), exitCode: 0, command: String(c.check.command).slice(0, 2000),
      evidence: `runtime settler re-run: exit 0 in ${Math.round(r.ms / 100) / 10}s (worker declared exit ${c.check.exitCode})` });
  }

  // node --check <file>: re-run as argv (no shell) in the checkout; the file must parse.
  for (const c of covered.syntax) {
    const argv = String(c.command).trim().split(/\s+/).slice(1);
    const syntaxStarted = now();
    const r = runNode(argv, { cwd: root, timeout: 60_000 });
    await record({ name: String(c.name), command: String(c.command), cwd: root, phase: 'parity', runner: 'parity',
      exitCode: r.status ?? (r.error?.code === 'ETIMEDOUT' ? 124 : 127), startedAt: syntaxStarted, finishedAt: now(), stdout: r.stdout, stderr: r.stderr ?? r.error?.message });
    if (r.status == null || r.error) return unavailable('parity-checker-unavailable', `${c.name}: ${r.error?.message ?? 'no exit'}`);
    if (r.status !== 0) return hand('parity-rerun-red', `${c.name}:${r.status} ${String(r.stderr ?? '').trim().split(/\r?\n/)[0] ?? ''}`);
    checks.push({ name: String(c.name), exitCode: 0, command: String(c.command).slice(0, 2000), evidence: `runtime settler re-run in ${root}: exit 0 (worker declared exit ${c.exitCode})` });
  }

  // (a) the slice's goal: canon-scan over its owned paths, 0 findings.
  const slice = await canon(item, { repo });
  await record({ name: 'cut-slice-postcondition', command: `canon-scan --root ${slice.root ?? root}`, cwd: slice.root ?? root,
    phase: 'parity', runner: 'parity', exitCode: slice.exitCode, output: slice.output ?? slice,
    summary: { status: slice.status, findings: slice.findings } });
  let owedAccepted = null;
  if (slice.exitCode === 1) {
    // Coordinator ruling (canon-parity-settle, owedToWire): findings left on owned paths pass only when EVERY one is
    // declared in report.owedToWire, maps to a queued/running canon-wire leg for its path, and was not introduced by
    // the slice (present at base). Anything else stays strict.
    const owed = await owedToWireAccept(item, slice, { root, base, ownedRels, wireLegs: wireLegs(), canonBase });
    if (!owed.ok) return hand('cut-postcondition-red', [`canon-scan ${slice.status ?? '?'} ${slice.findings ?? '?'} finding(s)`, `owedToWire: ${owed.why}`]);
    owedAccepted = owed;
  } else if (checkVerdictOf({ exitCode: slice.exitCode, status: slice.status }).verdict === 'unavailable') return unavailable('parity-checker-unavailable', `canon-scan ${slice.status ?? '?'}${slice.why ? ` ${slice.why}` : ''}`);
  else if (slice.exitCode !== 0) return hand('cut-postcondition-red', `canon-scan ${slice.status ?? '?'}${slice.findings != null ? ` ${slice.findings} finding(s)` : ''}${slice.why ? ` ${slice.why}` : ''}`);

  // (d) typecheck parity against the overlay base.
  const baseFiles = blobs(root, base, ownedRels);
  if (!baseFiles.ok) return hand('parity-base-unreadable', baseFiles.reason);
  let typed;
  try { typed = await tsc({ root, ownedRels, baseBlobs: baseFiles.blobs, extraProjects: declaredProjectsOf(covered.tsc, root) }); }
  catch (error) { typed = { ok: false, unavailable: String(error?.message ?? error) }; }
  await record({ name: PARITY_CHECKS.tsc, command: `typescript owned-file parity at ${base}`, cwd: root, phase: 'parity', runner: 'parity',
    exitCode: typed.ok ? 0 : typed.unavailable ? 127 : 1, output: typed,
    summary: { projects: typed.projects?.length ?? 0, newErrors: typed.newErrors?.length ?? null, unavailable: typed.unavailable ?? null } });
  if (typed.unavailable) return unavailable('parity-tsc-unavailable', typed.unavailable);
  if (!typed.ok) return hand('parity-tsc-new', typed.newErrors.slice(0, 8).map((e) => `${e.owned ? 'owned' : 'importer'} ${e.file} ${e.code} x${e.count - e.baseCount}: ${e.message}`), { tsc: typed });

  // (b) lint through the gate: no new finding over the owned files, and every tool ran.
  const files = ownedFilesOf(root, ownedRels);
  if (now() - started > settings.itemBudgetMs) return hand('verify-budget-exceeded', 'before the lint gate');
  const linted = await lint({ root, files, base });
  await record({ name: PARITY_CHECKS.lint, command: `gate.mjs lint --root ${root} --base ${base} --changed <${files.length} owned file(s)>`, cwd: root,
    phase: 'parity', runner: 'parity', exitCode: linted.ok ? 0 : linted.status === 'unavailable' ? 2 : 1, output: linted,
    summary: { status: linted.status, counts: linted.counts } });
  if (linted.status === 'unavailable') return unavailable('parity-checker-unavailable', `lint gate: ${(linted.gating ?? []).slice(0, 3).map(brief).join('; ')}`);
  if (!linted.ok) return hand('parity-lint-new', [`lint gate new=${linted.counts?.new ?? '?'} preexisting=${linted.counts?.preexisting ?? '?'} against ${base}`, ...(linted.gating ?? []).slice(0, 6).map(brief)], { lint: { ...linted, gating: (linted.gating ?? []).slice(0, 20) } });

  // git diff --check over the slice's diff (only when the worker declared one).
  let diffed = null;
  if (covered.diff.length) {
    diffed = diffCheck ? diffCheck({ root, base, ownedRels }) : (() => { const r = git(gitDiff, root, ['--check', base, '--', ...ownedRels]); return { ok: r.ok, tail: String(r.stdout ?? '').trim().split(/\r?\n/).slice(0, 3).join(' ') }; })();
    await record({ name: PARITY_CHECKS.diff, command: `git diff --check ${base} -- <owned paths>`, cwd: root,
      phase: 'parity', runner: 'parity', exitCode: diffed.ok ? 0 : 1, output: diffed,
      summary: { ok: diffed.ok, tail: diffed.tail ?? null } });
    if (!diffed.ok) return hand('parity-diff-check-red', diffed.tail ?? 'git diff --check reported whitespace/conflict errors in the slice diff');
  }

  const superseded = [...covered.canon, ...covered.lint, ...covered.tsc, ...covered.diff, ...covered.syntax].filter((c) => c?.exitCode !== 0).map((c) => `${c.name}:${c.exitCode}`);
  const tscLine = typed.projects.map((p) => `${p.project} ${p.errors} error(s) now / ${p.baseErrors} at base, 0 new`).join('; ') || typed.note;
  const lintLine = `lint gate ${linted.status}, new=${linted.counts?.new ?? 0} preexisting=${linted.counts?.preexisting ?? 0} against ${base}`;
  checks.push({ name: 'cut-slice-postcondition', exitCode: 0, command: `canon-scan (in-process) --root ${slice.root} over the slice's ${slice.paths} owned path(s)`,
    evidence: owedAccepted
      ? `runtime settler (canon parity): canon-scan ${slice.findings} finding(s) on the owned paths, every one declared owedToWire, held by canon-wire leg(s) ${owedAccepted.wires.join(', ')} and present at base ${base} (not introduced by the slice)`
      : `runtime settler (canon parity): canon-scan status ok, 0 findings on the slice's owned paths (families ${item.payload.params.canonFamilies})` });
  checks.push({ name: PARITY_CHECKS.lint, exitCode: 0, command: `gate.mjs lint (child) --root ${root} --base ${base} --changed <${files.length} owned file(s)>`,
    evidence: `runtime settler (canon parity): ${lintLine}` });
  checks.push({ name: PARITY_CHECKS.tsc, exitCode: 0, command: `typescript (in-process) owned files at ${base} vs working tree`, evidence: `runtime settler (canon parity): ${tscLine}` });
  if (diffed) checks.push({ name: PARITY_CHECKS.diff, exitCode: 0, command: `git diff --check ${base} -- <owned paths>`, evidence: 'runtime settler (canon parity): no whitespace/conflict error in the slice diff' });
  checks.push({ name: 'cut-regression-inventory', exitCode: 0, command: `canon parity: canon-scan + lint gate + typecheck over the owned paths vs ${base}`,
    evidence: `runtime settler (canon parity, contract change canon-parity-settle): no new finding and no new type error against the admission base; ${superseded.length ? `the worker's red declared check(s) ${superseded.join(', ')} are foreign residue outside the owned paths (superseded by the owned-scope measurements)` : 'no declared check was red'}${reruns.length ? `; ${reruns.length} runtime check(s) re-ran exit 0` : ''}` });
  return { green: true, via: 'canon-parity', checks: { checks }, parity: { base, ...(owedAccepted ? { owedToWire: { findings: slice.findings, wires: owedAccepted.wires } } : {}), lint: { status: linted.status, counts: linted.counts }, tsc: typed.projects, superseded } };
}

/** A path of a report or payload (maybe prefixed with the repository folder, e.g. shop-fe/apps/...) relative to root. */
const relOf = (p, root) => { const n = norm(p).replace(/\/+$/, ''); const head = path.basename(root); return n.startsWith(`${head}/`) ? n.slice(head.length + 1) : n; };

/**
 * The owedToWire acceptance of canon findings left on the owned paths. {ok, why?, wires?}. Every finding must be
 * (1) declared in report.owedToWire (its file sameOrUnder the entry's file/path, the ruleId equal when both name one),
 * (2) held by a canon-wire leg of the workflow that is queued or running and owns its path - or a queued leg, which
 * settle widens with the owed paths - and (3) present at base at least as often as now (canonBase at base).
 */
async function owedToWireAccept(item, slice, { root, base, ownedRels, wireLegs = [], canonBase = canonBaseFindings }) {
  const owed = Array.isArray(item.report?.owedToWire) ? item.report.owedToWire : [];
  const list = Array.isArray(slice.list) ? slice.list : [];
  if (!owed.length) return { ok: false, why: 'the report declares no owedToWire' };
  if (!list.length || list.length !== slice.findings) return { ok: false, why: 'the findings are not itemised' };
  const entries = owed.map((o) => ({ at: relOf(o.file ?? o.path, root), path: relOf(o.path, root), ruleId: o.ruleId ?? null }));
  const undeclared = list.filter((f) => !entries.some((e) => sameOrUnder(norm(f.file), e.at) && (!e.ruleId || !f.ruleId || e.ruleId === f.ruleId)));
  if (undeclared.length) return { ok: false, why: `${undeclared.length} finding(s) not declared: ${undeclared.slice(0, 3).map((f) => `${f.file} ${f.ruleId}`).join('; ')}` };
  const wires = wireLegs.filter((w) => ['queued', 'leased', 'running'].includes(w.status));
  if (!wires.length) return { ok: false, why: 'no canon-wire leg is queued or running' };
  const holders = new Set();
  for (const e of entries) {
    const w = wires.find((x) => x.ownedPaths.some((o) => sameOrUnder(e.path, relOf(o, root)) || sameOrUnder(relOf(o, root), e.path))) ?? wires.find((x) => x.status === 'queued');
    if (!w) return { ok: false, why: `no queued or running canon-wire leg holds ${e.path}` };
    holders.add(w.jobId);
  }
  const was = await canonBase({ root, base, ownedRels, families: String(item.payload.params?.canonFamilies ?? 'all') });
  if (!was.ok) return { ok: false, why: `base measurement unavailable: ${was.reason}` };
  const key = (f) => `${norm(f.file)} ${f.ruleId}`;
  const count = (xs) => xs.reduce((m, f) => m.set(key(f), (m.get(key(f)) ?? 0) + 1), new Map());
  const now = count(list), then = count(was.findings);
  const introduced = [...now].filter(([k, n]) => n > (then.get(k) ?? 0)).map(([k]) => k);
  if (introduced.length) return { ok: false, why: `introduced by the slice (absent at base): ${introduced.slice(0, 3).join('; ')}` };
  return { ok: true, wires: [...holders] };
}

/**
 * The canon findings of the owned paths AT BASE, read-only from git objects: ESLint over each owned file's base blob through
 * the checkout's own install and flat config (scripts/gates/gate.mjs baseEslintFindings) - no base tree, no worktree, no
 * link. {ok, findings: [{file, ruleId}]} or {ok: false, reason}.
 */
async function canonBaseFindings({ root, base, ownedRels }) {
  try {
    const blobs = baseBlobsOf(root, base, ownedRels);
    if (!blobs.ok) return { ok: false, reason: blobs.reason };
    const { baseEslintFindings } = await import('../../gates/gate.mjs');
    return { ok: true, findings: (await baseEslintFindings({ root, base, files: [...blobs.blobs.keys()] })).map((f) => ({ file: norm(f.file), ruleId: f.ruleId })) };
  } catch (error) { return { ok: false, reason: String(error?.message ?? error).slice(0, 200) }; }
}

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
      const bytes = Buffer.from(fs.readFileSync(path.join(where.root, rel)).toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
      frames.push(frame(rel), frame(bytes));
    }
  } catch { return null; }
  return sha256(Buffer.concat(frames));
}
// The lint child: node canon-parity.mjs --lint-child <job.json> -> one JSON line, runLintGate's result.
if (isMain(import.meta.url) && process.argv[2] === '--lint-child') {
  const job = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const { runLintGate } = await import('../../gates/gate.mjs');
  const out = await runLintGate({ root: job.root, base: job.base, files: job.files });
  process.stdout.write(`${JSON.stringify({ exit: out.exit, findings: out.findings.slice(0, 500), preexisting: out.preexisting, errors: out.errors })}\n`);
}
