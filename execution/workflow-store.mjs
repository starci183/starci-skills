import fs from 'node:fs';
import path from 'node:path';
import {readReports as readReportFiles,repositoryRoot} from './reports.mjs';

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
  const nextSeq=()=>{
    if(seq===null)seq=lastSeq(paths.events);
    seq+=1;return seq;
  };
  return {
    schema:WORKFLOW_STATE,id:workflowId,dir,paths,
    /** Append one audit line. The log is never rewritten, so a reader can replay a workflow from seq 0. */
    appendEvent(event){
      need(plain(event),'An event must be an object');
      need(event.seq===undefined,'seq is assigned by the log, never by the caller');
      const line={at:Date.now(),seq:nextSeq(),...event};
      fs.appendFileSync(paths.events,`${JSON.stringify(line)}\n`);
      return line;
    },
    readEvents({since=0}={}){
      return readText(paths.events).split('\n').map(line=>line.trim()).filter(Boolean)
        .map(readLine).filter(event=>event&&Number.isInteger(event.seq)&&event.seq>since);
    },
    /** Atomic: write a sibling tmp file, then rename over state.json, so no reader ever sees a partial state. */
    saveState(state){
      need(plain(state)&&state.schema===WORKFLOW_STATE,`State must carry schema ${WORKFLOW_STATE}`);
      const tmp=`${paths.state}.${process.pid}.tmp`;
      fs.writeFileSync(tmp,`${JSON.stringify(state,null,2)}\n`);
      fs.renameSync(tmp,paths.state);
      return state;
    },
    loadState(){return readJson(paths.state,null);},
    reportPath(dispatchOrKey){return path.join(paths.reports,`${required(dispatchOrKey,'dispatch id')}.json`);},
    readReports(){return readReportFiles(paths.reports).filter(report=>report?.error!==UNREADABLE);},
    contractPath(opId){return path.join(paths.contracts,`${required(opId,'operation id')}.md`);},
    checksPath(opId){return path.join(paths.checks,`${required(opId,'operation id')}.json`);}
  };
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
