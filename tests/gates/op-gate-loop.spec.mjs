// The op loop (knowledge/op-gate.yaml, contract change op-gate-loop): every code-writing op READs (read-digest.mjs), CODEs, forces
// scripts/gates/gate.mjs, FIXes up to params.gateRounds and REPORTs with gate.json and read-digest.json attached; `starci kernel settle`
// re-reads both (scripts/kernel/gate-settle.mjs) and refuses a done that is red, could not run a tool, or skipped READ. The gate
// blocks only findings the op's base does not have, measured read-only, and its MERGE GUARD refuses a merge that took the lane
// side over main (merge 9958cce38).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileReport, inspectLedger, ledgerFileFor, openLedger, writeContract, recordCheckRun } from '../../engine/db/ledger.mjs';
import { GATE_EXIT, GATE_SCHEMA, appRootOf, droppedMainChanges, mergeGuard, newLintFindings, newTscFindings, parseGateArgs, runGate } from '../../scripts/gates/gate.mjs';
import { DIGEST_SCHEMA, patternsForSlot, slotTopicMap } from '../../scripts/gates/read-digest.mjs';
import { OP_GATE_CHANGE, judgeLoop } from '../../scripts/kernel/gate-settle.mjs';
import { loadContractChanges } from '../../scripts/machine/contract-version.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { installCanons } from '../helpers/canon-install-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const ts = createRequire(path.join(ROOT, 'package.json'))('typescript');
const tmp = (t, prefix = 'starci-op-gate-') => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const put = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return rel; };
const GIT_TIME = '2026-10-01T00:00:00Z';
const gitIn = (cwd) => (...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true,
  env: { ...process.env, GIT_AUTHOR_DATE: GIT_TIME, GIT_COMMITTER_DATE: GIT_TIME } }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const SHA = 'a'.repeat(64);

// One process-local app keeps the immutable canon install and gate caches warm. Every appFixture call replaces the complete
// tracked tree and history before returning, so no test observes another test's branch, files or installed `leaky` package.
let appHarness = null;
let fixtureNo = 0;
function harness() {
  if (appHarness) return appHarness;
  const host = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-op-gate-harness-')));
  const root = path.join(host, 'app');
  fs.mkdirSync(root, { recursive: true });
  put(host, 'package-lock.json', '{}\n');
  installLeaky(host);
  const git = gitIn(root);
  git('init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  appHarness = { host, root, git, parkedModules: path.join(host, 'app-node-modules') };
  return appHarness;
}
after(() => { if (appHarness) fs.rmSync(appHarness.host, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });

/** An `hfs` whose `lint` prints a fixed starci/lint@1 report (the ESLint canon is judged by its own specs). */
function hfsStub(t, findings = []) {
  const dir = tmp(t, 'starci-hfs-stub-');
  const bin = put(dir, 'hfs.mjs', `process.stdout.write(JSON.stringify({ schema: 'starci/lint@1', findings: ${JSON.stringify(findings)}, errors: [] }) + '\\n');\n`);
  return { dir, bin: path.join(dir, bin) };
}

/**
 * An app in the monorepo shape `starci app scaffold` makes (built by hand: the scaffold is not on main yet) - one root
 * package.json and hfs.json of kind app, a be/ side and an fe/ app - committed on main, with a lane branch checked out. The
 * published canons are installed under node_modules (ignored), as the registry installs them; the gate judges that install.
 */
function appFixture(t, { baseFiles = {}, within = null, install = true } = {}) {
  const shared = harness();
  const { root, git, parkedModules } = shared;
  if (within && path.resolve(within) !== path.resolve(shared.host)) throw new Error('nested app must use the process-local host repository');
  if (fs.existsSync(parkedModules) && !fs.existsSync(path.join(root, 'node_modules'))) fs.renameSync(parkedModules, path.join(root, 'node_modules'));
  fs.rmSync(path.join(root, 'node_modules', 'leaky'), { recursive: true, force: true });
  git('checkout', '-q', '--orphan', `fixture-${++fixtureNo}`);
  git('read-tree', '--empty');
  for (const entry of fs.readdirSync(root)) if (!['.git', 'node_modules'].includes(entry))
    fs.rmSync(path.join(root, entry), { recursive: true, force: true });
  const strict = { strict: true, noEmit: true, noLib: true, target: 'es2022', module: 'commonjs', skipLibCheck: true, types: [] };
  const globals = 'interface Array<T> {}\ninterface Boolean {}\ninterface CallableFunction {}\ninterface Function {}\ninterface IArguments {}\ninterface NewableFunction {}\ninterface Number {}\ninterface Object {}\ninterface RegExp {}\ninterface String {}\n';
  put(root, '.gitignore', 'node_modules/\n');
  put(root, 'package.json', JSON.stringify({ name: 'app', private: true, workspaces: ['be', 'fe/apps/*'] }, null, 2));
  put(root, 'hfs.json', JSON.stringify({ kind: 'app' }, null, 2));
  put(root, 'be/package.json', JSON.stringify({ name: '@app/be', private: true }));
  put(root, 'be/tsconfig.json', JSON.stringify({ compilerOptions: strict, include: ['src'] }));
  put(root, 'be/src/lib.d.ts', globals);
  put(root, 'be/src/a.ts', 'export const a: number = 1;\n');
  put(root, 'fe/apps/web/package.json', JSON.stringify({ name: '@app/web', private: true }));
  put(root, 'fe/apps/web/tsconfig.json', JSON.stringify({ compilerOptions: { ...strict, jsx: 'preserve' }, include: ['src'] }));
  put(root, 'fe/apps/web/src/lib.d.ts', globals);
  put(root, 'fe/apps/web/src/page.tsx', 'export const title: string = "home";\n');
  for (const [rel, body] of Object.entries(baseFiles)) put(root, rel, body);
  if (install) {
    if (!fs.existsSync(path.join(root, 'node_modules'))) installCanons(root);
  } else if (fs.existsSync(path.join(root, 'node_modules'))) fs.renameSync(path.join(root, 'node_modules'), parkedModules);
  git('add', '-A'); git('commit', '-q', '-m', 'scaffold');
  git('branch', '-M', 'main');
  if (spawnSync('git', ['show-ref', '--verify', '--quiet', 'refs/heads/lane'], { cwd: root, windowsHide: true }).status === 0) git('branch', '-D', 'lane');
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', 'lane');
  return { root, git, base };
}

test('the gate flags', () => {
  assert.deepEqual(parseGateArgs(['--root', 'r', '--changed', 'a.ts', 'b.ts', '--tests', 'x', '--main', 'trunk']),
    { root: 'r', base: null, main: 'trunk', changed: ['a.ts', 'b.ts'], tests: 'x', out: null, profile: 'code', tree: null });
  assert.throws(() => parseGateArgs(['--base']), /needs a value/);
  assert.throws(() => parseGateArgs(['--nope']), /unknown argument/);
});

test('gate.mjs on an app in the scaffolded shape is clean: lint, one tsc program per side, no merge to judge', async (t) => {
  const { root, git, base } = appFixture(t);
  put(root, 'be/src/a.ts', 'export const a: number = 2;\n');
  put(root, 'fe/apps/web/src/page.tsx', 'export const title: string = "start";\n');
  git('commit', '-qam', 'slice');
  const report = await runGate({ root, base, changed: ['be/src/a.ts', 'fe/apps/web/src/page.tsx'], hfs: hfsStub(t), ts });
  assert.equal(report.schema, GATE_SCHEMA);
  assert.equal(report.exit, GATE_EXIT.clean, JSON.stringify(report.errors));
  assert.equal(report.ok, true);
  assert.deepEqual(report.steps.tsc.map((s) => s.project), ['be/tsconfig.json', 'fe/apps/web/tsconfig.json']);
  assert.deepEqual(report.steps.merges, { checked: [], dropped: 0 });
  assert.equal(report.steps.lint.files, 2);
});

test('a new tsc error blocks; the same error already on the base is preexisting and never blocks', async (t) => {
  const { root, git, base } = appFixture(t, { baseFiles: { 'be/src/old.ts': "export const o: number = 'debt';\n" } });
  put(root, 'be/src/a.ts', 'export const a: number = 3;\n');
  git('commit', '-qam', 'green slice over debt');
  const green = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(green.exit, GATE_EXIT.clean, JSON.stringify(green.findings));
  assert.ok(green.counts.preexisting >= 1, 'the debt at base is counted, not blamed');
  put(root, 'be/src/a.ts', "export const a: number = 'red';\n");
  git('commit', '-qam', 'red slice');
  const red = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(red.exit, GATE_EXIT.findings);
  assert.deepEqual(red.findings.map((f) => [f.engine, f.rule, f.path]), [['tsc', 'TS2322', 'be/src/a.ts']]);
});

test('lint is judged per (file, rule) against the base: only a grown count is new', () => {
  const f = (rule, pathName = 'be/src/a.ts') => ({ engine: 'eslint', rule, path: pathName, line: 1, message: rule });
  const base = new Map([['be/src/a.ts|eslint/no-var', 1]]);
  assert.deepEqual(newLintFindings([f('no-var')], base), { fresh: [], preexisting: 1 });
  const grown = newLintFindings([f('no-var'), f('no-var'), f('eqeqeq')], base);
  assert.deepEqual(grown.fresh.map((x) => x.rule).sort(), ['eqeqeq', 'no-var', 'no-var']);
  assert.equal(newTscFindings([{ key: 'k' }, { key: 'k' }], [{ key: 'k' }]).fresh.length, 1, 'tsc is a multiset over normalised keys');
});

test('a tool that could not run is exit 2, never a pass', async (t) => {
  const { root, git, base } = appFixture(t);
  put(root, 'README.md', '# changed\n');
  git('add', '-A'); git('commit', '-qm', 'slice');
  const broken = { dir: tmp(t, 'starci-hfs-broken-'), bin: path.join(ROOT, 'tests', 'no-such-hfs.mjs') };
  const report = await runGate({ root, base, changed: ['README.md'], hfs: broken, ts });
  assert.equal(report.exit, GATE_EXIT.toolFailed);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(' '), /hfs lint produced no starci\/lint@1 report/);
});

/* --------------------------------------------- the bound: no type-check resolves above the app root */

/** A package `leaky` (declarations only) installed under `dir`/node_modules. */
const installLeaky = (dir) => {
  put(dir, 'node_modules/leaky/package.json', JSON.stringify({ name: 'leaky', version: '1.0.0', types: 'index.d.ts' }));
  put(dir, 'node_modules/leaky/index.d.ts', 'export declare const leak: number;\n');
};
/** A directory standing for the enclosing repository: its own lockfile and node_modules holding `leaky`. */
const hostRepo = () => harness().host;
const IMPORTS_LEAKY = "import { leak } from 'leaky';\nexport const a: number = leak;\n";

test('BOUND: an app nested in a repository whose node_modules holds a package the app does not install gets TS2307 for it', async (t) => {
  const { root, git, base } = appFixture(t, { within: hostRepo(t) });
  put(root, 'be/src/a.ts', IMPORTS_LEAKY);
  git('commit', '-qam', 'import a package only the enclosing repository installs');
  const report = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(report.exit, GATE_EXIT.findings, JSON.stringify(report.errors));
  assert.deepEqual(report.findings.map((f) => [f.engine, f.rule, f.path]), [['tsc', 'TS2307', 'be/src/a.ts']]);
  assert.match(report.findings[0].message, /'leaky'/);
});

test('BOUND: the same nested app that installs the package itself is clean', async (t) => {
  const { root, git, base } = appFixture(t, { within: hostRepo(t) });
  installLeaky(root);
  put(root, 'be/src/a.ts', IMPORTS_LEAKY);
  git('commit', '-qam', 'import a package the app installs');
  const report = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(report.exit, GATE_EXIT.clean, JSON.stringify([report.errors, report.findings]));
  assert.deepEqual(report.steps.tsc.map((s) => [s.project, s.errors]), [['be/tsconfig.json', 0]]);
});

test('BOUND: an app with no node_modules is never measured: exit 2, no tsc step, even inside a repository that has an install', async (t) => {
  const { root, git, base } = appFixture(t, { within: hostRepo(t), install: false });
  put(root, 'be/src/a.ts', 'export const a: number = 5;\n');
  git('commit', '-qam', 'slice');
  const report = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(report.exit, GATE_EXIT.toolFailed);
  assert.equal(report.ok, false);
  assert.deepEqual(report.steps.tsc, []);
  assert.ok(report.errors.some((e) => /^GATE_INSTALL_MISSING tsc cannot measure be\/tsconfig\.json: its app root \. \(or its side\) has no install \(node_modules\)/.test(e)), JSON.stringify(report.errors));
  assert.ok(report.errors.some((e) => e.startsWith('CANON_INSTALL_MISSING')), "the canon in the enclosing node_modules is not the app's install either");
});

test('BOUND: appRootOf is the hfs.json app root, else the nearest lockfile root, never above the gate root', (t) => {
  const { root } = appFixture(t, { within: hostRepo(t), install: false });
  assert.equal(appRootOf(root, 'be/tsconfig.json'), root);
  assert.equal(appRootOf(path.join(root, 'be'), 'tsconfig.json'), root, 'a side root resolves to its app');
  const plain = tmp(t);
  put(plain, 'pkg/package-lock.json', '{}\n');
  assert.equal(appRootOf(plain, 'pkg/src/tsconfig.json'), path.join(plain, 'pkg'));
  assert.equal(appRootOf(plain, 'other/tsconfig.json'), plain);
});

/* ------------------------------------------------------------------ the merge guard (merge 9958cce38) */

/** main adds a file and changes a shared one; the lane merges main taking ITS side of everything (`-s ours`). */
function droppedMerge(t) {
  const { root, git, base } = appFixture(t, { baseFiles: { 'be/src/shared.ts': 'export const shared = 1;\n' } });
  put(root, 'be/src/lane.ts', 'export const lane = 1;\n');
  git('add', '-A'); git('commit', '-qm', 'lane work');
  git('checkout', '-q', 'main');
  put(root, 'be/src/service-deps.ts', 'export const rule = "service-deps";\n');
  put(root, 'be/src/shared.ts', 'export const shared = 2;\n');
  git('add', '-A'); git('commit', '-qm', 'main: service-deps rule');
  const mainTip = git('rev-parse', 'HEAD');
  git('checkout', '-q', 'lane');
  git('merge', '-q', '-s', 'ours', '--no-edit', '-m', 'merge main into lane (round 2)', 'main');
  return { root, git, base, mainTip, merge: git('rev-parse', 'HEAD'), lane: git('rev-parse', 'HEAD^1') };
}

test('MERGE GUARD: a merge that kept the lane side over main is recomputed with merge-tree and names every dropped path', async (t) => {
  const { root, base, mainTip, merge, lane } = droppedMerge(t);
  const judged = droppedMainChanges(root, { merge, mainParent: mainTip, laneParent: lane });
  assert.deepEqual(judged.dropped.map((d) => d.path).sort(), ['be/src/service-deps.ts', 'be/src/shared.ts']);
  assert.ok(judged.dropped.every((d) => !d.conflicted), 'clean main hunks the merge threw away');
  const guard = mergeGuard(root, { base, mainTip });
  assert.deepEqual(guard.checked, [merge]);
  assert.equal(guard.findings.length, 2);
  const report = await runGate({ root, base, changed: [], hfs: hfsStub(t), ts });
  assert.equal(report.exit, GATE_EXIT.findings);
  assert.deepEqual(report.findings.filter((f) => f.engine === 'merge').map((f) => f.rule), ['dropped-main-change', 'dropped-main-change']);
  assert.equal(report.steps.merges.dropped, 2);
});

test('MERGE GUARD: a merge that took main\'s changes, or resolved a conflict with a third text, is clean', (t) => {
  const { root, git, base } = appFixture(t, { baseFiles: { 'be/src/shared.ts': 'export const shared = 1;\n' } });
  put(root, 'be/src/shared.ts', 'export const shared = 10;\n');
  git('commit', '-qam', 'lane: shared 10');
  git('checkout', '-q', 'main');
  put(root, 'be/src/shared.ts', 'export const shared = 2;\n');
  put(root, 'be/src/service-deps.ts', 'export const rule = 1;\n');
  git('add', '-A'); git('commit', '-qm', 'main');
  const mainTip = git('rev-parse', 'HEAD');
  git('checkout', '-q', 'lane');
  spawnSync('git', ['merge', '--no-edit', 'main'], { cwd: root, encoding: 'utf8', windowsHide: true });
  put(root, 'be/src/shared.ts', 'export const shared = 12;\n');
  git('add', '-A'); git('commit', '-qm', 'merge main: shared resolved to 12');
  const guard = mergeGuard(root, { base, mainTip });
  assert.equal(guard.checked.length, 1);
  assert.deepEqual(guard.findings, [], 'service-deps.ts kept, shared.ts a real resolution');
});

test('MERGE GUARD reproduces merge 9958cce38 of this runtime: main-side rules dropped by "merge main into lane/ut-int"', { skip: spawnSync('git', ['cat-file', '-e', '9958cce389d8a305a6fdb8590549d7984cd887ed^{commit}'], { cwd: ROOT }).status !== 0 && 'the merge object is not in this clone' }, () => {
  const judged = droppedMainChanges(ROOT, { merge: '9958cce389d8a305a6fdb8590549d7984cd887ed', laneParent: '769ba32f5f00dccb1f10338f60fdc7221a206bfa', mainParent: 'd5f11c337c92f4df3d6bda2f4dbed8de764794da' });
  const dropped = judged.dropped.map((d) => d.path);
  // The paths as merge 9958cce38 recorded them (history: the tree has moved since).
  for (const file of ['packages/eslint/be/service-deps.mjs', 'packages/eslint/be/' + 'service-deps.test.mjs', 'packages/eslint/be/lib/persistence.mjs', 'scripts/checks/' + 'architecture/backend.mjs'])
    assert.ok(dropped.includes(file), `${file} is a dropped main change`);
  assert.equal(dropped.length, 21);
});

/* ------------------------------------------------------------------ settle */

const gateDoc = (over = {}) => ({ schema: GATE_SCHEMA, at: '2026-10-01T08:00:00.000Z', root: '.', base: 'b'.repeat(40), head: 'c'.repeat(40), changed: ['src/a.ts'], exit: 0, ok: true,
  steps: {}, counts: { new: 0, preexisting: 0 }, findings: [], errors: [], ...over });
const digestDoc = (files = [{ path: 'knowledge/patterns/be/service.yaml', role: 'pattern', sha256: SHA }]) => ({ schema: DIGEST_SCHEMA, at: '2026-10-01T07:00:00.000Z', root: '.', touched: ['src/a.ts'], slotMap: [], files });
const LINT_NEW = { exit: 1, ok: false, counts: { new: 1, preexisting: 0 }, findings: [{ engine: 'eslint', rule: 'starci-be/no-raw-sql', path: 'src/a.ts', line: 3, message: 'raw SQL' }] };
const TSC_NEW = { exit: 1, ok: false, counts: { new: 1, preexisting: 2 }, findings: [{ engine: 'tsc', rule: 'TS2322', path: 'src/a.ts', line: 1, message: "Type 'string' is not assignable to type 'number'." }] };
const PREEXISTING_ONLY = { exit: 0, ok: true, counts: { new: 0, preexisting: 5 } };

test('judgeLoop: new lint or tsc findings, a tool failure, a missing gate or READ digest refuse; base-only findings pass', () => {
  const kinds = [{ path: 'src/a.ts', slot: null }];
  assert.equal(judgeLoop({ gate: gateDoc(LINT_NEW), digest: digestDoc(), kinds }).code, 'op-gate-new-findings');
  assert.match(judgeLoop({ gate: gateDoc(TSC_NEW), digest: digestDoc(), kinds }).findings[0], /tsc\/TS2322/);
  assert.equal(judgeLoop({ gate: gateDoc({ exit: 2, errors: ['tsc could not run'] }), digest: digestDoc(), kinds }).code, 'op-gate-tool-failed');
  assert.equal(judgeLoop({ gate: null, digest: digestDoc(), kinds }).code, 'op-gate-proof-missing');
  assert.equal(judgeLoop({ gate: gateDoc(), digest: null, kinds }).code, 'op-read-digest-missing');
  assert.equal(judgeLoop({ gate: gateDoc(), digest: digestDoc([{ path: 'examples/x/be/a.ts', role: 'example', sha256: SHA }]), kinds }).code, 'op-read-digest-no-pattern');
  assert.equal(judgeLoop({ gate: gateDoc(PREEXISTING_ONLY), digest: digestDoc(), kinds }).status, 'pass');
});

test('the READ topic map derives from the topics\' own slots fields, in index.yaml order, with longest-prefix lookup', () => {
  const always = ['knowledge/patterns/be/index.yaml', 'knowledge/patterns/be/folder.yaml', 'knowledge/patterns/be/naming.yaml', 'knowledge/patterns/be/imports.yaml', 'knowledge/patterns/be/typing.yaml', 'knowledge/patterns/be/function.yaml', 'knowledge/patterns/be/comment.yaml'];
  assert.deepEqual(patternsForSlot('be.app'), [...always, 'knowledge/patterns/be/architecture-check.yaml', 'knowledge/patterns/be/injection.yaml', 'knowledge/patterns/be/config.yaml', 'knowledge/patterns/be/services.yaml']);
  assert.deepEqual(patternsForSlot('be.app.api'), patternsForSlot('be.app'), 'an unlisted sub-slot reads the longest covered prefix');
  assert.deepEqual(patternsForSlot('app.format-config'), ['knowledge/patterns/repo/index.yaml', 'knowledge/patterns/repo/folder.yaml', 'knowledge/patterns/repo/tooling.yaml', 'knowledge/patterns/repo/formatter.yaml']);
  assert.deepEqual(patternsForSlot('be.app.cli'), [...always, 'knowledge/patterns/be/architecture-check.yaml', 'knowledge/patterns/be/cli.yaml', 'knowledge/patterns/be/config.yaml']);
  assert.deepEqual(patternsForSlot(null), []);
  assert.deepEqual(patternsForSlot('app.tool-cache'), ['knowledge/patterns/repo/index.yaml', 'knowledge/patterns/repo/folder.yaml'], 'a slot no topic names owes the family always files alone');
  assert.ok(slotTopicMap().get('be.feature').includes('be/api.yaml'));
});

const effectiveOf = (id) => loadContractChanges(ROOT).changes.find((c) => c.id === id).effectiveAt;
function seedOps(t, cases) {
  const repo = tmp(t, 'starci-op-gate-settle-');
  const git = gitIn(repo);
  git('init', '--quiet', '-b', 'main');
  for (const [k, v] of [['user.email', 'lane@starci.test'], ['user.name', 'lane'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(repo, 'src/a.ts', 'export const a = 1;\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'init');
  const prepared = cases.map(({ label, gate, digest, op = 'test.author' }) => {
    const files = ['src/a.ts'];
    if (gate) files.push(put(repo, `src/checks/${label}/gate.json`, JSON.stringify({ ...gate, root: repo.replace(/\\/g, '/') })));
    if (digest) files.push(put(repo, `src/checks/${label}/read-digest.json`, JSON.stringify(digest)));
    return { label, op, files, jobId: `op-${op}-${label}` };
  });
  git('add', '.'); git('commit', '--quiet', '-m', 'slice');
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    for (const { label, op, files, jobId } of prepared) {
      seedWorkflow(ledger, { id: `wf-${label}`, state: { phase: 'running', job: 'impl' },
        jobs: [{ jobId, opId: op, dispatchId: `ctx-${jobId}`, terminalHandle: `term-${jobId}`, status: 'running',
          payload: { opId: op, owned_paths: ['src/'], orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } }] });
      const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
      ledger.transaction((db) => {
        writeContract(db, { attemptId, markdown: '# contract', context: { worktree: repo }, createdAt: effectiveOf(OP_GATE_CHANGE) + 1000 });
        fileReport(db, { attemptId, outcome: 'done', createdAt: Date.parse('2026-10-01T09:00:00.000Z'),
          report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'slice', files, head: git('rev-parse', 'HEAD') } });
        for (const check of [{ name: 'owned-paths-committed', command: 'git show' }, { name: 'owned-paths-clean', command: 'git status' }, { name: 'head-ancestor', command: 'git merge-base' }])
          recordCheckRun(db, { attemptId, name: check.name, phase: 'verify', runner: 'kernel', authority: 'runtime', status: 'pass', exitCode: 0, command: check.command });
      });
    }
  } finally { ledger.close(); }
  return { repo, jobs: new Map(prepared.map(({ label, jobId }) => [label, jobId])) };
}
const settle = (repo, jobId) => new Promise((resolve) => {
  const child = spawn(process.execPath, [API, 'settle', '--repo', repo, '--job', jobId, '--verdict', 'pass', '--json'], { cwd: ROOT, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  const timer = setTimeout(() => child.kill(), 120000);
  child.on('error', (error) => { clearTimeout(timer); resolve({ r: { status: null, stdout, stderr, error }, body: null }); });
  child.on('close', (status, signal) => {
    clearTimeout(timer);
    let body = null; try { body = JSON.parse(stdout); } catch { /* judged below */ }
    resolve({ r: { status, stdout, stderr, signal }, body });
  });
});
const read = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };

test('starci kernel settle refuses a done on a new lint finding, a new tsc error or a skipped READ; accepts findings that only pre-exist on base', async (t) => {
  const cases = [
    ['lint', gateDoc(LINT_NEW), digestDoc(), 'op-gate-new-findings'],
    ['tsc', gateDoc(TSC_NEW), digestDoc(), 'op-gate-new-findings'],
    ['noread', gateDoc(PREEXISTING_ONLY), null, 'op-read-digest-missing'],
  ];
  const seeded = seedOps(t, [...cases.map(([label, gate, digest]) => ({ label, gate, digest })),
    { label: 'base-only', gate: gateDoc(PREEXISTING_ONLY), digest: digestDoc() }]);
  const labels = [...cases.map(([label]) => label), 'base-only'];
  const settled = new Map();
  for (let i = 0; i < labels.length; i += 2) for (const [label, result] of await Promise.all(labels.slice(i, i + 2).map(async (label) =>
    [label, await settle(seeded.repo, seeded.jobs.get(label))]))) settled.set(label, result);
  for (const [label, gate, digest, code] of cases) {
    const jobId = seeded.jobs.get(label);
    const refused = settled.get(label);
    assert.equal(refused.r.status, 1, refused.r.stdout || refused.r.stderr);
    assert.equal(refused.body?.reason, code, `${label}: ${refused.r.stdout}`);
    assert.equal(read(seeded.repo, (db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status), 'running', 'a refused settle changes no job');
    assert.equal(read(seeded.repo, (db) => db.prepare("SELECT status FROM check_runs WHERE attempt_id=(SELECT attempt_id FROM op_attempts WHERE job_id=?) AND name='op-gate' ORDER BY check_id DESC").get(jobId).status), 'fail', `${label}: the refusal is the runtime check op-gate`);
  }
  const jobId = seeded.jobs.get('base-only');
  const ok = settled.get('base-only');
  assert.equal(ok.r.status, 0, ok.r.stderr || ok.r.stdout);
  assert.equal(read(seeded.repo, (db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status), 'succeeded');
  assert.equal(read(seeded.repo, (db) => db.prepare("SELECT status FROM check_runs WHERE attempt_id=(SELECT attempt_id FROM op_attempts WHERE job_id=?) AND name='op-gate' ORDER BY check_id DESC").get(jobId).status), 'pass');
});
