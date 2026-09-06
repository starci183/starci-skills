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

export async function fixture(t, { selection = 'return', followupReading = false } = {}) {
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
 if(followupReading){state.choices['budget:review-sequence']={selected:'continue',selectedBy:'user',sourceRef:'user:fixture-authorized-review-sequence'};state.budget.extensions=[{decisionId:'budget:review-sequence',maxSteps:24,maxSameOperator:6}];}
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
 if(followupReading){forecast.chain.push(['4/1']);forecast.steps['4/1']='architecture.decide';forecast.goals['4/1']={doneWhen:0};forecast.presets['4/1']={...first.requirements,decisionId:'second-read-path'};forecast.dependencies['4/1']=['1/1'];forecast.evidenceDependencies['4/1']=[];forecast.nodes['4/1']='second-architecture';}
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const address=await retainContext(session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:state.mission.version,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:address,revisions:[address]};await save(state);
 return {root,session,read,save,branch,parent,files,first,text,waiting,review,actual,plans,waitingReviewBinding,resolvedWaitingAttemptKeys,openAttempt,acceptAttempt,acquireWorkerSlot,releaseWorkerSlot,restatementDecisionId,recordRestatementChoice,load};
}
