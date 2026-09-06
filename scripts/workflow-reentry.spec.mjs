import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, rmSync, rmdirSync, cpSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { workspaceCheckoutFixture, fixtureGit as git } from './workspace-checkout-fixture.mjs';
import { openSession, confirmSession } from './session-open.mjs';
import { discoveryFor, answerFor } from './v23-test-fixture.mjs';
import { openAttempt, acceptAttempt } from './attempt-gate.mjs';
import { retainContext } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { previewRevision, commitRevision, planHistoryErrors, planAdmissionErrors } from './plan-history.mjs';
import { resolveWorkspaceCheckout, installedTreeOf, reflogEntries } from './workspace-checkout.mjs';
import { validateStep } from './validate-step.mjs';
import { sealedWorkspaceBindingErrors, attemptProgressErrors } from './validate-request.mjs';
import { baseline, confirmed } from '../operators/architecture-decide/self-test.mjs';
const sha = x => 'sha256:' + createHash('sha256').update(x).digest('hex');
const table = (title, columns, rows=[]) => `\n## ${title}\n\n| ${columns.join(' | ')} |\n| ${columns.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n`;

async function fixture(t,{backend=false}={}) {
 const f=workspaceCheckoutFixture({attachRuntime:true});t.after(()=>f.dispose());
 cpSync(import.meta.dirname,path.join(f.runtime,'scripts'),{recursive:true});
 // Module identity carries the admission phase. Copy executable operators too; a junction back
 // to this test runtime would create two independent AsyncLocalStorage phase owners.
 rmdirSync(path.join(f.runtime,'operators'));cpSync(path.resolve(import.meta.dirname,'../operators'),path.join(f.runtime,'operators'),{recursive:true});
 const gate=await import(pathToFileURL(path.join(f.runtime,'scripts/attempt-gate.mjs')).href);
 f.plans=await import(pathToFileURL(path.join(f.runtime,'scripts/plan-history.mjs')).href);
 f.validation=await import(pathToFileURL(path.join(f.runtime,'scripts/validate-step.mjs')).href);
 f.write(path.join(f.source,'.workspaces/projects/fixture/workflow.json'),{version:1,project:f.project,ownerRole:f.role});
 const discovery=discoveryFor(f.project,{head:f.baseHead});discovery.repositories[0].repository=f.origin;
 const opened=await openSession(path.join(f.canonical,'.worktrees/sessions'),{sessionId:f.sessionId,project:f.project,hostBinding:{kind:'codex-task',hostId:'reentry-'+path.basename(f.temporary),worktree:f.selected,sourcePromptRef:'user:fixture'},mission:{language:'en',goal:'Verify the bounded fixture result.',target:'The declared fixture boundary',includes:['Fixture implementation and verification'],excludes:[],outputs:['Fixture result'],doneWhen:[{producedBy:backend?'backend.generate':'data.plan',evidence:'The bounded fixture result is verified.'}],verification:'Validate the complete typed result.',sourceRef:'user:fixture',discovery}}, {sourceRoot:f.source});
 f.session=opened.session;f.stateFile=path.join(f.session,'state.json');f.state=()=>JSON.parse(readFileSync(f.stateFile));f.save=s=>f.write(f.stateFile,s);f.branch=cell=>path.join(f.session,`step-${cell.split('/')[0]}/parallel-${cell.split('/')[1]}`);
 await confirmSession(f.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved-fixture',authority:answerFor(f.state().mission,'user:approved-fixture')},{root:f.runtime});
 f.request=(cell,operatorId,requirements,contexts=[],goal={doneWhen:0})=>{const [step,parallel]=cell.split('/').map(Number);return{contractVersion:'starci/v2.2',schemaVersion:9,sessionId:f.sessionId,operatorId,step,parallel,contexts,requirements,inputs:{},resume:null,goal,attempt:{id:cell+':a1',number:1,kind:'initial',previous:null},expected:{version:1,goalVersion:1,sourceRef:`state.json#mission:v1/${goal.prerequisite?'prerequisite:'+goal.prerequisite:'doneWhen:'+goal.doneWhen}`,criteria:[{id:'bounded',required:true,expected:'The bounded fixture result is proved.',verification:'Read the typed fixture evidence.'}]},environment:{isolationId:cell+':a1',mode:operatorId==='workspace.bind'?'inline':'isolated',workspace:null,reads:contexts.map(c=>c.alias),writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]};};
 f.response=(r,status,fields)=>{const evidence=Object.values(fields),matched=status==='done',verdict=matched?'matched':status==='mismatch'?'mismatched':'inconclusive';return{contractVersion:'starci/v2.2',schemaVersion:9,operatorId:r.operatorId,step:r.step,parallel:r.parallel,status,fields,fallbacks:[],commits:[],next:[],boundProfile:r.operatorId==='workspace.bind'?'sol-fresh':'sol-reviewer',ranProfile:r.operatorId==='workspace.bind'?'sol-fresh':'sol-reviewer',attempt:{id:r.attempt.id,number:r.attempt.number,expectedVersion:r.expected.version},actual:{expectedVersion:r.expected.version,observedAt:new Date().toISOString(),observations:[{criterionId:'bounded',observed:matched?'The bounded fixture result is recorded.':'The fixture result remains unproved.',evidence}]},comparison:{expectedVersion:r.expected.version,verdict,criteria:[{criterionId:'bounded',verdict,evidence,note:'Actual test fixture acceptance, not product proof.'}],next:matched?'advance':status==='blocked'?'blocked':'repair'},...(matched?{goalCheck:{achieved:true,evidence},outcome:{summary:'The bounded fixture result is recorded.',primary:{kind:'document',label:'Fixture result',ref:evidence[0]}}}:{})};};
 f.open=async r=>{f.write(path.join(f.branch(`${r.step}/${r.parallel}`),'request/request.json'),r);return gate.openAttempt(f.branch(`${r.step}/${r.parallel}`));};
 f.accept=async(r,response)=>{f.write(path.join(f.branch(`${r.step}/${r.parallel}`),'response/response.json'),response);return gate.acceptAttempt(f.branch(`${r.step}/${r.parallel}`));};
 const bind=f.request('1/1','workspace.bind',{project:f.project,role:f.role,checkout:'session',declaredWriteRoots:['src'],sharedInstall:false,gitPolicy:{mutationBranch:'main',worktreeBranches:'session-only'}},[{alias:`@workspaces/projects/${f.project}/be`,head:null},{alias:`@workspaces/local/routes/${f.project}/be`,head:null},{alias:'@workspaces/device-state',head:null}],{prerequisite:'2/1'});
 let state=f.state();state.chain=[['1/1'],['2/1']];state.steps={'1/1':'workspace.bind','2/1':'data.plan'};state.current='1/1';f.save(state);
 await f.open(bind);await acceptBind(f,bind);f.bind=bind;
 f.load=file=>import(pathToFileURL(path.join(f.runtime,file)).href);
 return f;
}

async function architecture(f) {
 const {restatementDecisionId,recordRestatementChoice}=await f.load('scripts/restatement-choice.mjs'),{acquireWorkerSlot}=await f.load('scripts/worker-slots.mjs');
 const [files]=confirmed(baseline()),template=structuredClone(files['request/request.json']);delete template.decisionId;delete template.selectedOption;template.requirements.resume=null;template.contexts[0].head=f.sessionHead;
 const operation={operationId:'fixture-worker',name:'runFixtureWorker',transport:'worker',writerRef:'src/worker.mjs',storeRefs:[],transactionBoundary:'read-only',idempotencyKind:'none',migrationRefs:[],authorityDimensionIds:['deterministic-value']};
 files['response/data/stack-model.json'].operations=[operation];
 files['response/response.md']=files['response/response.md'].replace(/## Operations[\s\S]*?(?=## Handoff)/,table('Operations',['Operation','Transport','Writer','Stores','Transaction','Idempotency','Dimensions'],[[operation.operationId,'worker',operation.writerRef,'—','read-only','none','deterministic-value']])+'\n');
 let state=f.state();state.chain=[['1/1'],['2/1'],['3/1'],['4/1']];state.steps={'1/1':'workspace.bind','2/1':'architecture.decide','3/1':'architecture.decide','4/1':'backend.generate'};state.current='2/1';f.save(state);
 const reading={...template,...f.request('2/1','architecture.decide',template.requirements,template.contexts,{prerequisite:'4/1'})};
 await f.open(reading);const text=files['response/restatement.md'],id=restatementDecisionId(reading,template.requirements.decisionId,text);
 f.write(path.join(f.branch('2/1'),'response/restatement.md'),text);
 const refusal=f.response(reading,'blocked',{restatement:'response/restatement.md'});refusal.stop='RESTATEMENT_UNCONFIRMED';refusal.interaction={kind:'restatement-confirm',decisionId:id,options:[{id:'as-stated',label:'As stated',tradeoff:'Use this reading'},{id:'corrected',label:'Corrected',tradeoff:'Correct this reading'}]};
 await f.accept(reading,refusal);await recordRestatementChoice(f.branch('2/1'),{selected:'as-stated',selectedBy:'user',sourceRef:'user:fixture-reading'});
 const parent={...structuredClone(reading),step:3,decisionId:id,selectedOption:'as-stated',requirements:{...reading.requirements,resume:id},resume:{step:2,parallel:1,token:id},attempt:{id:'3/1:a2',number:2,kind:'repair',previous:reading.attempt.id}};parent.environment.isolationId=parent.attempt.id;
 state=f.state();state.resumes={'3/1':{resumes:'2/1',stop:'RESTATEMENT_UNCONFIRMED'}};f.save(state);await f.open(parent);
 for(const ref of ['response/restatement.md','response/data/current-state.json','response/data/stack-model.json'])f.write(path.join(f.branch('3/1'),ref),files[ref]);
 const waiting=f.response(parent,'waiting',{restatement:'response/restatement.md','current-state':'response/data/current-state.json','stack-model':'response/data/stack-model.json'});waiting.awaiting={exchange:'critique',kind:'independent-critique'};waiting.comparison.next='retry';await f.accept(parent,waiting);
 const child={...f.request('3/1','architecture.decide',{},files['critique/request/request.json'].contexts),exchange:'critique',inputs:{'stack-model':'step-3/parallel-1/response/data/stack-model.json'}};delete child.goal;child.attempt={id:'3/1/critique:a1',number:1,kind:'initial',previous:null};child.expected.sourceRef='step-3/parallel-1/response/data/stack-model.json';child.environment.isolationId=child.attempt.id;
 const childDir=path.join(f.branch('3/1'),'critique'),gate=await f.load('scripts/attempt-gate.mjs');f.write(path.join(childDir,'request/request.json'),child);await gate.openAttempt(childDir);f.write(path.join(childDir,'response/critique.md'),files['critique/response/critique.md']);
 const reviewed=f.response(child,'done',{'independent-critique':'response/critique.md'});reviewed.exchange='critique';delete reviewed.goalCheck;f.write(path.join(childDir,'response/response.json'),reviewed);await gate.acceptAttempt(childDir);
 await acquireWorkerSlot(f.branch('3/1'),'fixture-author',{resume:true,ranProfile:'sol-reviewer'});
 f.write(path.join(f.branch('3/1'),'response/response.md'),files['response/response.md']);
 const done=f.response(parent,'done',{...files['response/response.json'].fields,restatement:'response/restatement.md'});delete done.goalCheck;await f.accept(parent,done);
 return{reading,parent,files};
}

async function freezeForecast(f) {
 const state=f.state(),forecast={chain:state.chain,steps:state.steps,goals:{},presets:{},nodes:{},dependencies:{},evidenceDependencies:{},reasons:{},imports:{},fanout:{},handoffs:{},resumes:{}};
 for(const cell of state.chain.flat()) {const r=JSON.parse(readFileSync(path.join(f.branch(cell),'request/request.json')));forecast.goals[cell]=r.goal;forecast.presets[cell]=r.requirements;forecast.nodes[cell]=cell;forecast.dependencies[cell]=cell==='1/1'?[]:['1/1'];forecast.evidenceDependencies[cell]=[];if(r.resume)forecast.resumes[cell]=`${r.resume.step}/${r.resume.parallel}`;}
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const address=await retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:1,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:address,revisions:[address]};f.save(state);
}

for (const scenario of ['source-history','source-proof-review','wrong-stop']) test(`${scenario}: sealed source correction and refusal lifecycle`,async t=>{
 const correction=scenario==='wrong-stop'?'source-proof-review':scenario;
 const f=await fixture(t,{backend:true}),a=await architecture(f),model=a.files['response/data/stack-model.json'];
 const contexts=[{alias:'@workspaces/be',head:f.sessionHead},{alias:'@knowledge/patterns/be',head:null}];
 const request=f.request('4/1','backend.generate',{featureId:'fixture',outcome:'Implement the bounded fixture contract.',mutableFileRefs:['src/**'],protectedRefs:['outside.md'],contractFingerprint:sha(readFileSync(path.join(f.branch('3/1'),'response/data/stack-model.json'))),mode:'apply',scope:'full',resume:null},contexts);
 request.inputs={'architecture-decision':'step-3/parallel-1/response/response.md'};request.environment.workspace={alias:'@workspaces/be',worktree:f.selected,revision:f.sessionHead};request.environment.writes=['@workspaces/be/branch/session/src','response'];request.environment.exclusive=[f.selected];
 const oldMethod='Check the preexisting fixture behavior without the newly identified invalid-input regression.';
 if(correction==='source-proof-review') {
   f.write(path.join(f.branch('4/1'),'request/artifacts/old-method.md'),oldMethod);request.frozenInputs=[{ref:'request/artifacts/old-method.md',sha256:sha(oldMethod)}];
   request.expected.criteria.push({id:'optional',required:false,expected:'Optional fixture observation.',verification:'Read optional evidence.'},{id:'already-passed',required:true,expected:'The fixture source window is readable.',verification:'Read the actual source window.'});
   const originalResponse=f.response;f.response=(r,status,fields)=>{const response=originalResponse(r,status,fields);for(const criterion of r.expected.criteria.filter(c=>c.id!=='bounded')){const evidence=['response/changes.md'];response.actual.observations.push({criterionId:criterion.id,observed:'The retained fixture evidence was inspected.',evidence});response.comparison.criteria.push({criterionId:criterion.id,verdict:status==='done'||criterion.id==='already-passed'?'matched':'inconclusive',evidence,note:'Actual runtime fixture evidence.'});}return response;};
 }
 await f.open(request);
 const count=()=>reflogEntries(f.selected).length,before=count(),base=git(f.selected,'rev-parse','HEAD');
 f.write(path.join(f.selected,'src/model.txt'),'A real fixture implementation.\n');git(f.selected,'add','src/model.txt');git(f.selected,'commit','-m','Implement fixture');
 if(correction==='source-history'){f.write(path.join(f.selected,'src/model.txt'),'A real fixture implementation with corrected guard.\n');git(f.selected,'add','src/model.txt');git(f.selected,'commit','--amend','--no-edit');}const head=git(f.selected,'rev-parse','HEAD');
 const changes=`# changes — backend.generate step-4/parallel-1\n`+table('Binding',['Field','Value'],[['Operator','backend.generate'],['Step','4/1'],['Checkout',`@workspaces/be at ${base} → ${head} on session/${f.sessionId}`],['Predecessor',request.inputs['architecture-decision']],['Preflight','passed at '+new Date().toISOString()],['Reflog before',`HEAD ${before} ${base}; stash 0`],['Reflog after',`HEAD ${count()} ${head}; stash 0`]])+table('Files',['Path','Change','Why','Claims'],[['src/model.txt','modified','Implement fixture','bounded']])+'\n## What the next step must know\n\nThe rejected window is preserved; reverify at the current head.\n';
 f.write(path.join(f.branch('4/1'),'response/changes.md'),changes);const response=f.response(request,'blocked',{changes:'response/changes.md'});response.boundProfile=response.ranProfile='sol-fresh';response.stop=scenario==='wrong-stop'?'SOURCE_DRIFT':'INVALID_INPUT';response.reason=correction==='source-history'?'The observed amend makes the old source window inadmissible.':'A required regression remains unproved after the single source commit; preserve it and correct the proof in a fresh source invocation.';await f.accept(request,response);
 let retryStep=5;
 if(scenario==='source-proof-review') {
  // Independent admitted work may advance the same checkout while the failed proof is retained.
  const independent=structuredClone(request);independent.step=5;independent.attempt={id:'5/1:a1',number:1,kind:'initial',previous:null};independent.environment.isolationId=independent.attempt.id;independent.environment.workspace.revision=head;independent.contexts[0].head=head;independent.frozenInputs=[];
  const state=f.state();state.chain.push(['5/1']);state.steps['5/1']='backend.generate';state.current='5/1';f.save(state);
  await f.open(independent);await completeWorker(f,independent,model.operations[0]);assert.equal(f.state().attempts['5/1'].status,'matched');
  // A normal upstream merge is an ancestry-preserving base change, not this retry's source credit.
  const upstream=path.join(f.temporary,'upstream');git(f.canonical,'worktree','add','-b','fixture-upstream',upstream,'HEAD');
  f.write(path.join(upstream,'src/upstream.txt'),'Independent upstream fixture content.\n');git(upstream,'add','src/upstream.txt');git(upstream,'commit','-m','Independent upstream fixture');
  git(f.selected,'merge','--no-ff','-m','Integrate normal upstream fixture','fixture-upstream');
  retryStep=6;
 }
 await freezeForecast(f);const revision=git(f.selected,'rev-parse','HEAD');
 const review={criterionId:'bounded',methodRef:'request/artifacts/proof-review-method.md'};
 const flags={edit:{kind:'retry',cell:'4/1',correction,revision,...(correction==='source-proof-review'?review:{})}};
 if(scenario==='wrong-stop'){await assert.rejects(f.plans.previewRevision(f.runtime,f.session,flags),/no generic retry/);return;}
 const preview=await f.plans.previewRevision(f.runtime,f.session,flags);
 if(correction==='source-proof-review') {
  await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,cell:'2/1'}}),/interaction.*owning resolution gate/);
  for(const criterionId of [undefined,'missing','optional','already-passed']) await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,criterionId}}),/required nonpassing criterion/);
  for(const methodRef of [undefined,'../method.md','response/method.md','request/../method.md','request/request.json']) await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,methodRef}}),/method artifact/);
  await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,correction:'source-history'}}),/does not establish a failed technical window/);
  await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,revision:head}}),/PLAN_RETRY_STALE/);
  const branchRef=git(f.selected,'rev-parse','--path-format=absolute','--git-path',`refs/heads/session/${f.sessionId}`),branchBytes=readFileSync(branchRef);
  try{writeFileSync(branchRef,base+'\n');await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,revision:base}}),/retain the original committed source by ancestry/);}finally{writeFileSync(branchRef,branchBytes);}
 } else await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,correction:'source-proof-review',...review}}),/normal one-commit/);
 await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,revision:base}}),/PLAN_RETRY_STALE/);
 await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{kind:'retry',cell:'4/1'}}),/no generic retry/);
 const failureFile=path.join(f.branch('4/1'),'response/changes.md');writeFileSync(failureFile,changes+'Altered failure');
 await assert.rejects(f.plans.previewRevision(f.runtime,f.session,flags),/changed|fingerprint/);writeFileSync(failureFile,changes);
 // Git may fall back from an empty worktree HEAD log to the current branch log. Remove both
 // observations inside this disposable repository, then restore the exact original bytes.
 const logs=['logs/HEAD',`logs/refs/heads/session/${f.sessionId}`].map(ref=>git(f.selected,'rev-parse','--path-format=absolute','--git-path',ref));
 const logBytes=logs.map(file=>readFileSync(file));for(const file of logs)writeFileSync(file,'');
 try { assert.equal(reflogEntries(f.selected).length,0);await assert.rejects(f.plans.previewRevision(f.runtime,f.session,flags),/window must remain readable|keeps no HEAD reflog/); }
 finally { logs.forEach((file,index)=>writeFileSync(file,logBytes[index])); }
 await f.plans.commitRevision(f.runtime,f.session,{flags,previewHash:preview.previewHash,reason:'Retain the rejected amend and independently reverify the current checkout under the same scope.'});
 const retryCell=`${retryStep}/1`,retry={...structuredClone(request),step:retryStep,attempt:{id:retryCell+':a2',number:2,kind:'retry',previous:request.attempt.id}};retry.environment.isolationId=retry.attempt.id;retry.environment.workspace.revision=revision;retry.contexts[0].head=revision;
 if(correction==='source-proof-review') {
  await assert.rejects(f.open(retry),/NO_PROGRESS/);assert.equal(f.state().attempts[retryCell],undefined);
  f.write(path.join(f.branch(retryCell),review.methodRef),oldMethod);retry.frozenInputs=[{ref:review.methodRef,sha256:sha(oldMethod)}];await assert.rejects(f.open(retry),/NO_PROGRESS/);
  const method='Exercise real invalid and concurrent stateless worker inputs, preserve caller input, and run the Node regression before the new normal commit.';
  retry.frozenInputs=[{ref:review.methodRef,sha256:sha(method)}];await assert.rejects(f.open(retry),/request-side evidence changed/);assert.equal(f.state().attempts[retryCell],undefined);
  f.write(path.join(f.branch(retryCell),review.methodRef),method);
 }
 for(const change of [r=>{r.requirements.scope='fix';},r=>{r.environment.workspace.worktree=f.canonical;},r=>{r.environment.writes.push('@workspaces/fe');},r=>{r.goal={doneWhen:9};},r=>{r.unit='foreign';},r=>{r.environment.workspace.revision=base;}]) {const bad=structuredClone(retry);change(bad);assert.ok((await f.plans.planAdmissionErrors(f.runtime,f.session,f.state(),bad)).length);}
 assert.equal((await f.open(retry)).state,'opened');
 await completeWorker(f,retry,model.operations[0],{reviewCorrection:correction==='source-proof-review'});
 assert.notEqual(git(f.selected,'rev-parse','HEAD'),revision);
 // Revalidation uses the frozen invocation context, not a fresh comparison with its opening HEAD.
 assert.deepEqual((await (await f.load('scripts/validate-request.mjs')).validateRequest(f.runtime,f.branch(retryCell),undefined,{phase:'accept'})).errors,[]);
 f.write(path.join(f.selected,'src/later.txt'),'Later independently owned fixture work.\n');git(f.selected,'add','src/later.txt');git(f.selected,'commit','-m','Later fixture progress');f.write(path.join(f.selected,'outside.md'),'Unrelated later dirt.\n');
 assert.deepEqual((await f.validation.validateStep(f.runtime,f.branch(retryCell),{operator:true,requestPhase:'accept'})).errors,[]);
 assert.deepEqual(await (await f.load('scripts/validate-session.mjs')).v22SessionErrors(f.session,f.state(),f.runtime),[]);
 await f.plans.previewRevision(f.runtime,f.session,{roles:['be']});
 assert.deepEqual(readFileSync(path.join(f.branch('4/1'),'response/changes.md'),'utf8'),changes);
});

async function completeWorker(f,r,contract,{reviewCorrection=false}={}) {
 const dir=f.branch(`${r.step}/1`),base=r.environment.workspace.revision,branch=git(f.selected,'branch','--show-current'),before=reflogEntries(f.selected).length,preflight='passed at '+new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
 const files={'src/worker.mjs':"export function runFixtureWorker(input) { if (typeof input !== 'string') throw new TypeError('input must be a string'); return input.toUpperCase(); }\n",'src/worker.spec.mjs':"import test from 'node:test'; import assert from 'node:assert/strict'; import {runFixtureWorker as run} from './worker.mjs'; test('deterministic and concurrent value; invalid input stays unchanged', async()=>{ assert.equal(run('a'),'A'); assert.equal(run(''),''); assert.deepEqual(await Promise.all(['b','b'].map(v=>Promise.resolve(run(v)))),['B','B']); const input=Object.freeze({value:'x'}); for(const bad of [input,null,undefined,4]) assert.throws(()=>run(bad),TypeError); assert.equal(input.value,'x'); });\n"};
 if(reviewCorrection){delete files['src/worker.mjs'];files['src/worker.spec.mjs']+="test('Unicode case expansion and rejected symbol keep input untouched',()=>{assert.equal(run('straße'),'STRASSE'); const value=Symbol('input');assert.throws(()=>run(value),TypeError);assert.equal(value.description,'input');});\n";}
 const beforeBytes=Object.fromEntries(Object.keys(files).map(file=>{try{return[file,readFileSync(path.join(f.selected,file))]}catch{return[file,null]}}));
 for(const [file,bytes]of Object.entries(files))f.write(path.join(f.selected,file),bytes);
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST_'))),output=execFileSync(process.execPath,['--test','src/worker.spec.mjs'],{cwd:f.selected,encoding:'utf8',windowsHide:true,env});assert.match(output,reviewCorrection?/pass 2/:/pass 1/);
 git(f.selected,'add',...Object.keys(files));git(f.selected,'commit','-m','Implement and regress the admitted stateless fixture worker');const head=git(f.selected,'rev-parse','HEAD'),fingerprint=r.requirements.contractFingerprint;
 const facets=['writer','transaction','idempotency','exception-identity','concurrency'],operation={...contract,facets,proofKinds:['unit']},changes=Object.entries(files).map(([file,bytes])=>({path:file,change:beforeBytes[file]?'modified':'added',operationId:operation.operationId,beforeHash:beforeBytes[file]?sha(beforeBytes[file]):null,afterHash:sha(bytes)}));
 f.write(path.join(dir,'response/artifacts/unit.log'),output);f.write(path.join(dir,'response/data/mutations.json'),{mode:'apply',contractFingerprint:fingerprint,base,branch,commit:head,operations:[operation],changes});
 const conformance=facets.map(facet=>{const ref=`response/data/conformance/${operation.operationId}.${facet}.json`;f.write(path.join(dir,ref),{operationId:operation.operationId,facet,verdict:'conforms',evidenceRef:'response/artifacts/unit.log',statement:'The actual stateless worker tests exercise repeated, concurrent and invalid inputs with no persistent mutation.',contractFingerprint:fingerprint});return ref;});
 const proof=`response/data/proofs/${operation.operationId}.unit.json`;f.write(path.join(dir,proof),{operationId:operation.operationId,proofKind:'unit',commandRef:'node --test src/worker.spec.mjs',exitCode:0,result:'passed',output,statement:'The real fixture source test ran before the single normal commit.',contractFingerprint:fingerprint});
 const md='# backend-source-application — fixture\n'+table('Binding',['Field','Value'],[['Outcome',r.requirements.outcome],['Feature','fixture'],['Mode','apply'],['Contract fingerprint',fingerprint],['Base',base],['Branch',branch],['Commit',head]])+table('Operations',['Operation','Transport','Writer','Transaction','Idempotency','Decisions'],[[operation.operationId,operation.transport,operation.writerRef,operation.transactionBoundary,operation.idempotencyKind,operation.authorityDimensionIds.join(', ')]])+table('Changes',['Path','Change','Operation','Before','After'],changes.map(c=>[c.path,c.change,c.operationId,c.beforeHash??'—',c.afterHash]))+table('Widened',['Path','Nearest boundary','Why'])+table('Findings',['Code','Operation','File','Statement'],[['`PATTERN_BOUND`',operation.operationId,operation.writerRef,'The fixture uses dependency-free ESM and Node tests.']])+table('Fallbacks taken',['Code','Action']);f.write(path.join(dir,'response/response.md'),md);
 f.write(path.join(dir,'response/changes.md'),`# changes — backend.generate step-${r.step}/parallel-1\n`+table('Binding',['Field','Value'],[['Operator','backend.generate'],['Step',`step-${r.step}/parallel-1`],['Checkout',`@workspaces/be at ${base} → ${head} on ${branch}`],['Predecessor',r.inputs['architecture-decision']],['Preflight',preflight],['Reflog before',`HEAD ${before} ${base}; stash 0`],['Reflog after',`HEAD ${reflogEntries(f.selected).length} ${head}; stash 0`]])+table('Files',['Path','Change','Why','Claims'],changes.map(c=>[c.path,c.change==='added'?'created':'modified','Implement and exercise stateless fixture behavior.','deterministic-value']))+'\n## What the next step must know\n\nRun the same real Node test at this head.\n');
 const response=f.response(r,'done',{'backend-source-application':'response/response.md',changes:'response/changes.md',mutations:'response/data/mutations.json',conformance,proof:[proof]});response.actual.observations[0].evidence=['response/changes.md',proof];response.comparison.criteria[0].evidence=['response/changes.md',proof];response.goalCheck.evidence=['response/changes.md',proof];response.boundProfile=response.ranProfile='sol-fresh';response.commits=[head];response.outcome.primary={kind:'code',label:'Fixture correction',ref:'response/changes.md'};
 assert.equal((await f.accept(r,response)).state,'matched');
}

async function acceptBind(f,request) {
 const route={...resolveWorkspaceCheckout({source:f.source,project:f.project,role:f.role,sessionId:f.sessionId,checkout:'session',declaredWriteRoots:request.requirements.declaredWriteRoots}),identityFingerprint:sha('fixture-roster'),authorityRoots:{businesses:null},runtime:null,provenanceHeadRef:null};
 const c=route.checkout,dir=f.branch(`${request.step}/${request.parallel}`);
 const md=`# workspace-route-binding — ${f.project}/be\n`+table('Binding',['Field','Value'],[['Project',f.project],['Role','be'],['Portable route',route.portableRouteRef],['Hydrated route',route.hydratedRouteRef],['Source head',route.sourceHead]])+table('Checkout',['Field','Value'],[['Disk path',c.diskPath],['Git root',c.gitRoot],['Git repository',c.gitRepository],['Branch',c.branch],['Repository kind',c.repositoryKind],['Directory',c.directory??'—'],['Source head',c.sourceHead],['Mutation readiness',route.mutationReadiness],['Businesses root','—'],['Installed tree',installedTreeOf(c.diskPath).label]])+table('Policy',['Field','Value'],[['Worktree branches','session-only'],['Mutation branch','main']])+table('Write roots',['Path','Why'],route.writeRoots.map(r=>[r,'Exact fixture ownership']))+table('Runtime',['Field','Value'])+table('Findings',['Code','Subject','Statement'],[['`ROUTE_HYDRATED_FROM_PORTABLE`',route.hydratedRouteRef,'Measured fixture route'],['`IDENTITY_ROSTER_SEALED`','roster','Named fixture roster'],['`WORKTREE_BRANCH_SESSION_ONLY`','main','Registered session branch']]);
 f.write(path.join(dir,'response/data/route.json'),route);f.write(path.join(dir,'response/response.md'),md);
 const response=f.response(request,'done',{'workspace-route-binding':'response/response.md',route:'response/data/route.json'});delete response.goalCheck;
 assert.equal((await f.accept(request,response)).state,'matched');return route;
}

async function seedFailure(f,status='mismatched') {
 const r=f.request('2/1','data.plan',{goal:'Two attributable fixture units',feature:'items',env:'dev'},[{alias:'@workspaces/be',head:f.sessionHead},{alias:'@worktrees/_templates',head:null},{alias:'@worktrees/uat/items',head:null}]);
 await f.open(r);seedOutputs(f,'2/1');
 const res=f.response(r,'mismatch',{'seed-plan':'response/response.md',units:'response/data/units.json'});
 res.comparison.verdict=status;res.comparison.criteria[0].verdict=status;
 assert.equal((await f.accept(r,res)).state,status);
 const state=f.state(),forecast={chain:state.chain,steps:state.steps,goals:{'1/1':f.bind.goal,'2/1':r.goal},presets:{'1/1':f.bind.requirements,'2/1':r.requirements},nodes:{'1/1':'binding','2/1':'seed'},dependencies:{'1/1':[],'2/1':['1/1']},evidenceDependencies:{'1/1':[],'2/1':[]},reasons:{},imports:{},fanout:{},handoffs:{}};
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([key,requirements])=>[key,{requirements}]));
 const address=await retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:1,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:address,revisions:[address]};f.save(state);return r;
}

function seedOutputs(f,cell) {
 const units=[{id:'first',kind:'table',goal:'An attributable fixture is planned.',inputs:[],dependsOn:[]}],q=x=>'`'+x+'`';
 const md='# seed-plan — items\n'+table('Units',['Unit','Serves','Namespace','Goal'],units.map(u=>[q(u.id),'flow '+q(u.id),q('uat-'+u.id),u.goal]))+table('Targets',['Unit','Store','Attribution','Volume','Rollback'],units.map(u=>[q(u.id),q('items'),'owner','2','Remove the unit account records.']))+table('Fixtures',['Unit','State','Action','JSON','SQL','Expected','Creates outcome'],units.map(u=>[q(u.id),'valid','reuse',q('.worktrees/uat/items/'+u.id+'/seed/records.json'),'—','Two owned records read back.','false']))+table('Fallbacks taken',['Code','Action']);
 f.write(path.join(f.branch(cell),'response/response.md'),md);f.write(path.join(f.branch(cell),'response/data/units.json'),{schemaVersion:9,producedBy:'data.plan',units});
}

for(const pendingDependsOnFailure of [false,true]) test(`retry preview and commit preserve an accepted later independent cell with ${pendingDependsOnFailure?'dependent':'independent'} pending work`,async t=>{
 const f=await fixture(t),request=cell=>f.request(cell,'data.plan',{goal:'Two attributable fixture units',feature:'items',env:'dev'},[{alias:'@workspaces/be',head:f.sessionHead},{alias:'@worktrees/_templates',head:null},{alias:'@worktrees/uat/items',head:null}]);
 let state=f.state();state.choices['budget:independent-retry']={selected:'continue',selectedBy:'user',sourceRef:'user:fixture-authorized-independent-retry'};state.budget.extensions=[{decisionId:'budget:independent-retry',maxSteps:24,maxSameOperator:8}];state.chain=[['1/1'],['2/1'],['3/1'],['4/1'],['5/1']];state.steps={'1/1':'workspace.bind','2/1':'data.plan','3/1':'data.plan','4/1':'data.plan','5/1':'data.plan'};f.save(state);
 for(const [cell,status]of [['2/1','mismatch'],['4/1','done']]) {
  const r=request(cell);await f.open(r);seedOutputs(f,cell);
  assert.equal((await f.accept(r,f.response(r,status,{'seed-plan':'response/response.md',units:'response/data/units.json'}))).state,status==='done'?'matched':'mismatched');
 }
 state=f.state();const forecast={chain:state.chain,steps:state.steps,goals:{},presets:{},nodes:{},dependencies:{'1/1':[],'2/1':['1/1'],'3/1':[pendingDependsOnFailure?'2/1':'1/1'],'4/1':['1/1'],'5/1':['2/1','3/1']},evidenceDependencies:{},reasons:{},imports:{},fanout:{},handoffs:{}};
 for(const cell of state.chain.flat()){const r=cell==='1/1'?f.bind:request(cell);forecast.goals[cell]=r.goal;forecast.presets[cell]=r.requirements;forecast.nodes[cell]=`original:${cell}`;forecast.evidenceDependencies[cell]=[];}
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const original=await retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:1,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:original,revisions:[original]};f.save(state);
 const accepted=structuredClone(state.attempts['4/1']),files=['request/request.json','response/response.json','response/response.md','response/data/units.json'],bytes=files.map(ref=>readFileSync(path.join(f.branch('4/1'),ref)));
 const flags={edit:{kind:'retry',cell:'2/1'}},preview=await f.plans.previewRevision(f.runtime,f.session,flags);
 const committed=await f.plans.commitRevision(f.runtime,f.session,{flags,previewHash:preview.previewHash,reason:'Retain the accepted independent plan while retrying the earlier failed plan and preserving remaining dependencies.'});
 assert.deepEqual(committed.forecast,preview.forecast,'commit accepts exactly the reviewed projection');
 assert.deepEqual(committed.forecast.chain,[['1/1'],['2/1'],['4/1'],['5/1'],['6/1'],['7/1']]);
 const retryCell=pendingDependsOnFailure?'5/1':'6/1',pendingCell=pendingDependsOnFailure?'6/1':'5/1';
 assert.equal(committed.forecast.nodes['4/1'],'original:4/1');assert.equal(committed.forecast.nodes[pendingCell],'original:3/1');assert.equal(committed.forecast.nodes['7/1'],'original:5/1');
 assert.equal(committed.forecast.retries[retryCell].source,'2/1');assert.deepEqual(committed.forecast.dependencies['7/1'],[retryCell,pendingCell]);
 if(pendingDependsOnFailure)assert.deepEqual(committed.forecast.dependencies[pendingCell],[retryCell],'the newly numbered retry precedes the earlier planned dependent node');
 assert.deepEqual(f.state().attempts['4/1'],accepted);files.forEach((ref,index)=>assert.deepEqual(readFileSync(path.join(f.branch('4/1'),ref)),bytes[index]));assert.equal(f.state().attempts['3/1'],undefined);assert.equal(f.state().current,'5/1');
 assert.deepEqual(planHistoryErrors(f.session,f.state()),[]);assert.deepEqual(await(await f.load('scripts/validate-chain.mjs')).validateSessionChain(f.runtime,f.session,f.state()),[]);
 const impossible=structuredClone(forecast);impossible.dependencies['4/1']=['3/1'];await assert.rejects(f.plans.editForecast(f.runtime,f.session,f.state(),impossible,flags.edit),/PLAN_EDIT_DEPENDENCY: retained execution/);
 const cycle=structuredClone(forecast);cycle.dependencies['3/1']=['5/1'];await assert.rejects(f.plans.editForecast(f.runtime,f.session,f.state(),cycle,flags.edit),/PLAN_EDIT_DEPENDENCY: pending forecast/);
 assert.deepEqual(f.state().attempts['4/1'],accepted);files.forEach((ref,index)=>assert.deepEqual(readFileSync(path.join(f.branch('4/1'),ref)),bytes[index]));
});

for(const status of ['mismatched','inconclusive']) test(`sealed historical bind survives later dirt; ${status} preview/commit preserves proof and official fresh retry requires progress`,async t=>{
 const f=await fixture(t),original=await seedFailure(f,status),before=readFileSync(path.join(f.branch('2/1'),'response/response.json'));
 f.write(path.join(f.selected,'outside.md'),'Later work outside the old binding.\n');
 assert.deepEqual(await sealedWorkspaceBindingErrors(f.session,f.state(),f.bind),[]);
 assert.deepEqual((await f.validation.validateStep(f.runtime,f.branch('1/1'),{operator:true,requestPhase:'accept'})).errors,[]);
 assert.match((await f.validation.validateStep(f.runtime,f.branch('1/1'),{operator:true})).errors.join(),/CHECKOUT_DIRTY/);
 const flags={edit:{kind:'retry',cell:'2/1'}},preview=await f.plans.previewRevision(f.runtime,f.session,flags);
 await f.plans.commitRevision(f.runtime,f.session,{flags,previewHash:preview.previewHash,reason:'The failed method is retained; a corrected fixture input is frozen for retry.'});
 assert.equal(f.state().current,'3/1');assert.deepEqual(readFileSync(path.join(f.branch('2/1'),'response/response.json')),before);
 const retry={...structuredClone(original),step:3,attempt:{id:'3/1:a2',number:2,kind:'retry',previous:original.attempt.id}};retry.environment.isolationId=retry.attempt.id;
 await assert.rejects(f.open(retry),/NO_PROGRESS/);assert.equal(f.state().attempts['3/1'],undefined);
 const renumbered=structuredClone(retry);renumbered.expected.version=2;await assert.rejects(f.open(renumbered),/NO_PROGRESS/);
 const reordered=structuredClone(retry);reordered.contexts.reverse();reordered.environment.reads.reverse();assert.match((await attemptProgressErrors(f.session,f.state(),reordered)).join(),/NO_PROGRESS/);
 const method='Use the corrected two-unit namespace fixture, keeping original outcome and ownership.';
 f.write(path.join(f.branch('3/1'),'request/artifacts/method.md'),method);retry.frozenInputs=[{ref:'request/artifacts/method.md',sha256:sha(method)}];
 assert.deepEqual(await f.plans.planAdmissionErrors(f.runtime,f.session,f.state(),retry),[]);
 assert.equal((await f.open(retry)).state,'opened');
 seedOutputs(f,'3/1');assert.equal((await f.accept(retry,f.response(retry,'done',{'seed-plan':'response/response.md',units:'response/data/units.json'}))).state,'matched');
 assert.deepEqual(planHistoryErrors(f.session,f.state()),[]);
 const altered={...retry,requirements:{...retry.requirements,feature:'foreign'}};assert.match((await f.plans.planAdmissionErrors(f.runtime,f.session,f.state(),altered)).join(),/UNAUTHORIZED/);
 assert.deepEqual(readFileSync(path.join(f.branch('2/1'),'response/response.json')),before);
});

test('historical checkout admission rejects missing seals, route tampering and import-marker substitution',async t=>{
 const f=await fixture(t),state=f.state(),branch=f.branch('1/1');
 assert.deepEqual(await sealedWorkspaceBindingErrors(f.session,state,f.bind),[]);
 const damaged=structuredClone(state);delete damaged.attempts['1/1'].evidenceManifest;assert.ok((await sealedWorkspaceBindingErrors(f.session,damaged,f.bind)).length);
 f.write(path.join(branch,'import.json'),{});assert.match((await sealedWorkspaceBindingErrors(f.session,state,f.bind)).join(),/imported/);rmSync(path.join(branch,'import.json'));
 const file=path.join(branch,'response/response.json'),bytes=readFileSync(file),response=JSON.parse(bytes);response.fields.route='foreign-route';f.write(file,response);assert.ok((await sealedWorkspaceBindingErrors(f.session,state,f.bind)).length);writeFileSync(file,bytes);
 f.write(path.join(branch,'response/data/route.json'),{});assert.match((await sealedWorkspaceBindingErrors(f.session,state,f.bind)).join(),/changed|fingerprint/);
});

test('a source mismatch inserts only its exact approved rebind and gates the retry on genuine fresh binding acceptance',async t=>{
 const f=await fixture(t,{backend:true});await architecture(f);
 const r=f.request('4/1','backend.generate',{featureId:'fixture',outcome:'Implement the bounded fixture contract.',mutableFileRefs:['src/**','extra/**'],protectedRefs:['foreign/**','extra/*.json','extra/**/secret.txt'],mode:'apply',scope:'full',resume:null},[{alias:'@workspaces/be',head:f.sessionHead},{alias:'@knowledge/patterns/be',head:null}]);
 r.inputs={'architecture-decision':'step-3/parallel-1/response/response.md'};r.environment.workspace={alias:'@workspaces/be',worktree:f.selected,revision:f.sessionHead};r.environment.writes=['@workspaces/be/branch/session/src','@workspaces/be/branch/session/extra','response'];r.environment.exclusive=[f.selected];
 await f.open(r);f.write(path.join(f.selected,'extra/prepared.txt'),'The current request owns this prepared fixture path.\n');
 const changes='# changes — backend.generate step-4/parallel-1\n'+table('Binding',['Field','Value'],[['Operator','backend.generate'],['Step','4/1'],['Checkout','@workspaces/be'],['Predecessor',r.inputs['architecture-decision']]])+table('Files',['Path','Change','Why','Claims'],[['extra/prepared.txt','created','Current request owns this path; prior workspace binding does not.','bounded']])+'\n## What the next step must know\n\nThe current checkout needs its exact additional request-owned root bound before continuation.\n';
 f.write(path.join(f.branch('4/1'),'response/changes.md'),changes);const failed=f.response(r,'mismatch',{changes:'response/changes.md'});failed.boundProfile=failed.ranProfile='sol-fresh';failed.fallbacks=['OWNER_WIDENED'];assert.equal((await f.accept(r,failed)).state,'mismatched');await freezeForecast(f);
 const flags={edit:{kind:'retry',cell:'4/1',rebind:{source:'1/1',writeRoots:['src','extra']}}};
 for(const roots of [['src','foreign'],['src','../extra'],['extra'],['src','outside.md']]) await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,rebind:{source:'1/1',writeRoots:roots}}}),/REBIND/);
 for(const file of ['extra/private.json','extra/nested/secret.txt']) {f.write(path.join(f.selected,file),'Protected fixture content');await assert.rejects(f.plans.previewRevision(f.runtime,f.session,{edit:{...flags.edit,rebind:{source:'1/1',writeRoots:['src','extra',file]}}}),/REBIND_UNAUTHORIZED/);await assert.rejects(f.plans.previewRevision(f.runtime,f.session,flags),/protected dirty leaf/);rmSync(path.join(f.selected,file));}
 const preview=await f.plans.previewRevision(f.runtime,f.session,flags);await f.plans.commitRevision(f.runtime,f.session,{flags,previewHash:preview.previewHash,reason:'Bind the exact prepared source root already authorized by the failed request.'});
 assert.equal(f.state().steps['5/1'],'workspace.bind');assert.equal(f.state().steps['6/1'],'backend.generate');
 const retry={...structuredClone(r),step:6,attempt:{id:'6/1:a2',number:2,kind:'retry',previous:r.attempt.id}};retry.environment.isolationId=retry.attempt.id;
 const method='Reverify the exact prepared change through the newly accepted checkout binding.';f.write(path.join(f.branch('6/1'),'request/artifacts/rebind-method.md'),method);retry.frozenInputs=[{ref:'request/artifacts/rebind-method.md',sha256:sha(method)}];
 await assert.rejects(f.open(retry),/sealed matched/);assert.equal(f.state().requestHashes['6/1'],undefined);
 const bind={...structuredClone(f.bind),step:5,goal:{prerequisite:'6/1'},requirements:preview.forecast.presets['5/1'],attempt:{id:'5/1:a1',number:1,kind:'initial',previous:null}};bind.expected.sourceRef='state.json#mission:v1/prerequisite:6/1';bind.environment.isolationId=bind.attempt.id;
 assert.equal((await f.open(bind)).state,'opened');await acceptBind(f,bind);
 assert.equal((await f.open(retry)).state,'opened');assert.equal(readFileSync(path.join(f.selected,'extra/prepared.txt'),'utf8'),'The current request owns this prepared fixture path.\n');
 assert.deepEqual(planHistoryErrors(f.session,f.state()),[]);
});
