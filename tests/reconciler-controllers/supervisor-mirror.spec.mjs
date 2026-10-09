// A Decision Item a Kernel verb opens for the Supervisor in a product ledger (the Kernel's menu-escape) was owned by nobody: the Supervisor
// reads machine.sqlite only, so `starci supervisor status` held none of it (StarCi di-16537df8: "0 Decision Item open" while three stood).
// The Workflow controller opens the Supervisor's twin, keyed escalated:<ledger>:<id>, and the Supervisor's menu routes it to kernel-escape.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openDecisionRow, openDecision, listSupervisorDecisions } from '../../scripts/machine/decisions.mjs';
import { strandedSupervisorDis } from '../../scripts/reconciler/supervisor-mirror.mjs';
import { readSupervisorMenu } from '../../scripts/supervisor/supervisor-menu-sources.mjs';
import { snapshotOf } from '../../scripts/kernel/decision-log.mjs';

const WF = 'wf-mirror';
const T0 = Date.now() - 600_000;
const seed = (ledger, jobs = []) => seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'mirror' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} }, jobs });

test('a menu-escape in the product ledger gets a Supervisor twin the Supervisor menu routes to kernel-escape', (t) => withLedger(t, async (world) => {
  const { ledger } = world;
  seed(ledger);
  const di = openDecisionRow(ledger, { workflowId: WF, kind: 'menu-escape', decider: 'supervisor', entity: { type: 'workflow', id: WF }, idempotencyKey: `menu-escape:${WF}:leg-ready:x`,
    summary: 'Kernel: no option of leg-ready:x fits: the plan declares no write set', by: 'kernel' }, { now: T0 }).di;
  openDecisionRow(ledger, { workflowId: WF, kind: 'retry-decision', entity: { type: 'job', id: 'op-x-1' }, summary: 'a Kernel item', by: 'reconciler/job' }, { now: T0 });
  const name = path.basename(world.repoRoot);
  const specs = strandedSupervisorDis(ledger.db, { ledgerId: 'ledger-1', ledgerName: name, workflowId: WF, now: Date.now() });
  assert.equal(specs.length, 1, 'only the Supervisor-decided escape, not the Kernel own item');
  assert.equal(specs[0].idempotencyKey, `escalated:${name}:${di.id}`);
  assert.equal(specs[0].ledger, 'supervisor');
  const env = { ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome };
  assert.deepEqual(await listSupervisorDecisions({ env }), [], 'before the mirror the Supervisor holds nothing');
  const opened = await openDecision(world.repoRoot, specs[0], { env });
  assert.equal(opened.ok, true, JSON.stringify(opened.json));
  const again = await openDecision(world.repoRoot, specs[0], { env });
  assert.equal(again.json.existing, true, 'one twin per item, however many passes');
  const [twin] = await listSupervisorDecisions({ env });
  assert.equal(twin.kind, 'menu-escape');
  assert.equal(twin.decider, 'supervisor');
  const menu = readSupervisorMenu({ env });
  assert.ok(menu.some((item) => item.kind === 'kernel-escape'), `the Supervisor menu holds it: ${JSON.stringify(menu.map((item) => item.kind))}`);
  ledger.close();
}));

test('a job that waits for its settle is not counted as running in a decision baseline', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  const payload = (opId) => ({ opId, records: [], owned_paths: ['.starciwork/x'] });
  const job = (jobId, status) => ({ jobId, unitId: jobId, opId: 'work.author', status, createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 2000, payload: payload('work.author') });
  seed(ledger, [job('op-work.author-reported', 'reported'), job('op-work.author-queued', 'queued')]);
  assert.equal(snapshotOf(ledger.db, WF).running, 0, 'a reported job has no worker; the digest said nothing was running and the baseline said one was');
  ledger.close();
}));
