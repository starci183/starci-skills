// Verify-op reliability (lane op-verify, 2026-09-28). Measured before: nivo app-auth uat.verify ran
// five times into an owner gate (inc-2a2228098860) - each attempt restarted dead login-local servers by
// hand, then walked the same 3 red steps at an unchanged HEAD because the defect's owner
// (impl.login.nivo-backend.session-custody) was a Work record id the router could not read, so it fell
// to failed-retries-the-same-op; nivo fe-canon review.verify (lint MEASUREMENT leg) ran four times into
// inc-46ce3d247d77 because its findings - the very measurement the chain asked for - were filed failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {classifyFailure,measurementCheckClass,resolveRootOwner,failureSignature} from '../../scripts/kernel/verify-failure.mjs';
import {validateOpReport} from '../../scripts/kernel/report-envelope.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {checkEnvironments,discoverHealth,probeHttp,envHealthMain,environmentIdsOfPaths,readRegistered} from '../../scripts/uat/env-health.mjs';
import {recordEnvelopeChecks} from '../../scripts/kernel/verbs/shared/check-evidence.mjs';

// These cases exercise the owner-flow routing of verify failures; autopilot (scripts/kernel/autopilot.mjs, owner ruling
// 2026-09-28) is on by default and re-routes an owner gate to a supervisor-gate, so this spec runs with it off -
// tests/kernel/autopilot.spec.mjs covers the autopilot flow (same as tests/kernel-verbs-shared/op-ipc.spec.mjs).
process.env.STARCI_AUTOPILOT ??= 'off';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=v=>JSON.stringify(v??null);
const KINDS=parseYaml(fs.readFileSync(path.join(ROOT,'modules','models','kinds.yaml'),'utf8'));

// The fe-canon attempt-4 checks the kernel recorded, verbatim in shape.
const CANON_CHECKS=[
  {name:'canon-scan',command:'node .claude/scripts/gates/canon-scan.mjs --root ../nivo-fe --exclude design-plans --json',exitCode:1,evidence:'status=findings; 574 findings, 185 files, 34 slices'},
  {name:'hfs-lint',command:'npx hfs lint --repo ../nivo-fe --format json',exitCode:1,evidence:'exit 1 - 67 findings'},
  {name:'lint-check',command:'npm run lint:check (root ../nivo-fe)',exitCode:1,evidence:'exit 1 - 4 @typescript-eslint findings'},
];
const UAT_ROOT_CAUSE={node:'impl.login.nivo-backend.session-custody',self:false,category:'contract-gap',
  claim:'refresh-session.handler re-checks twoFactorEnabled on restore; the FE maps requiresTwoFactor to anonymous',
  evidence:['manifest.yaml step-6/step-7 observed no'],counterCheck:'a served revisit lands without a fresh prompt',
  expectedFix:'refreshSession stops re-demanding the factor for a verified session',recheck:'node --test e2e/login-password-sign-in.spec.mjs'};

const world=(t,{legs=['uat.verify'],workspace=true}={})=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-verify-rel-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(workspace){
    const work=path.join(repo,'.starciwork');
    fs.mkdirSync(path.join(work,'features','login','impl','nivo-backend','session-custody'),{recursive:true});
    fs.writeFileSync(path.join(work,'workspace.yaml'),'schema: work/workspace@1\nid: t\nrepositories:\n  - {role: be, name: nivo-backend}\n  - {role: fe, name: nivo-fe}\n');
    fs.writeFileSync(path.join(work,'features','login','impl','nivo-backend','session-custody','index.yaml'),
      'schema: work/implementation@1\nid: impl.login.nivo-backend.session-custody\nrepository: nivo-backend\nowners:\n  - {role: refresh-session, path: be/src/auth/refresh-session}\n  - {role: sign-out, path: be/src/auth/sign-out}\n');
  }
  const wf='wf-verify-rel';
  const seed=fn=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
  const read=fn=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger.db);}finally{ledger.close();}};
  seed(ledger=>{
    ledger.ensureWorkflow({workflowId:wf,title:'verify reliability'});
    // workflows.phase moves only through workflow_transitions with a lifecycle_changes row (phase guard).
    ledger.write.changeWorkflowPhase({workflowId:wf,to:'running',by:'test',reason:'seed'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf,0,'g0','# goal',json({derivedPlan:{legs:legs.map(op=>({op}))}}),Date.now());
  });
  // api(args[], extraEnv={}): STARCI_CALLER=runtime-settler makes `check` take the supplied exits as the
  // Kernel's own observations - without it a non-runtime caller re-runs runtime-command checks and the
  // measurement legs get rerun exits, not the seeded evidence (scripts/kernel/verbs/check.mjs).
  const api=(args,extraEnv={})=>{
    const r=spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,STARCI_ENV_GATE:'off',...extraEnv}});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {...r,body};
  };
  // Runtime schema: an op job is a try of a work unit (jobs_enqueue_guard), its dispatch an op_attempts row
  // (dispatch guard: the job leased, the workflow running), its status moves along job_transitions.
  const dispatchAttempt=(ledger,jobId)=>{
    for(const to of ['ready','leased'])ledger.write.setJobStatus({jobId,to,reason:'seed'});
    const attempt=ledger.write.startAttempt({workflowId:wf,jobId,dispatchId:`ctx_${jobId}`});
    return attempt;
  };
  const afterDispatch={running:['running'],answering:['running','answering'],reported:['running','reported'],
    deciding:['running','reported','deciding'],effect_unknown:['running','effect_unknown'],
    succeeded:['running','reported','succeeded'],failed:['running','failed'],leased:[],ready:[]};
  const job=(jobId,op,{status='running',records=[],paths=['docs/'],params=null,extra={}}={})=>seed(ledger=>{
    ledger.write.createUnit({workflowId:wf,unitId:`u-${jobId}`,opId:op,subjectKey:jobId,goalRevision:0});
    ledger.enqueueJob({jobId,workflowId:wf,unitId:`u-${jobId}`,opId:op,kind:'op',payload:{opId:op,records,owned_paths:paths,...(params?{params}:{}),...extra}});
    if(status==='queued')return;
    if(status==='ready'){ledger.write.setJobStatus({jobId,to:'ready',reason:'seed'});return;}
    dispatchAttempt(ledger,jobId);
    for(const to of afterDispatch[status]??[])ledger.write.setJobStatus({jobId,to,reason:'seed'});
  });
  // A report is attempt-bound (H10) and its contract keys on the attempt: a queued job (a route's fresh
  // retry) is dispatched first so the report has an attempt to land on.
  const report=(jobId,outcome='failed',extra={})=>seed(ledger=>{
    let attempt=ledger.db.prepare('SELECT * FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
    if(!attempt){
      attempt=dispatchAttempt(ledger,jobId);
      ledger.write.setJobStatus({jobId,to:'running',reason:'seed'});
    }
    if(!ledger.db.prepare('SELECT 1 FROM contracts WHERE attempt_id=?').get(attempt.attempt_id))
      ledger.write.writeContract({attemptId:attempt.attempt_id,markdown:'# contract',context:{}});
    ledger.write.fileReport({attemptId:attempt.attempt_id,outcome,
      report:{schema:'starci/op-report@1',outcome,summary:`${outcome} on purpose`,...extra}});
  });
  // jobs carries no result_json column: the result is the newest attempt's settle_json, else the latest
  // 'job-result' event (engine/db/ledger.mjs jobResult) - projected here as `result`.
  const row=jobId=>read(db=>{const r=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);if(!r)return r;
    const settled=db.prepare('SELECT settle_json FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId)?.settle_json
      ??db.prepare("SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND kind='job-result' ORDER BY seq DESC LIMIT 1").get(jobId)?.payload_json;
    return {...r,payload:JSON.parse(r.payload_json),result:JSON.parse(settled??'null')};});
  return {repo,wf,api,job,report,row,read,seed};
};

/* ------------------------------------------------------------------ classification */

test('failure classes: measurement findings, tool errors, environment, product owner, transient, deterministic',()=>{
  // fe-canon a4: a measurement leg whose checkers ran is findings, never a failure.
  assert.equal(classifyFailure({op:'review.verify',report:{outcome:'failed',checks:CANON_CHECKS},measurement:true}).class,'findings');
  assert.equal(measurementCheckClass(CANON_CHECKS[0]),'findings','canon-scan exit 1 is findings');
  assert.equal(measurementCheckClass({...CANON_CHECKS[0],exitCode:3}),'error','canon-scan exit 3: a machine could not run');
  assert.equal(measurementCheckClass(CANON_CHECKS[1]),'findings','a whole-repository hfs lint with findings is measured');
  assert.equal(measurementCheckClass({name:'gate',command:'node .claude/scripts/gates/gate.mjs --root ../nivo-fe',exitCode:1}),'findings','gate exit 1: new findings');
  assert.equal(measurementCheckClass({name:'gate',command:'node .claude/scripts/gates/gate.mjs --root ../nivo-fe',exitCode:2}),'error','gate exit 2: a tool could not run');
  assert.equal(classifyFailure({op:'review.verify',report:{outcome:'failed',checks:[{...CANON_CHECKS[0],exitCode:3}]},measurement:true}).class,'tool');
  // app-auth a1: the UAT names its owner as a Work record.
  assert.equal(classifyFailure({op:'uat.verify',report:{outcome:'failed',rootCause:UAT_ROOT_CAUSE,checks:[{name:'uat-spec-run',command:'node --test x',exitCode:1}]}}).class,'product');
  assert.equal(classifyFailure({op:'uat.verify',report:{outcome:'failed',checks:[{name:'env-health',command:'env-health check',exitCode:3}]}}).class,'environment');
  assert.equal(classifyFailure({op:'uat.verify',report:{outcome:'blocked',blocker:{kind:'environment',detail:'3068 down'}}}).class,'environment');
  assert.equal(classifyFailure({op:'uat.verify',report:{outcome:'failed',failureClass:'transient'}}).class,'transient','a verify may call a genuine flake transient');
  assert.equal(classifyFailure({op:'docs.author',report:{outcome:'failed'}}).class,'transient');
  const red={outcome:'failed',head:'abc1234',checks:[{name:'build',command:'npm run build',exitCode:1}]};
  assert.equal(classifyFailure({op:'docs.author',report:red}).class,'transient','first failure of a build op: no evidence it is deterministic');
  assert.equal(classifyFailure({op:'docs.author',report:red,prior:{report:red}}).class,'deterministic','the same red at the same HEAD twice');
  assert.equal(failureSignature({head:'x',checks:[]}),'','nothing to compare');
  // The envelope takes the new fields.
  assert.equal(validateOpReport({outcome:'failed',summary:'s',failureClass:'product',rootCause:{...UAT_ROOT_CAUSE,op:'backend.implement',files:['be/src/auth/refresh-session']}}).ok,true);
  assert.equal(validateOpReport({outcome:'failed',summary:'s',failureClass:'flaky'}).ok,false);
  assert.equal(validateOpReport({outcome:'done',summary:'s',failureClass:'product'}).ok,false);
});

test('a Work record id resolves to the build op of its repository role, with the record owner paths',t=>{
  const w=world(t);
  const owner=resolveRootOwner({repo:w.repo,rootCause:UAT_ROOT_CAUSE,kinds:KINDS});
  assert.equal(owner.op,'backend.implement');
  assert.equal(owner.record,'.starciwork/features/login/impl/nivo-backend/session-custody');
  assert.deepEqual(owner.ownedPaths,['be/src/auth/refresh-session','be/src/auth/sign-out','.starciwork/features/login/impl/nivo-backend/session-custody']);
  assert.equal(resolveRootOwner({repo:w.repo,rootCause:{...UAT_ROOT_CAUSE,op:'interface.implement',files:['fe/apps/app/src/session.tsx']},kinds:KINDS}).op,'interface.implement','an explicit rootCause.op wins');
  assert.equal(resolveRootOwner({repo:w.repo,rootCause:{...UAT_ROOT_CAUSE,node:'impl.login.nowhere.x'},kinds:KINDS}),null,'an unresolvable record names no owner');
});

/* ------------------------------------------------------------------ routing */

test('a red UAT naming a backend record repairs that record with a fresh backend.implement job, then walks again behind it - never the same walk again',t=>{
  const w=world(t,{legs:['uat.verify']});
  w.job('uat1','uat.verify',{paths:['.starciwork/features/login/uat/password-sign-in','be/src/auth/sign-in','fe/apps/app/src/auth'],extra:{repository:'fe'}});
  w.report('uat1','failed',{head:'f09c641',rootCause:UAT_ROOT_CAUSE,checks:[{name:'uat-spec-run',command:'node --test e2e/login.spec.mjs',exitCode:1,evidence:'6/9 pass'}]});
  const r=w.api(['settle','--job','uat1','--verdict','fail']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const next=r.body.nextStep;
  assert.deepEqual([next.kind,next.route,next.class],['repair','uat-red-repairs-the-build','product']);
  assert.equal(next.owner.op,'backend.implement');
  const [repairId,rerunId]=next.jobs;
  const repair=w.row(repairId),rerun=w.row(rerunId);
  assert.equal(repair.op_id,'backend.implement');
  assert.equal(repair.status,'queued');
  assert.deepEqual(repair.payload.owned_paths,['be/src/auth/refresh-session','be/src/auth/sign-out','.starciwork/features/login/impl/nivo-backend/session-custody']);
  assert.deepEqual(repair.payload.records,['.starciwork/features/login/impl/nivo-backend/session-custody']);
  assert.equal(repair.payload.repository,undefined,'a backend repair is not placed in the fe checkout the UAT ran from');
  assert.equal(repair.payload.repairFor.rootCause.claim,UAT_ROOT_CAUSE.claim);
  assert.equal(rerun.op_id,'uat.verify');
  assert.deepEqual(rerun.payload.after,[repairId],'the walk waits for the repair');
  assert.equal(w.row('uat1').result.failureClass.class,'product');
  assert.equal(w.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='failure-routed' AND json_extract(payload_json,'$.route')='failed-retries-the-same-op'").get().n),0);
});

test('a red UAT whose owner resolves to nothing stops for the owner with its class, not three blind re-walks',t=>{
  const w=world(t,{legs:['uat.verify'],workspace:false});
  w.job('uat1','uat.verify',{paths:['.starciwork/features/login/uat/password-sign-in']});
  w.report('uat1','failed',{head:'f09c641',checks:[{name:'uat-spec-run',command:'node --test e2e/login.spec.mjs',exitCode:1}]});
  const next=w.api(['settle','--job','uat1','--verdict','fail']).body.nextStep;
  assert.deepEqual([next.kind,next.route,next.class],['owner-gate','failed-without-a-repairable-owner-needs-the-user','product']);
  assert.match(next.reason,/failure class product/);
});

test('an environment failure re-runs behind the pre-step; a tool error retries; only transient takes the same-op retry',t=>{
  const w=world(t,{legs:['uat.verify','docs.author']});
  w.job('u','uat.verify',{paths:['.starciwork/features/login/uat/x']});
  w.report('u','failed',{checks:[{name:'env-health',command:'node scripts/uat/env-health.mjs check',exitCode:3}]});
  let next=w.api(['settle','--job','u','--verdict','fail']).body.nextStep;
  assert.deepEqual([next.kind,next.route,next.class],['retry','failed-environment-runs-again-behind-the-pre-step','environment']);
  w.job('d','docs.author');w.report('d','failed',{head:'aaaaaaa',checks:[{name:'docs-lint',command:'npm run docs:lint',exitCode:1}]});
  next=w.api(['settle','--job','d','--verdict','fail']).body.nextStep;
  assert.deepEqual([next.kind,next.route,next.class],['retry','failed-retries-the-same-op','transient']);
  const again=next.jobs[0];
  w.report(again,'failed',{head:'aaaaaaa',checks:[{name:'docs-lint',command:'npm run docs:lint',exitCode:1}]});
  // The Kernel's independent checks live on check_runs of each attempt (H8): both tries recorded the
  // identical red, so the signature compare sees the same failure twice.
  w.seed(l=>{for(const jobId of ['d',again]){
    const attempt=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
    recordEnvelopeChecks(l.db,{attemptId:attempt.attempt_id,runner:'kernel',
      checks:[{name:'docs-lint',command:'npm run docs:lint',exitCode:1}]});
  }});
  next=w.api(['settle','--job',again,'--verdict','fail']).body.nextStep;
  assert.deepEqual([next.kind,next.class],['owner-gate','deterministic'],'the identical red at the same HEAD is not retried blind');
});

/* ------------------------------------------------------------------ measurement leg */

test('a lint MEASUREMENT leg with findings settles pass (even filed failed), and a fail settle on findings alone is refused',t=>{
  const w=world(t,{legs:['review.verify','test.author','code.refactor'],workspace:false});
  w.job('lint','review.verify',{params:{mode:'lint'},paths:['.starciwork/evidence/wf.lint']});
  w.report('lint','failed',{checks:CANON_CHECKS,rootCause:{node:'code.refactor',self:false,category:'pending-upstream-repair',claim:'canon debt awaits the refactor legs',evidence:['574 findings']}});
  const checked=w.api(['check','--job','lint','--checks',json({checks:CANON_CHECKS})],{STARCI_CALLER:'runtime-settler'});
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
  assert.deepEqual([checked.body.checkEvidence.passed,checked.body.checkEvidence.failed,checked.body.checkEvidence.green],[3,0,true],'the measured findings count as a completed measurement');
  const refused=w.api(['settle','--job','lint','--verdict','fail']);
  assert.notEqual(refused.status,0);
  assert.match(refused.stdout+refused.stderr,/measurement-findings-are-the-result/);
  const passed=w.api(['settle','--job','lint','--verdict','pass']);
  assert.equal(passed.status,0,passed.stderr||passed.stdout);
  const row=w.row('lint');
  assert.equal(row.status,'succeeded');
  assert.deepEqual([row.result.measurement.readAs,row.result.checkEvidence.green],['done',true]);
});

test('a measurement whose checker did not run fails as a tool error and retries; the gate leg after a build repairs the owner of its findings',t=>{
  const w=world(t,{legs:['review.verify','code.refactor','review.verify'],workspace:false});
  w.job('lint','review.verify',{params:{mode:'lint'},paths:['.starciwork/evidence/wf.lint']});
  const broken=[{...CANON_CHECKS[0],exitCode:3,evidence:'a selected machine could not run'}];
  w.report('lint','failed',{checks:broken});
  w.api(['check','--job','lint','--checks',json({checks:broken})],{STARCI_CALLER:'runtime-settler'});
  let next=w.api(['settle','--job','lint','--verdict','fail']).body.nextStep;
  assert.deepEqual([next.kind,next.route,next.class],['retry','failed-tool-error-retries','tool']);
  // The final gate: a code.refactor settled before it, so findings are findings of the build.
  w.job('refactor','code.refactor',{status:'succeeded',paths:['apps/app/src/a']});
  w.seed(l=>l.db.prepare("UPDATE jobs SET updated_at=1 WHERE job_id='refactor'").run());
  w.job('gate','review.verify',{params:{mode:'lint'},paths:['.starciwork/evidence/wf.lint-final']});
  w.report('gate','failed',{checks:[CANON_CHECKS[0]],rootCause:{node:'code.refactor',self:false,category:'canon',claim:'slice a still has 3 findings',evidence:['canon-scan apps/app/src/a'],files:['apps/app/src/a']}});
  next=w.api(['settle','--job','gate','--verdict','fail']).body.nextStep;
  assert.deepEqual([next.kind,next.route,next.class],['repair','review-findings-repair-the-build','findings']);
  assert.equal(w.row(next.jobs[0]).op_id,'code.refactor');
  // The repair is the next try of the refactor's own unit: a done unit is reopened for it (units.mjs H5),
  // so retry_of is empty and the lineage is the shared unit_id.
  assert.equal(w.row(next.jobs[0]).unit_id,w.row('refactor').unit_id,'the refactor that owns the path is reopened');
  assert.equal(w.row(next.jobs[0]).try_no,2);
});

/* ------------------------------------------------------------------ environment pre-step */

const listen=(t,handler)=>new Promise(resolve=>{const server=http.createServer(handler);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));t.after(()=>server.close());});

test('env-health: ready, probe-drift with a discovered health endpoint, down, hung - and a hung foreign listener is a port conflict',async t=>{
  const apiPort=await listen(t,(req,res)=>{
    if(req.method==='POST'&&req.url==='/graphql'){res.writeHead(200,{'content-type':'application/json'});res.end('{"data":{"__typename":"Query"}}');return;}
    res.writeHead(404);res.end();
  });
  const webPort=await listen(t,(req,res)=>{res.writeHead(200);res.end('ok');});
  const hung=net.createServer(()=>{/* accepts, never answers */});
  const hungPort=await new Promise(r=>hung.listen(0,'127.0.0.1',()=>r(hung.address().port)));
  t.after(()=>hung.close());
  const deadPort=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});

  assert.equal((await probeHttp(`http://127.0.0.1:${deadPort}/`,{timeoutMs:2000})).state,'down');
  assert.equal((await probeHttp(`http://127.0.0.1:${hungPort}/`,{timeoutMs:800})).state,'hung');
  assert.deepEqual(await discoverHealth(`http://127.0.0.1:${apiPort}`,{timeoutMs:2000}),{method:'POST',url:`http://127.0.0.1:${apiPort}/graphql`,status:200});

  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-env-health-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const envDir=path.join(repo,'.starciwork','_resources','environments','login-local');
  fs.mkdirSync(envDir,{recursive:true});
  fs.writeFileSync(path.join(envDir,'resource.yaml'),[
    'schema: work/resource@1','id: environment.t.login-local','kind: environment','owner: t','revision: spec',
    'target:','  origins:',`    web: http://127.0.0.1:${webPort}`,`    api: http://127.0.0.1:${apiPort}`,`    worker: http://127.0.0.1:${deadPort}`,`    socket: http://127.0.0.1:${hungPort}`,
    'configuration:','  ports:',`    web: ${webPort}`,`    api: ${apiPort}`,`    worker: ${deadPort}`,`    socket: ${hungPort}`,
    'probes:',
    `  - {id: web-ready, method: http-get, target: 'http://127.0.0.1:${webPort}/en/authentication', expect: 200}`,
    `  - {id: api-ready, method: http-get, target: 'http://127.0.0.1:${apiPort}/health/live', expect: 200}`,
    `  - {id: worker-ready, method: http-get, target: 'http://127.0.0.1:${deadPort}/health', expect: 200}`,
    `  - {id: socket-ready, method: http-get, target: 'http://127.0.0.1:${hungPort}/health', expect: 200}`,
    'allowedEffects: [spec]',''].join('\n'));
  const flow=path.join(repo,'.starciwork','features','login','uat','password-sign-in');
  fs.mkdirSync(flow,{recursive:true});
  fs.writeFileSync(path.join(flow,'index.yaml'),'schema: work/uat-flow@1\nid: uat.login.password-sign-in\nrefs:\n  - environment.t.login-local\n');
  assert.deepEqual(environmentIdsOfPaths(repo,['.starciwork/features/login/uat/password-sign-in']),['environment.t.login-local']);

  const result=await checkEnvironments({repo,paths:['.starciwork/features/login/uat/password-sign-in'],restart:true,probeTimeoutMs:1500,readyTimeoutMs:2000,
    env:{...process.env,STARCI_ENV_SERVERS_DIR:path.join(repo,'servers')}});
  const by=Object.fromEntries(result.environments[0].services.map(s=>[s.service,s]));
  assert.equal(by.web.state,'ready');
  assert.equal(by.api.state,'probe-drift','the API is up; /health/live is a stale declaration');
  assert.equal(by.api.ready,true);
  assert.equal(by.api.discovered.url,`http://127.0.0.1:${apiPort}/graphql`);
  assert.equal(by.worker.state,'down');
  assert.match(by.worker.remedy,/env-health\.mjs serve --env environment\.t\.login-local --service worker/);
  assert.equal(by.socket.state,'port-conflict','a hung listener that is not a server of this workspace is never killed');
  assert.equal(by.socket.listener.pid,process.pid);
  assert.deepEqual([result.ready,result.class,result.hardBlock],[false,'environment',true]);
});

test('env-health serve registers a server so the next pre-step restarts it itself',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-env-serve-'));
  const pids=new Set();
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-env-servers'),{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  t.after(async()=>{
    try{pids.add(readRegistered('environment.t.local','web',env).pid);}catch{}
    for(const pid of pids){try{process.kill(pid);}catch{}}
    await new Promise(r=>setTimeout(r,500));
    try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:100});}catch{/* a Windows handle may linger */}
  });
  const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  const script=path.join(dir,'server.mjs');
  fs.writeFileSync(script,`import http from 'node:http';http.createServer((q,s)=>{s.writeHead(200);s.end('ok');}).listen(${port},'127.0.0.1');`);
  const env={...process.env,STARCI_TEST_MACHINE_FILE:path.join(dir,'machine.sqlite')};
  const out=[];const write=s=>out.push(s);
  const code=await envHealthMain(['serve','--env','environment.t.local','--service','web','--cwd',dir,'--url',`http://127.0.0.1:${port}/`,'--json','--','node',script],{write,env});
  const served=JSON.parse(out.pop());
  pids.add(served.pid);
  assert.equal(code,0,JSON.stringify(served));
  assert.equal(served.ready,true);
  const reg=readRegistered('environment.t.local','web',env);
  assert.deepEqual([reg.pid,reg.command,reg.state],[served.pid,['node',script],'ready']);
  // The server dies; the next pre-step with --restart brings it back from the registry.
  process.kill(served.pid);
  await new Promise(r=>setTimeout(r,500));
  const repo=path.join(dir,'repo');
  const envDir=path.join(repo,'.starciwork','_resources','environments','local');
  fs.mkdirSync(envDir,{recursive:true});
  fs.writeFileSync(path.join(envDir,'resource.yaml'),`schema: work/resource@1\nid: environment.t.local\nkind: environment\ntarget:\n  origins:\n    web: http://127.0.0.1:${port}\nconfiguration:\n  ports:\n    web: ${port}\nprobes:\n  - {id: web-ready, method: http-get, target: 'http://127.0.0.1:${port}/', expect: 200}\n`);
  const result=await checkEnvironments({repo,ids:['environment.t.local'],restart:true,probeTimeoutMs:1500,readyTimeoutMs:20000,env});
  const web=result.environments[0].services[0];
  assert.equal(web.state,'restarted',JSON.stringify(web));
  assert.equal(result.ready,true);
  const again=readRegistered('environment.t.local','web',env);
  assert.equal(again.state,'ready');
  assert.notEqual(again.pid,served.pid,'the registry names the restarted server');
});

test('api dispatch runs the environment pre-step for a walk: a foreign hung port refuses environment-not-ready before any host call; a ready stack rides the packet',async t=>{
  const {FAKE_ORCA}=await import('../helpers/fake-orca.mjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-env-gate-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const log=path.join(root,'calls.jsonl');
  // The spawned api resolves machine.sqlite/projects under ITS env's LOCALAPPDATA + the test registry;
  // ledgerFileFor({env}) seeds the file that resolution lands on.
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),LOCALAPPDATA:path.join(root,'localappdata'),
    STARCI_PROJECTS_ROOT:path.join(root,'projects'),STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),STARCI_ENV_GATE:'',STARCI_ENV_PROBE_TIMEOUT_MS:'1500'};
  const hung=net.createServer(()=>{});
  const hungPort=await new Promise(r=>hung.listen(0,'127.0.0.1',()=>r(hung.address().port)));
  t.after(()=>hung.close());
  // The ready server lives in its own process: spawnSync below blocks this one's event loop.
  const webPort=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  const {spawn}=await import('node:child_process');
  const web=spawn(process.execPath,['-e',`require('http').createServer((q,s)=>{s.writeHead(200);s.end('ok')}).listen(${webPort},'127.0.0.1')`],{stdio:'ignore',windowsHide:true});
  t.after(()=>{try{web.kill();}catch{}});
  for(let i=0;i<50&&(await probeHttp(`http://127.0.0.1:${webPort}/`,{timeoutMs:500})).state!=='answered';i+=1)await new Promise(r=>setTimeout(r,100));
  const writeEnv=port=>{
    const dir=path.join(repo,'.starciwork','_resources','environments','login-local');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'resource.yaml'),`schema: work/resource@1\nid: environment.t.login-local\nkind: environment\ntarget:\n  origins:\n    web: http://127.0.0.1:${port}\nconfiguration:\n  ports:\n    web: ${port}\nprobes:\n  - {id: web-ready, method: http-get, target: 'http://127.0.0.1:${port}/', expect: 200}\n`);
  };
  const flow=path.join(repo,'.starciwork','features','login','uat','password-sign-in');fs.mkdirSync(flow,{recursive:true});
  fs.writeFileSync(path.join(flow,'index.yaml'),'schema: work/uat-flow@1\nid: uat.login.password-sign-in\nrefs:\n  - environment.t.login-local\n');
  const ledger=openLedger({file:ledgerFileFor(repo,{env})});
  try{
    ledger.ensureWorkflow({workflowId:'wf-env',title:'wf-env',ledgerMode:'durable',sourceRoots:[repo]});
    ledger.write.changeWorkflowPhase({workflowId:'wf-env',to:'running',by:'test',reason:'seed'});
    ledger.write.createUnit({workflowId:'wf-env',unitId:'u-job-uat',opId:'uat.verify',subjectKey:'job-uat',goalRevision:1});
    ledger.enqueueJob({jobId:'job-uat',workflowId:'wf-env',unitId:'u-job-uat',opId:'uat.verify',kind:'op',payload:{opId:'uat.verify',records:['.starciwork/features/login/uat/password-sign-in'],owned_paths:['.starciwork/features/login/uat/password-sign-in'],model:'devin-agent'}});
  }
  finally{ledger.close();}
  const dispatch=()=>spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job','job-uat','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:300000,env});

  writeEnv(hungPort);
  const refused=dispatch();
  assert.equal(refused.status,1,refused.stdout+refused.stderr);
  const out=JSON.parse(refused.stdout);
  assert.equal(out.reason,'environment-not-ready');
  assert.equal(out.services[0].state,'port-conflict');
  assert.match(out.incident,/^inc-/);
  assert.equal(fs.existsSync(log)?fs.readFileSync(log,'utf8').trim():'','','nothing reached the host');
  const inspect=inspectLedger({file:ledgerFileFor(repo,{env})});
  try{
    assert.equal(inspect.db.prepare("SELECT status FROM jobs WHERE job_id='job-uat'").get().status,'queued','no attempt is spent on the environment');
    assert.match(inspect.db.prepare('SELECT last_progress FROM incidents WHERE incident_id=?').get(out.incident).last_progress,/^\[environment\] environment\.t\.login-local\/web port-conflict/);
  }finally{inspect.close();}

  writeEnv(webPort);
  const dry=dispatch();
  assert.equal(dry.status,0,dry.stdout+dry.stderr);
  const packet=JSON.parse(dry.stdout).packet;
  assert.equal(packet.context.environment.ready,true);
  assert.deepEqual(packet.context.environment.services.map(s=>[s.env,s.service,s.state]),[['environment.t.login-local','web','ready']]);
});
