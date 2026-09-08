import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './nested-return-fixture.mjs';

const put=async(file,value)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,typeof value==='string'?value:JSON.stringify(value));};

test('public correction retires three genuinely returned parents after a fresh keep, without current-goal credit',async t=>{
 const f=await fixture(t,{followupReading:true});
 const {missionCorrectionBusy}=await f.load('scripts/session-open.mjs');
 const {confirmSession}=await f.load('scripts/v23-test-fixture.mjs');
 let previous=f.parent;
 for(const step of [4,5,6]){
  const cell=`${previous.step}/1`,flags={edit:{kind:'resume',cell}};
  const preview=await f.plans.previewRevision(f.root,f.session,flags);
  await f.plans.commitRevision(f.root,f.session,{flags,previewHash:preview.previewHash,reason:'The exact current independent review returned this candidate; continue the authorized fixture review.'});
  const request={...structuredClone(previous),step,resume:{step:previous.step,parallel:1,token:'returned-review'},attempt:{id:`${step}/1:a${step-1}`,number:step-1,kind:'repair',previous:previous.attempt.id}};
  request.environment.isolationId=request.attempt.id;
  await f.waiting(request);await f.review(request,step===6?'keep':'return');
  assert.equal(await missionCorrectionBusy(f.session,await f.read()),true,'a genuine current waiting obligation remains busy even after its child completes');
  previous=request;
 }
 const dir=f.branch('6/1');
 await f.acquireWorkerSlot(dir,'final-author',{resume:true,ranProfile:'sol-reviewer'});
 await put(path.join(dir,'response/response.md'),f.files['response/response.md']);
 await put(path.join(dir,'response/response.json'),f.actual(previous,{...f.files['response/response.json'],fields:{...f.files['response/response.json'].fields,restatement:'response/restatement.md'}},'done',['response/response.md']));
 assert.equal((await f.acceptAttempt(dir)).state,'matched');
 const completed=await f.read(),keys=['3/1','4/1','5/1'];
 const settled=await f.resolvedWaitingAttemptKeys(f.root,f.session,completed,{requireSuccessorTerminal:true});
 assert.deepEqual(settled.errors,[]);assert.deepEqual([...settled.settled].sort(),keys);
 const retained=new Map();
 for(const key of [...keys,'6/1'])for(const ref of ['request/request.json','response/response.json']){
  const file=path.join(f.branch(key),ref);retained.set(file,await readFile(file));
 }
 const corrected=await confirmSession(f.session,{selected:'corrected',selectedBy:'user',sourceRef:'user:fixture-corrected-reading',mission:{...completed.mission,goal:'Decide the corrected bounded read architecture.'}});
 assert.equal(corrected.version,2);
 await confirmSession(f.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:fixture-approved-corrected-scope'});
 const current=await f.read(),retired=await f.resolvedWaitingAttemptKeys(f.root,f.session,current,{requireSuccessorTerminal:true});
 assert.deepEqual(retired.errors,[]);assert.deepEqual([...retired.retired].sort(),keys);
 assert.deepEqual([...retired.settled],[]);assert.deepEqual([...retired.reentering],[]);
 assert.equal(await missionCorrectionBusy(f.session,current),false);
 for(const key of keys)assert.deepEqual(current.attempts[key],completed.attempts[key]);
 for(const[file,bytes]of retained)assert.deepEqual(await readFile(file),bytes);
 const middle=path.join(f.branch('4/1'),'response/response.json'),bytes=await readFile(middle);
 try {
  await writeFile(middle,JSON.stringify({...JSON.parse(bytes),operatorId:'business.decide'}));
  const damaged=await f.resolvedWaitingAttemptKeys(f.root,f.session,current,{requireSuccessorTerminal:true});
  assert.ok(damaged.errors.length);assert.equal(damaged.retired.has('4/1'),false);
  assert.equal(await missionCorrectionBusy(f.session,current),true);
 }finally{await writeFile(middle,bytes);}
 const flags={};const preview=await f.plans.previewRevision(f.root,f.session,flags);
 await f.plans.commitRevision(f.root,f.session,{flags,previewHash:preview.previewHash,reason:'Plan the publicly confirmed corrected architecture while preserving original review history.'});
 const final=await f.read();
 assert.equal(final.mission.version,2);assert.deepEqual(f.plans.planHistoryErrors(f.session,final),[]);
 for(const[file,value]of retained)assert.deepEqual(await readFile(file),value);
 const result=await f.resolvedWaitingAttemptKeys(f.root,f.session,final,{requireSuccessorTerminal:true});
 assert.deepEqual(result.errors,[]);assert.deepEqual([...result.retired].sort(),keys);assert.deepEqual([...result.settled],[]);
 const {goalLedger}=await f.load('scripts/validate-session.mjs');
 const ledger=await goalLedger(f.session,final,f.root);
 assert.equal(ledger.some(row=>row.achieved),false,'neither historical waiting parents nor the old matched KEEP successor prove the corrected mission');
});
