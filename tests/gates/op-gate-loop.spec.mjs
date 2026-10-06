// The op loop (knowledge/op-gate.yaml, current contract): every code-writing op READs (read-digest.mjs), CODEs, forces
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
import { GATE_EXIT, GATE_SCHEMA, appRootOf, droppedMainChanges, gateInputSnapshot, mergeGuard, newLintFindings, newTscFindings, parseGateArgs, runGate } from '../../scripts/gates/gate.mjs';
import { exposesDist, inputStamp, typeImpact } from '../../scripts/gates/type-impact.mjs';
import { DIGEST_SCHEMA, buildReadDigest, judgeReadDigest, kindsOf, loadOpGate, patternsForSlot, slotTopicMap } from '../../scripts/gates/read-digest.mjs';
import { captureGateBinding, judgeJobLoop, judgeLoop } from '../../scripts/kernel/gate-settle.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { EXAMPLE_CATALOG_FILE } from '../../scripts/lib/example-refs.mjs';
import { CONTRACT_VERSION_SCHEMA } from '../../scripts/machine/contract-version.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { installBoundLintCanons, lintFixtureDeclaration } from '../helpers/lint-canon-fixture.mjs';

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
  put(root, 'hfs.json', JSON.stringify(lintFixtureDeclaration('app'), null, 2));
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
    if (!fs.existsSync(path.join(root, 'node_modules'))) installBoundLintCanons(root);
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

test('an empty submitted changed list cannot hide a committed or untracked owned TypeScript error', async (t) => {
  const { root, git, base } = appFixture(t);
  put(root, 'be/src/a.ts', 'export const a: number = "wrong";\n');
  git('commit', '-qam', 'committed wrong type');
  put(root, 'be/src/untracked.ts', 'export const b: number = "also wrong";\n');
  const report = await runGate({ root, base, changed: [], hfs: hfsStub(t), ts, context: null });
  assert.equal(report.exit, GATE_EXIT.findings, JSON.stringify([report.errors, report.findings]));
  assert.deepEqual(report.changed, ['be/src/a.ts', 'be/src/untracked.ts']);
  assert.ok(report.findings.some((finding) => finding.engine === 'tsc' && finding.path === 'be/src/a.ts'));
  assert.ok(report.findings.some((finding) => finding.engine === 'tsc' && finding.path === 'be/src/untracked.ts'));
});

test('the real input snapshot includes committed, dirty, untracked and deleted owned paths, excluding a parallel side', (t) => {
  const { root, git, base } = appFixture(t, { baseFiles: { 'be/src/deleted.ts': 'export const deleted = 1;\n' } });
  const binding = captureGateBinding([{ base: root, path: 'be/**' }], { at: Date.now() });
  assert.equal(binding.targets[0].head, base);
  put(root, 'be/src/a.ts', 'export const a = 2;\n');
  git('commit', '-qam', 'one owned edit');
  put(root, 'be/src/a.ts', 'export const a = 3;\n');
  put(root, 'be/src/untracked.ts', 'export const untracked = 1;\n');
  fs.unlinkSync(path.join(root, 'be/src/deleted.ts'));
  put(root, 'fe/apps/web/src/page.tsx', 'export const foreign = 2;\n');
  const target = binding.targets[0];
  const snapshot = gateInputSnapshot(root, target.head, [], target.owned);
  assert.deepEqual(snapshot.inputs.map((file) => file.path), ['be/src/a.ts', 'be/src/deleted.ts', 'be/src/untracked.ts']);
  assert.equal(snapshot.inputs.find((file) => file.path === 'be/src/deleted.ts').sha256, null);
  assert.equal(snapshot.inputs.find((file) => file.path === 'be/src/a.ts').sha256, sha256File(path.join(root, 'be/src/a.ts')));
  assert.throws(() => gateInputSnapshot(root, target.head, ['fe/apps/web/src/page.tsx'], target.owned), /outside the admitted owned scope/);
  assert.throws(() => captureGateBinding([], { at: Date.now() }), /no resolved target placement/);
  assert.throws(() => captureGateBinding([{ base: root, path: 'be', unresolved: true }], { at: Date.now() }), /unresolved/);
  assert.throws(() => captureGateBinding([{ base: root, path: 'be' }], { at: Date.now(), revision: () => null }), /baseline is unavailable/);
});

test('a bound gate measures only its admitted owned side and retains a real pre-launch baseline', async (t) => {
  const { root, git, base } = appFixture(t);
  const binding = captureGateBinding([{ base: root, path: 'be/**' }], { at: Date.now() });
  put(root, 'be/src/a.ts', 'export const a: number = 2;\n');
  git('commit', '-qam', 'owned slice');
  put(root, 'fe/apps/web/src/page.tsx', 'export const title: number = "parallel red";\n');
  const report = await runGate({ root, changed: [], hfs: hfsStub(t), ts, context: { gateBinding: binding } });
  assert.equal(report.base, base, 'a later HEAD must not replace the dispatch baseline');
  assert.equal(report.exit, GATE_EXIT.clean, JSON.stringify([report.errors, report.findings]));
  assert.deepEqual(report.changed, ['be/src/a.ts']);
  assert.deepEqual(report.steps.tsc.map((step) => step.project), ['be/tsconfig.json']);
});

test('current READ requires every canonical pattern/common input and rejects stale hashes or a foreign root', (t) => {
  const base = tmp(t, 'starci-read-canonical-'), root = tmp(t, 'starci-read-target-');
  const common = 'docs/architecture.md';
  const patterns = ['knowledge/patterns/be/index.yaml', 'knowledge/patterns/be/typing.yaml'];
  put(base, common, 'id: coding-reference\n');
  put(base, patterns[0], 'topics: []\n'); put(base, patterns[1], 'slots: []\n');
  const doc = { digest: { required: [common] }, kinds: { be: { always: ['be/index.yaml', 'be/typing.yaml'] } } };
  const kinds = [{ path: 'be/src/a.ts', slot: 'be.service' }];
  const digest = { schema: DIGEST_SCHEMA, root, touched: ['be/src/a.ts'], files: [common, ...patterns].map((file) => ({
    path: file, role: file === common ? 'knowledge' : 'pattern', sha256: sha256File(path.join(base, file)),
  })) };
  const judge = (value) => judgeReadDigest(value, kinds, doc, { root, base });
  assert.equal(judge(digest).status, 'pass');
  assert.equal(judge({ ...digest, files: digest.files.slice(0, 2) }).status, 'no-pattern', 'one of several applicable patterns is insufficient');
  assert.equal(judgeReadDigest({ ...digest, files: digest.files.slice(0, 2) }, kinds, doc, { root, base, current: false }).status, 'no-pattern', 'a supplied contextless flag cannot waive current READ membership');
  assert.equal(judge({ ...digest, files: digest.files.slice(1) }).status, 'no-pattern', 'the common reference cannot be omitted');
  assert.equal(judge({ ...digest, root: base }).status, 'no-pattern');
  put(base, patterns[1], 'slots: []\nchanged: true\n');
  assert.equal(judge(digest).status, 'no-pattern', 'a well-formed old sha is not current READ');
  fs.unlinkSync(path.join(base, patterns[0]));
  assert.equal(judge(digest).status, 'no-pattern', 'an absent recorded file is not READ');
});

test('current settle refuses omitted or changed inputs but accepts a parallel commit with identical owned bytes', (t) => {
  const { root, git, base } = appFixture(t);
  put(root, 'be/src/a.ts', 'export const a = 2;\n');
  const measured = gateInputSnapshot(root, base, [], ['be']);
  const doc = loadOpGate();
  const paths = [...new Set([...(doc.digest.required ?? []), ...patternsForSlot('be.service', doc)])];
  const digest = { schema: DIGEST_SCHEMA, at: new Date().toISOString(), root, touched: ['be/src/a.ts'],
    files: paths.map((file) => ({ path: file, role: file.startsWith('knowledge/patterns/') ? 'pattern' : 'knowledge', sha256: sha256File(path.join(ROOT, file)) })) };
  const gate = { ...gateDoc(), at: digest.at, root, base, head: measured.head, changed: measured.changed, inputs: measured.inputs };
  const kinds = [{ path: 'be/src/a.ts', slot: 'be.service' }];
  const judge = (value, snapshot = measured) => judgeLoop({ gate: value, digest, kinds, doc, current: true, snapshot });
  assert.equal(judge(gate).status, 'pass');
  assert.equal(judge({ ...gate, changed: [], inputs: [] }).code, 'op-gate-tool-failed');
  put(root, 'fe/apps/web/src/page.tsx', 'export const title = "parallel";\n');
  git('add', 'fe/apps/web/src/page.tsx'); git('commit', '-qm', 'parallel side');
  const parallel = gateInputSnapshot(root, base, [], ['be']);
  assert.notEqual(parallel.head, measured.head);
  assert.equal(judge(gate, parallel).status, 'pass');
  put(root, 'be/src/a.ts', 'export const a = 3;\n');
  assert.equal(judge(gate, gateInputSnapshot(root, base, [], ['be'])).code, 'op-gate-tool-failed');
});

test('a new non-app executable with no declared checker cannot settle as a document-only success', async (t) => {
  const { root } = appFixture(t);
  const placements = [{ base: root, path: 'scripts/**' }];
  const binding = { ...captureGateBinding(placements, { at: Date.now() }), placements };
  put(root, 'scripts/repair.mjs', 'export const repair = () => true;\n');
  const result = await judgeJobLoop({ op: 'knowledge.repair', files: [], binding, doc: loadOpGate(),
    kindResolver: async (_root, files) => files.map((file) => ({ path: file, slot: 'runtime.checker' })) });
  assert.equal(result.judged.code, 'op-gate-proof-missing');
  assert.match(result.judged.detail, /REF-VERIFY-1.*scripts\/repair\.mjs/);
  assert.match(result.judged.detail, /no applicable executable checker/);
});

test('Markdown code fences do not invent an executable lint obligation, while actual app code outside the old op list does', async (t) => {
  const { root } = appFixture(t);
  const placements = [{ base: root, path: '.' }];
  const binding = { ...captureGateBinding(placements, { at: Date.now() }), placements };
  put(root, 'example.md', '```js\nexport const example = 1;\n```\n');
  assert.equal(await judgeJobLoop({ op: 'content.generate', files: [], binding, doc: loadOpGate() }), null);
  put(root, 'be/src/generated.ts', 'export const generated = 1;\n');
  const doc = loadOpGate();
  const required = [...new Set([...(doc.digest.required ?? []), ...patternsForSlot('be.service', doc), ...patternsForSlot('app', doc)])];
  const expected = { slotMap: [{ path: 'be/src/generated.ts', slot: 'be.service' }, { path: 'example.md', slot: 'app' }],
    files: required.map((file) => ({ path: file, role: file.startsWith('knowledge/patterns/') ? 'pattern' : 'knowledge', sha256: sha256File(path.join(ROOT, file)) })) };
  const result = await judgeJobLoop({ op: 'content.generate', files: [], binding, doc,
    kindResolver: async (_root, files) => files.map((file) => ({ path: file, slot: 'be.service' })), readDigest: async () => expected });
  assert.equal(result.judged.code, 'op-gate-proof-missing', 'an op outside enforcedOps cannot omit CHECK after changing an app source');
});

test('a conditional writer with actual resolved app-side source and valid READ cannot omit its bound app CHECK', async (t) => {
  const cases = [
    ['be', 'be/src/modules/domain/billing/invoice.service.ts'],
    ['fe', 'fe/apps/web/src/components/leaves/banner/component.tsx'],
  ];
  for (const [side, file] of cases) {
    const { root } = appFixture(t), placements = [{ base: root, path: `${side}/**` }];
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8')).kind, 'app');
    const binding = { ...captureGateBinding(placements, { at: Date.now() }), placements };
    put(root, file, '/** The private app-side value. */\nexport const value = 1;\n');
    const kinds = await kindsOf(root, [file]);
    assert.equal(kinds.length, 1);
    assert.equal(kinds[0].slot?.split('.')[0], side, JSON.stringify(kinds));
    const doc = loadOpGate();
    assert.ok(!doc.enforcedOps.includes('interface.draw'), 'this actual produced-lint writer inherits CHECK only when its resolved source is app code');
    const digest = await buildReadDigest({ root, touch: [file] });
    assert.equal(judgeReadDigest(digest, kinds, doc, { root, expected: digest }).status, 'pass');
    const abs = path.join(tmp(t, 'starci-conditional-app-read-'), 'read.json');
    fs.writeFileSync(abs, JSON.stringify(digest));
    const result = await judgeJobLoop({ op: 'interface.draw', files: [{ abs, name: 'read-digest.json' }], binding, doc });
    assert.equal(result?.judged.code, 'op-gate-proof-missing', JSON.stringify(result));
    assert.match(result.judged.detail, /no gate JSON/, 'valid READ and a produced-lint profile cannot replace the bound app code gate');
  }
});

test('a tool that could not run is exit 2, never a pass', async (t) => {
  const { root, git, base } = appFixture(t);
  put(root, 'README.md', '# changed\n');
  git('add', '-A'); git('commit', '-qm', 'slice');
  const broken = { dir: tmp(t, 'starci-hfs-broken-'), bin: path.join(ROOT, 'tests', 'no-such-hfs.mjs') };
  const report = await runGate({ root, base, changed: ['README.md'], hfs: broken, ts });
  assert.equal(report.exit, GATE_EXIT.toolFailed);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(' '), /starci app lint produced no starci\/lint@1 report/);
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

test('type prerequisite stamps distinguish M-to-M bytes and deleted inputs, not merely Git status', (t) => {
  const { root, git } = appFixture(t);
  put(root, 'be/src/a.ts', 'export const a: number = 2;\n');
  const dirty = git('status', '--porcelain', '--', 'be/src/a.ts'), first = inputStamp(root, ['.']);
  put(root, 'be/src/a.ts', 'export const a: number = 3;\n');
  assert.equal(git('status', '--porcelain', '--', 'be/src/a.ts'), dirty, 'both edits remain M');
  const second = inputStamp(root, ['.']);
  assert.notEqual(second, first);
  fs.rmSync(path.join(root, 'be/src/a.ts'));
  assert.notEqual(inputStamp(root, ['.']), second, 'deleted input membership changes the stamp');
});

test('codegen inputs and explicit workspace outputs bind bytes, including missing and deleted payloads', (t) => {
  const { root } = appFixture(t);
  const missing = inputStamp(root, ['be/contracts']);
  put(root, 'be/contracts/schema.graphql', 'type Query { ready: Boolean! }\n');
  assert.notEqual(inputStamp(root, ['be/contracts']), missing);
  put(root, 'scripts/codegen.mjs', 'export const revision = 1;\n');
  const before = inputStamp(root, ['.']);
  put(root, 'scripts/codegen.mjs', 'export const revision = 2;\n');
  const after = inputStamp(root, ['.']);
  assert.notEqual(after, before, 'changing the generator invalidates codegen');
  const output = 'fe/packages/public/dist';
  put(root, `${output}/index.d.ts`, 'export declare const value: number;\n');
  assert.equal(inputStamp(root, ['.']), after, 'ordinary input walks exclude dist');
  const built = inputStamp(root, ['.', output]);
  put(root, `${output}/index.d.ts`, 'export declare const value: string;\n');
  assert.notEqual(inputStamp(root, ['.', output]), built, 'an explicit output scope detects stale payloads');
  fs.rmSync(path.join(root, output, 'index.d.ts'));
  assert.notEqual(inputStamp(root, ['.', output]), built);
});

test('a config-only compiler change selects its actual programs and compares the base config', async (t) => {
  const { root, base } = appFixture(t, { baseFiles: { 'be/src/a.ts': 'export const a: number = 1;\nconst unused = 2;\n' } });
  const config = JSON.parse(fs.readFileSync(path.join(root, 'be/tsconfig.json'), 'utf8'));
  config.compilerOptions.noUnusedLocals = true;
  put(root, 'be/tsconfig.json', JSON.stringify(config));
  const report = await runGate({ root, base, changed: ['be/tsconfig.json'], hfs: hfsStub(t), ts });
  assert.equal(report.exit, GATE_EXIT.findings, JSON.stringify(report.errors));
  assert.ok(report.steps.tsc.some((step) => step.project === 'be/tsconfig.json'));
  assert.ok(report.findings.some((finding) => finding.rule === 'TS6133' && finding.path === 'be/src/a.ts'));
});

test('dist prerequisites recognize bare package targets and nested exports without selecting source targets', () => {
  for (const manifest of [{ types: 'dist/index.d.ts' }, { main: 'dist/index.js' }, { module: 'dist/index.mjs' },
    { exports: { '.': { import: './dist/index.mjs', types: './dist/index.d.ts' } } }])
    assert.equal(exposesDist(manifest), true, JSON.stringify(manifest));
  for (const manifest of [{ types: 'src/index.ts' }, { main: 'src/index.js' }, { module: 'distribution/index.js' },
    { exports: { '.': { types: './src/index.ts' } } }])
    assert.equal(exposesDist(manifest), false, JSON.stringify(manifest));
});

test('package-only changes and dist-workspace source changes select existing typed consumers', async (t) => {
  const { root, base } = appFixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  manifest.description = 'changed installation metadata';
  put(root, 'package.json', JSON.stringify(manifest));
  const report = await runGate({ root, base, changed: ['package.json'], hfs: hfsStub(t), ts });
  assert.equal(report.exit, GATE_EXIT.clean, JSON.stringify(report.errors));
  assert.deepEqual(report.steps.tsc.map((step) => step.project), ['be/tsconfig.json', 'fe/apps/web/tsconfig.json']);
  manifest.workspaces.push('fe/packages/*');
  put(root, 'package.json', JSON.stringify(manifest));
  put(root, 'fe/packages/public/package.json', JSON.stringify({ name: '@app/public', exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } } }));
  put(root, 'fe/packages/public/tsconfig.json', JSON.stringify({ include: ['src'] }));
  put(root, 'fe/packages/public/src/index.ts', 'export const value = 1;\n');
  const impact = typeImpact(root, ['fe/packages/public/src/index.ts']);
  assert.deepEqual(impact.errors, []);
  assert.deepEqual(impact.projects, ['be/tsconfig.json', 'fe/apps/web/tsconfig.json', 'fe/packages/public/tsconfig.json']);
});

test('selected TypeScript with no compiler owner or excluded from its program is unmeasured, never green', async (t) => {
  const { root, base } = appFixture(t);
  fs.rmSync(path.join(root, 'be/tsconfig.json'));
  const missing = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(missing.exit, GATE_EXIT.toolFailed);
  assert.match(missing.errors.join(' '), /GATE_TSC_CONFIG_MISSING/);
  const { root: next, base: nextBase } = appFixture(t);
  const config = JSON.parse(fs.readFileSync(path.join(next, 'be/tsconfig.json'), 'utf8'));
  config.exclude = ['src/a.ts'];
  put(next, 'be/tsconfig.json', JSON.stringify(config));
  const excluded = await runGate({ root: next, base: nextBase, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(excluded.exit, GATE_EXIT.toolFailed);
  assert.match(excluded.errors.join(' '), /GATE_TSC_FILE_EXCLUDED/);
});

test('a deleted tsconfig with surviving source fails, while a deleted typed input still selects its owner', (t) => {
  const { root } = appFixture(t);
  fs.rmSync(path.join(root, 'be/src/a.ts'));
  assert.ok(typeImpact(root, ['be/src/a.ts'], { deleted: ['be/src/a.ts'] }).projects.includes('be/tsconfig.json'));
  put(root, 'be/src/survivor.ts', 'export const survivor = 1;\n');
  fs.rmSync(path.join(root, 'be/tsconfig.json'));
  assert.match(typeImpact(root, ['be/tsconfig.json'], { deleted: ['be/tsconfig.json'] }).errors.join(' '), /GATE_TSC_CONFIG_MISSING/);
  fs.rmSync(path.join(root, 'be/src'), { recursive: true });
  put(root, 'be/nested/tsconfig.json', JSON.stringify({ include: ['src'] }));
  put(root, 'be/nested/src/index.ts', 'export const nested = 1;\n');
  assert.deepEqual(typeImpact(root, ['be/tsconfig.json'], { deleted: ['be/tsconfig.json'] }).errors, [], 'a retained nested owner is independent');
});

test('base diagnostics are recomputed when an untracked generated type changes, preserving actual base debt', async (t) => {
  const a = (type, value) => `import type { X, Y } from './generated';\nexport const a: ${type} = '${value}';\n`;
  const { root, git, base } = appFixture(t, { baseFiles: {
    '.gitignore': 'node_modules/\nbe/src/generated.d.ts\n', 'be/src/generated.d.ts': 'export type X = number;\nexport type Y = number;\n', 'be/src/a.ts': a('X', 'base'),
  } });
  put(root, 'be/src/a.ts', a('X', 'first'));
  git('commit', '-qam', 'same base debt');
  const first = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(first.exit, GATE_EXIT.clean, JSON.stringify(first.errors));
  assert.ok(first.counts.preexisting > 0);
  put(root, 'be/src/generated.d.ts', 'export type X = string;\nexport type Y = number;\n');
  put(root, 'be/src/a.ts', a('Y', 'second'));
  git('commit', '-qam', 'new error after generated types changed');
  const second = await runGate({ root, base, changed: ['be/src/a.ts'], hfs: hfsStub(t), ts });
  assert.equal(second.exit, GATE_EXIT.findings, JSON.stringify(second.errors));
  assert.ok(second.findings.some((finding) => finding.rule === 'TS2322' && finding.path === 'be/src/a.ts'));
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

test('judgeLoop: new lint or tsc findings, a tool failure, a missing gate or READ digest refuse; base-only findings need current READ', async () => {
  const kinds = [{ path: 'src/a.ts', slot: null }];
  assert.equal(judgeLoop({ gate: gateDoc(LINT_NEW), digest: digestDoc(), kinds }).code, 'op-gate-new-findings');
  assert.match(judgeLoop({ gate: gateDoc(TSC_NEW), digest: digestDoc(), kinds }).findings[0], /tsc\/TS2322/);
  assert.equal(judgeLoop({ gate: gateDoc({ exit: 2, errors: ['tsc could not run'] }), digest: digestDoc(), kinds }).code, 'op-gate-tool-failed');
  assert.equal(judgeLoop({ gate: null, digest: digestDoc(), kinds }).code, 'op-gate-proof-missing');
  assert.equal(judgeLoop({ gate: gateDoc(), digest: null, kinds }).code, 'op-read-digest-missing');
  assert.equal(judgeLoop({ gate: gateDoc(), digest: digestDoc([{ path: 'examples/x/be/a.ts', role: 'example', sha256: SHA }]), kinds }).code, 'op-read-digest-no-pattern');
  assert.equal(judgeLoop({ gate: gateDoc(PREEXISTING_ONLY), digest: digestDoc(), kinds }).code, 'op-read-digest-no-pattern', 'fabricated attachment hashes are never current READ');
  const recorded = await buildReadDigest({ root: ROOT, touch: [] });
  assert.equal(judgeLoop({ gate: gateDoc(PREEXISTING_ONLY), digest: recorded, kinds: [] }).status, 'pass');
});

test('actual bound gate and READ bytes are selected from extensionless blobs by schema', async t => {
  const {root,base}=appFixture(t),store=tmp(t),placement={base:root,path:'be/**'};
  const binding={...captureGateBinding([placement],{at:Date.now()-1000}),placements:[placement]};
  const digest=await buildReadDigest({root,touch:[]});
  const gate=await runGate({root,base,changed:[],hfs:hfsStub(t),ts});
  assert.equal(gate.exit,GATE_EXIT.clean,JSON.stringify(gate));
  const file=(body,name)=>({abs:path.join(store,put(store,name,body)),name:'opaque-artifact'});
  const gateFile=file(JSON.stringify(gate),'opaque-gate'),readFile=file(JSON.stringify(digest),'opaque-read');
  const judge=files=>judgeJobLoop({op:'code.refactor',files,binding});
  assert.equal((await judge([gateFile,readFile])).judged.status,'pass');
  for(const body of ['{ malformed',JSON.stringify({schema:'unrelated/proof@1'})]){
    assert.equal((await judge([file(body,'bad-gate'),readFile])).judged.code,'op-gate-proof-missing');
    assert.equal((await judge([gateFile,file(body,'bad-read')])).judged.code,'op-read-digest-missing');
  }
  const failed=file(JSON.stringify({...gate,exit:2,errors:['checker unavailable']}),'unavailable');
  assert.equal((await judge([failed,readFile])).judged.code,'op-gate-tool-failed');
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

function seedOps(t, cases) {
  const base = tmp(t, 'starci-op-gate-settle-'), repo = path.join(base, 'main');
  fs.mkdirSync(repo);
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(base, 'machine.sqlite'), STARCI_LOCAL_ROOT: path.join(base, 'localappdata'),
    STARCI_PROJECTS_ROOT: path.join(base, 'projects'), STARCI_ARTIFACT_ROOT: path.join(base, 'artifacts'),
    STARCI_LOCAL_ROOT: path.join(base, 'local'), STARCI_OWNER_ROOT: path.join(base, 'owner'), STARCI_LANES_ROOT: path.join(base, 'lanes') };
  const git = gitIn(repo);
  git('init', '--quiet', '-b', 'main');
  for (const [k, v] of [['user.email', 'lane@starci.test'], ['user.name', 'lane'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(repo, 'src/a.ts', 'export const a = 1;\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'init');
  const prepared = cases.map(({ label, gate, digest, admitted = null, op = 'test.author' }) => {
    const workflowId = 'wf-' + label, tree = path.join(base, workflowId), branch = 'branch-' + workflowId;
    git('worktree', 'add', '-q', '-b', branch, tree, 'main');
    const treeGit = gitIn(tree), baseline = treeGit('rev-parse', 'HEAD');
    const files = ['src/a.ts'];
    // Bind the proof to the real admitted branch; only runtime settle may checkpoint its owned files.
    if (gate) files.push(put(tree, `src/checks/${label}/gate.json`, JSON.stringify({ ...gate, root: tree.replace(/\\/g, '/'), base: baseline, head: baseline })));
    if (digest) files.push(put(tree, `src/checks/${label}/read-digest.json`, JSON.stringify(digest)));
    return { label, op, files, admitted, tree, branch, treeGit, workflowId, jobId: `op-${op}-${label}` };
  });
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  try {
    for (const { label, op, files, jobId, admitted, tree, branch, treeGit, workflowId } of prepared) {
      registerWorkflowWorktree({ env }, { workflowId, orcaWorktreeId: 'fixture::' + workflowId, path: tree, branch });
      seedWorkflow(ledger, { id: `wf-${label}`, state: { phase: 'running', job: 'impl' },
        jobs: [{ jobId, opId: op, dispatchId: `ctx-${jobId}`, terminalHandle: `term-${jobId}`, status: 'running',
          payload: { opId: op, owned_paths: ['src/'], orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } }] });
      const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
      ledger.transaction((db) => {
        writeContract(db, { attemptId, markdown: '# contract', context: { worktree: tree, ...(admitted ? { contract: admitted } : {}) }, createdAt: Date.now() - 1000 });
        fileReport(db, { attemptId, outcome: 'done', createdAt: Date.parse('2026-10-01T09:00:00.000Z'),
          report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'slice', files, head: treeGit('rev-parse', 'HEAD') } });
        for (const check of [{ name: 'owned-paths-committed', command: 'git show' }, { name: 'owned-paths-clean', command: 'git status' }, { name: 'head-ancestor', command: 'git merge-base' }])
          recordCheckRun(db, { attemptId, name: check.name, phase: 'verify', runner: 'kernel', authority: 'runtime', status: 'pass', exitCode: 0, command: check.command });
      });
    }
  } finally { ledger.close(); }
  return { repo, env, jobs: new Map(prepared.map(({ label, jobId }) => [label, jobId])) };
}
const settle = ({ repo, env }, jobId) => new Promise((resolve) => {
  const child = spawn(process.execPath, [API, 'settle', '--repo', repo, '--job', jobId, '--verdict', 'pass', '--sync-tail', '--json'], { cwd: ROOT, windowsHide: true, env });
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
const read = ({ repo, env }, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return fn(l.db); } finally { l.close(); } };

test('native settlement refuses every admission missing its captured target baseline', async t => {
  const common={gate:gateDoc(PREEXISTING_ONLY),digest:digestDoc()};
  const cases=[{...common,label:'early',admitted:{schema:CONTRACT_VERSION_SCHEMA,op:'test.author',runtimeSha:'b'.repeat(40),digest:SHA,files:[],admittedAt:1}},
    {...common,label:'current',admitted:{schema:CONTRACT_VERSION_SCHEMA,op:'test.author',runtimeSha:'b'.repeat(40),digest:SHA,files:[],admittedAt:Date.now()-1000}}];
  const seeded=seedOps(t,cases);
  for(const row of cases){const job=seeded.jobs.get(row.label),result=await settle(seeded,job);
    assert.equal(result.r.status,1,result.r.stdout || result.r.stderr);
    assert.equal(result.body?.reason,'op-gate-proof-missing',result.r.stdout);
    assert.equal(read(seeded,db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job).status),'running');
  }
});

test('paper gate/read attachments cannot replace native admitted baseline custody', async t => {
  const cases=[['lint',gateDoc(LINT_NEW),digestDoc()],['tsc',gateDoc(TSC_NEW),digestDoc()],['noread',gateDoc(PREEXISTING_ONLY),null],['base-only',gateDoc(PREEXISTING_ONLY),digestDoc()]];
  const seeded=seedOps(t,cases.map(([label,gate,digest])=>({label,gate,digest})));
  for(const [label]of cases){const job=seeded.jobs.get(label),result=await settle(seeded,job);
    assert.equal(result.r.status,1,result.r.stdout || result.r.stderr);
    assert.equal(result.body?.reason,'op-gate-proof-missing',result.r.stdout);
    assert.equal(read(seeded,db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job).status),'running');
    assert.equal(read(seeded,db=>db.prepare("SELECT status FROM check_runs WHERE attempt_id=(SELECT attempt_id FROM op_attempts WHERE job_id=?) AND name='op-gate' ORDER BY check_id DESC").get(job).status),'fail');
  }
});

test('the prescribed no-touch unit READ producer carries the required common input into the qualified native judge', async t=>{
  const {root,base}=appFixture(t);
  const binding={...captureGateBinding([{base:root,path:'be/**'}],{at:Date.now()}),placements:[{base:root,path:'be/**'}]};
  const file=path.join(tmp(t),'unit-read.json');
  const run=spawnSync(process.execPath,[path.join(ROOT,'scripts','cli','gate-read.mjs'),'--root',root,
    '--knowledge','knowledge/patterns/be/test.yaml','--out',file],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const digest=JSON.parse(fs.readFileSync(file,'utf8'));
  const expected=await buildReadDigest({root,touch:[]});
  assert.equal(judgeReadDigest(digest,[],loadOpGate(),{root,current:true,expected}).status,'pass');
  const gate=await runGate({root,base,changed:[],hfs:hfsStub(t),ts});
  assert.equal(gate.exit,GATE_EXIT.clean,JSON.stringify(gate));
  const gateFile=path.join(path.dirname(file),'unit-gate.json');fs.writeFileSync(gateFile,JSON.stringify(gate));
  const judge=()=>judgeJobLoop({op:'unit.verify',files:[{abs:file,name:'unit-read.json'},{abs:gateFile,name:'unit-gate.json'}],binding});
  assert.equal((await judge()).judged.status,'pass');
  const required=loadOpGate().digest.required[0];
  fs.writeFileSync(file,JSON.stringify({...digest,files:digest.files.filter(f=>f.path!==required)}));
  assert.notEqual((await judge()).judged.status,'pass','omitting the common source input still refuses');
  fs.writeFileSync(file,JSON.stringify({...digest,files:digest.files.map(f=>f.path===required?{...f,sha256:'0'.repeat(64)}:f)}));
  assert.notEqual((await judge()).judged.status,'pass','a fabricated current hash still refuses');
});

test('coding READ selects complete topic references without forcing an unrelated catalog member', async (t) => {
  const base = tmp(t, 'starci-read-reference-'), root = tmp(t, 'starci-read-reference-target-');
  const inherited = 'be/base-tsconfig.json', sourceFiles = ['be/src/a.ts', 'be/src/b.ts', 'be/contracts/events.json', inherited];
  put(base, 'modules/schemas/code-example-catalog.schema.yaml', fs.readFileSync(path.join(ROOT, 'modules/schemas/code-example-catalog.schema.yaml')));
  put(base, 'docs/architecture.md', 'the selected common law\n');
  put(base, 'knowledge/patterns/be/index.yaml', 'topics: [{path: test.yaml}]\n');
  put(base, 'knowledge/patterns/be/test.yaml', 'slots: [be.module.service]\nrules: [{relatedExamples: [complete-reference, docs/architecture.md]}]\n');
  const app = path.dirname(EXAMPLE_CATALOG_FILE) + '/private-app';
  put(base, `${app}/hfs.json`, JSON.stringify({ kind: 'app' }));
  for (const file of sourceFiles) put(base, `${app}/${file}`, file.endsWith('.json') ? '{}\n' : '/** The private reference value. */\nexport const value = 1;\n');
  const inheritedBytes = JSON.stringify({ compilerOptions: { strict: true } })+'\n';
  put(base, `${app}/${inherited}`, inheritedBytes);
  put(base, `${app}/be/tsconfig.json`, JSON.stringify({ extends: './base-tsconfig.json', include: ['src/**/*.ts'] })+'\n');
  put(base, `${app}/be/owner.spec.ts`, '/** The private owner test. */\nexport const tested = true;\n');
  const row = { id: 'complete-reference', path: 'private-app', lane: 'backend', title: 'Complete private reference', summary: 'All selected owner inputs.',
    relatedRules: ['R89'], files: sourceFiles, entrypoint: sourceFiles[0], projects: ['be/tsconfig.json'], tests: ['be/owner.spec.ts'] };
  const other = { ...row, id: 'other-reference', files: ['be/src/other.ts'], entrypoint: 'be/src/other.ts', tests: [] };
  put(base, `${app}/be/src/other.ts`, '/** An unrelated reference. */\nexport const other = 1;\n');
  put(base, EXAMPLE_CATALOG_FILE, JSON.stringify({ schema: 'starci/code-example-catalog@1', title: 'Private references', purpose: 'Exercise complete READ selection.', examples: [row, other] }));
  const hfsDir = tmp(t, 'starci-read-explain-');
  put(hfsDir, 'runtime/scripts/hfs/check.mjs', 'export const explainPath = ({input}) => ({path: input, slot: "be.module.service", status: "declared"});\n');
  const doc = { digest: { required: ['docs/architecture.md'] }, examples: { catalog: EXAMPLE_CATALOG_FILE }, kinds: { be: { always: ['be/index.yaml'] } } };
  const digest = await buildReadDigest({ root, touch: ['be/src/target.ts'], base, doc, hfs: { dir: hfsDir, bin: 'unused' } });
  assert.deepEqual(digest.files.filter((file) => file.role === 'example').map((file) => file.path), [EXAMPLE_CATALOG_FILE, ...[...sourceFiles, ...row.projects, ...row.tests].map((file) => `${app}/${file}`)]);
  assert.equal(digest.files.some((file) => file.path.endsWith('/other.ts')), false, 'a coded topic does not owe an unrelated catalog ID');
  for (const file of digest.files) assert.equal(file.sha256, sha256File(path.join(base, file.path)));
  const kinds = [{ path: 'be/src/target.ts', slot: 'be.module.service' }];
  assert.equal(judgeReadDigest(digest, kinds, doc, { root, base, current: true, expected: digest }).status, 'pass');
  const inheritedPath = `${app}/${inherited}`, inheritedEntries = digest.files.filter(file => file.path === inheritedPath);
  assert.equal(inheritedEntries.length, 1, 'the declared inherited JSON input is recorded once');
  assert.equal(row.projects.includes(inherited), false, 'READ coverage never creates an ancestor compiler program');
  const dropped = { ...digest, files: digest.files.filter(file => file.path !== inheritedPath) };
  assert.equal(judgeReadDigest(dropped, kinds, doc, { root, base, expected: digest }).status, 'no-pattern', 'a READ digest that omits its inherited config refuses');
  const duplicated = { ...digest, files: [...digest.files, inheritedEntries[0]] };
  assert.equal(judgeReadDigest(duplicated, kinds, doc, { root, base, expected: digest }).status, 'no-pattern', 'duplicate inherited input is refused rather than silently deduplicated');
  put(base, inheritedPath, JSON.stringify({ compilerOptions: { strict: false } })+'\n');
  assert.equal(judgeReadDigest(digest, kinds, doc, { root, base, expected: digest }).status, 'no-pattern', 'valid but changed inherited JSON invalidates its recorded hash');
  put(base, inheritedPath, inheritedBytes);
  put(base, `${app}/be/src/b.ts`, '/** The changed private reference. */\nexport const value = 2;\n');
  assert.equal(judgeReadDigest(digest, kinds, doc, { root, base, current: true, expected: digest }).status, 'no-pattern');
  try {
    fs.unlinkSync(path.join(base, inheritedPath));
    await assert.rejects(buildReadDigest({ root, touch: ['be/src/target.ts'], base, doc, hfs: { dir: hfsDir, bin: 'unused' } }), /ENOENT/, 'a missing declared inherited config cannot become a partial READ');
  } finally { put(base, inheritedPath, inheritedBytes); }
  put(base, 'knowledge/patterns/be/test.yaml', 'slots: [be.module.service]\nrules: [{relatedExamples: [unknown-reference]}]\n');
  await assert.rejects(buildReadDigest({ root, touch: ['be/src/target.ts'], base, doc, hfs: { dir: hfsDir, bin: 'unused' } }), /unknown example id/);
});
