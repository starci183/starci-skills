// The canon parity verifier (contract change canon-parity-settle) and the 60 s settle invariant.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  canonParityVerdict, checkFamilyOf, sliceBaseOf, parityEligible, tscParity, baseBlobsOf, declaredProjectsOf, isForeignNote, lintParity,
} from '../scripts/reconcile/canon-parity.mjs';
import { verifyReported, classifyCheck, isBaselineCheck, settleInvariantDuty, settlerSettings, parityCacheFile, EVENTS } from '../scripts/reconcile/job-settle.mjs';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const git = (cwd, ...args) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

/** A git checkout with an owned folder `src/slice` committed at `base`. */
function checkout(files) {
  const root = tmp('parity-repo-');
  git(root, 'init', '-q'); git(root, 'config', 'user.email', 't@t'); git(root, 'config', 'user.name', 't'); git(root, 'config', 'core.autocrlf', 'false');
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'base');
  return { root, base: git(root, 'rev-parse', 'HEAD') };
}

const sliceItem = (base, checks, extra = {}) => ({
  jobId: 'op-code.refactor-aaa', workflowId: 'wf-x', op: 'code.refactor', attempt: 1, outcome: 'done', dispatchId: 'ctx_1',
  payload: { cut: { id: 'fe-canon', ordinal: 3, total: 9 }, params: { canonFamilies: 'all' }, owned_paths: ['src/slice'], ...(extra.payload ?? {}) },
  report: { checks: [
    { name: 'check-scoped-lint-before', command: `node .claude/scripts/checks/check-scoped-lint.mjs --profile next --root R --base ${base} -- a.ts`, exitCode: 2 },
    ...checks,
  ] },
});
const settings = { ...settlerSettings({}), itemBudgetMs: 60_000 };
const seams = (root, over = {}) => ({
  repo: root, settings, classify: (c) => classifyCheck(c), baseline: isBaselineCheck,
  resolveRoot: async () => ({ ok: true, root, ownedRels: ['src/slice'] }),
  rerun: () => ({ exitCode: 0, ms: 10, tail: '' }),
  canon: async () => ({ exitCode: 0, status: 'ok', findings: 0, root, paths: 1 }),
  tsc: async () => ({ ok: true, projects: [{ project: 'tsconfig.json', errors: 5, baseErrors: 5, newKeys: 0 }], newErrors: [] }),
  lint: async () => ({ ok: true, status: 'clean', counts: { new: 0, preexisting: 3, runLevel: 0 }, outside: 40, gating: [], attempts: 1, baseline: { method: 'base-tree', status: 'measured' } }),
  ...over,
});
const RED = [
  { name: 'canon-scan-repo-wide', command: 'node .claude/scripts/checks/canon-scan.mjs --root R --json', exitCode: 2 },
  { name: 'check-scoped-lint-after', command: 'node .claude/scripts/checks/check-scoped-lint.mjs --profile next --root R --base B -- a.ts', exitCode: 2 },
  { name: 'tsc-app', command: 'cd R/apps/app && npx tsc --noEmit', exitCode: 2 },
  { name: 'git-scoped-commit', command: 'git commit -m x', exitCode: 0 },
];

test('families, base and eligibility', () => {
  assert.equal(checkFamilyOf({ name: 'canon-scan-fix', command: 'node x/canon-scan.mjs --fix' }), 'canon');
  assert.equal(checkFamilyOf({ name: 'code-patterns-all-after', command: 'node x/check-scoped-lint.mjs --all' }), 'lint');
  assert.equal(checkFamilyOf({ name: 'eslint-owned', command: 'cd R && npx eslint src' }), 'lint');
  assert.equal(checkFamilyOf({ name: 'app-typecheck-after', command: 'npm run typecheck' }), 'tsc');
  assert.equal(checkFamilyOf({ name: 'tsc-landing-draft', command: 'cd R/apps/landing-draft && npx tsc --noEmit' }), 'tsc');
  assert.equal(checkFamilyOf({ name: 'git-diff-check', command: 'git diff --check HEAD~1' }), 'diff');
  assert.equal(checkFamilyOf({ name: 'vitest', command: 'npx vitest run' }), null);
  assert.equal(checkFamilyOf({ name: 'starci-validate-strict', command: 'node .claude/bin/starci.mjs validate X --strict' }), null);
  assert.equal(sliceBaseOf(sliceItem('abc1234', [])), 'abc1234');
  assert.equal(sliceBaseOf({ payload: { params: { admissionBase: 'def5678' } }, report: {} }), 'def5678');
  assert.equal(sliceBaseOf({ payload: { params: {} }, report: { checks: [] } }), null);
  assert.equal(parityEligible(sliceItem('a', [])), true);
  assert.equal(parityEligible({ ...sliceItem('a', []), payload: { params: { canonFamilies: 'all' } } }), false, 'a wire leg (no cut) is not a slice');
  assert.equal(parityEligible({ ...sliceItem('a', []), outcome: 'blocked' }), false);
  assert.equal(parityEligible({ ...sliceItem('a', []), op: 'review.verify' }), false);
  assert.equal(isForeignNote({ code: 'FOREIGN_RESIDUE' }), true);
  assert.equal(isForeignNote({ code: 'LINT_MESSAGE', file: 'a.ts' }), false);
});

test('parity settles a slice whose only reds are foreign residue, with the cut checks settle demands', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const v = await canonParityVerdict(sliceItem(base, RED), seams(root));
  assert.equal(v.green, true, JSON.stringify(v));
  assert.equal(v.via, 'canon-parity');
  const names = v.checks.checks.map((c) => c.name);
  for (const n of ['cut-slice-postcondition', 'cut-regression-inventory', 'canon-parity-scoped-lint', 'canon-parity-typecheck']) assert.ok(names.includes(n), n);
  assert.ok(v.checks.checks.every((c) => c.exitCode === 0));
  assert.deepEqual(v.parity.superseded, ['canon-scan-repo-wide:2', 'check-scoped-lint-after:2', 'tsc-app:2']);
});

test('any new finding in the owned files goes to the Kernel', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const item = sliceItem(base, RED);
  const lintNew = await canonParityVerdict(item, seams(root, { lint: async () => ({ ok: false, status: 'findings', counts: { new: 1, runLevel: 0 }, outside: 3,
    gating: [{ code: 'LINT_MESSAGE', file: 'src/slice/a.ts', line: 1, newBecause: 'changed-line' }], attempts: 1 }) }));
  assert.equal(lintNew.green, false); assert.equal(lintNew.reason, 'parity-lint-new');
  const unproven = await canonParityVerdict(item, seams(root, { lint: async () => ({ ok: false, status: 'unavailable', counts: { new: 0, runLevel: 1 }, outside: 3,
    gating: [{ code: 'SCRIPT_INPUT_UNAVAILABLE', message: 'unlocated' }], attempts: 1 }) }));
  assert.equal(unproven.reason, 'parity-lint-new', 'an unlocated issue inside the slice is not provably foreign');
  const tscNew = await canonParityVerdict(item, seams(root, { tsc: async () => ({ ok: false, projects: [], newErrors: [{ file: 'src/other/b.ts', code: 'TS2305', message: 'no export', owned: false, count: 1, baseCount: 0 }] }) }));
  assert.equal(tscNew.reason, 'parity-tsc-new');
  assert.match(tscNew.detail[0], /importer src\/other\/b\.ts TS2305/);
  const canonRed = await canonParityVerdict(item, seams(root, { canon: async () => ({ exitCode: 1, status: 'findings', findings: 2 }) }));
  assert.equal(canonRed.reason, 'cut-postcondition-red');
});

test('an uncovered red, a red re-run or a missing base never settles', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const vitest = await canonParityVerdict(sliceItem(base, [...RED, { name: 'vitest', command: 'npx vitest run', exitCode: 1 }]), seams(root));
  assert.equal(vitest.reason, 'parity-uncovered');
  const unverifiable = await canonParityVerdict(sliceItem(base, [...RED, { name: 'build', command: 'npm run build', exitCode: 0 }]), seams(root));
  assert.equal(unverifiable.reason, 'parity-uncovered', 'a green claim nothing re-measures stays the Kernel\'s');
  const strict = { name: 'starci-validate-strict', command: 'node .claude/bin/starci.mjs validate X --strict --json', exitCode: 0 };
  const rerunRed = await canonParityVerdict(sliceItem(base, [...RED, strict]), seams(root, { rerun: () => ({ exitCode: 1, ms: 1, tail: 'SCHEMA_VALIDATOR_UNAVAILABLE' }) }));
  assert.equal(rerunRed.reason, 'parity-rerun-red');
  const noBase = sliceItem(base, RED); noBase.report.checks = noBase.report.checks.slice(1);
  assert.equal((await canonParityVerdict(noBase, seams(root))).reason, 'parity-no-base');
  assert.equal((await canonParityVerdict(sliceItem('0'.repeat(40), RED), seams(root))).reason, 'parity-base-unknown');
});

test('lint parity re-measures a run a sibling edit voided, and only that', async () => {
  let n = 0;
  const flaky = async () => { n += 1; return { slice: n < 2 ? { status: 'unavailable', issues: [{ code: 'INPUTS_CHANGED_DURING_CHECK' }], counts: { new: 0 }, outside: 1 } : { status: 'clean', issues: [], counts: { new: 0 }, outside: 1 } }; };
  const r = await lintParity({ root: '.', files: ['a.ts'], base: 'b', profile: 'next', checker: flaky });
  assert.equal(r.ok, true); assert.equal(r.attempts, 2);
  let m = 0;
  const real = async () => { m += 1; return { slice: { status: 'findings', issues: [{ code: 'LINT_MESSAGE', file: 'a.ts', line: 1 }], counts: { new: 1 } } }; };
  const r2 = await lintParity({ root: '.', files: ['a.ts'], base: 'b', profile: 'next', checker: real });
  assert.equal(r2.ok, false); assert.equal(m, 1);
});

test('base blobs and declared projects', () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n', 'src/slice/sub/b.ts': 'export const b = 2;\n', 'src/other.ts': 'x\n', 'apps/app/tsconfig.json': '{}' });
  write(root, 'src/slice/a.ts', 'export const a = 3;\n');
  const blobs = baseBlobsOf(root, base, ['src/slice']);
  assert.equal(blobs.ok, true);
  assert.deepEqual([...blobs.blobs.keys()].sort(), ['src/slice/a.ts', 'src/slice/sub/b.ts']);
  assert.equal(blobs.blobs.get('src/slice/a.ts'), 'export const a = 1;\n');
  assert.deepEqual(declaredProjectsOf([{ name: 'tsc-app', command: `cd ${root}/apps/app && npx tsc --noEmit` }], root).map((f) => path.relative(root, f).replace(/\\/g, '/')), ['apps/app/tsconfig.json']);
});

// A real TypeScript program pair, when a TypeScript package is at hand (the runtime's ui/node_modules).
const tsPackage = (() => { for (const dir of [process.env.STARCI_TEST_TS_ROOT, path.join(skillRoot, 'ui'), skillRoot].filter(Boolean)) { try { return createRequire(path.join(dir, 'package.json'))('typescript'); } catch { /* next */ } } return null; })();
test('typecheck parity: a slice-caused error in an importer is new, a foreign error is not', { skip: !tsPackage && 'no typescript package beside the runtime' }, () => {
  const files = {
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'esnext', moduleResolution: 'bundler', target: 'es2020' }, include: ['src/**/*.ts'] }),
    'src/slice/a.ts': 'export const foo = 1;\n',
    'src/user.ts': "import { foo } from './slice/a';\nexport const u = foo;\n",
    'src/residue.ts': "import { gone } from './nowhere';\nexport const r = gone;\n",
  };
  const { root, base } = checkout(files);
  const ownedRels = ['src/slice'];
  const same = tscParity({ root, ownedRels, baseBlobs: baseBlobsOf(root, base, ownedRels).blobs, ts: tsPackage });
  assert.equal(same.ok, true, JSON.stringify(same));
  assert.ok(same.projects[0].errors >= 1, 'the foreign residue is an error on both sides');
  write(root, 'src/slice/a.ts', 'export const bar = 1;\n');
  const broke = tscParity({ root, ownedRels, baseBlobs: baseBlobsOf(root, base, ownedRels).blobs, ts: tsPackage });
  assert.equal(broke.ok, false);
  assert.deepEqual(broke.newErrors.map((e) => [e.file, e.owned]), [['src/user.ts', false]]);
  write(root, 'src/slice/a.ts', 'export const foo = 1;\nexport const n: number = "x";\n');
  const own = tscParity({ root, ownedRels, baseBlobs: baseBlobsOf(root, base, ownedRels).blobs, ts: tsPackage });
  assert.deepEqual(own.newErrors.map((e) => [e.file, e.owned]), [['src/slice/a.ts', true]]);
});

test('verifyReported runs parity only for a canon cut slice the declared checks cannot carry, and caches a refusal', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const db = { prepare: () => ({ get: () => undefined }) };
  let calls = 0;
  const parity = async () => { calls += 1; return { green: false, reason: 'parity-lint-new', detail: ['x'] }; };
  const parityDeps = { resolveRoot: async () => ({ ok: true, root, ownedRels: ['src/slice'] }) };
  const item = sliceItem(base, RED);
  const first = await verifyReported(db, item, { repo: root, parity, parityDeps });
  assert.equal(first.reason, 'parity-lint-new'); assert.equal(calls, 1);
  assert.match(first.detail[0], /^declared: declared-check-red/);
  const second = await verifyReported(db, item, { repo: root, parity, parityDeps });
  assert.equal(second.cached, true); assert.equal(calls, 1, 'an unchanged slice is not measured again');
  write(root, 'src/slice/a.ts', 'export const a = 2;\n');
  await verifyReported(db, item, { repo: root, parity, parityDeps });
  assert.equal(calls, 2, 'an owned-file change re-measures');
  fs.rmSync(parityCacheFile(root, item.jobId), { force: true });
  const wire = { ...item, payload: { ...item.payload, cut: null } };
  const plain = await verifyReported(db, wire, { repo: root, parity, parityDeps });
  assert.equal(plain.reason, 'declared-check-red'); assert.equal(calls, 2, 'a leg with no cut keeps the declared verdict');
  const off = await verifyReported(db, item, { repo: root, parity: null });
  assert.equal(off.reason, 'declared-check-red');
});

function ledgerWithReport(root, { filedAgoMs }) {
  const ledger = openLedger({ file: ledgerFileFor(root) });
  const now = Date.now();
  ledger.ensureWorkflow?.({ workflowId: 'wf-x' });
  ledger.db.prepare("INSERT OR IGNORE INTO workflows(workflow_id,created_at,updated_at,phase) VALUES('wf-x',?,?,'running')").run(now, now);
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,payload_json,status,created_at,updated_at) VALUES('op-code.refactor-aaa','wf-x','code.refactor',1,0,'op','{}','running',?,?)").run(now, now);
  ledger.db.prepare("INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,created_at) VALUES('wf-x','code.refactor',1,'ctx_1','m',?)").run(now);
  ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,outcome,report_json,created_at) VALUES('wf-x','ctx_1','code.refactor',1,'done','{}',?)").run(now - filedAgoMs);
  ledger.close();
}

test('the settle invariant: a job being verified is not a violation; a violation is recorded once', () => {
  const root = tmp('parity-ledger-');
  ledgerWithReport(root, { filedAgoMs: 5 * 60_000 });
  const s = { ...settlerSettings({}), invariantMaxAgeMs: 180_000, itemBudgetMs: 900_000 };
  const busy = settleInvariantDuty({ repos: [root], workflowId: 'wf-x', settings: s, record: true, start: () => null, held: (r, v) => (v.jobId === 'op-code.refactor-aaa' ? { pid: 1 } : null) });
  assert.equal(busy.violations.length, 0); assert.equal(busy.verifying.length, 1); assert.equal(busy.recorded, 0);
  const idle = settleInvariantDuty({ repos: [root], workflowId: 'wf-x', settings: s, record: true, start: () => 42, held: () => null });
  assert.equal(idle.violations.length, 1); assert.equal(idle.recorded, 1); assert.deepEqual(idle.started, [{ repo: path.resolve(root), pid: 42 }]);
  const again = settleInvariantDuty({ repos: [root], workflowId: 'wf-x', settings: s, record: true, start: () => null, held: () => null });
  assert.equal(again.violations.length, 1); assert.equal(again.recorded, 0, 'one event per dispatch');
  const other = settleInvariantDuty({ repos: [root], workflowId: 'wf-y', settings: s, start: () => null, held: () => null });
  assert.equal(other.violations.length, 0, 'scoped to its workflow');
  const ledger = openLedger({ file: ledgerFileFor(root) });
  try { assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM events WHERE kind=?').get(EVENTS.invariant).n, 1); } finally { ledger.close(); }
});

test('the watchdog loop checks the settle invariant on the settler cadence', async () => {
  const { runWatchdogLoop, checkSettleInvariant } = await import('../scripts/kernel/watchdog.mjs');
  const printed = [];
  let settles = 0, checks = 0;
  await runWatchdogLoop({ workflow: 'wf-x', tick: () => ({ ok: true, workflowId: 'wf-x', action: 'idle' }), sleep: async () => {}, print: (r) => printed.push(r),
    interval: 180_000, maxIterations: 1, settle: () => { settles += 1; }, settleEveryMs: 60_000, owns: () => false,
    invariant: () => { checks += 1; return checks === 2 ? { violations: 1, recorded: 1, jobs: ['op-a 4m'] } : { violations: 0 }; } });
  assert.equal(settles, 3); assert.equal(checks, 3);
  assert.deepEqual(printed.filter((r) => r.action === 'settle-invariant').map((r) => r.violations), [1]);
  const r = checkSettleInvariant({ repoPath: tmp('parity-none-'), workflow: 'wf-x', duty: (a) => { assert.equal(a.record, true); assert.equal(a.workflowId, 'wf-x'); return { violations: [], verifying: [], recorded: 0 }; } });
  assert.equal(r.violations, 0);
  assert.match(checkSettleInvariant({ repoPath: '.', workflow: 'wf-x', duty: () => { throw new Error('boom'); } }).error, /boom/);
});

test('a specs skip record is not a claim; node --check re-runs; a preload flag is never run', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n', 'e2e/x.mjs': 'export const x = 1;\n', 'e2e/bad.mjs': 'export const = ;\n' });
  const skip = { name: 'specs.unit', command: '(skipped - specs disabled)', exitCode: 0, evidence: 'skipped: specs.unit=false (config.yaml)' };
  const syntax = { name: 'node-syntax', command: 'node --check e2e/x.mjs', exitCode: 0 };
  const ok = await canonParityVerdict(sliceItem(base, [...RED, skip, syntax]), seams(root));
  assert.equal(ok.green, true, JSON.stringify(ok));
  assert.ok(ok.checks.checks.some((c) => c.name === 'node-syntax'));
  const bad = await canonParityVerdict(sliceItem(base, [...RED, { name: 'node-syntax', command: 'node --check e2e/bad.mjs', exitCode: 0 }]), seams(root));
  assert.equal(bad.reason, 'parity-rerun-red');
  assert.equal(checkFamilyOf({ name: 'n', command: 'node --check --import=evil.mjs x.mjs' }), null);
  const claim = await canonParityVerdict(sliceItem(base, [...RED, { name: 'specs.unit', command: 'npx vitest', exitCode: 0, evidence: 'all passed' }]), seams(root));
  assert.equal(claim.reason, 'parity-uncovered');
});

test('owedToWire: findings left on owned paths pass only when declared, held by a wire leg and present at base', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const list = [{ file: 'src/slice/a.ts', ruleId: 'ARCH_UNREGISTERED' }];
  const canon = async () => ({ exitCode: 1, status: 'findings', findings: 1, list, root, paths: 1 });
  const item = sliceItem(base, RED);
  item.report.owedToWire = [{ path: `${path.basename(root)}/src/slice/a.ts`, finding: 'architecture.json registration', ruleId: 'ARCH_UNREGISTERED' }];
  const wire = [{ jobId: 'op-wire', status: 'queued', ownedPaths: ['architecture.json'] }];
  const atBase = async () => ({ ok: true, findings: list });
  const ok = await canonParityVerdict(item, seams(root, { canon, wireLegs: () => wire, canonBase: atBase }));
  assert.equal(ok.green, true, JSON.stringify(ok));
  assert.deepEqual(ok.parity.owedToWire.wires, ['op-wire']);
  const undeclared = { ...item, report: { ...item.report, owedToWire: [{ path: 'src/other', finding: 'x' }] } };
  assert.match((await canonParityVerdict(undeclared, seams(root, { canon, wireLegs: () => wire, canonBase: atBase }))).detail.join(' '), /not declared/);
  assert.match((await canonParityVerdict(item, seams(root, { canon, wireLegs: () => [], canonBase: atBase }))).detail.join(' '), /no canon-wire leg/);
  assert.match((await canonParityVerdict(item, seams(root, { canon, wireLegs: () => wire, canonBase: async () => ({ ok: true, findings: [] }) }))).detail.join(' '), /introduced by the slice/);
  const noOwed = { ...item, report: { ...item.report, owedToWire: undefined } };
  assert.equal((await canonParityVerdict(noOwed, seams(root, { canon, wireLegs: () => wire, canonBase: atBase }))).reason, 'cut-postcondition-red');
});
