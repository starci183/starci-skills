#!/usr/bin/env node
// test-world-run.mjs - the test-world run summary (schema starci/test-world-run@1) e2e.verify and integration.verify attach
// (knowledge/op-gate.yaml proofs.test-world, contract change op-mechanism-proofs).
//
//   starci gate test-world --root <app> --project e2e|integration|contract [--tests <path pattern>] [--out <file>]
//
// Over the app at --root it records, and `starci kernel settle` re-reads (scripts/kernel/gate-settle.mjs):
//   harness  the be jest config is @starci/jest-preset's starciJestConfig() (its world projects run on the preset's world
//            runner: up to min(--maxWorkers, slots) files at once, each in a fresh process on its own data slot) and the world
//            declaration be/src/tests/world/test-world.config.ts
//            calls defineTestWorld;
//   specs    every spec of the project (be/src/tests/{e2e,integration,contract}/**/*.<project>-spec.ts, narrowed by --tests)
//            takes its world from the library in the layer's form - useTestWorld({ apps }) for e2e, useTestWorld({ modules })
//            for integration, useSandbox(...) for contract (the real client against the provider's sandbox) - and hand-rolls
//            none of op-gate.yaml testWorld.forbidden (docker, testcontainers, DataSource, process.env, sleeps); the outage calls
//            (cut, restore, during, latency) are counted;
//   run      the managed `npm run test:<project>` with jest's --json report: exit, totals, failed and skipped tests.
// Our own stack runs real and only third-party SaaS is faked at the network edge: the library owns that, a spec never does.
// Exit 0 green, 1 a finding or a red run, 2 the summary could not be built.
import fs from 'node:fs';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';
import { fileURLToPath } from 'node:url';
import { posixPath } from '../lib/path-key.mjs';
import { valueFlags } from '../lib/cli-arg.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs';
import { opGateRules } from '../lib/op-gate.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';

export const TEST_WORLD_RUN_SCHEMA = 'starci/test-world-run@1';
const WORLD_PROJECTS = Object.freeze({
  e2e: { dir: 'be/src/tests/e2e', suffix: '.e2e-spec.ts', mode: 'apps' },
  integration: { dir: 'be/src/tests/integration', suffix: '.integration-spec.ts', mode: 'modules' },
  contract: { dir: 'be/src/tests/contract', suffix: '.contract-spec.ts', mode: 'sandbox' },
});
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const JEST_CONFIGS = ['be/jest.config.js', 'be/jest.config.cjs', 'be/jest.config.ts', 'jest.config.js', 'jest.config.cjs', 'jest.config.ts'];
const DECLARATION = 'be/src/tests/world/test-world.config.ts';
const USAGE = 'usage: starci gate test-world --root <app> --project e2e|integration|contract [--tests <path pattern>] [--out <file>]';

/** op-gate.yaml testWorld: {required[], forbidden[], outage[]}. */
export function testWorldRules(runtime = runtimeRoot) {
  return opGateRules(runtime, 'testWorld');
}

/** The harness of the app: {jestConfig, preset, declaration, defineTestWorld}. */
function harnessOf(root) {
  const jestConfig = JEST_CONFIGS.find((rel) => fs.existsSync(path.join(root, rel))) ?? null;
  const text = jestConfig ? fs.readFileSync(path.join(root, jestConfig), 'utf8') : '';
  const declared = fs.existsSync(path.join(root, DECLARATION)) ? fs.readFileSync(path.join(root, DECLARATION), 'utf8') : null;
  return { jestConfig, preset: /@starci\/jest-preset/.test(text) && /starciJestConfig\s*\(/.test(text), declaration: declared === null ? null : DECLARATION, defineTestWorld: /defineTestWorld\s*\(/.test(declared ?? '') };
}

/** The `{ ... }` argument text of each useTestWorld( call, balanced over braces. */
function useTestWorldArgs(text) {
  const out = [];
  const re = /useTestWorld\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 0, i = m.index + m[0].length, start = i;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (c === '(' || c === '{' || c === '[') depth += 1;
      else if (c === ')' || c === '}' || c === ']') {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    out.push(text.slice(start, i));
  }
  return out;
}

/** One spec judged: {path, useTestWorld, modes[], outage, forbidden[]}; `sandbox` is a mode when the spec calls useSandbox. */
export function judgeSpec(rel, text, rules) {
  const args = useTestWorldArgs(text);
  const modes = [...new Set(args.flatMap((a) => ['apps', 'modules'].filter((k) => new RegExp(String.raw`(^|[{,\s])${k}\s*:`).test(a))))];
  const sandbox = /useSandbox\s*\(/.test(text);
  if (sandbox) modes.push('sandbox');
  // A comment may name a forbidden word to explain its absence; only code counts.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r\u2028\u2029]*/gm, '$1');
  return { path: rel, useTestWorld: args.length > 0 || sandbox, modes, outage: rules.outage.reduce((n, needle) => n + code.split(needle).length - 1, 0),
    forbidden: rules.forbidden.filter((needle) => code.includes(needle)) };
}

/** The spec files of a world project under the app root (app-relative POSIX paths), narrowed by a --tests pattern. */
export function specsOf(root, project, tests = null) {
  const def = WORLD_PROJECTS[project];
  const dir = path.join(root, def.dir);
  if (!fs.existsSync(dir)) return [];
  const narrow = tests ? new RegExp(tests) : null;
  return walkFiles(dir, { sorted: true, exclude: (name, full, entry) => entry.isDirectory() && name === 'node_modules' })
    .map((file) => posixPath(path.relative(root, file)))
    .filter((rel) => rel.endsWith(def.suffix) && (!narrow || narrow.test(rel)));
}

const RUN_COUNTS = Object.freeze(['total', 'passed', 'failed', 'skipped', 'files', 'failedFiles']);
const JEST_COUNTS = Object.freeze(['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests',
  'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numRuntimeErrorTestSuites']);

/** Reject an incomplete or inconsistent required test measurement without coercing reported counters. */
export function testRunCountsError(run) {
  if (!run || RUN_COUNTS.some((key) => !Number.isSafeInteger(run[key]) || run[key] < 0)) return 'test counters must be non-negative safe integers';
  if (run.total !== run.passed + run.failed + run.skipped || run.failedFiles > run.files) return 'test counters do not describe a complete run';
  return null;
}

/** The shape checks of the report and its process: an error string or null. */
const reportShapeError = (report, run) => {
  if (run?.error || run?.signal || !Number.isSafeInteger(run?.status) || run.status < 0) {
    const detail = run?.error?.message ?? run?.signal ?? `exit ${run?.status ?? 'unknown'}`;
    return `jest did not complete: ${detail}`;
  }
  if (!report || typeof report !== 'object' || Array.isArray(report) || !Array.isArray(report.testResults)) return 'jest wrote no valid --json report';
  if (JEST_COUNTS.some((key) => !Number.isSafeInteger(report[key]) || report[key] < 0)) return 'jest counters must be non-negative safe integers';
  if (typeof report.success !== 'boolean' || typeof report.wasInterrupted !== 'boolean') return 'jest result is missing completion flags';
  if (report.wasInterrupted || report.runExecError) return 'jest reports an interrupted or incomplete run';
  if (report.numTotalTestSuites !== report.numPassedTestSuites + report.numFailedTestSuites + report.numPendingTestSuites
    || report.numRuntimeErrorTestSuites > report.numFailedTestSuites || report.testResults.length !== report.numTotalTestSuites)
    return 'jest suite counters do not describe a complete run';
  return null;
};

/** The assertion and suite tallies of a valid report: {totals, suites}, or {error}. */
const suiteShapeError = (suite) => !suite || !['passed', 'failed', 'skipped', 'focused'].includes(suite.status) || !Array.isArray(suite.assertionResults)
  ? 'jest wrote an invalid suite result' : null;

const focusedSuiteError = (suite, report) => suite.status === 'focused'
  && (report.numPendingTests === 0 || !suite.assertionResults.some(a => ['pending', 'skipped', 'disabled'].includes(a?.status)))
  ? 'jest focused suite reports no pending assertion' : null;

const tallyAssertion = (assertion, totals) => {
  if (assertion?.status === 'passed') totals.passed += 1;
  else if (assertion?.status === 'failed') totals.failed += 1;
  else if (['pending', 'todo', 'skipped', 'disabled'].includes(assertion?.status)) totals.skipped += 1;
  else return 'jest wrote an invalid assertion result';
  return null;
};

const tallySuites = (report) => {
  const totals = { passed: 0, failed: 0, skipped: 0 }, suites = { passed: 0, failed: 0, skipped: 0 };
  for (const suite of report.testResults) {
    const shapeError = suiteShapeError(suite);
    if (shapeError) return { error: shapeError };
    const focusedError = focusedSuiteError(suite, report);
    if (focusedError) return { error: focusedError };
    suites[suite.status === 'focused' ? 'passed' : suite.status] += 1;
    for (const assertion of suite.assertionResults) {
      const assertionError = tallyAssertion(assertion, totals);
      if (assertionError) return { error: assertionError };
    }
  }
  return { totals, suites };
};

/** Validate the Jest JSON and its real process result before any producer can call the measurement clean. */
export function jestRunError(report, run) {
  const shapeError = reportShapeError(report, run);
  if (shapeError) return shapeError;
  const tally = tallySuites(report);
  if (tally.error) return tally.error;
  const { totals, suites } = tally;
  const countsError = testRunCountsError(reduceJest(report));
  if (countsError) return countsError;
  if (suites.passed !== report.numPassedTestSuites || suites.failed !== report.numFailedTestSuites
    || suites.skipped !== report.numPendingTestSuites) return 'jest suite counters disagree with its results';
  if (totals.passed !== report.numPassedTests || totals.failed !== report.numFailedTests
    || totals.skipped !== report.numPendingTests + report.numTodoTests) return 'jest assertion counters disagree with its results';
  const measuredFailure = report.numFailedTests > 0 || report.numFailedTestSuites > 0;
  // A normal failed assertion retains its typed finding; a nonzero process with a clean report never passes.
  if (run.status !== 0 && !measuredFailure) return `jest exited ${run.status} without a reported test failure`;
  if (!report.success && !measuredFailure) return 'jest reports an unsuccessful run without a reported test failure';
  if (report.success && measuredFailure) return 'jest success contradicts its failed tests or suites';
  return null;
}

/** jest's --json report, reduced: {total, passed, failed, skipped, files, failures[]}. */
export function reduceJest(report) {
  const failures = [];
  for (const file of Array.isArray(report?.testResults) ? report.testResults : []) for (const a of Array.isArray(file?.assertionResults) ? file.assertionResults : []) {
    if (a.status === 'failed') failures.push({ file: posixPath(String(file.name ?? '')), test: a.fullName ?? a.title, message: String(a.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 300) });
  }
  return { total: report?.numTotalTests ?? 0, passed: report?.numPassedTests ?? 0, failed: report?.numFailedTests ?? 0,
    skipped: (report?.numPendingTests ?? 0) + (report?.numTodoTests ?? 0), files: report?.numTotalTestSuites ?? 0, failedFiles: report?.numFailedTestSuites ?? 0, failures: failures.slice(0, 100) };
}

/** Run the managed `npm run test:<project>` with jest's JSON report; {command, exit, ...reduceJest, error}. */
function runWorldProject(root, project, tests = null, { npm = runNpm } = {}) {
  const outDir = makeTempDir('starci-test-world-run-');
  const outFile = path.join(outDir, 'jest.json');
  const args = ['run', `test:${project}`, '--', '--json', `--outputFile=${outFile}`, ...(tests ? ['--testPathPattern', tests] : [])];
  const run = npm(args, { cwd: root, maxBuffer: 512 * 1024 * 1024 });
  let report = null;
  try { report = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { report = null; }
  try { fs.rmSync(outFile, { force: true }); fs.rmdirSync(outDir); } catch { /* a temp file of this run */ }
  return { command: `npm ${args.filter((a) => !a.startsWith('--outputFile=')).join(' ')}`, exit: run.status ?? null,
    ...(report ? reduceJest(report) : { total: 0, passed: 0, failed: 0, skipped: 0, files: 0, failedFiles: 0, failures: [] }),
    error: jestRunError(report, run) };
}

/** The findings of a summary (harness, specs and run), each {rule, path, message}. */
export function testWorldFindings(summary) {
  const out = [];
  const h = summary.harness ?? {};
  if (!h.preset) out.push({ rule: 'preset-missing', path: h.jestConfig, message: 'the be jest config is not @starci/jest-preset starciJestConfig(): its world projects do not run on the world runner' });
  if (!h.declaration || !h.defineTestWorld) out.push({ rule: 'declaration-missing', path: DECLARATION, message: 'no world declaration calling defineTestWorld' });
  if (!(summary.specs ?? []).length) out.push({ rule: 'no-specs', path: WORLD_PROJECTS[summary.project]?.dir ?? null, message: `no ${summary.project} spec was selected` });
  const mode = WORLD_PROJECTS[summary.project]?.mode;
  for (const spec of summary.specs ?? []) {
    const form = mode === 'sandbox' ? 'useSandbox(...)' : `useTestWorld({ ${mode} })`;
    if (!spec.useTestWorld) out.push({ rule: 'use-test-world-missing', path: spec.path, message: 'the spec never calls useTestWorld or useSandbox: its world is hand-rolled' });
    else if (mode && !spec.modes.includes(mode)) out.push({ rule: 'layer-mode', path: spec.path, message: `a ${summary.project} spec calls ${form}; it uses ${spec.modes.join(', ') || 'neither apps nor modules'}` });
    for (const needle of spec.forbidden) out.push({ rule: 'hand-rolled', path: spec.path, message: `the spec uses ${needle}: infrastructure belongs to @starci/test-world` });
  }
  return out;
}

export function buildTestWorldRun({ root, project, tests = null, rules = testWorldRules(), npm = runNpm, run = true }) {
  if (!WORLD_PROJECTS[project]) throw new Error(`--project must be one of ${Object.keys(WORLD_PROJECTS).join(', ')}; ${USAGE}`);
  const abs = path.resolve(root);
  const specs = specsOf(abs, project, tests).map((rel) => judgeSpec(rel, fs.readFileSync(path.join(abs, rel), 'utf8'), rules));
  const summary = { schema: TEST_WORLD_RUN_SCHEMA, at: new Date().toISOString(), root: posixPath(abs), project, tests, harness: harnessOf(abs), specs,
    outageCalls: specs.reduce((n, s) => n + s.outage, 0), run: null, findings: [], exit: 2 };
  summary.findings = testWorldFindings(summary);
  summary.run = run ? runWorldProject(abs, project, tests, { npm }) : null;
  const red = !summary.run || summary.run.error || summary.run.exit !== 0 || summary.run.failed > 0 || summary.run.skipped > 0 || summary.run.total === 0;
  if (summary.run?.error) summary.exit = 2;
  else summary.exit = summary.findings.length || red ? 1 : 0;
  return summary;
}

function parseTestWorldArgs(argv) {
  const opts = { root: null, project: null, tests: null, out: null, ...valueFlags(argv, ['--root', '--project', '--tests', '--out'], USAGE) };
  if (!opts.project) throw new Error(`--project is required; ${USAGE}`);
  return opts;
}

if (isMain(import.meta.url)) {
  try {
    const opts = parseTestWorldArgs(process.argv.slice(2));
    const summary = buildTestWorldRun({ root: opts.root ?? process.cwd(), project: opts.project, tests: opts.tests });
    const text = `${JSON.stringify(summary, null, 2)}\n`;
    if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
    process.stdout.write(text);
    process.exitCode = summary.exit;
  } catch (error) {
    process.stderr.write(`test-world-run: ${error.message}\n`);
    process.exitCode = 2;
  }
}
