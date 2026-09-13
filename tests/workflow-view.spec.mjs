import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {RATE_WINDOW_MS,buildList,buildView,featureOf,renderJson,renderList,renderView} from '../kernel/view.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW=1_700_000_000_000;
const MIN=60_000;
const ago=minutes=>NOW-minutes*MIN;

const tmp=t=>{
  const dir=path.join(os.tmpdir(),'starci-view-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(dir,'.starciwork','_local','workflows'),{recursive:true});
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
};
const workflows=repoRoot=>path.join(repoRoot,'.starciwork','_local','workflows');
const writeLines=(file,lines)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,lines.map(line=>JSON.stringify(line)).join('\n')+'\n');};

const op=(id,status,extra={})=>({id,kind:'backend.implement',goal:id,status,runtime:'fast',restarts:0,
  ledgerIds:[],nodeId:null,allowlist:[`src/${id}`],refusal:null,dispatch:null,...extra});
const item=(id,status)=>({id,nodeId:id,title:id,kind:'implementation',status,evidence:[]});

/**
 * The rich fixture: a live workflow with two running ops, two blocked ones, eight ledger items over three
 * features, lanes, review rounds, validator verdicts, anomalies and a supervisor log.
 */
function richStore(repoRoot,id='20260101-000000-rich'){
  const dir=path.join(workflows(repoRoot),id);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({
    schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id,dir,
    job:'Deliver the fixture product',branch:'agent/fixture',head:'abcdef1234567890',worktree:repoRoot,
    ledgerMode:'work',phase:'run',approved:true,iterations:12,
    quota:{order:['fast','slow'],slots:{fast:2,slow:1},total:3},
    allocation:{loads:{fast:2},usedToday:{fast:5,slow:1},
      cooling:{slow:{kind:'rate-limited',until:NOW+10*MIN,cooldownMs:600000,reason:'429 from the provider'}}},
    ops:[
      op('a','done',{nodeId:'prod.alpha.one',ledgerIds:['prod.alpha.one']}),
      op('r1','running',{nodeId:'prod.beta.two',ledgerIds:['prod.beta.two'],dispatch:'ctx_r1',restarts:1}),
      op('r2','running',{kind:'interface.implement',nodeId:'prod.beta.three',ledgerIds:['prod.beta.three'],dispatch:'ctx_r2'}),
      op('p1','paused',{ledgerIds:['prod.alpha.two']}),
      op('shared-1','blocked',{refusal:'dynamic-op'}),
      op('x1','blocked',{nodeId:'prod.gamma.one',ledgerIds:['prod.gamma.one'],refusal:'out-of-repository'})
    ],
    ledger:[item('prod.alpha.one','verified'),item('prod.alpha.two','implemented'),item('prod.alpha.three','planned'),
      item('prod.beta.one','verified'),item('prod.beta.two','planned'),item('prod.beta.three','planned'),
      item('prod.gamma.one','out-of-repository'),item('prod.gamma.two','preexisting')],
    lanes:{'lane-a':['prod.alpha.one','prod.alpha.two'],'lane-b':{nodes:['prod.beta.one','prod.beta.two','prod.beta.three']}},
    verifyRounds:{'prod.alpha.one+prod.alpha.two':3,'prod.beta.one':1},
    reviewFindings:[{op:'verify-1',finding:'the migration is not reversible'}],
    needUser:[{kind:'dynamic-op',op:'shared-1',detail:'shared-1 was created beyond the dynamic-op budget'}],
    anomalies:{'settled:r1:stalled-idle':{count:4,firstAt:ago(60),lastAt:ago(5),triaged:{option:'settle-op'}},
      'launch-failed:r2':{count:1,firstAt:ago(20),lastAt:ago(20),triaged:null}},
    ledgerSummary:{total:50,eligible:40},gateResults:[],finished:null
  }));
  writeLines(path.join(dir,'events.jsonl'),[
    {at:ago(240),seq:1,event:'created',job:'Deliver the fixture product'},
    {at:ago(210),seq:2,event:'approved',ops:6},
    {at:ago(200),seq:3,event:'op-done',op:'a0',node:'prod.alpha.zero',runtime:'fast',files:['src/a0']},
    {at:ago(120),seq:4,event:'op-done',op:'a',node:'prod.alpha.one',runtime:'fast',files:['src/a']},
    {at:ago(60),seq:5,event:'op-done',op:'b',node:'prod.beta.one',runtime:'slow',files:['src/b']},
    {at:ago(45),seq:6,event:'launched',op:'r1',kind:'backend.implement',runtime:'fast',dispatch:'ctx_r1'},
    {at:ago(30),seq:7,event:'op-done',op:'c',node:'prod.beta.one',runtime:'fast',files:['src/c']},
    {at:ago(20),seq:8,event:'verify-exhausted',component:'prod.alpha.one+prod.alpha.two',rounds:3},
    {at:ago(10),seq:9,event:'launched',op:'r2',kind:'interface.implement',runtime:'fast',dispatch:'ctx_r2'},
    {at:ago(5),seq:10,event:'wait',result:'timeout',ticks:3,liveness:['ctx_r1:working','ctx_r2:working']},
    {at:ago(2),seq:11,event:'nudged',op:'r2',liveness:'stalled-idle'},
    {at:NOW-90_000,seq:12,event:'tick',iteration:12,ops:['r1=running','r2=running']}
  ]);
  writeLines(path.join(dir,'validator','verdicts.jsonl'),[
    {at:ago(50),node:'prod.alpha.one',outcome:'accepted'},
    {at:ago(40),node:'prod.gamma.two',outcome:'accepted'},
    {at:ago(30),node:'prod.beta.one',outcome:'rejected',summary:'prod.beta.one declares no checks'}
  ]);
  fs.writeFileSync(path.join(dir,'kernel.lock'),JSON.stringify({pid:process.pid,startedAt:ago(240)}));
  writeLines(path.join(workflows(repoRoot),'supervisor.log'),[
    {at:ago(20),event:'supervisor-round',round:0,rounds:[`${id}:start`]},
    {at:ago(3),event:'supervisor-round',round:1,rounds:[`${id}:leave`,'other:leave']}
  ]);
  return {dir,id};
}

test('the view counts exactly what the files say, and the clock comes from the caller',t=>{
  const repoRoot=tmp(t);
  const {id,dir}=richStore(repoRoot);
  const view=buildView({repoRoot,id,now:NOW});

  assert.equal(view.schema,'starci/workflow-view@1');
  assert.equal(view.id,id);
  assert.equal(view.dir,dir);
  assert.equal(view.phase,'run');
  assert.equal(view.finished,null);
  assert.equal(view.stopRequested,false);

  assert.equal(view.kernel.alive,true,'the lock names this very process');
  assert.equal(view.kernel.pid,process.pid);
  assert.equal(view.kernel.lastEventAt,NOW-90_000);
  assert.equal(view.kernel.silentMs,90_000,'silence is measured from the injected now, not the wall clock');
  assert.equal(view.kernel.lastEvent,'tick');
  assert.equal(view.kernel.events,12);

  assert.equal(view.supervisor.lastRoundAt,ago(3));
  assert.equal(view.supervisor.silentMs,3*MIN);
  assert.equal(view.supervisor.alive,true);
  assert.equal(view.supervisor.lastAction,'leave');

  assert.deepEqual(view.runtimes.find(runtime=>runtime.id==='fast'),{id:'fast',running:2,max:2,usedToday:5,cooling:null});
  const slow=view.runtimes.find(runtime=>runtime.id==='slow');
  assert.equal(slow.running,0);
  assert.equal(slow.max,1);
  assert.deepEqual({kind:slow.cooling.kind,minutesLeft:slow.cooling.minutesLeft},{kind:'rate-limited',minutesLeft:10});

  assert.deepEqual(view.ops.counts,{done:1,running:2,paused:1,blocked:2});
  assert.equal(view.ops.total,6);
  assert.equal(view.ops.live,3,'paused is live: it waits for someone else\'s change');
  assert.deepEqual(view.ops.running.map(entry=>[entry.id,entry.ageMin,entry.restarts]),[['r1',45,1],['r2',10,0]]);
  assert.deepEqual(view.ops.running[0].lastPing,{at:ago(5),ageMin:5,liveness:'working'});
  assert.deepEqual(view.ops.running[1].lastPing,{at:ago(2),ageMin:2,liveness:'stalled-idle'});
  assert.deepEqual(view.ops.blocked,[{id:'shared-1',refusal:'dynamic-op'},{id:'x1',refusal:'out-of-repository'}]);

  assert.equal(view.ledger.total,8);
  assert.equal(view.ledger.done,3,'verified plus preexisting');
  assert.equal(view.ledger.implemented,1);
  assert.equal(view.ledger.todo,3);
  assert.equal(view.ledger.outOfRepository,1);
  assert.equal(view.ledger.eligible,3,'the items a live op is carrying');
  assert.deepEqual(view.ledger.byFeature,[{feature:'prod.alpha',done:1,total:3},
    {feature:'prod.beta',done:1,total:3},{feature:'prod.gamma',done:1,total:2}]);
  assert.deepEqual([view.ledger.treeEligible,view.ledger.treeTotal],[40,50]);

  assert.deepEqual(view.lanes,[{lane:'lane-a',done:1,total:2},{lane:'lane-b',done:1,total:3}]);
  assert.deepEqual(view.reviews.rounds,{'prod.alpha.one+prod.alpha.two':3,'prod.beta.one':1});
  assert.deepEqual(view.reviews.exhausted,['prod.alpha.one+prod.alpha.two']);
  assert.equal(view.reviews.findings,1);

  assert.deepEqual({...view.validator,lastAt:undefined},{source:'verdicts',accepted:2,rejected:1,unavailable:0,
    lastSummary:'prod.beta.one declares no checks',lastAt:undefined});
  assert.equal(view.needUser.length,1);

  assert.equal(view.rate.windowMs,RATE_WINDOW_MS,'the first event is older than the window, so the window is the full 3h');
  assert.equal(view.rate.opsDone,3,'the op-done 200 min ago is outside the window');
  assert.equal(view.rate.opsDonePerHour,1);
  assert.equal(view.rate.nodesDone,2,'two op-done events name the same node');
  assert.equal(view.rate.nodesDonePerHour,0.67);

  assert.equal(view.anomalies.total,5);
  assert.equal(view.anomalies.untriaged,1);
  assert.deepEqual(view.anomalies.signatures.map(entry=>[entry.signature,entry.count,entry.triaged]),
    [['settled:r1:stalled-idle',4,'settle-op'],['launch-failed:r2',1,null]]);

  assert.equal(view.recent.length,12,'fewer than fifteen events means all of them');
  assert.match(view.recent.at(-1),/#12 tick iteration=12/);
  assert.match(view.recent.at(-2),/#11 nudged op=r2 liveness=stalled-idle/);
  assert.equal(JSON.parse(renderJson(view)).id,id);
});

test('a young workflow is measured over its own life, not a three hour window that did not happen',t=>{
  const repoRoot=tmp(t);
  const {id}=richStore(repoRoot,'20260101-000001-young');
  const dir=path.join(workflows(repoRoot),id);
  writeLines(path.join(dir,'events.jsonl'),[
    {at:ago(30),seq:1,event:'created'},
    {at:ago(20),seq:2,event:'op-done',op:'a',node:'prod.alpha.one'},
    {at:ago(10),seq:3,event:'op-done',op:'b',node:'prod.alpha.two'},
    {at:ago(1),seq:4,event:'tick',iteration:1}
  ]);
  const view=buildView({repoRoot,id,now:NOW});
  assert.equal(view.rate.windowMs,30*MIN);
  assert.equal(view.rate.windowHours,0.5);
  assert.equal(view.rate.opsDonePerHour,4);
  assert.equal(view.rate.nodesDonePerHour,4);
});

test('the render is a plain terminal page with tables and no control codes',t=>{
  const repoRoot=tmp(t);
  const {id}=richStore(repoRoot);
  const page=renderView(buildView({repoRoot,id,now:NOW}));

  assert.equal(/\[/.test(page),false,'no colour codes');
  assert.match(page,new RegExp(`^# ${id} - phase run`));
  assert.match(page,/kernel {5}alive pid \d+, last event 2m ago \(tick\)/);
  assert.match(page,/supervisor last round 3m ago \(leave\)/);
  assert.match(page,/ledger {5}3\/8 done, 1 implemented, 3 todo, 3 with a live op, 1 out of repository/);
  assert.match(page,/rate {7}1 ops\/h, 0\.67 nodes\/h over 3h/);
  assert.match(page,/## Runtimes\n\| runtime \| running \| max \| used today \| cooling \|\n\| --- \| --- \| --- \| --- \| --- \|\n\| fast \| 2 \| 2 \| 5 \| - \|\n\| slow \| 0 \| 1 \| 1 \| rate-limited 10m left \|/);
  assert.match(page,/## Running operations \(2\)\n\| op \| kind \| runtime \| age \| restarts \| last ping \|/);
  assert.match(page,/\| r1 \| backend\.implement \| fast \| 45m \| 1 \| working 5m ago \|/);
  assert.match(page,/## Blocked operations \(2\)\n- shared-1: dynamic-op\n- x1: out-of-repository/);
  assert.match(page,/## Ledger by feature \(tree: 40\/50 nodes eligible in scope\)\n\| feature \| done \| total \|/);
  assert.match(page,/\| prod\.gamma \| 1 \| 2 \|/);
  assert.match(page,/## Lanes\n\| lane \| done \| total \|\n\| --- \| --- \| --- \|\n\| lane-a \| 1 \| 2 \|/);
  assert.match(page,/## Reviews\n\| group \| rounds \| exhausted \|/);
  assert.match(page,/\| prod\.alpha\.one\+prod\.alpha\.two \| 3 \| yes \|/);
  assert.match(page,/## Validator {2}accepted 2, rejected 1, unavailable 0 \(from verdicts\)/);
  assert.match(page,/## Needs you \(1\)\n- dynamic-op shared-1: shared-1 was created beyond the dynamic-op budget/);
  assert.match(page,/## Anomalies \(5 in 2 signatures, 1 untriaged\)/);
  assert.match(page,/## Recent events \(12\)/);
  assert.equal(page.endsWith('\n'),true);
});

test('a store with no validator, no lanes, no supervisor log and no events still renders',t=>{
  const repoRoot=tmp(t);
  const id='20260101-000002-bare';
  const dir=path.join(workflows(repoRoot),id);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',
    kernel:'starci/workflow-kernel@1',id,job:'A goal nobody approved yet',phase:'goal',approved:false,ops:[],ledger:[]}));

  const view=buildView({repoRoot,id,now:NOW});
  assert.deepEqual(view.kernel,{alive:false,pid:null,startedAt:null,lastEventAt:null,lastEvent:null,silentMs:null,events:0});
  assert.deepEqual(view.supervisor,{lastRoundAt:null,silentMs:null,alive:null,rounds:0,lastAction:null});
  assert.deepEqual(view.runtimes,[]);
  assert.deepEqual(view.ops,{total:0,counts:{},live:0,running:[],blocked:[]});
  assert.deepEqual(view.ledger.byFeature,[]);
  assert.equal(view.ledger.treeTotal,null);
  assert.equal(view.lanes,null);
  assert.deepEqual(view.validator,{source:null,accepted:0,rejected:0,unavailable:0,lastSummary:null,lastAt:null});
  assert.deepEqual(view.needUser,[]);
  assert.deepEqual(view.anomalies,{total:0,untriaged:0,signatures:[]});
  assert.equal(view.rate.opsDonePerHour,0);
  assert.deepEqual(view.recent,[]);

  const page=renderView(view);
  assert.match(page,/\(not approved\)/);
  assert.match(page,/kernel {5}no kernel process/);
  assert.match(page,/supervisor no supervisor log/);
  assert.match(page,/nothing is running/);
  assert.match(page,/nothing is waiting on you/);
  assert.match(page,/no verdicts recorded/);
  assert.match(page,/## Recent events \(0\)\nno events/);
  assert.throws(()=>buildView({repoRoot,id:'20260101-000003-absent',now:NOW}),/No workflow state/);
  assert.throws(()=>buildView({repoRoot,id:'nested/id',now:NOW}),/./);
  assert.deepEqual(view.integrations,[],'a workflow that names no tree simply has no integrations section');
  assert.doesNotMatch(page,/## Integrations/);
});

/**
 * The status page tells the truth about every external system the tree declares. A page that prints an
 * integration proven only by a faked run as anything but that is the page that let four chatbot channels
 * read as verified; here it is one line each, and the section is skipped rather than guessed when the
 * workflow names no tree or the tree is gone.
 */
test('workflow-status prints one line per declared integration and what each is actually proven by',t=>{
  const repoRoot=tmp(t);
  const id='20260101-000004-integrations';
  const dir=path.join(workflows(repoRoot),id);
  const ledgerRoot=path.join(repoRoot,'.starciwork');
  const write=(relative,body)=>{const file=path.join(ledgerRoot,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  write('features/sales/business/srs/delivery/index.yaml',`schema: work/node@2
id: demo.sales.business.srs.fr.delivery
kind: business
required: true
state: done
extensions:
  work3:
    integrations:
      - id: telegram
        provider: telegram-bot-api
        credential:
          name: TELEGRAM_BOT_TOKEN
          providedBy: owner
          where: the workflow environment
        sandbox: https://api.telegram.org/bot<token>/getMe
      - id: zalo
        provider: zalo-oa-api
        credential:
          name: ZALO_OA_TOKEN
          providedBy: owner
      - id: viber
        provider: viber-bot-api
        credential:
          name: VIBER_TOKEN
          providedBy: owner
`);
  write('features/sales/integration/telegram/index.yaml',`schema: work/node@2
id: demo.sales.integration.telegram
kind: integration
required: true
state: done
`);
  write('features/sales/integration/telegram/evidence/op-telegram-evidence/manifest.yaml',`schema: work/evidence@1
id: op-telegram-evidence
nodeId: demo.sales.integration.telegram
inputDigest: ${'a'.repeat(64)}
outcome: pass
assertions: []
assets: []
proof:
  boundary: live
  fakes: []
`);
  write('features/sales/e2e/checkout/index.yaml',`schema: work/node@2
id: demo.sales.e2e.checkout
kind: e2e
required: true
state: done
`);
  write('features/sales/e2e/checkout/evidence/op-checkout-evidence/manifest.yaml',`schema: work/evidence@1
id: op-checkout-evidence
nodeId: demo.sales.e2e.checkout
inputDigest: ${'b'.repeat(64)}
outcome: pass
assertions: []
assets: []
proof:
  boundary: api
  fakes:
    - zalo
`);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',
    kernel:'starci/workflow-kernel@1',id,job:'Deliver the chatbot',phase:'run',approved:true,ops:[],ledger:[],ledgerRoot}));

  const view=buildView({repoRoot,id,now:NOW});
  assert.deepEqual(view.integrations.map(entry=>[entry.id,entry.node,entry.proven,entry.evidence]),[
    ['telegram','demo.sales.integration.telegram','live',1],
    ['zalo',null,'fake',1],
    ['viber',null,'none',0]
  ]);
  const page=renderView(view);
  assert.match(page,/## Integrations \(3\)/);
  assert.match(page,/- telegram \(telegram-bot-api\): proven live/);
  assert.match(page,/- zalo \(zalo-oa-api\): proven against a fake, not live - no integration node in the tree/);
  assert.match(page,/- viber \(viber-bot-api\): not proven - no integration node in the tree/);

  // A tree that is not there leaves the page complete and the section out, rather than failing the view.
  const absent='20260101-000005-no-tree';
  const absentDir=path.join(workflows(repoRoot),absent);
  fs.mkdirSync(absentDir,{recursive:true});
  fs.writeFileSync(path.join(absentDir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',
    kernel:'starci/workflow-kernel@1',id:absent,phase:'run',approved:true,ops:[],ledger:[],
    ledgerRoot:path.join(repoRoot,'gone','.starciwork')}));
  const gone=buildView({repoRoot,id:absent,now:NOW});
  assert.deepEqual(gone.integrations,[]);
  assert.doesNotMatch(renderView(gone),/## Integrations/);
});

test('workflow-list is one row per workflow of the repository, newest first',t=>{
  const repoRoot=tmp(t);
  richStore(repoRoot);
  const finishedDir=path.join(workflows(repoRoot),'20250101-000000-finished');
  fs.mkdirSync(finishedDir,{recursive:true});
  fs.writeFileSync(path.join(finishedDir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',
    kernel:'starci/workflow-kernel@1',id:'20250101-000000-finished',phase:'run',approved:true,
    // This one owned a lane and it went home: the row says so without anybody opening the workflow.
    lane:{name:'20250101-000000-finished',worktree:'W:/workspaces/demo/20250101-000000-finished',branch:'orca/finished',
      base:{worktree:'W:/demo',branch:'main'},merged:{commit:'feed1234feed',into:'main',at:ago(600)}},
    finished:{outcome:'done',reason:'every item verified'},ops:[op('a','done'),op('b','done')],ledger:[]}));
  writeLines(path.join(finishedDir,'events.jsonl'),[{at:ago(600),seq:1,event:'final'}]);

  const list=buildList({repoRoot,now:NOW});
  assert.deepEqual(list.map(entry=>entry.id),['20260101-000000-rich','20250101-000000-finished']);
  assert.deepEqual({...list[0],lastEventAt:undefined,pid:undefined},{id:'20260101-000000-rich',phase:'run',
    approved:true,finished:null,lane:null,opsDone:1,opsTotal:6,kernelAlive:true,stopRequested:false,
    lastEventAgeMs:90_000,lastEventAt:undefined,pid:undefined});
  assert.deepEqual([list[1].phase,list[1].finished,list[1].opsDone,list[1].opsTotal,list[1].kernelAlive],
    ['finished','done',2,2,false]);
  assert.deepEqual(list[1].lane,{name:'20250101-000000-finished',branch:'orca/finished',base:'main',
    merged:'feed1234feed',closed:false});

  const page=renderList(list);
  assert.match(page,/\| workflow \| phase \| lane \| ops \| kernel \| last event \|/);
  assert.match(page,/\| 20260101-000000-rich \| run \| - \| 1\/6 \| alive \d+ \| 2m \|/);
  assert.match(page,/\| 20250101-000000-finished \| finished done \| 20250101-000000-finished -> main merged \| 2\/2 \| - \| 10h \|/);
  assert.equal(renderList([]),'no workflows in this repository\n');

  // The CLI prints the page itself: a text view must never reach a terminal as an escaped JSON string.
  const cli=spawnSync(process.execPath,[path.join(root,'hosts','orca','launch.mjs'),'workflow-list'],
    {cwd:repoRoot,encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.match(cli.stdout,/\| 20260101-000000-rich \| run \| - \| 1\/6 \|/);
  assert.equal(cli.stdout.includes('\\n'),false);
  const json=spawnSync(process.execPath,[path.join(root,'hosts','orca','launch.mjs'),'workflow-list','--json','true'],
    {cwd:repoRoot,encoding:'utf8'});
  assert.equal(json.status,0,json.stderr);
  assert.equal(JSON.parse(json.stdout).workflows.length,2);
});

/**
 * A workflow that owns a lane says so on its page: which worktree it runs in, which branch, and whether that
 * branch went home. A reader never has to open state.json to learn where the workflow actually is.
 */
test('the view prints the lane of a workflow: its worktree, its branch and the base it merged into',t=>{
  const repoRoot=tmp(t);
  const dir=path.join(workflows(repoRoot),'20260101-000000-laned');
  fs.mkdirSync(dir,{recursive:true});
  const lane={name:'nivo-setup',worktree:'W:/workspaces/demo/nivo-setup',branch:'orca/nivo-setup',
    base:{worktree:'W:/demo',branch:'main'}};
  const write=value=>fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',
    kernel:'starci/workflow-kernel@1',id:'20260101-000000-laned',job:'Walk the setup flow',branch:'orca/nivo-setup',
    worktree:lane.worktree,phase:'run',approved:true,iterations:3,ops:[],ledger:[],needUser:[],lane:value}));
  write(lane);
  writeLines(path.join(dir,'events.jsonl'),[{at:ago(1),seq:1,event:'tick'}]);
  const running=buildView({repoRoot,id:'20260101-000000-laned',now:NOW});
  assert.deepEqual(running.lane,{name:'nivo-setup',worktree:'W:/workspaces/demo/nivo-setup',branch:'orca/nivo-setup',
    base:{worktree:'W:/demo',branch:'main'},merged:null,conflict:null,closed:false});
  assert.match(renderView(running),/lane {7}nivo-setup - W:\/workspaces\/demo\/nivo-setup on orca\/nivo-setup, base main in W:\/demo, not merged yet/);
  write({...lane,merged:{commit:'abcdef0123456789',into:'main',at:ago(2)}});
  assert.match(renderView(buildView({repoRoot,id:'20260101-000000-laned',now:NOW})),/merged abcdef012345 into main/);
  write({...lane,conflict:{files:['src/sales/intake.ts'],at:ago(2),reason:'local changes'}});
  const conflicted=buildView({repoRoot,id:'20260101-000000-laned',now:NOW});
  assert.deepEqual(conflicted.lane.conflict,{files:['src/sales/intake.ts']});
  assert.match(renderView(conflicted),/NOT merged: conflicts in src\/sales\/intake\.ts/);
  // A workflow without a lane renders no lane line at all, and says null in the record.
  assert.equal(buildView({repoRoot,id:'20260101-000000-rich',now:NOW,dir:richStore(repoRoot).dir})?.lane??null,null);
});

test('a feature is the first two segments of a Work node id, and nothing is invented without one',()=>{
  assert.equal(featureOf({nodeId:'nivo.accounting.implementation.backend.domain.money'}),'nivo.accounting');
  assert.equal(featureOf({id:'item-1',module:'features/sales'}),'features/sales');
  assert.equal(featureOf({id:'item-1'}),'item-1');
  assert.equal(featureOf({}),'(no feature)');
});

test('the module is listed as a runtime module',()=>{
  assert.match(fs.readFileSync(path.join(root,'scripts','runtime-modules.txt'),'utf8'),/^kernel\/view\.mjs$/m);
});
