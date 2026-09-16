import test from 'node:test';
import assert from 'node:assert/strict';
import {cutSizeReason,opScopes,planDispatch,writerKeys} from '../kernel/dispatcher.mjs';
import {CUT_ASSERTIONS,CUT_FILES} from '../kernel/sync.mjs';

/**
 * The dispatch planner's contract (goal §5): parallel where scopes are disjoint, sequential where a file, a
 * lease or a cut group says so, and `implementation.plan` where one op is simply too big. Every decision -
 * launch, cut, wait - carries the reason the debug trace prints.
 */
const op=(id,extra={})=>({id,kind:'backend.implement',role:'implement',status:'ready',goal:`build ${id}`,
  allowlist:[],references:[],checks:[],acceptance:[],dependsOn:[],ledgerIds:[],nodeId:null,
  avoidRuntimes:[],resources:[],...extra});
const state=(ops=[],extra={})=>({id:'wf-dispatch',worktree:'/repo',ops,cuts:{},ledger:[],...extra});
const allocator=(extra={})=>({maxParallelOps:10,fanOut:{seamFirst:true,maxPerGroup:9},...extra});

/* ------------------------------------------------------------------ the parallel rule */

test('ops with disjoint write scopes launch together',()=>{
  const a=op('a',{allowlist:['src/a/**']}),b=op('b',{allowlist:['src/b/**']});
  const plan=planDispatch(state([a,b]),[a,b],allocator());
  assert.deepEqual(plan.launch,['a','b']);
  assert.deepEqual(plan.cut,[]);
  assert.deepEqual(plan.wait,[]);
  assert.match(plan.reasons.a,/parallel-safe/);
  assert.match(plan.reasons.b,/parallel-safe/);
});

test('a write-read conflict defers the second op and names the file and its holder',()=>{
  const a=op('a',{allowlist:['src/a/**']});
  const b=op('b',{allowlist:['src/b/**'],references:['file:src/a/util.ts']});
  const plan=planDispatch(state([a,b]),[a,b],allocator());
  assert.deepEqual(plan.launch,['a']);
  assert.equal(plan.wait.length,1);
  assert.equal(plan.wait[0].op,'b');
  assert.equal(plan.wait[0].file,'src/a/util.ts');
  assert.equal(plan.wait[0].holder,'a');
  assert.match(plan.wait[0].reason,/src\/a\/util\.ts.*a/);
});

test('a candidate never reads a file an in-flight op is rewriting',()=>{
  const running=op('running-1',{allowlist:['src/a/**']});running.status='running';
  const candidate=op('c',{allowlist:['src/c/**'],references:['src/a/util.ts']});
  const plan=planDispatch(state([running,candidate]),[candidate],allocator());
  assert.deepEqual(plan.launch,[]);
  assert.equal(plan.wait[0].op,'c');
  assert.match(plan.wait[0].reason,/running-1/);
});

test('two ops reading the same file still launch together; write-write defers',()=>{
  const shared=['file:docs/spec.md'];
  const a=op('a',{allowlist:['src/a/**'],references:shared});
  const b=op('b',{allowlist:['src/b/**'],references:shared});
  assert.deepEqual(planDispatch(state([a,b]),[a,b],allocator()).launch,['a','b'],'read-read never conflicts');
  const c=op('c',{allowlist:['src/a/util.ts']});
  const clashing=planDispatch(state([a,c]),[a,c],allocator());
  assert.deepEqual(clashing.launch,['a']);
  assert.equal(clashing.wait[0].op,'c');
  assert.match(clashing.wait[0].reason,/write scope/);
});

test('record references resolve through the ledger to the paths a write scope can collide with',()=>{
  const running=op('author',{kind:'work.author',role:'plan',allowlist:['.starciwork/features/sale/**']});running.status='running';
  const s=state([running],{ledger:[{id:'demo.sale.node',title:'sale',inputRef:'features/sale/index.yaml'}]});
  const candidate=op('reader',{allowlist:['src/x/**'],references:['srs:demo.sale.node']});
  const plan=planDispatch(s,[candidate],allocator());
  assert.equal(plan.wait[0]?.op,'reader');
  assert.match(plan.wait[0].reason,/\.starciwork\/features\/sale\/index\.yaml/);
});

/* ------------------------------------------------------------------ leases and slots */

test('two ops needing the same canonical writer never co-launch',()=>{
  const root='/repo/product';
  const binding=id=>({candidateRootBindings:{bindings:[{id:'source',repoRoot:root,workerWritable:true,runtimeWritable:false}]}});
  const a=op('a',{allowlist:['src/a/**'],...binding()});
  const b=op('b',{allowlist:['src/b/**'],...binding()});
  assert.equal(writerKeys(a)[0],writerKeys(b)[0],'the same root declares the same canonical-writer fence');
  const plan=planDispatch(state([a,b]),[a,b],allocator());
  assert.deepEqual(plan.launch,['a']);
  assert.equal(plan.wait[0].op,'b');
  assert.match(plan.wait[0].reason,/canonical writer.*a/);
  const elsewhere=op('elsewhere',{allowlist:['src/c/**'],
    candidateRootBindings:{bindings:[{id:'source',repoRoot:'/repo/other',workerWritable:true,runtimeWritable:false}]}});
  assert.deepEqual(planDispatch(state([a,elsewhere]),[a,elsewhere],allocator()).launch,['a','elsewhere'],
    'a different fenced root contends nothing');
});

test('an inferred machine resource serializes the ops that both need it',()=>{
  const checks=[{name:'e2e',command:'npx playwright test'}];
  const a=op('a',{allowlist:['src/a/**'],checks}),b=op('b',{allowlist:['src/b/**'],checks});
  const plan=planDispatch(state([a,b]),[a,b],allocator());
  assert.deepEqual(plan.launch,['a']);
  assert.equal(plan.wait[0].op,'b');
  assert.match(plan.wait[0].reason,/e2e-runtime/);
});

test('maxParallelOps bounds the plan, counting ops already in flight',()=>{
  const running=op('running-1',{allowlist:['src/r/**']});running.status='running';
  const a=op('a',{allowlist:['src/a/**']}),b=op('b',{allowlist:['src/b/**']});
  const plan=planDispatch(state([running,a,b]),[a,b],allocator({maxParallelOps:2}));
  assert.deepEqual(plan.launch,['a']);
  assert.equal(plan.wait[0].op,'b');
  assert.match(plan.wait[0].reason,/maxParallelOps 2 is already in flight/);
});

/* ------------------------------------------------------------------ the cut rule */

test('an op past the cut bounds is routed to implementation.plan instead of launched',()=>{
  const wide=op('wide',{allowlist:Array.from({length:CUT_FILES+1},(_,i)=>`src/f${i}.ts`)});
  const deep=op('deep',{allowlist:['src/deep/**'],assertions:Array.from({length:CUT_ASSERTIONS+1},(_,i)=>`assertion ${i}`)});
  const fine=op('fine',{allowlist:['src/fine/**']});
  const plan=planDispatch(state([wide,deep,fine]),[wide,deep,fine],allocator());
  assert.deepEqual(plan.cut,['wide','deep']);
  assert.deepEqual(plan.launch,['fine'],'a cut consumes no launch slot');
  assert.match(plan.reasons.wide,/write scope names 13 files/);
  assert.match(plan.reasons.deep,/9 assertions/);
  assert.match(plan.reasons.wide,/implementation\.plan/);
});

test('a verify op is never cut: only implement-role ops are measured',()=>{
  const verify=op('verify-1',{kind:'review.verify',role:'verify',
    allowlist:Array.from({length:CUT_FILES+1},(_,i)=>`evidence/f${i}.md`)});
  assert.equal(cutSizeReason(verify),null);
  const plan=planDispatch(state([verify]),[verify],allocator());
  assert.deepEqual(plan.cut,[]);
  assert.deepEqual(plan.launch,['verify-1']);
});

/* ------------------------------------------------------------------ the fan-out rule */

test('children of one cut parent are bounded by fanOut.maxPerGroup',()=>{
  const cuts={p:{children:['c1','c2','c3'],seam:null,assertions:[]}};
  const kids=['c1','c2','c3'].map(id=>op(`op-${id}`,{nodeId:id,allowlist:[`src/${id}/**`]}));
  const s=state(kids,{cuts});
  const plan=planDispatch(s,kids,allocator({fanOut:{seamFirst:true,maxPerGroup:2}}));
  assert.deepEqual(plan.launch,['op-c1','op-c2']);
  assert.equal(plan.wait[0].op,'op-c3');
  assert.match(plan.wait[0].reason,/maxPerGroup|children of p/);
});

test('the seam child launches alone and first, whatever order the candidates arrive in',()=>{
  const cuts={p:{children:['seam','c1','c2'],seam:'seam',assertions:[]}};
  const seam=op('op-seam',{nodeId:'seam',allowlist:['src/seam/**']});
  const c1=op('op-c1',{nodeId:'c1',allowlist:['src/c1/**']});
  const c2=op('op-c2',{nodeId:'c2',allowlist:['src/c2/**']});
  const s=state([c1,c2,seam],{cuts});
  const plan=planDispatch(s,[c1,c2,seam],allocator());
  assert.deepEqual(plan.launch,['op-seam'],'the seam wins even listed last');
  assert.deepEqual(plan.wait.map(item=>item.op),['op-c1','op-c2']);
  assert.match(plan.wait[0].reason,/seam.*runs alone|launches first/);
});

test('siblings wait while their seam is in flight; the seam waits for running siblings',()=>{
  const cuts={p:{children:['seam','c1'],seam:'seam',assertions:[]}};
  const runningSeam=op('op-seam',{nodeId:'seam',allowlist:['src/seam/**']});runningSeam.status='running';
  const sibling=op('op-c1',{nodeId:'c1',allowlist:['src/c1/**']});
  const held=planDispatch(state([runningSeam,sibling],{cuts}),[sibling],allocator());
  assert.deepEqual(held.launch,[]);
  assert.match(held.wait[0].reason,/seam seam of p runs alone/);
  const runningSibling=op('op-c1',{nodeId:'c1',allowlist:['src/c1/**']});runningSibling.status='running';
  const seamOp=op('op-seam',{nodeId:'seam',allowlist:['src/seam/**']});
  const heldSeam=planDispatch(state([runningSibling,seamOp],{cuts}),[seamOp],allocator());
  assert.deepEqual(heldSeam.launch,[]);
  assert.match(heldSeam.wait[0].reason,/seam of p runs alone/);
});

/* ------------------------------------------------------------------ allocator readiness and determinism */

test('allocator.review is consulted for free slots, and planned launches spend them',()=>{
  const calls=[];
  const review=(kind,args)=>{calls.push({kind,avoid:args.avoid});return {ready:[{runtime:'r1',free:1}],blocked:[]};};
  const a=op('a',{allowlist:['src/a/**']}),b=op('b',{allowlist:['src/b/**']});
  const plan=planDispatch(state([a,b]),[a,b],allocator({review}));
  assert.deepEqual(plan.launch,['a'],'the one free slot is spent by the first plan');
  assert.equal(plan.wait[0].op,'b');
  assert.match(plan.wait[0].reason,/free slot/);
  assert.equal(calls.length,2);
});

test('a review.verify op avoids the runtime that implemented its slice',()=>{
  const builder=op('build-1',{allowlist:['src/a/**'],ledgerIds:['n1']});builder.status='done';builder.runtime='claude-agent';
  const review=op('review-1',{kind:'review.verify',role:'verify',allowlist:['evidence/**'],ledgerIds:['n1']});
  const seen=[];
  const allocatorWithReview=allocator({review:(kind,args)=>{seen.push(args);return {ready:[{runtime:'r2',free:2}],blocked:[]};}});
  const plan=planDispatch(state([builder,review]),[review],allocatorWithReview);
  assert.deepEqual(plan.launch,['review-1']);
  assert.deepEqual(seen[0].avoid,['claude-agent']);
});

test('no ready runtime means wait, and the reason names the role',()=>{
  const a=op('a',{allowlist:['src/a/**']});
  const plan=planDispatch(state([a]),[a],allocator({review:()=>({ready:[],blocked:[{runtime:'r1',reason:'no free slot'}]})}));
  assert.deepEqual(plan.launch,[]);
  assert.equal(plan.wait[0].op,'a');
  assert.match(plan.wait[0].reason,/implement role.*r1 \(no free slot\)/);
});

test('the plan is pure and deterministic: same state, same plan, nothing mutated',()=>{
  const a=op('a',{allowlist:['src/a/**']}),b=op('b',{allowlist:['src/b/**'],references:['file:src/a/x.ts']});
  const s=state([a,b]),alloc=allocator();
  const before=JSON.stringify(s);
  const first=planDispatch(s,[a,b],alloc),second=planDispatch(s,[a,b],alloc);
  assert.deepEqual(first,second);
  assert.equal(JSON.stringify(s),before,'the planner writes nothing back into state');
  assert.ok(Object.keys(first.reasons).length===2,'every decision carries a reason');
});

test('ops that cannot be launched anyway wait with their own reason',()=>{
  const leased=op('leased',{allowlist:['src/l/**'],lease:{jobId:'j1'}});
  const filling=op('filling',{allowlist:['src/f/**'],fill:{variables:['TOKEN']}});
  const plan=planDispatch(state([leased,filling]),[leased,filling],allocator());
  assert.deepEqual(plan.launch,[]);
  assert.deepEqual(plan.wait.map(item=>item.op),['leased','filling']);
  assert.match(plan.wait[0].reason,/durable reservation/);
  assert.match(plan.wait[1].reason,/credential custody/);
});
