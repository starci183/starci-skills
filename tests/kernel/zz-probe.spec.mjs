import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-probe'; const T0 = Date.now() - 3_600_000; const JOB = 'op-work.author-aaaa';
test('probe', (t) => withLedger(t, (world) => {
  const { ledger, repoRoot } = world;
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'p' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} },
    jobs: [{ jobId: JOB, unitId: JOB, opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120000, payload: { opId: 'work.author', records: [], owned_paths: ['.starciwork/x'] }, result: { verdict: 'fail' } }] });
  openDecisionRow(ledger, { workflowId: WF, kind: 'retry-decision', entity: { type: 'job', id: JOB }, summary: 'nothing follows', by: 'reconciler/job' }, { now: T0 });
  ledger.close();
  const env = { ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off' };
  const r = spawnSync(process.execPath, [CLI, 'status', '--repo', repoRoot, '--workflow', WF], { cwd: ROOT, encoding: 'utf8', env, timeout: 120000 });
  console.log(r.status, r.stderr.slice(0, 2000)); console.log(r.stdout.slice(0, 1500));
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a, '--repo', repoRoot], { cwd: ROOT, encoding: 'utf8', env, timeout: 120000 });
  let d = run('decide', '--workflow', WF, '--item', 'job-decision:' + JOB, '--choice', 'nope', '--reason', 'x');
  console.log('BAD CHOICE', d.status, d.stderr.slice(0, 500), d.stdout.slice(0, 1200));
  d = run('decide', '--workflow', WF, '--item', 'job-decision:' + JOB, '--choice', 'continue', '--reason', 'retry it', '--json');
  console.log('CONTINUE', d.status, d.stderr.slice(0, 1500), d.stdout.slice(0, 2500));
  d = run('decide', '--workflow', WF, '--list');
  console.log('LIST', d.stdout);
}));
