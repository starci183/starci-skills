import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {stallFindings,judgeGate,ownerGates,namedPaths,GATE_GRACE_MS} from '../scripts/supervisor/stall.mjs';
import {planAlerts,runStallAlert,RATE_MS,alertStateFile} from '../scripts/supervisor/stall-alert.mjs';
import {readInbox} from '../scripts/connectors/telegram-bridge.mjs';
import {ensureStallAlert,resumeAll} from '../scripts/kernel/resume-all.mjs';

// Incident 2026-09-24: nivo Collab sat idle ~2 h behind owner-gate inc-48bc556d89a6 ("resolve when
// the shell record .starciwork/shell/index.yaml exists (peer heads-up)") after the record had landed
// and the peer's ask had closed. Kernel and watchdog were alive; the supervisor digest checked
// liveness only. scripts/supervisor/stall.mjs classifies progress; stall-alert.mjs tells the
// supervisor's inbox and the owner with no chat involved.

const MIN=60_000;
// Relative to the real clock: a record written by the spec is written 'now', after every seeded gate.
const NOW=Date.now();
const WF='wf-nivo-collab-group-chat-mudqjp5g';
const PEER='wf-nivo-app-auth-mudqjob3';
const TOKEN='123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const HELD=['op-interface.implement-0a1619a4ac','op-interface.implement-a485eea143','op-interface.implement-490960859c'];
const GATE_TEXT=`Runtime now requires the product app shell record .starciwork/shell/index.yaml (work/app-shell@1) before interface.draw/implement dispatch; it is absent. Owner decision pending in peer ${PEER}'s ask. Resolve when the shell record exists (peer heads-up).`;

const seedCollab=(ledger,{progressAgoMin=120,gateAgoMin=180,gateText=GATE_TEXT,queuedAgoMin=180}={})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-600*MIN,
    events:[
      {kind:'op-dispatched',payload:{jobId:'op-interface.draw-1111111111'},created_at:NOW-progressAgoMin*MIN},
      {kind:'incident-raised',entityType:'incident',entityId:'inc-48bc556d89a6',payload:{kind:'owner-gate',detail:gateText,holds:[...HELD,'interface.implement']},created_at:NOW-gateAgoMin*MIN},
      {kind:'route-decided',payload:{jobId:HELD[0]},created_at:NOW-5*MIN},
    ],
    jobs:HELD.map(jobId=>({jobId,opId:'interface.implement',status:'queued',createdAt:NOW-queuedAgoMin*MIN,updatedAt:NOW-queuedAgoMin*MIN}))});
  seedWorkflow(ledger,{id:PEER,now:NOW-600*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-5*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run('inc-48bc556d89a6',WF,'interface.implement',`[owner-gate] ${gateText}`,'open',NOW-gateAgoMin*MIN);
};
const addAsk=(ledger,{workflowId=PEER,dispatchId='ctx_aaaaaaaaaaaa',answered=false,at=NOW-200*MIN}={})=>{
  ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(workflowId,dispatchId,'interface.scaffold',1,1,'ask','{}',at);
  ledger.appendEvent({workflowId,entityType:'workflow',entityId:workflowId,kind:'ask-notified',payload:{dispatchId},createdAt:at+MIN});
  if(answered)ledger.appendEvent({workflowId,entityType:'workflow',entityId:workflowId,kind:'ask-answered',payload:{dispatchId},createdAt:at+30*MIN});
};
const writeShell=(repoRoot,{state='done',at=NOW-40*MIN}={})=>{
  const file=path.join(repoRoot,'.starciwork','shell','index.yaml');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,`schema: work/layout-tree@1\nid: shell\nstate: ${state}\n`);
  fs.utimesSync(file,new Date(at),new Date(at));
  return file;
};
const frontier=(over={})=>({ok:true,frontier:{state:'engaged',actionable:false,queued:[],queuedCauses:{'owner-gate':3},reason:null,...over},workers:[]});
const byType=(findings,type)=>findings.filter(f=>f.type===type);

test('a running workflow with no progress past stallMinutes and nothing actionable is STALLED; progress, a working worker or a short idle is not',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  let calls=0;
  const frontierOf=()=>{calls++;return frontier();};
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf});
  const [stalled]=byType(found,'STALLED');
  assert.ok(stalled,'the idle Collab workflow is STALLED');
  assert.match(stalled.line,new RegExp(`^STALLED ${WF} idle 120m: frontier engaged; queued: owner-gate 3; gates: inc-48bc556d89a6 justified holds 3; last progress op-dispatched`));
  assert.equal(stalled.alert,true);
  assert.equal(stalled.justifiedGate,true,'a stall behind a justified owner gate is marked so the owner sees it');
  assert.ok(!found.some(f=>f.workflowId===PEER),'the peer moved 5m ago');
  assert.equal(calls,1,'the frontier is read only for a workflow idle past the threshold (or holding an old queued job)');

  // The route-decided at -5m is the Kernel looking, not progress; an op-settled is.
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:'x',kind:'op-settled',payload:{},createdAt:NOW-10*MIN});
  assert.equal(byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALLED').filter(f=>f.workflowId===WF).length,0,'fresh progress clears the stall');
  assert.equal(byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW+45*MIN,stallMinutes:30,frontierOf:()=>({...frontier(),workers:[{jobId:'op-x',liveness:'active'}]})}),'STALLED').filter(f=>f.workflowId===WF).length,0,
    'a worker mid-turn is progress the ledger does not see yet');
  const actionable=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW+45*MIN,stallMinutes:30,frontierOf:()=>frontier({state:'peer-message',actionable:true})}),'STALLED').find(f=>f.workflowId===WF);
  assert.match(actionable.line,/frontier peer-message ACTIONABLE but the Kernel has not moved/,'actionable work nobody moves on is a stall too (the wake is not landing)');
}));

test('STALE-GATE: an owner gate whose named record now exists (written after the gate, state done) is stale even while an ask is open',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  writeShell(repoRoot);
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  const [gate]=byType(found,'STALE-GATE');
  assert.ok(gate,'the gate is stale');
  assert.equal(gate.incidentId,'inc-48bc556d89a6');
  assert.match(gate.line,/^STALE-GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6 \[owner-gate\] holds 3 queued job\(s\) for 180m: /);
  assert.match(gate.line,/\.starciwork\/shell\/index\.yaml exists \(done\), (created|written) \d\d:\d\d/);
  assert.doesNotMatch(gate.line,/no owner ask open/,'the peer ask is still open, so only the landed record is the evidence');
  assert.match(gate.line,/tell its Kernel to resolve it/);
  assert.equal(byType(found,'GATE').length,0);
  assert.match(byType(found,'STALLED')[0].line,/inc-48bc556d89a6 STALE holds 3/,'the stall names the stale gate');

  // The same record still in draft is something the gate waits for, not evidence.
  writeShell(repoRoot,{state:'draft'});
  const draft=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(draft,'STALE-GATE').length,0);
  assert.match(byType(draft,'GATE')[0].line,/justified: ask ctx_aaaaaaaaaaaa open in wf-nivo-app-auth-mudqjob3, waits: \.starciwork\/shell\/index\.yaml is draft/);
}));

test('STALE-GATE: an owner gate with no owner ask open in its workflow or the peer it names is stale',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger,{gateText:`Owner decision pending in peer ${PEER}'s ask; resolve on the peer heads-up.`});
  addAsk(ledger,{answered:true});
  const [gate]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.ok(gate);
  assert.match(gate.line,/no owner ask open in wf-nivo-collab-group-chat-mudqjp5g, wf-nivo-app-auth-mudqjob3/);

  // A heads-up the peer delivered after the gate is evidence as well.
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at,applied_at) VALUES(?,?,?,?,?,?,?)")
    .run(WF,'peer-message','pm-d2e851605215',JSON.stringify({from:PEER,kind:'heads-up',subject:'App shell ask answered'}),'applied',NOW-100*MIN,NOW-99*MIN);
  const [again]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.match(again.line,/peer heads-up pm-d2e851605215 from wf-nivo-app-auth-mudqjob3 arrived \d\d:\d\d and was acked: App shell ask answered/);
}));

test('a justified gate is reported as GATE, never alerted; a young gate is not judged; a gate waiting on an absent record is justified',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(found,'STALE-GATE').length,0);
  const [gate]=byType(found,'GATE');
  assert.equal(gate.alert,false);
  assert.match(gate.line,/^GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6 \[owner-gate\] holds 3 queued job\(s\): justified: ask ctx_aaaaaaaaaaaa open in wf-nivo-app-auth-mudqjob3, waits: \.starciwork\/shell\/index\.yaml is absent/);

  const [g]=ownerGates(ledger.db,WF);
  const young=judgeGate({db:ledger.db,workflowId:WF,gate:{...g,text:'no ask anywhere'},repo:repoRoot,now:g.raisedAt+GATE_GRACE_MS-1});
  assert.equal(young.stale,false,'inside the grace window the Kernel may still be parking the ask');
  assert.equal(young.young,true);

  // A supervisor hold that waits for a record nobody wrote yet is justified with no ask at all.
  const hold=judgeGate({db:ledger.db,workflowId:'wf-miamia-base-repos-mud7kk5c',gate:{...g,text:'Supervisor holds interface.scaffold until .starciwork/brand/index.yaml is settled.'},repo:repoRoot,now:NOW});
  assert.equal(hold.stale,false);
  assert.deepEqual(hold.waits,['.starciwork/brand/index.yaml is absent']);
  assert.deepEqual(namedPaths('record .starciwork/shell/index.yaml. And .starciwork/brand/.'),['.starciwork/shell/index.yaml','.starciwork/brand']);
}));

test('STALE-WAIT: a queued job waiting past stallMinutes on a blocker that settled',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:'wf-next',now:NOW-600*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-5*MIN}],
    jobs:[{jobId:'op-workspace.manage-aaaaaaaaaa',opId:'workspace.manage',status:'queued',createdAt:NOW-90*MIN,updatedAt:NOW-90*MIN},
      {jobId:'op-workspace.manage-bbbbbbbbbb',opId:'workspace.manage',status:'failed',createdAt:NOW-120*MIN,updatedAt:NOW-70*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  const frontierOf=()=>frontier({queuedCauses:{'dependency-failed':1},actionable:true,
    queued:[{jobId:'op-workspace.manage-aaaaaaaaaa',opId:'workspace.manage',queuedBecause:'dependency-failed',blockedBy:{op:'workspace.manage',job:'op-workspace.manage-bbbbbbbbbb'}}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf});
  assert.equal(byType(found,'STALLED').length,0,'the workflow itself moved 5m ago');
  const [wait]=byType(found,'STALE-WAIT');
  assert.match(wait.line,/^STALE-WAIT wf-next op-workspace\.manage-aaaaaaaaaa \(workspace\.manage\) dependency-failed for 90m: blocker op-workspace\.manage-bbbbbbbbbb settled failed 70m ago/);
  assert.equal(wait.alert,true);
}));

test('dedupe and rate limit: a finding alerts once per channel per window, a resolved one is forgotten, a GATE line never alerts',()=>{
  const f=(type,key)=>({type,key,alert:type!=='GATE',line:`${type} ${key}`});
  const findings=[f('STALLED','STALLED|a'),f('STALE-GATE','STALE-GATE|a|inc-1'),f('GATE','GATE|b|inc-2')];
  const first=planAlerts(findings,{},{now:NOW});
  assert.deepEqual(first.inbox.map(x=>x.key),['STALLED|a','STALE-GATE|a|inc-1']);
  assert.deepEqual(first.telegram.map(x=>x.key),['STALLED|a','STALE-GATE|a|inc-1']);
  // What runStallAlert records after delivering both.
  for(const key of ['STALLED|a','STALE-GATE|a|inc-1'])Object.assign(first.state.findings[key],{inboxAt:NOW,telegramAt:NOW});
  const soon=planAlerts(findings,first.state,{now:NOW+10*MIN});
  assert.equal(soon.inbox.length+soon.telegram.length,0,'the same findings ten minutes later are not re-sent');
  const later=planAlerts(findings,soon.state,{now:NOW+RATE_MS});
  assert.deepEqual(later.inbox.map(x=>x.key),['STALLED|a','STALE-GATE|a|inc-1'],'after the window a persisting finding is re-sent');
  const gone=planAlerts([findings[0]],soon.state,{now:NOW+20*MIN});
  assert.deepEqual(Object.keys(gone.state.findings),['STALLED|a'],'a finding that disappeared is dropped');
  const back=planAlerts(findings,gone.state,{now:NOW+25*MIN});
  assert.deepEqual(back.inbox.map(x=>x.key),['STALE-GATE|a|inc-1'],'and alerts at once when it returns');
  // A channel that failed is retried on its own.
  const half=planAlerts(findings,{findings:{'STALLED|a':{firstAt:NOW,inboxAt:NOW}}},{now:NOW+MIN});
  assert.deepEqual(half.inbox.map(x=>x.key),['STALE-GATE|a|inc-1']);
  assert.deepEqual(half.telegram.map(x=>x.key),['STALLED|a','STALE-GATE|a|inc-1']);
});

async function fakeBot(t,{fail=null}={}){
  const bot={sent:[],paths:[]};
  const server=http.createServer((req,res)=>{
    let body='';
    req.on('data',c=>{body+=c;});
    req.on('end',()=>{
      bot.paths.push(req.url);
      res.writeHead(fail?fail.status:200,{'content-type':'application/json'});
      if(fail)return res.end(JSON.stringify(fail.json));
      bot.sent.push(JSON.parse(body||'{}'));
      res.end(JSON.stringify({ok:true,result:{message_id:700+bot.sent.length}}));
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections?.();server.close(()=>resolve());}));
  bot.apiBase=`http://127.0.0.1:${server.address().port}`;
  return bot;
}

test('stall-alert: a new finding lands in the supervisor inbox and one Telegram message in the owner language; a second pass is quiet; the token is never shown',async t=>{
  const bot=await fakeBot(t);
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    writeShell(repoRoot);
    const env={LOCALAPPDATA:machineHome,STARCI_TELEGRAM_API_BASE:bot.apiBase};
    const settings={ready:true,token:TOKEN,chatId:'4242',language:'vi'};
    const run=(now)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,settings,apiBase:bot.apiBase,frontierOf:()=>frontier()});

    const first=await run(NOW);
    assert.equal(first.ok,true,JSON.stringify(first));
    assert.deepEqual(first.findings.map(f=>f.type).sort(),['STALE-GATE','STALLED']);
    assert.equal(first.alerted.inbox.length,2);
    const inbox=readInbox('main',env);
    assert.equal(inbox.length,1,'one inbox message carries every new finding');
    assert.match(inbox[0].text,/^STALL-ALERT 2 finding\(s\): STALLED /);
    assert.match(inbox[0].text,/STALE-GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6/);
    assert.equal(inbox[0].read,false,'unread, so channel.mjs wait fires');
    assert.equal(bot.sent.length,1,'one Telegram message');
    assert.equal(bot.sent[0].chat_id,'4242');
    assert.match(bot.sent[0].text,/^⚠️ Giám sát StarCi: 2 vấn đề workflow cần xử lý/);
    assert.match(bot.sent[0].text,/cổng chờ đã hết lý do: STALE-GATE /);
    assert.match(bot.paths[0],/\/sendMessage$/);
    assert.doesNotMatch(JSON.stringify(first),new RegExp(TOKEN.split(':')[1]));
    assert.ok(fs.existsSync(alertStateFile(env)));

    const second=await run(NOW+10*MIN);
    assert.deepEqual([second.alerted.inbox.length,second.alerted.telegram.length],[0,0]);
    assert.equal(readInbox('main',env).length,1);
    assert.equal(bot.sent.length,1,'rate limited: nothing new within the hour');

    const hourLater=await run(NOW+61*MIN);
    for(const key of first.alerted.telegram)assert.ok(hourLater.alerted.telegram.includes(key),`${key} still there an hour later: alerted again`);
    assert.equal(bot.sent.length,2);
  });
});

test('stall-alert: a failed Telegram send is scrubbed and retried next pass while the inbox is not repeated',async t=>{
  const bot=await fakeBot(t,{fail:{status:401,json:{ok:false,description:`Unauthorized for bot${TOKEN}`}}});
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    const env={LOCALAPPDATA:machineHome};
    const settings={ready:true,token:TOKEN,chatId:'4242',language:'en'};
    const run=(now)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,settings,apiBase:bot.apiBase,frontierOf:()=>frontier()});
    const first=await run(NOW);
    assert.equal(first.ok,false);
    assert.equal(first.telegram.ok,false);
    assert.doesNotMatch(first.telegram.error,new RegExp(TOKEN.split(':')[1]),'the token is scrubbed from the error');
    assert.ok(first.alerted.inbox.length>0);
    const second=await run(NOW+5*MIN);
    assert.equal(second.alerted.inbox.length,0,'the inbox already has it');
    assert.equal(second.telegram.ok,false,'telegram is tried again');
    assert.equal(readInbox('main',env).length,1);
  });
});

test('stall-alert: Telegram off or connectors off still writes the inbox',async t=>{
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    const env={LOCALAPPDATA:machineHome,STARCI_CONNECTORS_OFF:'1'};
    const r=await runStallAlert({repos:[repoRoot],env,now:NOW,stallMinutes:30,settings:{ready:true,token:TOKEN,chatId:'1'},frontierOf:()=>frontier()});
    assert.equal(r.telegram.skipped,'STARCI_CONNECTORS_OFF');
    assert.equal(readInbox('main',env).length,1);
  });
});

test('resume-all launches the stall check detached every pass, once at a time, and a spec run never does',t=>withLedger(t,({repoRoot,machineHome})=>{
  const launched=[];
  const spawn=(file,args)=>{launched.push({file,args});return 4242;};
  const r=ensureStallAlert({repos:[repoRoot],env:{LOCALAPPDATA:machineHome},spawn});
  assert.deepEqual(r,{ok:true,launched:4242});
  assert.match(launched[0].file,/scripts[\\/]supervisor[\\/]stall-alert\.mjs$/);
  assert.deepEqual(launched[0].args,['--repo',repoRoot]);
  assert.deepEqual(ensureStallAlert({repos:[repoRoot],env:{LOCALAPPDATA:machineHome},spawn,dryRun:true}),{ok:true,wouldStart:true});
  assert.equal(ensureStallAlert({env:{NODE_TEST_CONTEXT:'1'},spawn}).skipped,'test context');
  const pass=resumeAll({repos:[repoRoot],workflowsOf:()=>[],watchdogs:()=>[],connectors:{cloudflare:{mode:'off'}},ensureBridge:()=>({ok:true,skipped:'x'}),
    stallAlert:({repos})=>({ok:true,launched:7,repos})});
  assert.deepEqual(pass.stallAlert,{ok:true,launched:7,repos:[repoRoot]});
}));

test('the supervisor digest prints the stall findings, one line each, under the workflow lines',async t=>{
  const {cycle}=await import('../scripts/supervisor/poll.mjs');
  await withLedger(t,async({repoRoot,ledger})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    writeShell(repoRoot);
    const out=await cycle(ledger.db,{repo:repoRoot,state:{lastReportId:0,lastArtifacts:Date.now(),first:false},watchdogs:()=>null,
      stall:(db,opts)=>stallFindings(db,{...opts,now:NOW,frontierOf:()=>frontier()}),stallMinutes:30});
    assert.match(out.text,/\n {2}STALLED wf-nivo-collab-group-chat-mudqjp5g idle 120m: /);
    assert.match(out.text,/\n {2}STALE-GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6 \[owner-gate\]/);
    assert.deepEqual(out.stalls.map(f=>f.type),['STALLED','STALE-GATE']);
    const broken=await cycle(ledger.db,{repo:repoRoot,state:{lastReportId:0,lastArtifacts:Date.now(),first:false},watchdogs:()=>null,stall:()=>{throw Error('boom');}});
    assert.match(broken.text,/stall check failed: boom/,'a failing stall check never stops the digest');
  });
});

test('a peer-dependency gate names no ask, so a closed ask is no evidence, and the job that settled before it is its cause, not its release',t=>withLedger(t,({repoRoot,ledger})=>{
  const text="Peer dependency (not an owner step, but the only holding mechanism): Collab's interface.draw op-interface.draw-da76af80ce settled blocked brand-gap. Holds the redraw until Modules' new shell rev lands.";
  seedCollab(ledger,{gateText:text});
  seedWorkflow(ledger,{id:'wf-cause',jobs:[{jobId:'op-interface.draw-da76af80ce',opId:'interface.draw',status:'failed',updatedAt:NOW-181*MIN}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(found,'STALE-GATE').length,0);
  assert.match(byType(found,'GATE')[0].line,/justified: no checkable condition, waits on: Peer dependency/);
  assert.equal(byType(found,'STALLED').length,1,'the stall itself is still reported');

  // The same named job settling after the gate is evidence the gate can go.
  ledger.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run('succeeded',NOW-20*MIN,'op-interface.draw-da76af80ce');
  const [stale]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.match(stale.line,/named job\(s\) settled after the gate: op-interface\.draw-da76af80ce succeeded \d\d:\d\d/);
  assert.doesNotMatch(stale.line,/no owner ask open/);
}));

// Live false positive (2026-09-24, mia-mia): STALE-GATE for wf-miamia-base-repos-mud7kk5c inc-55060d946270
// because peer heads-up pm-a34aec2c6891 ("Brand job admitted after Grammar 0.5.0 proof") arrived after the
// gate. The gate waits for .starciwork/brand/index.yaml to SETTLE; the brand job was only admitted and the
// record did not exist yet. A gate that names a path is released by that path landing and nothing else;
// a pending peer message is UNREAD-PEER (the Kernel reads its inbox), never STALE-GATE.
test('a gate naming a record is not released by a peer heads-up while the record is absent; the pending message is UNREAD-PEER',t=>withLedger(t,({repoRoot,ledger})=>{
  const BASE='wf-miamia-base-repos-mud7kk5c',WORK='wf-miamia-work-and-stacks-mud7kjun';
  const text=`Supervisor holds interface.scaffold until .starciwork/brand/index.yaml is settled by peer ${WORK} (heads-up when brand lands).`;
  seedWorkflow(ledger,{id:BASE,now:NOW-600*MIN,events:[
    {kind:'op-settled',payload:{},created_at:NOW-120*MIN},
    {kind:'incident-raised',entityType:'incident',entityId:'inc-55060d946270',payload:{kind:'owner-gate',detail:text,holds:['interface.scaffold']},created_at:NOW-180*MIN}]});
  seedWorkflow(ledger,{id:WORK,now:NOW-600*MIN,events:[{kind:'op-dispatched',payload:{},created_at:NOW-5*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run('inc-55060d946270',BASE,'interface.scaffold',`[owner-gate] ${text}`,'open',NOW-180*MIN);
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)")
    .run(BASE,'peer-message','pm-a34aec2c6891',JSON.stringify({from:WORK,kind:'heads-up',subject:'Brand job admitted after Grammar 0.5.0 proof'}),'pending',NOW-20*MIN);
  const run=()=>stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier({state:'peer-message',actionable:true})});
  const found=run().filter(f=>f.workflowId===BASE);
  assert.equal(found.filter(f=>f.type==='STALE-GATE').length,0,'the record the gate waits for does not exist');
  assert.match(found.find(f=>f.type==='GATE').line,/justified: waits: \.starciwork\/brand\/index\.yaml is absent/);
  const unread=found.find(f=>f.type==='UNREAD-PEER');
  assert.equal(unread.alert,false);
  assert.match(unread.line,/^UNREAD-PEER wf-miamia-base-repos-mud7kk5c pm-a34aec2c6891 from wf-miamia-work-and-stacks-mud7kjun \[heads-up\] Brand job admitted after Grammar 0\.5\.0 proof: pending since \d\d:\d\d \(20m\); inc-55060d946270 may concern it and still holds; tell its Kernel to read api inbox/);

  // Acked, the message is no finding at all; the record landing (settled) is what releases the gate.
  ledger.db.prepare("UPDATE inbox SET status='applied',applied_at=? WHERE key='pm-a34aec2c6891'").run(NOW-10*MIN);
  assert.equal(run().filter(f=>f.workflowId===BASE&&['UNREAD-PEER','STALE-GATE'].includes(f.type)).length,0);
  const file=path.join(repoRoot,'.starciwork','brand','index.yaml');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'id: brand\nstate: draft\n');
  assert.equal(run().filter(f=>f.workflowId===BASE&&f.type==='STALE-GATE').length,0,'a draft record is still waited on');
  fs.writeFileSync(file,'id: brand\nstate: done\n');
  const [stale]=run().filter(f=>f.workflowId===BASE&&f.type==='STALE-GATE');
  assert.match(stale.line,/\.starciwork\/brand\/index\.yaml exists \(done\)/);
  assert.doesNotMatch(stale.line,/pm-a34aec2c6891/,'the heads-up is not the evidence');
}));
