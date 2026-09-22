import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const load=id=>parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops',`${id}.yaml`),'utf8'));
const prose=value=>JSON.stringify(value);

function assertClosedStepReferences(contract){
  const reads=new Set((contract.reads??[]).map(item=>item.id));
  const writes=new Set((contract.writes??[]).map(item=>item.id));
  const readable=new Set([...reads,...writes]);
  for(const [index,step] of (contract.steps??[]).entries()){
    for(const id of step.reads??[])assert.ok(readable.has(id),`${contract.id} step ${index+1} has unknown read ${id}`);
    for(const id of step.writes??[])assert.ok(writes.has(id),`${contract.id} step ${index+1} has unknown write ${id}`);
  }
}

test('assisted UAT operations are valid distinct catalog contracts with closed step references',()=>{
  const prepare=load('uat.assisted.prepare');
  const verify=load('uat.assisted.verify');
  const automatic=load('uat.verify');

  assert.equal(prepare.id,'uat.assisted.prepare');
  assert.equal(verify.id,'uat.assisted.verify');
  assert.equal(automatic.id,'uat.verify');
  for(const contract of [prepare,verify]){
    assert.deepEqual(contract.nodeKinds,['uat.ux']);
    assert.equal(contract.completionProfile,'uat.ux');
    assert.equal(contract.route.phase[0],'verify');
    assert.equal(contract.graphPolicy.dispatch,'never');
    assert.equal(contract.policy.canonicalWorkPolicy.targetState,'todo');
    assert.equal(contract.policy.canonicalWorkPolicy.nodeWrites,'forbidden');
    assert.equal(contract.policy.canonicalWorkPolicy.completion,'final-reconciliation-only');
    assert.equal(contract.policy.canonicalWorkPolicy.runtimeSqliteWrites,'forbidden');
    assert.ok(!(contract.writes??[]).some(write=>write.id==='node'));
    assertClosedStepReferences(contract);
  }
  assert.equal(automatic.policy.uatPolicy.flowOrder,'request-sequential');
  assert.equal(verify.policy.assistedUatVerifyPolicy.automaticUatVerify,'distinct-operation-never-invoked');
});

test('assisted preparation freezes exact artifacts and classifies real human gates instead of third parties',()=>{
  const contract=load('uat.assisted.prepare');
  const request=contract.writes.find(write=>write.id==='request');
  const session=contract.writes.find(write=>write.id==='session');
  const scripts=contract.writes.find(write=>write.id==='playwright');

  assert.equal(request.path,'E/assisted-uat/request.yaml');
  assert.equal(session.path,'E/assisted-uat/session-manifest.yaml');
  assert.equal(scripts.path,'E/assisted-uat/playwright/<flow-id>.spec.ts');
  assert.deepEqual(request.fields,[
    'schema','requestId','nodeId','preparedAt','bindings','build','environment','flows','humanGates','scripts',
    'sessionManifest','redaction','cleanup','receipt','limits',
  ]);
  const text=prose(contract);
  for(const schema of ['starci/assisted-uat-request@1','starci/assisted-uat-session-manifest@1','starci/assisted-uat-receipt@1']){
    assert.match(text,new RegExp(schema.replace('/','\\/')));
  }
  for(const digest of ['requestDigest','inputDigest','buildDigest','environmentDigest','flowsDigest','scriptsDigest','cleanupPlanDigest','redactionPolicyDigest']){
    assert.match(text,new RegExp(digest));
  }
  for(const gateClass of ['secret-entry','anti-automation-challenge','cross-device-action','subjective-observation','reserved-manual-action']){
    assert.match(text,new RegExp(gateClass));
  }
  assert.equal(contract.policy.assistedUatPreparePolicy.minimumHumanGates,1);
  assert.equal(contract.policy.assistedUatPreparePolicy.thirdPartyIsGate,false);
  assert.equal(contract.policy.assistedUatPreparePolicy.executesJourney,false);
  assert.match(text,/flow with no genuine human gate belongs to uat\.verify/i);
  assert.match(text,/third-party API, provider[\s\S]*is not a human gate/i);
  assert.match(text,/actual Chromium launch/i);
  assert.match(text,/screenshot and short video/i);
  assert.match(text,/idempotent finally-style plan/i);
  assert.match(text,/generic human ok as an assertion/i);
});

test('assisted verification derives pass from immutable current proof and never from human ok',()=>{
  const contract=load('uat.assisted.verify');
  const receipt=contract.reads.find(read=>read.id==='receipt');
  const verification=contract.writes.find(write=>write.id==='verification');

  assert.equal(receipt.path,'selected uat.assisted.prepare E/assisted-uat/receipts/<run-id>.yaml');
  assert.equal(verification.path,'E/assisted-uat/verification.yaml');
  assert.equal(contract.policy.assistedUatVerifyPolicy.inputSelection,'explicit-paths-only');
  assert.equal(contract.policy.assistedUatVerifyPolicy.latestRunDiscovery,'forbidden');
  assert.equal(contract.policy.assistedUatVerifyPolicy.completionSignal,'execution-finished-only');
  assert.deepEqual(contract.policy.assistedUatVerifyPolicy.passDerivedFrom,[
    'immutable-current-bindings','complete-controlled-sequence','machine-checks',
    'genuine-redacted-evidence','independent-postconditions','verified-cleanup',
  ]);
  const text=prose(contract);
  assert.match(text,/completionSignal value ok means only that the human declared the controlled run finished/i);
  assert.match(text,/contains no accepted pass verdict/i);
  assert.match(text,/human ok contributes nothing to the predicate/i);
  assert.match(text,/independently recompute current Work input, build, environment and flow bindings/i);
  assert.match(text,/nonempty bytes, media signature and playable\/finalized media/i);
  assert.match(text,/read-only postcondition probe independently/i);
  assert.match(text,/real owning API\/database\/provider/i);
  assert.match(text,/Do not execute cleanup/i);
  assert.match(text,/Keep canonical Work todo and unchanged/i);
});

test('assisted UAT doctrine fixes runner invocation, receipt lifecycle and canonical reporting boundary',()=>{
  const doc=fs.readFileSync(path.join(ROOT,'docs','assisted-uat.md'),'utf8');
  assert.match(doc,/`--request <request\.yaml>` and `--receipt <new-receipt\.yaml>` paths only/);
  assert.match(doc,/writes its receipt last/);
  assert.match(doc,/refuse an existing receipt path or run ID/);
  assert.match(doc,/The receipt has no accepted `pass` field/);
  assert.match(doc,/execution-finished-not-pass/);
  assert.match(doc,/never searches for a latest or passing run/);
  assert.match(doc,/remains `state: todo`/);
  assert.match(doc,/only final[\s\S]*reconciliation may bind current SRS, SDS, implementation, test\/E2E and UAT evidence/);
  assert.match(doc,/starci\/op-report@1/);
  assert.match(doc,/scripts\/kernel\/api\.mjs report --repo <bound-repo> --job <current-job>/);
  assert.match(doc,/No separate assisted-UAT ingestion[\s\S]*verb or direct SQL path exists/);
});
