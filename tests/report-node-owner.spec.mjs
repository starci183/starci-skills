import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {jobScopedReportPath} from '../scripts/kernel/report-owner.mjs';

// nivo Collab inc-b915b61d8f9e: an interface.audit settled blocked, then a
// work.author committed the audit node's evidence and filed its done report at
// the node's report.json, clobbering the audit's verdict. A report path belongs
// to the op lineage that filed it first; another op's report is filed at
// report.<jobId>.json and the owner's report stays at the path
// (scripts/kernel/report-owner.mjs).

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WORKFLOW='wf-report-owner';
const NODE='node';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-report-owner-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(path.join(repo,NODE),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    LOCALAPPDATA:path.join(root,'localappdata')};
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
  return {root,repo,run};
};
const inspect=(fx,fn)=>{const l=inspectLedger({file:ledgerFileFor(fx.repo)});try{return fn(l.db);}finally{l.close();}};
const enqueue=(fx,jobId,op)=>{
  const l=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    l.enqueueJob({jobId,workflowId:WORKFLOW,opId:op,kind:'op',payload:{opId:op,owned_paths:[`${NODE}/`],model:'qwen-agent'}});
    l.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=? AND phase NOT IN ('running')").run(WORKFLOW);
  }finally{l.close();}
};
const dispatch=(fx,jobId)=>{
  const r=fx.run('dispatch','--repo',fx.repo,'--job',jobId,'--model','qwen-agent','--spawn','--json');
  assert.equal(r.status,0,`dispatch ${jobId}: ${r.stderr||r.stdout}`);
};
const emitted=stdout=>JSON.parse(stdout.slice(stdout.indexOf('{'),stdout.indexOf('\n}')+2));
const nodeReport=fx=>path.join(fx.repo,NODE,'report.json');
const writeReport=(fx,outcome,summary)=>{
  const file=nodeReport(fx);
  fs.writeFileSync(file,JSON.stringify({schema:'starci/op-report@1',outcome,summary,files:[`${NODE}/index.yaml`],
    ...(outcome==='done'?{head:'abc1234def'}:{}),
    ...(outcome==='blocked'?{blocker:{kind:'environment',detail:'the commit hook refused the evidence'}}:{})},null,2));
  return file;
};
const file=(fx,jobId,outcome,summary)=>{
  const r=fx.run('report','--repo',fx.repo,'--job',jobId,'--report',writeReport(fx,outcome,summary),'--json');
  assert.equal(r.status,0,`report ${jobId}: ${r.stderr||r.stdout}`);
  return {r,out:emitted(r.stdout)};
};
const settle=(fx,jobId,verdict,...extra)=>{
  const c=fx.run('check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({checks:[{name:'validator',exitCode:0}]}),'--json');
  assert.equal(c.status,0,c.stderr||c.stdout);
  const s=fx.run('settle','--repo',fx.repo,'--job',jobId,'--verdict',verdict,...extra,'--json');
  assert.equal(s.status,0,`settle ${jobId}: ${s.stderr||s.stdout}`);
  return JSON.parse(s.stdout);
};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));

test('a second op never clobbers the node report another op owns',t=>{
  const fx=fixture(t);
  enqueue(fx,'job-audit','code.refactor');
  dispatch(fx,'job-audit');
  file(fx,'job-audit','blocked','AUDIT-BLOCKED');
  settle(fx,'job-audit','blocked');

  enqueue(fx,'job-author','work.author');
  dispatch(fx,'job-author');
  const contract=inspect(fx,db=>db.prepare("SELECT markdown FROM contracts WHERE workflow_id=? AND op_id='work.author'").get(WORKFLOW).markdown);
  assert.match(contract,/report paths another op owns under your owned_paths: .*report\.json \(code\.refactor\)/,'the packet names the report path the audit owns');
  assert.match(contract,/report\.job-author\.json/);

  const {out}=file(fx,'job-author','done','AUTHOR-DONE');
  const scoped=jobScopedReportPath(nodeReport(fx),'job-author');
  assert.equal(path.basename(scoped),'report.job-author.json');
  assert.equal(readJson(nodeReport(fx)).outcome,'blocked','the node report still holds the owning audit verdict');
  assert.equal(readJson(nodeReport(fx)).from,'job-audit');
  assert.equal(readJson(scoped).summary,'AUTHOR-DONE','the second job report lives at its job-scoped path');
  assert.equal(out.report,scoped);
  assert.equal(out.relocatedFrom,nodeReport(fx));
  assert.equal(out.owner.jobId,'job-audit');
  assert.equal(out.restored,true);
  const filed=inspect(fx,db=>db.prepare("SELECT json_extract(payload_json,'$.report') r FROM events WHERE kind='report-filed' AND entity_id='job-author'").get().r);
  assert.equal(filed,scoped,'the ledger binds the second job to its own report file');

  // The Kernel settling the author with the node path reads the author's own report.
  const settled=settle(fx,'job-author','pass','--report',nodeReport(fx));
  assert.equal(settled.report,scoped);
  assert.equal(readJson(nodeReport(fx)).outcome,'blocked');
});

test('a retry of the owning op still files at the node report in place',t=>{
  const fx=fixture(t);
  enqueue(fx,'job-audit-1','code.refactor');
  dispatch(fx,'job-audit-1');
  file(fx,'job-audit-1','blocked','FIRST');
  settle(fx,'job-audit-1','blocked');

  enqueue(fx,'job-audit-2','code.refactor');
  dispatch(fx,'job-audit-2');
  const contract=inspect(fx,db=>db.prepare("SELECT markdown FROM contracts WHERE workflow_id=? AND markdown LIKE '%(job job-audit-2)%'").get(WORKFLOW)?.markdown);
  assert.ok(contract,'the retry has its contract');
  assert.doesNotMatch(contract,/report paths another op owns/);
  const written=writeReport(fx,'done','SECOND');
  const before=fs.readFileSync(written);
  const r=fx.run('report','--repo',fx.repo,'--job','job-audit-2','--report',written,'--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=emitted(r.stdout);
  assert.equal(out.report,nodeReport(fx));
  assert.equal(out.relocatedFrom,undefined);
  assert.deepEqual(fs.readFileSync(nodeReport(fx)),before,'the owning lineage report file is left byte-identical');
  assert.equal(fs.existsSync(jobScopedReportPath(nodeReport(fx),'job-audit-2')),false);
});
