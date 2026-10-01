import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {findOwnedPathLeaseConflicts,leaseCompareForm} from '../../engine/admission.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {leaseCanonicalizer} from '../../scripts/kernel/lease-canon.mjs';
import {placeOnRepo} from '../helpers/op-placement.mjs';

// nivo wf-nivo-fe-debt-mug06w7h inc-52a4a5ee5b12: Modules enqueued `apps/app/src/messages/vi.json` bare
// (--repository fe) while fe-debt enqueued `fe/apps/app/src/messages` prefixed with the side
// folder's name. Leases compared strings, so both were admitted onto the same catalog. In a bound
// app every owned path is app-relative (one form; a side-relative spelling is refused at enqueue), so
// the lease key is the app-relative path, held rows are compared in that form through their holder
// job, and on Windows the comparison ignores case. be/x and fe/x never overlap.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const VI='apps/app/src/messages/vi.json',MESSAGES='apps/app/src/messages';
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
};

// A tmp Source binding one nivo app repository with be/ and fe/ sides.
const fixture=t=>{
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'starci-lease-canon-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const be=path.join(dir,'nivo'),backend=path.join(be,'be'),fe=path.join(be,'fe'),source=path.join(dir,'source');
  for(const side of [backend,fe]){
    fs.mkdirSync(path.join(side,'apps','app','src','messages'),{recursive:true});
    fs.writeFileSync(path.join(side,VI),'{}\n');
  }
  git(be,'init','--quiet','-b','main');
  git(be,'config','user.email','fixture@example.test');
  git(be,'config','user.name','Fixture');
  git(be,'add','.');
  git(be,'commit','--quiet','-m','seed');
  fs.mkdirSync(path.join(source,'.workspaces','projects','nivo'),{recursive:true});
  fs.writeFileSync(path.join(source,'.workspaces','projects','nivo','work.json'),JSON.stringify({
    schema:'starci/workspace-binding@2',project:'nivo',
    repository:{pathFromSource:'../nivo',gitRepository:'https://example.test/nivo.git'},
    sides:{be:'be',fe:'fe'},work:{pathFromRepository:'.starciwork'},
  }));
  const prior=process.env.STARCI_SOURCE_ROOT;
  const priorProjects=process.env.STARCI_PROJECTS_ROOT;
  const priorMachine=process.env.STARCI_TEST_MACHINE_FILE;
  process.env.STARCI_SOURCE_ROOT=source;
  process.env.STARCI_PROJECTS_ROOT=path.join(dir,'projects');
  process.env.STARCI_TEST_MACHINE_FILE=path.join(dir,'machine.sqlite');
  t.after(()=>{
    if(prior===undefined)delete process.env.STARCI_SOURCE_ROOT;else process.env.STARCI_SOURCE_ROOT=prior;
    if(priorProjects===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=priorProjects;
    if(priorMachine===undefined)delete process.env.STARCI_TEST_MACHINE_FILE;else process.env.STARCI_TEST_MACHINE_FILE=priorMachine;
  });
  return {dir,be,backend,fe,source};
};
const withLedger=(repo,fn)=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
const enqueue=(ledger,{jobId,workflowId,opId='code.refactor',owned,repository})=>{
  ledger.ensureWorkflow({workflowId,title:workflowId});
  ledger.write.createUnit({workflowId,unitId:jobId,opId,subjectKey:jobId,goalRevision:1});
  return ledger.enqueueJob({jobId,workflowId,unitId:jobId,tryNo:1,opId,kind:'op',
    payload:{opId,owned_paths:owned,...(repository?{repository}:{})}});
};
const holdLease=(ledger,jobId,key)=>{
  // A lease held by a leased job, stored under the given key.
  const job=ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  ledger.db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  ledger.db.prepare('UPDATE jobs SET lease_token=? WHERE job_id=?').run(`tok-${jobId}`,jobId);
  for(const to of ['ready','leased'])ledger.write.setJobStatus({jobId,to,reason:'test-fixture'});
  ledger.db.prepare(`INSERT INTO leases(resource_key,job_id,workflow_id,op_id,try_no,generation,token,units,acquired_at,expires_at)
    VALUES(?,?,?,?,?,?,?,1,?,?)`).run(key,jobId,job.workflow_id,job.op_id,job.try_no,job.generation,`tok-${jobId}`,Date.now(),Date.now()+20*60_000);
};

test('a bound app keys every lease by its app-relative path; an unbound repository keeps its own',t=>{
  const {be,dir}=fixture(t);
  const canon=leaseCanonicalizer({repo:be});
  assert.ok(canon.binding,'the tmp Source binds nivo as one app repository');
  assert.equal(canon.canonical(`fe/${VI}`,{op:'interface.implement',payload:{repository:'fe'}}),`fe/${VI}`);
  assert.equal(canon.canonical(`fe/${MESSAGES}/**`,{op:'code.refactor',payload:{}}),`fe/${MESSAGES}`);
  assert.equal(canon.canonical(`be/${VI}`,{op:'code.refactor',payload:{repository:'be'}}),`be/${VI}`,'the same relative path in the backend side');
  assert.equal(canon.canonical('.starciwork/features/sales/impl/x',{op:'interface.implement',payload:{}}),'.starciwork/features/sales/impl/x','a Work path lands at the app root');
  assert.equal(canon.canonical(VI,{op:'interface.implement',payload:{repository:'fe'}}),VI,'a side-relative spelling is not app-relative: it stays as written (enqueue refuses it)');
  assert.deepEqual(canon.requests({opId:'interface.implement',owned_paths:[`fe/${VI}`,'fe/apps/app/src/messages/en.json',`fe/${MESSAGES}`]}),
    [{resourceKey:`path:fe/${MESSAGES}`,units:1}],'descendants collapse');
  const unbound=leaseCanonicalizer({repo:path.join(dir,'elsewhere')});
  assert.equal(unbound.binding,null);
  assert.equal(unbound.canonical(`fe/${MESSAGES}`,{payload:{}}),`fe/${MESSAGES}`,'no binding: the path as written');
});

test('one file held by one job fences another job naming it or a parent; the other side does not',t=>{
  const {be}=fixture(t);
  withLedger(be,ledger=>{
    enqueue(ledger,{jobId:'debt-held',workflowId:'wf-debt',owned:[`fe/${MESSAGES}`]});
    holdLease(ledger,'debt-held',`path:fe/${MESSAGES}`);
    const canon=leaseCanonicalizer({repo:be,db:ledger.db});
    const conflictsOf=(payload,exclude)=>findOwnedPathLeaseConflicts(ledger.db,canon.requests(payload),{excludeJobId:exclude,canonicalOf:canon.canonicalOf});
    const modules=conflictsOf({opId:'interface.implement',owned_paths:[`fe/${VI}`]},'modules-new');
    assert.deepEqual(modules.map(c=>[c.requested,c.held,c.job_id]),[[`path:fe/${VI}`,`path:fe/${MESSAGES}`,'debt-held']]);
    assert.deepEqual(conflictsOf({opId:'code.refactor',owned_paths:[`be/${VI}`]},'be-new'),[],'be/apps/app/src/messages/vi.json is not fe/apps/app/src/messages/vi.json');
  });
});

test('lease paths compare case-insensitively on Windows only',()=>{
  assert.equal(leaseCompareForm(`fe/Apps/App/src/messages/VI.json`,{platform:'win32'}),`fe/${VI}`);
  assert.equal(leaseCompareForm(`Apps/App`,{platform:'linux'}),'Apps/App');
  const db={prepare:()=>({all:()=>[{resource_key:`path:fe/${MESSAGES}`,job_id:'h',workflow_id:'w',op_id:'o',attempt:1,generation:1,expires_at:Date.now()+60_000}]})};
  assert.equal(findOwnedPathLeaseConflicts(db,[`path:fe/Apps/App/src/Messages/vi.json`],{platform:'win32'}).length,1);
  assert.equal(findOwnedPathLeaseConflicts(db,[`path:fe/Apps/App/src/Messages/vi.json`],{platform:'linux'}).length,0);
});

test('api: dispatch takes the app-relative lease, a parent of the same catalog waits on it, the backend side path does not',t=>{
  const {dir,be,source}=fixture(t);
  const stub=path.join(dir,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_SOURCE_ROOT:source,
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(dir,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(dir,'state.json'),
    LOCALAPPDATA:path.join(dir,'localappdata')};
  const api=(...args)=>{
    const r=spawnSync(process.execPath,[API,...placeOnRepo(args,be),'--repo',be,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {r,body};
  };
  withLedger(be,ledger=>{
    for(const wf of ['wf-modules','wf-debt']){
      ledger.ensureWorkflow({workflowId:wf,title:wf});
      ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(wf);
    }
    enqueue(ledger,{jobId:'modules-vi',workflowId:'wf-modules',owned:[`fe/${VI}`]});
    enqueue(ledger,{jobId:'debt-messages',workflowId:'wf-debt',owned:[`fe/${MESSAGES}`]});
    enqueue(ledger,{jobId:'be-vi',workflowId:'wf-debt',owned:[`be/${VI}`]});
  });
  const leases=jobId=>{const l=inspectLedger({file:ledgerFileFor(be)});try{return l.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(jobId).map(r=>r.resource_key);}finally{l.close();}};

  const first=api('dispatch','--job','modules-vi','--model','devin-agent','--spawn');
  assert.equal(first.r.status,0,first.r.stderr||first.r.stdout);
  assert.deepEqual(leases('modules-vi'),[`path:fe/${VI}`],'the lease is taken app-relative');

  const second=api('dispatch','--job','debt-messages','--model','devin-agent','--spawn');
  assert.notEqual(second.r.status,0,'the catalog directory holding the file is fenced');
  assert.equal(second.body?.reason,'path-lease',second.r.stdout);
  assert.equal(second.body.holders[0].jobId,'modules-vi');
  assert.deepEqual(leases('debt-messages'),[]);

  const third=api('dispatch','--job','be-vi','--model','devin-agent','--spawn');
  assert.equal(third.r.status,0,`the owner repository's own apps/app/src/messages/vi.json is another file: ${third.r.stderr||third.r.stdout}`);
  assert.deepEqual(leases('be-vi'),[`path:be/${VI}`]);
});
