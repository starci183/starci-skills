// Autopilot (owner ruling 2026-09-28 autopilot-run-to-finish; scripts/kernel/autopilot-run.mjs): "Run to the finish in
// one go. Don't stop to ask the owner - not even UX/UI review. When everything is done, the owner reviews once."
// Machine-gated reviews are accepted provisionally (never golden, never an owner answer), runtime/process gates go
// to the Supervisor, credentials / real money / shared systems are deferred to handover, and provision.ask is only
// the one end-of-flow checklist.
import test from 'node:test';
import { putBundle } from '../../engine/db/blob.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { stringifyYaml, parseYaml } from '../../engine/yaml.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import {seedWorkflow, withLedger} from '../helpers/ledger-fixture.mjs';
import { AUTOPILOT_BY, SUPERVISOR_GATE, autopilotAnswerAsk, autopilotAskClass, autopilotOf, autopilotSettings, drawGateEvidence, routeCapUnderAutopilot, budgetOf, autopilotSweep } from '../../scripts/kernel/autopilot-run.mjs';
import { ownerAnswerProof } from '../../scripts/machine/owner-claim.mjs';
import { applyDrawReview, drawReviewQuestion, drawReviewStatus } from '../../scripts/work/draw-review.mjs';
import { repeatedAnswerOf } from '../../scripts/machine/owner-answers.mjs';
import { buildProduct, layoutCapture, uiSkeleton } from '../fixtures/layout-tree.mjs';
import { layoutTreeMain } from '../../scripts/work/layout-tree.mjs';
import { blankImage, drawOver, encodePng } from '../../scripts/work/png.mjs';
import { composeDirection } from '../../scripts/work/compose-direction.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const baseEnv = (() => { const e = { ...process.env, STARCI_CONNECTORS_OFF: '1', ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: '' }; delete e.STARCI_OP_JOB; delete e.STARCI_AUTOPILOT; return e; })();
const run = (env, ...args) => spawnSync(process.execPath, [API, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...baseEnv, ...env } });
const json = (r) => { try { return JSON.parse(r.stdout); } catch { const s = r.stdout || r.stderr; const open = s.indexOf('{'), close = s.lastIndexOf('}'); return open < 0 ? null : JSON.parse(s.slice(open, close + 1)); } };
const seed = (repo, fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
const read = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
const WF = 'wf-autopilot';
// An attempt that ended longer ago than the usage sweep's interval (allocation.usageEveryMs) has had its usage metered or is unknown.
const PAST_METERING = allocationMs('usageEveryMs') * 2;

const world = (t, legs = [{ op: 'backend.implement' }, { op: 'e2e.verify' }, { op: 'handover.review' }]) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-autopilot-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  seed(repo, (l) => {
    l.ensureWorkflow({ workflowId: WF, title: 'autopilot spec' });
    l.write.changeWorkflowPhase({workflowId:WF,to:'running',by:'test',reason:'seed autopilot workflow'});
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(WF, 0, 'agoal', '# goal', JSON.stringify({ opChain: { legs }, derivedPlan: { legs, edges: legs.slice(1).map((l, i) => [legs[i].op, l.op]) } }), Date.now());
  });
  return repo;
};
const seedJob = (l, { jobId, op, attempt = 1, status = 'failed', result = null, params = null, retryOf = null, dispatchId = null }) => {
  const at = Date.now();
  seedWorkflow(l,{id:WF,jobs:[{jobId,opId:op,status,result,dispatchId:dispatchId??`seed:${jobId}`,createdAt:at,
    payload:{opId:op,owned_paths:[`.starciwork/evidence/${WF}.${op}`],...(params?{params}:{}),...(retryOf?{retry:{retryOf}}:{})}}]});
};
/** A settled ask: the job settled awaiting_owner and its filed ask report. */
const seedAsk = (repo, { jobId, op, dispatchId, question, params = null }) => seed(repo, (l) => {
  seedJob(l, { jobId, op, params, dispatchId, status: 'awaiting_owner', result: { verdict: 'awaiting-owner', kernelVerdict: 'blocked', askDispatchId: dispatchId } });
  const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  l.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(WF, attemptId, dispatchId, jobId, 'ask', JSON.stringify({ schema: 'starci/op-report@1', outcome: 'ask', from: jobId, summary: 'ask', question }), Date.now(), Date.now());
});
const status = (repo, env = {}) => { const r = run(env, 'status', '--repo', repo, '--workflow', WF, '--json'); assert.equal(r.status, 0, r.stderr); return json(r); };

const CREDENTIAL = { kind: 'credential', text: 'VNPAY sandbox: nh\u1eadp vnpay-hash-secret.key v\u00e0 VNPAY_TMN_CODE', options: [], refs: [] };
const PAYOS = { kind: 'irreversible-confirmation', text: '\u0110\u0103ng k\u00fd webhook dev l\u00ean k\u00eanh PayOS d\u00f9ng chung c\u1ee7a Academy v\u00e0 m\u1ed9t giao d\u1ecbch th\u1eadt 229.000 VND',
  options: ['Cho ph\u00e9p c\u1ea3 ba ph\u1ea7n (giao d\u1ecbch th\u1eadt)', 'Ch\u1ec9 webhook', 'Kh\u00f4ng'], recommended: 0, recommendedReason: 'ch\u1ee9ng minh tr\u1ef1c ti\u1ebfp' };

test('ask classes: reviews are provisional candidates; credentials, real money and shared systems wait for the end; handover stays the owner\'s', () => {
  assert.equal(autopilotAskClass({ opId: 'interface.draw', question: { kind: 'draw-review', text: 'x', options: ['a', 'b'] } }).class, 'draw-review');
  assert.equal(autopilotAskClass({ opId: 'brand.decide', question: { kind: 'brand-direction-review', text: 'x', options: ['a', 'b'] } }).class, 'direction-review');
  assert.equal(autopilotAskClass({ opId: 'provision.ask', question: CREDENTIAL }).class, 'credential');
  const payos = autopilotAskClass({ opId: 'provision.ask', question: PAYOS });
  assert.equal(payos.class, 'real-money', 'a recommended option never answers a real payment');
  assert.ok(payos.classes.includes('shared-system'));
  // "ch\u01b0a thu ti\u1ec1n th\u1eadt" (no real money yet) is no real-money ask.
  assert.equal(autopilotAskClass({ opId: 'provision.ask', question: { kind: 'credential', text: 'sandbox, ch\u01b0a thu ti\u1ec1n th\u1eadt: MOMO_PARTNER_CODE', options: [] } }).class, 'credential');
  assert.equal(autopilotAskClass({ opId: 'business.decide', question: { kind: 'decision', text: 'Which tax?', options: ['A (khuy\u1ebfn ngh\u1ecb)', 'B'] } }).class, 'recommended');
  assert.equal(autopilotAskClass({ opId: 'business.decide', question: { kind: 'decision', text: 'Which tax?', options: ['A', 'B'] } }).class, 'owner-decision');
  assert.equal(autopilotAskClass({ opId: 'handover.review', question: { text: 'x', options: ['a', 'b', 'c'] } }).class, 'owner-handover');
  assert.equal(autopilotAskClass({ opId: 'provision.ask', question: CREDENTIAL, subject: 'handover-credentials' }).class, 'owner-handover');
});

test('settings: on by default for every workflow; STARCI_AUTOPILOT and a per-workflow runtimes.yaml entry override', () => {
  assert.equal(autopilotSettings({ autopilot: { enabled: true } }).enabled, true);
  const prior = process.env.STARCI_AUTOPILOT;
  try { process.env.STARCI_AUTOPILOT = 'off'; assert.equal(autopilotSettings({ autopilot: { enabled: true } }).enabled, false); }
  finally { if (prior === undefined) delete process.env.STARCI_AUTOPILOT; else process.env.STARCI_AUTOPILOT = prior; }
  const fakeDb = { prepare: () => ({ get: () => null }) };
  assert.equal(autopilotOf(fakeDb, 'wf-x', autopilotSettings({ autopilot: { enabled: true, workflows: { 'wf-x': { enabled: false } } } })).on, false);
  assert.equal(autopilotOf(fakeDb, 'wf-y', autopilotSettings({ autopilot: { enabled: true, workflows: { 'wf-x': { enabled: false } } } })).on, true);
});

test('a credential ask is deferred to handover: nothing waits on the owner, the live proof waits for the checklist, the rest proceeds', (t) => {
  const repo = world(t);
  seedAsk(repo, { jobId: 'job-prov', op: 'provision.ask', dispatchId: 'ctx_cred0001', question: CREDENTIAL });
  // This settled private ask has explicit fixture usage; missing usage is tested separately below.
  seed(repo, l => {
    const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('job-prov').attempt_id;
    assert.equal(l.write.recordAttemptUsage({attemptId,source:'provider-report',
      rows:[{model:'private-test-model',inputTokens:17,outputTokens:5,cacheReadTokens:0,cacheWriteTokens:0}]}).recorded,true);
    const measured=budgetOf(l.db,WF,autopilotSettings({autopilot:{budgets:{tokens:1000}}}));
    assert.equal(measured.used.tokens,22);assert.equal(measured.coverage.complete,true);
    assert.deepEqual(measured.unverified,[]);assert.deepEqual(measured.exceeded,[]);
  });
  seed(repo, (l) => seedJob(l, { jobId: 'job-e2e', op: 'e2e.verify', status: 'queued' }));
  const s = status(repo);
  assert.equal(s.autopilot.on, true);
  assert.deepEqual(s.autopilot.deferredToHandover.map((d) => [d.dispatchId, d.deferClass]), [['ctx_cred0001', 'credential']]);
  assert.match(s.autopilot.deferredToHandover[0].stubPath, /placeholder/);
  assert.deepEqual(s.autopilot.deferredToHandover[0].fields, { files: ['vnpay-hash-secret.key'], vars: ['VNPAY_TMN_CODE'] });
  assert.equal(s.awaitingOwner[0].answer, 'deferred-to-handover');
  assert.ok(!s.nextActions.some((a) => a.kind === 'owner-gate'), JSON.stringify(s.nextActions));
  assert.notEqual(s.frontier.state, 'awaiting-owner');
  const e2e = s.frontier.queued.find((q) => q.jobId === 'job-e2e');
  assert.equal(e2e.queuedBecause, 'deferred-to-handover');
  // Nothing was answered for the owner, and the checklist carries the fields for the one end-of-flow form.
  assert.equal(read(repo, (db) => db.prepare("SELECT count(*) n FROM events WHERE kind='ask-answered'").get().n), 0);
  const c = json(run({}, 'autopilot', '--repo', repo, '--workflow', WF, '--checklist', '--json'));
  assert.equal(c.question.checklist, 'handover-credentials');
  assert.match(c.question.text, /vnpay-hash-secret\.key/);
  assert.match(c.question.text, /VNPAY_TMN_CODE/);
  // With autopilot off the same ask is the owner's, as before.
  const off = world(t);
  seedAsk(off, { jobId: 'job-prov', op: 'provision.ask', dispatchId: 'ctx_cred0002', question: CREDENTIAL });
  const so = status(off, { STARCI_AUTOPILOT: 'off' });
  assert.equal(so.autopilot.on, false);
  assert.ok(so.nextActions.some((a) => a.kind === 'owner-gate'));
});

test('real money and a shared external system are deferred, never taken on their recommendation', (t) => {
  const repo = world(t);
  seedAsk(repo, { jobId: 'job-payos', op: 'provision.ask', dispatchId: 'ctx_payos001', question: PAYOS });
  const s = status(repo);
  assert.equal(s.autopilot.deferredToHandover[0].deferClass, 'real-money');
  assert.match(s.autopilot.deferredToHandover[0].stubPath, /sandbox/);
  assert.equal(read(repo, (db) => db.prepare("SELECT count(*) n FROM events WHERE kind='ask-answered'").get().n), 0);
});

test('autopilot answers a recommended ask in one ledger transaction: the receipt joins the open transaction', (t) => {
  const repo = world(t);
  seedAsk(repo, { jobId: 'job-rec', op: 'business.decide', dispatchId: 'ctx_rec00001', question: { kind: 'decision', text: 'Which tax?', options: ['A (khuy\u1ebfn ngh\u1ecb)', 'B'] } });
  const l = openLedger({ file: ledgerFileFor(repo) });
  try {
    const report = l.db.prepare("SELECT r.*, a.op_id FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.dispatch_id='ctx_rec00001'").get();
    const r = autopilotAnswerAsk({ ledger: l, repo, workflowId: WF, report });
    assert.equal(r.action, 'recommended');
    assert.equal(l.db.prepare("SELECT count(*) n FROM events WHERE kind='ask-answered'").get().n, 1);
    assert.equal(l.db.prepare("SELECT count(*) n FROM decisions WHERE workflow_id=?").get(WF).n, 1);
  } finally { l.close(); }
});

test('provision.ask opens only as the end-of-flow checklist; a mid-flow need is recorded deferred-to-handover', (t) => {
  const repo = world(t);
  const r = run({}, 'enqueue', '--repo', repo, '--workflow', WF, '--op', 'provision.ask', '--paths', `.starciwork/evidence/${WF}.p`, '--json');
  assert.equal(r.status, 1);
  assert.equal(json(r).reason, 'autopilot-provision-deferred');
  const d = run({}, 'autopilot', '--repo', repo, '--workflow', WF, '--defer-to-handover', '--op', 'backend.implement', '--class', 'credential', '--detail', 'MoMo test keys', '--fields', 'momo-secret-key.key,MOMO_PARTNER_CODE', '--json');
  assert.equal(d.status, 0, d.stderr);
  const s = status(repo);
  assert.deepEqual(s.autopilot.deferredToHandover.map((x) => x.deferClass), ['credential']);
});

test('an owner gate is the Supervisor\'s under autopilot: raised or older gates become supervisor-gates; an owner claim is still refused', (t) => {
  const repo = world(t);
  seed(repo, (l) => seedJob(l, { jobId: 'job-be', op: 'backend.implement', status: 'queued' }));
  const raised = json(run({}, 'incident', '--repo', repo, '--workflow', WF, '--kind', 'owner-gate', '--detail', 'hold for a checker defect', '--holds', 'job-be', '--json'));
  assert.equal(raised.kind, SUPERVISOR_GATE);
  // An owner-gate row from before autopilot is re-routed by the next status.
  seed(repo, (l) => {
    l.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,kind,owner,last_progress,status,created_at,updated_at) VALUES('inc-old',?,?,'owner-ask','owner','[owner-gate] retry cap 3 of 3','open',?,?)").run(WF, 'backend.implement', Date.now(), Date.now());
    l.appendEvent({ workflowId: WF, entityType: 'incident', entityId: 'inc-old', kind: 'incident-raised', payload: { kind: 'owner-gate', detail: 'retry cap 3 of 3', holds: ['job-be'] } });
  });
  const s = status(repo);
  assert.deepEqual(s.autopilot.supervisorGates.map((g) => g.incidentId).sort(), [raised.incidentId, 'inc-old'].sort());
  assert.equal(s.frontier.queued.find((q) => q.jobId === 'job-be').queuedBecause, SUPERVISOR_GATE);
  assert.ok(s.nextActions.some((a) => a.kind === SUPERVISOR_GATE));
  assert.ok(!s.nextActions.some((a) => a.kind === 'owner-gate'));
  assert.equal(s.frontier.state, 'supervisor-wait');
  assert.equal(s.frontier.actionable, false);
  // The owner-claim guard keeps refusing a fake owner claim; the Supervisor resolves with what landed.
  const fake = run({}, 'incident', '--repo', repo, '--workflow', WF, '--resolve', 'inc-old', '--detail', 'Owner confirmed the retry', '--json');
  assert.equal(fake.status, 1);
  assert.equal(json(fake).code, 'owner-claim-unproven');
  const ok = run({}, 'incident', '--repo', repo, '--workflow', WF, '--resolve', 'inc-old', '--by', 'supervisor', '--detail', 'fixed by .claude abc1234: checker defect', '--json');
  assert.equal(ok.status, 0, ok.stderr);
});

test('retry caps: supervisor-gate within supervisorExtraBudget, then the leg is deferred', () => {
  const settings = autopilotSettings({ autopilot: { enabled: true, supervisorExtraBudget: 2 } });
  const db = { prepare: () => ({ get: () => null }) };
  const job = { workflow_id: WF };
  const row = (kind) => ({ result_json: JSON.stringify({ nextStep: { route: 'r1', kind } }) });
  assert.equal(routeCapUnderAutopilot(db, job, { lineage: [row('retry')], routeId: 'r1', settings }).kind, SUPERVISOR_GATE);
  assert.equal(routeCapUnderAutopilot(db, job, { lineage: [row(SUPERVISOR_GATE)], routeId: 'r1', settings }).kind, SUPERVISOR_GATE);
  assert.equal(routeCapUnderAutopilot(db, job, { lineage: [row(SUPERVISOR_GATE), row(SUPERVISOR_GATE)], routeId: 'r1', settings }).kind, 'deferred');
  assert.equal(routeCapUnderAutopilot(db, job, { lineage: [], routeId: 'r1', settings: autopilotSettings({ autopilot: { enabled: false } }) }), null);
});

/** A ui record with one live part drawn through a passing draw loop, beauty `beauty`, with its rationale. */
const loopRecord = (t, { beauty = 9, outcome = 'passed', rationale = true } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-autopilot-ui-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'assets', 'loop'), { recursive: true });
  const png = path.join(dir, 'assets', 'p.png');
  fs.writeFileSync(png, encodePng(blankImage(4, 4, [10, 20, 30, 255])));
  fs.writeFileSync(path.join(dir, 'assets', 'p.html'), '<main></main>');
  if (rationale) fs.writeFileSync(path.join(dir, 'assets', 'p.rationale.json'), '{"decisions":[]}');
  const sha = createHash('sha256').update(fs.readFileSync(png)).digest('hex');
  fs.writeFileSync(path.join(dir, 'assets', 'loop', 'loop.json'), JSON.stringify({ schema: 'starci/draw-loop@1', outcome, installed: [{ sha256: sha }],
    rounds: [{ n: 1, allPass: outcome === 'passed', failures: outcome === 'passed' ? 0 : 2, beauty }], remaining: outcome === 'passed' ? [] : [{ code: 'DNA_OFF_GRAMMAR' }] }));
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ schema: 'work/ui-screen@1', id: 'ui.x.y', state: 'todo',
    assets: [{ path: 'assets/p.png', role: 'direction-content', breakpoint: 'desktop', theme: 'light', sha256: sha, generation: { tool: 'draw-render', mode: 'draw-loop', loop: { sha256: putBundle(path.join(dir, 'assets', 'loop')), round: 1 } } }] }));
  return { dir, sha };
};

test('draw gates: provisional only when the loop passed, the critic scored at least beautyMin and a rationale exists', (t) => {
  const good = loopRecord(t);
  const ok = drawGateEvidence({ repo: good.dir, recordPath: 'index.yaml', reviewed: [{ path: 'assets/p.png', sha256: good.sha }], beautyMin: 8 });
  assert.equal(ok.ok, true, JSON.stringify(ok.findings));
  assert.equal(ok.parts[0].beauty, 9);
  const ugly = loopRecord(t, { beauty: 6 });
  assert.deepEqual(drawGateEvidence({ repo: ugly.dir, recordPath: 'index.yaml', beautyMin: 8 }).findings.map((f) => f.code), ['DRAW_BEAUTY_BELOW']);
  const red = loopRecord(t, { outcome: 'blocked', rationale: false });
  assert.deepEqual(new Set(drawGateEvidence({ repo: red.dir, recordPath: 'index.yaml', beautyMin: 8 }).findings.map((f) => f.code)), new Set(['DRAW_METRICS_FAILED', 'DRAW_RATIONALE_MISSING']));
  const stale = drawGateEvidence({ repo: good.dir, recordPath: 'index.yaml', reviewed: [{ path: 'assets/p.png', sha256: 'f'.repeat(64) }], beautyMin: 8 });
  assert.deepEqual(stale.findings.map((f) => f.code), ['REVIEW_PART_REDRAWN']);
});

// The greenfield layout draw of tests/work/draw-review.spec.mjs, reused: apply settles a provisional acceptance.
function greenfield(t) {
  const p = buildProduct(t, { files: {} });
  const planned = layoutTreeMain(['plan', '--work', p.work, '--node', '/(app)', '--files', 'layout,page', '--design', 'ui.home.app-layout', '--write']);
  assert.equal(planned.exitCode, 0, planned.text);
  const file = path.join(p.work, 'shell', 'index.yaml');
  const tree = parseYaml(fs.readFileSync(file, 'utf8'));
  tree.breakpoints = [{ name: 'desktop', width: 40, height: 30 }, { name: 'mobile', width: 20, height: 30 }];
  fs.writeFileSync(file, stringifyYaml(tree));
  const dir = path.join(p.work, 'features', 'home', 'ui', 'app-layout');
  fs.mkdirSync(path.join(dir, 'assets', 'directions'), { recursive: true });
  const record = uiSkeleton('ui.home.app-layout', { route: '/(app)', surface: 'layout', shell: { ref: 'shell', rev: tree.rev, layouts: [] },
    ui: { status: 'Proposed.', intent: 'Frame.', surfaces: [{ name: 'app-layout', route: '/(app)', purpose: 'Frame.', actors: ['student'] }],
      states: [{ name: 'default', trigger: 'Open.', behavior: 'Chrome.' }],
      coverage: { scale: 'bounded', representativeScreens: ['app-layout'], map: [{ screen: 'app-layout', state: 'default', viewport: '40x30 desktop light', breakpoint: 'desktop', theme: 'light', components: ['TopBar'] }, { screen: 'app-layout', state: 'default', viewport: '20x30 mobile light', breakpoint: 'mobile', theme: 'light', components: ['TopBar'] }] },
      accessibility: ['One banner.'], responsive: ['BottomNav.'], observations: ['Proposed.'], gaps: [] } });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets: [] }));
  const assets = [];
  for (const [bp, w, h, slot] of [['desktop', 40, 30, { x: 10, y: 6, width: 30, height: 24 }], ['mobile', 20, 30, { x: 0, y: 6, width: 20, height: 24 }]]) {
    const drawing = layoutCapture(w, h, slot, [20, 40, 160, 255]);
    drawOver(drawing, blankImage(6, 4, [250, 200, 0, 255]), 1, 1);
    const content = path.join(dir, 'assets', 'directions', `default--page--${bp}--light.content.png`);
    fs.writeFileSync(content, encodePng(drawing));
    fs.writeFileSync(content.replace(/\.png$/, '.prompt.txt'), 'App layout. Product locale: en.');
    const result = composeDirection({ uiDir: dir, content, breakpoint: bp, theme: 'light' });
    assert.equal(result.ok, true, result.error);
    assets.push({ ...result.contentAsset, generation: { tool: 'image_gen.imagegen', promptPath: `assets/directions/default--page--${bp}--light.content.prompt.txt`, mode: 'slot' } }, { ...result.asset, selected: true });
  }
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets }));
  return { ...p, dir };
}
const autopilotReceipt = (p, question, { provisional = true, optionIndex = 0 } = {}) => {
  const dir = path.join(p.work, 'kernel-evidence', WF, 'serve-ask');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `answer-${Date.now()}-${provisional}.json`);
  fs.writeFileSync(file, JSON.stringify({ schema: 'starci/ask-answer@1', workflowId: WF, dispatchId: 'ctx_pilot0001', opId: 'interface.draw', option: question.options[optionIndex], optionIndex,
    answeredBy: AUTOPILOT_BY, ...(provisional ? { provisional: true, acceptance: { provisional: true, by: AUTOPILOT_BY, receipt: { ok: true, beautyMin: 8, parts: [] } } } : {}),
    custodyWritten: [], envWritten: [], pointersWritten: [], errors: [], note: 'autopilot', at: '2026-09-28T01:00:00.000Z', review: question.review }, null, 2));
  return file;
};

test('a provisional acceptance settles the drawing done (self-accepted provisional), owes nothing now, is never golden and never an owner acceptance', (t) => {
  const p = greenfield(t);
  const q = drawReviewQuestion(p.dir);
  assert.throws(() => applyDrawReview(p.dir, autopilotReceipt(p, q, { provisional: false }), { write: true }), /only provisionally/);
  const r = applyDrawReview(p.dir, autopilotReceipt(p, q), { write: true });
  assert.equal(r.decision, 'accept');
  assert.equal(r.golden, undefined, 'autopilot never promotes a golden');
  const record = parseYaml(fs.readFileSync(path.join(p.dir, 'index.yaml'), 'utf8'));
  assert.equal(record.state, 'done');
  assert.equal(record.ui.review.owner.provisional, true);
  assert.equal(record.ui.review.owner.answeredBy, AUTOPILOT_BY);
  assert.match(record.because, /PROVISIONALLY by autopilot/);
  const s = drawReviewStatus(p.dir);
  assert.equal(s.owed, false, s.why);
  assert.equal(s.provisional, true);
  assert.match(s.why, /provisionally accepted by autopilot/);
});

test('an autopilot answer is never an owner answer, and a handover re-open needs the owner\'s own handover answer', (t) => {
  const repo = world(t);
  seedAsk(repo, { jobId: 'job-ho', op: 'handover.review', dispatchId: 'ctx_handover1', question: { text: 'B\u00e0n giao', options: ['Duy\u1ec7t', 'G\u00f3p \u00fd', 'H\u1ecfi'] } });
  const dir = path.join(repo, '.starciwork', 'kernel-evidence', WF, 'serve-ask');
  fs.mkdirSync(dir, { recursive: true });
  const receiptPath = path.join(dir, 'answer-1.json');
  fs.writeFileSync(receiptPath, JSON.stringify({ schema: 'starci/ask-answer@1', workflowId: WF, dispatchId: 'ctx_handover1', optionIndex: 1, answeredBy: AUTOPILOT_BY, note: 'redraw it' }));
  seed(repo, (l) => {
    l.appendEvent({ workflowId: WF, entityType: 'report', entityId: 'ctx_handover1', kind: 'ask-answered', payload: { dispatchId: 'ctx_handover1', receiptPath, answeredBy: AUTOPILOT_BY } });
    l.appendEvent({ workflowId: WF, entityType: 'report', entityId: 'ctx_draw1', kind: 'autopilot-provisional', payload: { dispatchId: 'ctx_draw1', opId: 'interface.draw', jobId: 'job-ho', record: 'ui.x', by: AUTOPILOT_BY } });
  });
  read(repo, (db) => assert.equal(ownerAnswerProof(db, 'ctx_handover1').ok, false));
  const r = run({}, 'autopilot', '--repo', repo, '--workflow', WF, '--reopen', 'ctx_draw1', '--handover-answer', 'ctx_handover1', '--json');
  assert.equal(r.status, 1);
  assert.equal(json(r).code, 'owner-claim-unproven');
  // Nor can an owner claim rest on it.
  const inc = json(run({}, 'incident', '--repo', repo, '--workflow', WF, '--kind', 'source-runtime-defect', '--detail', 'x', '--json')).incidentId;
  const fake = run({}, 'incident', '--repo', repo, '--workflow', WF, '--resolve', inc, '--detail', 'owner approved', '--owner-answer', 'ctx_handover1', '--json');
  assert.equal(json(fake).code, 'owner-claim-unproven');
});

test('a brand-direction review repeats only by its text: a revised rev is a new question', () => {
  const answers = [{ dispatchId: 'ctx_a', question: 'Duy\u1ec7t h\u01b0\u1edbng rev 1 [desktop aaaa]', options: ['Ch\u1ea5p nh\u1eadn', 'S\u1eeda l\u1ea1i'], attempt: 1 }];
  assert.equal(repeatedAnswerOf({ kind: 'brand-direction-review', text: 'Duy\u1ec7t h\u01b0\u1edbng rev 2 [desktop bbbb]', options: ['Ch\u1ea5p nh\u1eadn', 'S\u1eeda l\u1ea1i'] }, answers, { op: 'brand.decide' }), null);
  assert.ok(repeatedAnswerOf({ kind: 'brand-direction-review', text: 'Duy\u1ec7t h\u01b0\u1edbng rev 1 [desktop aaaa]', options: ['Ch\u1ea5p nh\u1eadn', 'S\u1eeda l\u1ea1i'] }, answers, { op: 'brand.decide' }));
});

// Real attempt/usage writers prove the meter follows dispatch history, not queued job declarations.
const withUsageBudget = (t, fn) => withLedger(t, ({ ledger, repoRoot }) => {
  ledger.ensureWorkflow({ workflowId: WF });
  ledger.write.changeWorkflowPhase({ workflowId: WF, to: 'running', by: 'test', reason: 'usage budget fixture' });
  const queue = (jobId) => {
    ledger.write.createUnit({ workflowId: WF, unitId: jobId, opId: 'test.op', subjectKey: jobId, goalRevision: 1 });
    ledger.enqueueJob({ workflowId: WF, jobId, unitId: jobId, opId: 'test.op', kind: 'op', payload: { usage: { totalTokens: 999999 } } });
  };
  const dispatch = (jobId, dispatchId) => {
    if (ledger.getJob(jobId).status === 'queued') ledger.write.setJobStatus({ jobId, to: 'ready', reason: 'test dispatch' });
    ledger.write.setJobStatus({ jobId, to: 'leased', reason: 'test dispatch' });
    const attempt = ledger.write.startAttempt({ workflowId: WF, jobId, dispatchId, provider: 'codex', dispatchedAt: Date.now() });
    ledger.write.setJobStatus({ jobId, to: 'running', reason: 'test worker accepted' });
    return attempt.attempt_id;
  };
  const end = (jobId, attemptId, endedAgoMs = 0) => {
    ledger.write.updateAttempt({ attemptId, settledAt: Date.now() - endedAgoMs, endState: 'worker-dead' });
    ledger.write.setJobStatus({ jobId, to: 'ready', reason: 'test worker died; retry same job' });
  };
  return fn({ ledger, repoRoot, queue, dispatch, end, settings: autopilotSettings({ autopilot: { budgets: { attempts: 10, tokens: 1000, wallMs: 100000 } } }) });
});

test('autopilot budgets count each real dispatch and measured attempt/Kernel tokens once, ignoring queued jobs and payload claims', t => withUsageBudget(t, ({ ledger, queue, dispatch, end, settings }) => {
  queue('meter-queued-a'); queue('meter-queued-b'); queue('meter-work');
  assert.equal(budgetOf(ledger.db, WF, settings).used.attempts, 0);
  const first = dispatch('meter-work', 'ctx_meter_first');
  const rows = [{ model: 'm', inputTokens: 100, outputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 30, reasoningTokens: 99 }];
  assert.equal(ledger.write.recordAttemptUsage({ attemptId: first, rows }).recorded, true);
  assert.equal(ledger.write.recordAttemptUsage({ attemptId: first, rows }).recorded, false);
  end('meter-work', first);
  const second = dispatch('meter-work', 'ctx_meter_retry');
  ledger.write.recordAttemptUsage({ attemptId: second, rows: [{ model: 'm', inputTokens: 5, outputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0 }] });
  end('meter-work', second);
  const kernel = { workflowId: WF, turnRef: 'kernel:meter:s1@1', provider: 'codex', rows: [{ model: 'm', inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 5 }] };
  assert.equal(ledger.write.recordKernelUsage(kernel).recorded, true);
  assert.equal(ledger.write.recordKernelUsage(kernel).recorded, false);
  const result = budgetOf(ledger.db, WF, settings);
  assert.equal(result.used.attempts, 2, 'two dispatches of one job spend two attempts; queued work spends none');
  assert.equal(result.used.tokens, 186, 'detail rows include Kernel usage; summaries, reasoning and job payloads are not added again');
  assert.equal(result.coverage.complete, true);
  assert.deepEqual(result.exceeded, []);
  const capped = budgetOf(ledger.db, WF, { ...settings, budgets: { ...settings.budgets, attempts: 1, tokens: 185 } });
  assert.deepEqual(capped.exceeded, ['attempts', 'tokens']);
}));

test('completed missing usage is unknown and holds dispatch through the existing Supervisor gate; later measurement replaces unknown', t => withUsageBudget(t, ({ ledger, repoRoot, queue, dispatch, end, settings }) => {
  queue('meter-unavailable'); queue('meter-pending');
  const unavailable = dispatch('meter-unavailable', 'ctx_meter_unavailable');
  end('meter-unavailable', unavailable, PAST_METERING);
  ledger.write.markAttemptUsageUnavailable({ attemptId: unavailable, reason: 'private fixture has no adapter result' });
  const pending = dispatch('meter-pending', 'ctx_meter_pending');
  end('meter-pending', pending, PAST_METERING);
  const before = budgetOf(ledger.db, WF, settings);
  assert.equal(before.used.tokens, null, 'completed unmeasured attempts cannot claim verified zero');
  assert.equal(before.measured.tokens, 0);
  assert.deepEqual(before.unverified, ['tokens']);
  assert.equal(before.coverage.unknown, 2);
  assert.equal(before.coverage.complete, false);
  const sweep = autopilotSweep({ ledger, repo: repoRoot, workflowId: WF, settings });
  assert.deepEqual(sweep.budget.unverified, ['tokens']);
  const gates = ledger.db.prepare("SELECT payload_json FROM events WHERE kind='incident-raised'").all().map(row => JSON.parse(row.payload_json)).filter(row => row.kind === SUPERVISOR_GATE);
  assert.equal(gates.length, 1); assert.deepEqual(gates[0].holds, ['*']);
  assert.match(gates[0].detail, /tokens unknown/);
  autopilotSweep({ ledger, repo: repoRoot, workflowId: WF, settings });
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='autopilot-budget-exceeded'").get().n, 1);
  for (const attemptId of [unavailable, pending]) ledger.write.recordAttemptUsage({ attemptId, rows: [{ model: 'm', inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }] });
  const after = budgetOf(ledger.db, WF, settings);
  assert.equal(after.used.tokens, 12); assert.deepEqual(after.unverified, []); assert.equal(after.coverage.complete, true);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM incidents WHERE status='open'").get().n, 1, 'the gate stays open until the next evaluation');
  autopilotSweep({ ledger, repo: repoRoot, workflowId: WF, settings });
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM incidents WHERE status='open'").get().n, 0, 'the runtime resolves a budget gate whose condition no longer holds');
  const resolved = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE kind='incident-resolved' ORDER BY seq DESC LIMIT 1").get().payload_json);
  assert.equal(resolved.by, AUTOPILOT_BY); assert.equal(resolved.evidence.coverage.complete, true);
}));

test('usage still being metered is not unknown: no budget gate inside the metering window, one after it, released when the usage arrives, kept while a cap is exceeded', t => withUsageBudget(t, ({ ledger, repoRoot, queue, dispatch, end, settings }) => {
  const openGates = () => ledger.db.prepare("SELECT count(*) n FROM incidents WHERE status='open'").get().n;
  const sweep = () => autopilotSweep({ ledger, repo: repoRoot, workflowId: WF, settings });
  queue('meter-fresh'); queue('meter-late');
  const fresh = dispatch('meter-fresh', 'ctx_meter_fresh');
  end('meter-fresh', fresh);
  const inside = sweep();
  assert.deepEqual(inside.budget.unverified, [], 'an attempt that just ended is being metered, not unknown');
  assert.equal(inside.budget.coverage.metering, 1);
  assert.equal(openGates(), 0, 'no gate inside the metering window');
  ledger.write.recordAttemptUsage({ attemptId: fresh, rows: [{ model: 'm', inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }] });
  sweep();
  assert.equal(openGates(), 0, 'usage arriving opens nothing');
  const late = dispatch('meter-late', 'ctx_meter_late');
  end('meter-late', late, PAST_METERING);
  assert.deepEqual(sweep().budget.unverified, ['tokens']);
  assert.equal(openGates(), 1, 'usage still missing after the window opens the gate');
  ledger.write.recordAttemptUsage({ attemptId: late, rows: [{ model: 'm', inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }] });
  sweep();
  assert.equal(openGates(), 0, 'the usage arriving resolves the gate without a human');
  const exceeded = { ...settings, budgets: { ...settings.budgets, tokens: 5 } };
  autopilotSweep({ ledger, repo: repoRoot, workflowId: WF, settings: exceeded });
  assert.equal(openGates(), 1, 'a cap actually exceeded opens the gate');
  autopilotSweep({ ledger, repo: repoRoot, workflowId: WF, settings: exceeded });
  assert.equal(openGates(), 1, 'an exceeded cap needs the Supervisor: the runtime keeps the gate');
}));

test('an open attempt remains pending, extensions retain existing cap semantics, and a zero token cap does not require a usage hold', t => withUsageBudget(t, ({ ledger, queue, dispatch, end, settings }) => {
  queue('meter-open'); const attempt = dispatch('meter-open', 'ctx_meter_open');
  const open = budgetOf(ledger.db, WF, settings);
  assert.equal(open.used.attempts, 1); assert.equal(open.coverage.open, 1); assert.equal(open.coverage.complete, false); assert.deepEqual(open.unverified, []);
  end('meter-open', attempt, PAST_METERING);
  const zero = budgetOf(ledger.db, WF, { ...settings, budgets: { ...settings.budgets, tokens: 0 } });
  assert.deepEqual(zero.unverified, []); assert.equal(zero.used.tokens, null, 'completed unavailable totals stay unknown even with no active token cap');
  ledger.appendEvent({ workflowId: WF, entityType: 'workflow', entityId: WF, kind: 'autopilot-budget-extended', payload: { attempts: 2, tokens: 3, wallMs: 4 } });
  const started = ledger.db.prepare('SELECT MIN(created_at) at FROM events WHERE workflow_id=?').get(WF).at;
  const extended = budgetOf(ledger.db, WF, settings, { now: started + 500 });
  assert.deepEqual(extended.caps, { attempts: 12, tokens: 1003, wallMs: 100004 }); assert.equal(extended.used.wallMs, 500);
  const uncapped = budgetOf(ledger.db, WF, { ...settings, budgets: { ...settings.budgets, tokens: 0 } });
  assert.deepEqual(uncapped.unverified, ['tokens'], 'an extension makes the declared zero token cap active');
}));
