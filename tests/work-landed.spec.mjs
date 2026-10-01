import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {WORK_COMMIT_CHANGE,admittedCommitPolicy,commitPolicyOf,ownedPathsDirty,policyCommits,specBatches} from '../scripts/kernel/settle-landed.mjs';
import {loadContractChanges} from '../scripts/kernel/contract-version.mjs';
import {writeGreenProofs} from './helpers/sonar-scan.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';
import {jobRowOf} from '../scripts/kernel/api-lib/rows.mjs';

// Authored Work lands like code (contract changes authoring-ops-commit-work and
// work-writing-ops-commit-work, reach new-legs): every op that writes canonical Work - the five
// authoring ops and the four work-writing ops the first rollout missed (provision.ask,
// decision.prepare, interface.draw, workspace.manage) - declares a committing commitPolicy, so api
// report owes head and api settle refuses not-landed while a Work record path the job owns is
// untracked; an older leg reports and settles as it was admitted; api reconcile --work-debt lists
// what settled legs left uncommitted and the commit-only enqueue that repairs each. A tmp git
// checkout is the target and the ledger repo.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const AUTHORING=['scope.define','business.decide','architecture.decide','work.author','brand.decide'];
const WORK_WRITING=[...AUTHORING,'provision.ask','decision.prepare','interface.draw','workspace.manage'];
const WORK_WRITING_CHANGE='work-writing-ops-commit-work';
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
// The governed set the live registry declares: the ops of modules/kernel/contract-changes.yaml's
// authoring-ops-commit-work entry, which is where the api reads it from (admittedCommitPolicy,
// reconcile --work-debt). The specs mirror the live entry into their seam so that a change to the
// governed list is exercised here, not hidden behind a hardcoded list.
const governedOps=()=>loadContractChanges(ROOT).changes.find(c=>c.id===WORK_COMMIT_CHANGE)?.ops??[];
// The registry api reads (STARCI_CONTRACT_CHANGES) with authoring-ops-commit-work in force from `at`.
const registryAt=(dir,at)=>{
  const file=path.join(dir,'contract-changes.yaml');
  fs.writeFileSync(file,`schema: starci/contract-changes@1\nchanges:\n  - id: ${WORK_COMMIT_CHANGE}\n    effectiveAt: '${new Date(at).toISOString()}'\n    summary: spec\n    ops: [${governedOps().join(', ')}]\n    reach: new-legs\n`);
  return {STARCI_CONTRACT_CHANGES:file};
};
const api=(env,...args)=>{
  const r=spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,...env}});
  let body=null;try{body=JSON.parse(r.stdout);}catch{}
  return {r,body};
};
const OWNED='.starciwork/features/collab/';
const scratchFor=(repo,jobId)=>{const dir=path.join(path.dirname(repo),'scratch',jobId);fs.mkdirSync(dir,{recursive:true});return dir;};
const reportFile=(repo,jobId,body)=>{const file=path.join(scratchFor(repo,jobId),'report.json');fs.writeFileSync(file,json(body));return file;};
// A job of `op` owning the collab feature record, admitted at `admittedAt`, with (optionally) a
// filed done report and green recorded checks.
const seedJob=(repo,{op='scope.define',jobId='op-work-1',wf='wf-work',admittedAt=Date.now()-60_000,report,status='running',attempt=1,owned=[OWNED]})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const first=!ledger.db.prepare('SELECT 1 FROM goals WHERE workflow_id=?').get(wf);
    seedWorkflow(ledger,{id:wf,now:admittedAt,goal:first?{revision:1,markdown:'Work landed fixture goal',json:{}}:null,jobs:[{jobId,opId:op,status,
      createdAt:admittedAt,updatedAt:status==='succeeded'?admittedAt+1000:admittedAt,
      dispatchId:`ctx-${jobId}`,terminalHandle:`term-${jobId}`,
      payload:{opId:op,owned_paths:owned,orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},
        ...(status==='succeeded'?{settledAt:admittedAt+1000}:{})}}]});
    if(status!=='queued'){
      const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
      ledger.write.updateAttempt({attemptId,scratchDir:scratchFor(repo,jobId)});
      ledger.write.writeContract({attemptId,markdown:'# contract',context:{worktree:repo},createdAt:admittedAt});
      // The deciding and authoring ops owe their READ digest (and work.author its document gate) at settle (knowledge/op-gate.yaml
      // opProofs): the green ones ride beside the report, in the job scratch.
      if(report)ledger.write.fileReport({attemptId,outcome:'done',report:{...report,files:[...(report.files??[]),...writeGreenProofs(scratchFor(repo,jobId))]},createdAt:admittedAt});
      ledger.write.recordCheckRun({attemptId,name:'starci-validate',phase:'verify',runner:'kernel',status:'pass',exitCode:0,createdAt:admittedAt});
    }
  }finally{ledger.close();}
  return jobId;
};
const jobRow=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return jobRowOf(l.db,jobId);}finally{l.close();}};

test('every canonical-Work-writing op declares a committing commitPolicy and a landed proof; the live registry governs them',()=>{
  for(const op of WORK_WRITING){
    const brief=parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops',`${op}.yaml`),'utf8'));
    assert.equal(policyCommits(commitPolicyOf(brief)),true,`${op} commits`);
    assert.equal(commitPolicyOf(brief).push,false,`${op} never pushes`);
    assert.ok(brief.proofs.some(proof=>proof.id==='landed'),`${op} proves its Work landed`);
  }
  const changes=loadContractChanges(ROOT).changes;
  const change=changes.find(c=>c.id===WORK_COMMIT_CHANGE);
  assert.ok(change,'registered in modules/kernel/contract-changes.yaml');
  assert.equal(change.reach,'new-legs');
  assert.deepEqual([...change.ops].sort(),[...WORK_WRITING].sort(),'the governed set is every Work-writing op');
  const rollout=changes.find(c=>c.id===WORK_WRITING_CHANGE);
  assert.ok(rollout,'the second rollout is registered in modules/kernel/contract-changes.yaml');
  assert.equal(rollout.reach,'new-legs');
  assert.deepEqual([...rollout.ops].sort(),WORK_WRITING.filter(op=>!AUTHORING.includes(op)).sort());
  for(const op of WORK_WRITING.filter(op=>!AUTHORING.includes(op)))assert.ok(rollout.paths.includes(`modules/ops/ops/${op}.yaml`),`${op}'s manifest is named`);
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

  const olderReport=seedJob(repo,{op:'work.author',jobId:'op-work-2',wf:'wf-work-2'});
  const file=reportFile(repo,olderReport,{outcome:'done',summary:'authored'});
  const accepted=api(env,'report','--repo',repo,'--job',olderReport,'--report',file,'--json');
  assert.equal(accepted.r.status,0,accepted.r.stderr);

  const newer=registryAt(dir,Date.now()-3_600_000);
  const newReport=seedJob(repo,{op:'work.author',jobId:'op-work-3',wf:'wf-work-3'});
  const refused=api(newer,'report','--repo',repo,'--job',newReport,'--report',reportFile(repo,newReport,{outcome:'done',summary:'authored'}),'--json');
  assert.equal(refused.r.status,1,refused.r.stdout);
  assert.match(refused.r.stderr,/git rev-parse HEAD/,'a new authoring leg owes head');
});

// The four the first rollout missed (provision.ask, decision.prepare, interface.draw,
// workspace.manage) are governed exactly like the five: their manifests commit, the live registry's
// governed set names them, and api reconcile --work-debt lists what their settled legs left behind.
test('api settle: a new decision.prepare leg whose decision record is untracked is refused not-landed; committed at head it settles',t=>{
  const {dir,repo,write,commit}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  write(`${OWNED}decision/d1/index.yaml`,'id: decision.collab.d1\n');
  const head=git(repo,'rev-parse','HEAD');
  const jobId=seedJob(repo,{op:'decision.prepare',report:{outcome:'done',summary:'prepared',head,branch:'main'}});
  const refused=api(env,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(refused.r.status,1,refused.r.stderr||refused.r.stdout);
  assert.equal(refused.body.reason,'not-landed');
  assert.deepEqual(refused.body.detail.dirty,[`${OWNED}decision/d1/index.yaml`]);
  assert.equal(jobRow(repo,jobId).status,'running','a refused settle writes nothing');

  commit(`${OWNED}decision/d1/index.yaml`,'id: decision.collab.d1\n');
  const settled=api(env,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(settled.r.status,0,settled.r.stderr||settled.r.stdout);
  assert.equal(jobRow(repo,jobId).status,'succeeded');
});

test('api report: a newly governed op (provision.ask) owes head; a leg admitted before the change does not',t=>{
  const {dir,repo}=checkout(t);
  const before=registryAt(dir,Date.now()+3_600_000);
  const older=seedJob(repo,{op:'provision.ask',jobId:'op-ask-1',wf:'wf-ask-1'});
  const accepted=api(before,'report','--repo',repo,'--job',older,'--report',reportFile(repo,older,{outcome:'done',summary:'asked'}),'--json');
  assert.equal(accepted.r.status,0,accepted.r.stderr,'an older leg of a newly governed op reports as it was admitted');

  const after=registryAt(dir,Date.now()-3_600_000);
  const newer=seedJob(repo,{op:'provision.ask',jobId:'op-ask-2',wf:'wf-ask-2'});
  const refused=api(after,'report','--repo',repo,'--job',newer,'--report',reportFile(repo,newer,{outcome:'done',summary:'asked'}),'--json');
  assert.equal(refused.r.status,1,refused.r.stdout);
  assert.match(refused.r.stderr,/git rev-parse HEAD/,'a newly governed leg owes head');
});

test('reconcile --work-debt governs the four too: a settled workspace.manage leg\'s untracked workspace.yaml is its debt',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  const settledAt=Date.now()-60_000;
  write('.starciwork/workspace.yaml','id: workspace.collab\n');
  fs.utimesSync(path.join(repo,'.starciwork','workspace.yaml'),new Date(settledAt-5000),new Date(settledAt-5000));
  const jobId=seedJob(repo,{op:'workspace.manage',jobId:'op-ws-1',status:'succeeded',admittedAt:settledAt-1000,owned:['.starciwork/workspace.yaml'],report:{outcome:'done',summary:'prepared'}});
  const listed=api(env,'reconcile','--repo',repo,'--work-debt','--json');
  assert.equal(listed.r.status,0,listed.r.stderr);
  assert.equal(listed.body.owed,1);
  assert.equal(listed.body.debts[0].jobId,jobId);
  assert.deepEqual(listed.body.debts[0].paths,['.starciwork/workspace.yaml']);
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
  assert.deepEqual(listed.body.unattributed.map(u=>u.file),[`${OWNED}evidence/later.yaml`],'a later write is never the settled job\'s debt');
  assert.deepEqual(debt.attributedBy,{report:0,window:2});
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

// A job row brought to where a pass can settle: running, its contract, a done report naming head, green checks.
const armForSettle=(repo,jobId,{head,admittedAt=Date.now()-60_000})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const job=ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    const payload=JSON.parse(job.payload_json);
    payload.orca={dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`};
    ledger.write.updateJob({jobId,payload});
    ledger.write.setJobStatus({jobId,to:'ready',reason:'fixture admission'});
    ledger.write.setJobStatus({jobId,to:'leased',reason:'fixture admission',leaseToken:`lease-${jobId}`});
    const {attempt_id:attemptId}=ledger.write.startAttempt({workflowId:job.workflow_id,jobId,dispatchId:`ctx-${jobId}`});
    ledger.write.setJobStatus({jobId,to:'running',reason:'fixture dispatch'});
    ledger.write.updateAttempt({attemptId,scratchDir:scratchFor(repo,jobId)});
    ledger.write.writeContract({attemptId,markdown:'# contract',context:{worktree:repo},createdAt:admittedAt});
    ledger.write.fileReport({attemptId,outcome:'done',report:{outcome:'done',summary:'committed',head,branch:'main'},createdAt:admittedAt});
    ledger.write.recordCheckRun({attemptId,name:'starci-validate',phase:'verify',runner:'kernel',status:'pass',exitCode:0,createdAt:admittedAt});
  }finally{ledger.close();}
};
// Settled `op` jobs of wf-batch, each having written `files` (backdated before it settled) and left them untracked.
const seedDebt=(repo,write,jobs)=>{
  const settledAt=Date.now()-60_000;
  const attempts={};
  for(const {jobId,op,files,owned} of jobs){
    attempts[op]=(attempts[op]??0)+1;
    for(const rel of files){write(rel,`id: ${rel}\n`);fs.utimesSync(path.join(repo,rel),new Date(settledAt-5000),new Date(settledAt-5000));}
    seedJob(repo,{op,jobId,wf:'wf-batch',status:'succeeded',admittedAt:settledAt-1000,report:{outcome:'done',summary:'authored'},attempt:attempts[op],owned});
  }
};

test('batched repair: reconcile prints one --commit-only-work-debt per op; the batch owns the union, the landed proof checks all of it',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  seedDebt(repo,write,[
    {jobId:'op-biz-a',owned:[`${OWNED}business/a/`],op:'business.decide',files:[`${OWNED}business/a/a.yaml`,`${OWNED}business/a/b.yaml`]},
    {jobId:'op-biz-b',owned:[`${OWNED}business/c/`],op:'business.decide',files:[`${OWNED}business/c/c.yaml`]},
    {jobId:'op-arch-a',owned:[`${OWNED}architecture/`],op:'architecture.decide',files:[`${OWNED}architecture/x.yaml`]},
  ]);
  const listed=api(env,'reconcile','--repo',repo,'--work-debt','--workflow','wf-batch','--json');
  assert.equal(listed.r.status,0,listed.r.stderr);
  const byOp=Object.fromEntries(listed.body.batches.map(b=>[b.op,b]));
  assert.deepEqual(Object.keys(byOp).sort(),['architecture.decide','business.decide']);
  assert.deepEqual([...byOp['business.decide'].jobs].sort(),['op-biz-a','op-biz-b']);
  assert.equal(byOp['business.decide'].files,3);
  assert.match(byOp['business.decide'].enqueue,/ enqueue --repo .* --workflow wf-batch --op business\.decide --commit-only-work-debt$/);

  const enq=api(env,...byOp['business.decide'].enqueue.split(' ').slice(2),'--json');
  assert.equal(enq.r.status,0,enq.r.stderr||enq.r.stdout);
  const payload=JSON.parse(jobRow(repo,enq.body.job_id).payload_json);
  assert.deepEqual({...payload.commitOnly,of:[...payload.commitOnly.of].sort()},{of:['op-biz-a','op-biz-b'],batch:'work-debt'});
  assert.deepEqual([...payload.owned_paths].sort(),[`${OWNED}business/a/a.yaml`,`${OWNED}business/a/b.yaml`,`${OWNED}business/c/c.yaml`]);

  const after=api(env,'reconcile','--repo',repo,'--work-debt','--workflow','wf-batch','--json');
  assert.deepEqual(after.body.batches.map(b=>b.op),['architecture.decide'],'the batched jobs are repairPending');
  assert.ok(after.body.debts.filter(d=>d.op==='business.decide').every(d=>d.repairPending===enq.body.job_id&&d.enqueue===null));
  const none=api(env,'enqueue','--repo',repo,'--workflow','wf-batch','--op','business.decide','--commit-only-work-debt','--json');
  assert.equal(none.r.status,1);
  assert.equal(none.body.reason,'no-work-debt');

  git(repo,'add','--',`${OWNED}business/a/a.yaml`,`${OWNED}business/a/b.yaml`);
  git(repo,'commit','--quiet','-m','commit part of the batch');
  armForSettle(repo,enq.body.job_id,{head:git(repo,'rev-parse','HEAD')});
  const partial=api(env,'settle','--repo',repo,'--job',enq.body.job_id,'--verdict','pass','--json');
  assert.equal(partial.r.status,1,partial.r.stdout);
  assert.equal(partial.body.reason,'not-landed');
  assert.deepEqual(partial.body.detail.dirty,[`${OWNED}business/c/c.yaml`],'one uncommitted file of the union refuses the whole batch');

  git(repo,'add','--',`${OWNED}business/c/c.yaml`);
  git(repo,'commit','--quiet','-m','commit the rest');
  const landed=api(env,'settle','--repo',repo,'--job',enq.body.job_id,'--verdict','pass','--json');
  assert.equal(landed.r.status,0,landed.r.stderr||landed.r.stdout);
  assert.equal(jobRow(repo,enq.body.job_id).status,'succeeded');
});

test('--commit-only-of takes several jobs of one op; another op\'s job, or mixing with the batch flag, is refused',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  seedDebt(repo,write,[
    {jobId:'op-w-a',owned:[`${OWNED}work/a/`],op:'work.author',files:[`${OWNED}work/a/a.yaml`]},
    {jobId:'op-w-b',owned:[`${OWNED}work/b/`],op:'work.author',files:[`${OWNED}work/b/b.yaml`]},
    {jobId:'op-s-a',owned:[`${OWNED}scope/`],op:'scope.define',files:[`${OWNED}scope/s.yaml`]},
  ]);
  const both=api(env,'enqueue','--repo',repo,'--workflow','wf-batch','--op','work.author','--paths',`${OWNED}work/a/a.yaml,${OWNED}work/b/b.yaml`,'--commit-only-of','op-w-a,op-w-b','--json');
  assert.equal(both.r.status,0,both.r.stderr);
  assert.deepEqual(JSON.parse(jobRow(repo,both.body.job_id).payload_json).commitOnly,{of:['op-w-a','op-w-b']});
  const other=api(env,'reconcile','--repo',repo,'--work-debt','--workflow','wf-other','--json');
  assert.deepEqual(other.body.debts,[],'--work-debt takes no value, so --workflow still filters');
  const mixed=api(env,'enqueue','--repo',repo,'--workflow','wf-batch','--op','work.author','--paths',`${OWNED}scope/s.yaml`,'--commit-only-of','op-s-a','--json');
  assert.equal(mixed.r.status,1);
  assert.match(mixed.r.stderr,/commit-only-of-invalid/);
  const conflict=api(env,'enqueue','--repo',repo,'--workflow','wf-batch','--op','scope.define','--paths',`${OWNED}scope/s.yaml`,'--commit-only-work-debt','--json');
  assert.equal(conflict.r.status,1);
  assert.match(conflict.r.stderr,/commit-only-conflict/);
});

// A Windows checkout stores ':' in a file name as U+F03A; without -z git status C-quotes it as
// octal escapes and the dirty path no longer round-trips (inc-e7e54ba0b970).
test('a file name carrying U+F03A (the Windows colon) under owned paths round-trips through git status',t=>{
  const {repo,write}=checkout(t);
  const rel=`${OWNED}scope/-change\uf03a`;
  write(rel,'id: x\n');
  const found=ownedPathsDirty({base:repo,ownedPaths:[OWNED]});
  assert.equal(found.error,undefined,JSON.stringify(found));
  assert.deepEqual(found.repos[0].dirty,[rel]);
});

test('a batch of hundreds of long exact paths is read in bounded git calls (Windows argv limit)',t=>{
  const {repo,write}=checkout(t);
  const files=Array.from({length:420},(_,i)=>`${OWNED}architecture/decisions/${'long-segment-name-'.repeat(4)}${String(i).padStart(4,'0')}.yaml`);
  assert.ok(files.join(' ').length>32_767,'the fixture must exceed one argv');
  for(const rel of files)write(rel,'id: x\n');
  const found=ownedPathsDirty({base:repo,ownedPaths:files});
  assert.equal(found.error,undefined,JSON.stringify(found));
  assert.equal(found.repos[0].dirty.length,files.length);
  assert.deepEqual(specBatches(['a','b']),[['a','b']]);
  assert.ok(specBatches(files).length>1);
});

// A file's mtime pinned at `at`.
const touch=(repo,rel,at)=>fs.utimesSync(path.join(repo,rel),new Date(at),new Date(at));
const finish=(repo,wf)=>{const l=openLedger({file:ledgerFileFor(repo)});try{l.ensureWorkflow({workflowId:wf,phase:'running',title:wf});l.write.changeWorkflowPhase({workflowId:wf,to:'finished',by:'test-fixture',reason:'finished for adoption'});}finally{l.close();}};

test('attribution: the report files first, then the run window; a file neither names is unattributed and never batched',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  const now=Date.now(),hour=3_600_000;
  // an OLD finished leg and a NEW live leg both own the whole feature directory
  write(`${OWNED}business/listed.yaml`,'x\n');touch(repo,`${OWNED}business/listed.yaml`,now-60_000);
  write(`${OWNED}business/new.yaml`,'x\n');touch(repo,`${OWNED}business/new.yaml`,now-60_000);
  write(`${OWNED}business/old.yaml`,'x\n');touch(repo,`${OWNED}business/old.yaml`,now-3*hour+10_000);
  write(`${OWNED}business/stray.yaml`,'x\n');touch(repo,`${OWNED}business/stray.yaml`,now-2*hour);
  seedJob(repo,{op:'business.decide',jobId:'op-old',wf:'wf-old',status:'succeeded',admittedAt:now-3*hour,
    report:{outcome:'done',summary:'old',files:[`${OWNED}business/listed.yaml`]}});
  finish(repo,'wf-old');
  seedJob(repo,{op:'business.decide',jobId:'op-new',wf:'wf-live',status:'succeeded',admittedAt:now-90_000,report:{outcome:'done',summary:'new'}});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{ledger.db.prepare("UPDATE reports SET created_at=? WHERE dispatch_id='ctx-op-old'").run(now-3*hour+30_000);
    ledger.db.prepare("UPDATE jobs SET updated_at=? WHERE job_id='op-old'").run(now-3*hour+30_000);}finally{ledger.close();}

  const all=api(env,'reconcile','--repo',repo,'--work-debt','--json');
  assert.equal(all.r.status,0,all.r.stderr);
  const byJob=Object.fromEntries(all.body.debts.map(d=>[d.jobId,d]));
  assert.deepEqual(byJob['op-old'].paths.sort(),[`${OWNED}business/listed.yaml`,`${OWNED}business/old.yaml`],'named by its report, or written inside its run');
  assert.deepEqual(byJob['op-old'].attributedBy,{report:1,window:1});
  assert.equal(byJob['op-old'].workflowFinished,true);
  assert.deepEqual(byJob['op-new'].paths,[`${OWNED}business/new.yaml`],'the newest covering job no longer takes files it did not write');
  assert.deepEqual(all.body.unattributed.map(u=>u.file),[`${OWNED}business/stray.yaml`]);
  assert.deepEqual(all.body.batches.map(b=>[b.workflowId,b.files]),[['wf-live',1]],'only the live workflow\'s own debt is batched');

  const live=api(env,'enqueue','--repo',repo,'--workflow','wf-live','--op','business.decide','--commit-only-work-debt','--json');
  assert.equal(live.r.status,0,live.r.stderr);
  assert.deepEqual(JSON.parse(jobRow(repo,live.body.job_id).payload_json).owned_paths,[`${OWNED}business/new.yaml`]);
});

test('adoption: a live workflow adopts a finished workflow\'s debt inside its Work scope; the repo owner takes what no live scope covers',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  const now=Date.now();
  const SHELL='.starciwork/shell/';
  for(const rel of [`${OWNED}architecture/a.yaml`,`${SHELL}layout.yaml`,'.starciwork/features/billing/sds/b.yaml']){write(rel,'x\n');touch(repo,rel,now-60_000);}
  seedJob(repo,{op:'architecture.decide',jobId:'op-fin',wf:'wf-fin',status:'succeeded',admittedAt:now-90_000,owned:['.starciwork/'],
    report:{outcome:'done',summary:'fin'}});
  finish(repo,'wf-fin');
  // wf-collab authors in the collab feature (one exact record); wf-billing in billing
  seedJob(repo,{op:'work.author',jobId:'op-collab',wf:'wf-collab',status:'queued',owned:[`${OWNED}work/w.yaml`]});
  seedJob(repo,{op:'work.author',jobId:'op-billing',wf:'wf-billing',status:'queued',owned:['.starciwork/features/billing/br/x.yaml']});

  const listed=api(env,'reconcile','--repo',repo,'--work-debt','--json');
  const [adoption]=listed.body.adoptions;
  assert.equal(adoption.from,'wf-fin');
  assert.deepEqual(adoption.candidates.map(c=>[c.workflowId,c.covers]).sort(),[['wf-billing',1],['wf-collab',1]],'scope widens to the feature directory');
  assert.equal(adoption.uncovered,1,'.starciwork/shell/ is in no live scope');
  assert.equal(adoption.repoOwner.workflowId,null,'two live workflows: the repo owner is named by the operator');

  const collab=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op','architecture.decide','--commit-only-work-debt','--adopt-from','wf-fin','--json');
  assert.equal(collab.r.status,0,collab.r.stderr);
  const payload=JSON.parse(jobRow(repo,collab.body.job_id).payload_json);
  assert.deepEqual(payload.owned_paths,[`${OWNED}architecture/a.yaml`]);
  assert.deepEqual(payload.commitOnly,{of:['op-fin'],batch:'work-debt',adoptedFrom:'wf-fin',outOfScope:2});

  const owner=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op','architecture.decide','--commit-only-work-debt','--adopt-from','wf-fin','--as-repo-owner','--json');
  assert.equal(owner.r.status,0,owner.r.stderr);
  assert.deepEqual(JSON.parse(jobRow(repo,owner.body.job_id).payload_json).owned_paths,[`${SHELL}layout.yaml`],'billing\'s file stays with billing; the already-adopted file is pending');

  const again=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op','architecture.decide','--commit-only-work-debt','--adopt-from','wf-fin','--as-repo-owner','--json');
  assert.equal(again.r.status,1);
  assert.equal(again.body.reason,'adopt-out-of-scope');
  const fromLive=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op','architecture.decide','--commit-only-work-debt','--adopt-from','wf-billing','--json');
  assert.match(fromLive.r.stderr,/adopt-from-live/);
  const ownerAlone=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op','architecture.decide','--paths',`${OWNED}x.yaml`,'--as-repo-owner','--json');
  assert.match(ownerAlone.r.stderr,/commit-only-conflict/);
});

test('adoption: with one live workflow the reconcile names it the repo owner',t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  const now=Date.now();
  write('.starciwork/features/work/br/a.yaml','x\n');touch(repo,'.starciwork/features/work/br/a.yaml',now-60_000);
  seedJob(repo,{op:'business.decide',jobId:'op-fin',wf:'wf-fin',status:'succeeded',admittedAt:now-90_000,owned:['.starciwork/features/work/'],report:{outcome:'done',summary:'fin'}});
  finish(repo,'wf-fin');
  seedJob(repo,{op:'brand.decide',jobId:'op-base',wf:'wf-base',status:'queued',owned:['.starciwork/brand/']});
  const [adoption]=api(env,'reconcile','--repo',repo,'--work-debt','--workflow','wf-base','--json').body.adoptions;
  assert.equal(adoption.repoOwner.workflowId,'wf-base');
  assert.match(adoption.repoOwner.enqueue,/--workflow wf-base --op business\.decide --commit-only-work-debt --adopt-from wf-fin --as-repo-owner$/);
  const enq=api(env,...adoption.repoOwner.enqueue.split(' ').slice(2),'--json');
  assert.equal(enq.r.status,0,enq.r.stderr);
  assert.deepEqual(JSON.parse(jobRow(repo,enq.body.job_id).payload_json).commitOnly.asRepoOwner,true);
});
