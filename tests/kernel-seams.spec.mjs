import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {markDone,markInProgress,readNode} from '../kernel/ledger.mjs';
import {toOp} from '../kernel/common.mjs';
import {applyOpReport,renderContract} from '../kernel/kernel.mjs';
import {validateAccepted} from '../kernel/verify.mjs';
import {settleIntake} from '../kernel/intake.mjs';
import {recordDone,syncLedgerOps} from '../kernel/sync.mjs';
import {answerOwnerQuestion} from '../kernel/owner.mjs';
import {ioPayload} from '../kernel/io.mjs';

/**
 * The seams the other packages of 5-plus plug into. Each is a hook the kernel is given, each defaults to
 * `null`, and each test hands in a fake one: the claim under test is that the kernel calls it at the right
 * moment, names the right event, and behaves exactly as it did before when it was given none.
 */
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-kernel-seams',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};

function stubStore(dir){
  const events=[];
  return {id:'wf-seam',dir,events,
    paths:{reports:path.join(dir,'reports'),goal:path.join(dir,'goal.md'),goalJson:path.join(dir,'goal.json'),
      inbox:path.join(dir,'inbox'),final:path.join(dir,'final.json'),launch:path.join(dir,'launch.json'),
      contracts:path.join(dir,'contracts')},
    appendEvent(event){events.push(event);return event;},
    saveState(){},
    readEvents(){return events;},
    readReports(){return [];},
    checksPath:id=>path.join(dir,'checks',`${id}.json`),
    contractPath:id=>path.join(dir,'contracts',`${id}.md`),
    reportPath:dispatch=>path.join(dir,'reports',`${dispatch}.json`)};
}
const stubState=(store,ops=[])=>({id:store.id,dir:store.dir,job:'a seam under test',worktree:store.dir,branch:'seam',
  ledgerMode:'plan',scope:[],inputs:[],ledger:[],ops,needUser:[],lanes:{},gates:[],gateResults:[],verifyRounds:{},
  gateRounds:0,counters:{},iterations:1,decisions:[],sharedQueue:[],silences:{},dynamicOps:0,dynamicOpsBudget:64,
  head:null,stalls:0,critique:null,approved:true});
/** A worktree git that reports exactly the given files dirty and lets a commit clear them. */
function fakeGit(dirty=[]){
  let pending=[...dirty];
  return (executable,args)=>{
    if(args[0]==='status')return {status:0,stdout:pending.map(file=>` M ${file}`).join('\n'),stderr:''};
    if(args[0]==='commit'){pending=[];return {status:0,stdout:'',stderr:''};}
    if(args[0]==='rev-parse')return {status:0,stdout:`${'b'.repeat(40)}\n`,stderr:''};
    return {status:0,stdout:'',stderr:''};
  };
}
const doneReport=({dispatch='ctx_1',files=[],checks=[{name:'unit',command:'npx vitest run',exitCode:0,evidence:'ok'}]}={})=>
  buildReport({outcome:'done',run:'run_seam',task:'task_1',dispatch,from:'term_1',summary:'the slice is built',files,checks});
const guards={protectedPaths:()=>[],revertProtected:()=>({reverted:[],removed:[]}),resourceLocks:()=>[],
  resourcesClash:()=>false,gitQueue:fn=>fn(),preflight:()=>({ok:true,fixes:[],problems:[]}),parseSharedChangePaths:()=>[]};
const baseCtx=(dir,extra={})=>({cwd:dir,git:fakeGit(),exec:()=>({status:0,stdout:'',stderr:''}),guards,orca:null,
  now:()=>1,validateOp:null,work:null,allocator:{snapshot:()=>({cooling:[]})},validator:['stub'],
  reconcile:null,renderChecks:null,contractDigest:null,kindsProfile:null,...extra});

/* ------------------------------------------------------------------ the contract and the validator */

test('the contract prints what the kind reads and produces, under the goal and after the critique',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'draw-1',kind:'interface.draw',goal:'Draw the sales screens.',allowlist:['.starciwork/features/sales/ui/**']},0);
    const state=stubState(store,[op]);
    state.critique={verdict:'revise',required:['name every empty state'],objections:[],alternatives:[],prerequisites:[]};
    const contract=renderContract({template,op,state,store,launcher:'L.mjs',run:'run_seam'});
    assert.match(contract,/## Goal[\s\S]*## Goal critique - required[\s\S]*## Produces[\s\S]*## Allowlist/,
      'the declaration is read after the goal and its critique, and before the allowlist it bounds');
    assert.match(contract,/## Produces\n- `design`/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('the validator is handed the declaration of the kind it judges',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'draw-1',kind:'interface.draw',goal:'Draw.',allowlist:['.starciwork/features/sales/ui/**']},0);
    const state=stubState(store,[op]);
    const seen=[];
    const ctx=baseCtx(dir,{validateOp:payload=>{seen.push(payload);return {ok:true,verdict:'accept',summary:'fine',findings:[],dropped:[],provider:'stub'};}});
    const verdict=validateAccepted(store,state,op,ctx,{files:['.starciwork/features/sales/ui/index.yaml'],verified:{checks:[]}});
    assert.equal(verdict.verdict,'accept');
    assert.equal(seen.length,1);
    // The payload is the catalog's own declaration for the kind, both lists: the validator judges against what
    // the profile says the drawing may cite and may produce, never against a list the kernel remembers.
    assert.deepEqual(seen[0].io,ioPayload('interface.draw'));
    assert.ok(seen[0].io.reads.includes('brand')&&seen[0].io.writes.includes('design'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/* ------------------------------------------------------------------ a record the kind never declared */

test('a changed file whose record kind the op does not declare downgrades the report, with no model asked',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'build-1',kind:'backend.implement',goal:'Build the intake.',
      allowlist:['src/sales','.starciwork/features/sales'],checks:[]},0);
    op.status='running';op.dispatch='ctx_1';op.runtime='qwen3.8-flash';
    const state=stubState(store,[op]);
    const files=['src/sales/intake.ts','.starciwork/features/sales/business/rule/index.yaml'];
    const ctx=baseCtx(dir,{git:fakeGit(files),
      // The profile of 5-plus: this kind writes `code` and nothing else.
      kindsProfile:{kinds:{'backend.implement':{family:'build',role:'implement',reads:['srs','code'],writes:['code']}}}});
    const action=applyOpReport(null,store,state,op,doneReport({files}),ctx);
    assert.equal(action,'retry');
    assert.equal(op.reports.at(-1).downgradedTo,'failed');
    assert.match(op.findings[0],/produced a srs record it does not declare: \.starciwork\/features\/sales\/business\/rule\/index\.yaml/);
    const event=store.events.find(item=>item.event==='io-undeclared-write');
    assert.deepEqual(event.files,['.starciwork/features/sales/business/rule/index.yaml']);
    assert.equal(event.op,'build-1');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a report whose every file is a record kind the op declares is accepted, and no io event is written',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'build-1',kind:'backend.implement',goal:'Build the intake.',allowlist:['src/sales'],checks:[]},0);
    op.status='running';op.dispatch='ctx_1';
    const state=stubState(store,[op]);
    // The same op against the shipped catalog: product source is the  record kind a build declares it
    // writes, so nothing is undeclared and the report goes on to be accepted exactly as before the rule existed.
    const files=['src/sales/intake.ts'];
    const action=applyOpReport(null,store,state,op,doneReport({files}),baseCtx(dir,{git:fakeGit(files)}));
    assert.equal(action,'done');
    assert.equal(store.events.some(item=>item.event==='io-undeclared-write'),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/* ------------------------------------------------------------------ a drawing checked from its bytes */

test('a drawing that fails a canon check is downgraded before the validator; a passing one is recorded',()=>{
  for(const [ok,expected,event] of [[false,'retry','render-check-failed'],[true,'done','render-checked']]){
    const dir=tmp();
    try{
      const store=stubStore(dir);
      const op=toOp({id:'draw-1',kind:'interface.draw',goal:'Draw the sales screens.',
        allowlist:['.starciwork/features/sales/ui'],checks:[]},0);
      op.status='running';op.dispatch='ctx_1';
      const state=stubState(store,[op]);
      const files=['.starciwork/features/sales/ui/index.yaml'];
      const calls=[];
      const ctx=baseCtx(dir,{git:fakeGit(files),renderChecks:input=>{
        calls.push(input.op.id);
        return {ok,checks:[{id:'palette-off-brand',outcome:ok?'pass':'fail',detail:'a saturated colour matches no brand token'}]};
      }});
      assert.equal(applyOpReport(null,store,state,op,doneReport({files}),ctx),expected);
      assert.deepEqual(calls,['draw-1'],'the hook is called once, with the op that produced the bytes');
      assert.equal(store.events.some(item=>item.event===event),true);
      if(!ok){
        assert.equal(op.reports.at(-1).downgradedTo,'failed');
        assert.match(op.findings[0],/render check palette-off-brand fail: a saturated colour matches no brand token/);
      }
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
});

test('a kind that is not a drawing never reaches the render checks',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'build-1',kind:'backend.implement',goal:'Build.',allowlist:['src/sales'],checks:[]},0);
    op.status='running';op.dispatch='ctx_1';
    const state=stubState(store,[op]);
    const calls=[];
    const ctx=baseCtx(dir,{git:fakeGit(['src/sales/intake.ts']),renderChecks:()=>{calls.push(1);return {ok:false,checks:[]};}});
    assert.equal(applyOpReport(null,store,state,op,doneReport({files:['src/sales/intake.ts']}),ctx),'done');
    assert.deepEqual(calls,[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/* ------------------------------------------------------------------ the reconciliation of an intake */

const intakeTree=()=>({ok:true,errors:[],list:[
  {id:'demo.collab.business.srs.fr.share',kind:'business',path:'features/collab/business/srs/fr-share/index.yaml',state:'todo'}
],nodes:new Map()});
function intakeCtx(dir,extra={}){
  const tree=intakeTree();
  return {...baseCtx(dir,extra),work:{api:{loadLedger:()=>tree,decisionCandidates:()=>[],readNode:()=>({description:'a draft'})},
    at:{repoRoot:dir,workRoot:path.join(dir,'.starciwork')},validate:()=>({ok:true}),loaded:tree,
    code:{repository:null,repoRoot:dir,origin:null},side:null,shared:false,node:()=>null}};
}
const intakeOpOf=()=>{
  const op=toOp({id:'collab-intake',kind:'work.author',goal:'Author the feature collab.',allowlist:['.starciwork/features/collab/**']},0);
  op.intake={scope:'collab',mode:'reconcile'};
  op.reports.push({attempt:1,outcome:'done',summary:'the drafts are written'});
  return op;
};

test('a reconciliation the kernel refuses comes back as findings and the intake runs again',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=intakeOpOf();
    const state=stubState(store,[op]);
    const ctx=intakeCtx(dir,{reconcile:()=>({ok:false,findings:[
      {code:'conflict-without-decision',record:'demo.sales.architecture.sds.contract.intake',detail:'no decision record under collab'}],
      conflicts:[],counts:{reference:1,conflict:1,new:0}})});
    const settled=settleIntake(store,state,op,ctx);
    assert.equal(settled.retry,true);
    assert.equal(settled.reason,'reconciliation-failed');
    assert.match(settled.findings[0],/conflict-without-decision \(demo\.sales\.architecture\.sds\.contract\.intake\): no decision record under collab/);
    assert.equal(op.reports.at(-1).downgradedTo,'failed');
    assert.equal(store.events.some(item=>item.event==='reconciliation-rejected'),true);
    assert.equal(store.events.some(item=>item.event==='intake-authored'),false,'a refused table never settles the intake');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a valid table is counted, and every conflict row is the owner\'s question - answered by workflow-answer',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=intakeOpOf();
    const state=stubState(store,[op]);
    const ctx=intakeCtx(dir,{reconcile:()=>({ok:true,findings:[],counts:{reference:2,conflict:1,new:3},
      conflicts:[{record:'demo.sales.architecture.sds.contract.intake-command',
        decision:'demo.collab.business.srs.decision.d-intake-contract',
        options:['keep the synchronous contract','add an asynchronous intake beside it'],
        detail:'collab needs an asynchronous intake; sales decided a synchronous contract'}]})});
    assert.equal(settleIntake(store,state,op,ctx),'intake-authored');
    const reconciled=store.events.find(item=>item.event==='reconciled');
    assert.deepEqual([reconciled.op,reconciled.scope,reconciled.reference,reconciled.conflict,reconciled.new],
      ['collab-intake','collab',2,1,3]);
    const raised=store.events.find(item=>item.event==='reconciliation-conflict');
    assert.equal(raised.record,'demo.sales.architecture.sds.contract.intake-command');
    assert.equal(raised.decision,'demo.collab.business.srs.decision.d-intake-contract');
    const item=state.needUser.find(entry=>entry.kind==='decision');
    assert.equal(item.op,'collab-intake');
    assert.equal(item.record,'demo.collab.business.srs.decision.d-intake-contract');
    assert.equal(item.options.length,2);
    assert.match(item.detail,/workflow-answer --id wf-seam --op collab-intake --choice <n>/);
    // A second settle of the same intake raises the same conflict once, never twice on the owner's list.
    settleIntake(store,state,op,ctx);
    assert.equal(state.needUser.filter(entry=>entry.kind==='decision').length,1);

    // `workflow-answer` settles it even though the op that raised it is not an owner.ask.
    const answered=answerOwnerQuestion(store,state,{op:'collab-intake',choice:2,note:'both paths stay'});
    assert.equal(answered.ask,'collab-intake');
    assert.match(answered.answer,/option 2 - add an asynchronous intake beside it; both paths stay/);
    assert.equal(state.needUser.some(entry=>entry.kind==='decision'),false);
    assert.deepEqual(op.decisions,[{record:'demo.collab.business.srs.decision.d-intake-contract',choice:'2',
      note:'both paths stay',at:op.decisions[0].at,answer:answered.answer}]);
    const event=store.events.at(-1);
    assert.equal(event.event,'owner-answered');
    assert.equal(event.record,'demo.collab.business.srs.decision.d-intake-contract');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a kernel given no reconciler settles an intake exactly as it did before the rule existed',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=intakeOpOf();
    const state=stubState(store,[op]);
    assert.equal(settleIntake(store,state,op,intakeCtx(dir)),'intake-authored');
    assert.equal(store.events.some(item=>item.event==='reconciled'),false);
    assert.equal(state.needUser.length,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/* ------------------------------------------------------------------ a proof remembers its rules */

const NODE=`schema: work/node@2
id: demo.sales.implementation.backend.intake
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
        - npx vitest run intake
      files:
        - src/sales/intake.ts
extensions:
  work3:
    checks:
      - assertion: unit-tests-pass
        command: npx vitest run intake
`;
const NODE_REF={id:'demo.sales.implementation.backend.intake',kind:'implementation',
  path:'features/sales/implementation/backend/intake/index.yaml',state:'todo'};

test('markDone stores the digest of the declaration the proof was accepted under',()=>{
  const dir=tmp();
  try{
    const file=path.join(dir,'.starciwork',NODE_REF.path);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,NODE);
    fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'@demo/backend'}));
    markInProgress(dir,NODE_REF,{opId:'op-1',dispatch:'ctx_1'});
    markDone(dir,NODE_REF,{opId:'op-1',head:'b'.repeat(40),inputDigest:'a'.repeat(64),
      checks:[{name:'unit',command:'npx vitest run intake',exitCode:0,assertion:'unit-tests-pass'}],
      contractDigest:'c'.repeat(64)});
    assert.equal(parseYaml(fs.readFileSync(file,'utf8')).extensions.work3.kernel.contractDigest,'c'.repeat(64));
    // A later write that names none leaves the stored one alone: an older proof is not invented one.
    markDone(dir,NODE_REF,{opId:'op-2',head:'b'.repeat(40),inputDigest:'a'.repeat(64),
      checks:[{name:'unit',command:'npx vitest run intake',exitCode:0,assertion:'unit-tests-pass'}]});
    assert.equal(readNode(dir,NODE_REF).extensions.work3.kernel.contractDigest,'c'.repeat(64));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('an accepted operation binds its proof to the declaration of its kind',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'build-1',kind:'backend.implement',nodeId:'n1',goal:'Build.',allowlist:['src/sales']},0);
    op.head='b'.repeat(40);
    const state=stubState(store,[op]);
    const node={id:'n1',kind:'implementation',path:'features/sales/implementation/backend/intake/index.yaml'};
    const written=[];
    const ctx=baseCtx(dir,{contractDigest:kind=>`digest-of-${kind}`,
      work:{api:{markDone:(at,target,payload)=>{written.push(payload);return {};},readNode:()=>({assertions:[]}),
        nodeChecks:()=>[],buildSourceIdentity:()=>null,loadLedger:()=>({ok:true,list:[],nodes:new Map()})},
        at:{repoRoot:dir,workRoot:path.join(dir,'.starciwork')},validate:()=>({ok:true}),loaded:{list:[],nodes:new Map()},
        code:{repository:'demo-backend',repoRoot:dir,origin:null},node:()=>node,digest:()=>'a'.repeat(64),shared:false}});
    recordDone(store,state,op,ctx,{checks:[]},{nodeId:'n1',head:'b'.repeat(40)});
    assert.equal(written.length,1);
    assert.equal(written[0].contractDigest,'digest-of-backend.implement');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a done node proven under an older declaration is reopened; one that stores no digest is left alone',()=>{
  for(const [stored,reopened] of [['old-digest',true],[null,false]]){
    const dir=tmp();
    try{
      const store=stubStore(dir);
      const state=stubState(store,[]);
      const node={id:'n1',kind:'implementation',path:'features/sales/implementation/backend/intake/index.yaml',state:'done'};
      const loaded={ok:true,errors:[],list:[node],nodes:new Map([['n1',node]])};
      const calls=[];
      const ctx=baseCtx(dir,{contractDigest:kind=>`current-${kind}`,
        work:{api:{loadLedger:()=>loaded,executableCandidates:()=>[],
          readNode:()=>({extensions:{work3:{kernel:stored?{contractDigest:stored}:{}}}}),
          markReopened:(at,target,payload)=>{calls.push({node:target.id,reason:payload.reason});return {};}},
          at:{repoRoot:dir,workRoot:path.join(dir,'.starciwork')},validate:()=>({ok:true}),loaded,
          code:{repository:null,repoRoot:dir,origin:null},side:null,shared:false,node:id=>loaded.nodes.get(id)??null}});
      syncLedgerOps(store,state,ctx);
      const event=store.events.find(item=>item.event==='proof-under-old-rule');
      assert.equal(Boolean(event),reopened,`stored ${stored}`);
      assert.equal(calls.length,reopened?1:0);
      if(reopened){
        assert.equal(event.node,'n1');
        // The kind of a node's proof is the step whose acceptance wrote `done`: the last step of its lane.
        assert.equal(event.kind,'review.verify');
        assert.match(calls[0].reason,/proof-under-old-rule/);
      }
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
});

test('a kernel given no digest function reopens nothing',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const state=stubState(store,[]);
    const node={id:'n1',kind:'implementation',path:'features/sales/implementation/backend/intake/index.yaml',state:'done'};
    const loaded={ok:true,errors:[],list:[node],nodes:new Map([['n1',node]])};
    const ctx=baseCtx(dir,{work:{api:{loadLedger:()=>loaded,executableCandidates:()=>[],
      readNode:()=>({extensions:{work3:{kernel:{contractDigest:'old'}}}}),markReopened:()=>{throw Error('never');}},
      at:{repoRoot:dir,workRoot:path.join(dir,'.starciwork')},validate:()=>({ok:true}),loaded,
      code:{repository:null,repoRoot:dir,origin:null},side:null,shared:false,node:id=>loaded.nodes.get(id)??null}});
    syncLedgerOps(store,state,ctx);
    assert.equal(store.events.some(item=>item.event==='proof-under-old-rule'),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
