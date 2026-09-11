import {readDistJson} from '../core/runtime-root.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const add=(errors,condition,message)=>{if(!condition)errors.push(message);};
const readProviderRef=reference=>{
  if(typeof reference!=='string'||!reference.endsWith('.json')||reference.includes('..'))throw Error(`Invalid provider reference: ${reference}`);
  return readDistJson('providers',...reference.split('/'));
};

/** Load the compiled provider catalog and every contract referenced by one provider. */
export function loadProviderContract(provider){
  const catalog=readDistJson('providers','catalog.json');
  const entry=catalog?.providers?.[provider];
  if(!plain(entry))throw Error(`Unknown provider: ${provider}`);
  const loaded={catalog};
  for(const [name,reference] of Object.entries(entry)){
    if(name==='adapters'){
      loaded.adapters={};
      for(const [adapter,adapterReference] of Object.entries(reference))loaded.adapters[adapter]=readProviderRef(adapterReference);
    }else loaded[name]=readProviderRef(reference);
  }
  return loaded;
}

/** Validate the executable provider tree before an operation launch is planned. */
export function validateProviderContracts(){
  const errors=[];
  const catalog=readDistJson('providers','catalog.json');
  add(errors,catalog?.schema==='starci/provider-catalog@1','Unsupported provider catalog');
  add(errors,catalog?.selection?.orchestrated==='orca','Orchestrated mode must resolve to Orca');
  add(errors,Array.isArray(catalog?.selection?.solo)&&['codex','claude','orca'].every(value=>catalog.selection.solo.includes(value)),'Solo provider selection is incomplete');
  let orca,codex,claude;
  try{orca=loadProviderContract('orca');codex=loadProviderContract('codex');claude=loadProviderContract('claude');}
  catch(error){errors.push(error.message);return {ok:false,errors};}

  add(errors,orca.index?.schema==='starci/orca-provider@1','Missing Orca provider index');
  add(errors,orca.index?.names?.planCoordinator==='[Coordinator] <Plan>','Invalid Orca Plan Coordinator name');
  add(errors,orca.index?.names?.workflowWorktree==='[Workflow] <Workflow>','Invalid Orca workflow worktree name');
  add(errors,orca.index?.names?.workflowCoordinator==='[Coordinator] <Workflow>','Invalid Orca Workflow Coordinator name');
  add(errors,orca.index?.names?.operationAgent==='[Op] <operation> - <scope>','Invalid Orca operation name');
  const commands=orca.api?.publicCommands;
  add(errors,Array.isArray(commands)&&commands.length===orca.api?.snapshot?.observedCommandCount,'Orca API inventory count mismatch');
  add(errors,Array.isArray(commands)&&new Set(commands).size===commands.length,'Orca API inventory contains duplicates');
  const publicCommands=new Set(commands||[]);
  for(const [role,allowlist] of Object.entries(orca.api?.starciOrchestrationAllowlist||{})){
    add(errors,Array.isArray(allowlist),`Invalid Orca ${role} allowlist`);
    for(const command of allowlist||[])add(errors,publicCommands.has(command),`Unknown Orca command in ${role} allowlist: ${command}`);
  }
  const qwen=orca.adapters?.qwen;
  add(errors,qwen?.agent==='qwen-code','Missing native Orca Qwen adapter');
  add(errors,qwen?.launchCommand==='qwen --exclude-tools agent','Qwen adapter must disable nested agents');
  add(errors,qwen?.forbidden?.includes('qwen-agent-tool'),'Qwen adapter does not forbid its agent tool');
  add(errors,orca.index?.operationAgent?.qwen38Flash?.command===qwen?.launchCommand,'Orca index and Qwen adapter launch commands disagree');

  add(errors,codex.api?.schema==='starci/codex-api@1','Missing Codex provider API');
  const codexCalls=Object.values(codex.api?.collaborationApi||{}).map(value=>value?.call);
  for(const call of ['collaboration.spawn_agent','collaboration.followup_task','collaboration.send_message','collaboration.interrupt_agent','collaboration.list_agents','collaboration.wait_agent'])add(errors,codexCalls.includes(call),`Missing Codex collaboration API: ${call}`);
  add(errors,codex.index?.modes?.orchestratedHost?.supported===false,'Codex must not host orchestrated mode');

  add(errors,claude.api?.schema==='starci/claude-api@1','Missing Claude provider API');
  add(errors,claude.api?.subagentApi?.task?.call==='Task','Claude operation API must be Task');
  add(errors,claude.api?.unavailableAssumptions?.Agent===false&&claude.api?.unavailableAssumptions?.AgentOutput===false,'Claude invented-agent guards are missing');
  add(errors,claude.index?.modes?.orchestratedHost?.supported===false,'Claude must not host orchestrated mode');
  return {ok:errors.length===0,errors};
}

export function requireProviderContracts(){
  const result=validateProviderContracts();
  if(!result.ok)throw Error(result.errors.join('; '));
  return result;
}

