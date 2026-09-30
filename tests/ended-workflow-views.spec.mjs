// ended-workflow-views.spec.mjs — the runtime views v_decision_rows, v_blocking and v_open_work never surface a
// live row of an ended workflow (phase archived|finished). Cluster ended-workflow-views, follow-up of
// decisions-archived-workflow (main 55643dfc5) and fix-notifier-ended-workflow-dis-254f7a's diagnosis: the views
// are baked into each runtime.sqlite, so the ENDED predicate of scripts/reconciler/decisions.mjs listDecisions
// (LEFT JOIN workflows w, w.phase IS NULL OR w.phase NOT IN ('archived','finished')) moves into them through
// forward migration 0005-ended-workflow-views.
// Evidence 2026-09-30 nivo-backend: di-876124d7, a live owner DI on a workflow archived 2026-09-29, is locked by
// events_refuse_archived — it can never be resolved — yet v_decision_rows still read it 'bad' and v_blocking /
// v_open_work kept listing it, a permanent attention item.
//   1. A ledger at user_version 4 is migrated to 5 on the writer's first open (VACUUM INTO backup, a done
//      schema_migrations row, foreign_key_check + quick_check before COMMIT).
//   2. v_decision_rows drops the ended workflows' live-status rows and keeps their resolved history.
//   3. v_blocking and v_open_work drop every UNION leg of an ended workflow; a running workflow's rows still list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { changeWorkflowPhase, inspectLedger, openLedger } from '../engine/ledger-db.mjs';
import { openDecisionRow, resolveDecision } from '../scripts/reconciler/decisions.mjs';
import { seedWorkflow } from './_ledger-fixture.mjs';

const require = createRequire(import.meta.url);
const WF_ARCH = 'wf-ended-archived', WF_FIN = 'wf-ended-finished', WF_RUN = 'wf-ended-running';
const MIGRATED_VIEWS = ['v_decision_rows', 'v_blocking', 'v_open_work'];
const INIT_FILE = path.resolve(import.meta.dirname, '..', 'engine', 'migrations', 'runtime', '0001-init.sql');
const LIVE = ['open', 'claimed', 'escalated'];
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ended-views-'));

/** The pre-0005 shape of one of the three views: its CREATE VIEW block in 0001-init.sql (no ';' inside a body). */
const initViewSql = (init, name) => {
  const m = init.match(new RegExp(`CREATE VIEW IF NOT EXISTS ${name} AS\\s[\\s\\S]*?;`));
  assert.ok(m, `0001-init.sql declares ${name}`);
  return m[0];
};

/** Put the file back to what a v4 runtime wrote: the 0001 views as they were, user_version 4, no 0005 row. */
const rewindToV4 = (file) => {
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(file);
  const init = fs.readFileSync(INIT_FILE, 'utf8');
  for (const name of MIGRATED_VIEWS) raw.exec(`DROP VIEW IF EXISTS ${name};${initViewSql(init, name)}`);
  raw.exec('DELETE FROM schema_migrations WHERE version=5;PRAGMA user_version=4');
  raw.close();
};

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

test('a ledger migrated from v4 lists no live DI, blocker or open work of an ended workflow, keeps its resolved history', (t) => {
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
  resolveDecision(seeded, resolved.id, { by: 'kernel', verb: 'api enqueue the retry', now: 1_000 });
  seeded.write.openIncident({ workflowId: WF_RUN, kind: 'runtime-defect', detail: 'a live incident on the running workflow' });
  toPhase(seeded, WF_ARCH, ['stopped', 'archived']);
  toPhase(seeded, WF_FIN, ['finished']);
  seeded.close();
  rewindToV4(file);
  const old = inspectLedger({ file }); // read-only, never migrates: the v4 shape still lists the leftovers raw
  try {
    assert.equal(liveDiRows(old.db, WF_ARCH).length, 1, 'the v4 shape still lists the archived leftover');
  } finally { old.close(); }

  const ledger = openLedger({ file });
  try {
    const db = ledger.db;
    assert.equal(Number(db.prepare('PRAGMA user_version').get().user_version), 5);
    assert.deepEqual({ ...db.prepare('SELECT name,status FROM schema_migrations WHERE version=5').get() }, { name: '0005-ended-workflow-views', status: 'done' });
    assert.equal(fs.existsSync(`${file}.pre-0005-ended-workflow-views.bak`), true, 'a VACUUM INTO backup precedes the migration');

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

test('a fresh ledger is created at version 5 and its views already hide an ended workflow\'s live leftovers', (t) => {
  const dir = temporary(), file = path.join(dir, 'runtime.sqlite');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const ledger = openLedger({ file });
  try {
    const db = ledger.db;
    assert.equal(Number(db.prepare('PRAGMA user_version').get().user_version), 5, 'a fresh ledger runs 0001 then the forward files');
    assert.equal(db.prepare('SELECT status FROM schema_migrations WHERE version=5').get()?.status, 'done');
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
