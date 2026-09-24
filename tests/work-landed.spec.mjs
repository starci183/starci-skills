import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {WORK_COMMIT_CHANGE,admittedCommitPolicy,commitPolicyOf,ownedPathsDirty,policyCommits} from '../scripts/kernel/settle-landed.mjs';
import {loadContractChanges} from '../scripts/kernel/contract-version.mjs';

// Authored Work lands like code (contract change authoring-ops-commit-work, reach new-legs): the
// Work-authoring ops declare a committing commitPolicy, so api report owes head and api settle
// refuses not-landed while a Work record path the job owns is untracked; an older leg reports and
// settles as it was admitted; api reconcile --work-debt lists what settled legs left uncommitted
// and the commit-only enqueue that repairs each. A tmp git checkout is the target and the ledger repo.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const AUTHORING=['scope.define','business.decide','architecture.decide','work.author','brand.decide'];
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// The ledger lives under .starciwork/ too, so the checkout ignores only the ledger's own files.
const checkout=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-work-landed-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(dir,'work');
  fs.mkdirSync(path.join(repo,'.starciwork','features','collab'),{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  const ledger=path.relative(repo,ledgerFileFor(repo)).replaceAll('\\','/');
  fs.writeFileSync(path.join(repo,'.gitignore'),`${ledger}*\n${path.posix.dirname(ledger)}/*.lock\n`);
  fs.writeFileSync(path.join(repo,'.starciwork','features','collab','index.yaml'),'id: collab\n');
  git(repo,'add','.');
  git(repo,'commit','--quiet','-m','init');
  const write=(rel,body)=>{fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),body);};
  const commit=(rel,body)=>{write(rel,body);git(repo,'add',rel);git(repo,'commit','--quiet','-m',`edit ${rel}`);return git(repo,'rev-parse','HEAD');};
  return {dir,repo,write,commit};
};
// The registry api reads (STARCI_CONTRACT_CHANGES) with authoring-ops-commit-work in force from `at`.
const registryAt=(dir,at)=>{
  const file=path.join(dir,'contract-changes.yaml');
  fs.writeFileSync(file,`schema: starci/contract-changes@1\nchanges:\n  - id: ${WORK_COMMIT_CHANGE}\n    effectiveAt: '${new Date(at).toISOString()}'\n    summary: spec\n    ops: [${AUTHORING.join(', ')}]\n    reach: new-legs\n`);
  return {STARCI_CONTRACT_CHANGES:file};
};
const api=(env,...args)=>{
  const r=spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,...env}});
  let body=null;try{body=JSON.parse(r.stdout);}catch{}
  return {r,body};
};
const OWNED='.starciwork/features/collab/';
// A job of `op` owning the collab feature record, admitted at `admittedAt`, with (optionally) a
// filed done report and green recorded checks.
const seedJob=(repo,{op='scope.define',jobId='op-work-1',wf='wf-work',admittedAt=Date.now()-60_000,report,status='running'})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.ensureWorkflow({workflowId:wf,title:'work'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:op,kind:'op',payload:{opId:op,owned_paths:[OWNED],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},...(status==='succeeded'?{settledAt:admittedAt+1000}:{})}});
    ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,1,`ctx-${jobId}`,'# contract',json({worktree:repo}),admittedAt);
    if(report)ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,op,1,0,'done',json(report),null,admittedAt);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,op,1,json({checks:[{name:'starci-validate',exitCode:0}]}),admittedAt);
  }finally{ledger.close();}
  return jobId;
};
const jobRow=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);}finally{l.close();}};

test('the five Work-authoring ops declare a committing commitPolicy and a landed proof; the live registry governs them',()=>{
  for(const op of AUTHORING){
    const brief=parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops',`${op}.yaml`),'utf8'));
    assert.equal(policyCommits(commitPolicyOf(brief)),true,`${op} commits`);
    assert.equal(commitPolicyOf(brief).push,false,`${op} never pushes`);
    assert.ok(brief.proofs.some(proof=>proof.id==='landed'),`${op} proves its Work landed`);
  }
  const change=loadContractChanges(ROOT).changes.find(c=>c.id===WORK_COMMIT_CHANGE);
  assert.ok(change,'registered in modules/kernel/contract-changes.yaml');
  assert.equal(change.reach,'new-legs');
  assert.deepEqual([...change.ops].sort(),[...AUTHORING].sort());
});

test('admittedCommitPolicy: an older leg of a governed op owes no commit; a newer one and other ops keep theirs',()=>{
  const policy={mode:'scoped-local-commit',push:false};
  const registry={changes:[{id:WORK_COMMIT_CHANGE,effectiveAt:1000,ops:['scope.define'],safetyCritical:false}]};
  assert.equal(admittedCommitPolicy({policy,op:'scope.define',admittedAt:999,registry}),null);
  assert.equal(admittedCommitPolicy({policy,op:'scope.define',admittedAt:1000,registry}),policy);
  assert.equal(admittedCommitPolicy({policy,op:'backend.implement',admittedAt:1,registry}),policy,'a code op committed before the change');
  assert.equal(admittedCommitPolicy({policy,op:'scope.define',admittedAt:null,registry}),policy,'not yet admitted: the current contract');
  assert.equal(admittedCommitPolicy({policy,op:'scope.define',admittedAt:1,registry:{changes:[]}}),policy,'unregistered: the current contract');
});

test('api settle: a new scope.define leg whose Work record is untracked is refused not-landed; committed at head it settles',t=>{
  const {dir,repo,write,commit}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  write(`${OWNED}scope/scope.yaml`,'id: scope.collab\n');
  const head=git(repo,'rev-parse','HEAD');
  const jobId=seedJob(repo,{report:{outcome:'done',summary:'scoped',head,branch:'main'}});
  const refused=api(env,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(refused.r.status,1,refused.r.stderr||refused.r.stdout);
  assert.equal(refused.body.reason,'not-landed');
  assert.deepEqual(refused.body.detail.dirty,[`${OWNED}scope/scope.yaml`]);
  assert.equal(jobRow(repo,jobId).status,'running','a refused settle writes nothing');

  commit(`${OWNED}scope/scope.yaml`,'id: scope.collab\n');
  const settled=api(env,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(settled.r.status,0,settled.r.stderr||settled.r.stdout);
  assert.equal(jobRow(repo,jobId).status,'succeeded');
});

test('api settle and report: a leg admitted before the change settles and reports on its admitted contract',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()+3_600_000);
  write(`${OWNED}scope/scope.yaml`,'id: scope.collab\n');
  const older=seedJob(repo,{report:{outcome:'done',summary:'scoped'}});
  const settled=api(env,'settle','--repo',repo,'--job',older,'--verdict','pass','--json');
  assert.equal(settled.r.status,0,settled.r.stderr||settled.r.stdout);
  assert.equal(settled.body.landed,undefined,'no landed proof for an older authoring leg');

  const file=path.join(dir,'report.json');
  fs.writeFileSync(file,json({outcome:'done',summary:'authored'}));
  const olderReport=seedJob(repo,{op:'work.author',jobId:'op-work-2',wf:'wf-work-2'});
  const accepted=api(env,'report','--repo',repo,'--job',olderReport,'--report',file,'--json');
  assert.equal(accepted.r.status,0,accepted.r.stderr);

  const newer=registryAt(dir,Date.now()-3_600_000);
  const newReport=seedJob(repo,{op:'work.author',jobId:'op-work-3',wf:'wf-work-3'});
  const refused=api(newer,'report','--repo',repo,'--job',newReport,'--report',file,'--json');
  assert.equal(refused.r.status,1,refused.r.stdout);
  assert.match(refused.r.stderr,/git rev-parse HEAD/,'a new authoring leg owes head');
});

test('reconcile --work-debt lists settled uncommitted Work with its commit-only enqueue; the enqueue records the repair',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  const settledAt=Date.now()-60_000;
  write(`${OWNED}business/br.yaml`,'id: br.collab\n');
  write(`${OWNED}business/br-2.yaml`,'id: br.collab.2\n');
  fs.utimesSync(path.join(repo,OWNED,'business','br.yaml'),new Date(settledAt-5000),new Date(settledAt-5000));
  fs.utimesSync(path.join(repo,OWNED,'business','br-2.yaml'),new Date(settledAt-5000),new Date(settledAt-5000));
  const jobId=seedJob(repo,{op:'business.decide',jobId:'op-biz-1',status:'succeeded',admittedAt:settledAt-1000,report:{outcome:'done',summary:'decided'}});
  write(`${OWNED}evidence/later.yaml`,'written after the job settled\n');

  assert.deepEqual(ownedPathsDirty({base:repo,ownedPaths:[OWNED]}).repos[0].dirty.sort(),
    [`${OWNED}business/br-2.yaml`,`${OWNED}business/br.yaml`,`${OWNED}evidence/later.yaml`]);

  const listed=api(env,'reconcile','--repo',repo,'--work-debt','--workflow','wf-work','--json');
  assert.equal(listed.r.status,0,listed.r.stderr);
  assert.equal(listed.body.owed,1);
  const [debt]=listed.body.debts;
  assert.equal(debt.jobId,jobId);
  assert.deepEqual([...debt.paths].sort(),[`${OWNED}business/br-2.yaml`,`${OWNED}business/br.yaml`]);
  assert.deepEqual(debt.laterWrites,[`${OWNED}evidence/later.yaml`],'a later write is never the settled job\'s debt');
  assert.match(debt.enqueue,/ enqueue --repo .* --op business\.decide --paths .* --commit-only-of op-biz-1$/);

  const argv=debt.enqueue.split(' ').slice(2);
  const enq=api(env,...argv,'--json');
  assert.equal(enq.r.status,0,enq.r.stderr||enq.r.stdout);
  const repair=jobRow(repo,enq.body.job_id);
  const payload=JSON.parse(repair.payload_json);
  assert.deepEqual(payload.commitOnly,{of:jobId});
  assert.deepEqual([...payload.owned_paths].sort(),[...debt.paths].sort());

  const again=api(env,'reconcile','--repo',repo,'--work-debt','--workflow','wf-work','--json');
  assert.equal(again.body.owed,0);
  assert.equal(again.body.debts[0].repairPending,enq.body.job_id);
  assert.equal(again.body.debts[0].enqueue,null);

  const wrongOp=api(env,'enqueue','--repo',repo,'--workflow','wf-work','--op','scope.define','--paths',`${OWNED}business/br.yaml`,'--commit-only-of',jobId,'--json');
  assert.equal(wrongOp.r.status,1);
  assert.match(wrongOp.r.stderr,/commit-only-of-invalid/);
});
