import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../core/yaml.mjs';
import {resolveExecutionChain} from '../../profiles/select.mjs';
import {createOrcaCalls} from '../../execution/orca-calls.mjs';
import {buildReport} from '../../execution/reports.mjs';

/**
 * The kernel test harness: a scripted Orca, a pool allocator and the small helpers a workflow test needs.
 * It is shared so a second kernel spec does not re-script Orca, and it takes the worktree as an argument
 * because a workflow under test does not always live inside this repository.
 */
const calls=parseYaml(fs.readFileSync(new URL('../../providers/orca/calls.yaml',import.meta.url),'utf8'));
const json=(status,value)=>({status,stdout:JSON.stringify(value),stderr:''});
const flag=(args,name)=>{const index=args.indexOf(`--${name}`);return index<0?null:args[index+1];};

/**
 * One scripted Orca for a whole 5.0 workflow: it launches command-terminal (qwen) and managed-agent
 * (claude, codex) operations through the real launcher, and the blocking wait "finishes" each live
 * operation by writing the next report scripted for its operation id.
 */
export function scriptedOrca({reportsDir,scripts,worktree,run='run_wf'}){
  const terminals=new Map(),dispatches=new Map(),tasks=new Map(),live=new Map();
  const taken=new Map();let counter=0;const sends=[];
  const opOf=spec=>(String(spec??'').match(/op `([^`]+)`/)??[null,'unknown'])[1];
  const newHandle=()=>`term_${++counter}`;
  const screenOf=handle=>{
    const terminal=terminals.get(handle);
    if(!terminal)return [];
    return terminal.sent
      ?['∵ Thinking… 1s','⠼ working (12s · esc to cancel)','qwen3.8-flash (Token Plan Singapore)']
      :['>_ Qwen Code (v0.23.3)','>   Type your message or @path/to/file','qwen3.8-flash (Token Plan Singapore)'];
  };
  const handlers={
    'run-show':()=>json(0,{ok:true,result:{run:{id:run,coordinator_handle:'term_kernel'}}}),
    'run-create':()=>json(0,{ok:true,result:{run:{id:run}}}),
    'run-use':()=>json(0,{ok:true,result:{run:{id:run}}}),
    'task-create':args=>{
      const id=`task_${++counter}`;
      tasks.set(id,{id,display_name:flag(args,'display-name'),op:opOf(flag(args,'spec'))});
      return json(0,{ok:true,result:{task:{id,display_name:flag(args,'display-name'),task_id:id}}});
    },
    'task-update':()=>json(0,{ok:true,result:{task:{status:'ready'}}}),
    'task-list':()=>json(0,{ok:true,result:{tasks:[...tasks.values()].map(task=>({id:task.id,display_name:task.display_name}))}}),
    'terminal-create':args=>{
      const handle=newHandle();
      terminals.set(handle,{handle,title:flag(args,'title'),status:'running',sent:false,worktreePath:worktree,lastOutputAt:Date.now()});
      return json(0,{ok:true,result:{terminal:{handle}}});
    },
    'terminal-read':args=>{
      const handle=flag(args,'terminal');
      return json(0,{ok:true,result:{terminal:{handle,status:terminals.get(handle)?.status??'running',tail:screenOf(handle)}}});
    },
    'terminal-send':args=>{const terminal=terminals.get(flag(args,'terminal'));if(terminal)terminal.sent=true;return json(0,{ok:true,result:{}});},
    'terminal-rename':args=>{const terminal=terminals.get(flag(args,'terminal'));if(terminal)terminal.title=flag(args,'title');return json(0,{ok:true,result:{}});},
    'terminal-list':()=>json(0,{ok:true,result:{terminals:[...terminals.values()]}}),
    'terminal-close':args=>{terminals.delete(flag(args,'terminal'));return json(0,{ok:true,result:{}});},
    dispatch:args=>{
      const id=`ctx_${++counter}`,task=flag(args,'task'),handle=flag(args,'to');
      dispatches.set(id,{id,task,handle,op:tasks.get(task)?.op??'unknown'});
      live.set(id,dispatches.get(id));
      return json(0,{ok:true,result:{dispatch:{id,task_id:task},preamble:'=== PREAMBLE ===\nreport once\n=== TASK ===\nDo it'}});
    },
    'dispatch-show':args=>{
      const task=flag(args,'task');
      const found=[...dispatches.values()].find(item=>item.task===task);
      return json(0,{ok:true,result:{dispatch:{id:found?.id,task_id:task,assignee_handle:found?.handle,status:'dispatched'}}});
    },
    'worker-start':args=>{
      const id=`ctx_${++counter}`,handle=newHandle(),task=flag(args,'task');
      const agent=flag(args,'agent'),model=flag(args,'model')??null;
      terminals.set(handle,{handle,title:`Terminal ${counter}`,status:'running',sent:true,worktreePath:worktree,lastOutputAt:Date.now()});
      dispatches.set(id,{id,task,handle,agent,model,op:tasks.get(task)?.op??'unknown'});
      live.set(id,dispatches.get(id));
      return json(0,{ok:true,result:{state:'ready',dispatchId:id,taskId:task,launch:{effective:{agent,model}},
        effects:[{kind:'terminal',role:'agent',id:handle},{kind:'dispatch_input',state:'accepted'}]}});
    },
    'worker-show':args=>{
      const found=dispatches.get(flag(args,'dispatch'));
      if(!found)return json(1,{ok:false,error:{message:'unknown dispatch'}});
      const terminal=terminals.get(found.handle);
      return json(0,{ok:true,result:{dispatch:{id:found.id,task_id:found.task,status:'dispatched'},
        worker:{state:'ready',agent_terminal_handle:found.handle,startOptions:{launch:{effective:{agent:found.agent,model:found.model}}},
          effects:[{kind:'dispatch_input',state:'accepted'}]},
        observation:{exactWorker:true,status:'running'},
        terminal:{title:terminal?.title??null,worktreePath:worktree}}});
    },
    'worker-list':()=>json(0,{ok:true,result:{workers:[...live.values()].map(item=>({dispatchId:item.id,taskId:item.task,
      workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:item.handle}))}}),
    'worker-release':args=>{live.delete(flag(args,'dispatch'));return json(0,{ok:true,result:{dispatchId:flag(args,'dispatch'),state:'released',processAction:'none'}});},
    'worker-stop':args=>json(0,{ok:true,result:{state:'stopped',dispatchId:flag(args,'dispatch')}}),
    check:args=>{
      if(args.includes('--peek'))return json(0,{ok:true,result:{messages:[]}});
      // The blocking wait: every live operation that still has a scripted report finishes now.
      for(const dispatch of live.values()){
        const queue=scripts[dispatch.op];
        const file=path.join(reportsDir,`${dispatch.id}.json`);
        if(!queue?.length||fs.existsSync(file))continue;
        const script=queue.shift();
        const report=buildReport({...script,run,task:dispatch.task,dispatch:dispatch.id,from:dispatch.handle});
        report.sent={messageId:`msg_${dispatch.id}`,sentAt:1,type:report.signal.type};
        fs.mkdirSync(reportsDir,{recursive:true});
        fs.writeFileSync(file,JSON.stringify(report));
        taken.set(dispatch.id,dispatch.op);
      }
      return json(0,{ok:true,result:{deliveryId:`delivery_${counter}`,messages:[]}});
    },
    send:args=>{sends.push(args);return json(0,{ok:true,result:{message:{id:`msg_${++counter}`}}});}
  };
  const spawn=(executable,args)=>{
    const key=args[0]==='terminal'?`terminal-${args[1]}`:args[0]==='agent-context'?'agent-context':args[1];
    const handler=handlers[key];
    if(!handler)throw Error(`Unexpected fake Orca call: ${args.join(' ')}`);
    return handler(args);
  };
  /**
   * Stand in for one launch without the real launcher. The launcher resolves the worktree as a path relative
   * to the process, which a workflow on another drive cannot be; `register` gives the test the same handles
   * the launcher would have produced, so everything after the launch is the kernel's real path.
   */
  const register=op=>{
    const task=`task_${++counter}`,dispatch=`ctx_${++counter}`,handle=newHandle();
    tasks.set(task,{id:task,display_name:`[Operation] ${op}`,op});
    terminals.set(handle,{handle,title:`Terminal ${counter}`,status:'running',sent:true,worktreePath:worktree,lastOutputAt:Date.now()});
    dispatches.set(dispatch,{id:dispatch,task,handle,op});
    live.set(dispatch,dispatches.get(dispatch));
    return {ok:true,task:{id:task},dispatchId:dispatch,terminal:handle,selection:{target:'qwen3.8-flash'}};
  };
  return {orca:createOrcaCalls({executable:'orca-fake',calls,spawn,now:()=>0}),terminals,dispatches,live,sends,register};
}

/** Pools instead of a chain: least-index-free runtime per role, honouring `avoid`. */
export function fakeAllocator({maxParallelOps=3,pools={implement:['qwen3.8-flash','claude-opus','gpt-5.6-sol'],verify:['qwen3.8-flash','claude-fable-5.1','gpt-5.6-sol'],decide:['claude-fable-5.1','gpt-6-astra']}}={}){
  const busy=new Set(),requests=[];
  const roleOf=kind=>kind==='review.verify'?'verify':['architecture.decide','business.decide'].includes(kind)?'decide':'implement';
  return {
    maxParallelOps,requests,
    allocate(kind,{avoid=[]}={}){
      const role=roleOf(kind),free=(pools[role]??[]).filter(id=>!busy.has(id)&&!avoid.includes(id));
      requests.push({kind,role,avoid:[...avoid],chosen:free[0]??null});
      if(!free.length)return {ok:false,reason:`no runtime with a free slot for ${kind}`,avoid};
      busy.add(free[0]);
      return {ok:true,runtime:free[0],target:free[0],role,alternatives:free.slice(1)};
    },
    release(runtime){busy.delete(runtime);},
    failed(runtime){busy.delete(runtime);},
    snapshot(){return {busy:[...busy]};},
    serialize(){return {busy:[...busy]};},
    candidateFor(kind,target){
      const found=resolveExecutionChain({skill:'starci',op:kind}).candidates.find(candidate=>candidate.target===target);
      if(!found)throw Error(`Runtime target ${target} is not launchable for ${kind}`);
      return found;
    }
  };
}

export const passing=(name,command)=>({name,command,exitCode:0,evidence:'ok'});
