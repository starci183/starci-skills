import fs from 'node:fs';
import path from 'node:path';
import {readReports as readReportFiles,repositoryRoot} from './reports.mjs';
import crypto from 'node:crypto';
import {createProgressReporter} from './progress.mjs';
import {compactSnapshots} from './journal.mjs';

/**
 * Runtime state of a 5.0 workflow. One workflow owns exactly one directory under
 * `<repo>/.starciwork/_local/workflows/<workflowId>/`, and that directory is the whole runtime state of
 * the product: no other `_local` subtree exists. `events.jsonl` is the audit trail (append only, never
 * rewritten); `state.json` is a derived snapshot written atomically so a crash never leaves a half file.
 */
export const WORKFLOW_STATE='starci/workflow-state@1';
const UNREADABLE='unreadable report file';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const stamp=ms=>{const iso=new Date(ms).toISOString();return [iso.slice(0,10).replaceAll('-',''),iso.slice(11,19).replaceAll(':','')];};

export {repositoryRoot};
export function workflowsRoot(repoRoot){return path.join(required(repoRoot,'repository root'),'.starciwork','_local','workflows');}

/** `yyyymmdd-hhmmss-slug`: sortable by time, readable by a human, safe as a directory name on Windows. */
export function slugify(title){
  const slug=String(title??'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'');
  return slug||'workflow';
}
export function newWorkflowId(title,now=Date.now){
  const [day,time]=stamp(typeof now==='function'?now():now);
  return `${day}-${time}-${slugify(title)}`;
}

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
/** The highest seq already on disk: a torn or hand-edited last line must never reset the counter. */
function lastSeq(file){
  const lines=readText(file).split('\n').map(line=>line.trim()).filter(Boolean);
  for(let index=lines.length-1;index>=0;index-=1){const event=readLine(lines[index]);if(Number.isInteger(event?.seq))return event.seq;}
  return 0;
}
function readText(file){try{return fs.readFileSync(file,'utf8');}catch{return '';}}
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value??null)).digest('hex');
const renameWait=new Int32Array(new SharedArrayBuffer(4));
/** Windows readers can briefly deny replacement; retain atomic rename and bound the retry to 775 ms. */
export function replaceStateSnapshot(tmp,file,{rename=fs.renameSync,wait=ms=>Atomics.wait(renameWait,0,0,ms),platform=process.platform}={}){
  const delays=[25,50,100,200,400];
  for(let attempt=0;;attempt++){
    try{return rename(tmp,file);}
    catch(error){
      if(platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error?.code)||attempt>=delays.length)throw error;
      wait(delays[attempt]);
    }
  }
}
export const stateGoalIdentity=state=>String(state?.goalDigest??state?.approval?.goalDigest??state?.approvalDigest??state?.goal?.digest??digest({job:state?.job??null,inputs:state?.inputs??state?.goal?.inputs??null,scope:state?.scope??state?.goal?.scope??null,definitionOfDone:state?.definitionOfDone??state?.goal?.definitionOfDone??null,ledgerMode:state?.ledgerMode??state?.goal?.ledgerMode??null}));
function assertNoRawSecrets(value,path=[]){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){const at=[...path,key];if(/^(plaintext|rawSecret|secretValue|credentialValue|passwordValue)$/i.test(key)&&item!==null&&item!==undefined&&item!=='')throw Error(`Workflow state contains raw secret field ${at.join('.')}`);assertNoRawSecrets(item,at);}}

/** Open (creating if needed) the single directory that holds a workflow's runtime state. */
export function createStore({repoRoot,id}){
  const workflowId=required(id,'workflow id');
  need(!/[\\/]/.test(workflowId),`Workflow id must be one directory segment: ${workflowId}`);
  const dir=path.join(workflowsRoot(repoRoot),workflowId);
  const paths={
    state:path.join(dir,'state.json'),events:path.join(dir,'events.jsonl'),
    goal:path.join(dir,'goal.md'),goalJson:path.join(dir,'goal.json'),
    reports:path.join(dir,'reports'),contracts:path.join(dir,'contracts'),checks:path.join(dir,'checks'),inbox:path.join(dir,'inbox'),
    final:path.join(dir,'final-report.json'),launch:path.join(dir,'launch.json')
  };
  for(const directory of [dir,paths.reports,paths.contracts,paths.checks,paths.inbox])fs.mkdirSync(directory,{recursive:true});
  let seq=null;
  let durable=null;
  const reportProgress=createProgressReporter();
  const nextSeq=()=>{
    if(seq===null)seq=lastSeq(paths.events);
    seq+=1;return seq;
  };
  const project=state=>{const tmp=`${paths.state}.${process.pid}.tmp`;fs.writeFileSync(tmp,`${JSON.stringify(state,null,2)}\n`);replaceStateSnapshot(tmp,paths.state);return state;};
  const api={
    schema:WORKFLOW_STATE,id:workflowId,dir,paths,
    /** Append one audit line. The log is never rewritten, so a reader can replay a workflow from seq 0. */
    appendEvent(event){
      need(plain(event),'An event must be an object');
      need(event.seq===undefined,'seq is assigned by the log, never by the caller');
      const line={at:Date.now(),seq:nextSeq(),...event};
      fs.appendFileSync(paths.events,`${JSON.stringify(line)}\n`);
      reportProgress(line);
      return line;
    },
    readEvents({since=0}={}){
      return readText(paths.events).split('\n').map(line=>line.trim()).filter(Boolean)
        .map(readLine).filter(event=>event&&Number.isInteger(event.seq)&&event.seq>since);
    },
    /** Atomic: write a sibling tmp file, then rename over state.json, so no reader ever sees a partial state. */
    saveState(state){
      need(plain(state)&&state.schema===WORKFLOW_STATE,`State must carry schema ${WORKFLOW_STATE}`);
      if(!durable)return project(state);
      assertNoRawSecrets(state);const goal=stateGoalIdentity(state);need(goal===durable.goalIdentity,'Workflow goal identity changed across the durable binding');
      const checkpoint=`save:${workflowId}:${durable.generation}:${digest(state)}`;
      durable.journal.transaction(db=>{db.prepare('INSERT OR IGNORE INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)').run(checkpoint,workflowId,durable.generation,goal,JSON.stringify(state),Date.now());compactSnapshots(db,{workflowId,generation:durable.generation,goalIdentity:goal});});
      return project(state);
    },
    loadState(){if(!durable)return readJson(paths.state,null);const row=durable.journal.db.prepare('SELECT state_json FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId,durable.generation,durable.goalIdentity);return row?JSON.parse(row.state_json):null;},
    bindJournal(journal,generation,{goalIdentity=null,state=null}={}){need(journal?.transaction,'bindJournal needs an operational journal');need(Number.isInteger(generation)&&generation>0,'bindJournal needs a positive generation');const seed=state??readJson(paths.state,null);durable={journal,generation,goalIdentity:goalIdentity??stateGoalIdentity(seed)};const any=journal.db.prepare('SELECT goal_identity FROM state_snapshots WHERE workflow_id=? AND generation=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId,generation);need(!any||any.goal_identity===durable.goalIdentity,'Durable workflow snapshot belongs to a different approved goal');const found=journal.db.prepare('SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? LIMIT 1').get(workflowId,generation,durable.goalIdentity);if(!found&&plain(seed)){assertNoRawSecrets(seed);journal.transaction(db=>db.prepare('INSERT OR IGNORE INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)').run(`bind:${workflowId}:${generation}:${digest(seed)}`,workflowId,generation,durable.goalIdentity,JSON.stringify(seed),Date.now()));}
      // The generations this binding retires keep one body each; the bound one keeps its latest few.
      journal.transaction(db=>compactSnapshots(db,{workflowId,generation,goalIdentity:durable.goalIdentity}));return api;},
    transition(state,{transitionId,event,apply,projectState=true}={}){need(durable,'transition needs a bound journal');need(typeof transitionId==='string'&&transitionId,'transition needs a stable id');need(typeof apply==='function','transition needs an apply function');const checkpoint=`transition:${workflowId}:${durable.generation}:${transitionId}`;const existing=durable.journal.db.prepare('SELECT 1 FROM state_snapshots WHERE checkpoint_id=?').get(checkpoint);if(existing){const latest=durable.journal.db.prepare('SELECT state_json FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId,durable.generation,durable.goalIdentity);return JSON.parse(latest.state_json);}const next=structuredClone(state);apply(next);assertNoRawSecrets(next);need(stateGoalIdentity(next)===durable.goalIdentity,'Transition changed the workflow goal identity');durable.journal.transaction(db=>{db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)').run(checkpoint,workflowId,durable.generation,durable.goalIdentity,JSON.stringify(next),Date.now());if(event)db.prepare('INSERT OR IGNORE INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)').run(`transition:${transitionId}`,workflowId,'workflow',workflowId,durable.generation,event.kind??'state-transition',JSON.stringify(event.payload??event),Date.now());compactSnapshots(db,{workflowId,generation:durable.generation,goalIdentity:durable.goalIdentity});});if(projectState)project(next);return next;},
    reportPath(dispatchOrKey){return path.join(paths.reports,`${required(dispatchOrKey,'dispatch id')}.json`);},
    readReports(){return readReportFiles(paths.reports).filter(report=>report?.error!==UNREADABLE);},
    contractPath(opId){return path.join(paths.contracts,`${required(opId,'operation id')}.md`);},
    checksPath(opId){return path.join(paths.checks,`${required(opId,'operation id')}.json`);}
  };return api;
}
function readLine(line){try{return JSON.parse(line);}catch{return null;}}

/** Every workflow of a repository, newest first: the id carries the timestamp, so the order is the name order. */
export function listWorkflows(repoRoot){
  const root=workflowsRoot(repoRoot);
  if(!fs.existsSync(root))return [];
  return fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>{
    const dir=path.join(root,entry.name);
    const state=readJson(path.join(dir,'state.json'),null);
    const stats=[path.join(dir,'events.jsonl'),path.join(dir,'state.json'),dir].map(file=>{try{return fs.statSync(file).mtimeMs;}catch{return 0;}});
    return {id:entry.name,dir,state,updatedAt:Math.max(...stats)};
  }).sort((a,b)=>b.id.localeCompare(a.id));
}
