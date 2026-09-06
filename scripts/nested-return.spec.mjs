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

async function fixture(t, { selection = 'return' } = {}) {
 const host = await mkdtemp(path.join(os.tmpdir(), 'starci-review-lifecycle-')), root = path.join(host,'.claude');
 t.after(()=>rm(host,{recursive:true,force:true}));
 const payload = JSON.parse(await readFile(path.join(source,'package.json')));
 for (const file of ['package.json',...payload.files]) await cp(path.join(source,file),path.join(root,file),{recursive:true});
 const load = file => import(pathToFileURL(path.join(root,file)).href);
 const [{openSession,confirmSession,cleanupFixtureOwners},{openAttempt,acceptAttempt},{retainContext},{scopeHash},{restatementDecisionId,recordRestatementChoice},plans,{waitingReviewBinding,resolvedWaitingAttemptKeys},{baseline,confirmed},{acquireWorkerSlot,releaseWorkerSlot}] = await Promise.all([
  load('scripts/v23-test-fixture.mjs'),load('scripts/attempt-gate.mjs'),load('scripts/mission-history.mjs'),load('scripts/mission-scope.mjs'),load('scripts/restatement-choice.mjs'),load('scripts/plan-history.mjs'),load('scripts/resolved-waiting.mjs'),load('operators/architecture-decide/self-test.mjs'),load('scripts/worker-slots.mjs')]);
 const owner=path.join(host,'owner');await mkdir(owner);
 const opened=await openSession(path.join(owner,'.worktrees/sessions'),{project:'review',hostBinding:{kind:'codex-task',hostId:path.basename(host),worktree:owner,sourcePromptRef:'user:opening'},mission:{language:'en',goal:'Decide one reviewed architecture.',target:'The bounded read path',includes:['Architecture and independent review'],outputs:['A reviewed architecture decision'],doneWhen:[{producedBy:'architecture.decide',evidence:'The architecture is independently reviewed.'}],verification:'Validate the model and a fresh independent critique.',sourceRef:'user:opening'}});
 t.after(()=>cleanupFixtureOwners(owner));
 await confirmSession(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved'});
 const session=opened.session,stateFile=path.join(session,'state.json'),read=async()=>JSON.parse(await readFile(stateFile)),save=state=>put(stateFile,state),branch=cell=>path.join(session,`step-${cell.split('/')[0]}/parallel-${cell.split('/')[1]}`);
 let state=await read();const head=state.mission.discovery.repositories[0].head;
 const criteria=[{id:'decision',required:true,expected:'The architecture is independently reviewed.',verification:'Read the model and independent critique.'}];
 function current(request,step,{number=1,previous=null,resume=null,exchange=null}={}) {
  const id=`${step}/1${exchange?'/'+exchange:''}:a${number}`;
  return {...structuredClone(request),contractVersion:'starci/v2.2',sessionId:state.id,step,parallel:1,...(exchange?{exchange}:{}),...(!exchange?{goal:{doneWhen:0}}:{}),resume,attempt:{id,number,kind:number===1?'initial':'repair',previous},expected:{version:1,goalVersion:state.mission.version,sourceRef:exchange?`step-${step}/parallel-1/response/data/stack-model.json`:`state.json#mission:v${state.mission.version}/doneWhen:0`,criteria},environment:{isolationId:id,mode:'isolated',workspace:null,reads:(request.contexts??[]).map(c=>c.alias),writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]};
 }
 function actual(request,response,status,evidence) {
  const matched=status==='done';return {...response,contractVersion:'starci/v2.2',step:request.step,parallel:1,...(request.exchange?{exchange:request.exchange}:{}),status,boundProfile:'sol-reviewer',ranProfile:'sol-reviewer',attempt:{id:request.attempt.id,number:request.attempt.number,expectedVersion:1},actual:{expectedVersion:1,observedAt:new Date().toISOString(),observations:[{criterionId:'decision',observed:matched?'The requested review result is recorded.':'A fresh independent review is required.',evidence}]},comparison:{expectedVersion:1,verdict:matched?'matched':'inconclusive',criteria:[{criterionId:'decision',verdict:matched?'matched':'inconclusive',evidence,note:'Synthetic lifecycle evidence, not product completion.'}],next:matched?'advance':status==='waiting'?'retry':'blocked'},...(matched?{outcome:{summary:'The requested review evidence is available.',primary:{kind:'document',label:'Review evidence',ref:evidence[0]}}}:{}),...(matched&&!request.exchange?{goalCheck:{achieved:true,evidence}}:{})};
 }
 // A genuine accepted source binding is the context prerequisite of this isolated architecture plan.
 const disk=owner.replaceAll('\\','/'),project=state.project,gitPolicy={mutationBranch:'master',worktreeBranches:'forbidden'};
 const binding={project,role:'be',portableRouteRef:`.workspaces/projects/${project}/be.json`,hydratedRouteRef:`.workspaces/local/routes/${project}/be/config.json`,routeFingerprint:sha('fixture-route'),identityFingerprint:sha('fixture-roster'),sourceHead:head,checkout:{diskPath:disk,gitRoot:disk,gitRepository:'https://github.com/sample/fixture.git',branch:'master',repositoryKind:'source',directory:null,sourceHead:head},gitPolicy,mutationReadiness:'ready',writeRoots:[],authorityRoots:{businesses:null},runtime:null,provenanceHeadRef:null};
 const bind=current({schemaVersion:9,operatorId:'workspace.bind',contexts:[{alias:`@workspaces/projects/${project}/be`,head:null},{alias:`@workspaces/local/routes/${project}/be`,head},{alias:'@workspaces/device-state',head:null}],requirements:{project,role:'be',gitPolicy,declaredWriteRoots:[],resume:null},inputs:{}},1);
 bind.environment.mode='inline';bind.goal={prerequisite:'2/1'};bind.expected.sourceRef=`state.json#mission:v1/prerequisite:2/1`;
 state.chain=[['1/1'],['2/1'],['3/1']];state.steps={'1/1':'workspace.bind','2/1':'architecture.decide','3/1':'architecture.decide'};state.current='1/1';await save(state);
 await put(path.join(branch('1/1'),'request/request.json'),bind);await openAttempt(branch('1/1'));
 const md=`# workspace-route-binding — ${project}/be\n\nSynthetic binding of the actual fixture checkout.\n`+table('Binding',['Field','Value'],[['Project',project],['Role','be'],['Portable route',binding.portableRouteRef],['Hydrated route',binding.hydratedRouteRef],['Source head',head]])+table('Checkout',['Field','Value'],[['Disk path',disk],['Git root',disk],['Git repository',binding.checkout.gitRepository],['Branch','master'],['Repository kind','source'],['Directory','—'],['Source head',head],['Mutation readiness','ready'],['Businesses root','—'],['Installed tree','absent']])+table('Policy',['Field','Value'],[['Worktree branches','forbidden'],['Mutation branch','master']])+table('Write roots',['Path','Why'],[])+table('Runtime',['Field','Value'],[])+table('Findings',['Code','Subject','Statement'],[['ROUTE_HYDRATED_FROM_PORTABLE',binding.hydratedRouteRef,'The fixture route is bound.'],['IDENTITY_ROSTER_SEALED','fixture-roster','The roster is only named.'],['WORKTREE_BRANCH_FORBIDDEN','master','Only the declared branch may mutate.']]);
 await put(path.join(branch('1/1'),'response/data/route.json'),binding);await put(path.join(branch('1/1'),'response/response.md'),md.replace(/\| (ROUTE_HYDRATED_FROM_PORTABLE|IDENTITY_ROSTER_SEALED|WORKTREE_BRANCH_FORBIDDEN) \|/g,(_,$1)=>'| `'+$1+'` |'));
 const bindResponse=actual(bind,{schemaVersion:9,operatorId:'workspace.bind',fields:{'workspace-route-binding':'response/response.md',route:'response/data/route.json'},fallbacks:[],commits:[],next:['architecture.decide']},'done',['response/response.md']);delete bindResponse.goalCheck;
 bindResponse.boundProfile='sol-fresh';bindResponse.ranProfile='sol-fresh';await put(path.join(branch('1/1'),'response/response.json'),bindResponse);await acceptAttempt(branch('1/1'));
 const [files]=confirmed(baseline());const template=files['request/request.json'];template.contexts[0].head=head;delete template.decisionId;delete template.selectedOption;template.requirements.resume=null;
 const first=current(template,2),text=files['response/restatement.md'];
 await put(path.join(branch('2/1'),'request/request.json'),first);await openAttempt(branch('2/1'));
 const decisionId=restatementDecisionId(first,template.requirements.decisionId,text);
 await put(path.join(branch('2/1'),'response/restatement.md'),text);
 await put(path.join(branch('2/1'),'response/response.json'),actual(first,{schemaVersion:9,operatorId:'architecture.decide',stop:'RESTATEMENT_UNCONFIRMED',fields:{restatement:'response/restatement.md'},fallbacks:[],commits:[],next:[],interaction:{kind:'restatement-confirm',decisionId,options:[{id:'as-stated',label:'As stated',tradeoff:'Use this reading'},{id:'corrected',label:'Corrected',tradeoff:'Correct this reading'}]}},'blocked',['response/restatement.md']));
 await acceptAttempt(branch('2/1'));await recordRestatementChoice(branch('2/1'),{selected:'as-stated',selectedBy:'user',sourceRef:'user:actual-fixture-answer'});
 const parent=current(template,3,{number:2,previous:first.attempt.id,resume:{step:2,parallel:1,token:decisionId}});parent.decisionId=decisionId;parent.selectedOption='as-stated';parent.requirements.resume=decisionId;
 state=await read();state.resumes={'3/1':{resumes:'2/1',stop:'RESTATEMENT_UNCONFIRMED'}};state.current='3/1';await save(state);
 async function waiting(request) {
  const dir=branch(`${request.step}/1`);await put(path.join(dir,'request/request.json'),request);await openAttempt(dir);
  for (const ref of ['response/restatement.md','response/data/current-state.json','response/data/stack-model.json']) await put(path.join(dir,ref),files[ref]);
  const response=actual(request,{schemaVersion:9,operatorId:'architecture.decide',fields:{restatement:'response/restatement.md','current-state':'response/data/current-state.json','stack-model':'response/data/stack-model.json'},awaiting:{exchange:'critique',kind:'independent-critique'},fallbacks:[],commits:[],next:[]},'waiting',['response/data/stack-model.json']);
  await put(path.join(dir,'response/response.json'),response);assert.equal((await acceptAttempt(dir)).state,'waiting');return dir;
 }
 async function review(request,selection) {
  const dir=path.join(branch(`${request.step}/1`),'critique'),child=current(files['critique/request/request.json'],request.step,{exchange:'critique'});child.inputs={'stack-model':`step-${request.step}/parallel-1/response/data/stack-model.json`};
  await put(path.join(dir,'request/request.json'),child);await openAttempt(dir);
  let critique=files['critique/response/critique.md'];if(selection==='return')critique=critique.replace('| Selection | keep |','| Selection | return |').replace('| holds |','| fails |');
  await put(path.join(dir,'response/critique.md'),critique);await put(path.join(dir,'response/response.json'),actual(child,{...files['critique/response/response.json']},'done',['response/critique.md']));
  assert.equal((await acceptAttempt(dir)).state,'matched');return child;
 }
 await waiting(parent);await review(parent,selection);state=await read();
 const forecast={chain:state.chain,steps:state.steps,goals:{'1/1':bind.goal,'2/1':first.goal,'3/1':parent.goal},reasons:{},presets:{'1/1':bind.requirements,'2/1':first.requirements,'3/1':parent.requirements},dependencies:{'1/1':[],'2/1':['1/1'],'3/1':['1/1']},evidenceDependencies:{'1/1':[],'2/1':[],'3/1':[]},handoffs:{},nodes:{'1/1':'binding','2/1':'reading','3/1':'architecture'},resumes:{'3/1':'2/1'},imports:{},fanout:{}};
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const address=await retainContext(session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:state.mission.version,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:address,revisions:[address]};await save(state);
 return {root,session,read,save,branch,parent,files,waiting,review,actual,plans,waitingReviewBinding,resolvedWaitingAttemptKeys,openAttempt,acceptAttempt,acquireWorkerSlot,releaseWorkerSlot};
}

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

test('integrity disclosure preserves questioned proof but cannot approve or complete the replacement without fresh review',async t=>{
 const f=await fixture(t),state=await f.read();
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
});

test('a keep verdict cannot impersonate a return and forged or stale review identities cannot authorize re-entry',async t=>{
 const f=await fixture(t,{selection:'keep'}),state=await f.read();
 await assert.rejects(f.waitingReviewBinding(f.root,f.session,state,'3/1'),/does not select the declared return/);
 for(const change of [s=>{s.attempts['3/1'].status='running';},s=>{delete s.attempts['3/1'].evidenceManifest;},s=>{s.attempts['3/1/critique'].id='forged';},s=>{s.requestHashes['3/1/critique']=sha('wrong');},s=>{s.attempts['3/1/critique'].expected.goalVersion+=1;},s=>{delete s.attempts['3/1/critique'].context;}]) {
  const altered=structuredClone(state);change(altered);
  await assert.rejects(f.waitingReviewBinding(f.root,f.session,altered,'3/1'));
 }
});
