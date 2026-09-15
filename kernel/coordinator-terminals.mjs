import fs from 'node:fs';
import path from 'node:path';

/**
 * The coordinator terminals a workflow's kernels were started in, kept beside the store. Orca re-titles a tab to
 * its process once the kernel command exits, so a dead kernel's tab reads `powershell.exe`, never `[Kernel] <id>`:
 * a title sweep cannot find it. The record can. A supervisor that starts a kernel - there is none alive - closes
 * every recorded terminal first; a running kernel's sweep closes every recorded terminal but its own.
 */
const fileFor=dir=>path.join(dir,'coordinator-terminals.json');
const unique=handles=>[...new Set(handles.filter(handle=>typeof handle==='string'&&handle))];

function readRecord(dir){
  try{const parsed=JSON.parse(fs.readFileSync(fileFor(dir),'utf8'));return {terminals:unique(Array.isArray(parsed?.terminals)?parsed.terminals:[]),closed:unique(Array.isArray(parsed?.closed)?parsed.closed:[])};}catch{return {terminals:[],closed:[]};}
}
export function readCoordinatorTerminals(dir){return readRecord(dir).terminals;}
/** Terminals a close was answered for: never re-seeded from the log, watched only while Orca still lists them. */
export function readClosedCoordinatorTerminals(dir){return readRecord(dir).closed;}

function write(dir,terminals,closed=readRecord(dir).closed){
  try{fs.writeFileSync(fileFor(dir),JSON.stringify({schema:'starci/coordinator-terminals@1',terminals:unique(terminals),closed:unique(closed)}));return true;}catch{return false;}
}

/** Remember a terminal a kernel command was sent into. */
export function recordCoordinatorTerminal(dir,handle){
  if(typeof handle!=='string'||!handle)return false;
  return write(dir,[...readCoordinatorTerminals(dir),handle]);
}

/** Forget terminals that are closed (or gone), keeping the rest. */
export function dropCoordinatorTerminals(dir,handles){
  const gone=new Set(unique(handles));
  if(!gone.size)return true;
  return write(dir,readCoordinatorTerminals(dir).filter(handle=>!gone.has(handle)));
}

/**
 * Close every recorded coordinator terminal except `keep` through `close(handle)` (true when closed). A terminal
 * Orca no longer knows is closed as far as the record is concerned; one whose close fails for another reason stays
 * recorded for the next pass. Returns what was closed and what remains.
 */
export function closeStaleCoordinatorTerminals(dir,{keep=null,close,known=null}={}){
  const closed=[],kept=[],record=readRecord(dir),answered=[...record.closed];
  for(const handle of record.terminals){
    if(handle===keep){kept.push(handle);continue;}
    if(Array.isArray(known)&&!known.includes(handle)){closed.push({terminal:handle,reason:'coordinator terminal already gone'});continue;}
    if(close(handle)){closed.push({terminal:handle,reason:'coordinator terminal of a kernel that is not running'});answered.push(handle);}
    else kept.push(handle);
  }
  write(dir,kept,Array.isArray(known)?answered.filter(handle=>known.includes(handle)):answered);
  return {closed,kept};
}

/** Forget answered closes whose tabs Orca no longer lists. */
export function pruneClosedCoordinatorTerminals(dir,listed){
  const record=readRecord(dir);
  return write(dir,record.terminals,record.closed.filter(handle=>listed.includes(handle)));
}

/**
 * Every coordinator terminal the supervisor log beside the store says was opened for this workflow, added to the
 * record: tabs opened before the record existed are closed like the rest. Returns how many were new.
 */
export function seedCoordinatorTerminalsFromLog(dir,workflowId){
  let lines;try{lines=fs.readFileSync(path.join(path.dirname(dir),'supervisor.log'),'utf8').split(String.fromCharCode(10));}catch{return 0;}
  const record=readRecord(dir),known=new Set([...record.terminals,...record.closed]);let added=0;
  for(const line of lines){
    if(!line.includes('"kernel-started-in-coordinator"'))continue;
    let event;try{event=JSON.parse(line);}catch{continue;}
    if(event.event==='kernel-started-in-coordinator'&&event.id===workflowId&&typeof event.terminal==='string'&&!known.has(event.terminal)&&recordCoordinatorTerminal(dir,event.terminal)){known.add(event.terminal);added+=1;}
  }
  return added;
}
