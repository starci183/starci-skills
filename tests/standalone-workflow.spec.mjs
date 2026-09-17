import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {stringifyYaml} from '../core/yaml.mjs';
import {sha256,validateWorkspace} from '../core/index.mjs';
import {proposeStandalone,presentStandaloneGoal,approveGoal,requestCell,acceptCell,acceptDelivery,workflowDigest,markWorkDone} from '../workflows/lifecycle.mjs';
import {verifyProducerResult,hasDirectProducerAcceptance} from '../workflows/producer-verification.mjs';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-standalone-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const root=path.join(dir,'.starciwork');
 const put=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(value));};
 put(path.join(root,'workspace.yaml'),{schema:'work/workspace@1',id:'synthetic'});
 put(path.join(root,'piece/index.yaml'),{schema:'work/node@2',id:'piece',kind:'operations',required:true,state:'todo',description:'Synthetic bounded local check',assertions:['ready']});
 const goal={schema:'starci/goal@1',id:'one-check',workflow:'operate-runtime',requestId:'request',originalRequest:'Check this local service',finalOutcome:'Local service is ready',scope:{business:['local check'],paths:[],resources:['local:test'],exclusions:['production']},criteria:['ready'],businessChanges:['Check only local readiness'],impacts:[],resourceEffects:[{target:'local:test',operation:'inspect',postcondition:'ready'}],inputs:{},cells:[{id:'operate-runtime',op:'runtime.operate',operation:'service',purpose:'Check local readiness',finalOutput:'Readiness result',criteria:['ready'],inputs:{},outputSchema:{type:'object',properties:{ready:{type:'boolean'}},required:['ready'],additionalProperties:false}}],workTargets:['piece']};
 const receipt=(phase,digest)=>({actor:'user',phase,digest,approved:true,messageId:'synthetic-'+phase,replyTo:'shown',quote:'Synthetic explicit later approval'});
 return {dir,root,put,goal,receipt,run:proposeStandalone(goal,{workRoot:root})};
}
function approved(f){return approveGoal(presentStandaloneGoal(f.run,{messageId:'shown'}),f.receipt('goal',f.run.goalDigest));}
function result(f,run){const issued=requestCell(run,'operate-runtime');fs.writeFileSync(path.join(f.dir,'result.log'),'Synthetic real fixture result');const response={cell:'operate-runtime',op:'runtime.operate',operation:'service',goalDigest:run.goalDigest,scopeDigest:run.scopeDigest,requestDigest:workflowDigest(issued.request),status:'pass',outputs:{ready:true},criteria:[{id:'ready',status:'pass',observation:'Fixture service ready',evidence:['log']}],artifacts:[{id:'log',path:'result.log',sha256:sha256(fs.readFileSync(path.join(f.dir,'result.log')))}]};return acceptCell(issued.run,response,{evidenceRoot:f.dir});}
/**
 * The standalone run's on-disk record (`saveStandaloneRun`/`loadStandaloneRun`, under
 * `.starciwork/_local/workflows/<id>/`) is retired with `_local` itself - docs/ledger-db.md §13. What it was
 * ever asked to prove survives the writer: a run is a plain value, so carrying it across a process boundary
 * is serializing that value, and every verification still holds on the far side. That is asserted here with
 * a JSON round-trip, which is strictly stronger than the YAML one it replaces - it keeps no writer's schema
 * knowledge and would catch any hidden non-serializable state the old bundle silently dropped.
 */
const carried=run=>JSON.parse(JSON.stringify(run));
test('standalone lifecycle executes without any Plan and survives being carried, retaining result and Work completion proof',t=>{
 const f=fixture(t);let run=approved(f);
 assert.deepEqual(carried(run),run);
 assert.equal(fs.existsSync(path.join(f.root,'_local')),false,'no workflow record is written under _local any more');
 run=result(f,carried(run));assert.equal(verifyProducerResult(run),true);assert.equal(hasDirectProducerAcceptance(run),false);run=acceptDelivery(run,f.receipt('acceptance',run.resultDigest));assert.equal(hasDirectProducerAcceptance(run),true);
 assert.throws(()=>markWorkDone(run,{}));const node=validateWorkspace(f.root).nodes[0];f.put(path.join(f.root,'piece/evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:'proof',nodeId:'piece',inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'ready',outcome:'pass',observation:'Synthetic completion test'}],assets:[]});
 // The carried value is what finishes the run, and its completion proof is the same proof.
 run=markWorkDone(carried(run),{piece:{inputDigest:node.inputDigest,evidence:['proof']}});assert.equal(run.status,'done');
 assert.equal(carried(run).status,'done');assert.equal(verifyProducerResult(carried(run)),true);assert.equal(hasDirectProducerAcceptance(carried(run)),true);
 assert.equal(fs.existsSync(path.join(f.root,'_local')),false);
});
test('standalone does not waive goal confirmation, unresolved choices, or scope immutability',t=>{
 const f=fixture(t);assert.throws(()=>requestCell(f.run,'operate-runtime'));assert.throws(()=>approveGoal(f.run,f.receipt('goal',f.run.goalDigest)));
 const uncertain=presentStandaloneGoal(f.run,{messageId:'shown',openQuestions:['Which service?']});assert.throws(()=>approveGoal(uncertain,f.receipt('goal',f.run.goalDigest)),/questions/);
 const run=approved(f);run.goal.scope.resources.push('production');assert.throws(()=>requestCell(run,'operate-runtime'),/Frozen/);
});
test('standalone proof rejects stale artifacts and presentation tampering',t=>{
 const f=fixture(t);const run=result(f,approved(f));const changed=structuredClone(run);changed.presentation.scope.workflow='correct-data';assert.throws(()=>verifyProducerResult(changed),/presentation changed/);
 fs.writeFileSync(path.join(f.dir,'result.log'),'changed');assert.throws(()=>acceptDelivery(run,f.receipt('acceptance',run.resultDigest)),/stale/);
});
/**
 * The unsafe-ID and overwrite guards this used to assert belonged to `saveStandaloneRun`'s directory
 * handling and retire with it - there is no directory left to escape or overwrite. The half that was never
 * about a file is that a differently-worded goal is a DIFFERENT run, which the frozen digest already says.
 */
test('a restated standalone goal is a different run, not a replacement of the approved one',t=>{
 const f=fixture(t);const original=approved(f);
 const changed=presentStandaloneGoal(proposeStandalone({...f.goal,finalOutcome:'Another outcome'},{workRoot:f.root}),{messageId:'other'});
 assert.notEqual(changed.goalDigest,original.goalDigest);
 // Same presentation, same reply - only the digest differs, so the digest is what refuses.
 assert.throws(()=>approveGoal(changed,{...f.receipt('goal',original.goalDigest),replyTo:'other'}),/decision/);
 assert.equal(approveGoal(changed,{...f.receipt('goal',changed.goalDigest),replyTo:'other'}).status,'approved');
 assert.throws(()=>requestCell({...changed,approvals:original.approvals,status:'approved'},'operate-runtime'));
});
test('standalone retains missing Work gate and cannot reuse original request as approval',t=>{
 const f=fixture(t);const shown=presentStandaloneGoal(f.run,{messageId:'shown'});
 assert.throws(()=>approveGoal(shown,{...f.receipt('goal',f.run.goalDigest),messageId:f.goal.requestId}),/later user reply/);
 const root=path.join(f.dir,'missing/.starciwork'),run=proposeStandalone(f.goal,{workRoot:root});
 const approvedRun=approveGoal(presentStandaloneGoal(run,{messageId:'shown'}),f.receipt('goal',run.goalDigest));
 assert.equal(approvedRun.status,'awaiting-bootstrap');assert.throws(()=>requestCell(approvedRun,'operate-runtime'));
});
