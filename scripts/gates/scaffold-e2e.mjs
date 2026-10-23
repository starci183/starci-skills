#!/usr/bin/env node
// scaffold-e2e.mjs - `starci release scaffold-e2e`: the scaffold end-to-end proof of the runtime. With the package clean-test it is one of the two real
// test proofs of the runtime (owner ruling no-runtime-specs, 2026-10-17: the runtime carries no specs of its own; package specs and the scaffold e2e decide).
// It runs e2e/hfs-scaffold-app.e2e.spec.mjs (the full scaffold: npm ci, typecheck, lint, the be unit run, cli migrate over a real Postgres) and
// e2e/hfs-scaffold-lite.e2e.spec.mjs (the lite scaffold over its own local Supabase stack) and e2e/hfs-scaffold-app-installs.e2e.spec.mjs (the registry-install
// proof of e2e/hfs-scaffold-app.spec.mjs over fresh installs of the packed @starci tarballs: `starci release app-installs --source`), e2e/workflows-actionlint.e2e.spec.mjs and e2e/git-commit-body.e2e.spec.mjs (`starci git commit` keeps a multi-line body) under the e2e preloads (e2e/setup: low priority and the file
// watchdog, a private temp root with the repository-root guard, a private machine registry, the regenerated runtime copies).
// A skipped test is red here: the proof is that every scaffold test RAN (Docker, npm and the source canon registry are prerequisites, never optional).
// Before the run it prepares the built output the source canon registry packs (it packs with --ignore-scripts, so a package's prepack never builds it): the
// grammar dist (scripts/gates/grammar-build.mjs) when it is not fresh, and the heroicons dist when it is missing or older than its source, each from its own
// lockfile install. A fresh lane and CI therefore need no separate build step.
// It also prepares test-world's own node_modules with lifecycle scripts disabled, refusing borrowed installs through links.
//
//   starci release scaffold-e2e        exit 0 every test passed and none skipped, 1 a test failed, was cancelled or skipped, 2 the run could not start
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { tapSummary } from '../lib/tap-summary.mjs';
import { isMain } from '../lib/is-main.mjs';
import { ci } from '../api/npm/ci.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { buildGrammar } from './grammar-build.mjs';
import { grammarDistStatus } from './grammar-dist.mjs';
import { linkedNodeModules } from '../machine/npm-ci.mjs';
import { withoutSeatEnv } from '../lib/seat-env.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The scaffold e2e files, run in this order (each is its own test process). */
const E2E_FILES = Object.freeze(['e2e/hfs-scaffold-app.e2e.spec.mjs', 'e2e/hfs-scaffold-lite.e2e.spec.mjs', 'e2e/hfs-scaffold-app-installs.e2e.spec.mjs', 'e2e/workflows-actionlint.e2e.spec.mjs', 'e2e/git-commit-body.e2e.spec.mjs']);
/** The preloads every e2e process loads first. */
const E2E_PRELOADS = Object.freeze(['e2e/setup/low-priority.mjs', 'e2e/setup/isolated-temp.mjs', 'e2e/setup/isolated-registry.mjs', 'e2e/setup/runtime-copies.mjs']);
const MAX_BUFFER = 512 * 1024 * 1024;

const newest = (dir) => (fs.existsSync(dir) ? Math.max(0, ...walkFiles(dir, { exclude: (name) => name === 'node_modules' }).map((file) => fs.statSync(file).mtimeMs)) : 0);

/** Whether the built `dist` of a package is missing or older than its `src`. */
const distStale = (packageRoot) => !fs.existsSync(path.join(packageRoot, 'dist')) || newest(path.join(packageRoot, 'src')) > newest(path.join(packageRoot, 'dist'));

/** Build the heroicons dist from its own lockfile install when it is stale: {ok, detail}. */
function prepareHeroicons(root, env) {
  const dir = path.join(root, 'packages', 'heroicons');
  if (!fs.existsSync(path.join(dir, 'package.json')) || !distStale(dir)) return { ok: true, detail: 'heroicons dist fresh' };
  const install = ci(dir, { env });
  if (!install.ok) return { ok: false, detail: `heroicons npm ci exit ${install.status}: ${install.stderr.slice(0, 200)}` };
  const build = runNpm(['run', 'build'], { cwd: dir, env, timeout: 600_000 });
  return build.status === 0 && !distStale(dir) ? { ok: true, detail: 'heroicons dist built' } : { ok: false, detail: `heroicons npm run build exit ${build.status ?? build.error?.message}` };
}

/** Build the grammar dist when it is not fresh: {ok, detail}. */
function prepareGrammar(root, env) {
  const status = grammarDistStatus(path.join(root, 'packages', 'grammar'));
  if (status.state === 'fresh') return { ok: true, detail: 'grammar dist fresh' };
  const built = buildGrammar({ root, env });
  return built.ok ? { ok: true, detail: 'grammar dist built' } : { ok: false, detail: `grammar ${built.step}: ${built.detail}` };
}

/** The hidden npm install record, or null for a missing or unreadable record. */
function testWorldInstallRecord(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', '.package-lock.json'), 'utf8')); } catch { return null; }
}

/** A local test-world install is stale when absent, older than its lockfile, or its recorded SHA-256 lock hash differs. Older npm records without a hash remain usable by timestamp. */
function testWorldInstallStale(dir, hash, record) {
  const modules = path.join(dir, 'node_modules');
  if (!fs.existsSync(modules) || !record) return true;
  if (fs.statSync(modules).mtimeMs < fs.statSync(path.join(dir, 'package-lock.json')).mtimeMs) return true;
  return record.starciLockHash !== undefined && record.starciLockHash !== hash;
}

/** Prepare only test-world's local lockfile install; the injected npm call never uses a shell and no linked node_modules is read or installed through. */
function prepareTestWorld(root, env = process.env, deps = {}) {
  const dir = path.join(root, 'packages', 'test-world');
  const fail = (code, detail) => ({ ok: false, detail: `${code}: test-world ${detail}` });
  const link = linkedNodeModules(dir, deps.lstat ?? fs.lstatSync);
  if (!link.ok) return fail('SCAFFOLD_E2E_TEST_WORLD_PREPARE', `cannot inspect node_modules: ${link.error}`);
  if (link.linked) return fail('RT_NODE_MODULES_LINK', 'node_modules is a junction or symbolic link; remove it before preparation');
  try {
    const hash = createHash('sha256').update(fs.readFileSync(path.join(dir, 'package-lock.json'))).digest('hex');
    if (!testWorldInstallStale(dir, hash, testWorldInstallRecord(dir))) return { ok: true, detail: 'test-world node_modules fresh' };
    const install = (deps.runNpm ?? runNpm)(['ci', '--ignore-scripts'], { cwd: dir, env: withoutSeatEnv(env), timeout: 900_000 });
    if (install.error || install.status !== 0) return fail('SCAFFOLD_E2E_TEST_WORLD_PREPARE', `npm ci --ignore-scripts exit ${install.status ?? install.error?.message}: ${String(install.stderr ?? '').slice(0, 200)}`);
    const record = testWorldInstallRecord(dir);
    if (!record) return fail('SCAFFOLD_E2E_TEST_WORLD_PREPARE', 'npm ci did not produce node_modules/.package-lock.json');
    fs.writeFileSync(path.join(dir, 'node_modules', '.package-lock.json'), `${JSON.stringify({ ...record, starciLockHash: hash }, null, 2)}\n`);
    return { ok: true, detail: 'test-world node_modules prepared (npm ci --ignore-scripts)' };
  } catch (error) {
    return fail('SCAFFOLD_E2E_TEST_WORLD_PREPARE', String(error?.message ?? error));
  }
}

/** The built output and test-world dependencies prepared before the run: {ok, lines}. `deps` replaces each preparation step. */
export function prepareE2e({ root = runtimeRoot, env = process.env, deps = {} } = {}) {
  const steps = [(deps.grammar ?? prepareGrammar)(root, env), (deps.heroicons ?? prepareHeroicons)(root, env), (deps.testWorld ?? prepareTestWorld)(root, env)];
  return { ok: steps.every((step) => step.ok), lines: steps.map((step) => step.detail) };
}

/** The node arguments of one e2e run writing its TAP report to `tapFile`. */
const e2eArgs = (tapFile, files = E2E_FILES) => [...E2E_PRELOADS.flatMap((file) => ['--import', `./${file}`]), '--test', '--test-concurrency=1',
  '--test-reporter=tap', `--test-reporter-destination=${tapFile}`, '--test-reporter=spec', '--test-reporter-destination=stdout', ...files];

/** The verdict of a finished run over its TAP summary: {ok, pass, total, failed, skipped, line}. */
function e2eVerdict(status, summary) {
  const total = summary.tests ?? 0, pass = summary.pass ?? 0, failed = (summary.fail ?? 0) + (summary.cancelled ?? 0), skipped = (summary.skipped ?? 0) + (summary.todo ?? 0);
  const ok = status === 0 && total > 0 && failed === 0 && skipped === 0 && pass === total;
  const line = `scaffold-e2e: ${pass} of ${total} passed, ${failed} failed, ${skipped} skipped`;
  return { ok, pass, total, failed, skipped, failing: summary.failing ?? [], line };
}

/** Runs the scaffold e2e in `root`: {ok, pass, total, failed, skipped, failing, line, ms, output, unrun}. `deps.runNode` is the process seam. */
export function runScaffoldE2e({ root = runtimeRoot, env = process.env, stdio = 'pipe', deps = {} } = {}) {
  const node = deps.runNode ?? runNode;
  const prepared = (deps.prepare ?? prepareE2e)({ root, env });
  for (const line of prepared.lines) (deps.progress ?? ((text) => process.stdout.write(`scaffold-e2e: ${text}\n`)))(line);
  if (!prepared.ok) return { ok: false, unrun: true, pass: 0, total: 0, failed: 0, skipped: 0, failing: [], ms: 0, output: '', line: `scaffold-e2e: the preparation failed (${prepared.lines.join('; ')})` };
  const dir = makeTempDir('scaffold-e2e-');
  const tapFile = path.join(dir, 'e2e.tap');
  const started = Date.now();
  try {
    const run = node(e2eArgs(tapFile), { cwd: root, env, stdio, maxBuffer: MAX_BUFFER });
    const ms = Date.now() - started;
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    if (run.error || run.status === null) return { ok: false, unrun: true, pass: 0, total: 0, failed: 0, skipped: 0, failing: [], ms, output, line: `scaffold-e2e: the run did not start (${run.error?.message ?? run.signal ?? 'no exit status'})` };
    const verdict = e2eVerdict(run.status, tapSummary(fs.existsSync(tapFile) ? fs.readFileSync(tapFile, 'utf8') : ''));
    return { ...verdict, unrun: false, ms, output };
  } finally {
    safeRemove(dir, { hold: artifactHoldReason });
  }
}

if (isMain(import.meta.url)) {
  if (process.argv.length > 2) {
    process.stderr.write('usage: starci release scaffold-e2e\n');
    process.exit(2);
  }
  const result = runScaffoldE2e({ stdio: ['ignore', 'inherit', 'inherit'] });
  const failing = result.failing.length ? `; failing: ${result.failing.join(' | ')}` : '';
  process.stdout.write(`${result.line} (${Math.round(result.ms / 1000)}s)${failing}\n`);
  if (result.unrun) process.exitCode = 2;
  else process.exitCode = result.ok ? 0 : 1;
}
