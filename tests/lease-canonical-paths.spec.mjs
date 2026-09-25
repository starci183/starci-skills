import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {findOwnedPathLeaseConflicts,leaseCompareForm} from '../engine/admission.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {leaseCanonicalizer} from '../scripts/kernel/lease-canon.mjs';

// nivo wf-nivo-fe-debt-mug06w7h inc-52a4a5ee5b12: Modules enqueued `apps/app/src/messages/vi.json` bare
// (--repository fe) while fe-debt enqueued `nivo-fe/apps/app/src/messages` prefixed with the fe
// repository's name. Leases compared strings, so both were admitted onto the same catalog. In a bound
// project every owned path is now spelled `repository:<role>/<path>` for its lease, held rows (also ones
// taken before this change) are compared in that form through their holder job, and on Windows the
// comparison ignores case. The same relative path in two repositories never overlaps.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const VI='apps/app/src/messages/vi.json',MESSAGES='apps/app/src/messages';
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
};

// A tmp Source binding nivo-backend (be, the Work owner) and nivo-fe (fe, gitRepository nivo-fe2).
const fixture=t=>{
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'starci-lease-canon-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const be=path.join(dir,'nivo-backend'),fe=path.join(dir,'nivo-fe'),source=path.join(dir,'source');
  for(const repo of [be,fe]){
    fs.mkdirSync(path.join(repo,'apps','app','src','messages'),{recursive:true});
    fs.writeFileSync(path.join(repo,VI),'{}\n');
    git(repo,'init','--quiet');
  }
  fs.mkdirSync(path.join(source,'.workspaces','projects','nivo'),{recursive:true});
  fs.writeFileSync(path.join(source,'.workspaces','projects','nivo','work.json'),JSON.stringify({
    schema:'starci/workspace-binding@1',project:'nivo',
    repositories:{
      be:{pathFromSource:'../nivo-backend',gitRepository:'https://example.test/nivo-backend.git'},
      fe:{pathFromSource:'../nivo-fe',gitRepository:'https://example.test/nivo-fe2.git'},
    },
    work:{ownerRole:'be',pathFromRepository:'.starciwork'},
  }));
  const prior=process.env.STARCI_SOURCE_ROOT;
  process.env.STARCI_SOURCE_ROOT=source;
  t.after(()=>{if(prior===undefined)delete process.env.STARCI_SOURCE_ROOT;else process.env.STARCI_SOURCE_ROOT=prior;});
  return {dir,be,fe,source};
};
const withLedger=(repo,fn)=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
const enqueue=(ledger,{jobId,workflowId,opId='code.refactor',owned,repository})=>ledger.enqueueJob({jobId,workflowId,opId,kind:'op',
  payload:{opId,owned_paths:owned,...(repository?{repository}:{})}});
const holdLegacy=(ledger,jobId,key)=>{
  // A lease taken before canonical keys: stored in the spelling its job used.
  const job=ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  ledger.db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run(key);
  ledger.db.prepare("UPDATE jobs SET status='leased',lease_token=? WHERE job_id=?").run(`tok-${jobId}`,jobId);
  ledger.db.prepare(`INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref)
    VALUES(?,?,?,?,?,?,?,1,?,?,NULL)`).run(key,jobId,job.workflow_id,job.op_id,job.attempt,job.generation,`tok-${jobId}`,Date.now(),Date.now()+20*60_000);
};

test('every spelling of a bound path is one repository-qualified lease path; an unbound repository keeps its own',t=>{
  const {be,fe,dir}=fixture(t);
  const canon=leaseCanonicalizer({repo:be});
  assert.ok(canon.binding,'the tmp Source binds nivo-backend as the Work owner');
  const fePayload={repository:'fe'};
  assert.equal(canon.canonical(VI,{op:'interface.implement',payload:fePayload}),`repository:fe/${VI}`,'bare, --repository fe');
  assert.equal(canon.canonical(`nivo-fe/${MESSAGES}`,{op:'code.refactor',payload:{}}),`repository:fe/${MESSAGES}`,'prefixed with the repository name');
  assert.equal(canon.canonical(`nivo-fe/${MESSAGES}/**`,{op:'code.refactor',payload:{}}),`repository:fe/${MESSAGES}`);
  assert.equal(canon.canonical(`repository:fe/${VI}`),`repository:fe/${VI}`);
  assert.equal(canon.canonical(`repository:nivo-fe/${VI}`),`repository:fe/${VI}`,'a repository id resolves to its role');
  assert.equal(canon.canonical(VI,{op:'code.refactor',payload:{repository:'be'}}),`repository:be/${VI}`,'the same relative path in the owner repository');
  assert.equal(canon.canonical('.starciwork/features/sales/impl/x',{op:'interface.implement',payload:fePayload}),'repository:be/.starciwork/features/sales/impl/x','a Work path lands in the Work owner');
  assert.deepEqual(canon.requests({opId:'interface.implement',repository:'fe',owned_paths:[VI,`apps/app/src/messages/en.json`,`apps/app/src/messages`]}),
    [{resourceKey:`path:repository:fe/${MESSAGES}`,units:1}],'descendants collapse after canonicalization');
  const unbound=leaseCanonicalizer({repo:path.join(dir,'elsewhere')});
  assert.equal(unbound.binding,null);
  assert.equal(unbound.canonical(`nivo-fe/${MESSAGES}`,{payload:{}}),`nivo-fe/${MESSAGES}`,'no binding: the path as written');
  assert.ok(fe);
});

test('a bare and a prefixed spelling of one file overlap in both directions, legacy held leases included; another repository does not',t=>{
  const {be}=fixture(t);
  withLedger(be,ledger=>{
    enqueue(ledger,{jobId:'modules-legacy',workflowId:'wf-modules',owned:[VI],repository:'fe'});
    holdLegacy(ledger,'modules-legacy',`path:${VI}`);
    enqueue(ledger,{jobId:'debt-legacy',workflowId:'wf-debt',owned:[`nivo-fe/apps/landing/src`]});
    holdLegacy(ledger,'debt-legacy','path:nivo-fe/apps/landing/src');
    const canon=leaseCanonicalizer({repo:be,db:ledger.db});
    const conflictsOf=(payload,exclude)=>findOwnedPathLeaseConflicts(ledger.db,canon.requests(payload),{excludeJobId:exclude,canonicalOf:canon.canonicalOf});

    // fe-debt (prefixed) against the Modules lease taken bare before canonical keys.
    const debt=conflictsOf({opId:'code.refactor',owned_paths:[`nivo-fe/${MESSAGES}`]},'debt-new');
    assert.deepEqual(debt.map(c=>[c.requested,c.held,c.job_id]),[[`path:repository:fe/${MESSAGES}`,`path:${VI}`,'modules-legacy']]);
    // Modules (bare, fe) against the fe-debt lease taken prefixed.
    const modules=conflictsOf({opId:'interface.implement',repository:'fe',owned_paths:['apps/landing/src/page.tsx']},'modules-new');
    assert.deepEqual(modules.map(c=>c.job_id),['debt-legacy']);
    // The same relative path in the Work owner repository is another file.
    assert.deepEqual(conflictsOf({opId:'code.refactor',repository:'be',owned_paths:[VI]},'be-new'),[],'be:apps/app/src/messages/vi.json is not fe:apps/app/src/messages/vi.json');
    assert.deepEqual(conflictsOf({opId:'code.refactor',owned_paths:[`nivo-backend/${VI}`]},'be-named'),[],'nor spelled with the owner repository name');
  });
});

test('lease paths compare case-insensitively on Windows only',()=>{
  assert.equal(leaseCompareForm(`repository:fe/Apps/App/src/messages/VI.json`,{platform:'win32'}),`repository:fe/${VI}`);
  assert.equal(leaseCompareForm(`Apps/App`,{platform:'linux'}),'Apps/App');
  const db={prepare:()=>({all:()=>[{resource_key:`path:repository:fe/${MESSAGES}`,job_id:'h',workflow_id:'w',op_id:'o',attempt:1,generation:1,expires_at:Date.now()+60_000}]})};
  assert.equal(findOwnedPathLeaseConflicts(db,[`path:repository:fe/Apps/App/src/Messages/vi.json`],{platform:'win32'}).length,1);
  assert.equal(findOwnedPathLeaseConflicts(db,[`path:repository:fe/Apps/App/src/Messages/vi.json`],{platform:'linux'}).length,0);
});

test('api: dispatch takes the canonical lease, a prefixed spelling of the same catalog waits on it, the owner repository path does not',t=>{
  const {dir,be,source}=fixture(t);
  const stub=path.join(dir,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_SOURCE_ROOT:source,
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(dir,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(dir,'state.json'),
    LOCALAPPDATA:path.join(dir,'localappdata')};
  const api=(...args)=>{
    const r=spawnSync(process.execPath,[API,...args,'--repo',be,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {r,body};
  };
  withLedger(be,ledger=>{
    for(const wf of ['wf-modules','wf-debt']){
      ledger.ensureWorkflow({workflowId:wf,title:wf});
      ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(wf);
    }
    enqueue(ledger,{jobId:'modules-vi',workflowId:'wf-modules',owned:[VI],repository:'fe'});
    enqueue(ledger,{jobId:'debt-messages',workflowId:'wf-debt',owned:[`nivo-fe/${MESSAGES}`]});
    enqueue(ledger,{jobId:'be-vi',workflowId:'wf-debt',owned:[VI],repository:'be'});
  });
  const leases=jobId=>{const l=inspectLedger({file:ledgerFileFor(be)});try{return l.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(jobId).map(r=>r.resource_key);}finally{l.close();}};

  const first=api('dispatch','--job','modules-vi','--model','qwen-agent','--spawn');
  assert.equal(first.r.status,0,first.r.stderr||first.r.stdout);
  assert.deepEqual(leases('modules-vi'),[`path:repository:fe/${VI}`],'the lease is taken repository-qualified');

  const second=api('dispatch','--job','debt-messages','--model','qwen-agent','--spawn');
  assert.notEqual(second.r.status,0,'the prefixed spelling of the same catalog is fenced');
  assert.equal(second.body?.reason,'path-lease',second.r.stdout);
  assert.equal(second.body.holders[0].jobId,'modules-vi');
  assert.deepEqual(leases('debt-messages'),[]);

  const third=api('dispatch','--job','be-vi','--model','qwen-agent','--spawn');
  assert.equal(third.r.status,0,`the owner repository's own apps/app/src/messages/vi.json is another file: ${third.r.stderr||third.r.stdout}`);
  assert.deepEqual(leases('be-vi'),[`path:repository:be/${VI}`]);
});
