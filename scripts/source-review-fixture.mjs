import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createSourceFixture, acceptArchitecture, acceptBackend, current, actual, open, accept, branch, read, put, git, sha, table, planCells } from './workflow-source-fixture.mjs';

const WRITER='src/modules/fixture/worker.mjs', TEST='src/modules/fixture/worker.spec.mjs';
const testSource="import test from 'node:test'; import assert from 'node:assert/strict'; import {runFixtureWorker} from './worker.mjs'; test('normal, invalid, repeated and concurrent input', async()=>{assert.equal(runFixtureWorker('hello'),'HELLO'); assert.equal(runFixtureWorker(''),''); for(const input of [null,undefined,1,{}]) assert.throws(()=>runFixtureWorker(input),TypeError); assert.deepEqual(await Promise.all(['a','b','a'].map(value=>Promise.resolve(runFixtureWorker(value)))),['A','B','A']);});\n";
const source=(trim=false)=>`export function runFixtureWorker(input) { if(typeof input!=='string') throw new TypeError('input must be a string'); return input${trim?'.trim()':''}.toUpperCase(); }\n`;

export async function sealForecast(f, source) {
  const {retainContext}=await f.load('scripts/mission-history.mjs'),{scopeHash}=await f.load('scripts/mission-scope.mjs');
  planCells(f,[[source.step+1,'quality.verify'],[source.step+2,'runtime.serve'],[source.step+3,'api.verify']]);
  const state=f.state(),forecast={chain:state.chain,steps:state.steps,goals:{},presets:{},nodes:{},dependencies:{},evidenceDependencies:{},reasons:{},imports:{},fanout:{},handoffs:{},resumes:{}};
  for(const cell of state.chain.flat()) {
    const step=Number(cell.split('/')[0]),r=state.attempts[cell] ? read(path.join(branch(f,step),'request/request.json')) : {goal:{doneWhen:1},requirements:{}};
    forecast.goals[cell]=r.goal;forecast.presets[cell]=r.requirements;forecast.nodes[cell]=cell;
    forecast.dependencies[cell]=step===1?[]:['1/1'];forecast.evidenceDependencies[cell]=[];
    if(r.resume)forecast.resumes[cell]=`${r.resume.step}/${r.resume.parallel}`;
    if(step===source.step+1){forecast.dependencies[cell]=[`${source.step}/1`];forecast.evidenceDependencies[cell]=[`${source.step}/1`];forecast.handoffs[cell]=`${source.step}/1`;}
    if(step===source.step+2){forecast.goals[cell]={prerequisite:`${source.step+3}/1`};forecast.presets[cell]={routeKey:`${state.project}/be`};forecast.dependencies[cell]=[`${source.step}/1`];forecast.evidenceDependencies[cell]=[`${source.step}/1`];forecast.handoffs[cell]=`${source.step}/1`;}
    if(step===source.step+3){forecast.goals[cell]={doneWhen:state.mission.doneWhen.findIndex(item=>item.producedBy==='api.verify')};forecast.dependencies[cell]=[`${source.step+2}/1`];forecast.evidenceDependencies[cell]=[`${source.step+2}/1`];forecast.handoffs[cell]=`${source.step+2}/1`;}
  }
  state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
  const address=await retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:state.mission.version,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});
  state.planHistory={active:address,revisions:[address]}; put(path.join(f.session,'state.json'),state);
}
export async function revision(f,edit) {
  const plans=await f.load('scripts/plan-history.mjs'),flags={edit};
  const preview=await plans.previewRevision(f.root,f.session,flags);
  const committed=await plans.commitRevision(f.root,f.session,{previewHash:preview.previewHash,reason:'Measure and repair the same confirmed source contract while preserving accepted evidence.',flags});
  assert.deepEqual(committed.forecast,preview.forecast); return committed.forecast;
}
export const forecastOf=async f=>(await f.load('scripts/plan-history.mjs')).activePlanView(f.session,f.state()).forecast;
const methodFor=f=>`import assert from 'node:assert/strict'; import {runFixtureWorker} from ${JSON.stringify(pathToFileURL(path.join(f.worktree,WRITER)).href)}; assert.equal(runFixtureWorker(' hello '),' HELLO ','uppercase must preserve surrounding input characters'); console.log('Actual declared worker preserves whitespace');\n`;

export async function diagnostic(f,subject,forecast,cell,method,{expectedExit=1}={}) {
  const step=Number(cell.split('/')[0]),dir=branch(f,step),review=forecast.sourceReviews[cell],head=subject.head;
  put(path.join(dir,review.method.ref),method);
  const request=current(f,{operatorId:'quality.verify',contexts:[{alias:'@workspaces/be',head}],requirements:forecast.presets[cell],inputs:{'backend-source-application':subject.ref}},step,{goal:forecast.goals[cell],mode:'inline'});
  request.frozenInputs=[review.method];
  await open(f,request);
  const ran=spawnSync(process.execPath,[path.join(dir,review.method.ref)],{cwd:f.worktree,encoding:'utf8',windowsHide:true,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST_')))});
  assert.equal(ran.error,undefined); assert.equal(ran.status,expectedExit); if(expectedExit) assert.match(ran.stderr,/uppercase must preserve surrounding input characters/);
  assert.equal(git(f.worktree,'rev-parse','HEAD'),head);
  const gate=review.gates[0],output=ran.stdout+ran.stderr; put(path.join(dir,'response/artifacts/integration.log'),output);
  const status=expectedExit?'fail':'pass',classification=expectedExit?'in-boundary':null;
  const statement=expectedExit?'The actual worker violates its declared string transformation contract by dropping whitespace.':'The actual worker preserves the declared string input characters.';
  put(path.join(dir,'response/data/gates/integration.json'),{...gate,sourceHead:head,predecessorCommit:head,sessionBranch:git(f.worktree,'branch','--show-current'),observedAt:new Date().toISOString(),status,exitCode:ran.status,evidenceRef:'response/artifacts/integration.log',classification,sonarScope:null,debt:null,statement});
  put(path.join(dir,'response/response.md'),`# quality-verification — ${head}\n`
    +table('Binding',['Field','Value'],[['Operator','quality.verify'],['Step',`step-${step}/parallel-1`],['Checkout','@workspaces/be'],['Head',head],['Session branch',git(f.worktree,'branch','--show-current')],['Predecessors',subject.ref]])
    +table('Gate plan',['Gate','Required','Command','Configuration'],[['`integration`','yes',gate.commandRef,gate.configRef]])
    +table('Results',['Gate','Status','Exit code','Evidence','Classification','Statement'],[['`integration`',status,ran.status,'response/artifacts/integration.log',classification??'—',statement]])
    +table('Coverage',['Metric','Measured','Threshold','Verdict'])+table('Sonar',['Field','Value'],[['Scope','new-code'],['Finding','—']])
    +table('Debts',['Debt','Gate','Approval','Owner','Expires','Statement'])
    +table('Findings',['Code','Gate','Statement'],[['`PREDECESSOR_CONSUMED`','—','Exact accepted source is measured without modifying it.']])
    +table('Gate verdict',['Field','Value'],[['Verdict','`'+status+'`']])
    +table('Verdict',['Topic','Verdict','Route'],['presentation','composition','responsive','motion','accessibility','contrast','render-truth','taste','experience'].map(topic=>['`'+topic+'`','not-applicable','none']))+'\nVerdict: ship\n'
    +table('Audit scope',['Field','Value'],[['Mode','not-recorded'],['Coverage claim','not-recorded'],['Deferred states','—']]));
  await accept(f,request,actual(request,{fields:{'quality-verification':'response/response.md','gate-result':['response/data/gates/integration.json']},fallbacks:[],commits:[],next:[expectedExit?'backend.generate':'git.publish']},'done',['response/response.md','response/data/gates/integration.json']));
  return {step,request,dir};
}

export async function runSourceReviewLifecycle(t,{checkpoint=async()=>{},createFixture=t=>createSourceFixture(t,{sessionId:'source-review'}),afterOriginal=async()=>{},seal=sealForecast,expectedPendingAfterRepair=[]}={}) {
  const f=await createFixture(t),architecture=await acceptArchitecture(f);
  // The original real test suite misses a whitespace case. Its acceptance is preserved as observed;
  // the new independently executed diagnostic discovers the concrete contract violation.
  const original=await acceptBackend(f,architecture,{files:{[WRITER]:source(true),[TEST]:testSource}});
  const manifest=f.state().attempts[`${original.step}/1`].evidenceManifest;
  await afterOriginal({f,original,architecture});
  await seal(f,original);
  const method=methodFor(f),methodBinding={ref:'request/source-contract.mjs',sha256:sha(method)};
  const edit={kind:'review',cell:`${original.step}/1`,criterionId:'delivery',method:methodBinding,gates:[{gate:'integration',required:true,commandRef:'node request/source-contract.mjs',configRef:'request/source-contract.mjs'}]};
  const plans=await f.load('scripts/plan-history.mjs'),api=await f.load('scripts/source-review.mjs');
  await assert.rejects(plans.previewRevision(f.root,f.session,{edit:{...edit,criterionId:'not-original'}}),/original required source criterion/);
  let forecast=await revision(f,edit),reviewCell=Object.keys(forecast.sourceReviews)[0];
  let coverage=await api.sourceReviewCoverage(f.root,f.session,f.state(),forecast); assert.deepEqual(coverage.errors,[]);assert.equal(coverage.pending[0].sourceCell,`${original.step}/1`);
  await checkpoint({phase:'scheduled',f,original,forecast,coverage});
  const consumer=forecast.goals[reviewCell].prerequisite,request=current(f,{operatorId:'quality.verify',contexts:[{alias:'@workspaces/be',head:original.head}],requirements:{},inputs:{'backend-source-application':original.ref}},Number(consumer.split('/')[0]),{goal:forecast.goals[consumer],mode:'inline'});
  assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),request,forecast)).join('\n'),/SOURCE_REVIEW_PENDING/);
  await assert.rejects(revision(f,{kind:'source-repair',cell:edit.cell,review:reviewCell,gateRef:'response/data/gates/integration.json'}),/executed required in-boundary red gate/);
  const review=await diagnostic(f,original,forecast,reviewCell,method);
  coverage=await api.sourceReviewCoverage(f.root,f.session,f.state(),forecast);assert.deepEqual(coverage.errors,[]);assert.deepEqual(coverage.retiredSources,[edit.cell]);
  await checkpoint({phase:'red',f,original,review,forecast,coverage});
  forecast=await revision(f,{kind:'source-repair',cell:edit.cell,review:reviewCell,gateRef:'response/data/gates/integration.json'});
  const repairCell=Object.keys(forecast.sourceRepairs)[0],step=Number(repairCell.split('/')[0]);
  const repaired=await acceptBackend(f,architecture,{step,goal:forecast.goals[repairCell],files:{[WRITER]:source(false),[TEST]:testSource+"test('whitespace contract regression',()=>assert.equal(runFixtureWorker(' hello '),' HELLO '));\n"},beforeRequest:async({request,dir})=>{
    request.attempt={id:`${step}/1:a2`,number:2,kind:'repair',previous:original.request.attempt.id};
    request.expected=structuredClone(original.request.expected); request.frozenInputs=[methodBinding];put(path.join(dir,methodBinding.ref),method);
    const widened=structuredClone(request);widened.environment.writes.push('@workspaces/be/unrelated.mjs');
    assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),widened,forecast)).join('\n'),/expand effect/);
  }});
  assert.notEqual(repaired.head,original.head);assert.equal(git(f.worktree,'rev-parse',`${repaired.head}^`),original.head);
  const rerun=spawnSync(process.execPath,[path.join(review.dir,methodBinding.ref)],{cwd:f.worktree,encoding:'utf8',windowsHide:true});assert.equal(rerun.status,0,rerun.stderr);
  coverage=await api.sourceReviewCoverage(f.root,f.session,f.state(),forecast);assert.deepEqual(coverage.errors,[]);assert.deepEqual(coverage.pending.map(item=>item.sourceCell),typeof expectedPendingAfterRepair==='function'?expectedPendingAfterRepair({f,original,repaired,forecast}):expectedPendingAfterRepair);assert.deepEqual(coverage.retiredSources,[edit.cell]);
  assert.deepEqual(f.state().attempts[edit.cell].evidenceManifest,manifest);
  const {evidenceManifestErrors}=await f.load('scripts/evidence-manifest.mjs'); assert.deepEqual(await evidenceManifestErrors(branch(f,original.step),manifest),[]);
  await checkpoint({phase:'repaired',f,original,repaired,review,forecast,coverage});
  return {f,original,repaired,review,forecast};
}
