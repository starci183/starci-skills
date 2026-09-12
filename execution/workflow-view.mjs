import fs from 'node:fs';
import path from 'node:path';
import {listWorkflows,workflowsRoot} from './workflow-store.mjs';

/**
 * One truthful status view of a workflow. This is what replaces "go and watch the agents": every number
 * below is derived from the workflow's own files - `state.json`, `events.jsonl`, `kernel.lock`, `stop.flag`,
 * `validator/verdicts.jsonl` and the repository's `supervisor.log`. The view never calls Orca, never asks a
 * model and never writes: it opens no store (the store constructor creates directories), so reading a
 * workflow can never change one, and a file that does not exist yields an empty or null field instead of an
 * error - a tree whose kernel has no validator or no lanes still renders a complete page.
 */
export const WORKFLOW_VIEW='starci/workflow-view@1';
export const WORKFLOW_LIST='starci/workflow-list@1';
/** The rate window. A workflow younger than this is measured over its own life, so a 10 minute old run does not read as idle. */
export const RATE_WINDOW_MS=3*60*60*1000;
/** The supervisor has no pid to probe; a round inside this window is the only honest evidence it is polling. */
export const SUPERVISOR_FRESH_MS=5*60*1000;
const RECENT_EVENTS=15;
const MINUTE_MS=60000;
/** Op statuses that still owe the workflow something; `paused` is live too (it waits for a shared change). */
const LIVE_OPS=['pending','ready','running','answering','paused'];
/** Ledger statuses that are finished work: `preexisting` was approved by the user, never verified by a kernel. */
const DONE_LEDGER=['verified','preexisting'];
/** Event fields worth one line of a terminal; everything else of an event stays in `events.jsonl`. */
const LINE_FIELDS=['op','node','runtime','kind','outcome','result','reason','refusal','component','liveness',
  'iteration','rounds','step','option','signature','restarts','attempt','budget','files','orphans'];

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const readJson=(file,fallback=null)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const readLines=file=>{try{return fs.readFileSync(file,'utf8').split('\n').map(line=>line.trim()).filter(Boolean);}catch{return [];}};
const readJsonLines=file=>readLines(file).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(plain);
const minutes=ms=>Number.isFinite(ms)?Math.round(ms/MINUTE_MS):null;
const at=entry=>Number.isFinite(entry?.at)?entry.at:null;
const count=(list,key)=>list.reduce((totals,item)=>{const bucket=key(item);if(bucket!==null&&bucket!==undefined)totals[bucket]=(totals[bucket]??0)+1;return totals;},{});
const unique=list=>[...new Set(list)];
const per=(total,windowMs)=>windowMs>0?Math.round((total/(windowMs/3600000))*100)/100:null;
const last=(list,predicate)=>{for(let index=list.length-1;index>=0;index-=1)if(predicate(list[index]))return list[index];return null;};

/** A pid that exists but belongs to another user answers EPERM: the process is alive, we simply may not signal it. */
function processAlive(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}
}

export function workflowDir(repoRoot,id){return path.join(workflowsRoot(repoRoot),required(id,'workflow id'));}

/** The feature a ledger item belongs to: a Work node id is `<product>.<feature>.…`, so the first two segments name it. */
export function featureOf(item){
  const id=String(item?.nodeId??item?.id??'');
  const segments=id.split('.').filter(Boolean);
  if(segments.length>=2)return `${segments[0]}.${segments[1]}`;
  return item?.module??(segments[0]||'(no feature)');
}

/** The last supervision round, from `_local/workflows/supervisor.log`, plus what that round decided for this workflow. */
function readSupervisor(repoRoot,id,now){
  const rounds=readJsonLines(path.join(workflowsRoot(repoRoot),'supervisor.log')).filter(entry=>entry.event==='supervisor-round');
  const lastRound=rounds.at(-1)??null;
  const lastRoundAt=at(lastRound);
  const mine=last(rounds,entry=>Array.isArray(entry.rounds)&&entry.rounds.some(item=>String(item).startsWith(`${id}:`)));
  const action=mine?String(mine.rounds.find(item=>String(item).startsWith(`${id}:`))).split(':').slice(1).join(':'):null;
  const silentMs=lastRoundAt===null?null:now-lastRoundAt;
  return {lastRoundAt,silentMs,alive:lastRoundAt===null?null:silentMs<SUPERVISOR_FRESH_MS,rounds:rounds.length,lastAction:action};
}

/**
 * The verdicts of the Work validator, when the kernel keeps them. The file is the source of truth; without
 * it the events carry the same story, and without either the section is honestly empty rather than absent.
 */
function readValidator(dir,events){
  const lines=readJsonLines(path.join(dir,'validator','verdicts.jsonl'));
  const verdict=entry=>String(entry.outcome??entry.verdict??entry.status??'').toLowerCase();
  if(lines.length){
    const accepted=lines.filter(entry=>/accept|ok|valid|pass/.test(verdict(entry))).length;
    const rejected=lines.filter(entry=>/reject|invalid|fail/.test(verdict(entry))).length;
    const unavailable=lines.filter(entry=>/unavailable|skip|error/.test(verdict(entry))).length;
    const latest=lines.at(-1);
    return {source:'verdicts',accepted,rejected,unavailable,
      lastSummary:String(latest.summary??latest.reason??latest.detail??verdict(latest)??'').slice(0,300)||null,lastAt:at(latest)};
  }
  // Only a verdict counts here. `validator-only-block` is a kernel policy event about one operation, not a verdict on the tree.
  const verdicts=['validated','validator-rejected','validator-unavailable'];
  const byEvent=count(events,event=>verdicts.includes(event.event)?event.event:null);
  const latest=last(events,event=>verdicts.includes(event.event));
  return {source:latest?'events':null,accepted:byEvent.validated??0,rejected:byEvent['validator-rejected']??0,
    unavailable:byEvent['validator-unavailable']??0,
    lastSummary:latest?String(latest.summary??latest.note??latest.reason??latest.event).slice(0,300):null,lastAt:at(latest)};
}

/** Lanes are the kernel's optional grouping of nodes; both shapes it may take are read, neither is required. */
function readLanes(state,statusOf){
  const lanes=state?.lanes;
  if(!lanes)return null;
  const entries=Array.isArray(lanes)
    ?lanes.map(lane=>[String(lane?.id??lane?.lane??lane?.name??''),lane?.nodes??lane?.ops??lane?.ledgerIds??[]])
    :Object.entries(lanes).map(([name,lane])=>[name,Array.isArray(lane)?lane:lane?.nodes??lane?.ops??lane?.ledgerIds??[]]);
  return entries.filter(([name])=>name).map(([name,nodes])=>{
    const ids=Array.isArray(nodes)?nodes.map(String):[];
    return {lane:name,done:ids.filter(id=>DONE_LEDGER.includes(statusOf(id))).length,total:ids.length};
  });
}

/**
 * The one view. `now` is injected so a status line is reproducible in a test and so two sections of one
 * render can never disagree about the time.
 */
export function buildView({repoRoot,id,now=Date.now(),dir:given=null}){
  const stamp=typeof now==='function'?now():now;
  const dir=given?path.resolve(given):workflowDir(repoRoot,id);
  const state=readJson(path.join(dir,'state.json'));
  need(plain(state),`No workflow state in ${dir.replaceAll('\\','/')}`);
  const events=readJsonLines(path.join(dir,'events.jsonl'));
  const ops=Array.isArray(state.ops)?state.ops:[];
  const ledger=Array.isArray(state.ledger)?state.ledger:[];
  const lock=readJson(path.join(dir,'kernel.lock'));
  const lastEvent=last(events,event=>at(event)!==null);
  const lastEventAt=at(lastEvent);

  const opStatus=count(ops,op=>op.status??'unknown');
  const liveness=op=>{
    const entry=last(events,event=>event.op===op.id
      ||(Array.isArray(event.liveness)&&op.dispatch&&event.liveness.some(item=>String(item).startsWith(`${op.dispatch}:`))));
    if(!entry)return null;
    const word=Array.isArray(entry.liveness)
      ?String(entry.liveness.find(item=>String(item).startsWith(`${op.dispatch}:`))??'').split(':').slice(1).join(':')||null
      :typeof entry.liveness==='string'?entry.liveness:entry.event??null;
    return {at:at(entry),ageMin:minutes(stamp-at(entry)),liveness:word};
  };
  const launchedAt=op=>at(last(events,event=>event.event==='launched'&&event.op===op.id));
  const running=ops.filter(op=>op.status==='running').map(op=>({id:op.id,kind:op.kind??null,runtime:op.runtime??null,
    ageMin:launchedAt(op)===null?null:minutes(stamp-launchedAt(op)),restarts:op.restarts??0,lastPing:liveness(op)}))
    .sort((a,b)=>(b.ageMin??-1)-(a.ageMin??-1));
  const blocked=ops.filter(op=>op.status==='blocked').map(op=>({id:op.id,refusal:op.refusal??op.waitingFor??null}));

  const statusOf=nodeId=>ledger.find(item=>item.id===nodeId||item.nodeId===nodeId)?.status??null;
  const ledgerStatus=count(ledger,item=>item.status??'unknown');
  const liveLedgerIds=new Set(ops.filter(op=>LIVE_OPS.includes(op.status)).flatMap(op=>[...(op.ledgerIds??[]),op.nodeId].filter(Boolean)));
  const features=new Map();
  for(const item of ledger){
    const key=featureOf(item);
    const bucket=features.get(key)??{feature:key,done:0,total:0};
    bucket.total+=1;
    if(DONE_LEDGER.includes(item.status))bucket.done+=1;
    features.set(key,bucket);
  }

  const firstAt=at(events.find(event=>at(event)!==null));
  const windowMs=Math.max(Math.min(RATE_WINDOW_MS,firstAt===null?RATE_WINDOW_MS:stamp-firstAt),MINUTE_MS);
  const inWindow=events.filter(event=>at(event)!==null&&at(event)>=stamp-windowMs);
  const opsDone=inWindow.filter(event=>event.event==='op-done');
  const nodesDone=unique(opsDone.map(event=>event.node).filter(Boolean));

  const runtimeIds=unique([...Object.keys(plain(state.quota?.slots)?state.quota.slots:{}),
    ...Object.keys(plain(state.allocation?.loads)?state.allocation.loads:{}),
    ...Object.keys(plain(state.allocation?.cooling)?state.allocation.cooling:{}),
    ...ops.map(op=>op.runtime).filter(Boolean)]);
  const runtimes=runtimeIds.map(runtime=>{
    const cool=state.allocation?.cooling?.[runtime];
    return {id:runtime,running:ops.filter(op=>op.status==='running'&&op.runtime===runtime).length,
      max:Number.isFinite(state.quota?.slots?.[runtime])?state.quota.slots[runtime]:null,
      usedToday:state.allocation?.usedToday?.[runtime]??0,
      cooling:plain(cool)&&Number.isFinite(cool.until)&&cool.until>stamp
        ?{kind:cool.kind??'other',until:cool.until,minutesLeft:minutes(cool.until-stamp),reason:cool.reason??null}:null};
  });

  const anomalies=plain(state.anomalies)?state.anomalies:{};
  const anomalyList=Object.entries(anomalies).map(([signature,entry])=>({signature,count:entry?.count??0,
    triaged:entry?.triaged?.option??entry?.triaged??null,lastAt:entry?.lastAt??entry?.firstAt??null}))
    .sort((a,b)=>b.count-a.count);

  return {
    schema:WORKFLOW_VIEW,id:state.id??id,dir,at:stamp,
    job:state.job??null,branch:state.branch??null,head:state.head??null,worktree:state.worktree??null,
    ledgerMode:state.ledgerMode??null,iterations:state.iterations??0,approved:Boolean(state.approved),
    phase:state.phase??null,finished:state.finished??null,stopRequested:fs.existsSync(path.join(dir,'stop.flag')),
    kernel:{alive:processAlive(lock?.pid),pid:lock?.pid??null,startedAt:lock?.startedAt??null,
      lastEventAt,lastEvent:lastEvent?.event??null,silentMs:lastEventAt===null?null:stamp-lastEventAt,events:events.length},
    supervisor:readSupervisor(repoRoot,state.id??id,stamp),
    runtimes,
    ops:{total:ops.length,counts:opStatus,live:ops.filter(op=>LIVE_OPS.includes(op.status)).length,running,blocked},
    ledger:{total:ledger.length,counts:ledgerStatus,
      done:DONE_LEDGER.reduce((sum,status)=>sum+(ledgerStatus[status]??0),0),
      implemented:ledgerStatus.implemented??0,todo:ledgerStatus.planned??0,
      reviewExhausted:ledgerStatus['review-exhausted']??0,outOfRepository:ledgerStatus['out-of-repository']??0,
      eligible:ledger.filter(item=>liveLedgerIds.has(item.id)||liveLedgerIds.has(item.nodeId)).length,
      treeEligible:state.ledgerSummary?.eligible??null,treeTotal:state.ledgerSummary?.total??null,
      byFeature:[...features.values()].sort((a,b)=>a.feature.localeCompare(b.feature))},
    lanes:readLanes(state,statusOf),
    reviews:{rounds:plain(state.verifyRounds)?{...state.verifyRounds}:{},
      exhausted:unique(events.filter(event=>event.event==='verify-exhausted').map(event=>event.component).filter(Boolean)),
      findings:Array.isArray(state.reviewFindings)?state.reviewFindings.length:0},
    validator:readValidator(dir,events),
    needUser:Array.isArray(state.needUser)?state.needUser:[],
    rate:{windowMs,windowHours:Math.round((windowMs/3600000)*100)/100,
      opsDone:opsDone.length,opsDonePerHour:per(opsDone.length,windowMs),
      nodesDone:nodesDone.length,nodesDonePerHour:per(nodesDone.length,windowMs)},
    anomalies:{total:anomalyList.reduce((sum,entry)=>sum+entry.count,0),
      untriaged:anomalyList.filter(entry=>!entry.triaged).length,signatures:anomalyList},
    recent:events.slice(-RECENT_EVENTS).map(oneLine)
  };
}

const cell=value=>value===null||value===undefined||value===''?'-':String(value).replace(/\s+/g,' ');
const table=(headers,rows)=>[`| ${headers.join(' | ')} |`,`| ${headers.map(()=>'---').join(' | ')} |`,
  ...rows.map(row=>`| ${row.map(cell).join(' | ')} |`)].join('\n');
const short=value=>Array.isArray(value)?`[${value.length}]`:plain(value)?'{...}':String(value).replace(/\s+/g,' ').slice(0,60);
const clip=(value,max)=>{const text=String(value).replace(/\s+/g,' ');return text.length>max?`${text.slice(0,max)}...`:text;};
const age=ms=>ms===null||ms===undefined?'-':ms<MINUTE_MS?'<1m':ms<3600000?`${Math.round(ms/MINUTE_MS)}m`:`${Math.round(ms/3600000*10)/10}h`;
function oneLine(event){
  const time=Number.isFinite(event.at)?new Date(event.at).toISOString().slice(11,19):'--:--:--';
  const fields=LINE_FIELDS.filter(key=>event[key]!==undefined&&event[key]!==null).map(key=>`${key}=${short(event[key])}`);
  return `${time} #${event.seq??'-'} ${event.event??'?'}${fields.length?` ${fields.join(' ')}`:''}`;
}

/** The terminal page. Plain text with markdown tables: no colour codes, no cursor control, safe in a log. */
export function renderView(view){
  const lines=[];
  const verdict=view.finished?`finished ${view.finished.outcome??'?'}`:view.stopRequested?'stop requested':`phase ${view.phase??'?'}`;
  lines.push(`# ${view.id} - ${verdict}${view.approved?'':' (not approved)'}`);
  if(view.job)lines.push(`job        ${clip(view.job,140)}`);
  lines.push(`kernel     ${view.kernel.alive?`alive pid ${view.kernel.pid}`:view.kernel.pid?`pid ${view.kernel.pid} is gone`:'no kernel process'}, last event ${age(view.kernel.silentMs)} ago${view.kernel.lastEvent?` (${view.kernel.lastEvent})`:''}`);
  lines.push(`supervisor ${view.supervisor.lastRoundAt===null?'no supervisor log':`last round ${age(view.supervisor.silentMs)} ago${view.supervisor.lastAction?` (${view.supervisor.lastAction})`:''}`}`);
  lines.push(`ledger     ${view.ledger.done}/${view.ledger.total} done, ${view.ledger.implemented} implemented, ${view.ledger.todo} todo, ${view.ledger.eligible} with a live op${view.ledger.outOfRepository?`, ${view.ledger.outOfRepository} out of repository`:''}`);
  lines.push(`ops        ${Object.entries(view.ops.counts).map(([status,n])=>`${status} ${n}`).join(', ')||'none'} (${view.ops.total} total)`);
  lines.push(`rate       ${view.rate.opsDonePerHour??'-'} ops/h, ${view.rate.nodesDonePerHour??'-'} nodes/h over ${view.rate.windowHours}h`);
  lines.push(`iterations ${view.iterations}${view.head?`, head ${String(view.head).slice(0,12)}`:''}${view.branch?` on ${view.branch}`:''}`);

  if(view.runtimes.length){
    lines.push('','## Runtimes',table(['runtime','running','max','used today','cooling'],
      view.runtimes.map(runtime=>[runtime.id,runtime.running,runtime.max,runtime.usedToday,
        runtime.cooling?`${runtime.cooling.kind} ${runtime.cooling.minutesLeft}m left`:null])));
  }
  lines.push('',`## Running operations (${view.ops.running.length})`);
  lines.push(view.ops.running.length?table(['op','kind','runtime','age','restarts','last ping'],
    view.ops.running.map(op=>[op.id,op.kind,op.runtime,op.ageMin===null?null:`${op.ageMin}m`,op.restarts,
      op.lastPing?`${op.lastPing.liveness??'seen'} ${op.lastPing.ageMin}m ago`:null])):'nothing is running');
  if(view.ops.blocked.length)lines.push('',`## Blocked operations (${view.ops.blocked.length})`,
    ...view.ops.blocked.map(op=>`- ${op.id}: ${op.refusal??'no refusal recorded'}`));

  if(view.ledger.byFeature.length)lines.push('',`## Ledger by feature${view.ledger.treeTotal===null?'':` (tree: ${view.ledger.treeEligible}/${view.ledger.treeTotal} nodes eligible in scope)`}`,
    table(['feature','done','total'],view.ledger.byFeature.map(entry=>[entry.feature,entry.done,entry.total])));
  if(view.lanes?.length)lines.push('','## Lanes',table(['lane','done','total'],view.lanes.map(lane=>[lane.lane,lane.done,lane.total])));

  const rounds=Object.entries(view.reviews.rounds);
  if(rounds.length||view.reviews.exhausted.length)lines.push('','## Reviews',
    table(['group','rounds','exhausted'],rounds.map(([group,n])=>[group,n,view.reviews.exhausted.includes(group)?'yes':'no'])));
  lines.push('',`## Validator  accepted ${view.validator.accepted}, rejected ${view.validator.rejected}, unavailable ${view.validator.unavailable}${view.validator.source?` (from ${view.validator.source})`:' (no verdicts recorded)'}`);
  if(view.validator.lastSummary)lines.push(`last: ${view.validator.lastSummary}`);

  lines.push('',`## Needs you (${view.needUser.length})`);
  lines.push(view.needUser.length?view.needUser.map(item=>`- ${item.kind??'item'}${item.node?` ${item.node}`:item.op?` ${item.op}`:''}: ${clip(item.detail??'',200)}`).join('\n'):'nothing is waiting on you');
  if(view.anomalies.signatures.length)lines.push('',`## Anomalies (${view.anomalies.total} in ${view.anomalies.signatures.length} signatures, ${view.anomalies.untriaged} untriaged)`,
    table(['signature','count','triaged'],view.anomalies.signatures.map(entry=>[entry.signature,entry.count,entry.triaged])));
  lines.push('',`## Recent events (${view.recent.length})`,...(view.recent.length?view.recent:['no events']));
  return `${lines.join('\n')}\n`;
}

export function renderJson(view){return `${JSON.stringify(view,null,2)}\n`;}

/** One row per workflow of the repository: enough to pick the one to open, never enough to guess at. */
export function buildList({repoRoot,now=Date.now()}){
  const stamp=typeof now==='function'?now():now;
  return listWorkflows(repoRoot).map(entry=>{
    const state=entry.state;
    const ops=Array.isArray(state?.ops)?state.ops:[];
    const lastEvent=readLines(path.join(entry.dir,'events.jsonl')).at(-1);
    const parsed=(()=>{try{return JSON.parse(lastEvent??'');}catch{return null;}})();
    const lastEventAt=at(parsed);
    const lock=readJson(path.join(entry.dir,'kernel.lock'));
    return {id:entry.id,phase:state?.finished?'finished':state?.phase??'unknown',
      approved:Boolean(state?.approved),finished:state?.finished?.outcome??null,
      opsDone:ops.filter(op=>op.status==='done').length,opsTotal:ops.length,
      kernelAlive:processAlive(lock?.pid),pid:lock?.pid??null,
      stopRequested:fs.existsSync(path.join(entry.dir,'stop.flag')),
      lastEventAt,lastEventAgeMs:lastEventAt===null?null:stamp-lastEventAt};
  });
}

export function renderList(list){
  if(!list.length)return 'no workflows in this repository\n';
  return `${table(['workflow','phase','ops','kernel','last event'],list.map(entry=>[entry.id,
    entry.finished?`finished ${entry.finished}`:entry.stopRequested?`${entry.phase} (stop)`:entry.approved?entry.phase:`${entry.phase} (not approved)`,
    `${entry.opsDone}/${entry.opsTotal}`,entry.kernelAlive?`alive ${entry.pid}`:'-',age(entry.lastEventAgeMs)]))}\n`;
}
