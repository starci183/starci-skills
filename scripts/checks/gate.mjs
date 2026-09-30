#!/usr/bin/env node
// gate.mjs - THE gate of a code-writing op and of the Kernel landing (schema starci/gate@1).
//
//   node scripts/checks/gate.mjs --root <app> [--base <commit>] [--changed <file>...] [--tests <pattern>] [--out <file>]
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
//   4. with --tests, the slice's unit/integration specs (jest --maxWorkers=2).
// Only NEW findings block: lint per (file, engine/rule) count and tsc per normalised message are compared with the base commit
// (--base, else the merge-base of HEAD with its upstream, else with main). The base is measured READ-ONLY from git objects: an
// ESLint lintText of the base blob, the repository checks over the base listing, and a TypeScript program whose host reads the
// changed files from the base. No worktree, no checkout and no junction is ever created for it (node_modules incident
// 2026-09-30). A finding the base already has is counted as preexisting, never a finding of the op. Failing specs always block.
// Exit 0 clean, 1 new findings, 2 a tool could not run (never a pass). stdout is the one JSON document.
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

export const GATE_SCHEMA = 'starci/gate@1';
export const LINT_SCHEMA = 'starci/lint@1';
export const GATE_EXIT = Object.freeze({ clean: 0, findings: 1, toolFailed: 2 });
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TS_SOURCE = /\.(?:[cm]?tsx?)$/;
const ESLINT_CONFIGS = ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'];
const JEST_CONFIGS = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'];
const LINT_CHUNK = 150;
const LISTED_MAX = 500;
const USAGE = 'usage: gate.mjs --root <app> [--base <commit>] [--changed <file>...] [--tests <pattern>] [--out <file>]';

/** The flags; `--changed` takes every argument up to the next flag (an empty list is an empty slice). */
export function parseGateArgs(argv) {
  const opts = { root: null, base: null, changed: null, tests: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--changed') {
      opts.changed = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.changed.push(argv[++i]);
    } else if (['--root', '--base', '--tests', '--out'].includes(arg)) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a value; ${USAGE}`);
      opts[arg.slice(2)] = argv[++i];
    } else throw new Error(`unknown argument ${arg}; ${USAGE}`);
  }
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
 * The delta between the base and the working tree, relative to --root: {changed[] (existing files), added Set, deleted Set}.
 * Renames are split into a deletion and an addition, and untracked files are additions.
 */
export function gateDelta(root, base) {
  const status = lines(gitText(root, ['diff', '--name-status', '--no-renames', '--relative', base]));
  const added = new Set(), deleted = new Set(), changed = new Set();
  for (const row of status) {
    const [kind, file] = row.split('\t');
    const rel = posixPath(file);
    if (kind === 'D') deleted.add(rel);
    else { changed.add(rel); if (kind === 'A') added.add(rel); }
  }
  for (const file of lines(gitText(root, ['ls-files', '--others', '--exclude-standard']))) { const rel = posixPath(file); changed.add(rel); added.add(rel); }
  return { changed: [...changed].filter((file) => fs.existsSync(path.join(root, file))).sort(), added, deleted };
}

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
 * The base counts of the lint keys the head reports: ESLint over the base blob of each file (lintText through the app's
 * own install and the nearest flat config), the repository checks over the base listing. Nothing is written to the tree.
 */
async function lintBaseCounts({ root, base, head, delta, hfs, readBase, cache }) {
  const counts = new Map();
  const add = (key, n = 1) => counts.set(key, (counts.get(key) ?? 0) + n);
  const eslintFiles = [...new Set(head.filter((f) => f.engine === 'eslint' && f.path && !delta.added.has(f.path)).map((f) => f.path))];
  const linters = new Map();
  for (const file of eslintFiles) {
    const cacheFile = path.join(cache.shared, 'eslint', sha256(`${base}\0${file}`) + '.json');
    let messages = readCache(cacheFile);
    if (!messages) {
      const text = readBase(file);
      if (text === null) continue;
      const cwd = nearestWith(root, file, ESLINT_CONFIGS) ?? root;
      if (!linters.has(cwd)) {
        const require = createRequire(path.join(cwd, 'package.json'));
        const { ESLint } = await import(pathToFileURL(require.resolve('eslint')).href);
        linters.set(cwd, new ESLint({ cwd }));
      }
      const [result] = await linters.get(cwd).lintText(text, { filePath: path.join(root, file) });
      messages = (result?.messages ?? []).map((m) => m.ruleId ?? 'eslint-error');
      writeCache(cacheFile, messages);
    }
    for (const rule of messages) add(`${file}|eslint/${rule}`);
  }
  const hfsFiles = [...new Set(head.filter((f) => f.engine === 'hfs' && f.path && !delta.added.has(f.path)).map((f) => f.path))];
  if (hfsFiles.length) {
    const listing = lines(gitText(root, ['ls-tree', '-r', '--name-only', '--full-tree', base])).map(posixPath);
    const prefix = (gitText(root, ['rev-parse', '--show-prefix']) ?? '').trim();
    const files = listing.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length));
    const { checkRepo } = await import(pathToFileURL(path.join(hfs.dir, 'runtime', 'scripts', 'lib', 'hfs-check.mjs')).href);
    const result = checkRepo({ repoRoot: root, files, only: hfsFiles, tree: false });
    for (const finding of result.findings.filter((f) => f.level === 'error' && f.path)) add(`${posixPath(finding.path)}|hfs/${finding.code}`);
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
 * which reads its base blob (an added file does not exist, a deleted one comes back). Cached per (base, project).
 */
function baseTsc(ts, root, project, { base, delta, readBase, cache }) {
  const cacheFile = path.join(cache.shared, 'tsc', `${sha256(`${base}\0${project}\0${ts.version}`)}.json`);
  const cached = readCache(cacheFile);
  if (cached) return cached;
  const abs = (rel) => posixPath(path.resolve(root, rel));
  const overlay = new Map([...delta.changed, ...delta.deleted].map((rel) => [abs(rel), rel]));
  for (const rel of delta.added) overlay.set(abs(rel), rel);
  const read = (fileName) => {
    const rel = overlay.get(posixPath(path.resolve(fileName)));
    if (rel === undefined) return ts.sys.readFile(fileName);
    return delta.added.has(rel) ? undefined : readBase(rel) ?? undefined;
  };
  const exists = (fileName) => { const rel = overlay.get(posixPath(path.resolve(fileName))); return rel === undefined ? ts.sys.fileExists(fileName) : !delta.added.has(rel) && readBase(rel) !== null; };
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
  return writeBack(cacheFile, errorsOf(ts, programDiagnostics(program), root));
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

/* ----------------------------------------------------------------------------------------------- gate */

/**
 * Run the gate; resolves the starci/gate@1 report. Never throws for a tool failure: it lands in errors[] with exit 2.
 * `hfs` ({dir, bin}) is a spec seam: the hfs install to lint with, default hfsEntry(root).
 */
export async function runGate({ root, base = null, changed = null, tests = null, hfs = null }) {
  const at = new Date().toISOString();
  const report = { schema: GATE_SCHEMA, at, root: posixPath(path.resolve(root)), base: null, head: null, dirty: null, changed: [], exit: GATE_EXIT.toolFailed, ok: false,
    steps: { lint: null, codegen: null, build: [], tsc: [], tests: null, staleBuildInfo: [] }, counts: { new: 0, preexisting: 0 }, findings: [], errors: [] };
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

  if (report.changed.length) {
    hfs ??= hfsEntry(root);
    const lint = runHfsLint(root, report.changed, hfs);
    report.errors.push(...lint.errors);
    let baseCounts = new Map();
    if (!lint.errors.length && lint.findings.length) {
      try { baseCounts = await lintBaseCounts({ root, base: report.base, head: lint.findings, delta, hfs, readBase, cache }); }
      catch (error) { report.errors.push(`lint base could not be measured: ${String(error?.message ?? error).split('\n')[0]}`); }
    }
    const judged = newLintFindings(lint.findings, baseCounts);
    report.steps.lint = { files: report.changed.length, findings: lint.findings.length, new: judged.fresh.length, preexisting: judged.preexisting };
    fresh.push(...judged.fresh.map(({ engine, rule, path: file, line, message }) => ({ engine, rule, path: file, line, message })));
    preexisting += judged.preexisting;
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
        const ts = loadTypeScript(root, project);
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

export async function gateMain(argv, { stdout = (s) => process.stdout.write(s) } = {}) {
  let opts;
  try { opts = parseGateArgs(argv); } catch (error) { stdout(`${JSON.stringify({ schema: GATE_SCHEMA, ok: false, exit: GATE_EXIT.toolFailed, errors: [error.message] })}\n`); return GATE_EXIT.toolFailed; }
  const report = await runGate({ root: opts.root ?? process.cwd(), base: opts.base, changed: opts.changed, tests: opts.tests });
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
  stdout(text);
  return report.exit;
}

if (isMain(import.meta.url)) {
  lowerOwnPriority();
  process.exitCode = await gateMain(process.argv.slice(2));
}
