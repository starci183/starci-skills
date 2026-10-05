import test from 'node:test';
import assert from 'node:assert/strict';
import { withKernelIngress } from '../helpers/kernel-ingress-fixture.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { changeWorkflowPhase } from '../../engine/db/ledger.mjs';
import { callerOf } from '../../scripts/guards/op-caller.mjs';
import { boundIdentityOf } from '../../scripts/guards/rights.mjs';
import { callerAdmission } from '../../scripts/kernel/caller-admission.mjs';
import { kernelAuthorityOf } from '../../scripts/kernel/verbs/shared/kernel-seat.mjs';
import { withMutationFence, assertMutationFence } from '../../scripts/lib/mutation-fence.mjs';
import { nodeSpawn } from '../../scripts/api/node/lib.mjs';
import { claimDecision, resolveDecision, openDecisionRow } from '../../scripts/machine/decisions.mjs';
import { writeSeat } from '../../scripts/machine/home.mjs';
import fs from 'node:fs';
import path from 'node:path';

const current = world => callerAdmission(world.ledger,{ workflow: world.workflowId },{ env: { ...process.env,ORCA_TERMINAL_HANDLE: world.handle },root: world.runtime });
const eventCount = world => world.ledger.db.prepare('SELECT count(*) AS n FROM events').get().n;

test('actual current Kernel mutates its own ledger; foreign workflow and --by spoof refuse before writes', t => withKernelIngress(t,w => {
  assert.equal(callerOf(w.ledger.db,{ ...process.env,ORCA_TERMINAL_HANDLE: w.handle }).role,'kernel');
  assert.equal(kernelAuthorityOf(w.ledger.db,w.workflowId,w.handle).attempt,1);
  current(w).run(() => w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId,entityType: 'kernel',entityId: w.workflowId,kind: 'ingress-positive',payload: {} })));
  const n = eventCount(w);
  assert.throws(() => callerAdmission(w.ledger,{ workflow: w.workflowId,by: 'owner' },{ env: { ...process.env,ORCA_TERMINAL_HANDLE: w.handle },root: w.runtime }),{ code: 'kernel-caller-actor' });
  const foreign = callerAdmission(w.ledger,{ workflow: 'another-workflow' },{ env: { ...process.env,ORCA_TERMINAL_HANDLE: w.handle },root: w.runtime });
  assert.throws(() => foreign.run(() => w.ledger.transaction(() => assert.fail('foreign mutation body'))),{ code: 'kernel-caller-stale' });
  assert.equal(eventCount(w),n);
}));

test('retired history, foreign registry and unavailable reads cannot become owner; native unbound owner remains legitimate', t => withKernelIngress(t,w => {
  const env = { ...process.env,ORCA_TERMINAL_HANDLE: 'source-owner-45',STARCI_ROLE: 'kernel' };
  assert.equal(callerOf(w.ledger.db,env).role,'owner');
  callerAdmission(w.ledger,{ workflow: w.workflowId,by: 'owner' },{ env,root: w.runtime }).run(() => w.ledger.transaction(() => {}));
  w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId,entityType: 'kernel',entityId: w.workflowId,kind: 'kernel-restarted',payload: { terminal: 'retired' } }));
  const retired = callerOf(w.ledger.db,{ ...env,ORCA_TERMINAL_HANDLE: 'retired' });
  assert.equal(retired.role,'kernel');
  assert.throws(() => callerAdmission(w.ledger,{}, { caller: retired,root: w.runtime }),{ code: 'kernel-caller-stale' });
  const unknown = callerOf(w.ledger.db,env,{ machine: () => { throw Error('locked or unreadable'); } });
  assert.equal(unknown.role,'unknown');
  assert.throws(() => callerAdmission(w.ledger,{}, { caller: unknown,root: w.runtime }),{ code: 'kernel-caller-unknown' });
  const foreign = callerOf(w.ledger.db,{ ...env,ORCA_TERMINAL_HANDLE: 'foreign' },{ machine: () => ({ db: { prepare: () => ({ get: () => null }) },listLedgers: () => [{ file: 'foreign-ledger' }],close() {} }),reader: () => ({ prepare: sql => sql.includes('FROM jobs') ? { all: () => [{ job_id: 'kernel-foreign',workflow_id: 'foreign',kind: 'kernel',worker_id: 'foreign',payload_json: '{}' }] } : { get: () => null },close() {} }) });
  assert.equal(foreign.role,'foreign');
}));

test('malformed actual guard is unknown, not missing; genuine Supervisor seat is rechecked against its existing machine owner', t => withKernelIngress(t,w => {
  const guards = path.join(w.root,'guards'), handle = 'supervisor-current';
  fs.mkdirSync(path.join(guards,'terminals'),{ recursive: true });fs.writeFileSync(path.join(guards,'terminals',handle+'.json'),'{broken');
  const env = { ...process.env,ORCA_TERMINAL_HANDLE: handle,STARCI_GUARDS_ROOT: guards };
  assert.throws(() => boundIdentityOf(handle,{ env }));
  assert.equal(callerOf(w.ledger.db,env).role,'unknown');
  fs.rmSync(path.join(guards,'terminals',handle+'.json'));
  writeSeat(w.machine,{ token: 'supervisor-token',value: { terminal: handle,dispatch: 'supervisor-dispatch',attempt: 1 } });
  const owner = callerAdmission(w.ledger,{ by: 'supervisor' },{ env,root: w.runtime });
  assert.equal(owner.caller.role,'supervisor');
  owner.run(() => w.ledger.transaction(() => {}));
  writeSeat(w.machine,{ token: 'replacement-token',value: { terminal: handle,dispatch: 'new-dispatch',attempt: 2 } });
  assert.throws(() => owner.run(() => w.ledger.transaction(() => assert.fail('old Supervisor mutation'))),{ code: 'kernel-caller-stale' });
}));

test('replacement at actual BEGIN IMMEDIATE is checked after lock acquisition and rolls back without a domain write', t => withKernelIngress(t,w => {
  const admitted = current(w), db = w.ledger.db, original = db.exec.bind(db), n = eventCount(w);
  db.exec = sql => { original(sql); if (sql === 'BEGIN IMMEDIATE') db.prepare("UPDATE signals SET token='replacement' WHERE scope='kernel' AND key=?").run(w.workflowId); };
  try { assert.throws(() => admitted.run(() => w.ledger.transaction(() => assert.fail('body after replacement'))),{ code: 'kernel-caller-stale' }); }
  finally { db.exec = original; }
  assert.equal(eventCount(w),n);assert.equal(db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(w.workflowId).token,w.token);
}));

test('replacement after await refuses both ledger publication and actual Node effect before its process starts', t => withKernelIngress(t,async w => {
  const admitted = current(w), n = eventCount(w);
  let resume;const wait = new Promise(resolve => { resume = resolve; });
  const result = admitted.run(async () => { await wait; nodeSpawn(['-e','throw Error("must not execute")']); });
  w.ledger.transaction(() => w.ledger.db.prepare("UPDATE signals SET token='replacement' WHERE key=? AND scope='kernel'").run(w.workflowId));resume();
  await assert.rejects(result,{ code: 'kernel-caller-stale' });
  assert.throws(() => admitted.run(() => w.ledger.transaction(() => assert.fail('late ledger publication'))),{ code: 'kernel-caller-stale' });assert.equal(eventCount(w),n);
}));

test('hash drift during awaited work refuses while unrelated committed documentation preserves authority', t => withKernelIngress(t,w => {
  const admitted = current(w);
  w.write('modules/kernel/kernel-prompt.md','changed during call');
  assert.throws(() => admitted.run(() => assertMutationFence({ kind: 'native-test-effect' })),{ code: 'kernel-read-unverified' });
  w.git('checkout','--','modules/kernel/kernel-prompt.md');w.write('README.md','unrelated new docs');w.git('add','README.md');w.git('commit','-qm','docs only');
  admitted.run(() => w.ledger.transaction(() => {}));
}));

test('same stable DI actor cannot resolve a prior incarnation claim; current identity succeeds with ordinary typed owner', t => withKernelIngress(t,w => {
  const opened = openDecisionRow(w.ledger,{ workflowId: w.workflowId,kind: 'runtime-defect',decider: 'kernel',summary: 'fixture',entity: { type: 'workflow',id: w.workflowId },by: 'owner' });
  const first = { role: 'kernel',workflowId: w.workflowId,digest: 'first' },second = { ...first,digest: 'second' };
  withMutationFence(() => {},first,() => claimDecision(w.ledger,opened.di.id,{ by: `kernel:${w.workflowId}` }));
  const n=eventCount(w);
  assert.throws(() => withMutationFence(() => {},second,() => resolveDecision(w.ledger,opened.di.id,{ by: `kernel:${w.workflowId}`,verb: 'fixture' })),{ code: 'decision-held-by-other' });
  assert.equal(eventCount(w),n);
  const done=withMutationFence(() => {},first,() => resolveDecision(w.ledger,opened.di.id,{ by: `kernel:${w.workflowId}`,verb: 'fixture' }));assert.equal(done.status,'resolved');assert.equal(done.resolution.authority.digest,'first');
}));

test('real Op attempt keeps own report writes and rejects replacement before publication', t => withKernelIngress(t,w => {
  const handle='op-current',jobId='job-report';
  seedWorkflow(w.ledger,{ id: w.workflowId,jobs: [{ jobId,kind: 'op',opId: 'review.verify',status: 'running',workerId: handle,dispatchId: 'op-dispatch',payload: { managed: { agentTerminalHandle: handle,dispatchId: 'op-dispatch' } } }] });
  const admitted=callerAdmission(w.ledger,{ job: jobId },{ env: { ...process.env,ORCA_TERMINAL_HANDLE: handle },root: w.runtime });assert.equal(admitted.caller.role,'op');
  admitted.run(() => w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId,entityType: 'job',entityId: jobId,kind: 'report-fixture',payload: {} })));
  const n=eventCount(w);
  w.ledger.transaction(() => w.ledger.db.prepare("UPDATE op_attempts SET terminal_handle='replacement' WHERE job_id=?").run(jobId));
  assert.throws(() => admitted.run(() => w.ledger.transaction(() => assert.fail('stale report'))),{ code: 'kernel-caller-stale' });assert.equal(eventCount(w),n);
}));


test('a conflicting actual managed guard is unknown and a Kernel cannot publish through another ledger handle', t => withKernelIngress(t,w => {
  const guard=path.join(w.root,'guard-only','terminals');fs.mkdirSync(guard,{ recursive: true });
  fs.writeFileSync(path.join(guard,w.handle+'.json'),JSON.stringify({ terminal: w.handle,role: 'kernel',jobId: 'different-job',workflowId: w.workflowId }));
  const env={ ...process.env,ORCA_TERMINAL_HANDLE: w.handle,STARCI_GUARDS_ROOT: path.dirname(guard) };
  assert.equal(callerOf(w.ledger.db,env).role,'unknown');
  assert.throws(() => current(w).run(() => assertMutationFence({ kind: 'ledger-write',db: {} })),{ code: 'kernel-caller-stale' });
}));

test('only exact original finished-incarnation terminal close survives seat release', t => withKernelIngress(t,w => {
  const admitted=current(w);
  w.ledger.transaction(() => {
    changeWorkflowPhase(w.ledger.db,{ workflowId: w.workflowId,to: 'finished',by: 'owner',reason: 'fixture-finished' });
    w.ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(w.workflowId);
    w.ledger.appendEvent({ workflowId: w.workflowId,entityType: 'workflow',entityId: w.workflowId,kind: 'workflow-finished',payload: { kernelTerminal: w.handle } });
  });
  admitted.run(() => assertMutationFence({ kind: 'kernel-terminal-close',terminal: w.handle }));
  assert.throws(() => admitted.run(() => assertMutationFence({ kind: 'kernel-terminal-close',terminal: 'another-terminal' })),{ code: 'kernel-caller-stale' });
  assert.throws(() => admitted.run(() => w.ledger.transaction(() => assert.fail('finished Kernel domain write'))),{ code: 'kernel-caller-stale' });
  w.ledger.transaction(() => w.ledger.db.prepare("UPDATE jobs SET payload_json=json_set(payload_json,'$.hierarchy.attempt',2) WHERE job_id=?").run(`kernel-${w.workflowId}`));
  assert.throws(() => admitted.run(() => assertMutationFence({ kind: 'kernel-terminal-close',terminal: w.handle })),{ code: 'kernel-caller-stale' });
}));
