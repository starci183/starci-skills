import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
// Lane m13: settle is where an op's verdict becomes ledger truth. The verdict
// enum is the contract (modules/kernel/verdict-contract.yaml): pass|fail|blocked
// accepted, anything else refused with exit!=0 — a misspelled verdict must never
// write a settled row.
//
// The ledger module is canonical at engine/ledger-db.mjs post-flip (kernel/ is
// doomed); use whichever actually imports — engine/ can exist-but-be-mid-flip.
const LEDGER_MODULE=await (async()=>{
  for(const p of ['../engine/ledger-db.mjs','../kernel/ledger-db.mjs']){
    if(!fs.existsSync(path.join(ROOT,p.slice(3))))continue;
    try{return await import(p);}catch{/* landed but not yet wired — fall back */}
  }
  throw new Error('no importable ledger module at engine/ or kernel/');
})();
const {openLedger,inspectLedger,ledgerFileFor}=LEDGER_MODULE;

const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-verdict-'));dirs.push(dir);return dir;}};
};

/** One workflow + one queued op job, seeded through the ledger API then closed. */
const seedJob=(repo,jobId)=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId,workflowId:'wf-verdict',opId:'ex-test.probe',kind:'op',
      payload:{opId:'ex-test.probe',owned_paths:['docs/']}});
  }finally{ledger.close();}
};
const jobStatus=(repo,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}
  finally{ledger.close();}
};
const reportFile=(repo,outcome='done')=>{const f=path.join(repo,'report.json');fs.writeFileSync(f,JSON.stringify({
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
      seedJob(repo,jobId);
      // The report is filed row-first via `api report`; pass additionally needs the
      // kernel's independently recorded green checks (verdict-contract.yaml).
      const filed=runApi('report','--repo',repo,'--job',jobId,'--report',reportFile(repo,outcome),'--json');
      assert.equal(filed.status,0,filed.stderr||filed.error?.message);
      if(verdict==='pass'){
        const checked=runApi('check','--repo',repo,'--job',jobId,'--checks',JSON.stringify({checks:[{name:'self-check',command:'true',exitCode:0}]}),'--json');
        assert.equal(checked.status,0,checked.stderr||checked.error?.message);
      }
      const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict',verdict,'--json');
      assert.equal(r.status,0,r.stderr||r.error?.message);
      assert.equal(jobStatus(repo,jobId),expected);
    });
  }
});

test('settle rejects a garbage verdict with exit!=0 and leaves the job untouched',t=>{
  const repo=fixture(t).repo(),jobId='job-garbage';
  seedJob(repo,jobId);
  const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict','maybe','--report',reportFile(repo),'--json');
  assert.notEqual(r.status,0,`a verdict outside pass|fail|blocked must be refused, got exit ${r.status}: ${r.stdout}`);
  assert.equal(jobStatus(repo,jobId),'queued','a rejected verdict must not settle the job');
});

test('settle refuses a missing report file with exit!=0',t=>{
  const repo=fixture(t).repo(),jobId='job-no-report';
  seedJob(repo,jobId);
  const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--report',path.join(repo,'absent.json'),'--json');
  assert.notEqual(r.status,0,'a verdict without its evidence report is not a settle');
  assert.equal(jobStatus(repo,jobId),'queued');
});
