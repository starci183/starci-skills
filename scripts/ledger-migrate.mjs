import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {inspectJournal} from '../kernel/journal.mjs';
import {journalFileFor,runtimeRootFor} from '../kernel/engine.mjs';
import {pidAlive} from '../kernel/loads.mjs';
import {stateGoalIdentity,workflowsRoot} from '../kernel/store.mjs';

const require=createRequire(import.meta.url);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
const readText=file=>{try{return fs.readFileSync(file,'utf8');}catch{return null;}};
const mtime=file=>{try{return Math.round(fs.statSync(file).mtimeMs);}catch{return null;}};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const SETTLED=['succeeded','failed','cancelled'];
const SEGMENT=/^events\.g(\d+)\.jsonl$/;
/** The journal's machine-arbiter resources; repo fences (canonical-writer:*, source-root:*, lane:*) stay ledger-side. */
const machineScoped=key=>key.startsWith('ai/')||key.startsWith('machine:');

export const ledgerFileFor=repoRoot=>path.join(repoRoot,'.starciwork','runtime.sqlite');
export const machineFileFor=(env=process.env)=>path.join(runtimeRootFor(env),'machine.sqlite');
/** §4: digest chains a workflow's event rows; the stored text columns are hashed verbatim. */
const eventDigest=(prev,row)=>sha256(`${prev??''}${row.event_id}${row.kind}${String(row.payload_json)}${row.created_at}`);

/** Recompute a workflow's event chain; the migrator's own proof until ledger-db exports the canonical verifier. */
export function verifyChain(db,workflowId){
  const rows=workflowId?db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId):db.prepare('SELECT * FROM events ORDER BY workflow_id,seq').all();
  const heads=new Map(),broken=[];
  for(const row of rows){
    const prev=heads.get(row.workflow_id)??null;
    if((row.prev_digest??null)!==prev||eventDigest(prev,row)!==row.digest)broken.push(row.event_id);
    heads.set(row.workflow_id,row.digest);
  }
  return {ok:broken.length===0,broken};
}

const journalRows=(journal,sql,args=[])=>{try{return journal.db.prepare(sql).all(...[].concat(args));}catch{return [];}};

/** Read everything one `_local/workflows/<id>` directory plus the journal hold for it. Pure: touches no target. */
function collectWorkflow({dir,id,state,stateGen,journal,ledgerFile,machineFile,now}){
  const goalMd=readText(path.join(dir,'goal.md')),goalJsonText=readText(path.join(dir,'goal.json')),goalJson=(()=>{try{return goalJsonText?JSON.parse(goalJsonText):null;}catch{return null;}})();
  const goalIdentity=state?stateGoalIdentity(state):sha256(JSON.stringify({job:goalJson?.job??null,inputs:goalJson?.inputs??null,scope:goalJson?.scope??null,definitionOfDone:goalJson?.definitionOfDone??null,ledgerMode:goalJson?.ledgerMode??null}));
  const events=[];
  const pushFileEvent=(line,generation)=>{
    const {seq:original,...rest}=line;
    events.push({event_id:`audit:${id}:${original}`,workflow_id:id,generation,entity_type:'workflow',entity_id:id,
      kind:rest.event??rest.kind??'imported',payload_json:JSON.stringify({...rest,_seq:original}),created_at:Number.isFinite(rest.at)?rest.at:(mtime(dir)??now())});
  };
  let maxSegment=0;
  const names=(()=>{try{return fs.readdirSync(dir);}catch{return [];}})();
  for(const generation of names.map(name=>SEGMENT.exec(name)).filter(Boolean).map(match=>Number(match[1])).sort((a,b)=>a-b)){
    maxSegment=Math.max(maxSegment,generation);
    for(const line of (readText(path.join(dir,`events.g${generation}.jsonl`))??'').split('\n')){const parsed=(()=>{try{return JSON.parse(line);}catch{return null;}})();if(plain(parsed)&&Number.isInteger(parsed.seq))pushFileEvent(parsed,generation);}
  }
  const liveGeneration=stateGen||maxSegment+1||1;
  for(const line of (readText(path.join(dir,'events.jsonl'))??'').split('\n')){const parsed=(()=>{try{return JSON.parse(line);}catch{return null;}})();if(plain(parsed)&&Number.isInteger(parsed.seq))pushFileEvent(parsed,liveGeneration);}
  const used=new Set();
  for(const event of events){let candidate=event.event_id,n=2;while(used.has(candidate))candidate=`${event.event_id}~${n++}`;used.add(candidate);event.event_id=candidate;}
  const jevents=journalRows(journal,'SELECT * FROM events WHERE workflow_id=? ORDER BY seq',id)
    .map(row=>({event_id:row.event_id,workflow_id:id,generation:row.generation,entity_type:row.entity_type,entity_id:row.entity_id,kind:row.kind,payload_json:row.payload_json,created_at:row.created_at}));
  const jobs=journalRows(journal,'SELECT * FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id',id);
  const leases=journalRows(journal,'SELECT * FROM leases WHERE workflow_id=? ORDER BY acquired_at,resource_key,job_id',id);
  const snapshots=journalRows(journal,'SELECT * FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id',id);
  const incidents=journalRows(journal,'SELECT * FROM incidents WHERE workflow_id=?',id);
  const reservations=journalRows(journal,'SELECT br.scope_key,br.job_id,br.units FROM budget_reservations br JOIN jobs j ON j.job_id=br.job_id WHERE j.workflow_id=?',id);
  const seenDispatch=new Set();
  const reports=(()=>{try{return fs.readdirSync(path.join(dir,'reports')).filter(name=>name.endsWith('.json')&&name!=='wait-state.json').sort();}catch{return [];}})()
    .map(name=>{const file=path.join(dir,'reports',name),text=readText(file)??'',parsed=(()=>{try{return JSON.parse(text);}catch{return null;}})();
      // UNIQUE(workflow_id,dispatch_id): a second file claiming one dispatch keeps its filename as the id instead.
      let dispatch=parsed?.dispatch??name.replace(/\.json$/,'');if(seenDispatch.has(dispatch))dispatch=name.replace(/\.json$/,'');seenDispatch.add(dispatch);
      return {dispatch_id:dispatch,op_id:parsed?.task??null,attempt:Number.isInteger(parsed?.attempt)?parsed.attempt:null,generation:Number.isInteger(parsed?.generation)?parsed.generation:null,
        outcome:parsed?.outcome??'unreadable',report_json:text,from_terminal:parsed?.from??null,created_at:Number.isFinite(parsed?.reportedAt)?parsed.reportedAt:(mtime(file)??now())};});
  const contracts=(()=>{try{return fs.readdirSync(path.join(dir,'contracts')).filter(name=>name.endsWith('.md')).sort();}catch{return [];}})()
    .map(name=>{const file=path.join(dir,'contracts',name);return {op_id:name.replace(/\.md$/,''),attempt:1,dispatch_id:null,markdown:readText(file)??'',created_at:mtime(file)??now()};});
  const checks=(()=>{try{return fs.readdirSync(path.join(dir,'checks')).filter(name=>name.endsWith('.json')).sort();}catch{return [];}})()
    .map(name=>{const file=path.join(dir,'checks',name),parsed=readJson(file);return {op_id:name.replace(/\.json$/,''),attempt:Number.isInteger(parsed?.attempt)&&parsed.attempt>0?parsed.attempt:1,checks_json:readText(file)??'',created_at:mtime(file)??now()};});
  const inbox=(()=>{try{return fs.readdirSync(path.join(dir,'inbox')).filter(name=>name.endsWith('.json')).sort();}catch{return [];}})()
    .map(name=>{const file=path.join(dir,'inbox',name),text=readText(file)??'',parsed=(()=>{try{return JSON.parse(text);}catch{return null;}})();
      return {kind:parsed?.kind??'unknown',key:name.replace(/\.json$/,''),payload_json:text,created_at:Number.isFinite(Date.parse(parsed?.at))?Date.parse(parsed.at):(mtime(file)??now())};});
  // The imported snapshot rebinds the engine to the ledger; `journalFile` left in place would read unmigrated.
  let importedState=null;
  if(plain(state)){
    importedState=structuredClone(state);
    if(plain(importedState.engine)){delete importedState.engine.journalFile;importedState.engine.ledgerFile=ledgerFile;importedState.engine.machineFile=machineFile;}
  }
  const firstEvent=events[0]?.created_at,lastEvent=[...events,...jevents].at(-1)?.created_at;
  const workflow={workflow_id:id,title:state?.job?.title??state?.job?.goal??goalJson?.job?.title??(typeof (state?.job??goalJson?.job)==='string'?(state?.job??goalJson?.job):null),
    created_at:Number.isFinite(state?.createdAt)?state.createdAt:(firstEvent??mtime(dir)??now()),updated_at:lastEvent??mtime(dir)??now(),
    ledger_mode:state?.ledgerMode??goalJson?.ledgerMode??null,source_roots_json:JSON.stringify([state?.worktree].filter(root=>typeof root==='string'&&root)),
    generation:stateGen,goal_identity:goalIdentity,phase:state?.phase??null,finished_json:plain(state?.finished)?JSON.stringify(state.finished):null,
    pin_digest:state?.engine?.runtimePin?.digest??state?.engine?.runtimePinDigest??null};
  const goal={revision:Number.isInteger(goalJson?.rev)?goalJson.rev:1,goal_identity:goalIdentity,markdown:goalMd??'',json:goalJsonText??'null',created_at:mtime(path.join(dir,'goal.json'))??mtime(path.join(dir,'goal.md'))??now()};
  const counts={events:events.length+jevents.length,snapshots:snapshots.length+(importedState?1:0),jobs:jobs.length,leases:leases.length,
    reports:reports.length,contracts:contracts.length,checks:checks.length,inbox:inbox.length,goals:(goalMd!==null||goalJson!==null)?1:0};
  return {id,dir,workflow,goal:counts.goals?goal:null,events:[...events,...jevents],snapshots,importedState,jobs,leases,incidents,reservations,reports,contracts,checks,inbox,counts};
}

/** Journal-global rows (resources, budgets) have no workflow scope: they import once, under their own migration key. */
function collectShared(journal){
  if(!journal)return {resources:[],budgets:[]};
  const has=table=>{try{return journal.db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)!==undefined;}catch{return false;}};
  return {resources:has('resources')?journal.db.prepare('SELECT * FROM resources ORDER BY resource_key').all():[],
    budgets:has('budgets')?journal.db.prepare('SELECT * FROM budgets ORDER BY scope_key').all():[]};
}

const ledgerId=file=>sha256(fs.realpathSync(file)).slice(0,16);

function machineApply(machine,{ledgerKey,file,plan,shared,at}){
  machine.db.prepare('INSERT OR IGNORE INTO ledgers(ledger_id,file,registered_at,seen_at) VALUES(?,?,?,?)').run(ledgerKey,file,at,at);
  for(const row of shared.resources.filter(row=>machineScoped(row.resource_key)))machine.db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,?)').run(row.resource_key,row.capacity);
  for(const row of shared.budgets.filter(row=>machineScoped(row.scope_key)))machine.db.prepare('INSERT OR IGNORE INTO budgets(scope_key,limit_value,used_value,reserved_value) VALUES(?,?,?,?)').run(row.scope_key,row.limit_value,row.used_value,row.reserved_value);
  for(const lease of plan.leases.filter(row=>machineScoped(row.resource_key)))machine.db.prepare('INSERT OR IGNORE INTO leases(resource_key,token,ledger_id,workflow_id,job_id,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(lease.resource_key,lease.token,ledgerKey,plan.id,lease.job_id,lease.units,lease.acquired_at,lease.expires_at);
  for(const row of plan.reservations.filter(row=>machineScoped(row.scope_key)))machine.db.prepare('INSERT OR IGNORE INTO budget_reservations(scope_key,ledger_id,job_id,units) VALUES(?,?,?,?)').run(row.scope_key,ledgerKey,row.job_id,row.units);
}

function ledgerApply(db,{plan,shared,recordShared,journalFile,at}){
  const row=plan.workflow;
  db.prepare('INSERT INTO workflows(workflow_id,title,created_at,updated_at,ledger_mode,source_roots_json,generation,goal_identity,phase,finished_json,pin_digest) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(row.workflow_id,row.title,row.created_at,row.updated_at,row.ledger_mode,row.source_roots_json,row.generation,row.goal_identity,row.phase,row.finished_json,row.pin_digest);
  if(plan.goal)db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(plan.id,plan.goal.revision,plan.goal.goal_identity,plan.goal.markdown,plan.goal.json,plan.goal.created_at);
  let head=null;
  const insertEvent=db.prepare('INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const event of plan.events){const digest=eventDigest(head,event);insertEvent.run(event.event_id,plan.id,event.generation,event.entity_type,event.entity_id,event.kind,event.payload_json,head,digest,event.created_at);head=digest;}
  const insertSnapshot=db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,events_head,created_at) VALUES(?,?,?,?,?,?,?)');
  for(const snapshot of plan.snapshots)insertSnapshot.run(snapshot.checkpoint_id,plan.id,snapshot.generation,snapshot.goal_identity,snapshot.state_json,null,snapshot.created_at);
  if(plan.importedState)insertSnapshot.run(`import:${plan.id}:${plan.workflow.generation}`,plan.id,plan.workflow.generation,plan.workflow.goal_identity,JSON.stringify(plan.importedState),head,at);
  const insertJob=db.prepare('INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,worker_id,deadline,result_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for(const job of plan.jobs)insertJob.run(job.job_id,plan.id,job.op_id,job.attempt,job.generation,job.kind,job.role,job.payload_json,job.status,job.priority_json,job.lease_token,job.worker_id,job.deadline,job.result_json,job.created_at,job.updated_at);
  const insertLease=db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  for(const lease of plan.leases)insertLease.run(lease.resource_key,lease.job_id,plan.id,lease.op_id,lease.attempt,lease.generation,lease.token,lease.units,lease.acquired_at,lease.expires_at,machineScoped(lease.resource_key)?lease.token:null);
  const insertIncident=db.prepare('INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const incident of plan.incidents)insertIncident.run(incident.incident_id,plan.id,incident.op_id,incident.attempts,incident.model_calls,incident.tokens,incident.elapsed_ms,incident.last_progress,incident.status,incident.updated_at);
  for(const resource of shared.resources.filter(row=>!machineScoped(row.resource_key)))db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,?)').run(resource.resource_key,resource.capacity);
  const insertBudget=db.prepare('INSERT OR IGNORE INTO budgets(scope_key,limit_value,used_value,reserved_value) VALUES(?,?,?,?)');
  for(const budget of shared.budgets.filter(row=>!machineScoped(row.scope_key)))insertBudget.run(budget.scope_key,budget.limit_value,budget.used_value,budget.reserved_value);
  const insertReservation=db.prepare('INSERT OR IGNORE INTO budget_reservations(scope_key,job_id,units) VALUES(?,?,?)');
  for(const reservation of plan.reservations.filter(row=>!machineScoped(row.scope_key)))insertReservation.run(reservation.scope_key,reservation.job_id,reservation.units);
  const insertReport=db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  for(const report of plan.reports)insertReport.run(plan.id,report.dispatch_id,report.op_id,report.attempt,report.generation,report.outcome,report.report_json,report.from_terminal,report.created_at);
  const insertContract=db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,created_at) VALUES(?,?,?,?,?,?)');
  for(const contract of plan.contracts)insertContract.run(plan.id,contract.op_id,contract.attempt,contract.dispatch_id,contract.markdown,contract.created_at);
  const insertCheck=db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)');
  for(const check of plan.checks)insertCheck.run(plan.id,check.op_id,check.attempt,check.checks_json,check.created_at);
  const insertInbox=db.prepare('INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)');
  for(const item of plan.inbox)insertInbox.run(plan.id,item.kind,item.key,item.payload_json,'pending',item.created_at);
  db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(plan.dir,'workflow-dir',JSON.stringify(plan.counts),at);
  db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(`${journalFile}#${plan.id}`,'journal-workflow',JSON.stringify({events:plan.counts.events,jobs:plan.jobs.length,leases:plan.leases.length,snapshots:plan.snapshots.length,incidents:plan.incidents.length}),at);
  if(recordShared)db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(`${journalFile}#shared`,'journal-shared',JSON.stringify({resources:shared.resources.length,budgets:shared.budgets.length}),at);
}

const readMigrations=file=>{
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  try{return new Set(db.prepare('SELECT source FROM migrations').all().map(row=>row.source));}catch{return new Set();}finally{db.close();}
};

function archiveDir(root,id){
  const target=path.join(path.dirname(root),'workflows-archive');
  fs.mkdirSync(target,{recursive:true});
  let name=`${id}.migrated`,n=2;
  while(fs.existsSync(path.join(target,name)))name=`${id}.migrated.${n++}`;
  fs.renameSync(path.join(root,id),path.join(target,name));
  return name;
}

/**
 * §10: fold `.starciwork/_local/workflows/<id>` plus the retired journal's rows for it into
 * `.starciwork/runtime.sqlite`, per workflow and atomically. `deps` injects the ledger openers
 * (`kernel/ledger-db.mjs`, s0) so the spec can stand the schema up before that branch lands.
 */
export async function migrateLedger({repoRoot,journalFile=journalFileFor(),machineFile=machineFileFor(),dryRun=false,archive=false,now=Date.now,pidAliveFn=pidAlive,deps=null}={}){
  need(typeof repoRoot==='string'&&repoRoot.trim(),'migrateLedger needs a repository root');
  const root=workflowsRoot(path.resolve(repoRoot)),ledgerFile=deps?.ledgerFileFor?.(repoRoot)??ledgerFileFor(path.resolve(repoRoot));
  const summary={ok:true,workflows:[],skipped:[],refused:[]};
  if(!fs.existsSync(root))return summary;
  const journal=journalFile&&fs.existsSync(journalFile)?inspectJournal({file:journalFile}):null;
  let ledger=null,machine=null,openMachine=null,prior=new Set();
  const closeAll=()=>{try{ledger?.close();}catch{}try{machine?.close();}catch{}try{journal?.close();}catch{}};
  try{
    if(dryRun){if(fs.existsSync(ledgerFile))prior=readMigrations(ledgerFile);}
    else{
      const openers=deps??await import('../kernel/ledger-db.mjs');
      need(typeof openers.openLedger==='function','kernel/ledger-db.mjs (s0) is required for a real migration');
      ledger=openers.openLedger({file:ledgerFile,now});
      openMachine=openers.openMachine;
      try{prior=new Set(ledger.db.prepare('SELECT source FROM migrations').all().map(row=>row.source));}catch{prior=new Set();}
    }
    const ids=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
    const shared=collectShared(journal),sharedSource=`${journalFile}#shared`;
    let sharedDone=prior.has(sharedSource);
    for(const id of ids){
      const dir=path.join(root,id);
      if(prior.has(dir)){summary.skipped.push({id,reason:'already-migrated'});continue;}
      const lock=readJson(path.join(dir,'kernel.lock'));
      if(Number.isInteger(lock?.pid)&&lock.pid>0&&pidAliveFn(lock.pid)){summary.refused.push({id,reason:'kernel-lock-held'});continue;}
      const state=readJson(path.join(dir,'state.json')),stateGen=Number.isInteger(state?.engine?.generation)?state.engine.generation:0;
      const behind=journal?journalRows(journal,`SELECT job_id FROM jobs WHERE workflow_id=? AND generation<? AND status NOT IN (${SETTLED.map(()=>'?').join(',')})`,[id,stateGen,...SETTLED]).length:0;
      if(behind){summary.refused.push({id,reason:'kernel-reconcile-required'});continue;}
      const plan=collectWorkflow({dir,id,state,stateGen,journal,ledgerFile,machineFile,now});
      if(dryRun){summary.workflows.push({id,imported:plan.counts});continue;}
      try{
        const needsMachine=plan.leases.some(lease=>machineScoped(lease.resource_key))||plan.reservations.some(row=>machineScoped(row.scope_key))||(!sharedDone&&(shared.resources.some(row=>machineScoped(row.resource_key))||shared.budgets.some(row=>machineScoped(row.scope_key))));
        if(needsMachine){need(typeof openMachine==='function','openMachine is required to import machine-scoped journal rows');machine??=openMachine({file:machineFile,now});machine.transaction(()=>machineApply(machine,{ledgerKey:ledgerId(ledgerFile),file:ledgerFile,plan,shared:sharedDone?{resources:[],budgets:[]}:shared,at:now()}));}
        ledger.transaction(db=>ledgerApply(db,{plan,shared:sharedDone?{resources:[],budgets:[]}:shared,recordShared:!sharedDone,journalFile,at:now()}));
        sharedDone=true;
        if(archive)archiveDir(root,id);
        summary.workflows.push({id,imported:plan.counts});
      }catch(error){summary.refused.push({id,reason:`import-failed:${String(error?.message??error).slice(0,160)}`});}
    }
    summary.ok=summary.refused.length===0;
    return summary;
  }finally{closeAll();}
}

function parseArgs(argv){
  const options={archive:false};
  for(let i=0;i<argv.length;i+=1){
    const key=argv[i];
    if(key==='--dry-run'){options.dryRun=true;continue;}
    if(key==='--archive'){options.archive=argv[i+1]==='false'?(i+=1,false):(argv[i+1]==='true'?(i+=1,true):true);continue;}
    if(key==='--repo'||key==='--journal-file'||key==='--machine-file'){options[key.slice(2).replace(/-([a-z])/g,(m,c)=>c.toUpperCase())]=argv[++i];continue;}
    throw Error(`Unknown argument ${key}; expected --repo <root> [--journal-file <f>] [--machine-file <f>] [--dry-run] [--archive true]`);
  }
  return options;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try{
    const options=parseArgs(process.argv.slice(2));
    need(options.repo,'--repo <root> is required');
    const summary=await migrateLedger({repoRoot:options.repo,journalFile:options.journalFile,machineFile:options.machineFile,dryRun:options.dryRun===true,archive:options.archive});
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    process.exitCode=summary.ok?0:1;
  }catch(error){process.stdout.write(`${JSON.stringify({ok:false,error:String(error?.message??error)})}\n`);process.exitCode=2;}
}
