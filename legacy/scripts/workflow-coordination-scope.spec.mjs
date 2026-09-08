import {observeCheckoutFixture,prepareFixtureSource,fixtureSourceCritique} from './architecture-source-fixture.mjs';
// Scope ownership fixtures use disposable repositories and actual current admission/acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, cpSync, rmdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { workspaceCheckoutFixture, fixtureGit as git } from './workspace-checkout-fixture.mjs';
import { openSession, confirmSession } from './session-open.mjs';
import { discoveryFor, answerFor } from './v23-test-fixture.mjs';
import { resolveWorkspaceCheckout, installedTreeOf } from './workspace-checkout.mjs';
import { baseline, confirmed } from '../operators/architecture-decide/self-test.mjs';
import { createSourceFixture, acceptArchitecture, acceptBackend, branch, put, read, current, actual, open, accept, planCells } from './workflow-source-fixture.mjs';
import { createInterfaceFixture, INTERFACE_PAGE } from './workflow-interface-fixture.mjs';
import { repositoryPath } from './workflow-coordination.mjs';
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
 const discovery=discoveryFor(f.project,{head:f.baseHead,tags:['backend','architecture']});discovery.repositories[0].repository=f.origin;discovery.impacts[0].code=['project-ledger:step-27/claims','apps/{chatbot,accounting}/src/**'];
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
 files['response/data/stack-model.json'].operations=[operation];observeCheckoutFixture(files,f.sessionHead);
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
 const childDir=path.join(f.branch('3/1'),'critique'),gate=await f.load('scripts/attempt-gate.mjs');f.write(path.join(childDir,'request/request.json'),child);await prepareFixtureSource(f.runtime,childDir,child);await gate.openAttempt(childDir);f.write(path.join(childDir,'response/critique.md'),fixtureSourceCritique(childDir,files['critique/response/critique.md']));
 const reviewed=f.response(child,'done',{'independent-critique':'response/critique.md'});reviewed.exchange='critique';delete reviewed.goalCheck;f.write(path.join(childDir,'response/response.json'),reviewed);await gate.acceptAttempt(childDir);
 await acquireWorkerSlot(f.branch('3/1'),'fixture-author',{resume:true,ranProfile:'sol-reviewer'});
 f.write(path.join(f.branch('3/1'),'response/response.md'),files['response/response.md']);
 const done=f.response(parent,'done',{...files['response/response.json'].fields,restatement:'response/restatement.md'});delete done.goalCheck;await f.accept(parent,done);
 return{reading,parent,files};
}

async function acceptBind(f,request) {
 const route={...resolveWorkspaceCheckout({source:f.source,project:f.project,role:f.role,sessionId:f.sessionId,checkout:'session',declaredWriteRoots:request.requirements.declaredWriteRoots}),identityFingerprint:sha('fixture-roster'),authorityRoots:{businesses:null},runtime:null,provenanceHeadRef:null};
 const c=route.checkout,dir=f.branch(`${request.step}/${request.parallel}`);
 const md=`# workspace-route-binding — ${f.project}/be\n`+table('Binding',['Field','Value'],[['Project',f.project],['Role','be'],['Portable route',route.portableRouteRef],['Hydrated route',route.hydratedRouteRef],['Source head',route.sourceHead]])+table('Checkout',['Field','Value'],[['Disk path',c.diskPath],['Git root',c.gitRoot],['Git repository',c.gitRepository],['Branch',c.branch],['Repository kind',c.repositoryKind],['Directory',c.directory??'—'],['Source head',c.sourceHead],['Mutation readiness',route.mutationReadiness],['Businesses root','—'],['Installed tree',installedTreeOf(c.diskPath).label]])+table('Policy',['Field','Value'],[['Worktree branches','session-only'],['Mutation branch','main']])+table('Write roots',['Path','Why'],route.writeRoots.map(r=>[r,'Exact fixture ownership']))+table('Runtime',['Field','Value'])+table('Findings',['Code','Subject','Statement'],[['`ROUTE_HYDRATED_FROM_PORTABLE`',route.hydratedRouteRef,'Measured fixture route'],['`IDENTITY_ROSTER_SEALED`','roster','Named fixture roster'],['`WORKTREE_BRANCH_SESSION_ONLY`','main','Registered session branch']]);
 f.write(path.join(dir,'response/data/route.json'),route);f.write(path.join(dir,'response/response.md'),md);
 const response=f.response(request,'done',{'workspace-route-binding':'response/response.md',route:'response/data/route.json'});delete response.goalCheck;
 assert.equal((await f.accept(request,response)).state,'matched');return route;
}

async function coordinationPeers(f) {
 const { openSession: open, confirmSession: confirm, discoveryFor: discover } = await f.load('scripts/v23-test-fixture.mjs');
 const peers = {};
 for (const [id, mode, draft] of [['rebind-coordinator','coordinated',false],['shared-donor','solo',false],['shared-producer','solo',true]]) {
  const worktree=path.join(f.temporary,id);git(f.canonical,'worktree','add','--quiet','-b',`session/${id}`,worktree,f.baseHead);
  const sessions=path.join(worktree,'.worktrees/sessions'),project=`${id}-${sha(sessions).slice(7,15)}`;
  const discovery=discover(project,{head:f.baseHead,tags:['backend','architecture']});discovery.repositories[0].repository=f.origin;discovery.impacts[0].code=['src/shared'];
  f.write(path.join(f.source,`.workspaces/projects/${project}/workflow.json`),{version:1,project,ownerRole:'be'});
  f.write(path.join(f.source,`.workspaces/local/routes/${project}/be/config.json`),{project,role:'be',source:{path:f.source},repository:{diskPath:worktree,gitRepository:f.origin}});
  const opened=await open(sessions,{sessionId:id,project:id,topology:{mode},hostBinding:{kind:'codex-task',hostId:`task-${id}`,worktree,sourcePromptRef:'user:rebind-fixture'},mission:{language:'en',goal:mode==='coordinated'?'Coordinate the bounded worker and shared implementation.':'Implement the bounded shared worker.',target:'Disposable shared source',includes:['Declared stateless source'],excludes:['Product source and services'],outputs:['Accepted source evidence'],doneWhen:[{producedBy:mode==='coordinated'?'workflow.verify':'backend.generate',evidence:'The declared source outcome is proved.'}],verification:'Validate source evidence and repository ownership.',sourceRef:'user:rebind-fixture',discovery}});
  if(!draft)await confirm(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:rebind-peer-confirmed'});
  peers[id]={...opened,worktree};
 }
 return{coordinator:peers['rebind-coordinator'],donor:peers['shared-donor'],producer:peers['shared-producer']};
}

test('literal claims retain real route segments and refuse expressions or ledger annotations',()=>{
 assert.equal(repositoryPath('src/app/[locale]/[workspaceId]'),process.platform==='win32'?'src/app/[locale]/[workspaceid]':'src/app/[locale]/[workspaceId]');
 for(const value of ['src/**','src/*/worker.mjs','src/{a,b}','src/?.mjs','project-ledger:step-27/claim','../src','src/../a','/src','src\\a'])assert.throws(()=>repositoryPath(value),/COORDINATION_ROOT/,value);
});

test('immutable admitted source plus accepted checkout authorizes a new child subtree after truthful release', {timeout:180000},async t=>{
 const f=await fixture(t,{backend:true});await architecture(f);
 const {acquireWorkerSlot}=await f.load('scripts/worker-slots.mjs');
 const r=f.request('4/1','backend.generate',{featureId:'fixture',outcome:'Implement the bounded fixture contract.',mutableFileRefs:['src/**','extra/**'],protectedRefs:['src/private/**'],mode:'apply',scope:'full',resume:null},[{alias:'@workspaces/be',head:f.sessionHead},{alias:'@knowledge/patterns/be',head:null}]);
 r.inputs={'architecture-decision':'step-3/parallel-1/response/response.md'};r.environment.workspace={alias:'@workspaces/be',worktree:f.selected,revision:f.sessionHead};r.environment.writes=['@workspaces/be/src','@workspaces/be/extra','response'];r.environment.exclusive=[f.selected];
 await f.open(r);await acquireWorkerSlot(f.branch('4/1'),'scope-source',{ranProfile:'sol-fresh'});
 const root='src/app/[locale]/parent',child=root+'/shared',file=child+'/worker.mjs';assert.equal(existsSync(path.join(f.selected,file)),false);
 const requestFile=path.join(f.branch('4/1'),'request/request.json'),requestBytes=readFileSync(requestFile);
 const {coordinator,donor,producer}=await coordinationPeers(f);
 const api=await f.load('scripts/workflow-coordination.mjs');
 for(const peer of [{session:f.session},donor])await api.enrolWorkflow(f.runtime,peer.session,coordinator.sessionId);
 const assign=claim=>api.assignWorkflows(f.runtime,coordinator.session,{id:'new-source',claims:[{sessionId:f.sessionId,role:'be',root:claim}]});
 for(const claim of ['src/private/new.mjs','extra/new.mjs','apps/chatbot/src/unbound.mjs','project-ledger:step-27/claims'])await assert.rejects(assign(claim),/COORDINATION_SCOPE|COORDINATION_ROOT/,claim);
 await assert.rejects(api.assignWorkflows(f.runtime,coordinator.session,{id:'wrong-role',claims:[{sessionId:f.sessionId,role:'fe',root}]}),/COORDINATION_REPOSITORY|COORDINATION_SCOPE/);
 try { f.write(requestFile,{...r,requirements:{...r.requirements,protectedRefs:[]}});await assert.rejects(assign(root),/hash|immutable|invocation|COORDINATION_SCOPE/); } finally {writeFileSync(requestFile,requestBytes);}
 // The second enrolled owner has literal source authority, but may not claim the live writer's src/shared reservation.
 await assert.rejects(api.assignWorkflows(f.runtime,coordinator.session,{id:'foreign-running',claims:[{sessionId:donor.sessionId,role:'be',root:'src/shared'}]}),/COORDINATION_BUSY/);
 const measured=spawnSync(process.execPath,[path.join(f.selected,file)],{encoding:'utf8',windowsHide:true});assert.notEqual(measured.status,0);
 f.write(path.join(f.branch('4/1'),'response/artifacts/missing-source.log'),measured.stdout+measured.stderr);
 const changes='# changes — backend.generate step-4/parallel-1\n'+table('Binding',['Field','Value'],[['Operator','backend.generate'],['Step','4/1'],['Checkout','@workspaces/be'],['Predecessor',r.inputs['architecture-decision']]])+table('Files',['Path','Change','Why','Claims'],[['src/model.txt','unchanged','The existing fixture source is retained; the proposed worker is not implemented.','bounded']])+'\n## What the next step must know\n\nNo source was written. The declared new worker does not yet exist; the actual test invocation is retained in response/artifacts/missing-source.log.\n';
 f.write(path.join(f.branch('4/1'),'response/changes.md'),changes);
 const refusal=f.response(r,'blocked',{changes:'response/changes.md'});refusal.boundProfile=refusal.ranProfile='sol-fresh';refusal.stop='PROOF_UNAVAILABLE';refusal.reason='The actual test command cannot read the not-yet-implemented worker; no implementation or delivery is claimed.';
 assert.equal((await f.accept(r,refusal)).state,'blocked');assert.equal(f.state().workerSlots.length,0);
 const assignment=await assign(root),record=JSON.parse(readFileSync(path.join(coordinator.session,assignment.ref))),authority=record.claims[0].authority;
 assert.equal(authority.kind,'admitted-source-root');assert.equal(authority.shape,'subtree');assert.equal(authority.root,root);assert.equal(authority.request.hash,sha(requestBytes));assert.equal(authority.binding.step,1);
 const consumerState=JSON.parse(readFileSync(path.join(donor.session,'state.json')));consumerState.steps={'1/1':'backend.generate'};consumerState.chain=[['1/1']];consumerState.current='1/1';f.write(path.join(donor.session,'state.json'),consumerState);
 const specification={id:'new-child',donorSessionId:f.sessionId,producerSessionId:producer.sessionId,operatorId:'backend.generate',selections:[{impactId:'bounded',roots:[child]}],dependencies:[{consumerSessionId:donor.sessionId,kind:'backend-source-application',cells:['1/1']}]};
 await assert.rejects(api.prepareExtraction(f.runtime,coordinator.session,{...specification,id:'widen',selections:[{impactId:'bounded',roots:['src/app']}]}),/COORDINATION_SCOPE|COORDINATION_EXTRACTION/);
 const prepared=await api.prepareExtraction(f.runtime,coordinator.session,specification);
 await api.enrolWorkflow(f.runtime,producer.session,coordinator.sessionId,{preparation:prepared});
 const activated=await api.activateExtraction(f.runtime,coordinator.session,prepared),next=JSON.parse(readFileSync(path.join(coordinator.session,activated.ref))),transferred=next.claims.find(claim=>claim.ownerSessionId===producer.sessionId);
 assert.equal(transferred.root,child);assert.deepEqual(transferred.authority,authority,'child transfer retains and revalidates its original ancestor request authority');assert.equal(existsSync(path.join(f.selected,file)),false);
 assert.equal(f.state().attempts['4/1'].status,'blocked','opening authority never becomes delivery credit');assert.deepEqual(readFileSync(requestFile),requestBytes);
 try {f.write(requestFile,{...r,environment:{...r.environment,exclusive:[]}});assert.ok((await api.coordinationStateErrors(f.runtime,coordinator.session,JSON.parse(readFileSync(path.join(coordinator.session,'state.json'))))).length);}finally{writeFileSync(requestFile,requestBytes);}
 const state=f.state();state.mission.goal+=' Changed outside its original sealed authority.';f.save(state);
 assert.ok((await api.coordinationStateErrors(f.runtime,coordinator.session,JSON.parse(readFileSync(path.join(coordinator.session,'state.json'))))).some(error=>/scope|mission|authority/i.test(error)),'stale mission cannot reuse the original request proof');
});

test('accepted changed files supply exact same-mission authority beyond generalized discovery', {timeout:180000},async t=>{
 const f=await createSourceFixture(t,{sessionId:'scope-accepted',mission:({discovery})=>({discovery:{...discovery,impacts:discovery.impacts.map(impact=>({...impact,code:['project-ledger:step-27/claims','apps/{chatbot,accounting}/src/**']}))}})});
 const architecture=await acceptArchitecture(f),source=await acceptBackend(f,architecture);
 const coordinator=await createSourceFixture(t,{existing:f,sessionId:'scope-coordinator',topology:{mode:'coordinated'},mission:{goal:'Coordinate exact accepted source ownership.',doneWhen:[{producedBy:'workflow.verify',evidence:'Verify the accepted source ownership.'}]}});
 const api=await f.load('scripts/workflow-coordination.mjs');await api.enrolWorkflow(f.root,f.session,coordinator.sessionId);
 const claim='src/modules/fixture/worker.mjs';
 const assign=root=>api.assignWorkflows(f.root,coordinator.session,{id:'accepted-file',claims:[{sessionId:f.sessionId,role:'be',root}]});
 await assert.rejects(assign('src/modules'),/COORDINATION_SCOPE/);await assert.rejects(assign('apps/chatbot/src/new.mjs'),/COORDINATION_SCOPE/);
 const evidence=path.join(branch(f,source.step),'response/artifacts/unit.log'),bytes=readFileSync(evidence);
 try {put(evidence,'Tampered actual unit evidence.\n');await assert.rejects(assign(claim),/evidenceManifest|original|hash/);}finally{put(evidence,bytes);}
 const assignment=await assign(claim),record=JSON.parse(readFileSync(path.join(coordinator.session,assignment.ref))),authority=record.claims[0].authority;
 assert.equal(authority.kind,'accepted-source-file');assert.equal(authority.root,claim);assert.equal(authority.origin.sessionId,f.sessionId);assert.equal(authority.proof.manifestFingerprint,f.state().attempts[`${source.step}/1`].evidenceManifest.fingerprint);
 assert.deepEqual(await api.coordinationStateErrors(f.root,coordinator.session,JSON.parse(readFileSync(path.join(coordinator.session,'state.json')))),[]);
});

async function interfaceBinding(f) {
 const role='fe',worktree=f.feWorktree,project=f.state().project,head=git(worktree,'rev-parse','HEAD'),sessionBranch=git(worktree,'branch','--show-current');
 const hydratedRouteRef=f.state().mission.discovery.repositories.find(repo=>repo.role===role).routeRef,portableRouteRef=`.workspaces/projects/${project}/fe.json`,gitPolicy={mutationBranch:sessionBranch,worktreeBranches:'session-only'};
 const hydrated=read(path.join(f.source,hydratedRouteRef));hydrated.gitPolicy=gitPolicy;put(path.join(f.source,hydratedRouteRef),hydrated);
 const repository=git(worktree,'remote','get-url','origin');put(path.join(f.source,portableRouteRef),{project,role,repository:{gitRepository:repository},gitPolicy});
 const disk=worktree.replaceAll('\\','/'),writeRoots=['src/modules/fixture/**'];
 const route={project,role,portableRouteRef,hydratedRouteRef,routeFingerprint:sha(readFileSync(path.join(f.source,hydratedRouteRef))),identityFingerprint:sha('anonymous fixture without credentials'),sourceHead:head,checkout:{diskPath:disk,gitRoot:disk,gitRepository:repository,branch:sessionBranch,repositoryKind:'source',directory:null,sourceHead:head},gitPolicy,mutationReadiness:'ready',writeRoots,authorityRoots:{businesses:null},runtime:null,provenanceHeadRef:null};
 planCells(f,[[1,'workspace.bind'],[2,'interface.generate']]);
 const request=current(f,{operatorId:'workspace.bind',contexts:[{alias:`@workspaces/projects/${project}/fe`,head:null},{alias:`@workspaces/local/routes/${project}/fe`,head},{alias:'@workspaces/device-state',head:null}],requirements:{project,role,gitPolicy,declaredWriteRoots:writeRoots,resume:null},inputs:{}},1,{goal:{prerequisite:'2/1'},workspace:false,mode:'inline'});
 const dir=await open(f,request);put(path.join(dir,'response/data/route.json'),route);
 const receipt='# workspace-route-binding — '+project+'/fe\n'+table('Binding',['Field','Value'],[['Project',project],['Role',role],['Portable route',portableRouteRef],['Hydrated route',hydratedRouteRef],['Source head',head]])+table('Checkout',['Field','Value'],[['Disk path',disk],['Git root',disk],['Git repository',repository],['Branch',sessionBranch],['Repository kind','source'],['Directory','—'],['Source head',head],['Mutation readiness','ready'],['Businesses root','—'],['Installed tree','absent']])+table('Policy',['Field','Value'],[['Worktree branches','session-only'],['Mutation branch',sessionBranch]])+table('Write roots',['Path','Why'],writeRoots.map(root=>[root,'The exact existing disposable form subtree.']))+table('Runtime',['Field','Value'])+table('Findings',['Code','Subject','Statement'],[['`ROUTE_HYDRATED_FROM_PORTABLE`',hydratedRouteRef,'The declared route names the actual checkout.'],['`IDENTITY_ROSTER_SEALED`','anonymous','The fixture has no credentials.'],['`WORKTREE_BRANCH_SESSION_ONLY`',sessionBranch,'The actual branch is isolated.']]);
 put(path.join(dir,'response/response.md'),receipt);await accept(f,request,actual(request,{fields:{'workspace-route-binding':'response/response.md',route:'response/data/route.json'},fallbacks:[],commits:[],next:['interface.generate']},'done',['response/response.md'],'sol-fresh'));
 return route;
}

test('current FE admission joins native branch aliases and subtree declarations to its exact accepted route', {timeout:180000},async t=>{
 const f=await createInterfaceFixture(t,{sessionId:'scope-interface',mission:({discovery})=>({discovery:{...discovery,impacts:discovery.impacts.map(impact=>({...impact,code:['project-ledger:step-27/claims','apps/{chatbot,accounting}/src/**']}))}})});
 await interfaceBinding(f);
 const bindings=['@knowledge/ui/composition','@knowledge/ui/presentation','@knowledge/ui/proof','@knowledge/grammars/<family>'],head=git(f.feWorktree,'rev-parse','HEAD');
 const contexts=[{alias:'@workspaces/fe',head},{alias:'@grammar/core',head:null},...bindings.map(alias=>({alias:alias.replace('<family>','starci'),head:null}))];
 const r=current(f,{operatorId:'interface.generate',contexts,requirements:{target:'/fixture',intent:'modify',changeLevel:'refine',ownerCeiling:'surface-only',candidates:1,preview:'no',references:[],selectionPolicy:'automatic',approval:null,maxRounds:2,contractEmission:'off',mode:'apply',resume:null},inputs:{}},2,{goal:{doneWhen:2}});
 r.environment.workspace={alias:'@workspaces/fe',worktree:f.feWorktree,revision:head};
 r.environment.writes=['@workspaces/fe/branch/session/src/modules/fixture/page.html','@workspaces/fe/branch/session/src/modules/fixture/[locale]/**','@workspaces/fe/branch/session/src/modules/fixture/protected/new.mjs','@workspaces/fe/branch/session/src/unbound/new.mjs','response'];
 r.environment.exclusive=[path.join(f.feWorktree,INTERFACE_PAGE),path.join(f.feWorktree,'src/modules/fixture/[locale]'),path.join(f.feWorktree,'src/unbound')];
 const dir=branch(f,2),before=readFileSync(path.join(f.feWorktree,INTERFACE_PAGE),'utf8');put(path.join(dir,'request/before.html'),before);
 const {buildKnowledgeManifest}=await f.load('scripts/knowledge-manifest.mjs');put(path.join(dir,'request/knowledge-manifest.json'),buildKnowledgeManifest(f.root,bindings,{family:'starci'}));
 const pkg=read(path.join(f.feWorktree,'vendor/grammar/provenance.json'));
 put(path.join(dir,'request/family-understanding.json'),{schemaVersion:10,grammarId:'starci',packageBinding:{name:pkg.name,version:pkg.version,sourceRef:pkg.sourceRef},authoritySplit:{common:'Published Common CSS owns foundations.',family:'Published Core CSS owns scoped tokens.',product:'The disposable native form owns its existing behavior.'},visualPrinciples:[{principle:'Keep the existing native form and its published values.',source:'knowledge/grammars/starci/family.md'}],businessShape:{shape:'Existing anonymous native transformation form.',fit:'composed',source:'request/before.html'},reuse:[{concept:'Reuse the existing form and published Core CSS.',owner:'product',source:'request/before.html'}],ownerSearch:{common:['knowledge/grammars/starci/DNA.md'],family:['knowledge/grammars/starci/family.md'],product:[INTERFACE_PAGE],gaps:[]},decision:'reuse',deltas:{props:[],anatomy:[],tokens:[],claims:[],classes:[]},consumers:['/fixture'],compatibility:'No source is written by this admission test.',proof:{before:'request/before.html',after:'response/artifacts/form.html'},knowledgeChallenges:[],rollback:'No mutation is made.'});
 r.frozenInputs=['request/knowledge-manifest.json','request/family-understanding.json','request/before.html'].map(ref=>({ref,sha256:sha(readFileSync(path.join(dir,ref)))}));await open(f,r);
 const coordinator=await createSourceFixture(t,{existing:f,sessionId:'fe-scope-coordinator',topology:{mode:'coordinated'},mission:{goal:'Coordinate the declared frontend boundary.',doneWhen:[{producedBy:'workflow.verify',evidence:'Verify exact frontend ownership.'}]}});
 const api=await f.load('scripts/workflow-coordination.mjs');await api.enrolWorkflow(f.root,f.session,coordinator.sessionId);
 const roots=api.requestRoots(f.state(),r);assert.ok(roots.some(item=>item.root==='src/modules/fixture/[locale]'));assert.ok(roots.every(item=>!item.root.startsWith('branch/session')));
 const unreserved={...r,environment:{...r.environment,writes:['@workspaces/fe/branch/other/src/file.mjs']}};assert.equal(api.requestRoots(f.state(),unreserved)[0].root,'branch/other/src/file.mjs','only the registered session segment is substituted');
 const assign=(root,role='fe')=>api.assignWorkflows(f.root,coordinator.session,{id:'fe-owner',claims:[{sessionId:f.sessionId,role,root}]});
 for(const root of ['src/modules/fixture/protected/new.mjs','src/unbound/new.mjs','src/modules/fixture/undeclared.mjs','project-ledger:step-27/claims'])await assert.rejects(assign(root),/COORDINATION_SCOPE|COORDINATION_ROOT/,root);
 await assert.rejects(assign(INTERFACE_PAGE,'be'),/COORDINATION_SCOPE/);
 const requestFile=path.join(dir,'request/request.json'),bytes=readFileSync(requestFile);
 try{put(requestFile,{...r,environment:{...r.environment,exclusive:[f.feWorktree]}});await assert.rejects(assign(INTERFACE_PAGE),/hash|immutable|invocation|COORDINATION_SCOPE/);}finally{put(requestFile,bytes);}
 const address=await assign('src/modules/fixture/[locale]/shared'),record=read(path.join(coordinator.session,address.ref));assert.equal(record.claims[0].authority.kind,'admitted-source-root');assert.equal(record.claims[0].authority.shape,'subtree');assert.equal(record.claims[0].authority.binding.step,1);
 assert.equal(f.state().attempts['2/1'].status,'running','the admitted source is not delivered');assert.equal(git(f.feWorktree,'status','--porcelain'),'');
});
