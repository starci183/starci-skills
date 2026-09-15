import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore} from '../kernel/store.mjs';
import {approve,createWorkflowState,goalPhase,needsWorkGate,stageExternalInputs} from '../kernel/kernel.mjs';
import {featureScope,intakeOp,narrowIntakeScopes,scopedLayers} from '../kernel/intake.mjs';
import {FRESH_MAX_AGE_MS,budgetIsFresh,freshRuntimeBudget,normalizeBudget,readRuntimeBudget,writeRuntimeBudget} from '../kernel/budget.mjs';
import * as llm from '../models/functions.mjs';

/**
 * Held-out checks for the three defects the first live trials of v1-alpha exposed, each driven through the public
 * goal path (`goalPhase` -> `workGoalPhase`/`planGoalPhase`, `approve`) rather than through a helper:
 *
 * 1. the goal phase read whatever `runtime-budget.json` a previous run left behind, so a stale file emptied the
 *    planner and validator pools and the goal was assessed and critiqued by nobody, with no model call made;
 * 2. a scope entry spelled `features/<f>/<layer>` became an intake over `features/features/<f>/<layer>`, and a
 *    `--reintake <f>` beside a two-layer scope became an intake over the whole feature;
 * 3. a goal with an empty definition of done and a critique nobody was asked for returned `ok:true` and was
 *    approvable.
 */

const DIGEST=letter=>letter.repeat(64);
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-goal-grounds-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const record=(id,kind,state,description)=>`schema: work/node@2
id: ${id}
kind: ${kind}
required: true
state: ${state}
description: ${description}
${state==='done'?`completion:
  inputDigest: ${DIGEST('a')}
  review:
    schema: starci/design-review@1
    reviewer: Root coordinator
    authority: The user accepted the record.
    reviewedAt: "2026-09-01T00:00:00.000Z"
    observations: []
    limitations: []
`:''}`;
const node=(id,where,kind,state)=>({id,path:where,kind,state,eligible:false,inputDigest:DIGEST('f'),dependsOn:[],refs:[],blockedBy:[],children:[],completion:state==='done'?{inputDigest:DIGEST('a')}:null,
  authored:record(id,kind,state,`The ${kind} record ${id}.`)});

/** A tree with one feature decided (login: business and architecture) and one feature that has nothing yet. */
const TREE=[
  node('demo.login.business.overview','features/login/business/overview/index.yaml','business-overview','done'),
  node('demo.login.architecture.overview','features/login/architecture/overview/index.yaml','architecture','done'),
  node('demo.payments.business.overview','features/payments/business/overview/index.yaml','business-overview','done')
];

function workRepo(nodes=TREE){
  const repo=tmp();
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'@demo/backend'}));
  for(const item of nodes){
    const file=path.join(repo,'.starciwork',item.path);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,item.authored);
  }
  const validate=()=>({ok:true,errors:[],warnings:[],nodes:nodes.map(({authored,...rest})=>rest),resources:[]});
  return {repo,validate,cleanup:()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true})};
}

const events=store=>store.readEvents();

/** The receipt Orca prints for `account list --json`, with every window open. */
const OPEN_RECEIPT={ok:true,result:{rateLimits:{
  claude:{status:'ok',error:null,updatedAt:1,session:{usedPercent:0,windowMinutes:300,resetsAt:9e15},weekly:{usedPercent:10,windowMinutes:10080,resetsAt:9e15},fableWeekly:{usedPercent:12,windowMinutes:10080,resetsAt:9e15}},
  codex:{status:'ok',error:null,updatedAt:1,weekly:{usedPercent:45,windowMinutes:10080,resetsAt:9e15}}}}};

function setup({nodes=TREE,scope=[],reintake=[],ledgerMode='work',job='Design the remaining features',assessGoal,critiqueGoal,providers,runHeadless,budget,goalOptions={}}={}){
  const tree=workRepo(nodes);
  const worktree=tree.repo;
  const store=createStore({repoRoot:tree.repo,id:'20260915-goal-grounds'});
  const state=createWorkflowState({job,worktree,branch:'starci183/design',gates:[],store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode,scope,reintake,migrate:[],repoRoot:tree.repo});
  let goal,error=null;
  try{goal=goalPhase(store,state,{validate:tree.validate,cwd:worktree,
    ...(assessGoal!==undefined?{assessGoal}:{}),...(critiqueGoal!==undefined?{critiqueGoal}:{}),
    ...(providers!==undefined?{providers}:{}),...(runHeadless?{runHeadless}:{}),...(budget?{budget}:{}),...goalOptions});}
  catch(caught){error=caught;}
  return {...tree,store,state,goal,error};
}

const modelAssessed=({ledger=[]}={})=>({ok:true,provider:'fake-planner',attempts:[{provider:'fake-planner',attempt:0,errors:[]}],
  value:{definitionOfDone:[`the ${ledger.length} listed nodes and every intake are done`],difficulty:[],risks:[],questions:[]}});
const soundCritique=()=>({ok:true,verdict:'sound',provider:'fake-critic',attempts:[{provider:'fake-critic',attempt:0,errors:[]}],objections:[],required:[],alternatives:[],question:null,prerequisites:[],overlaps:[],provisions:[]});

/* ------------------------------------------------------------------ 2. scope normalization and intersection */

test('a scope entry is read as the tree reads it: feature and layers, in every spelling',()=>{
  assert.deepEqual(featureScope('login'),{feature:'login',layers:[],name:'login'});
  assert.deepEqual(featureScope('features/login'),{feature:'login',layers:[],name:'login'});
  assert.deepEqual(featureScope('features/login/business'),{feature:'login',layers:['business'],name:'login/business'});
  assert.deepEqual(featureScope('.starciwork/features/login/architecture/'),{feature:'login',layers:['architecture'],name:'login/architecture'});
  assert.equal(featureScope('demo.sales.intake'),null,'a node id is not a path into the feature tree');
  assert.equal(featureScope(''),null);
  assert.deepEqual(scopedLayers('login',['features/login/business','features/login/architecture','features/collab/business']),['business','architecture']);
  assert.deepEqual(scopedLayers('login',['login','features/login/business']),[],'a feature also named whole is the whole feature');
  assert.deepEqual(scopedLayers('login',[]),[],'no scope at all is the whole feature');
  assert.deepEqual(narrowIntakeScopes(['features/login/business','features/login/architecture','login','collab/business','brand']),['login','collab/business','brand']);
});

test('an intake over two approved layers writes exactly those layers: never a fake `features/features` feature, never the whole feature, never the module record',()=>{
  const harness=setup({
    scope:['features/login/business','features/login/architecture','features/workspace-dashboard/business','features/workspace-dashboard/architecture'],
    reintake:['login','workspace-dashboard'],
    assessGoal:modelAssessed,critiqueGoal:soundCritique});
  try{
    assert.equal(harness.error,null,harness.error?.message);
    assert.equal(harness.goal.ok,true);
    const intakes=harness.state.ops.filter(op=>op.intake);
    assert.deepEqual(intakes.map(op=>[op.id,op.intake.scope,op.intake.mode]).sort(),
      [['login-intake','login','reconcile'],['workspace-dashboard-intake','workspace-dashboard','author']],
      'one intake per feature: the drafts the tree holds are reconciled, the feature it lacks is authored');
    for(const op of intakes){
      assert.deepEqual(op.allowlist,[`.starciwork/features/${op.intake.scope}/business/**`,`.starciwork/features/${op.intake.scope}/architecture/**`],
        `${op.id} owns the two approved layers and nothing else`);
      assert.equal(op.allowlist.some(entry=>/features\/features\//.test(entry)),false,'no fake feature');
      assert.equal(op.allowlist.some(entry=>/index\.yaml$/.test(entry)),false,'the module record is outside a layer-restricted scope: the owner approved business and architecture, not the feature index');
      assert.match(op.goal,/business\/index\.yaml|shallowest/,'the reconciliation table is directed to a record the operation may write');
      assert.doesNotMatch(op.acceptance.join(' '),/module record of \S+ carries extensions\.work3\.reconciliation/,'the acceptance cannot demand a write outside the allowlist');
    }
    assert.deepEqual(events(harness.store).filter(event=>event.event==='intake-planned').map(event=>[event.op,event.scope,event.mode,event.allowlist.length]).sort(),
      [['login-intake','login','reconcile',2],['workspace-dashboard-intake','workspace-dashboard','author',2]]);
  }finally{harness.cleanup();}
});

test('a whole-feature scope keeps its whole-feature intake, with the module record inside it',()=>{
  const harness=setup({scope:['collab'],assessGoal:modelAssessed,critiqueGoal:soundCritique});
  try{
    const op=harness.state.ops.find(item=>item.intake);
    assert.deepEqual([op.id,op.intake.scope,op.intake.mode,op.allowlist],['collab-intake','collab','author',['.starciwork/features/collab/**']]);
    assert.match(op.acceptance.join(' '),/module record of collab carries extensions\.work3\.reconciliation/);
  }finally{harness.cleanup();}
});

test('a reintake of a feature the approved scope does not name is refused, not widened into an operation outside the scope',()=>{
  const harness=setup({scope:['features/login/business'],reintake:['login','payments'],assessGoal:modelAssessed,critiqueGoal:soundCritique});
  try{
    assert.ok(harness.error,'the goal phase refuses');
    assert.match(harness.error.message,/payments/);
    assert.match(harness.error.message,/scope/);
  }finally{harness.cleanup();}
});

test('retemplating an intake keeps the layers it was granted',()=>{
  const state={job:'j'};
  const loaded={list:[{path:'features/payments/business/overview/index.yaml',state:'done',kind:'business-overview',id:'p'}]};
  const first=intakeOp(state,{workRoot:'/w',loaded,index:0,entry:'login',scope:['features/login/business','features/login/architecture'],mode:'reconcile'});
  assert.deepEqual(first.intake.layers,['business','architecture']);
  const again=intakeOp(state,{workRoot:'/w',loaded,index:0,entry:first.intake.scope,scope:[],mode:'reconcile',layers:first.intake.layers});
  assert.deepEqual(again.allowlist,first.allowlist,'the granted layers travel with the op, the scope of the moment does not re-scope it');
});

/* ------------------------------------------------------------------ 1. the budget the goal phase reads */

test('a budget is fresh only inside the selector\'s own window; stale or future stamps are not',()=>{
  const now=1_000_000_000;
  assert.equal(budgetIsFresh({at:now-1000},{now}),true);
  assert.equal(budgetIsFresh({at:now-FRESH_MAX_AGE_MS-1},{now}),false);
  assert.equal(budgetIsFresh({at:now+5000},{now}),false,'a stamp from the future is not fresh');
  assert.equal(budgetIsFresh(null,{now}),false);
});

test('the goal phase refreshes a stale or missing budget through the probe and writes it; a failed probe leaves the file alone and answers no budget',()=>{
  const root=tmp();
  try{
    const workflows=path.join(root,'.starciwork','_local','workflows');
    const now=()=>5_000_000_000;
    // Missing file, probe answers: refreshed and written.
    let calls=0;
    const probe=()=>{calls+=1;return {ok:true,budget:normalizeBudget(OPEN_RECEIPT,{at:now()})};};
    const first=freshRuntimeBudget(workflows,{probe,now});
    assert.deepEqual([first.ok,first.source,first.refreshed,calls],[true,'probed',true,1]);
    assert.equal(readRuntimeBudget(workflows).at,now());
    // Fresh file: read, never probed.
    const second=freshRuntimeBudget(workflows,{probe:()=>{throw Error('must not probe a fresh file');},now});
    assert.deepEqual([second.ok,second.source,second.refreshed],[true,'file',false]);
    // Stale file, probe fails: the written file stands untouched and the answer is an honest refusal, never the stale numbers.
    writeRuntimeBudget(workflows,normalizeBudget(OPEN_RECEIPT,{at:now()-FRESH_MAX_AGE_MS*4}));
    const before=fs.readFileSync(path.join(workflows,'runtime-budget.json'),'utf8');
    const third=freshRuntimeBudget(workflows,{probe:()=>({ok:false,reason:'orca account list exited 1: not paired'}),now});
    assert.equal(third.ok,false);assert.equal(third.budget,null);
    assert.match(third.reason,/old and the provider quota could not be read: orca account list exited 1/);
    assert.equal(fs.readFileSync(path.join(workflows,'runtime-budget.json'),'utf8'),before);
    // A probe that throws is a reason too.
    assert.match(freshRuntimeBudget(workflows,{probe:()=>{throw Error('spawn orca ENOENT');},now}).reason,/spawn orca ENOENT/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('public goal path: a stale budget is refreshed before the planner and critic pools are chosen, and both are actually called',()=>{
  const answers={assessGoal:JSON.stringify({definitionOfDone:['login and workspace-dashboard are authored under the approved layers'],difficulty:[],risks:[],questions:[]}),
    critiqueGoal:JSON.stringify({verdict:'sound',objections:[],provisions:[],overlaps:[],required:[],alternatives:[],question:null,prerequisites:[]})};
  const called=[];
  const runHeadless=(provider,prompt)=>{const kind=/assessGoal/.test(prompt)?'assessGoal':'critiqueGoal';called.push([kind,provider]);return {text:answers[kind],usage:null};};
  let probes=0;
  const budget=root=>freshRuntimeBudget(root,{probe:()=>{probes+=1;return {ok:true,budget:normalizeBudget(OPEN_RECEIPT,{at:Date.now()})};}});
  const harness=setup({scope:['features/login/business','features/login/architecture'],reintake:['login'],
    assessGoal:llm.assessGoal,critiqueGoal:llm.critiqueGoal,runHeadless,budget});
  try{
    assert.equal(harness.error,null,harness.error?.message);
    assert.equal(harness.goal.ok,true);
    assert.ok(probes>=1,'the budget beside the store was stale or missing, so it was probed');
    assert.deepEqual(called.map(([kind])=>kind),['assessGoal','critiqueGoal'],'both pools were called once the quota was known');
    assert.ok(called.every(([,provider])=>typeof provider==='string'&&provider),'a real runtime id was selected');
    assert.ok(events(harness.store).some(event=>event.event==='budget-refreshed'),'the refresh is on the record');
    assert.equal(harness.state.critique.verdict,'sound');
    assert.equal(harness.state.critique.attempted,true);
    assert.deepEqual(harness.state.definitionOfDone,['login and workspace-dashboard are authored under the approved layers']);
    assert.equal(harness.goal.approvable,true);
    assert.equal(approve(harness.store,harness.state).approved,true);
  }finally{harness.cleanup();}
});

test('public goal path: a budget nobody can read selects nothing, says why, and leaves a goal that cannot be approved',()=>{
  const budget=root=>freshRuntimeBudget(root,{probe:()=>({ok:false,reason:'orca account list exited 1: not paired'}),now:Date.now});
  const runHeadless=()=>{throw Error('no model may be called without a known quota');};
  const harness=setup({scope:['features/login/business','features/login/architecture','features/workspace-dashboard/business'],reintake:['login'],
    assessGoal:llm.assessGoal,critiqueGoal:llm.critiqueGoal,runHeadless,budget});
  try{
    assert.equal(harness.error,null,harness.error?.message);
    const kinds=events(harness.store).map(event=>event.event);
    assert.ok(kinds.includes('quota-unreadable'),'the unreadable quota is an event, per role');
    assert.ok(kinds.includes('goal-assessment-failed')&&kinds.includes('goal-critique-unavailable'));
    assert.equal(harness.state.critique.attempted,false,'the critic was never asked: the chain was empty');
    assert.equal(harness.goal.approvable,false);
    assert.ok(kinds.includes('goal-not-approvable'));
    assert.throws(()=>approve(harness.store,harness.state),/cannot be approved/);
    assert.equal(harness.state.approved,false);
    const page=fs.readFileSync(harness.store.paths.goal,'utf8');
    assert.match(page,/## This goal cannot be approved as it stands/);
    assert.ok(page.indexOf('cannot be approved')<page.indexOf('## Definition of done'),'the owner reads the refusal before the criteria');
  }finally{harness.cleanup();}
});

/* ------------------------------------------------------------------ 3. a goal with no grounds */

test('a goal made only of intakes whose assessment failed still has criteria from the tree, and is approvable once a critic was actually asked',()=>{
  const harness=setup({scope:['collab'],
    assessGoal:()=>({ok:false,reason:'no provider produced a valid form',attempts:[{provider:'claude-fable-5.1',attempt:0,errors:['garbage']}]}),
    critiqueGoal:()=>({ok:false,verdict:'unavailable',reason:'no provider produced a valid critique',attempts:[{provider:'claude-fable-5.1',attempt:0,errors:['rate-limited']}]})});
  try{
    assert.equal(harness.goal.ok,true);
    assert.equal(harness.state.definitionOfDone.length,1,'the intake is a fact of the tree and gives one criterion');
    assert.match(harness.state.definitionOfDone[0],/collab-intake/);
    assert.equal(harness.state.goalGrounds.assessment,'ledger');
    assert.equal(harness.state.goalGrounds.critique,'attempted');
    assert.equal(harness.goal.approvable,true,'a critic that was asked and could not answer is no veto');
    assert.equal(approve(harness.store,harness.state).approved,true);
  }finally{harness.cleanup();}
});

test('a goal nobody assessed and nobody was asked to critique cannot be approved, and the repair is named on the page',()=>{
  const harness=setup({scope:['collab'],assessGoal:llm.assessGoal,critiqueGoal:llm.critiqueGoal,providers:[]});
  try{
    assert.equal(harness.error,null,harness.error?.message);
    assert.equal(harness.goal.ok,true,'the goal page is still written: the owner reads why it stops');
    assert.equal(harness.state.critique.verdict,'unavailable');
    assert.equal(harness.state.critique.attempted,false);
    assert.equal(harness.goal.approvable,false);
    assert.ok(harness.goal.approvalBlocks.some(block=>/never critiqued/.test(block)));
    assert.throws(()=>approve(harness.store,harness.state),/never critiqued/);
    assert.match(fs.readFileSync(harness.store.paths.goal,'utf8'),/do not\s+write the missing criteria or a verdict into this page by hand/);
  }finally{harness.cleanup();}
});

test('a plan-ledger goal whose model answered an empty definition of done is not approvable',()=>{
  const tree=workRepo([]);
  try{
    const store=createStore({repoRoot:tree.repo,id:'20260915-plan-empty'});
    const state=createWorkflowState({job:'Reinstall the stack',worktree:tree.repo,branch:'starci183/stacks',gates:[],store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'plan',scope:[],reintake:[],migrate:[],repoRoot:tree.repo});
    const goal=goalPhase(store,state,{cwd:tree.repo,extractMaterial:()=>[],renderGoalMarkdown:null,
      assessGoal:()=>({ok:true,provider:'fake',value:{definitionOfDone:[],risks:[],questions:[],
        ledger:[{id:'g1',title:'inventory',status:'planned'}],
        ops:[{id:'op1',kind:'backend.implement',goal:'inventory the stack',ledgerIds:['g1'],allowlist:['.stacks/**'],references:[],checks:[{name:'c',command:'true'}],acceptance:['done'],dependsOn:[]}]}}),
      critiqueGoal:soundCritique});
    assert.equal(goal.ok,true);
    assert.equal(goal.approvable,false);
    assert.throws(()=>approve(store,state),/no definition of done/);
  }finally{tree.cleanup();}
});

test('a plan-ledger goal whose model invented an operation kind is refused before the page is written',()=>{
  const tree=workRepo([]);
  try{
    const store=createStore({repoRoot:tree.repo,id:'20260915-plan-kind'});
    const state=createWorkflowState({job:'Reinstall the stack',worktree:tree.repo,branch:'starci183/stacks',gates:[],store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'plan',scope:[],reintake:[],migrate:[],repoRoot:tree.repo});
    const plan={definitionOfDone:['the stack is inventoried'],risks:[],questions:[],ledger:[{id:'g1',title:'inventory',status:'planned'}],
      ops:[{id:'op1',kind:'inventory',goal:'inventory the stack',ledgerIds:['g1'],allowlist:['.stacks/**'],references:[],checks:[{name:'c',command:'true'}],acceptance:['done'],dependsOn:[]}]};
    assert.throws(()=>goalPhase(store,state,{cwd:tree.repo,extractMaterial:()=>[],renderGoalMarkdown:null,assessGoal:()=>({ok:true,provider:'fake',value:plan}),critiqueGoal:soundCritique}),
      /Operation op1 has the kind inventory, which no operator launches/);
    assert.equal(state.approved,false);
    assert.equal(fs.existsSync(store.paths.goalJson),false,'no goal record is written for a plan the kernel cannot launch');
  }finally{tree.cleanup();}
});

test('a file input outside the worktree is staged under its own _local inputs and referred to by the copy',()=>{
  const tree=workRepo([]);
  const outside=tmp();
  try{
    const file=path.join(outside,'review.md');fs.writeFileSync(file,'# review\n');
    const insideFile=path.join(tree.repo,'notes.md');fs.writeFileSync(insideFile,'notes');
    const store=createStore({repoRoot:tree.repo,id:'20260915-inputs'});
    const state=createWorkflowState({job:'Reinstall the stack',inputs:[`file:${file.replaceAll('\\\\','/')}`,`file:${insideFile.replaceAll('\\\\','/')}`,'file:branch:starci183/x','file:history:D:/nowhere'],
      worktree:tree.repo,branch:'starci183/stacks',gates:[],store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'plan',scope:[],reintake:[],migrate:[],repoRoot:tree.repo});
    const staged=stageExternalInputs(store,state,{worktree:tree.repo});
    assert.equal(staged.length,1);
    assert.equal(state.inputs[0].ref,'.starciwork/_local/inputs/20260915-inputs/1-review.md');
    assert.equal(fs.readFileSync(path.join(tree.repo,state.inputs[0].ref),'utf8'),'# review\n');
    assert.match(state.inputs[0].sha256,/^[a-f0-9]{64}$/);
    assert.equal(state.inputs[1].ref,'notes.md','an input inside the worktree is spelled relative to it');
    assert.equal(state.inputs[2].ref,'branch:starci183/x','a ref that is no path is left as declared');
    assert.equal(state.inputs[3].ref,'history:D:/nowhere');
    assert.ok(events(store).some(event=>event.event==='inputs-staged'&&event.inputs[0].to===state.inputs[0].ref));
  }finally{tree.cleanup();fs.rmSync(outside,{recursive:true,force:true});}
});

test('on a plan ledger a decisive hidden decision is the owner\'s question on the page, never a decision.prepare op the Work gate refuses',()=>{
  const tree=workRepo([]);
  try{
    const store=createStore({repoRoot:tree.repo,id:'20260915-plan-decision'});
    const state=createWorkflowState({job:'Reinstall the stack',worktree:tree.repo,branch:'starci183/stacks',gates:[],store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'plan',scope:[],reintake:[],migrate:[],repoRoot:tree.repo});
    const plan={definitionOfDone:['the stack is reinstalled'],risks:[],questions:['which services are in scope?'],ledger:[{id:'g1',title:'inventory',status:'planned'}],
      ops:[{id:'op1',kind:'runtime.operate',goal:'inventory the stack',ledgerIds:['g1'],allowlist:['.stacks/**'],references:[],checks:[{name:'c',command:'true'}],acceptance:['done'],dependsOn:[]}]};
    const critique=()=>({ok:true,verdict:'revise',provider:'fake-critic',attempts:[{provider:'fake-critic',attempt:0,errors:[]}],required:['decide the backup store first'],alternatives:[],question:null,prerequisites:[],overlaps:[],provisions:[],
      objections:[{kind:'hidden-decision',claim:'nivo-backup-store is removed as Nivo-owned',evidence:'job text',consequence:'the only recovery copy may be deleted',decisive:true}]});
    const goal=goalPhase(store,state,{cwd:tree.repo,extractMaterial:()=>[],renderGoalMarkdown:null,assessGoal:()=>({ok:true,provider:'fake',value:plan}),critiqueGoal:critique});
    assert.equal(goal.ok,true);
    assert.deepEqual(state.ops.map(op=>op.id),['op1'],'no ask op is planned on a plan ledger');
    assert.ok(state.questions.some(line=>/nivo-backup-store is removed as Nivo-owned - the only recovery copy may be deleted/.test(line)));
    const unplanned=events(store).find(event=>event.event==='decision-unplanned');
    assert.match(unplanned.reason,/plan ledger binds no canonical Work/);
    assert.match(fs.readFileSync(store.paths.goal,'utf8'),/nivo-backup-store is removed as Nivo-owned/);
    assert.equal(goal.approvable,true);
  }finally{tree.cleanup();}
});

test('a plan-ledger goal that plans a Work-record kind is refused, and the Work gate holds only where a canonical tree is bound',()=>{
  const tree=workRepo([]);
  try{
    const store=createStore({repoRoot:tree.repo,id:'20260915-plan-record-kind'});
    const state=createWorkflowState({job:'Reinstall the stack',worktree:tree.repo,branch:'starci183/stacks',gates:[],store,host:path.resolve('.'),launcher:'L.mjs',ledgerMode:'plan',scope:[],reintake:[],migrate:[],repoRoot:tree.repo});
    const plan={definitionOfDone:['the owner decided'],risks:[],questions:[],ledger:[{id:'g1',title:'decide',status:'planned'}],
      ops:[{id:'op1',kind:'decision.prepare',goal:'ask the owner',ledgerIds:['g1'],allowlist:['.starciwork/decisions/**'],references:[],checks:[{name:'c',command:'true'}],acceptance:['done'],dependsOn:[]}]};
    assert.throws(()=>goalPhase(store,state,{cwd:tree.repo,extractMaterial:()=>[],renderGoalMarkdown:null,assessGoal:()=>({ok:true,provider:'fake',value:plan}),critiqueGoal:soundCritique}),
      /Operation op1 has the kind decision\.prepare, which no operator launches on a plan ledger/);
  }finally{tree.cleanup();}
  const v6={};
  assert.equal(needsWorkGate({kind:'runtime.operate'},{v6,work:null}),false,'a plan ledger has no tree to gate');
  assert.equal(needsWorkGate({kind:'runtime.operate'},{v6,work:{ledger:{repoRoot:'r',workRoot:'w'}}}),true);
  assert.equal(needsWorkGate({kind:'backend.implement'},{v6,work:{ledger:{repoRoot:'r',workRoot:'w'}}}),false,'code is not a Work record');
  assert.equal(needsWorkGate({kind:'runtime.operate'},{v6:null,work:{ledger:{repoRoot:'r',workRoot:'w'}}}),false);
});

test('a resumed workflow that finished blocked is approved again without the first-approval gate',()=>{
  const harness=setup({scope:['collab'],assessGoal:modelAssessed,critiqueGoal:soundCritique});
  try{
    assert.equal(approve(harness.store,harness.state).approved,true);
    harness.state.finished={outcome:'blocked',reason:'owner question'};harness.state.phase='finished';
    harness.state.definitionOfDone=[];harness.state.goalGrounds={assessment:'none',critique:'not-attempted'};
    const again=approve(harness.store,harness.state);
    assert.equal(again.approved,true,'the gate is about the first approval of a new envelope, not a resume');
    assert.equal(harness.state.finished,null);
  }finally{harness.cleanup();}
});
