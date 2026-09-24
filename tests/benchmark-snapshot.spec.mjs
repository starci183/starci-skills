import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {boundRepos,previousSnapshot,snapshotDelta,formatDelta,takeSnapshot,snapshotName,SNAPSHOTS_DIR} from '../scripts/agent/benchmark-snapshot.mjs';

// benchmark-snapshot runs the model scorecard over the bound project ledgers and writes one append-only file
// under benchmark/snapshots/. Every ledger here is a fixture (withLedger: temp dir, LOCALAPPDATA repointed) and
// every snapshot dir, source root and qwen home is a temp dir, so no real ledger or benchmark file is touched.
const SCRIPT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','scripts','agent','benchmark-snapshot.mjs');
const T=Date.UTC(2026,8,24,12,0,0);
const H=3600000,MIN=60000;
const job=(jobId,{op,pool,status,verdict=null,createdAt,updatedAt=createdAt+10*MIN})=>({
  jobId,opId:op,kind:'op',status,createdAt,updatedAt,
  payload:{opId:op,...(pool?{model:pool,modelId:`${pool}-model`,difficulty:'medium'}:{}),retry:{retryOf:null,attempt:1}},
  result:verdict?{verdict}:null,
});
const DAY1=[
  job('c1',{op:'business.decide',pool:'claude-agent',status:'succeeded',verdict:'pass',createdAt:T-5*H}),
  job('c2',{op:'business.decide',pool:'claude-agent',status:'failed',verdict:'fail',createdAt:T-4*H,updatedAt:T-4*H+30*MIN}),
  job('q1',{op:'backend.scaffold',pool:'qwen-agent',status:'succeeded',verdict:'pass',createdAt:T-2*H}),
];
const DAY2=[
  job('c3',{op:'business.decide',pool:'claude-agent',status:'succeeded',verdict:'pass',createdAt:T+20*H}),
  job('c4',{op:'architecture.decide',pool:'claude-agent',status:'succeeded',verdict:'pass',createdAt:T+21*H}),
  job('d1',{op:'backend.implement',pool:'devin-agent',status:'failed',verdict:'blocked',createdAt:T+22*H}),
];
const tmp=(t,prefix)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
};
const emptyQwen=t=>tmp(t,'starci-bench-qwen-');
const bind=(sourceRoot,project,pathFromSource,ownerRole='be')=>{
  const dir=path.join(sourceRoot,'.workspaces','projects',project);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'work.json'),JSON.stringify({schema:'starci/workspace-binding@1',project,
    repositories:{[ownerRole]:{pathFromSource},fe:{pathFromSource:'../elsewhere-fe'}},work:{ownerRole,pathFromRepository:'.starciwork'}}));
};

test('the default snapshots dir is benchmark/snapshots at the runtime root',()=>{
  assert.equal(path.relative(path.resolve(path.dirname(SCRIPT),'..','..'),SNAPSHOTS_DIR).split(path.sep).join('/'),'benchmark/snapshots');
  assert.equal(snapshotName('2026-09-25',72),'2026-09-25-72h.json');
});

test('bound repos come from .workspaces bindings: the Work owner, once, only with a ledger',t=>withLedger(t,({repoRoot})=>{
  const sourceRoot=tmp(t,'starci-bench-src-');
  bind(sourceRoot,'alpha',repoRoot);
  bind(sourceRoot,'alpha-again',repoRoot);                       // the same repo bound twice counts once
  bind(sourceRoot,'no-ledger',path.join(sourceRoot,'missing'));  // no .starciwork/runtime.sqlite: skipped
  fs.mkdirSync(path.join(sourceRoot,'.workspaces','projects','broken'));  // no work.json: skipped
  assert.deepEqual(boundRepos({sourceRoot}),[path.resolve(repoRoot)]);
  assert.deepEqual(boundRepos({sourceRoot:path.join(sourceRoot,'nothing-here')}),[]);
}));

test('first snapshot from the bindings is the baseline; the next one of the same window prints a per-pool delta',t=>withLedger(t,({repoRoot,ledger})=>{
  const sourceRoot=tmp(t,'starci-bench-src-'),dir=tmp(t,'starci-bench-snap-'),qwenHome=emptyQwen(t);
  bind(sourceRoot,'alpha',repoRoot);
  seedWorkflow(ledger,{id:'wf-day1',jobs:DAY1,now:T});

  const first=takeSnapshot({sinceHours:24,now:T,date:'2026-09-24',dir,sourceRoot,qwenHome});
  assert.equal(first.file,path.join(dir,'2026-09-24-24h.json'));
  assert.equal(first.previous,null);
  assert.equal(first.delta,null);
  const written=JSON.parse(fs.readFileSync(first.file,'utf8'));
  // The file is the model-scorecard --json shape, untouched.
  assert.deepEqual(Object.keys(written),['repos','window','jobs','durationSource','errors','pools']);
  assert.deepEqual(written.repos,[path.resolve(repoRoot)]);
  assert.equal(written.window.label,'24h');
  assert.equal(written.jobs,3);
  assert.equal(written.pools['claude-agent'].passRate,0.5);
  assert.match(formatDelta(first),/2026-09-24-24h\.json: 3 jobs over 1 repo\(s\), window 24h\nno earlier 24h snapshot: this is the baseline/);

  // A snapshot of another window never serves as the previous one.
  fs.writeFileSync(path.join(dir,'2026-09-24-72h.json'),JSON.stringify({...written,window:{sinceMs:0,label:'72h'},jobs:999}));
  seedWorkflow(ledger,{id:'wf-day2',jobs:DAY2,now:T+23*H});
  const second=takeSnapshot({sinceHours:24,now:T+24*H,date:'2026-09-25',dir,sourceRoot,qwenHome});
  assert.equal(second.previous.file,'2026-09-24-24h.json');
  assert.equal(second.snapshot.jobs,3);
  const d=second.delta;
  assert.equal(d.jobsDelta,0);
  assert.deepEqual([d.pools['claude-agent'].jobs,d.pools['claude-agent'].jobsDelta,d.pools['claude-agent'].passPp,d.pools['claude-agent'].failPp],[2,0,50,-50]);
  assert.equal(d.pools['claude-agent'].medianMinDelta,-10);   // [10,30] -> [10,10] min
  assert.equal(d.pools['devin-agent'].isNew,true);
  assert.equal(d.pools['devin-agent'].blockedPp,null);
  assert.equal(d.pools['qwen-agent'].isGone,true);
  const text=formatDelta(second);
  assert.match(text,/delta vs 2026-09-24-24h\.json: jobs 3 \(0\)/);
  assert.match(text,/ {2}claude: 2 jobs \(0\) pass 100% \(\+50pp\) fail -50pp blk 0pp med 10m \(-10m\)/);
  assert.match(text,/ {2}devin: 1 jobs \(\+1\) pass 0% \(-\) fail - blk - med 10m \(-\) \[new\]/);
  assert.match(text,/ {2}qwen: absent now \(was present\)/);
}));

test('a snapshot is never overwritten: an existing file refuses the run and stays byte-identical',t=>withLedger(t,({repoRoot,ledger})=>{
  const dir=tmp(t,'starci-bench-snap-'),qwenHome=emptyQwen(t);
  seedWorkflow(ledger,{id:'wf-day1',jobs:DAY1,now:T});
  const file=path.join(dir,'2026-09-24-24h.json');
  fs.writeFileSync(file,'{"frozen":true}\n');
  assert.throws(()=>takeSnapshot({repos:[repoRoot],sinceHours:24,now:T,date:'2026-09-24',dir,qwenHome}),
    e=>e.code==='EEXIST'&&/append-only/.test(e.message));
  assert.equal(fs.readFileSync(file,'utf8'),'{"frozen":true}\n');
  assert.throws(()=>takeSnapshot({repos:[repoRoot],sinceHours:0,dir,qwenHome}),e=>e.code==='EUSAGE');
  assert.throws(()=>takeSnapshot({repos:[repoRoot],sinceHours:24,date:'25-09-2026',dir,qwenHome}),e=>e.code==='EUSAGE');
  assert.throws(()=>takeSnapshot({sinceHours:24,dir,sourceRoot:tmp(t,'starci-bench-src-'),qwenHome}),e=>e.code==='EUSAGE'&&/--repo/.test(e.message));
}));

test('previousSnapshot takes the newest earlier file of the same window only',t=>{
  const dir=tmp(t,'starci-bench-snap-');
  for(const name of ['2026-09-20-72h.json','2026-09-22-72h.json','2026-09-23-24h.json','2026-09-26-72h.json','notes.txt'])
    fs.writeFileSync(path.join(dir,name),JSON.stringify({jobs:1,pools:{}}));
  assert.equal(previousSnapshot(dir,'2026-09-25-72h.json',72).file,'2026-09-22-72h.json');
  assert.equal(previousSnapshot(dir,'2026-09-20-72h.json',72),null);
  assert.equal(previousSnapshot(path.join(dir,'absent'),'2026-09-25-72h.json',72),null);
  const delta=snapshotDelta({jobs:4,pools:{'(unrouted)':{jobs:4,passRate:0,medianMs:null}}},{jobs:1,pools:{}});
  assert.deepEqual([delta.jobsDelta,delta.pools['(unrouted)'].isNew,delta.pools['(unrouted)'].medianMin],[3,true,null]);
});

test('CLI: --repo/--dir/--date write the file and print the delta; a second run on the same name exits 1',t=>withLedger(t,({repoRoot,ledger})=>{
  const dir=tmp(t,'starci-bench-snap-');
  seedWorkflow(ledger,{id:'wf-cli',jobs:DAY2.map(j=>({...j,createdAt:Date.now()-H,updatedAt:Date.now()-H+10*MIN})),now:Date.now()});
  const run=()=>spawnSync(process.execPath,[SCRIPT,'--repo',repoRoot,'--since-hours','24','--date','2026-09-25','--dir',dir],{encoding:'utf8'});
  const ok=run();
  assert.equal(ok.status,0,ok.stderr);
  assert.match(ok.stdout,/benchmark snapshot 2026-09-25-24h\.json: 3 jobs over 1 repo\(s\), window 24h/);
  const body=fs.readFileSync(path.join(dir,'2026-09-25-24h.json'),'utf8');
  assert.equal(JSON.parse(body).jobs,3);
  const again=run();
  assert.equal(again.status,1);
  assert.match(again.stderr,/append-only/);
  assert.equal(fs.readFileSync(path.join(dir,'2026-09-25-24h.json'),'utf8'),body);
  const usage=spawnSync(process.execPath,[SCRIPT,'--repo',repoRoot],{encoding:'utf8'});
  assert.equal(usage.status,2);
}));
