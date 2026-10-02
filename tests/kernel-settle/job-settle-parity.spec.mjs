// The canon parity verifier (contract change canon-parity-settle) and the 60 s settle invariant.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  canonParityVerdict, checkFamilyOf, sliceBaseOf, parityEligible, tscParity, baseBlobsOf, declaredProjectsOf, lintParity,
} from '../../scripts/kernel/settle/canon-parity.mjs';
import { verifyReported, classifyCheck, isBaselineCheck, settlerSettings, parityCacheFile, EVENTS } from '../../scripts/kernel/settle/job-settle.mjs';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpDirs = [], DRIVE = path.parse(os.tmpdir()).root.replace(/\\/g, '/');
const tmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); tmpDirs.push(d); return d; };
after(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
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
    { name: 'gate-before', command: `starci gate run --root R --base ${base} --changed a.ts`, exitCode: 2 },
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
  lint: async () => ({ ok: true, status: 'clean', counts: { new: 0, preexisting: 3 }, gating: [], baseline: { method: 'gate', status: 'measured' } }),
  ...over,
});
const RED = [
  { name: 'canon-scan-repo-wide', command: 'starci gate canon-scan --root R --json', exitCode: 2 },
  { name: 'gate-after', command: 'starci gate run --root R --base B --changed a.ts', exitCode: 2 },
  { name: 'tsc-app', command: 'cd R/apps/app && npx tsc --noEmit', exitCode: 2 },
  { name: 'git-scoped-commit', command: 'git commit -m x', exitCode: 0 },
];

test('families, base and eligibility', () => {
  assert.equal(checkFamilyOf({ name: 'canon-scan-fix', command: 'node x/canon-scan.mjs --fix' }), 'canon');
  assert.equal(checkFamilyOf({ name: 'lint-gate-after', command: 'node x/gate.mjs --root R --base B' }), 'lint');
  assert.equal(checkFamilyOf({ name: 'hfs-lint', command: 'npx starci app lint --format json' }), 'lint');
  assert.equal(checkFamilyOf({ name: 'eslint-owned', command: 'cd R && npx eslint src' }), 'lint');
  assert.equal(checkFamilyOf({ name: 'app-typecheck-after', command: 'npm run typecheck' }), 'tsc');
  assert.equal(checkFamilyOf({ name: 'tsc-landing-draft', command: 'cd R/apps/landing-draft && npx tsc --noEmit' }), 'tsc');
  assert.equal(checkFamilyOf({ name: 'git-diff-check', command: 'git diff --check HEAD~1' }), 'diff');
  assert.equal(checkFamilyOf({ name: 'vitest', command: 'npx vitest run' }), null);
  assert.equal(checkFamilyOf({ name: 'starci-validate-strict', command: 'starci runtime validate X --strict' }), null);
  assert.equal(sliceBaseOf(sliceItem('abc1234', [])), 'abc1234');
  assert.equal(sliceBaseOf({ payload: { params: { admissionBase: 'def5678' } }, report: {} }), null, 'no admissionBase param: the base is what the checks measured against');
  assert.equal(sliceBaseOf({ payload: { params: {} }, report: { checks: [] } }), null);
  assert.equal(parityEligible(sliceItem('a', [])), true);
  assert.equal(parityEligible({ ...sliceItem('a', []), payload: { params: { canonFamilies: 'all' } } }), false, 'a wire leg (no cut) is not a slice');
  assert.equal(parityEligible({ ...sliceItem('a', []), outcome: 'blocked' }), false);
  assert.equal(parityEligible({ ...sliceItem('a', []), op: 'review.verify' }), false);
});

test('parity settles a slice whose only reds are foreign residue, with the cut checks settle demands', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const v = await canonParityVerdict(sliceItem(base, RED), seams(root));
  assert.equal(v.green, true, JSON.stringify(v));
  assert.equal(v.via, 'canon-parity');
  const names = v.checks.checks.map((c) => c.name);
  for (const n of ['cut-slice-postcondition', 'cut-regression-inventory', 'canon-parity-lint', 'canon-parity-typecheck']) assert.ok(names.includes(n), n);
  assert.ok(v.checks.checks.every((c) => c.exitCode === 0));
  assert.deepEqual(v.parity.superseded, ['canon-scan-repo-wide:2', 'gate-after:2', 'tsc-app:2']);
});

test('any new finding in the owned files goes to the Kernel', async () => {
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const item = sliceItem(base, RED);
  const lintNew = await canonParityVerdict(item, seams(root, { lint: async () => ({ ok: false, status: 'findings', counts: { new: 1, preexisting: 0 },
    gating: [{ code: 'eslint/no-unused-vars', file: 'src/slice/a.ts', line: 1 }] }) }));
  assert.equal(lintNew.green, false); assert.equal(lintNew.reason, 'parity-lint-new');
  const unproven = await canonParityVerdict(item, seams(root, { lint: async () => ({ ok: false, status: 'unavailable', counts: { new: 0, preexisting: 0 },
    gating: [{ code: 'GATE_TOOL_FAILED', message: 'starci app lint produced no report' }] }) }));
  // H7: a lint gate that could not run a tool could not measure the slice - tooling, never the slice's red.
  assert.equal(unproven.reason, 'parity-checker-unavailable'); assert.equal(unproven.unavailable, true);
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
  const strict = { name: 'starci-validate-strict', command: 'starci runtime validate X --strict --json', exitCode: 0 };
  const rerunRed = await canonParityVerdict(sliceItem(base, [...RED, strict]), seams(root, { rerun: () => ({ exitCode: 1, ms: 1, tail: 'SCHEMA_VALIDATOR_UNAVAILABLE' }) }));
  assert.equal(rerunRed.reason, 'parity-rerun-red');
  const noBase = sliceItem(base, RED); noBase.report.checks = noBase.report.checks.slice(1);
  assert.equal((await canonParityVerdict(noBase, seams(root))).reason, 'parity-no-base');
  assert.equal((await canonParityVerdict(sliceItem('0'.repeat(40), RED), seams(root))).reason, 'parity-base-unknown');
});

test('lint parity maps the gate: exit 0 clean, 1 findings, 2 unavailable', async () => {
  const gate = (exit, extra = {}) => async (root, files, { base }) => { assert.equal(base, 'b'); return { exit, findings: [], preexisting: 0, errors: [], ...extra }; };
  assert.equal((await lintParity({ root: '.', files: ['a.ts'], base: 'b', checker: gate(0, { preexisting: 2 }) })).status, 'clean');
  const red = await lintParity({ root: '.', files: ['a.ts'], base: 'b', checker: gate(1, { findings: [{ engine: 'eslint', rule: 'no-var', path: 'a.ts', line: 1, message: 'x' }] }) });
  assert.equal(red.ok, false); assert.equal(red.status, 'findings'); assert.equal(red.gating[0].code, 'eslint/no-var');
  const down = await lintParity({ root: '.', files: ['a.ts'], base: 'b', checker: gate(2, { errors: ['starci app lint produced no report'] }) });
  assert.equal(down.status, 'unavailable'); assert.equal(down.gating[0].code, 'GATE_TOOL_FAILED');
  assert.equal((await lintParity({ root: '.', files: [], base: 'b', checker: gate(2) })).ok, true, 'no owned file: nothing to lint');
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
  const list = [{ file: 'src/slice/a.ts', ruleId: 'CONFIG_UNWIRED' }];
  const canon = async () => ({ exitCode: 1, status: 'findings', findings: 1, list, root, paths: 1 });
  const item = sliceItem(base, RED);
  item.report.owedToWire = [{ path: `${path.basename(root)}/src/slice/a.ts`, finding: 'package.json wiring', ruleId: 'CONFIG_UNWIRED' }];
  const wire = [{ jobId: 'op-wire', status: 'queued', ownedPaths: ['package.json'] }];
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

test('a NODE_PATH prefix is dropped before a declared runtime check is classified and re-run', async () => {
  const { withoutNodePath } = await import('../../scripts/kernel/settle/canon-parity.mjs');
  assert.equal(withoutNodePath(`NODE_PATH=${DRIVE}x/node_modules starci runtime validate X --strict --json`), 'starci runtime validate X --strict --json');
  assert.equal(withoutNodePath(`$env:NODE_PATH='${DRIVE}x'; node ${DRIVE}r/.claude/bin/starci.mjs validate X --json`), `node ${DRIVE}r/.claude/bin/starci.mjs validate X --json`);
  assert.equal(withoutNodePath('FOO=1 node x.mjs'), 'FOO=1 node x.mjs');
  const { root, base } = checkout({ 'src/slice/a.ts': 'export const a = 1;\n' });
  const strict = { name: 'starci-validate-strict', command: `NODE_PATH=${DRIVE}x/node_modules starci runtime validate X --strict --json`, exitCode: 0 };
  let ran = null;
  const v = await canonParityVerdict(sliceItem(base, [...RED, strict]), seams(root, { rerun: (c) => { ran = c; return { exitCode: 0, ms: 1, tail: '' }; } }));
  assert.equal(v.green, true, JSON.stringify(v));
  assert.deepEqual(ran.argv, ['validate', 'X', '--strict', '--json']);
});
