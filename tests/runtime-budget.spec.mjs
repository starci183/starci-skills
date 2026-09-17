import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BUDGET_FILE,RUNTIME_BUDGET,budgetVerdict,normalizeBudget,probeRuntimeBudget,readRuntimeBudget,runtimeWindows,writeRuntimeBudget} from '../kernel/budget.mjs';
import {superviseForever} from '../kernel/supervisor.mjs';
import {acquireStartup} from '../kernel/launch.mjs';
import {WORKFLOW_STATE,createStore} from '../kernel/store.mjs';
import {ledgerFileFor,inspectLedger} from '../kernel/ledger-db.mjs';
import {readProviderLoads} from '../kernel/loads.mjs';

/** The receipt Orca prints for `account list --json`, trimmed to the rate-limit block the status bar shows. */
const RECEIPT={ok:true,result:{rateLimits:{
  claude:{provider:'claude',status:'ok',error:null,updatedAt:1000,
    session:{usedPercent:33,windowMinutes:300,resetsAt:20_000,resetDescription:'2:50 PM'},
    weekly:{usedPercent:48,windowMinutes:10080,resetsAt:90_000},
    fableWeekly:{usedPercent:96,windowMinutes:10080,resetsAt:90_000}},
  codex:{provider:'codex',status:'ok',error:null,session:null,weekly:{usedPercent:20,windowMinutes:10080,resetsAt:150_000},rateLimitResetCredits:{availableCount:0}},
  gemini:{provider:'gemini',status:'unavailable',error:'Gemini CLI OAuth is disabled in settings',session:null,weekly:null}}}};
const FABLE={target:'claude-fable-5.1',provider:'claude',budgetWindow:'fableWeekly'};
const OPUS={target:'claude-opus',provider:'claude'};
const SOL={target:'gpt-5.6-sol',provider:'codex'};
const QWEN={target:'qwen3.8-flash'};

test('the Orca receipt is reduced to per-provider windows, unreadable providers stay listed as unavailable',()=>{
  const budget=normalizeBudget(RECEIPT,{at:5000});
  assert.equal(budget.schema,RUNTIME_BUDGET);
  assert.deepEqual(Object.keys(budget.providers).sort(),['claude','codex','gemini']);
  assert.deepEqual(budget.providers.claude.windows.session,{usedPercent:33,resetsAt:20_000,minutes:300});
  assert.deepEqual(Object.keys(budget.providers.claude.windows).sort(),['fableWeekly','session','weekly']);
  assert.deepEqual(budget.providers.codex.windows,{weekly:{usedPercent:20,resetsAt:150_000,minutes:10080}});
  assert.equal(budget.providers.gemini.status,'unavailable');
  assert.deepEqual(budget.providers.gemini.windows,{});
});

test('a runtime is bound by the generic windows of its provider, and by a named window only when its profile names it',()=>{
  const budget=normalizeBudget(RECEIPT,{at:5000});
  assert.deepEqual(runtimeWindows(OPUS,budget).map(win=>win.name),['session','weekly'],'Opus never sees the Fable window');
  assert.deepEqual(runtimeWindows(FABLE,budget).map(win=>win.name),['session','weekly','fableWeekly']);
  assert.deepEqual(runtimeWindows(SOL,budget).map(win=>win.name),['weekly']);
  assert.deepEqual(runtimeWindows(QWEN,budget),[],'a runtime with no provider is bound by nothing here');
  assert.deepEqual(runtimeWindows({provider:'gemini'},budget),[],'an unavailable provider binds nothing');
});

test('the verdict names an exhausted window until its reset, the smallest remaining share, and knows nothing about an unread runtime',()=>{
  const budget=normalizeBudget(RECEIPT,{at:5000});
  const fable=budgetVerdict(FABLE,budget,{now:10_000});
  assert.equal(fable.known,true);assert.equal(fable.exhausted,true);assert.equal(fable.until,90_000);assert.equal(fable.remaining,4);
  const opus=budgetVerdict(OPUS,budget,{now:10_000});
  assert.equal(opus.exhausted,false);assert.equal(opus.remaining,52,'the week is the tighter of Opus windows');
  const sol=budgetVerdict(SOL,budget,{now:10_000});
  assert.deepEqual([sol.exhausted,sol.remaining],[false,80]);
  // Past its reset an exhausted window no longer binds, and a window Orca reset since is simply gone.
  assert.equal(budgetVerdict(FABLE,budget,{now:100_000}).exhausted,false);
  assert.deepEqual(budgetVerdict(QWEN,budget,{now:10_000}),{known:false,exhausted:false,until:null,remaining:null,windows:[]});
});

test('the probe never throws: an unreachable Orca, a non-zero exit and non-JSON output are reasons, a receipt is a budget',()=>{
  assert.equal(probeRuntimeBudget({run:()=>{throw Error('spawn orca ENOENT');}}).ok,false);
  assert.match(probeRuntimeBudget({run:()=>({status:1,stdout:'',stderr:'not paired'})}).reason,/exited 1: not paired/);
  assert.match(probeRuntimeBudget({run:()=>({status:0,stdout:'garbage'})}).reason,/no JSON/);
  const probed=probeRuntimeBudget({run:()=>({status:0,stdout:JSON.stringify(RECEIPT)}),at:777});
  assert.equal(probed.ok,true);assert.equal(probed.budget.at,777);assert.equal(probed.budget.providers.claude.windows.weekly.usedPercent,48);
});

test('the budget file is written whole beside the stores and read back; a missing or foreign file reads as null',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-budget-'));
  try{
    const workflows=path.join(root,'.starciwork','_local','workflows');
    assert.equal(readRuntimeBudget(workflows),null);
    const file=writeRuntimeBudget(workflows,normalizeBudget(RECEIPT,{at:1}));
    assert.equal(path.basename(file),BUDGET_FILE);
    assert.equal(readRuntimeBudget(workflows).providers.codex.windows.weekly.usedPercent,20);
    assert.equal(fs.readdirSync(workflows).filter(name=>name.endsWith('.tmp')).length,0,'no temp file is left behind');
    fs.writeFileSync(file,'{"schema":"other"}');
    assert.equal(readRuntimeBudget(workflows),null);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('the supervisor probes the quota on its own cadence and writes the budget beside every store root it covers',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-budget-sup-'));
  try{
    const workflows=path.join(root,'.starciwork','_local','workflows');
    let clock=1_000_000;
    // One approved, healthy, unfinished workflow keeps the supervisor alive for three rounds. The workflow
    // list and the kernel-lock startup reservation supervisor.mjs reads are both ledger rows now (docs §4) -
    // "healthy" no longer means a kernel.lock file, it means an `acquireStartup` row in phase 'running'
    // whose pid a real process.kill(pid,0) proves alive.
    const store=createStore({repoRoot:root,id:'w'});
    store.saveState({schema:WORKFLOW_STATE,id:'w',job:'goal',approved:true,finished:null,worktree:root,host:'H',ops:[]});
    store.appendEvent({event:'tick'});
    acquireStartup(store.ledger,'w',{pid:process.pid});
    store.close();
    const logged=[];let probes=0;
    superviseForever({repoRoot:root,roots:[root],launcher:'L.mjs',maxRounds:3,sleep:()=>{clock+=60_000;},now:()=>clock,log:event=>logged.push(event),
      probe:()=>{probes+=1;return probes===2?{ok:false,reason:'orca away'}:{ok:true,budget:normalizeBudget(RECEIPT,{at:clock})};},probeMs:120_000});
    // Round 1 probes (nothing probed yet), round 2 is inside the cadence, round 3 probes again (and fails): the file keeps the last good budget.
    assert.equal(probes,2);
    assert.deepEqual(logged.filter(event=>event.event==='budget-probed').map(event=>event.providers.claude.fableWeekly),[96]);
    assert.deepEqual(logged.filter(event=>event.event==='budget-probe-failed').map(event=>event.reason),['orca away']);
    // recordProviderLoads writes the probed quota into the ledger's runtime_loads table now (kernel/loads.mjs) -
    // "beside every store root it covers" means one row per claimed ledger, not a file beside `workflows`.
    const inspect=inspectLedger({file:ledgerFileFor(root)});
    assert.equal(readProviderLoads({ledger:inspect}).providers.claude.windows.session.usedPercent,33);
    inspect.close();
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
