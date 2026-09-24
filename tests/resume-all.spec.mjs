import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {parseWatchdogLine,planWatchdogs,resumeAll,resumeRepos,runningWorkflows,startupTasks,renderSchtasks,waitForOrca} from '../scripts/kernel/resume-all.mjs';

// After a reboot nothing restarts the watchdogs, so no dead Kernel is ever
// relaunched. scripts/kernel/resume-all.mjs restarts exactly the missing ones.
// Every host seam (process table, spawner, Orca probe, connectors) is injected.

const WATCHDOG='C:\\starci\\scripts\\kernel\\watchdog.mjs';
const line=(pid,args)=>`${pid}|133000000000000000|"C:\\Program Files\\nodejs\\node.exe" ${WATCHDOG} ${args}`;

const seedLedger=ledger=>{
  seedWorkflow(ledger,{id:'wf-guarded',state:{phase:'running'}});
  seedWorkflow(ledger,{id:'wf-orphan',state:{phase:'running'}});
  seedWorkflow(ledger,{id:'wf-done',state:{phase:'finished'}});
  seedWorkflow(ledger,{id:'wf-archived',state:{phase:'running'}});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id IN ('wf-guarded','wf-orphan','wf-archived')").run();
  ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-done'").run();
  ledger.db.prepare("UPDATE workflows SET archived_at=? WHERE workflow_id='wf-archived'").run(Date.now());
};

test('a watchdog line names its workflow, repo and flags; the per-tick --once child and other processes are told apart',()=>{
  const loop=parseWatchdogLine(line(41,'--repo D:\\Repositories\\nivo-backend --workflow wf-a --repair'));
  assert.deepEqual({pid:loop.pid,workflowId:loop.workflowId,repo:loop.repo,repair:loop.repair,once:loop.once},
    {pid:41,workflowId:'wf-a',repo:'D:\\Repositories\\nivo-backend',repair:true,once:false});
  assert.equal(parseWatchdogLine(line(42,'--repo "D:/My Repos/x" --goal wf-b --repair --once --json')).once,true);
  assert.equal(parseWatchdogLine(line(42,'--repo "D:/My Repos/x" --goal wf-b')).repo,'D:/My Repos/x');
  assert.equal(parseWatchdogLine('43|0|node scripts/connectors/tunnel.mjs run --port 7070'),null);
  assert.equal(parseWatchdogLine('garbage'),null);
});

test('resume-all starts a watchdog only for a running, unarchived workflow that has no watchdog loop',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLedger(ledger);
  assert.deepEqual(runningWorkflows(repoRoot).map(w=>w.workflowId),['wf-guarded','wf-orphan']);
  const spawned=[];
  const result=resumeAll({repos:[repoRoot],
    watchdogs:()=>[
      parseWatchdogLine(line(10,`--repo ${repoRoot} --workflow wf-guarded --repair`)),
      // a loop's per-tick child is not a second watchdog, and a finished
      // workflow's leftover watchdog does not matter
      parseWatchdogLine(line(11,`--repo ${repoRoot} --workflow wf-orphan --repair --once --json`)),
      parseWatchdogLine(line(12,`--repo ${repoRoot} --workflow wf-done --repair`)),
    ],
    spawn:wf=>{spawned.push(wf);return {pid:900+spawned.length,log:`logs/${wf.workflowId}.log`};},
    probe:()=>true,connectors:{cloudflare:{mode:'off'}},startOne:()=>assert.fail('connectors are off')});
  assert.equal(result.ok,true);
  assert.deepEqual(spawned,[{workflowId:'wf-orphan',repo:repoRoot}]);
  assert.deepEqual(result.started.map(w=>[w.workflowId,w.pid]),[['wf-orphan',901]]);
  assert.deepEqual(result.present.map(w=>[w.workflowId,w.pid]),[['wf-guarded',10]]);
  assert.deepEqual(result.duplicate,[]);
}));

test('resume-all is idempotent: with every workflow guarded it starts nothing and never probes Orca',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLedger(ledger);
  const result=resumeAll({repos:[repoRoot],
    watchdogs:()=>['wf-guarded','wf-orphan'].map((id,i)=>parseWatchdogLine(line(20+i,`--repo ${repoRoot} --workflow ${id} --repair`))),
    spawn:()=>assert.fail('nothing to start'),probe:()=>assert.fail('no Orca call without a watchdog to start'),
    connectors:{cloudflare:{mode:'off'}}});
  assert.equal(result.ok,true);
  assert.equal(result.started.length,0);
  assert.equal(result.orca,null);
}));

test('two watchdog loops for one workflow are reported, never multiplied or stopped',()=>{
  const plan=planWatchdogs({workflows:[{workflowId:'wf-x',repo:'r'}],
    watchdogs:[parseWatchdogLine(line(1,'--repo r --workflow wf-x --repair')),parseWatchdogLine(line(2,'--repo r --workflow wf-x --repair --json'))]});
  assert.deepEqual(plan.start,[]);
  assert.deepEqual(plan.duplicate,[{workflowId:'wf-x',repo:'r',pids:[1,2]}]);
});

test('while Orca is not up resume-all backs off, retries for a bounded time, then starts the watchdogs',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLedger(ledger);
  let clock=0,probes=0;
  const sleeps=[];
  const sleep=ms=>{sleeps.push(ms);clock+=ms;};
  const now=()=>clock;
  const ready=waitForOrca({probe:()=>++probes>=3,waitMs:60000,sleep,now});
  assert.deepEqual(ready,{ready:true,attempts:3,waitedMs:15000});
  assert.deepEqual(sleeps,[5000,10000],'5s doubling');
  clock=0;sleeps.length=0;
  const gaveUp=waitForOrca({probe:()=>false,waitMs:20000,sleep,now});
  assert.equal(gaveUp.ready,false);
  assert.equal(clock,20000,'never waits past the bound');
  let up=false;const spawned=[];
  const blocked=resumeAll({repos:[repoRoot],watchdogs:()=>[],spawn:wf=>{spawned.push(wf);return {pid:1};},
    probe:()=>up,waitMs:0,connectors:{cloudflare:{mode:'off'}}});
  assert.equal(blocked.ok,false);
  assert.equal(blocked.skipped,'orca-unavailable');
  assert.deepEqual(blocked.pending.map(w=>w.workflowId),['wf-guarded','wf-orphan']);
  assert.equal(spawned.length,0,'no watchdog starts into a host without Orca');
  up=true;
  const resumed=resumeAll({repos:[repoRoot],watchdogs:()=>[],spawn:wf=>{spawned.push(wf);return {pid:1};},
    probe:()=>up,connectors:{cloudflare:{mode:'off'}}});
  assert.equal(resumed.ok,true);
  assert.deepEqual(spawned.map(w=>w.workflowId),['wf-guarded','wf-orphan']);
}));

test('the ask gateway and tunnel start only when connectors.cloudflare.mode is not off and they are not already running',t=>withLedger(t,({repoRoot})=>{
  const started=[];
  const on=resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>true,connectors:{cloudflare:{mode:'named'}},connectorAlive:()=>false,
    startOne:script=>{started.push(script);return {ok:true};}});
  assert.equal(on.ok,true);
  assert.equal(started.length,2);
  assert.ok(started.some(s=>s.endsWith('ask-gateway.mjs'))&&started.some(s=>s.endsWith('tunnel.mjs')));
  started.length=0;
  const running=resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>true,connectors:{cloudflare:{mode:'named'}},
    connectorAlive:script=>script.endsWith('tunnel.mjs'),startOne:s=>{started.push(s);return {ok:true};}});
  assert.deepEqual(started.map(s=>path.basename(s)),['ask-gateway.mjs'],'a running tunnel is left alone');
  assert.deepEqual(running.connectors.find(c=>c.script==='tunnel.mjs'),{script:'tunnel.mjs',ok:true,already:true});
  started.length=0;
  const dry=resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>true,connectors:{cloudflare:{mode:'named'}},dryRun:true,
    connectorAlive:script=>script.endsWith('tunnel.mjs'),startOne:s=>{started.push(s);return {ok:true};}});
  assert.equal(started.length,0,'a dry run starts nothing');
  assert.deepEqual(dry.connectors.map(c=>[c.script,Boolean(c.already),Boolean(c.wouldStart)]),[['ask-gateway.mjs',false,true],['tunnel.mjs',true,false]]);
  resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>true,connectors:{cloudflare:{mode:'off'}},connectorAlive:()=>false,startOne:s=>{started.push(s);return {ok:true};}});
  assert.equal(started.length,0);
}));

test('only the ledgers config.yaml supervisor.repos lists (plus --repo) are resumed; nothing is discovered',t=>withLedger(t,({root,repoRoot})=>{
  const source=path.dirname(repoRoot),other=path.join(root,'no-ledger');
  fs.mkdirSync(other,{recursive:true});
  const env={...process.env,STARCI_SOURCE_ROOT:source};
  assert.deepEqual(resumeRepos({config:{supervisor:{repos:[]}},env}),{repos:[],missing:[]},'an empty list resumes nothing, not the source root');
  assert.deepEqual(resumeRepos({config:{supervisor:{repos:['repo','repo']}},env}),{repos:[repoRoot],missing:[]},'relative to the source root, once');
  assert.deepEqual(resumeRepos({config:{supervisor:{}},env,extra:[other,repoRoot]}),{repos:[repoRoot],missing:[other]});
}));

test('--install-startup names a logon task that waits for Orca and a 10-minute task, both limited and overwritable',()=>{
  const [logon,every]=startupTasks({node:'C:\\node\\node.exe',script:'D:\\starci\\scripts\\kernel\\resume-all.mjs'});
  assert.deepEqual(logon.argv.slice(0,8),['/Create','/TN','StarCi-Resume','/SC','ONLOGON','/RL','LIMITED','/TR']);
  assert.equal(logon.argv[8],'"C:\\node\\node.exe" "D:\\starci\\scripts\\kernel\\resume-all.mjs" --wait-orca');
  assert.deepEqual(every.argv.slice(2,8),['StarCi-Resume-Every10m','/SC','MINUTE','/MO','10','/RL']);
  assert.ok(logon.argv.includes('/F')&&every.argv.includes('/F'));
  assert.match(renderSchtasks(logon),/^schtasks \/Create \/TN StarCi-Resume \/SC ONLOGON \/RL LIMITED \/TR ".+--wait-orca" \/F$/);
});

test('the post-reboot dedupe runs once Orca answers and before any watchdog starts; a pass with every watchdog present skips it unless asked',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLedger(ledger);
  const order=[];
  const dedupeFn=({repos})=>{order.push(['dedupe',repos]);return {ok:true,closed:[{handle:'term-old',kind:'agent',marker:'[Kernel]',ok:true,repo:repoRoot}],kept:[],deferred:[]};};
  const logs=[];
  const reboot=resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>true,connectors:{cloudflare:{mode:'off'}},
    spawn:wf=>{order.push(['spawn',wf.workflowId]);return {pid:1};},dedupeFn,logDedupeFn:d=>{logs.push(d);return 'resume-all.log';},orphansOf:()=>[]});
  assert.deepEqual(order.map(o=>o[0]),['dedupe','spawn','spawn'],'strays close before a watchdog can start a kernel beside them');
  assert.deepEqual(reboot.dedupe.closed.map(c=>c.handle),['term-old'],'what was closed is in the JSON');
  assert.equal(reboot.dedupe.logFile,'resume-all.log');
  assert.equal(logs.length,1);
  order.length=0;
  const steady=resumeAll({repos:[repoRoot],watchdogs:()=>['wf-guarded','wf-orphan'].map((id,i)=>parseWatchdogLine(line(30+i,`--repo ${repoRoot} --workflow ${id} --repair`))),
    probe:()=>assert.fail('a steady pass makes no Orca call'),connectors:{cloudflare:{mode:'off'}},dedupeFn,orphansOf:()=>[]});
  assert.equal(steady.dedupe,null);
  assert.deepEqual(order,[]);
  const asked=resumeAll({repos:[repoRoot],watchdogs:()=>['wf-guarded','wf-orphan'].map((id,i)=>parseWatchdogLine(line(30+i,`--repo ${repoRoot} --workflow ${id} --repair`))),
    probe:()=>true,connectors:{cloudflare:{mode:'off'}},dedupe:true,dedupeFn,logDedupeFn:()=>null,orphansOf:()=>[]});
  assert.equal(asked.dedupe.closed.length,1,'--dedupe runs it with every watchdog present');
  const down=resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>false,connectors:{cloudflare:{mode:'off'}},dedupe:true,
    dedupeFn:()=>assert.fail('no dedupe while Orca does not answer'),orphansOf:()=>[]});
  assert.equal(down.skipped,'orca-unavailable');
  const off=resumeAll({repos:[repoRoot],watchdogs:()=>[],probe:()=>true,spawn:()=>({pid:1}),connectors:{cloudflare:{mode:'off'}},dedupe:false,
    dedupeFn:()=>assert.fail('--no-dedupe'),orphansOf:()=>[]});
  assert.equal(off.dedupe,null);
}));

test('resume-all reports kernel jobs of finished or archived workflows',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLedger(ledger);
  ledger.enqueueJob({jobId:'kernel-wf-done',workflowId:'wf-done',kind:'kernel'});
  ledger.db.prepare("UPDATE jobs SET status='running',worker_id='term-x' WHERE job_id='kernel-wf-done'").run();
  const result=resumeAll({repos:[repoRoot],watchdogs:()=>['wf-guarded','wf-orphan'].map((id,i)=>parseWatchdogLine(line(40+i,`--repo ${repoRoot} --workflow ${id} --repair`))),
    probe:()=>true,connectors:{cloudflare:{mode:'off'}}});
  assert.deepEqual(result.orphanKernelJobs.map(o=>[o.jobId,o.phase,o.terminal]),[['kernel-wf-done','finished','term-x']]);
}));
