import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const source = path.resolve(import.meta.dirname, '..');
const sha = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const put = async (file, value) => { await mkdir(path.dirname(file), {recursive:true}); await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value)); };
const table = (heading, columns, rows) => `\n## ${heading}\n\n| ${columns.join(' | ')} |\n| ${columns.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n`;

import { fixture } from './nested-return-fixture.mjs';

async function replacementLifecycle(f, flags) {
 const state=await f.read(),before=await readFile(path.join(f.branch('3/1'),'response/response.json'));
 const preview=await f.plans.previewRevision(f.root,f.session,flags);
 await f.plans.commitRevision(f.root,f.session,{previewHash:preview.previewHash,flags,reason:'The independently reviewed candidate was returned; repair under the same scope.'});
 const after=await f.read(),cell=after.current;assert.equal(cell,'4/1');
 const pending=await f.resolvedWaitingAttemptKeys(f.root,f.session,after);
 assert.deepEqual(pending.errors,[]);assert.equal(pending.settled.has('3/1'),false,'a sealed forecast is not executed proof');
 assert.match((await f.resolvedWaitingAttemptKeys(f.root,f.session,after,{requireSuccessorTerminal:true})).errors.join(),/no terminal accepted successor/);
 const request={...structuredClone(f.parent),step:4,resume:{step:3,parallel:1,token:'returned-review'},attempt:{id:'4/1:a3',number:3,kind:'repair',previous:f.parent.attempt.id}};request.environment.isolationId=request.attempt.id;
 if (flags.edit.integrity) {
  const invalid={...request,inputs:{'independent-critique':flags.edit.integrity.ref}};
  await put(path.join(f.branch('4/1'),'request/request.json'),invalid);
  await assert.rejects(f.openAttempt(f.branch('4/1')),/input|kind|declared/i,'a disclosure is never review approval or typed delivery evidence');
  assert.equal((await f.read()).attempts['4/1'],undefined);
 }
 const dir=await f.waiting(request);
 await assert.rejects(f.acquireWorkerSlot(f.branch('3/1'),'old-author',{resume:true,ranProfile:'sol-reviewer'}),/PLAN_SUPERSEDED/);
 assert.equal((await f.resolvedWaitingAttemptKeys(f.root,f.session,await f.read())).settled.has('3/1'),false);
 await assert.rejects(f.acquireWorkerSlot(dir,'fresh-author',{resume:true,ranProfile:'sol-reviewer'}),/cannot resume until/);
 await put(path.join(dir,'response/response.md'),f.files['response/response.md']);
 const concluded=f.actual(request,{...f.files['response/response.json'],fields:{...f.files['response/response.json'].fields,restatement:'response/restatement.md'}},'done',['response/response.md']);
 const waitingBytes=await readFile(path.join(dir,'response/response.json'));
 await put(path.join(dir,'response/response.json'),concluded);
 await assert.rejects(f.acceptAttempt(dir),/critique|exchange/,'no fresh independent review means no completed architecture');
 await rm(path.join(dir,'response/response.md'));
 await writeFile(path.join(dir,'response/response.json'),waitingBytes);
 await f.review(request,'keep');
 const lease=await f.acquireWorkerSlot(dir,'fresh-author',{resume:true,ranProfile:'sol-reviewer'});
 await put(path.join(dir,'response/response.md'),f.files['response/response.md']);
 await put(path.join(dir,'response/response.json'),f.actual(request,{...f.files['response/response.json'],fields:{...f.files['response/response.json'].fields,restatement:'response/restatement.md'}},'done',['response/response.md']));
 assert.equal((await f.acceptAttempt(dir)).state,'matched');
 assert.equal((await f.resolvedWaitingAttemptKeys(f.root,f.session,await f.read(),{requireSuccessorTerminal:true})).settled.has('3/1'),true);
 assert.deepEqual(await readFile(path.join(f.branch('3/1'),'response/response.json')),before);
 assert.deepEqual((await f.read()).attempts['3/1'],state.attempts['3/1']);
 assert.deepEqual(f.plans.planHistoryErrors(f.session,await f.read()),[]);
}

test('accepted nested return creates a fresh parent and review without rewriting either sealed checkpoint',async t=>{
 await replacementLifecycle(await fixture(t),{edit:{kind:'resume',cell:'3/1'}});
});

test('integrity disclosure preserves questioned proof and its completed replacement permits the next answered reading to replan',async t=>{
 const f=await fixture(t,{followupReading:true}),state=await f.read();
 const binding=await f.waitingReviewBinding(f.root,f.session,state,'3/1');
 const disclosure={version:1,identity:binding.identity,disposition:'fresh-review-required',reason:'The owning reviewer disclosed an estimated observation timestamp. Preserve the admitted concern and collect a fresh independent review.',sourceRef:'owner:actual-integrity-admission'};
 const file=path.join(f.session,'support/integrity-disclosure.json');
 const flags={edit:{kind:'resume',cell:'3/1',integrity:{ref:'support/integrity-disclosure.json',hash:sha(JSON.stringify(disclosure))}}};
 await put(file,disclosure);
 assert.equal((await f.waitingReviewBinding(f.root,f.session,state,'3/1',flags.edit.integrity)).mode,'integrity');
 for(const mutate of [d=>{d.identity.parent.attemptId='foreign';},d=>{d.identity.child.evidenceFingerprint=sha('another review');},d=>{d.identity.missionVersion+=1;},d=>{d.disposition='approved';},d=>{d.approval=true;},d=>{delete d.reason;}]) {
  const changed=structuredClone(disclosure);mutate(changed);await put(file,changed);
  await assert.rejects(f.waitingReviewBinding(f.root,f.session,state,'3/1',{...flags.edit.integrity,hash:sha(JSON.stringify(changed))}),/REVIEW_REENTRY_UNBOUND/);
 }
 await put(file,{...disclosure,reason:'Changed after the digest was recorded.'});
 await assert.rejects(f.waitingReviewBinding(f.root,f.session,state,'3/1',flags.edit.integrity),/digest changed/);
 await put(file,disclosure);
 await replacementLifecycle(f,flags);
 const active=JSON.parse(await readFile(path.join(f.session,(await f.read()).planHistory.active.ref)));
 assert.equal(active.forecast.reviewResumes['4/1'].disclosure.bytes,JSON.stringify(disclosure));
 assert.equal(active.forecast.reviewResumes['4/1'].mode,'integrity');
 assert.equal((await f.read()).mission.version,state.mission.version);
 const {missionCorrectionBusy}=await f.load('scripts/session-open.mjs');
 const completed=await f.read();
 assert.equal(await missionCorrectionBusy(f.session,completed),false,'the preserved waiting parent is settled by its terminal accepted replacement');
 const originalState=await readFile(path.join(f.session,'state.json'));
 await assert.rejects(f.plans.previewRevision(f.root,f.session,{edit:{kind:'resume',cell:'3/1'}}),/exactly one recorded successor/);
 assert.deepEqual(await readFile(path.join(f.session,'state.json')),originalState,'a duplicate successor is refused before any session mutation');
 for(const change of [s=>{s.attempts['4/1'].id='forged';},s=>{delete s.attempts['4/1'].evidenceManifest;},s=>{s.attempts['4/1'].status='waiting';},s=>{s.attempts['4/1'].status='running';},s=>{s.workerSlots=[{attemptId:'active'}];},s=>{s.leases={active:{}};}]){const altered=structuredClone(completed);change(altered);assert.equal(await missionCorrectionBusy(f.session,altered),true);}
 const terminalFile=path.join(f.branch('4/1'),'response/response.json'),terminalBytes=await readFile(terminalFile);
 await put(terminalFile,{...JSON.parse(terminalBytes),status:'waiting'});assert.equal(await missionCorrectionBusy(f.session,completed),true);await writeFile(terminalFile,terminalBytes);
 const reading={...structuredClone(f.first),step:5,requirements:active.forecast.presets['5/1'],attempt:{id:'5/1:a1',number:1,kind:'initial',previous:null}};reading.environment.isolationId=reading.attempt.id;
 const dir=f.branch('5/1'),text=f.text.replace('restatement — entitlement-read-path','restatement — second-read-path');
 const decisionId=f.restatementDecisionId(reading,'second-read-path',text);
 await put(path.join(dir,'request/request.json'),reading);await f.openAttempt(dir);await put(path.join(dir,'response/restatement.md'),text);
 await put(path.join(dir,'response/response.json'),f.actual(reading,{schemaVersion:9,operatorId:'architecture.decide',stop:'RESTATEMENT_UNCONFIRMED',fields:{restatement:'response/restatement.md'},fallbacks:[],commits:[],next:[],interaction:{kind:'restatement-confirm',decisionId,options:[{id:'as-stated',label:'As stated',tradeoff:'Use this reading'},{id:'corrected',label:'Corrected',tradeoff:'Correct this reading'}]}},'blocked',['response/restatement.md']));
 await f.acceptAttempt(dir);await f.recordRestatementChoice(dir,{selected:'as-stated',selectedBy:'user',sourceRef:'user:second-current-reading'});
 const nextFlags={edit:{kind:'resume',cell:'5/1'}},preview=await f.plans.previewRevision(f.root,f.session,nextFlags);
 await f.plans.commitRevision(f.root,f.session,{previewHash:preview.previewHash,flags:nextFlags,reason:'The next current reading was answered; continue its declared architecture work.'});
 const replanned=await f.read();assert.equal(replanned.current,'6/1');assert.deepEqual(replanned.attempts['3/1'],state.attempts['3/1']);assert.deepEqual(replanned.attempts['4/1'],completed.attempts['4/1']);assert.deepEqual(f.plans.planHistoryErrors(f.session,replanned),[]);
});

test('a keep verdict cannot impersonate a return and forged or stale review identities cannot authorize re-entry',async t=>{
 const f=await fixture(t,{selection:'keep'}),state=await f.read();
 await assert.rejects(f.waitingReviewBinding(f.root,f.session,state,'3/1'),/does not select the declared return/);
 for(const change of [s=>{s.attempts['3/1'].status='running';},s=>{delete s.attempts['3/1'].evidenceManifest;},s=>{s.attempts['3/1/critique'].id='forged';},s=>{s.requestHashes['3/1/critique']=sha('wrong');},s=>{s.attempts['3/1/critique'].expected.goalVersion+=1;},s=>{delete s.attempts['3/1/critique'].context;}]) {
  const altered=structuredClone(state);change(altered);
  await assert.rejects(f.waitingReviewBinding(f.root,f.session,altered,'3/1'));
 }
});

test('successive returned reviews admit only their verified waiting ancestors and settle after a fresh keep',async t=>{
 const f=await fixture(t,{followupReading:true});
 const {missionCorrectionBusy}=await f.load('scripts/session-open.mjs');
 const original=await f.read(),originalBytes=await readFile(path.join(f.branch('3/1'),'response/response.json'));
 async function commitReturn(cell) {
  const flags={edit:{kind:'resume',cell}},preview=await f.plans.previewRevision(f.root,f.session,flags);
  return f.plans.commitRevision(f.root,f.session,{flags,previewHash:preview.previewHash,reason:'The exact fresh review returned this candidate; repair under its existing confirmed scope.'});
 }
 await commitReturn('3/1');
 const second={...structuredClone(f.parent),step:4,resume:{step:3,parallel:1,token:'returned-review'},attempt:{id:'4/1:a3',number:3,kind:'repair',previous:f.parent.attempt.id}};second.environment.isolationId=second.attempt.id;
 await f.waiting(second);await f.review(second,'return');
 const waiting=await f.read(),waitingBytes=await readFile(path.join(f.branch('4/1'),'response/response.json'));
 const transaction={waitingReentry:{source:'4/1'}};
 const normal=await f.resolvedWaitingAttemptKeys(f.root,f.session,waiting);
 assert.deepEqual(normal.errors,[]);assert.deepEqual([...normal.settled],[]);
 assert.equal(await missionCorrectionBusy(f.session,waiting),true);
 assert.equal(await missionCorrectionBusy(f.session,waiting,transaction),false);
 const admission=await f.resolvedWaitingAttemptKeys(f.root,f.session,waiting,{reentry:{source:'4/1'}});
 assert.deepEqual([...admission.reentering].sort(),['3/1','4/1']);assert.deepEqual([...admission.settled],[],'admission never credits completion');
 for(const change of [s=>{s.attempts['3/1'].id='forged';},s=>{delete s.attempts['3/1'].evidenceManifest;},s=>{s.requestHashes['3/1/critique']=sha('wrong');},s=>{s.attempts['99/1']={...s.attempts['4/1'],id:'unrelated'};},s=>{s.workerSlots=[{attemptId:'active'}];},s=>{s.leases={active:{}};},s=>{s.resumes['99/1']={resumes:'3/1',stop:'CRITIQUE_UNRESOLVED'};}]) {
  const changed=structuredClone(waiting);change(changed);assert.equal(await missionCorrectionBusy(f.session,changed,transaction),true);
 }
 await put(path.join(f.branch('3/1'),'response/response.json'),{...JSON.parse(originalBytes),operatorId:'business.decide'});
 assert.equal(await missionCorrectionBusy(f.session,waiting,transaction),true);
 await writeFile(path.join(f.branch('3/1'),'response/response.json'),originalBytes);
 const before=await readFile(path.join(f.session,'state.json'));
 await assert.rejects(commitReturn('3/1'),/exactly one recorded successor|PLAN_BUSY/);
 assert.deepEqual(await readFile(path.join(f.session,'state.json')),before);
 await commitReturn('4/1');
 const third={...structuredClone(second),step:5,resume:{step:4,parallel:1,token:'returned-review'},attempt:{id:'5/1:a4',number:4,kind:'repair',previous:second.attempt.id}};third.environment.isolationId=third.attempt.id;
 const dir=await f.waiting(third);await f.review(third,'keep');
 assert.deepEqual([...(await f.resolvedWaitingAttemptKeys(f.root,f.session,await f.read())).settled],[]);
 await f.acquireWorkerSlot(dir,'third-author',{resume:true,ranProfile:'sol-reviewer'});
 await put(path.join(dir,'response/response.md'),f.files['response/response.md']);
 await put(path.join(dir,'response/response.json'),f.actual(third,{...f.files['response/response.json'],fields:{...f.files['response/response.json'].fields,restatement:'response/restatement.md'}},'done',['response/response.md']));
 assert.equal((await f.acceptAttempt(dir)).state,'matched');
 const completed=await f.read(),resolved=await f.resolvedWaitingAttemptKeys(f.root,f.session,completed,{requireSuccessorTerminal:true});
 assert.deepEqual(resolved.errors,[]);assert.deepEqual([...resolved.settled].sort(),['3/1','4/1']);
 assert.equal(await missionCorrectionBusy(f.session,completed),false);
 const active=JSON.parse(await readFile(path.join(f.session,completed.planHistory.active.ref)));
 const reading={...structuredClone(f.first),step:6,requirements:active.forecast.presets['6/1'],attempt:{id:'6/1:a1',number:1,kind:'initial',previous:null}};reading.environment.isolationId=reading.attempt.id;
 const readingDir=f.branch('6/1'),text=f.text.replace('restatement — entitlement-read-path','restatement — second-read-path'),decisionId=f.restatementDecisionId(reading,'second-read-path',text);
 await put(path.join(readingDir,'request/request.json'),reading);await f.openAttempt(readingDir);await put(path.join(readingDir,'response/restatement.md'),text);
 await put(path.join(readingDir,'response/response.json'),f.actual(reading,{schemaVersion:9,operatorId:'architecture.decide',stop:'RESTATEMENT_UNCONFIRMED',fields:{restatement:'response/restatement.md'},fallbacks:[],commits:[],next:[],interaction:{kind:'restatement-confirm',decisionId,options:[{id:'as-stated',label:'As stated',tradeoff:'Use this reading'},{id:'corrected',label:'Corrected',tradeoff:'Correct this reading'}]}},'blocked',['response/restatement.md']));
 await f.acceptAttempt(readingDir);await f.recordRestatementChoice(readingDir,{selected:'as-stated',selectedBy:'user',sourceRef:'user:second-current-reading'});
 const flags={edit:{kind:'resume',cell:'6/1'}},preview=await f.plans.previewRevision(f.root,f.session,flags);
 await f.plans.commitRevision(f.root,f.session,{flags,previewHash:preview.previewHash,reason:'The unrelated later reading was answered; continue its own current work.'});
 const final=await f.read();assert.equal(final.current,'7/1');
 assert.deepEqual(final.attempts['3/1'],original.attempts['3/1']);assert.deepEqual(final.attempts['4/1'],waiting.attempts['4/1']);
 assert.deepEqual(await readFile(path.join(f.branch('3/1'),'response/response.json')),originalBytes);assert.deepEqual(await readFile(path.join(f.branch('4/1'),'response/response.json')),waitingBytes);
 assert.deepEqual(f.plans.planHistoryErrors(f.session,final),[]);
});
