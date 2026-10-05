// Sonar is an enforced gate for the code-writing ops (knowledge/sonar-gate.yaml, scripts/kernel/sonar-settle.mjs): the runtime
// reads the sonar.json an op attached, records the runtime check sonar-gate, and refuses a pass unless it is green. A Sonar
// that could not run is the explicit sonar-unavailable why with a Supervisor-owned incident - never a silent pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileReport,inspectLedger,ledgerFileFor,openLedger,writeContract,recordCheckRun} from '../../engine/db/ledger.mjs';
import {readProperties} from '../../scripts/lib/properties.mjs';
import {coverageScopeOf,judgeCoverage,judgeDashboard,judgeSummary,loadSonarGate,serverConditions,thresholdsOf} from '../../scripts/gates/sonar-gate.mjs';
import {enforcesOp,judgeJob,readSonarSummary,recordSonarJudgment,SONAR_CHECK,SONAR_INCIDENT_TAG} from '../../scripts/kernel/sonar-settle.mjs';
import {independentChecksOf} from '../../scripts/kernel/verbs/shared/check-evidence.mjs';
import {buildWhy,checkFacts,loadCatalog} from '../../scripts/kernel/why.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {proofRepo} from '../helpers/sonar-scan.mjs';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const gate=loadSonarGate();
const json=v=>JSON.stringify(v??null);
const tmp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-sonar-settle-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return dir;};
const put=(repo,rel,body)=>{const abs=path.join(repo,rel);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);return rel;};

const scan=(over={})=>({schema:'starci/sonar-local-scan@3',at:'2026-09-29T10:00:00.000Z',scope:'slice',outcome:'pass',gate:thresholdsOf(gate),slice:{verdict:'pass',failures:[]},...over});

test('the gate is one file: the thresholds, the enforced ops and the server conditions come from it', () => {
  assert.equal(gate.gate.name,'starci-quality');
  assert.deepEqual([...gate.enforcedOps].sort(),['backend.implement','code.refactor','interface.implement']);
  assert.deepEqual(serverConditions(gate),[
    {metric:'new_coverage',op:'LT',error:'100'},
    {metric:'new_duplicated_lines_density',op:'GT',error:'3'},
    {metric:'new_security_hotspots_reviewed',op:'LT',error:'100'},
    {metric:'new_blocker_violations',op:'GT',error:'0'},
    {metric:'new_critical_violations',op:'GT',error:'0'},
    {metric:'coverage',op:'LT',error:'100'},
    {metric:'violations',op:'GT',error:'0'},
    {metric:'security_hotspots_reviewed',op:'LT',error:'100'},
    {metric:'duplicated_lines_density',op:'GT',error:'3'},
  ]);
  assert.deepEqual(gate.overall.issues.engines,['starci-hfs','eslint','stylelint']);
  assert.deepEqual(thresholdsOf(gate),{name:'starci-quality',ignoreBelowChangedLines:20,duplicationMaxPercent:3,blockingSeverities:['BLOCKER','CRITICAL'],blockingIssuesMax:0,unreviewedHotspotsMax:0,coverageMinPercent:100});
  for(const op of gate.enforcedOps){
    const manifest=fs.readFileSync(path.join(ROOT,'modules','ops','ops',`${op}.yaml`),'utf8');
    assert.match(manifest,/sonar-local\.mjs scan/,`${op} tells its worker to run sonar-local`);
    assert.match(manifest,/sonar-unavailable/,`${op} tells its worker what an unavailable Sonar means`);
  }
});

test('the gate judges coverage per service: one service below 100 fails, a non-service file is not part of the measure', () => {
  // The scope is the one the managed sonar-project.properties renders (starci app sync: the complement of the measured scope derived from the slot manifest).
  const scope=coverageScopeOf(readProperties(path.join(ROOT,'examples','ecommerce-app','sonar-project.properties')));
  assert.ok(scope.exclusions.includes('fe/**')&&scope.exclusions.includes('be/**/*.resolver.ts'));
  const minPercent=thresholdsOf(gate).coverageMinPercent;
  const files=[
    {path:'be/src/features/orders/order.service.ts',coverage:'100.0'},
    {path:'be/src/features/orders/payment.service.ts',coverage:'99.4'},
    {path:'be/src/features/orders/order.resolver.ts',coverage:'0.0'},
    {path:'be/src/features/orders/orders.module.ts',coverage:'12.0'},
    {path:'be/src/features/orders/order.service.spec.ts',coverage:null},
    {path:'fe/apps/web/src/lib/cart.service.ts',coverage:'0.0'},
  ];
  const red=judgeCoverage(files,{scope,minPercent});
  assert.deepEqual(red.files.map(f=>[f.path,f.coverage,f.ok]),[
    ['be/src/features/orders/order.service.ts',100,true],
    ['be/src/features/orders/payment.service.ts',99.4,false],
  ],'a resolver, a module, a spec and anything under fe/ are not coverage targets');
  assert.deepEqual(red.failures,['coverage of be/src/features/orders/payment.service.ts 99.4% < 100%']);
  // The project average can round to 100 while one service is below: the per-file verdict still fails.
  const dashboard=judgeDashboard({measures:{bugs:'0',code_smells:'0',vulnerabilities:'0',security_hotspots:'0',duplicated_lines_density:'0',coverage:'100.0'},files,scope},gate);
  assert.equal(dashboard.verdict,'fail');
  assert.deepEqual(dashboard.failures,['coverage of be/src/features/orders/payment.service.ts 99.4% < 100%']);
  // The same project with every service at 100 passes, whatever the resolver, the module and fe/ show.
  const green=files.map(f=>f.path.endsWith('payment.service.ts')?{...f,coverage:'100.0'}:f);
  assert.deepEqual(judgeCoverage(green,{scope,minPercent}).failures,[]);
  assert.equal(judgeDashboard({measures:{bugs:'0',code_smells:'0',vulnerabilities:'0',security_hotspots:'0',duplicated_lines_density:'0',coverage:'100.0'},files:green,scope},gate).verdict,'pass');
  // A service the lcov does not name is never a pass.
  assert.deepEqual(judgeCoverage([{path:'be/src/a.service.ts',coverage:null}],{scope,minPercent}).failures,["be/src/a.service.ts has no coverage measure (the be unit run's lcov is not imported or does not name it)"]);
  // A slice whose scan failed on coverage is a red settle like any other failing condition.
  const settle=judgeSummary(scan({outcome:'fail',slice:{verdict:'fail',failures:red.failures}}),gate);
  assert.deepEqual([settle.status,settle.code,settle.findings],['red','sonar-gate-red',red.failures]);
});

test('owner mode (specs.unit off): coverage is not measured and the judgment says so, and the claim stands only while the owner switch is off', () => {
  const ownerMode={specs:{unit:false},coverage:'not-measured',note:'owner mode specs.unit=false (config.yaml specs): the slice wrote and ran no unit test, so its coverage is NOT MEASURED'};
  const summary=scan({ownerMode,slice:{verdict:'pass',failures:[],coverage:{applied:false,status:'not-measured',files:[],failures:[]}}});
  const off=judgeSummary(summary,gate,{specs:{unit:false,e2e:false}});
  assert.deepEqual([off.status,off.coverage],['pass','not-measured'],'never a plain green: coverage reads not measured');
  assert.match(off.note,/owner mode specs\.unit=false[\s\S]*NOT MEASURED/);
  // An op cannot claim owner mode: with the owner's unit tests on (or the switches unknown) the claim is refused.
  for(const specs of [{unit:true,e2e:false},null]){
    const claimed=judgeSummary(summary,gate,{specs});
    assert.deepEqual([claimed.status,claimed.code],['missing','sonar-proof-missing']);
    assert.match(claimed.detail,/claims owner mode/);
  }
  // A plain pass carries no owner-mode note.
  assert.equal(judgeSummary(scan(),gate,{specs:{unit:false}}).coverage,undefined);
});

test('judgeSummary: pass, red, unavailable, refused and missing are told apart - never a silent pass', () => {
  assert.equal(judgeSummary(scan(),gate).status,'pass');
  const red=judgeSummary(scan({outcome:'fail',slice:{failures:['1 open BLOCKER/CRITICAL issue(s) on changed lines','duplication on the slice\'s changed lines 12% > 3%']}}),gate);
  assert.deepEqual([red.status,red.code],['red','sonar-gate-red']);
  assert.deepEqual(red.findings.length,2);
  const down=judgeSummary(scan({outcome:'blocked',unavailable:true,reason:'SonarQube at http://localhost:9010 is not reachable'}),gate);
  assert.deepEqual([down.status,down.code],['unavailable','sonar-unavailable']);
  assert.match(down.detail,/not reachable/);
  const refused=judgeSummary(scan({outcome:'refused',code:'SLICE_BASE_UNKNOWN',reason:'the base is not a revision'}),gate);
  assert.deepEqual([refused.status,refused.code],['refused','sonar-scan-refused']);
  assert.equal(judgeSummary(null,gate).code,'sonar-proof-missing');
  assert.equal(judgeSummary({schema:'something/else@1'},gate).status,'missing');
  assert.equal(judgeSummary(scan({outcome:'submitted'}),gate).status,'missing','a submission without --wait proves nothing');
  assert.equal(judgeSummary(scan({scope:'project'}),gate).status,'missing','the whole-project verdict is not the slice\'s');
  assert.equal(judgeSummary(scan({outcome:'refused',code:'SLICE_EMPTY',reason:'no file'}),gate).status,'pass','nothing changed, nothing new to fail');
  const disabled=judgeSummary(scan({outcome:'disabled',reason:'declaration disables Sonar'}),gate);
  assert.equal(disabled.status,'pass');
  assert.match(disabled.note,/disabled by the repository's declaration/);
});

test('readSonarSummary takes the newest sonar-local scan among a job\'s files and ignores other JSON', t => {
  const dir=tmp(t);
  put(dir,'a/sonar.json',json(scan({at:'2026-09-29T09:00:00.000Z',outcome:'fail'})));
  put(dir,'b/sonar.json',json(scan({at:'2026-09-29T11:00:00.000Z'})));
  put(dir,'c/sonar-notes.json',json({schema:'other@1'}));
  put(dir,'d/report.json',json(scan({at:'2030-01-01T00:00:00.000Z',outcome:'fail'})));
  const files=['a/sonar.json','b/sonar.json','c/sonar-notes.json','d/report.json'].map(rel=>({abs:path.join(dir,rel),name:`attachments/${rel}`}));
  const found=readSonarSummary(files);
  assert.equal(found.summary.outcome,'pass');
  assert.equal(found.file,'attachments/b/sonar.json');
  assert.equal(readSonarSummary([{abs:path.join(dir,'d/report.json')}]),null,'a file whose name does not mention sonar is not read');
  assert.equal(judgeJob({op:'docs.author',files}),null,'an op outside the gate is not judged');
  assert.equal(enforcesOp('backend.implement',gate),true);
  assert.equal(judgeJob({op:'code.refactor',files:[]}).judged.code,'sonar-proof-missing');
});

const seedAttempt=(t)=>{
  const repo=tmp(t);
  const ledger=openLedger({file:ledgerFileFor(repo)});
  t.after(()=>{try{ledger.close();}catch{}});
  seedWorkflow(ledger,{id:'wf-sonar',state:{phase:'running',job:'impl'},jobs:[{jobId:'op-backend.implement-1',opId:'backend.implement',dispatchId:'ctx-1',status:'running',payload:{opId:'backend.implement'}}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-backend.implement-1').attempt_id;
  return {repo,ledger,attemptId};
};
const judgment=(summary,file='attachments/checks/sonar.json')=>({judged:judgeSummary(summary,gate),file,summary});
const record=(ledger,attemptId,summary,now)=>recordSonarJudgment(ledger,{workflowId:'wf-sonar',jobId:'op-backend.implement-1',opId:'backend.implement',attemptId,judgment:judgment(summary),now});

test('a red judgment is a failed runtime check whose why speaks Vietnamese; a later green one replaces it', t => {
  const {ledger,attemptId}=seedAttempt(t);
  const red=record(ledger,attemptId,scan({outcome:'fail',slice:{failures:['duplication on the slice\'s changed lines 12% > 3%']}}),1000);
  assert.deepEqual([red.green,red.code],[false,'sonar-gate-red']);
  const checks=independentChecksOf(ledger.db,{attemptId}).checks;
  assert.deepEqual(checks.map(c=>[c.name,c.exitCode,c.authority]),[[SONAR_CHECK,1,'runtime']],'an exit 1 counts as failed, so the attempt is never green');
  const row=ledger.db.prepare('SELECT * FROM check_runs WHERE attempt_id=? AND name=?').get(attemptId,SONAR_CHECK);
  const facts=checkFacts(row,()=>null);
  assert.deepEqual(facts.codes,['sonar-gate-red']);
  const catalog=loadCatalog();
  const why=buildWhy({attempt:{attempt_id:attemptId,workflow_id:'wf-sonar',op_id:'backend.implement',try_no:1,verdict:'fail',report_outcome:'done',end_state:'settled',settled_at:1,reported_at:1},
    checks:[facts],report:{report_id:1,report_json:json({outcome:'done',summary:'xong'})},settle:{claimOverruled:true},unit:null,catalog});
  assert.ok(why.codes.includes('sonar-gate-red'));
  assert.match(`${why.headline} ${why.cause}`,/C\u1ed5ng ch\u1ea5t l\u01b0\u1ee3ng Sonar \u0111\u1ecf/);
  const green=record(ledger,attemptId,scan(),2000);
  assert.equal(green.green,true);
  assert.equal(independentChecksOf(ledger.db,{attemptId}).checks[0].exitCode,0,'the latest run decides');
});

test('an unavailable Sonar records the explicit why, tells the Supervisor once and never passes; a later pass resolves it', t => {
  const {ledger,attemptId}=seedAttempt(t);
  const down=scan({outcome:'blocked',unavailable:true,reason:'SonarQube at http://localhost:9010 is not reachable (ECONNREFUSED); container starci-sonarqube is exited'});
  const first=record(ledger,attemptId,down,1000);
  assert.deepEqual([first.green,first.code,first.status],[false,'sonar-unavailable','unavailable']);
  assert.ok(first.incidentId,'the Supervisor is told');
  const incident=ledger.db.prepare('SELECT * FROM incidents WHERE incident_id=?').get(first.incidentId);
  assert.deepEqual([incident.kind,incident.owner,incident.status,incident.op_id],['runtime-defect','supervisor','open','backend.implement']);
  assert.ok(incident.last_progress.startsWith(SONAR_INCIDENT_TAG));
  assert.match(incident.detail,/cannot settle done/);
  const event=ledger.db.prepare("SELECT payload_json FROM events WHERE kind='sonar-unavailable'").get();
  assert.equal(JSON.parse(event.payload_json).why,'sonar-unavailable');
  const again=record(ledger,attemptId,down,2000);
  assert.equal(again.incidentId,first.incidentId,'one open incident per workflow, not one per settle');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM incidents WHERE status='open'").get().n,1);
  const row=ledger.db.prepare('SELECT * FROM check_runs WHERE attempt_id=? AND name=? ORDER BY run_seq DESC').get(attemptId,SONAR_CHECK);
  assert.equal(row.status,'fail','a red check, not an "unavailable" that summarizeCheckEvidence would count as neither');
  assert.deepEqual(checkFacts(row,()=>null).codes,['sonar-unavailable']);
  assert.match(loadCatalog()['sonar-unavailable'].meaning_vi,/Supervisor/);
  record(ledger,attemptId,scan(),3000);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM incidents WHERE status='open'").get().n,0,'a judged slice resolves the notice');
});

// ---- starci kernel settle, end to end ---------------------------------------------------------------------------------------

const checkout=t=>{
  const root=tmp(t),main=path.join(root,'main'),repo=path.join(root,'workflow'),branch='wf-sonar';
  fs.mkdirSync(main);
  const mainGit=proofRepo(t,main);
  put(main,'src/a.ts','export const a = 1;\n');
  mainGit('add','src/a.ts');mainGit('commit','--quiet','-m','source baseline');
  mainGit('worktree','add','-q','-b',branch,repo,'main');
  const git=(...args)=>mainGit('-C',repo,...args);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
    STARCI_PROJECTS_ROOT:path.join(root,'projects'),LOCALAPPDATA:path.join(root,'localappdata'),STARCI_ARTIFACT_ROOT:path.join(root,'artifacts'),
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json')};
  return {repo,git,env,branch};
};
const seedImplement=({repo,git,env,branch},{jobId,wf,summary,admittedAt,op='backend.implement'})=>{
  registerWorkflowWorktree({env},{workflowId:wf,orcaWorktreeId:`sonar-${wf}::workflow`,path:repo,branch});
  const files=['src/a.ts'];
  if(summary){put(repo,'src/checks/sonar.json',json(summary));files.push('src/checks/sonar.json');git('add','.');git('commit','--quiet','-m','slice');}
  const ledger=openLedger({file:ledgerFileFor(repo,{env})});
  try{
    seedWorkflow(ledger,{id:wf,state:{phase:'running',job:'impl'},
      jobs:[{jobId,opId:op,dispatchId:`ctx-${jobId}`,terminalHandle:`term-${jobId}`,status:'running',
        payload:{opId:op,owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`}}}]});
    const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.transaction(db=>{
      writeContract(db,{attemptId,markdown:'# contract',context:{worktree:repo},createdAt:admittedAt});
      fileReport(db,{attemptId,outcome:'done',createdAt:Date.now(),
        report:{schema:'starci/op-report@1',outcome:'done',summary:'implemented',files,head:git('rev-parse','HEAD')}});
      for(const check of [{name:'owned-paths-committed',command:'git show'},{name:'owned-paths-clean',command:'git status'},{name:'head-ancestor',command:'git merge-base'}])
        recordCheckRun(db,{attemptId,name:check.name,phase:'verify',runner:'kernel',authority:'runtime',status:'pass',exitCode:0,command:check.command});
    });
  }finally{ledger.close();}
  return jobId;
};
const settle=({repo,env},jobId,verdict='pass')=>{const r=spawnSync(process.execPath,[API,'settle','--repo',repo,'--job',jobId,'--verdict',verdict,'--json','--sync-tail'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});let body=null;try{body=JSON.parse(r.stdout);}catch{}return {r,body};};
const read=({repo,env},fn)=>{const l=inspectLedger({file:ledgerFileFor(repo,{env})});try{return fn(l.db);}finally{l.close();}};

test('starci kernel settle refuses a code-writing pass whose sonar.json is red, unavailable or absent, and records green Sonar without inventing complete mechanism proof', t => {
  const at=Date.now() - 1000;
  const cases=[
    ['red',scan({outcome:'fail',slice:{failures:['1 open BLOCKER/CRITICAL issue(s) on changed lines']}}),'sonar-gate-red'],
    ['down',scan({outcome:'blocked',unavailable:true,reason:'SonarQube is not reachable'}),'sonar-unavailable'],
    ['none',null,'sonar-proof-missing'],
  ];
  for(const [label,summary,code] of cases){
    const fx=checkout(t);
    const jobId=seedImplement(fx,{jobId:`op-backend.implement-${label}`,wf:`wf-${label}`,summary,admittedAt:at});
    const refused=settle(fx,jobId);
    assert.equal(refused.r.status,1,refused.r.stdout||refused.r.stderr);
    assert.ok(refused.body,`stdout: ${refused.r.stdout}
stderr: ${refused.r.stderr}`);
    assert.equal(refused.body.reason,code);
    assert.equal(read(fx,db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status),'running','a refused settle changes no job');
    const check=read(fx,db=>db.prepare("SELECT status FROM check_runs WHERE name='sonar-gate' ORDER BY check_id DESC").get());
    assert.equal(check.status,'fail',`${label}: the refusal is on the attempt as a runtime check`);
    if(label==='down'){
      assert.ok(refused.body.incidentId);
      assert.equal(read(fx,db=>db.prepare("SELECT owner FROM incidents WHERE last_progress LIKE '[runtime-sonar-unavailable]%'").get().owner),'supervisor');
    }
    // a fail verdict is the kernel's way out: it settles, and the why carries the code
    if(label==='red'){
      const failed=settle(fx,jobId,'fail');
      assert.equal(failed.r.status,0,failed.r.stderr||failed.r.stdout);
      const why=read(fx,db=>JSON.parse(db.prepare('SELECT why_json FROM op_attempts WHERE job_id=?').get(jobId).why_json));
      assert.ok(why.codes.includes('sonar-gate-red'),JSON.stringify(why));
    }
  }
  const fx=checkout(t);
  const jobId=seedImplement(fx,{jobId:'op-backend.implement-green',wf:'wf-green',summary:scan(),admittedAt:at});
  const ok=settle(fx,jobId);
  assert.equal(ok.r.status,1,ok.r.stderr||ok.r.stdout);
  assert.equal(ok.body?.reason,'op-gate-proof-missing','green Sonar alone has no captured gate baseline');
  assert.equal(read(fx,db=>db.prepare("SELECT status FROM check_runs WHERE name='sonar-gate' ORDER BY check_id DESC").get().status),'pass');
  assert.equal(read(fx,db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status),'running','other missing current proof retains the attempt');
});

test('an early admission still requires Sonar; the actual op scope excludes documentation', t => {
  const fx=checkout(t);
  const old=seedImplement(fx,{jobId:'op-backend.implement-old',wf:'wf-old',summary:null,admittedAt:1});
  const settled=settle(fx,old);
  assert.equal(settled.r.status,1,settled.r.stderr||settled.r.stdout);
  assert.equal(settled.body?.reason,'sonar-proof-missing');
  const other=checkout(t);
  const outside=seedImplement(other,{jobId:'op-docs.author-1',wf:'wf-docs',summary:null,admittedAt:Date.now() - 1000,op:'docs.author'});
  assert.notEqual(settle(other,outside).body?.reason,'sonar-proof-missing');
});
