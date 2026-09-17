import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ledgerFileFor,machineFileFor,openLedger,openMachine} from '../kernel/ledger-db.mjs';
import {prepareGenerationRetry} from '../kernel/engine.mjs';
import {retryableOperation} from '../kernel/kernel.mjs';

// The regression this file guards: a pending kind left on an operation that still holds a durable
// writer lease, in a shape no reconciliation path admits, deadlocks the workflow — the lease fences
// the writer reservation forever and nothing can settle it. Every pending kind the kernel can set
// must therefore either reach a reconcile path (`workflow-retry`'s lease settlement and named
// readmissions, or the live loop's report replay) or be provably owner-only with no lease held.

const KERNEL=fs.readFileSync(new URL('../kernel/kernel.mjs',import.meta.url),'utf8');

// Every kind that can land on `op.pending`: direct literals (`op.pending={kind:'x'}`, including the
// deferred-restore ternary's two literals), `pending:{kind:'x'}` object fields, and the pending
// record handed to quarantineCandidate, which assigns it verbatim.
function pendingKinds(source){
  const kinds=new Set();
  for(const statement of source.matchAll(/\.pending\s*=\s*[^;]+;/gs))
    for(const kind of statement[0].matchAll(/kind:'([a-z-]+)'/g))kinds.add(kind[1]);
  for(const m of source.matchAll(/pending\s*:\s*\{\s*kind:'([a-z-]+)'/g))kinds.add(m[1]);
  for(const m of source.matchAll(/quarantineCandidate\([^;]*?\{kind:'([a-z-]+)'/gs))kinds.add(m[1]);
  return kinds;
}

const retryBlock=KERNEL.slice(KERNEL.indexOf("if(command==='workflow-retry')"),KERNEL.indexOf("if(command==='workflow-answer')"));
// Pending kinds the public retry names explicitly: dispatch-reconciliation and required-validation
// re-admit the exact retained report instead of dropping the writer.
const namedReadmits=new Set([...retryBlock.matchAll(/pending\?\.kind==='([a-z-]+)'/g)].map(m=>m[1]));
// The acceptance-pending requeue regex: matched kinds become refusal='runtime-reconciliation' via
// quarantineCandidate and are then admitted by the generic retry lease settlement.
const requeue=KERNEL.match(/\/([^/]+)\/\.test\(op\.pending\?\.kind\?\?''\)\)quarantineCandidate/);
const REQUEUE_KIND=new RegExp(requeue[1]);
// Kinds passed literally to quarantineCandidate leave the same shape directly.
const quarantinedLiterals=new Set([...KERNEL.matchAll(/quarantineCandidate\([^;]*?\{kind:'([a-z-]+)'/gs)].map(m=>m[1]));

const LEASE={workflowId:'wf',opId:'op-1',attempt:1,generation:1,jobId:'operation-1',leaseToken:'lt'};
// The shapes a pending op can actually be left in. `quarantined` is what quarantineCandidate writes;
// `validationParked` is the validator-exhausted block (blocked, no refusal, worker already settled);
// `running` is an acceptance-pending or deferred op between ticks, its retained report replaying.
const SHAPES={
  quarantined:{status:'blocked',refusal:'runtime-reconciliation',dispatch:'d-1',terminal:'t-1'},
  validationParked:{status:'blocked',workerSettled:true,dispatch:'d-1',terminal:'t-1'},
  running:{status:'running',dispatch:'d-1',terminal:'t-1'},
};
const opIn=(kind,shape)=>({id:'op-1',kind:'backend.implement',dependsOn:[],reports:[],pending:{kind},lease:{...LEASE},...SHAPES[shape]});

// Pending kind -> every shape the kernel can leave it in while a writer lease is held. Each listed
// shape must be retry-admitted; that admission is the reconcile path.
const LEASE_HOLDING={
  'dispatch-reconciliation':['quarantined'],
  'native-stop-reconciliation':['quarantined'],
  'candidate-quarantine':['quarantined'],
  'protected-record-quarantine':['quarantined'],
  'protected-proof':['quarantined'],
  'candidate-dependencies':['quarantined'],
  'required-acceptance':['quarantined'],
  'integration-quarantine':['quarantined'],
  'required-validation':['validationParked','running'],
  'answered-decision-late-report':['quarantined','running'],
  'model-quota-wait':['running'],
  'durable-job':['running'],
};
// Pending kinds whose owner action IS the reconcile path: they are permanent refusals set in
// scheduleOps before admission, so no durable writer lease can exist to fence.
const OWNER_ONLY=['runtime-gate-binding'];

test('every pending kind the kernel can set is enumerated here',()=>{
  assert.deepEqual([...pendingKinds(KERNEL)].sort(),[...Object.keys(LEASE_HOLDING),...OWNER_ONLY].sort());
});

test('a pending kind that can hold a writer lease is retry-admitted in every shape it can be left in',()=>{
  for(const [kind,shapes] of Object.entries(LEASE_HOLDING))
    for(const shape of shapes)
      assert.equal(retryableOperation(opIn(kind,shape)),true,
        `${kind} left ${shape} while holding a writer lease has no reconcile path`);
  // The guard has teeth: a lease left under an unrecognized refusal is not retry-admitted, so any
  // producer that ever leaves a pending kind in that shape fails the enumeration above.
  assert.equal(retryableOperation({...opIn('some-future-kind','quarantined'),refusal:'never-heard-of'}),false);
});

test('the reconcile paths the coverage table names still exist in the kernel',()=>{
  assert.ok(requeue,'acceptance-pending requeue into quarantineCandidate is gone');
  // Quarantined-shape kinds are reachable as refusal='runtime-reconciliation': either a literal
  // quarantineCandidate call sets them or the acceptance-pending requeue regex catches them.
  for(const kind of Object.keys(LEASE_HOLDING).filter(kind=>LEASE_HOLDING[kind].includes('quarantined')))
    assert.ok(quarantinedLiterals.has(kind)||REQUEUE_KIND.test(kind),`${kind} cannot reach the runtime-reconciliation refusal it is reconciled under`);
  // The named readmissions: completed-report and validation-parked writers are re-admitted exactly.
  assert.ok(namedReadmits.has('dispatch-reconciliation')&&namedReadmits.has('required-validation'));
  // The answered-decision late report re-admits by its retained immutable report binding.
  assert.match(retryBlock,/lateReportRecovery\?\.schema==='starci\/answered-decision-late-report@1'/);
  // `running`-shape kinds keep their retained report replaying through acceptReports each tick: none
  // of them is caught by the requeue regex (which would block them instead of replaying), and the
  // deferred-restore path never rewrites the running status it restores.
  for(const kind of Object.keys(LEASE_HOLDING).filter(kind=>LEASE_HOLDING[kind].includes('running')))
    assert.ok(!REQUEUE_KIND.test(kind),`${kind} would be fenced instead of replayed`);
  const deferred=KERNEL.slice(KERNEL.indexOf('function restoreDeferredReportOperation'),KERNEL.indexOf('export function acceptReports'));
  assert.ok(!/\.status\s*=/.test(deferred),'restoreDeferredReportOperation must leave the running op running');
});

test('owner-only pending kinds never hold a writer lease',()=>{
  // kernel.mjs never mints op.lease; the lease exists only after engine admission inside scheduleOps.
  assert.ok(!/op\.lease\s*=[^=]/.test(KERNEL));
  const schedule=KERNEL.slice(KERNEL.indexOf('function scheduleOps'),KERNEL.indexOf('export function runLoop'));
  const admission=schedule.indexOf('reserveOperation(op'),launch=schedule.indexOf('launchOp(');
  assert.ok(admission>0&&launch>0);
  for(const kind of OWNER_ONLY){
    for(const m of schedule.matchAll(new RegExp(`kind:'${kind}'`,'g')))
      assert.ok(m.index<admission&&m.index<launch,`${kind} is set where a writer lease may already exist`);
    // Owner action, not a silent fence: unleased it is a plain refusal that no retry pretends to run.
    const op={id:'op-1',kind:'backend.implement',dependsOn:[],reports:[],pending:{kind},status:'blocked',refusal:kind};
    assert.equal(retryableOperation(op),false,`${kind} must stay owner-visible, not silently re-admitted`);
  }
});

test('prepareGenerationRetry drains the durable side so the op-level reconcile paths can run',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-w5-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledgerFile=ledgerFileFor(dir),machineFile=path.join(dir,'machine.sqlite');
  const machine=openMachine({file:machineFile}),journal=openLedger({file:ledgerFile,machine});
  journal.enqueueJob({jobId:'queued-never-launched',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'operation',role:'implement',payload:{runtime:'x'}});
  journal.enqueueJob({jobId:'dead-check',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'check',role:'machine-check',payload:{command:'x'}});
  journal.db.prepare("UPDATE jobs SET status='running',lease_token='lt' WHERE job_id='dead-check'").run();
  journal.appendEvent({eventId:'dead-check:spawned',workflowId:'wf',entityType:'job',entityId:'dead-check',generation:2,kind:'job-spawned',payload:{pid:4242}});
  journal.close();machine.close();
  const prepared=prepareGenerationRetry({ledgerFile,machineFile,workflowId:'wf',generation:2,pidAliveFn:()=>false});
  // The never-launched queued job is cancelled and the dead-process leased job settles, so retry's
  // op-level readmissions and lease settlement run against an empty durable fence.
  assert.deepEqual(prepared.cancelled,['queued-never-launched']);
  assert.deepEqual(prepared.deadSettled,['dead-check']);
  assert.deepEqual(prepared.unsettled,[]);
});

test('a still-live durable job stays unsettled and keeps retry fenced',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-w5-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledgerFile=ledgerFileFor(dir),machineFile=path.join(dir,'machine.sqlite');
  const machine=openMachine({file:machineFile}),journal=openLedger({file:ledgerFile,machine});
  journal.enqueueJob({jobId:'live-check',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'check',role:'machine-check',payload:{command:'x'}});
  journal.db.prepare("UPDATE jobs SET status='running',lease_token='lt' WHERE job_id='live-check'").run();
  journal.appendEvent({eventId:'live-check:spawned',workflowId:'wf',entityType:'job',entityId:'live-check',generation:2,kind:'job-spawned',payload:{pid:4242}});
  journal.close();machine.close();
  const prepared=prepareGenerationRetry({ledgerFile,machineFile,workflowId:'wf',generation:2,pidAliveFn:()=>true});
  assert.deepEqual(prepared.unsettled,['live-check'],'a job whose recorded process is alive must keep the retry fence up');
});
