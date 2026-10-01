import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
// Lane m13: settle is where an op's verdict becomes ledger truth. The verdict
// enum is the contract (modules/kernel/verdict-contract.yaml): pass|fail|blocked
// accepted, anything else refused with exit!=0 — a misspelled verdict must never
// write a settled row.
//
// The ledger module is canonical at engine/db/ledger.mjs post-flip (kernel/ is
// doomed); use whichever actually imports — engine/ can exist-but-be-mid-flip.
const LEDGER_MODULE=await (async()=>{
  for(const p of ['../../engine/db/ledger.mjs','../kernel/ledger-db.mjs']){
    if(!fs.existsSync(path.join(ROOT,p.slice(3))))continue;
    try{return await import(p);}catch{/* landed but not yet wired — fall back */}
  }
  throw new Error('no importable ledger module at engine/ or kernel/');
})();
const {openLedger,inspectLedger,ledgerFileFor,ensureWorkflow,changeWorkflowPhase,createUnit,enqueueJob,setJobStatus,startAttempt,writeContract}=LEDGER_MODULE;

const runApi=(args,{env={}}={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,...env}});

const scratches=[];
const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of [...dirs,...scratches.splice(0)])fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-verdict-'));dirs.push(dir);return dir;}};
};

/** One workflow + one dispatched op job (running + a contract-bound open attempt,
 * the state `api report`/`settle` require), seeded through the ledger then closed.
 * The attempt's STARCI_JOB_SCRATCH is returned: api report reads the report file
 * out of it and nowhere else (H10). */
const seedJob=(repo,jobId)=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const wf='wf-verdict',dispatchId=`ctx-${jobId}`,unitId=`unit-${jobId}`;
    const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'starci-verdict-scratch-'));
    scratches.push(scratch);
    const at=Date.now();
    ledger.transaction(db=>{
      ensureWorkflow(db,{workflowId:wf,phase:'queued',title:'verdict fixture',by:'test-fixture',reason:'seed',at});
      changeWorkflowPhase(db,{workflowId:wf,to:'running',by:'test-fixture',reason:'seed',at});
      createUnit(db,{workflowId:wf,unitId,opId:'ex-test.probe',subjectKey:unitId,goalRevision:1,createdAt:at});
      enqueueJob(db,{jobId,workflowId:wf,unitId,opId:'ex-test.probe',role:'op',
        payload:{opId:'ex-test.probe',owned_paths:['docs/'],orca:{dispatchId,agentTerminalHandle:`term-${jobId}`}},createdAt:at});
      setJobStatus(db,{jobId,to:'ready',reason:'seed',at});
      setJobStatus(db,{jobId,to:'leased',reason:'seed',at});
      const attempt=startAttempt(db,{workflowId:wf,jobId,dispatchId,
        terminalHandle:`term-${jobId}`,scratchDir:scratch,dispatchedAt:at,startedAt:at,at});
      writeContract(db,{attemptId:attempt.attempt_id,markdown:'# contract',context:{},createdAt:at});
      setJobStatus(db,{jobId,to:'running',reason:'seed',at});
    });
    return scratch;
  }finally{ledger.close();}
};
const jobStatus=(repo,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}
  finally{ledger.close();}
};
const reportFile=(dir,outcome='done')=>{const f=path.join(dir,'report.json');fs.writeFileSync(f,JSON.stringify({
  schema:'starci/op-report@1',outcome,summary:`op ${outcome} — verdict fixture`,files:['docs/'],
  checks:[{name:'self-check',command:'true',exitCode:outcome==='done'?0:1}],
  ...(outcome==='blocked'?{blocker:{kind:'environment',detail:'dep missing'}}:{}),
  ...(outcome==='partial'?{open:['unfinished item']}:{}),
}));return f;};

test('settle accepts the contract verdicts pass|fail|blocked',async t=>{
  // verdict -> the op-report outcome the envelope must carry (verdict-outcome-mismatch otherwise)
  for(const [verdict,outcome,expected] of [['pass','done','succeeded'],['fail','failed','failed'],['blocked','blocked','failed']]){
    await t.test(`--verdict ${verdict} settles the job as ${expected}`,t=>{
      const repo=fixture(t).repo(),jobId=`job-${verdict}`;
      const scratch=seedJob(repo,jobId);
      // The report is filed row-first via `api report` out of the attempt's scratch;
      // pass additionally needs the kernel's independently recorded green checks
      // (verdict-contract.yaml) — recorded the way the settler records them, with
      // runtime authority (a caller-declared green never counts, H8).
      const filed=runApi(['report','--repo',repo,'--job',jobId,'--report',reportFile(scratch,outcome),'--json']);
      assert.equal(filed.status,0,filed.stderr||filed.error?.message);
      if(verdict==='pass'){
        const checked=runApi(['check','--repo',repo,'--job',jobId,'--checks',JSON.stringify({checks:[{name:'self-check',command:'true',exitCode:0}]}),'--json'],{env:{STARCI_CALLER:'runtime-settler'}});
        assert.equal(checked.status,0,checked.stderr||checked.error?.message);
      }
      const r=runApi(['settle','--repo',repo,'--job',jobId,'--verdict',verdict,'--json']);
      assert.equal(r.status,0,r.stderr||r.error?.message);
      assert.equal(jobStatus(repo,jobId),expected);
    });
  }
});

test('settle rejects a garbage verdict with exit!=0 and leaves the job untouched',t=>{
  const repo=fixture(t).repo(),jobId='job-garbage';
  const scratch=seedJob(repo,jobId);
  const r=runApi(['settle','--repo',repo,'--job',jobId,'--verdict','maybe','--report',reportFile(scratch),'--json']);
  assert.notEqual(r.status,0,`a verdict outside pass|fail|blocked must be refused, got exit ${r.status}: ${r.stdout}`);
  assert.equal(jobStatus(repo,jobId),'running','a rejected verdict must not settle the job');
});

test('settle refuses a missing report file with exit!=0',t=>{
  const repo=fixture(t).repo(),jobId='job-no-report';
  seedJob(repo,jobId);
  const r=runApi(['settle','--repo',repo,'--job',jobId,'--verdict','pass','--report',path.join(repo,'absent.json'),'--json']);
  assert.notEqual(r.status,0,'a verdict without its evidence report is not a settle');
  assert.equal(jobStatus(repo,jobId),'running');
});
