import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {inspectJournal} from '../kernel/journal.mjs';
import {journalFileFor} from '../kernel/engine.mjs';
import {pidAlive} from '../kernel/loads.mjs';
import {stateGoalIdentity,workflowsRoot} from '../kernel/store.mjs';
import {openLedger,openMachine,inspectLedger,ledgerFileFor,machineFileFor,LEDGER_SCHEMA} from '../kernel/ledger-db.mjs';

const ANCHOR_SCHEMA='starci/ledger-anchor@1';

export {verifyChain} from '../kernel/ledger-db.mjs';

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
/** §4 chain digest — byte-identical to ledger-db.mjs's digestOf (it is not exported, so it is mirrored here). */
const eventDigest=(prev,row)=>sha256(`${prev??''}${row.event_id}${row.kind}${row.payload_json??''}${row.created_at}`);

const journalRows=(journal,sql,args=[])=>{try{return journal.db.prepare(sql).all(...[].concat(args));}catch{return [];}};

/**
 * Owner-named inputs staged under `_local/inputs/<id>/` (goal.mjs's `stageExternalInputs`). A declared ref the
 * directory no longer holds is a loss, not a refusal: the workflow still imports, missing bytes are reported.
 */
function collectInputs({id,inputsDir,declared,now}){
  const present=(()=>{try{return new Set(fs.readdirSync(inputsDir));}catch{return null;}})();
  const items=[],lost=[],seen=new Set();
  for(const input of declared){
    const ref=String(input?.ref??'');
    if(!ref.startsWith(`.starciwork/_local/inputs/${id}/`))continue;
    const key=path.basename(ref);
    if(seen.has(key))continue;   // state.json and goal.json both carry `inputs`; the same key is not a second input.
    seen.add(key);
    const file=path.join(inputsDir,key);
    const bytes=present?.has(key)?(()=>{try{return fs.readFileSync(file);}catch{return null;}})():null;
    if(!bytes){lost.push({key,reason:'input-file-missing'});continue;}
    items.push({key,bytes,origin:input.sourceRef??ref,created_at:mtime(file)??now()});
  }
  for(const key of present??[]){
    if(seen.has(key))continue;
    const file=path.join(inputsDir,key);
    const bytes=(()=>{try{return fs.readFileSync(file);}catch{return null;}})();
    if(bytes)items.push({key,bytes,origin:file,created_at:mtime(file)??now()});
  }
  return {items,lost};
}

/** Read everything one `_local/workflows/<id>` directory plus the journal hold for it. Pure: touches no target. */
function collectWorkflow({dir,id,state,stateGen,journal,ledgerFile,machineFile,inputsDir,now}){
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
  const declaredInputs=[...(Array.isArray(state?.inputs)?state.inputs:[]),...(Array.isArray(goalJson?.inputs)?goalJson.inputs:[])];
  const inputs=collectInputs({id,inputsDir,declared:declaredInputs,now});
  const counts={events:events.length+jevents.length,snapshots:snapshots.length+(importedState?1:0),jobs:jobs.length,leases:leases.length,
    reports:reports.length,contracts:contracts.length,checks:checks.length,inbox:inbox.length,goals:(goalMd!==null||goalJson!==null)?1:0,inputs:inputs.items.length};
  return {id,dir,inputsDir,workflow,goal:counts.goals?goal:null,events:[...events,...jevents],snapshots,importedState,jobs,leases,incidents,reservations,reports,contracts,checks,inbox,inputs,counts};
}

/** Journal-global rows (resources, budgets) have no workflow scope: they import once, under their own migration key. */
function collectShared(journal){
  if(!journal)return {resources:[],budgets:[]};
  const has=table=>{try{return journal.db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)!==undefined;}catch{return false;}};
  return {resources:has('resources')?journal.db.prepare('SELECT * FROM resources ORDER BY resource_key').all():[],
    budgets:has('budgets')?journal.db.prepare('SELECT * FROM budgets ORDER BY scope_key').all():[]};
}

function machineApply(machine,{file,plan,shared,at}){
  const {ledgerId}=machine.registerLedger({file});
  for(const row of shared.resources.filter(row=>machineScoped(row.resource_key)))machine.db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,?)').run(row.resource_key,row.capacity);
  for(const row of shared.budgets.filter(row=>machineScoped(row.scope_key)))machine.db.prepare('INSERT OR IGNORE INTO budgets(scope_key,limit_value,used_value,reserved_value) VALUES(?,?,?,?)').run(row.scope_key,row.limit_value,row.used_value,row.reserved_value);
  for(const lease of plan.leases.filter(row=>machineScoped(row.resource_key)))machine.db.prepare('INSERT OR IGNORE INTO leases(resource_key,token,ledger_id,workflow_id,job_id,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(lease.resource_key,lease.token,ledgerId,plan.id,lease.job_id,lease.units,lease.acquired_at,lease.expires_at);
  for(const row of plan.reservations.filter(row=>machineScoped(row.scope_key)))machine.db.prepare('INSERT OR IGNORE INTO budget_reservations(scope_key,ledger_id,job_id,units) VALUES(?,?,?,?)').run(row.scope_key,ledgerId,row.job_id,row.units);
}

function ledgerApply(db,{plan,shared,recordShared,journalFile,at,ledger}){
  const row=plan.workflow;
  db.prepare('INSERT INTO workflows(workflow_id,title,created_at,updated_at,ledger_mode,source_roots_json,generation,goal_identity,phase,finished_json,pin_digest) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(row.workflow_id,row.title,row.created_at,row.updated_at,row.ledger_mode,row.source_roots_json,row.generation,row.goal_identity,row.phase,row.finished_json,row.pin_digest);
  if(plan.goal)db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(plan.id,plan.goal.revision,plan.goal.goal_identity,plan.goal.markdown,plan.goal.json,plan.goal.created_at);
  let head=null,lastSeq=null;
  const insertEvent=db.prepare('INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const event of plan.events){const digest=eventDigest(head,event);const result=insertEvent.run(event.event_id,plan.id,event.generation,event.entity_type,event.entity_id,event.kind,event.payload_json,head,digest,event.created_at);head=digest;lastSeq=Number(result.lastInsertRowid);}
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
  for(const item of plan.inputs.items)ledger.inputs.put({workflowId:plan.id,key:item.key,goalRevision:plan.goal?.revision??1,bytes:item.bytes,origin:item.origin});
  // `inputs.put` bumps `workflows.updated_at` to its own clock (via `ensureWorkflow`); restore the imported value.
  if(plan.inputs.items.length)db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(row.updated_at,plan.id);
  if(plan.inputs.items.length||plan.inputs.lost.length)db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(plan.inputsDir,'workflow-inputs',JSON.stringify({imported:plan.inputs.items.length,lost:plan.inputs.lost}),at);
  db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(plan.dir,'workflow-dir',JSON.stringify(plan.counts),at);
  db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(`${journalFile}#${plan.id}`,'journal-workflow',JSON.stringify({events:plan.counts.events,jobs:plan.jobs.length,leases:plan.leases.length,snapshots:plan.snapshots.length,incidents:plan.incidents.length}),at);
  if(recordShared)db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(`${journalFile}#shared`,'journal-shared',JSON.stringify({resources:shared.resources.length,budgets:shared.budgets.length}),at);
  return {eventsHead:head,lastSeq};
}

const readMigrations=file=>{
  const inspection=inspectLedger({file});
  try{return new Set(inspection.db.prepare('SELECT source FROM migrations').all().map(row=>row.source));}catch{return new Set();}finally{inspection.close();}
};

/**
 * §4/§12: `meta` is seeded once, at ledger creation, and never rewritten. `kernel/ledger-db.mjs` does not yet
 * create the table itself (docs addendum ahead of the module), so the migrator — the process that actually
 * creates `runtime.sqlite` on a first run — owns bootstrapping it here. `CREATE TABLE IF NOT EXISTS` plus the
 * `ledger_id` existence check make this safe to keep calling even once the module seeds its own copy.
 */
function seedMeta(db,{now}){
  db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if(db.prepare('SELECT 1 FROM meta WHERE key=?').get('ledger_id'))return null;
  const ledgerId=crypto.randomUUID();
  const journalMode=String(db.prepare('PRAGMA journal_mode').get().journal_mode).toLowerCase();
  const insert=db.prepare('INSERT INTO meta(key,value) VALUES(?,?)');
  insert.run('ledger_id',ledgerId);insert.run('schema',LEDGER_SCHEMA);insert.run('created_at',String(now()));insert.run('journal_mode',journalMode);
  return ledgerId;
}

const anchorFileFor=repoRoot=>path.join(repoRoot,'.starciwork','ledger-anchor.json');
const readAnchorFile=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
/** §12: replace the anchor atomically (write temp + rename), after the ledger transaction it describes has committed. */
function writeAnchorEntry({repoRoot,ledgerId,workflowId,entry,now}){
  const file=anchorFileFor(repoRoot);
  const prior=readAnchorFile(file);
  const anchor={schema:ANCHOR_SCHEMA,ledgerId,updatedAt:now,workflows:{...(prior?.workflows??{}),[workflowId]:entry}};
  const tmp=path.join(path.dirname(file),`.ledger-anchor.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(tmp,JSON.stringify(anchor));
  fs.renameSync(tmp,file);
  return anchor;
}
/** The checkpoint the anchor should point at for one imported workflow: the file state if imported, else the newest old-journal snapshot. */
function anchorCheckpoint(plan){
  if(plan.importedState)return {checkpointId:`import:${plan.id}:${plan.workflow.generation}`,generation:plan.workflow.generation};
  const newest=plan.snapshots.at(-1);
  return newest?{checkpointId:newest.checkpoint_id,generation:newest.generation}:{checkpointId:null,generation:plan.workflow.generation};
}

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
 * `.starciwork/runtime.sqlite`, per workflow and atomically.
 */
export async function migrateLedger({repoRoot,journalFile=journalFileFor(),machineFile=machineFileFor(),dryRun=false,archive=false,now=Date.now,pidAliveFn=pidAlive}={}){
  need(typeof repoRoot==='string'&&repoRoot.trim(),'migrateLedger needs a repository root');
  const resolvedRoot=path.resolve(repoRoot),root=workflowsRoot(resolvedRoot),ledgerFile=ledgerFileFor(resolvedRoot);
  const summary={ok:true,workflows:[],skipped:[],refused:[]};
  if(!fs.existsSync(root))return summary;
  const journal=journalFile&&fs.existsSync(journalFile)?inspectJournal({file:journalFile}):null;
  let ledger=null,machine=null,prior=new Set(),ledgerId=null;
  const closeAll=()=>{try{ledger?.close();}catch{}try{machine?.close();}catch{}try{journal?.close();}catch{}};
  try{
    if(dryRun){if(fs.existsSync(ledgerFile))prior=readMigrations(ledgerFile);}
    else{
      ledger=openLedger({file:ledgerFile,now});
      try{prior=new Set(ledger.db.prepare('SELECT source FROM migrations').all().map(row=>row.source));}catch{prior=new Set();}
      // §4/§12: seed `meta` the first time this ledger is created; every run reads back its `ledger_id` for the anchor.
      const metaSource=`${ledgerFile}#meta`;
      ledgerId=ledger.transaction(db=>{
        if(!prior.has(metaSource)){
          const seeded=seedMeta(db,{now});
          if(seeded)db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(metaSource,'ledger-meta',JSON.stringify({ledgerId:seeded}),now());
        }
        return db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value??null;
      });
      prior.add(metaSource);
    }
    const ids=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
    const inputsRoot=path.join(path.dirname(root),'inputs');
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
      const plan=collectWorkflow({dir,id,state,stateGen,journal,ledgerFile,machineFile,inputsDir:path.join(inputsRoot,id),now});
      if(dryRun){summary.workflows.push({id,imported:plan.counts,...(plan.inputs.lost.length?{inputsLost:plan.inputs.lost}:{})});continue;}
      try{
        const needsMachine=plan.leases.some(lease=>machineScoped(lease.resource_key))||plan.reservations.some(row=>machineScoped(row.scope_key))||(!sharedDone&&(shared.resources.some(row=>machineScoped(row.resource_key))||shared.budgets.some(row=>machineScoped(row.scope_key))));
        if(needsMachine){machine??=openMachine({file:machineFile,now});machine.transaction(()=>machineApply(machine,{file:ledgerFile,plan,shared:sharedDone?{resources:[],budgets:[]}:shared,at:now()}));}
        const applied=ledger.transaction(db=>ledgerApply(db,{plan,shared:sharedDone?{resources:[],budgets:[]}:shared,recordShared:!sharedDone,journalFile,at:now(),ledger}));
        sharedDone=true;
        // §12: the anchor is written only after the ledger transaction it describes has committed.
        const checkpoint=anchorCheckpoint(plan),anchorSource=`${plan.dir}#anchor`;
        writeAnchorEntry({repoRoot:resolvedRoot,ledgerId,workflowId:id,
          entry:{generation:checkpoint.generation,checkpointId:checkpoint.checkpointId,eventsHead:applied.eventsHead,seq:applied.lastSeq,at:now()},now:now()});
        ledger.transaction(db=>db.prepare('INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?)').run(anchorSource,'workflow-anchor',JSON.stringify({workflowId:id,checkpointId:checkpoint.checkpointId}),now()));
        if(archive)archiveDir(root,id);
        summary.workflows.push({id,imported:plan.counts,...(plan.inputs.lost.length?{inputsLost:plan.inputs.lost}:{})});
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
