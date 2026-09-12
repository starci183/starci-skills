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
  add(errors,orca.index?.names?.workflowWorktree==='[Workflow] <Workflow>','Invalid Orca workflow worktree name');
  add(errors,orca.index?.names?.workflowKernel==='[Kernel] <Workflow>','Invalid Orca workflow kernel name');
  add(errors,orca.index?.names?.operationAgent==='[Op] <operation> - <scope>','Invalid Orca operation name');
  // 5.0 has a kernel and operation agents; a provider contract that still declares a supervisor layer is stale.
  add(errors,!orca.index?.planCoordinator&&!orca.index?.workflowMonitor,'Orca provider index still declares a retired supervisor layer');
  add(errors,plain(orca.index?.workflowKernel?.calls?.waitOperationBoundary)&&orca.index.workflowKernel.role==='one-local-process-per-workflow-in-the-workflow-worktree','Orca workflow kernel contract is invalid');
  add(errors,orca.index?.environmentBinding?.currentRuntime==='omit---on','Current Orca runtime must omit --on');
  add(errors,orca.index?.environmentBinding?.namedRuntimeAuthority==='live-runtime-inventory-only','Named Orca runtime must come from live inventory');
  add(errors,orca.index?.operationAgent?.admission?.expectedOperation==='approved-goal-operation','Orca operation admission must bind an operation of the approved goal');
  add(errors,orca.index?.operationAgent?.admission?.providerSelection==='profiles-registry-resolver-output','Orca operation admission must use the profile resolver');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.api==='orchestration.worker-show','Orca provider attestation must use worker-show');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.beforeEffectAcceptance==='required','Orca provider attestation must precede effect acceptance');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.canonicalizeTitle?.renameApi==='terminal.rename'&&orca.index?.operationAgent?.admission?.afterWorkerStart?.canonicalizeTitle?.verifyApi==='orchestration.worker-show','Orca operation title canonicalization sequence is invalid');
  add(errors,orca.index?.operationAgent?.admission?.afterWorkerStart?.runtimeTitleDrift?.whenImmutableIdentityRemainsExact==='recanonicalize-without-fencing'&&orca.index?.operationAgent?.admission?.afterWorkerStart?.runtimeTitleDrift?.effectDecision==='never-reject-solely-for-title-drift','Orca runtime title-drift policy is invalid');
  add(errors,orca.index?.operationAgent?.admission?.architectureSidearm?.onlyTrigger==='active implementation secondary_request','Architecture sidearm trigger is too broad');
  add(errors,orca.index?.operationAgent?.admission?.architectureSidearm?.exactReason==='sds-technical-gap','Architecture sidearm reason is invalid');
  add(errors,orca.index?.operationAgent?.canonicalLauncher?.module==='execution/orca-supervised-launch.mjs'&&orca.index?.operationAgent?.canonicalLauncher?.command==='start-op'&&orca.index?.operationAgent?.canonicalLauncher?.authority==='exclusive-effectful-construction-path','Orca operation launcher contract is invalid');
  add(errors,/terminal send/.test(orca.index?.routing?.kernelToOperation?.cli||'')&&orca.index?.routing?.kernelToOperation?.forbiddenType==='status'&&orca.index?.routing?.kernelToOperation?.proveDeliveryFrom==='terminal-screen-not-send-receipt','Kernel-to-operation control must be a proven terminal send, never a status message');
  add(errors,orca.index?.routing?.operationToKernel?.authority==='report-file-then-signal'&&orca.index?.routing?.operationToKernel?.onceOnly===true,'An operation must answer exactly once, in its report file');
  add(errors,orca.index?.routing?.operationToOperation==='forbidden','An operation must never control another operation');
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
  add(errors,qwen?.agent==='qwen','Missing Orca Qwen adapter');
  add(errors,qwen?.kind==='command-terminal-agent','Qwen adapter must launch a command terminal');
  add(errors,qwen?.model==='qwen3.8-flash'&&qwen?.modelMarker==='qwen3.8-flash','Qwen adapter must attest Qwen 3.8 Flash from the rendered footer');
  add(errors,typeof qwen?.credentialRefresh?.envKey==='string'&&/^[A-Z0-9_]+$/.test(qwen.credentialRefresh.envKey)&&typeof qwen?.credentialRefresh?.win32==='string'&&typeof qwen?.credentialRefresh?.posix==='string'&&!/sk-|Bearer|=\S{20,}/.test(qwen.credentialRefresh.win32+qwen.credentialRefresh.posix),'Qwen credential refresh must name only the variable and never carry a value');
  add(errors,typeof qwen?.readiness?.screenPattern==='string'&&qwen?.readiness?.timeoutMs>=30000,'Qwen readiness contract is invalid');
  add(errors,typeof qwen?.submission?.stagedPattern==='string'&&typeof qwen?.submission?.activityPattern==='string'&&qwen?.submission?.maxEnter===2,'Qwen submission contract is invalid');
  add(errors,qwen?.start?.length===6&&qwen.start[0]?.api==='terminal.create'&&qwen.start[1]?.api==='terminal.read'&&qwen.start[2]?.api==='orchestration.dispatch'&&qwen.start[2]?.binding==='return-preamble'&&qwen.start[3]?.api==='terminal.send'&&qwen.start[4]?.api==='terminal.read'&&qwen.start[5]?.api==='orchestration.dispatch-show','Qwen adapter start sequence is invalid');
  add(errors,qwen?.forbidden?.includes('qwen-agent-tool')&&qwen?.forbidden?.includes('dispatch-inject')&&qwen?.forbidden?.includes('reuse-existing-terminal'),'Qwen adapter does not forbid nested agents, inject or terminal reuse');
  add(errors,orca.index?.operationAgent?.qwen38Flash?.launch==='command-terminal','Orca index must launch Qwen as a command terminal');
  add(errors,orca.index?.operationAgent?.qwen38Flash?.agent===qwen?.agent&&orca.index?.operationAgent?.qwen38Flash?.model===qwen?.model,'Orca index and Qwen adapter identities disagree');
  for(const [name,target] of Object.entries(readDistJson('profiles','registry.json').targets||{})){
    if(target?.orcaLaunch?.kind==='command-terminal')add(errors,/--exclude-tools agent\b/.test(target.orcaLaunch.command||''),`Command terminal ${name} must exclude the provider agent tool`);
  }
  const workerStartTemplates=[
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
