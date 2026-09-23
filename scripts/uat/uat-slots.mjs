#!/usr/bin/env node
// The machine-wide UAT slot semaphore. At most config.yaml `uat.maxConcurrent` (default 10) UAT runs —
// a headed browser session, a player, the app they drive — execute at once on this host; every other
// run waits queued for a slot. A slot is a lock file <runtime>/uat-slots/slot-<n>.lock created with
// flag 'wx' and holding {pid, startedAt, runId, token}; a slot whose holder is dead or from an earlier
// boot is stale and reclaimed (the scripts/connectors/lib.mjs claimManager rule). Waiters take a FIFO
// ticket under <runtime>/uat-slots/queue so a free slot goes to the oldest live waiter.
//
// STARCI_UAT_SLOTS_DIR repoints the directory and STARCI_UAT_MAX_CONCURRENT the ceiling (specs, one
// process tree). CLI: `status` prints holders and the queue; `run -- <command...>` runs one command
// (e.g. a project Playwright UAT) while holding a slot.

import '../lib/hide-child-windows.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {machineFileFor} from '../../engine/ledger-db.mjs';
import {loadConfig, uatSettings, UAT_DEFAULTS} from '../../engine/config.mjs';
import {readJson, recordAlive} from '../connectors/lib.mjs';

export const DEFAULT_POLL_MS=2000;
const FRESH_WRITE_MS=5000;
const SLOT=/^slot-(\d+)\.lock$/;

/** <runtime>/uat-slots beside machine.sqlite, or STARCI_UAT_SLOTS_DIR. */
export const slotsDir=(env=process.env)=>env.STARCI_UAT_SLOTS_DIR?path.resolve(env.STARCI_UAT_SLOTS_DIR):path.join(path.dirname(machineFileFor(env)),'uat-slots');
const queueDir=env=>path.join(slotsDir(env),'queue');

/** The ceiling: STARCI_UAT_MAX_CONCURRENT, else config.yaml uat.maxConcurrent, else 10. A broken config never stops a run. */
export function maxConcurrent({env=process.env,config}={}){
  const override=Number(env.STARCI_UAT_MAX_CONCURRENT);
  if(env.STARCI_UAT_MAX_CONCURRENT!==undefined&&Number.isInteger(override)&&override>=1)return override;
  try{return uatSettings(config===undefined?loadConfig():config).maxConcurrent;}catch{return UAT_DEFAULTS.maxConcurrent;}
}

const ageMs=file=>{try{return Date.now()-fs.statSync(file).mtimeMs;}catch{return Infinity;}};
/** A lock or ticket still counts when its holder is live, or when it is unreadable but young (being written). */
const liveEntry=file=>{const held=readJson(file);return held?recordAlive(held):ageMs(file)<FRESH_WRITE_MS;};
const list=dir=>{try{return fs.readdirSync(dir);}catch{return [];}};
const removeAside=file=>{
  // Move a stale entry aside under a unique name first, so two reclaimers cannot both delete a fresh one.
  const aside=`${file}.stale-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  try{fs.renameSync(file,aside);}catch{return false;}
  try{fs.rmSync(aside,{force:true});}catch{/* best effort */}
  return true;
};

/** The live slot holders: [{slot, pid, startedAt, runId}]. Stale locks found on the way are reclaimed. */
export function slotHolders({env=process.env,reclaim=true}={}){
  const dir=slotsDir(env),out=[];
  for(const name of list(dir)){
    const match=SLOT.exec(name);if(!match)continue;
    const file=path.join(dir,name),held=readJson(file);
    if(liveEntry(file)){out.push({slot:Number(match[1]),pid:held?.pid??null,startedAt:held?.startedAt??null,runId:held?.runId??null});continue;}
    if(reclaim)removeAside(file);
  }
  return out.sort((a,b)=>a.slot-b.slot);
}

/** The live queue, oldest first: [{ticket, pid, runId, waitingSince}]. Tickets of dead waiters are dropped. */
export function slotQueue({env=process.env}={}){
  const dir=queueDir(env),out=[];
  for(const name of list(dir).filter(name=>name.endsWith('.ticket')).sort()){
    const file=path.join(dir,name);
    if(!liveEntry(file)){removeAside(file);continue;}
    const held=readJson(file);out.push({ticket:name,pid:held?.pid??null,runId:held?.runId??null,waitingSince:held?.startedAt??null});
  }
  return out;
}

/** Claim one free slot index in 1..limit, or null. Never exceeds the live holder count. */
function claimFree(env,limit,record){
  const dir=slotsDir(env);
  if(slotHolders({env}).length>=limit)return null;
  for(let slot=1;slot<=limit;slot++){
    const file=path.join(dir,`slot-${slot}.lock`);
    for(let attempt=0;attempt<2;attempt++){
      try{fs.writeFileSync(file,JSON.stringify({...record,slot}),{flag:'wx'});return {slot,file};}
      catch(error){
        if(error?.code!=='EEXIST')throw error;
        if(liveEntry(file))break;
        if(!removeAside(file))break;
      }
    }
  }
  return null;
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
 * Wait for a UAT slot and hold it. Resolves {slot, file, limit, waited, release}; release() is idempotent
 * and also runs from a process 'exit' handler, so a crash that unwinds still frees the slot (a hard kill
 * leaves a lock whose dead pid the next claimant reclaims). While no slot is free, onQueued({position,
 * limit, holders}) fires once and again whenever the position changes. No timeout of its own: the only
 * way out without a slot is `signal` (AbortSignal), which rejects with code uat-slot-aborted.
 */
export async function acquireUatSlot({runId=null,env=process.env,limit=maxConcurrent({env}),pollMs=DEFAULT_POLL_MS,onQueued=null,signal=null}={}){
  const queue=queueDir(env);
  fs.mkdirSync(queue,{recursive:true});
  const record={pid:process.pid,startedAt:new Date().toISOString(),runId,token:crypto.randomBytes(8).toString('hex')};
  const ticketName=`${String(Date.now()).padStart(15,'0')}-${String(process.pid).padStart(8,'0')}-${record.token}.ticket`;
  const ticket=path.join(queue,ticketName);
  fs.writeFileSync(ticket,JSON.stringify(record),{flag:'wx'});
  const dropTicket=()=>{try{fs.rmSync(ticket,{force:true});}catch{/* gone */}};
  const unhookTicket=atExit(dropTicket);
  let lastPosition=null,waited=false;
  try{
    for(;;){
      if(signal?.aborted)throw Object.assign(new Error('UAT slot wait aborted'),{code:'uat-slot-aborted'});
      const holders=slotHolders({env});
      const tickets=slotQueue({env}).map(entry=>entry.ticket);
      if(!tickets.includes(ticketName))fs.writeFileSync(ticket,JSON.stringify(record));
      const position=Math.max(1,tickets.indexOf(ticketName)+1||tickets.length+1);
      // FIFO: only the waiters that fit in the free slots may claim.
      const claimed=position<=limit-holders.length?claimFree(env,limit,record):null;
      if(claimed){
        let released=false,unhook=()=>{};
        const release=()=>{
          if(released)return;released=true;unhook();
          try{if(readJson(claimed.file)?.token===record.token)fs.rmSync(claimed.file,{force:true});}catch{/* gone */}
        };
        unhook=atExit(release);
        return {slot:claimed.slot,file:claimed.file,limit,waited,release};
      }
      waited=true;
      if(position!==lastPosition){lastPosition=position;try{await onQueued?.({position,limit,holders:holders.length});}catch{/* reporting never blocks the wait */}}
      await sleep(pollMs,signal);
    }
  }finally{dropTicket();unhookTicket();}
}

/** Holders, queue and ceiling, for `status`. */
export const slotStatus=({env=process.env}={})=>({dir:slotsDir(env),limit:maxConcurrent({env}),holders:slotHolders({env}),queue:slotQueue({env})});

async function runHolding(command){
  if(!command.length){console.error('use: node scripts/uat/uat-slots.mjs run -- <command...>');process.exit(2);}
  const {launchFor}=await import('./assisted-runner.mjs');
  const slot=await acquireUatSlot({runId:`run-${process.pid}`,onQueued:({position,limit})=>console.error(`[uat-slots] queued: position ${position}, ${limit} slots busy`)});
  for(const sig of ['SIGINT','SIGTERM','SIGBREAK'])process.on(sig,()=>{slot.release();process.exit(130);});
  const launch=launchFor(command);
  const child=spawn(launch.file,launch.args,{stdio:'inherit',windowsHide:false});
  const code=await new Promise(resolve=>{child.once('exit',code=>resolve(Number.isInteger(code)?code:1));child.once('error',()=>resolve(1));});
  slot.release();process.exit(code);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,...rest]=process.argv.slice(2);
  if(command==='status')process.stdout.write(`${JSON.stringify(slotStatus(),null,2)}\n`);
  else if(command==='run')await runHolding(rest[0]==='--'?rest.slice(1):rest);
  else{console.error('use: node scripts/uat/uat-slots.mjs <status|run -- <command...>>');process.exit(2);}
}
