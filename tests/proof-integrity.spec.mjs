// Proof integrity (scripts/kernel/proof-integrity.mjs): every indexed artifact carries what it proves, a proof whose
// code changed reads stale and api status re-runs only its check, api coverage lists the scope as proven|stale|missing,
// api verify-proofs catches a tampered file or a broken events chain, and a handover ask is refused while a must-have
// FR is unproven. A tmp git checkout is the product repo; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { indexJobArtifacts } from '../scripts/kernel/job-artifacts.mjs';
import { PROOF_INTEGRITY_CHANGE, claimsOfJob, claimsProblems, coverageOf, staleProofsOf, verifyProofs } from '../scripts/kernel/proof-integrity.mjs';
import { validateOpReport } from '../scripts/kernel/report-envelope.mjs';
import { recordVersion } from '../scripts/work/work-graph-store.mjs';
import { readContractChangesDoc } from '../scripts/kernel/contract-changes-store.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const WF = 'wf-proof';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const json = (v) => JSON.stringify(v ?? null);
const runApi = (...args) => spawnSync(process.execPath, [API, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: '' } });
const git = (cwd, ...args) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const effectiveAt = () => Date.parse(readContractChangesDoc(ROOT).doc.changes.find((c) => c.id === PROOF_INTEGRITY_CHANGE).effectiveAt);
const OPTIONS = ['Approve - the workflow is done', 'Feedback - describe it in the note', 'Question - ask it in the note'];

const FR = (name, command) => `schema: work/functional-requirement@1\nid: fr.login.${name}\ntitle: ${name}\nstate: done\nrequiresProof:\n  e2e:\n    command: ${command}\n    required: true\n`;
const UI = 'schema: work/ui-screen@1\nid: ui.login.sign-in\ntitle: sign in\nui:\n  shapes:\n    - {base: SignInBase, state: refused, viewports: [desktop-1280]}\n';

function world(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-proof-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const write = (rel, body) => { const abs = path.join(repo, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return abs; };
  git(repo, 'init', '--quiet');
  git(repo, 'config', 'user.email', 'lane@starci.test'); git(repo, 'config', 'user.name', 'lane'); git(repo, 'config', 'core.autocrlf', 'false');
  write('src/login/sign-in.ts', 'export const signIn = 1;\n');
  write('src/other/x.ts', 'export const x = 1;\n');
  write('e2e/sign-in.e2e-spec.ts', 'test("sign in", () => {});\n');
  write('.gitignore', '.starciwork/\n');
  git(repo, 'add', '.'); git(repo, 'commit', '--quiet', '-m', 'init');
  write('.starciwork/features/login/fr/sign-in/index.yaml', FR('sign-in', 'npx playwright test e2e/sign-in.e2e-spec.ts'));
  write('.starciwork/features/login/fr/sign-out/index.yaml', FR('sign-out', 'npx playwright test e2e/sign-out.e2e-spec.ts'));
  write('.starciwork/features/login/ui/sign-in/index.yaml', UI);
  const seed = (fn) => { const ledger = openLedger({ file: ledgerFileFor(repo) }); try { return fn(ledger); } finally { ledger.close(); } };
  seed((ledger) => {
    ledger.ensureWorkflow({ workflowId: WF, title: 'proof' });
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(WF, 0, 'g0', '# goal', json({ opChain: { legs: [{ op: 'backend.implement' }, { op: 'e2e.verify' }, { op: 'handover.review' }] } }), Date.now());
  });
  /** A job with a bound contract and a filed report, settled `status`. */
  const job = ({ jobId, op, attempt = 1, status = 'succeeded', owned = [], records = [], report = null, admittedAt = Date.now() }) => seed((ledger) => {
    const dispatchId = `ctx-${jobId}`;
    ledger.enqueueJob({ jobId, workflowId: WF, opId: op, attempt, kind: 'op', payload: { opId: op, owned_paths: owned, records, orca: { dispatchId } } });
    ledger.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run(status, Date.now(), jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(WF, op, attempt, dispatchId, '# contract', null, admittedAt);
    if (report) ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(WF, dispatchId, op, attempt, 0, report.outcome, json({ schema: 'starci/op-report@1', summary: 'proof', ...report }), null, Date.now());
  });
  const index = (jobId, opts = {}) => seed((ledger) => indexJobArtifacts(ledger, { repo, jobId, ...opts }));
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  const graph = () => seed((ledger) => recordVersion(ledger, { workflowId: WF, event: 'draw', reason: 'v0', authorOp: 'scope.define', authorJob: 'j-scope', graph: {
    schema: 'starci/work-graph@1', workflow: WF, domains: [{ id: 'login' }],
    nodes: [{ id: 'login.sign-in', domain: 'login', slice: 'login.sign-in', kind: 'slice', title: 'sign in', ownedPaths: ['src/login'], reads: [], rollbackTo: 'login.sign-in', size: { files: 2 }, frs: ['fr.login.sign-in'], shapes: ['SignInBase#refused'] }],
    edges: [] } }));
  return { repo, write, seed, job, index, read, graph };
}

/** An implement leg, then an e2e.verify leg whose report proves fr.login.sign-in by its spec and the refused shape by a claim. */
function proveSignIn(w) {
  w.graph();
  w.job({ jobId: 'j-impl', op: 'backend.implement', owned: ['src/login'], records: ['.starciwork/features/login/fr/sign-in'], report: { outcome: 'done', files: ['src/login/sign-in.ts'] } });
  w.write('.starciwork/evidence/e2e/sign-in.png', PNG);
  w.write('.starciwork/evidence/e2e/score.json', json({ schema: 'starci/ui-proof-score@1', cases: [{ rule: 'ANATOMY-2', case: 'case-1', status: 'pass' }, { rule: 'ANATOMY-3', case: 'case-1', status: 'fail' }] }));
  w.job({ jobId: 'j-e2e', op: 'e2e.verify', owned: ['.starciwork/evidence/e2e'], records: ['.starciwork/features/login/fr/sign-in', '.starciwork/features/login/fr/sign-out', '.starciwork/features/login/ui/sign-in'],
    report: { outcome: 'done', files: ['.starciwork/evidence/e2e/sign-in.png', '.starciwork/evidence/e2e/score.json'],
      checks: [{ name: 'e2e sign-in', command: 'npx playwright test e2e/sign-in.e2e-spec.ts', exitCode: 0 }],
      claims: [{ paths: ['.starciwork/evidence/e2e/sign-in.png'], shapes: ['SignInBase#refused'] }] } });
  const r = w.index('j-e2e');
  assert.equal(r.ok, true, r.error);
  assert.ok(r.proofs >= 2, json(r));
}
const itemOf = (cov, kind, id) => cov.items.find((i) => i.kind === kind && i.id === id);

test('a drawing labelled with a ui record state claims that record shape', (t) => {
  const w = world(t);
  const rows = [{ path: '.starciwork/features/login/ui/sign-in/drawings/refused--page@desktop.png', kind: 'image', label: 'refused--page@desktop' },
    { path: '.starciwork/features/login/ui/sign-in/drawings/other@desktop.png', kind: 'image', label: 'loading@desktop' }];
  const { byPath } = claimsOfJob({ repo: w.repo, job: { op_id: 'interface.draw' }, payload: {}, envelope: { outcome: 'done' }, rows });
  assert.deepEqual(byPath.get(rows[0].path).shapes, ['SignInBase#refused']);
  assert.deepEqual(byPath.get(rows[1].path).shapes, [], 'a state the record does not draw claims nothing');
});

test('claims ride on the report envelope and are validated', () => {
  assert.deepEqual(claimsProblems([{ frs: ['fr.login.sign-in'], cases: ['ANATOMY-2 case-1'], shapes: ['SignInBase#refused'], specs: ['e2e/a.spec.ts'], paths: ['x.png'] }]), []);
  assert.match(claimsProblems([{ paths: ['x.png'] }])[0], /names none/);
  assert.match(claimsProblems([{ shapes: ['SignIn#refused'] }])[0], /XBase#state/);
  assert.equal(validateOpReport({ outcome: 'done', summary: 's', claims: [{ frs: ['fr.a.b'] }] }).ok, true);
  assert.equal(validateOpReport({ outcome: 'done', summary: 's', claims: [{ frs: ['nope'] }] }).ok, false);
});

test('coverage lists every FR, shape and proof case of the scope as proven, stale or missing', (t) => {
  const w = world(t);
  proveSignIn(w);
  const briefCases = () => ['ANATOMY-2 case-1', 'ANATOMY-3 case-1'];
  const cov = w.read((db) => coverageOf(db, WF, { repo: w.repo, briefCases }));
  assert.equal(itemOf(cov, 'fr', 'fr.login.sign-in').status, 'proven');
  assert.equal(itemOf(cov, 'fr', 'fr.login.sign-in').must, true);
  assert.ok(itemOf(cov, 'fr', 'fr.login.sign-in').evidence.some((e) => e.jobId === 'j-e2e' && e.codeSha));
  assert.equal(itemOf(cov, 'fr', 'fr.login.sign-out').status, 'missing');
  assert.equal(itemOf(cov, 'shape', 'SignInBase#refused').status, 'proven');
  assert.deepEqual(itemOf(cov, 'shape', 'SignInBase#refused').evidence.map((e) => e.path), ['.starciwork/evidence/e2e/sign-in.png']);
  assert.equal(itemOf(cov, 'case', 'ANATOMY-2 case-1').status, 'proven');
  assert.equal(itemOf(cov, 'case', 'ANATOMY-3 case-1').status, 'missing', 'a failing scored case proves nothing');
  assert.deepEqual(cov.mustOwed, [{ kind: 'fr', id: 'fr.login.sign-out', status: 'missing' }]);

  w.write('src/login/sign-in.ts', 'export const signIn = 2;\n');
  const after = w.read((db) => coverageOf(db, WF, { repo: w.repo, briefCases }));
  assert.equal(itemOf(after, 'fr', 'fr.login.sign-in').status, 'stale');
  assert.ok(itemOf(after, 'fr', 'fr.login.sign-in').evidence.every((e) => e.changed.includes('src/login')));
  assert.equal(after.summary.mustOwed, 2);

  const cli = runApi('coverage', '--repo', w.repo, '--workflow', WF, '--json');
  assert.equal(cli.status, 0, cli.stderr);
  const out = JSON.parse(cli.stdout);
  assert.equal(out.schema, 'starci/proof-coverage@1');
  assert.equal(itemOf(out, 'fr', 'fr.login.sign-in').status, 'stale');
});

test('a proof goes stale when its code changes; status re-runs only its check op, and a re-index never freshens it', (t) => {
  const w = world(t);
  proveSignIn(w);
  assert.deepEqual(w.read((db) => staleProofsOf(db, WF, { repo: w.repo })), []);
  w.write('src/other/x.ts', 'export const x = 2;\n');
  assert.deepEqual(w.read((db) => staleProofsOf(db, WF, { repo: w.repo })), [], 'a path the proof does not depend on changes nothing');

  w.write('src/login/sign-in.ts', 'export const signIn = 2;\n');
  const stale = w.read((db) => staleProofsOf(db, WF, { repo: w.repo }));
  assert.equal(stale.length, 1);
  assert.equal(stale[0].jobId, 'j-e2e');
  assert.equal(stale[0].op, 'e2e.verify');
  assert.ok(stale[0].items.includes('fr fr.login.sign-in'));
  assert.deepEqual(stale[0].changed, ['src/login']);

  w.index('j-e2e', { event: 'on-change' });
  assert.equal(w.read((db) => staleProofsOf(db, WF, { repo: w.repo })).length, 1, 're-indexing unchanged bytes keeps the old baseline');

  const r = runApi('status', '--repo', w.repo, '--workflow', WF, '--json');
  assert.equal(r.status, 0, r.stderr);
  const status = JSON.parse(r.stdout);
  const checks = status.nextActions.filter((a) => a.kind === 'impact-check');
  assert.deepEqual(checks.map((a) => [a.op, a.jobId]), [['e2e.verify', 'j-e2e']], json(status.nextActions));
  assert.equal(status.frontier.staleProofs[0].jobId, 'j-e2e');

  w.job({ jobId: 'j-e2e-2', op: 'e2e.verify', attempt: 2, status: 'running', owned: ['.starciwork/evidence/e2e'] });
  assert.deepEqual(w.read((db) => staleProofsOf(db, WF, { repo: w.repo })), [], 'an open attempt of the check op owns the re-proof');
});

test('verify-proofs catches a modified or missing file, a ledger row edited to match, and a broken chain', (t) => {
  const w = world(t);
  proveSignIn(w);
  const verify = () => { const r = runApi('verify-proofs', '--repo', w.repo, '--workflow', WF, '--json'); return { code: r.status, out: JSON.parse(r.stdout) }; };
  const clean = verify();
  assert.equal(clean.code, 0, json(clean.out));
  assert.equal(clean.out.ok, true);
  assert.equal(clean.out.files.unchained, 0, 'artifacts-indexed chains every indexed sha256');
  assert.ok(clean.out.files.checked >= 3);
  const chained = w.read((db) => JSON.parse(db.prepare("SELECT payload_json FROM events WHERE kind='artifacts-indexed' ORDER BY seq DESC LIMIT 1").get().payload_json));
  assert.ok(chained.artifacts.some((a) => a.path === '.starciwork/evidence/e2e/sign-in.png' && /^[0-9a-f]{64}$/.test(a.sha256)));

  const png = path.join(w.repo, '.starciwork/evidence/e2e/sign-in.png');
  fs.appendFileSync(png, 'x');
  const modified = verify();
  assert.equal(modified.code, 1);
  assert.deepEqual(modified.out.files.tampered.map((x) => [x.path, x.reason]), [['.starciwork/evidence/e2e/sign-in.png', 'modified']]);

  const forged = w.seed((ledger) => {
    const sha = verifyProofs(ledger.db, WF, { repo: w.repo }).files.tampered[0].actual;
    ledger.db.prepare('UPDATE job_artifacts SET sha256=? WHERE path=?').run(sha, '.starciwork/evidence/e2e/sign-in.png');
    return verifyProofs(ledger.db, WF, { repo: w.repo });
  });
  assert.deepEqual(forged.files.tampered.map((x) => x.reason), ['modified'], 'the chained sha256 outranks an edited row');

  fs.rmSync(png);
  assert.deepEqual(verify().out.files.tampered.map((x) => x.reason), ['missing']);

  w.seed((ledger) => ledger.db.prepare("UPDATE events SET payload_json=? WHERE seq=(SELECT MIN(seq) FROM events WHERE kind='artifacts-indexed')").run(json({ forged: true })));
  const broken = verify();
  assert.equal(broken.out.chain.ok, false);
  assert.ok(broken.out.chain.broken.some((b) => b.kind === 'artifacts-indexed'));
});

test('a handover ask is refused while a must-have FR is missing or stale; a leg admitted earlier asks as admitted', (t) => {
  const w = world(t);
  proveSignIn(w);
  const ask = (jobId, admittedAt, attempt) => {
    w.job({ jobId, op: 'handover.review', attempt, status: 'running', owned: [`.starciwork/evidence/${WF}.handover`], admittedAt });
    const file = w.write(`${jobId}.json`, json({ schema: 'starci/op-report@1', outcome: 'ask', summary: 'handover', question: { text: 'Handover: the app is done.', options: OPTIONS } }));
    return runApi('report', '--repo', w.repo, '--job', jobId, '--report', file, '--json');
  };
  const refused = ask('j-ho-1', effectiveAt() + 1000, 1);
  assert.notEqual(refused.status, 0);
  const error = JSON.parse(refused.stderr.trim().split('\n').at(-1));
  assert.equal(error.code, 'handover-proof-owed');
  assert.match(error.error, /fr fr\.login\.sign-out is missing/);
  assert.doesNotMatch(error.error, /fr\.login\.sign-in /);

  const older = ask('j-ho-2', effectiveAt() - 1000, 2);
  assert.equal(older.status, 0, older.stderr);
});
