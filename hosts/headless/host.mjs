import fs from 'node:fs';
import path from 'node:path';
import {spawn as spawnChild,spawnSync} from 'node:child_process';
import {RESULT_SCHEMA,buildArgs,classifyReceipt,loadOrcaCalls,verifyLiveSchema} from '../orca/calls.mjs';
import {HEADLESS_PROVIDERS} from '../../models/functions.mjs';
import {repositoryRoot} from '../../kernel/reports.mjs';

/**
 * The headless host: the workflow kernel without Orca. It answers the exact call surface the kernel and the
 * launcher issue against Orca (`invoke(name, params, {cwd}) -> starci/orca-call-result@1`), so not one line of
 * the kernel knows which host it runs on, and it backs every call with a child process or a file instead of a
 * multi-agent IDE:
 *
 * - `worker-start` (a managed agent) and `dispatch` (a command terminal) spawn the runtime's own headless
 *   command line from `HEADLESS_PROVIDERS` - `claude -p`, `codex exec`, `qwen` - detached, in the operation's
 *   worktree, with the operation contract on stdin and stdout/stderr in `<root>/<dispatch>.log`;
 * - `send` appends one line to `<root>/mailbox.jsonl`, which is how the launcher's `report` command reaches
 *   the kernel from the child process, and `check` reads that mailbox with the delivery/ack semantics the
 *   protocol's `singleTick` relies on;
 * - terminals are handles in a table, never a pty: a terminal's screen is synthesized from the liveness of the
 *   process it stands for, so the protocol's observer reads `working`, `dead` or `stalled-silent` from facts;
 * - runs, tasks, terminals, dispatches and lane worktrees live in `<root>/table.json`, where `<root>` is
 *   `<workflow store>/headless` once the kernel binds its store and the repository's `_local/headless` before;
 * - lane worktrees are plain `git worktree` operations under `<repo>/.worktrees/lanes/<name>`.
 *
 * What this host cannot do it says so: `account list` (the provider quota Orca reads) is `unsupported`, never a
 * throw, and the host declares no capability, so an operation kind whose catalog entry `needs` one (the design
 * tool behind `interface.draw`) is refused at schedule time instead of being launched into a process that has
 * no tool to draw with. The host also runs strictly sequentially - see `sequential` - because one chat drives
 * one workflow and there is no terminal to supervise a second process from.
 */
export const HEADLESS_TABLE='starci/headless-table@1';
export const HEADLESS_HOST=Object.freeze({name:'headless',capabilities:Object.freeze([]),sequential:true});
/** The environment the kernel sets on every child it spawns, so the child's own `report` finds the same host. */
export const HOST_ENV='STARCI_HOST';
export const HEADLESS_ROOT_ENV='STARCI_HEADLESS_ROOT';
export const HEADLESS_DISPATCH_ENV='STARCI_HEADLESS_DISPATCH';
/** Calls Orca has and this host cannot answer: the result is `unsupported` with a reason, never an exception. */
export const UNSUPPORTED_CALLS=Object.freeze(['account-list']);
/**
 * A headless process prints nothing until its turn ends, so output is no proof of life and a hung process is
 * indistinguishable from a working one. The wall-time bound is the one signal this host can give: past it the
 * synthesized screen stops claiming activity and the kernel's observer settles the worker as stalled. It is the
 * same 90 minutes the Orca qwen command line carries as `--max-wall-time`.
 */
export const DEFAULT_MAX_WALL_MS=90*60*1000;
/** The Orca agent ids the launcher hands over, and the headless command family each one is. */
export const HEADLESS_AGENTS=Object.freeze({
  claude:{executable:'claude',default:'claude-opus'},
  codex:{executable:'codex',default:'gpt-5.6-sol'},
  qwen:{executable:'qwen',default:'qwen3.8-flash'}
});
const HEADLESS_TERMINAL_STATUS={live:'running',exited:'exited'};

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const csv=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
const iso=ms=>new Date(ms).toISOString();
const slash=value=>String(value??'').replaceAll('\\','/');
const sleepSync=ms=>{if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};
const okReceipt=result=>({ok:true,result});
const failReceipt=(message,code='headless_refused')=>({ok:false,error:{code,message}});

/** A pid that exists is alive; EPERM means it exists and belongs to somebody else, which is still alive. */
export function pidAlive(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}
}
/** Kill a detached child and everything it started: the shell wrapper on Windows, the process group elsewhere. */
export function killTree(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  if(process.platform==='win32'){
    const result=spawnSync('taskkill',['/PID',String(pid),'/T','/F'],{encoding:'utf8',windowsHide:true});
    return result.status===0;
  }
  try{process.kill(-pid);return true;}catch{}
  try{process.kill(pid);return true;}catch{return false;}
}

/** The `--model` a command line names, or null. */
const modelOf=command=>{const words=Array.isArray(command)?command:String(command??'').split(/\s+/);const at=words.indexOf('--model');return at>=0?words[at+1]??null:null;};

/**
 * Which headless command runs an operation: the launcher names an Orca agent (`claude`, `codex`) and a model for a
 * managed agent, or a whole terminal command (`qwen --model ...`) for a command terminal. Both are mapped onto
 * the one entry of `HEADLESS_PROVIDERS` that has the same executable and the same `--model`. An agent asked for
 * with no model runs its family's command line with the `--model` pair removed - the agent's own default model,
 * which is exactly what an Orca `worker-start` without `--model` launches - and reports `model: null` back, so
 * the launcher's attestation reads the same identity on both hosts. `null` when no headless command exists for
 * the request, which the caller reports as a failed launch - never a guessed substitute.
 */
export function providerFor({agent=null,model=null,command=null}={},providers=HEADLESS_PROVIDERS){
  const words=String(command??'').split(/\s+/).filter(Boolean);
  const family=agent??words.find(word=>Object.hasOwn(HEADLESS_AGENTS,word))??null;
  const executable=HEADLESS_AGENTS[family]?.executable;
  if(!executable)return null;
  const wanted=model??modelOf(words);
  const entries=Object.entries(providers).filter(([,spec])=>spec?.command?.[0]===executable);
  const hit=wanted?entries.find(([id,spec])=>id===wanted||modelOf(spec.command)===wanted):entries.find(([id])=>id===HEADLESS_AGENTS[family].default);
  if(!hit)return null;
  if(wanted)return {id:hit[0],family,executable,model:modelOf(hit[1].command),command:[...hit[1].command]};
  const at=hit[1].command.indexOf('--model');
  return {id:hit[0],family,executable,model:null,command:at<0?[...hit[1].command]:[...hit[1].command.slice(0,at),...hit[1].command.slice(at+2)]};
}

/**
 * Where the host keeps its files. The kernel binds its workflow store, so the table, the mailbox and every
 * dispatch log sit beside the workflow's own events; a child process finds that same directory through the
 * environment the kernel gave it, and a `report` run by hand finds it beside the `--reports-dir` it was given.
 * Before any of those is known (a lane opened at goal time) the repository's `_local/headless` is the root.
 */
export function headlessRoot({cwd=process.cwd(),root=null,storeDir=null,reportsDir=null,env=process.env}={}){
  if(root)return path.resolve(root);
  if(storeDir)return path.join(path.resolve(storeDir),'headless');
  if(text(env?.[HEADLESS_ROOT_ENV]))return path.resolve(env[HEADLESS_ROOT_ENV]);
  if(reportsDir)return path.join(path.dirname(path.resolve(cwd,reportsDir)),'headless');
  return path.join(repositoryRoot(path.resolve(cwd)),'.starciwork','_local','headless');
}

/** `path:<p>` and `id:headless::<p>` both name a directory; a bare value is taken as one. */
export function selectorPath(selector){
  const value=String(selector??'').trim();
  if(value.startsWith('path:'))return path.resolve(value.slice(5));
  if(value.startsWith('id:'))return path.resolve(value.slice(3).replace(/^headless::/,''));
  return path.resolve(value.replace(/^headless::/,''));
}

/**
 * The preamble every child reads before the contract. It is what the Orca dispatch preamble carries - the ids the
 * report command needs - plus the two things a headless process must know: there is no `orca` here, so the
 * heartbeat ping of the contract is not owed, and the report command works unchanged because the environment
 * already selects this host.
 */
export function headlessPreamble({run,task,dispatch,terminal,displayName,provider}){
  return [
    '=== HEADLESS PREAMBLE ===',
    `Host: headless (one chat = one workflow). You are ${displayName??'an operation agent'} of run ${run}, running as ${provider} in this working directory.`,
    `Task id: ${task}. Dispatch id: ${dispatch}. Your terminal handle: ${terminal} (a handle in the host table; there is no Orca terminal behind it).`,
    'There is no `orca` command on this host. Skip the heartbeat ping of the contract: the host reads the liveness of your process instead. Every other rule of the contract binds you exactly as written.',
    'Report exactly once, at the end, with the report command in your contract and these ids; STARCI_HOST=headless is set in your environment, so that command reaches the kernel through the host mailbox.',
    '=== TASK ===',''
  ].join('\n');
}

export function createHeadlessHost({cwd=process.cwd(),root=null,env=process.env,calls=loadOrcaCalls(),providers=HEADLESS_PROVIDERS,
  spawn=spawnChild,alive=pidAlive,kill=killTree,git=spawnSync,now=Date.now,sleep=sleepSync,pollMs=1000,maxWallMs=DEFAULT_MAX_WALL_MS}={}){
  need(plain(calls)&&calls.schema==='starci/orca-calls@1','Orca calls contract starci/orca-calls@1 is required');
  let rootDir=headlessRoot({cwd,root,env});
  /** Exit codes the event loop delivered; merged into the table the next time it is read. */
  const exits=new Map();
  const tablePath=()=>path.join(rootDir,'table.json');
  const mailboxPath=()=>path.join(rootDir,'mailbox.jsonl');
  const emptyTable=()=>({schema:HEADLESS_TABLE,counter:0,runs:{},tasks:{},terminals:{},dispatches:{},worktrees:{},deliveries:{}});
  const nextId=(table,prefix)=>`${prefix}_h${++table.counter}`;
  const live=record=>plain(record)&&Number.isInteger(record.pid)&&!record.endedAt&&!record.stopped&&alive(record.pid);
  const age=record=>now()-Number(record?.startedAt??now());
  const withinWall=record=>age(record)<=maxWallMs;
  /**
   * Read the table and observe every dispatch in it: an exit the loop delivered or a pid that is gone is recorded
   * once, so every reader of a worker - the kernel, a `wait` run by hand - sees the same fact.
   */
  function load(){
    let table=emptyTable();
    try{const parsed=JSON.parse(fs.readFileSync(tablePath(),'utf8'));if(parsed?.schema===HEADLESS_TABLE)table={...emptyTable(),...parsed};}catch{table=emptyTable();}
    let changed=false;
    for(const record of Object.values(table.dispatches)){
      const exit=exits.get(record.id);
      if(exit&&record.exitCode===null){record.exitCode=exit.code??null;record.endedAt=record.endedAt??exit.at;record.lastError=exit.error??record.lastError??null;changed=true;}
      if(!record.endedAt&&Number.isInteger(record.pid)&&!alive(record.pid)){record.endedAt=now();changed=true;}
    }
    if(changed)save(table);
    return table;
  }
  function save(table){
    fs.mkdirSync(rootDir,{recursive:true});
    const tmp=`${tablePath()}.${process.pid}.${Math.random().toString(16).slice(2,8)}.tmp`;
    fs.writeFileSync(tmp,`${JSON.stringify(table,null,2)}\n`);
    fs.renameSync(tmp,tablePath());
  }
  const mutate=fn=>{const table=load();const out=fn(table);save(table);return out;};
  function readMailbox(){
    let body='';try{body=fs.readFileSync(mailboxPath(),'utf8');}catch{return [];}
    return body.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(plain);
  }
  const logTail=(file,lines)=>{try{return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(-lines);}catch{return [];}};
  const logMtime=file=>{try{return Math.round(fs.statSync(file).mtimeMs);}catch{return 0;}};

  /** The screen a terminal would show, made of the facts this host has: the process behind it and its log. */
  function screenOf(table,terminal){
    const record=terminal.dispatch?table.dispatches[terminal.dispatch]:null;
    if(!record){
      if(String(terminal.title??'').startsWith('[Kernel]'))return [`[headless] kernel terminal ${terminal.handle}`];
      return [`[headless] terminal ${terminal.handle} ready`,'Type your message or @path/to/file',modelOf(terminal.command)??''].filter(Boolean);
    }
    if(!live(record))return [`[headless] ${record.provider} exited${record.exitCode===null?'':` ${record.exitCode}`}`,...logTail(record.log,5)];
    if(!withinWall(record))return [`[headless] ${record.provider} pid ${record.pid} past the wall-time bound after ${Math.round(age(record)/60000)} min with no report`];
    // The busy markers of every family at once: the observer has no footer to read, only the fact that the process runs.
    return [`[headless] ${record.provider} pid ${record.pid} running for ${Math.round(age(record)/60000)} min (esc to interrupt, esc to cancel)`,record.model??record.provider];
  }
  const terminalStatus=(table,terminal)=>{const record=terminal.dispatch?table.dispatches[terminal.dispatch]:null;return record&&!live(record)?HEADLESS_TERMINAL_STATUS.exited:HEADLESS_TERMINAL_STATUS.live;};
  /** Output time is the log when the process is gone or past its bound; a live process inside the bound is current. */
  const lastOutputAt=(table,terminal)=>{
    const record=terminal.dispatch?table.dispatches[terminal.dispatch]:null;
    if(!record)return terminal.createdAt??now();
    return live(record)&&withinWall(record)?now():Math.max(logMtime(record.log),Number(record.startedAt??0));
  };
  const terminalRow=(table,terminal)=>({handle:terminal.handle,title:terminal.title??null,status:terminalStatus(table,terminal),worktreePath:terminal.worktreePath??null,lastOutputAt:lastOutputAt(table,terminal),command:terminal.command??null,dispatch:terminal.dispatch??null});
  const workerState=record=>record.released?'released':record.stopped?'stopped':live(record)?'running':'exited';
  const dispatchStatus=record=>record.released?'completed':record.stopped?'failed':'dispatched';
  const liveDispatches=(table,run)=>Object.values(table.dispatches).filter(record=>(!run||record.run===run)&&live(record)&&withinWall(record));

  /**
   * Spawn the headless command of one dispatch, detached, contract on stdin, output to the dispatch log. Returns
   * the record and the one prompt the process was given, which is also what a command-terminal dispatch hands
   * back as its preamble: one text, written once.
   */
  function launch(table,{run,task,terminal,provider,agent,launchKind,at,displayName}){
    const id=nextId(table,'ctx');
    fs.mkdirSync(rootDir,{recursive:true});
    const log=path.join(rootDir,`${id}.log`),promptFile=path.join(rootDir,`${id}.prompt.md`);
    const record=table.tasks[task];
    // The contract ends with a newline on stdin exactly as it does in the prompt file: a provider reads its last line either way.
    const body=`${headlessPreamble({run,task,dispatch:id,terminal:terminal.handle,displayName:displayName??record?.display_name??null,provider:provider.id})}${record?.spec??''}`;
    const prompt=body.endsWith('\n')?body:`${body}\n`;
    fs.writeFileSync(promptFile,prompt);
    let fd=null;
    try{fd=fs.openSync(log,'a');fs.writeSync(fd,`=== headless ${provider.id} ${iso(now())} cwd ${slash(at)}\n`);}catch{fd=null;}
    const [executable,...args]=provider.command;
    // Permissions are exactly what the runtime's own headless calls carry on this command line and nothing more:
    // the operation runs under its contract allowlist in the workflow's worktree, as it does under Orca.
    const child=spawn(executable,args,{cwd:at,detached:true,stdio:['pipe',fd??'ignore',fd??'ignore'],windowsHide:true,shell:process.platform==='win32',
      env:{...env,[HOST_ENV]:'headless',[HEADLESS_ROOT_ENV]:rootDir,[HEADLESS_DISPATCH_ENV]:id}});
    if(fd!==null){try{fs.closeSync(fd);}catch{}}
    try{child.stdin?.write(prompt);child.stdin?.end();}catch{}
    child.on?.('exit',code=>{exits.set(id,{code,at:now()});});
    child.on?.('error',error=>{exits.set(id,{code:null,error:String(error?.message??error),at:now()});});
    child.unref?.();
    table.dispatches[id]={id,run,task,terminal:terminal.handle,agent,model:provider.model,provider:provider.id,pid:child.pid??null,startedAt:now(),
      log,prompt:promptFile,cwd:at,exitCode:null,endedAt:null,lastError:null,stopped:false,released:false,launch:launchKind};
    terminal.dispatch=id;
    return {record:table.dispatches[id],prompt};
  }
  const stopRecord=record=>{
    const wasLive=live(record);
    const killed=wasLive?kill(record.pid):false;
    record.stopped=true;record.endedAt=record.endedAt??now();
    return {wasLive,killed};
  };

  const handlers={
    status:()=>okReceipt({runtime:{state:'headless',host:HEADLESS_HOST.name}}),
    'agent-context':()=>{
      // The command registry Orca would print, derived from the contract itself: `verify` on this host passes for
      // every call the contract declares, which is the truth - this host answers exactly those.
      const commands=Object.values(calls.calls).map(call=>({command:call.command,flags:[...call.flags,calls.defaults.jsonFlag,...(call.kind==='mutation'&&(call.replay??'retry-request')==='retry-request'?[calls.idempotency.flag]:[])]}));
      return {ok:true,schemaVersion:calls.liveSchema.schemaVersion,commandCount:commands.length,commands,host:HEADLESS_HOST.name};
    },
    'run-create':params=>mutate(table=>{
      const id=nextId(table,'run');
      table.runs[id]={id,objective:params.objective,coordinator:params.from??null,createdAt:now()};
      return okReceipt({run:{id,objective:params.objective,coordinator_handle:params.from??null}});
    }),
    'run-use':params=>mutate(table=>{
      const run=table.runs[params.id];
      if(!run)return failReceipt(`unknown run ${params.id}`,'run_unknown');
      run.coordinator=params.from??run.coordinator;
      return okReceipt({run:{id:run.id,coordinator_handle:run.coordinator}});
    }),
    'run-show':params=>{
      const run=load().runs[params.id];
      return run?okReceipt({run:{id:run.id,objective:run.objective,coordinator_handle:run.coordinator}}):failReceipt(`unknown run ${params.id}`,'run_unknown');
    },
    'task-create':params=>mutate(table=>{
      const id=nextId(table,'task');
      table.tasks[id]={id,run:params.run,display_name:params['display-name']??null,title:params['task-title']??null,spec:params.spec,status:'ready',createdAt:now()};
      return okReceipt({task:{id,task_id:id,display_name:table.tasks[id].display_name,title:table.tasks[id].title,status:'ready',run:params.run}});
    }),
    'task-update':params=>mutate(table=>{
      const task=table.tasks[params.id];
      if(!task)return failReceipt(`unknown task ${params.id}`,'task_unknown');
      task.status=params.status;
      return okReceipt({task:{id:task.id,status:task.status}});
    }),
    'task-list':params=>okReceipt({tasks:Object.values(load().tasks).filter(task=>!params.run||task.run===params.run).map(task=>({id:task.id,display_name:task.display_name,status:task.status}))}),
    'terminal-create':params=>mutate(table=>{
      const handle=nextId(table,'term');
      table.terminals[handle]={handle,title:params.title,command:params.command,worktreePath:selectorPath(params.worktree),createdAt:now(),dispatch:null};
      return okReceipt({terminal:{handle,title:params.title}});
    }),
    'terminal-list':()=>{const table=load();return okReceipt({terminals:Object.values(table.terminals).map(terminal=>terminalRow(table,terminal))});},
    'terminal-read':params=>{
      const table=load();const terminal=table.terminals[params.terminal];
      if(!terminal)return failReceipt(`unknown terminal ${params.terminal}`,'terminal_unknown');
      return okReceipt({terminal:{...terminalRow(table,terminal),tail:screenOf(table,terminal),source:'headless'}});
    },
    'terminal-send':params=>{
      const table=load();const terminal=table.terminals[params.terminal];
      if(!terminal)return failReceipt(`unknown terminal ${params.terminal}`,'terminal_unknown');
      const record=terminal.dispatch?table.dispatches[terminal.dispatch]:null;
      // A headless process reads stdin once, at its start: text typed later reaches nothing, and saying so is what
      // lets the kernel record an answer as undelivered instead of believing a screen.
      if(record&&!live(record))return failReceipt(`the process behind ${params.terminal} has exited; nothing reads what is sent to it`,'terminal_exited');
      return okReceipt({terminal:params.terminal,accepted:record?false:true,reason:record?'a running headless process reads no terminal input':null});
    },
    'terminal-rename':params=>mutate(table=>{
      const terminal=table.terminals[params.terminal];
      if(!terminal)return failReceipt(`unknown terminal ${params.terminal}`,'terminal_unknown');
      terminal.title=params.title;
      return okReceipt({terminal:{handle:terminal.handle,title:terminal.title}});
    }),
    'terminal-close':params=>mutate(table=>{
      const terminal=table.terminals[params.terminal];
      if(!terminal)return failReceipt(`unknown terminal ${params.terminal}`,'terminal_unknown');
      // The terminal is the process here: closing it while the process runs ends the process, as Orca would.
      const record=terminal.dispatch?table.dispatches[terminal.dispatch]:null;
      const stopped=record?stopRecord(record):null;
      delete table.terminals[params.terminal];
      return okReceipt({terminal:params.terminal,closed:true,processAction:stopped?.killed?'killed':'none'});
    }),
    dispatch:params=>mutate(table=>{
      const task=table.tasks[params.task],terminal=table.terminals[params.to];
      if(!task)return failReceipt(`unknown task ${params.task}`,'task_unknown');
      if(!terminal)return failReceipt(`unknown terminal ${params.to}`,'terminal_unknown');
      if(terminal.dispatch)return failReceipt(`terminal ${params.to} already carries dispatch ${terminal.dispatch}`,'terminal_busy');
      const provider=providerFor({command:terminal.command},providers);
      if(!provider)return failReceipt(`no headless command for the terminal command "${String(terminal.command??'').slice(0,120)}"`,'headless_no_provider');
      const {record,prompt}=launch(table,{run:params.run??task.run,task:task.id,terminal,provider,agent:provider.family,launchKind:'command-terminal',at:terminal.worktreePath,displayName:task.display_name});
      // The preamble the launcher would type into the terminal is the prompt the process already read on stdin.
      return okReceipt({dispatch:{id:record.id,task_id:task.id,assignee_handle:terminal.handle,status:'dispatched'},preamble:prompt});
    }),
    'dispatch-show':params=>{
      const table=load();
      const found=Object.values(table.dispatches).filter(record=>record.task===params.task).at(-1);
      if(!found)return failReceipt(`no dispatch for task ${params.task}`,'dispatch_unknown');
      return okReceipt({dispatch:{id:found.id,task_id:found.task,assignee_handle:found.terminal,status:dispatchStatus(found)}});
    },
    'worker-start':params=>mutate(table=>{
      const task=table.tasks[params.task];
      if(!task)return failReceipt(`unknown task ${params.task}`,'task_unknown');
      const provider=providerFor({agent:params.agent,model:params.model??null},providers);
      if(!provider)return failReceipt(`no headless command for agent ${params.agent}${params.model?` model ${params.model}`:''}`,'headless_no_provider');
      const handle=nextId(table,'term');
      const terminal=table.terminals[handle]={handle,title:`Terminal ${table.counter}`,command:provider.command.join(' '),worktreePath:selectorPath(params.worktree),createdAt:now(),dispatch:null};
      const {record}=launch(table,{run:params.run,task:task.id,terminal,provider,agent:params.agent,launchKind:'managed-agent',at:terminal.worktreePath,displayName:params['display-name']??task.display_name});
      return okReceipt({state:'ready',runId:params.run,taskId:task.id,dispatchId:record.id,launch:{effective:{agent:params.agent,model:provider.model}},
        effects:[{kind:'terminal',role:'agent',id:handle},{kind:'dispatch_input',state:'accepted'}]});
    }),
    'worker-show':params=>{
      const table=load();const record=table.dispatches[params.dispatch];
      if(!record)return failReceipt(`unknown dispatch ${params.dispatch}`,'dispatch_unknown');
      const terminal=table.terminals[record.terminal]??null;
      return okReceipt({dispatch:{id:record.id,task_id:record.task,status:dispatchStatus(record)},
        worker:{state:workerState(record),agent_terminal_handle:record.terminal,pid:record.pid,startOptions:{launch:{effective:{agent:record.agent,model:record.model}}},
          effects:[{kind:'dispatch_input',state:'accepted'}],last_error:record.lastError??null,exitCode:record.exitCode},
        observation:{exactWorker:true,status:live(record)?'running':'exited'},
        terminal:{handle:record.terminal,title:terminal?.title??null,worktreePath:record.cwd}});
    },
    'worker-read':params=>{
      const record=load().dispatches[params.dispatch];
      if(!record)return failReceipt(`unknown dispatch ${params.dispatch}`,'dispatch_unknown');
      return okReceipt({dispatch:record.id,log:record.log,lines:logTail(record.log,Number(params.limit??50))});
    },
    'worker-list':params=>{
      // A dispatch stays listed until the kernel releases it - the exited one included - because the kernel is what
      // settles a dead worker, and it can only settle what it is shown.
      const rows=Object.values(load().dispatches).filter(record=>(!params.run||record.run===params.run)&&!record.released)
        .map(record=>({dispatchId:record.id,taskId:record.task,runId:record.run,workerState:record.stopped?'stopped':'unsupervised',dispatchStatus:dispatchStatus(record),agentTerminalHandle:record.terminal,pid:record.pid,alive:live(record)}));
      return okReceipt({workers:rows});
    },
    'worker-stop':params=>mutate(table=>{
      const record=table.dispatches[params.dispatch];
      if(!record)return failReceipt(`unknown dispatch ${params.dispatch}`,'dispatch_unknown');
      const {wasLive,killed}=stopRecord(record);
      return okReceipt({dispatchId:record.id,state:'stopped',alreadySettled:!wasLive,processAction:killed?'killed':'none'});
    }),
    'worker-release':params=>mutate(table=>{
      const record=table.dispatches[params.dispatch];
      if(!record)return failReceipt(`unknown dispatch ${params.dispatch}`,'dispatch_unknown');
      const already=record.released;
      if(live(record))stopRecord(record);
      record.released=true;
      return okReceipt({dispatchId:record.id,state:already?'already_released':'released',processAction:'none'});
    }),
    'worker-abandon':params=>mutate(table=>{
      const record=table.dispatches[params.dispatch];
      if(!record)return failReceipt(`unknown dispatch ${params.dispatch}`,'dispatch_unknown');
      record.stopped=true;record.released=true;record.endedAt=record.endedAt??now();
      return okReceipt({dispatchId:record.id,state:'abandoned'});
    }),
    check:params=>{
      const table=load();
      const types=csv(params.types),run=params.run??null;
      let changed=false;
      if(params.ack){for(const entry of Object.values(table.deliveries))if(entry.delivery===params.ack&&!entry.acked){entry.acked=true;changed=true;}}
      const unread=()=>readMailbox().filter(message=>(!run||message.run===run)&&(!types.length||types.includes(message.type))&&!table.deliveries[message.id]?.acked);
      const shape=message=>({id:message.id,type:message.type,subject:message.subject??'',body:message.body??'',payload:message.payload??'{}',created_at:message.created_at,from:message.from??null,to:message.to??null});
      if(params.peek){
        // A ping per live process: liveness is the heartbeat this host can vouch for, and it is peeked, never acked.
        const pings=!types.length||types.includes('heartbeat')?liveDispatches(table,run).map(record=>({id:`ping_${record.id}_${now()}`,type:'heartbeat',subject:'alive',body:'',created_at:iso(now()),from:record.terminal,to:null,payload:JSON.stringify({dispatchId:record.id,taskId:record.task,phase:'process alive',pid:record.pid})})):[];
        if(changed)save(table);
        return okReceipt({messages:[...unread().map(shape),...pings]});
      }
      let messages=unread();
      if(!messages.length&&params.wait){
        const timeout=Math.max(0,Number(params['timeout-ms']??0)),started=now();
        const watched=liveDispatches(table,run).map(record=>record.id);
        // Bounded by the clock and by a count, so an injected clock or sleep can never turn the wait into a spin.
        for(let round=0;round<Math.ceil(timeout/pollMs)+1&&now()-started<timeout;round+=1){
          sleep(Math.min(pollMs,Math.max(1,timeout-(now()-started))));
          messages=unread();
          if(messages.length)break;
          // A process that ended is a boundary too: the kernel's tick reads it as dead now, instead of waiting the
          // whole timeout for a report that will not come.
          const fresh=load();
          if(watched.some(id=>!live(fresh.dispatches[id])))break;
        }
      }
      let deliveryId=null;
      if(messages.length){deliveryId=nextId(table,'delivery');for(const message of messages)table.deliveries[message.id]={delivery:deliveryId,acked:false};changed=true;}
      if(changed){
        // The wait observed processes through fresh reads; what it learned about them is kept, the acks and the new
        // delivery are this call's, and the counter never goes backwards.
        const fresh=load();
        table.dispatches=fresh.dispatches;table.counter=Math.max(table.counter,fresh.counter);
        save(table);
      }
      return okReceipt({deliveryId,messages:messages.map(shape)});
    },
    send:params=>{
      fs.mkdirSync(rootDir,{recursive:true});
      const id=`msg_h${now().toString(36)}${Math.random().toString(16).slice(2,8)}`;
      const payload=params.payload??JSON.stringify({dispatchId:params['dispatch-id']??null,taskId:params['task-id']??null,outcome:params.outcome??null,
        reportPath:params['report-path']??null,phase:params.phase??null,filesModified:params['files-modified']??null,capability:params['dispatch-capability']??null});
      const message={id,run:params.run??null,from:params.from??null,to:params.to??null,type:params.type??'note',subject:params.subject,body:params.body??'',payload,
        priority:params.priority??null,threadId:params['thread-id']??null,created_at:iso(now())};
      fs.appendFileSync(mailboxPath(),`${JSON.stringify(message)}\n`);
      return okReceipt({message:{id,type:message.type},messageId:id});
    },
    reply:params=>handlers.send({subject:`re: ${params.id}`,body:params.body,run:params.run,from:params.from,type:'reply','thread-id':params.id}),
    'worktree-create':params=>mutate(table=>{
      const repo=selectorPath(params.repo),name=text(params.name);
      if(!name)return failReceipt('a lane needs a name','worktree_name');
      const dir=path.join(repo,'.worktrees','lanes',name);
      if(fs.existsSync(dir))return failReceipt(`worktree ${slash(dir)} already exists`,'worktree_exists');
      const branch=`workflow/${name}`;
      const args=['worktree','add','-b',branch,dir,...(params['base-branch']?[params['base-branch']]:[])];
      const result=git('git',args,{cwd:repo,encoding:'utf8',windowsHide:true});
      if(result.status!==0)return failReceipt(`git worktree add failed: ${String(result.stderr??result.error?.message??'').trim().slice(0,300)}`,'git_failed');
      const row={id:`headless::${slash(dir)}`,path:dir,branch,repo,name,displayName:null,workspaceStatus:null,createdAt:now()};
      table.worktrees[dir]=row;
      return okReceipt({worktree:{id:row.id,path:dir,branch:`refs/heads/${branch}`,name}});
    }),
    'worktree-set':params=>mutate(table=>{
      const dir=selectorPath(params.worktree);
      const row=table.worktrees[dir]??(fs.existsSync(dir)?(table.worktrees[dir]={id:`headless::${slash(dir)}`,path:dir,branch:null,repo:null,name:path.basename(dir),displayName:null,workspaceStatus:null,createdAt:now()}):null);
      if(!row)return failReceipt(`unknown worktree ${slash(dir)}`,'worktree_unknown');
      if(params['display-name']!==undefined)row.displayName=params['display-name'];
      if(params['workspace-status']!==undefined)row.workspaceStatus=params['workspace-status'];
      if(params['parent-worktree']!==undefined)row.parent=selectorPath(params['parent-worktree']);
      if(params['no-parent'])row.parent=null;
      return okReceipt({worktree:{...row}});
    }),
    'worktree-show':params=>{
      const dir=selectorPath(params.worktree);
      const row=load().worktrees[dir];
      if(!row&&!fs.existsSync(dir))return failReceipt(`unknown worktree ${slash(dir)}`,'worktree_unknown');
      const head=git('git',['rev-parse','--abbrev-ref','HEAD'],{cwd:dir,encoding:'utf8',windowsHide:true});
      const branch=head.status===0?String(head.stdout??'').trim():row?.branch??null;
      return okReceipt({worktree:{id:row?.id??`headless::${slash(dir)}`,path:dir,branch,displayName:row?.displayName??null,workspaceStatus:row?.workspaceStatus??null,parentWorktreeId:row?.parent?`headless::${slash(row.parent)}`:null}});
    },
    'worktree-rm':params=>mutate(table=>{
      const dir=selectorPath(params.worktree);
      const row=table.worktrees[dir]??null;
      const repo=row?.repo??repositoryRoot(dir);
      const branch=row?.branch??(()=>{const head=git('git',['rev-parse','--abbrev-ref','HEAD'],{cwd:dir,encoding:'utf8',windowsHide:true});return head.status===0?String(head.stdout??'').trim():null;})();
      const result=git('git',['worktree','remove',...(params.force?['--force']:[]),dir],{cwd:repo,encoding:'utf8',windowsHide:true});
      if(result.status!==0)return failReceipt(`git worktree remove failed: ${String(result.stderr??result.error?.message??'').trim().slice(0,300)}`,'git_failed');
      delete table.worktrees[dir];
      return okReceipt({removed:dir,preservedBranch:branch?`refs/heads/${branch}`:null});
    }),
    'worktree-current':(params,{cwd:at})=>okReceipt({worktree:{id:`headless::${slash(at)}`,path:at}})
  };

  /**
   * The typed envelope every caller reads. Parameters are validated against the same calls contract Orca's runner
   * uses (an undeclared flag throws here exactly as it would there), the receipt is classified by the same rules,
   * and a call this host has no answer for is `unsupported` with a reason.
   */
  function invoke(name,params={},{cwd:at=cwd}={}){
    if(UNSUPPORTED_CALLS.includes(name)){
      return {schema:RESULT_SCHEMA,call:name,command:name.replace('-',' '),kind:'read',args:[],exitCode:null,outcome:'unsupported',effectState:'none',
        reason:`the headless host has no ${name.replace('-',' ')}: it reads no provider account, so the budget is not probed here`,stage:null,residualResources:[],recovery:null,receipt:null,attempts:[]};
    }
    const call=calls.calls?.[name];
    need(plain(call),`Unknown Orca call: ${name}`);
    const args=buildArgs(calls,name,params);
    const handler=handlers[name];
    need(typeof handler==='function',`The headless host does not implement ${name}`);
    let receipt;
    try{receipt=handler(params,{cwd:path.resolve(at)});}
    catch(error){receipt=failReceipt(String(error?.message??error),'headless_error');}
    const exitCode=receipt?.ok===false?1:0;
    const classified=classifyReceipt(calls,name,{exitCode,receipt});
    return {schema:RESULT_SCHEMA,call:name,command:call.command,kind:call.kind,args,exitCode,...classified,receipt,
      attempts:[{args,exitCode,durationMs:0,stderr:'',receipt,...classified}]};
  }
  function verify(){
    const context=invoke('agent-context',{});
    if(context.outcome!=='ok')return {ok:false,errors:[`agent-context failed: ${context.reason}`],commandCount:0,result:context};
    return {...verifyLiveSchema(calls,context.receipt),result:context};
  }
  return {
    calls,host:HEADLESS_HOST,executable:null,invoke,verify,
    /** Where the table, the mailbox and the logs are right now. */
    root:()=>rootDir,
    /** The kernel binds its workflow store so the host's files live beside the workflow's own. */
    bindStore(storeDir){rootDir=headlessRoot({storeDir});return rootDir;},
    /** What the supervisor's budget probe gets on this host: a reason, and the last written budget stands. */
    probeBudget(){const result=invoke('account-list',{});return {ok:false,reason:result.reason};}
  };
}
