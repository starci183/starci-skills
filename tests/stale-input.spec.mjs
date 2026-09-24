import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {INPUT_DIGEST_SCHEMA,baselineWorkInputs,createDigester,inputKindOf,lawTokens,opInputPaths,recordInputs,workInputPaths} from '../scripts/kernel/input-digests.mjs';

// Stale input: `api dispatch` records the digests of the inputs an op reads
// (contracts.context_json.inputs) by kind. A Source-law input (knowledge/**,
// modules/schemas/**) edited after admission is advisory `sourceDrift`, never
// stale; a product Work record the job read (payload.records under .starciwork),
// changed after it settled from outside its workflow, is `staleInput`. The
// runtime root is where api.mjs lives, so each spec runs a private copy of the
// runtime whose knowledge/ it can edit, beside a product repo whose .starciwork/
// it can edit.

const ROOT=path.resolve(import.meta.dirname,'..');
const OP='code.refactor';
const WORKFLOW='wf-stale-input';
const RULES='knowledge/coding-reference.yaml';
const FR_DIR='.starciwork/features/task/fr/list';
const require=createRequire(import.meta.url);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');

const fixture=(t,{registry=null}={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stale-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const skill=path.join(root,'skill'),repo=path.join(root,'repo');
  for(const dir of ['scripts','engine','modules','bin'])fs.cpSync(path.join(ROOT,dir),path.join(skill,dir),{recursive:true});
  fs.cpSync(path.join(ROOT,'packages','grammar','scripts'),path.join(skill,'packages','grammar','scripts'),{recursive:true});
  for(const file of ['CONTEXT.md','package.json'])fs.copyFileSync(path.join(ROOT,file),path.join(skill,file));
  fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:ROOT,LOCALAPPDATA:path.join(root,'localappdata'),...(registry?{STARCI_CONTRACT_CHANGES:registry}:{})};
  if(!registry)delete env.STARCI_CONTRACT_CHANGES;
  const api=path.join(skill,'scripts','kernel','api.mjs');
  const run=(...args)=>spawnSync(process.execPath,[api,...args,'--repo',repo,'--json'],{cwd:skill,encoding:'utf8',windowsHide:true,timeout:180000,env});
  const write=(rel,text)=>{const file=path.join(skill,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  const work=(rel,text)=>{const file=path.join(repo,'.starciwork',rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  return {root,skill,repo,env,api,run,write,work};
};
const json=r=>{try{return JSON.parse(r.stdout);}catch{const at=r.stdout.indexOf('{'),end=r.stdout.indexOf('\n}');return at<0||end<0?null:JSON.parse(r.stdout.slice(at,end+2));}};
const withLedger=(fx,fn)=>{const ledger=openLedger({file:ledgerFileFor(fx.repo)});try{return fn(ledger);}finally{ledger.close();}};
const inspect=(fx,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(fx.repo)});try{return fn(ledger.db);}finally{ledger.close();}};
const status=fx=>{const r=fx.run('status','--workflow',WORKFLOW);assert.equal(r.status,0,r.stderr||r.stdout);return json(r);};
const survey=fx=>{const r=fx.run('survey','--workflow',WORKFLOW);assert.equal(r.status,0,r.stderr||r.stdout);return json(r);};

/** A running operation with no exact terminal keeps the frontier `engaged` and not actionable by itself. */
const holdEngaged=(ledger,jobId='job-engaged')=>{
  ledger.enqueueJob({jobId,workflowId:WORKFLOW,opId:'docs.author',kind:'op',payload:{opId:'docs.author',owned_paths:['docs/engaged/']}});
  ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WORKFLOW);
};
/** A settled op row plus its contract, written the way a ledger already holds them. */
const settledRow=(ledger,{jobId,opId=OP,attempt,cut=null,inputs,status='succeeded',owned=null,admittedAt=null})=>{
  const at=admittedAt??Date.now();
  ledger.enqueueJob({jobId,workflowId:WORKFLOW,opId,attempt,kind:'op',payload:{opId,owned_paths:owned??[`src/${jobId}/`],...(cut?{cut}:{})}});
  ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WORKFLOW,opId,attempt,`dispatch-${jobId}`,'# contract',JSON.stringify({packet:{op:opId},worktree:'.',...(inputs?{inputs}:{})}),at);
};

test('law tokens: knowledge, schema paths and the named data-owned files, never other runtime paths; Work inputs are the .starciwork records',()=>{
  assert.deepEqual(lawTokens('modules/schemas/stacks-layout.yaml + modules/models/registry.yaml'),['modules/schemas/stacks-layout.yaml']);
  assert.deepEqual(workInputPaths({records:['.starciwork/shell/index.yaml','.starciwork/features/x/fr/','src/a.ts','.starciwork/runtime.sqlite','.starciwork/kernel-evidence/w/x.json','.starciwork/features/<f>/**','.starciwork/../x']}),
    ['.starciwork/shell/index.yaml','.starciwork/features/x/fr']);
  assert.deepEqual([{path:'knowledge/a.yaml'},{path:'.starciwork/index.yaml'},{path:'docs/x.md'},{path:'knowledge/a.yaml',kind:'work'}].map(inputKindOf),['source','work',null,'work'],'an entry recorded before kinds is classified by its path');
  assert.deepEqual(lawTokens('CONTEXT.md (fixed stack) + knowledge/repository-baseline.yaml (shapes common and nest)'),['knowledge/repository-baseline.yaml']);
  assert.deepEqual(lawTokens('scripts/checks/code-patterns/*.mjs + modules/models/code-patterns.yaml + docs/architecture-check.md'),['modules/models/code-patterns.yaml']);
  assert.deepEqual(lawTokens('knowledge/patterns/be/* + knowledge/../CONTEXT.md'),['knowledge/patterns/be/*']);
  const brief={reads:[{path:'knowledge/grammars/<family>/DNA.yaml'}],policy:{executionModes:{lint:{reads:[{path:'knowledge/coding-reference.yaml'}]}}}};
  assert.deepEqual(opInputPaths(brief,{params:{family:'carbon'}}),['knowledge/grammars/carbon/DNA.yaml']);
  assert.deepEqual(opInputPaths(brief,{mode:'lint'}),['knowledge/grammars/<family>/DNA.yaml','knowledge/coding-reference.yaml']);
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

test('dispatch records Source and Work digests by kind; settle re-baselines Work; a knowledge edit is advisory sourceDrift, never stale',t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  fx.write('knowledge/patterns/be/index.yaml','be: v1\n');
  fx.work('features/task/fr/list/index.yaml','fr: v1\n');
  fx.work('features/task/fr/list/evidence/run.txt','noise\n');
  withLedger(fx,ledger=>{
    ledger.enqueueJob({jobId:'job-refactor',workflowId:WORKFLOW,opId:OP,kind:'op',payload:{opId:OP,owned_paths:['src/refactor/'],model:'qwen-agent',records:[FR_DIR,'src/refactor/a.ts']}});
    ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(WORKFLOW);
  });
  const dispatched=fx.run('dispatch','--job','job-refactor','--model','qwen-agent','--spawn');
  assert.equal(dispatched.status,0,dispatched.stderr||dispatched.stdout);
  const inputsOf=()=>inspect(fx,db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=?').get(WORKFLOW).context_json).inputs);
  const inputs=inputsOf();
  assert.equal(inputs.schema,INPUT_DIGEST_SCHEMA);
  const recorded=Object.fromEntries(inputs.digests.map(d=>[d.path,d]));
  assert.deepEqual(Object.keys(recorded).sort(),[FR_DIR,RULES,'knowledge/patterns/be/index.yaml','knowledge/patterns/fe/index.yaml','modules/models/code-patterns.yaml'].sort(),
    'a record outside .starciwork (the job\'s own source) is not a Work input');
  assert.deepEqual(Object.values(recorded).filter(d=>d.kind==='work').map(d=>d.path),[FR_DIR]);
  assert.equal(recorded[RULES].kind,'source');
  assert.equal(recorded[RULES].digest,sha('rules: v1\n'));
  assert.equal(recorded[FR_DIR].digest,sha(`${FR_DIR}/index.yaml\0${sha('fr: v1\n')}\n`),'a record directory counts its record files, never evidence/');

  const report=path.join(fx.repo,'report.json');
  fs.writeFileSync(report,JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:'refactor done',head:'abc1234def',files:['src/refactor/a.ts'],checks:[{name:'self',command:'true',exitCode:0}]}));
  assert.equal(fx.run('report','--job','job-refactor','--report',report).status,0);
  assert.equal(fx.run('check','--job','job-refactor','--checks',JSON.stringify({checks:[{name:'validator',exitCode:0}]})).status,0);
  const settled=fx.run('settle','--job','job-refactor','--verdict','pass');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  const work=inputsOf().digests.find(d=>d.path===FR_DIR);
  assert.equal(work.settled.digest,recorded[FR_DIR].digest);
  assert.deepEqual(Object.keys(work.settled.files),[`${FR_DIR}/index.yaml`]);
  withLedger(fx,ledger=>holdEngaged(ledger));

  const quiet=status(fx);
  assert.deepEqual(quiet.staleInput,[],'unchanged inputs are not stale');
  assert.deepEqual(quiet.sourceDrift,[]);
  assert.equal(quiet.frontier.sourceDrift,undefined,'the advisory key is present only when there is drift');
  assert.equal(quiet.frontier.actionable,false,'precondition: nothing else makes the frontier actionable');

  fx.write(RULES,'rules: v2\n');
  const edited=status(fx);
  assert.deepEqual(edited.staleInput,[],'a Source knowledge edit never makes a settled job stale');
  assert.deepEqual(edited.frontier.staleOperations,[]);
  assert.equal(edited.frontier.actionable,false,'nor actionable');
  assert.equal(edited.frontier.reason,quiet.frontier.reason);
  assert.deepEqual(edited.sourceDrift.map(s=>[s.jobId,s.path,s.kind,s.recorded,s.current,s.unregistered]),[['job-refactor',RULES,'source',sha('rules: v1\n'),sha('rules: v2\n'),true]]);
  assert.deepEqual(edited.frontier.sourceDrift,{advisory:true,jobs:1,paths:[{path:RULES,jobs:1,changes:[],followUp:[],unregistered:true}]});
  assert.deepEqual(survey(fx).sourceDrift,edited.sourceDrift);
  assert.deepEqual(survey(fx).staleInput,[]);

  fx.work('features/task/fr/list/evidence/run.txt','more noise\n');
  assert.deepEqual(status(fx).staleInput,[],'evidence beside a record is not the record');
  fx.work('features/task/fr/list/index.yaml','fr: v2 (owner edit)\n');
  const loud=status(fx);
  assert.deepEqual(loud.staleInput.map(s=>[s.jobId,s.path,s.kind,s.changed]),[['job-refactor',FR_DIR,'work',[`${FR_DIR}/index.yaml`]]],'a product record the job read, changed from outside its workflow, is stale');
  assert.deepEqual(loud.frontier.staleOperations,[{jobId:'job-refactor',op:OP,attempt:1,paths:[FR_DIR]}]);
  assert.equal(loud.frontier.actionable,true);
  assert.match(loud.frontier.reason,/job-refactor.*product records/);

  withLedger(fx,ledger=>ledger.enqueueJob({jobId:'job-refactor-redo',workflowId:WORKFLOW,opId:OP,attempt:2,kind:'op',payload:{opId:OP,owned_paths:['src/refactor/']}}));
  const redo=status(fx);
  assert.deepEqual(redo.staleInput,[],'a newer attempt of the same op supersedes the stale one');
  assert.deepEqual(redo.sourceDrift,[],'and its drift');
});

test('Work: the job\'s own writes and its workflow\'s later legs are progress, not staleness; another workflow\'s write is advisory peerDrift',t=>{
  const fx=fixture(t);
  const REC='.starciwork/features/task/ui/list';
  fx.work('features/task/ui/list/index.yaml','ui: v1\n');
  withLedger(fx,ledger=>{
    const inputs=baselineWorkInputs(recordInputs(fx.skill,[],undefined,{repo:fx.repo,workPaths:[REC]}),fx.repo,{now:Date.now()-60000});
    settledRow(ledger,{jobId:'job-draw',opId:'interface.draw',attempt:1,inputs,owned:[REC]});
    ledger.enqueueJob({jobId:'job-audit',workflowId:WORKFLOW,opId:'interface.audit',kind:'op',payload:{opId:'interface.audit',owned_paths:[`${REC}/index.yaml`]}});
    ledger.enqueueJob({jobId:'job-peer',workflowId:'wf-peer',opId:'interface.implement',kind:'op',payload:{opId:'interface.implement',owned_paths:[REC]}});
    holdEngaged(ledger);
  });
  fx.work('features/task/ui/list/index.yaml','ui: v2 by the draw itself or its audit\n');
  assert.deepEqual(status(fx).staleInput,[],'a write inside the job\'s own or a later same-workflow leg\'s owned paths is planned progress');
  withLedger(fx,ledger=>{
    ledger.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id='job-draw'").run(JSON.stringify({opId:'interface.draw',owned_paths:['src/elsewhere/']}));
    ledger.db.prepare("UPDATE jobs SET status='cancelled',updated_at=0 WHERE job_id='job-audit'").run();
  });
  // starci-next inc-1c7f7dad53e0: the record's one owner is wf-peer (its job owns it); its change is
  // judged against the revision the draw read and is advisory until wf-peer declares it breaking.
  const drift=status(fx);
  assert.deepEqual(drift.staleInput,[],'a peer workflow owning the record rewrote it: never staleInput, never a redo');
  assert.deepEqual(drift.peerDrift.map(p=>[p.jobId,p.files.map(f=>[f.file,f.owner,f.ownerBy])]),[['job-draw',[[`${REC}/index.yaml`,'wf-peer','cut']]]]);
  assert.deepEqual(drift.frontier.peerDrift,{advisory:true,jobs:1,records:[{file:`${REC}/index.yaml`,owner:'wf-peer',ownerBy:'cut',writers:[],jobs:1,foreignWrite:false}]});
  assert.equal(drift.frontier.actionable,false,'advisory drift never wakes the Kernel');
});

test('a contract without recorded digests never reports stale input and leaves actionable as it was',t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  withLedger(fx,ledger=>{
    settledRow(ledger,{jobId:'job-legacy',attempt:1});
    settledRow(ledger,{jobId:'job-legacy-null',opId:'docs.author',attempt:1});
    ledger.db.prepare("UPDATE contracts SET context_json=NULL WHERE op_id='docs.author'").run();
    holdEngaged(ledger);
  });
  const before=status(fx);
  fx.write(RULES,'rules: v2\n');
  const after=status(fx);
  assert.deepEqual(after.staleInput,[]);
  assert.equal(after.staleInputError,undefined);
  assert.equal(after.frontier.actionable,before.frontier.actionable);
  assert.equal(after.frontier.actionable,false);
  assert.equal(after.frontier.reason,before.frontier.reason);
  assert.deepEqual(survey(fx).staleInput,[]);
});

test('a finished workflow reports no stale input',t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  withLedger(fx,ledger=>{
    settledRow(ledger,{jobId:'job-done',attempt:1,inputs:recordInputs(fx.skill,[RULES])});
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(WORKFLOW);
  });
  fx.write(RULES,'rules: v2\n');
  assert.deepEqual(status(fx).staleInput,[]);
  assert.deepEqual(survey(fx).staleInput,[]);
});

/* ------------------------------ the churn the live ledgers hit on 2026-09-24 */

// nivo inc-fd7bd0b0ecff / inc-89de324ac72a / inc-f18e11d1f44d: knowledge/application-stacks.yaml
// (16:52) and knowledge/repository-baseline.yaml (16:38, 16:52, 17:09) were edited under dozens of
// settled legs of four workflows; `api status` listed every one in staleInput, the Kernels redid the
// seams, and each further edit re-staled the redo. mia inc-914266179f5c: the same through a cut set
// (base-repos 8 slices, seam first). The fix: Source edits are judged against admission.
const STACKS='knowledge/application-stacks.yaml',BASELINE='knowledge/repository-baseline.yaml';
const T_ADMIT=Date.parse('2026-09-24T16:00:00+07:00');
const churnRegistry=(t,{followUp=false}={})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-churn-registry-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'contract-changes.yaml');
  fs.writeFileSync(file,['schema: starci/contract-changes@1','changes:',
    '  - id: starcistacks-services',"    effectiveAt: '2026-09-24T17:00:00+07:00'",'    paths:',`      - ${STACKS}`,'      - modules/schemas/stacks-layout.yaml','    reach: new-legs',
    '  - id: baseline-stack-services-repository',"    effectiveAt: '2026-09-24T17:09:15+07:00'",'    paths:',`      - ${BASELINE}`,
    ...(followUp?['    reach: follow-up','    followUp:','      op: backend.scaffold','      ops:','        - backend.scaffold','      detail: re-apply the baseline stack services block']:['    reach: new-legs']),
    ''].join('\n'));
  return file;
};

test('nivo churn: repeated knowledge edits under many settled legs stale none of them; each is advisory drift naming its registered change',t=>{
  const fx=fixture(t,{registry:churnRegistry(t)});
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
  const quiet=status(fx);
  for(const [edit,text] of [[STACKS,'stacks: v2 (16:52)\n'],[BASELINE,'baseline: v2\n'],[STACKS,'stacks: v3 (17:09)\n'],[STACKS,'stacks: v4 (18:37)\n']]){
    fx.write(edit,text);
    const now=status(fx);
    assert.deepEqual(now.staleInput,[],`${edit} edit: no settled leg is stale`);
    assert.deepEqual(now.frontier.staleOperations,[]);
    assert.equal(now.frontier.actionable,quiet.frontier.actionable,'the frontier does not wake the Kernel for a knowledge edit');
    assert.equal(now.frontier.reason,quiet.frontier.reason);
  }
  const final=status(fx);
  assert.deepEqual(final.frontier.sourceDrift,{advisory:true,jobs:13,paths:[{path:STACKS,jobs:13,changes:['starcistacks-services'],followUp:[],unregistered:false}]},
    'only what the legs read drifts, and the change that registered it is named');
  assert.equal(final.sourceDrift.length,13);
  assert.ok(final.sourceDrift.every(s=>s.admittedAt>=T_ADMIT&&s.recorded===sha('stacks: v1\n')&&s.current===sha('stacks: v4 (18:37)\n')),'judged against the bytes it was admitted under');

  fx.write('knowledge/unrelated.yaml','x: 2\n');
  const unregistered=status(fx).frontier.sourceDrift.paths.find(p=>p.path==='knowledge/unrelated.yaml');
  assert.deepEqual(unregistered,{path:'knowledge/unrelated.yaml',jobs:13,changes:[],followUp:[],unregistered:true},'an edit nobody registered is flagged for the supervisor, still not stale');
  assert.deepEqual(status(fx).staleInput,[]);
});

test('mia churn: a cut set admitted before a registered reach follow-up baseline change owes follow-up legs, never a seam-first redo',t=>{
  const fx=fixture(t,{registry:churnRegistry(t,{followUp:true})});
  fx.write(BASELINE,'baseline: v1\n');
  withLedger(fx,ledger=>{
    const inputs=recordInputs(fx.skill,[BASELINE]);
    for(let i=1;i<=8;i++)settledRow(ledger,{jobId:`job-base-${i}`,opId:'backend.scaffold',attempt:i,cut:{id:'base-repos',ordinal:i,total:8},inputs,admittedAt:T_ADMIT});
    holdEngaged(ledger);
  });
  fx.write(BASELINE,'baseline: v2 (17:09)\n');
  const now=status(fx);
  assert.deepEqual(now.staleInput,[],'the redo is a follow-up leg, not a stale seam');
  assert.deepEqual(now.frontier.staleOperations,[]);
  assert.deepEqual(now.frontier.contractFollowUps.map(f=>[f.change,f.jobId,f.followUpOp]),
    Array.from({length:8},(_,i)=>['baseline-stack-services-repository',`job-base-${i+1}`,'backend.scaffold']),'status lists the owed follow-up legs as for any follow-up change');
  assert.deepEqual(now.frontier.sourceDrift.paths,[{path:BASELINE,jobs:8,changes:['baseline-stack-services-repository'],followUp:['baseline-stack-services-repository'],unregistered:false}]);
  assert.equal(now.frontier.actionable,true,'owed follow-ups are actionable, as before');
});

test('cut: Work-stale slices list their ordinals; while the seam redo is open the other slices wait on it',t=>{
  const fx=fixture(t);
  fx.work('features/task/fr/list/index.yaml','fr: v1\n');
  const cut=ordinal=>({id:'root-configs',ordinal,total:3});
  const baseline=()=>baselineWorkInputs(recordInputs(fx.skill,[],undefined,{repo:fx.repo,workPaths:[FR_DIR]}),fx.repo);
  withLedger(fx,ledger=>{
    const inputs=baseline();
    for(const ordinal of [1,2,3])settledRow(ledger,{jobId:`job-cut-${ordinal}`,attempt:ordinal,cut:cut(ordinal),inputs});
    settledRow(ledger,{jobId:'job-partial',opId:'docs.author',attempt:1,inputs,status:'failed'});
    ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(WORKFLOW,'dispatch-job-partial','docs.author',1,1,'partial','{}',Date.now());
    settledRow(ledger,{jobId:'job-failed',opId:'test.author',attempt:1,inputs,status:'failed'});
    holdEngaged(ledger);
  });
  fx.work('features/task/fr/list/index.yaml','fr: v2\n');
  const all=status(fx);
  assert.deepEqual(all.frontier.staleOperations.map(s=>[s.jobId,s.cut?.ordinal??null,s.heldBy??null]),
    [['job-cut-1',1,null],['job-cut-2',2,null],['job-cut-3',3,null],['job-partial',null,null]],'partial counts, a plain failure does not');
  assert.deepEqual(all.staleInput.find(s=>s.jobId==='job-cut-2').cut,cut(2));
  assert.equal(all.frontier.actionable,true);

  withLedger(fx,ledger=>ledger.enqueueJob({jobId:'job-cut-1-redo',workflowId:WORKFLOW,opId:OP,attempt:4,kind:'op',payload:{opId:OP,owned_paths:['src/job-cut-1/'],cut:cut(1)}}));
  const seam=status(fx);
  assert.deepEqual(seam.frontier.staleOperations.filter(s=>s.op===OP).map(s=>[s.jobId,s.heldBy]),[['job-cut-2','job-cut-1-redo'],['job-cut-3','job-cut-1-redo']]);
  assert.doesNotMatch(seam.frontier.reason,/job-cut-2/);

  withLedger(fx,ledger=>{
    ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='job-cut-1-redo'").run();
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(WORKFLOW,OP,4,'dispatch-redo','# contract',JSON.stringify({inputs:baseline()}),Date.now());
  });
  const rest=status(fx);
  assert.deepEqual(rest.frontier.staleOperations.filter(s=>s.op===OP).map(s=>[s.jobId,s.heldBy??null]),[['job-cut-2',null],['job-cut-3',null]]);
  assert.match(rest.frontier.reason,/job-cut-2 \(code\.refactor a2 cut root-configs 2\/3\)/);
});

/* ------------------------------------------ an existing ledger, as main left it */

// The ledger shape before input digests existed: schema.sql executed directly,
// no openLedger, contract rows carrying no inputs record.
const legacyLedger=file=>{
  const {DatabaseSync}=require('node:sqlite');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const db=new DatabaseSync(file);
  db.function('starci_sha256',{deterministic:true},text=>sha(String(text)));
  db.exec(`BEGIN IMMEDIATE;${fs.readFileSync(path.join(ROOT,'engine','schema.sql'),'utf8')}
    PRAGMA user_version=1; COMMIT;`);
  const at=Date.now(),seed=db.prepare('INSERT INTO meta(key,value) VALUES(?,?)');
  seed.run('ledger_id',crypto.randomUUID());seed.run('schema','starci/ledger-db@1');seed.run('created_at',String(at));
  db.prepare("INSERT INTO workflows(workflow_id,title,created_at,updated_at,phase) VALUES(?,?,?,?,'running')").run(WORKFLOW,'legacy',at,at);
  for(const [jobId,opId] of [['job-old-1',OP],['job-old-2','docs.author']]){
    db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'succeeded',?,?)")
      .run(jobId,WORKFLOW,opId,JSON.stringify({opId,owned_paths:[`src/${jobId}/`]}),at,at);
    db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,1,?,?,?,?)')
      .run(WORKFLOW,opId,jobId,'# contract',JSON.stringify({packet:{op:opId},worktree:'.',model:'qwen-agent'}),at);
  }
  db.close();
};
const schemaOf=file=>{
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(file,{readOnly:true});
  try{return {version:db.prepare('PRAGMA user_version').get().user_version,
    ddl:db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(r=>`${r.type}:${r.name}:${r.sql}`),
    contracts:db.prepare('PRAGMA table_info(contracts)').all().map(c=>`${c.name}:${c.type}:${c.notnull}`)};}
  finally{db.close();}
};
const openRace=(file,root)=>new Promise(resolve=>{
  const code=`import {openLedger} from ${JSON.stringify(new URL('../engine/ledger-db.mjs',import.meta.url).href)};
    import {staleInputs} from ${JSON.stringify(new URL('../scripts/kernel/input-digests.mjs',import.meta.url).href)};
    const l=openLedger({file:${JSON.stringify(file)}});const s=staleInputs(l.db,${JSON.stringify(WORKFLOW)},{root:${JSON.stringify(root)}});l.close();
    process.stdout.write(JSON.stringify(s));`;
  const child=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true});
  let out='',err='';child.stdout.on('data',d=>{out+=d;});child.stderr.on('data',d=>{err+=d;});
  child.on('close',status=>resolve({status,out,err}));
});

test('an existing ledger: no schema change, legacy rows never stale, new dispatches record digests, concurrent opens succeed',async t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  const file=ledgerFileFor(fx.repo);
  legacyLedger(file);
  const pristine=schemaOf(file);

  withLedger(fx,ledger=>holdEngaged(ledger));
  const before=status(fx);
  assert.deepEqual(before.staleInput,[]);
  fx.write(RULES,'rules: v2\n');
  const after=status(fx);
  assert.deepEqual(after.staleInput,[],'a legacy contract row carries no digests and is never stale');
  assert.equal(after.frontier.actionable,before.frontier.actionable);
  assert.equal(after.frontier.actionable,false);

  withLedger(fx,ledger=>ledger.enqueueJob({jobId:'job-new',workflowId:WORKFLOW,opId:OP,attempt:2,generation:0,kind:'op',payload:{opId:OP,owned_paths:['src/new/'],model:'qwen-agent'}}));
  const dispatched=fx.run('dispatch','--job','job-new','--model','qwen-agent','--spawn');
  assert.equal(dispatched.status,0,dispatched.stderr||dispatched.stdout);
  const reopened=inspect(fx,db=>db.prepare('SELECT op_id,attempt,context_json FROM contracts WHERE workflow_id=? ORDER BY op_id,attempt').all(WORKFLOW)
    .map(r=>[r.op_id,r.attempt,JSON.parse(r.context_json).inputs?.schema??null]));
  assert.deepEqual(reopened,[[OP,1,null],[OP,2,INPUT_DIGEST_SCHEMA],['docs.author',1,null]]);

  const [a,b]=await Promise.all([openRace(file,fx.skill),openRace(file,fx.skill)]);
  assert.equal(a.status,0,a.err);assert.equal(b.status,0,b.err);
  assert.deepEqual(JSON.parse(a.out),[]);assert.deepEqual(JSON.parse(b.out),[]);
  const reopenedSchema=schemaOf(file);
  assert.equal(reopenedSchema.version,pristine.version,'user_version is unchanged');
  assert.deepEqual(reopenedSchema.contracts,pristine.contracts,'contracts gains no column: digests ride in context_json');
  assert.deepEqual(reopenedSchema.ddl,pristine.ddl,'opening with this code applies no migration');
});
