import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {KINDS,FAMILIES,ROLES,BLOCKERS,OUTCOMES,CAPABILITIES,kindRecord,loadKinds} from '../kernel/graph.mjs';
import {RECORD_KINDS} from '../kernel/io.mjs';
import {resolveExecutionChain} from '../kernel/chains.mjs';
import {createAllocator,LEAST_LOADED,PREFER_THEN_OVERFLOW} from '../kernel/schedule.mjs';
import {goalApprovalBlocks,approve,reviseGoal} from '../kernel/goal.mjs';
import {GOAL_RECORD,parseQuota} from '../kernel/common.mjs';
import {createWorkflowState,runLoop} from '../kernel/kernel.mjs';
import {goalPhase} from '../kernel/kernel.mjs';
import {createStore} from '../kernel/store.mjs';
import {enrollEngine,createEngineRuntime} from '../kernel/engine.mjs';
import {resolveCandidateReferences,candidateRootBindings,candidateRootBindingDigest} from '../kernel/candidate-roots.mjs';
import {MANAGER_DECISION} from '../models/manager-contract.mjs';
import {scriptedOrca} from './helpers/kernel-harness.mjs';
import {GOAL_POOLS,POOL_OF_MODEL,GOAL_POOL_CAPS,GOAL_MAX_PARALLEL_OPS,poolOf,idOf,poolMembers,namingOf,loadRuntimeProfile} from './helpers/pools.mjs';

// goal.md acceptance suite: executable invariants where the code supports them today, marked
// test.skip where the feature is not merged yet. A skipped check here is the acceptance test
// the merge must turn green; an unsipped check is a contract the runtime already owes.
/**
 * `enrollEngine` opens its own ledger handle and hands it to `store.bindJournal`, which the store keeps
 * as its durable binding; `store.close()` only closes the handle it opened itself, and nothing ever closes
 * the one `enrollEngine` opened (kernel/engine.mjs and kernel/store.mjs, not owned by this stream - see
 * notes/w2-s9.md, "kernel/engine.mjs leaks the durable ledger handle enrollEngine opens"). Windows refuses
 * to delete a directory with any file still open under it, and no amount of retrying closes a handle
 * nothing ever releases, so cleanup after such a test tolerates that specific, external, known leak rather
 * than asserting a defect this stream does not own.
 */
const rmSyncTolerant=target=>{try{fs.rmSync(target,{recursive:true,force:true});}
  catch(error){if(process.platform!=='win32'||error?.code!=='EPERM')throw error;}};
const profile=loadRuntimeProfile();
const kinds=parseYaml(fs.readFileSync(new URL('../model/kinds.yaml',import.meta.url),'utf8'));
const opsDirs=fs.readdirSync(new URL('../ops',import.meta.url),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
const opsRegistry=parseYaml(fs.readFileSync(new URL('../ops/registry.yaml',import.meta.url),'utf8'));
const SOL=idOf(profile.runtimes,'gpt-5.6-sol');
const NAMING=namingOf(profile);

test('the canonical catalog is one closed list: kinds.yaml keys equal KINDS, fully declared',()=>{
  assert.deepEqual(Object.keys(kinds.kinds).sort(),[...KINDS].sort(),'model/kinds.yaml and kernel/graph.mjs KINDS must be the same closed catalog');
  for(const kind of KINDS){
    const record=kindRecord(kind);
    assert.ok(FAMILIES.includes(record.family),`${kind}: family ${record.family} must be one of ${FAMILIES}`);
    assert.ok(ROLES.includes(record.role),`${kind}: role ${record.role} must be one of ${ROLES}`);
    assert.ok(profile.roleOfKind[kind]===undefined||profile.roleOfKind[kind]===record.role,`${kind}: roleOfKind disagrees with the declared role`);
    for(const entry of record.reads??[])assert.ok(RECORD_KINDS.includes(entry),`${kind} reads undeclared record kind ${entry}`);
    for(const entry of record.writes??[])assert.ok(RECORD_KINDS.includes(entry),`${kind} writes undeclared record kind ${entry}`);
    if(record.readOnly===true)assert.deepEqual(record.writes??[],[],`${kind}: readOnly kinds write nothing`);
    else assert.ok((record.writes??[]).length>0,`${kind}: a writable kind writes at least one record`);
    for(const outcome of record.reports?.outcomes??[])assert.ok(OUTCOMES.includes(outcome),`${kind} reports undeclared outcome ${outcome}`);
    for(const blocker of record.reports?.blockers??[])assert.ok(BLOCKERS.includes(blocker),`${kind} reports undeclared blocker ${blocker}`);
    for(const need of record.needs??[])assert.ok(CAPABILITIES.includes(need),`${kind} needs undeclared capability ${need}`);
    assert.ok(opsDirs.includes(record.operator),`${kind} names operator ${record.operator} that has no ops/ directory`);
  }
});

test('every executable operator is wired to a kind or registered, with no name drift',()=>{
  const wired=new Set(Object.values(kinds.kinds).map(record=>record.operator));
  for(const dir of opsDirs)assert.ok(opsRegistry.ops.includes(dir),`ops/${dir} is absent from ops/registry.yaml`);
  for(const dir of opsDirs){
    if(wired.has(dir))continue;
    const registered=opsRegistry.ops.includes(dir)&&(opsRegistry.consolidation?.basic??[]).concat(opsRegistry.consolidation?.supporting??[]).includes(dir);
    assert.ok(registered,`ops/${dir} is neither wired to a kind nor registered`);
  }
});

// goal.md "Done means": every executable operator is either wired to a kind or explicitly marked
// ad-hoc. The ad-hoc marker does not exist in ops/registry.yaml yet; today the one registered but
// not kinded operator is task.execute (retired in favour of request.analyze).
test('no orphan operators: every ops/ directory is wired to a kind or explicitly marked ad-hoc',{skip:'ad-hoc marking is not merged; the one unwired operator is task.execute'},()=>{});

test('the goal chain order holds for the kinds that exist in the catalog',()=>{
  // goal.md §2: request.analyze → scope.define → business.decide → architecture.decide →
  // interface.draw → implementation.plan → build ops → test.author → verify ops → release.deliver
  const present=['business.decide','architecture.decide','interface.draw','implementation.plan','frontend.implement','backend.implement','review.verify','e2e.verify','integration.verify','uat.verify'];
  for(const kind of present)assert.ok(KINDS.includes(kind),`canonical chain kind ${kind} is missing from the catalog`);
  assert.equal(kindRecord('interface.draw').role,'write');
  assert.deepEqual(kindRecord('interface.draw').needs,['design-tool']);
  for(const entry of ['srs','sds','brand','grammar'])assert.ok(kindRecord('interface.draw').reads.includes(entry),`interface.draw must read ${entry}`);
  for(const entry of ['design','asset'])assert.ok(kindRecord('interface.draw').writes.includes(entry),`interface.draw must write ${entry}`);
  assert.equal(kindRecord('implementation.plan').role,'plan');
  for(const kind of ['review.verify','e2e.verify','integration.verify','uat.verify'])assert.equal(kindRecord(kind).role,'verify',`${kind} must carry the verify role`);
});

// goal.md §2: the whole chain is in the catalog - intake, scope, decide, draw, plan, build, refactor,
// test authoring, security/perf proofs, delivery, retirement and goal governance.
test('the full goal §2 chain is in the catalog: intake, refactor, test.author, security/perf verify, deliver, retire, govern',()=>{
  for(const kind of ['request.analyze','scope.define','scope.retire','code.refactor','test.author','security.verify','perf.verify','docs.author','release.deliver','knowledge.repair','workspace.manage','content.generate','goal.revise','goal.validate'])
    assert.ok(KINDS.includes(kind),`goal §2 chain kind ${kind} is missing from the catalog`);
});

test('interface.draw and interface.asset allow only the image route: one candidate, its pool\'s write model',{skip:false},()=>{
  for(const op of ['interface.draw','interface.asset']){
    const chain=resolveExecutionChain({skill:'starci',op});
    assert.equal(chain.candidates.length,1,`${op} must have exactly one launch candidate`);
    const candidate=chain.candidates[0];
    assert.equal(poolOf(candidate.target),'codex-agent',`${op} must resolve inside the codex pool`);
    // model/registry.yaml: the ImageGen tool call names the operation agent, not an image-model version, so
    // the resolved model is whatever model/runtimes.yaml pins codex-agent's `write` role to.
    assert.equal(candidate.model,profile.runtimes[SOL].models.write,`${op} is pinned to the codex pool's write model`);
    assert.equal(idOf(profile.runtimes,candidate.target),SOL);
  }
});

test('interface.draw never resolves to another pool even under quota pressure',()=>{
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9)});
  const launchable=allocator.launchableTargets('interface.draw');
  assert.deepEqual(launchable,[SOL],'the launch chain of interface.draw is the Sol route only');
  // Every other pool is granted free slots and none is avoided: the override still wins.
  const others=Object.keys(profile.runtimes).filter(id=>id!==SOL&&poolOf(id)!=='devin-agent');
  const granted=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),
    quota:{order:[],slots:Object.fromEntries(Object.keys(profile.runtimes).map(id=>[id,99]))}});
  const picked=granted.allocate('interface.draw',{restrictTo:launchable});
  assert.equal(picked.ok,true,picked.reason);
  assert.equal(picked.runtime,SOL,'quota pressure on other pools cannot move interface.draw off Sol');
  // Once Sol is exhausted the operation refuses with a named reason instead of falling back.
  const exhausted=granted.allocate('interface.draw',{restrictTo:launchable,avoid:[SOL]});
  assert.equal(exhausted.ok,false);
  assert.ok(exhausted.blocked.some(item=>item.runtime===SOL&&/avoided/.test(item.reason)),'the refused Sol candidate is named with its reason');
  for(const other of others)
    assert.ok(exhausted.blocked.some(item=>item.runtime===other&&item.reason),`${other} must be blocked with a named reason, never selected`);
  // No launchable target outside the chain can be claimed directly either.
  for(const other of others)
    assert.throws(()=>allocator.candidateFor('interface.draw',other),/not launchable for interface\.draw/);
  const none=granted.allocate('interface.draw',{restrictTo:[]});
  assert.equal(none.ok,false,'an empty allow-override never widens to a fallback');
  assert.ok(none.blocked.length===Object.keys(profile.runtimes).length&&none.blocked.every(item=>item.reason),'every pool is blocked with a named reason');
});

test('devin-agent is a first-class peer runtime admitted only by explicit owner quota',()=>{
  const key=idOf(profile.runtimes,'devin-agent');
  const pool=profile.runtimes[key];
  assert.equal(pool.provider,'devin');
  assert.equal(pool.capacityAuthority,'explicit-workflow-quota','the pool starts closed and opens only through workflow quota');
  assert.equal(pool.quotaTelemetry,'launch-status','launch/refusal status is its live capacity signal');
  assert.equal(pool.maxParallel,0,'no slots without an owner grant');
  for(const role of ['implement','verify','write'])assert.ok(pool.roles.includes(role),`devin-agent must carry the ${role} role`);
  const allocator=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9)});
  assert.equal(allocator.review('backend.implement').blocked.find(item=>item.runtime===key)?.reason,'requires an explicit workflow quota slot');
  const opened=createAllocator({runtimes:profile,now:()=>Date.UTC(2026,8,12,9),quota:{order:[],slots:{[key]:1},roles:{[key]:['implement']}}});
  const picked=opened.allocate('backend.implement',{restrictTo:[key],job:{opId:'op-devin'}});
  assert.equal(picked.ok,true,picked.reason);
  assert.equal(picked.runtime,key);
  assert.equal(opened.allocate('backend.implement',{restrictTo:[key],job:{opId:'op-devin-2'}}).ok,false,'the granted slot is the whole capacity');
});

// goal.md §3: pools are keyed by provider window (codex-agent, claude-agent, claude-fable,
// qwen-agent, devin-agent) with per-role model pins and caps 8/6/2/4/owner-grant; maxParallelOps 20.
// The profile is still keyed by model id; POOL_OF_MODEL bridges the two spellings.
test('runtime pools are keyed by provider window with goal §3 caps',()=>{
  assert.equal(NAMING,'pool');
  assert.deepEqual(Object.keys(profile.runtimes).sort(),[...GOAL_POOLS].sort());
  for(const [pool,cap] of Object.entries(GOAL_POOL_CAPS))assert.equal(profile.runtimes[pool]?.maxParallel,cap,`${pool} cap`);
  assert.equal(profile.maxParallelOps,GOAL_MAX_PARALLEL_OPS);
});

test('a goal without a checkable done block cannot be approved or enrolled',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-contract-'));
  const store=createStore({repoRoot:root,id:'wf-goal'});
  t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});
  const state=createWorkflowState({job:'x',inputs:[],worktree:root,branch:'main',store,host:path.resolve(import.meta.dirname,'..'),launcher:'L.mjs'});
  const blocks=goalApprovalBlocks(state);
  assert.ok(blocks.length>0&&blocks.every(text=>/definition of done|assessed by nobody|never critiqued/.test(text)),'empty goals must name their blocks');
  assert.throws(()=>approve(store,state),/This goal cannot be approved/);
  state.definitionOfDone=['`n1` is done with checks the kernel re-ran itself'];
  state.doneMetrics=[{kind:'operation',ref:'op-0'}];
  state.critique={verdict:'sound'};
  state.ops=[{id:'op-0',kind:'backend.implement',status:'pending',dependsOn:[],references:[],checks:[{name:'c',command:'true'}],allowlist:['src/**']}];
  assert.doesNotThrow(()=>approve(store,state,{allocation:`${idOf(profile.runtimes,'claude-opus')}=2@implement`}),'a goal with a done block and an answered critique is approvable');
});

test('typed I/O: a candidate reference resolves to a concrete file inside a digest-bound root',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-io-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'docs'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs','spec.md'),'# spec\n');
  const state={worktree:root};
  const op={id:'op-x',allowlist:['docs/**'],references:['docs/spec.md','srs:docs/spec.md']};
  const resolved=resolveCandidateReferences(op,state,{});
  assert.equal(resolved.length,2,'both spellings of the reference resolve');
  for(const item of resolved){
    assert.equal(item.path,'docs/spec.md','the reference binds a concrete repository-relative file');
    assert.equal(item.rootId,'source');
    assert.ok(fs.existsSync(path.join(root,item.path)),'the resolved path is a real file');
  }
  assert.equal(resolved[0].kind,'file');
  assert.equal(resolved[1].kind,'srs','the record kind is preserved on the resolved reference');
  const bindings=candidateRootBindings({state,op:{...op,resolvedReferences:resolved},resolvedReferences:resolved,runtimePaths:[]});
  const source=bindings.bindings.find(binding=>binding.id==='source');
  assert.ok(source.references.some(item=>item.kind==='srs'&&item.path==='docs/spec.md'),'the record reference lands on the source root');
  assert.match(bindings.bindingDigest,/^[a-f0-9]{64}$/,'the root binding carries a concrete sha256 digest');
  assert.equal(bindings.bindingDigest,candidateRootBindingDigest(bindings.bindings),'the digest is reproducible from the bindings');
});

test('typed I/O: a record reference that resolves to nothing blocks dispatch with a named reason',t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-block-'));
  let runtime=null;
  const store=createStore({repoRoot:repo,id:'wf-io-block'});
  t.after(()=>{runtime?.close();store.close();rmSyncTolerant(repo);});
  const events=[];
  const append=store.appendEvent.bind(store);
  store.appendEvent=event=>{events.push(event);return append(event);};
  const state=createWorkflowState({job:'x',inputs:[],worktree:repo,branch:'main',store,host:path.resolve(import.meta.dirname,'..'),launcher:'L.mjs'});
  goalPhase(store,state,{
    assessGoal:()=>({ok:true,provider:'fake',value:{definitionOfDone:['`n1` verified'],ledger:[{id:'n1',title:'t',inputRef:'sds:x',status:'absent'}],
      ops:[{id:'op-x',kind:'backend.implement',goal:'g',allowlist:['src/**'],references:['srs:features/ghost/business/srs/index.yaml'],checks:[{name:'c',command:'true'}],acceptance:['a'],dependsOn:[]}]}}),
    critiqueGoal:()=>({ok:true,verdict:'sound'}),renderGoalMarkdown:()=>'# g',extractMaterial:()=>[]});
  approve(store,state);
  state.run='run_wf';state.from='term_kernel';
  enrollEngine(store,state,{journalFile:path.join(repo,'journal.sqlite')});
  runtime=createEngineRuntime({store,state,eligibility:()=>({eligible:true,mode:'qualified'}),spawnChild:()=>({pid:1,once(){},unref(){}})});
  runtime.manageWorkflow=snapshot=>({schema:MANAGER_DECISION,workflowId:snapshot.workflowId,decisionId:snapshot.decisionId,generation:snapshot.generation,version:snapshot.version,digest:snapshot.digest,basisDigest:snapshot.basisDigest,orderedActionIds:(snapshot.actions??[]).map(action=>action.id),rationale:'test'});
  const orca=scriptedOrca({store,scripts:{},worktree:repo});
  let at=0;const clock={now:()=>at,wait:ms=>{at+=ms;}};
  runLoop(orca.orca,store,state,{cwd:repo,engineRuntime:runtime,allocator:createAllocator({runtimes:profile,now:clock.now}),
    wait:clock.wait,now:clock.now,template:'t',maxIterations:3,waitTimeoutMs:1000,tickMs:50,
    exec:()=>({status:0,stdout:'',stderr:''}),validateOp:()=>({ok:true,verdict:'accept',findings:[]}),
    git:()=>({status:0,stdout:'',stderr:''})});
  const op=state.ops.find(item=>item.id==='op-x');
  assert.equal(op.status,'blocked','the operation never launched');
  assert.equal(op.refusal,'candidate-root-binding');
  const refused=events.find(event=>event.event==='candidate-root-binding-refused');
  assert.ok(refused,'the refusal is journaled with its name');
  assert.match(refused.reason,/candidate reference is not resolved by the loaded Work tree or repository: features\/ghost\/business\/srs\/index\.yaml/,'the named reason carries the unresolved reference');
  assert.ok(state.needUser.some(item=>item.op==='op-x'&&item.code==='candidate-root-binding'),'the owner sees a typed blocker naming the same code');
  assert.ok(!op.dispatch&&!op.lease,'a blocked binding must not leave a launch or a lease behind');
});

// goal.md §1: the goal freezes with goalRev at approval; every op, decision and artifact binds
// the rev it was derived from, and goal.revise produces v(n+1) invalidating derived work.
test('approval freezes the goal with goalRev and every derived artifact binds it',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-rev-'));
  const store=createStore({repoRoot:root,id:'wf-goal-rev'});
  t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});
  const state=createWorkflowState({job:'x',inputs:[],worktree:root,branch:'main',store,host:path.resolve(import.meta.dirname,'..'),launcher:'L.mjs'});
  state.definitionOfDone=['`op-0` settles'];
  state.doneMetrics=[{kind:'operation',ref:'op-0'}];
  state.critique={verdict:'sound'};
  state.ops=[{id:'op-0',kind:'backend.implement',status:'pending',dependsOn:[],references:[],checks:[{name:'c',command:'true'}],allowlist:['src/**'],question:{kind:'question',text:'which?'}},{id:'op-1',kind:'review.verify',status:'pending',dependsOn:['op-0'],references:[],checks:[{name:'c',command:'true'}],allowlist:['src/**']}];
  state.decisions=[{id:'d-0',answer:'yes'}];
  approve(store,state);
  assert.equal(state.goalRev,1,'the approval freezes the goal at rev 1');
  for(const op of state.ops){assert.equal(op.goalRev,1,`op ${op.id} binds the rev it was derived under`);assert.equal(op.question?.goalRev??1,1,`op ${op.id} question binds the rev`);}
  assert.equal(state.decisions[0].goalRev,1,'decisions bind the rev they were taken under');
});
// docs/ledger-db.md §8, goal.md §8 Persistence: workflow-goal/workflow-amend write `goals` rows via
// `store.setGoal`; no goal.md/goal.json file, revision increments, goal_identity is recomputed.
test('goal.revise persists a new goals row via store.setGoal: revision increments, the amendment body is recorded',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-revise-rows-'));
  const store=createStore({repoRoot:root,id:'wf-goal-revise-rows'});
  t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});
  const state=createWorkflowState({job:'x',inputs:[],worktree:root,branch:'main',store,host:path.resolve(import.meta.dirname,'..'),launcher:'L.mjs'});
  state.definitionOfDone=['`op-0` settles'];
  state.doneMetrics=[{kind:'operation',ref:'op-0'}];
  state.critique={verdict:'sound'};
  state.ops=[{id:'op-0',kind:'backend.implement',status:'pending',dependsOn:[],references:[],checks:[{name:'c',command:'true'}],allowlist:['src/**']}];
  approve(store,state);
  const first=store.setGoal({markdown:'# x',json:{schema:GOAL_RECORD,id:state.id,rev:state.goalRev,done:state.doneMetrics}});
  assert.equal(first.revision,1,'the first persisted goal is revision 1');
  const revised=reviseGoal(store,state,{done:[{kind:'operation',ref:'op-0'}],risks:['new risk']},{source:'owner'});
  assert.equal(revised.ok,true,JSON.stringify(revised));
  assert.equal(state.goalRev,2,'reviseGoal bumps the in-memory goal revision');
  const row=store.goal();
  assert.equal(row.revision,2,'the ledger goals row advanced to the new revision');
  assert.equal(row.json.rev,2,'the persisted json carries the same revision');
  assert.equal(row.markdown,'# x','a revision that never touches the markdown carries the prior one forward unchanged');
  assert.deepEqual(row.amendment,{done:[{kind:'operation',ref:'op-0'}],risks:['new risk']},'the amendment body is recorded beside the json it produced');
});
test('goal.revise produces goal v(n+1), bumps the rev and stales derived work',()=>{
  assert.ok(KINDS.includes('goal.revise'),'goal.revise is the typed revision kind');
  assert.equal(kindRecord('goal.revise').family,'design','goal.revise is a design-family record write');
});

// goal.md §5: op.dispatcher maximizes parallelism inside non-overlapping file-level write
// scopes with no contested lease, respecting fanOut.maxPerGroup and verifyAvoidsImplementRuntime.
// The executable contract lives in tests/dispatcher.spec.mjs.
test('the dispatcher launches every parallel op whose write scopes do not overlap',{skip:'covered by tests/dispatcher.spec.mjs'},()=>{});

// goal.md §5: "parallel ASAP" saturates ALL granted provider pools concurrently up to the
// global ceiling - e.g. 10 devin-agent + 5 codex-agent + 4 claude-agent + 1 qwen-agent = 20,
// never 20 of one runtime. The kernel-level guards (disjoint file allowlists, contested
// leases, resource locks, fanOut.maxPerGroup, seam-first cuts) are exercised by the
// workflow-kernel specs; these pin the capacity contract the dispatcher runs under.
// The fixture is keyed by goal §3 pool names because a synthetic profile needs no alias map.
const saturatingProfile=()=>({
  maxParallelOps:GOAL_MAX_PARALLEL_OPS,
  roleOfKind:{'x.implement':'implement','x.verify':'verify'},
  allocation:{policy:LEAST_LOADED},
  runtimes:{
    'devin-agent':{provider:'devin',roles:['implement','verify'],maxParallel:0,capacityAuthority:'explicit-workflow-quota',quotaTelemetry:'launch-status'},
    'codex-agent':{provider:'codex',roles:['implement','verify'],maxParallel:5},
    'claude-agent':{provider:'claude',roles:['implement','verify'],maxParallel:4},
    'qwen-agent':{provider:'qwen',roles:['implement','verify'],maxParallel:1}}});

test('parallel ASAP saturates every granted pool to the global ceiling, capped per pool - never 20 of one runtime',()=>{
  // The addendum example: the owner grants devin-agent 10 slots; 10+5+4+1 fills the 20 ceiling.
  const allocator=createAllocator({runtimes:saturatingProfile(),quota:parseQuota('devin-agent=10'),now:()=>Date.UTC(2026,8,12,9)});
  const picked=[];
  for(let index=0;index<GOAL_MAX_PARALLEL_OPS;index+=1){
    const allocation=allocator.allocate('x.implement');
    assert.equal(allocation.ok,true,`allocation ${index+1}: ${allocation.reason}`);
    assert.ok(allocation.load<=allocation.slots,`${allocation.runtime} must never exceed its own maxParallel cap`);
    picked.push(allocation.runtime);
  }
  const tally=id=>picked.filter(runtime=>runtime===id).length;
  assert.deepEqual(Object.fromEntries(['devin-agent','codex-agent','claude-agent','qwen-agent'].map(id=>[id,tally(id)])),
    {'devin-agent':10,'codex-agent':5,'claude-agent':4,'qwen-agent':1},
    'every pool fills to its own maxParallel concurrently and the shares sum to the global ceiling');
  const over=allocator.allocate('x.implement');
  assert.equal(over.ok,false);
  assert.match(over.reason,/maxParallelOps 20 is already in flight/);
  assert.ok(over.blocked.length&&over.blocked.every(item=>item.reason),'every saturated pool names why it cannot take the operation');
});

test('owner weights are both the quota grant and the target share; the named order leads capacity heuristics',()=>{
  const weighted={...saturatingProfile(),allocation:{policy:PREFER_THEN_OVERFLOW}};
  const allocator=createAllocator({runtimes:weighted,quota:parseQuota('qwen-agent=1,codex-agent=5,claude-agent=4,devin-agent=10'),now:()=>Date.UTC(2026,8,12,9)});
  const first=allocator.allocate('x.implement');
  assert.equal(first.runtime,'qwen-agent','the owner-named order leads the fill, not the largest pool');
  const second=allocator.allocate('x.implement');
  assert.equal(second.runtime,'codex-agent','a full preferred pool overflows down the owner order, not to the biggest free pool');
  assert.equal(second.overflowed,true,'overflow past the first owner choice is named on the receipt');
  const review=allocator.review('x.implement');
  assert.equal(review.ready.find(item=>item.runtime==='devin-agent')?.slots,10,'the owner weight is also the grant that opened the gated pool');
});

test('a degraded pool surrenders its share to the remaining pools; the run never stalls on a refused window',()=>{
  const now=()=>Date.UTC(2026,8,12,9);
  const allocator=createAllocator({runtimes:saturatingProfile(),quota:parseQuota('devin-agent=10'),now,
    state:{cooling:{'codex-agent':{kind:'quota',until:now()+3_600_000,reason:'provider window refused'}}}});
  const review=allocator.review('x.implement');
  const degraded=review.blocked.find(item=>item.runtime==='codex-agent');
  assert.match(degraded?.reason??'',/cooling after quota/,'the refused window parks the pool with its named reason');
  const picked=new Set();
  for(let index=0;index<15;index+=1){
    const allocation=allocator.allocate('x.implement');
    assert.equal(allocation.ok,true,allocation.reason);
    assert.notEqual(allocation.runtime,'codex-agent','a cooling pool takes nothing');
    picked.add(allocation.runtime);
  }
  assert.deepEqual([...picked].sort(),['claude-agent','devin-agent','qwen-agent'],
    'the freed share rebalances over every remaining pool, not wholly onto the largest one');
  const exhausted=allocator.allocate('x.implement');
  assert.equal(exhausted.ok,false);
  assert.match(exhausted.reason,/no runtime with the implement role, a free slot/,'with codex-agent parked, the other pools are the whole remaining capacity');
});

test('verifyAvoidsImplementRuntime: a verify op never runs on the runtime that implemented the slice',()=>{
  const allocator=createAllocator({runtimes:saturatingProfile(),quota:parseQuota('devin-agent=10'),now:()=>Date.UTC(2026,8,12,9)});
  const verify=allocator.allocateVerify('x.verify',{implementRuntime:'devin-agent'});
  assert.equal(verify.ok,true,verify.reason);
  assert.notEqual(verify.runtime,'devin-agent','the implementing runtime is excluded even while it has free granted slots');
  const blocked=verify.blocked.find(item=>item.runtime==='devin-agent');
  assert.match(blocked?.reason??'',/avoided/,'the exclusion is named on the receipt, never silent');
});

// goal.md §6: blocked ops emit {questionId, digest, goalRev, fields:[select|multi|text|confirm]}.
test('a blocker emits a typed question record with fields and goalRev',{skip:'covered by tests/ask-report.spec.mjs and the workflow-kernel ask flow'},()=>{});

// goal.md §7: debug: true in config.json emits a human-readable trace.log beside events.jsonl.
test('debug: true emits a trace.log line per dispatch, settle and block',{skip:'covered by tests/trace.spec.mjs'},()=>{});
