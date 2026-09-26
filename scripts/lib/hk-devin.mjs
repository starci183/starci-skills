// hk-devin.mjs — Devin CLI data housekeeping (storage slice of the host-housekeeping wave).
//
// %APPDATA%/devin grows without bound: on 2026-09-26 it held 5.7 GB — cli/sessions.db at 3.9 GB
// plus a 570 MB WAL, with summaries and transcripts beside it. This module is the ONLY runtime
// path that touches that tree, and it touches it under one rule: sessions.db is live sqlite state
// belonging to the Devin CLI, so it is measured and reported, NEVER opened, edited, checkpointed
// or moved — hand-editing a sqlite file its owner may reopen corrupts it.
//
// Behaviour:
//  - report the byte size of <devinRoot>/cli/sessions.db and its -wal/-shm siblings, always;
//  - when a devin process runs (any name starting with "devin" from `processes()`), every
//    mutation is skipped and only the size report comes back — the CLI could reopen the db or
//    rewrite a transcript mid-move;
//  - when none runs, files older than allocation.housekeeping.sessionArchiveAfterMs (default
//    3 days) inside the history directories under the devin root (any dir named summaries/,
//    transcripts/ or History/) move to <archiveRoot>/devin/<relative path>, byte-for-byte;
//  - the devin CLI exposes no prune/cleanup command (`devin --help`: auth, mcp, models, doctor,
//    rules, skills, plugins, cloud, desktop, list, rm, ssh, forward, update, version, migrate,
//    sandbox, setup, uninstall, acp) — `rm` deletes one named session and `uninstall` wipes
//    everything, so there is nothing safe to call; sqlite stays untouched;
//  - no move ever crosses a link (isLinkLike on every directory walked and every file moved)
//    and nothing outside the devin root is ever touched.
//
// sweepDevinData({apply, now, env, allocation, processes}) returns:
//   { ok, freedBytes, movedBytes, skipped, errors,
//     report: { sessionsDbBytes, walBytes, shmBytes, devinRunning, devinRoot, archiveRoot,
//               archiveAfterMs, apply, candidateFiles } }
// freedBytes counts bytes that left (a dry run: would leave) the devin root; movedBytes counts
// bytes relocated into the archive (a dry run: planned). `skipped` is [{path, reason}] and
// explains every refusal: the running process, the report-only sqlite files, links, target
// collisions. `errors` is [{path, code, message}]; ok is true only when errors is empty.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {isLinkLike} from './safe-remove.mjs';
import {pathKey} from './path-key.mjs';
import {allocationSettings} from '../../engine/config.mjs';

const DAY_MS=86400000;
/** Defaults for the allocation.housekeeping keys; runtimes.yaml overrides them when it declares them. */
const DEFAULT_ARCHIVE_AFTER_MS=3*DAY_MS;
const DEFAULT_ARCHIVE_ROOT='D:/starci-archive';
/** Directory names under the devin root whose files are session history (transcripts, summaries, local History). */
const HISTORY_DIRS=new Set(['summaries','transcripts','history']);
/** Extensions session history is written in; anything else in those dirs stays. */
const HISTORY_EXT=new Set(['.md','.json','.jsonl','.txt']);
const DEVIN_PROCESS=/^devin/i;

/** The Devin CLI data root: %APPDATA%/devin on Windows, $XDG_CONFIG_HOME/devin (~/.config) elsewhere. */
export const devinRoot=(env=process.env)=>{
  if(env.APPDATA)return path.join(env.APPDATA,'devin');
  return path.join(env.XDG_CONFIG_HOME??path.join(os.homedir(),'.config'),'devin');
};

/** Running process image names: tasklist on Windows, `ps -eo comm` elsewhere. Null when the probe fails. */
const listProcessNames=async()=>{
  if(process.platform==='win32'){
    const r=spawnSync('tasklist',['/fo','csv','/nh'],{encoding:'utf8',windowsHide:true,timeout:15000});
    if(r.error||r.status!==0)return null;
    return String(r.stdout??'').split(/\r?\n/).map(line=>/^"([^"]+)"/.exec(line.trim())?.[1]).filter(Boolean);
  }
  const r=spawnSync('ps',['-eo','comm='],{encoding:'utf8',timeout:15000});
  if(r.error||r.status!==0)return null;
  return String(r.stdout??'').split(/\r?\n/).map(line=>path.basename(line.trim())).filter(Boolean);
};

const sizeOf=file=>{try{return fs.lstatSync(file).size;}catch{return 0;}};

/** Move `src` to `dst` byte-for-byte, across volumes when rename cannot (copy + unlink), keeping mtime. */
const moveFile=(src,dst)=>{
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  try{fs.renameSync(src,dst);return;}catch(error){if(error?.code!=='EXDEV')throw error;}
  fs.copyFileSync(src,dst);
  try{const st=fs.statSync(src);fs.utimesSync(dst,st.atime,st.mtime);}catch{/* mtime is best-effort */}
  fs.unlinkSync(src);
};

/** `p` is inside `root` (never the root itself, never a sibling spelling). */
const inside=(p,rootKey)=>pathKey(p).startsWith(`${rootKey}/`);

/**
 * Files worth archiving under `dir`: regular files with a history extension, at any depth, links skipped.
 * `report` collects skipped entries; `now`/`archiveAfterMs` gate the age.
 */
const collectHistoryFiles=(dir,{rootKey,now,archiveAfterMs,skipped,errors})=>{
  const out=[];
  const walk=(dir,st,parentReal)=>{
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch(error){
      if(error?.code!=='ENOENT')errors.push({path:dir,code:error?.code??'ERROR',message:String(error?.message??error)});
      return;
    }
    const real=(()=>{try{return fs.realpathSync.native(dir);}catch{return parentReal;}})();
    for(const entry of entries){
      const p=path.join(dir,entry.name);
      let st;
      try{st=fs.lstatSync(p);}catch{continue;}
      if(entry.isDirectory()){
        if(isLinkLike(p,{parentReal:real,stat:st})){skipped.push({path:p,reason:'link: never descend or move through it'});continue;}
        walk(p,st,real);
        continue;
      }
      if(isLinkLike(p,{parentReal:real,stat:st})){skipped.push({path:p,reason:'link: never descend or move through it'});continue;}
      if(!st.isFile()){skipped.push({path:p,reason:'not a regular file'});continue;}
      if(!HISTORY_EXT.has(path.extname(entry.name).toLowerCase()))continue;
      if(!(inside(p,rootKey))){skipped.push({path:p,reason:'outside the devin root'});continue;}
      if(now-st.mtimeMs<=archiveAfterMs)continue; // young enough to keep
      out.push({path:p,bytes:st.size,mtimeMs:st.mtimeMs});
    }
  };
  let st;
  try{st=fs.lstatSync(dir);}catch{return out;}
  if(!st.isDirectory()||isLinkLike(dir,{stat:st}))return out;
  walk(dir,st,null);
  return out;
};

/**
 * Sweep the Devin CLI data root. See the header comment for the contract; `processes` is an
 * injectable async () => string[] of running image names so specs never depend on this host.
 */
export async function sweepDevinData({apply=false,now=Date.now(),env=process.env,allocation,processes}={}){
  const hk=(allocation??allocationSettings())?.housekeeping??allocation??{};
  const archiveAfterMs=Number.isFinite(Number(hk.sessionArchiveAfterMs))&&Number(hk.sessionArchiveAfterMs)>0
    ?Number(hk.sessionArchiveAfterMs):DEFAULT_ARCHIVE_AFTER_MS;
  const archiveRoot=typeof hk.archiveRoot==='string'&&hk.archiveRoot.trim()?hk.archiveRoot:DEFAULT_ARCHIVE_ROOT;
  const root=devinRoot(env),rootKey=pathKey(root);
  const archiveDevin=path.join(archiveRoot,'devin'),archiveKey=pathKey(archiveDevin);
  const cliDir=path.join(root,'cli');
  const report={
    sessionsDbBytes:sizeOf(path.join(cliDir,'sessions.db')),
    walBytes:sizeOf(path.join(cliDir,'sessions.db-wal')),
    shmBytes:sizeOf(path.join(cliDir,'sessions.db-shm')),
    devinRunning:false,
    devinRoot:root,archiveRoot:archiveDevin,archiveAfterMs,apply,candidateFiles:0,
  };
  const skipped=[],errors=[];
  if(!fs.existsSync(root))return{ok:true,freedBytes:0,movedBytes:0,skipped,errors,report};
  let names=null;
  try{names=await(processes??listProcessNames)();}catch(error){
    errors.push({path:'processes',code:'PROBE',message:String(error?.message??error)});
  }
  // A probe that cannot answer fails closed: assume devin is up and mutate nothing.
  report.devinRunning=!Array.isArray(names)||names.some(name=>DEVIN_PROCESS.test(String(name)));
  const out={ok:false,freedBytes:0,movedBytes:0,skipped,errors,report};
  for(const sibling of ['sessions.db','sessions.db-wal','sessions.db-shm'])
    skipped.push({path:path.join(cliDir,sibling),reason:'live sqlite state: reported, never opened/edited/checkpointed/moved'});
  if(report.devinRunning){
    skipped.push({path:root,reason:'a devin process is running: every mutation skipped, size report only'});
    out.ok=errors.length===0;
    return out;
  }
  // History directories anywhere under the devin root (cli/summaries, cli/transcripts, summaries,
  // User/History, …); files in them older than the window move to the archive root.
  const plan=[];
  const scan=(dir,parentReal)=>{
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch(error){
      if(error?.code!=='ENOENT')errors.push({path:dir,code:error?.code??'ERROR',message:String(error?.message??error)});
      return;
    }
    const real=(()=>{try{return fs.realpathSync.native(dir);}catch{return parentReal;}})();
    for(const entry of entries){
      const p=path.join(dir,entry.name);
      let st;try{st=fs.lstatSync(p);}catch{continue;}
      if(isLinkLike(p,{parentReal:real,stat:st})){skipped.push({path:p,reason:'link: never descend or move through it'});continue;}
      if(!entry.isDirectory())continue;
      if(HISTORY_DIRS.has(entry.name.toLowerCase()))
        plan.push(...collectHistoryFiles(p,{rootKey,now,archiveAfterMs,skipped,errors}));
      else scan(p,real);
    }
  };
  scan(root,null);
  report.candidateFiles=plan.length;
  for(const file of plan){
    const rel=path.relative(root,file.path);
    let target=path.join(archiveDevin,rel);
    if(!inside(target,archiveKey)){skipped.push({path:file.path,reason:'archive target escaped the archive root'});continue;}
    if(fs.existsSync(target)){
      let n=1,next;
      do{next=`${target}.hk${n}`;n+=1;}while(fs.existsSync(next));
      target=next;
    }
    out.freedBytes+=file.bytes;
    out.movedBytes+=file.bytes;
    if(!apply){skipped.push({path:file.path,reason:`dry run: would archive ${file.bytes} bytes to ${target}`});continue;}
    try{moveFile(file.path,target);}catch(error){
      out.freedBytes-=file.bytes;out.movedBytes-=file.bytes;
      errors.push({path:file.path,code:error?.code??'ERROR',message:String(error?.message??error)});
    }
  }
  out.ok=errors.length===0;
  return out;
}
