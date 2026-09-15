/**
 * The provider quota as Orca reports it (`orca account list --json` -> `rateLimits`): per provider, the usage
 * windows the status bar shows - Claude's five-hour session, its week, Fable's own week; Codex's week. The
 * supervisor probes it on a slow cadence and writes it beside the workflow stores as `runtime-budget.json`,
 * so every kernel of the repository reads the same numbers and none of them calls Orca for them. A runtime is
 * bound by the windows of its provider, and by a named window (Fable's) only when its profile names it.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const RUNTIME_BUDGET='starci/runtime-budget@1';
export const BUDGET_FILE='runtime-budget.json';
/** A window this full is exhausted: nothing is launched on its provider until it resets. */
export const EXHAUSTED_PERCENT=95;
/** How often the supervisor asks Orca; the numbers move slowly and every kernel reads the file, not Orca. */
export const DEFAULT_PROBE_MS=3*60*1000;
/**
 * How old a written budget may be and still bound an allocation. It is the supervisor's cadence with room for
 * two missed probes, and it is one constant on purpose: the freshness `budgetVerdict` demands and the freshness
 * `freshRuntimeBudget` refreshes for must never drift apart, or a kernel reads a file its own selector rejects.
 */
export const FRESH_MAX_AGE_MS=DEFAULT_PROBE_MS*3;
const GENERIC_WINDOWS=['session','weekly','daily','monthly'];

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function windowsOf(entry){
  const out={};
  for(const [name,win] of Object.entries(entry)){
    if(!plain(win)||typeof win.usedPercent!=='number')continue;
    out[name]={usedPercent:win.usedPercent,resetsAt:Number.isFinite(Number(win.resetsAt))&&win.resetsAt?Number(win.resetsAt):null,minutes:Number.isFinite(Number(win.windowMinutes))?Number(win.windowMinutes):null};
  }
  return out;
}

/** The Orca receipt, reduced to what allocation reads. Providers Orca cannot read stay listed as unavailable. */
export function normalizeBudget(receipt,{at=Date.now()}={}){
  const limits=receipt?.result?.rateLimits??receipt?.rateLimits??{};
  const providers={};
  for(const [provider,entry] of Object.entries(plain(limits)?limits:{})){
    if(!plain(entry))continue;
    providers[provider]={status:entry.status??(entry.error?'unavailable':'ok'),error:entry.error??null,updatedAt:entry.updatedAt??null,windows:windowsOf(entry)};
  }
  return {schema:RUNTIME_BUDGET,at,providers};
}

const defaultRun=()=>spawnSync(process.platform==='win32'?'orca.exe':'orca',['account','list','--json'],{encoding:'utf8',windowsHide:true});

/** Ask Orca once. Never throws: an unreachable Orca is `{ok:false, reason}` and the last written budget stands. */
export function probeRuntimeBudget({run=defaultRun,at=Date.now()}={}){
  let result;
  try{result=run();}catch(error){return {ok:false,reason:`orca account list: ${error?.message??error}`};}
  if(!result||result.status!==0)return {ok:false,reason:`orca account list exited ${result?.status??'?'}: ${String(result?.stderr??'').trim().slice(0,200)}`};
  let receipt;
  try{receipt=JSON.parse(String(result.stdout??''));}catch{return {ok:false,reason:'orca account list printed no JSON'};}
  if(receipt?.ok===false)return {ok:false,reason:receipt?.error?.message??'orca account list refused'};
  return {ok:true,budget:normalizeBudget(receipt,{at})};
}

export function budgetPath(workflowsRoot){return path.join(workflowsRoot,BUDGET_FILE);}

/** Written whole and atomically: kernels read it at any moment. */
export function writeRuntimeBudget(workflowsRoot,budget){
  const file=budgetPath(workflowsRoot);
  fs.mkdirSync(workflowsRoot,{recursive:true});
  const temp=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp,JSON.stringify(budget,null,2));
  fs.renameSync(temp,file);
  return file;
}

export function readRuntimeBudget(workflowsRoot){
  try{const parsed=JSON.parse(fs.readFileSync(budgetPath(workflowsRoot),'utf8'));return parsed?.schema===RUNTIME_BUDGET&&plain(parsed.providers)?parsed:null;}catch{return null;}
}

/** Whether a written budget is recent enough to bind an allocation now. A future stamp is not fresh either. */
export function budgetIsFresh(budget,{now=Date.now(),maxAgeMs=FRESH_MAX_AGE_MS}={}){
  const at=Number(budget?.at);
  return Number.isFinite(at)&&at<=now&&now-at<=maxAgeMs;
}

/**
 * The budget an allocation may actually read, refreshed when it is not.
 *
 * The supervisor probes on its own cadence, but a workflow's FIRST quota question is asked before any supervisor
 * exists: `workflow-goal` runs on the bare command, selects the planner and validator pools, and used to read
 * whatever `runtime-budget.json` the last run left behind. A file hours old is rejected by `budgetVerdict`'s
 * freshness rule, so the pool came back empty and the goal was assessed and critiqued by nobody at all - with no
 * model call ever made and no reason on the record. That is the hole this closes: the caller asks for a budget it
 * may use, and gets either a fresh one or an honest refusal.
 *
 * Stale is never good enough. A probe that fails leaves the written file exactly where it is (the supervisor's
 * own rule) and answers `{budget:null, reason}`, because a quota nobody can read is not a quota that permits a
 * launch. Nothing here chooses or forces a provider: it only decides which numbers the quota-aware selector sees.
 */
export function freshRuntimeBudget(workflowsRoot,{probe=probeRuntimeBudget,now=Date.now,maxAgeMs=FRESH_MAX_AGE_MS,write=writeRuntimeBudget}={}){
  const at=now();
  const onDisk=readRuntimeBudget(workflowsRoot);
  if(budgetIsFresh(onDisk,{now:at,maxAgeMs}))return {ok:true,budget:onDisk,source:'file',refreshed:false,reason:null};
  const stale=onDisk?`the written budget is ${Math.round((at-Number(onDisk.at))/1000)}s old`:'no budget has been written beside this store';
  let probed=null;
  try{probed=probe({at});}
  catch(error){probed={ok:false,reason:String(error?.message??error).slice(0,300)};}
  if(!probed?.ok)return {ok:false,budget:null,source:null,refreshed:false,
    reason:`${stale} and the provider quota could not be read: ${probed?.reason??'unknown'}`};
  let written=null;
  try{written=write(workflowsRoot,probed.budget);}
  catch(error){return {ok:false,budget:null,source:null,refreshed:false,
    reason:`${stale} and the refreshed budget could not be written beside the stores: ${String(error?.message??error).slice(0,200)}`};}
  return {ok:true,budget:probed.budget,source:'probed',refreshed:true,reason:null,file:written};
}

/**
 * The windows that bound one runtime: every generic window of its provider (session, weekly, ...) plus a named
 * window only when the runtime's profile names it (`budgetWindow: fableWeekly`). A runtime whose profile names
 * no provider, or whose provider Orca cannot read, is bound by nothing here and falls back to the local rules.
 */
export function runtimeWindows(profileEntry,budget){
  const provider=typeof profileEntry?.provider==='string'?profileEntry.provider:null;
  const entry=provider?budget?.providers?.[provider]:null;
  if(!entry||entry.status!=='ok')return [];
  const named=typeof profileEntry?.budgetWindow==='string'?profileEntry.budgetWindow:null;
  return Object.entries(entry.windows??{})
    .filter(([name])=>GENERIC_WINDOWS.includes(name)||name===named)
    .map(([name,win])=>({name,...win}));
}

/**
 * What the budget says about launching on one runtime now: `known` (the provider was read), `exhausted` (a
 * window is at or past the limit and has not reset), `until` (that reset), `remaining` (the smallest share
 * left across its windows, 0-100) and the windows read. A runtime nobody can read is never exhausted here.
 */
export function budgetVerdict(profileEntry,budget,{now=Date.now(),exhaustedPercent=EXHAUSTED_PERCENT,requireFresh=false,maxAgeMs=FRESH_MAX_AGE_MS}={}){
  const windows=runtimeWindows(profileEntry,budget);
  if(!windows.length)return {known:false,exhausted:false,until:null,remaining:null,windows:[]};
  const live=windows.filter(win=>!win.resetsAt||win.resetsAt>now);
  if(requireFresh&&(!Number.isFinite(Number(budget?.at))||now-Number(budget.at)>maxAgeMs||Number(budget.at)>now||!live.length))return {known:false,exhausted:false,until:null,remaining:null,windows:[]};
  const full=live.filter(win=>win.usedPercent>=exhaustedPercent);
  const until=full.length?Math.max(...full.map(win=>win.resetsAt??now)):null;
  const remaining=live.length?Math.max(0,Math.min(...live.map(win=>100-win.usedPercent))):100;
  return {known:true,exhausted:full.length>0,until,remaining,windows};
}

/** Choose peers by fresh remaining provider quota. Config order breaks only an exact measured tie. */
export function quotaAwarePeers(ids,runtimes,budget,{now=Date.now()}={}){
  const reviewed=(ids??[]).map((id,index)=>({id,index,verdict:budgetVerdict(runtimes?.runtimes?.[id],budget,{now,requireFresh:true})}));
  const available=reviewed.filter(item=>item.verdict.known&&!item.verdict.exhausted).sort((a,b)=>b.verdict.remaining-a.verdict.remaining||a.index-b.index);
  return {ok:available.length>0,providers:available.map(item=>item.id),reviewed:reviewed.map(item=>({runtime:item.id,known:item.verdict.known,exhausted:item.verdict.exhausted,remaining:item.verdict.remaining,until:item.verdict.until}))};
}
