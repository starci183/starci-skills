#!/usr/bin/env node
// gate.mjs - THE gate of a code-writing op and of the Kernel landing (schema starci/gate@1).
//
//   node scripts/checks/gate.mjs --root <app> [--base <commit>] [--main <ref>] [--changed <file>...] [--tests <pattern>] [--out <file>]
//
// An op forces it every round of its READ-CODE-CHECK-FIX-REPORT loop (knowledge/op-gate.yaml) and attaches the JSON it prints;
// `api settle` re-reads that JSON (scripts/kernel/gate-settle.mjs), and the Kernel's landing re-runs this script on the op branch
// against its base, so a branch green in the op is green at landing. Over the changed files of the app at --root:
//   1. `hfs lint --changed <files> --format json` at the app root (starci/lint@1: ESLint only on the changed files - the BE canon
//      under be/, the FE canon under fe/ - plus the repository checks on them);
//   2. before any tsc: the root `codegen` script and the build of every workspace package that exposes a `dist` export
//      (each skipped while its inputs are unchanged since its last run in this worktree);
//   3. tsc, one incremental program per tsconfig that owns a changed file (be/, each fe app or package), through the compiler
//      API, its buildinfo in this worktree's git dir; the worktree's own stale *.tsbuildinfo files are deleted first;
//   4. with --tests, the slice's unit/integration specs (jest --maxWorkers=2);
//   0. first, the INSTALLED CANON: for every profile of modules/models/code-patterns.yaml, the canon package its pin's side (be/, fe/)
//      resolves must carry the bound canon.version and canon.contentDigest (scripts/lib/canon-digest.mjs over the installed
//      files); a mismatch is a finding `canon/installed-canon-mismatch` (never preexisting), a canon that does not resolve is a
//      tool that could not run (exit 2, CANON_INSTALL_MISSING), never a pass;
//   0. then the MERGE GUARD: every merge commit in base..HEAD with one parent on the main line (--main, default main|master) is
//      recomputed with `git merge-tree`; a path main changed whose merged blob is the lane's (main's change dropped, merge
//      9958cce38) is a finding `merge/dropped-main-change`, never preexisting.
// Only NEW findings block: lint per (file, engine/rule) count and tsc per normalised message are compared with the base commit
// (--base, else the merge-base of HEAD with its upstream, else with main). The base is measured READ-ONLY from git objects: an
// ESLint lintText of the base blob, the repository checks over the base listing, and a TypeScript program whose host reads the
// changed files from the base. No worktree, no checkout and no junction is ever created for it (node_modules incident
// 2026-09-30). A finding the base already has is counted as preexisting, never a finding of the op. Failing specs always block.
// Exit 0 clean, 1 new findings, 2 a tool could not run (never a pass). stdout is the one JSON document.
//
//   node scripts/checks/gate.mjs --profile docs [--tree <app>/.starciwork] [--out <file>]
//
// The DOCUMENT profile (knowledge/op-gate.yaml docChecks, owed by docs.author, knowledge.repair and work.author): every document
// check runs from the runtime root - doc-language, check-work-surfaces, check-work-deep, check-example-work, check-contract-cites,
// check-json-exceptions - the `tree` ones over the Work root --tree names (else the runtime's examples). A check that exits 1 is a
// finding (engine doc, rule the check id, its refusal lines); any other exit is a tool that could not run. The report carries
// `profile: docs`; `api settle` refuses a documenting op's done on a red or unrunnable document gate.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runGit } from '../lib/git.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { lowerOwnPriority } from '../lib/low-priority.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { isMain, walkFiles } from './common.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { canonContentDigest, installedFiles } from '../lib/canon-digest.mjs';
import { PROFILES_FILE, loadPins } from './check-canon-pins.mjs';

export const GATE_SCHEMA = 'starci/gate@1';
export const LINT_SCHEMA = 'starci/lint@1';
export const GATE_EXIT = Object.freeze({ clean: 0, findings: 1, toolFailed: 2 });
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TS_SOURCE = /\.(?:[cm]?tsx?)$/;
const ESLINT_CONFIGS = ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'];
const JEST_CONFIGS = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'];
const LINT_CHUNK = 150;
const LISTED_MAX = 500;
const USAGE = 'usage: gate.mjs --root <app> [--base <commit>] [--main <ref>] [--changed <file>...] [--tests <pattern>] [--out <file>] | gate.mjs --profile docs [--tree <work root>] [--out <file>]';
export const DOC_PROFILE = 'docs';
export const GATE_PROFILES = Object.freeze(['code', DOC_PROFILE]);

/** The flags; `--changed` takes every argument up to the next flag (an empty list is an empty slice). */
export function parseGateArgs(argv) {
  const opts = { root: null, base: null, main: null, changed: null, tests: null, out: null, profile: 'code', tree: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--changed') {
      opts.changed = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.changed.push(argv[++i]);
    } else if (['--root', '--base', '--main', '--tests', '--out', '--profile', '--tree'].includes(arg)) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a value; ${USAGE}`);
      opts[arg.slice(2)] = argv[++i];
    } else throw new Error(`unknown argument ${arg}; ${USAGE}`);
  }
  if (!GATE_PROFILES.includes(opts.profile)) throw new Error(`--profile must be one of ${GATE_PROFILES.join(', ')}; ${USAGE}`);
  if (opts.tree && opts.profile !== DOC_PROFILE) throw new Error(`--tree belongs to --profile ${DOC_PROFILE}; ${USAGE}`);
  return opts;
}

const git = (root, args, options = {}) => runGit(['-c', 'core.quotepath=off', ...args], { cwd: root, maxBuffer: 256 * 1024 * 1024, ...options });
const gitText = (root, args) => { const r = git(root, args); return !r.error && r.status === 0 ? r.stdout : null; };
const lines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);

/** The base commit: --base verified as a commit, else the merge-base of HEAD with its upstream, main or master. */
export function resolveGateBase(root, base = null) {
  if (base) {
    const sha = gitText(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`])?.trim();
    if (!sha) throw Object.assign(new Error(`--base ${base} is not a commit of ${root}`), { code: 'GATE_BASE_UNKNOWN' });
    return sha;
  }
  for (const ref of ['@{upstream}', 'main', 'master', 'origin/HEAD']) {
    const sha = gitText(root, ['merge-base', 'HEAD', ref])?.trim();
    if (sha) return sha;
  }
  throw Object.assign(new Error(`no base: ${root} has no upstream, main or master to measure against; pass --base`), { code: 'GATE_BASE_UNKNOWN' });
}

/**
 * The delta between the base and the working tree, relative to --root: {changed[] (existing files), added Set, deleted Set,
 * renamed Map(new -> old)}. A rename's old path counts as deleted and its new path is measured against the old path's base
 * blob, so the findings a move carries stay preexisting; untracked files are additions.
 */
export function gateDelta(root, base) {
  const status = lines(gitText(root, ['diff', '--name-status', '--find-renames', '--relative', base]));
  const added = new Set(), deleted = new Set(), changed = new Set(), renamed = new Map();
  for (const row of status) {
    const [kind, file, to] = row.split('\t');
    const rel = posixPath(file);
    if (kind.startsWith('R')) { deleted.add(rel); changed.add(posixPath(to)); renamed.set(posixPath(to), rel); }
    else if (kind === 'D') deleted.add(rel);
    else { changed.add(rel); if (kind === 'A') added.add(rel); }
  }
  for (const file of lines(gitText(root, ['ls-files', '--others', '--exclude-standard']))) { const rel = posixPath(file); changed.add(rel); added.add(rel); }
  return { changed: [...changed].filter((file) => fs.existsSync(path.join(root, file))).sort(), added, deleted, renamed };
}
/** The base path a head path is measured against: its rename source, itself, or null when the base has no such file. */
const basePathOf = (delta, rel) => (delta.added.has(rel) ? null : delta.renamed.get(rel) ?? rel);

/** The base blob of a root-relative path, or null when the base has no such file. */
function baseBlobReader(root, base) {
  const prefix = (gitText(root, ['rev-parse', '--show-prefix']) ?? '').trim();
  const memo = new Map();
  return (rel) => {
    if (!memo.has(rel)) {
      const r = git(root, ['show', `${base}:${prefix}${rel}`], { encoding: 'buffer' });
      memo.set(rel, !r.error && r.status === 0 ? r.stdout.toString('utf8') : null);
    }
    return memo.get(rel);
  };
}

/** The cache directory of this worktree (its git dir, never the checkout) and the shared one of the repository. */
function cacheDirs(root) {
  const own = gitText(root, ['rev-parse', '--absolute-git-dir'])?.trim();
  const common = gitText(root, ['rev-parse', '--git-common-dir'])?.trim();
  if (!own || !common) throw Object.assign(new Error(`${root} is not inside a git repository`), { code: 'GATE_NOT_GIT' });
  const worktree = path.join(own, 'starci-gate');
  const shared = path.join(path.resolve(root, common), 'starci-gate');
  fs.mkdirSync(worktree, { recursive: true });
  fs.mkdirSync(shared, { recursive: true });
  return { worktree, shared };
}
const readCache = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const writeCache = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };

/* ----------------------------------------------------------------------------------------------- lint */

/** The `hfs` entry of the app's own install, else this runtime's packages/hfs. */
export function hfsEntry(root) {
  try {
    const manifest = createRequire(path.join(root, 'package.json')).resolve('@starci/hfs/package.json');
    const bin = JSON.parse(fs.readFileSync(manifest, 'utf8')).bin;
    return { dir: path.dirname(manifest), bin: path.join(path.dirname(manifest), typeof bin === 'string' ? bin : bin.hfs) };
  } catch {
    const dir = path.join(runtimeRoot, 'packages', 'hfs');
    return { dir, bin: path.join(dir, 'bin', 'hfs.mjs') };
  }
}

/** `hfs lint --changed` over the files, in chunks (the Windows command line); {findings, errors}. */
function runHfsLint(root, files, hfs) {
  const findings = [], errors = [], seen = new Set();
  for (let i = 0; i < files.length; i += LINT_CHUNK) {
    const chunk = files.slice(i, i + LINT_CHUNK);
    const run = spawnSync(process.execPath, [hfs.bin, 'lint', '--changed', ...chunk, '--format', 'json'], { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true });
    let report = null;
    try { report = JSON.parse(run.stdout); } catch { /* judged below */ }
    if (report?.schema !== LINT_SCHEMA) { errors.push(`hfs lint produced no ${LINT_SCHEMA} report (exit ${run.status}): ${String(run.stderr || run.stdout || run.error?.message || '').trim().split('\n')[0]}`); continue; }
    errors.push(...(report.errors ?? []).map((e) => `hfs lint: ${e}`));
    for (const finding of report.findings ?? []) {
      const id = JSON.stringify([finding.engine, finding.rule, finding.path, finding.line, finding.column, finding.message]);
      if (!seen.has(id)) { seen.add(id); findings.push(finding); }
    }
  }
  return { findings, errors };
}

export const lintKey = (finding) => `${posixPath(finding.path ?? '')}|${finding.engine}/${finding.rule}`;
const countBy = (items, key) => { const m = new Map(); for (const item of items) m.set(key(item), (m.get(key(item)) ?? 0) + 1); return m; };

/** Head lint findings minus the base's, per (file, engine/rule) count: {fresh[], preexisting}. */
export function newLintFindings(head, baseCounts) {
  const counts = countBy(head, lintKey);
  const grown = new Set([...counts].filter(([key, n]) => n > (baseCounts.get(key) ?? 0)).map(([key]) => key));
  const fresh = head.filter((finding) => grown.has(lintKey(finding)));
  return { fresh, preexisting: head.length - fresh.length };
}

const nearestWith = (root, file, names) => {
  let dir = path.dirname(path.join(root, file));
  for (;;) {
    if (names.some((name) => fs.existsSync(path.join(dir, name)))) return dir;
    if (path.resolve(dir) === path.resolve(root)) return null;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
};

/**
 * ESLint over base blobs, read-only: (basePath, headPath) -> the rule ids of the base blob of basePath linted as headPath through
 * the app's own install and the nearest flat config (null when the base has no such file). Cached per (base, paths, config).
 */
function baseEslint({ root, base, readBase, cache }) {
  const linters = new Map();
  return async (basePath, file) => {
    const cwd = nearestWith(root, file, ESLINT_CONFIGS) ?? root;
    const config = ESLINT_CONFIGS.map((name) => path.join(cwd, name)).find((p) => fs.existsSync(p));
    const cacheFile = path.join(cache.shared, 'eslint', sha256(`${base}\0${basePath}\0${file}\0${config ? fs.readFileSync(config, 'utf8') : ''}`) + '.json');
    let messages = readCache(cacheFile);
    if (!messages) {
      const text = readBase(basePath);
      if (text === null) return null;
      if (!linters.has(cwd)) {
        const require = createRequire(path.join(cwd, 'package.json'));
        const { ESLint } = await import(pathToFileURL(require.resolve('eslint')).href);
        linters.set(cwd, new ESLint({ cwd }));
      }
      const [result] = await linters.get(cwd).lintText(text, { filePath: path.join(root, file) });
      messages = (result?.messages ?? []).map((m) => m.ruleId ?? 'eslint-error');
      writeCache(cacheFile, messages);
    }
    return messages;
  };
}

/**
 * The ESLint findings of `files` (root-relative) at `base`, read-only from git objects (no tree, no worktree, no link):
 * [{file, ruleId}] - what scripts/reconcile/canon-parity.mjs compares a slice's remaining canon findings with.
 */
export async function baseEslintFindings({ root, base, files }) {
  root = path.resolve(root);
  const sha = resolveGateBase(root, base);
  const atBase = baseEslint({ root, base: sha, readBase: baseBlobReader(root, sha), cache: cacheDirs(root) });
  const out = [];
  for (const file of [...new Set(files.map(posixPath))]) for (const ruleId of (await atBase(file, file)) ?? []) out.push({ file, ruleId });
  return out;
}

/**
 * The base counts of the lint keys the head reports:ESLint over the base blob of each file (lintText through the app's
 * own install and the nearest flat config), the repository checks over the base listing. Nothing is written to the tree.
 */
async function lintBaseCounts({ root, base, head, delta, hfs, readBase, cache }) {
  const counts = new Map();
  const add = (key, n = 1) => counts.set(key, (counts.get(key) ?? 0) + n);
  const eslintFiles = [...new Set(head.filter((f) => f.engine === 'eslint' && f.path && basePathOf(delta, f.path)).map((f) => f.path))];
  const atBase = baseEslint({ root, base, readBase, cache });
  for (const file of eslintFiles) for (const rule of (await atBase(basePathOf(delta, file), file)) ?? []) add(`${file}|eslint/${rule}`);
  // The repository checks judge paths: over the base listing (the declaration and file contents are the head's) a finding
  // on a file's base path, or on no file, is the base's. A content finding on a changed file does not reproduce there.
  const headPathOf = new Map(head.filter((f) => f.engine === 'hfs' && f.path && basePathOf(delta, f.path)).map((f) => [basePathOf(delta, f.path), f.path]));
  if (headPathOf.size || head.some((f) => f.engine === 'hfs' && !f.path)) {
    const listing = lines(gitText(root, ['ls-tree', '-r', '--name-only', '--full-tree', base])).map(posixPath);
    const prefix = (gitText(root, ['rev-parse', '--show-prefix']) ?? '').trim();
    const files = listing.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length));
    const { checkRepo } = await import(pathToFileURL(path.join(hfs.dir, 'runtime', 'scripts', 'lib', 'hfs-check.mjs')).href);
    const result = checkRepo({ repoRoot: root, files, only: [...headPathOf.keys()], tree: false });
    for (const finding of result.findings.filter((f) => f.level === 'error')) {
      if (!finding.path) add(`|hfs/${finding.code}`);
      else if (headPathOf.has(posixPath(finding.path))) add(`${headPathOf.get(posixPath(finding.path))}|hfs/${finding.code}`);
    }
  }
  return counts;
}

/* ------------------------------------------------------------------------------------ codegen + build */

const npm = (cwd, script) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
const readManifest = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return null; } };
/** A stamp of what `paths` hold in this worktree: their index entries plus their uncommitted state. */
const inputStamp = (root, paths) => sha256(`${gitText(root, ['ls-files', '-s', '--', ...paths]) ?? ''}\0${gitText(root, ['status', '--porcelain', '--', ...paths]) ?? ''}`);
const exposesDist = (manifest) => /(^|\/)dist\//.test(JSON.stringify([manifest?.exports ?? null, manifest?.main ?? null, manifest?.types ?? null, manifest?.module ?? null]));

/** The workspace package directories of the root manifest (`dir/*` globs and plain paths). */
function workspaceDirs(root, manifest) {
  const globs = Array.isArray(manifest?.workspaces) ? manifest.workspaces : manifest?.workspaces?.packages ?? [];
  return globs.flatMap((glob) => {
    const clean = posixPath(glob).replace(/\/$/, '');
    if (!clean.endsWith('/*')) return fs.existsSync(path.join(root, clean, 'package.json')) ? [clean] : [];
    const parent = clean.slice(0, -2);
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, parent), { withFileTypes: true }); } catch { return []; }
    return entries.filter((e) => e.isDirectory() && fs.existsSync(path.join(root, parent, e.name, 'package.json'))).map((e) => `${parent}/${e.name}`);
  });
}

/** Root codegen, then every dist-exposing workspace package's build; each skipped while its inputs keep their stamp. */
function prepareTypes(root, cache) {
  const steps = { codegen: null, build: [] }, errors = [];
  const stamps = readCache(path.join(cache.worktree, 'stamps.json')) ?? {};
  const manifest = readManifest(root);
  if (manifest?.scripts?.codegen) {
    const inputs = fs.existsSync(path.join(root, 'be', 'contracts')) ? ['be/contracts'] : ['.'];
    const stamp = inputStamp(root, inputs);
    if (stamps.codegen === stamp) steps.codegen = { ran: false, reason: 'inputs unchanged' };
    else {
      const started = Date.now(), run = npm(root, 'codegen');
      steps.codegen = { ran: true, exit: run.status, ms: Date.now() - started };
      if (run.status === 0) stamps.codegen = stamp;
      else errors.push(`codegen could not run (exit ${run.status}): ${String(run.stderr || run.stdout || run.error?.message || '').trim().split('\n').slice(-1)[0]}`);
    }
  }
  for (const dir of workspaceDirs(root, manifest)) {
    const pkg = readManifest(path.join(root, dir));
    if (!exposesDist(pkg) || !pkg?.scripts?.build) continue;
    const stamp = inputStamp(root, [dir]), key = `build:${dir}`;
    if (stamps[key] === stamp && fs.existsSync(path.join(root, dir, 'dist'))) { steps.build.push({ package: pkg.name ?? dir, ran: false }); continue; }
    const started = Date.now(), run = npm(path.join(root, dir), 'build');
    steps.build.push({ package: pkg.name ?? dir, ran: true, exit: run.status, ms: Date.now() - started });
    if (run.status === 0) stamps[key] = stamp;
    else errors.push(`build of ${pkg.name ?? dir} could not run (exit ${run.status}): ${String(run.stderr || run.stdout || run.error?.message || '').trim().split('\n').slice(-1)[0]}`);
  }
  writeCache(path.join(cache.worktree, 'stamps.json'), stamps);
  return { steps, errors };
}

/* ------------------------------------------------------------------------------------------------ tsc */

/** The tsconfig.json nearest above each changed TypeScript file, root-relative. */
export function tsProjectsOf(root, files) {
  return [...new Set(files.filter((f) => TS_SOURCE.test(f)).map((f) => nearestWith(root, f, ['tsconfig.json'])).filter(Boolean)
    .map((dir) => posixPath(path.relative(root, path.join(dir, 'tsconfig.json')))))].sort();
}

/** The worktree's own *.tsbuildinfo files (outside node_modules and .git): stale ones report phantom errors. */
function removeStaleBuildInfo(root) {
  const files = walkFiles(root, { filter: (name) => name.endsWith('.tsbuildinfo'), exclude: (name, full, entry) => entry.isDirectory() && (name === 'node_modules' || name === '.git'), ignoreReadErrors: true });
  for (const file of files) fs.rmSync(file, { force: true });
  return files.map((file) => posixPath(path.relative(root, file)));
}

/** A diagnostic as {path, line, code, message, key}; the key drops the position and the absolute root. */
export function tscFinding(ts, diagnostic, root) {
  const rootPaths = [path.resolve(root), posixPath(path.resolve(root))];
  const scrub = (text) => rootPaths.reduce((acc, p) => acc.split(p).join('<ROOT>'), text);
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').split('\n')[0];
  const file = diagnostic.file ? posixPath(path.relative(root, diagnostic.file.fileName)) : null;
  const line = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : null;
  return { engine: 'tsc', rule: `TS${diagnostic.code}`, path: file, line, message, key: `${file ?? '-'}|TS${diagnostic.code}|${scrub(message).replace(/\s+/g, ' ').trim()}` };
}

const errorsOf = (ts, diagnostics, root) => diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error).map((d) => tscFinding(ts, d, root));
const programDiagnostics = (program) => [...program.getConfigFileParsingDiagnostics(), ...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()];
const NO_OUTPUT = { noEmit: true, composite: false, declaration: false, declarationMap: false, emitDeclarationOnly: false, sourceMap: false };

function loadTypeScript(root, project) {
  const require = createRequire(path.join(root, path.dirname(project), 'package.json'));
  return require(require.resolve('typescript'));
}

/** The head program of one project: incremental, its buildinfo in the worktree's git dir. */
function headTsc(ts, root, project, cache) {
  const configPath = path.join(root, project);
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  if (!parsed) throw new Error(`${project} could not be read`);
  const buildInfo = path.join(cache.worktree, 'tsbuildinfo', `${sha256(`${project}\0${ts.version}\0${fs.readFileSync(configPath, 'utf8')}`).slice(0, 24)}.tsbuildinfo`);
  fs.mkdirSync(path.dirname(buildInfo), { recursive: true });
  const options = { ...parsed.options, ...NO_OUTPUT, incremental: true, tsBuildInfoFile: buildInfo };
  const program = ts.createIncrementalProgram({ rootNames: parsed.fileNames, options, projectReferences: parsed.projectReferences, configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(parsed), host: ts.createIncrementalCompilerHost(options) });
  const findings = errorsOf(ts, programDiagnostics(program), root);
  program.emit();
  return findings;
}

/**
 * The base program of one project, read-only: a host whose files are the working tree's except every path the delta changed,
 * which reads its base blob (an added or renamed-to file does not exist, a deleted or renamed-from one comes back). A base
 * finding on a rename source is keyed at its new path. Cached per (base, project, renames).
 */
function baseTsc(ts, root, project, { base, delta, readBase, cache }) {
  const cacheFile = path.join(cache.shared, 'tsc', `${sha256(`${base}\0${project}\0${ts.version}\0${JSON.stringify([...delta.renamed])}`)}.json`);
  const cached = readCache(cacheFile);
  if (cached) return cached;
  const abs = (rel) => posixPath(path.resolve(root, rel));
  const overlay = new Map([...delta.changed, ...delta.deleted].map((rel) => [abs(rel), rel]));
  for (const rel of delta.added) overlay.set(abs(rel), rel);
  const absent = (rel) => delta.added.has(rel) || delta.renamed.has(rel);
  const read = (fileName) => {
    const rel = overlay.get(posixPath(path.resolve(fileName)));
    if (rel === undefined) return ts.sys.readFile(fileName);
    return absent(rel) ? undefined : readBase(rel) ?? undefined;
  };
  const exists = (fileName) => { const rel = overlay.get(posixPath(path.resolve(fileName))); return rel === undefined ? ts.sys.fileExists(fileName) : !absent(rel) && readBase(rel) !== null; };
  const deletedSources = [...delta.deleted].filter((rel) => TS_SOURCE.test(rel)).map((rel) => path.resolve(root, rel));
  const sys = { ...ts.sys, readFile: read, fileExists: exists, onUnRecoverableConfigFileDiagnostic: () => {},
    readDirectory: (dir, ext, exclude, include, depth) => [...ts.sys.readDirectory(dir, ext, exclude, include, depth).filter((f) => exists(f)),
      ...deletedSources.filter((f) => posixPath(f).startsWith(`${posixPath(path.resolve(dir))}/`))] };
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, project), {}, sys);
  if (!parsed) return writeBack(cacheFile, []);
  const options = { ...parsed.options, ...NO_OUTPUT, incremental: false };
  const host = ts.createCompilerHost(options);
  Object.assign(host, {
    readFile: read, fileExists: exists,
    getSourceFile: (fileName, languageVersion) => { const text = read(fileName); return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion); },
  });
  const program = ts.createProgram({ rootNames: [...new Set(parsed.fileNames)], options, projectReferences: parsed.projectReferences, host });
  const movedTo = new Map([...delta.renamed].map(([to, from]) => [from, to]));
  const moved = (finding) => (finding.path && movedTo.has(finding.path)
    ? { ...finding, path: movedTo.get(finding.path), key: `${movedTo.get(finding.path)}${finding.key.slice(finding.path.length)}` } : finding);
  return writeBack(cacheFile, errorsOf(ts, programDiagnostics(program), root).map(moved));
}
const writeBack = (file, value) => { writeCache(file, value); return value; };

/** Head tsc findings minus the base's, a multiset over normalised keys: {fresh[], preexisting}. */
export function newTscFindings(head, baseFindings) {
  const remaining = countBy(baseFindings, (f) => f.key);
  const fresh = head.filter((f) => { const n = remaining.get(f.key) ?? 0; if (n > 0) { remaining.set(f.key, n - 1); return false; } return true; });
  return { fresh, preexisting: head.length - fresh.length };
}

/* ---------------------------------------------------------------------------------------------- tests */

/** The slice's specs through the app's jest (--maxWorkers=2): {step, findings, error}. */
function runTests(root, pattern, cache) {
  const cwd = [root, path.join(root, 'be')].find((dir) => JEST_CONFIGS.some((name) => fs.existsSync(path.join(dir, name))) || readManifest(dir)?.jest) ?? root;
  let bin;
  try { bin = createRequire(path.join(cwd, 'package.json')).resolve('jest/bin/jest.js'); } catch { return { step: { pattern }, findings: [], error: `jest is not installed under ${posixPath(cwd)}` }; }
  const outputFile = path.join(cache.worktree, 'jest.json');
  fs.rmSync(outputFile, { force: true });
  const started = Date.now();
  const run = spawnSync(process.execPath, [bin, '--maxWorkers=2', '--ci', '--json', `--outputFile=${outputFile}`, pattern], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  const result = readCache(outputFile);
  if (!result) return { step: { pattern, exit: run.status }, findings: [], error: `jest produced no json result (exit ${run.status}): ${String(run.stderr || run.error?.message || '').trim().split('\n').slice(-1)[0]}` };
  const findings = [];
  for (const suite of result.testResults ?? []) {
    const file = posixPath(path.relative(root, suite.name ?? suite.testFilePath ?? ''));
    if (suite.testExecError || (suite.status === 'failed' && !(suite.assertionResults ?? []).some((a) => a.status === 'failed')))
      findings.push({ engine: 'test', rule: 'suite-failed', path: file, line: null, message: String(suite.testExecError?.message ?? suite.message ?? 'the suite failed to run').split('\n')[0] });
    for (const assertion of (suite.assertionResults ?? []).filter((a) => a.status === 'failed'))
      findings.push({ engine: 'test', rule: 'test-failed', path: file, line: assertion.location?.line ?? null, message: assertion.fullName ?? assertion.title });
  }
  if (!result.numTotalTests && !findings.length) findings.push({ engine: 'test', rule: 'no-test-matched', path: null, line: null, message: `no spec matched --tests ${pattern}` });
  return { step: { pattern, cwd: posixPath(path.relative(root, cwd)) || '.', exit: run.status, total: result.numTotalTests ?? 0, failed: result.numFailedTests ?? 0, ms: Date.now() - started }, findings, error: null };
}

/** The lint half: `hfs lint --changed` over the files, judged against the base. {step, fresh[], preexisting, errors[]} */
async function lintAgainstBase({ root, base, files, delta, hfs, readBase, cache }) {
  const lint = runHfsLint(root, files, hfs);
  const errors = [...lint.errors];
  let baseCounts = new Map();
  if (!errors.length && lint.findings.length) {
    try { baseCounts = await lintBaseCounts({ root, base, head: lint.findings, delta, hfs, readBase, cache }); }
    catch (error) { errors.push(`lint base could not be measured: ${String(error?.message ?? error).split('\n')[0]}`); }
  }
  const judged = newLintFindings(lint.findings, baseCounts);
  return { step: { files: files.length, findings: lint.findings.length, new: judged.fresh.length, preexisting: judged.preexisting },
    fresh: judged.fresh.map(({ engine, rule, path: file, line, message }) => ({ engine, rule, path: file, line, message })), preexisting: judged.preexisting, errors };
}

/**
 * The gate's lint half alone, for a caller that measures TypeScript itself (scripts/reconcile/canon-parity.mjs):
 * {exit, step, findings[] (new), preexisting, errors[]} over `files` against `base`, with the gate's exit codes.
 */
export async function runLintGate({ root, base, files, hfs = null }) {
  try {
    root = path.resolve(root);
    const sha = resolveGateBase(root, base);
    const lint = await lintAgainstBase({ root, base: sha, files, delta: gateDelta(root, sha), hfs: hfs ?? hfsEntry(root), readBase: baseBlobReader(root, sha), cache: cacheDirs(root) });
    return { exit: lint.errors.length ? GATE_EXIT.toolFailed : lint.fresh.length ? GATE_EXIT.findings : GATE_EXIT.clean, step: lint.step, findings: lint.fresh, preexisting: lint.preexisting, errors: lint.errors };
  } catch (error) {
    return { exit: GATE_EXIT.toolFailed, step: null, findings: [], preexisting: 0, errors: [String(error?.message ?? error)] };
  }
}

/* ------------------------------------------------------------------------------------------ merge guard */

const GUARD_CHUNK = 200;
/** {path -> blob} of `commit` over `paths` (ls-tree -z, chunked; a missing path has no entry). Full-tree, repository-relative. */
function blobsAt(root, commit, paths) {
  const out = new Map();
  for (let i = 0; i < paths.length; i += GUARD_CHUNK) {
    const text = gitText(root, ['ls-tree', '-r', '-z', '--full-tree', commit, '--', ...paths.slice(i, i + GUARD_CHUNK)]) ?? '';
    for (const row of text.split('\0').filter(Boolean)) { const [meta, file] = row.split('\t'); out.set(posixPath(file), meta.split(' ')[2]); }
  }
  return out;
}

/**
 * The main-side changes one merge commit dropped (owner 2026-10-01, merge 9958cce38 "merge main into lane/ut-int"): the merge
 * is recomputed with `git merge-tree --write-tree` from its lane parent and its main parent, and every path the main parent
 * changed since their merge-base (main's blob differs from the lane's) whose recorded blob in the merge is the LANE's - the
 * lane side taken over main, a clean hunk of main or a conflict resolved as "ours" alike - is a dropped main change. A path
 * where the merge kept main's blob, or wrote a third blob (a real resolution), is not. {merge, lane, main, conflicted[],
 * dropped: [{path, conflicted, main: blob|null, lane: blob|null}]}; throws when the commits cannot be read.
 */
export function droppedMainChanges(root, { merge, mainParent, laneParent }) {
  const mergeBase = gitText(root, ['merge-base', laneParent, mainParent])?.trim();
  if (!mergeBase) throw Object.assign(new Error(`merge ${merge}: its parents ${laneParent} and ${mainParent} have no merge-base`), { code: 'GATE_MERGE_UNREADABLE' });
  const remerge = git(root, ['merge-tree', '--write-tree', '--name-only', '--no-messages', laneParent, mainParent]);
  if (remerge.error || ![0, 1].includes(remerge.status)) throw Object.assign(new Error(`merge ${merge}: git merge-tree could not recompute it: ${String(remerge.stderr ?? remerge.error?.message ?? '').trim().split('\n')[0]}`), { code: 'GATE_MERGE_UNREADABLE' });
  const conflicted = lines(remerge.stdout).slice(1).map(posixPath);
  const touched = lines(gitText(root, ['diff', '--no-renames', '--name-only', mergeBase, mainParent])).map(posixPath);
  const main = blobsAt(root, mainParent, touched), lane = blobsAt(root, laneParent, touched), recorded = blobsAt(root, merge, touched);
  const conflicts = new Set(conflicted);
  const dropped = touched.filter((file) => (main.get(file) ?? null) !== (lane.get(file) ?? null) && (recorded.get(file) ?? null) === (lane.get(file) ?? null))
    .map((file) => ({ path: file, conflicted: conflicts.has(file), main: main.get(file) ?? null, lane: lane.get(file) ?? null }));
  return { merge, lane: laneParent, main: mainParent, mergeBase, conflicted, dropped };
}

/** The main line a merge is judged against: `main`, else `master`, else null (then no merge has a main side). */
export function mainTipOf(root, ref = null) {
  for (const name of ref ? [ref] : ['main', 'master']) { const sha = gitText(root, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`])?.trim(); if (sha) return sha; }
  return null;
}

/**
 * THE merge guard: every merge commit in base..head whose parents split into exactly one main-side parent (an ancestor of the
 * main tip) and a lane parent is recomputed (droppedMainChanges); a merge with dropped main changes is a finding (engine
 * `merge`, rule `dropped-main-change`, one per path), never preexisting. A merge of two lane parents, or of two main parents,
 * has no main side and is not judged. {checked: [sha], findings[], errors[]}
 */
export function mergeGuard(root, { base, head = 'HEAD', mainTip = mainTipOf(root) }) {
  const out = { checked: [], findings: [], errors: [] };
  if (!mainTip) return out;
  const merges = lines(gitText(root, ['rev-list', '--merges', '--parents', head, `^${base}`]));
  for (const row of merges) {
    const [merge, ...parents] = row.split(' ');
    const onMain = parents.filter((p) => git(root, ['merge-base', '--is-ancestor', p, mainTip]).status === 0);
    if (onMain.length !== 1 || parents.length !== 2) continue;
    const mainParent = onMain[0], laneParent = parents.find((p) => p !== mainParent);
    try {
      const judged = droppedMainChanges(root, { merge, mainParent, laneParent });
      out.checked.push(merge);
      for (const d of judged.dropped) out.findings.push({ engine: 'merge', rule: 'dropped-main-change', path: d.path, line: null,
        message: `merge ${merge.slice(0, 12)} keeps the lane side of ${d.path} over main's change (${d.conflicted ? 'a conflict resolved as the lane' : 'a clean main hunk dropped'}; main parent ${mainParent.slice(0, 12)}, recomputed with git merge-tree)` });
    } catch (error) { out.errors.push(String(error?.message ?? error)); }
  }
  return out;
}

/* ----------------------------------------------------------------------------------------- installed canon */

const INSTALL = Object.freeze({ missing: 'CANON_INSTALL_MISSING', mismatch: 'CANON_INSTALL_MISMATCH', unjudged: 'CANON_INSTALL_UNJUDGED' });

/** The installed root of package `name` as node resolves it from `directory` (its node_modules walk), or null. */
function installedPackageRoot(directory, name) {
  const searched = createRequire(path.join(directory, 'package.json')).resolve.paths(name) ?? [];
  for (const modules of searched) {
    const candidate = path.join(modules, ...name.split('/'));
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
  }
  return null;
}

/**
 * Every profile's canon as installed under the app at `root`, judged against its binding in `runtime`'s code-patterns.yaml:
 * the package resolved from the pin's side directory must have the bound version and content digest.
 * {checked: [{profile, package, side, path, version, digest, files}], findings[], errors[]}
 */
export function installedCanonFindings(root, { runtime = runtimeRoot } = {}) {
  const out = { checked: [], findings: [], errors: [] };
  let pins, profiles;
  try {
    pins = loadPins(runtime).pins ?? {};
    profiles = parseYaml(fs.readFileSync(path.join(runtime, PROFILES_FILE), 'utf8'))?.profiles ?? {};
  } catch (error) { out.errors.push(`${INSTALL.unjudged} the canon bindings are unreadable: ${error.message}`); return out; }
  for (const [profile, value] of Object.entries(profiles)) {
    const canon = value?.canon, side = pins[canon?.package]?.side;
    if (!canon?.package || typeof side !== 'string') { out.errors.push(`${INSTALL.unjudged} profile ${profile}: canon.package ${canon?.package} has no pinned side`); continue; }
    const installed = installedPackageRoot(path.join(root, side), canon.package);
    if (!installed) { out.errors.push(`${INSTALL.missing} profile ${profile}: ${canon.package} does not resolve from ${side}/ of the app; install the pinned ${canon.version}`); continue; }
    const where = posixPath(path.relative(root, installed));
    let version, digest;
    try {
      version = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8')).version ?? null;
      digest = canonContentDigest(installed, canon.contentDigest, installedFiles(installed));
    } catch (error) { out.errors.push(`${INSTALL.unjudged} profile ${profile}: ${error.code ?? 'ERROR'} ${error.message}`); continue; }
    out.checked.push({ profile, package: canon.package, side, path: where, version, digest: digest.value, files: digest.files });
    if (version !== canon.version || digest.value !== canon.contentDigest.value || digest.files !== canon.contentDigest.files) {
      out.findings.push({ engine: 'canon', rule: 'installed-canon-mismatch', path: where, line: null,
        message: `${canon.package} installed for ${side}/ is ${version} with ${digest.files} files digesting ${digest.value}; profile ${profile} binds ${canon.version} with ${canon.contentDigest.files} files digesting ${canon.contentDigest.value} (${INSTALL.mismatch}: reinstall the pinned version from the registry)` });
    }
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- gate */

/**
 * Run the gate; resolves the starci/gate@1 report. Never throws for a tool failure: it lands in errors[] with exit 2.
 * Spec seams: `hfs` ({dir, bin}) the hfs install to lint with, default hfsEntry(root); `ts` the TypeScript module, default
 * the app's own install per project.
 */
export async function runGate({ root, base = null, changed = null, tests = null, main = null, hfs = null, ts: typescript = null }) {
  const at = new Date().toISOString();
  const report = { schema: GATE_SCHEMA, at, root: posixPath(path.resolve(root)), base: null, head: null, dirty: null, changed: [], exit: GATE_EXIT.toolFailed, ok: false,
    steps: { canon: null, merges: null, lint: null, codegen: null, build: [], tsc: [], tests: null, staleBuildInfo: [] }, counts: { new: 0, preexisting: 0 }, findings: [], errors: [] };
  const fail = (error) => { report.errors.push(String(error?.message ?? error)); return finish(report); };
  let cache, delta;
  try {
    root = path.resolve(root);
    report.base = resolveGateBase(root, base);
    report.head = gitText(root, ['rev-parse', 'HEAD'])?.trim() ?? null;
    report.dirty = Boolean((gitText(root, ['status', '--porcelain']) ?? '').trim());
    cache = cacheDirs(root);
    delta = gateDelta(root, report.base);
  } catch (error) { return fail(error); }
  const asked = changed === null ? delta.changed : changed.map((file) => posixPath(path.isAbsolute(file) ? path.relative(root, file) : file));
  report.changed = [...new Set(asked)].filter((file) => fs.existsSync(path.join(root, file))).sort();
  const readBase = baseBlobReader(root, report.base);
  const fresh = [];
  let preexisting = 0;

  // The installed canon: the lint below means nothing over a canon that is not the bound one.
  const installed = installedCanonFindings(root);
  report.steps.canon = installed.checked;
  report.errors.push(...installed.errors);
  fresh.push(...installed.findings);

  // The merge guard first: a merge in base..HEAD that took the lane side over a main-side change is never a clean branch.
  const guard = mergeGuard(root, { base: report.base, mainTip: mainTipOf(root, main) });
  report.steps.merges = { checked: guard.checked, dropped: guard.findings.length };
  report.errors.push(...guard.errors);
  fresh.push(...guard.findings);

  if (report.changed.length) {
    const lint = await lintAgainstBase({ root, base: report.base, files: report.changed, delta, hfs: hfs ?? hfsEntry(root), readBase, cache });
    report.errors.push(...lint.errors);
    report.steps.lint = lint.step;
    fresh.push(...lint.fresh);
    preexisting += lint.preexisting;
  }

  const projects = tsProjectsOf(root, report.changed);
  if (projects.length) {
    report.steps.staleBuildInfo = removeStaleBuildInfo(root);
    const prepared = prepareTypes(root, cache);
    report.steps.codegen = prepared.steps.codegen;
    report.steps.build = prepared.steps.build;
    report.errors.push(...prepared.errors);
    if (!prepared.errors.length) for (const project of projects) {
      const started = Date.now();
      try {
        const ts = typescript ?? loadTypeScript(root, project);
        const head = headTsc(ts, root, project, cache);
        const baseFindings = head.length ? baseTsc(ts, root, project, { base: report.base, delta, readBase, cache }) : [];
        const judged = newTscFindings(head, baseFindings);
        report.steps.tsc.push({ project, errors: head.length, new: judged.fresh.length, preexisting: judged.preexisting, ms: Date.now() - started });
        fresh.push(...judged.fresh.map(({ key, ...finding }) => finding));
        preexisting += judged.preexisting;
      } catch (error) { report.errors.push(`tsc could not run on ${project}: ${String(error?.message ?? error).split('\n')[0]}`); }
    }
  }

  if (tests) {
    const tested = runTests(root, tests, cache);
    report.steps.tests = tested.step;
    if (tested.error) report.errors.push(tested.error);
    fresh.push(...tested.findings);
  }

  report.counts = { new: fresh.length, preexisting };
  report.findings = fresh.slice(0, LISTED_MAX);
  return finish(report);
}

function finish(report) {
  report.exit = report.errors.length ? GATE_EXIT.toolFailed : report.counts.new ? GATE_EXIT.findings : GATE_EXIT.clean;
  report.ok = report.exit === GATE_EXIT.clean;
  return report;
}

/** The document checks of op-gate.yaml docChecks: [{id, script, tree}]. */
export function docChecksOf(runtime = runtimeRoot) {
  const doc = parseYaml(fs.readFileSync(path.join(runtime, 'knowledge', 'op-gate.yaml'), 'utf8'));
  return (doc?.docChecks ?? []).map((c) => ({ id: String(c.id), script: String(c.script), tree: c.tree === true }));
}

const DOC_PATH = /^(?:REFUSED?\s+)?([^\s:]+\.(?:md|ya?ml|mjs|json)):(\d+)/;
/** The lines a document check prints for its refusals: REFUSE/REFUSED or file:line lines when it has them, else its last lines. */
function refusalLines(output) {
  const all = String(output ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const refused = all.filter((l) => /^REFUSED?\b/.test(l) || DOC_PATH.test(l));
  return (refused.length ? refused : all.slice(-5)).slice(0, 50);
}

/**
 * The document profile: each docChecks script run from the runtime root (`tree` ones with --tree when given). Exit 1 of a check
 * is its findings, any other exit (or a spawn error) a tool that could not run. The same starci/gate@1 envelope, profile docs.
 */
export function runDocGate({ tree = null, runtime = runtimeRoot, checks = docChecksOf(runtime), spawn = spawnSync } = {}) {
  const report = { schema: GATE_SCHEMA, profile: DOC_PROFILE, at: new Date().toISOString(), root: posixPath(path.resolve(runtime)), tree: tree ? posixPath(path.resolve(tree)) : null,
    base: null, head: gitText(runtime, ['rev-parse', 'HEAD'])?.trim() ?? null, changed: [], exit: GATE_EXIT.toolFailed, ok: false,
    steps: { docs: [] }, counts: { new: 0, preexisting: 0 }, findings: [], errors: [] };
  if (tree && !fs.existsSync(path.resolve(tree))) { report.errors.push(`--tree ${tree} does not exist`); return finish(report); }
  if (!checks.length) { report.errors.push('knowledge/op-gate.yaml names no docChecks'); return finish(report); }
  const fresh = [];
  for (const check of checks) {
    const args = [path.join(runtime, check.script), ...(check.tree && tree ? ['--tree', path.resolve(tree)] : [])];
    const started = Date.now();
    const run = spawn(process.execPath, args, { cwd: runtime, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
    report.steps.docs.push({ id: check.id, command: `node ${check.script}${check.tree && tree ? ' --tree <tree>' : ''}`, exit: run.status ?? null, ms: Date.now() - started });
    // An uncaught exception also exits 1: a stack trace on stderr is a check that could not run, never its findings.
    const crashed = run.status === 1 && /^\s+at .+[:(]\d+:\d+\)?$/m.test(String(run.stderr ?? ''));
    if (run.error || crashed || (run.status !== 0 && run.status !== 1)) {
      const reason = String(run.stderr ?? '').split(/\r?\n/).find((l) => /Error/.test(l))?.trim() ?? '';
      report.errors.push(`${check.id} could not run (exit ${run.status ?? run.error?.message})${reason ? `: ${reason}` : ''}`);
      continue;
    }
    if (run.status === 1) {
      for (const message of refusalLines(`${run.stdout ?? ''}\n${run.stderr ?? ''}`)) {
        const at = DOC_PATH.exec(message);
        fresh.push({ engine: 'doc', rule: check.id, path: at?.[1] ?? null, line: at ? Number(at[2]) : null, message });
      }
    }
  }
  report.counts = { new: fresh.length, preexisting: 0 };
  report.findings = fresh.slice(0, LISTED_MAX);
  return finish(report);
}

export async function gateMain(argv, { stdout = (s) => process.stdout.write(s) } = {}) {
  let opts;
  try { opts = parseGateArgs(argv); } catch (error) { stdout(`${JSON.stringify({ schema: GATE_SCHEMA, ok: false, exit: GATE_EXIT.toolFailed, errors: [error.message] })}\n`); return GATE_EXIT.toolFailed; }
  const report = opts.profile === DOC_PROFILE ? runDocGate({ tree: opts.tree })
    : await runGate({ root: opts.root ?? process.cwd(), base: opts.base, main: opts.main, changed: opts.changed, tests: opts.tests });
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
  stdout(text);
  return report.exit;
}

if (isMain(import.meta.url)) {
  lowerOwnPriority();
  process.exitCode = await gateMain(process.argv.slice(2));
}
