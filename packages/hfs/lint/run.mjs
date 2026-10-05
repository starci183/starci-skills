// starci app lint - the ONE lint entry and the ONE report of a StarCi app.
//
//   starci app lint [--cwd <dir>] [--changed <file>...] [--workspace <dir>] [--fix] [--format text|json] [--sonar <file>]
//
// It runs at the app root (the folder of hfs.json), over the app (or over the app-relative files named by --changed):
//   1. ESLint once per side, from the side folder, through the app's own install and that side's eslint.config.mjs (be/ the be canon,
//      fe/ the fe canon: the per-file rules and the project-graph rules of the architecture machine, findings on the line of the
//      offending TypeScript file); each side lints only its own files, so the be rules never see fe/ and the fe rules never see be/;
//   2. `starci app check` for what has no TypeScript file to sit on (the tree, managed files, pins, CI, contracts, docs, .starciwork), root and sides;
//   3. stylelint over the fe side's stylesheets (sync STYLE_GLOB), from fe/ with its stylelint.config.mjs.
// Their findings become one list of one shape (`starci/lint@1`), every path app-relative. `--format json` prints that report on stdout;
// `--sonar <file>` writes the same findings as THE Sonar Generic Issue Import file (engine ids starci-hfs, eslint, stylelint in one
// document); the exit code is the land-gate input: 0 no finding, 1 at least one, 2 a tool could not run (never a pass).
// --changed restricts ESLint and stylelint to the listed files and keeps of the app findings only those on a listed file or on no file.
// --workspace scopes the same lint to one npm workspace of the fe side (fe/apps/<app> or fe/packages/<pkg>, app-relative): ESLint and
// stylelint over that folder only, and of the app findings only those inside it. It is the `lint` script of every fe workspace (the
// turbo `lint` task); the root `npm run lint` stays the whole app. There is no second linter: a workspace lint is this lint, scoped.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { linterReport, mergeReports, sonarReport, sourceRootsOf } from '../report/sonar.mjs';
import { SIDES, appRelativeMessages, loadSlotManifest, readRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';
import { STYLE_GLOB } from '../sync/index.mjs';
import { braceVariants, globExpression } from '../runtime/scripts/lib/glob.mjs';

export const LINT_SCHEMA = 'starci/lint@1';
/** The side whose stylesheets stylelint judges. */
const STYLE_SIDE = 'fe';
const CODE_PREFIX = /^\[([A-Z][A-Z0-9_]+)\] /;
const posix = (file) => String(file).replace(/\\/g, '/').replace(/^\.\//, '');
/** An npm workspace of the fe side, app-relative: one folder below fe/apps or fe/packages (the root package.json workspaces). */
const WORKSPACE = /^fe\/(?:apps|packages)\/[a-z0-9][a-z0-9-]*$/;

/** The app-relative workspace of `opts.workspace` (already app-relative), or a refusal when it is not one folder of fe/apps or fe/packages. */
export function workspaceOf(workspace) {
  const rel = posix(workspace).replace(/\/+$/, '');
  if (!WORKSPACE.test(rel)) throw new Error(`--workspace ${workspace} is not an fe workspace (fe/apps/<app> or fe/packages/<pkg>, from the app root)`);
  return rel;
}

/** The flags of `starci app lint`; `--changed` takes every argument up to the next flag, and a repeated `--changed` adds to the list (the
 *  catalog's list flag, `--changed a --changed b`, as the CLI dispatcher passes it through). */
export function parseLintArgs(argv) {
  const opts = { changed: null, fix: false, format: 'text', sonar: undefined, workspace: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--changed') {
      opts.changed ??= [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.changed.push(posix(argv[++i]));
    } else if (arg === '--fix') opts.fix = true;
    else if (arg === '--json') opts.format = 'json';
    else if (['--format', '--sonar', '--workspace'].includes(arg)) {
      if (argv[i + 1] === undefined) throw new Error(`${arg} needs a value`);
      opts[arg.slice(2)] = argv[++i];
    } else throw new Error(`unknown argument ${arg}`);
  }
  if (!['text', 'json'].includes(opts.format)) throw new Error('--format is text or json');
  if (opts.workspace !== undefined && opts.changed !== null) throw new Error('--workspace and --changed do not combine: a workspace lint judges the whole workspace');
  return opts;
}

/** The typed ESLint run reads nothing above the app root: its TypeScript `sys` is bound by this preload (3.3, bound-sys.cjs). */
export const BOUND_ENV = 'STARCI_LINT_BOUND';
export const linterBoundArgs = () => ['--require', fileURLToPath(new URL('./bound-sys.cjs', import.meta.url))];

/** A linter's json results through the app's own install, run from `cwd` (a side folder): `{ results }` or `{ error }`. */
function runLinter({ cwd, pkg, bin, args, bound = null }) {
  let entry;
  try {
    const manifest = createRequire(path.join(cwd, 'package.json')).resolve(`${pkg}/package.json`);
    const declared = JSON.parse(fs.readFileSync(manifest, 'utf8')).bin;
    entry = path.join(path.dirname(manifest), typeof declared === 'string' ? declared : declared[bin]);
  } catch {
    return { error: `${pkg} is not installed for ${cwd}` };
  }
  const run = spawnSync(process.execPath, [...(bound ? linterBoundArgs() : []), entry, ...args], { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...(bound ? { env: { ...process.env, [BOUND_ENV]: bound } } : {}) });
  // ESLint prints its report on stdout; stylelint uses stderr. JSON does not prove a completed child: only exits 0/1
  // without a spawn error or signal are measurable, and exit 1 must carry findings.
  let results;
  try { results = JSON.parse(run.stdout.trim() || run.stderr); } catch { return { error: `${pkg} produced no json report in ${path.basename(cwd)}/ (exit ${run.status}): ${String(run.stderr || run.stdout).trim().split('\n')[0]}` }; }
  if (!Array.isArray(results)) return { error: `${pkg} produced a report that is not a result list` };
  const completed = !run.error && !run.signal && [0, 1].includes(run.status)
    && (run.status === 0 || results.some((result) => result?.messages?.length || result?.warnings?.length));
  return { results, ...(completed ? {} : { error: `${pkg} could not complete in ${path.basename(cwd)}/ (exit ${run.status}, signal ${run.signal ?? 'none'}): ${String(run.error?.message || run.stderr || run.stdout || '').trim().split('\n')[0]}` }) };
}

const eslintFindings = (results, appRoot) => results.flatMap((result) => (result.messages ?? []).map((message) => ({
  engine: 'eslint', rule: message.ruleId ?? 'eslint-error', code: CODE_PREFIX.exec(message.message ?? '')?.[1] ?? null, severity: 'error',
  path: posix(path.relative(appRoot, result.filePath)), line: message.line ?? null, column: message.column ?? null, message: message.message,
})));

const stylelintFindings = (results, appRoot) => results.flatMap((result) => (result.warnings ?? []).map((warning) => ({
  engine: 'stylelint', rule: warning.rule || 'stylelint-error', code: null, severity: 'error',
  path: posix(path.relative(appRoot, result.source)), line: warning.line ?? null, column: warning.column ?? null, message: warning.text,
})));

const byLocation = (a, b) => `${a.path ?? ''}:${String(a.line ?? 0).padStart(7, '0')}:${a.rule}`.localeCompare(`${b.path ?? ''}:${String(b.line ?? 0).padStart(7, '0')}:${b.rule}`);

/** The files of `changed` (app-relative) below `side`/, relative to the side folder. */
const onSide = (changed, side) => changed.filter((file) => file.startsWith(`${side}/`)).map((file) => file.slice(side.length + 1));

const fileKey = (file) => process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file);
const inside = (root, file) => { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };

/** Read the installed canon's source selectors, then enumerate that scope; unavailable or unsupported selectors cannot prove coverage. */
async function sourceFiles({ repoRoot, cwd, side, scope }) {
  const entry = createRequire(path.join(cwd, 'package.json')).resolve(`@starci/eslint-canon-${side}`);
  if (!inside(fs.realpathSync(repoRoot), fs.realpathSync(entry))) throw new Error('the installed canon is outside the app root');
  const canon = await import(pathToFileURL(entry).href);
  const factory = side === 'be' ? canon.starciBeConfig : canon.starciFeConfig;
  if (typeof factory !== 'function' || typeof canon.loadHfs !== 'function') throw new Error('the installed canon has no supported config factory');
  const config = await factory({ hfs: canon.loadHfs(pathToFileURL(path.join(cwd, 'eslint.config.mjs')).href) });
  if (!Array.isArray(config)) throw new Error('the installed canon did not return a flat config');
  const selectors = [], ignored = [];
  for (const block of config) {
    if (!block || typeof block !== 'object') throw new Error('the installed canon returned an invalid config block');
    for (const [field, target] of [['files', selectors], ['ignores', ignored]]) {
      if (block[field] === undefined) continue;
      if (!Array.isArray(block[field]) || block[field].some((glob) => typeof glob !== 'string' || glob.startsWith('!'))) throw new Error(`unsupported canon ${field} selectors`);
      if (field === 'ignores' && Object.keys(block).some((key) => !['ignores', 'name'].includes(key))) throw new Error('unsupported non-global canon ignores');
      target.push(...block[field].flatMap((glob) => braceVariants(glob).map(globExpression)));
    }
  }
  if (!selectors.length) throw new Error('the installed canon has no source selectors');
  const matches = (patterns, file) => patterns.some((pattern) => pattern.test(file));
  const files = [];
  const visit = (folder) => {
    for (const child of fs.readdirSync(path.join(cwd, folder), { withFileTypes: true })) {
      const file = posix(path.join(folder, child.name));
      // Ask the canon's global ignore patterns before entering output or installed-package trees.
      if (matches(ignored, file) || matches(ignored, `${file}/__starci_scope_probe__`)) continue;
      if (child.isSymbolicLink()) throw new Error(`cannot enumerate symlink ${file}`);
      if (child.isDirectory()) visit(file);
      else if (child.isFile() && matches(selectors, file)) files.push(file);
    }
  };
  visit(scope ?? '');
  return files.sort();
}

/** Every requested source needs an explicit, well-formed result; suppressed findings and foreign paths cannot witness a completed lint. */
function checkedEslintResults({ results, expected, cwd, scope, changed }) {
  const required = new Set(expected.map((file) => fileKey(path.join(cwd, file))));
  const seen = new Set(), valid = [], errors = [];
  for (const result of results) {
    if (!result || typeof result.filePath !== 'string' || !path.isAbsolute(result.filePath) || !Array.isArray(result.messages)
      || result.messages.some((message) => !message || typeof message.message !== 'string')
      || (result.suppressedMessages !== undefined && !Array.isArray(result.suppressedMessages))) {
      errors.push('eslint produced a malformed file result'); continue;
    }
    const key = fileKey(result.filePath);
    if (!inside(cwd, result.filePath) || (scope && !inside(path.join(cwd, scope), result.filePath)) || (changed && !required.has(key))) {
      errors.push(`eslint produced a result outside the requested scope: ${result.filePath}`); continue;
    }
    if (seen.has(key)) errors.push(`eslint produced duplicate results for ${result.filePath}`);
    seen.add(key);
    if (result.suppressedMessages?.length) errors.push(`eslint suppressed findings for ${result.filePath}`);
    valid.push(result);
  }
  const missing = expected.filter((file) => !seen.has(fileKey(path.join(cwd, file))));
  if (missing.length) errors.push(`eslint produced no result for requested source files: ${missing.join(', ')}`);
  return { results: valid, errors };
}

/**
 * Run the whole lint of the app at `repoRoot`. `hfsCheck(repoRoot)` returns the `starci app check` result (`{ findings, tracked }`); the CLI
 * injects it. Returns `{ report, sonar, exit }`; `sonar` is the merged Generic Issue Import document.
 */
export async function lintRepository({ repoRoot, opts, hfsCheck, trackedFiles = () => [] }) {
  const changed = opts.changed === null ? null : new Set(opts.changed);
  const errors = [];
  let workspace = null;
  if (opts.workspace !== undefined) {
    try { workspace = workspaceOf(opts.workspace); } catch (error) { errors.push(String(error?.message ?? error)); }
  }
  /** Whether an app-relative path lies inside the scoped workspace. */
  const inWorkspace = (file) => posix(file).startsWith(`${workspace}/`);
  const existing = changed ? [...changed].filter((file) => fs.existsSync(path.join(repoRoot, file))) : [];
  const findings = [];
  const raw = { eslint: [], stylelint: [] };
  const engines = {};

  let app = null;
  try { app = readRepoDeclaration(loadSlotManifest(), repoRoot); } catch (error) { errors.push(`starci app lint runs at the app root: ${String(error?.message ?? error)}`); }
  if (app && !app.sides) { errors.push(`${repoRoot} is the ${app.side} side of an app; starci app lint runs at the app root, the folder of hfs.json`); app = null; }
  if (opts.workspace !== undefined && workspace === null) app = null;
  if (workspace !== null && !fs.existsSync(path.join(repoRoot, workspace, 'package.json'))) { errors.push(`--workspace ${workspace} holds no package.json; it is not a workspace of this app`); app = null; }
  /** The workspace folder relative to the fe side folder (apps/<app> or packages/<pkg>). */
  const onFe = workspace === null ? null : workspace.slice(STYLE_SIDE.length + 1);

  // 1. ESLint, once per side, from the side folder with that side's config.
  engines.eslint = { sides: {} };
  for (const side of app ? SIDES : []) {
    if (workspace !== null && side !== STYLE_SIDE) { engines.eslint.sides[side] = { files: 0, skipped: `outside --workspace ${workspace}` }; continue; }
    const sources = onSide(existing, side).filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file));
    if (changed !== null && !sources.length) { engines.eslint.sides[side] = { files: 0, skipped: 'no changed source file' }; continue; }
    const cwd = path.join(repoRoot, side);
    let expected;
    try { expected = changed ? sources : await sourceFiles({ repoRoot, cwd, side, scope: onFe }); }
    catch (error) { errors.push(`eslint source scope is unavailable in ${side}/: ${String(error?.message ?? error)}`); engines.eslint.sides[side] = { files: 0 }; continue; }
    const linted = runLinter({ cwd, pkg: 'eslint', bin: 'eslint', args: ['--format', 'json', ...(opts.fix ? ['--fix'] : []), ...(changed ? sources : [onFe ?? '.'])], bound: repoRoot });
    if (linted.error) errors.push(linted.error);
    if (linted.results) {
      const checked = checkedEslintResults({ results: linted.results, expected, cwd, scope: onFe, changed: changed !== null });
      errors.push(...checked.errors);
      linted.results = checked.results;
      // The side canon names side-relative paths in its messages; the report names every path from the app root.
      const appRelative = appRelativeMessages(side, path.join(repoRoot, side));
      for (const result of linted.results) for (const message of result.messages ?? []) message.message = appRelative(message.message);
      raw.eslint.push(...linted.results);
      findings.push(...eslintFindings(linted.results, repoRoot));
    }
    engines.eslint.sides[side] = { files: linted.results?.length ?? 0 };
  }

  // 3. stylelint over the fe side's stylesheets.
  if (app) {
    const styles = onSide(existing, STYLE_SIDE).filter((file) => file.endsWith('.css'));
    if (changed === null || styles.length) {
      const linted = runLinter({ cwd: path.join(repoRoot, STYLE_SIDE), pkg: 'stylelint', bin: 'stylelint', args: [...(changed ? styles : [onFe ? `${onFe}/src/**/*.css` : STYLE_GLOB]), '--formatter', 'json', ...(opts.fix ? ['--fix'] : [])] });
      if (linted.error) errors.push(linted.error);
      if (linted.results) {
        const appRelative = appRelativeMessages(STYLE_SIDE, path.join(repoRoot, STYLE_SIDE));
        for (const result of linted.results) for (const warning of result.warnings ?? []) warning.text = appRelative(warning.text);
        raw.stylelint = linted.results;
        findings.push(...stylelintFindings(linted.results, repoRoot));
      }
    }
    engines.stylelint = { side: STYLE_SIDE, files: raw.stylelint.length };
  }

  // 2. The app check: root and sides.
  let checked = { findings: [] };
  if (app) {
    try { checked = await hfsCheck(repoRoot); } catch (error) { errors.push(`starci app check could not run: ${String(error?.message ?? error)}`); }
  }
  const repoErrors = checked.findings.filter((finding) => finding.level === 'error');
  // A workspace lint keeps only the app findings inside the workspace; the rest belong to the root lint of the whole app.
  const kept = workspace !== null
    ? repoErrors.filter((finding) => finding.path && inWorkspace(finding.path))
    : changed === null ? repoErrors : repoErrors.filter((finding) => !finding.path || changed.has(posix(finding.path)));
  for (const finding of kept) {
    findings.push({ engine: 'hfs', rule: finding.code, code: finding.code, severity: 'error', path: finding.path ? posix(finding.path) : null, line: finding.line ?? null, column: finding.column ?? null, message: finding.message, titleVi: finding.titleVi, nextStepVi: finding.nextStepVi });
  }
  engines.hfs = { findings: kept.length };
  findings.sort(byLocation);

  let properties = '';
  try { properties = fs.readFileSync(path.join(repoRoot, 'sonar-project.properties'), 'utf8'); } catch { /* no properties: every finding keeps its own path */ }
  const sourceRoots = sourceRootsOf(properties);
  const tracked = sourceRoots.length ? trackedFiles(repoRoot) : [];
  const sonar = mergeReports([
    sonarReport(kept, { sourceRoots, tracked }),
    linterReport('eslint', raw.eslint, { root: repoRoot, sourceRoots, tracked }),
    linterReport('stylelint', raw.stylelint, { root: repoRoot, sourceRoots, tracked }),
  ]);
  const report = { schema: LINT_SCHEMA, ok: findings.length === 0 && errors.length === 0, repoRoot, changed: changed ? [...changed].sort() : null, workspace, counts: { error: findings.length }, engines, errors, findings };
  return { report, sonar, exit: errors.length ? 2 : findings.length ? 1 : 0 };
}

export function printLintText(report, out) {
  for (const f of report.findings) out(`${f.path ?? '-'}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}  ${f.engine}/${f.rule}  ${f.message}\n`);
  for (const e of report.errors) out(`ERROR ${e}\n`);
  const per = Object.keys(report.engines).map((engine) => `${engine} ${report.findings.filter((f) => f.engine === engine).length}`).join(', ');
  out(`\nstarci app lint: ${report.counts.error} finding${report.counts.error === 1 ? '' : 's'} (${per})${report.errors.length ? `, ${report.errors.length} tool error${report.errors.length === 1 ? '' : 's'}` : ''}\n`);
}
