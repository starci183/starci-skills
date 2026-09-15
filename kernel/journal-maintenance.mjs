import fs from 'node:fs';
import path from 'node:path';
import {inspectJournal,openJournal} from './journal.mjs';
import {listWorkflows} from './store.mjs';

/**
 * Operator maintenance of a local admission journal: what a kernel never does for another workflow. A kernel
 * retires only its own rows; these commands take the store roots an operator names, read every workflow state
 * under them, and act on the journal only where those states prove the rows are history.
 */
export const JOURNAL_PRUNE='starci/journal-prune@1';
export const JOURNAL_RETIRE='starci/journal-retire@1';
/** A journal written to this recently may still be held by a kernel whose store the operator did not name: it is not retired. */
export const JOURNAL_QUIET_MS=30*60*1000;
const samePath=(a,b)=>{if(!a||!b)return false;const left=path.resolve(a),right=path.resolve(b);return process.platform==='win32'?left.toLowerCase()===right.toLowerCase():left===right;};
const need=(ok,message)=>{if(!ok)throw Error(message);};
const list=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
const sizeOf=file=>{try{return fs.statSync(file).size;}catch{return null;}};

/** Every workflow state under the given store roots, by id, with whether it references the journal file. */
export function statesUnderRoots(roots,journalFile){
  const found=new Map();
  for(const root of roots){
    let entries=[];try{entries=listWorkflows(root);}catch{entries=[];}
    for(const entry of entries){
      if(!entry.state||found.has(entry.id))continue;
      found.set(entry.id,{id:entry.id,dir:entry.dir,finished:Boolean(entry.state.finished),approved:Boolean(entry.state.approved),
        journalFile:entry.state.engine?.journalFile??null,references:samePath(entry.state.engine?.journalFile,journalFile)});
    }
  }
  return found;
}

/**
 * `journal-prune`: retire the rows of every workflow the operator's store roots prove settled - finished, moved
 * to another journal, or named with --retire - and give the space back. A workflow the roots do not know is
 * reported and left alone; a workflow with live rows is refused by the journal itself.
 */
export function pruneJournal({journalFile,storeRoots=[],retire=[],vacuum=false,dryRun=false}){
  need(typeof journalFile==='string'&&fs.existsSync(journalFile),'journal-prune needs an existing --journal-file');
  const roots=storeRoots.map(root=>path.resolve(root));
  const states=statesUnderRoots(roots,journalFile),named=new Set(retire);
  const before=sizeOf(journalFile);
  // A dry run reads and nothing else; a live run opens the journal as a kernel would, compacting on the way in.
  const journal=dryRun?inspectJournal({file:journalFile}):openJournal({file:journalFile});
  const decisions=[];
  try{
    for(const entry of journal.workflows()){
      const state=states.get(entry.workflowId)??null;
      const live=entry.leases.length||entry.jobs.length;
      let decision,reason;
      if(live){decision='kept';reason=`live rows: ${entry.leases.length} lease(s), ${entry.jobs.length} unsettled job(s)`;}
      else if(named.has(entry.workflowId)){decision='retire';reason='named by --retire';}
      else if(!state){decision='unknown';reason='no state under the given store roots';}
      else if(state.finished){decision='retire';reason='its state is finished';}
      else if(!state.references){decision='retire';reason=`its state binds another journal: ${state.journalFile??'none'}`;}
      else {decision='kept';reason='its state is unfinished and binds this journal';}
      let removed=null;
      if(decision==='retire'&&!dryRun){const result=journal.retireWorkflow(entry.workflowId);if(result.ok)removed=result.removed;else {decision='kept';reason=result.reason;}}
      decisions.push({workflowId:entry.workflowId,decision,reason,rows:entry.rows,...(removed?{removed}:{})});
    }
    if(vacuum&&!dryRun)journal.db.exec('VACUUM');
  }finally{journal.close();}
  return {schema:JOURNAL_PRUNE,ok:true,journalFile:path.resolve(journalFile),storeRoots:roots,dryRun,vacuum,bytesBefore:before,bytesAfter:sizeOf(journalFile),decisions};
}

/**
 * `journal-retire`: a whole journal file nothing binds any more. Deleted only with --delete true, and only when
 * no state under the store roots names it and nothing wrote to it within the quiet window. Rows still live inside
 * it belong to workflows no state names - nothing can settle them - and are reported as what dies with the file.
 */
export function retireJournal({journalFile,storeRoots=[],remove=false,now=Date.now,quietMs=JOURNAL_QUIET_MS}){
  need(typeof journalFile==='string'&&fs.existsSync(journalFile),'journal-retire needs an existing --journal-file');
  need(storeRoots.length,'journal-retire needs --store-root <root[,root]>: the stores whose states could bind the journal');
  const roots=storeRoots.map(root=>path.resolve(root));
  const referencing=[...statesUnderRoots(roots,journalFile).values()].filter(state=>state.references).map(state=>({id:state.id,dir:state.dir,finished:state.finished}));
  const journal=inspectJournal({file:journalFile});
  let live;try{live=journal.workflows().filter(entry=>entry.leases.length||entry.jobs.length).map(entry=>({workflowId:entry.workflowId,leases:entry.leases.length,jobs:entry.jobs.length}));}finally{journal.close();}
  const quietFor=now()-fs.statSync(journalFile).mtimeMs,recentlyWritten=quietFor<quietMs;
  const retirable=!referencing.length&&!recentlyWritten;
  const siblings=['','-journal','-wal','-shm'].map(suffix=>`${journalFile}${suffix}`).filter(file=>fs.existsSync(file));
  let deleted=[];
  if(retirable&&remove){for(const file of siblings){fs.rmSync(file,{force:true});deleted.push(file);}}
  return {schema:JOURNAL_RETIRE,ok:retirable,journalFile:path.resolve(journalFile),storeRoots:roots,bytes:sizeOf(journalFile),referencing,orphanedLiveRows:live,quietForMs:Math.round(quietFor),quietMs,retirable,deleted,
    ...(retirable?{}:{reason:referencing.length?'a workflow state still names this journal':`the journal was written ${Math.round(quietFor/60000)} min ago, inside the ${Math.round(quietMs/60000)} min quiet window`}),
    ...(retirable&&!remove?{next:'run again with --delete true to remove the file'}:{})};
}

export function journalMaintenanceMain(command,options={}){
  const journalFile=options['journal-file']?path.resolve(options['journal-file']):null;
  const storeRoots=list(options['store-root']);
  if(command==='journal-prune')return pruneJournal({journalFile,storeRoots,retire:list(options.retire),vacuum:options.vacuum==='true',dryRun:options['dry-run']===true});
  if(command==='journal-retire')return retireJournal({journalFile,storeRoots,remove:options.delete==='true'});
  throw Error(`Unsupported journal maintenance command: ${command}`);
}
