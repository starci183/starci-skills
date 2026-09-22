import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {admitOpSlot,deriveRetryLineage,normalizeOwnedPath,normalizeOwnedPaths,opSlotCeiling,ownedPathLeaseKey,ownedPathsIntersect,retryDisposition} from '../engine/admission.mjs';
import {reserveTwoPhase} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {withLedger} from './_ledger-fixture.mjs';

test('owned paths normalize to concrete workspace-relative prefixes',()=>{
  assert.equal(normalizeOwnedPath('.\\nivo-fe//apps/landing/**'),'nivo-fe/apps/landing');
  assert.equal(ownedPathLeaseKey('./.starciwork/migration/'),'path:.starciwork/migration');
  assert.throws(()=>normalizeOwnedPath('../nivo-fe'),/must not traverse/);
  assert.throws(()=>normalizeOwnedPath('nivo-fe/apps/*'),/concrete prefix/);
  assert.throws(()=>normalizeOwnedPath('C:\\repo\\file'),/repository-relative/);
});

test('owned path sets collapse duplicate descendants but preserve disjoint Nivo slices',()=>{
  assert.deepEqual(normalizeOwnedPaths(['nivo-fe/apps/landing/src','nivo-fe/apps/landing','nivo-fe/apps/landing/**','.starciwork/migration']),[
    'nivo-fe/apps/landing','.starciwork/migration',
  ]);
  assert.equal(ownedPathsIntersect('nivo-fe/apps/landing','nivo-fe/apps/landing/src/page.tsx'),true);
  assert.equal(ownedPathsIntersect('nivo-fe/apps/landing','.starciwork/migration'),false);
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
  for(const key of ['path:nivo-fe/apps/landing','path:nivo-fe/apps/landing/src','path:.starciwork/migration'])
    ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  const landing=reserveTwoPhase(ledger,machine,{job:{jobId:'landing',workflowId:'wf-landing',opId:'interface.implement',generation:1,kind:'op'},
    leases:[{resourceKey:'path:nivo-fe/apps/landing',units:1}]});
  assert.equal(landing.ok,true);
  const child=reserveTwoPhase(ledger,machine,{job:{jobId:'landing-child',workflowId:'wf-other',opId:'test.author',generation:1,kind:'op'},
    leases:[{resourceKey:'path:nivo-fe/apps/landing/src',units:1}]});
  assert.equal(child.ok,false);
  assert.match(child.reason,/overlaps durable lease path:nivo-fe\/apps\/landing held by landing/);
  const migration=reserveTwoPhase(ledger,machine,{job:{jobId:'canonicalize',workflowId:'wf-canonicalize',opId:'workspace.manage',generation:1,kind:'op'},
    leases:[{resourceKey:'path:.starciwork/migration',units:1}]});
  assert.equal(migration.ok,true,'disjoint product and Work migration paths may run concurrently');
}));

test('an expired path lease stays a fence until its attempt is explicitly settled',t=>withLedger(t,({ledger,machine})=>{
  for(const key of ['path:nivo-fe/apps/landing','path:nivo-fe/apps/landing/src'])
    ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  assert.equal(reserveTwoPhase(ledger,machine,{job:{jobId:'old',workflowId:'wf-old',opId:'op',generation:1,kind:'op'},
    leases:[{resourceKey:'path:nivo-fe/apps/landing',units:1}],ttlMs:1}).ok,true);
  ledger.db.prepare("UPDATE leases SET expires_at=0 WHERE job_id='old'").run();
  const next=reserveTwoPhase(ledger,machine,{job:{jobId:'next',workflowId:'wf-next',opId:'op',generation:1,kind:'op'},
    leases:[{resourceKey:'path:nivo-fe/apps/landing/src',units:1}]});
  assert.equal(next.ok,false);
  assert.match(next.reason,/overlaps durable lease/);
}));

test('only explicit no-effect infrastructure failures resume without consuming business retry budget',()=>{
  const rejected={job_id:'j1',attempt:1,payload_json:JSON.stringify({businessAttempt:1}),result_json:JSON.stringify({reason:'dispatch-rejected',effectState:'none',retryable:true,attemptConsumed:false})};
  assert.deepEqual(retryDisposition(rejected),{retryClass:'infrastructure',effectState:'none',resumable:true,consumesBusinessRetry:false});
  assert.deepEqual(deriveRetryLineage(rejected),{retryOf:null,resumeOf:'j1',attempt:1,businessAttempt:1,retryClass:'infrastructure',effectState:'none',resumed:true,reusesDurableAttempt:true,consumesBusinessRetry:false});

  const unknown={job_id:'j2',attempt:2,payload_json:JSON.stringify({retry:{businessAttempt:1}}),result_json:JSON.stringify({reason:'dispatch-rejected',retryClass:'infrastructure'})};
  assert.equal(retryDisposition(unknown).resumable,false);
  assert.deepEqual(deriveRetryLineage(unknown),{retryOf:'j2',resumeOf:null,attempt:3,businessAttempt:2,retryClass:'business',effectState:'unknown',resumed:false,reusesDurableAttempt:false,consumesBusinessRetry:true});
  const refused={job_id:'j3',attempt:1,result_json:JSON.stringify({reason:'dispatch-rejected',effectState:'none',retryable:false,attemptConsumed:true})};
  assert.equal(retryDisposition(refused).resumable,false,'no-effect alone is not enough without durable reusable classification');
});

test('workspace.manage derives explicit migration slices instead of claiming broad workspace roots',()=>{
  const file=path.resolve(import.meta.dirname,'../modules/ops/ops/workspace.manage.yaml');
  const policy=parseYaml(fs.readFileSync(file,'utf8')).policy.modePolicy.ownershipDerivation;
  assert.equal(policy.rule,'narrowest-concrete-selected-prefixes');
  assert.deepEqual(policy.broadRootsForbiddenWhenDerivable,['repository root','.starciwork','.starcistacks']);
  assert.ok(policy.importSlices.some(slice=>slice.includes('.starciwork/<scope>/')&&slice.includes('migration')));
  assert.ok(policy.concurrency.includes('landing-app'));
});
