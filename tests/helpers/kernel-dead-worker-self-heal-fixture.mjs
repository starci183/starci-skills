import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {TEST_REGISTRY_ENV,openMachine} from '../../engine/db/machine.mjs';
import {seedWorkflow} from './ledger-fixture.mjs';
import {JOB_ROW} from '../../scripts/machine/job-row.mjs';

const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));

// The production CLI is intentionally a script rather than an exported function. Keep one isolated
// Node worker alive and import that real entry afresh for each successful command: its parser, extension
// registry and ledger-open path still run, while Node can reuse the already parsed dependency graph.
if(!isMainThread&&workerData?.kind==='kernel-dead-worker-self-heal-cli'){
  let invocation=0,chain=Promise.resolve();
  const invoke=async({id,args})=>{
    const stdout=[],stderr=[];
    let emitted;
    const output=new Promise(resolve=>{emitted=resolve;});
    const log=console.log,error=console.error,argv=process.argv;
    console.log=(...parts)=>{const line=parts.join(' ');stdout.push(line);parentPort.postMessage({id,trace:'stdout',line});emitted();};
    console.error=(...parts)=>{const line=parts.join(' ');stderr.push(line);parentPort.postMessage({id,trace:'stderr',line});emitted();};
    process.argv=[process.execPath,workerData.api,...args];
    try{
      await import(`${pathToFileURL(workerData.api).href}?self_heal_invocation=${++invocation}`);
      await Promise.race([output,new Promise((_,reject)=>setTimeout(()=>reject(Error('kernel CLI emitted no result')),120000))]);
      await nextTurn();
      parentPort.postMessage({id,status:0,stdout:stdout.join('\n')+(stdout.length?'\n':''),stderr:stderr.join('\n')+(stderr.length?'\n':'')});
    }catch(cause){
      parentPort.postMessage({id,status:1,stdout:stdout.join('\n')+(stdout.length?'\n':''),stderr:`${stderr.join('\n')}${stderr.length?'\n':''}${cause?.stack??cause}\n`});
    }finally{
      console.log=log;console.error=error;process.argv=argv;
    }
  };
  parentPort.on('message',message=>{chain=chain.then(()=>invoke(message));});
}

const git=(cwd,args,env={})=>{
  const result=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,
    GIT_AUTHOR_NAME:'spec',GIT_AUTHOR_EMAIL:'spec@example.invalid',GIT_COMMITTER_NAME:'spec',GIT_COMMITTER_EMAIL:'spec@example.invalid',...env}});
  if(result.status!==0)throw Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

class CliEntryRunner{
  constructor(api,env){
    this.sequence=0;this.pending=new Map();
    this.worker=new Worker(new URL(import.meta.url),{workerData:{kind:'kernel-dead-worker-self-heal-cli',api},env});
    this.worker.on('message',message=>{const pending=this.pending.get(message.id);if(!pending)return;if(message.trace){pending[message.trace].push(message.line);return;}this.pending.delete(message.id);pending.resolve(message);});
    this.worker.on('error',cause=>{for(const pending of this.pending.values())pending.reject(cause);this.pending.clear();});
    this.worker.on('exit',code=>{if(code===0)return;for(const pending of this.pending.values())pending.reject(Error(`kernel CLI fixture worker exited ${code}: ${[...pending.stderr,...pending.stdout].join('\n')}`));this.pending.clear();});
  }
  run(args){
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,stdout:[],stderr:[]});this.worker.postMessage({id,args});});
  }
  async close(){await this.worker.terminate();}
}

const copyDatabase=(from,to)=>{
  for(const suffix of ['-wal','-shm'])fs.rmSync(`${to}${suffix}`,{force:true});
  fs.copyFileSync(from,to);
};

export function createKernelDeadWorkerSelfHealFixture({api,fakeOrca,root:runtimeRoot,wf,jobId,handle,op,hour,minute}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-self-heal-'));
  const repoRoot=path.join(root,'repo'),machineHome=path.join(root,'machine');
  fs.mkdirSync(path.join(repoRoot,'.starciwork'),{recursive:true});
  fs.mkdirSync(machineHome,{recursive:true});
  git(repoRoot,['init','-q']);
  fs.writeFileSync(path.join(repoRoot,'.gitignore'),'.starciwork/\n');
  fs.mkdirSync(path.join(repoRoot,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repoRoot,'docs','readme.md'),'# docs\n');
  const past=new Date(Date.now()-2*hour).toISOString();
  git(repoRoot,['add','-A']);
  git(repoRoot,['commit','-q','-m','seed'],{GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past});

  const stub=path.join(root,'fake-orca.mjs'),stateFile=path.join(root,'orca-state.json');
  fs.writeFileSync(stub,fakeOrca);
  const machineFile=path.join(machineHome,'machine.sqlite');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_LOCAL_ROOT:machineHome,STARCI_PROJECTS_ROOT:path.join(root,'projects'),[TEST_REGISTRY_ENV]:machineFile};
  delete env.ORCA_TERMINAL_HANDLE;
  const ledgerFile=ledgerFileFor(repoRoot,{env});
  fs.mkdirSync(path.dirname(ledgerFile),{recursive:true});
  openLedger({file:ledgerFile}).close();
  openMachine({file:machineFile}).close();
  const blankLedger=path.join(root,'blank-ledger.sqlite'),blankMachine=path.join(root,'blank-machine.sqlite');
  fs.copyFileSync(ledgerFile,blankLedger);fs.copyFileSync(machineFile,blankMachine);
  const cli=new CliEntryRunner(api,env);
  let ledger=null;

  const reset=({terminal={connected:false,writable:false},dispatchedAgo=minute,leaseExpiresIn=hour,operation=op,payloadExtra={}}={})=>{
    try{ledger?.close();}catch{}
    ledger=null;
    copyDatabase(blankLedger,ledgerFile);copyDatabase(blankMachine,machineFile);
    fs.rmSync(path.join(repoRoot,'docs'),{recursive:true,force:true});
    fs.mkdirSync(path.join(repoRoot,'docs'),{recursive:true});
    fs.writeFileSync(path.join(repoRoot,'docs','readme.md'),'# docs\n');
    fs.rmSync(env.STARCI_FAKE_ORCA_LOG,{force:true});
    fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:terminal?{[handle]:{handle,...structuredClone(terminal)}}:{}}));
    ledger=openLedger({file:ledgerFile});
    const dispatchedAt=Date.now()-dispatchedAgo;
    seedWorkflow(ledger,{id:wf,state:{phase:'running'},goal:{revision:1,markdown:'# self-heal',json:{}},
      jobs:[{jobId,opId:operation,kind:'op',status:'running',dispatchId:handle,workerId:handle,leaseToken:'tok-self-heal',createdAt:dispatchedAt,
        payload:{opId:operation,title:'author the docs',records:['docs/readme.md'],owned_paths:['docs/'],orca:{dispatchId:handle,agentTerminalHandle:handle},
          hierarchy:{runtime:{host:'orca',agent:'codex',dispatchId:handle,terminalHandle:handle}},...payloadExtra}}],
      leases:[{resourceKey:'path:docs/',jobId,expiresAt:Date.now()+leaseExpiresIn}]});
    const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
      .run(attemptId,wf,jobId,'# self-heal contract','{}',dispatchedAt);
    ledger.appendEvent({workflowId:wf,entityType:'job',entityId:jobId,kind:'op-dispatched',payload:{op:operation,dispatch:handle,terminal:handle},createdAt:dispatchedAt});
    const job=(id=jobId)=>ledger.db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(id);
    const jobs=()=>ledger.db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? ORDER BY created_at`).all(wf);
    const leases=()=>ledger.db.prepare('SELECT * FROM leases WHERE job_id=?').all(jobId);
    const events=kind=>ledger.db.prepare('SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND kind=?').all(wf,kind);
    const incidents=()=>ledger.db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open'").all(wf);
    const orcaState=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
    const writeOrca=mutate=>{const state=orcaState();mutate(state);fs.writeFileSync(stateFile,JSON.stringify(state));};
    const run=(...args)=>cli.run([...args,'--repo',repoRoot,'--json']);
    const runFailure=(...args)=>spawnSync(process.execPath,[api,...args,'--repo',repoRoot,'--json'],{cwd:runtimeRoot,encoding:'utf8',windowsHide:true,timeout:120000,env});
    return {repoRoot,ledger,run,runFailure,job,jobs,leases,events,incidents,orcaState,writeOrca,dispatchedAt};
  };
  const close=async()=>{
    try{ledger?.close();}catch{}
    await cli.close();
    fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});
  };
  return {reset,close};
}
