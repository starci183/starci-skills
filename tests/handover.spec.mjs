// The owner handover: a workflow is done only when the owner approves it.
//
// Owner ruling 2026-09-23: at handover one op lets the owner test, give feedback
// or ask, and the workflow counts as done only when the reviewer approves.
// handover.review is that op (modules/ops/ops/handover.review.yaml), the last
// leg of every chain; scripts/kernel/handover.mjs reads the answer receipt back;
// api settle records handover-approved only for the owner's approve, and api
// finish refuses handover-not-approved without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {checkOpManifest} from '../scripts/checks/check-op-manifest.mjs';
import {HANDOVER_DECISIONS,HANDOVER_OP,decisionOf,handoverAskProblem} from '../scripts/kernel/handover.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const PLAN=path.join(ROOT,'scripts','route','route-plan.mjs');
const readYaml=rel=>parseYaml(fs.readFileSync(path.join(ROOT,rel),'utf8'));
const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
  env:{...process.env,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:''}});
const json=r=>{try{return JSON.parse(r.stdout);}catch{const open=r.stdout.indexOf('{'),close=r.stdout.indexOf('\n}');return open<0||close<0?null:JSON.parse(r.stdout.slice(open,close+2));}};
const OPTIONS=['Duyệt - workflow hoàn tất','Góp ý / báo lỗi - mô tả trong ghi chú','Đặt câu hỏi - ghi trong ghi chú'];

const fixture=t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-handover-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return repo;
};
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger.db);}finally{ledger.close();}};

/** A running workflow whose approved chain is docs.author then the handover, with docs.author settled pass. */
const seedWorkflow=(repo,wf)=>seed(repo,ledger=>{
  const at=Date.now();
  ledger.ensureWorkflow({workflowId:wf,title:'handover spec'});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
  ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
    .run(wf,0,'hgoal','# goal',JSON.stringify({opChain:{legs:[{op:'docs.author'},{op:HANDOVER_OP}]}}),at);
  seedJob(ledger,{wf,jobId:'job-docs',op:'docs.author',attempt:1,status:'succeeded',result:{verdict:'pass'}});
  ledger.appendEvent({workflowId:wf,entityType:'job',entityId:'job-docs',kind:'op-settled',payload:{verdict:'pass',status:'succeeded'}});
});
/** A job row; with dispatchId it is bound to a contract, so api report / check / settle accept it. */
function seedJob(ledger,{wf,jobId,op,attempt,status='running',dispatchId=null,result=null}){
  const at=Date.now();
  ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,result_json,created_at,updated_at)
    VALUES(?,?,?,?,0,'op','op',?,?,?,?,?)`).run(jobId,wf,op,attempt,
    JSON.stringify({opId:op,owned_paths:[`.starciwork/evidence/${wf}.handover`],...(dispatchId?{orca:{dispatchId}}:{})}),
    status,result?JSON.stringify(result):null,at,at);
  if(dispatchId)ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(wf,op,attempt,dispatchId,'# contract',null,at);
}
const writeReport=(repo,name,body)=>{
  const file=path.join(repo,name);
  fs.writeFileSync(file,JSON.stringify({schema:'starci/op-report@1',summary:'handover',...body}),'utf8');
  return file;
};
const status=(repo,wf)=>{const r=run('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return json(r);};
/** Files the handover ask of `attempt`, settles it blocked (awaiting-owner) and serves it on a live pid. */
const handOver=(repo,wf,{attempt,dispatchId})=>{
  seed(repo,ledger=>seedJob(ledger,{wf,jobId:`job-ho-${attempt}`,op:HANDOVER_OP,attempt,dispatchId}));
  const filed=run('report','--repo',repo,'--job',`job-ho-${attempt}`,'--report',
    writeReport(repo,`ask-${attempt}.json`,{outcome:'ask',question:{text:'Bàn giao: ứng dụng đã xong.',options:OPTIONS}}),'--json');
  assert.equal(filed.status,0,filed.stderr||filed.stdout);
  const settled=run('settle','--repo',repo,'--job',`job-ho-${attempt}`,'--verdict','blocked','--json');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.equal(json(settled).awaitingOwner,true);
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:dispatchId,kind:'ask-serving',payload:{dispatchId,url:'http://127.0.0.1:6971/a-x',pid:process.pid}}));
};
/** What serve-ask writes on submit: the receipt file and the ask-answered event. */
const answer=(repo,wf,{dispatchId,optionIndex,answeredBy='owner',eventAnsweredBy=answeredBy,receiptDispatch=dispatchId,note=null})=>{
  const dir=path.join(repo,'.starciwork','kernel-evidence',wf,'serve-ask');fs.mkdirSync(dir,{recursive:true});
  const receiptPath=path.join(dir,`answer-${dispatchId}.json`);
  fs.writeFileSync(receiptPath,JSON.stringify({schema:'starci/ask-answer@1',workflowId:wf,dispatchId:receiptDispatch,opId:HANDOVER_OP,
    option:OPTIONS[optionIndex],optionIndex,picks:null,answeredBy,custodyWritten:[],envWritten:[],pointersWritten:[],bridge:null,errors:[],note,at:'2026-09-23T10:00:00.000Z'}));
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:dispatchId,kind:'ask-answered',
    payload:{dispatchId,receiptPath,answeredBy:eventAnsweredBy,optionIndex,custodyWritten:[],envWritten:[],pointersWritten:[],errors:[]}}));
  return receiptPath;
};
/** The attempt that runs after an approve: it files done, the kernel records its check, then settles pass. */
const settleApproval=(repo,wf,{attempt,dispatchId})=>{
  seed(repo,ledger=>seedJob(ledger,{wf,jobId:`job-ho-${attempt}`,op:HANDOVER_OP,attempt,dispatchId}));
  const filed=run('report','--repo',repo,'--job',`job-ho-${attempt}`,'--report',writeReport(repo,`done-${attempt}.json`,{outcome:'done',summary:'approved by the owner'}),'--json');
  assert.equal(filed.status,0,filed.stderr||filed.stdout);
  const checked=run('check','--repo',repo,'--job',`job-ho-${attempt}`,'--checks',JSON.stringify({checks:[{name:'handover-owner-approval',command:'api status --json',exitCode:0,evidence:'approve by owner'}]}),'--json');
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
  return run('settle','--repo',repo,'--job',`job-ho-${attempt}`,'--verdict','pass','--json');
};
/** A refused pass leaves its attempt running on a filed done report; retire it the way a kernel would, failed and consumed. */
const retire=(repo,wf,jobId)=>seed(repo,ledger=>{
  ledger.db.prepare("UPDATE jobs SET status='failed',result_json=? WHERE job_id=?").run(JSON.stringify({verdict:'fail'}),jobId);
  ledger.db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND consumed_at IS NULL').run(Date.now(),wf);
});
const approvals=(repo,wf)=>read(repo,db=>db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='handover-approved' ORDER BY seq").all(wf).map(r=>JSON.parse(r.payload_json)));

test('handover.review is a valid op manifest wired into the kind catalog, the routes and the allocator',()=>{
  const result=checkOpManifest();
  assert.deepEqual(result.findings.filter(f=>f.op===HANDOVER_OP),[],'the handover manifest holds starci/op@1 and the prose rules');
  const registry=readYaml('modules/ops/registry.yaml');
  assert.ok(registry.ops.some(op=>op.id===HANDOVER_OP),'the generated registry indexes the op');
  const kinds=readYaml('modules/models/kinds.yaml');
  assert.deepEqual([kinds.kinds[HANDOVER_OP]?.family,kinds.kinds[HANDOVER_OP]?.role,kinds.kinds[HANDOVER_OP]?.operator],['prove','verify',HANDOVER_OP]);
  assert.ok(kinds.vocabularies.families.includes('prove')&&kinds.vocabularies.roles.includes('verify'));
  const routeIds=kinds.routes.map(r=>r.id);
  const handoverRoutes=kinds.routes.filter(r=>r.from===HANDOVER_OP);
  assert.deepEqual(handoverRoutes.map(r=>r.on.answer),HANDOVER_DECISIONS,'one route per answer, in option order');
  for(const r of handoverRoutes)assert.ok(routeIds.indexOf(r.id)<routeIds.indexOf('question-needs-the-user'),`${r.id} stands before the generic ask route`);
  assert.deepEqual(handoverRoutes.map(r=>r.to.kind),['same','lane.build','same'],'feedback repairs the build, approve and question run the handover again');
  assert.deepEqual(readYaml('modules/models/runtimes.yaml').roleOfKind[HANDOVER_OP],{role:'verify',work:'think',floor:'hard'});
  // The Qwen base pool (owner ruling 2026-09-24) trails the frontier pools on every think chain.
  assert.deepEqual(readYaml('modules/models/registry.yaml').operators[HANDOVER_OP].chain,['claude-agent','codex-agent']);
});

test('a handover ask carries exactly the three options approve, feedback, question; api report refuses any other shape',t=>{
  assert.equal(handoverAskProblem({text:'x',options:OPTIONS}),null);
  assert.match(handoverAskProblem({text:'x',options:OPTIONS.slice(0,2)}),/exactly 3 options/);
  assert.match(handoverAskProblem({text:'x',options:[...OPTIONS,'Khác']}),/exactly 3 options/);
  assert.match(handoverAskProblem({text:'x',options:[OPTIONS[0],OPTIONS[0],OPTIONS[2]]}),/distinct/);
  assert.match(handoverAskProblem({text:'x',options:OPTIONS,picks:[{id:'p',choices:['a','b']}]}),/no picks/);
  assert.equal(decisionOf({optionIndex:0},{options:OPTIONS}),'approve');
  assert.equal(decisionOf({option:OPTIONS[1]},{options:OPTIONS}),'feedback','an older receipt is matched by its label');
  assert.equal(decisionOf({optionIndex:2},{options:OPTIONS}),'question');

  const repo=fixture(t),wf='wf-handover-shape';
  seedWorkflow(repo,wf);
  seed(repo,ledger=>seedJob(ledger,{wf,jobId:'job-ho-1',op:HANDOVER_OP,attempt:1,dispatchId:'ho-d1'}));
  const two=run('report','--repo',repo,'--job','job-ho-1','--report',writeReport(repo,'two.json',{outcome:'ask',question:{text:'Bàn giao',options:OPTIONS.slice(0,2)}}),'--json');
  assert.notEqual(two.status,0,'a two-option handover ask is refused');
  assert.match(two.stderr,/report-invalid/);
  assert.match(two.stderr,/exactly 3 options/);
  assert.equal(read(repo,db=>db.prepare('SELECT count(*) n FROM reports WHERE workflow_id=?').get(wf).n),0,'nothing is filed');
  const three=run('report','--repo',repo,'--job','job-ho-1','--report',writeReport(repo,'three.json',{outcome:'ask',question:{text:'Bàn giao',options:OPTIONS}}),'--json');
  assert.equal(three.status,0,three.stderr||three.stdout);
  assert.deepEqual(read(repo,db=>JSON.parse(db.prepare('SELECT report_json FROM reports WHERE workflow_id=?').get(wf).report_json)).question.options,OPTIONS);
});

test('finish is refused without the owner approval and allowed after it; a later business settle makes it stale',t=>{
  const repo=fixture(t),wf='wf-handover-finish';
  seedWorkflow(repo,wf);
  const refused=run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(refused.status,0,'no approval, no finish');
  assert.match(refused.stderr,/handover-not-approved/);
  assert.equal(read(repo,db=>db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf).phase),'running','a refused finish writes nothing');

  let s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.state,s.handover.due],['handover-due',true,'not-started',true],
    'every approved leg settled: the handover is the Kernel\'s next move');
  assert.match(s.frontier.reason,/enqueue handover\.review as the final leg/);

  handOver(repo,wf,{attempt:1,dispatchId:'ho-d1'});
  s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.state],['awaiting-owner',false,'awaiting-owner'],
    'a workflow waiting on its handover waits on the owner, it is not orphaned');

  answer(repo,wf,{dispatchId:'ho-d1',optionIndex:0});
  s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.ask.decision,s.handover.ask.byOwner],['handover-answered',true,'approve',true]);
  assert.match(s.frontier.reason,/enqueue handover\.review again/);
  assert.equal(run('finish','--repo',repo,'--workflow',wf,'--json').status===0,false,'an answer is not yet the recorded approval');

  const settled=settleApproval(repo,wf,{attempt:2,dispatchId:'ho-d2'});
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.deepEqual(json(settled).handoverApproved,{dispatchId:'ho-d1',answeredBy:'owner'});
  const [approved]=approvals(repo,wf);
  assert.deepEqual([approved.jobId,approved.dispatchId,approved.answeredBy,approved.at],['job-ho-2','ho-d1','owner','2026-09-23T10:00:00.000Z'],
    'handover-approved {jobId, dispatchId, answeredBy, at}');

  s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.state,s.handover.finishAllowed],['finish-ready',true,'approved',true],
    'an approved but unfinished workflow is the Kernel\'s to finish');

  // A business job that settles after the approval: the owner approved a package that no longer covers the product.
  seed(repo,ledger=>{
    seedJob(ledger,{wf,jobId:'job-docs-2',op:'docs.author',attempt:2,status:'succeeded',result:{verdict:'pass'}});
    ledger.appendEvent({workflowId:wf,entityType:'job',entityId:'job-docs-2',kind:'op-settled',payload:{verdict:'pass',status:'succeeded'}});
  });
  s=status(repo,wf);
  assert.equal(s.handover.finishAllowed,false);
  assert.equal(s.frontier.state,'handover-due');
  const stale=run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(stale.status,0);
  assert.match(stale.stderr,/handover-not-approved/);

  // Handed over again and approved again: the new approval covers the new settle.
  handOver(repo,wf,{attempt:3,dispatchId:'ho-d3'});
  answer(repo,wf,{dispatchId:'ho-d3',optionIndex:0});
  assert.equal(settleApproval(repo,wf,{attempt:4,dispatchId:'ho-d4'}).status,0);
  const finished=run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.equal(finished.status,0,finished.stderr||finished.stdout);
  assert.equal(json(finished).handover.via,'handover-approved');
  assert.equal(read(repo,db=>db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf).phase),'finished');
});

test('a non-owner answer never approves a handover',t=>{
  const repo=fixture(t),wf='wf-handover-delegate';
  seedWorkflow(repo,wf);
  handOver(repo,wf,{attempt:1,dispatchId:'ho-d1'});
  answer(repo,wf,{dispatchId:'ho-d1',optionIndex:0,answeredBy:'supervisor'});
  const s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.handover.ask.decision,s.handover.ask.byOwner],['handover-answered','approve',false]);
  assert.match(s.frontier.reason,/only the owner approves a handover/);
  const refused=settleApproval(repo,wf,{attempt:2,dispatchId:'ho-d2'});
  assert.notEqual(refused.status,0,'a delegated approve cannot settle the handover pass');
  assert.match(refused.stderr,/handover-not-approved/);
  assert.match(refused.stderr,/answered by supervisor/);
  assert.equal(read(repo,db=>db.prepare("SELECT status FROM jobs WHERE job_id='job-ho-2'").get().status),'running','the refused settle writes nothing');
  assert.deepEqual(approvals(repo,wf),[]);
  retire(repo,wf,'job-ho-2');
  assert.match(run('finish','--repo',repo,'--workflow',wf,'--json').stderr,/handover-not-approved/);

  // A receipt that says owner under an event that does not, and a receipt bound to another ask, approve nothing either.
  for(const [dispatchId,opts] of [['ho-d3',{eventAnsweredBy:'supervisor'}],['ho-d5',{receiptDispatch:'ho-other'}]]){
    const attempt=Number(dispatchId.slice(-1));
    handOver(repo,wf,{attempt,dispatchId});
    answer(repo,wf,{dispatchId,optionIndex:0,...opts});
    const r=settleApproval(repo,wf,{attempt:attempt+1,dispatchId:`${dispatchId}-next`});
    assert.notEqual(r.status,0,`${dispatchId} must not approve`);
    assert.match(r.stderr,/handover-not-approved/);
    retire(repo,wf,`job-ho-${attempt+1}`);
  }
  assert.deepEqual(approvals(repo,wf),[]);
});

test('feedback and question answers are the Kernel\'s move, and a passed fix makes the handover due again',t=>{
  const repo=fixture(t),wf='wf-handover-feedback';
  seedWorkflow(repo,wf);
  handOver(repo,wf,{attempt:1,dispatchId:'ho-d1'});
  answer(repo,wf,{dispatchId:'ho-d1',optionIndex:1,note:'Nút lưu không hoạt động'});
  let s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.ask.decision,s.handover.ask.note],['handover-answered',true,'feedback','Nút lưu không hoạt động']);
  assert.match(s.frontier.reason,/handover-feedback-repairs-the-build/);
  assert.match(settleApproval(repo,wf,{attempt:2,dispatchId:'ho-d2'}).stderr,/not approve/,'feedback is no approval');
  retire(repo,wf,'job-ho-2');
  seed(repo,ledger=>{
    seedJob(ledger,{wf,jobId:'job-fix',op:'docs.author',attempt:3,status:'succeeded',result:{verdict:'pass'}});
    ledger.appendEvent({workflowId:wf,entityType:'job',entityId:'job-fix',kind:'op-settled',payload:{verdict:'pass',status:'succeeded'}});
  });
  s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.handover.state],['handover-due','due'],'the fix passed: hand over again');
  const deliveries=json(run('survey','--repo',repo,'--workflow',wf,'--deliveries','--json'));
  assert.deepEqual(deliveries.handoverHistory.map(h=>[h.dispatchId,h.decision,h.note]),[['ho-d1','feedback','Nút lưu không hoạt động']],
    'the next handover and the fix op read the note through survey --deliveries');
  assert.deepEqual(deliveries.deliveries.map(d=>d.jobId),['job-docs','job-fix']);

  handOver(repo,wf,{attempt:4,dispatchId:'ho-d4'});
  answer(repo,wf,{dispatchId:'ho-d4',optionIndex:2,note:'Làm sao đăng nhập?'});
  s=status(repo,wf);
  assert.deepEqual([s.frontier.state,s.handover.ask.decision],['handover-answered','question']);
  assert.match(s.frontier.reason,/answers it in the package/);
});

test('the planner appends handover.review as the final leg of every chain',()=>{
  const plan=(...args)=>{const r=spawnSync(process.execPath,[PLAN,'--simulate','--json',...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});return JSON.parse(r.stdout);};
  for(const text of ['viết SDS, khai báo .starcistacks','build the enrolment screen','scaffold a backend and a frontend']){
    const p=plan('--text',text);
    assert.equal(p.status,'ok',text);
    const last=p.legs.at(-1);
    assert.equal(last.op,HANDOVER_OP,`${text}: ${p.legs.map(l=>l.op).join(' > ')}`);
    assert.deepEqual(last.producesCovered,['handover: approved']);
    assert.ok(last.injected);
    assert.equal(p.legs.filter(l=>l.op===HANDOVER_OP).length,1);
  }
  const vars=readYaml('modules/goal/legality.yaml').producesVocabulary;
  assert.deepEqual(vars.opProduces[HANDOVER_OP],['handover: approved']);
  assert.ok(vars.stateVariables.includes('handover: approved'));
  assert.ok(readYaml('modules/goal/archetypes.yaml').archetypes.every(a=>a.chain.at(-1).op===HANDOVER_OP),'every archetype chain ends with the handover');
  const ambiguous=plan('--text','xyzzy');
  assert.equal(ambiguous.status,'needs-owner');
  assert.ok(!ambiguous.legs.some(l=>l.op===HANDOVER_OP),'an intent question is no chain to hand over');
});

test('api plan does not count a trailing handover.review appended to an older chain as divergence',t=>{
  const repo=fixture(t),wf='wf-handover-plan';
  seedWorkflow(repo,wf);
  seed(repo,ledger=>ledger.db.prepare('UPDATE goals SET json=? WHERE workflow_id=?').run(JSON.stringify({opChain:{legs:[{op:'docs.author'},{op:'review.verify'}]}}),wf));
  const planFile=(name,legs)=>{const f=path.join(repo,name);fs.writeFileSync(f,JSON.stringify({legs:legs.map(op=>({op}))}));return f;};
  const appended=run('plan','--repo',repo,'--workflow',wf,'--file',planFile('a.json',['docs.author','review.verify',HANDOVER_OP]),'--json');
  assert.equal(appended.status,0,appended.stderr);
  assert.deepEqual([json(appended).divergence.diverged,json(appended).divergence.handoverAppended,json(appended).divergence.extra],[false,true,[]]);
  const middle=run('plan','--repo',repo,'--workflow',wf,'--file',planFile('b.json',['docs.author',HANDOVER_OP,'review.verify']),'--json');
  assert.equal(json(middle).divergence.diverged,true,'anywhere but last it is a structural change');
});
