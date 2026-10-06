// The mechanism proofs (knowledge/op-gate.yaml proofs/opProofs): every op whose job touches a
// runtime mechanism attaches the document that mechanism prints, and `starci kernel settle` re-reads it (scripts/kernel/gate-settle.mjs
// judgeJobProofs, runtime check op-proof) and refuses a done that lacks it, is red or could not run. One spec per refusal code,
// the producers' own judgments (test-world-run.mjs, unit-run.mjs, release-proof.mjs, starci gate run --scope docs, read-digest.mjs
// --knowledge), and starci kernel settle end to end for a documenting, a test-world and a reviewing op.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileReport, inspectLedger, ledgerFileFor, openLedger, writeContract, recordCheckRun } from '../../engine/db/ledger.mjs';
import { DOC_PROFILE, GATE_SCHEMA, LINT_SCHEMA, parseGateArgs, runDocGate } from '../../scripts/gates/gate.mjs';
import { DIGEST_SCHEMA, buildReadDigest, judgeKnowledgeDigest, loadOpGate } from '../../scripts/gates/read-digest.mjs';
import { TEST_WORLD_RUN_SCHEMA, buildTestWorldRun, judgeSpec, testWorldRules } from '../../scripts/gates/test-world-run.mjs';
import { UNIT_RUN_SCHEMA, judgeServices, unitFindings, unitKitRules } from '../../scripts/gates/unit-run.mjs';
import { RELEASE_PROOF_SCHEMA, RELEASE_STEPS, appInstallsStep, buildReleaseProof, scaffoldInvocation } from '../../scripts/gates/release-proof.mjs';
import {
  REVIEW_DEFECTS_SCHEMA, SECURITY_FINDINGS_SCHEMA, captureGateBinding, judgeDocGate, judgeJobLoop, judgeJobProofs, judgeKnowledgeRead, judgeLint, judgeRelease, judgeReviewDefects,
  judgeReviewGate, judgeSecurityLint, judgeTestWorld, judgeTestWorlds, judgeUnitRun, feRelevant, proofsOf, securityRelevant,
} from '../../scripts/kernel/gate-settle.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { exampleSourcePaths } from '../../scripts/lib/example-refs.mjs';
import { readCatalog } from '../../scripts/checks/check-failure-codes.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { greenDocGate, greenGate, greenLint, greenReadDigest, greenReleaseProof, greenReviewDefects, greenTestWorldRun, greenUnitRun } from '../helpers/sonar-scan.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const SHA = 'a'.repeat(64);
const tmp = (t, prefix = 'starci-op-proof-') => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const put = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return rel; };
const gitIn = (cwd) => (...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const codeOf = (judged) => judged.code;

// ---- the data and the codes ----

test('op-gate.yaml: every op named in opProofs exists, every proof is defined, and every refusal code is catalogued', () => {
  const doc = loadOpGate();
  const ops = new Set(fs.readdirSync(path.join(ROOT, 'modules', 'ops', 'ops')).map((f) => f.replace(/\.yaml$/, '')));
  for (const [op, entries] of Object.entries(doc.opProofs)) {
    assert.ok(ops.has(op), `${op} is an op`);
    for (const e of entries) assert.ok(doc.proofs[typeof e === 'string' ? e : e.proof], `${op}: proof ${JSON.stringify(e)} is defined`);
  }
  for (const [id, proof] of Object.entries(doc.proofs)) if (proof.script) assert.ok(fs.existsSync(path.join(ROOT, proof.script)), `${id}: ${proof.script} exists`);
  const catalog = readCatalog(ROOT);
  for (const code of ['op-read-digest-missing', 'op-doc-gate-missing', 'op-test-world-hand-rolled', 'op-unit-proof-missing', 'op-lint-proof-missing', 'op-review-defects-missing', 'op-release-proof-missing'])
    assert.ok(catalog[code], `${code} has a current failure-codes entry`);
});

test('proofsOf: a moded proof is owed only by its modes; select and an unknown mode owe every proof', () => {
  assert.deepEqual(proofsOf('review.verify', { mode: 'delivery' }), ['review-gate', 'review-defects']);
  assert.deepEqual(proofsOf('review.verify', { mode: 'visual' }), ['review-defects']);
  assert.deepEqual(proofsOf('review.verify', { mode: 'lint' }), [], 'a lint measurement owes neither review proof');
  assert.deepEqual(proofsOf('review.verify', { mode: 'select' }), ['review-gate', 'review-defects']);
  assert.deepEqual(proofsOf('release.deliver', { mode: 'migrate' }), []);
  assert.deepEqual(proofsOf('release.deliver', { mode: 'publish' }), ['release']);
  assert.deepEqual(proofsOf('docs.author'), ['read-knowledge', 'doc-gate']);
  assert.deepEqual(proofsOf('goal.revise'), []);
});

// ---- read-knowledge ----

test('read-knowledge: no digest is op-read-digest-missing; no knowledge file or an unmapped record is op-read-digest-no-knowledge', () => {
  assert.equal(codeOf(judgeKnowledgeRead(null)), 'op-read-digest-missing');
  const noKnowledge = { schema: DIGEST_SCHEMA, touched: [], slotMap: [], files: [{ path: 'be/src/a.ts', role: 'read', sha256: SHA }] };
  assert.equal(codeOf(judgeKnowledgeRead(noKnowledge)), 'op-read-digest-no-knowledge');
  const badSha = { schema: DIGEST_SCHEMA, touched: [], slotMap: [], files: [{ path: 'knowledge/hfs/rules.yaml', role: 'knowledge', sha256: 'nope' }] };
  assert.equal(codeOf(judgeKnowledgeRead(badSha)), 'op-read-digest-no-knowledge');
  const unmapped = { schema: DIGEST_SCHEMA, touched: ['.starciwork/features/a/br/b/index.yaml'], slotMap: [], files: [{ path: 'knowledge/hfs/rules.yaml', role: 'knowledge', sha256: SHA }] };
  assert.equal(codeOf(judgeKnowledgeRead(unmapped)), 'op-read-digest-no-knowledge');
  assert.equal(judgeKnowledgeRead(greenReadDigest()).status, 'pass');
});

test('read-digest records declared law and knowledge hashes but refuses undeclared or escaping canonical reads', async (t) => {
  const app = tmp(t);
  const hfs = { dir: app, bin: path.join(app, 'none.mjs') };
  const digest = await buildReadDigest({ root: app, touch: [], knowledge: ['knowledge/hfs/rules.yaml', 'knowledge/patterns/be/test.yaml'], hfs });
  const required = loadOpGate().digest.required;
  assert.ok(required.includes('docs/architecture.md') && required.includes('docs/code-pattern-enforcement.md'), 'both current law owners are required');
  const expected = new Map(required.map((rel) => [rel, [rel, 'knowledge']]));
  expected.set(loadOpGate().examples.catalog, [loadOpGate().examples.catalog, 'example']);
  for (const rel of exampleSourcePaths(ROOT)) expected.set(rel, [rel, 'example']);
  for (const [rel, role] of [['knowledge/hfs/rules.yaml', 'knowledge'], ['knowledge/patterns/be/test.yaml', 'pattern']])
    if (!expected.has(rel)) expected.set(rel, [rel, role]);
  assert.deepEqual(digest.files.map((f) => [f.path, f.role]), [...expected.values()]);
  for (const file of digest.files) assert.equal(file.sha256, sha256File(path.join(ROOT, file.path)), `${file.path}: exact current canonical bytes`);
  assert.equal(judgeKnowledgeDigest(digest).status, 'pass');
  await assert.rejects(buildReadDigest({ root: app, touch: [], knowledge: ['scripts/kernel/cli.mjs'], hfs }), /not declared canonical knowledge/);
  const declared = await buildReadDigest({ root: app, touch: [], knowledge: ['docs/architecture.md', 'docs/code-pattern-enforcement.md'], hfs });
  assert.equal(judgeKnowledgeDigest(declared).status, 'pass');
  for (const rel of ['docs/debugging.md', 'knowledge/../docs/debugging.md', '../CONTEXT.md'])
    await assert.rejects(buildReadDigest({ root: app, touch: [], knowledge: [rel], hfs }), /not declared canonical knowledge/, rel);
  const missingLaw = structuredClone(loadOpGate()); missingLaw.digest.required.push('knowledge/private-fixture-missing-common-law.yaml');
  await assert.rejects(buildReadDigest({ root: app, touch: [], knowledge: ['knowledge/hfs/rules.yaml'], hfs, doc: missingLaw }), /ENOENT/, 'a missing required common law cannot be silently omitted');
});

// ---- doc-gate ----

test('doc-gate: missing (or a code gate) is op-doc-gate-missing, a check that cannot run op-doc-gate-tool-failed, a refusal op-doc-gate-red', () => {
  assert.equal(codeOf(judgeDocGate(null)), 'op-doc-gate-missing');
  assert.equal(codeOf(judgeDocGate(greenGate())), 'op-doc-gate-missing', 'a code gate is not the document gate');
  assert.equal(codeOf(judgeDocGate({ ...greenDocGate(), exit: 2, errors: ['check-work-deep could not run (exit 3)'] })), 'op-doc-gate-tool-failed');
  assert.equal(codeOf(judgeDocGate({ ...greenDocGate(), exit: 1, counts: { new: 1 }, findings: [{ engine: 'doc', rule: 'doc-language', path: 'docs/a.md', line: 3, message: 'docs/a.md:3 not English' }] })), 'op-doc-gate-red');
  assert.equal(judgeDocGate(greenDocGate()).status, 'pass');
});

test('a declared document gate cannot supply an executable checker for newly changed non-app source', async (t) => {
  const repo = tmp(t, 'starci-op-proof-profile-'), git = gitIn(repo);
  git('init', '-q', '--template=', '-b', 'main');
  for (const [key, value] of [['user.name', 'fixture'], ['user.email', 'fixture@starci.test'],
    ['commit.gpgsign', 'false'], ['core.hooksPath', path.join(repo, 'no-hooks')]]) git('config', key, value);
  put(repo, 'README.md', '# private runtime fixture\n');
  git('add', '-A'); git('commit', '-q', '-m', 'private baseline');
  const placements = [{ base: repo, path: 'scripts' }];
  const binding = { ...captureGateBinding(placements, { at: Date.now() }), placements };
  put(repo, 'scripts/repair.mjs', 'export const repair = () => true;\n');
  // The actual kind/READ owners run; no gate or READ stub can supply the missing executable profile.
  for (const op of ['docs.author', 'knowledge.repair', 'work.author']) {
    const result = await judgeJobLoop({ op, files: [], binding });
    assert.equal(result.judged.code, 'op-gate-proof-missing', op);
    assert.match(result.judged.detail, /REF-VERIFY-1.*scripts\/repair\.mjs/, op);
    assert.match(result.judged.detail, /no applicable executable checker/, op);
  }
  const review = await judgeJobLoop({ op: 'review.verify', mode: 'delivery', files: [], binding });
  assert.equal(review.judged.code, 'op-read-digest-missing', 'the declared code review profile remains executable and still requires READ');
});

test('gate run --scope docs runs every docChecks script: exit 1 is a finding, a crash or another exit is a tool failure', () => {
  assert.equal(parseGateArgs(['--scope', 'docs', '--tree', 'x']).profile, DOC_PROFILE);
  assert.throws(() => parseGateArgs(['--scope', 'lint']), /--scope must be one of/);
  assert.throws(() => parseGateArgs(['--tree', 'x']), /--tree belongs to --scope docs/);
  const checks = [{ id: 'a', script: 'a.mjs', tree: false }, { id: 'b', script: 'b.mjs', tree: true }];
  const seen = [];
  const answers = { 'a.mjs': { status: 0, stdout: 'ok' }, 'b.mjs': { status: 1, stdout: 'REFUSE docs/x.md:4 a refusal\n1 refused' } };
  const spawn = (args) => { seen.push(args.slice(1)); return { ...answers[path.basename(args[0])], stderr: '' }; };
  const red = runDocGate({ tree: ROOT, checks, spawn });
  assert.equal(red.profile, DOC_PROFILE);
  assert.equal(red.exit, 1);
  assert.deepEqual(seen, [[], ['--tree', ROOT]], 'only a tree check gets --tree');
  assert.deepEqual(red.findings.map((f) => [f.rule, f.path, f.line]), [['b', 'docs/x.md', 4]]);
  const crash = runDocGate({ checks, spawn: () => ({ status: 1, stdout: '', stderr: "Error: Cannot find module 'typescript'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)" }) });
  assert.equal(crash.exit, 2, 'an uncaught exception exits 1 but is a tool failure');
  assert.match(crash.errors[0], /could not run.*Cannot find module/);
  const green = runDocGate({ checks, spawn: () => ({ status: 0, stdout: '', stderr: '' }) });
  assert.equal(green.exit, 0);
  assert.equal(judgeDocGate(green).status, 'pass');
});

// ---- test-world ----

const RULES = testWorldRules(ROOT);
const worldSpec = (body) => `import { useTestWorld } from "@tests/world/use-test-world"\n${body}\n`;

test('test-world-run judges each spec: useTestWorld with the layer mode, forbidden infrastructure, outage calls; comments do not count', () => {
  const e2e = judgeSpec('be/src/tests/e2e/a.e2e-spec.ts', worldSpec('const world = useTestWorld({ apps: { shop: { module: ShopApp } } })\n// no docker run here\nawait world.infra.postgresql.cut()\nawait world.infra.postgresql.restore()'), RULES);
  assert.deepEqual([e2e.useTestWorld, e2e.modes, e2e.outage, e2e.forbidden], [true, ['apps'], 2, []]);
  const integration = judgeSpec('be/src/tests/integration/a.integration-spec.ts', worldSpec('const world = useTestWorld({ modules: CATALOG_MODULES })'), RULES);
  assert.deepEqual(integration.modes, ['modules']);
  const rolled = judgeSpec('be/src/tests/e2e/b.e2e-spec.ts', 'import { GenericContainer } from "testcontainers"\nconst url = process.env.DB_URL\nconst ds = new DataSource({})', RULES);
  assert.equal(rolled.useTestWorld, false);
  assert.deepEqual(rolled.forbidden.sort(), ['new DataSource(', 'process.env', 'testcontainers'].sort());
});

function worldApp(t, specs, { preset = true, declaration = true } = {}) {
  const app = tmp(t, 'starci-op-proof-world-');
  put(app, 'be/jest.config.js', preset ? 'module.exports = require("@starci/jest-preset").starciJestConfig()\n' : 'module.exports = { testMatch: ["**/*.e2e-spec.ts"] }\n');
  if (declaration) put(app, 'be/src/tests/world/test-world.config.ts', 'export const { useTestWorld, useSandbox } = defineTestWorld({ stack: ".starcistacks/dev" })\n');
  for (const [rel, body] of Object.entries(specs)) put(app, rel, body);
  return app;
}
const jestRun = (over = {}) => (args) => {
  const out = args.find((a) => a.startsWith('--outputFile=')).slice('--outputFile='.length);
  const counts = { numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, ...over };
  const statuses = ['passed', 'failed', 'pending', 'todo'].flatMap((status, i) => Array.from({ length: counts[['numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'][i]] }, () => ({ status })));
  fs.writeFileSync(out, JSON.stringify({ ...counts, numTotalTestSuites: 1, numPassedTestSuites: counts.numFailedTests ? 0 : 1,
    numFailedTestSuites: counts.numFailedTests ? 1 : 0, numPendingTestSuites: 0, numRuntimeErrorTestSuites: 0,
    success: !counts.numFailedTests, wasInterrupted: false,
    testResults: [{ name: 'fixture.spec.ts', status: counts.numFailedTests ? 'failed' : counts.numPendingTests ? 'focused' : 'passed', assertionResults: statuses }] }));
  return { status: over.numFailedTests ? 1 : 0, stdout: '', stderr: '' };
};

test('test-world: missing is op-test-world-proof-missing, a hand-rolled world op-test-world-hand-rolled, a red run op-test-world-run-red', (t) => {
  assert.equal(codeOf(judgeTestWorld(null)), 'op-test-world-proof-missing');
  const good = { 'be/src/tests/e2e/a.e2e-spec.ts': worldSpec('const world = useTestWorld({ apps: { shop: true } })') };
  const green = buildTestWorldRun({ root: worldApp(t, good), project: 'e2e', rules: RULES, npm: jestRun() });
  assert.equal(green.schema, TEST_WORLD_RUN_SCHEMA);
  assert.equal(green.exit, 0);
  assert.equal(judgeTestWorld(green).status, 'pass');
  for (const [label, app, project] of [
    ['no preset', worldApp(t, good, { preset: false }), 'e2e'],
    ['no declaration', worldApp(t, good, { declaration: false }), 'e2e'],
    ['wrong layer', worldApp(t, { 'be/src/tests/integration/a.integration-spec.ts': worldSpec('const world = useTestWorld({ apps: { shop: true } })') }), 'integration'],
    ['docker', worldApp(t, { 'be/src/tests/e2e/a.e2e-spec.ts': worldSpec('const world = useTestWorld({ apps: { shop: true } })\nexecSync("docker run postgres")') }), 'e2e'],
    ['no specs', worldApp(t, {}), 'e2e'],
  ]) {
    const summary = buildTestWorldRun({ root: app, project, rules: RULES, npm: jestRun() });
    assert.equal(codeOf(judgeTestWorld(summary)), 'op-test-world-hand-rolled', label);
  }
  // A summary whose findings list was emptied by hand is judged from its recorded specs, not from its findings field.
  const doctored = { ...greenTestWorldRun(), specs: [{ path: 'be/src/tests/e2e/a.e2e-spec.ts', useTestWorld: false, modes: [], outage: 0, forbidden: [] }], findings: [] };
  assert.equal(codeOf(judgeTestWorld(doctored)), 'op-test-world-hand-rolled');
  const failed = buildTestWorldRun({ root: worldApp(t, good), project: 'e2e', rules: RULES, npm: jestRun({ numFailedTests: 1, numPassedTests: 1 }) });
  assert.equal(codeOf(judgeTestWorld(failed)), 'op-test-world-run-red');
  const skipped = buildTestWorldRun({ root: worldApp(t, good), project: 'e2e', rules: RULES, npm: jestRun({ numPendingTests: 1, numPassedTests: 1 }) });
  assert.equal(codeOf(judgeTestWorld(skipped)), 'op-test-world-run-red', 'a skipped scenario is never green');
  const none = buildTestWorldRun({ root: worldApp(t, good), project: 'e2e', rules: RULES, npm: () => ({ status: 1, stdout: '', stderr: 'jest: not found' }) });
  assert.equal(none.exit, 2);
  assert.equal(codeOf(judgeTestWorld(none)), 'op-test-world-run-red');
});

test('test-world over every attached summary: each required project is owed, and a red contract run beside a green integration run refuses', () => {
  assert.equal(codeOf(judgeTestWorlds([greenTestWorldRun('e2e')], ['integration'])), 'op-test-world-proof-missing', 'an e2e run never stands in for the integration layer');
  assert.equal(judgeTestWorlds([greenTestWorldRun('integration')], ['integration']).status, 'pass');
  const redContract = { ...greenTestWorldRun('contract'), run: { ...greenTestWorldRun('contract').run, skipped: 2, passed: 0, total: 2 } };
  assert.equal(codeOf(judgeTestWorlds([greenTestWorldRun('integration'), redContract], ['integration'])), 'op-test-world-run-red', 'a contract spec that skipped itself is no live proof');
  const sandbox = judgeSpec('be/src/tests/contract/sepay/a.contract-spec.ts', 'const client = useSandbox({ provider: "sepay", keys: ["SEPAY_KEY"] })', RULES);
  assert.deepEqual([sandbox.useTestWorld, sandbox.modes], [true, ['sandbox']]);
  const appsInContract = judgeSpec('be/src/tests/contract/a.contract-spec.ts', 'const world = useTestWorld({ apps: { shop: true } })', RULES);
  const summary = { ...greenTestWorldRun('contract'), specs: [appsInContract] };
  assert.equal(codeOf(judgeTestWorld(summary)), 'op-test-world-hand-rolled', 'a contract spec takes the sandbox, not a booted app');
});

// ---- unit-kit ----

function unitApp(t, { spec = 'Test.createTestingModule({ providers: [OrderService] })' } = {}) {
  const app = tmp(t, 'starci-op-proof-unit-');
  put(app, 'be/src/modules/domain/order/order.service.ts', 'export class OrderService { run() { return 1 } }\n');
  if (spec !== null) put(app, 'be/src/modules/domain/order/order.service.spec.ts', `import { Test } from "@nestjs/testing"\nconst m = await ${spec}\n`);
  put(app, 'be/src/tests/world/kit.service.ts', 'export class KitService {}\n');
  return app;
}
const fullCoverage = (app) => ({ total: {}, [path.join(app, 'be/src/modules/domain/order/order.service.ts')]: Object.fromEntries(['lines', 'branches', 'functions', 'statements'].map((m) => [m, { pct: 100 }])) });
const unitSummary = (app, coverage, run = greenUnitRun().run) => {
  const s = { schema: UNIT_RUN_SCHEMA, at: 'x', root: app, run, services: judgeServices(app, coverage, unitKitRules(ROOT)), findings: [] };
  return { ...s, findings: unitFindings(s) };
};

test('unit-kit: missing, red run, coverage below 100, spec missing and an off-kit spec each refuse with their code', (t) => {
  assert.equal(codeOf(judgeUnitRun(null)), 'op-unit-proof-missing');
  const app = unitApp(t);
  const green = unitSummary(app, fullCoverage(app));
  assert.deepEqual(green.services.map((s) => s.path), ['be/src/modules/domain/order/order.service.ts'], 'services under be/src/tests are not unit subjects');
  assert.equal(judgeUnitRun(green).status, 'pass');
  assert.equal(codeOf(judgeUnitRun(unitSummary(app, fullCoverage(app), { ...greenUnitRun().run, failed: 1, exit: 1 }))), 'op-unit-run-red');
  assert.equal(codeOf(judgeUnitRun(unitSummary(app, fullCoverage(app), { ...greenUnitRun().run, total: 0 }))), 'op-unit-run-red');
  assert.equal(codeOf(judgeUnitRun(unitSummary(app, fullCoverage(app), { ...greenUnitRun().run, passed: 0, skipped: 1 }))), 'op-unit-run-red', 'a unit scenario that never executed cannot pass settle');
  assert.equal(codeOf(judgeUnitRun(unitSummary(app, fullCoverage(app), { ...greenUnitRun().run, total: '1' }))), 'op-unit-run-red', 'unit counters are not coerced');
  const partial = fullCoverage(app);
  partial[path.join(app, 'be/src/modules/domain/order/order.service.ts')].branches.pct = 87.5;
  assert.equal(codeOf(judgeUnitRun(unitSummary(app, partial))), 'op-unit-coverage-below');
  assert.equal(codeOf(judgeUnitRun(unitSummary(app, {}))), 'op-unit-coverage-below', 'a service the run never measured is below 100');
  const noSpec = unitApp(t, { spec: null });
  assert.equal(codeOf(judgeUnitRun(unitSummary(noSpec, fullCoverage(noSpec)))), 'op-unit-coverage-below');
  for (const spec of ['new OrderService()', 'Test.createTestingModule({}) && jest.mock("./x")', 'Test.createTestingModule({}).overrideProvider(X)']) {
    const off = unitApp(t, { spec });
    assert.equal(codeOf(judgeUnitRun(unitSummary(off, fullCoverage(off)))), 'op-unit-kit-violation', spec);
  }
});

// ---- lint ----

test('security-lint: missing lint, a lint that could not run, no typed findings and a dropped canon finding each refuse', () => {
  const security = securityRelevant(loadOpGate());
  const byCode = { engine: 'eslint', rule: 'starci-be/auth-door-strict-rate-tier', code: 'BE_INPUT_BOUNDED', path: 'be/src/features/auth/auth.controller.ts', line: 4, message: '[BE_INPUT_BOUNDED] strict tier' };
  const byRule = { engine: 'eslint', rule: 'starci-fe/response-cookie-attributes', code: null, path: 'fe/apps/web/src/route.ts', line: 2, message: 'httpOnly' };
  const naming = { engine: 'eslint', rule: 'starci-be/file-naming', code: 'BE_NAMING', path: 'be/src/a.ts', line: 1, message: 'naming' };
  const lint = (findings, errors = []) => ({ schema: LINT_SCHEMA, findings, errors });
  const typed = (findings) => ({ schema: SECURITY_FINDINGS_SCHEMA, findings });
  assert.equal(codeOf(judgeSecurityLint(null, typed([]), security)), 'op-lint-proof-missing');
  assert.equal(codeOf(judgeSecurityLint(lint([], ['eslint could not load the canon']), typed([]), security)), 'op-lint-tool-failed');
  assert.equal(codeOf(judgeSecurityLint(lint([byCode]), null, security)), 'op-security-findings-missing');
  assert.equal(codeOf(judgeSecurityLint(lint([byCode, byRule]), typed([{ code: 'BE_INPUT_BOUNDED', path: byCode.path, line: 4, severity: 'high' }]), security)), 'op-security-finding-unreported', 'the cookie finding (matched by rule) was dropped');
  assert.equal(judgeSecurityLint(lint([byCode, byRule, naming]), typed([
    { code: 'BE_INPUT_BOUNDED', path: byCode.path, line: 4, severity: 'high' },
    { rule: 'response-cookie-attributes', path: byRule.path, line: 2, severity: 'medium' },
  ]), security).status, 'pass', 'a verdict may carry findings; a non-security finding is not owed');
});

test('fe-lint: missing, a lint that could not run, and an fe/ finding refuse; a be/ finding is not an interface verdict', () => {
  const fe = { engine: 'stylelint', rule: 'declaration-no-important', code: null, path: 'fe/apps/web/src/a.css', line: 2, message: '!important' };
  const be = { engine: 'eslint', rule: 'starci-be/file-naming', code: 'BE_NAMING', path: 'be/src/a.ts', line: 1, message: 'naming' };
  assert.equal(codeOf(judgeLint(null, feRelevant, 'fe/')), 'op-lint-proof-missing');
  assert.equal(codeOf(judgeLint({ schema: LINT_SCHEMA, findings: [], errors: ['stylelint could not run'] }, feRelevant, 'fe/')), 'op-lint-tool-failed');
  assert.equal(codeOf(judgeLint({ schema: LINT_SCHEMA, findings: [fe], errors: [] }, feRelevant, 'fe/')), 'op-lint-findings');
  assert.equal(judgeLint({ schema: LINT_SCHEMA, findings: [be], errors: [] }, feRelevant, 'fe/').status, 'pass');
  assert.equal(judgeLint(greenLint(), feRelevant, 'fe/').status, 'pass');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-op-proof-lint-'));
  try {
    const record = { engine: 'hfs', rule: 'WORK_YAML_UNPARSEABLE', code: 'WORK_YAML_UNPARSEABLE', path: '.starciwork/features/a/ui/b/index.yaml', line: 3, message: 'unparseable' };
    const abs = path.join(dir, 'lint.json');
    fs.writeFileSync(abs, JSON.stringify({ schema: LINT_SCHEMA, findings: [record], errors: [] }));
    assert.equal(judgeLint(JSON.parse(fs.readFileSync(abs, 'utf8')), () => true, 'produced-file').code, 'op-lint-findings', 'a drawing is judged on every file it produced, .starciwork included');
    assert.equal(judgeLint(JSON.parse(fs.readFileSync(abs, 'utf8')), feRelevant, 'fe/').status, 'pass', 'an audit is judged on the fe/ side only');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- review ----

test('review-gate: missing, a tool failure and a red range refuse with the op-gate codes; a document gate is not a review gate', () => {
  assert.equal(codeOf(judgeReviewGate(null)), 'op-gate-proof-missing');
  assert.equal(codeOf(judgeReviewGate(greenDocGate())), 'op-gate-proof-missing');
  assert.equal(codeOf(judgeReviewGate({ ...greenGate(), exit: 2, errors: ['tsc could not run'] })), 'op-gate-tool-failed');
  assert.equal(codeOf(judgeReviewGate({ ...greenGate(), exit: 1, counts: { new: 1 }, findings: [{ engine: 'merge', rule: 'dropped-main-change', path: 'be/src/a.ts', message: 'merge kept the lane side' }] })), 'op-gate-new-findings');
  assert.equal(judgeReviewGate(greenGate()).status, 'pass');
});

test('review-defects: missing, an unclassified defect and an uncaught non-business defect without missingCheck refuse', () => {
  assert.equal(codeOf(judgeReviewDefects(null)), 'op-review-defects-missing');
  const doc = (defects) => ({ schema: REVIEW_DEFECTS_SCHEMA, defects });
  assert.equal(codeOf(judgeReviewDefects(doc([{ id: 'd1', title: 'x' }]))), 'op-review-defect-unclassified');
  assert.equal(codeOf(judgeReviewDefects(doc([{ id: 'd1', class: 'style' }]))), 'op-review-defect-unclassified');
  assert.equal(codeOf(judgeReviewDefects(doc([{ id: 'd2', class: 'non-business', caughtBy: null }]))), 'op-review-missing-check-unrecorded');
  assert.equal(codeOf(judgeReviewDefects(doc([{ id: 'd2', class: 'non-business', caughtBy: '', missingCheck: { check: ' ' } }]))), 'op-review-missing-check-unrecorded');
  assert.equal(judgeReviewDefects(doc([
    { id: 'd2', class: 'non-business', caughtBy: null, missingCheck: { check: 'eslint-be/no-floating-promise', rule: 'R60', detail: 'an unawaited publish' } },
    { id: 'd3', class: 'non-business', caughtBy: 'starci app lint R42' },
    { id: 'd4', class: 'business', caughtBy: null },
  ])).status, 'pass');
  assert.equal(judgeReviewDefects(greenReviewDefects()).status, 'pass', 'a review that found nothing attaches an empty list');
});

// ---- release ----

test('release: the app-installs proof scaffolds through the published @starci/cli bin at its pin (the hfs package has no bin) and refuses a missing pin', () => {
  const pins = { '@starci/cli': { version: '1.0.0' }, '@starci/hfs': { version: '4.0.9' }, '@starci/jest-preset': { version: '2.2.4' } };
  assert.deepEqual(scaffoldInvocation(pins, '/tmp/into'), ['-y', '-p', '@starci/cli@1.0.0', '-p', '@starci/jest-preset@2.2.4', 'starci', 'app', 'scaffold', 'release-app', '--into', '/tmp/into']);
  assert.throws(() => scaffoldInvocation({ '@starci/jest-preset': { version: '2.2.4' } }, '/tmp/into'), /no canon pin for @starci[/]cli/);
});

test('release: missing, a missing or skipped step and a red step refuse; release-proof.mjs reads a SKIPPED line as a skip', (t) => {
  assert.equal(codeOf(judgeRelease(null)), 'op-release-proof-missing');
  const green = greenReleaseProof();
  assert.equal(judgeRelease(green).status, 'pass');
  assert.equal(codeOf(judgeRelease({ ...green, steps: green.steps.filter((s) => s.id !== 'merge-guard') })), 'op-release-step-skipped');
  assert.equal(codeOf(judgeRelease({ ...green, steps: green.steps.map((s) => (s.id === 'app-installs' ? { ...s, status: 'skipped' } : s)) })), 'op-release-step-skipped');
  assert.equal(codeOf(judgeRelease({ ...green, steps: green.steps.map((s) => (s.id === 'check' ? { ...s, status: 'red' } : s)) })), 'op-release-step-red');
  assert.equal(codeOf(judgeRelease({ ...green, steps: green.steps.map((s) => (s.id === 'canon-pins' ? { ...s, status: 'tool-failed' } : s)) })), 'op-release-step-red');
  const skip = appInstallsStep({ runtime: ROOT, node: () => ({ status: 0, stdout: 'SKIPPED: no installs - lint: no node_modules\n', stderr: '' }) });
  assert.equal(skip.status, 'skipped', 'a skipped proof with exit 0 is still a skip');
  // The whole proof over a repository: every step is present, in order, and a red check makes it red.
  const repo = tmp(t, 'starci-op-proof-release-');
  const git = gitIn(repo);
  git('init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(repo, 'a.txt', 'a\n'); git('add', '-A'); git('commit', '-q', '-m', 'a');
  put(repo, 'b.txt', 'b\n'); git('add', '-A'); git('commit', '-q', '-m', 'b');
  const node = (args) => {
    const joined = args.join(' ');
    if (joined.includes('check-canon-pins')) return { status: 0, stdout: JSON.stringify({ ok: true, errors: [], pins: 3, profiles: 2 }), stderr: '' };
    if (joined.includes('release-app-installs')) return { status: 0, stdout: 'release-app-installs: OK', stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  const npm = () => ({ status: 1, stdout: 'check-op-manifest: 1 finding', stderr: '' });
  const proof = buildReleaseProof({ repo, base: 'HEAD~1', runtime: ROOT, node, npm });
  assert.equal(proof.schema, RELEASE_PROOF_SCHEMA);
  assert.deepEqual(proof.steps.map((s) => s.id), [...RELEASE_STEPS]);
  assert.deepEqual(proof.steps.map((s) => s.status), ['pass', 'pass', 'pass', 'red']);
  assert.equal(codeOf(judgeRelease(proof)), 'op-release-step-red');
});

// ---- judgeJobProofs over attached files ----

test('judgeJobProofs refuses paper-only attachments even when every required schema is green', (t) => {
  const dir = tmp(t);
  const file = (name, doc) => { const abs = path.join(dir, name); fs.writeFileSync(abs, JSON.stringify(doc)); return { abs, name }; };
  const files = [file('read-digest.json', greenReadDigest()), file('gate.json', greenGate())];
  const refused = judgeJobProofs({ op: 'docs.author', files });
  assert.equal(refused.proof, 'read-knowledge');
  assert.equal(refused.judged.code, 'op-read-digest-missing', 'a filed green digest never stands in for its admitted native READ');
  const done = judgeJobProofs({ op: 'docs.author', files: [...files, file('doc-gate.json', greenDocGate())] });
  assert.equal(done.judged.status, 'missing', 'green paper documents cannot replace admitted native observations');
  assert.equal(judgeJobProofs({ op: 'goal.revise', files }), null, 'an op with no proof is not judged');
});

// ---- starci kernel settle end to end ----

function seedOp(t, { label, op, docs, admittedAt = null, current = false }) {
  const base = tmp(t, 'starci-op-proof-settle-'), repo = path.join(base, 'main'), tree = path.join(base, 'workflow');
  fs.mkdirSync(repo);
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(base, 'machine.sqlite'), STARCI_LOCAL_ROOT: path.join(base, 'localappdata'),
    STARCI_PROJECTS_ROOT: path.join(base, 'projects'), STARCI_ARTIFACT_ROOT: path.join(base, 'artifacts'),
    STARCI_LOCAL_ROOT: path.join(base, 'local'), STARCI_OWNER_ROOT: path.join(base, 'owner'), STARCI_LANES_ROOT: path.join(base, 'lanes') };
  delete env.STARCI_CALLER;
  const git = gitIn(repo);
  git('init', '--quiet', '-b', 'main');
  for (const [k, v] of [['user.email', 'lane@starci.test'], ['user.name', 'lane'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(repo, 'docs/a.md', '# a\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'init');
  const branch = 'branch-' + label;
  git('worktree', 'add', '-q', '-b', branch, tree, 'main');
  const treeGit = gitIn(tree);
  registerWorkflowWorktree({ env }, { workflowId: `wf-${label}`, orcaWorktreeId: 'fixture::' + label, path: tree, branch });
  const files = ['docs/a.md'];
  // Accepted proof bytes remain owned changes until the real runtime checkpoint commits them.
  const head = treeGit('rev-parse', 'HEAD');
  // Capture admission before producing attachments; native observations are still independently required.
  const admissionAt = admittedAt ?? Date.now() - 1000;
  const proofDocs = typeof docs === 'function' ? docs({ repo, tree, base, env }) : docs;
  for (const [name, doc] of Object.entries(proofDocs)) {
    const proof = doc?.schema === GATE_SCHEMA ? { ...doc, root: tree, base: head, head } : doc;
    files.push(put(tree, `docs/checks/${name}`, Buffer.isBuffer(proof) ? proof : JSON.stringify(proof)));
  }
  const jobId = `op-${op}-${label}`;
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  try {
    seedWorkflow(ledger, { id: `wf-${label}`, state: { phase: 'running', job: 'impl' },
      jobs: [{ jobId, opId: op, dispatchId: `ctx-${jobId}`, terminalHandle: `term-${jobId}`, status: 'running',
        payload: { opId: op, owned_paths: ['docs/'], orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } }] });
    const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.transaction((db) => {
      writeContract(db, { attemptId, markdown: '# contract', context: { worktree: tree, packet: { context: {
        selected_op: { mode: null, contract: { id: op, reads: [{ id: 'standard', path: 'docs/architecture.md' }] }, checks: { required: [], candidates: [] } },
        readRefs: [{ path: 'docs/architecture.md', absolute: path.join(ROOT, 'docs/architecture.md'), rootKind: 'source', root: ROOT, sha256: sha256File(path.join(ROOT, 'docs/architecture.md')) }],
        owned_paths: [{ root: tree, path: 'docs/' }],
      gate_binding: captureGateBinding([{ base: tree, path: 'docs/' }], { at: admissionAt }) } } }, createdAt: admissionAt });
      fileReport(db, { attemptId, outcome: 'done', createdAt: Date.now(),
        report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'slice', files, head: treeGit('rev-parse', 'HEAD') } });
      for (const check of [{ name: 'owned-paths-committed', command: 'git show' }, { name: 'owned-paths-clean', command: 'git status' }, { name: 'head-ancestor', command: 'git merge-base' }])
        recordCheckRun(db, { attemptId, name: check.name, phase: 'verify', runner: 'kernel', authority: 'runtime', status: 'pass', exitCode: 0, command: check.command });
    });
  } finally { ledger.close(); }
  return { repo, tree, env, jobId, base };
}
const settle = ({ repo, env }, jobId) => { const r = spawnSync(process.execPath, [API, 'settle', '--repo', repo, '--job', jobId, '--verdict', 'pass', '--json'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 120000 }); let body = null; try { body = JSON.parse(r.stdout); } catch { /* judged below */ } return { r, body }; };
const read = ({ repo, env }, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return fn(l.db); } finally { l.close(); } };
// A 1x1 PNG: e2e.verify owes an image of its run (proof-media) before its mechanism proofs are judged.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const lastProofCheck = (seeded) => read(seeded, (db) => db.prepare("SELECT status FROM check_runs WHERE name='op-proof' ORDER BY check_id DESC").get()?.status ?? null);

test('starci kernel settle refuses a documenting op without its document gate and a reviewing op with an unrecorded missing check; an earlier admission also needs native evidence', (t) => {
  const cases = [
    ['docs-nogate', 'docs.author', { 'read-digest.json': greenReadDigest() }, 'op-read-digest-missing'],
    ['docs-noread', 'docs.author', { 'doc-gate.json': greenDocGate() }, 'op-read-digest-missing'],
    ['review-unobserved', 'review.verify', () => ({ 'gate.json': greenGate(), 'review-defects.json': { schema: REVIEW_DEFECTS_SCHEMA, defects: [{ id: 'd1', class: 'non-business', caughtBy: null }] } }), 'op-gate-proof-missing'],
    ['decide-noread', 'architecture.decide', {}, 'op-read-digest-missing'],
  ];
  for (const [label, op, docs, code] of cases) {
    const seeded = seedOp(t, { label, op, docs }), { jobId } = seeded;
    const refused = settle(seeded, jobId);
    assert.equal(refused.r.status, 1, `${label}: ${refused.r.stdout || refused.r.stderr}`);
    assert.equal(refused.body?.reason, code, `${label}: ${refused.r.stdout}`);
    assert.equal(read(seeded, (db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status), 'running', `${label}: a refused settle changes no job`);
    assert.equal(lastProofCheck(seeded), 'fail', `${label}: the refusal is the runtime check op-proof`);
  }
  const seeded = seedOp(t, { label: 'docs-claimed', op: 'docs.author', docs: { 'read-digest.json': greenReadDigest(), 'doc-gate.json': greenDocGate() } });
  const claimed = settle(seeded, seeded.jobId);
  assert.equal(claimed.r.status,1,claimed.r.stderr || claimed.r.stdout);
  assert.equal(claimed.body?.reason,'op-read-digest-missing','green attachments do not invent independently observed READ');
  assert.equal(read(seeded,(db)=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(seeded.jobId).status),'running');
  const old = seedOp(t, { label: 'docs-early', op: 'docs.author', docs: {}, admittedAt: 1 });
  const before = settle(old, old.jobId);
  assert.equal(before.r.status,1,before.r.stdout || before.r.stderr);
  assert.equal(before.body?.reason,'op-read-digest-missing');
  assert.equal(lastProofCheck(old),'fail');
});

test('native settlement refuses an unbound e2e loop before attachments can claim a test-world success', (t) => {
  const handRolled = { ...greenTestWorldRun(), specs: [{ path: 'be/src/tests/e2e/a.e2e-spec.ts', useTestWorld: true, modes: ['apps'], outage: 0, forbidden: ['testcontainers'] }] };
  const seeded = seedOp(t, { label: 'e2e-rolled', op: 'e2e.verify', docs: { 'gate.json': { ...greenGate(), changed: [] }, 'read-digest.json': greenReadDigest(), 'test-world-run.json': handRolled, 'run.png': PNG } }), { jobId } = seeded;
  const refused = settle(seeded, jobId);
  assert.equal(refused.r.status, 1, refused.r.stdout || refused.r.stderr);
  assert.equal(read(seeded, (db) => db.prepare("SELECT status FROM check_runs WHERE name='op-gate' ORDER BY check_id DESC LIMIT 1").get()?.status), 'fail');
  assert.equal(refused.body?.reason,'op-gate-tool-failed',refused.r.stdout);
  assert.equal(read(seeded,(db)=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status),'running');
});


test('current deciding-op route needs a real record-checks READ before native settle; a green attachment alone refuses', (t) => {
  const create = (label) => seedOp(t, { label, op: 'architecture.decide', current: true, admittedAt: Date.now() - 1000,
    docs: ({ tree, env }) => {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/cli/gate-read.mjs'), '--root', tree, '--knowledge', 'docs/architecture.md'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
      assert.equal(r.status, 0, r.stderr || r.stdout);
      return { 'read-digest.json': JSON.parse(r.stdout) };
    } });
  const missing = create('current-claimed-only'), refused = settle(missing, missing.jobId);
  assert.equal(refused.r.status, 1, refused.r.stderr || refused.r.stdout);
  assert.equal(refused.body?.reason, 'op-read-digest-missing');
  assert.equal(read(missing, (db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(missing.jobId).status), 'running');
  const seeded = create('current-native-read'), checks = path.join(seeded.base, 'independent-checks.json');
  fs.writeFileSync(checks, JSON.stringify({ checks: [{ name: 'read-knowledge', exitCode: 0, command: `starci gate read --root "${seeded.tree}" --knowledge docs/architecture.md` }] }));
  const r = spawnSync(process.execPath, [API, 'record-checks', '--repo', seeded.repo, '--job', seeded.jobId, '--checks-file', checks, '--json'], { cwd: ROOT, env: seeded.env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const raw = read(seeded, (db) => db.prepare("SELECT exit_code,authority,output_sha,cwd,summary_json FROM check_runs WHERE name='read-knowledge' ORDER BY check_id DESC").get());
  assert.equal(raw.exit_code, 0); assert.equal(raw.authority, 'runtime'); assert.equal(raw.cwd, seeded.tree); assert.ok(raw.output_sha);
  assert.equal(JSON.parse(raw.summary_json).native.schema, DIGEST_SCHEMA);
  const accepted = settle(seeded, seeded.jobId);
  assert.equal(accepted.r.status, 0, accepted.r.stderr || accepted.r.stdout);
  assert.equal(read(seeded, (db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(seeded.jobId).status), 'succeeded');
});

test('release: canon child exits determine the whole proof even when its JSON is positive', (t) => {
  const repo = tmp(t, 'starci-op-proof-canon-exit-');
  const git = gitIn(repo);
  git('init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['commit.gpgsign', 'false']]) git('config', key, value);
  put(repo, 'a.txt', 'a\n'); git('add', '-A'); git('commit', '-q', '-m', 'a');
  put(repo, 'b.txt', 'b\n'); git('add', '-A'); git('commit', '-q', '-m', 'b');
  const positive = JSON.stringify({ ok: true, errors: [], pins: 3, profiles: 1 });
  const cases = [
    ['nonzero exit with positive JSON', { status: 1, stdout: positive }, 'red', 1],
    ['null exit with positive JSON', { status: null, stdout: positive }, 'tool-failed', 2],
    ['absent status with positive JSON', { stdout: positive }, 'tool-failed', 2],
    ['zero exit with positive JSON', { status: 0, stdout: positive }, 'pass', 0],
    ['zero exit with a negative judgment', { status: 0, stdout: JSON.stringify({ ok: false, profiles: 1 }) }, 'red', 1],
    ['zero exit without a bound runtime profile', { status: 0, stdout: JSON.stringify({ ok: true, profiles: 0 }) }, 'red', 1],
    ['zero exit with malformed JSON', { status: 0, stdout: '{' }, 'tool-failed', 2],
    ['zero exit with a process error', { status: 0, stdout: positive, error: new Error('fake process failure') }, 'tool-failed', 2],
  ];
  for (const [label, child, expectedStatus, expectedExit] of cases) {
    const checkerRuns = [];
    const node = (args) => {
      if (args[0].endsWith('check-canon-pins.mjs')) {
        checkerRuns.push(args.includes('--repo') ? 'app' : 'runtime');
        return { stderr: '', ...child };
      }
      return { status: 0, stdout: 'release-app-installs: OK', stderr: '' };
    };
    const proof = buildReleaseProof({ repo, base: 'HEAD~1', runtime: ROOT, node, npm: () => ({ status: 0, stdout: '', stderr: '' }) });
    assert.deepEqual(checkerRuns, ['runtime'], label);
    assert.equal(proof.schema, RELEASE_PROOF_SCHEMA, label);
    assert.deepEqual(proof.steps.map((step) => step.id), [...RELEASE_STEPS], label);
    assert.equal(proof.steps.find((step) => step.id === 'canon-pins').status, expectedStatus, label);
    assert.ok(proof.steps.filter((step) => step.id !== 'canon-pins').every((step) => step.status === 'pass'), label);
    assert.equal(proof.ok, expectedStatus === 'pass', label);
    assert.equal(proof.exit, expectedExit, label);
    if (expectedStatus === 'pass') assert.equal(judgeRelease(proof).status, 'pass', label);
    else assert.equal(codeOf(judgeRelease(proof)), 'op-release-step-red', label);
  }
  put(repo, 'hfs.json', JSON.stringify({ kind: 'app' }));
  git('add', 'hfs.json'); git('commit', '-q', '-m', 'app declaration');
  for (const [label, runtimeStatus, appStatus, expectedStatus, expectedExit] of [
    ['successful runtime cannot hide a nonzero app exit', 0, 1, 'red', 1],
    ['successful runtime cannot hide a null app exit', 0, null, 'tool-failed', 2],
    ['null app exit takes precedence over a red runtime exit', 1, null, 'tool-failed', 2],
    ['runtime and app zero exits retain a passing proof', 0, 0, 'pass', 0],
  ]) {
    const checkerRuns = [];
    const node = (args) => {
      if (args[0].endsWith('check-canon-pins.mjs')) {
        const app = args.includes('--repo');
        checkerRuns.push(app ? 'app' : 'runtime');
        return { status: app ? appStatus : runtimeStatus, stdout: positive, stderr: '' };
      }
      return { status: 0, stdout: 'release-app-installs: OK', stderr: '' };
    };
    const proof = buildReleaseProof({ repo, base: 'HEAD~1', runtime: ROOT, node, npm: () => ({ status: 0, stdout: '', stderr: '' }) });
    assert.deepEqual(checkerRuns, ['runtime', 'app'], label);
    assert.equal(proof.steps.find((step) => step.id === 'canon-pins').status, expectedStatus, label);
    assert.ok(proof.steps.filter((step) => step.id !== 'canon-pins').every((step) => step.status === 'pass'), label);
    assert.equal(proof.ok, expectedStatus === 'pass', label);
    assert.equal(proof.exit, expectedExit, label);
  }
});
