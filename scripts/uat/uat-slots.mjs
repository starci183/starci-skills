#!/usr/bin/env node
// The machine-wide UAT slot semaphore. At most config.yaml `uat.maxConcurrent` (default 10) UAT runs —
// a headed browser session, a player, the app they drive — execute at once on this host; every other
// run waits queued for a slot. Everything lives in machine.sqlite: slot <n> is the host lock
// `uat-slot-<n>` (host_locks: the holder pid; its runId and token in `holder`) and its uat_slots row
// `slot-<n>` (acquired_at / released_at, job_id = the runId); a slot whose holder is dead or from an
// earlier boot is stale and reclaimed (the scripts/connectors/lib.mjs claimManager rule). A waiter holds a
// FIFO ticket, the host lock `uat-ticket-<time>-<pid>-<token>`, so a free slot goes to the oldest live waiter.
//
// STARCI_UAT_MAX_CONCURRENT sets the ceiling (specs, one process tree). CLI: `status` prints holders and the
// queue; `run [--record-dir <dir>] -- <command...>` runs one command (e.g. a project Playwright UAT) while
// holding a slot; a Playwright test run records video, trace and screenshots into a fresh directory under
// --record-dir (default <tmp>/starci-uat-recordings), printed first.

import '../lib/hide-child-windows.mjs';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {machineFileFor, readMachine, withMachine} from '../../engine/machine-db.mjs';
import {loadConfig, uatSettings, UAT_DEFAULTS} from '../../engine/config.mjs';
import {recordAlive} from '../connectors/lib.mjs';
// launch.mjs, never assisted-runner.mjs: assisted-runner imports this module, and a dynamic import of it
// under this module's own top-level await (`run`) is a cycle that never settles (inc-f681bbed166f).
import {launchFor} from './launch.mjs';
import {defaultRecordRoot,recordingDirUnder,withRecording} from './playwright-recording.mjs';

export const DEFAULT_POLL_MS=2000;
const SLOT_PREFIX='uat-slot-',TICKET_PREFIX='uat-ticket-';
const SLOT_LOCK=/^uat-slot-(\d+)$/;
// A slot or ticket is held for as long as its process lives; the expiry only feeds v_leaks.
const HOLD_TTL_MS=24*3600_000;

/** The ceiling: STARCI_UAT_MAX_CONCURRENT, else config.yaml uat.maxConcurrent, else 10. A broken config never stops a run. */
export function maxConcurrent({env=process.env,config}={}){
  const override=Number(env.STARCI_UAT_MAX_CONCURRENT);
  if(env.STARCI_UAT_MAX_CONCURRENT!==undefined&&Number.isInteger(override)&&override>=1)return override;
  try{return uatSettings(config===undefined?loadConfig():config).maxConcurrent;}catch{return UAT_DEFAULTS.maxConcurrent;}
}

const holderOf=row=>{try{return JSON.parse(row.holder??'null')??{};}catch{return {};}};
const liveRow=row=>row.state!=='released'&&recordAlive({pid:row.holder_pid,startedAt:row.started_at});
const locksLike=(m,prefix)=>m.db.prepare("SELECT * FROM host_locks WHERE substr(name,1,length(?))=? AND state<>'released' ORDER BY name").all(prefix,prefix);

// The live holders on one handle; with `reclaim`, the stale slots found are released (inside the caller's transaction).
function holdersOn(m,{reclaim}){
  const out=[];
  for(const row of locksLike(m,SLOT_PREFIX)){
    const match=SLOT_LOCK.exec(row.name);if(!match)continue;
    if(liveRow(row)){out.push({slot:Number(match[1]),pid:row.holder_pid,startedAt:new Date(row.started_at).toISOString(),runId:holderOf(row).runId??null});continue;}
    if(reclaim){m.releaseHostLock({name:row.name,pid:row.holder_pid});m.releaseUatSlot(`slot-${match[1]}`);}
  }
  return out.sort((a,b)=>a.slot-b.slot);
}

/** The live slot holders: [{slot, pid, startedAt, runId}]. Stale locks found on the way are reclaimed. */
export const slotHolders=({env=process.env,reclaim=true}={})=>reclaim
  ?withMachine(m=>m.transaction(()=>holdersOn(m,{reclaim:true})),{env})
  :readMachine(m=>holdersOn(m,{reclaim:false}),[],{env});

/** The live queue, oldest first: [{ticket, pid, runId, waitingSince}]. Tickets of dead waiters are dropped. */
export function slotQueue({env=process.env}={}){
  return withMachine(m=>m.transaction(()=>{
    const out=[];
    for(const row of locksLike(m,TICKET_PREFIX)){
      if(!liveRow(row)){m.releaseHostLock({name:row.name,pid:row.holder_pid});continue;}
      out.push({ticket:row.name,pid:row.holder_pid,runId:holderOf(row).runId??null,waitingSince:new Date(row.started_at).toISOString()});
    }
    return out;
  }),{env});
}

/** Claim one free slot index in 1..limit, or null. Never exceeds the live holder count. One transaction. */
function claimFree(env,limit,record){
  return withMachine(m=>m.transaction(()=>{
    if(holdersOn(m,{reclaim:true}).length>=limit)return null;
    for(let slot=1;slot<=limit;slot++){
      const name=`${SLOT_PREFIX}${slot}`,cur=m.hostLock(name);
      if(cur&&liveRow(cur))continue;
      if(cur&&cur.state!=='released')m.releaseHostLock({name,force:true});
      if(!m.acquireHostLock({name,holder:JSON.stringify({runId:record.runId,token:record.token}),ttlMs:HOLD_TTL_MS}).ok)continue;
      m.upsertUatSlot({slotId:`slot-${slot}`,jobId:record.runId,acquiredAt:m.now(),expiresAt:null,releasedAt:null});
      return {slot,name};
    }
    return null;
  }),{env});
}

// One process 'exit' handler frees whatever this process still holds (slots and queue tickets), so a
// crash that unwinds releases its slot; many holders in one process never stack exit listeners.
const onExit=new Set();
let exitHooked=false;
const atExit=fn=>{
  if(!exitHooked){exitHooked=true;process.on('exit',()=>{for(const fn of [...onExit])try{fn();}catch{/* best effort */}});}
  onExit.add(fn);return ()=>onExit.delete(fn);
};

const sleep=(ms,signal)=>new Promise(resolve=>{
  const timer=setTimeout(done,ms);
  function done(){clearTimeout(timer);signal?.removeEventListener?.('abort',done);resolve();}
  signal?.addEventListener?.('abort',done,{once:true});
});

/**
 * Wait for a UAT slot and hold it. Resolves {slot, limit, waited, release}; release() is idempotent
 * and also runs from a process 'exit' handler, so a crash that unwinds still frees the slot (a hard kill
 * leaves a lock whose dead pid the next claimant reclaims). While no slot is free, onQueued({position,
 * limit, holders}) fires once and again whenever the position changes. No timeout of its own: the only
 * way out without a slot is `signal` (AbortSignal), which rejects with code uat-slot-aborted.
 */
export async function acquireUatSlot({runId=null,env=process.env,limit=maxConcurrent({env}),pollMs=DEFAULT_POLL_MS,onQueued=null,signal=null}={}){
  const record={pid:process.pid,runId,token:crypto.randomBytes(8).toString('hex')};
  const ticket=`${TICKET_PREFIX}${String(Date.now()).padStart(15,'0')}-${String(process.pid).padStart(8,'0')}-${record.token}`;
  const holder=JSON.stringify({runId,token:record.token});
  const takeTicket=()=>withMachine(m=>m.acquireHostLock({name:ticket,holder,ttlMs:HOLD_TTL_MS}),{env});
  takeTicket();
  const dropTicket=()=>{try{withMachine(m=>m.releaseHostLock({name:ticket}),{env});}catch{/* gone */}};
  const unhookTicket=atExit(dropTicket);
  let lastPosition=null,waited=false;
  try{
    for(;;){
      if(signal?.aborted)throw Object.assign(new Error('UAT slot wait aborted'),{code:'uat-slot-aborted'});
      const holders=slotHolders({env});
      const tickets=slotQueue({env}).map(entry=>entry.ticket);
      if(!tickets.includes(ticket))takeTicket();
      const position=Math.max(1,tickets.indexOf(ticket)+1||tickets.length+1);
      // FIFO: only the waiters that fit in the free slots may claim.
      const claimed=position<=limit-holders.length?claimFree(env,limit,record):null;
      if(claimed){
        let released=false,unhook=()=>{};
        const release=()=>{
          if(released)return;released=true;unhook();
          try{
            withMachine(m=>m.transaction(()=>{
              const cur=m.hostLock(claimed.name);
              if(cur&&cur.state!=='released'&&cur.holder_pid===process.pid&&holderOf(cur).token===record.token){m.releaseHostLock({name:claimed.name});m.releaseUatSlot(`slot-${claimed.slot}`);}
            }),{env});
          }catch{/* the store is gone */}
        };
        unhook=atExit(release);
        return {slot:claimed.slot,limit,waited,release};
      }
      waited=true;
      if(position!==lastPosition){lastPosition=position;try{await onQueued?.({position,limit,holders:holders.length});}catch{/* reporting never blocks the wait */}}
      await sleep(pollMs,signal);
    }
  }finally{dropTicket();unhookTicket();}
}

/** Holders, queue and ceiling, for `status`. */
export const slotStatus=({env=process.env}={})=>({store:machineFileFor(env),limit:maxConcurrent({env}),holders:slotHolders({env}),queue:slotQueue({env})});

// An op's run records into its own folder (playwright-recording.mjs defaultRecordRoot), which settle indexes as its proof.
async function runHolding(command,{recordDir=defaultRecordRoot()}={}){
  if(!command.length){console.error('use: node scripts/uat/uat-slots.mjs run [--record-dir <dir>] -- <command...>');process.exit(2);}
  const slot=await acquireUatSlot({runId:`run-${process.pid}`,onQueued:({position,limit})=>console.error(`[uat-slots] queued: position ${position}, ${limit} slots busy`)});
  for(const sig of ['SIGINT','SIGTERM','SIGBREAK'])process.on(sig,()=>{slot.release();process.exit(130);});
  const recording=withRecording(command,{cwd:process.cwd(),outputDir:recordingDirUnder(path.resolve(recordDir))});
  if(recording.outputDir)console.error(`[uat-slots] recording video, trace and screenshots into ${recording.outputDir}`);
  const launch=launchFor(recording.command);
  const child=spawn(launch.file,launch.args,{stdio:'inherit',windowsHide:false});
  const code=await new Promise(resolve=>{child.once('exit',code=>resolve(Number.isInteger(code)?code:1));child.once('error',()=>resolve(1));});
  slot.release();process.exit(code);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,...rest]=process.argv.slice(2);
  if(command==='status')process.stdout.write(`${JSON.stringify(slotStatus(),null,2)}\n`);
  else if(command==='run'){
    const record=rest[0]==='--record-dir'?rest[1]:null,args=record?rest.slice(2):rest;
    await runHolding(args[0]==='--'?args.slice(1):args,record?{recordDir:record}:{});
  }
  else{console.error('use: node scripts/uat/uat-slots.mjs <status|run [--record-dir <dir>] -- <command...>>');process.exit(2);}
}
