import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {buildScorecard,outcomeOf,median,readQwenTokens,scorecardFor,summaryLine,formatTable,UNROUTED} from '../scripts/agent/model-scorecard.mjs';

// The model scorecard reads a ledger READ-ONLY and reports each routed pool x op kind: jobs, pass/fail/
// blocked, rework (retries) and median duration, plus qwen token usage from Qwen Code's own usage log.
// These specs pin the numbers on a fixture ledger (withLedger repoints LOCALAPPDATA and lives in a temp dir,
// so no real ledger or machine DB is touched) and a fixture qwen home.
const T=Date.UTC(2026,8,24,12,0,0);
const H=3600000,MIN=60000;
const job=(jobId,{op,pool,status,verdict=null,retryOf=null,createdAt,updatedAt=createdAt})=>({
  jobId,opId:op,kind:'op',status,createdAt,updatedAt,
  payload:{opId:op,...(pool?{model:pool,modelId:`${pool}-model`,difficulty:'medium'}:{}),retry:{retryOf,attempt:retryOf?2:1}},
  result:verdict?{verdict}:null,
});
const timed=(jobId,dispatchedAt,settledAt)=>[
  {kind:'op-dispatched',entityType:'job',entityId:jobId,payload:{},createdAt:dispatchedAt},
  {kind:'op-settled',entityType:'job',entityId:jobId,payload:{},createdAt:settledAt},
];
const JOBS=[
  job('c1',{op:'backend.implement',pool:'claude-agent',status:'succeeded',verdict:'pass',createdAt:T-11*H,updatedAt:T-9*H}),
  job('c2',{op:'backend.implement',pool:'claude-agent',status:'failed',verdict:'fail',createdAt:T-8*H,updatedAt:T-6*H}),
  job('c3',{op:'backend.implement',pool:'claude-agent',status:'succeeded',verdict:'pass',retryOf:'c2',createdAt:T-5*H,updatedAt:T-5*H+30*MIN}),
  job('c4',{op:'business.decide',pool:'claude-agent',status:'failed',verdict:'blocked',createdAt:T-3*H,updatedAt:T-3*H+4*MIN}),
  job('x1',{op:'backend.implement',pool:'codex-agent',status:'succeeded',verdict:'pass',createdAt:T-7*H,updatedAt:T-6*H}),
  job('x2',{op:'backend.implement',pool:'codex-agent',status:'running',retryOf:'x0',createdAt:T-1*H}),
  job('d1',{op:'interface.implement',pool:'devin-agent',status:'failed',verdict:'awaiting-owner',createdAt:T-4*H,updatedAt:T-2*H}),
  job('u1',{op:'work.author',pool:null,status:'cancelled',verdict:'dropped',createdAt:T-2*H,updatedAt:T-H}),
  // Outside a 24h window: only the all-history scorecard counts it (created -> updated = 60 min).
  job('old',{op:'backend.implement',pool:'claude-agent',status:'succeeded',verdict:'pass',createdAt:T-48*H,updatedAt:T-47*H}),
];
const EVENTS=[
  ...timed('c1',T-10*H,T-10*H+10*MIN),
  ...timed('c2',T-7*H,T-7*H+20*MIN),
  ...timed('x1',T-6.5*H,T-6.5*H+6*MIN),
  ...timed('d1',T-3*H,T-3*H+8*MIN),
];

const qwenHome=(t,{monthly=true,session=false}={})=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'starci-qwen-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const rec=(at,model,input,output)=>({schemaVersion:1,id:`r${at}`,timestamp:new Date(at).toISOString(),localDate:new Date(at).toISOString().slice(0,10),
    model,inputTokens:input,outputTokens:output,cachedTokens:0,thoughtsTokens:0,totalTokens:input+output,apiDurationMs:1});
  if(monthly){
    fs.mkdirSync(path.join(home,'usage'));
    fs.writeFileSync(path.join(home,'usage','token-usage-2026-09.jsonl'),[
      rec(T-H,'qwen3.8-flash',1000,200),rec(T-2*H,'qwen3.8-max',500,100),rec(T-30*H,'qwen3.8-flash',1000000,200000),
    ].map(r=>JSON.stringify(r)).join('\n')+'\nnot json\n');
  }
  if(session)fs.writeFileSync(path.join(home,'usage_record.jsonl'),JSON.stringify({version:1,sessionId:'s',timestamp:T-H,
    models:{'qwen3.8-max':{requests:3,inputTokens:700,outputTokens:70,totalTokens:770}}})+'\n');
  return home;
};

const seeded=(t,fn)=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:'wf-scorecard',jobs:JOBS,events:EVENTS,now:T});
  return fn({repoRoot});
});

test('outcome buckets and median follow the documented rules',()=>{
  assert.equal(outcomeOf({status:'succeeded',verdict:'pass'}),'pass');
  assert.equal(outcomeOf({status:'succeeded',verdict:null}),'pass');
  assert.equal(outcomeOf({status:'failed',verdict:'fail'}),'fail');
  assert.equal(outcomeOf({status:'failed',verdict:null}),'fail');
  assert.equal(outcomeOf({status:'failed',verdict:'blocked'}),'blocked');
  assert.equal(outcomeOf({status:'failed',verdict:'awaiting-owner'}),'blocked');
  assert.equal(outcomeOf({status:'cancelled',verdict:'dropped'}),'cancelled');
  assert.equal(outcomeOf({status:'running',verdict:null}),'open');
  assert.equal(outcomeOf({status:'effect_unknown',verdict:null}),'open');
  assert.equal(median([]),null);
  assert.equal(median([3,1,2]),2);
  assert.equal(median([4,1,3,2]),2.5);
});

test('24h scorecard over a fixture ledger: per pool x kind counts, rates, medians and shares',t=>seeded(t,({repoRoot})=>{
  const sc=scorecardFor({repos:[repoRoot],sinceHours:24,now:T,qwenHome:qwenHome(t)});
  assert.deepEqual(sc.errors,[]);
  assert.equal(sc.jobs,8);
  assert.equal(sc.window.label,'24h');
  assert.deepEqual(Object.keys(sc.pools),['claude-agent','codex-agent',UNROUTED,'devin-agent','qwen-agent']);
  // c1, c2, x1, d1 have dispatch->settle events; c3 and c4 fall back to created->updated.
  assert.deepEqual(sc.durationSource,{events:4,row:2});

  const claude=sc.pools['claude-agent'];
  assert.equal(claude.jobs,4);
  assert.equal(claude.share,0.5);
  assert.deepEqual([claude.pass,claude.fail,claude.blocked,claude.cancelled,claude.open,claude.rework],[2,1,1,0,0,1]);
  assert.equal(claude.passRate,0.5);
  assert.equal(claude.reworkRate,0.25);
  assert.equal(claude.medianMs,15*MIN); // [4,10,20,30] min
  assert.equal(claude.tokens,'n/a');

  const impl=claude.kinds['backend.implement'];
  assert.deepEqual([impl.jobs,impl.settled,impl.pass,impl.fail,impl.rework],[3,3,2,1,1]);
  assert.equal(impl.passRate,2/3);
  assert.equal(impl.failRate,1/3);
  assert.equal(impl.reworkRate,1/3);
  assert.equal(impl.medianMs,20*MIN); // events 10, events 20, row 30
  assert.equal(impl.share,0.75);
  const decide=claude.kinds['business.decide'];
  assert.deepEqual([decide.jobs,decide.blocked,decide.blockedRate,decide.passRate,decide.medianMs],[1,1,1,0,4*MIN]);

  const codex=sc.pools['codex-agent'];
  assert.deepEqual([codex.jobs,codex.share,codex.settled,codex.pass,codex.open,codex.rework],[2,0.25,1,1,1,1]);
  assert.equal(codex.passRate,1);
  assert.equal(codex.reworkRate,0.5);
  assert.equal(codex.medianMs,6*MIN);

  const devin=sc.pools['devin-agent'];
  assert.deepEqual([devin.jobs,devin.blocked,devin.passRate,devin.medianMs],[1,1,0,8*MIN]);
  const unrouted=sc.pools[UNROUTED];
  assert.deepEqual([unrouted.jobs,unrouted.cancelled,unrouted.medianMs,unrouted.share],[1,1,null,0.125]);

  // qwen has no jobs here but its token usage still reports: 24h = the two recent records only.
  const qwen=sc.pools['qwen-agent'];
  assert.equal(qwen.jobs,0);
  assert.deepEqual(qwen.tokens.last24h,{input:1500,output:300,total:1800,requests:2});
  assert.deepEqual(qwen.tokens.total,{input:1001500,output:200300,total:1201800,requests:3});
  assert.equal(qwen.tokens.byDay['2026-09-24']['qwen3.8-flash'].input,1000);
  assert.equal(qwen.tokens.byDay['2026-09-23']['qwen3.8-flash'].total,1200000);

  assert.equal(summaryLine(sc),'pools 24h: claude 50% (p50%) · codex 25% (p100%) · unrouted 13% · devin 13% (p0%) · qwen tokens 24h 1.8k');
  const table=formatTable(sc);
  assert.match(table,/claude\s+backend\.implement\s+3\s+67%\s+33%\s+0%\s+33%\s+20\.0/);
  assert.match(table,/TOTAL qwen: 0 jobs .* tokens 24h 1\.8k/);
  assert.match(table,/events \(4\) else created->updated \(2\)/);
}));

test('all-history window counts the old job and --json shape carries every pool and kind',t=>seeded(t,({repoRoot})=>{
  const sc=scorecardFor({repos:[repoRoot],now:T,qwenHome:qwenHome(t)});
  assert.equal(sc.window.label,'all');
  assert.equal(sc.jobs,9);
  const impl=sc.pools['claude-agent'].kinds['backend.implement'];
  assert.equal(impl.jobs,4);
  assert.equal(impl.medianMs,25*MIN); // [10,20,30,60]
  assert.equal(sc.pools['claude-agent'].share,5/9);
  const json=JSON.parse(JSON.stringify(sc));
  assert.deepEqual(Object.keys(json).sort(),['durationSource','errors','jobs','pools','repos','window']);
  for(const key of ['jobs','share','pass','fail','rework','medianMs','tokens','kinds'])assert.ok(key in json.pools['codex-agent'],key);
  assert.ok(summaryLine(sc).startsWith('pools all: claude 56% (p60%)'));
}));

test('a missing ledger or qwen home is reported, never thrown; tokens fall back to the session log',t=>{
  const missing=path.join(os.tmpdir(),'starci-scorecard-no-such-repo');
  const sc=scorecardFor({repos:[missing],sinceHours:24,now:T,qwenHome:path.join(missing,'.qwen')});
  assert.equal(sc.errors.length,1);
  assert.equal(sc.errors[0].repo,missing);
  assert.deepEqual(sc.pools,{});
  assert.equal(summaryLine(sc),'pools 24h: no op jobs');
  assert.equal(readQwenTokens({home:path.join(missing,'.qwen'),now:T}),null);

  const home=qwenHome(t,{monthly:false,session:true});
  const tokens=readQwenTokens({home,now:T});
  assert.deepEqual(tokens.last24h,{input:700,output:70,total:770,requests:1});
  assert.equal(tokens.scope,'machine');
  const built=buildScorecard([],{window:{sinceMs:null,label:'24h'},tokens:{'qwen-agent':tokens}});
  assert.equal(summaryLine(built),'pools 24h: qwen tokens 24h 770');
});
