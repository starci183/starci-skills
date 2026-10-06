// Native mechanism evidence: real READ child and existing ledger records, with private process-boundary faults.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { writeContract, fileReport } from '../../engine/db/ledger.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { recordCheck } from '../../scripts/machine/evidence-store.mjs';
import { classifyCheck, rerunCheck, recordSettlerCheck, verifyReported } from '../../scripts/kernel/settle/job-settle.mjs';
import { observationContextOf, observeCheck, stageObservation, mechanismObservations, judgeFiledRead, requireObservationFresh } from '../../scripts/kernel/mechanism-observation.mjs';
import { judgeJobProofs, judgeInspectionRun, SECURITY_FINDINGS_SCHEMA, securityRelevant } from '../../scripts/kernel/mechanism-proofs.mjs';
import { DIGEST_SCHEMA, buildReadDigest, loadOpGate } from '../../scripts/gates/read-digest.mjs';
import { LINT_SCHEMA } from '../../scripts/gates/gate.mjs';
import { getBlob } from '../../engine/db/blob.mjs';
import { buildContext } from '../../scripts/context/pack.mjs';
import { EXAMPLE_CATALOG_FILE, exampleSourcePaths } from '../../scripts/lib/example-refs.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const LAW = 'docs/architecture.md';
const put = (root, rel, content) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); return f; };
const ownEnv = (t, values) => { const old = new Map(Object.keys(values).map((k) => [k, process.env[k]]));
  Object.assign(process.env, values); t.after(() => { for (const [k, v] of old) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }); };

function fixture(t, op = 'architecture.decide', { privateLaw = false } = {}) {
  return withLedger(t, (fx) => {
    const at = Date.now() - 1000, jobId = 'op-native-proof', workflowId = 'wf-native-proof';
    ownEnv(t, { STARCI_ARTIFACT_ROOT: path.join(fx.root, 'artifacts') });
    put(fx.repoRoot, 'src/a.ts', 'export const value = 1;\n');
    seedWorkflow(fx.ledger, { id: workflowId, state: { phase: 'running' }, now: at,
      jobs: [{ jobId, opId: op, status: 'running', dispatchId: 'dispatch-native-proof', terminalHandle: 'fixture-terminal', payload: { opId: op, owned_paths: ['src/'] } }] });
    const job = fx.ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    const attemptId = fx.ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    const lawRoot = privateLaw ? path.join(fx.root, 'admitted-source') : ROOT;
    if (privateLaw) put(lawRoot, LAW, 'the private common law captured at admission\n');
    const readRefs = [{ path: LAW, absolute: path.join(lawRoot, LAW), rootKind: 'source', root: lawRoot, sha256: sha256File(path.join(lawRoot, LAW)), why: 'common law' }];
    fx.ledger.transaction((db) => writeContract(db, { attemptId, createdAt: at, markdown: '# native fixture', context: {
      worktree: fx.repoRoot, packet: { context: { selected_op: { mode: null, contract: { id: op, reads: [{ id: 'standard', path: LAW }] }, checks: { required: [], candidates: [] } }, readRefs,
        owned_paths: [{ root: fx.repoRoot, path: 'src/' }] } },
    } }));
    const context = observationContextOf(fx.ledger.db, job, { repo: fx.repoRoot, skillRoot: ROOT });
    const item = { jobId, workflowId, attemptId, dispatchId: 'dispatch-native-proof', repo: fx.repoRoot, op, outcome: 'done', payload: {} };
    return { ...fx, job, item, context, at };
  });
}
const readCheck = (root) => classifyCheck({ command: `starci gate read --root "${root}" --knowledge ${LAW}` }, { mechanical: true });
const nativeRead = (fx) => observeCheck(readCheck(fx.repoRoot), fx.context, (repo) => rerunCheck(readCheck(fx.repoRoot), { repo, timeoutMs: 30000 }));
const store = (fx, run, name = 'native-read') => { const staged = stageObservation(run, [fx.repoRoot]);
  return fx.ledger.transaction((db) => recordCheck(db, { attemptId: fx.item.attemptId, name, command: 'starci gate read', runner: 'kernel', phase: 'verify',
    ...staged, summary: { native: staged.native } })); };
const proofFile = (fx, doc, name = 'read.json') => ({ abs: put(fx.root, name, JSON.stringify(doc)), name });

test('a real canonical READ child indexes its observed output and qualifies only the current admitted attempt', async (t) => {
  const fx = fixture(t), read = await buildReadDigest({ root: fx.repoRoot, touch: [], knowledge: [LAW] });
  const run = nativeRead(fx); assert.equal(run.exitCode, 0, run.tail); assert.equal(run.native.stable, true);
  const check = store(fx, run), row = fx.ledger.db.prepare('SELECT * FROM check_runs WHERE check_id=?').get(check.checkId);
  assert.equal(row.authority, 'runtime'); assert.equal(row.exit_code, 0); assert.equal(row.cwd, fx.repoRoot);
  assert.ok(fx.ledger.db.prepare('SELECT 1 FROM blobs WHERE sha256=?').get(row.output_sha), 'the raw child output is indexed, not an attachment shape');
  assert.equal(JSON.parse(getBlob(row.output_sha).toString('utf8')).schema, DIGEST_SCHEMA);
  const observations = mechanismObservations(fx.ledger.db, fx.context);
  const verdict = judgeJobProofs({ op: fx.item.op, files: [proofFile(fx, read)], context: fx.context, observations });
  assert.equal(verdict.judged.status, 'pass'); assert.deepEqual(verdict.nativeCheckIds, [check.checkId]);
  const next = { ...fx.context, attemptId: fx.item.attemptId + 1 };
  assert.equal(judgeJobProofs({ op: fx.item.op, files: [proofFile(fx, read)], context: next, observations: mechanismObservations(fx.ledger.db, next) }).judged.status, 'missing');
});

test('a green attachment or caller-supplied native-shaped entry is not a native execution', async (t) => {
  const fx = fixture(t), digest = await buildReadDigest({ root: fx.repoRoot, touch: [], knowledge: [LAW] }), file = proofFile(fx, digest);
  assert.equal(judgeJobProofs({ op: fx.item.op, files: [file] }).judged.status, 'missing', 'green attachment shape has no admitted native producer');
  fx.ledger.transaction((db) => recordCheck(db, { attemptId: fx.item.attemptId, name: 'claimed', runner: 'op', phase: 'verify', exitCode: 0,
    summary: { entry: { native: { schema: DIGEST_SCHEMA, stable: true } } } }));
  assert.equal(judgeJobProofs({ op: fx.item.op, files: [file], context: fx.context, observations: mechanismObservations(fx.ledger.db, fx.context) }).judged.status, 'missing');
  const cls = readCheck(fx.repoRoot), rawRed = observeCheck(cls, fx.context, (repo) => rerunCheck(cls, { repo, timeoutMs: 30, run: () => ({ status: 1, stdout: JSON.stringify({ ...digest, findings: [] }), stderr: '' }) }));
  store(fx, rawRed);
  assert.equal(judgeJobProofs({ op: fx.item.op, files: [file], context: fx.context, observations: mechanismObservations(fx.ledger.db, fx.context) }).judged.status, 'red', 'a green READ JSON cannot hide an observed exit 1');
});

test('green JSON cannot hide nonzero, signal, spawn error, missing status or a latest unavailable child', (t) => {
  const fx = fixture(t), cls = readCheck(fx.repoRoot), output = { schema: DIGEST_SCHEMA, files: [] };
  const faults = [{ status: 1 }, { status: 2 }, { status: null }, { status: 0, signal: 'SIGTERM' }, { status: 0, error: Object.assign(new Error('missing'), { code: 'ENOENT' }) }];
  for (const fault of faults) {
    const run = observeCheck(cls, fx.context, (repo) => rerunCheck(cls, { repo, timeoutMs: 30, run: () => ({ ...fault, stdout: JSON.stringify(output), stderr: '' }) }));
    store(fx, run);
    const observed = mechanismObservations(fx.ledger.db, fx.context);
    assert.equal(observed.length, 1, 'only the latest native run of the same proof is current');
    assert.equal(observed[0].judged?.status, 'unavailable', JSON.stringify(fault));
  }
});

test('same-path dirty edits, foreign roots and mutation flags cannot reuse a native observation', (t) => {
  const fx = fixture(t), cls = readCheck(fx.repoRoot);
  const run = observeCheck(cls, fx.context, (repo) => rerunCheck(cls, { repo, timeoutMs: 30, run: () => ({ status: 0, stdout: JSON.stringify({ schema: DIGEST_SCHEMA }), stderr: '' }) }));
  store(fx, run); put(fx.repoRoot, 'src/a.ts', 'export const value = 2;\n');
  assert.equal(mechanismObservations(fx.ledger.db, fx.context)[0].judged.status, 'unavailable', 'an M-to-M byte change changes the stamp');
  assert.throws(() => requireObservationFresh([run.native]), /inputs changed/);
  assert.equal(observeCheck(readCheck(fx.root), fx.context, () => { throw new Error('must not spawn a foreign check'); }).status, 'unavailable');
  assert.equal(classifyCheck({ command: `starci gate run --root "${fx.repoRoot}" --fix` }, { mechanical: true }).kind, 'foreign');
});

test('indexed native output rejects corrupted time, cwd, binding and unavailable status', (t) => {
  const fx = fixture(t), cls = readCheck(fx.repoRoot);
  const run = observeCheck(cls, fx.context, (repo) => rerunCheck(cls, { repo, timeoutMs: 30, run: () => ({ status: 0, stdout: JSON.stringify({ schema: DIGEST_SCHEMA }), stderr: '' }) }));
  const fields = [{ cwd: fx.root }, { input_digest: '0'.repeat(64) }, { started_at: fx.at - 1 }, { finished_at: Date.now() + 60000 }, { status: 'unavailable' }];
  for (const values of fields) {
    const check = store(fx, run);
    fx.ledger.transaction((db) => db.prepare(`UPDATE check_runs SET ${Object.keys(values).map((k) => `${k}=?`).join(',')} WHERE check_id=?`).run(...Object.values(values), check.checkId));
    assert.equal(mechanismObservations(fx.ledger.db, fx.context)[0].judged.status, 'unavailable', JSON.stringify(values));
  }
});

test('READ requires real common law and target hashes before CHECK, including a no-touch deciding op', async (t) => {
  const fx = fixture(t), digest = await buildReadDigest({ root: fx.repoRoot, touch: [], knowledge: [LAW] }), doc = loadOpGate();
  assert.equal(judgeFiledRead(digest, fx.context, doc, []), null);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  for (const mutate of [
    (d) => { d.files = []; }, (d) => { d.files[0].sha256 = '0'.repeat(64); }, (d) => { d.root = fx.root; },
    (d) => { d.files.push({ path: 'knowledge/absent.yaml', role: 'knowledge', sha256: 'a'.repeat(64) }); },
    (d) => { d.files.push({ path: '../foreign.ts', role: 'read', sha256: 'a'.repeat(64) }); },
  ]) { const d = clone(digest); mutate(d); assert.equal(judgeFiledRead(d, fx.context, doc, []).status, 'red'); }
  assert.equal(judgeFiledRead(digest, fx.context, doc, [{ native: { schema: LINT_SCHEMA }, startedAt: Date.parse(digest.at) - 1 }]).status, 'red');
  const target = { path: 'src/a.ts', absolute: path.join(fx.repoRoot, 'src/a.ts'), rootKind: 'app', root: fx.repoRoot, sha256: sha256File(path.join(fx.repoRoot, 'src/a.ts')) };
  const withTarget = { ...digest, files: [...digest.files, { path: target.path, role: 'read', sha256: target.sha256 }] }, context = { ...fx.context, readRefs: [...fx.context.readRefs, target] };
  assert.equal(judgeFiledRead(withTarget, context, doc, []), null);
  put(fx.repoRoot, target.path, 'export const value = 3;\n');
  assert.equal(judgeFiledRead(withTarget, context, doc, []).status, 'red', 'a captured target SHA does not excuse current byte drift');
});

// HFS lint maps its actual catalog code to both rule and code. R41 is a catalog
// label, not the current securityCodes identity; a stale fixture must fail here
// instead of reducing the dropped-finding oracle to zero relevant findings.
const lint = () => {
  const finding = { engine: 'hfs', code: 'BE_DEFAULT_DENY', rule: 'BE_DEFAULT_DENY', path: 'src/a.ts', line: 1, message: 'fixture security finding' };
  assert.equal(securityRelevant(loadOpGate())(finding), true, 'the private native finding belongs to the current security canon');
  return { schema: LINT_SCHEMA, exit: 1, errors: [], findings: [finding] };
};
function lintRun(fx, result) {
  const cls = classifyCheck({ command: 'starci app lint --changed src/a.ts --format json' }, { mechanical: true });
  return observeCheck(cls, fx.context, (repo) => rerunCheck(cls, { repo, timeoutMs: 30, run: () => result }));
}
test('security.verify retains actual exit 1 only with every typed finding; tool failure never qualifies', async (t) => {
  const fx = fixture(t, 'security.verify'), findings = { schema: SECURITY_FINDINGS_SCHEMA, findings: [{ rule: 'BE_DEFAULT_DENY', code: 'BE_DEFAULT_DENY', path: 'src/a.ts', line: 1, severity: 'high', reachability: 'fixture' }] };
  const files = [proofFile(fx, lint(), 'lint.json'), proofFile(fx, findings, 'security.json')];
  const run = lintRun(fx, { status: 1, stdout: JSON.stringify(lint()), stderr: '' });
  assert.equal(judgeInspectionRun(run, files).status, 'pass');
  const check = store(fx, run, 'native-lint');
  const verdict = judgeJobProofs({ op: fx.item.op, files, context: fx.context, observations: mechanismObservations(fx.ledger.db, fx.context) });
  assert.equal(verdict.judged.status, 'pass'); assert.deepEqual(verdict.inspectionCheckIds, [check.checkId]);
  const raw = fx.ledger.db.prepare('SELECT exit_code,status FROM check_runs WHERE check_id=?').get(check.checkId);
  assert.equal(raw.exit_code, 1); assert.equal(raw.status, 'fail', 'successful inspection bookkeeping never synthesizes raw zero');
  const dropped = [files[0], proofFile(fx, { ...findings, findings: [] }, 'dropped.json')];
  assert.equal(judgeInspectionRun(run, dropped).code, 'op-security-finding-unreported');
  const contradictory = lintRun(fx, { status: 0, stdout: JSON.stringify(lint()), stderr: '' });
  store(fx, contradictory, 'native-lint');
  assert.equal(mechanismObservations(fx.ledger.db, fx.context).find((row) => row.native.schema === LINT_SCHEMA).judged.status, 'unavailable', 'JSON exit 1 cannot be reported as an observed raw zero');
  for (const result of [{ status: 2 }, { status: null }, { status: 1, signal: 'SIGTERM' }, { status: 1, error: new Error('crash') }])
    assert.equal(judgeInspectionRun(lintRun(fx, { ...result, stdout: JSON.stringify(lint()), stderr: '' }), files).status, 'unavailable');
});

test('the deterministic settler carries the bound inspection raw 1, but not a generic failed command', async (t) => {
  const fx = fixture(t, 'security.verify'), findingsPath = put(fx.repoRoot, 'src/security.json', JSON.stringify({ schema: SECURITY_FINDINGS_SCHEMA, findings: [{ code: 'BE_DEFAULT_DENY', rule: 'BE_DEFAULT_DENY', path: 'src/a.ts', line: 1, severity: 'high', reachability: 'the private inspection fixture' }] }));
  const checks = [{ name: 'lint', exitCode: 1, command: 'starci app lint --changed src/a.ts --format json' }];
  fx.ledger.transaction((db) => fileReport(db, { attemptId: fx.item.attemptId, outcome: 'done', report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'inspection', files: [findingsPath], checks } }));
  const invoke = (cls, { repo }) => rerunCheck(cls, { repo, timeoutMs: 30, run: () => ({ status: 1, stdout: JSON.stringify(lint()), stderr: '' }) });
  const recorded = (run) => recordSettlerCheck(fx.ledger, fx.item, run);
  fx.ledger.transaction((db) => { for (const c of checks) recordCheck(db, { attemptId: fx.item.attemptId, name: c.name, phase: 'after', runner: 'op', command: c.command, exitCode: c.exitCode }); });
  const result = await verifyReported(fx.ledger.db, { ...fx.item, report: { checks } }, { repo: fx.repoRoot, env: process.env, parity: null, rerun: invoke, record: recorded });
  assert.equal(result.green, true, JSON.stringify(result));
  assert.equal(fx.ledger.db.prepare("SELECT exit_code FROM check_runs WHERE runner='settler' ORDER BY check_id DESC").get().exit_code, 1);
  put(fx.repoRoot, 'src/security.json', JSON.stringify({ schema: SECURITY_FINDINGS_SCHEMA, findings: [] }));
  const dropped = await verifyReported(fx.ledger.db, { ...fx.item, report: { checks } }, { repo: fx.repoRoot, env: process.env, parity: null, rerun: invoke, record: recorded });
  assert.equal(dropped.green, false); assert.equal(dropped.reason, 'rerun-red');
});

test('the default independent runner resolves canonical scripts at the runtime root, not scripts/scripts', (t) => {
  const fx = fixture(t), expected = path.join(ROOT, 'scripts', 'checks', 'check-failure-codes.mjs');
  const cls = classifyCheck({ command: `node "${expected}"` });
  assert.equal(cls.kind, 'runtime');
  let called = false;
  rerunCheck(cls, { repo: fx.repoRoot, timeoutMs: 30, run: (argv, options) => { called = true; assert.equal(argv[0], expected); assert.equal(options.cwd, fx.repoRoot); return { status: 0, stdout: '{}', stderr: '' }; } });
  assert.equal(called, true);
});

test('the default canon cut keeps Windows paths normalized and retains a real unavailable machine', async (t) => {
  const fx = fixture(t, 'code.refactor');
  // Profile detection uses declaration metadata only. The absent hfs.json is
  // deliberate: this exercises the real default scanner and its unavailable
  // result without faking a green canon or copying a product/toolchain tree.
  put(fx.repoRoot, 'package.json', JSON.stringify({ private: true, dependencies: { next: '0.0.0-fixture' } }));
  const checks = [{ name: 'canonical-parser-help', command: `node "${path.join(ROOT, 'scripts/checks/check-runtime-public-docs.mjs')}" --help`, exitCode: 0 }];
  const item = { ...fx.item, payload: { owned_paths: [String.raw`src\a.ts`], params: { canonFamilies: 'architecture' },
    cut: { id: 'private-canon-cut', ordinal: 1, total: 2 } }, report: { checks } };
  fx.ledger.transaction((db) => { for (const c of checks) recordCheck(db, { attemptId: fx.item.attemptId, name: c.name, phase: 'after', runner: 'op', command: c.command, exitCode: c.exitCode }); });
  const recorded = [];
  // Both rerun and canon stay at their production defaults. Only the recording
  // sink is local; no native receipt is fabricated or counted as a gate pass.
  const result = await verifyReported(fx.ledger.db, item, { repo: fx.repoRoot, parity: null, record: (run) => recorded.push(run) });
  assert.equal(result.green, false); assert.equal(result.unavailable, true); assert.equal(result.reason, 'checker-unavailable');
  const canon = recorded.find((row) => row.name === 'cut-slice-postcondition');
  assert.ok(canon, 'default canon reached its real measurement instead of throwing an unbound norm ReferenceError');
  assert.equal(canon.exitCode, 3); assert.equal(canon.output.schema, 'starci/canon-findings@1');
  assert.equal(canon.output.status, 'unavailable'); assert.deepEqual(canon.output.scope.paths, ['src/a.ts']);
  assert.deepEqual(canon.output.scope.machines, ['architecture']); assert.ok(canon.output.issues.length > 0);
  assert.equal(canon.cwd, fx.repoRoot);
});

test('a current native READ retains its admitted common-law set when Source adds a law', async (t) => {
  const fx = fixture(t), digest = await buildReadDigest({ root: fx.repoRoot, touch: [], knowledge: [LAW] });
  const run = nativeRead(fx); assert.equal(run.exitCode, 0, run.tail); const check = store(fx, run);
  const doc = structuredClone(loadOpGate()); doc.digest.required.push('knowledge/added-after-admission.yaml');
  const observations = mechanismObservations(fx.ledger.db, fx.context), files = [proofFile(fx, digest)];
  const verdict = judgeJobProofs({ op: fx.item.op, files, context: fx.context, observations, doc });
  assert.equal(verdict.judged.status, 'pass', 'new live common-law membership cannot revise a filed attempt');
  assert.deepEqual(verdict.nativeCheckIds, [check.checkId]);
  const omitted = { ...digest, files: digest.files.filter((row) => row.path !== LAW) };
  assert.equal(judgeJobProofs({ op: fx.item.op, files: [proofFile(fx, omitted, 'omitted-law.json')], context: fx.context, observations, doc }).judged.status, 'red', 'the originally admitted common law remains required');
});

test('filed Source bytes may drift advisably while their admitted identity remains required', (t) => {
  const fx = fixture(t, 'architecture.decide', { privateLaw: true }), ref = fx.context.readRefs[0];
  const digest = { schema: DIGEST_SCHEMA, at: new Date().toISOString(), root: fx.repoRoot, touched: [], slotMap: [],
    files: [{ path: ref.path, role: 'knowledge', sha256: ref.sha256 }] };
  put(ref.root, ref.path, 'the law changed after this private admission\n');
  const doc = structuredClone(loadOpGate()); doc.digest.required.push('knowledge/new-live-law.yaml');
  assert.notEqual(sha256File(ref.absolute), ref.sha256);
  assert.equal(judgeFiledRead(digest, fx.context, doc, []), null, 'the filed Source identity is judged without rereading new law bytes');
  const altered = { ...digest, files: [{ ...digest.files[0], sha256: sha256File(ref.absolute) }] };
  assert.equal(judgeFiledRead(altered, fx.context, doc, []).status, 'red', 'current Source bytes cannot replace the admitted identity');
  assert.equal(judgeFiledRead({ ...digest, files: [] }, fx.context, doc, []).status, 'red');
});

test('native raw-1 inspection needs distinct complete carriage for every reported location', (t) => {
  const fx = fixture(t, 'security.verify'), report = { ...lint(), findings: [lint().findings[0], { ...lint().findings[0], line: 2 }] };
  const findings = { schema: SECURITY_FINDINGS_SCHEMA, findings: report.findings.map((f) => ({ rule: f.rule, code: f.code,
    path: f.path, line: f.line, severity: 'high', reachability: `private entry point at line ${f.line}` })) };
  const run = lintRun(fx, { status: 1, stdout: JSON.stringify(report), stderr: '' }), check = store(fx, run, 'two-locations');
  const lintFile = proofFile(fx, report, 'two-lint.json'), files = [lintFile, proofFile(fx, findings, 'two-security.json')];
  const observations = mechanismObservations(fx.ledger.db, fx.context);
  assert.equal(report.findings.every(securityRelevant(loadOpGate())), true, 'both native locations are real security canon findings');
  assert.equal(judgeInspectionRun(run, files).status, 'pass');
  const verdict = judgeJobProofs({ op: fx.item.op, files, context: fx.context, observations });
  assert.equal(verdict.judged.status, 'pass'); assert.deepEqual(verdict.inspectionCheckIds, [check.checkId]);
  const mutations = [
    (d) => { d.findings.pop(); }, (d) => { d.findings[1].line = 1; },
    ...['rule', 'code', 'path', 'line', 'severity', 'reachability'].map((key) => (d) => { delete d.findings[1][key]; }),
    (d) => { d.findings[1].line = null; }, (d) => { d.findings[1].severity = ' '; }, (d) => { d.findings[1].reachability = ''; },
    (d) => { d.findings[1].code = 'BE_INPUT_BOUNDED'; }, (d) => { d.findings[1].rule = 'another-rule'; },
  ];
  for (const [i, mutate] of mutations.entries()) {
    const bad = structuredClone(findings); mutate(bad);
    const attached = [lintFile, proofFile(fx, bad, `carriage-${i}.json`)];
    assert.equal(judgeInspectionRun(run, attached).status, 'red', `carriage mutant ${i} cannot excuse raw 1`);
    assert.equal(judgeJobProofs({ op: fx.item.op, files: attached, context: fx.context, observations }).judged.status, 'red', `native consumer mutant ${i}`);
  }
  const paperFiles = [lintFile, proofFile(fx, { schema: SECURITY_FINDINGS_SCHEMA, findings: [{ rule: 'BE_DEFAULT_DENY', path: 'src/a.ts' }] }, 'paper-carriage.json')];
  assert.equal(judgeJobProofs({ op: fx.item.op, files: paperFiles }).judged.status, 'missing', 'paper carriage cannot replace the admitted native producer');
  assert.equal(judgeJobProofs({ op: fx.item.op, files: paperFiles, context: fx.context, observations }).judged.status, 'red');
  const raw = fx.ledger.db.prepare('SELECT exit_code,status FROM check_runs WHERE check_id=?').get(check.checkId);
  assert.deepEqual({ ...raw }, { exit_code: 1, status: 'fail' }, 'carriage never converts the actual child failure into raw zero');
});

test('native rule-only findings carry explicit null code without collapsing repeated locations', (t) => {
  const fx = fixture(t, 'security.verify'), report = { ...lint(), findings: [{ ...lint().findings[0], code: null, rule: 'starci-fe/response-cookie-attributes' }] };
  const findings = { schema: SECURITY_FINDINGS_SCHEMA, findings: [{ rule: 'response-cookie-attributes', code: null, path: 'src/a.ts', line: 1, severity: 'medium', reachability: 'private route' }] };
  const run = lintRun(fx, { status: 1, stdout: JSON.stringify(report), stderr: '' });
  const files = [proofFile(fx, report, 'rule-lint.json'), proofFile(fx, findings, 'rule-findings.json')];
  assert.equal(report.findings.every(securityRelevant(loadOpGate())), true, 'the null-code fixture is admitted by its actual rule identity');
  assert.equal(judgeInspectionRun(run, files).status, 'pass', 'the native producer explicitly has no code for a rule-based finding');
  report.findings.push({ ...report.findings[0] });
  const repeated = lintRun(fx, { status: 1, stdout: JSON.stringify(report), stderr: '' });
  assert.equal(judgeInspectionRun(repeated, files).code, 'op-security-finding-unreported', 'one typed row cannot cover two native occurrences');
});

test('no-touch deciding proof requires its filed declared catalog source/compiler/test union, not a later live reconstruction', async (t) => {
  const fx = fixture(t), contract = { ...fx.context.selected.contract, reads: [{ id: 'standard', path: `${LAW} + ${EXAMPLE_CATALOG_FILE}` }] };
  const union = exampleSourcePaths(ROOT);
  contract.reads.unshift({ id: 'early', path: union.join(' + ') });
  const cut = buildContext({ op: fx.item.op, skillRoot: ROOT, appRoot: fx.repoRoot, briefDoc: contract, ownedPaths: [] });
  assert.deepEqual(cut.requiredMissing, []);
  const context = { ...fx.context, selected: { ...fx.context.selected, contract }, readRefs: cut.mandatory };
  const digest = await buildReadDigest({ root: fx.repoRoot, touch: [], knowledge: [LAW] });
  assert.ok(union.length > 3, 'the actual declared catalog has source and owning compiler/test inputs');
  for (const relative of union) {
    assert.ok(digest.files.some((file) => file.path === relative));
    assert.ok(cut.mandatory.find((row) => row.path === relative).why.split('\n').some((why) => why.startsWith('brief read [standard]')),
      'an earlier explicit READ cannot erase the declared catalog obligation');
  }
  const run = nativeRead({ ...fx, context }); assert.equal(run.exitCode, 0, run.tail); store(fx, run);
  const observations = mechanismObservations(fx.ledger.db, context);
  const judge = (value) => judgeJobProofs({ op: fx.item.op, files: [proofFile(fx, value)], context, observations }).judged;
  assert.equal(judge(digest).status, 'pass', 'the native deciding READ and actual filed producer union agree');
  for (const relative of [union.find((file) => /\.tsx?$/.test(file)), union.find((file) => /tsconfig.*\.json$/.test(file)), union.find((file) => /(?:spec|test)\.[cm]?tsx?$/.test(file))]) {
    assert.ok(relative, 'the current catalog declares every tested input class');
    const dropped = { ...digest, files: digest.files.filter((file) => file.path !== relative) };
    assert.equal(judgeFiledRead(dropped, context, loadOpGate(), observations).status, 'red', relative);
    assert.equal(judge(dropped).status, 'red', `native settlement rejects a dropped filed ${relative}`);
  }
  const unrelated = { path: 'docs/unrelated.md', absolute: put(fx.root, 'docs/unrelated.md', 'not declared common law\n'), rootKind: 'source', root: fx.root,
    sha256: sha256File(path.join(fx.root, 'docs/unrelated.md')), why: 'an optional unrelated reference' };
  assert.equal(judgeFiledRead(digest, { ...context, readRefs: [...context.readRefs, unrelated] }, loadOpGate(), observations), null);
  const live = structuredClone(loadOpGate()); live.digest.required.push('knowledge/new-live-law.yaml');
  assert.equal(judgeFiledRead(digest, context, live, observations), null, 'no later Source duty is reconstructed for a filed attempt');
  const wrong = { ...digest, files: digest.files.map((file) => file.path === union[0] ? { ...file, sha256: '0'.repeat(64) } : file) };
  assert.equal(judgeFiledRead(wrong, context, loadOpGate(), observations).status, 'red', 'filed Source hashes remain exact');
});
