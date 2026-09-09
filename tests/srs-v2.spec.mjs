import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {validateWorkspace} from '../core/index.mjs';
import {validateSpecification} from '../specifications/validate.mjs';
const example=new URL('../examples/nested-business/',import.meta.url);
const leaf='knowledge/business/srs/documents/update/index.yaml';
const sample=()=>parseYaml(fs.readFileSync(new URL(leaf,example),'utf8')).extensions.work3.specification;
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-srs-v2-'));fs.cpSync(example,root,{recursive:true});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,run:()=>validateWorkspace(root),write:(p,m)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(m));},mutate:(p,fn)=>{const file=path.join(root,p),m=parseYaml(fs.readFileSync(file,'utf8'));fn(m);fs.writeFileSync(file,stringifyYaml(m));}};}
const valid=s=>assert.deepEqual(validateSpecification(s),{ok:true,errors:[]});

test('v2 Business is a detailed SRS without architecture tables; draft is not accepted',()=>{const s=sample();valid(s);assert.equal(s.codeImpacts,undefined);assert.equal(s.serviceImpacts,undefined);s.status='pass';assert.equal(validateSpecification(s).ok,false);});
test('v2 rejects missing FR flow, actors, joins and title-only alternative/exception paths',()=>{
  for(const mutate of [
    s=>s.codeImpacts=[],
    s=>s.handoff.implementationChecks=[],
    s=>s.flows[0].requirementIds=['BR-OWNER'],
    s=>s.flows[0].steps[0].actor='unknown',
    s=>s.flows[0].alternatives[0].steps=[],
    s=>s.flows[0].exceptions[0].fromStep='missing',
    s=>s.flows[0].exceptions[0].resumeAt='missing',
    s=>s.flows[0].exceptions[0].steps[0].response='',
    s=>s.flows[0].ruleIds=['FR-KNOW-03'],
    s=>{s.flows[0].alternatives=[];s.flows[0].branchReview.alternatives='';},
    s=>s.requirements[0].acceptanceIds=['AC-SAVED'],
    s=>s.acceptance[0].flowIds=['unknown'],
    s=>s.data[0].transitions[0].to='missing',
    s=>s.context.scope=null
  ]){const s=sample();mutate(s);assert.equal(validateSpecification(s).ok,false,mutate.toString());}
});
test('recursive SRS discovers a new nested folder without a registry and changes parent inputs',t=>{
  const f=fixture(t),before=f.run();assert.equal(before.ok,true,JSON.stringify(before.errors));
  const rootDigest=before.nodes.find(n=>n.id==='example.business.srs').inputDigest;
  const base={schema:'work/node@2',kind:'business',required:true,description:'New synthetic cohesive scope'};
  f.write('knowledge/business/srs/A/index.yaml',{...base,id:'example.A'});
  f.write('knowledge/business/srs/A/B/index.yaml',{...base,id:'example.B',state:'uninvestigate'});
  const result=f.run();assert.equal(result.ok,true,JSON.stringify(result.errors));assert.ok(result.nodes.some(n=>n.id==='example.B'));
  assert.notEqual(result.nodes.find(n=>n.id==='example.business.srs').inputDigest,rootDigest);
  f.mutate('knowledge/business/srs/A/B/index.yaml',m=>{m.state='todo';});assert.ok(f.run().errors.some(e=>e.code==='SRS_VERSION'));
});
test('nested SRS rejects duplicate detail, misplaced overview, branch payload and forged completion',t=>{
  for(const [file,mutate,code] of [
    [leaf,m=>{m.business={};},'SRS_DUPLICATE'],
    ['knowledge/business/srs/index.yaml',m=>{m.extensions={work3:{specification:sample()}};},'SRS_BRANCH_PAYLOAD'],
    ['knowledge/business/srs/index.yaml',m=>{m.state='done';},'BRANCH_STATE'],
    [leaf,m=>{m.state='done';},'SPECIFICATION_NOT_ACCEPTED'],
    ['knowledge/business/overview/index.yaml',m=>{m.kind='business';},'MODULE_SPEC_OWNER']
  ]){const f=fixture(t);f.mutate(file,mutate);assert.ok(f.run().errors.some(e=>e.code===code),code);}
});

function architecture(){
  const s=sample();s.op='architecture.decide';
  s.codeImpacts=[{id:'code',repository:'synthetic-example',path:'src/documents.ts',symbol:'update',existence:'proposed',disposition:'change',relation:'direct',reason:'Implement the reviewed update',callerChain:['owner request'],sourceRefs:['example-intent'],flowIds:['FLOW-UPDATE'],serviceId:'service',tests:['Acceptance scenarios'],protectedPaths:['unrelated modules']}];
  s.serviceImpacts=[{id:'service',name:'Document application',deployment:'One synthetic local process',owner:'Document team',disposition:'change',inbound:['Owner request'],outbound:[],stores:['Document store'],events:[],compatibility:'Preserve document contract',rollout:'Later implementation',rollback:'Later implementation',observability:'Record outcomes without document content',sourceRefs:['example-intent'],flowIds:['FLOW-UPDATE']}];
  s.security[0].codeImpactIds=['code'];s.security[0].serviceIds=['service'];
  s.serviceCalls=[{id:'call',flowId:'FLOW-UPDATE',sequence:1,callerServiceId:'service',calleeServiceId:'service',mode:'in-process',operation:'Update owned document',endpointBinding:'Proposed local application call',callerSourceRef:'example-intent',receiverSourceRef:'example-intent',bindingSourceRefs:['example-intent'],identity:'Verified requester',dataClassification:'Private',failurePolicy:'Retain saved content on rejected update',status:'proposed'}];
  s.patternDecisions=[];
  s.securityReview=['authorization-and-tenancy','identity-and-token-forwarding','network-and-ssrf','data-privacy','replay-and-consistency','resource-abuse'].map((category,i)=>({id:'review-'+i,category,applicability:'assessed',rationale:'Synthetic local request boundary review',threatIds:['SEC-OWNER'],sourceRefs:['example-intent'],decisionId:'example-policy'}));
  s.handoff.implementationChecks=[{owner:'backend.implement',repository:'synthetic-example',check:'Ownership acceptance',command:'Proposed test harness; not yet created',sourceRef:'example-intent',status:'planned'}];
  s.architectureReview={context:'A small single-process document update example, not a distributed infrastructure design.',concerns:[{id:'privacy',concern:'Private content disclosure',rationale:'The accepted intent makes owner isolation important.',requirementIds:['NFR-PRIVACY'],sourceRefs:['example-intent'],decisionId:'example-policy',scenarios:[{id:'other-owner',trigger:'A different owner submits an update',impact:'Private document disclosure or change',control:'Check ownership before reading or writing',owner:'Document team',acceptanceIds:['AC-DENIED']}]}],challenge:{proposal:'One application boundary enforcing ownership and revision checks',simplerAlternative:'Blind replacement without checking ownership or edited version',tradeoffs:'Additional validation is required to preserve privacy and concurrent edits',decision:'Use the application boundary',reason:'The simpler alternative violates stated outcomes'},residualRisks:[],evidenceLimitations:['Synthetic design fixture only; no code or recovery test executed.']};return s;
}
test('architecture v2 permits no named patterns, but rejects unreasoned or unresolved concerns',()=>{
  const s=architecture();valid(s);
  for(const mutate of [x=>x.architectureReview.concerns=[],x=>x.architectureReview.challenge.reason='',x=>x.architectureReview.concerns[0].scenarios[0].acceptanceIds=['AC-CANCEL'],x=>x.architectureReview.evidenceLimitations=[]]){const bad=architecture();mutate(bad);assert.equal(validateSpecification(bad).ok,false);}
  s.status='pass';s.sources[0].kind='accepted-intent';for(const r of s.requirements)r.authority='accepted';s.decisions[0].blocking=false;assert.equal(validateSpecification(s).ok,false);s.decisions[0].status='accepted';valid(s);
  s.patternDecisions=[{id:'saga',pattern:'Saga',decision:'adopt',problem:'Synthetic',rationale:'Synthetic',simplerAlternative:'Local transaction',tradeoffs:'Synthetic',mechanism:{},sourceRefs:['example-intent'],serviceIds:['service'],acceptanceIds:['AC-SAVED']}];assert.equal(validateSpecification(s).ok,false);
});
test('architecture resolves nested Business dependencies and refuses rewritten user flows',t=>{
  const f=fixture(t);f.write('knowledge/architecture/index.yaml',{schema:'work/node@2',id:'example.architecture',kind:'architecture',required:true,state:'todo',description:'Synthetic design',dependsOn:['example.business.srs'],extensions:{work3:{specification:architecture()}}});
  assert.equal(f.run().ok,true,JSON.stringify(f.run().errors));
  f.mutate('knowledge/architecture/index.yaml',m=>{m.extensions.work3.specification.flows[0].steps[0].request='Different user behavior';});
  assert.ok(f.run().errors.some(e=>e.code==='SPECIFICATION_BUSINESS_DRIFT'));
});
