// A Kernel labelled a work failure (the op's product failed its check) as a runtime fault and sent it up the Supervisor and Debug chain
// (StarCi 2026-10-07). The class is decided by the evidence and the failure-code catalog (`kind`): a failing check on the op's own product
// is work (policy row error-work), a code the catalog classes runtime-fault is a runtime fault. The menu withholds the escape from a work
// failure that still has retries, and a supervisor-gate of cause runtime-defect over work evidence is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { classOfCode, failureClassOf, failureFactsOf, workClassedJobs, workRetriesLeft } from '../../scripts/kernel/failure-class.mjs';
import { buildMenu } from '../../scripts/kernel/kernel-menu.mjs';
import { gateStepOf } from '../../scripts/kernel/verbs/shared/gate-raise.mjs';

const WORK_CODE = 'ACTIVE_NAV_CONFLICT';
const RUNTIME_CODE = 'FOLLOW_INVALID';

const dbWith = ({ checks = [], refusals = [], tries = 1 } = {}) => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE jobs(job_id TEXT, try_no INTEGER);
    CREATE TABLE events(seq INTEGER PRIMARY KEY, entity_type TEXT, entity_id TEXT, kind TEXT, payload_json TEXT);
    CREATE TABLE check_runs(job_id TEXT, attempt_id INTEGER, status TEXT);
    INSERT INTO jobs VALUES('job-a', ${tries});
    INSERT INTO events(entity_type, entity_id, kind, payload_json) VALUES('job', 'job-a', 'job-result', '{"reason":"settle-refused"}');`);
  for (const status of checks) db.prepare("INSERT INTO check_runs VALUES('job-a', 1, ?)").run(status);
  for (const reason of refusals) db.prepare("INSERT INTO events(entity_type, entity_id, kind, payload_json) VALUES('job', 'job-a', 'job-settle-refused', ?)").run(JSON.stringify({ reason }));
  return db;
};

test('the catalog kind decides the class: check-finding is work, runtime-fault is runtime, anything else decides nothing', () => {
  assert.equal(classOfCode(WORK_CODE), 'work');
  assert.equal(classOfCode(RUNTIME_CODE), 'runtime');
  assert.equal(classOfCode('DESIGN_NOT_SETTLED'), null, 'a dispatch refusal is neither');
  assert.equal(classOfCode('not-a-catalogued-code'), null);
});

test('a failing check on the latest attempt is work; a runtime-fault code wins over it; no evidence is unknown', () => {
  assert.equal(failureClassOf(dbWith({ checks: ['pass', 'fail'] }), 'job-a').class, 'work');
  assert.equal(failureClassOf(dbWith({ refusals: [WORK_CODE] }), 'job-a').class, 'work');
  const mixed = failureClassOf(dbWith({ checks: ['fail'], refusals: [RUNTIME_CODE] }), 'job-a');
  assert.equal(mixed.class, 'runtime');
  assert.deepEqual(mixed.codes.map((entry) => entry.code), [RUNTIME_CODE]);
  assert.equal(failureClassOf(dbWith({ checks: ['pass'] }), 'job-a').class, 'unknown');
});

test('the retries left follow the error-work bound and the unit tries so far', () => {
  assert.equal(workRetriesLeft(dbWith({ tries: 1 }), 'job-a'), 2);
  assert.equal(workRetriesLeft(dbWith({ tries: 3 }), 'job-a'), 0);
  assert.equal(workRetriesLeft(dbWith({ tries: 9 }), 'job-a'), 0, 'never negative');
  assert.deepEqual(workClassedJobs(dbWith({ checks: ['fail'] }), ['job-a']), ['job-a']);
});

const decisionSources = (failure) => ({ workflow: 'wf-class', rev: null, jobDecisions: [{ di: { id: 'di-1', summary: 's' },
  resolution: { jobId: 'job-a', op: 'work.author', what: 'work.author failed', failure,
    options: [{ key: 'continue', title: 'continue', steps: [{ verb: 'enqueue', args: { workflow: 'wf-class', op: 'work.author' } }] }] } }],
questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [], handover: null, snoozed: new Set() });
const choicesOf = (failure) => buildMenu(decisionSources(failure))[0].options.map((option) => option.choice);

test('the menu withholds none-fits from a work failure that still has retries, and offers it once they are spent or the class is not work', () => {
  assert.deepEqual(choicesOf({ class: 'work', retriesLeft: 2 }), ['continue'], 'a work failure is the Kernel\'s step: no exit that calls it a fault');
  assert.deepEqual(choicesOf({ class: 'work', retriesLeft: 0 }), ['continue', 'none-fits'], 'the bound is spent: the chain goes on to the Supervisor');
  assert.deepEqual(choicesOf({ class: 'runtime', retriesLeft: 2 }), ['continue', 'none-fits']);
  assert.deepEqual(choicesOf({ class: 'unknown', retriesLeft: 2 }), ['continue', 'none-fits']);
});

const raise = (db, cause, holds) => gateStepOf({ db, transaction: () => {}, appendEvent: () => {} }, { workflowId: 'wf-class', args: { kind: 'supervisor-gate', cause, workaround: 'dispatched on codex-agent and it failed the same way' }, holds, until: [] });

// The class guard is the first step of the raise; whatever a passing raise does after it needs the full ledger, so only its refusal is observed.
const classRefusal = (db, cause) => {
  try { raise(db, cause, ['job-a']); } catch (error) { return error.code === 'gate-cause-class-work' ? error : null; }
  return null;
};

test('a supervisor-gate of cause runtime-defect over a work failure is refused with the catalog class; other causes and runtime evidence pass', () => {
  const work = dbWith({ checks: ['fail'] });
  assert.match(classRefusal(work, 'runtime-defect')?.message ?? '', /job-a/);
  assert.equal(classRefusal(work, 'retry-cap'), null, 'the class guard concerns the runtime-defect cause only');
  assert.equal(classRefusal(dbWith({ checks: ['fail'], refusals: [RUNTIME_CODE] }), 'runtime-defect'), null, 'a runtime-fault code is a runtime fault');
  assert.equal(classRefusal(dbWith({ checks: ['pass'] }), 'runtime-defect'), null, 'no work evidence decides nothing');
  assert.equal(failureFactsOf(work, 'job-a').retriesLeft, 2);
});
