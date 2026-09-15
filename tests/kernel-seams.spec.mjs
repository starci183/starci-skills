import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {markDone,markInProgress,readNode} from '../kernel/ledger.mjs';
import {toOp} from '../kernel/common.mjs';
import {inputAsk} from './helpers/input-fixture.mjs';
import {PRESENTATION_RETRY_MS,sweepSettledCandidates,decisionRecordOptions,releaseSettledOperationLeases,handleBlocked,publishAuthoredDecisions,presentOwnerQuestions,applyOpReport,completionOutlook,languageBlock,renderContract,retryJournalTarget} from '../kernel/kernel.mjs';
import {deriveOwnerRequests} from '../kernel/owner-requests.mjs';
import {authoredDecisionOf} from '../kernel/owner.mjs';
import {loadConfig} from '../scripts/config.mjs';
import {validateAccepted} from '../kernel/verify.mjs';
import {settleIntake} from '../kernel/intake.mjs';
import {recordDone,syncLedgerOps} from '../kernel/sync.mjs';
import {STOP_KINDS,answerOwnerQuestion,dedupeNeedUser,inheritProvisional,irreversibleEffect,openOwnerAsk,
  ownerProvisionNeed,provisionalLines,redactSecrets,settleOwnerAsk,stopReasonFor,
  noteOwnerList,ownerItems,ownerLines} from '../kernel/owner.mjs';
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

test('the contract tells the worker which language the owner reads the tab in, and that the files stay English',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'draw-1',kind:'interface.draw',goal:'Draw the sales screens.',allowlist:['.starciwork/features/sales/ui/**']},0);
    const state=stubState(store,[op]);
    const vi=renderContract({template,op,state,store,launcher:'L.mjs',run:'run_seam',language:'vi'});
    assert.match(vi,/## Language\nSpeak to the owner in Vietnamese \(tiếng Việt\)[\s\S]*stays in English[\s\S]*## Goal/,'the language section precedes the goal');
    assert.doesNotMatch(vi,/presentation \(vi\)/,'a drawing op hands the page no presentation');
    assert.match(languageBlock('vi',{kind:'decision.prepare'}).join(' '),/presentation \(vi\): <the question in Vietnamese \(tiếng Việt\)> 1\. <option 1/,'an ask ends its summary with the presentation the page shows');
    const en=renderContract({template,op,state,store,launcher:'L.mjs',run:'run_seam',language:'en'});
    assert.doesNotMatch(en,/## Language/,'English is the default of the record and needs no section');
    assert.match(renderContract({template,op,state,store,launcher:'L.mjs',run:'run_seam',language:'vi-VN'}),/## Language/);
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

test('a required frontend render exception fails closed at acceptance while pass and fail verdicts retain their meaning',()=>{
  for(const variant of ['pass','fail','throw']){
    const dir=tmp();
    try{
      const store=stubStore(dir),op=toOp({id:`frontend-${variant}`,kind:'frontend.implement',goal:'Build the accepted surface.',
        allowlist:['src/sales'],references:['.starciwork/features/sales/ui/index.yaml'],checks:[]},0);
      op.status='running';op.dispatch='ctx_1';const state=stubState(store,[op]),files=['src/sales/page.tsx'];
      const renderChecks=variant==='throw'?()=>{throw Error('synthetic audit unavailable');}:()=>({ok:variant==='pass',checks:[{id:'palette-off-brand',outcome:variant==='pass'?'pass':'fail',detail:'synthetic palette verdict'}]});
      const action=applyOpReport(null,store,state,op,doneReport({files}),baseCtx(dir,{git:fakeGit(files),renderChecks}));
      assert.equal(action,variant==='pass'?'done':'retry',variant);
      if(variant==='throw'){
        assert.equal(store.events.some(item=>item.event==='render-check-unavailable'),true);
        assert.match(op.findings[0],/implementation-render-check-unavailable fail: The required implementation render audit could not run/);
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

/** A record id is a name, never a key: the redactor masks keys and leaves the slugs of the tree alone. */
test('the secret redactor masks a key and leaves a record id slug alone',()=>{
  const id='nivo.sales.business.srs.decision.d-sales-shared-public-route-contract';
  assert.equal(redactSecrets(`decision: ${id} recommended: 1`),`decision: ${id} recommended: 1`);
  assert.equal(redactSecrets('the shell-api-authentication-and-session-restoration question'),'the shell-api-authentication-and-session-restoration question');
  const key=['sk','live',['4eC39HqLyjWDarjtT1zdp7dc','9QzQ'].join('')].join('_');
  assert.equal(redactSecrets(`token ${key} present`),'token [redacted] present');
  assert.equal(redactSecrets('AKIAIOSFODNN7EXAMPLE1234ABCD'),'[redacted]');
  // A variable NAME is what the code reads, never a value: it survives, so "credential: <VAR> present" stays readable.
  assert.equal(redactSecrets('credential: RECOVERY_CUSTODY_SECRET_KEY present in identity:shared-lifecycle-recovery.'),'credential: RECOVERY_CUSTODY_SECRET_KEY present in identity:shared-lifecycle-recovery.');
  assert.equal(redactSecrets('ZALO_OA_ACCESS_TOKEN_AND_SECRET_PAIR'),'ZALO_OA_ACCESS_TOKEN_AND_SECRET_PAIR');
  assert.equal(redactSecrets('a1b2c3d4e5f6a7b8c9d0e1f2a3b4'),'[redacted]');
});

test('a valid table is counted, and every conflict row is taken provisionally through one detached decision.prepare that reads the record the intake wrote',()=>{
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
    // Not the owner's list: one detached decision.prepare reads the decision record the intake wrote and reports
    // the recommendation, which the runtime takes provisionally. Nothing waits for it, and the intake is done.
    assert.equal(state.needUser.some(entry=>entry.kind==='decision'),false,'a conflict is never a line on the owner\'s list');
    assert.equal(raised.provisional,true);
    const ask=state.ops.find(item=>item.kind==='decision.prepare');
    assert.ok(ask,'a decision.prepare was opened for the conflict');
    assert.equal(raised.ask,ask.id);
    assert.deepEqual([ask.question.record,ask.question.prepared,ask.question.from,ask.requesters,ask.question.options.length],
      ['demo.collab.business.srs.decision.d-intake-contract',true,'collab-intake',[],2]);
    assert.match(ask.question.text,/report `decision: demo\.collab\.business\.srs\.decision\.d-intake-contract` with `recommended: <n>`/);
    assert.match(ask.goal,/Take the conflict collab-intake recorded provisionally/);
    // A second settle of the same intake opens the same decision once, never twice.
    settleIntake(store,state,op,ctx);
    assert.equal(state.ops.filter(item=>item.kind==='decision.prepare').length,1);
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
    // A proof also remembers which decisions it rests on that the owner has not taken yet, so an overturned
    // one can find every node it was built on instead of guessing from the workflow's own memory.
    markDone(dir,NODE_REF,{opId:'op-3',head:'b'.repeat(40),inputDigest:'a'.repeat(64),
      checks:[{name:'unit',command:'npx vitest run intake',exitCode:0,assertion:'unit-tests-pass'}],
      provisional:['demo.sales.business.srs.policy-decision.d-refund','demo.sales.business.srs.policy-decision.d-refund']});
    assert.deepEqual(readNode(dir,NODE_REF).extensions.work3.kernel.provisional,['demo.sales.business.srs.policy-decision.d-refund']);
    markDone(dir,NODE_REF,{opId:'op-4',head:'b'.repeat(40),inputDigest:'a'.repeat(64),
      checks:[{name:'unit',command:'npx vitest run intake',exitCode:0,assertion:'unit-tests-pass'}]});
    assert.deepEqual(readNode(dir,NODE_REF).extensions.work3.kernel.provisional,['demo.sales.business.srs.policy-decision.d-refund'],
      'a proof that names none keeps what the node already carried, exactly as the digest does');
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

test('a proof records the kind it was bound to, and a lane whose last step is optional is not reopened for that step',()=>{
  const dir=tmp();
  try{
    const workRoot=path.join(dir,'.starciwork');
    const node={id:'demo.sales.ui',path:'features/sales/ui/index.yaml',kind:'ui'};
    fs.mkdirSync(path.join(workRoot,'features/sales/ui'),{recursive:true});
    fs.writeFileSync(path.join(workRoot,'features/sales/ui/index.yaml'),['schema: work/node@2','id: demo.sales.ui','kind: ui','required: true','state: todo','assertions:','  - the screens are drawn',''].join(String.fromCharCode(10)));
    markInProgress(dir,node,{opId:'draw-1'});
    const digest='a'.repeat(64);
    markDone(dir,node,{opId:'draw-1',checks:[{name:'the screens are drawn',command:'x',exitCode:0}],assertions:['the screens are drawn'],bindSource:false,contractDigest:digest,contractKind:'interface.draw'});
    const kernel=readNode(dir,node).extensions.work3.kernel;
    // The ui lane ends in the optional artwork step; a proof written by the drawing is compared against the drawing's
    // declaration, never against the artwork's, or every drawn node would be reopened on the next sync.
    assert.deepEqual([kernel.contractDigest,kernel.contractKind],[digest,'interface.draw']);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
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

/* ------------------------------------------------------------------ the two stop reasons */

/**
 * The owner's ruling of 2026-09-14, as data. The two stop reasons are a closed set and everything else is a
 * decision the runtime takes provisionally, so the whole rule reduces to one question about a sentence: can the
 * runtime get this, and can the runtime take it back? Both regex families are product-agnostic on purpose - an
 * accounting product needs a sandbox account on the tax authority and a real bank statement exactly as a chat
 * product needs a bot token, and neither of them names a vendor here.
 */
test('the runtime asks the owner only for what it cannot obtain and for what it cannot undo',()=>{
  // What only the owner can provide, by kind.
  const provision=[
    ['credential','TELEGRAM_BOT_TOKEN is not set; the delivery worker reads it at boot'],
    ['credential','the payment gateway api key the owner has not provided'],
    ['credential','the SMTP password of the mail provider is missing'],
    ['account','the payment gateway sandbox account the owner must open'],
    ['account','there is no test account on the e-invoice provider; the owner registers one'],
    ['account','an SMS provider account is needed before any message can be sent'],
    ['account','we are not registered with the tax authority sandbox'],
    ['dataset','no real bank statement to reconcile against; the owner provides a sample export'],
    ['dataset','the accounting import needs a sample of production invoices from the owner'],
    ['dataset','test data for the identity provider must be supplied by the owner'],
    ['authority','may we message these users about their overdue invoices?'],
    ['authority','consent to charge this card is not recorded anywhere'],
    ['authority','the legal basis to store identity documents of customers is not stated']
  ];
  for(const [kind,detail] of provision)assert.deepEqual(ownerProvisionNeed(detail),{kind},detail);
  // What the runtime can get for itself, or simply cannot: not the owner's to provide.
  for(const detail of ['docker is not installed on this host','the unit suite is red on node 22',
    'the account page component has no empty state','the invoice list view needs a loading state',
    'the production build fails on a type error','the migration must run before the seed'])
    assert.equal(ownerProvisionNeed(detail),null,detail);

  // What nobody can undo.
  for(const detail of ['the run would send the reminder e-mail to real customers',
    'this step charges the customer card for the outstanding balance',
    'completing it transfers funds to the supplier account',
    'the fix deletes production customer data from the orders table',
    'the last step publishes the release to production',
    'we would deploy to prod to see whether the webhook arrives'])
    assert.equal(irreversibleEffect(detail),true,detail);
  for(const detail of ['the seed sends a message to the local fake','the build publishes nothing',
    'the spec charges a stub gateway'])
    assert.equal(irreversibleEffect(detail),false,detail);

  // The stop reason of a question is read from what it says, then from an unambiguous kind it declares.
  // `authority` alone is NOT a stop: it is also the kernel's own generic blocker kind.
  assert.equal(stopReasonFor({kind:'decision',text:'the run would send the invoice to real customers'}),'irreversible');
  assert.equal(stopReasonFor({kind:'authority',text:'which of the two retry policies should the intake use?'}),null);
  assert.equal(stopReasonFor({kind:'dataset',text:'something only the owner has'}),'dataset');
  assert.equal(stopReasonFor({kind:'decision',text:'should a refund reopen the order or close it?'}),null);
  assert.deepEqual(STOP_KINDS,['credential','account','dataset','authority','irreversible']);
});

/**
 * A question the runtime may take provisionally does NOT stop the requester: it only waits for the ask op, comes
 * back with the recommendation, carries the decision id into whatever it builds, and the decision is listed for
 * the owner as something to answer rather than as something the workflow is blocked on.
 */
test('a decision the records do not settle is taken provisionally: the requester continues and the owner is told',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const requester=toOp({id:'op-intake',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts'],
      nodeId:'demo.sales.implementation.backend.intake'},0);
    requester.status='running';
    const state=stubState(store,[requester]);
    state.provisional=[];
    assert.equal(openOwnerAsk(store,state,requester,{kind:'decision',
      text:'Should a refund reopen the order or close it?',options:[]},null),'owner-ask');
    const ask=state.ops.find(op=>op.kind==='decision.prepare');
    // Not paused: it waits for the ask op alone, so nothing schedules it before the recommendation exists.
    assert.deepEqual([requester.status,requester.waitingFor,requester.dependsOn],['pending',null,[ask.id]]);
    const opened=store.events.find(item=>item.event==='owner-ask-opened');
    assert.deepEqual([opened.kind,opened.stop,opened.provisional],['decision',null,true]);

    settleOwnerAsk(store,state,ask,{summary:'decision: demo.sales.business.srs.policy-decision.d-refund recommended: 2 1. reopen the order 2. close it and issue a credit note'});
    assert.deepEqual(state.provisional.map(entry=>[entry.decision,entry.op,entry.recommended,entry.options,entry.answered]),
      [['demo.sales.business.srs.policy-decision.d-refund',ask.id,2,['reopen the order','close it and issue a credit note'],null]]);
    assert.equal(state.needUser.length,0,'a provisional decision is never a needUser item');
    assert.deepEqual(requester.provisional,['demo.sales.business.srs.policy-decision.d-refund']);
    assert.equal(requester.status,'ready');
    assert.match(requester.answer,/^provisional: option 2 - close it and issue a credit note \(decision demo\.sales\.business\.srs\.policy-decision\.d-refund\)/);
    assert.ok(store.events.some(item=>item.event==='owner-answer-provisional'&&item.op==='op-intake'&&item.recommended===2));
    assert.match(provisionalLines(state)[0],/^## Provisional decisions \(1\)$/);
    assert.match(provisionalLines(state)[1],/workflow-answer --id wf-seam --op ask-1 --choice <n>/);

    // A provisional decision travels to everything built behind it, so an overturn knows what rested on it.
    const later=toOp({id:'op-review',kind:'review.verify',goal:'Review the intake',allowlist:['src/intake.ts'],
      nodeId:'demo.sales.implementation.backend.intake'},1);
    state.ops.push(later);
    inheritProvisional(state);
    assert.deepEqual(later.provisional,['demo.sales.business.srs.policy-decision.d-refund']);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/**
 * The owner's answer, whenever it comes. The same option confirms what was built; a different one overturns it,
 * and every done node whose kernel receipt lists that decision goes back to `todo` - because it was built on an
 * answer the owner has now replaced. That is what makes finishing `done` over a provisional decision honest.
 */
test('the same option confirms a provisional decision; a different one overturns it and reopens what rested on it',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const ask=toOp({id:'ask-1',kind:'decision.prepare',goal:'Prepare the refund decision',allowlist:['.starciwork/decisions/**'],
      question:{kind:'decision',text:'Should a refund reopen the order or close it?',options:[]},requesters:['op-intake']},0);
    const built=toOp({id:'op-intake',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts'],
      nodeId:'demo.sales.implementation.backend.intake'},1);
    built.status='done';built.provisional=['d-refund'];
    const state=stubState(store,[ask,built]);
    state.ledger=[{id:'demo.sales.implementation.backend.intake',status:'verified',title:'the intake'}];
    const pending=()=>[{decision:'d-refund',op:'ask-1',recommended:2,options:['reopen the order','close it'],at:1,answered:null}];
    state.provisional=pending();
    const reopened=[];
    const ctx={work:{api:{markReopened:(at,node,options)=>{reopened.push([node.id,options.reason]);}},
      at:dir,node:id=>({id,path:'features/sales/implementation/backend/intake/index.yaml'})}};

    // The owner agrees with the runtime: nothing that was built on it moves.
    answerOwnerQuestion(store,state,{op:'ask-1',choice:2},ctx);
    assert.deepEqual(store.events.filter(item=>item.event==='decision-confirmed').map(item=>[item.decision,item.choice]),[['d-refund','2']]);
    assert.deepEqual(reopened,[]);
    assert.equal(built.status,'done');
    assert.equal(state.provisional[0].answered.choice,'2');

    // The owner answers differently: what rested on it is reopened, in the tree and in this workflow.
    state.provisional=pending();
    built.status='done';
    answerOwnerQuestion(store,state,{op:'ask-1',choice:1},ctx);
    const overturned=store.events.find(item=>item.event==='decision-overturned');
    assert.deepEqual([overturned.decision,overturned.choice,overturned.reopened],
      ['d-refund','1',['demo.sales.implementation.backend.intake']]);
    assert.deepEqual(reopened,[['demo.sales.implementation.backend.intake','decision-overturned: d-refund']]);
    assert.equal(built.status,'ready','the work is planned again against the owner\'s own answer');
    assert.equal(state.ledger[0].status,'planned');
    assert.match(built.findings.at(-1),/the owner overturned the provisional decision d-refund/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/**
 * The owner is at a keyboard, in front of the op's own tab. Making them leave it to type a command is how a
 * one-word answer waited a day, so the ask op asks there - and what comes back is the same ruling by another
 * door. A provision is never asked for as a value: presence is the only thing that is ever checked, and no
 * value can travel because the op never reports one.
 */
test('the custody of a credential is read from what the ask and its requesters reported, not only from the question',async()=>{
  const {credentialAsked}=await import('../kernel/fill.mjs');
  const ask={question:{text:'Which existing repository command proves ZALO_BOT_TOKEN authentication against zalo-bot-api?'},goal:'',
    reports:[{outcome:'blocked',summary:'Owner provisioning prompt timed out.',blocker:{kind:'authority',detail:'ZALO_BOT_TOKEN for zalo-bot-api in identity:chatbot-zalo-bot'}}]};
  assert.deepEqual(credentialAsked(ask),{variables:['ZALO_BOT_TOKEN'],custody:'identity:chatbot-zalo-bot',provider:null});
  const bare={question:{text:'PAY_API_KEY is not provided'},goal:'',reports:[]};
  assert.deepEqual(credentialAsked(bare,{requesters:[{reports:[{summary:'blocked',blocker:{detail:'PAY_API_KEY lives in identity:payments'}}]}]}).custody,'identity:payments');
  assert.equal(credentialAsked(bare).custody,null,'nothing named a custody: nothing is invented');
});

test('the owner answers in the op\'s own terminal, and a credential reports only that it is present',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const requester=toOp({id:'op-intake',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts']},0);
    requester.status='paused';
    const ask=toOp({id:'ask-1',kind:'decision.prepare',goal:'Prepare the decision',allowlist:['.starciwork/decisions/**'],
      question:{kind:'decision',text:'Which retry policy?',options:['retry twice','retry five times']},requesters:['op-intake']},1);
    const state=stubState(store,[requester,ask]);
    state.provisional=[];
    // A number typed in the tab is exactly `workflow-answer --choice n`.
    settleOwnerAsk(store,state,ask,{summary:'answered-by-owner: 2 the volume justifies it'});
    const answered=store.events.find(item=>item.event==='owner-answered');
    assert.deepEqual([answered.choice,answered.via],['2','terminal']);
    assert.match(requester.answer,/option 2 - retry five times/);
    assert.equal(state.needUser.length,0);

    // A credential: the op checked presence, and what it reports carries the variable and its custody, never a value.
    const store2=stubStore(dir);
    const waiting=toOp({id:'op-send',kind:'integration.verify',goal:'Prove the delivery',allowlist:['src/live.spec.ts']},0);
    waiting.status='paused';
    const credentialAsk=toOp({id:'ask-1',kind:'provision.ask',goal:'Prepare the credential question',allowlist:['.starciwork/decisions/**'],
      question:{kind:'credential',text:'PAY_API_KEY is not provided'},requesters:['op-send']},1);
    credentialAsk.question.stop='credential';
    const state2=stubState(store2,[waiting,credentialAsk]);
    state2.provisional=[];
    // The variable name is long enough to look like a key and the sentence ends in a full stop: both are read past.
    settleOwnerAsk(store2,state2,credentialAsk,{summary:'credential: RECOVERY_CUSTODY_SECRET_KEY present in identity:payments. Named the provision exactly before asking.'});
    const present=store2.events.find(item=>item.event==='credential-present');
    assert.equal(present.provided,'RECOVERY_CUSTODY_SECRET_KEY in identity:payments');
    assert.equal(waiting.status,'ready');
    assert.match(waiting.answer,/confirmed only that it is present and never read its value/);
    // Nothing anywhere carries a value, and a value that slipped into a summary never reaches a file or an event.
    assert.doesNotMatch(JSON.stringify([store2.events,state2,waiting.answer]),/sk_live|BEGIN PRIVATE KEY/);
    // The synthetic key is assembled at run time so no file of this repository ever carries a string a secret scanner reads as a live key.
    assert.equal(redactSecrets('the token is '+['sk','live','51NaBcDeFgHiJkLmNoPqRsTuVwXyZ01234'].join('_')),'the token is [redacted]');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/**
 * The kind of the ask op is chosen by a keyword before the op has read a single record, so it is a hint about
 * the tab to open and never a ruling about what the question is. Either form may end any of the three ways, and
 * the kernel takes the report by its content: a provision that turned out to be a design decision lifts its own
 * stop, and a decision that turned out to be a provision answers its requester with the presence.
 */
test('either ask kind may end either way: a provision that reports a decision lifts the stop, and a decision that reports a credential answers its requester',()=>{
  const dir=tmp();
  try{
    // "Which Telegram bot token does the chatbot use, and WHERE does the owner provide it" is a design decision -
    // the word "token" opened a provision tab and paused the requester. The op read the records and said so.
    const store=stubStore(dir);
    const requester=toOp({id:'op-chat',kind:'backend.implement',goal:'Wire the chatbot',allowlist:['src/chatbot.ts']},0);
    requester.status='paused';requester.waitingFor='ask-1';
    const ask=toOp({id:'ask-1',kind:'provision.ask',goal:'Prepare the token question',
      allowlist:['.starciwork/features/chatbot/business/srs/business-rules/policy-decisions/**'],
      question:{kind:'credential',stop:'credential',text:'Which Telegram bot token does the chatbot use, and where does the owner provide it?',options:[]},
      requesters:['op-chat']},1);
    const state=stubState(store,[requester,ask]);
    state.provisional=[];
    settleOwnerAsk(store,state,ask,{summary:'decision: demo.chatbot.business.srs.policy-decision.d-token-custody recommended: 1 1. a stack secret named TELEGRAM_BOT_TOKEN 2. an environment variable on the host'});
    assert.deepEqual(store.events.filter(item=>item.event==='ask-reclassified').map(item=>[item.ask,item.from,item.to]),
      [['ask-1','provision','decision']]);
    assert.equal(state.needUser.length,0,'the stop is lifted: nothing is left for the owner to provide');
    assert.deepEqual(state.provisional.map(entry=>[entry.decision,entry.recommended]),
      [['demo.chatbot.business.srs.policy-decision.d-token-custody',1]]);
    assert.deepEqual([requester.status,requester.waitingFor],['ready',null],'the paused requester carries on');
    assert.match(requester.answer,/^provisional: option 1 - a stack secret named TELEGRAM_BOT_TOKEN/);
    assert.deepEqual(requester.provisional,['demo.chatbot.business.srs.policy-decision.d-token-custody']);
    assert.equal(ask.question.stop,null,'the op no longer carries a stop it disproved');

    // And the other way: a decision tab whose question turned out to be a credential the owner had to put in
    // custody. The requester is `pending` on the ask rather than paused, and the presence is its answer.
    const store2=stubStore(dir);
    const pending=toOp({id:'op-send',kind:'integration.verify',goal:'Prove the delivery',allowlist:['src/live.spec.ts']},0);
    pending.status='pending';pending.dependsOn=['ask-1'];
    const draft=toOp({id:'ask-1',kind:'decision.prepare',goal:'Prepare the delivery question',
      allowlist:['.starciwork/features/chatbot/business/srs/business-rules/policy-decisions/**'],
      question:{kind:'decision',stop:null,text:'Which mailbox does the reminder go out through?',options:[]},
      requesters:['op-send']},1);
    const state2=stubState(store2,[pending,draft]);
    state2.provisional=[];
    settleOwnerAsk(store2,state2,draft,{summary:'credential: MAIL_API_KEY present in identity:mail'});
    assert.deepEqual(store2.events.filter(item=>item.event==='ask-reclassified').map(item=>[item.ask,item.from,item.to]),
      [['ask-1','decision','provision']]);
    assert.equal(store2.events.find(item=>item.event==='credential-present').provided,'MAIL_API_KEY in identity:mail');
    assert.equal(pending.status,'ready','a pending requester that depends on the ask resumes on the presence');
    assert.match(pending.answer,/The owner provided MAIL_API_KEY in identity:mail/);
    assert.equal(state2.provisional.length,0,'a presence is not a provisional decision');
    assert.equal(draft.question.stop,'credential','the op carries the stop it found');

    // `answered-from` is the same door for both kinds: a decided record settles it and nobody waits.
    const store3=stubStore(dir);
    const waiting=toOp({id:'op-send',kind:'integration.verify',goal:'Prove the delivery',allowlist:['src/live.spec.ts']},0);
    waiting.status='paused';waiting.waitingFor='ask-1';
    const settled=toOp({id:'ask-1',kind:'provision.ask',goal:'Prepare the question',allowlist:['.starciwork/decisions/**'],
      question:{kind:'credential',stop:'credential',text:'Which key?',options:[]},requesters:['op-send']},1);
    const state3=stubState(store3,[waiting,settled]);
    state3.provisional=[];
    settleOwnerAsk(store3,state3,settled,{summary:'answered-from: demo.chatbot.architecture.sds.integration.mail the record names the custody already'});
    assert.equal(waiting.status,'ready');
    assert.match(waiting.answer,/Answered from the decided record demo\.chatbot\.architecture\.sds\.integration\.mail/);
    assert.equal(state3.needUser.length,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/**
 * The keyword heuristic is the last word, not the first. An operation standing in front of the thing knows what
 * it is; the sentence is only read when nothing was declared, and the event says which of the two decided.
 */
test('a blocker kind the op declared beats the words of its sentence, and the ask op records which decided it',()=>{
  const dir=tmp();
  try{
    // Declared: the report says `dataset`, and the sentence - which reads like a plain design question - does not overrule it.
    assert.equal(stopReasonFor({kind:'decision',text:'which of the two reconciliation shapes holds?'},{blocker:{kind:'dataset'}}),'dataset');
    // Declared on the question itself, the same rule.
    assert.equal(stopReasonFor({kind:'account',text:'which of the two reconciliation shapes holds?'}),'account');
    // `authority` is the kernel's own generic blocker kind: declaring it decides nothing, and the words are read.
    assert.equal(stopReasonFor({kind:'authority',text:'the design does not say whether a supervisor may approve their own request'}),null);
    assert.equal(stopReasonFor({kind:'authority',text:'this step charges the customer card for the outstanding balance'}),'irreversible');
    // A question the kernel prepared itself is never a stop, whatever anybody declared.
    assert.equal(stopReasonFor({kind:'credential',prepared:true,text:'anything'},{blocker:{kind:'credential'}}),null);

    const store=stubStore(dir);
    const requester=toOp({id:'op-recon',kind:'backend.implement',goal:'Build the reconciliation',allowlist:['src/recon.ts']},0);
    requester.status='running';
    const state=stubState(store,[requester]);
    state.provisional=[];
    openOwnerAsk(store,state,requester,{kind:'decision',text:'which of the two reconciliation shapes holds?',options:[]},null,{blocker:{kind:'dataset'}});
    const declared=store.events.find(item=>item.event==='owner-ask-opened');
    assert.deepEqual([declared.kind,declared.stop,declared.by],['dataset','dataset','declared']);

    // Nothing declared: the words are the fallback, exactly as they were, and the event says so.
    const store2=stubStore(dir);
    const asking=toOp({id:'op-pay',kind:'backend.implement',goal:'Build the payout',allowlist:['src/payout.ts']},0);
    asking.status='running';
    const state2=stubState(store2,[asking]);
    state2.provisional=[];
    openOwnerAsk(store2,state2,asking,{kind:'environment',text:'PAY_API_KEY is not provided; src/payout.ts reads it at boot',options:[]},null);
    const byWords=store2.events.find(item=>item.event==='owner-ask-opened');
    assert.deepEqual([byWords.kind,byWords.stop,byWords.by],['credential','credential','words']);

    // A question neither declared nor worded as a stop is a decision, and nothing decided a stop at all.
    const store3=stubStore(dir);
    const open=toOp({id:'op-rule',kind:'backend.implement',goal:'Build the rule',allowlist:['src/rule.ts']},0);
    open.status='running';
    const state3=stubState(store3,[open]);
    state3.provisional=[];
    openOwnerAsk(store3,state3,open,{kind:'decision',text:'Should a refund reopen the order or close it?',options:[]},null);
    const none=store3.events.find(item=>item.event==='owner-ask-opened');
    assert.deepEqual([none.kind,none.stop,none.by],['decision',null,'none']);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/** One item per question: a kernel that ran for a day pushed the same line on every iteration. */
test('the owner\'s list carries one item per question, not one per iteration',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir),state=stubState(store,[]);
    const item=(kind,op,detail)=>({kind,op,detail});
    state.needUser=[
      item('environment','op-1','no runtime could launch op-1 (3 attempts, last chain-exhausted)'),
      item('environment','op-1','no runtime could launch op-1 (3 attempts, last chain-exhausted)'),
      item('environment','op-2','no runtime could launch op-2 (3 attempts, last chain-exhausted)'),
      {kind:'ledger',node:'n1',detail:'ledger incomplete: n1'},
      {kind:'ledger',node:'n1',detail:'ledger incomplete: n1'}
    ];
    assert.equal(dedupeNeedUser(state),2);
    assert.deepEqual(state.needUser.map(entry=>[entry.kind,entry.op??entry.node]),
      [['environment','op-1'],['environment','op-2'],['ledger','n1']]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/**
 * The owner opened the IDE, read six tabs and asked "where does it ask me?". Three places were honest on their
 * own - the ask ops waiting in their tabs, `state.provisional`, `state.needUser` - and none of them was an
 * answer. `ownerItems` is the answer: one list, and every entry says what waits and what to type for it.
 *
 * The two rules that make it readable are here too. A value never travels: the whole list goes through
 * `redactSecrets`, so a question that quotes a token prints its NAME and not one character of its value. And a
 * line the runtime has already taken in hand - a record a `work.author` op is writing right now - is not the
 * owner's and never reaches the list.
 */
test('ownerItems is the one list: every ask tab, every provisional decision, every line that is truly the owner\'s',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    // A fake value that must never be echoed. The variable name carries the word TOKEN; the value beside it does not travel.
    // Key-SHAPED and nobody's: long, mixed case, digits - what `redactSecrets` masks - and no vendor prefix, so
    // a scanner reading this file finds a fixture and not a revoked credential to warn somebody about.
    const value='zzFIXTURE0000aaaaBBBB1111cccc2222';
    const command='node /skills/bin/starci.mjs identity set payments --name PAYMENTS_API_TOKEN';
    const ask=toOp({id:'ask-cred',kind:'provision.ask',goal:'Ask the owner for the payments credential',
      allowlist:[],question:{kind:'credential',from:'op-pay',options:[],
        text:`Put PAYMENTS_API_TOKEN into custody: run \`${command}\` - the value ${value} must never be typed here.`}},0);
    ask.status='running';ask.terminal='term_ask';ask.launchedAt=1700;
    ask.inputMode='gui';ask.credential=inputAsk('prepared',['PAYMENTS_API_TOKEN'],{slug:'payments'}).credential;
    const author=toOp({id:'n-four-author',kind:'work.author',nodeId:'prod.admin.four',
      goal:'Complete the Work record of prod.admin.four',allowlist:['.starciwork/features/admin/four/index.yaml']},1);
    author.status='running';
    const state=stubState(store,[ask,author]);
    // A real workflow id: long, and it starts with digits. The secret masker cannot tell one from a key, so it
    // must never be run over a command the owner has to type - it once handed them `--id [redacted]`.
    state.id='20260101-093000-deliver-the-sales-intake';
    state.provisional=[{decision:'prod.admin.business.srs.policy-decision.d-refund',op:'ask-refund',recommended:2,
      options:['reopen the order','close it and issue a credit note'],at:1600,answered:null}];
    state.needUser=[
      {op:'op-verify',kind:'validator',detail:'the Work validator is not installed in this worktree'},
      {node:'prod.admin.four',kind:'ledger',detail:'ledger incomplete: prod.admin.four declares no write scope'}
    ];

    const items=ownerItems(state);
    assert.deepEqual(items.map(entry=>[entry.kind,entry.op]),
      [['provision','ask-cred'],['decision','ask-refund'],['blocked','op-verify']],
      'the mechanical ledger line has an author op on it and is not the owner\'s');
    assert.deepEqual(items.map(entry=>entry.how),[
      "Open this workflow's Credentials page in Orca to fill PAYMENTS_API_TOKEN for identity:payments. Saved fields resume their waiting tasks automatically.",
      'starci workflow-answer --id 20260101-093000-deliver-the-sales-intake --op ask-refund --choice <n> [--note "..."]',
      'settle what `op-verify` names, then `starci workflow-approve --id 20260101-093000-deliver-the-sales-intake` to re-admit it'
    ]);
    for(const entry of items)assert.equal(entry.how.includes('[redacted]'),false,'a command the owner types is never masked');
    assert.deepEqual(items.map(entry=>[entry.terminal,entry.since]),[['term_ask',1700],[null,1600],[null,null]]);
    assert.equal(items[0].what,
      'Put PAYMENTS_API_TOKEN into custody: run `node /skills/bin/starci.mjs identity set payments --name PAYMENTS_API_TOKEN` - the value [redacted] must never be typed here.');
    assert.match(items[1].what,/^prod\.admin\.business\.srs\.policy-decision\.d-refund: the runtime took option 2 - close it and issue a credit note and carried on$/);

    // No value of anything, anywhere: not in an item, not in the rendered section, not in the event.
    const page=ownerLines(state).join('\n');
    for(const text of [...items.map(entry=>`${entry.what} ${entry.how}`),page])assert.equal(text.includes(value),false,'a value never travels');
    assert.match(page,/^## Owner \(3\)\n- provision ask-cred \(tab term_ask\): /);

    // The event fires when the list changes and never on a tick that changed nothing.
    assert.deepEqual(noteOwnerList(store,state).length,3);
    assert.deepEqual(store.events.at(-1),{event:'owner-list',
      items:[{kind:'provision',op:'ask-cred'},{kind:'decision',op:'ask-refund'},{kind:'blocked',op:'op-verify'}]});
    const written=store.events.length;
    assert.equal(noteOwnerList(store,state),null);
    assert.equal(store.events.length,written,'an unchanged list writes no second event');

    // The author op blocks: the record is nobody's job again, so the line is the owner's and comes back.
    author.status='blocked';author.refusal='shared-change';
    assert.deepEqual(ownerItems(state).map(entry=>[entry.kind,entry.op]),
      [['provision','ask-cred'],['decision','ask-refund'],['blocked','op-verify'],['ledger','prod.admin.four']]);
    assert.equal(ownerItems(state).at(-1).how,
      'complete the Work record of prod.admin.four, then `starci workflow-approve --id 20260101-093000-deliver-the-sales-intake`');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/** Nothing waiting is said out loud: "where does it ask me?" is answered even when the answer is "nowhere". */
test('the owner section says so when nothing is waiting, instead of leaving itself out',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    assert.deepEqual(ownerLines(stubState(store,[])),['## Owner (0)','nothing is waiting on you']);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('the completion outlook counts the open operations and estimates from the durations accepted so far',()=>{
  const state={ops:[{id:'a',status:'done'},{id:'b',status:'running'},{id:'c',status:'pending'},{id:'d',status:'blocked',refusal:'superseded'},{id:'e',status:'cancelled'}]};
  const first=completionOutlook(state,{id:'a',launchedAt:1000,reports:[{summary:'  Did   the thing.  '}]},601000);
  assert.deepEqual(first,{summary:'Did the thing.',durationMs:600000,remainingOps:2,estimateMs:1200000},'two open operations at ten minutes each');
  const second=completionOutlook(state,{id:'b',launchedAt:0},1200000);
  assert.equal(second.estimateMs,900000,'the mean of ten and twenty minutes, times the one operation left');
  assert.equal(completionOutlook({ops:[]},{id:'x'}).estimateMs,null,'no duration yet, no estimate');
});

test('a retry brings the journal to the build default unless the operator chose one, and a refused relocation never pins the old journal',()=>{
  const fallback='C:/local/StarCi/runtime/journal.sqlite',former='C:/local/StarCi/runtime-v6/journal.sqlite',named='D:/shared/journal.sqlite';
  assert.equal(retryJournalTarget({option:named,previous:former,chosen:false,fallback}),path.resolve(named),'the named journal wins');
  assert.equal(retryJournalTarget({option:null,previous:former,chosen:true,fallback}),path.resolve(former),'a journal the operator chose before is kept');
  assert.equal(retryJournalTarget({option:null,previous:former,chosen:false,fallback}),path.resolve(fallback),'a record still on a former journal moves to the default at the next retry');
  assert.equal(retryJournalTarget({option:null,previous:null,chosen:false,fallback}),path.resolve(fallback));
});

test('an enrolled ask keeps its recommendation and its presentation for the page while the record options stay English',()=>{
  const events=[],store={appendEvent:event=>events.push(event)};
  const ask={id:'ask-1',kind:'decision.prepare',status:'running',requesters:[],question:{kind:'decision',text:'Which registration path?'}};
  const state={id:'wf',approved:true,engine:{schema:'starci/engine@1',generation:1},ops:[ask],needUser:[]};
  settleOwnerAsk(store,state,ask,{summary:'decision: nivo.login.business.srs.policy-decision.d-registration recommended: 2 1. Open self-service registration 2. Invitation-only registration presentation (vi): Đường đăng ký nào trước khi thanh toán? 1. Mở đăng ký tự phục vụ 2. Chỉ đăng ký theo lời mời'});
  assert.deepEqual(state.needUser.at(-1).options,['Open self-service registration','Invitation-only registration'],'the record options are read without the presentation');
  assert.equal(ask.question.recommended,2);
  assert.deepEqual(ask.question.presentation,{language:'vi',text:'Đường đăng ký nào trước khi thanh toán?',options:['Mở đăng ký tự phục vụ','Chỉ đăng ký theo lời mời']});
  const request=deriveOwnerRequests(state)[0];
  assert.deepEqual(request.options.map(option=>[option.id,option.label,option.recommended]),[['1','Open self-service registration',false],['2','Invitation-only registration',true]]);
  assert.deepEqual(request.presentation,{language:'vi',text:'Đường đăng ký nào trước khi thanh toán?',options:[{id:'1',label:'Mở đăng ký tự phục vụ'},{id:'2',label:'Chỉ đăng ký theo lời mời'}]});
});

test('every open question is presented in the configured language once, again when its options arrive, and an ask that reports its own presentation keeps it',()=>{
  const host=fs.mkdtempSync(path.join(os.tmpdir(),'starci-presentation-'));
  fs.writeFileSync(path.join(host,'config.json'),JSON.stringify({...loadConfig(),language:'vi'}));
  try{
    const events=[],store={appendEvent:event=>events.push(event),saveState(){}},asked=[];
    const ask={id:'ask-1',kind:'decision.prepare',status:'running',attempt:1,question:{kind:'decision',text:'Which registration path?'}};
    const state={id:'wf',host,engine:{schema:'starci/engine@1',generation:1},needUser:[],
      ops:[ask,{id:'w',kind:'backend.implement',status:'ready',allowlist:['x/**']}]};
    const engine={model:(name,args)=>{asked.push([name,args.language,args.options.length]);
      return {ok:true,value:{language:args.language,text:'Chọn đường đăng ký nào?',options:args.options.map(option=>`VI ${option}`)}};}};
    let now=1_000_000;const ctx={engine,now:()=>now};
    assert.deepEqual(presentOwnerQuestions(store,state,ctx),{op:'ask-1',presented:true});
    assert.deepEqual(ask.question.presentation,{language:'vi',text:'Chọn đường đăng ký nào?',options:[],by:'kernel'});
    assert.deepEqual(asked,[['presentOwnerQuestion','vi',0]]);
    assert.equal(presentOwnerQuestions(store,state,ctx),null,'a presented question is not presented again');
    ask.question.options=['Open self-service','Invitation-only'];
    assert.deepEqual(presentOwnerQuestions(store,state,ctx),{op:'ask-1',presented:true},'the options are presented when they arrive');
    assert.deepEqual(ask.question.presentation.options,['VI Open self-service','VI Invitation-only']);
    ask.question.presentation={language:'vi',text:'Bản của chính op',options:['A','B']};
    assert.equal(presentOwnerQuestions(store,state,ctx),null,'a presentation the ask itself reported is left alone');
    const refusing={model:()=>{throw Error('No evaluated model is eligible for presentOwnerQuestion');}};
    const second={id:'ask-2',kind:'decision.prepare',status:'ready',attempt:1,question:{kind:'decision',text:'Second question?'}};
    state.ops.push(second);
    assert.deepEqual(presentOwnerQuestions(store,state,{engine:refusing,now:()=>now}),{op:'ask-2',presented:false});
    assert.equal(second.question.presentationFailedAt,now);
    assert.equal(presentOwnerQuestions(store,state,{engine:refusing,now:()=>now+1000}),null,'a refused rendering waits before it is asked again');
    now+=PRESENTATION_RETRY_MS+1;
    assert.deepEqual(presentOwnerQuestions(store,state,ctx),{op:'ask-2',presented:true});
    assert.deepEqual(events.map(event=>event.event),['question-presented','question-presented','question-presentation-unavailable','question-presented']);
    const waiting={model:()=>{const error=Error('every presenter is out of quota');error.code='STARCI_MODEL_QUOTA_WAIT';throw error;}};
    const third={...second,id:'ask-3',question:{text:'Third question?'}};
    assert.throws(()=>presentOwnerQuestions(store,{...state,ops:[third]},{engine:waiting,now:()=>now}),/out of quota/,'a quota wait defers the stage instead of marking the ask');
    assert.equal(third.question.presentationFailedAt,undefined);
    const english=fs.mkdtempSync(path.join(os.tmpdir(),'starci-presentation-en-'));
    fs.writeFileSync(path.join(english,'config.json'),JSON.stringify({...loadConfig(),language:'en'}));
    assert.equal(presentOwnerQuestions(store,{...state,host:english,ops:[third]},{engine:waiting,now:()=>now}),null,'a page already in the record language is never presented');
    fs.rmSync(english,{recursive:true,force:true});
  }finally{fs.rmSync(host,{recursive:true,force:true});}
});

test('an ask that already wrote its decision record puts the question on the owner page with its options instead of attempting the same refusal again',()=>{
  const summary=['decision: nivo.login.business.srs.decision.d-login-purchaser-registration recommended: 1',
    'BLOCKED shared-change: four Login ancestry paths outside this allowlist must change first.',
    '1. OPEN SELF-SERVICE REGISTRATION BEFORE CHECKOUT - any verified person may buy.',
    '2. INVITATION-ONLY REGISTRATION - only an invited recipient may buy.',
    '3. EXISTING-PRINCIPAL-ONLY PURCHASE - no registration journey exists.',
    '4. GUEST PAYMENT, THEN ACCOUNT CLAIM - payment first, principal after.'].join(' ');
  const authored=authoredDecisionOf(summary);
  assert.equal(authored.record,'nivo.login.business.srs.decision.d-login-purchaser-registration');
  assert.equal(authored.options.length,4);
  assert.match(authored.options[0],/^OPEN SELF-SERVICE/);
  assert.equal(authoredDecisionOf('BLOCKED shared-change: paths. 1. one 2. two'),null,'options without their record are not an authored decision');
  assert.equal(authoredDecisionOf('decision: some.record 1. the only option'),null,'a single option is not a choice');

  const events=[],store={appendEvent:event=>events.push(event),saveState(){},reportPath:()=>path.join(os.tmpdir(),'no-such-report'),dir:os.tmpdir()};
  const ask={id:'ask-1',kind:'decision.prepare',status:'running',attempt:13,resumes:0,reports:[],dispatch:'d-1',terminal:'t-1',
    requesters:['login-intake'],allowlist:['.starciwork/features/login/business/srs/business-rules/policy-decisions/**'],
    question:{kind:'decision',text:'Who may register as purchaser principal?'}};
  const state={id:'wf',host:process.cwd(),worktree:process.cwd(),engine:{schema:'starci/engine@1',generation:1},needUser:[],
    ops:[ask,{id:'login-intake',kind:'business.intake',status:'waiting',attempt:1,reports:[]}]};
  const report={outcome:'partial',summary,open:['four Login ancestry paths must change first'],
    blocker:{kind:'shared-change',detail:'.starciwork/features/login/business/index.yaml and three more'}};
  const ctx={guards:{parseSharedChangePaths:()=>['.starciwork/features/login/business/index.yaml']},cwd:process.cwd()};
  assert.equal(handleBlocked(store,state,ask,report,ctx),'decision-published-unfinished');
  assert.equal(ask.status,'blocked','the operation stops being dispatched');
  assert.equal(ask.dispatch,null);
  assert.equal(ask.ownerRequestStatus,'waiting-owner');
  const item=state.needUser.find(entry=>entry.kind==='decision');
  assert.equal(item.record,'nivo.login.business.srs.decision.d-login-purchaser-registration');
  assert.equal(item.options.length,4,'the owner page receives the four options, not an empty text box');
  assert.equal(ask.question.recommended,1);
  assert.deepEqual(deriveOwnerRequests(state).find(request=>request.opId==='ask-1').options.map(option=>option.recommended),[true,false,false,false]);
  assert.ok(events.some(event=>event.event==='decision-published-unfinished'));
  assert.equal(handleBlocked(store,state,ask,report,ctx)!=='decision-published-unfinished',true,'a question already on the owner page is not published twice');
});

test('an ask that was already blocked in an earlier generation still reaches the owner page with the options its report carries',()=>{
  const summary=['decision: nivo.login.business.srs.decision.d-login-purchaser-registration recommended: 1 BLOCKED shared-change: four paths.',
    '1. OPEN SELF-SERVICE REGISTRATION - any verified person may buy.',
    '2. INVITATION-ONLY REGISTRATION - only an invited recipient may buy.',
    '3. EXISTING-PRINCIPAL-ONLY PURCHASE - no registration journey exists.',
    '4. GUEST PAYMENT, THEN ACCOUNT CLAIM - payment first, principal after.'].join(' ');
  const events=[],store={appendEvent:event=>events.push(event),saveState(){}};
  const ask={id:'ask-1',kind:'decision.prepare',status:'blocked',attempt:13,requesters:['login-intake'],
    question:{kind:'decision',text:'Who may register as purchaser principal?'},
    reports:[{attempt:12,outcome:'partial',summary:'no decision written yet'},{attempt:13,outcome:'partial',summary,valid:true}]};
  const quiet={id:'ask-9',kind:'decision.prepare',status:'blocked',attempt:2,question:{kind:'decision',text:'Nothing written'},reports:[{attempt:2,outcome:'blocked',summary:'BLOCKED environment: docker is down'}]};
  const state={id:'wf',host:process.cwd(),engine:{schema:'starci/engine@1',generation:4},needUser:[],
    ops:[ask,quiet,{id:'login-intake',kind:'business.intake',status:'waiting',attempt:1,reports:[]}]};
  assert.deepEqual(publishAuthoredDecisions(store,state),{op:'ask-1'});
  assert.equal(ask.ownerRequestStatus,'waiting-owner');
  assert.equal(state.needUser.find(item=>item.kind==='decision').options.length,4);
  assert.equal(publishAuthoredDecisions(store,state),null,'a question already on the page is not published again, and an ask with no record written is left alone');
  assert.equal(quiet.ownerRequestStatus,undefined);
  const answered={...ask,id:'ask-2',ownerRequestStatus:undefined,ownerAnswer:{option:'1'}};
  assert.equal(publishAuthoredDecisions(store,{...state,ops:[answered],needUser:[]}),null,'an ask the owner already answered is not reopened');
});

test('a capped report keeps only the first option, so the choices are read from the decision record the ask authored',t=>{
  const worktree=fs.mkdtempSync(path.join(os.tmpdir(),'starci-decision-record-'));
  t.after(()=>fs.rmSync(worktree,{recursive:true,force:true}));
  const dir=path.join(worktree,'.starciwork','features','login','business','srs','business-rules','policy-decisions','d-x');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.yaml'),[
    'schema: work/node@2','id: nivo.login.decision.d-x','kind: business','description: |',
    '  QUESTION. Who may register as purchaser principal?','',
    '  OPTION 1 - OPEN SELF-SERVICE REGISTRATION. Any verified person may buy, and the record keeps an email.',
    '  OPTION 2 - INVITATION-ONLY REGISTRATION. Only an invited recipient may buy.',
    '  OPTION 3 - EXISTING-PRINCIPAL-ONLY PURCHASE. No registration journey exists at all.',
    '  RECOMMENDATION. Option 1.',''].join(String.fromCharCode(10)));
  assert.deepEqual(decisionRecordOptions(worktree,'nivo.login.decision.d-x'),
    ['OPEN SELF-SERVICE REGISTRATION','INVITATION-ONLY REGISTRATION','EXISTING-PRINCIPAL-ONLY PURCHASE'],
    'one clean title per option, the reasoning after the first full stop left off the label');
  assert.deepEqual(decisionRecordOptions(worktree,'nivo.login.decision.d-absent'),[],'a record that is not in the tree yields nothing');
  assert.deepEqual(decisionRecordOptions(worktree,''),[],'no record named, nothing read');
  assert.deepEqual(decisionRecordOptions(null,'nivo.login.decision.d-x'),[],'no worktree, nothing read');

  // The report kept the record and the first option only, exactly as the 600-character cap leaves it.
  const capped=`decision: nivo.login.decision.d-x recommended: 1 BLOCKED shared-change: four paths must change. 1. OPEN SELF-SERVICE REGISTRATION. Any verified person may buy, and the record keeps`;
  const events=[],store={appendEvent:event=>events.push(event),saveState(){}};
  const ask={id:'ask-1',kind:'decision.prepare',status:'blocked',attempt:13,requesters:[],
    question:{kind:'decision',text:'Who may register?'},reports:[{attempt:13,outcome:'partial',summary:capped,valid:true}]};
  const state={id:'wf',host:process.cwd(),worktree,engine:{schema:'starci/engine@1',generation:4},needUser:[],ops:[ask]};
  assert.deepEqual(publishAuthoredDecisions(store,state),{op:'ask-1'});
  assert.deepEqual(state.needUser.find(item=>item.kind==='decision').options.length,3,'the owner page receives all three, not the one the cap left');
  assert.equal(ask.ownerRequestStatus,'waiting-owner');
});

test('a settled operation releases the canonical writer it reserved, and an operation still running keeps it',()=>{
  const events=[],store={appendEvent:event=>events.push(event),saveState(){}},asked=[];
  const lease=id=>({workflowId:'wf',opId:id,attempt:1,generation:3,jobId:`operation-${id}`,leaseToken:'t'});
  const accepted={id:'ask-2',kind:'decision.prepare',status:'done',lease:lease('ask-2')};
  const live={id:'intake',kind:'work.author',status:'running',lease:lease('intake')};
  const cancelled={id:'old',kind:'work.author',status:'cancelled',lease:lease('old')};
  const skipped={id:'not-needed',kind:'work.author',status:'skipped',lease:lease('not-needed')};
  const dispatched={id:'busy',kind:'work.author',status:'done',lease:lease('busy'),dispatch:'d-1'};
  const state={id:'wf',host:process.cwd(),engine:{schema:'starci/engine@1',generation:3,journalFile:'J'},needUser:[],
    ops:[accepted,live,cancelled,skipped,dispatched]};
  const status={'operation-ask-2':'effect_unknown','operation-intake':'running','operation-old':'succeeded','operation-not-needed':'failed','operation-busy':'effect_unknown'};
  const ctx={engine:{journal:{getJob:id=>({status:status[id]})}}};
  const settle=({leases})=>{asked.push(leases[0].opId);return [{ok:true}];};
  assert.deepEqual(releaseSettledOperationLeases(store,state,ctx,{settle}),{released:['ask-2','old','not-needed']});
  assert.deepEqual(asked,['ask-2','old','not-needed'],'only the settled operations are asked to release');
  assert.equal(accepted.lease,undefined,'the released reservation is gone from the operation');
  assert.ok(live.lease,'an operation still running keeps its writer');
  assert.ok(dispatched.lease,'an operation with a live dispatch is left alone');
  assert.deepEqual(events.filter(event=>event.event==='settled-lease-released').map(event=>event.op),['ask-2','old','not-needed']);
  assert.equal(releaseSettledOperationLeases(store,state,ctx,{settle}),null,'nothing to release twice');

  // A journal that refuses says so once, and the reservation stays until it can be settled.
  const refused={id:'ask-9',kind:'decision.prepare',status:'done',lease:lease('ask-9')};
  const stuck={...state,ops:[refused]},log=[];
  const noisy={appendEvent:event=>log.push(event),saveState(){}};
  const refusing=()=>[{ok:false,reason:'the journal is locked'}];
  assert.equal(releaseSettledOperationLeases(noisy,stuck,ctx,{settle:refusing}),null);
  assert.ok(refused.lease,'a refused release keeps the reservation rather than losing the fence');
  assert.equal(releaseSettledOperationLeases(noisy,stuck,ctx,{settle:refusing}),null);
  assert.equal(log.filter(event=>event.event==='settled-lease-release-refused').length,1,'the refusal is said once, not every tick');
});

test('the frozen copy of a settled launch is removed, the copy of anything still in flight is kept, and an unreadable journal removes nothing',t=>{
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'starci-candidates-'));
  t.after(()=>fs.rmSync(runtime,{recursive:true,force:true}));
  const base=path.join(runtime,'candidates','wf');
  for(const name of ['job-done','job-failed','job-running','job-leased-by-op'])fs.mkdirSync(path.join(base,name),{recursive:true});
  const events=[],store={appendEvent:event=>events.push(event),saveState(){}};
  const state={id:'wf',host:process.cwd(),engine:{schema:'starci/engine@1',generation:3,journalFile:path.join(runtime,'journal.sqlite')},needUser:[],
    ops:[{id:'op-a',kind:'backend.implement',status:'running',lease:{jobId:'job-leased-by-op'}}]};
  const journal={listJobs:()=>[
    {job_id:'job-done',status:'succeeded'},{job_id:'job-failed',status:'failed'},
    {job_id:'job-running',status:'running'},{job_id:'job-leased-by-op',status:'succeeded'}]};
  const removed=sweepSettledCandidates(store,state,{engine:{journal}});
  assert.deepEqual(removed.sort(),['job-done','job-failed'],'only the copies of settled launches go');
  assert.equal(fs.existsSync(path.join(base,'job-running')),true,'a launch still in flight keeps its copy');
  assert.equal(fs.existsSync(path.join(base,'job-leased-by-op')),true,'and so does one an operation still leases');
  assert.equal(fs.existsSync(path.join(base,'job-done')),false);
  assert.deepEqual(events.map(event=>event.event),['candidates-swept']);
  assert.deepEqual(events[0],{event:'candidates-swept',removed:2,kept:2});
  assert.deepEqual(sweepSettledCandidates(store,state,{engine:{journal}}),[],'a second sweep finds nothing and says nothing');
  const blind={listJobs:()=>{throw Error('the journal is locked');}};
  assert.deepEqual(sweepSettledCandidates(store,state,{engine:{journal:blind}}),[],'a journal the kernel cannot read removes nothing');
  assert.equal(fs.existsSync(path.join(base,'job-running')),true);
  assert.deepEqual(sweepSettledCandidates(store,{...state,engine:undefined},{engine:{journal}}),[],'a workflow that is not enrolled sweeps nothing');
});
