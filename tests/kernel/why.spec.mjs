import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {changeWorkflowPhase,ledgerFileFor,openLedger,recordCheckRun,recordJobResult,setJobStatus,startAttempt,updateAttempt} from '../../engine/db/ledger.mjs';
import {catalogProblems,emittedCodes,readCatalog} from '../../scripts/checks/check-failure-codes.mjs';
import {buildWhy,checkFacts,explainCode,kernelNotesOf,loadCatalog,whyOf,WHY_SCHEMA} from '../../scripts/kernel/why.mjs';
import {recordWhy} from '../../scripts/kernel/why-record.mjs';
import {loadAdapter,adapterModelAuthority,loadModelRegistry,loadRuntimes} from '../../scripts/agent/model-registry.mjs';
import {selectAdmission} from '../../scripts/lib/agent-admission.mjs';
import {fakeAdmission} from '../helpers/fake-admission.mjs';

// Every failed / blocked / refused / waiting attempt explains itself in the owner's language: the catalog
// (modules/kernel/failure-codes.yaml) names every code the runtime emits, the checker refuses an uncatalogued one, and
// scripts/kernel/why.mjs builds the {headline, cause, disagreement, next, owner, codes, refs} stored in op_attempts.why_json.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=v=>JSON.stringify(v??null);
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'starci-why-'));fs.mkdirSync(path.join(d,'docs'));t.after(()=>fs.rmSync(d,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return d;};

test('the catalog carries every emitted code, in the owner-facing shape, and no retired one',()=>{
  const p=catalogProblems();
  assert.deepEqual(p.missing.map(m=>m.code),[],'an emitted code with no catalog entry');
  assert.deepEqual(p.stale,[],'a catalog entry no code emits');
  assert.deepEqual(p.malformed,[]);
  assert.ok(p.catalog>=1000,`the catalog has ${p.catalog} entries`);
  const c=loadCatalog();
  assert.match(c.TARGET_MISSING.title_vi,/kh\u00f4ng t\u1ed3n t\u1ea1i/);
  assert.equal(c['rerun-red'].kind,'settle-reason');
  assert.ok(c['prompt-stuck'].nextStep_vi);
  assert.ok(emittedCodes().some(e=>e.code==='LAYOUT_ANCESTOR_UNSETTLED'));
});

test('the checker refuses an emitted code missing from the catalog, and a retired entry',t=>{
  const base=tmp(t);
  for(const d of ['scripts/x','modules/kernel','modules/models','modules/ops/ops','engine/db/schema','scripts/checks','knowledge/hfs'])fs.mkdirSync(path.join(base,d),{recursive:true});
  fs.writeFileSync(path.join(base,'scripts/x/emit.mjs'),"export const r={code:'brand-new-refusal'};\nexport const f='[BRAND_NEW_FINDING]';\nexport const env=process.env.NOT_A_CODE_VAR;\n");
  fs.writeFileSync(path.join(base,'knowledge/hfs/rules.yaml'),'rules: []\n');
  fs.writeFileSync(path.join(base,'modules/models/kinds.yaml'),'vocabularies:\n  blockers: []\n');
  fs.writeFileSync(path.join(base,'engine/db/schema/runtime.sql'),'-- none\n');
  fs.writeFileSync(path.join(base,'modules/kernel/allowlist.yaml'),'schema: starci/allowlist@1\nnot-codes: []\n');
  fs.writeFileSync(path.join(base,'modules/kernel/failure-codes.yaml'),'GONE_CODE:\n  title: "x"\n  title_vi: "x"\n  meaning_vi: "x"\n  causes_vi:\n    - "x"\n  nextStep_vi: "x"\n  owner: other-op:no.such.op\n  kind: blocker\n');
  const p=catalogProblems(base);
  assert.deepEqual(p.missing.map(m=>m.code).sort(),['BRAND_NEW_FINDING','brand-new-refusal']);
  assert.deepEqual(p.stale,['GONE_CODE']);
  assert.match(p.malformed[0].problems.join(';'),/names an op with no modules\/ops\/ops/);
  const r=spawnSync(process.execPath,[path.join(ROOT,'scripts/checks/check-failure-codes.mjs')],{cwd:ROOT,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});

const catalog=readCatalog();
const attemptRow=over=>({attempt_id:13,workflow_id:'wf',op_id:'scope.define',try_no:2,verdict:'fail',report_outcome:'done',end_state:'settled',settled_at:1,reported_at:1,head_sha:'abc123',next_step:null,settle_json:null,...over});
const scratch=path.join(os.tmpdir(),'starci-job-scratch','4a40','iso','.starciwork','features','collab');

test('actual admission floor, required identity, outside-group and opaque-model refusals have public owner explanations',()=>{
  const now=Date.parse('2026-10-03T08:00:00Z');
  const policy=loadRuntimes().allocation.admission,registry=loadModelRegistry(),io=fakeAdmission();
  const candidate=(id,provider,model)=>({id,provider,model,account:'default',
    modelAuthority:adapterModelAuthority(loadAdapter(provider).card),qualityFloor:registry.models[model].tier,
    eligibility:{eligible:true,mode:'operation-policy'},quota:io.quota(provider,{now}),capacity:{running:0,maxParallel:1}});
  const sonnet=candidate('sonnet','claude','claude-sonnet-5-5');
  const sol=candidate('sol','codex','gpt-6.1-sol');
  const devin=candidate('devin','devin','swe-2-max');
  const pair=c=>({provider:c.provider,model:c.model});
  const choose=(candidates,extra={})=>selectAdmission({policy,now,candidates,request:{role:'op',scopeId:'why/op',
    attemptId:'why-attempt',difficulty:'easy',allowGroup:[pair(sonnet)],...extra}});
  const cases=[
    {receipt:choose([sonnet],{difficulty:'hard',qualityFloor:'standard'}),reason:'quality-floor-invalid',code:'quality-floor-invalid'},
    {receipt:choose([sonnet],{require:pair(sol)}),reason:'required-unavailable',code:'required-unavailable'},
    {receipt:choose([sol]),reason:'no-eligible-candidate',code:'outside-allow-group'},
    {receipt:choose([devin],{allowGroup:[pair(devin)],require:{model:devin.model}}),reason:'required-unavailable',code:'required-model-unverifiable'},
  ];
  for(const {receipt,reason,code} of cases){
    assert.equal(receipt.ok,false,code);
    assert.equal(receipt.reason,reason,code);
    assert.ok([receipt.reason,...receipt.rejected.flatMap(row=>row.codes)].includes(code),'the selector actually emitted the explained code');
    const explanation=explainCode(code,catalog);
    assert.equal(explanation.known,true,code);
    assert.ok(explanation.meaning_vi?.trim(),code);
    assert.ok(explanation.nextStep_vi?.trim(),code);
    assert.notEqual(explanation.title_vi,code,'the public explanation is not a raw code fallback');
    const why=buildWhy({attempt:attemptRow({verdict:null,report_outcome:null,end_state:'requeued',settled_at:null}),
      settle:{reason:'dispatch-rejected',step:'admission',signal:code},catalog});
    assert.equal(why.state,'dispatch-rejected',code);
    assert.ok(why.codes.includes(code),code);
    assert.ok(why.cause.includes(explanation.meaning_vi),code);
    assert.equal(why.owner,explanation.owner,code);
  }
});

test('an op that claimed done but whose re-run check is red: headline, cause, disagreement, next in Vietnamese',()=>{
  const blob=json({refused:[`${scratch}: target does not exist [TARGET_MISSING]`]});
  const red=checkFacts({name:'starci-validate-strict-scope-record',phase:'verify',runner:'settler',authority:'runtime',status:'fail',exit_code:1,declared_exit_code:0,summary_json:null,stdout_sha:'s',output_sha:null},()=>blob);
  const own=checkFacts({name:'starci-validate-strict-scope-record',phase:'after',runner:'op',authority:'declared',status:'pass',exit_code:null,declared_exit_code:0,summary_json:json({evidence:'1 compiled, 0 rejected'})},()=>null);
  assert.deepEqual(red.codes,['TARGET_MISSING']);
  const why=buildWhy({attempt:attemptRow(),checks:[own,red],report:{report_id:11,report_json:json({outcome:'done',summary:'xong'})},
    settle:{claimOverruled:true,nextStep:{kind:'retry',route:'rejected-report-retries',limit:2,firing:1}},unit:{tries:2,try_budget:5},catalog});
  assert.equal(why.schema,WHY_SCHEMA);
  assert.equal(Object.keys(why)[0],'headline','headline is the first key');
  assert.match(why.headline,/^Op b\u00e1o xong nh\u01b0ng runtime ch\u1ea1y l\u1ea1i check starci-validate-strict-scope-record th\u00ec \u0111\u1ecf \(TARGET_MISSING\)/);
  assert.match(why.cause,/[Tt]h\u01b0 m\u1ee5c t\u1ea1m c\u1ee7a op.*\u0111\u00e3 b\u1ecb x\u00f3a khi op n\u1ed9p report/);
  assert.match(why.disagreement,/tho\u00e1t 0 \(xanh\).*tho\u00e1t 1/);
  assert.match(why.next,/giao l\u1ea1i op \(l\u1ea7n 3\/5/);
  assert.equal(why.state,'failed');
  assert.equal(why.owner,'op-retry');
  assert.deepEqual(why.codes,['TARGET_MISSING']);
  assert.ok(why.refs.some(r=>r.kind==='check'&&r.name==='starci-validate-strict-scope-record'));
  assert.ok(why.refs.some(r=>r.kind==='commit'&&r.sha==='abc123'));
  assert.doesNotMatch(JSON.stringify(why),/C:\\\\Users/,'no absolute temp path reaches the owner');
});

test('waiting on the owner, blocked, refused launch, dead worker, passed',()=>{
  const ask=buildWhy({attempt:attemptRow({verdict:'blocked',report_outcome:'ask'}),report:{report_id:1,report_json:json({outcome:'ask',question:{text:'Ch\u1ecdn h\u01b0\u1edbng n\u00e0o?'}})},catalog});
  assert.equal(ask.state,'awaiting-owner');
  assert.equal(ask.owner,'owner');
  assert.match(ask.headline,/h\u1ecfi owner: Ch\u1ecdn h\u01b0\u1edbng n\u00e0o\?/);
  assert.match(ask.next,/kh\u00f4ng t\u00ednh v\u00e0o s\u1ed1 l\u1ea7n th\u1eed/);

  const blocked=buildWhy({attempt:attemptRow({verdict:'blocked',report_outcome:'blocked'}),report:{report_id:2,report_json:json({outcome:'blocked',blocker:{kind:'brand-gap',detail:'LAYOUT_ANCESTOR_UNSETTLED on shell; SHELL_LOCKUP_MISSING'}})},catalog});
  assert.equal(blocked.state,'blocked');
  assert.equal(blocked.owner,'other-op:brand.decide');
  assert.deepEqual(blocked.codes,['blocker:brand-gap','LAYOUT_ANCESTOR_UNSETTLED','SHELL_LOCKUP_MISSING']);
  assert.match(blocked.headline,/^Op b\u00e1o b\u1ecb ch\u1eb7n \(thi\u1ebfu n\u1ec1n th\u01b0\u01a1ng hi\u1ec7u/);

  const refused=buildWhy({attempt:attemptRow({verdict:null,report_outcome:null,end_state:'requeued',settled_at:null}),settle:{reason:'dispatch-rejected',step:'submission',signal:'prompt-stuck',detail:'paste stayed in the input box'},catalog});
  assert.equal(refused.state,'dispatch-rejected');
  assert.match(refused.next,/Kh\u00f4ng t\u00ednh v\u00e0o s\u1ed1 l\u1ea7n th\u1eed/);
  assert.deepEqual(refused.codes,['prompt-stuck','dispatch-rejected']);
  assert.match(refused.cause,/k\u1eb9t trong \u00f4 nh\u1eadp/);

  const dead=buildWhy({attempt:attemptRow({verdict:null,report_outcome:null,end_state:'worker-dead'}),settle:{reason:'worker-failed-no-report'},catalog});
  assert.equal(dead.state,'worker-dead');

  assert.equal(buildWhy({attempt:attemptRow({verdict:'pass'}),catalog}),null,'a passed attempt needs no explanation');
  assert.equal(buildWhy({attempt:attemptRow({verdict:null,end_state:null,settled_at:null,reported_at:null,report_outcome:null}),catalog}),null,'a running attempt needs none');
  const waiting=buildWhy({attempt:attemptRow({verdict:null,end_state:null,settled_at:null,report_outcome:'done'}),catalog});
  assert.equal(waiting.state,'waiting-settle');
  assert.equal(explainCode('NO_SUCH_CODE',catalog).known,false);
});

const runtimeCheck=(name,codes,over={})=>checkFacts({name,phase:'verify',runner:'settler',authority:'runtime',status:'fail',exit_code:1,declared_exit_code:null,summary_json:json({codes,evidence:`${name} failed`}),stdout_sha:null,output_sha:null,...over},()=>null);
const catalogText=code=>`${catalog[code].title_vi}: ${catalog[code].meaning_vi}`;
const failedReport=(outcome,summary)=>({report_id:21,report_json:json({outcome,summary})});

test('a failed attempt with a red runtime check carrying a catalogued code explains itself with the catalog line',()=>{
  const red=runtimeCheck('scope-record-valid',['TARGET_MISSING']);
  assert.deepEqual(red.codes,['TARGET_MISSING']);
  const why=buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[red],report:failedReport('failed','broke the scope'),settle:{},unit:{tries:1,try_budget:5},catalog});
  assert.equal(why.state,'failed');
  assert.ok(why.cause.includes(catalogText('TARGET_MISSING')),'the cause carries the catalog title and meaning of the primary code');
  assert.ok(why.headline.includes('scope-record-valid')&&why.headline.includes('(TARGET_MISSING)')&&why.headline.includes('broke the scope'),why.headline);
  assert.equal(why.disagreement,null);
  assert.equal(why.owner,catalog.TARGET_MISSING.owner);
  assert.deepEqual(why.codes,['TARGET_MISSING']);
  assert.ok(why.refs.some(r=>r.kind==='check'&&r.name==='scope-record-valid'));
  assert.ok(why.refs.some(r=>r.kind==='report'&&r.reportId===21));
  const second=buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[red,runtimeCheck('other-check',['SHELL_LOCKUP_MISSING'])],report:failedReport('failed','x'),settle:{},catalog});
  assert.deepEqual(second.codes,['TARGET_MISSING','SHELL_LOCKUP_MISSING'],'every red runtime check contributes its codes');
});

test('a failed attempt without a catalogued code, a partial one, and a failure class are each explained by their own branch', ()=>{
  const uncatalogued=buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[runtimeCheck('c',['NOT_IN_THE_CATALOG_AT_ALL'])],report:failedReport('failed','s'),settle:{},catalog});
  assert.deepEqual(uncatalogued.codes,['NOT_IN_THE_CATALOG_AT_ALL']);
  assert.ok(uncatalogued.cause.trim().length>0);
  const partial=buildWhy({attempt:attemptRow({verdict:'partial',report_outcome:'partial'}),checks:[],report:failedReport('partial','half done'),settle:{failureClass:{class:'flaky-env',reason:'the host dropped the session'}},catalog});
  assert.equal(partial.state,'failed');
  assert.deepEqual(partial.codes,['failure-class:flaky-env']);
  assert.ok(partial.cause.includes('flaky-env')&&partial.cause.includes('the host dropped the session'),partial.cause);
  assert.ok(partial.headline.includes('half done'),partial.headline);
  const bare=buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[],report:failedReport('failed','nothing red'),settle:{},catalog});
  assert.deepEqual(bare.codes,[]);
  assert.ok(bare.cause.trim().length>0,'a failure with no red check still has a cause');
});

test('an overruled done claim names who declared red and who re-read it', ()=>{
  const declaredRed=checkFacts({name:'own-check',phase:'after',runner:'op',authority:'declared',status:'fail',exit_code:null,declared_exit_code:1,summary_json:json({evidence:'own check failed'})},()=>null);
  const why=buildWhy({attempt:attemptRow(),checks:[declaredRed],report:failedReport('done','claimed'),settle:{},catalog});
  assert.equal(why.state,'failed');
  assert.ok(why.disagreement.includes('own-check')&&why.disagreement.includes('1'),why.disagreement);
  const rerun=runtimeCheck('own-check',['TARGET_MISSING'],{declared_exit_code:1});
  const both=buildWhy({attempt:attemptRow(),checks:[declaredRed,rerun],report:failedReport('done','claimed'),settle:{claimOverruled:true},catalog});
  assert.ok(both.cause.includes(catalogText('TARGET_MISSING')),both.cause);
  assert.deepEqual(both.codes,['TARGET_MISSING']);
  assert.notEqual(both.headline,why.headline,'a re-run and a re-read read differently');
});

test('a failure caused by another workflow names the red checks and the peers and spends no try', ()=>{
  const why=buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[],report:failedReport('failed','red'),settle:{peerBlocked:{checks:['lint','types'],peers:['wf-a','wf-b']}},catalog});
  assert.equal(why.state,'failed');
  assert.equal(why.owner,'runtime-core');
  assert.ok(why.cause.includes('lint, types')&&why.cause.includes('wf-a, wf-b'),why.cause);
  const anonymous=buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[],report:failedReport('failed','red'),settle:{peerBlocked:{}},catalog});
  assert.equal(anonymous.state,'failed');
  assert.ok(anonymous.cause.trim().length>0);
  assert.notEqual(anonymous.cause,why.cause);
});

test('an attempt that ended without a report is scored failed with the worker reason', ()=>{
  const why=buildWhy({attempt:attemptRow({report_outcome:null}),checks:[],report:null,settle:{reason:'the terminal vanished'},catalog});
  assert.equal(why.state,'failed');
  assert.deepEqual(why.codes,['worker-died-no-report']);
  assert.ok(why.cause.includes('the terminal vanished'),why.cause);
  const silent=buildWhy({attempt:attemptRow({report_outcome:null}),checks:[],report:null,settle:{},catalog});
  assert.deepEqual(silent.codes,['worker-died-no-report']);
  assert.ok(silent.cause.trim().length>0);
  assert.notEqual(silent.cause,why.cause);
});

test('cancelled and requeued runs, an unknown launch effect and a bare blocker each have their own explanation', ()=>{
  const requeued=buildWhy({attempt:attemptRow({verdict:null,report_outcome:null,end_state:'requeued'}),settle:{reason:'worker-gone'},catalog});
  assert.equal(requeued.state,'requeued');
  assert.deepEqual(requeued.codes,['worker-gone']);
  const cancelled=buildWhy({attempt:attemptRow({verdict:'cancelled',report_outcome:null,end_state:'cancelled'}),settle:{reason:'workflow-archived'},catalog});
  assert.equal(cancelled.state,'cancelled');
  assert.deepEqual(cancelled.codes,['workflow-archived']);
  assert.equal(buildWhy({attempt:attemptRow({verdict:'dropped',report_outcome:null,end_state:'settled'}),settle:{},catalog}).state,'cancelled');
  const unknownEffect=buildWhy({attempt:attemptRow({verdict:null,report_outcome:null,end_state:'effect-unknown',settled_at:null}),settle:{step:'submission',signal:'prompt-stuck'},catalog});
  assert.equal(unknownEffect.state,'requeued','an op that may have run partway is reconciled, not refused');
  assert.ok(unknownEffect.cause.includes(catalogText('prompt-stuck')),unknownEffect.cause);
  const bare=buildWhy({attempt:attemptRow({verdict:'blocked',report_outcome:'blocked'}),report:{report_id:3,report_json:json({outcome:'blocked',summary:'cannot go on'})},catalog});
  assert.equal(bare.state,'blocked');
  assert.deepEqual(bare.codes,[]);
  assert.ok(bare.headline.includes('cannot go on'),bare.headline);
});

test('the recorded next step decides who acts next, and an exhausted try budget goes to the owner', ()=>{
  const failed=(settle,unit)=>buildWhy({attempt:attemptRow({report_outcome:'failed'}),checks:[],report:failedReport('failed','x'),settle,unit,catalog});
  const owners=[
    [{nextStep:{kind:'retry',route:'r',limit:3,firing:1}},'op-retry'],
    [{nextStep:{kind:'repair',route:'r',jobs:['j'],owner:{op:'brand.decide'}}},'other-op:brand.decide'],
    [{nextStep:{kind:'repair',route:'r'}},'runtime-core'],
    [{nextStep:{kind:'owner-gate',reason:'pick one'}},'owner'],
    [{nextStep:{kind:'supervisor-gate',incidentId:'inc-1',reason:'stuck'}},'supervisor'],
    [{nextStep:{kind:'peer-blocked',rootCause:{wf:'a'}}},'runtime-core'],
    [{nextStep:{kind:'root-elsewhere'}},'runtime-core'],
    [{nextStep:{kind:'deferred',reason:'final review'}},'owner'],
    [{nextStep:{kind:'none',reason:'nothing to do'}},'supervisor'],
    [{},'runtime-core'],
  ];
  for(const [settle,owner] of owners)assert.equal(failed(settle).owner,owner,JSON.stringify(settle));
  assert.ok(failed({nextStep:{kind:'owner-gate',reason:'pick one'}}).next.includes('pick one'));
  assert.ok(failed({nextStep:{kind:'supervisor-gate',incidentId:'inc-1',reason:'stuck'}}).next.includes('inc-1'));
  const used=failed({},{tries:5,try_budget:5});
  assert.equal(used.owner,'owner');
  assert.ok(used.next.includes('5'),used.next);
});

const seedWorld=(t)=>{
  const repo=tmp(t),wf='wf-why';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  t.after(()=>{try{ledger.close();}catch{}});
  ledger.transaction(db=>{
    ledger.ensureWorkflow({workflowId:wf,title:'why'});
    changeWorkflowPhase(db,{workflowId:wf,to:'running',by:'seed',reason:'fixture'});
    db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf,0,'g','# goal',json({}),Date.now());
  });
  const r=spawnSync(process.execPath,[API,'enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths','docs/x','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  return {repo,wf,ledger,jobId:JSON.parse(r.stdout).job_id};
};

test('recordWhy stores the why with the attempt; whyOf returns it; v_op_history carries it and awaiting-owner is its own ui state',t=>{
  const {wf,ledger,jobId}=seedWorld(t);
  const attemptId=ledger.transaction(db=>{
    const at=Date.now();
    for(const to of ['ready','leased'])setJobStatus(db,{jobId,to,reason:'seed',at});
    const a=startAttempt(db,{workflowId:wf,jobId,dispatchId:'d1',at});
    for(const to of ['running','reported'])setJobStatus(db,{jobId,to,reason:'seed',at});
    recordCheckRun(db,{attemptId:a.attempt_id,name:'starci-validate',phase:'after',runner:'op',status:'pass',declaredExitCode:0,createdAt:at,summary:{evidence:'ok'}});
    recordCheckRun(db,{attemptId:a.attempt_id,name:'starci-validate',phase:'verify',runner:'settler',status:'fail',exitCode:1,createdAt:at,summary:{evidence:'target does not exist [TARGET_MISSING]',codes:['TARGET_MISSING']}});
    recordJobResult(db,{jobId,result:{verdict:'fail',claimOverruled:true,nextStep:{kind:'retry',route:'r',limit:2,firing:1}},at});
    setJobStatus(db,{jobId,to:'failed',reason:'seed-settle',at});
    updateAttempt(db,{attemptId:a.attempt_id,verdict:'fail',reportOutcome:'done',settledAt:at,endState:'settled',at});
    const why=recordWhy(db,a.attempt_id,{at});
    assert.equal(why.state,'failed');
    return a.attempt_id;
  });
  const row=ledger.db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  assert.equal(JSON.parse(row.why_json).headline,whyOf(ledger,row).headline,'whyOf returns the stored value');
  assert.match(JSON.parse(row.why_json).headline,/TARGET_MISSING/);
  const hist=ledger.db.prepare('SELECT why_json, ui FROM v_op_history WHERE attempt_id=?').get(attemptId);
  assert.equal(JSON.parse(hist.why_json).state,'failed');
  assert.equal(hist.ui,'bad');
  // The same attempt with no stored why is computed on read (a ledger settled before why existed).
  ledger.transaction(db=>{db.prepare('UPDATE op_attempts SET why_json=NULL WHERE attempt_id=?').run(attemptId);});
  assert.match(whyOf(ledger,attemptId).headline,/TARGET_MISSING/);
  // An ask reads awaiting-owner, waiting, not bad.
  ledger.transaction(db=>{db.prepare("UPDATE op_attempts SET verdict='blocked', report_outcome='ask' WHERE attempt_id=?").run(attemptId);});
  const view=()=>ledger.db.prepare('SELECT ui, attempt_state, job_status FROM v_op_history WHERE attempt_id=?').get(attemptId);
  assert.equal(view().ui,'awaiting-owner');
  assert.equal(view().attempt_state,'awaiting-owner');
  assert.equal(view().job_status,'failed','job_status is a column of v_op_history');
  // A refused launch (requeued + settle reason dispatch-rejected) reads 'rejected', neutral, not 'done' or 'bad'.
  ledger.transaction(db=>{db.prepare("UPDATE op_attempts SET verdict=NULL, report_outcome=NULL, end_state='requeued', settle_json=? WHERE attempt_id=?").run(json({reason:'dispatch-rejected',step:'submission'}),attemptId);});
  assert.equal(view().ui,'rejected');
  assert.equal(view().attempt_state,'rejected');
});

test('kernelNotesOf reads the Kernel decisions (opened, closed) and proposals of a workflow from the events table',t=>{
  const {wf,ledger}=seedWorld(t);
  ledger.transaction(()=>{
    ledger.appendEvent({workflowId:wf,entityType:'decision',entityId:'dec-1',kind:'kernel-decision',payload:{hypothesis:'chia nh\u1ecf leg \u0111\u1ec3 tr\u00e1nh h\u1ebft gi\u1edd',actionKey:'split:leg',metric:'th\u1eddi gian settle'}});
    ledger.appendEvent({workflowId:wf,entityType:'decision',entityId:'dec-1',kind:'kernel-decision-result',payload:{result:'keep',observed:'settle nhanh h\u01a1n'}});
    ledger.appendEvent({workflowId:wf,entityType:'kernel-proposal',entityId:'kprop-1',kind:'kernel-proposal',payload:{id:'kprop-1',title:'C\u1ea5m khai check \u1edf th\u01b0 m\u1ee5c t\u1ea1m',evidence:'attempt 13',files:['modules/ops/ops/scope.define.yaml'],tier:'important',status:'open'}});
  });
  const notes=kernelNotesOf(ledger,wf);
  assert.deepEqual(notes.map(n=>[n.kind,n.id,n.status]),[['decision','dec-1','kept'],['proposal','kprop-1','open']]);
  assert.match(notes[0].headline,/chia nh\u1ecf leg/);
  assert.equal(notes[0].observed,'settle nhanh h\u01a1n');
  assert.equal(notes[1].tier,'important');
});
