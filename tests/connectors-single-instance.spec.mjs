import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {claimManager,lockHolder,recordAlive} from '../scripts/connectors/lib.mjs';
import {tunnelState} from '../scripts/connectors/tunnel.mjs';

// `api serve-ask` runs `tunnel.mjs start` for every ask, and concurrent starts each launched a manager
// before the first wrote tunnel.json: nine managers, nine cloudflared. A manager (tunnel `run`,
// ask-gateway `run`) now claims <state>/<name>.lock exclusively and refuses while another live manager
// holds it or owns the state file. These specs start managers concurrently and get exactly one.

const ROOT=path.resolve(import.meta.dirname,'..');
const TUNNEL=pathToFileURL(path.join(ROOT,'scripts','connectors','tunnel.mjs')).href;
const GATEWAY=path.join(ROOT,'scripts','connectors','ask-gateway.mjs');
const tmp=(t,prefix)=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return dir;};
const kill=pid=>{if(!pid)return;try{process.kill(pid);}catch{/* gone */}};

// Start `argv` as a node process and resolve with its first JSON stdout line (and the child).
const firstLine=(argv,env)=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,argv,{env,cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='';
  const timer=setTimeout(()=>reject(Error(`no output from ${argv.join(' ')}`)),20000);
  child.stdout.on('data',chunk=>{
    out+=chunk;
    const line=out.split(/\r?\n/).find(l=>l.trim().startsWith('{'));
    if(line){clearTimeout(timer);resolve({child,answer:JSON.parse(line)});}
  });
  child.on('exit',code=>{if(!out.trim()){clearTimeout(timer);resolve({child,answer:null,code});}});
});
const deadPid=()=>spawnSync(process.execPath,['-e','0']).pid;

test('two tunnel managers started at once leave exactly one manager and one cloudflared',async t=>{
  const home=tmp(t,'starci-tunnel-single-');
  const fake=path.join(home,'fake-cloudflared.cjs');
  const launched=path.join(home,'cloudflared-pids.txt');
  fs.writeFileSync(fake,`require('fs').appendFileSync(${JSON.stringify(launched)},process.pid+'\\n');process.stderr.write('Registered tunnel connection connIndex=0\\n');setTimeout(()=>process.exit(0),60000);`);
  const manager=path.join(home,'manager.mjs');
  fs.writeFileSync(manager,`import {runManager} from ${JSON.stringify(TUNNEL)};
const r=runManager({mode:'quick'},{port:7070,env:process.env});
console.log(JSON.stringify({ok:r.ok,pid:process.pid,holder:r.holder?.pid??null}));
if(!r.ok)process.exit(1);
setInterval(()=>{},1000);`);
  const env={...process.env,LOCALAPPDATA:home,STARCI_CLOUDFLARED_COMMAND:process.execPath,STARCI_CLOUDFLARED_ARGS:JSON.stringify([fake])};
  const runs=await Promise.all([firstLine([manager],env),firstLine([manager],env)]);
  const winners=runs.filter(r=>r.answer?.ok===true);
  t.after(()=>{for(const r of runs)kill(r.child.pid);kill(tunnelState(env)?.childPid);});
  assert.equal(winners.length,1,JSON.stringify(runs.map(r=>r.answer)));
  const loser=runs.find(r=>r!==winners[0]);
  assert.equal(loser.answer?.ok,false,'the second manager refuses');
  const winner=winners[0].answer.pid;
  assert.equal(tunnelState(env)?.pid,winner,'tunnel.json names the one manager');
  assert.equal(lockHolder('tunnel',env)?.pid,winner);
  // A third start while the manager lives is refused on the state record alone.
  const third=await firstLine([manager],env);
  assert.equal(third.answer?.ok,false);
  assert.equal(third.answer?.holder,winner);
  const pids=()=>fs.existsSync(launched)?fs.readFileSync(launched,'utf8').split('\n').filter(Boolean):[];
  for(const end=Date.now()+5000;!pids().length&&Date.now()<end;)await new Promise(r=>setTimeout(r,50));
  await new Promise(r=>setTimeout(r,300));
  assert.equal(pids().length,1,'one cloudflared');
});

test('two ask gateways started at once leave exactly one serving',async t=>{
  const home=tmp(t,'starci-gateway-single-');
  const env={...process.env,LOCALAPPDATA:home};
  const runs=await Promise.all([firstLine([GATEWAY,'run','--port','0'],env),firstLine([GATEWAY,'run','--port','0'],env)]);
  t.after(()=>{for(const r of runs)kill(r.child.pid);});
  const serving=runs.filter(r=>r.answer?.ok===true);
  assert.equal(serving.length,1,JSON.stringify(runs.map(r=>r.answer)));
  assert.equal(runs.find(r=>r!==serving[0]).answer?.already,true);
  assert.equal(lockHolder('gateway',env)?.pid,serving[0].answer.pid);
});

test('a manager lock whose holder died, or that an earlier boot left, is taken over; a live one is not',t=>{
  const home=tmp(t,'starci-lock-stale-');
  const env={LOCALAPPDATA:home};
  const file=path.join(home,'StarCi','runtime','connectors','probe.lock');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const write=record=>fs.writeFileSync(file,JSON.stringify(record));

  write({pid:deadPid(),startedAt:new Date().toISOString()});
  let claim=claimManager('probe',{env});
  assert.equal(claim.ok,true,'a dead holder is stale');
  claim.release();
  assert.equal(fs.existsSync(file),false,'release removes the lock');

  write({pid:process.ppid,startedAt:'2000-01-01T00:00:00.000Z'});
  assert.equal(recordAlive({pid:process.ppid,startedAt:'2000-01-01T00:00:00.000Z'}),false,'a pid recorded before this boot names another process');
  claim=claimManager('probe',{env});
  assert.equal(claim.ok,true,'a lock from an earlier boot is stale');
  claim.release();

  write({pid:process.ppid,startedAt:new Date().toISOString()});
  claim=claimManager('probe',{env});
  assert.equal(claim.ok,false,'a live holder keeps its lock');
  assert.equal(claim.holder.pid,process.ppid);

  fs.rmSync(file);
  claim=claimManager('probe',{env,current:{pid:process.ppid,startedAt:new Date().toISOString()}});
  assert.equal(claim.ok,false,'a live manager named by the state file owns it even without a lock');
  assert.equal(fs.existsSync(file),false);
});
