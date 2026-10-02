// ended-workflow-views.spec.mjs — the runtime views v_decision_rows, v_blocking and v_open_work never surface a
// live row of an ended workflow (phase archived|finished). The views are baked into each runtime.sqlite, so the ENDED
// predicate of scripts/machine/decisions.mjs listDecisions (LEFT JOIN workflows w, w.phase IS NULL OR w.phase NOT IN
// ('archived','finished')) lives in engine/db/migrations/runtime/0001-init.sql.
// A live owner DI on an archived workflow is locked by events_refuse_archived and can never be resolved, so a view that
// listed it would read 'bad' forever: a permanent attention item on work that no longer runs.
//   1. v_decision_rows drops the ended workflows' live-status rows and keeps their resolved history.
//   2. v_blocking and v_open_work drop every UNION leg of an ended workflow; a running workflow's rows still list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { changeWorkflowPhase, openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow, resolveDecision } from '../../scripts/machine/decisions.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

const WF_ARCH = 'wf-ended-archived', WF_FIN = 'wf-ended-finished', WF_RUN = 'wf-ended-running';
const LIVE = ['open', 'claimed', 'escalated'];
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ended-views-'));

/**
 * One workflow's leftovers, seeded while it runs so events_refuse_archived never sees a post-archive write: a live
 * owner DI (the leftover archive/finish already closes — seeded open on purpose, the di-876124d7 shape), one
 * resolved DI (history), a not-True condition, a pending worker-question, a queued unit behind the running one
 * (v_blocking's unit leg) and a reported-uns settled attempt past its SLA (the settle-overdue leg).
 */
const seedLeftovers = (ledger, wf, { withDecision = true } = {}) => {
  seedWorkflow(ledger, {
    id: wf,
    jobs: [
      { jobId: `job-${wf}-live`, opId: 'code.write', status: 'running' },
      { jobId: `job-${wf}-overdue`, opId: 'code.verify', status: 'reported' },
    ],
  });
  ledger.write.createUnit({ workflowId: wf, unitId: `u-${wf}-queued`, opId: 'code.write', subjectKey: `u-${wf}-queued`, goalRevision: 1 });
  ledger.write.addUnitEdge({ workflowId: wf, fromUnit: `job-${wf}-live`, toUnit: `u-${wf}-queued`, kind: 'dependsOn', source: 'plan' });
  ledger.db.prepare('UPDATE op_attempts SET reported_at=? WHERE job_id=?').run(Date.now() - 20 * 60_000, `job-${wf}-overdue`);
  ledger.write.setCondition({ workflowId: wf, entityType: 'workflow', entityId: wf, type: 'Ready', status: 'False', reason: 'ProviderCircuitOpen' });
  ledger.write.postInbox({ workflowId: wf, kind: 'worker-question', payload: { question: `which way for ${wf}?` } });
  if (!withDecision) return;
  openDecisionRow(ledger, {
    workflowId: wf, kind: 'worker-question', decider: 'owner', entity: { type: 'workflow', id: wf },
    summary: `owner must pick an option for ${wf}`, by: 'kernel', idempotencyKey: `worker-question:${wf}:pick`,
  }, { now: 0 });
};

/** Walk phase along workflow_transitions the way the verbs do (lifecycle row, then the update). */
const toPhase = (ledger, workflowId, chain) => {
  for (const to of chain) changeWorkflowPhase(ledger.db, { workflowId, to, by: 'test', reason: `seed-${to}`, at: Date.now() });
};

/** The DI rows one workflow still owes in v_decision_rows. */
const liveDiRows = (db, wf) => db.prepare('SELECT * FROM v_decision_rows WHERE workflow_id=?').all(wf)
  .filter((r) => LIVE.includes(r.status));

test('a ledger lists no live DI, blocker or open work of an ended workflow, keeps its resolved history', (t) => {
  const dir = temporary(), file = path.join(dir, 'runtime.sqlite');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const seeded = openLedger({ file });
  seedLeftovers(seeded, WF_ARCH);
  seedLeftovers(seeded, WF_FIN);
  seedLeftovers(seeded, WF_RUN);
  // Resolved history of the archived workflow: opened and resolved while it ran, before the flip.
  const resolved = openDecisionRow(seeded, {
    workflowId: WF_ARCH, kind: 'progress-stall', decider: 'kernel', entity: { type: 'workflow', id: WF_ARCH },
    summary: 'a stall the kernel resolved while the workflow ran', by: 'reconciler/workflow',
    idempotencyKey: `progress-stall:${WF_ARCH}:resolved`,
  }, { now: 0 }).di;
  resolveDecision(seeded, resolved.id, { by: 'kernel', verb: 'starci kernel enqueue the retry', now: 1_000 });
  seeded.write.openIncident({ workflowId: WF_RUN, kind: 'runtime-defect', detail: 'a live incident on the running workflow' });
  toPhase(seeded, WF_ARCH, ['stopped', 'archived']);
  toPhase(seeded, WF_FIN, ['finished']);
  seeded.close();

  const ledger = openLedger({ file });
  try {
    const db = ledger.db;
    // v_decision_rows: ended workflows' live rows gone, resolved history stays; the running workflow's DI still lists.
    assert.deepEqual(liveDiRows(db, WF_ARCH), [], 'the archived workflow\'s live DI never lists');
    assert.deepEqual(liveDiRows(db, WF_FIN), [], 'the finished workflow\'s live DI never lists');
    assert.equal(liveDiRows(db, WF_RUN).length, 1, 'the running workflow\'s live DI still lists');
    assert.equal(liveDiRows(db, WF_RUN)[0].ui, 'bad', 'opened at now=0 it is long overdue — the permanent bad the leftover faked');
    const history = db.prepare('SELECT status FROM v_decision_rows WHERE workflow_id=?').all(WF_ARCH).map((r) => r.status);
    assert.deepEqual(history, ['resolved'], 'the archived workflow\'s resolved DI stays as history');

    // v_blocking: every UNION leg of an ended workflow is gone; the running workflow keeps each leg it seeded.
    const blocking = db.prepare('SELECT * FROM v_blocking WHERE workflow_id=?').all(WF_ARCH)
      .concat(db.prepare('SELECT * FROM v_blocking WHERE workflow_id=?').all(WF_FIN));
    assert.deepEqual(blocking, [], 'no blocker of an archived or finished workflow lists');
    assert.ok(db.prepare("SELECT count(*) n FROM v_blocking WHERE workflow_id=? AND blocker_type='unit'").get(WF_RUN).n === 1, 'unit leg of a running workflow lists');
    assert.ok(db.prepare("SELECT count(*) n FROM v_blocking WHERE workflow_id=? AND blocker_type='decision'").get(WF_RUN).n === 1, 'decision leg of a running workflow lists');
    assert.ok(db.prepare("SELECT count(*) n FROM v_blocking WHERE workflow_id=? AND blocker_type='condition'").get(WF_RUN).n === 1, 'condition leg of a running workflow lists');
    assert.ok(db.prepare("SELECT count(*) n FROM v_blocking WHERE workflow_id=? AND blocker_type='question'").get(WF_RUN).n === 1, 'worker-question leg of a running workflow lists');
    assert.ok(db.prepare("SELECT count(*) n FROM v_blocking WHERE workflow_id=? AND blocker_type='incident'").get(WF_RUN).n === 1, 'incident leg of a running workflow lists');
    assert.ok(db.prepare("SELECT count(*) n FROM v_blocking WHERE workflow_id=? AND blocker_type='settle'").get(WF_RUN).n === 1, 'settle-overdue leg of a running workflow lists');

    // v_open_work: decision and job legs of an ended workflow are gone; the running workflow's stay.
    const openArch = db.prepare('SELECT * FROM v_open_work WHERE workflow_id IN (?,?)').all(WF_ARCH, WF_FIN);
    assert.deepEqual(openArch, [], 'no open work of an ended workflow lists');
    const openRun = new Set(db.prepare('SELECT kind FROM v_open_work WHERE workflow_id=?').all(WF_RUN).map((r) => r.kind));
    assert.ok(openRun.has('decision'), 'the running workflow\'s live DI is open work');
    assert.ok(openRun.has('job-running'), 'the running workflow\'s running job is open work');
  } finally { ledger.close(); }
});

test("a fresh ledger hides an ended workflow's live leftovers in its views", (t) => {
  const dir = temporary(), file = path.join(dir, 'runtime.sqlite');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const ledger = openLedger({ file });
  try {
    const db = ledger.db;
    seedLeftovers(ledger, WF_ARCH);
    seedLeftovers(ledger, WF_RUN);
    toPhase(ledger, WF_ARCH, ['stopped', 'archived']);
    assert.deepEqual(liveDiRows(db, WF_ARCH), [], 'the archived leftover is hidden from the start');
    assert.equal(liveDiRows(db, WF_RUN).length, 1);
    assert.deepEqual(db.prepare('SELECT * FROM v_blocking WHERE workflow_id=?').all(WF_ARCH), []);
    assert.ok(db.prepare('SELECT * FROM v_blocking WHERE workflow_id=?').all(WF_RUN).length > 0);
    assert.deepEqual(db.prepare('SELECT * FROM v_open_work WHERE workflow_id=?').all(WF_ARCH), []);
    assert.ok(db.prepare('SELECT * FROM v_open_work WHERE workflow_id=?').all(WF_RUN).length > 0);
  } finally { ledger.close(); }
});
