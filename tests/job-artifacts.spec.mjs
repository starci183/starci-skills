import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {PROOF_MEDIA_CHANGE,PROOF_MEDIA_MISSING,evidenceDirOf,indexJobArtifacts,kindOf,listJobArtifacts,proofMediaGate} from '../scripts/kernel/job-artifacts.mjs';
import {backfillJobArtifacts} from '../scripts/work/backfill-job-artifacts.mjs';
import {artifactHoldOf} from '../scripts/lib/artifact-hold.mjs';
import {forbiddenRoot,safeRemoveTree} from '../scripts/lib/safe-remove.mjs';
import {retainLedgerDb} from '../scripts/lib/hk-ledger.mjs';
import {withRecording} from '../scripts/uat/playwright-recording.mjs';
import {withLedger} from './_ledger-fixture.mjs';
import {readArtifacts,readOpProofs} from '../ui/op-proofs.mjs';
import {readContractChangesDoc} from '../scripts/kernel/contract-changes-store.mjs';

// job_artifacts (engine/schema.sql): settle indexes every output of a job whatever its verdict, writes its
// patch, refuses a visual-proof op's pass without media, housekeeping never removes an indexed path, and the
// backfill is idempotent. A tmp clone of a local bare origin is the product repo; no network.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const json=v=>JSON.stringify(v??null);
const PNG=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082','hex');
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const effectiveAt=()=>{
  const registry=readContractChangesDoc(ROOT).doc;
  const change=registry.changes.find(c=>c.id===PROOF_MEDIA_CHANGE);
  assert.ok(change,`${PROOF_MEDIA_CHANGE} is registered`);
  return Date.parse(change.effectiveAt);
};

const checkout=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-artifacts-'));
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
  const commit=(file,body)=>{fs.writeFileSync(path.join(repo,file),body);git(repo,'add',file);git(repo,'commit','--quiet','-m',`edit ${file}`);return git(repo,'rev-parse','HEAD');};
  const write=(rel,body)=>{const abs=path.join(repo,rel);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);return abs;};
  return {dir,repo,commit,write};
};

// A running job with a bound contract, a filed report and recorded checks.
const seedJob=(repo,{op,jobId,wf='wf-art',outcome='done',report={},checks=[{name:'unit',command:'npm test',exitCode:0}],admittedAt=Date.now(),status='running'})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.ensureWorkflow({workflowId:wf,title:'artifacts'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:op,kind:'op',payload:{opId:op,owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`}}});
    ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,1,`ctx-${jobId}`,'# contract',json({worktree:repo}),admittedAt);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,op,1,0,outcome,json({outcome,summary:'artifacts',...report}),null,Date.now());
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)').run(wf,op,1,json({checks}),Date.now());
  }finally{ledger.close();}
  return jobId;
};
const runSettle=(repo,jobId,verdict,report=null)=>{const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict',verdict,...(report?['--report',report]:[]),'--json');let body=null;try{body=JSON.parse(r.stdout);}catch{}return {r,body};};
const settle=(repo,jobId,verdict)=>{const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict',verdict,'--json');let body=null;try{body=JSON.parse(r.stdout);}catch{}return {r,body};};
const read=(repo,fn)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};

test('kind, evidence directory and proof-media rules',()=>{
  assert.equal(kindOf('a/home--desktop.png'),'image');
  assert.equal(kindOf('x/video.webm'),'video');
  assert.equal(kindOf('x/trace.zip'),'trace');
  assert.equal(kindOf('E/report.json'),'report');
  assert.equal(kindOf('E/run-output.txt'),'log');
  assert.equal(kindOf('assets/a.prompt.txt'),'file');
  assert.equal(kindOf('j/op-1.patch'),'patch');
  assert.equal(evidenceDirOf('.starciwork/evidence/wf-a.e2e/renders/x.png'),'.starciwork/evidence/wf-a.e2e');
  assert.equal(evidenceDirOf('.starciwork/features/f/impl/be/E/manifest.yaml'),'.starciwork/features/f/impl/be/E');
  assert.equal(evidenceDirOf('.starciwork/features/f/impl/fe/evidence/round-2/a.json'),'.starciwork/features/f/impl/fe/evidence/round-2');
  assert.equal(evidenceDirOf('.starciwork/features/f/ui/x/assets/a.png'),null,'an assets directory is never walked whole');
  const files=names=>names.map(abs=>({abs}));
  assert.equal(proofMediaGate({policy:null,files:[]}),null);
  assert.deepEqual(proofMediaGate({policy:{images:1,video:'required'},files:files(['a.png'])}).missing,['video']);
  assert.deepEqual(proofMediaGate({policy:{images:1,video:'when-browser'},files:files(['r.json'])}).missing,['image (0/1)']);
  assert.equal(proofMediaGate({policy:{images:1,video:'when-browser'},files:files(['a.png'])}),null,'no browser ran: an image is enough');
  assert.deepEqual(proofMediaGate({policy:{images:1,video:'when-browser'},files:files(['a.png']),checks:[{command:'npx playwright test'}]}).missing,['video']);
  assert.equal(proofMediaGate({policy:{images:1,video:'when-browser'},files:files(['a.png','v.webm','trace.zip'])}),null);
});

test('settle indexes a pass: evidence dir, named media, the envelope and a landed patch, with an artifacts-indexed event',async t=>{
  const {repo,commit,write}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  write('.starciwork/evidence/wf-art.backend/run.log','ok\n');
  write('.starciwork/evidence/wf-art.backend/report.json','{}\n');
  write('.starciwork/evidence/wf-art.backend/home--desktop.png',PNG);
  const outside=path.join(path.dirname(repo),'notes-outside.json');
  fs.writeFileSync(outside,json({outcome:'done'}));
  const jobId=seedJob(repo,{op:'backend.implement',jobId:'op-art-pass',report:{head,branch:'main',files:['.starciwork/evidence/wf-art.backend/home--desktop.png','src/a.ts']}});
  const {r,body}=runSettle(repo,jobId,'pass',outside);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.artifacts.patch.state,'landed');
  assert.equal(body.artifacts.patch.landed,head);
  const rows=read(repo,db=>db.prepare('SELECT * FROM job_artifacts WHERE job_id=? ORDER BY path').all(jobId));
  const byPath=Object.fromEntries(rows.map(row=>[row.path,row]));
  assert.equal(byPath['.starciwork/evidence/wf-art.backend/home--desktop.png'].kind,'image');
  assert.equal(byPath['.starciwork/evidence/wf-art.backend/home--desktop.png'].label,'home@desktop');
  assert.equal(byPath['.starciwork/evidence/wf-art.backend/run.log'].kind,'log','every file of the evidence dir is indexed');
  assert.ok(!rows.some(row=>row.path==='src/a.ts'),'source is carried by the patch, not indexed as a file');
  const copy=rows.find(row=>row.origin&&row.origin.endsWith('notes-outside.json'));
  assert.ok(copy&&copy.path.startsWith(`.starciwork/kernel-evidence/wf-art/jobs/${jobId}/files/`),'a file outside Work is copied into the job dir');
  assert.equal(copy.kind,'report','a copied report file keeps its kind, whatever its name');
  const patch=rows.find(row=>row.kind==='patch');
  assert.equal(patch.path,`.starciwork/kernel-evidence/wf-art/jobs/${jobId}/${jobId}.patch`);
  assert.equal(patch.landed_sha,head);
  assert.equal(patch.label,'landed');
  const text=fs.readFileSync(path.join(repo,patch.path),'utf8');
  assert.match(text,/\+export const a = 2;/);
  assert.match(text,new RegExp(`^From ${head}`,'m'));
  assert.ok(rows.some(row=>row.kind==='report'&&row.path.endsWith('/report-1.json')),'the envelope is kept');
  for(const row of rows)assert.match(row.sha256,/^[0-9a-f]{64}$/);
  const events=read(repo,db=>db.prepare("SELECT payload_json FROM events WHERE kind='artifacts-indexed' AND entity_id=?").all(jobId));
  assert.equal(events.length,1);
  assert.equal(JSON.parse(events[0].payload_json).indexed,rows.length);
  const listed=read(repo,db=>listJobArtifacts(db,{workflowId:'wf-art',jobId}));
  assert.equal(listed.total,rows.length);
  assert.equal(listed.jobs[0].status,'succeeded');
  const api=runApi('artifacts','--repo',repo,'--workflow','wf-art','--kind','patch','--json');
  assert.equal(api.status,0,api.stderr);
  assert.equal(JSON.parse(api.stdout).total,1);
  const project={id:'nivo',repo};
  assert.equal(readArtifacts(project,{workflowId:'wf-art'}).total,rows.length,'ui/server.mjs /api/artifacts reads the same rows');
  const proofs=await readOpProofs(project,{workflowId:'wf-art',op:'backend.implement'});
  assert.ok(proofs.jobs[0].files.some(file=>file.kind==='patch'),'the UI proof panel serves the indexed patch');
});

test('settle indexes a failed job too, and its patch of commits that never landed is unlanded',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 3;\n');
  const jobId=seedJob(repo,{op:'backend.implement',jobId:'op-art-fail',outcome:'failed',report:{head}});
  const {r,body}=settle(repo,jobId,'fail');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.artifacts.patch.state,'unlanded');
  const patch=read(repo,db=>db.prepare("SELECT * FROM job_artifacts WHERE job_id=? AND kind='patch'").get(jobId));
  assert.equal(patch.head_sha,head);
  assert.equal(patch.landed_sha,null);
  assert.equal(patch.label,'unlanded');
});

test('a visual-proof op cannot settle pass without its media: PROOF_MEDIA_MISSING; a leg admitted before the change settles as admitted',t=>{
  const {repo,write}=checkout(t);
  const at=effectiveAt();
  write('.starciwork/evidence/wf-art.uat/result.md','# ran\n');
  const report={files:['.starciwork/evidence/wf-art.uat/result.md']};
  const jobId=seedJob(repo,{op:'uat.verify',jobId:'op-art-uat',report,admittedAt:at+1000});
  const refused=settle(repo,jobId,'pass');
  assert.equal(refused.r.status,1,refused.r.stdout);
  assert.equal(refused.body.reason,PROOF_MEDIA_MISSING);
  assert.deepEqual(refused.body.missing,['image (0/1)','video']);
  assert.equal(read(repo,db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status),'running','a refused settle writes nothing');
  write('.starciwork/evidence/wf-art.uat/checkout--mobile.png',PNG);
  write('.starciwork/evidence/wf-art.uat/flow-1.webm','webm');
  const passed=settle(repo,jobId,'pass');
  assert.equal(passed.r.status,0,passed.r.stderr||passed.r.stdout);
  assert.equal(passed.body.artifacts.byKind.video,1);
  const legacy=seedJob(repo,{op:'uat.verify',jobId:'op-art-uat-old',wf:'wf-art-old',report:{files:[]},admittedAt:at-1000});
  const old=settle(repo,legacy,'pass');
  assert.equal(old.r.status,0,old.r.stderr||old.r.stdout);
});

test('housekeeping never removes an indexed artifact or its evidence directory',t=>withLedger(t,({repoRoot,ledger,machine,ledgerFile})=>{
  machine.registerLedger({file:ledgerFile,ledgerId:ledger.ledgerId});
  const dir=path.join(repoRoot,'.starciwork','evidence','wf-hk.e2e');
  fs.mkdirSync(path.join(dir,'renders'),{recursive:true});
  fs.writeFileSync(path.join(dir,'renders','a--desktop.png'),PNG);
  fs.writeFileSync(path.join(dir,'scratch.tmp'),'x');
  ledger.ensureWorkflow({workflowId:'wf-hk'});
  ledger.enqueueJob({jobId:'op-hk-1',workflowId:'wf-hk',opId:'e2e.verify',kind:'op'});
  ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='op-hk-1'").run();
  ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
    .run('wf-hk','ctx-hk','e2e.verify',1,0,'done',json({outcome:'done',files:['.starciwork/evidence/wf-hk.e2e/renders/a--desktop.png']}),null,Date.now());
  const indexed=indexJobArtifacts(ledger,{repo:repoRoot,jobId:'op-hk-1'});
  assert.equal(indexed.ok,true);
  assert.ok(artifactHoldOf(dir),'the evidence dir holds indexed files');
  assert.ok(artifactHoldOf(path.join(dir,'scratch.tmp')),'a file inside an evidence dir of an indexed artifact is held');
  assert.match(forbiddenRoot(repoRoot)??'',/indexed job artifact/);
  const removed=safeRemoveTree(dir);
  assert.equal(removed.ok,false);
  assert.ok(fs.existsSync(path.join(dir,'renders','a--desktop.png')),'safeRemoveTree refused the tree');
  assert.equal(artifactHoldOf(path.join(repoRoot,'node_modules')),null,'an unindexed path is not held');
  ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-hk'").run();
  const before=ledger.db.prepare('SELECT count(*) n FROM job_artifacts').get().n;
  const retained=retainLedgerDb(ledger.db);
  assert.equal(retained.retained,true,JSON.stringify(retained));
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM job_artifacts').get().n,before,'ledger retention keeps every artifact row of a finished workflow');
}));

test('backfill: dry-run writes nothing, apply indexes every settled job, a second apply changes nothing, gone commits are listed',t=>{
  const {repo,commit,write}=checkout(t);
  const head=commit('src/a.ts','export const a = 4;\n');
  write('.starciwork/features/f/impl/be/E/manifest.yaml','id: e\n');
  write('.starciwork/features/f/impl/be/E/run-output.txt','green\n');
  seedJob(repo,{op:'e2e.verify',jobId:'op-bf-1',status:'succeeded',report:{head,files:['.starciwork/features/f/impl/be/E/manifest.yaml']}});
  seedJob(repo,{op:'e2e.verify',jobId:'op-bf-2',wf:'wf-bf-2',status:'failed',outcome:'failed',report:{head:'0123456789abcdef0123456789abcdef01234567'}});
  seedJob(repo,{op:'e2e.verify',jobId:'op-bf-3',wf:'wf-bf-3',status:'running'});
  const dry=backfillJobArtifacts({repo});
  assert.equal(dry.mode,'dry-run');
  assert.equal(dry.counts.jobs,2,'only settled jobs');
  assert.ok(dry.counts.added>0);
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','kernel-evidence')),false,'a dry run writes no file');
  assert.equal(read(repo,db=>db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='job_artifacts'").get().n)>0
    ? read(repo,db=>db.prepare('SELECT count(*) n FROM job_artifacts').get().n):0,0,'a dry run writes no row');
  const first=backfillJobArtifacts({repo,apply:true});
  assert.equal(first.counts.errors,0,JSON.stringify(first.errors));
  assert.equal(first.patches.unlanded,1);
  assert.deepEqual(first.commitsGone.map(g=>g.jobId),['op-bf-2']);
  assert.ok(first.byKind.log>=1&&first.byKind.patch===1&&first.byKind.report>=2);
  const rows=read(repo,db=>db.prepare('SELECT count(*) n FROM job_artifacts').get().n);
  const events=read(repo,db=>db.prepare("SELECT count(*) n FROM events WHERE kind='artifacts-indexed'").get().n);
  assert.equal(rows,first.counts.added);
  const second=backfillJobArtifacts({repo,apply:true});
  assert.equal(second.counts.added,0);
  assert.equal(second.counts.updated,0);
  assert.equal(read(repo,db=>db.prepare('SELECT count(*) n FROM job_artifacts').get().n),rows);
  assert.equal(read(repo,db=>db.prepare("SELECT count(*) n FROM events WHERE kind='artifacts-indexed'").get().n),events,'no second event for an unchanged job');
});

test('a Playwright test command records video, trace and screenshots through a wrapper of the project config',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-recording-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'playwright.config.ts'),'export default { testDir: "./e2e" };\n');
  const out=path.join(dir,'rec','playwright-1');
  const r=withRecording(['npx','playwright','test','--config','playwright.config.ts','--project=chromium'],{cwd:dir,outputDir:out});
  assert.deepEqual(r.command.slice(0,4),['npx','playwright','test','--project=chromium']);
  assert.deepEqual(r.command.slice(-2),['--config',`${out}.playwright.config.ts`]);
  const source=fs.readFileSync(r.config,'utf8');
  assert.match(source,/video: 'on', trace: 'on', screenshot: 'on'/);
  assert.match(source,new RegExp(JSON.stringify(path.join(dir,'playwright.config').replace(/\\/g,'/')).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.deepEqual(withRecording(['node','seed.mjs'],{cwd:dir,outputDir:out}).command,['node','seed.mjs'],'any other command runs as given');
});
