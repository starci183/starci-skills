import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sweepDevinData,devinRoot} from '../scripts/lib/hk-devin.mjs';

// hk-devin sweeps %APPDATA%/devin without ever touching cli/sessions.db: the sqlite file and its
// WAL/SHM siblings are reported by size only. When any devin* process runs, every mutation is
// skipped; when none runs, files in the history dirs (summaries/, transcripts/, History/) older
// than allocation.housekeeping.sessionArchiveAfterMs move to <archiveRoot>/devin/<relative path>.

const DAY=86400000;
const NOW=Date.parse('2026-09-26T12:00:00Z');
const none=async()=>['node.exe','explorer.exe'];
const running=async()=>['devin.exe','node.exe'];

const fixture=(t)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-hk-devin-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const appdata=path.join(root,'appdata');
  const devin=path.join(appdata,'devin');
  const archive=path.join(root,'archive');
  for(const dir of ['cli/summaries','cli/transcripts','summaries','cli','User/History'])
    fs.mkdirSync(path.join(devin,dir),{recursive:true});
  const file=(rel,bytes,ageDays)=>{
    const p=path.join(devin,rel);
    fs.mkdirSync(path.dirname(p),{recursive:true});
    fs.writeFileSync(p,Buffer.alloc(bytes,7));
    const mtime=new Date(NOW-ageDays*DAY);
    fs.utimesSync(p,mtime,mtime);
    return p;
  };
  file('cli/sessions.db',4096,30); // mtime is irrelevant: it is report-only, never moved
  file('cli/sessions.db-wal',1024,30);
  file('cli/sessions.db-shm',64,30);
  const env={...process.env,APPDATA:appdata};
  const allocation={housekeeping:{archiveRoot:archive,sessionArchiveAfterMs:3*DAY}};
  const sweep=(opts={})=>sweepDevinData({env,now:NOW,allocation,processes:none,...opts});
  return {root,appdata,devin,archive,env,allocation,file,sweep};
};

test('reports sessions.db and WAL/SHM sizes and never moves them, even in apply mode',async t=>{
  const f=fixture(t);
  f.file('cli/summaries/history_1.md',500,10);
  const r=await f.sweep({apply:true});
  assert.equal(r.ok,true);
  assert.equal(r.report.devinRunning,false);
  assert.equal(r.report.sessionsDbBytes,4096);
  assert.equal(r.report.walBytes,1024);
  assert.equal(r.report.shmBytes,64);
  for(const name of ['sessions.db','sessions.db-wal','sessions.db-shm']){
    const db=path.join(f.devin,'cli',name);
    assert.ok(fs.existsSync(db),`${name} must still exist`);
    assert.ok(!fs.existsSync(path.join(f.archive,'devin','cli',name)),`${name} must never be archived`);
    assert.ok(r.skipped.some(s=>s.path===db&&/sqlite/.test(s.reason)),`skip entry explains ${name}`);
  }
});

test('a running devin process skips every mutation and returns the size report only',async t=>{
  const f=fixture(t);
  const old=f.file('cli/transcripts/calm-fox.json',800,10);
  f.file('summaries/enshrined-spoonbill.md',300,10);
  const r=await f.sweep({apply:true,processes:running});
  assert.equal(r.ok,true);
  assert.equal(r.report.devinRunning,true);
  assert.equal(r.report.sessionsDbBytes,4096);
  assert.equal(r.report.walBytes,1024);
  assert.equal(r.movedBytes,0);
  assert.equal(r.freedBytes,0);
  assert.ok(fs.existsSync(old),'old transcript stays while devin runs');
  assert.ok(!fs.existsSync(f.archive),'archive root is never created');
  assert.ok(r.skipped.some(s=>/devin process is running/.test(s.reason)));
});

test('when no devin runs, apply archives history files older than 3d preserving relative paths',async t=>{
  const f=fixture(t);
  const oldMd=f.file('cli/summaries/history_006dfaf8232547dd.md',700,10);
  const oldJson=f.file('cli/transcripts/acute-skirt.json',900,4);
  const oldTop=f.file('summaries/granite-power.md',200,30);
  f.file('cli/summaries/fresh.md',150,1);            // younger than 3d: stays
  f.file('cli/summaries/notes.bin',150,10);          // not a history extension: stays
  f.file('cli/sessions.db-wal',1024,30);             // already there; assert again it stays
  const r=await f.sweep({apply:true});
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(r.report.devinRunning,false);
  assert.equal(r.report.candidateFiles,3);
  assert.equal(r.movedBytes,700+900+200);
  assert.equal(r.freedBytes,r.movedBytes);
  for(const [src,rel] of [[oldMd,'cli/summaries/history_006dfaf8232547dd.md'],[oldJson,'cli/transcripts/acute-skirt.json'],[oldTop,'summaries/granite-power.md']]){
    assert.ok(!fs.existsSync(src),`${rel} left the devin root`);
    const dst=path.join(f.archive,'devin',...rel.split('/'));
    assert.ok(fs.existsSync(dst),`archive keeps the relative path ${rel}`);
    assert.equal(fs.statSync(dst).size,fs.readFileSync(dst).length);
  }
  assert.ok(fs.existsSync(path.join(f.devin,'cli','summaries','fresh.md')),'young file stays');
  assert.ok(fs.existsSync(path.join(f.devin,'cli','summaries','notes.bin')),'non-history extension stays');
  assert.ok(fs.existsSync(path.join(f.devin,'cli','sessions.db')),'sessions.db untouched');
});

test('dry run plans the same files but moves nothing and creates no archive',async t=>{
  const f=fixture(t);
  const old=f.file('cli/transcripts/booming-nurse.json',600,9);
  const r=await f.sweep({apply:false});
  assert.equal(r.ok,true);
  assert.equal(r.report.candidateFiles,1);
  assert.equal(r.movedBytes,600);
  assert.equal(r.freedBytes,600);
  assert.ok(fs.existsSync(old),'dry run leaves the file');
  assert.ok(!fs.existsSync(f.archive),'dry run creates nothing');
  assert.ok(r.skipped.some(s=>s.path===old&&/dry run/.test(s.reason)));
});

test('a linked directory inside the devin root is never descended or moved through',async t=>{
  const f=fixture(t);
  const outside=path.join(f.root,'elsewhere');
  fs.mkdirSync(outside,{recursive:true});
  const payload=path.join(outside,'escape.md');
  fs.writeFileSync(payload,Buffer.alloc(50));
  const old=new Date(NOW-10*DAY);fs.utimesSync(payload,old,old);
  const link=path.join(f.devin,'cli','transcripts','linked');
  try{fs.symlinkSync(outside,link,'junction');}catch{return t.skip('no privilege to create a junction');}
  const r=await f.sweep({apply:true});
  assert.equal(r.ok,true);
  assert.ok(fs.existsSync(payload),'the link target is never touched');
  assert.ok(fs.existsSync(link),'the link itself stays');
  assert.ok(r.skipped.some(s=>s.path===link&&/link/.test(s.reason)));
});

test('a process probe that cannot answer fails closed',async t=>{
  const f=fixture(t);
  const old=f.file('cli/transcripts/bejeweled-enquiry.json',400,10);
  const r=await f.sweep({apply:true,processes:async()=>{throw Error('tasklist gone');}});
  assert.equal(r.report.devinRunning,true);
  assert.equal(r.movedBytes,0);
  assert.ok(fs.existsSync(old));
  assert.ok(r.errors.some(e=>e.code==='PROBE'));
});

test('a missing devin root reports zeros and stays ok',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-hk-devin-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const r=await sweepDevinData({env:{APPDATA:path.join(root,'appdata')},now:NOW,allocation:{housekeeping:{}},processes:none});
  assert.equal(r.ok,true);
  assert.equal(r.report.sessionsDbBytes,0);
  assert.equal(r.report.walBytes,0);
  assert.equal(r.movedBytes,0);
});

test('devinRoot resolves under APPDATA on Windows spelling',()=>{
  assert.equal(devinRoot({APPDATA:'C:/Users/X/AppData/Roaming'}),path.join('C:/Users/X/AppData/Roaming','devin'));
});
