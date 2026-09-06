import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterfaceFixture,interfaceBaseFiles,INTERFACE_PAGE,startInterfaceRuntime,acceptInterfaceRoute,acceptInterface} from './workflow-interface-fixture.mjs';
import {current,actual,open,accept,branch,read,put,git,commit,sha,table} from './workflow-source-fixture.mjs';
import {runSourceReviewLifecycle,revision,forecastOf,sealForecast} from './source-review-fixture.mjs';
const run=promisify(execFile),WRITER='src/modules/fixture/worker.mjs',q=value=>'`'+value+'`';

async function frontendDiagnostic(f,subject,forecast,cell,method,counterpart) {
 const step=Number(cell.split('/')[0]),dir=branch(f,step),review=forecast.sourceReviews[cell],head=subject.head;
 put(path.join(dir,review.method.ref),method);
 const contexts=[{alias:'@workspaces/fe',head},{alias:'@workspaces/be',head:counterpart.head}];
 const request=current(f,{operatorId:'quality.verify',contexts,requirements:forecast.presets[cell],inputs:{'frontend-source-application':subject.ref}},step,{goal:forecast.goals[cell],mode:'inline'});
 request.environment.workspace={alias:'@workspaces/fe',worktree:f.feWorktree,revision:head};request.frozenInputs=[review.method];
 await open(f,request);
 let observed;try{await run(process.execPath,[path.join(dir,review.method.ref)],{cwd:f.feWorktree,windowsHide:true,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST_')))});}catch(error){observed=error;}
 assert.equal(observed?.code,1);assert.match(observed.stderr,/actual frontend result assignment must consume the served backend value/);
 assert.equal(git(f.feWorktree,'rev-parse','HEAD'),head);assert.equal(git(f.worktree,'rev-parse','HEAD'),counterpart.head);
 const gate=review.gates[0];put(path.join(dir,'response/artifacts/integration.log'),observed.stdout+observed.stderr);
 put(path.join(dir,'response/data/gates/integration.json'),{...gate,sourceHead:head,predecessorCommit:head,sessionBranch:git(f.feWorktree,'branch','--show-current'),observedAt:new Date().toISOString(),status:'fail',exitCode:observed.code,evidenceRef:'response/artifacts/integration.log',classification:'in-boundary',sonarScope:null,debt:null,statement:'The emitted frontend result assignment reads a different property from the actual backend JSON response.'});
 put(path.join(dir,'response/data/write-set.txt'),INTERFACE_PAGE+'\n');
 const swept=await run(process.execPath,[path.join(f.root,'scripts/sweep-presentation.mjs'),f.feWorktree,'--write-set',path.join(dir,'response/data/write-set.txt'),'--json'],{cwd:f.feWorktree,windowsHide:true});
 assert.deepEqual(JSON.parse(swept.stdout).findings,[]);put(path.join(dir,'response/artifacts/presentation-sweep.log'),swept.stdout);
 const sweep=review.gates[1];put(path.join(dir,'response/data/gates/presentation-sweep.json'),{...sweep,sourceHead:head,predecessorCommit:head,sessionBranch:git(f.feWorktree,'branch','--show-current'),observedAt:new Date().toISOString(),status:'pass',exitCode:0,evidenceRef:'response/artifacts/presentation-sweep.log',classification:null,sonarScope:null,debt:null,statement:'The actual presentation sweep found no source conformance violation; browser verdicts remain unobserved.'});
 put(path.join(dir,'response/response.md'),`# quality-verification — ${head}\n`
 +table('Binding',['Field','Value'],[['Operator','quality.verify'],['Step',`step-${step}/parallel-1`],['Checkout','@workspaces/fe'],['Head',head],['Session branch',git(f.feWorktree,'branch','--show-current')],['Predecessors',subject.ref]])
 +table('Gate plan',['Gate','Required','Command','Configuration'],review.gates.map(item=>[q(item.gate),'yes',item.commandRef,item.configRef]))
 +table('Results',['Gate','Status','Exit code','Evidence','Classification','Statement'],[[q('integration'),'fail',observed.code,'response/artifacts/integration.log','in-boundary','The actual frontend assignment misses the returned JSON value.'],[q('presentation-sweep'),'pass',0,'response/artifacts/presentation-sweep.log','—','The actual source sweep passed.']])
 +table('Coverage',['Metric','Measured','Threshold','Verdict'])+table('Sonar',['Field','Value'],[['Scope','new-code'],['Finding','—']])
 +table('Debts',['Debt','Gate','Approval','Owner','Expires','Statement'])+table('Findings',['Code','Gate','Statement'],[[q('PREDECESSOR_CONSUMED'),'—','The exact accepted frontend source and corrected backend counterpart are measured.']])
 +table('Gate verdict',['Field','Value'],[['Verdict',q('fail')]])+table('Verdict',['Topic','Verdict','Route'],['presentation','composition','responsive','motion','accessibility','contrast','render-truth','taste','experience'].map(topic=>[q(topic),'blocked','none']))+'\nVerdict: blocked\n'
 +table('Audit scope',['Field','Value'],[['Mode','not-recorded'],['Coverage claim','not-recorded'],['Deferred states','—']]));
 await accept(f,request,actual(request,{fields:{'quality-verification':'response/response.md','gate-result':['response/data/gates/integration.json','response/data/gates/presentation-sweep.json']},fallbacks:[],commits:[],next:['interface.generate']},'done',['response/response.md','response/data/gates/integration.json','response/data/gates/presentation-sweep.json']));
 return {step,dir,request};
}

async function sealCompleteSourceForecast(f,source) {
 await sealForecast(f,source);
 const {readContext,retainContext}=await f.load('scripts/mission-history.mjs');
 const state=f.state(),record=readContext(f.session,state.planHistory.active,'plans'),forecast=record.forecast;
 const tail=[[12,'runtime.serve',7],[13,'interface.audit',3],[14,'quality.verify',4],[15,'uat.plan',null],[16,'uat.verify',5]];
 for(const [step,operator,goal] of tail){const cell=step+'/1';forecast.chain.push([cell]);forecast.steps[cell]=operator;forecast.nodes[cell]=cell;forecast.goals[cell]=goal===null?{prerequisite:'16/1'}:{doneWhen:goal};forecast.presets[cell]={};forecast.dependencies[cell]=[];forecast.evidenceDependencies[cell]=[];}
 forecast.presets['12/1']={routeKey:state.project+'/fe',env:'dev',operation:'serve'};
 for(const cell of ['15/1','16/1'])forecast.presets[cell]={access:'anonymous',fixtures:'none',sourceRoles:'full'};
 const dependencies={'12/1':['11/1'],'13/1':['11/1','10/1','12/1'],'14/1':['11/1','13/1'],'15/1':['11/1','14/1'],'16/1':['7/1','4/1','11/1','10/1','13/1','14/1','15/1','12/1']};
 for(const [cell,parents] of Object.entries(dependencies)){forecast.dependencies[cell]=parents;forecast.evidenceDependencies[cell]=parents;}
 forecast.handoffs['12/1']='11/1';forecast.handoffs['13/1']='11/1';forecast.handoffs['14/1']='13/1';forecast.evidenceDependencies['15/1']=[];forecast.handoffs['16/1']='15/1';forecast.fanout['16/1']='units';
 state.chain=forecast.chain;state.steps=forecast.steps;state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));record.planned=state.planned;
 const address=await retainContext(f.session,'plans',record);state.planHistory={active:address,revisions:[address]};put(path.join(f.session,'state.json'),state);
}

test('accepted BE and FE repair sequentially from actual red diagnostics while the original goal and both source histories remain intact',async t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'starci-source-review-fe-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const repository=path.join(home,'frontend'),worktree=path.join(home,'frontend-session');fs.mkdirSync(repository);git(repository,'init','-q');
 const files=await interfaceBaseFiles();files[INTERFACE_PAGE]=files[INTERFACE_PAGE].replaceAll('data.value','data.output');
 for(const [file,bytes] of Object.entries(files))put(path.join(repository,file),bytes);
 put(path.join(repository,'.gitignore'),'.worktrees/sessions/\n.worktrees/e2e/\n');put(path.join(repository,'package.json'),{private:true,type:'module',scripts:{build:'node --check src/modules/fixture/verify.mjs'}});
 put(path.join(repository,'src/modules/fixture/verify.mjs'),"import assert from 'node:assert/strict';import fs from 'node:fs';const html=fs.readFileSync('src/modules/fixture/page.html','utf8');assert.ok(html.includes('aria-label=\"Result\"'));console.log('Actual labelled source output exists; no API assertion was made.');\n");
 const base=commit(repository,'Preexisting form with a missed JSON field contract case');git(repository,'remote','add','origin',repository);git(repository,'worktree','add','--quiet','-b','session/source-review-frontend',worktree,base);
 let frontend,runtime,route,goalBytes;
 const checkpoint=async({phase,f,original,repaired,coverage})=>{
  const {goalLedger}=await f.load('scripts/validate-session.mjs'),ledger=await goalLedger(f.session,f.state(),f.root);
  assert.equal(JSON.stringify(f.state().mission),goalBytes);
  assert.deepEqual(coverage.errors,[]);
  if(phase==='scheduled'||phase==='red')assert.equal(ledger.find(row=>row.branch===`${original.step}/1`).achieved,false);
  if(phase==='repaired'){assert.equal(ledger.find(row=>row.branch===`${original.step}/1`).achieved,false);assert.equal(ledger.find(row=>row.branch===`${repaired.step}/1`).achieved,true);}
  assert.equal(ledger.find(row=>row.branch===`${frontend.step}/1`).achieved,false,'the original frontend cannot close while its exact backend relationship needs re-review');
  console.log(`source-review lifecycle: backend ${phase}; frontend proof remains pending`);
 };
 const backend=await runSourceReviewLifecycle(t,{seal:sealCompleteSourceForecast,createFixture:async()=>createInterfaceFixture(t,{sessionId:'source-review-frontend',feExisting:{repository,worktree}}),afterOriginal:async({f,original})=>{
  goalBytes=JSON.stringify(f.state().mission);
  runtime=await startInterfaceRuntime(t,f,{worker:value=>{const code=fs.readFileSync(path.join(f.worktree,WRITER),'utf8');return new Function(code.replace('export function','function')+';return runFixtureWorker;')()(value);}});
  route=await acceptInterfaceRoute(f);
  frontend=await acceptInterface(f,runtime,route,{beforeRequest:({request})=>{request.inputs['backend-source-application']=original.ref;}});
 },checkpoint,expectedPendingAfterRepair:()=>[`${frontend.step}/1`]});
 const {f,repaired:be}=backend,originalManifest=f.state().attempts[`${frontend.step}/1`].evidenceManifest,api=await f.load('scripts/source-review.mjs');
 const method=`import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';const worktree=${JSON.stringify(f.worktree)},expected=${JSON.stringify(be.head)};const head=()=>execFileSync('git',['-C',worktree,'rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(head(),expected);const html=fs.readFileSync(${JSON.stringify(path.join(f.feWorktree,INTERFACE_PAGE))},'utf8');const expression=/result\\.textContent = (data\\.[A-Za-z]+ \\|\\| '\\(empty result\\)');/.exec(html);assert.ok(expression,'actual emitted result assignment exists');const response=await fetch(${JSON.stringify(runtime.origin+'/api?value=hello')});assert.equal(response.status,200);const data=await response.json();assert.equal(data.value,'HELLO');const rendered=new Function('data','return ('+expression[1]+')')(data);assert.equal(rendered,data.value,'actual frontend result assignment must consume the served backend value');assert.equal(head(),expected);console.log(JSON.stringify({backendHead:expected,response:data,rendered}));\n`;
 const methodBinding={ref:'request/frontend-contract.mjs',sha256:sha(method)},edit={kind:'review',cell:`${frontend.step}/1`,criterionId:'delivery',method:methodBinding,gates:[{gate:'integration',required:true,commandRef:'node request/frontend-contract.mjs',configRef:'request/frontend-contract.mjs'},{gate:'presentation-sweep',required:true,commandRef:'node scripts/sweep-presentation.mjs . --write-set response/data/write-set.txt --json',configRef:INTERFACE_PAGE}],counterparts:[`${be.step}/1`]};
 const retainedBudget=structuredClone(f.state().budget);
 assert.equal(retainedBudget.maxSameOperator,4);
 let forecast=await revision(f,edit),reviewCell=Object.keys(forecast.sourceReviews).find(cell=>forecast.sourceReviews[cell].subject.cell===edit.cell);
 assert.equal(Object.values(forecast.steps).filter(operator=>operator==='quality.verify').length,4,'two delivery gates and two source reviews retain the original finite budget');
 assert.deepEqual(f.state().budget,retainedBudget,'rescheduling unopened coordinates does not require an artificial budget extension');
 const review=await frontendDiagnostic(f,frontend,forecast,reviewCell,method,be);
 console.log('source-review lifecycle: actual frontend red diagnostic accepted');
 const repairEdit={kind:'source-repair',cell:edit.cell,review:reviewCell,gateRef:'response/data/gates/integration.json',replacements:{'backend-source-application':`${be.step}/1`}};
 try { forecast=await revision(f,repairEdit); } catch(error) {
  const plans=await f.load('scripts/plan-history.mjs'),state=f.state(),projected=await plans.editForecast(f.root,f.session,state,structuredClone(forecast),repairEdit,Math.max(...Object.keys(state.attempts).map(cell=>Number(cell.split('/')[0]))));
  console.error(JSON.stringify({repairOrdering:projected.chain.flat().map(cell=>({cell,operator:projected.steps[cell],accepted:state.attempts[cell]?.status,dependencies:projected.dependencies[cell],evidenceDependencies:projected.evidenceDependencies[cell],goal:projected.goals[cell]})),source:edit.cell,review:reviewCell,backend:be.step}));throw error;
 }
 const repairCell=Object.keys(forecast.sourceRepairs).find(cell=>forecast.sourceRepairs[cell].source===edit.cell),step=Number(repairCell.split('/')[0]);
 const repaired=await acceptInterface(f,runtime,route,{step,goal:forecast.goals[repairCell],transform:html=>html.replaceAll('data.output','data.value'),description:'Consume the exact returned backend JSON value without changing the established surface.',beforeRequest:({request,dir})=>{
  request.attempt={id:`${step}/1:a2`,number:2,kind:'repair',previous:frontend.request.attempt.id};request.expected=structuredClone(frontend.request.expected);
  request.inputs['backend-source-application']=be.ref;request.frozenInputs.push(methodBinding);put(path.join(dir,methodBinding.ref),method);
 }});
 assert.notEqual(repaired.head,frontend.head);assert.equal(git(f.feWorktree,'rev-parse',`${repaired.head}^`),frontend.head);
 console.log('source-review lifecycle: frontend replacement accepted with its new normal commit');
 const checked=await run(process.execPath,[path.join(review.dir,methodBinding.ref)],{cwd:f.feWorktree,windowsHide:true});assert.match(checked.stdout,/HELLO/);
 const coverage=await api.sourceReviewCoverage(f.root,f.session,f.state(),await forecastOf(f));assert.deepEqual(coverage.errors,[]);assert.deepEqual(coverage.pending,[]);assert.ok(coverage.retiredSources.includes(edit.cell));
 const {goalLedger,validateSession}=await f.load('scripts/validate-session.mjs'),ledger=await goalLedger(f.session,f.state(),f.root);assert.equal(ledger.find(row=>row.branch===edit.cell).achieved,false);assert.equal(ledger.find(row=>row.branch===repairCell).achieved,true);
 assert.deepEqual((await validateSession(f.root,f.session)).errors,[],'the full current session remains valid after both repairs with its original future delivery obligations');
 assert.deepEqual(f.state().attempts[edit.cell].evidenceManifest,originalManifest);assert.equal(JSON.stringify(f.state().mission),goalBytes);
 assert.notEqual(f.repository,f.feRepository);assert.ok(runtime.observed.some(item=>item.value==='hello'));
});
