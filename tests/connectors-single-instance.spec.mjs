import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {claimManager,lockHolder,markStarting,recordAlive,writeConnectorState} from '../scripts/connectors/lib.mjs';
import {withMachine} from '../engine/machine-db.mjs';
import {ensureAskConnectors,managerAlive,tunnelHealth,tunnelState} from '../scripts/connectors/tunnel.mjs';
import {createGateway} from '../scripts/connectors/ask-gateway.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {mkdtemp} from './helpers/tmpdir.mjs';

// `api serve-ask` runs `tunnel.mjs start` for every ask, and concurrent starts each launched a manager
// before the first wrote tunnel.json: nine managers, nine cloudflared. A manager (tunnel `run`,
// ask-gateway `run`) now claims the host lock <name> (machine.sqlite host_locks) and refuses while another live
// manager holds it or owns the connectors row. These specs start managers concurrently and get exactly one. Every
// case has its own machine.sqlite (STARCI_TEST_MACHINE_FILE under its temp home).

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
const storeOf=home=>({STARCI_TEST_MACHINE_FILE:path.join(home,'machine.sqlite')});
// Write the host lock row `name` as another process would have left it.
const putLock=(env,name,{pid,startedAt=Date.now()})=>withMachine(m=>m.upsert('host_locks',{name,holder_pid:pid,holder:'spec',started_at:startedAt,heartbeat_at:startedAt,expires_at:Date.now()+600000,state:'held'},['name']),{env});
const freeLock=(env,name)=>withMachine(m=>m.releaseHostLock({name,force:true}),{env});
const lockRow=(env,name)=>withMachine(m=>m.hostLock(name),{env});

test('two tunnel managers started at once leave exactly one manager and one cloudflared',async t=>{
  // Kills run inside the same after-callback ahead of the rm: the children write under home, so an rm
  // registered before them either EPERMs on a held file or the losers recreate the tree it just removed.
  const home=mkdtemp(t,'starci-tunnel-single-',()=>{for(const r of runs)kill(r.child.pid);kill(tunnelState(env)?.childPid);});
  const fake=path.join(home,'fake-cloudflared.cjs');
  const launched=path.join(home,'cloudflared-pids.txt');
  fs.writeFileSync(fake,`require('fs').appendFileSync(${JSON.stringify(launched)},process.pid+'\\n');process.stderr.write('Registered tunnel connection connIndex=0\\n');setTimeout(()=>process.exit(0),60000);`);
  const manager=path.join(home,'manager.mjs');
  fs.writeFileSync(manager,`import {runManager} from ${JSON.stringify(TUNNEL)};
const r=runManager({mode:'quick'},{port:7070,env:process.env});
console.log(JSON.stringify({ok:r.ok,pid:process.pid,holder:r.holder?.pid??null}));
if(!r.ok)process.exit(1);
setInterval(()=>{},1000);`);
  const env={...process.env,LOCALAPPDATA:home,...storeOf(home),STARCI_CLOUDFLARED_COMMAND:process.execPath,STARCI_CLOUDFLARED_ARGS:JSON.stringify([fake])};
  const runs=await Promise.all([firstLine([manager],env),firstLine([manager],env)]);
  const winners=runs.filter(r=>r.answer?.ok===true);
  assert.equal(winners.length,1,JSON.stringify(runs.map(r=>r.answer)));
  const loser=runs.find(r=>r!==winners[0]);
  assert.equal(loser.answer?.ok,false,'the second manager refuses');
  const winner=winners[0].answer.pid;
  assert.equal(tunnelState(env)?.pid,winner,'the connectors row names the one manager');
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
  const home=mkdtemp(t,'starci-gateway-single-',()=>{for(const r of runs)kill(r.child.pid);});
  const env={...process.env,LOCALAPPDATA:home,...storeOf(home)};
  const runs=await Promise.all([firstLine([GATEWAY,'run','--port','0'],env),firstLine([GATEWAY,'run','--port','0'],env)]);
  const serving=runs.filter(r=>r.answer?.ok===true);
  assert.equal(serving.length,1,JSON.stringify(runs.map(r=>r.answer)));
  assert.equal(runs.find(r=>r!==serving[0]).answer?.already,true);
  assert.equal(lockHolder('gateway',env)?.pid,serving[0].answer.pid);
});

// 18 `tunnel.mjs run --port 7070` managers once ran at once, and response.<domain> answered 502 after
// the supervisor killed 17 of them.
test('a tunnel manager that loses its host lock to another live process stops its cloudflared and exits',async t=>{
  const home=mkdtemp(t,'starci-tunnel-lost-',()=>{kill(child.pid);kill(cloudflared);});
  const fake=path.join(home,'fake-cloudflared.cjs');
  const launched=path.join(home,'cloudflared-pids.txt');
  fs.writeFileSync(fake,`require('fs').appendFileSync(${JSON.stringify(launched)},process.pid+'\\n');process.stderr.write('Registered tunnel connection connIndex=0\\n');setTimeout(()=>process.exit(0),60000);`);
  const manager=path.join(home,'manager.mjs');
  fs.writeFileSync(manager,`import {runManager} from ${JSON.stringify(TUNNEL)};
const r=runManager({mode:'quick'},{port:7070,env:process.env,checkMs:100,onLost:h=>{console.log(JSON.stringify({lost:h.pid}));process.exit(0);}});
console.log(JSON.stringify({ok:r.ok,pid:process.pid}));
if(!r.ok)process.exit(1);
setInterval(()=>{},1000);`);
  const env={...process.env,LOCALAPPDATA:home,...storeOf(home),STARCI_CLOUDFLARED_COMMAND:process.execPath,STARCI_CLOUDFLARED_ARGS:JSON.stringify([fake])};
  const {child,answer}=await firstLine([manager],env);
  assert.equal(answer?.ok,true);
  const pids=()=>fs.existsSync(launched)?fs.readFileSync(launched,'utf8').split('\n').filter(Boolean).map(Number):[];
  for(const end=Date.now()+8000;!pids().length&&Date.now()<end;)await new Promise(r=>setTimeout(r,50));
  const [cloudflared]=pids();
  // The lock is freed under the manager: the owner takes it back.
  freeLock(env,'tunnel');
  for(const end=Date.now()+5000;lockHolder('tunnel',env)?.pid!==child.pid&&Date.now()<end;)await new Promise(r=>setTimeout(r,50));
  assert.equal(lockHolder('tunnel',env)?.pid,child.pid,'a manager whose lock was freed re-claims it');
  // Another live process now holds the lock: this manager is not the owner and must go.
  const gone=new Promise(resolve=>child.on('exit',code=>resolve(code)));
  let out='';child.stdout.on('data',c=>{out+=c;});
  putLock(env,'tunnel',{pid:process.pid});
  const code=await Promise.race([gone,new Promise(r=>setTimeout(()=>r('timeout'),10000))]);
  assert.equal(code,0,'the manager exited on its own');
  assert.match(out,new RegExp(`"lost":${process.pid}`));
  for(const end=Date.now()+5000;Date.now()<end;){try{process.kill(cloudflared,0);}catch{break;}await new Promise(r=>setTimeout(r,50));}
  assert.throws(()=>process.kill(cloudflared,0),'its cloudflared was stopped with it');
  assert.equal(tunnelState(env)?.childPid,cloudflared,'the loser leaves the connectors row alone (it is the winner\'s to write)');
});

test('ensureAskConnectors starts the gateway and one manager, never a second while one is alive or still starting',t=>{
  const home=tmp(t,'starci-ensure-');
  const env={LOCALAPPDATA:home,STARCI_CLOUDFLARED_COMMAND:process.execPath};
  const config={...parseYaml(fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8')),connectors:{secretsFile:null,cloudflare:{mode:'quick'}}};
  const spawned=[];
  // The launched processes are stood in for by this live process, still starting (no lock yet).
  const spawn=(script,args)=>{spawned.push([path.basename(script),...args]);return process.pid;};
  assert.equal(ensureAskConnectors({env:{...env,STARCI_CONNECTORS_OFF:'1'},config,spawn}).skipped,'STARCI_CONNECTORS_OFF');
  assert.equal(ensureAskConnectors({env:{LOCALAPPDATA:home,NODE_TEST_CONTEXT:'child'},config,spawn}).skipped,'test context','a spec never starts the real cloudflared');
  const first=ensureAskConnectors({env,config,spawn});
  assert.deepEqual([first.ok,first.gateway,first.tunnel],[true,{launched:process.pid},{launched:process.pid}]);
  assert.deepEqual(spawned,[['ask-gateway.mjs','run','--port','7070'],['tunnel.mjs','run','--port','7070']]);
  const second=ensureAskConnectors({env,config,spawn});
  assert.deepEqual([second.gateway,second.tunnel],[{already:true},{already:process.pid}],'a manager still starting counts as alive');
  assert.equal(spawned.length,2,'no second manager');
  // Past the starting window with no lock and a dead pid, a manager is launched again.
  markStarting('tunnel',deadPid(),env);
  assert.deepEqual(ensureAskConnectors({env,config,spawn}).tunnel,{launched:process.pid});
  assert.equal(managerAlive(env)?.pid,process.pid);
});

test('tunnel status reports health: manager, cloudflared, gateway reachability, and every extra manager',async t=>{
  const home=tmp(t,'starci-health-');
  const env={LOCALAPPDATA:home,...storeOf(home)};
  const server=createGateway({resolve:()=>null});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(()=>resolve())));
  const port=server.address().port,at=new Date().toISOString();
  writeConnectorState('gateway',{pid:process.pid,port,config:{pid:process.pid,port,startedAt:at}},env);
  writeConnectorState('tunnel',{pid:process.pid,config:{pid:process.pid,childPid:process.pid,connected:true,baseUrl:'https://response.example.org',gatewayPort:port,startedAt:at}},env);
  const held=claimManager('tunnel',{env});
  const healthy=await tunnelHealth({env,processes:()=>[{pid:process.pid,commandLine:'node tunnel.mjs run --port 7070'}]});
  assert.equal(healthy.healthy,true,JSON.stringify(healthy.problems));
  assert.deepEqual([healthy.manager.pid,healthy.cloudflared.alive,healthy.gateway.reachable,healthy.gateway.status,healthy.gateway.gateway],[process.pid,true,true,404,true]);
  assert.equal(healthy.publicBase,'https://response.example.org');
  const leaked=await tunnelHealth({env,processes:()=>[{pid:process.pid},{pid:4242},{pid:4343}]});
  assert.equal(leaked.healthy,false);
  assert.match(leaked.problems.join('\n'),/2 extra tunnel manager\(s\) running: 4242, 4343/);
  held.release();
  await new Promise(resolve=>server.close(()=>resolve()));
  const down=await tunnelHealth({env,processes:null});
  assert.equal(down.healthy,false);
  assert.match(down.problems.join('\n'),/holds no tunnel host lock/);
  assert.match(down.problems.join('\n'),/nothing answers on 127\.0\.0\.1:\d+ .*502/,'a gateway that does not answer is why the public host 502s');
});

test('a manager lock whose holder died, or that an earlier boot left, is taken over; a live one is not',t=>{
  const home=tmp(t,'starci-lock-stale-');
  const env={LOCALAPPDATA:home,...storeOf(home)};
  const write=record=>putLock(env,'probe',record);

  write({pid:deadPid()});
  let claim=claimManager('probe',{env});
  assert.equal(claim.ok,true,'a dead holder is stale');
  claim.release();
  assert.equal(lockRow(env,'probe').state,'released','release frees the lock');
  assert.equal(lockHolder('probe',env),null);

  write({pid:process.ppid,startedAt:Date.parse('2000-01-01T00:00:00.000Z')});
  assert.equal(recordAlive({pid:process.ppid,startedAt:'2000-01-01T00:00:00.000Z'}),false,'a pid recorded before this boot names another process');
  claim=claimManager('probe',{env});
  assert.equal(claim.ok,true,'a lock from an earlier boot is stale');
  claim.release();

  write({pid:process.ppid});
  claim=claimManager('probe',{env});
  assert.equal(claim.ok,false,'a live holder keeps its lock');
  assert.equal(claim.holder.pid,process.ppid);

  freeLock(env,'probe');
  claim=claimManager('probe',{env,current:{pid:process.ppid,startedAt:new Date().toISOString()}});
  assert.equal(claim.ok,false,'a live manager named by its connectors row owns it even without a lock');
  assert.equal(lockRow(env,'probe').state,'released','nothing was claimed');
});
