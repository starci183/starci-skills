// A job a refused launch returned to ready spent no try and used to vanish from `starci kernel status` (readyOperations 0, frontier
// not actionable), and `dispatch-ready` skipped it: nobody was told to move it (Nivo op-business.decide-58d0a31e7e, 2026-10-07). The status now projects it as
// ready work with its policy step (modules/kernel/op-incident-policy.yaml, row error-launch).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { launchRefusalViewOf } from '../../scripts/kernel/verbs/shared/launch-refusal-step.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-launch-refusal';
const OP = 'business.decide';
const JOB = 'op-business.decide-58d0a31e7e';
const PREV = 'op-business.decide-19b37f6c00';

const world = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launch-refusal-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_AUTOPILOT: 'off', STARCI_PROJECTS_ROOT: path.join(repo, '.starciwork', 'projects'),
    STARCI_TEST_MACHINE_FILE: path.join(repo, '.starciwork', 'machine.sqlite'), STARCI_LOCAL_ROOT: path.join(repo, '.starciwork', 'localappdata') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  const at = Date.now();
  const payload = (extra = {}) => ({ opId: OP, owned_paths: ['.starciwork/features/authentication/br'], ...extra });
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'launch refusal' }, goalIdentity: 'refusalgoal',
    goal: { revision: 0, identity: 'refusalgoal', markdown: '# goal', json: {} },
    jobs: [{ jobId: PREV, unitId: 'unit-a', opId: OP, tryNo: 1, retryOf: null, status: 'failed', pool: 'claude-agent', payload: payload({ model: 'claude-agent' }), createdAt: at },
      { jobId: JOB, unitId: 'unit-a', opId: OP, tryNo: 2, retryOf: PREV, status: 'ready', payload: payload(), createdAt: at + 1 }] });
  for (const [step, error] of [['worker-start', 'turn_start_unobserved'], ['admission', 'no-eligible-candidate']]) {
    ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: JOB, kind: 'dispatch-rejected',
      payload: { op: OP, step, error, effectState: 'none', attemptConsumed: false, retryable: true, model: 'claude-agent', provider: 'claude' } });
  }
  return { repo, env, ledger };
};

test('the view names the pool, the count against the bound and the escalation', (t) => {
  const { ledger } = world(t);
  try {
    const view = launchRefusalViewOf(ledger.db, ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB));
    assert.deepEqual(view.launchRefusals, { pool: 'claude-agent', count: 2, of: 2 });
    assert.match(view.policy, /error-launch: attempt 2 of 2 \(claude-agent: launch refused at admission/);
    assert.match(view.policy, /escalate to supervisor/);
  } finally { ledger.close(); }
});

test('status projects the ready job as ready work with its step, so the frontier is actionable', (t) => {
  const { repo, env, ledger } = world(t);
  ledger.close();
  const run = spawnSync(process.execPath, [API, 'status', '--repo', repo, '--workflow', WF, '--json'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const status = JSON.parse(run.stdout);
  const item = status.frontier.queued.find((entry) => entry.jobId === JOB);
  assert.ok(item, 'the ready job is listed with the queued work');
  assert.equal(item.queuedBecause, 'ready');
  assert.deepEqual(item.launchRefusals, { pool: 'claude-agent', count: 2, of: 2 });
  assert.ok(status.frontier.readyOperations >= 1);
  assert.equal(status.frontier.actionable, false);
  assert.match(status.frontier.reason, /error-launch: attempt 2 of 2/);
});
