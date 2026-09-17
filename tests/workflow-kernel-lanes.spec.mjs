import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';
import {createStore,listWorkflows} from '../kernel/store.mjs';
import {ledgerFileFor} from '../kernel/ledger-db.mjs';
import {approve,kernelMain,laneRowTitle,runLoop,validateWorkTree} from '../kernel/kernel.mjs';
import {fakeAllocator,passing,scriptedOrca} from './helpers/kernel-harness.mjs';

/** A one-off read of a workflow's store: the store holds a real ledger handle now, so it is closed the
 * instant its answer is in hand, never left open for Windows to trip over when the fixture cleans up. */
function withStore(run,fn){
  const store=createStore({repoRoot:run.repo,id:run.goal.id});
  try{return fn(store);}finally{store.close();}
}

/**
 * One workflow, one lane, one Orca worktree row. Everything here is real except the runtimes and Orca itself:
 * a git repository with an authored Work tree, a lane created by a real `git worktree add` behind the fake
 * `worktree create`, the shipped Work validator, real commits - because the claim under test is that the
 * workflow runs in a tree of its own and that its branch goes home into the base branch when it is done.
 */
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const noWait=()=>{};
const INTAKE='demo.sales.implementation.backend.intake';
const FILE='src/sales/intake.ts';
const CHECK='npx vitest run intake';
/** The ledger (docs §3: WAL by default) leaves these untracked in the base repo - no `_local` directory any more. */
const LEDGER_UNTRACKED=['?? .starciwork/ledger-anchor.json','?? .starciwork/runtime.sqlite','?? .starciwork/runtime.sqlite-shm','?? .starciwork/runtime.sqlite-wal'];

const NODE=`schema: work/node@2
id: ${INTAKE}
kind: implementation
required: true
state: todo
description: Persist an order on intake.
assertions:
  - unit-tests-pass
implementation:
  status: proposed
  changes:
    - what: Write the slice.
      why: Nothing does this yet.
      repository: demo-backend
      directory: src/sales
      revision: worktree
      verification:
        - ${CHECK}
      files:
        - ${FILE}
  gaps: []
extensions:
  work3:
    checks:
      - assertion: unit-tests-pass
        command: ${CHECK}
`;

function git(cwd,...args){
  const result=spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,`git ${args.join(' ')} in ${cwd}: ${result.stderr}`);
  return (result.stdout??'').trim();
}
const gitMaybe=(cwd,...args)=>spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});
/** `git status --porcelain` as its lines, untrimmed on the left: the two status letters matter. */
const statusOf=cwd=>(gitMaybe(cwd,'status','--porcelain').stdout??'').split(String.fromCharCode(10)).map(line=>line.replace(/\s+$/,'')).filter(Boolean);

/**
 * The repository a lane is cut from, its host (no workspace registry: this product owns its own Work tree) and
 * the factory the fake Orca uses for `worktree create` - a real `git worktree add` under a workspaces root, the
 * way Orca places one, answering the refusal Orca gives when the name is taken.
 */
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-lanes-'));
  // `node:test` runs `t.after` hooks in registration order, not reverse order: a store `walked()` opens after
  // this call would still be open when a `t.after` registered here ran first. Every store a helper below opens
  // registers its own close through this instead, so nothing outlives the worktree removal that follows it.
  const closers=[];
  t.after(()=>{
    for(const close of closers)try{close();}catch{}
    assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-lanes-'));
    // SQLite on Windows can still hold the file mapping open a moment past close(); the removal retries through it.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);
    fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:150});
  });
  const repo=path.join(root,'demo-backend'),host=path.join(root,'source','.claude');
  const workspaces=path.join(root,'workspaces','demo-backend');
  fs.mkdirSync(host,{recursive:true});
  fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(host,'config.example.yaml'));
  fs.mkdirSync(workspaces,{recursive:true});
  const put=(relative,content)=>{
    const file=path.join(repo,relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  };
  put('package.json',`${JSON.stringify({name:'@demo/backend',private:true},null,2)}\n`);
  put(FILE,'export const intake=()=>null;\n');
  put('.starciwork/workspace.yaml','schema: work/workspace@1\nid: demo\n');
  put(`.starciwork/features/sales/implementation/backend/intake/index.yaml`,NODE);
  git(repo,'init','-b','main');
  git(repo,'remote','add','origin','https://github.com/demo/demo-backend.git');
  git(repo,'config','user.email','kernel@starci.test');
  git(repo,'config','user.name','StarCi lane spec');
  git(repo,'config','commit.gpgsign','false');
  git(repo,'add','-A');
  git(repo,'commit','-q','-m','chore: seed the repository and its Work tree');
  const worktrees={
    create:({name,baseBranch})=>{
      const target=path.join(workspaces,name);
      if(fs.existsSync(target))return {error:`worktree_name_taken: ${name} already exists under ${workspaces}`};
      const branch=`orca/${name}`;
      const added=gitMaybe(repo,'worktree','add','-b',branch,target,baseBranch);
      if(added.status!==0)return {error:(added.stderr??'').trim()};
      return {path:target,branch};
    },
    remove:selector=>{
      const target=String(selector).replace(/^path:/,'');
      const removed=gitMaybe(repo,'worktree','remove','--force',target);
      if(removed.status!==0)return {error:(removed.stderr??'').trim()};
      return {preservedBranch:`orca/${path.basename(target)}`};
    }
  };
  // The node record as it stands in any checkout of this repository: the base worktree, or a lane of it.
  const record=(at=repo)=>parseYaml(fs.readFileSync(path.join(at,'.starciwork','features','sales','implementation','backend','intake','index.yaml'),'utf8'));
  return {root,repo,host,workspaces,worktrees,record,onClose:fn=>closers.push(fn)};
}

const assessGoal=({ledger})=>({ok:true,provider:'fake',value:{definitionOfDone:[`the ${ledger.length} listed nodes are done`],risks:[],questions:[]}});
/** The critic stands in too: every goal is critiqued by the runtime, and a real call here would be a different claim. */
const critiqueGoal=()=>({ok:true,verdict:'sound',objections:[],dropped:[],required:[],alternatives:[],question:null,provider:'stub-critic',attempts:[],usage:null});
/** The validator stands in: this spec is about the lane, and a real provider call would be a different claim. */
const acceptAll=()=>({ok:true,verdict:'accept',summary:'stub validator: accepted',findings:[],dropped:[],provider:'stub',usage:null});

/** `workflow-goal --lane` from the base worktree: the lane is created, named and the goal phase runs inside it. */
function openedLane(t,{lane=true,id=null}={}){
  const fixed=fixture(t);
  // The goal phase dispatches nothing, so no report is ever written or read here; the store is created by
  // the `workflow-goal` call this fake Orca is about to drive, not before it.
  const fake=scriptedOrca({store:null,scripts:{},worktree:fixed.repo,worktrees:fixed.worktrees});
  const goal=kernelMain('workflow-goal',{job:'Persist an order on intake',host:fixed.host,lane,...(id?{id}:{})},
    {orca:fake.orca,cwd:fixed.repo,functions:{assessGoal,critiqueGoal}});
  return {...fixed,fake,goal};
}

test('workflow-goal --lane creates the workflow its own Orca worktree row, runs the goal inside it, and keeps the store in the repository',t=>{
  const run=openedLane(t,{id:'20260913-090000-intake'});
  assert.equal(run.goal.ok,true);
  const lane=run.goal.lane;
  assert.equal(lane.name,'20260913-090000-intake','the lane is named after the workflow unless --lane names it');
  assert.equal(lane.branch,'orca/20260913-090000-intake');
  assert.equal(lane.base.branch,'main');
  assert.equal(lane.base.worktree,run.repo.replaceAll('\\','/'));
  assert.equal(lane.merged,null);
  // The lane is a real worktree of this repository, and it is where the workflow works.
  const laneDir=path.join(run.workspaces,'20260913-090000-intake');
  assert.equal(lane.worktree,laneDir.replaceAll('\\','/'));
  assert.ok(fs.existsSync(path.join(laneDir,FILE)));
  const state=withStore(run,store=>store.loadState());
  assert.equal(state.worktree,laneDir);
  assert.equal(state.repoRoot,laneDir);
  assert.equal(state.branch,'orca/20260913-090000-intake');
  assert.deepEqual(state.lane,{name:'20260913-090000-intake',worktree:laneDir,branch:'orca/20260913-090000-intake',
    orcaId:`path:${run.repo.replaceAll('\\','/')}::${laneDir.replaceAll('\\','/')}`,
    base:{worktree:run.repo,branch:'main'}});
  // The store stays in the repository, so the supervisor finds it from the base worktree and from the lane.
  assert.equal(run.goal.dir,ledgerFileFor(run.repo));
  assert.equal(fs.existsSync(path.join(laneDir,'.starciwork','runtime.sqlite')),false,'the lane worktree carries no ledger of its own');
  assert.equal(kernelMain('workflow-status',{id:run.goal.id,host:run.host},{orca:null,cwd:laneDir}).dir,run.goal.dir,
    'the same workflow is reached from inside the lane');
  // goal.md names the lane and the base it goes home to, under the title.
  const page=withStore(run,store=>store.goal().markdown);
  assert.match(page,/Lane `20260913-090000-intake` - worktree `.*20260913-090000-intake` on branch `orca\/20260913-090000-intake`/);
  assert.match(page,/merged into `main` in `.*demo-backend`/);
  // The Orca calls: one create as a top-level row with setup skipped, then the row title and its status.
  assert.deepEqual(run.fake.worktreeCalls,[
    {call:'create',name:'20260913-090000-intake',repo:`path:${run.repo.replaceAll('\\','/')}`,baseBranch:'main',setup:'skip',noParent:true},
    {call:'set',worktree:`path:${laneDir.replaceAll('\\','/')}`,displayName:laneRowTitle(run.goal.id),workspaceStatus:'in-progress',noParent:false}]);
  assert.equal(laneRowTitle(run.goal.id),'[Workflow] 20260913-090000-intake');
  const created=withStore(run,store=>store.readEvents()).find(event=>event.event==='lane-created');
  assert.equal(created.row,'[Workflow] 20260913-090000-intake');
  assert.equal(created.branch,'orca/20260913-090000-intake');
  assert.equal(created.base.branch,'main');
  // The status view prints the lane for a reader.
  const status=kernelMain('workflow-status',{id:run.goal.id,host:run.host},{orca:null,cwd:run.repo});
  assert.deepEqual(status.lane.base,{worktree:run.repo.replaceAll('\\','/'),branch:'main'});
  assert.equal(status.lane.branch,'orca/20260913-090000-intake');
});

test('a lane never opens a lane of its own, and a taken lane name is Orca refusal, not a second guess',t=>{
  const run=openedLane(t,{id:'20260913-090001-intake'});
  const laneDir=path.join(run.workspaces,'20260913-090001-intake');
  assert.throws(()=>kernelMain('workflow-goal',{job:'Another job from inside the lane',host:run.host,lane:true},
    {orca:run.fake.orca,cwd:laneDir,functions:{assessGoal,critiqueGoal}}),/is already the lane of workflow 20260913-090001-intake/);
  assert.throws(()=>kernelMain('workflow-goal',{job:'A second workflow on the same name',host:run.host,
    lane:'20260913-090001-intake'},{orca:run.fake.orca,cwd:run.repo,functions:{assessGoal,critiqueGoal}}),/worktree_name_taken/);
  // Neither refusal left a second workflow behind in the store.
  assert.deepEqual(listWorkflows(run.repo).map(entry=>entry.id),['20260913-090001-intake']);
});

/** Approve, run the lane to `done`, and let `finish` take the branch home. */
function walked(t,{dirtyBase=null,moveBase=null,id='20260913-100000-intake'}={}){
  const run=openedLane(t,{id});
  const laneDir=path.join(run.workspaces,id);
  const store=createStore({repoRoot:run.repo,id:run.goal.id});
  // This store outlives walked() itself (the test body reads from it afterward), so it closes through the
  // fixture's own closer list - registered here, run before the worktree removal, not after it (node:test
  // runs t.after hooks in registration order, and fixture()'s own removal was registered first).
  run.onClose(()=>store.close());
  const state=store.loadState();
  approve(store,state);
  state.run='run_wf';state.from='term_kernel';
  const fake=scriptedOrca({store,worktree:laneDir,worktrees:run.worktrees,
    scripts:{[INTAKE]:[{outcome:'done',summary:'Intake persists an order.',files:[FILE],
      checks:[passing('unit-tests-pass',CHECK)],
      effect:()=>fs.writeFileSync(path.join(laneDir,FILE),'export const intake=order=>order;\n')}],
      [`${INTAKE}-verify`]:[{outcome:'done',summary:'The intake flow passes end to end.',files:[],
      checks:[passing('unit-tests-pass',CHECK)]}],
      'verify-1':[{outcome:'done',summary:'The slice holds under review.',files:[],checks:[passing('unit-tests-pass',CHECK)]}]}});
  if(dirtyBase)fs.writeFileSync(path.join(run.repo,dirtyBase),'export const intake=()=>"the owner is editing this right now";\n');
  if(moveBase)git(run.repo,'checkout','-q','-b',moveBase);
  const baseHead=git(run.repo,'rev-parse','HEAD');
  const finished=runLoop(fake.orca,store,state,{cwd:laneDir,allocator:fakeAllocator(),template,wait:noWait,
    validate:validateWorkTree,git:spawnSync,exec:command=>({status:0,stdout:`${command} ok`,stderr:''}),
    launch:(_orca,{operation,scope})=>fake.register(scope??operation),
    validateOp:acceptAll,
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    waitTimeoutMs:2000,tickMs:1000,maxIterations:20});
  return {...run,id:run.goal.id,laneDir,store,fake,finished,baseHead};
}

test('a finished lane merges its own branch into the base branch, in the base worktree, and the row is completed',t=>{
  const run=walked(t);
  assert.equal(run.finished.finished.outcome,'done',JSON.stringify(run.finished.needUser));
  // The lane did the work: the code commit and the Work record commit are both on the lane branch.
  const laneLog=git(run.laneDir,'log','--format=%s',`${run.baseHead}..HEAD`);
  assert.match(laneLog,new RegExp(`work\\(${INTAKE.replaceAll('.','\\.')}\\): record`));
  assert.equal(git(run.laneDir,'rev-parse','--abbrev-ref','HEAD'),`orca/${run.id}`);
  assert.equal(run.record().state,'done');
  // The base branch received the merge, in the base worktree, and it names the workflow.
  const merge=git(run.repo,'log','-1','--format=%B');
  assert.match(merge,new RegExp(`^merge\\(workflow\\): ${run.id} - orca/${run.id} into main`));
  assert.equal(git(run.repo,'rev-parse','--abbrev-ref','HEAD'),'main');
  assert.notEqual(git(run.repo,'rev-parse','HEAD'),run.baseHead);
  assert.equal(git(run.repo,'rev-list','--count','HEAD','^HEAD^2'),'1','a --no-ff merge commit, so the lane reads as one branch');
  // The Work record the lane wrote is on the base branch now.
  assert.equal(parseYaml(git(run.repo,'show','HEAD:.starciwork/features/sales/implementation/backend/intake/index.yaml')).state,'done');
  const merged=run.store.readEvents().find(event=>event.event==='lane-merged');
  assert.equal(merged.commit,git(run.repo,'rev-parse','HEAD'));
  assert.equal(merged.branch,`orca/${run.id}`);
  assert.equal(merged.base,'main');
  assert.equal(run.finished.lane.merged.commit,merged.commit);
  // Orca is told the row is done, and the worktree is left in place for the owner to read.
  assert.deepEqual(run.fake.worktreeCalls.filter(call=>call.call==='set').map(call=>call.workspaceStatus),['completed']);
  assert.ok(fs.existsSync(run.laneDir));
  const final=run.store.signal.get(run.id,'final-report').value;
  assert.equal(final.outcome,'done');
  assert.equal(final.lane.merged.commit,merged.commit);
  assert.equal(final.lane.base.branch,'main');
});

test('a base worktree that carries an uncommitted change the lane also changed blocks the workflow instead of being overwritten',t=>{
  const run=walked(t,{dirtyBase:FILE,id:'20260913-110000-intake'});
  assert.equal(run.finished.finished?.outcome,'blocked',JSON.stringify({ops:run.finished.ops.map(op=>[op.id,op.status]),
    events:run.store.readEvents().map(event=>`${event.seq} ${event.event} ${event.op??event.node??''} ${event.reason??event.result??event.message??''}`)}));
  const conflict=run.store.readEvents().find(event=>event.event==='lane-merge-conflict');
  assert.deepEqual(conflict.files,[FILE]);
  assert.equal(conflict.branch,`orca/${run.id}`);
  assert.equal(conflict.base,'main');
  assert.ok(run.store.readEvents().every(event=>event.event!=='lane-merged'));
  assert.deepEqual(run.finished.needUser.filter(item=>item.kind==='merge').map(item=>item.detail.includes(FILE)),[true]);
  assert.ok(!run.finished.lane.merged,'the lane did not go home');
  assert.deepEqual(run.finished.lane.conflict.files,[FILE]);
  // Nothing in the base was stashed, reset or half-merged: the owner's pending change is exactly as it was.
  assert.equal(git(run.repo,'rev-parse','HEAD'),run.baseHead);
  assert.deepEqual(statusOf(run.repo),[` M ${FILE}`,...LEDGER_UNTRACKED],
    'only the owner pending change and the ledger WAL set, no half-merge');
  assert.equal(fs.existsSync(path.join(run.repo,'.git','MERGE_HEAD')),false);
  assert.match(fs.readFileSync(path.join(run.repo,FILE),'utf8'),/the owner is editing this right now/);
  // The work itself is not lost: it is recorded and committed in the lane, waiting for the merge the owner does.
  assert.equal(run.record(run.laneDir).state,'done');
  assert.equal(run.record().state,'todo','the base branch never received the record the merge would have brought');
  const final=run.store.signal.get(run.id,'final-report').value;
  assert.equal(final.outcome,'blocked');
  assert.match(final.reason,/does not merge into main/);
  assert.equal(final.lane.merged,null);
});

test('workflow-lane-close refuses an unmerged lane and a live kernel, and removes the worktree once the lane went home',t=>{
  const open=openedLane(t,{id:'20260913-120000-intake'});
  assert.throws(()=>kernelMain('workflow-lane-close',{id:open.goal.id,host:open.host},{orca:open.fake.orca,cwd:open.repo}),
    /is not merged into main yet/);
  assert.ok(fs.existsSync(path.join(open.workspaces,'20260913-120000-intake')),'a refusal removes nothing');
  assert.deepEqual(open.fake.worktreeCalls.filter(call=>call.call==='rm'),[]);

  const run=walked(t,{id:'20260913-130000-intake'});
  assert.equal(run.finished.finished.outcome,'done',JSON.stringify({needUser:run.finished.needUser,ops:run.finished.ops.map(op=>[op.id,op.status])}));
  run.store.signal.set(run.id,'kernel-lock',{pid:process.pid,value:{phase:'running'}});
  assert.throws(()=>kernelMain('workflow-lane-close',{id:run.id,host:run.host},{orca:run.fake.orca,cwd:run.repo}),
    /kernel of 20260913-130000-intake is still running/);
  run.store.signal.clear(run.id,'kernel-lock');
  const closed=kernelMain('workflow-lane-close',{id:run.id,host:run.host},{orca:run.fake.orca,cwd:run.repo});
  assert.equal(closed.closed,true);
  assert.equal(closed.lane.closed.preservedBranch,`orca/${run.id}`);
  assert.equal(fs.existsSync(run.laneDir),false,'the worktree is gone');
  assert.ok(git(run.repo,'branch','--list',`orca/${run.id}`),'the branch is preserved');
  const event=run.store.readEvents().find(item=>item.event==='lane-closed');
  assert.equal(event.preservedBranch,`orca/${run.id}`);
  assert.deepEqual(run.fake.worktreeCalls.filter(call=>call.call==='rm'),
    [{call:'rm',worktree:`path:${run.laneDir.replaceAll('\\','/')}`,force:true}]);
  // Closing twice is not an error and makes no second Orca call.
  const again=kernelMain('workflow-lane-close',{id:run.id,host:run.host},{orca:run.fake.orca,cwd:run.repo});
  assert.equal(again.closed,true);
  assert.equal(run.fake.worktreeCalls.filter(call=>call.call==='rm').length,1);
});

/**
 * The base worktree is the owner's, and it may have moved on. A merge takes whatever branch is checked out
 * there, so a base that is no longer on B is not this lane's merge: it is refused, named, and left to the owner.
 */
test('a base worktree that has moved to another branch is not merged into by accident',t=>{
  const run=walked(t,{moveBase:'session/elsewhere',id:'20260913-140000-intake'});
  assert.equal(run.finished.finished?.outcome,'blocked');
  const conflict=run.store.readEvents().find(event=>event.event==='lane-merge-conflict');
  assert.deepEqual(conflict.files,[]);
  assert.match(conflict.reason,/is on session\/elsewhere, not main/);
  assert.ok(run.store.readEvents().every(event=>event.event!=='lane-merged'));
  assert.match(run.finished.needUser.find(item=>item.kind==='merge').detail,/is on session\/elsewhere, not main/);
  // Neither branch moved: the lane keeps its commits and main is exactly where it was.
  assert.equal(git(run.repo,'rev-parse','session/elsewhere'),run.baseHead);
  assert.equal(git(run.repo,'rev-parse','main'),run.baseHead);
  assert.deepEqual(statusOf(run.repo),LEDGER_UNTRACKED);
});
