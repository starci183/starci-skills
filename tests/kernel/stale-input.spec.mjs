import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {fakeDevinQuotaEnv} from '../helpers/fake-devin-quota.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {writeGreenProofs, proofRepo} from '../helpers/sonar-scan.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';
import {INPUT_DIGEST_SCHEMA,baselineWorkInputs,createDigester,inputKindOf,lawTokens,opInputPaths,recordInputs,workInputPaths} from '../../scripts/kernel/input-digests.mjs';
import {resolveOpContract} from '../../scripts/lib/op-shared.mjs';
import {usageOfWorkflow} from '../../scripts/kernel/usage-report.mjs';
import {EXAMPLE_CATALOG_FILE,EXAMPLES_ROOT,exampleSourcePaths,loadExampleCatalog} from '../../scripts/lib/example-refs.mjs';

// Stale input: `starci kernel dispatch` records the digests of the inputs an op reads
// (contracts.context_json.inputs) by kind. A Source-law input (knowledge/**,
// modules/schemas/**) edited after admission is advisory `sourceDrift`, never
// stale; a product Work record the job read (payload.records under .starciwork),
// changed after it settled from outside its workflow, is `staleInput`. The
// runtime root is where cli.mjs lives, so each spec runs a private copy of the
// runtime whose knowledge/ it can edit, beside a product repo whose .starciwork/
// it can edit.

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const OP='code.refactor';
const WORKFLOW='wf-stale-input';
const RULES='knowledge/patterns/fe/index.yaml';
const FR_DIR='.starciwork/features/task/fr/list';
const require=createRequire(import.meta.url);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
if(process.env.STARCI_TEST_TEMP_DIR){
  const scratch=path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch');
  after(()=>fs.rmSync(scratch,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
}

// The scenarios own disjoint runtime copies and ledgers. Let two of them overlap so the
// many real CLI entries do not pay their process-start cost strictly in series, while
// keeping the test's subprocess load bounded.
let activeScenarios=0;
const scenarioWaiters=[];
const runScenario=async fn=>{
  if(activeScenarios>=2)await new Promise(resolve=>scenarioWaiters.push(resolve));
  activeScenarios++;
  try{return await fn();}
  finally{activeScenarios--;scenarioWaiters.shift()?.();}
};
const selectiveRun=[...process.execArgv,...process.argv].some(arg=>arg==='--test-name-pattern'||arg.startsWith('--test-name-pattern='));
const scenario=(title,fn)=>{
  // Mutation proofs select one catching test; leave those runs lazy so Node does
  // not start work belonging to tests it will skip.
  if(selectiveRun){test(title,t=>runScenario(()=>fn(t)));return;}
  const cleanups=[];
  // Start independent work while the serial test runner is still registering the
  // file, then attribute its result to the unchanged test title when Node reaches it.
  const execution=runScenario(async()=>{
    try{await fn({after:cleanup=>cleanups.push(cleanup)});}
    finally{for(const cleanup of cleanups.reverse())await cleanup();}
  }).then(()=>({error:null}),error=>({error}));
  test(title,async()=>{const result=await execution;if(result.error)throw result.error;});
};

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stale-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const skill=path.join(root,'skill'),main=path.join(root,'main'),repo=path.join(root,'repo');
  for(const dir of ['scripts','engine','modules',path.join('packages','cli')])fs.cpSync(path.join(ROOT,dir),path.join(skill,dir),{recursive:true});
  fs.cpSync(path.join(ROOT,'packages','grammar','scripts'),path.join(skill,'packages','grammar','scripts'),{recursive:true});
  for(const file of ['CONTEXT.md','package.json'])fs.copyFileSync(path.join(ROOT,file),path.join(skill,file));
  // Strict selected READs use the current architecture and pinned lint documentation.
  for(const rel of ['docs/architecture.md','docs/code-pattern-enforcement.md','packages/eslint/fe/README.md','packages/eslint/be/README.md']){
    const target=path.join(skill,rel);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(ROOT,rel),target);
  }
  // The real READ producer validates the whole catalog and its public source/compiler/test pointers.
  const catalog=loadExampleCatalog(ROOT);
  const exampleReads=[EXAMPLE_CATALOG_FILE,...new Set(catalog.examples.map(row=>`${EXAMPLES_ROOT}/${row.path}/hfs.json`)),...exampleSourcePaths(ROOT)];
  for(const rel of exampleReads){
    const target=path.join(skill,rel);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(ROOT,rel),target);
  }
  fs.mkdirSync(path.join(skill,'knowledge'),{recursive:true});
  fs.copyFileSync(path.join(ROOT,'knowledge','sonar-gate.yaml'),path.join(skill,'knowledge','sonar-gate.yaml')); // the Sonar gate a code-writing settle reads
  fs.cpSync(path.join(ROOT,'knowledge'),path.join(skill,'knowledge'),{recursive:true}); // current canonical READ inputs, owned by this private runtime
  fs.mkdirSync(main,{recursive:true});
  const mainGit=proofRepo(t,main),branch=`wf-${WORKFLOW}`;
  mainGit('worktree','add','-q','-b',branch,repo,'main');
  const git=(...args)=>mainGit('-C',repo,...args);
  fs.writeFileSync(path.join(skill,'config.yaml'),fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8')
    .replace(/^launchTrust:.*$/m,`launchTrust: ${JSON.stringify({profile:'automatic',approvedBy:'owner',approvalRef:'private stale-input fixture adoption',roots:[main]})}`));
  const trustHome=path.join(root,'trust-home');fs.mkdirSync(trustHome);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,...fakeDevinQuotaEnv(t,path.join(root,'appdata')),
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:skill,STARCI_AGENT_TRUST_HOME:trustHome,STARCI_LOCAL_ROOT:path.join(root,'localappdata'),STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
    STARCI_PROJECTS_ROOT:path.join(root,'projects'),STARCI_TEST_TEMP_DIR:path.join(root,'tmp'),STARCI_GIT_MEMO_DIR:path.join(root,'git-memo')};
  registerWorkflowWorktree({env},{workflowId:WORKFLOW,orcaWorktreeId:'stale-input::workflow',path:repo,branch});
  const api=path.join(skill,'scripts','kernel','cli.mjs');
  const run=(...args)=>new Promise(resolve=>{
    const child=spawn(process.execPath,[api,...args,'--repo',repo,'--json'],{cwd:skill,windowsHide:true,env});
    let stdout='',stderr='',timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;child.kill();},180000);
    child.stdout.on('data',chunk=>{stdout+=chunk;});
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',error=>{stderr+=String(error?.stack??error);});
    child.on('close',(status,signal)=>{clearTimeout(timeout);resolve({status,signal,stdout,stderr,...(timedOut?{error:new Error('ETIMEDOUT')}: {})});});
  });
  const write=(rel,text)=>{const file=path.join(skill,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  const work=(rel,text)=>{const file=path.join(repo,'.starciwork',rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  return {root,skill,repo,git,env,api,run,write,work};
};
const json=r=>{try{return JSON.parse(r.stdout);}catch{const at=r.stdout.indexOf('{'),end=r.stdout.indexOf('\n}');return at<0||end<0?null:JSON.parse(r.stdout.slice(at,end+2));}};
// A write grant names a directory that must exist in the target repository (grant-parent-missing): seeding a job under
// withLedger creates the directories its owned paths name.
let grantRepo=null;
const grantDirsOf=payload=>{if(!grantRepo)return;for(const owned of payload?.owned_paths??[]){const rel=String(owned).replace(/\/+$/,'');if(rel&&!rel.startsWith('.starciwork'))fs.mkdirSync(path.join(grantRepo,path.posix.extname(rel)?path.posix.dirname(rel):rel),{recursive:true});}};
const withLedger=(fx,fn)=>{grantRepo=fx.repo;const ledger=openLedger({file:ledgerFileFor(fx.repo,{env:fx.env})});try{
  if(!ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(WORKFLOW))seedWorkflow(ledger,{id:WORKFLOW});
  return fn(ledger);
}finally{ledger.close();}};
const enqueueSeed=(ledger,args)=>{
  grantDirsOf(args.payload);
  const unitId=args.unitId??args.jobId;
  if(!ledger.db.prepare('SELECT 1 FROM work_units WHERE workflow_id=? AND unit_id=?').get(args.workflowId,unitId))
    ledger.write.createUnit({workflowId:args.workflowId,unitId,opId:args.opId,subjectKey:unitId,goalRevision:1});
  return ledger.enqueueJob({...args,unitId,tryNo:1});
};
const inspect=(fx,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(fx.repo,{env:fx.env})});try{return fn(ledger.db);}finally{ledger.close();}};
const status=async fx=>{const r=await fx.run('status','--workflow',WORKFLOW);assert.equal(r.status,0,r.stderr||r.stdout);return json(r);};
const survey=async fx=>{const r=await fx.run('survey','--workflow',WORKFLOW);assert.equal(r.status,0,r.stderr||r.stdout);return json(r);};

/** A running operation with no exact terminal keeps the frontier `engaged` and not actionable by itself. */
const holdEngaged=(ledger,jobId='job-engaged',opId='docs.author')=>{
  ledger.write.createUnit({workflowId:WORKFLOW,unitId:jobId,opId,subjectKey:jobId,goalRevision:1});
  enqueueSeed(ledger,{jobId,workflowId:WORKFLOW,unitId:jobId,opId,kind:'op',payload:{opId,owned_paths:['docs/engaged/']}});
  for(const phase of ['ready','leased','running'])ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(phase,jobId);
};
/** A settled op row plus its contract, written the way a ledger already holds them. */
const settledRow=(ledger,{jobId,opId=OP,attempt,cut=null,inputs,status='succeeded',owned=null,admittedAt=null})=>{
  const at=admittedAt??Date.now();
  seedWorkflow(ledger,{id:WORKFLOW,jobs:[{jobId,opId,status,createdAt:at,updatedAt:at,
    dispatchId:`dispatch-${jobId}`,payload:{opId,owned_paths:owned??[`src/${jobId}/`],...(cut?{cut}:{})}}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(attemptId,WORKFLOW,jobId,'# contract',JSON.stringify({packet:{op:opId},worktree:'.',...(inputs?{inputs}:{})}),at);
};

test('law tokens: knowledge, schema paths and the named data-owned files, never other runtime paths; Work inputs are the .starciwork records',()=>{
  assert.deepEqual(lawTokens('modules/schemas/stacks-layout.yaml + modules/models/registry.yaml'),['modules/schemas/stacks-layout.yaml']);
  assert.deepEqual(workInputPaths({records:['.starciwork/shell/index.yaml','.starciwork/features/x/fr/','src/a.ts','.starciwork/kernel-evidence/w/x.json','.starciwork/kernel-approvals/w/x.json','.starciwork/features/<f>/**','.starciwork/../x']}),
    ['.starciwork/shell/index.yaml','.starciwork/features/x/fr']);
  assert.deepEqual([{path:'knowledge/a.yaml',kind:'source'},{path:'.starciwork/index.yaml',kind:'work'},{path:'docs/x.md'},{path:'knowledge/a.yaml',kind:'work'}].map(inputKindOf),['source','work',null,'work'],'an entry is classified by its own kind');
  assert.deepEqual(lawTokens('CONTEXT.md (fixed stack) + knowledge/churn-baseline.yaml (shapes common and nest)'),['knowledge/churn-baseline.yaml']);
  assert.deepEqual(lawTokens('scripts/hfs/architecture/*.mjs + modules/models/code-patterns.yaml + docs/architecture.md'),['modules/models/code-patterns.yaml']);
  assert.deepEqual(lawTokens('knowledge/patterns/be/* + knowledge/../CONTEXT.md'),['knowledge/patterns/be/*']);
  const brief={reads:[{id:'grammar',path:'knowledge/grammars/<family>/DNA.yaml'}]};
  assert.deepEqual(opInputPaths(brief,{params:{family:'carbon'}}),['knowledge/grammars/carbon/DNA.yaml']);
  const selected={...brief,params:{mode:{type:'enum',enum:['select','lint'],default:'select',setBy:'kernel'}},policy:{executionModes:{lint:{reads:[{id:'reference',path:'knowledge/architecture-rules.yaml'}]}}}};
  assert.deepEqual(opInputPaths(selected,{params:{family:'carbon'}}),['knowledge/grammars/carbon/DNA.yaml'],'planning keeps common reads without a selected mode');
  assert.equal(resolveOpContract(selected,{params:{family:'carbon'}}).ok,false,'execution still requires one concrete declared mode');
  assert.deepEqual(opInputPaths(selected,{params:{mode:'lint',family:'carbon'}}),['knowledge/grammars/carbon/DNA.yaml','knowledge/architecture-rules.yaml'],'selected Source-law reads retain distinct common IDs and bind concrete params');
});

test('digests: a file is sha256 of its bytes, a directory or glob the digest of its sorted file digests, a missing path absent',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-digest-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'knowledge','ui','composition'),{recursive:true});
  fs.writeFileSync(path.join(dir,'knowledge','ui','index.yaml'),'a');
  fs.writeFileSync(path.join(dir,'knowledge','ui','composition','index.yaml'),'b');
  const digest=createDigester(dir);
  assert.equal(digest('knowledge/ui/index.yaml'),sha('a'));
  assert.equal(digest('knowledge/missing.yaml'),'absent');
  const set=sha(`knowledge/ui/composition/index.yaml\0${sha('b')}\nknowledge/ui/index.yaml\0${sha('a')}\n`);
  assert.equal(digest('knowledge/ui'),set);
  assert.equal(digest('knowledge/ui/**/index.yaml'),set,'**/ matches zero or more directories');
  assert.equal(digest('knowledge/ui/{composition}/*.yaml'),sha(`knowledge/ui/composition/index.yaml\0${sha('b')}\n`));
  assert.equal(digest('knowledge/none/*'),'absent');
});

scenario('dispatch records Source and Work digests by kind; settle re-baselines Work; a knowledge edit is advisory sourceDrift, never stale',async t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  fx.write('knowledge/patterns/be/index.yaml','be: v1\n');
  fx.work('features/task/fr/list/index.yaml','fr: v1\n');
  fx.work('features/task/fr/list/evidence/run.txt','noise\n');
  withLedger(fx,ledger=>{
    enqueueSeed(ledger,{jobId:'job-refactor',workflowId:WORKFLOW,opId:OP,kind:'op',payload:{opId:OP,owned_paths:['src/refactor/'],model:'devin-agent',records:[FR_DIR,'src/refactor/a.ts']}});
  });
  const dispatched=await fx.run('dispatch','--job','job-refactor','--model','devin-agent','--spawn');
  assert.equal(dispatched.status,0,dispatched.stderr||dispatched.stdout);
  const readContext=inspect(fx,db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE job_id=?').get('job-refactor').context_json).packet.context);
  for(const rel of ['docs/architecture.md','docs/code-pattern-enforcement.md']){
    const absolute=path.resolve(fx.skill,rel);
    assert.deepEqual(readContext.mandatoryReads.filter(read=>read===rel),[rel],`${rel} is mandatory exactly once`);
    assert.deepEqual(readContext.readRefs.filter(read=>read.path===rel).map(({rootKind,root,absolute,sha256})=>({rootKind,root,absolute,sha256})),
      [{rootKind:'source',root:fx.skill,absolute,sha256:sha(fs.readFileSync(absolute))}],`${rel} binds the actual private Source bytes exactly once`);
  }
  const inputsOf=()=>inspect(fx,db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=?').get(WORKFLOW).context_json).inputs);
  const inputs=inputsOf();
  assert.equal(inputs.schema,INPUT_DIGEST_SCHEMA);
  const recorded=Object.fromEntries(inputs.digests.map(d=>[d.path,d]));
  assert.deepEqual(Object.keys(recorded).sort(),[FR_DIR,RULES,'knowledge/op-gate.yaml','knowledge/patterns/be/index.yaml','modules/models/code-patterns.yaml'].sort(),
    'a record outside .starciwork (the job\'s own source) is not a Work input');
  assert.deepEqual(Object.values(recorded).filter(d=>d.kind==='work').map(d=>d.path),[FR_DIR]);
  assert.equal(recorded[RULES].kind,'source');
  assert.equal(recorded[RULES].digest,sha('rules: v1\n'));
  assert.equal(recorded[FR_DIR].digest,sha(`${FR_DIR}/index.yaml\0${sha('fr: v1\n')}\n`),'a record directory counts its record files, never evidence/');

  const report=inspect(fx,db=>path.join(db.prepare('SELECT scratch_dir FROM op_attempts WHERE job_id=?').get('job-refactor').scratch_dir,'report.json'));
  const binding=inspect(fx,db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=?').get(WORKFLOW).context_json).packet.context.gate_binding);
  const proofs=path.join(path.dirname(report),'proofs');
  writeGreenProofs(proofs,{root:fx.repo,binding,baseRoot:fx.skill});
  fs.writeFileSync(report,JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:'refactor done',head:fx.git('rev-parse','HEAD'),files:[],checks:[{name:'self',command:'true',exitCode:0}]}));
  const reported=await fx.run('report','--job','job-refactor','--report',report,'--attach',proofs);
  assert.equal(reported.status,0,reported.stderr||reported.stdout);
  const checked=await fx.run('record-checks','--job','job-refactor','--checks',JSON.stringify({checks:[{name:'validator',exitCode:0}]}));
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
  withLedger(fx,ledger=>{
    const attempt=ledger.db.prepare('SELECT attempt_id,span_id FROM op_attempts WHERE job_id=?').get('job-refactor');
    ledger.db.prepare(`INSERT INTO check_runs(workflow_id,attempt_id,job_id,op_id,span_id,name,phase,runner,authority,exit_code,status,created_at)
      VALUES(?,?,?,?,?,?,'verify','settler','runtime',0,'pass',?)`)
      .run(WORKFLOW,attempt.attempt_id,'job-refactor',OP,attempt.span_id,'validator',Date.now());
  });
  const settled=await fx.run('settle','--job','job-refactor','--verdict','pass');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  const work=inputsOf().digests.find(d=>d.path===FR_DIR);
  assert.equal(work.settled.digest,recorded[FR_DIR].digest);
  assert.deepEqual(Object.keys(work.settled.files),[`${FR_DIR}/index.yaml`]);
  withLedger(fx,ledger=>holdEngaged(ledger));

  const quiet=await status(fx);
  assert.deepEqual(quiet.staleInput,[],'unchanged inputs are not stale');
  assert.deepEqual(quiet.sourceDrift,[]);
  assert.equal(quiet.frontier.sourceDrift,undefined,'the advisory key is present only when there is drift');
  assert.equal(quiet.frontier.actionable,false,'precondition: nothing else makes the frontier actionable');

  fx.write(RULES,'rules: v2\n');
  const edited=await status(fx);
  assert.deepEqual(edited.staleInput,[],'a Source knowledge edit never makes a settled job stale');
  assert.deepEqual(edited.frontier.staleOperations,[]);
  assert.equal(edited.frontier.actionable,false,'nor actionable');
  assert.equal(edited.frontier.reason,quiet.frontier.reason);
  assert.deepEqual(edited.sourceDrift.map(s=>[s.jobId,s.path,s.kind,s.recorded,s.current]),[['job-refactor',RULES,'source',sha('rules: v1\n'),sha('rules: v2\n')]]);
  assert.deepEqual(edited.frontier.sourceDrift,{advisory:true,jobs:1,paths:[{path:RULES,jobs:1}]});
  assert.deepEqual((await survey(fx)).sourceDrift,edited.sourceDrift);
  assert.deepEqual((await survey(fx)).staleInput,[]);

  fx.work('features/task/fr/list/evidence/run.txt','more noise\n');
  assert.deepEqual((await status(fx)).staleInput,[],'evidence beside a record is not the record');
  fx.work('features/task/fr/list/index.yaml','fr: v2 (owner edit)\n');
  const loud=await status(fx);
  assert.deepEqual(loud.staleInput.map(s=>[s.jobId,s.path,s.kind,s.changed]),[['job-refactor',FR_DIR,'work',[`${FR_DIR}/index.yaml`]]],'a product record the job read, changed from outside its workflow, is stale');
  assert.deepEqual(loud.frontier.staleOperations,[{jobId:'job-refactor',op:OP,attempt:1,paths:[FR_DIR]}]);
  assert.equal(loud.frontier.actionable,true);
  assert.match(loud.frontier.reason,/job-refactor.*product records/);

  withLedger(fx,ledger=>enqueueSeed(ledger,{jobId:'job-refactor-redo',workflowId:WORKFLOW,opId:OP,attempt:2,kind:'op',payload:{opId:OP,owned_paths:['src/refactor/']}}));
  const redo=await status(fx);
  assert.deepEqual(redo.staleInput,[],'a newer attempt of the same op supersedes the stale one');
  assert.deepEqual(redo.sourceDrift,[],'and its drift');
});

scenario('Work: the job\'s own writes and its workflow\'s later legs are progress, not staleness; another workflow\'s write is advisory peerDrift',async t=>{
  const fx=fixture(t);
  const REC='.starciwork/features/task/ui/list';
  fx.work('features/task/ui/list/index.yaml','ui: v1\n');
  withLedger(fx,ledger=>{
    const inputs=baselineWorkInputs(recordInputs(fx.skill,[],undefined,{repo:fx.repo,workPaths:[REC]}),fx.repo,{now:Date.now()-60000});
    // Admitted after every registered interface.draw follow-up change: this spec is about drift, not a contract redo.
    settledRow(ledger,{jobId:'job-draw',opId:'interface.draw',attempt:1,inputs,owned:[REC],admittedAt:Date.parse('2099-01-01T00:00:00Z')});
    enqueueSeed(ledger,{jobId:'job-audit',workflowId:WORKFLOW,opId:'interface.audit',kind:'op',payload:{opId:'interface.audit',owned_paths:[`${REC}/index.yaml`]}});
    seedWorkflow(ledger,{id:'wf-peer'});
    enqueueSeed(ledger,{jobId:'job-peer',workflowId:'wf-peer',opId:'interface.implement',kind:'op',payload:{opId:'interface.implement',owned_paths:[REC]}});
    holdEngaged(ledger);
  });
  fx.work('features/task/ui/list/index.yaml','ui: v2 by the draw itself or its audit\n');
  assert.deepEqual((await status(fx)).staleInput,[],'a write inside the job\'s own or a later same-workflow leg\'s owned paths is planned progress');
  withLedger(fx,ledger=>{
    ledger.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id='job-draw'").run(JSON.stringify({opId:'interface.draw',owned_paths:['src/elsewhere/']}));
    ledger.db.prepare("UPDATE jobs SET status='cancelled',updated_at=0 WHERE job_id='job-audit'").run();
  });
  // The record's one owner is wf-peer (its job owns it); its change is
  // judged against the revision the draw read and is advisory until wf-peer declares it breaking.
  const drift=await status(fx);
  assert.deepEqual(drift.staleInput,[],'a peer workflow owning the record rewrote it: never staleInput, never a redo');
  assert.deepEqual(drift.peerDrift.map(p=>[p.jobId,p.files.map(f=>[f.file,f.owner,f.ownerBy])]),[['job-draw',[[`${REC}/index.yaml`,'wf-peer','cut']]]]);
  assert.deepEqual(drift.frontier.peerDrift,{advisory:true,jobs:1,records:[{file:`${REC}/index.yaml`,owner:'wf-peer',ownerBy:'cut',writers:[],jobs:1,foreignWrite:false}]});
  assert.equal(drift.frontier.actionable,false,'advisory drift never wakes the Kernel');
});

scenario('a contract without recorded digests never reports stale input and leaves actionable as it was',async t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  withLedger(fx,ledger=>{
    settledRow(ledger,{jobId:'job-digest-free',attempt:1});
    settledRow(ledger,{jobId:'job-digest-null',opId:'docs.author',attempt:1});
    ledger.db.prepare("UPDATE contracts SET context_json=NULL WHERE job_id='job-digest-null'").run();
    holdEngaged(ledger);
  });
  const before=await status(fx);
  fx.write(RULES,'rules: v2\n');
  const after=await status(fx);
  assert.deepEqual(after.staleInput,[]);
  assert.equal(after.staleInputError,undefined);
  assert.equal(after.frontier.actionable,before.frontier.actionable);
  assert.equal(after.frontier.actionable,false);
  assert.equal(after.frontier.reason,before.frontier.reason);
  assert.deepEqual((await survey(fx)).staleInput,[]);
});

scenario('a finished workflow reports no stale input',async t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  withLedger(fx,ledger=>{
    settledRow(ledger,{jobId:'job-done',attempt:1,inputs:recordInputs(fx.skill,[RULES])});
    ledger.write.changeWorkflowPhase({workflowId:WORKFLOW,to:'finished',by:'test',reason:'finished'});
  });
  fx.write(RULES,'rules: v2\n');
  assert.deepEqual((await status(fx)).staleInput,[]);
  assert.deepEqual((await survey(fx)).staleInput,[]);
});

/* ------------------------------ the churn the live ledgers hit */

// knowledge/application-stacks.yaml
// and the repository baseline record (BASELINE, a fixture path) were edited under dozens of
// settled legs of four workflows; `starci kernel status` listed every one in staleInput, the Kernels redid the
// seams, and each further edit re-staled the redo. The same happened through a cut set
// (8 slices, seam first). The fix: Source edits are judged against admission.
const STACKS='knowledge/application-stacks.yaml',BASELINE='knowledge/churn-baseline.yaml';
const T_ADMIT=Date.parse('2026-09-24T16:00:00+07:00');
scenario('churn: repeated knowledge edits under many settled legs stale none of them; each retains factual admitted and current Source bytes',async t=>{
  const fx=fixture(t);
  fx.write(STACKS,'stacks: v1\n');fx.write(BASELINE,'baseline: v1\n');fx.write('knowledge/unrelated.yaml','x: 1\n');
  const legs=[['interface.draw',8],['backend.implement',5]];
  withLedger(fx,ledger=>{
    const inputs=recordInputs(fx.skill,[STACKS,'knowledge/unrelated.yaml']);
    let n=0;
    for(const [opId,count] of legs)for(let i=1;i<=count;i++){
      const cut=count>1?{id:`${opId}-cut`,ordinal:i,total:count}:null;
      settledRow(ledger,{jobId:`job-${opId}-${i}`,opId,attempt:i,cut,inputs,admittedAt:T_ADMIT+(n++)});
    }
    holdEngaged(ledger);
  });
  const quiet=await status(fx);
  for(const [edit,text] of [[STACKS,'stacks: v2 (16:52)\n'],[BASELINE,'baseline: v2\n'],[STACKS,'stacks: v3 (17:09)\n'],[STACKS,'stacks: v4 (18:37)\n']]){
    fx.write(edit,text);
    const now=await status(fx);
    assert.deepEqual(now.staleInput,[],`${edit} edit: no settled leg is stale`);
    assert.deepEqual(now.frontier.staleOperations,[]);
    assert.equal(now.frontier.actionable,quiet.frontier.actionable,'the frontier does not wake the Kernel for a knowledge edit');
    assert.equal(now.frontier.reason,quiet.frontier.reason);
  }
  const final=await status(fx);
  assert.deepEqual(final.frontier.sourceDrift,{advisory:true,jobs:13,paths:[{path:STACKS,jobs:13}]},
    'only the inputs the settled legs actually read contribute to Source drift');
  assert.equal(final.sourceDrift.length,13);
  assert.ok(final.sourceDrift.every(s=>s.admittedAt>=T_ADMIT&&s.recorded===sha('stacks: v1\n')&&s.current===sha('stacks: v4 (18:37)\n')),'judged against the bytes it was admitted under');

  fx.write('knowledge/unrelated.yaml','x: 2\n');
  const unregistered=(await status(fx)).frontier.sourceDrift.paths.find(p=>p.path==='knowledge/unrelated.yaml');
  assert.deepEqual(unregistered,{path:'knowledge/unrelated.yaml',jobs:13},'a changed captured Source input is measured without a historical registry');
  assert.deepEqual((await status(fx)).staleInput,[]);
});

scenario('Source baseline edits preserve settled cuts and never invent follow-up work',async t=>{
  const fx=fixture(t);
  fx.write(BASELINE,'baseline: v1\n');
  withLedger(fx,ledger=>{
    const inputs=recordInputs(fx.skill,[BASELINE]);
    for(let i=1;i<=8;i++)settledRow(ledger,{jobId:`job-base-${i}`,opId:'backend.scaffold',attempt:i,cut:{id:'base-repos',ordinal:i,total:8},inputs,admittedAt:T_ADMIT});
    holdEngaged(ledger);
  });
  fx.write(BASELINE,'baseline: v2 (17:09)\n');
  const now=await status(fx);
  assert.deepEqual(now.staleInput,[],'the redo is a follow-up leg, not a stale seam');
  assert.deepEqual(now.frontier.staleOperations,[]);
  assert.equal(now.frontier.contractFollowUps,undefined,'no retired registry owns current work');
  assert.deepEqual(now.frontier.sourceDrift.paths,[{path:BASELINE,jobs:8}]);
  assert.equal(now.frontier.actionable,false,'Source drift cannot invent a new work obligation');
});

scenario('cut: Work-stale slices list their ordinals; while the seam redo is open the other slices wait on it',async t=>{
  const fx=fixture(t);
  fx.work('features/task/fr/list/index.yaml','fr: v1\n');
  const cut=ordinal=>({id:'root-configs',ordinal,total:3});
  const baseline=()=>baselineWorkInputs(recordInputs(fx.skill,[],undefined,{repo:fx.repo,workPaths:[FR_DIR]}),fx.repo);
  withLedger(fx,ledger=>{
    const inputs=baseline();
    for(const ordinal of [1,2,3])settledRow(ledger,{jobId:`job-cut-${ordinal}`,attempt:ordinal,cut:cut(ordinal),inputs});
    settledRow(ledger,{jobId:'job-partial',opId:'docs.author',attempt:1,inputs,status:'failed'});
    const partialAttempt=ledger.db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-partial'").get().attempt_id;
    ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(WORKFLOW,partialAttempt,'dispatch-job-partial','job-partial','partial','{}',Date.now());
    settledRow(ledger,{jobId:'job-failed',opId:'test.author',attempt:1,inputs,status:'failed'});
    holdEngaged(ledger,'job-engaged-cut','business.analyze');
  });
  fx.work('features/task/fr/list/index.yaml','fr: v2\n');
  const all=await status(fx);
  assert.deepEqual(all.frontier.staleOperations.map(s=>[s.jobId,s.cut?.ordinal??null,s.heldBy??null]),
    [['job-cut-1',1,null],['job-cut-2',2,null],['job-cut-3',3,null],['job-partial',null,null]],'partial counts, a plain failure does not');
  assert.deepEqual(all.staleInput.find(s=>s.jobId==='job-cut-2').cut,cut(2));
  assert.equal(all.frontier.actionable,true);

  withLedger(fx,ledger=>enqueueSeed(ledger,{jobId:'job-cut-1-redo',workflowId:WORKFLOW,opId:OP,attempt:4,kind:'op',payload:{opId:OP,owned_paths:['src/job-cut-1/'],cut:cut(1)}}));
  const seam=await status(fx);
  assert.deepEqual(seam.frontier.staleOperations.filter(s=>s.op===OP).map(s=>[s.jobId,s.heldBy]),[['job-cut-2','job-cut-1-redo'],['job-cut-3','job-cut-1-redo']]);
  assert.doesNotMatch(seam.frontier.reason,/job-cut-2/);

  withLedger(fx,ledger=>{
    for(const to of ['ready','leased'])ledger.write.setJobStatus({jobId:'job-cut-1-redo',to,reason:'test-fixture'});
    const attempt=ledger.write.startAttempt({workflowId:WORKFLOW,jobId:'job-cut-1-redo',dispatchId:'dispatch-redo'});
    for(const to of ['running','reported','succeeded'])ledger.write.setJobStatus({jobId:'job-cut-1-redo',to,reason:'test-fixture'});
    ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
      .run(attempt.attempt_id,WORKFLOW,'job-cut-1-redo','# contract',JSON.stringify({inputs:baseline()}),Date.now());
  });
  const rest=await status(fx);
  assert.deepEqual(rest.frontier.staleOperations.filter(s=>s.op===OP).map(s=>[s.jobId,s.heldBy??null]),[['job-cut-2',null],['job-cut-3',null]]);
  assert.match(rest.frontier.reason,/job-cut-2 \(code\.refactor a1 cut root-configs 2\/3\)/);
});

/* ------------------------------------------ an existing ledger, as main left it */

// A current ledger whose contracts carry no input digests.
const digestFreeLedger=file=>{
  const ledger=openLedger({file});
  try{
    const at=Date.now();
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running',job:'digest-free'},now:at,jobs:[
      {jobId:'job-old-1',opId:OP,status:'succeeded',dispatchId:'job-old-1',payload:{opId:OP,owned_paths:['src/job-old-1/']}},
      {jobId:'job-old-2',opId:'docs.author',status:'succeeded',dispatchId:'job-old-2',payload:{opId:'docs.author',owned_paths:['src/job-old-2/']}},
    ]});
    const pending=usageOfWorkflow(ledger.db,WORKFLOW);
    assert.deepEqual([pending.coverage.attempts,pending.coverage.measured,pending.coverage.pending,pending.coverage.unavailable,pending.coverage.open],[2,0,2,0,0],'completed digest-free fixture attempts start with genuinely unknown usage');
    for(const row of ledger.db.prepare('SELECT attempt_id,job_id,op_id FROM op_attempts WHERE workflow_id=?').all(WORKFLOW)){
      ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
        .run(row.attempt_id,WORKFLOW,row.job_id,'# contract',JSON.stringify({packet:{op:row.op_id},worktree:'.',model:'devin-agent'}),at);
      // Nonzero private usage reports satisfy the real meter without changing the old digest-free contracts.
      assert.deepEqual(ledger.write.recordAttemptUsage({attemptId:row.attempt_id,provider:'codex',source:'provider-report',
        rows:[{model:'fixture-model',inputTokens:11,outputTokens:3,cacheReadTokens:2,cacheWriteTokens:1,turns:1}]}),{recorded:true,rows:1});
    }
    const measured=usageOfWorkflow(ledger.db,WORKFLOW);
    assert.deepEqual([measured.coverage.attempts,measured.coverage.measured,measured.coverage.pending,measured.coverage.unavailable,measured.coverage.open],[2,2,0,0,0]);
    assert.equal(measured.total.tokens,34,'the real reader folds both nonzero reports before status can check the token cap');
    assert.equal(measured.total.costUsd,null,'unpriced fixture usage keeps its cost unknown');
  }finally{ledger.close();}
};
const schemaOf=file=>{
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(file,{readOnly:true});
  try{return {version:db.prepare('PRAGMA user_version').get().user_version,
    ddl:db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(r=>`${r.type}:${r.name}:${r.sql}`),
    contracts:db.prepare('PRAGMA table_info(contracts)').all().map(c=>`${c.name}:${c.type}:${c.notnull}`)};}
  finally{db.close();}
};
const openRace=(file,root,env)=>new Promise(resolve=>{
  const code=`import {openLedger} from ${JSON.stringify(new URL('../../engine/db/ledger.mjs',import.meta.url).href)};
    import {staleInputs} from ${JSON.stringify(new URL('../../scripts/kernel/input-digests.mjs',import.meta.url).href)};
    const l=openLedger({file:${JSON.stringify(file)}});const s=staleInputs(l.db,${JSON.stringify(WORKFLOW)},{root:${JSON.stringify(root)}});l.close();
    process.stdout.write(JSON.stringify(s));`;
  const child=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true,env});
  let out='',err='';child.stdout.on('data',d=>{out+=d;});child.stderr.on('data',d=>{err+=d;});
  child.on('close',status=>resolve({status,out,err}));
});

scenario('an existing ledger: no schema change, digest-free rows never stale, new dispatches record digests, concurrent opens succeed',async t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  const file=ledgerFileFor(fx.repo,{env:fx.env});
  digestFreeLedger(file);
  const pristine=schemaOf(file);

  withLedger(fx,ledger=>holdEngaged(ledger));
  const before=await status(fx);
  assert.deepEqual(before.staleInput,[]);
  fx.write(RULES,'rules: v2\n');
  const after=await status(fx);
  assert.deepEqual(after.staleInput,[],'a digest-free contract row is never stale');
  assert.equal(after.frontier.actionable,before.frontier.actionable);
  assert.equal(after.frontier.actionable,false);

  withLedger(fx,ledger=>{
    // The synthetic running row has served the digest-free frontier assertions; release its side before new admission.
    ledger.write.setJobStatus({jobId:'job-engaged',to:'cancelled',reason:'fixture-complete'});
    assert.equal(ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-engaged').status,'cancelled');
    ledger.write.createUnit({workflowId:WORKFLOW,unitId:'job-new',opId:OP,subjectKey:'job-new',goalRevision:1});
    enqueueSeed(ledger,{jobId:'job-new',workflowId:WORKFLOW,unitId:'job-new',opId:OP,kind:'op',payload:{opId:OP,owned_paths:['src/new/'],model:'devin-agent'}});
  });
  const dispatched=await fx.run('dispatch','--job','job-new','--model','devin-agent','--spawn');
  assert.equal(dispatched.status,0,dispatched.stderr||dispatched.stdout);
  const reopened=inspect(fx,db=>db.prepare('SELECT a.op_id,a.try_no,c.context_json FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE c.workflow_id=? ORDER BY a.op_id,a.attempt_id').all(WORKFLOW)
    .map(r=>[r.op_id,r.try_no,JSON.parse(r.context_json).inputs?.schema??null]));
  assert.deepEqual(reopened,[[OP,1,null],[OP,1,INPUT_DIGEST_SCHEMA],['docs.author',1,null]]);

  const [a,b]=await Promise.all([openRace(file,fx.skill,fx.env),openRace(file,fx.skill,fx.env)]);
  assert.equal(a.status,0,a.err);assert.equal(b.status,0,b.err);
  assert.deepEqual(JSON.parse(a.out),[]);assert.deepEqual(JSON.parse(b.out),[]);
  const reopenedSchema=schemaOf(file);
  assert.equal(reopenedSchema.version,pristine.version,'user_version is unchanged');
  assert.deepEqual(reopenedSchema.contracts,pristine.contracts,'contracts gains no column: digests ride in context_json');
  assert.deepEqual(reopenedSchema.ddl,pristine.ddl,'opening with this code changes no schema');
});
