import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
// Lane k7: the owner->goal->kernel entry path. define-goal queues (workflows +
// goals rev 0 + pending inbox row); start-workflow claims. --plan on either is
// read-only by contract (modules/goal/define-goal.yaml, modules/kernel/
// start-workflow.yaml). The --project flag on define-goal lands in a sibling
// lane and is not covered here.
const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-'));dirs.push(dir);return dir;}};
};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};

test('define-goal --plan writes nothing to sqlite',t=>{
  const repo=fixture(t).repo(),file=ledgerFileFor(repo);
  const inboxBefore=fs.existsSync(file)
    ?read(repo,l=>l.db.prepare('SELECT count(*) n FROM inbox').get().n)
    :0;
  const r=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--plan','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.equal(out(r)?.plan,true,'--plan output should carry plan:true');
  if(!fs.existsSync(file))return; // the cleanest proof: --plan never even opened the ledger
  const inboxAfter=read(repo,l=>l.db.prepare('SELECT count(*) n FROM inbox').get().n);
  assert.equal(inboxAfter,inboxBefore,'--plan must not write inbox rows');
});

test('define-goal creates the workflow, goal revision 0 and a pending inbox row',t=>{
  const repo=fixture(t).repo();
  const r=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const workflowId=out(r)?.workflowId;
  assert.ok(workflowId,`define-goal --json should print workflowId, got: ${r.stdout}`);
  const rows=read(repo,l=>({
    wf:l.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(workflowId),
    goal:l.db.prepare('SELECT revision,markdown FROM goals WHERE workflow_id=?').get(workflowId),
    inbox:l.db.prepare("SELECT status,kind FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId),
  }));
  assert.ok(rows.wf,'no workflows row');
  assert.equal(rows.wf.phase,'queued');
  assert.ok(rows.goal,'no goals row');
  assert.equal(rows.goal.revision,0);
  assert.ok(rows.inbox,'no inbox row');
  assert.equal(rows.inbox.status,'pending');
});

test('start-workflow --plan prints the plan and leaves the inbox row pending',t=>{
  const repo=fixture(t).repo();
  const def=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(def.status,0,def.stderr);
  const workflowId=out(def)?.workflowId;
  assert.ok(workflowId);
  const r=run(START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--plan','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const plan=out(r);
  assert.equal(plan?.plan,true);
  assert.equal(plan?.workflowId,workflowId);
  const status=read(repo,l=>l.db.prepare("SELECT status FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId)?.status);
  assert.equal(status,'pending','--plan claimed the inbox row — it must only read');
});

test('start-workflow treats --repo as the project ledger owner when launched outside Source',t=>{
  const repo=fixture(t).repo();
  const def=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(def.status,0,def.stderr);
  const workflowId=out(def)?.workflowId;
  assert.ok(workflowId);
  // Codex, Claude and Devin chats are ingress launchers. They may invoke the
  // absolute executable from any cwd; --repo remains the project-owned
  // ledger root, while Source is derived from the executable itself.
  const r=spawnSync(process.execPath,[START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--plan','--json'],{
    cwd:repo,encoding:'utf8',windowsHide:true,timeout:120000,
  });
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const plan=out(r);
  assert.equal(plan?.sourceHost,path.dirname(ROOT));
  assert.equal(path.resolve(plan?.ledger??''),ledgerFileFor(repo));
  assert.equal(plan?.executionHost,'orca');
  assert.equal(plan?.inbox,'pending');
});

test('start-workflow on a finished workflow exits nonzero',t=>{
  const repo=fixture(t).repo();
  const def=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(def.status,0,def.stderr);
  const workflowId=out(def)?.workflowId;
  assert.ok(workflowId);
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(workflowId);}
  finally{ledger.close();}
  const r=run(START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0,'a finished workflow never restarts — starting it again must be refused');
});
