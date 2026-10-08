import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
// Lane m13: settle is where an op's verdict becomes ledger truth. The verdict
// enum is the contract (modules/kernel/verdict-contract.yaml): pass|fail|blocked
// accepted, anything else refused with exit!=0 — a misspelled verdict must never
// write a settled row.
//
import {openLedger,inspectLedger,ledgerFileFor,ensureWorkflow,changeWorkflowPhase,createUnit,enqueueJob,setJobStatus,startAttempt} from '../../engine/db/ledger.mjs';
import {proofRepo,writeGreenProofs} from '../helpers/sonar-scan.mjs';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';
import {fileDispatchContract} from '../helpers/filed-contract.mjs';
import {allocateDispatchedScratch,releaseDispatchedScratchAfter} from '../helpers/dispatched-scratch.mjs';

const runApi=(args,{env={}}={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,...env}});

const bindings=new Map();
const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-verdict-'));dirs.push(dir);releaseDispatchedScratchAfter(t,dir);fs.mkdirSync(path.join(dir,'docs'));proofRepo(t,dir);return dir;}};
};

/** One workflow + one dispatched op job (running + a contract-bound open attempt,
 * the state `starci kernel report`/`settle` require), seeded through the ledger then closed.
 * The attempt's STARCI_JOB_SCRATCH is returned: starci kernel report reads the report file
 * out of it and nowhere else (H10). */
const seedJob=(repo,jobId)=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const wf='wf-verdict',dispatchId=`ctx-${jobId}`,unitId=`unit-${jobId}`;
    const scratch=allocateDispatchedScratch({repo,workflowId:wf,jobId});
    const at=Date.now();
    ledger.transaction(db=>{
      ensureWorkflow(db,{workflowId:wf,phase:'queued',title:'verdict fixture',by:'test-fixture',reason:'seed',at});
      changeWorkflowPhase(db,{workflowId:wf,to:'running',by:'test-fixture',reason:'seed',at});
      createUnit(db,{workflowId:wf,unitId,opId:'code.refactor',subjectKey:unitId,goalRevision:1,createdAt:at});
      enqueueJob(db,{jobId,workflowId:wf,unitId,opId:'code.refactor',role:'op',
        payload:{opId:'code.refactor',owned_paths:['docs/'],orca:{dispatchId,agentTerminalHandle:`term-${jobId}`}},createdAt:at});
      setJobStatus(db,{jobId,to:'ready',reason:'seed',at});
      setJobStatus(db,{jobId,to:'leased',reason:'seed',at});
      const attempt=startAttempt(db,{workflowId:wf,jobId,dispatchId,
        terminalHandle:`term-${jobId}`,scratchDir:scratch,dispatchedAt:at,startedAt:at,at});
      setJobStatus(db,{jobId,to:'running',reason:'seed',at});
    });
    registerWorkflowWorktree({env:process.env},{workflowId:wf,orcaWorktreeId:`verdict::${jobId}`,path:repo,branch:'main'});
    bindings.set(jobId,fileDispatchContract(ledger,{jobId,repo,createdAt:at}).packet.context.gate_binding);
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

/** The pass report carries the op's green proof files, which live outside the owned paths the CLI envelope admits: filed as the row the ledger keeps. */
const fileGreenReport=(repo,jobId,scratch)=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId).attempt_id;
    const files=writeGreenProofs(path.join(scratch,'proofs'),{root:repo,binding:bindings.get(jobId)});
    ledger.write.fileReport({attemptId,outcome:'done',report:{schema:'starci/op-report@1',outcome:'done',summary:'op done — verdict fixture',files,checks:[{name:'self-check',command:'true',exitCode:0}]}});
  }finally{ledger.close();}
};

test('settle accepts the contract verdicts pass|fail|blocked',async t=>{
  // verdict -> the op-report outcome the envelope must carry (verdict-outcome-mismatch otherwise)
  for(const [verdict,outcome,expected] of [['pass','done','succeeded'],['fail','failed','failed'],['blocked','blocked','failed']]){
    await t.test(`--verdict ${verdict} settles the job as ${expected}`,t=>{
      const repo=fixture(t).repo(),jobId=`job-${verdict}`;
      const scratch=seedJob(repo,jobId);
      // The report is filed row-first via `starci kernel report` out of the attempt's scratch;
      // pass additionally needs the kernel's independently recorded green checks
      // (verdict-contract.yaml) — recorded the way the settler records them, with
      // runtime authority (a caller-declared green never counts, H8).
      if(verdict==='pass')fileGreenReport(repo,jobId,scratch);
      else{
        const filed=runApi(['report','--repo',repo,'--job',jobId,'--report',reportFile(scratch,outcome),'--json']);
        assert.equal(filed.status,0,filed.stderr||filed.error?.message);
      }
      if(verdict==='pass'){
        const checked=runApi(['record-checks','--repo',repo,'--job',jobId,'--checks',JSON.stringify({checks:[{name:'self-check',command:'true',exitCode:0}]}),'--json'],{env:{STARCI_CALLER:'runtime-settler'}});
        assert.equal(checked.status,0,checked.stderr||checked.error?.message);
      }
      const r=runApi(['settle','--repo',repo,'--job',jobId,'--verdict',verdict,'--json']);
      assert.equal(r.status,0,r.stderr||r.stdout||r.error?.message);
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
