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
  add(errors,orca.index?.names?.workflowMonitor==='[Monitor] <Workflow>','Invalid Orca Workflow Monitor name');
  add(errors,orca.index?.names?.operationAgent==='[Op] <operation> - <scope>','Invalid Orca operation name');
  add(errors,orca.index?.environmentBinding?.currentRuntime==='omit---on','Current Orca runtime must omit --on');
  add(errors,orca.index?.environmentBinding?.namedRuntimeAuthority==='live-runtime-inventory-only','Named Orca runtime must come from live inventory');
  add(errors,orca.index?.operationAgent?.admission?.expectedOperation==='active-dag-node','Orca operation admission must bind the active DAG node');
  add(errors,orca.index?.operationAgent?.admission?.providerSelection==='profiles-registry-resolver-output','Orca operation admission must use the profile resolver');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.api==='orchestration.worker-show','Orca provider attestation must use worker-show');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.beforeEffectAcceptance==='required','Orca provider attestation must precede effect acceptance');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.canonicalizeTitle?.renameApi==='terminal.rename'&&orca.index?.operationAgent?.admission?.afterWorkerStart?.canonicalizeTitle?.verifyApi==='orchestration.worker-show','Orca operation title canonicalization sequence is invalid');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.runtimeTitleDrift?.whenImmutableIdentityRemainsExact==='recanonicalize-without-fencing'&&orca.index?.operationAgent?.admission?.afterWorkerStart?.runtimeTitleDrift?.effectDecision==='never-reject-solely-for-title-drift','Orca runtime title-drift policy is invalid');
  add(errors,orca.index?.operationAgent?.admission?.architectureSidearm?.onlyTrigger==='active implementation secondary_request','Architecture sidearm trigger is too broad');
  add(errors,orca.index?.operationAgent?.admission?.architectureSidearm?.exactReason==='sds-technical-gap','Architecture sidearm reason is invalid');
  add(errors,orca.index?.operationAgent?.canonicalLauncher?.module==='execution/orca-supervised-launch.mjs'&&orca.index?.operationAgent?.canonicalLauncher?.command==='start-op'&&orca.index?.operationAgent?.canonicalLauncher?.authority==='exclusive-effectful-construction-path','Orca operation launcher contract is invalid');
  add(errors,/--type escalation/.test(orca.index?.routing?.coordinatorToWorkflow?.cli||'')&&orca.index?.routing?.coordinatorToWorkflow?.forbiddenType==='status','Coordinator-to-Workflow control must use escalation, not status');
  const commands=orca.api?.publicCommands;
  add(errors,Array.isArray(commands)&&commands.length===orca.api?.snapshot?.observedCommandCount,'Orca API inventory count mismatch');
  add(errors,Array.isArray(commands)&&new Set(commands).size===commands.length,'Orca API inventory contains duplicates');
  const publicCommands=new Set(commands||[]);
  for(const [role,allowlist] of Object.entries(orca.api?.starciOrchestrationAllowlist||{})){
    add(errors,Array.isArray(allowlist),`Invalid Orca ${role} allowlist`);
    for(const command of allowlist||[])add(errors,publicCommands.has(command),`Unknown Orca command in ${role} allowlist: ${command}`);
  }
  const calls=orca.calls;
  add(errors,calls?.schema==='starci/orca-calls@1','Missing Orca calls contract');
  add(errors,calls?.envelope?.schema==='starci/orca-call-result@1','Orca calls contract must emit starci/orca-call-result@1');
  add(errors,calls?.idempotency?.flag==='retry-request','Orca mutations must carry retry-request on unknown results');
  const forbiddenCommands=new Set([...(calls?.forbiddenCalls||[]),...(orca.api?.forbiddenForStarciOrchestration||[])]);
  for(const [name,call] of Object.entries(calls?.calls||{})){
    add(errors,publicCommands.has(call?.command),`Orca call ${name} names an unknown command: ${call?.command}`);
    add(errors,!forbiddenCommands.has(call?.command),`Orca call ${name} names a forbidden command: ${call?.command}`);
    add(errors,['read','mutation'].includes(call?.kind),`Orca call ${name} has an invalid kind`);
  }
  for(const required of ['run-show','task-create','worker-start','worker-show','worker-stop','worker-release','worker-list','terminal-rename','check','send','worktree-set','worktree-show'])add(errors,plain(calls?.calls?.[required]),`Orca calls contract is missing ${required}`);
  add(errors,(calls?.calls?.['worker-start']?.forbidden||[]).includes('terminal')&&(calls?.calls?.['worker-start']?.forbidden||[]).includes('on'),'worker-start must forbid --terminal and --on');
  add(errors,Array.isArray(calls?.calls?.['worker-start']?.classify)&&calls.calls['worker-start'].classify.length>0,'worker-start must declare failure classification');
  const qwen=orca.adapters?.qwen;
  add(errors,qwen?.agent==='qwen-code','Missing native Orca Qwen adapter');
  add(errors,qwen?.kind==='direct-native-managed-agent','Qwen adapter must use direct native worker-start');
  add(errors,qwen?.requiredModel==='qwen3.8-flash','Qwen adapter must attest Qwen 3.8 Flash');
  add(errors,qwen?.start?.length===4&&qwen.start[0]?.api==='orchestration.worker-start'&&qwen.start[0]?.binding==='agent-qwen-code'&&qwen.start[1]?.api==='orchestration.worker-show'&&qwen.start[1]?.phase==='provider-identity'&&qwen.start[2]?.api==='terminal.rename'&&qwen.start[3]?.api==='orchestration.worker-show'&&qwen.start[3]?.phase==='canonical-title','Qwen adapter start sequence is invalid');
  add(errors,qwen?.forbidden?.includes('qwen-agent-tool'),'Qwen adapter does not forbid its agent tool');
  add(errors,qwen?.forbidden?.includes('terminal-create-qwen-command')&&qwen?.forbidden?.includes('worker-start-by-terminal-handle'),'Qwen adapter does not forbid command-terminal attachment');
  add(errors,orca.index?.operationAgent?.qwen38Flash?.launch==='direct-native-worker-start','Orca index must launch Qwen natively');
  add(errors,orca.index?.operationAgent?.qwen38Flash?.agent===qwen?.agent&&orca.index?.operationAgent?.qwen38Flash?.model===qwen?.requiredModel,'Orca index and Qwen adapter identities disagree');
  const workerStartTemplates=[
    orca.index?.planCoordinator?.calls?.startAgent?.cli,
    orca.index?.workflowMonitor?.calls?.startChildAgent?.cli,
    orca.index?.operationAgent?.qwen38Flash?.calls?.startAgent?.cli,
    orca.index?.operationAgent?.managedFallback?.calls?.startAgent?.cli,
    codex.index?.orcaManagedForm?.start?.cli,
    claude.index?.orcaManagedForm?.start?.cli
  ];
  for(const cli of workerStartTemplates){
    add(errors,typeof cli==='string'&&!/--on\s+(?:windows|macos|linux)(?:\s|$)/i.test(cli),'Worker-start template contains a literal environment label');
  }

  add(errors,codex.api?.schema==='starci/codex-api@1','Missing Codex provider API');
  const codexCalls=Object.values(codex.api?.collaborationApi||{}).map(value=>value?.call);
  for(const call of ['collaboration.spawn_agent','collaboration.followup_task','collaboration.send_message','collaboration.interrupt_agent','collaboration.list_agents','collaboration.wait_agent'])add(errors,codexCalls.includes(call),`Missing Codex collaboration API: ${call}`);
  add(errors,codex.index?.modes?.orchestratedHost?.supported===false,'Codex must not host orchestrated mode');
  add(errors,codex.index?.orcaManagedForm?.environmentBinding?.currentRuntime==='omit---on','Codex Orca form must omit --on for the current runtime');

  add(errors,claude.api?.schema==='starci/claude-api@1','Missing Claude provider API');
  add(errors,claude.api?.subagentApi?.task?.call==='Task','Claude operation API must be Task');
  add(errors,claude.api?.unavailableAssumptions?.Agent===false&&claude.api?.unavailableAssumptions?.AgentOutput===false,'Claude invented-agent guards are missing');
  add(errors,claude.index?.modes?.orchestratedHost?.supported===false,'Claude must not host orchestrated mode');
  add(errors,claude.index?.orcaManagedForm?.environmentBinding?.currentRuntime==='omit---on','Claude Orca form must omit --on for the current runtime');
  return {ok:errors.length===0,errors};
}

export function requireProviderContracts(){
  const result=validateProviderContracts();
  if(!result.ok)throw Error(result.errors.join('; '));
  return result;
}
