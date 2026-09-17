import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectLedger,ledgerFileFor,openLedger,openMachine} from '../kernel/ledger-db.mjs';
import {createAdmission,GLOBAL_AI_RESOURCE} from '../kernel/admission.mjs';

const identity=(n,kind='operation')=>({jobId:`job-${n}`,workflowId:`workflow-${n}`,opId:`op-${n}`,attempt:1,generation:1,kind});
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-admission-'));
const withPair=async(fn,{now=Date.now}={})=>{
  const dir=temporary(),machineFile=path.join(dir,'machine.sqlite'),ledgerFile=ledgerFileFor(dir);
  const machine=openMachine({file:machineFile,now}),ledger=openLedger({file:ledgerFile,now,machine});
  try{return await fn(ledger,machine,dir);}finally{ledger.close();machine.close();fs.rmSync(dir,{recursive:true,force:true});}
};

test('atomic multi-resource admission and stale fencing, on the ledger',()=>withPair((journal,machine)=>{
  const admission=createAdmission({journal,machine,now:()=>100,defaultAiCapacity:1});admission.setCapacity('db/test',1);admission.setBudget('tokens/day',5);
  journal.enqueueJob(identity(1));journal.enqueueJob(identity(2));
  const one=admission.reserve({...identity(1),resources:[{key:GLOBAL_AI_RESOURCE,units:1},{key:'db/test',units:1}],budgets:[{key:'tokens/day',units:5}]});assert.equal(one.ok,true);
  const two=admission.reserve({...identity(2),resources:[{key:GLOBAL_AI_RESOURCE,units:1},{key:'db/test',units:1}]});assert.equal(two.ok,false);
  assert.equal(journal.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-2'").get().n,0);
  assert.equal(admission.assertFence({...identity(1),leaseToken:'wrong'}),false);assert.equal(admission.assertFence({...identity(1),leaseToken:one.leaseToken}),true);
  assert.equal(admission.release({...identity(1),leaseToken:one.leaseToken,consumeBudgets:true}).ok,true);
  assert.deepEqual({...journal.db.prepare("SELECT used_value,reserved_value FROM budgets WHERE scope_key='tokens/day'").get()},{used_value:5,reserved_value:0});
  assert.equal(journal.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,0,'release drops every ledger lease row too');
}));

test('an expired repo-scoped lease becomes effect_unknown before capacity is reused',()=>{
  let at=100;
  // A repo-scoped resource: reserveTwoPhase's own capacity query already excludes expired lease rows
  // (`expires_at>at`), and admission.reserve's `runExpire` additionally moves the stale job to effect_unknown
  // before the capacity check runs, so the two agree on why capacity opened back up.
  return withPair((journal,machine)=>{
    const admission=createAdmission({journal,machine,now:()=>at});admission.setCapacity('db/test',1);journal.enqueueJob(identity(1));journal.enqueueJob(identity(2));
    assert.equal(admission.reserve({...identity(1),resources:[{key:'db/test',units:1}],ttlMs:5}).ok,true);at=106;
    assert.equal(admission.reserve({...identity(2),resources:[{key:'db/test',units:1}]}).ok,true);assert.equal(journal.getJob('job-1').status,'effect_unknown');
    const token=journal.getJob('job-1').lease_token;assert.equal(admission.settleUnknown({...identity(1),leaseToken:token}).ok,true);
  },{now:()=>at});
});
test('ai/* machine capacity is reclaimed purely by TTL, independent of the ledger job’s own status',()=>{
  let at=100;
  return withPair((journal,machine)=>{
    const admission=createAdmission({journal,machine,now:()=>at,defaultAiCapacity:1});journal.enqueueJob(identity(1));journal.enqueueJob(identity(2));
    assert.equal(admission.reserve({...identity(1),resources:[{key:GLOBAL_AI_RESOURCE,units:1}],ttlMs:5}).ok,true);at=106;
    assert.equal(admission.reserve({...identity(2),resources:[{key:GLOBAL_AI_RESOURCE,units:1}]}).ok,true,'the machine arbiter reaps its own expired row by TTL alone');
    assert.equal(journal.getJob('job-1').status,'effect_unknown','the ledger side still records the stale reservation for reconciliation');
  },{now:()=>at});
});

test('ai/* resources are machine-scoped: capacity lives on the machine DB, repo resources stay on the ledger',()=>withPair((journal,machine)=>{
  const admission=createAdmission({journal,machine,defaultAiCapacity:3});admission.setCapacity('canonical-writer:repo',2);
  assert.deepEqual({...machine.db.prepare("SELECT capacity FROM resources WHERE resource_key=?").get(GLOBAL_AI_RESOURCE)},{capacity:3});
  assert.equal(journal.db.prepare("SELECT capacity FROM resources WHERE resource_key=?").get(GLOBAL_AI_RESOURCE),undefined,'ai/* capacity never lands on the ledger');
  assert.deepEqual({...journal.db.prepare("SELECT capacity FROM resources WHERE resource_key=?").get('canonical-writer:repo')},{capacity:2});
}));

test('two-phase failure on machine capacity leaves 0 ledger leases and 0 machine leases',()=>withPair((journal,machine)=>{
  const admission=createAdmission({journal,machine,defaultAiCapacity:1});admission.setCapacity('canonical-writer:repo',5);
  journal.enqueueJob(identity('blocker'));journal.enqueueJob(identity(1));
  assert.equal(admission.reserve({...identity('blocker'),resources:[{key:GLOBAL_AI_RESOURCE,units:1}]}).ok,true,'exhaust the machine-scoped resource first');
  const attempt=admission.reserve({...identity(1),resources:[{key:'canonical-writer:repo',units:1},{key:GLOBAL_AI_RESOURCE,units:1}]});
  assert.equal(attempt.ok,false);
  assert.equal(journal.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,0,'the repo-scoped lease the same transaction took is rolled back too');
  assert.equal(machine.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,0);
  assert.equal(journal.getJob('job-1').status,'queued','a failed reservation leaves the durable job exactly as it was, re-reservable');
}));

test('a crash simulated between the two release phases is swept clean by machine.sweep',()=>withPair((journal,machine,dir)=>{
  const admission=createAdmission({journal,machine,defaultAiCapacity:2});
  journal.enqueueJob(identity(1));
  const reserved=admission.reserve({...identity(1),resources:[{key:GLOBAL_AI_RESOURCE,units:1}]});assert.equal(reserved.ok,true);
  assert.equal(machine.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,1);
  // Release's ledger transaction commits the lease-row delete; simulate the crash landing right after that commit,
  // before admission.release's machine.release(machine_ref) call ever runs.
  journal.db.prepare('DELETE FROM leases WHERE job_id=?').run('job-1');
  const swept=machine.sweep({inspectLedger});
  assert.equal(swept.orphaned,1);
  assert.equal(machine.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,0);
}));

test('a partial budget failure after resources are reserved leaves nothing held',()=>withPair((journal,machine)=>{
  const admission=createAdmission({journal,machine,defaultAiCapacity:2});admission.setBudget('tokens/day',1);
  journal.enqueueJob(identity(1));
  const result=admission.reserve({...identity(1),resources:[{key:GLOBAL_AI_RESOURCE,units:1}],budgets:[{key:'tokens/day',units:5}]});
  assert.equal(result.ok,false);assert.deepEqual(result.reasons,['budget tokens/day exhausted']);
  assert.equal(journal.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,0);
  assert.equal(machine.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-1'").get().n,0);
  assert.equal(journal.getJob('job-1').status,'queued');
}));

test('a lease-identity trigger abort maps back to the named reconciliation failure',()=>withPair((journal,machine)=>{
  const admission=createAdmission({journal,machine});
  journal.enqueueJob(identity(1));
  // A hand-rolled INSERT that does not match the job's current lease_token is exactly the drift the
  // `leases_match_job` trigger exists to refuse; admission surfaces it as the same named failure it always has.
  assert.throws(()=>journal.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('db/test','job-1','workflow-1','op-1',1,1,'not-the-jobs-token',1,0,60000),/lease-identity-drift/);
}));
