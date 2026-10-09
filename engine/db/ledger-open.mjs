import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installRefResolver } from './ref-value.mjs';

// engine/db/ledger-open.mjs — how a ledger file is opened: bounded retry on a transient CANTOPEN, a reference-resolving handle.
const require=createRequire(import.meta.url);
const need=(ok,message,code)=>{if(!ok)throw Object.assign(new Error(message),code?{code}:{});};
export const applyPragmas=(db,pragmas)=>db.exec(Object.entries(pragmas).map(([k,v])=>`PRAGMA ${k}=${v};`).join(' '));
const openSleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
// SQLITE_CANTOPEN is transient on Windows while a concurrent process closes the WAL files: a short bounded retry.
const OPEN_RETRY_DELAYS_MS=[0,300,900];
const cantOpen=error=>/unable to open/i.test(String(error?.message??''));
export function openDb({file,busyTimeoutMs,journalMode='WAL',autoVacuum=false,label,pragmas}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&file.trim(),`${label} needs a file`);
  fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  let lastError;
  for(const delay of OPEN_RETRY_DELAYS_MS){
    if(delay)openSleep(delay);
    let db;
    try{
      db=installRefResolver(new DatabaseSync(file,{timeout:busyTimeoutMs}));
      // page_size/auto_vacuum only take on an empty database, before WAL and before the first table.
      if(autoVacuum&&Number(db.prepare('PRAGMA page_count').get().page_count)===0)db.exec('PRAGMA page_size=4096; PRAGMA auto_vacuum=INCREMENTAL;');
      const sqliteVersion=db.prepare('select sqlite_version() AS version').get().version;
      const actual=String(db.prepare(`PRAGMA journal_mode=${journalMode}`).get().journal_mode).toUpperCase();
      need(actual===String(journalMode).toUpperCase(),`${label}: SQLite selected journal mode ${actual}, expected ${journalMode} (a network or UNC path cannot hold WAL)`,'STARCI_LEDGER_NOT_WAL');
      applyPragmas(db,pragmas);
      return {db,sqliteVersion,journalMode:actual};
    }catch(error){
      try{db?.close();}catch{}
      if(!cantOpen(error))throw error;
      lastError=error;
    }
  }
  throw lastError;
}
