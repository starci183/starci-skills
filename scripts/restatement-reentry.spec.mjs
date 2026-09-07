import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fixture} from './nested-return-fixture.mjs';
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const put=(file,value)=>writeFile(file,typeof value==='string'?value:JSON.stringify(value));

async function sealReading(f) {
 const state=await f.read(),bind=JSON.parse(await readFile(path.join(f.branch('1/1'),'request/request.json')));
 const forecast={chain:state.chain,steps:state.steps,goals:{'1/1':bind.goal,'2/1':f.first.goal,'3/1':f.first.goal},reasons:{},presets:{'1/1':bind.requirements,'2/1':f.first.requirements,'3/1':f.first.requirements},dependencies:{'1/1':[],'2/1':['1/1'],'3/1':['1/1']},evidenceDependencies:{'1/1':[],'2/1':[],'3/1':[]},handoffs:{},nodes:{'1/1':'binding','2/1':'reading','3/1':'architecture'},resumes:{},imports:{},fanout:{}};
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const address=await f.retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:state.mission.version,scopeHash:f.scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});
 state.planHistory={active:address,revisions:[address]};await f.save(state);
}

for(const delegated of [true,false])test(`public preview, commit and open consume the exact ${delegated?'delegated review':'ordinary user answer'} without rewriting the blocked reading`,async t=>{
 const f=await fixture(t,{readingOnly:true}),dir=f.branch('2/1'),state=await f.read();
 const decisionId=f.restatementDecisionId(f.first,f.template.requirements.decisionId,f.text);
 const retainedFiles=['request/request.json','response/restatement.md','response/response.json'];
 const original=await Promise.all(retainedFiles.map(ref=>readFile(path.join(dir,ref))));
 let reviewAddress;
 if(delegated){
  const reviewer=await f.openSession(path.join(f.owner,'.worktrees/sessions'),{project:'review',hostBinding:{kind:'codex-task',hostId:path.basename(f.host)+'-coordinator',worktree:f.owner,sourcePromptRef:'user:explicit-coordinator'},topology:{mode:'coordinated'},mission:{language:'en',goal:'Coordinate the bounded review.',target:'The same read path',includes:['Review unchanged restatements'],outputs:['A coordinator review'],doneWhen:[{producedBy:'architecture.decide',evidence:'The review is recorded.'}],verification:'Review the exact approved scope.',sourceRef:'user:explicit-coordinator'}});
  const api=await f.load('scripts/restatement-delegation.mjs');
  const grant={selectedBy:'user',sourceRef:'user:explicit-fixture-delegation',statement:'The named coordinator may review unchanged restatements within this approved architecture scope; ask me about material deviations.',scope:{sessionId:state.id,missionVersion:state.mission.version,scopeHash:f.scopeHash(state.mission)},coordinatorSession:reviewer.session,operators:['architecture.decide']};
  const granted=await api.recordRestatementDelegation(f.root,f.session,grant);
  const {tableUnder}=await f.load('scripts/validate-response.mjs');
  const review={selected:'as-stated',selectedBy:'coordinator',sourceRef:'coordinator:actual-bounded-reading-review',delegationId:granted.decisionId,coordinatorSession:reviewer.session,requestHash:sha(original[0]),restatementHash:sha(f.text),scopeHash:grant.scope.scopeHash,goalVersion:state.mission.version,lines:tableUnder(f.text,'## Restatement').map(([line,statement])=>({line:Number(line),statementHash:sha(statement),clauses:[{pointer:'/includes/0',hash:sha(state.mission.includes[0])},{pointer:'/target',hash:sha(state.mission.target)}],judgment:'The read-path architecture reading stays within the approved architecture and independent-review boundary; this mapping is reviewer judgment, not a semantic proof.'})),exclusions:(state.mission.excludes??[]).map((text,index)=>({index,hash:sha(text)})),materialChanges:[]};
  reviewAddress=(await api.recordDelegatedRestatementReview(f.root,dir,review)).basis;
 }else await f.recordRestatementChoice(dir,{selected:'as-stated',selectedBy:'user',sourceRef:'user:actual-fixture-answer'});
 await sealReading(f);
 const flags={edit:{kind:'resume',cell:'3/1',source:'2/1'}},before=await readFile(path.join(f.session,'state.json'));
 const preview=await f.plans.previewRevision(f.root,f.session,flags);
 const flagsFile=path.join(f.host,'reading-flags.json');await put(flagsFile,flags);
 const run=(operation,input)=>execFileSync(process.execPath,[path.join(f.root,'scripts/plan-history.mjs'),operation,f.session,input],{encoding:'utf8',windowsHide:true,timeout:60000});
 assert.ok(run('preview',flagsFile).includes(preview.previewHash),'standalone CLI prints the same reviewed forecast');
 assert.deepEqual(await readFile(path.join(f.session,'state.json')),before,'preview is read-only');
 if(delegated){
  for(const change of [s=>{delete s.choices[decisionId];},s=>{s.choices[decisionId].selectedBy='external';},s=>{delete s.choices[decisionId].basis;},s=>{s.choices[decisionId].selected='corrected';}]){
   const altered=await f.read();change(altered);await f.save(altered);
   await assert.rejects(f.plans.previewRevision(f.root,f.session,flags),/PLAN_REENTRY_UNAUTHORIZED|HISTORY|choice|basis/i);
   await writeFile(path.join(f.session,'state.json'),before);
  }
  const reviewFile=path.join(f.session,reviewAddress.ref),bytes=await readFile(reviewFile);
  await put(reviewFile,bytes.toString().replace('actual-bounded-reading-review','tampered-bounded-reading-review'));
  await assert.rejects(f.plans.previewRevision(f.root,f.session,flags),/HISTORY_TAMPERED|PLAN_REENTRY_UNAUTHORIZED/);
  await assert.rejects(f.plans.commitRevision(f.root,f.session,{previewHash:preview.previewHash,flags,reason:'Reject a changed review before committing.'}),/HISTORY_TAMPERED|PLAN_REENTRY_UNAUTHORIZED/);
  await writeFile(reviewFile,bytes);
  const changed=await f.read();changed.mission.version+=1;await f.save(changed);
  await assert.rejects(f.plans.previewRevision(f.root,f.session,flags),/scope|mission|HISTORY|PLAN_SCOPE|PLAN_PROOF/i);
  await writeFile(path.join(f.session,'state.json'),before);
 }
 const reviewed={previewHash:preview.previewHash,flags,reason:'Continue the exact retained reading under its verified decision.'};
 if(delegated){const file=path.join(f.host,'reviewed-plan.json');await put(file,reviewed);assert.ok(JSON.parse(run('commit',file)),'standalone CLI commits the same delegated forecast');}
 else await f.plans.commitRevision(f.root,f.session,reviewed);
 const after=await f.read(),cell=after.current,[step,parallel]=cell.split('/').map(Number);
 assert.equal(after.resumes[cell].resumes,'2/1');
 const request=f.current(f.template,step,{number:2,previous:f.first.attempt.id,resume:{step:2,parallel:1,token:decisionId}});
 request.parallel=parallel;request.decisionId=decisionId;request.selectedOption='as-stated';request.requirements={...after.planned[cell].requirements};
 const requestDir=f.branch(cell);
 const {mkdir}=await import('node:fs/promises');await mkdir(path.join(requestDir,'request'),{recursive:true});
 await put(path.join(requestDir,'request/request.json'),request);await f.openAttempt(requestDir);
 assert.equal((await f.read()).attempts[cell].status,'running');
 assert.equal((await f.read()).choices[decisionId].selectedBy,delegated?'coordinator':'user');
 for(let i=0;i<retainedFiles.length;i++)assert.deepEqual(await readFile(path.join(dir,retainedFiles[i])),original[i]);
 assert.deepEqual(f.plans.planHistoryErrors(f.session,await f.read()),[]);
});
