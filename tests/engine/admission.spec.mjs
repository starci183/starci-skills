import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {AWAITING_OWNER_STATUS,SETTLED_JOB_LIST,admitOpSlot,admitUnitTry,spentTries,normalizeOwnedPath,normalizeOwnedPaths,opSlotCeiling,ownedPathLeaseKey,ownedPathsIntersect,retryDisposition} from '../../engine/admission.mjs';
import {reserveTwoPhase} from '../../engine/db/ledger.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';

test('owned paths normalize to concrete workspace-relative prefixes',()=>{
  assert.equal(normalizeOwnedPath('.\\todo-app-fe//apps/landing/**'),'todo-app-fe/apps/landing');
  assert.equal(ownedPathLeaseKey('./.starciwork/migration/'),'path:.starciwork/migration');
  assert.throws(()=>normalizeOwnedPath('../todo-app-fe'),/must not traverse/);
  assert.throws(()=>normalizeOwnedPath('todo-app-fe/apps/*'),/concrete prefix/);
  assert.throws(()=>normalizeOwnedPath('C:\\repo\\file'),/repository-relative/);
});

test('owned path sets collapse duplicate descendants but preserve disjoint product slices',()=>{
  assert.deepEqual(normalizeOwnedPaths(['todo-app-fe/apps/landing/src','todo-app-fe/apps/landing','todo-app-fe/apps/landing/**','.starciwork/migration']),[
    'todo-app-fe/apps/landing','.starciwork/migration',
  ]);
  assert.equal(ownedPathsIntersect('todo-app-fe/apps/landing','todo-app-fe/apps/landing/src/page.tsx'),true);
  assert.equal(ownedPathsIntersect('todo-app-fe/apps/landing','.starciwork/migration'),false);
});

// Two declared ceilings meet at one line: budgets.maxOps (owner, per workflow)
// and modules/models/runtimes.yaml maxParallelOps (fleet). The lower admits and
// the refusal string is `max-ops`.
test('the concurrent-operation ceiling is the lower of the owner budget and the fleet ceiling',()=>{
  assert.deepEqual(opSlotCeiling({maxOps:1,maxParallelOps:20}),{ceiling:1,source:'budgets.maxOps'});
  assert.deepEqual(opSlotCeiling({maxOps:40,maxParallelOps:20}),{ceiling:20,source:'maxParallelOps'});
  assert.deepEqual(opSlotCeiling({maxOps:20,maxParallelOps:20}),{ceiling:20,source:'budgets.maxOps'},'a tie names the owner budget — the one the owner can move');
  assert.deepEqual(opSlotCeiling({maxOps:null,maxParallelOps:20}),{ceiling:20,source:'maxParallelOps'},'no owner budget still meets the fleet ceiling');
  assert.deepEqual(opSlotCeiling({maxOps:8,maxParallelOps:null}),{ceiling:8,source:'budgets.maxOps'});
  assert.deepEqual(opSlotCeiling({}),{ceiling:null,source:null},'two absent ceilings are unbounded, not zero');
  assert.deepEqual(opSlotCeiling({maxOps:0,maxParallelOps:-3}),{ceiling:null,source:null},'a non-positive ceiling is not a ceiling');
});

test('admitOpSlot refuses max-ops at the ceiling and never above or below it',()=>{
  assert.deepEqual(admitOpSlot({running:0,maxOps:1,maxParallelOps:20}),
    {ok:true,running:0,ceiling:1,ceilingSource:'budgets.maxOps',reason:null});
  assert.deepEqual(admitOpSlot({running:1,maxOps:1,maxParallelOps:20}),
    {ok:false,running:1,ceiling:1,ceilingSource:'budgets.maxOps',reason:'max-ops'},'at the ceiling is refused — the cap is a ceiling, not a target');
  assert.deepEqual(admitOpSlot({running:5,maxOps:1,maxParallelOps:20}).reason,'max-ops','drift above the ceiling stays refused');
  assert.equal(admitOpSlot({running:19,maxParallelOps:20}).ok,true);
  assert.deepEqual(admitOpSlot({running:20,maxParallelOps:20}),
    {ok:false,running:20,ceiling:20,ceilingSource:'maxParallelOps',reason:'max-ops'},'the fleet ceiling admits alone when the owner declared none');
  assert.equal(admitOpSlot({running:9999}).ok,true,'unbounded is unbounded');
});

test('durable prefix leases serialize parent and child scopes across workflows while disjoint scopes run together',t=>withLedger(t,({ledger,machine})=>{
  seedWorkflow(ledger,{id:'wf-landing',jobs:[{jobId:'landing',opId:'interface.implement'}]});
  seedWorkflow(ledger,{id:'wf-other',jobs:[{jobId:'landing-child',opId:'test.author'}]});
  seedWorkflow(ledger,{id:'wf-canonicalize',jobs:[{jobId:'canonicalize',opId:'workspace.manage'}]});
  for(const key of ['path:todo-app-fe/apps/landing','path:todo-app-fe/apps/landing/src','path:.starciwork/migration'])
    ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  const landing=reserveTwoPhase(ledger,machine,{job:{jobId:'landing',workflowId:'wf-landing',opId:'interface.implement',generation:1,kind:'op'},
    leases:[{resourceKey:'path:todo-app-fe/apps/landing',units:1}]});
  assert.equal(landing.ok,true);
  const child=reserveTwoPhase(ledger,machine,{job:{jobId:'landing-child',workflowId:'wf-other',opId:'test.author',generation:1,kind:'op'},
    leases:[{resourceKey:'path:todo-app-fe/apps/landing/src',units:1}]});
  assert.equal(child.ok,false);
  assert.match(child.reason,/overlaps durable lease path:todo-app-fe\/apps\/landing held by landing/);
  const migration=reserveTwoPhase(ledger,machine,{job:{jobId:'canonicalize',workflowId:'wf-canonicalize',opId:'workspace.manage',generation:1,kind:'op'},
    leases:[{resourceKey:'path:.starciwork/migration',units:1}]});
  assert.equal(migration.ok,true,'disjoint product and Work migration paths may run concurrently');
}));

test('an expired path lease stays a fence until its attempt is explicitly settled',t=>withLedger(t,({ledger,machine})=>{
  seedWorkflow(ledger,{id:'wf-old',jobs:[{jobId:'old',opId:'op'}]});
  seedWorkflow(ledger,{id:'wf-next',jobs:[{jobId:'next',opId:'op'}]});
  for(const key of ['path:todo-app-fe/apps/landing','path:todo-app-fe/apps/landing/src'])
    ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  assert.equal(reserveTwoPhase(ledger,machine,{job:{jobId:'old',workflowId:'wf-old',opId:'op',generation:1,kind:'op'},
    leases:[{resourceKey:'path:todo-app-fe/apps/landing',units:1}],ttlMs:1}).ok,true);
  ledger.db.prepare("UPDATE leases SET acquired_at=0,expires_at=1 WHERE job_id='old'").run();
  const next=reserveTwoPhase(ledger,machine,{job:{jobId:'next',workflowId:'wf-next',opId:'op',generation:1,kind:'op'},
    leases:[{resourceKey:'path:todo-app-fe/apps/landing/src',units:1}]});
  assert.equal(next.ok,false);
  assert.match(next.reason,/overlaps durable lease/);
}));

test('only explicit no-effect infrastructure failures resume without consuming business retry budget',()=>{
  const rejected={job_id:'j1',attempt:1,payload_json:JSON.stringify({businessAttempt:1}),result_json:JSON.stringify({reason:'dispatch-rejected',effectState:'none',retryable:true,attemptConsumed:false})};
  assert.deepEqual(retryDisposition(rejected),{retryClass:'infrastructure',effectState:'none',resumable:true,consumesBusinessRetry:false});

  const unknown={job_id:'j2',attempt:2,payload_json:JSON.stringify({retry:{businessAttempt:1}}),result_json:JSON.stringify({reason:'dispatch-rejected',retryClass:'infrastructure'})};
  assert.equal(retryDisposition(unknown).resumable,false);
  const refused={job_id:'j3',attempt:1,result_json:JSON.stringify({reason:'dispatch-rejected',effectState:'none',retryable:false,attemptConsumed:true})};
  assert.equal(retryDisposition(refused).resumable,false,'no-effect alone is not enough without durable reusable classification');
});

test('an attempt settled awaiting-owner spends no business retry',()=>{
  const asked={job_id:'ask1',attempt:3,payload_json:JSON.stringify({retry:{businessAttempt:2}}),result_json:JSON.stringify({verdict:'awaiting-owner',kernelVerdict:'blocked'})};
  assert.deepEqual(retryDisposition(asked),{retryClass:'owner-answer',effectState:'unknown',resumable:false,consumesBusinessRetry:false});
  const blocked={job_id:'b1',attempt:1,result_json:JSON.stringify({verdict:'blocked'})};
  assert.equal(retryDisposition(blocked).consumesBusinessRetry,true,'a typed blocker is still a business attempt');
});

test('a try that ended awaiting_owner is settled, follows like a failed try and spends no unit try',()=>{
  assert.equal(AWAITING_OWNER_STATUS,'awaiting_owner');
  assert.ok(SETTLED_JOB_LIST.includes('awaiting_owner')&&SETTLED_JOB_LIST.includes('failed'));
  const unit={unit_id:'u1',try_budget:5,state:'failed'};
  const failed=n=>({job_id:`t${n}`,try_no:n,status:'failed',result_json:JSON.stringify({verdict:'fail'})});
  const asked=n=>({job_id:`t${n}`,try_no:n,status:'awaiting_owner',result_json:JSON.stringify({verdict:'awaiting-owner'})});
  const tries=[failed(1),asked(2),failed(3),asked(4)];
  assert.equal(spentTries(tries),2,'the two asks spent nothing');
  const next=admitUnitTry({unit,tries,retryOf:'t4'});
  assert.deepEqual([next.tryNo,next.retryOf,next.retryClass],[5,'t4','follow-up'],'an answered ask is retried as an owner-answer follow-up');
  assert.equal(admitUnitTry({unit,tries:[...tries,failed(5),failed(6)]}).tryNo,7,'try 7 is only the fifth SPENT try');
  assert.throws(()=>admitUnitTry({unit,tries:[...tries,failed(5),failed(6),failed(7)]}),{code:'unit-try-budget-exhausted'},'five spent tries exhaust the budget even with asks in the lineage');
  assert.throws(()=>admitUnitTry({unit,tries:[{job_id:'r1',try_no:1,status:'running'}],retryOf:'r1'}),{code:'unit-in-flight'});
});

test('workspace.manage derives explicit migration slices instead of claiming broad workspace roots',()=>{
  const file=path.resolve(import.meta.dirname,'..', '..', 'modules', 'ops', 'ops', 'workspace.manage.yaml');
  const policy=parseYaml(fs.readFileSync(file,'utf8')).policy.modePolicy.ownershipDerivation;
  assert.equal(policy.rule,'narrowest-concrete-selected-prefixes');
  assert.deepEqual(policy.broadRootsForbiddenWhenDerivable,['repository root','.starciwork','.starcistacks']);
  assert.ok(policy.importSlices.some(slice=>slice.includes('.starciwork/index.yaml')&&slice.includes('.starciwork/evidence/<workflow>.import/')&&slice.includes('migration')));
  assert.ok(!policy.importSlices.some(slice=>/\.starciwork\/<scope/.test(slice)),'no root-level scope record directory is an import slice');
  assert.ok(policy.concurrency.includes('landing-app'));
});
