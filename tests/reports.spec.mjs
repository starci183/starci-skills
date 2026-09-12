import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {createOrcaCalls} from '../execution/orca-calls.mjs';
import {OUTCOMES,buildReport,reportBody,reportsDirectory,repositoryRoot,validateReport} from '../execution/reports.mjs';
import {classifyWorker,reportOutcome,waitTick} from '../execution/orca-protocol.mjs';

const calls=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
const base={run:'run_sales',task:'task_op',dispatch:'ctx_op',from:'term_op',summary:'Implemented the slice and ran the focused suite.'};
const check={name:'unit',command:'npx vitest run x.spec.ts',exitCode:0,evidence:'12 passed'};
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
function fakeOrca(handlers){
  const spawned=[];const counts={};
  const spawn=(executable,args)=>{spawned.push(args);const key=args[0]==='terminal'?`terminal-${args[1]}`:args[0]==='agent-context'?'agent-context':args[1];counts[key]=(counts[key]??0)+1;const handler=handlers[key];if(!handler)throw Error(`Unexpected fake call: ${args.join(' ')}`);return handler(args,counts[key]);};
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),spawned};
}
const has=(args,flag,value)=>{const index=args.indexOf(flag);return index>=0&&(value===undefined||args[index+1]===value);};
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-reports-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};

test('every outcome maps to exactly one Orca signal and done is earned, not claimed',()=>{
  assert.deepEqual(OUTCOMES,['done','partial','failed','ask','blocked']);
  const done=buildReport({...base,outcome:'done',files:['apps/sales/a.ts'],checks:[check]});
  assert.deepEqual(done.signal,{type:'worker_done',orcaOutcome:'succeeded'});
  assert.throws(()=>buildReport({...base,outcome:'done',checks:[]}),/at least one check/);
  assert.throws(()=>buildReport({...base,outcome:'done',checks:[{...check,exitCode:1}]}),/failing check/);
  assert.throws(()=>buildReport({...base,outcome:'done',checks:[check],open:['x']}),/open items/);
  assert.throws(()=>buildReport({...base,outcome:'partial',checks:[check]}),/partial requires open items/);
  assert.throws(()=>buildReport({...base,outcome:'ask'}),/ask requires a question/);
  assert.throws(()=>buildReport({...base,outcome:'blocked',blocker:{kind:'weather',detail:'x'}}),/blocker kind/);
  assert.equal(buildReport({...base,outcome:'blocked',blocker:{kind:'shared-change',detail:'Core must register the entity'}}).signal.type,'escalation');
  assert.equal(buildReport({...base,outcome:'ask',question:{text:'Which order?',options:['a','b']}}).signal.type,'question');
  assert.equal(buildReport({...base,outcome:'failed',checks:[{...check,exitCode:2}]}).signal.orcaOutcome,'failed');
  const outside=validateReport(done,{allowlist:['apps/accounting']});
  assert.equal(outside.ok,false);assert.match(outside.errors.join(';'),/outside the allowlist/);
  assert.equal(validateReport(done,{allowlist:['apps/sales']}).ok,true);
  assert.throws(()=>buildReport({...base,kind:'workflow',outcome:'done',checks:[check]}),/branch and head/);
  assert.match(reportBody(done,'reports/run_sales/ctx_op.json'),/^outcome: done\nreport: reports\/run_sales\/ctx_op.json/);
});

test('report writes the file first, sends the matching signal once, and refuses a second report',()=>{
  const dir=tmp();
  try{
    const sent=[];
    const fake=fakeOrca({send:(args)=>{sent.push(args);return json(0,{ok:true,result:{message:{id:'msg_1'}}});}});
    const first=reportOutcome(fake.orca,{cwd:path.resolve('fixtures/orca/agentos-r14-sales'),...base,outcome:'done',files:['apps/sales/a.ts'],checks:[check],reportsDir:dir,now:()=>42});
    assert.equal(first.ok,true);assert.equal(first.messageId,'msg_1');
    assert.ok(has(sent[0],'--type','worker_done')&&has(sent[0],'--outcome','succeeded')&&has(sent[0],'--task-id','task_op')&&has(sent[0],'--dispatch-id','ctx_op')&&has(sent[0],'--files-modified','apps/sales/a.ts'));
    const stored=JSON.parse(fs.readFileSync(path.join(dir,'ctx_op.json'),'utf8'));
    assert.equal(stored.sent.messageId,'msg_1');assert.equal(stored.outcome,'done');
    const again=reportOutcome(fake.orca,{cwd:path.resolve('fixtures/orca/agentos-r14-sales'),...base,outcome:'failed',reportsDir:dir});
    assert.equal(again.ok,false);assert.equal(again.reason,'already-reported');assert.equal(sent.length,1);
    const refused=fakeOrca({send:()=>json(1,{ok:false,error:{code:'sender_not_assignee',message:'No active Dispatch belongs to this message sender.'}})});
    const lost=reportOutcome(refused.orca,{cwd:path.resolve('fixtures/orca/agentos-r14-sales'),...base,dispatch:'ctx_other',outcome:'blocked',blocker:{kind:'sds-gap',detail:'ledger key'},reportsDir:dir});
    assert.equal(lost.ok,false);assert.match(lost.reason,/still reads the file/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'ctx_other.json'),'utf8')).sent,null);
  }finally{fs.rmSync(path.dirname(dir),{recursive:true,force:true});}
});

test('a live worker is classified from its screen, never from a fresh heartbeat',()=>{
  const term={handle:'t',status:'running',lastOutputAt:1000,title:'x'};
  assert.equal(classifyWorker({screen:'● Editing\n  ⏵⏵ bypass permissions on · esc to interrupt',terminal:term,now:2000}).liveness,'working');
  assert.equal(classifyWorker({screen:'✻ done 1:21 PM\n❯\n  ⏵⏵ bypass permissions on',terminal:term,now:2000}).liveness,'stalled-idle');
  assert.equal(classifyWorker({screen:'Allow execution of: cmd?\n› 1. Yes, allow once\n⠏ Waiting for user confirmation...',terminal:term,now:2000}).liveness,'stalled-prompt');
  assert.equal(classifyWorker({screen:'⠦ Herding digital cats... (14s · esc to cancel)',terminal:term,now:2000}).liveness,'working');
  assert.equal(classifyWorker({screen:'*   Type your message or @path/to/file',terminal:term,now:2000}).liveness,'stalled-idle');
  assert.equal(classifyWorker({screen:'Reading files...',terminal:term,now:1000+30*60*1000,stalledAfterMs:20*60*1000}).liveness,'stalled-silent');
  assert.equal(classifyWorker({screen:'',terminal:null,now:2000}).liveness,'dead');
  assert.equal(classifyWorker({screen:'❯',terminal:term,now:2000,reported:true}).liveness,'reported');
  // classifyWorker is the protocol-side name for `observe`: it also names the family and that family's
  // accepting keystroke, so the supervisor answers a dialog the way its provider expects (see
  // tests/provider-observe.spec.mjs for the whole signature table).
  const dialog=classifyWorker({screen:'Allow command `npm test`? (y/n)',terminal:term,now:2000});
  assert.deepEqual([dialog.liveness,dialog.provider,dialog.answer],['stalled-prompt','codex','y']);
  const qwen=classifyWorker({screen:'⠦ Thinking… (14s · esc to cancel)\nqwen3.8-flash (Token Plan Singapore)',terminal:term,now:2000});
  assert.deepEqual([qwen.liveness,qwen.provider,qwen.answer],['working','qwen','1']);
  assert.equal(classifyWorker({screen:'API Error: 429 rate_limit_error',terminal:term,now:2000}).liveness,'rate-limited');
});

test('wait tick acknowledges the previous batch, reads report files, classifies workers, sweeps and re-canonicalizes titles',()=>{
  const dir=tmp();const cwd=path.resolve('fixtures/orca/agentos-r14-sales');
  try{
    fs.writeFileSync(path.join(dir,'ctx_done.json'),JSON.stringify(buildReport({...base,dispatch:'ctx_done',outcome:'done',files:['apps/sales/a.ts'],checks:[check]})));
    const renames=[],checks=[];
    const fake=fakeOrca({
      check:(args)=>{if(args.includes('--peek'))return json(0,{ok:true,result:{messages:[{id:'hb',type:'heartbeat',created_at:'1970-01-01T00:00:04Z',payload:'{"dispatchId":"ctx_done"}'}]}});checks.push(args);return json(0,{ok:true,result:{deliveryId:'delivery_2',messages:[{id:'msg_q',type:'question',subject:'Which order?',body:'a or b',payload:'{"taskId":"task_q","dispatchId":"ctx_q"}'}]}});},
      'worker-list':()=>json(0,{ok:true,result:{workers:[
        {dispatchId:'ctx_done',taskId:'task_done',workerState:'ready',dispatchStatus:'dispatched',agentTerminalHandle:'term_done'},
        {dispatchId:'ctx_idle',taskId:'task_idle',workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:'term_idle'},
        {dispatchId:'ctx_old',taskId:'task_old',workerState:'failed',dispatchStatus:'failed',agentTerminalHandle:'term_old'}]}}),
      'terminal-list':()=>json(0,{ok:true,result:{terminals:[
        {handle:'term_done',title:'[Op] backend.implement - Sales',worktreePath:cwd,status:'running',lastOutputAt:0},
        {handle:'term_idle',title:'✳ Qwen - sales',worktreePath:cwd,status:'running',lastOutputAt:0},
        {handle:'term_old',title:'worker-task_old',worktreePath:cwd,status:'running',lastOutputAt:0},
        {handle:'term_me',title:'[Monitor] Sales',worktreePath:cwd,status:'running',lastOutputAt:0}]}}),
      'task-list':()=>json(0,{ok:true,result:{tasks:[{id:'task_done',display_name:'[Op] backend.implement - Sales'},{id:'task_idle',display_name:'[Op] review.verify - Sales'}]}}),
      'terminal-read':(args)=>json(0,{ok:true,result:{terminal:{handle:args[3],tail:args[3]==='term_idle'?['*   Type your message or @path/to/file']:['● Editing','esc to interrupt']}}}),
      'terminal-rename':(args)=>{renames.push(args);return json(0,{ok:true,result:{}});},
      'terminal-close':()=>json(0,{ok:true,result:{}})
    });
    const first=waitTick(fake.orca,{cwd,run:'run_sales',from:'term_me',reportsDir:dir,now:()=>5000,wait:()=>{}});
    assert.equal(first.event,'report');
    assert.ok(!has(checks[0],'--ack'));assert.ok(has(checks[0],'--types','worker_done,question,escalation')&&has(checks[0],'--wait'));
    assert.equal(first.messages[0].payload.dispatchId,'ctx_q');
    assert.equal(first.reports.length,1);assert.equal(first.reports[0].validation.ok,true);
    assert.deepEqual(first.liveness.map(item=>[item.dispatch,item.liveness]),[['ctx_done','reported'],['ctx_idle','stalled-idle']]);
    assert.deepEqual(renames.map(args=>args[args.indexOf('--title')+1]),['[Op] review.verify - Sales']);
    assert.deepEqual(first.sweep.closed.map(item=>item.handle),['term_old']);
    const second=waitTick(fake.orca,{cwd,run:'run_sales',from:'term_me',reportsDir:dir,now:()=>6000,wait:()=>{}});
    assert.ok(has(checks[1],'--ack','delivery_2'));
    assert.equal(second.reports.length,0);
  }finally{fs.rmSync(path.dirname(dir),{recursive:true,force:true});}
});

test('report files of a linked worktree live in the main repository so op and kernel scan the same directory',()=>{
  const root=repositoryRoot(process.cwd());
  assert.ok(fs.existsSync(path.join(root,'.git')));
  assert.equal(reportsDirectory(process.cwd(),'run_x'),path.join(root,'.starciwork','_local','runtime','reports','run_x'));
  assert.equal(reportsDirectory(process.cwd(),'run_x','C:/explicit'),path.resolve('C:/explicit'));
});

test('wait pings every live worker each tick instead of sleeping through the whole timeout',()=>{
  const dir=tmp();const cwd=path.resolve('fixtures/orca/agentos-r14-sales');
  try{
    let clock=0,checks=0;const reads=[];
    const fake=fakeOrca({
      check:(args)=>{if(args.includes('--peek'))return json(0,{ok:true,result:{messages:[]}});checks+=1;clock+=Number(args[args.indexOf('--timeout-ms')+1]);return json(0,{ok:true,result:{deliveryId:null,messages:[]}});},
      'worker-list':()=>json(0,{ok:true,result:{workers:[{dispatchId:'ctx_p',taskId:'task_p',workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:'term_p'}]}}),
      'terminal-list':()=>json(0,{ok:true,result:{terminals:[{handle:'term_p',title:'[Op] review.verify - Sales',worktreePath:cwd,status:'running',lastOutputAt:0}]}}),
      'task-list':()=>json(0,{ok:true,result:{tasks:[{id:'task_p',display_name:'[Op] review.verify - Sales'}]}}),
      'terminal-read':()=>{reads.push(clock);const prompt=checks===3?answers.length===0:checks>=4;return json(0,{ok:true,result:{terminal:{handle:'term_p',tail:prompt?['Allow execution of: orca?','> 1. Yes, allow once','Waiting for user confirmation...']:['Reading files','esc to cancel']}}});},
      'terminal-send':(args)=>{answers.push(args);return json(0,{ok:true,result:{}});}
    });
    const answers=[];
    const result=waitTick(fake.orca,{cwd,run:'run_sales',from:'term_me',reportsDir:dir,timeoutMs:900000,tickMs:120000,now:()=>clock,wait:()=>{}});
    // tick 3: the prompt is answered once and clears (working); tick 4: a prompt survives the answer -> stalled-prompt.
    assert.equal(result.event,'stalled-prompt');
    assert.equal(checks,4);
    assert.equal(result.ticks,4);
    assert.ok(answers.every(args=>args.includes('--enter')&&args[args.indexOf('--text')+1]==='1'));
    assert.equal(result.approvals.length,1);
    assert.equal(result.approvals[0].cleared,false);
    assert.equal(answers.length,2);
    assert.match(result.next,/settle/);
    assert.deepEqual(reads.slice(0,3),[120000,240000,360000]);
  }finally{fs.rmSync(path.dirname(dir),{recursive:true,force:true});}
});

test('a worker that neither pings nor prints inside the grace window is reported silent',()=>{
  const dir=tmp();const cwd=path.resolve('fixtures/orca/agentos-r14-sales');
  try{
    const fake=fakeOrca({
      check:(args)=>args.includes('--peek')?json(0,{ok:true,result:{messages:[{id:'hb',type:'heartbeat',created_at:'1970-01-01T00:00:00Z',payload:'{"dispatchId":"ctx_s"}'}]}}):json(0,{ok:true,result:{deliveryId:null,messages:[]}}),
      'worker-list':()=>json(0,{ok:true,result:{workers:[{dispatchId:'ctx_s',taskId:'task_s',workerState:'ready',dispatchStatus:'dispatched',agentTerminalHandle:'term_s'}]}}),
      'terminal-list':()=>json(0,{ok:true,result:{terminals:[{handle:'term_s',title:'[Op] backend.implement - Sales',worktreePath:cwd,status:'running',lastOutputAt:0}]}}),
      'task-list':()=>json(0,{ok:true,result:{tasks:[{id:'task_s',display_name:'[Op] backend.implement - Sales'}]}}),
      'terminal-read':()=>json(0,{ok:true,result:{terminal:{handle:'term_s',tail:['Compiling...']}}})
    });
    const result=waitTick(fake.orca,{cwd,run:'run_sales',from:'term_me',reportsDir:dir,timeoutMs:1000,tickMs:1000,now:()=>11*60*1000,stalledAfterMs:20*60*1000,wait:()=>{}});
    assert.equal(result.event,'stalled-silent');
    assert.equal(result.liveness[0].pingAgeMs,11*60*1000);
  }finally{fs.rmSync(path.dirname(dir),{recursive:true,force:true});}
});
