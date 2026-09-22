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
import {INPUT_DIGEST_SCHEMA,createDigester,lawTokens,opInputPaths,recordInputs} from '../scripts/kernel/input-digests.mjs';

// Stale input: `api dispatch` records the digests of the law inputs an op reads
// (contracts.context_json.inputs), and `api survey` / `api status` list a
// settled job whose recorded digest no longer matches the runtime root. The
// runtime root is where api.mjs lives, so each spec runs a private copy of the
// runtime whose knowledge/ it can edit.

const ROOT=path.resolve(import.meta.dirname,'..');
const OP='code.refactor';
const WORKFLOW='wf-stale-input';
const RULES='knowledge/coding-reference.yaml';
const require=createRequire(import.meta.url);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stale-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const skill=path.join(root,'skill'),repo=path.join(root,'repo');
  for(const dir of ['scripts','engine','modules','bin'])fs.cpSync(path.join(ROOT,dir),path.join(skill,dir),{recursive:true});
  for(const file of ['CONTEXT.md','package.json'])fs.copyFileSync(path.join(ROOT,file),path.join(skill,file));
  fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:ROOT,LOCALAPPDATA:path.join(root,'localappdata')};
  const api=path.join(skill,'scripts','kernel','api.mjs');
  const run=(...args)=>spawnSync(process.execPath,[api,...args,'--repo',repo,'--json'],{cwd:skill,encoding:'utf8',windowsHide:true,timeout:180000,env});
  const write=(rel,text)=>{const file=path.join(skill,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  return {root,skill,repo,env,api,run,write};
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
const settledRow=(ledger,{jobId,opId=OP,attempt,cut=null,inputs,status='succeeded'})=>{
  const at=Date.now();
  ledger.enqueueJob({jobId,workflowId:WORKFLOW,opId,attempt,kind:'op',payload:{opId,owned_paths:[`src/${jobId}/`],...(cut?{cut}:{})}});
  ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WORKFLOW,opId,attempt,`dispatch-${jobId}`,'# contract',JSON.stringify({packet:{op:opId},worktree:'.',...(inputs?{inputs}:{})}),at);
};

test('law tokens: knowledge paths and the named data-owned files, never other runtime paths',()=>{
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

test('dispatch records the op input digests; a changed knowledge file makes the settled job stale-input in survey and status',t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  fx.write('knowledge/patterns/be/index.yaml','be: v1\n');
  withLedger(fx,ledger=>{
    ledger.enqueueJob({jobId:'job-refactor',workflowId:WORKFLOW,opId:OP,kind:'op',payload:{opId:OP,owned_paths:['src/refactor/'],model:'qwen-agent'}});
    ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(WORKFLOW);
  });
  const dispatched=fx.run('dispatch','--job','job-refactor','--model','qwen-agent','--spawn');
  assert.equal(dispatched.status,0,dispatched.stderr||dispatched.stdout);
  const inputs=inspect(fx,db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=?').get(WORKFLOW).context_json).inputs);
  assert.equal(inputs.schema,INPUT_DIGEST_SCHEMA);
  const recorded=Object.fromEntries(inputs.digests.map(d=>[d.path,d.digest]));
  assert.deepEqual(Object.keys(recorded).sort(),[RULES,'knowledge/patterns/be/index.yaml','knowledge/patterns/fe/index.yaml','modules/models/code-patterns.yaml'].sort());
  assert.equal(recorded[RULES],sha('rules: v1\n'));
  assert.equal(recorded['knowledge/patterns/fe/index.yaml'],'absent');
  assert.match(recorded['modules/models/code-patterns.yaml'],/^[0-9a-f]{64}$/);

  const report=path.join(fx.repo,'report.json');
  fs.writeFileSync(report,JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:'refactor done',files:['src/refactor/a.ts'],checks:[{name:'self',command:'true',exitCode:0}]}));
  assert.equal(fx.run('report','--job','job-refactor','--report',report).status,0);
  assert.equal(fx.run('check','--job','job-refactor','--checks',JSON.stringify({checks:[{name:'validator',exitCode:0}]})).status,0);
  const settled=fx.run('settle','--job','job-refactor','--verdict','pass');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  withLedger(fx,ledger=>holdEngaged(ledger));

  const quiet=status(fx);
  assert.deepEqual(quiet.staleInput,[],'unchanged inputs are not stale');
  assert.deepEqual(quiet.frontier.staleOperations,[]);
  assert.equal(quiet.frontier.state,'engaged');
  assert.equal(quiet.frontier.actionable,false,'precondition: nothing else makes the frontier actionable');
  assert.deepEqual(survey(fx).staleInput,[]);

  fx.write(RULES,'rules: v2\n');
  const loud=status(fx);
  assert.deepEqual(loud.staleInput,[{jobId:'job-refactor',op:OP,attempt:1,path:RULES,recorded:sha('rules: v1\n'),current:sha('rules: v2\n')}]);
  assert.deepEqual(loud.frontier.staleOperations,[{jobId:'job-refactor',op:OP,attempt:1,paths:[RULES]}]);
  assert.equal(loud.frontier.actionable,true);
  assert.match(loud.frontier.reason,/job-refactor/);
  assert.deepEqual(survey(fx).staleInput,loud.staleInput);

  fx.write('knowledge/patterns/fe/index.yaml','fe: new\n');
  assert.deepEqual(status(fx).staleInput.map(s=>[s.path,s.recorded]),[[RULES,sha('rules: v1\n')],['knowledge/patterns/fe/index.yaml','absent']],'an input that appears is a change too');

  withLedger(fx,ledger=>ledger.enqueueJob({jobId:'job-refactor-redo',workflowId:WORKFLOW,opId:OP,attempt:2,kind:'op',payload:{opId:OP,owned_paths:['src/refactor/']}}));
  const redo=status(fx);
  assert.deepEqual(redo.staleInput,[],'a newer attempt of the same op supersedes the stale one');
  assert.equal(redo.frontier.staleOperations.length,0);
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

test('cut: stale slices list their ordinals; while the seam redo is open the other slices wait on it',t=>{
  const fx=fixture(t);
  fx.write(RULES,'rules: v1\n');
  const cut=ordinal=>({id:'root-configs',ordinal,total:3});
  withLedger(fx,ledger=>{
    const inputs=recordInputs(fx.skill,[RULES]);
    for(const ordinal of [1,2,3])settledRow(ledger,{jobId:`job-cut-${ordinal}`,attempt:ordinal,cut:cut(ordinal),inputs});
    settledRow(ledger,{jobId:'job-partial',opId:'docs.author',attempt:1,inputs,status:'failed'});
    ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(WORKFLOW,'dispatch-job-partial','docs.author',1,1,'partial','{}',Date.now());
    settledRow(ledger,{jobId:'job-failed',opId:'test.author',attempt:1,inputs,status:'failed'});
    holdEngaged(ledger);
  });
  fx.write(RULES,'rules: v2\n');
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
      .run(WORKFLOW,OP,4,'dispatch-redo','# contract',JSON.stringify({inputs:recordInputs(fx.skill,[RULES])}),Date.now());
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
