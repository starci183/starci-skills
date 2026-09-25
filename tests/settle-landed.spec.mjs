import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {foreignLandedPaths,landedProof,policyCommits,policyPushes} from '../scripts/kernel/settle-landed.mjs';
import {validateOpReport} from '../scripts/kernel/report-envelope.mjs';

// settle's landed proof (modules/kernel/api.yaml commands.settle refuses
// not-landed / landed-unverifiable). A tmp clone of a local bare origin is the
// target checkout and also the ledger repo; no network.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

const checkout=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-landed-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const origin=path.join(dir,'origin.git'),repo=path.join(dir,'work');
  git(dir,'init','--quiet','--bare',origin);
  git(dir,'clone','--quiet',origin,repo);
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  fs.mkdirSync(path.join(repo,'src'));
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = 1;\n');
  fs.writeFileSync(path.join(repo,'.gitignore'),'.starciwork/\n');
  git(repo,'add','.');
  git(repo,'commit','--quiet','-m','init');
  git(repo,'push','--quiet','-u','origin','main');
  const commit=(file,body)=>{
    fs.writeFileSync(path.join(repo,file),body);
    git(repo,'add',file);
    git(repo,'commit','--quiet','-m',`edit ${file}`);
    return git(repo,'rev-parse','HEAD');
  };
  return {dir,origin,repo,commit};
};

// A running job of `op` owning src/, with a bound contract, a filed done
// report naming `head`, and green recorded checks — everything a pass needs
// except the landed proof.
const seedJob=(repo,{op,head,jobId='op-landed-1',wf='wf-landed',filed=true})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId:wf,title:'landed'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:op,kind:'op',payload:{
      opId:op,owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,1,`ctx-${jobId}`,'# contract',json({worktree:repo}),at);
    if(filed)ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,op,1,0,'done',json({outcome:'done',summary:'landed',...(head?{head,branch:'main'}:{})}),null,at);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,op,1,json({checks:[{name:'unit',exitCode:0}]}),at);
  }finally{ledger.close();}
  return jobId;
};
const settlePass=(repo,jobId)=>{
  const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  let body=null;try{body=JSON.parse(r.stdout);}catch{}
  return {r,body};
};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{l.close();}};

test('policy vocabulary: scoped-local-commit commits, push:true pushes, none/absent does neither',()=>{
  assert.equal(policyCommits({mode:'scoped-local-commit',push:false}),true);
  assert.equal(policyPushes({mode:'scoped-local-commit',push:false}),false);
  assert.equal(policyPushes({mode:'scoped-local-commit',push:true}),true);
  assert.equal(policyCommits(null),false);
  assert.equal(policyCommits({mode:'none',push:true}),false);
  assert.equal(policyPushes({mode:'none',push:true}),false);
});

test('push:false op with a dirty owned path is refused not-landed with the dirty list',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  fs.writeFileSync(path.join(repo,'src','b.ts'),'export const b = 1;\n');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.ok,false);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['src/b.ts']);
  assert.equal(body.detail.head,head);
  assert.deepEqual(body.detail.missing,[]);
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');
});

test('push:false op committed locally while the checkout is ahead of origin settles pass',t=>{
  const {repo,commit}=checkout(t);
  commit('src/a.ts','export const a = 2;\n');
  const head=commit('src/a.ts','export const a = 3;\n');
  assert.notEqual(git(repo,'rev-parse','HEAD'),git(repo,'rev-parse','origin/main'),'fixture must be ahead of origin');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(body.landed.head,head);
  assert.equal(body.landed.headCheck,'verified');
  assert.equal(body.landed.originHead,undefined,'push:false never reads origin');
  assert.equal(statusOf(repo,jobId),'succeeded');
});

test('push:false op whose report head is not in local history is refused not-landed',t=>{
  const {repo}=checkout(t);
  const head='0123456789abcdef0123456789abcdef01234567';
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.missing,[`commit:${head}`]);
});

test('a legacy headless done report with clean owned paths settles pass, head check skipped',t=>{
  const {repo,commit}=checkout(t);
  commit('src/a.ts','export const a = 2;\n');
  const jobId=seedJob(repo,{op:'backend.implement',head:null});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.landed.headCheck,'skipped-legacy-report');
  assert.equal(statusOf(repo,jobId),'succeeded');
});

test('a legacy headless done report with dirty owned paths is refused not-landed',t=>{
  const {repo}=checkout(t);
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = 9;\n');
  const jobId=seedJob(repo,{op:'backend.implement',head:null});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['src/a.ts']);
  assert.equal(body.detail.headCheck,'skipped-legacy-report');
});

test('validateOpReport: a committing op owes head on done|partial; others and ask/blocked do not',()=>{
  const policy={mode:'scoped-local-commit',push:false};
  const done={outcome:'done',summary:'shipped'};
  const refused=validateOpReport(done,{commitPolicy:policy});
  assert.equal(refused.ok,false);
  assert.match(refused.reasons.join(';'),/put `git rev-parse HEAD` of the checkout holding your owned paths into `head` and re-file/);
  assert.equal(validateOpReport({outcome:'partial',summary:'half',open:['rest']},{commitPolicy:policy}).ok,false);
  assert.equal(validateOpReport({...done,head:'not-a-sha'},{commitPolicy:policy}).ok,false);
  assert.equal(validateOpReport({...done,head:'abc1234'},{commitPolicy:policy}).ok,true);
  assert.equal(validateOpReport({...done,head:'0123456789abcdef0123456789abcdef01234567'},{commitPolicy:policy}).ok,true);
  assert.equal(validateOpReport({outcome:'ask',summary:'which',question:{text:'which?'}},{commitPolicy:policy}).ok,true);
  assert.equal(validateOpReport(done,{commitPolicy:null}).ok,true,'a non-committing op files without head');
  assert.equal(validateOpReport(done).ok,true,'the two-option call stays valid');
});

test('api report resolves the op commitPolicy: headless done refused for backend.implement, accepted for docs.author',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  const file=path.join(repo,'..','report.json');
  const fileReport=(jobId,body)=>{fs.writeFileSync(file,json(body));return runApi('report','--repo',repo,'--job',jobId,'--report',file,'--json');};
  const implement=seedJob(repo,{op:'backend.implement',head:null,filed:false,jobId:'op-landed-impl'});
  const refused=fileReport(implement,{outcome:'done',summary:'shipped'});
  assert.equal(refused.status,1,refused.stdout);
  assert.match(refused.stderr,/report-invalid/);
  assert.match(refused.stderr,/git rev-parse HEAD/);
  const accepted=fileReport(implement,{outcome:'done',summary:'shipped',head,branch:'main'});
  assert.equal(accepted.status,0,accepted.stderr);
  const docs=seedJob(repo,{op:'docs.author',head:null,filed:false,jobId:'op-landed-docs',wf:'wf-landed-docs'});
  const plain=fileReport(docs,{outcome:'done',summary:'written'});
  assert.equal(plain.status,0,plain.stderr);
});

test('op without a commitPolicy settles pass over a dirty tree unchanged',t=>{
  const {repo}=checkout(t);
  fs.writeFileSync(path.join(repo,'src','b.ts'),'export const b = 1;\n');
  const jobId=seedJob(repo,{op:'docs.author',head:null});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(body.landed,undefined);
});

test('a job whose owned paths sit in no git checkout settles as before',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-landed-plain-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  assert.deepEqual(landedProof({base:dir,ownedPaths:['src/'],head:null,branch:null,pushes:true}),{checked:false,why:'repo-unresolved'});
});

// inc-e7e54ba0b970: an op that reports the checkout's HEAD at report time — a peer's commit
// touching no owned path — owes no foreign evidence; the owned-path log already names its own commits.
test('foreign-paths: a reported head touching no owned path is not foreign evidence',t=>{
  const {repo,commit}=checkout(t);
  const admittedAt=Date.now();
  commit('src/a.ts','export const a = 2;\n');
  fs.writeFileSync(path.join(repo,'business.yaml'),'id: br.peer\n');
  git(repo,'add','business.yaml');
  git(repo,'commit','--quiet','-m','peer business commit');
  const reported=git(repo,'rev-parse','HEAD');
  const found=foreignLandedPaths({root:repo,specs:['src'],head:reported,sinceMs:admittedAt,timeoutMs:30_000});
  assert.deepEqual(found,{commits:[]});
  const proof=landedProof({base:repo,ownedPaths:['src/'],head:reported,branch:'main',pushes:false,foreign:{sinceMs:admittedAt}});
  assert.equal(proof.ok,true,JSON.stringify(proof));
});

// The head stays examined when it does touch an owned path, even committed inside the admission's
// first second: 8244b3733 moved the --since floor to the admission's next whole second on the
// strength of that.
test('foreign-paths: a head touching owned paths is examined even when it predates the since window',t=>{
  const {repo}=checkout(t);
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = 2;\n');
  fs.writeFileSync(path.join(repo,'peer.ts'),'x\n');
  git(repo,'add','src/a.ts','peer.ts');
  git(repo,'commit','--quiet','-m','job commit carrying a foreign file');
  const head=git(repo,'rev-parse','HEAD');
  const found=foreignLandedPaths({root:repo,specs:['src'],head,sinceMs:Date.now()+3_600_000,timeoutMs:30_000});
  assert.deepEqual(found.commits,[{sha:head,foreign:['peer.ts']}]);
});

// diff-tree lists nothing for a merge unless asked: a merge whose resolution touched owned paths was examined
// with an empty file list, so a foreign file it carried landed unseen. With -c it counts every file the merge
// differs from all its parents in.
test('foreign-paths: a merge carrying a foreign file in its own resolution is foreign evidence',t=>{
  const {repo}=checkout(t);
  const admittedAt=Date.now();
  git(repo,'checkout','--quiet','-b','side');
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = "side";\n');
  git(repo,'commit','--quiet','-am','side edit');
  git(repo,'checkout','--quiet','main');
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = "main";\n');
  git(repo,'commit','--quiet','-am','main edit');
  spawnSync('git',['-C',repo,'merge','--no-edit','side'],{encoding:'utf8'});
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = "resolved";\n');
  fs.writeFileSync(path.join(repo,'peer.ts'),'x\n');
  git(repo,'add','src/a.ts','peer.ts');
  git(repo,'commit','--quiet','--no-edit');
  const merge=git(repo,'rev-parse','HEAD');
  const found=foreignLandedPaths({root:repo,specs:['src'],head:merge,sinceMs:admittedAt,timeoutMs:30_000});
  assert.deepEqual(found.commits,[{sha:merge,foreign:['peer.ts']}]);
});

// Windows stores ':' as U+F03A; without -z git status C-quotes it as octal and the name no longer
// round-trips, so a filed report file under owned paths counted as dirty (inc-e7e54ba0b970).
test('a report file whose name carries U+F03A (the Windows colon) under owned paths is excluded, not dirty',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  const reportFile=path.join(repo,'src','-change\uf03a');
  fs.writeFileSync(reportFile,'report\n');
  const proof=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:false,exclude:[reportFile]});
  assert.equal(proof.ok,true,JSON.stringify(proof));
  assert.deepEqual(proof.detail.dirty,[]);
});

// The owned path records the ASCII ':' while git holds U+F03A: the job's own deletion of '-change:' read
// as a foreign path and settle refused foreign-paths (nivo inc-54046f4a4f99).
test('foreign-paths: an owned name with a Windows-illegal ":" matches its U+F03A spelling in git',t=>{
  const {repo}=checkout(t);
  fs.mkdirSync(path.join(repo,'dec'),{recursive:true});
  fs.writeFileSync(path.join(repo,'dec','-'),'');
  fs.writeFileSync(path.join(repo,'dec','-change'),'');
  git(repo,'add','dec');
  git(repo,'commit','--quiet','-m','junk files');
  const admittedAt=Date.now();
  // git --since is whole seconds from the admission's next second: commit the job's removal after it.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.ceil(admittedAt/1000)*1000+50-Date.now());
  git(repo,'rm','--quiet','dec/-','dec/-change');
  git(repo,'commit','--quiet','-m','job removes the junk files');
  const head=git(repo,'rev-parse','HEAD');
  const found=foreignLandedPaths({root:repo,specs:['dec/-','dec/-change:'],head,sinceMs:admittedAt,timeoutMs:30_000});
  assert.deepEqual(found,{commits:[]});
  const onlyColon=foreignLandedPaths({root:repo,specs:['dec/-change:'],head,sinceMs:admittedAt,timeoutMs:30_000});
  assert.deepEqual(onlyColon,{commits:[{sha:head,foreign:['dec/-']}]});
});

test('push:true: unpushed head is not-landed, pushed head passes, a vanished origin is landed-unverifiable',t=>{
  const {origin,repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  const unpushed=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:true});
  assert.equal(unpushed.reason,'not-landed');
  assert.notEqual(unpushed.detail.originHead,head);
  assert.deepEqual(unpushed.detail.missing,[`origin/main:${head}`]);

  git(repo,'push','--quiet','origin','main');
  const pushed=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:true});
  assert.equal(pushed.ok,true,JSON.stringify(pushed));
  assert.equal(pushed.detail.originHead,head);

  fs.rmSync(origin,{recursive:true,force:true});
  const gone=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:true});
  assert.equal(gone.ok,false);
  assert.equal(gone.reason,'landed-unverifiable');
  assert.equal(gone.detail.step,'fetch');
});

// guards G20: --accept-foreign is a proof, not a hint. Every accepted path names the resolved
// foreign-file-committed incident on the job's workflow whose owner confirmed or reverted it;
// a bare path, an open or wrong-kind incident, or an incident that never names the path refuses
// foreign-accept-unproven instead of quietly skipping the foreign-path guard.
test('--accept-foreign settles only on a resolved foreign-file-committed incident naming the path',t=>{
  const {repo}=checkout(t);
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = 2;\n');
  fs.writeFileSync(path.join(repo,'peer.ts'),'x\n');
  git(repo,'add','src/a.ts','peer.ts');
  git(repo,'commit','--quiet','-m','job commit carrying a foreign file');
  const head=git(repo,'rev-parse','HEAD');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const settleAccept=(accept)=>{
    const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--accept-foreign',accept,'--json');
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {r,body};
  };
  const {r:refused,body:refusedBody}=settlePass(repo,jobId);
  assert.equal(refused.status,1,refused.stderr||refused.stdout);
  assert.equal(refusedBody.reason,'foreign-paths');

  const bare=settleAccept('peer.ts');
  assert.equal(bare.r.status,1,bare.r.stderr||bare.r.stdout);
  assert.equal(bare.body.reason,'foreign-accept-unproven');
  assert.match(bare.body.hint,/incident:<incidentId>/);
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');

  const unknown=settleAccept('peer.ts,incident:inc-000000000000');
  assert.equal(unknown.r.status,1,unknown.r.stderr||unknown.r.stdout);
  assert.equal(unknown.body.reason,'foreign-accept-unproven');

  const raised=runApi('incident','--repo',repo,'--workflow','wf-landed','--kind','foreign-file-committed','--detail','peer.ts confirmed by its owner','--json');
  assert.equal(raised.status,0,raised.stderr||raised.stdout);
  const incident=JSON.parse(raised.stdout).incidentId;
  const open=settleAccept(`peer.ts,incident:${incident}`);
  assert.equal(open.r.status,1,open.r.stderr||open.r.stdout);
  assert.equal(open.body.reason,'foreign-accept-unproven','an open incident is no confirmation yet');

  const resolved=runApi('incident','--repo',repo,'--workflow','wf-landed','--resolve',incident,'--detail','owner confirmed','--json');
  assert.equal(resolved.status,0,resolved.stderr||resolved.stdout);
  const ok=settleAccept(`peer.ts,incident:${incident}`);
  assert.equal(ok.r.status,0,ok.r.stderr||ok.r.stdout);
  assert.equal(ok.body.ok,true);
  assert.equal(statusOf(repo,jobId),'succeeded');
});

// guards G26: the report file is read once, guarded. A path that resolves yet cannot be read
// (here: a directory — readFileSync throws EISDIR) is a typed report-unreadable refusal on
// stderr, never a raw stack.
// The worker's terminal guard binding (runtime/guards/terminals/<handle>.json) dies with its
// terminal. Settle unbinds it itself - including a worker released while its settle was held, where
// no close runs here at all - rather than leaving it to the seven-day prune.
test('settle unbinds the worker terminal guard of a worker released while its settle was held',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const bindingDir=path.join(ROOT,'runtime','guards','terminals');
  fs.mkdirSync(bindingDir,{recursive:true});
  const binding=path.join(bindingDir,'term-held-guard.json');
  t.after(()=>{try{fs.rmSync(binding,{force:true});}catch{}});
  fs.writeFileSync(binding,json({schema:'starci/op-guard@1',jobId,terminal:'term-held-guard'}));
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const row=ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId);
    const payload=JSON.parse(row.payload_json);
    payload.workerReleased={custody:{state:'released',proof:'released-while-held'},at:Date.now(),heldBy:'wf-peer'};
    ledger.db.prepare('UPDATE jobs SET payload_json=?, worker_id=? WHERE job_id=?').run(json(payload),'term-held-guard',jobId);
  }finally{ledger.close();}
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(body.terminalClosed.releasedWhileHeld,true,'the released-while-held path ran - no close was attempted');
  assert.equal(fs.existsSync(binding),false,'the terminal guard binding was removed at settle');
  assert.deepEqual(body.guardUnbound,['term-held-guard']);
});

test('a report path that resolves but cannot be read is a typed refusal, not a crash',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--report',path.join(repo,'src'),'--json');
  assert.equal(r.status,1,r.stdout);
  assert.match(r.stderr,/"code":"report-unreadable"/);
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');
  const reported=runApi('report','--repo',repo,'--job',jobId,'--report',path.join(repo,'src'),'--json');
  assert.equal(reported.status,1,reported.stdout);
  assert.match(reported.stderr,/"code":"report-unreadable"/);
});
