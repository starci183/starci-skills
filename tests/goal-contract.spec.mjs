import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {KINDS,FAMILIES,ROLES,BLOCKERS,OUTCOMES,CAPABILITIES,kindRecord,loadKinds} from '../kernel/graph.mjs';
import {RECORD_KINDS} from '../kernel/io.mjs';
import {resolveExecutionChain} from '../kernel/chains.mjs';
import {createAllocator} from '../kernel/schedule.mjs';
import {goalApprovalBlocks,approve} from '../kernel/goal.mjs';
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
// ad-hoc. The ad-hoc marker does not exist in ops/registry.yaml yet; today these operators are
// registered but not kinded: content.generate, knowledge.repair, release.deliver, scope.retire,
// task.execute, workspace.manage.
test('no orphan operators: every ops/ directory is wired to a kind or explicitly marked ad-hoc',{skip:'ad-hoc marking is not merged; the six unwired operators are content.generate, knowledge.repair, release.deliver, scope.retire, task.execute, workspace.manage'},()=>{});

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

// goal.md §2 names kinds not yet in the catalog (request.analyze, scope.define, code.refactor,
// test.author, security.verify, perf.verify, release.deliver, scope.retire, docs.author,
// knowledge.repair, workspace.manage, content.generate). Enable when the catalog merges them.
test('the full goal §2 chain is in the catalog: intake, refactor, test.author, security/perf verify, deliver, retire, govern',{skip:'request.analyze, scope.define, code.refactor, test.author, security.verify, perf.verify, docs.author and the deliver/retire/govern kinds are not merged into model/kinds.yaml yet'},()=>{});

test('interface.draw and interface.asset allow only the image route: one candidate, Sol-pinned',{skip:false},()=>{
  for(const op of ['interface.draw','interface.asset']){
    const chain=resolveExecutionChain({skill:'starci',op});
    assert.equal(chain.candidates.length,1,`${op} must have exactly one launch candidate`);
    const candidate=chain.candidates[0];
    assert.equal(poolOf(candidate.target),'codex-agent',`${op} must resolve inside the codex pool`);
    assert.equal(candidate.model,'gpt-5.6-sol',`${op} is pinned to the gpt-5.6-sol model inside its pool`);
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
test('runtime pools are keyed by provider window with goal §3 caps',{skip:'goal §3 pool naming (codex-agent, claude-agent, claude-fable, qwen-agent) is not merged into model/runtimes.yaml yet'},()=>{
  assert.equal(NAMING,'pool');
  assert.deepEqual(Object.keys(profile.runtimes).sort(),[...GOAL_POOLS].sort());
  for(const [pool,cap] of Object.entries(GOAL_POOL_CAPS))assert.equal(profile.runtimes[pool]?.maxParallel,cap,`${pool} cap`);
  assert.equal(profile.maxParallelOps,GOAL_MAX_PARALLEL_OPS);
});

test('a goal without a checkable done block cannot be approved or enrolled',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-contract-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'wf-goal'});
  const state=createWorkflowState({job:'x',inputs:[],worktree:root,branch:'main',store,host:path.resolve(import.meta.dirname,'..'),launcher:'L.mjs'});
  const blocks=goalApprovalBlocks(state);
  assert.ok(blocks.length>0&&blocks.every(text=>/definition of done|assessed by nobody|never critiqued/.test(text)),'empty goals must name their blocks');
  assert.throws(()=>approve(store,state),/This goal cannot be approved/);
  state.definitionOfDone=['`n1` is done with checks the kernel re-ran itself'];
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
  t.after(()=>{runtime?.close();fs.rmSync(repo,{recursive:true,force:true});});
  const store=createStore({repoRoot:repo,id:'wf-io-block'});
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
  const orca=scriptedOrca({reportsDir:store.paths.reports,scripts:{},worktree:repo});
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
// Neither state.goalRev nor a goal.revise kind exists yet.
test('approval freezes the goal with goalRev and every derived artifact binds it',{skip:'goalRev is not merged; state carries goalDigest but no rev, and goal.revise is not in the catalog'},()=>{});
test('goal.revise produces goal v(n+1), bumps the rev and stales derived work',{skip:'the goal.revise typed op and rev invalidation are not merged'},()=>{});

// goal.md §5: op.dispatcher maximizes parallelism inside non-overlapping file-level write
// scopes with no contested lease, respecting fanOut.maxPerGroup and verifyAvoidsImplementRuntime.
test('the dispatcher launches every parallel op whose write scopes do not overlap',{skip:'the goal §5 dispatcher is not merged; scheduling is manager-dispatched one tick at a time'},()=>{});

// goal.md §6: blocked ops emit {questionId, digest, goalRev, fields:[select|multi|text|confirm]}.
test('a blocker emits a typed question record with fields and goalRev',{skip:'question records carry kind/text/options today; the fields vocabulary, questionId and goalRev binding are not merged'},()=>{});

// goal.md §7: debug: true in config.json emits a human-readable trace.log beside events.jsonl.
test('debug: true emits a trace.log line per dispatch, settle and block',{skip:'debug trace.log is not merged; the event stream is the only record today'},()=>{});
