import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';
import {inspectLedger,ledgerFileFor,openLedger,jobResult} from '../engine/ledger-db.mjs';
import {
  admittedBeforeChange,advisoryCodesFor,carriesChange,contractFollowUpsOf,frozenChangesFor,laterChangesFor,loadContractChanges,loadContractFreeze,
  releasedChangesOf,withheldChangesFor,
} from '../scripts/kernel/contract-version.mjs';
import {gateFamiliesTouched} from '../scripts/supervisor/land.mjs';
import {compareSides,gateSide} from '../scripts/supervisor/gate-stability.mjs';

// Owner, 2026-09-28: "Đóng băng luật vẽ: ngừng đổi cổng vẽ trong lúc workflow đang chạy; thay đổi gom lại, áp một lần
// và chỉ nợ vẽ lại một lần." Eight reach follow-up changes hit interface.draw on 2026-09-27 and each made running and
// settled draw legs owe another redo. A frozen family's changes reach a running workflow only at a release; until then
// new legs are admitted with them withheld and they owe nothing; after it a leg owes ONE redo for the whole set.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));
const T0=Date.parse('2026-09-27T10:00:00+07:00');   // the workflow is created
const T1=Date.parse('2026-09-27T12:00:00+07:00');   // first frozen change
const T2=Date.parse('2026-09-27T15:00:00+07:00');   // second frozen change
const T3=Date.parse('2026-09-27T18:00:00+07:00');   // a follow-up change of an unfrozen family

const REGISTRY=['schema: starci/contract-changes@1','changes:',
  '  - id: refactor-gate-one',"    effectiveAt: '2026-09-27T12:00:00+07:00'",'    ops: [code.refactor]','    adds:','      codes: [REFACTOR_ONE]','    reach: follow-up','    followUp:','      op: code.refactor','      ops: [code.refactor]',
  '  - id: refactor-gate-two',"    effectiveAt: '2026-09-27T15:00:00+07:00'",'    ops: [code.refactor]','    adds:','      codes: [REFACTOR_TWO]','    reach: follow-up','    followUp:','      op: code.refactor','      ops: [code.refactor]',
  '  - id: refactor-safety',"    effectiveAt: '2026-09-27T16:00:00+07:00'",'    ops: [code.refactor]','    safetyCritical: true','    reach: new-legs',
  '  - id: audit-follow-up',"    effectiveAt: '2026-09-27T18:00:00+07:00'",'    reach: follow-up','    followUp:','      op: interface.audit','      ops: [interface.audit]',
  '  - id: named-batch',"    effectiveAt: '2026-09-27T09:00:00+07:00'",'    ops: [interface.audit]','    batch: audit-wave','    reach: new-legs',''].join('\n');
const FREEZE=['schema: starci/contract-freeze@1','families:','  - family: code.refactor',"    since: '2026-09-27T11:00:00+07:00'",'    gatePaths: [scripts/checks/refactor-]','    gates:','      - module: gate.mjs','        export: refactorFindings',''].join('\n');

const files=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-freeze-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const registry=path.join(dir,'contract-changes.yaml'),freeze=path.join(dir,'contract-freeze.yaml');
  fs.writeFileSync(registry,REGISTRY);fs.writeFileSync(freeze,FREEZE);
  return {dir,registry,freeze};
};
const load=f=>loadContractChanges(ROOT,{file:f.registry,freezeFile:f.freeze});

test('a change governing a frozen family is batched from the freeze on; safety-critical and other families are not; the live files parse clean',t=>{
  const registry=load(files(t));
  assert.deepEqual(registry.problems,[]);
  const batch=Object.fromEntries(registry.changes.map(c=>[c.id,c.batch]));
  assert.deepEqual(batch,{'named-batch':'audit-wave','refactor-gate-one':'code.refactor','refactor-gate-two':'code.refactor','refactor-safety':null,'audit-follow-up':null});
  assert.deepEqual(registry.changes.find(c=>c.id==='refactor-gate-one').families,['code.refactor']);
  const live=loadContractChanges(ROOT,{freezeFile:path.join(ROOT,'modules','kernel','contract-freeze.yaml')});
  assert.deepEqual(live.problems,[]);
  assert.ok(live.changes.filter(c=>c.reach==='follow-up'&&c.families.includes('interface.draw')&&c.effectiveAt>=Date.parse('2026-09-27T00:00:00+07:00')).every(c=>c.batch==='interface.draw'),'every draw follow-up change of 2026-09-27 is in the interface.draw batch');
  const freeze=loadContractFreeze(ROOT,{file:path.join(ROOT,'modules','kernel','contract-freeze.yaml')});
  assert.ok(freeze.families.find(f=>f.family==='interface.draw').gates.length>0);
  // A safety-critical change cannot name a batch; a freeze naming no op is a problem.
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-freeze-bad-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'c.yaml'),['schema: starci/contract-changes@1','changes:','  - id: urgent',"    effectiveAt: '2026-09-27T12:00:00+07:00'",'    safetyCritical: true','    batch: later',''].join('\n'));
  fs.writeFileSync(path.join(dir,'f.yaml'),['schema: starci/contract-freeze@1','families:','  - family: no.such.op',"    since: '2026-09-27T00:00:00+07:00'",''].join('\n'));
  const bad=loadContractChanges(ROOT,{file:path.join(dir,'c.yaml'),freezeFile:path.join(dir,'f.yaml')});
  assert.equal(bad.changes.length,0);
  assert.ok(bad.problems.some(p=>/urgent: a safetyCritical change .* never batched/.test(p)));
  assert.ok(bad.problems.some(p=>/no\.such\.op is not an op/.test(p)));
});

test('withheld changes are judged as if admitted before them: advisory codes, old settle gates, not carried',()=>{
  const change={id:'refactor-gate-two',effectiveAt:T2,safetyCritical:false};
  const frozen={at:T2+60_000,withheld:['refactor-gate-two']};
  assert.equal(carriesChange(frozen,change),false);
  assert.equal(admittedBeforeChange(frozen,change),true);
  assert.equal(carriesChange({at:T2+60_000,withheld:[]},change),true);
  assert.equal(admittedBeforeChange({at:T2+60_000},{...change,safetyCritical:true}),false,'a safety-critical change applies to every leg');
  assert.equal(admittedBeforeChange({at:null,withheld:['refactor-gate-two']},change),false,'an unknown admission is judged under the current contract');
  const registry={changes:[{id:'refactor-gate-one',effectiveAt:T1,ops:['code.refactor'],adds:{codes:['REFACTOR_ONE'],checks:[]}},{id:'refactor-gate-two',effectiveAt:T2,ops:['code.refactor'],adds:{codes:['REFACTOR_TWO'],checks:[]}}]};
  assert.deepEqual(laterChangesFor(registry,{admittedAt:T2+1,op:'code.refactor',withheld:['refactor-gate-one','refactor-gate-two']}).map(c=>c.id),['refactor-gate-one','refactor-gate-two']);
  assert.deepEqual(advisoryCodesFor(registry,{admittedAt:T2+1,op:'code.refactor',withheld:['refactor-gate-two']}).codes,['REFACTOR_TWO']);
  assert.deepEqual(advisoryCodesFor(registry,{admittedAt:T2+1,op:'code.refactor'}).codes,[]);
});

const fixture=t=>{
  const f=files(t);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-freeze-wf-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const savedMachine=process.env.STARCI_TEST_MACHINE_FILE,savedProjects=process.env.STARCI_PROJECTS_ROOT;
  process.env.STARCI_TEST_MACHINE_FILE=path.join(root,'machine.sqlite');
  process.env.STARCI_PROJECTS_ROOT=path.join(root,'projects');
  t.after(()=>{
    if(savedMachine===undefined)delete process.env.STARCI_TEST_MACHINE_FILE;else process.env.STARCI_TEST_MACHINE_FILE=savedMachine;
    if(savedProjects===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=savedProjects;
  });
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});for(const d of ['docs','src'])fs.mkdirSync(path.join(repo,d),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_CONTRACT_CHANGES:f.registry,STARCI_CONTRACT_FREEZE:f.freeze,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json')};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete env[key];
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout)??lastLine(r.stdout);};
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const wf='wf-contract-freeze';
  seed(l=>{
    l.ensureWorkflow({workflowId:wf,title:wf,ledgerMode:'durable',sourceRoots:[repo],at:T0});
    l.write.changeWorkflowPhase({workflowId:wf,to:'running',by:'test',reason:'seed contract workflow',at:T0});
    l.db.prepare("UPDATE workflows SET created_at=? WHERE workflow_id=?").run(T0,wf);
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf,0,'goal','# goal','{}',T0);
  });
  // One leg of `op` at `admittedAt` (a contracts row unless status queued), with a done report when it ran.
  const leg=(jobId,op,admittedAt,{status='succeeded',attempt=1,payload={},withheld=null}={})=>seed(l=>{
    const dispatchId=`ctx-${jobId}`;
    const jobPayload={opId:op,owned_paths:[`docs/${op}`],...(status==='queued'?{}:{managed:{dispatchId}}),...payload};
    if(!l.db.prepare('SELECT 1 FROM jobs WHERE job_id=?').get(jobId))
      seedWorkflow(l,{id:wf,jobs:[{jobId,opId:op,status,dispatchId,payload:jobPayload,createdAt:admittedAt,updatedAt:admittedAt}]});
    else if(status==='running'){
      for(const to of ['ready','leased'])l.write.setJobStatus({jobId,to,reason:'test dispatch',at:admittedAt});
      l.write.startAttempt({workflowId:wf,jobId,dispatchId,at:admittedAt});
      l.write.setJobStatus({jobId,to:'running',reason:'test dispatch',at:admittedAt});
    }
    if(status==='queued'||status==='cancelled')return;
    const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId).attempt_id;
    const context=withheld?{contract:{schema:'starci/contract-version@1',op,admittedAt,withheld}}:{};
    l.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)').run(attemptId,wf,jobId,'# contract',JSON.stringify(context),admittedAt);
    l.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,'done','{}',?,?)").run(wf,attemptId,dispatchId,jobId,admittedAt,admittedAt);
  });
  return {f,repo,wf,api,ok,seed,read,leg,registry:load(f)};
};

test('frozen changes owe no follow-up until released; the release owes ONE redo for the whole set, never one per change',t=>{
  const fx=fixture(t);
  fx.leg('job-refactor','code.refactor',T0+60_000);
  fx.leg('job-audit','interface.audit',T0+60_000);
  const owed=()=>fx.read(db=>contractFollowUpsOf(db,fx.wf,fx.registry).owed);
  assert.deepEqual(owed().map(o=>[o.change,o.jobId]),[['audit-follow-up','job-audit']],'an unfrozen family still owes per landing');
  assert.deepEqual(fx.read(db=>frozenChangesFor(db,fx.registry,{workflowId:fx.wf}).map(c=>c.id)),['refactor-gate-one','refactor-gate-two']);
  assert.deepEqual(fx.read(db=>withheldChangesFor(db,fx.registry,{workflowId:fx.wf,op:'code.refactor'})),['refactor-gate-one','refactor-gate-two']);
  const status=fx.ok(['status','--workflow',fx.wf]);
  assert.deepEqual(status.frozenContractChanges.map(c=>c.id),['refactor-gate-one','refactor-gate-two']);

  const dry=fx.ok(['contract-release','--family','code.refactor','--dry-run']);
  assert.deepEqual(dry.workflows.map(w=>[w.workflowId,w.changes,w.owedBefore,w.owedAfter,w.released]),[[fx.wf,['refactor-gate-one','refactor-gate-two'],1,2,false]]);
  assert.equal(fx.read(db=>releasedChangesOf(db,fx.wf).size),0,'a dry run writes nothing');

  const rel=fx.ok(['contract-release','--family','code.refactor','--reason','one release for the day']);
  assert.equal(rel.workflows[0].released,true);
  const after=owed();
  const refactor=after.filter(o=>o.jobId==='job-refactor');
  assert.equal(refactor.length,1,'two released changes owe the leg ONE redo');
  assert.deepEqual([refactor[0].change,refactor[0].alsoCovers,refactor[0].batch],['refactor-gate-two',['refactor-gate-one'],'code.refactor']);
  assert.equal(fx.ok(['contract-release','--family','code.refactor']).workflows[0].changes.length,0,'a second release has nothing left to release');
  refuse(fx,['contract-release','--family','no.family.here'],'contract-family-unknown');

  // The Kernel files the redo: while it is queued nothing more is owed, and admitted after the release it carries all.
  fx.leg('job-refactor-redo','code.refactor',Date.now(),{status:'queued',attempt:2,payload:{contractChange:{id:'refactor-gate-two',followUpOf:'job-refactor'}}});
  assert.deepEqual(owed().filter(o=>o.op==='code.refactor'),[]);
  fx.seed(l=>l.db.prepare("DELETE FROM jobs WHERE job_id='job-refactor-redo'").run());
  fx.leg('job-refactor-redo','code.refactor',Date.now()+1000,{status:'running',attempt:2,payload:{contractChange:{id:'refactor-gate-two',followUpOf:'job-refactor'}}});
  assert.deepEqual(owed().filter(o=>o.op==='code.refactor'),[],'a redo admitted after the release satisfies every change up to it');
});

const refuse=(fx,args,code)=>{const r=fx.api(args);assert.equal(r.status,1,r.stdout);assert.equal(lastLine(r.stderr)?.code,code,r.stderr);};

test('a redo still withheld from a change owes it only after the release; a cancelled redo covers nothing',t=>{
  const fx=fixture(t);
  fx.leg('job-a','code.refactor',T0+60_000);
  // Released: gate one only (a release of that day), then a redo admitted between the two changes, then gate two lands.
  fx.seed(l=>l.appendEvent({workflowId:fx.wf,entityType:'contract',entityId:'code.refactor',kind:'contract-release',payload:{family:'code.refactor',changes:['refactor-gate-one']},createdAt:T1+1000}));
  fx.leg('job-a-cancelled','code.refactor',T1+1500,{status:'cancelled',attempt:2,payload:{contractChange:{id:'refactor-gate-one',followUpOf:'job-a'}}});
  const owedNow=()=>fx.read(db=>contractFollowUpsOf(db,fx.wf,fx.registry).owed.map(o=>[o.change,o.jobId]));
  assert.deepEqual(owedNow(),[['refactor-gate-one','job-a']],'a cancelled redo did no work');
  fx.leg('job-b','code.refactor',T2+60_000,{attempt:3,withheld:['refactor-gate-two'],payload:{contractChange:{id:'refactor-gate-one',followUpOf:'job-a'}}});
  assert.deepEqual(owedNow(),[],'gate two is still frozen; job-b carries gate one');
  fx.seed(l=>l.appendEvent({workflowId:fx.wf,entityType:'contract',entityId:'code.refactor',kind:'contract-release',payload:{family:'code.refactor',changes:['refactor-gate-two']},createdAt:Date.now()}));
  assert.deepEqual(owedNow(),[['refactor-gate-two','job-b']],'admitted with gate two withheld, job-b owes one redo at its release');
});

test('dispatch withholds the frozen changes; api check reads their codes advisory; the release re-stamps queued legs and drops a duplicate',t=>{
  const fx=fixture(t);
  const first=fx.ok(['enqueue','--workflow',fx.wf,'--op','code.refactor','--paths','docs/']).job_id;
  const d=fx.api(['dispatch','--job',first,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const context=fx.read(db=>JSON.parse(db.prepare('SELECT c.context_json FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE c.workflow_id=? AND a.op_id=? ORDER BY c.created_at DESC LIMIT 1').get(fx.wf,'code.refactor').context_json));
  assert.deepEqual(context.contract.withheld,['refactor-gate-one','refactor-gate-two']);
  const admission=fx.ok(['op-contract','--job',first]).admission;
  assert.deepEqual(admission.withheld,['refactor-gate-one','refactor-gate-two']);
  assert.deepEqual(admission.advisoryCodes,['REFACTOR_ONE','REFACTOR_TWO']);
  const attempt=fx.read(db=>db.prepare('SELECT a.attempt_id,a.dispatch_id,a.job_id FROM op_attempts a WHERE a.workflow_id=? AND a.op_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(fx.wf,'code.refactor'));
  fx.seed(l=>l.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,'done','{}',?)").run(fx.wf,attempt.attempt_id,attempt.dispatch_id,attempt.job_id,Date.now()));
  const checked=fx.ok(['check','--job',first,'--checks',JSON.stringify({checks:[{name:'refactor-gate',exitCode:1,codes:['REFACTOR_TWO']}]})]);
  assert.deepEqual(checked.advisory,[{name:'refactor-gate',changes:['refactor-gate-two']}],'a code of a withheld change is a suspect, not a refusal');

  // Two never-dispatched legs of the same paths wait: the release keeps the newest, re-stamped, and drops the older one.
  fx.leg('job-q1','code.refactor',Date.now(),{status:'queued',attempt:5});
  fx.leg('job-q2','code.refactor',Date.now()+1,{status:'queued',attempt:6});
  const rel=fx.ok(['contract-release','--family','code.refactor']);
  assert.deepEqual([rel.workflows[0].restamped,rel.workflows[0].dropped,rel.workflows[0].running],[['job-q2'],['job-q1'],[first]]);
  fx.read(db=>{
    const q1=db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-q1');
    assert.equal(q1.status,'cancelled');
    assert.equal(jobResult(db,'job-q1').reason,'superseded-by-contract-release');
    assert.deepEqual(JSON.parse(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get('job-q2').payload_json).contractRelease.changes,['refactor-gate-one','refactor-gate-two']);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM events WHERE kind='contract-release'").get().n,1);
  });
  // An operation terminal (the Orca terminal the ledger binds to an op job) never releases contracts.
  fx.seed(l=>l.db.prepare('UPDATE jobs SET worker_id=? WHERE job_id=?').run('term_op-first',first));
  const op=spawnSync(process.execPath,[API,'contract-release','--family','code.refactor','--repo',fx.repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,
    env:{...process.env,STARCI_CONTRACT_CHANGES:fx.f.registry,STARCI_CONTRACT_FREEZE:fx.f.freeze,ORCA_TERMINAL_HANDLE:'term_op-first'}});
  assert.equal(op.status,1);
  assert.equal(lastLine(op.stderr)?.code,'op-context-refused');
});

test('the land gate reports gate stability for a frozen family: which lands touch it, and how many accepted legs would flip',async t=>{
  const freeze=[{family:'interface.draw',gatePaths:['scripts/checks/draw-','knowledge/grammars/']}];
  assert.deepEqual(gateFamiliesTouched({changed:['scripts/checks/draw-dna.mjs','README.md'],freeze}),[{family:'interface.draw',why:['scripts/checks/draw-dna.mjs']}]);
  assert.deepEqual(gateFamiliesTouched({changed:['README.md'],freeze}),[]);
  const entry={id:'new-draw-code',ops:['interface.draw'],adds:{codes:['DRAW_X']}};
  assert.deepEqual(gateFamiliesTouched({changed:['modules/kernel/contract-changes.yaml'],freeze,before:{changes:[]},after:{changes:[entry]}}),[{family:'interface.draw',why:['contract change new-draw-code']}]);
  assert.deepEqual(gateFamiliesTouched({changed:[],freeze,before:{changes:[entry]},after:{changes:[entry]}}),[],'an unchanged entry is not this land');

  // Two trees whose gate differs: the candidate newly fails one accepted leg.
  const fx=fixture(t);
  fx.leg('job-accepted','code.refactor',T0+60_000,{payload:{owned_paths:['docs/a.md']}});
  fx.leg('job-older','code.refactor',T0,{attempt:0});
  const tree=(name,body)=>{const dir=path.join(fx.f.dir,name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'gate.mjs'),body);return dir;};
  const base=tree('base','export const refactorFindings = () => ({ findings: [] });\n');
  const head=tree('head',"export const refactorFindings = ({ files }) => ({ findings: files.map((f) => ({ code: 'REFACTOR_TWO', path: f })) });\n");
  const gates=[{module:'gate.mjs',export:'refactorFindings'}];
  const ledgers=[ledgerFileFor(fx.repo)];
  const b=await gateSide({tree:base,family:'code.refactor',ledgers,gates});
  const h=await gateSide({tree:head,family:'code.refactor',ledgers,gates});
  assert.deepEqual(h.legs.map(l=>[l.workflowId,l.jobId]),[[fx.wf,'job-accepted']],'the newest accepted leg per live workflow');
  const report=compareSides(b,h);
  assert.deepEqual([report.legs,report.flips,report.newlyFailing],[1,1,1]);
  assert.deepEqual(report.perLeg[0].newFindings,[{code:'REFACTOR_TWO',path:'docs/a.md'}]);
});
