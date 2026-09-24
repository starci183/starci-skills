import test from 'node:test';
import assert from 'node:assert/strict';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {owedFindings,classifyIncidents,patternFindings,linkFix,fixTokens,alertableOwed,labelsOf,CLASSES,OWED_ALERT_MS} from '../scripts/supervisor/owed.mjs';
import {planOwed,owedAlert,runStallAlert} from '../scripts/supervisor/stall-alert.mjs';
import {readInbox} from '../scripts/connectors/telegram-bridge.mjs';

// Owner, 2026-09-24: "supervisor phải xử lý các conflict, chỉnh grammar, sửa lint, xác định vấn đề out
// of scope workflow ... để workflows stale/block/kẹt chờ sai là lỗi của supervisor". ~90 open incidents
// of the running workflows waited on the supervisor/runtime/Source, many fixed by later .claude
// commits and never resolved. scripts/supervisor/owed.mjs classifies every open incident by
// elimination and links each OWED one to the commit that likely fixed it.

const MIN=60_000;
const NOW=Date.now();
const WF='wf-nivo-app-auth-mudqjob3';
const PEER='wf-nivo-collab-group-chat-mudqjp5g';
const DONE='wf-nivo-old-finished-aaaaaaaa';

const incident=(ledger,{wf=WF,id,kind,text,agoMin=60,payload={}})=>{
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run(id,wf,payload.opId??null,`[${kind}] ${text}`,'open',NOW-agoMin*MIN);
  ledger.appendEvent({workflowId:wf,entityType:'incident',entityId:id,kind:'incident-raised',payload:{kind,detail:text,...payload},createdAt:NOW-agoMin*MIN});
};
const ask=(ledger,{wf=WF,dispatchId})=>ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
  .run(wf,dispatchId,'provision.ask',1,1,'ask','{}',NOW-90*MIN);
const commit=(sha,agoMin,message)=>({sha,at:NOW-agoMin*MIN,subject:message.split('\n')[0],message});
// A fake `git log`: a generic token (index.yaml) in many commits links nothing.
const COMMITS=[
  commit('aaaaaaaaa1',30,'liveness: any Claude spinner row is active\n\nFixes inc-111111111111 and inc-444444444444.'),
  commit('bbbbbbbbb2',20,'admission: owned paths accept App Router [segment] directories\n\nengine/admission.mjs GLOB_META no longer treats a bracketed literal segment as a glob.'),
  commit('ccccccccc3',500,'liveness: older fix before the incident\n\ninc-555555555555'),
  ...[1,2,3,4,5].map(n=>commit(`ddddddddd${n}`,10+n,`work: index.yaml record ${n}`)),
];

const seed=(ledger)=>{
  seedWorkflow(ledger,{id:WF,now:NOW-900*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-3*MIN}]});
  seedWorkflow(ledger,{id:PEER,now:NOW-900*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-4*MIN}]});
  seedWorkflow(ledger,{id:DONE,now:NOW-900*MIN});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(DONE);
  incident(ledger,{id:'inc-111111111111',kind:'source-runtime-defect',text:'terminal liveness classifier reads a Claude spinner frame as turn-idle',agoMin:120});
  incident(ledger,{id:'inc-222222222222',kind:'runtime-owned-path-bracket',text:'For the supervisor: engine/admission.mjs GLOB_META=/[*?[\\]{}]/ rejects src/app/[lang] as an owned path',agoMin:100});
  incident(ledger,{id:'inc-333333333333',kind:'plan-note',text:'Cut backend-reconcile ordinal 5 settles after ordinal 6; see .starciwork/features/login/index.yaml'});
  incident(ledger,{id:'inc-3a3a3a3a3a3a',kind:'scope-gap',text:'Dependency loop needs the owner or supervisor to decide: cần chủ sở hữu hoặc supervisor quyết'});
  incident(ledger,{id:'inc-3b3b3b3b3b3b',kind:'plan',text:'Stale input (inc-999999999999, chưa có phản hồi supervisor): redo seam first'});
  incident(ledger,{id:'inc-444444444444',kind:'runtime-liveness-misread',text:'Escalation of inc-111111111111: codex frame Working read turn-idle; index.yaml',agoMin:110});
  incident(ledger,{id:'inc-555555555555',kind:'runtime-nudge-receipt',text:'nudge returned terminal-send-failed while the wake landed',agoMin:60});
  incident(ledger,{id:'inc-666666666666',kind:'weird-new-kind',text:'something nobody typed a release for',agoMin:45});
  incident(ledger,{id:'inc-777777777777',kind:'owner-gate',text:'Owner picks the pricing tier before interface.draw',agoMin:50,payload:{holds:['interface.draw']}});
  incident(ledger,{id:'inc-888888888888',kind:'owner-gate',text:'Needs the Stripe API key credentials the runtime cannot mint',agoMin:50,payload:{holds:['integration.verify']}});
  incident(ledger,{id:'inc-8a8a8a8a8a8a',kind:'owner-gate',text:`Waits for the owner answer on ask ctx_aaaaaaaaaaaa in ${PEER} about the plan tiers`,agoMin:50});
  ask(ledger,{wf:PEER,dispatchId:'ctx_aaaaaaaaaaaa'});
  incident(ledger,{id:'inc-999999999999',kind:'peer-wait',text:`waits for ${PEER} to land the membership contract`,agoMin:40,payload:{peer:PEER,holds:['backend.implement']}});
  incident(ledger,{id:'inc-aaaaaaaaaaaa',kind:'runtime-agent-exited',text:'codex exited to a bare PowerShell prompt',agoMin:4});
  incident(ledger,{wf:DONE,id:'inc-bbbbbbbbbbbb',kind:'source-runtime-defect',text:'a finished workflow is nobody\'s to chase',agoMin:300});
};
const byId=(items)=>Object.fromEntries(items.filter(i=>i.incidentId).map(i=>[i.incidentId,i]));

test('every open incident of a running workflow is exactly one class, by elimination; keyword rules never take one out of OWED',t=>withLedger(t,({repoRoot,ledger})=>{
  seed(ledger);
  const items=classifyIncidents(ledger.db,{repo:repoRoot,now:NOW});
  const cls=Object.fromEntries(items.map(i=>[i.incidentId,i.class]));
  assert.deepEqual(cls,{
    'inc-111111111111':'supervisor','inc-222222222222':'supervisor','inc-333333333333':'kernel',
    'inc-3a3a3a3a3a3a':'supervisor','inc-3b3b3b3b3b3b':'supervisor','inc-444444444444':'supervisor',
    'inc-555555555555':'supervisor','inc-666666666666':'supervisor',
    'inc-777777777777':'supervisor','inc-888888888888':'owner','inc-8a8a8a8a8a8a':'owner',
    'inc-999999999999':'peer','inc-aaaaaaaaaaaa':'in-progress',
  },'an unknown kind is OWED; a note that asks the supervisor is OWED; an owner gate with no ask and no owner-only condition is the supervisor\'s');
  assert.equal(items.filter(i=>i.workflowId===DONE).length,0,'a finished workflow is not classified');
  const i=byId(items);
  assert.match(i['inc-777777777777'].reason,/no owner ask and no owner-only condition/);
  assert.match(i['inc-888888888888'].reason,/owner-only condition/);
  assert.match(i['inc-999999999999'].reason,/running and moving/);
  assert.ok(i['inc-3a3a3a3a3a3a'].labels.includes('addressed-to-supervisor'));
  assert.ok(i['inc-3a3a3a3a3a3a'].labels.includes('decision'));
  assert.deepEqual(labelsOf('cross-workflow-git-effect','worker ran git reset --soft HEAD~1').includes('cross-workflow'),true);
}));

test('a peer-wait whose peer stopped moving is its Kernel\'s (the stall wake), not OWED; a peer in no ledger in view is OWED',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-900*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-3*MIN}]});
  seedWorkflow(ledger,{id:PEER,now:NOW-900*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-400*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  incident(ledger,{id:'inc-999999999999',kind:'peer-wait',text:`waits for ${PEER}`,agoMin:120,payload:{peer:PEER,holds:['backend.implement']}});
  incident(ledger,{id:'inc-cccccccccccc',kind:'peer-wait',text:'waits for wf-somewhere-else-zzzzzzzz',agoMin:120,payload:{peer:'wf-somewhere-else-zzzzzzzz'}});
  const i=byId(classifyIncidents(ledger.db,{repo:repoRoot,now:NOW}));
  assert.equal(i['inc-999999999999'].class,'kernel');
  assert.match(i['inc-999999999999'].reason,/stale peer-wait/);
  assert.equal(i['inc-cccccccccccc'].class,'supervisor','a peer in no ledger in view: nobody but the supervisor can judge it');
}));

test('fixed-by: a later commit citing the incident, or an incident it escalates; else rare file/identifier tokens; a generic token or an earlier commit links nothing',t=>withLedger(t,({repoRoot,ledger})=>{
  seed(ledger);
  const {owed}=owedFindings(ledger.db,{repo:repoRoot,now:NOW,commitsOf:()=>COMMITS,staleOf:()=>[]});
  const i=byId(owed);
  assert.deepEqual([i['inc-111111111111'].status,i['inc-111111111111'].fixedBy.how,i['inc-111111111111'].fixedBy.sha],['fixed-by','id','aaaaaaaaa1']);
  assert.equal(i['inc-444444444444'].fixedBy.how,'id');
  assert.equal(i['inc-222222222222'].fixedBy.how,'keywords');
  assert.equal(i['inc-222222222222'].fixedBy.sha,'bbbbbbbbb2');
  assert.ok(['admission.mjs','glob_meta'].every(tok=>i['inc-222222222222'].fixedBy.tokens.includes(tok)));
  assert.ok(!i['inc-222222222222'].fixedBy.tokens.includes('admission'),'admission.mjs and admission are one piece of evidence');
  assert.equal(i['inc-555555555555'].fixedBy,null,'a commit from before the incident fixed nothing it reports');
  assert.equal(i['inc-555555555555'].status,'open');
  assert.equal(i['inc-666666666666'].fixedBy,null);
  assert.match(i['inc-111111111111'].line,/^OWED wf-nivo-app-auth-mudqjob3 inc-111111111111 \[source-runtime-defect\] age=120m fixed-by aaaaaaaaa\?: terminal liveness/);
  assert.match(i['inc-666666666666'].line,/^OWED wf-nivo-app-auth-mudqjob3 inc-666666666666 \[weird-new-kind\] age=45m open: something nobody/);
  assert.match(i['inc-111111111111'].action,/verify aaaaaaaaa fixed it, then tell wf-nivo-app-auth-mudqjob3's Kernel: api incident --workflow wf-nivo-app-auth-mudqjob3 --resolve inc-111111111111/);
  assert.match(i['inc-777777777777'].action,/decide it under the owner's delegated authority/);
  assert.doesNotMatch(owed.map(o=>o.action).join('\n'),/ask the owner/i,'an OWED item is the supervisor\'s to fix, never an owner question');
  // index.yaml appears in five commits: generic, never evidence.
  assert.equal(linkFix({incidentId:'inc-x',kind:'work-record-form',text:'features/chatbot/impl/index.yaml record',raisedAt:NOW-100*MIN},COMMITS),null);
  assert.ok(fixTokens('runtime-owned-path-bracket','engine/admission.mjs GLOB_META').some(t=>t.token==='glob_meta'&&t.weight===2));
}));

const job=(jobId,{attempt,status,retryOf=null,agoMin,opId='backend.implement',paths=['src/a.ts']})=>({jobId,opId,attempt,status,createdAt:NOW-agoMin*MIN,updatedAt:NOW-(agoMin-5)*MIN,
  payload:{owned_paths:paths,retry:retryOf?{retryOf,attempt,businessAttempt:attempt}:{retryOf:null,attempt}}});
const checkRow=(ledger,{attempt,name,exitCode,opId='backend.implement'})=>ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
  .run(WF,opId,attempt,JSON.stringify({checks:[{name,exitCode,evidence:'x'}]}),NOW);

test('patterns with no incident: 3+ failures in a row since the last success, the same check failing twice, dying workers, identical rejects, a re-route loop, re-staled work',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-900*MIN,jobs:[
    job('op-backend.implement-0000000001',{attempt:1,status:'succeeded',agoMin:300}),
    job('op-backend.implement-0000000002',{attempt:2,status:'failed',retryOf:'op-backend.implement-0000000001',agoMin:250}),
    job('op-backend.implement-0000000003',{attempt:3,status:'failed',retryOf:'op-backend.implement-0000000002',agoMin:200}),
    job('op-backend.implement-0000000004',{attempt:4,status:'failed',retryOf:'op-backend.implement-0000000003',agoMin:150}),
    job('op-backend.implement-0000000005',{attempt:5,status:'queued',retryOf:'op-backend.implement-0000000004',agoMin:100}),
    // A chain that succeeded at the end, and one broken by a success: neither is a loop.
    job('op-interface.draw-0000000001',{opId:'interface.draw',attempt:1,status:'failed',agoMin:300,paths:['ui/x']}),
    job('op-interface.draw-0000000002',{opId:'interface.draw',attempt:2,status:'failed',retryOf:'op-interface.draw-0000000001',agoMin:280,paths:['ui/x']}),
    job('op-interface.draw-0000000003',{opId:'interface.draw',attempt:3,status:'succeeded',retryOf:'op-interface.draw-0000000002',agoMin:260,paths:['ui/x']}),
    job('op-interface.draw-0000000004',{opId:'interface.draw',attempt:4,status:'failed',retryOf:'op-interface.draw-0000000003',agoMin:100,paths:['ui/x']}),
    job('op-interface.draw-0000000005',{opId:'interface.draw',attempt:5,status:'queued',retryOf:'op-interface.draw-0000000004',agoMin:90,paths:['ui/x']}),
    job('op-scope.define-0000000001',{opId:'scope.define',attempt:1,status:'queued',agoMin:60,paths:['s']}),
  ],events:[
    ...['op-a-0000000001','op-b-0000000002'].flatMap((j,n)=>[
      {kind:'op-dispatched',entityType:'job',entityId:j,payload:{model:'codex-agent'},created_at:NOW-(100-n)*MIN},
      {kind:'op-settled',entityType:'job',entityId:j,payload:{reportFiled:false,status:'failed'},created_at:NOW-(90-n)*MIN}]),
    {kind:'op-dispatched',entityType:'job',entityId:'op-c-0000000003',payload:{model:'claude-agent'},created_at:NOW-80*MIN},
    {kind:'op-settled',entityType:'job',entityId:'op-c-0000000003',payload:{reportFiled:false},created_at:NOW-70*MIN},
    ...[1,2].map(n=>({kind:'dispatch-rejected',entityType:'job',entityId:`op-d-000000000${n}`,payload:{provider:'devin',step:'task-create',error:''},created_at:NOW-n*10*MIN})),
    {kind:'dispatch-rejected',entityType:'job',entityId:'op-e-0000000001',payload:{provider:'devin',step:'readiness',error:'timeout'},created_at:NOW-10*MIN},
    ...[1,2,3,4].map(n=>({kind:'route-decided',entityType:'job',entityId:'op-scope.define-0000000001',payload:{},created_at:NOW-n*10*MIN})),
  ]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  checkRow(ledger,{attempt:2,name:'lint',exitCode:1});
  checkRow(ledger,{attempt:3,name:'lint',exitCode:1});
  checkRow(ledger,{attempt:4,name:'typecheck',exitCode:0});
  checkRow(ledger,{opId:'interface.draw',attempt:1,name:'shell-conformance',exitCode:1});
  checkRow(ledger,{opId:'interface.draw',attempt:4,name:'shell-conformance',exitCode:1});
  const staleOf=()=>[{jobId:'op-backend.implement-0000000001',op:'backend.implement',attempt:1,path:'knowledge/application-stacks.yaml',recorded:'a',current:'b'}];
  const found=patternFindings(ledger.db,{repo:repoRoot,now:NOW,staleOf});
  const keys=found.map(f=>f.key).sort();
  assert.deepEqual(keys,[
    'pattern:repeat-check:op-backend.implement-0000000002:lint',
    `pattern:repeat-reject:${WF}:${keys.find(k=>k.startsWith('pattern:repeat-reject')).split(':').pop()}`,
    'pattern:reroute-loop:op-scope.define-0000000001',
    'pattern:retry-loop:op-backend.implement-0000000002',
    `pattern:stale-input:${WF}`,
    `pattern:worker-died:${WF}:codex-agent`,
  ].sort(),'a success resets the streak (interface.draw), one claude death and one readiness reject are not patterns');
  const loop=found.find(f=>f.pattern==='retry-loop');
  assert.match(loop.summary,/3 failed attempt\(s\) in a row since the last success \(a2 failed, a3 failed, a4 failed, a5 queued\)/);
  assert.ok(found.every(f=>f.class===CLASSES.supervisor));
  assert.deepEqual(found.find(f=>f.pattern==='stale-input').labels,['knowledge-churn']);
  const {owed}=owedFindings(ledger.db,{repo:repoRoot,now:NOW,commitsOf:()=>[],staleOf});
  assert.ok(owed.find(o=>o.pattern==='stale-input').action.includes('contract-changes.yaml'));
  assert.match(owed.find(o=>o.pattern==='retry-loop').line,/^OWED wf-nivo-app-auth-mudqjob3 pattern:retry-loop:op-backend.implement-0000000002 \[pattern:retry-loop\] age=250m open: /);
}));

test('OWED-ALERT: items 15+ min old go to the supervisor inbox once an hour; a commit citing the incident silences it, a keyword guess does not',()=>{
  const item=(key,agoMin,fixedBy=null)=>({key,raisedAt:NOW-agoMin*MIN,status:fixedBy?'fixed-by':'open',fixedBy,line:`OWED wf-a ${key} [k] age=${agoMin}m open: s`,action:'fix it'});
  const owed=[item('a',20),item('b',5),item('c',30,{sha:'abc',how:'id'}),item('d',30,{sha:'def',how:'keywords'})];
  assert.deepEqual(alertableOwed(owed,{now:NOW}).map(i=>i.key),['a','d']);
  const first=planOwed(owed,{},{now:NOW});
  assert.deepEqual(first.due.map(i=>i.key),['a','d']);
  for(const k of ['a','d'])first.state[k].alertedAt=NOW;
  assert.deepEqual(planOwed(owed,first.state,{now:NOW+30*MIN}).due.map(i=>i.key),['b'],'a and d at most hourly; b just turned 15 min old');
  assert.deepEqual(planOwed(owed,first.state,{now:NOW+60*MIN}).due.map(i=>i.key),['a','b','d'],'b is old enough now; a and d are due again');
  assert.deepEqual(Object.keys(planOwed([owed[0]],first.state,{now:NOW}).state),['a'],'a gone item is dropped');
  const text=owedAlert(first.due);
  assert.match(text,/^OWED-ALERT 2 item\(s\) wait on the supervisor, not on a Kernel or the owner/);
  assert.match(text,/\nOWED wf-a a \[k\] age=20m open: s -> fix it/);
  assert.equal(OWED_ALERT_MS,15*MIN);
});

test('stall-alert routes OWED items straight to the supervisor inbox, deduped, never to a Kernel wake or the owner',async t=>{
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seed(ledger);
    const env={LOCALAPPDATA:machineHome,STARCI_CONNECTORS_OFF:'1'};
    const calls=[];
    const wake=(w)=>{calls.push(w);return {action:'kernel-busy',delivered:false};};
    const owedOf=(db,opts)=>owedFindings(db,{...opts,commitsOf:()=>COMMITS,staleOf:()=>[]}).owed;
    const run=(now,extra={})=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,frontierOf:()=>({ok:true,frontier:{state:'engaged',actionable:false,queued:[]},workers:[]}),wake,owedOf,...extra});
    const dry=await run(NOW,{dryRun:true});
    assert.equal(readInbox('main',env).length,0,'a dry run tells nobody');
    const expected=['inc-222222222222','inc-3a3a3a3a3a3a','inc-3b3b3b3b3b3b','inc-555555555555','inc-666666666666','inc-777777777777'].map(id=>`incident:${WF}:${id}`);
    assert.deepEqual(dry.alerted.owed.sort(),expected,'OWED 15+ min old with no commit citing it (inc-111/444 are fixed by id; the 50-60 min old ones qualify)');
    const first=await run(NOW);
    assert.equal(first.ok,true,JSON.stringify(first.errors));
    assert.deepEqual(first.alerted.owed.sort(),expected);
    const inbox=readInbox('main',env);
    assert.equal(inbox.length,1);
    assert.match(inbox[0].text,/^OWED-ALERT 6 item\(s\) wait on the supervisor/);
    assert.match(inbox[0].text,/inc-222222222222 \[runtime-owned-path-bracket\] age=100m fixed-by bbbbbbbbb\?/,'a keyword guess is shown with its sha, and still alerted');
    assert.equal(calls.filter(c=>/OWED/.test(c.text??'')).length,0,'never typed into a Kernel');
    const later=await run(NOW+20*MIN);
    assert.deepEqual(later.alerted.owed,[`incident:${WF}:inc-aaaaaaaaaaaa`],'inside the hour only what just turned OWED (out of its grace, 15+ min old)');
    assert.equal(readInbox('main',env).length,2);
    const hour=await run(NOW+61*MIN);
    assert.deepEqual(hour.alerted.owed.sort(),expected,'repeated hourly while they stay OWED');
    assert.equal(readInbox('main',env).length,3);
  });
});

test('the supervisor digest prints one OWED line per item, and a failing owed check never stops it',async t=>{
  const {cycle}=await import('../scripts/supervisor/poll.mjs');
  await withLedger(t,async({repoRoot,ledger})=>{
    seed(ledger);
    const base={repo:repoRoot,state:{lastReportId:0,lastArtifacts:Date.now(),first:false},watchdogs:()=>null,stall:()=>[]};
    const out=await cycle(ledger.db,{...base,owed:(db,opts)=>owedFindings(db,{...opts,now:NOW,commitsOf:()=>COMMITS,staleOf:()=>[]}).owed});
    assert.match(out.text,/\n {2}OWED wf-nivo-app-auth-mudqjob3 inc-111111111111 \[source-runtime-defect\] age=120m fixed-by aaaaaaaaa\?: /);
    assert.match(out.text,/\n {2}OWED wf-nivo-app-auth-mudqjob3 inc-666666666666 \[weird-new-kind\] age=45m open: /);
    assert.doesNotMatch(out.text,/OWED \S+ inc-333333333333/,'a note holds nothing and is its Kernel\'s');
    assert.equal(out.owed.length,8);
    const broken=await cycle(ledger.db,{...base,owed:()=>{throw Error('boom');}});
    assert.match(broken.text,/owed check failed: boom/);
  });
});
