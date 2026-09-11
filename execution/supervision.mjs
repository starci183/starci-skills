import {canonicalJSON,sha256} from '../core/index.mjs';
import {readDistJson} from '../core/runtime-root.mjs';
import {loadProviderContract,requireProviderContracts} from '../providers/validate.mjs';

const POLICY_SCHEMA='starci/orchestration-supervision@1';
const STATE_SCHEMA='starci/orchestration-supervision-state@1';
const BOUNDARY_EVENTS=new Set(['question','escalation','worker_done','worker_failed']);
const TERMINAL_SIGNALS=new Set(['closed','crashed']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const copy=value=>structuredClone(value);
const text=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const positive=(value,label)=>{need(Number.isSafeInteger(value)&&value>0,`Invalid ${label}`);return value;};
const finite=(value,label)=>{need(Number.isFinite(value),`Invalid ${label}`);return value;};
const uniqueStrings=value=>Array.isArray(value)&&value.length>0&&value.every(item=>typeof item==='string'&&item.trim())&&new Set(value).size===value.length;
const oneLine=(value,label)=>text(value,label).replace(/\s+/g,' ');

export function formatOrcaDisplayName(kind,{plan,workflow,operation,scope}={}){
  if(kind==='coordinator')return `[Coordinator] ${oneLine(plan,'plan name')}`;
  if(kind==='workflow-worktree')return `[Workflow] ${oneLine(workflow,'workflow name')}`;
  if(kind==='workflow-manager')return `[Coordinator] ${oneLine(workflow,'workflow name')}`;
  if(kind==='operation-agent')return `[Op] ${oneLine(operation,'operation name')} - ${oneLine(scope,'operation scope')}`;
  throw Error(`Unsupported Orca display-name kind: ${kind}`);
}

/** Produce the exact supervised launch plan for one Orca operation agent. */
export function planOperationAgentLaunch({taskId,worktree,selection,operation,scope}){
  requireProviderContracts();
  const task=text(taskId,'operation Task ID'),target=text(worktree,'workflow worktree selector');
  need(plain(selection?.orcaLaunch),'Missing Orca launch selection');
  const displayName=formatOrcaDisplayName('operation-agent',{operation,scope});
  if(selection.orcaLaunch.kind==='managed-agent'&&selection.orcaLaunch.agent==='qwen-code'){
    const qwen=loadProviderContract('orca').adapters.qwen;
    need(selection.orcaLaunch.command===qwen.launchCommand,'Resolved Qwen launch does not match the provider adapter');
    return {
    schema:'starci/orca-operation-launch@1',mode:'prewarm-and-attach',displayName,
    steps:[
      {command:'terminal-create',args:{worktree:target,title:displayName,command:text(qwen.launchCommand,'Qwen launch command')},save:'terminalHandle'},
      {command:'terminal-wait',args:{terminal:'$terminalHandle',for:'tui-idle'}},
      {command:'worker-start',args:{task,terminal:'$terminalHandle'}},
      {command:'terminal-rename',args:{terminal:'$terminalHandle',title:displayName}}
    ],
    forbidden:['dispatch-inject','dispatch-return-preamble','manual-terminal-prompt','unsupervised-retain']
  };
  }
  need(selection.orcaLaunch.kind==='managed-agent','Operation launch must use a supervised managed agent');
  return {
    schema:'starci/orca-operation-launch@1',mode:'native-worker-start',displayName,
    steps:[
      {command:'worker-start',args:{task,worktree:target,agent:text(selection.orcaLaunch.agent,'Orca agent ID')}},
      {command:'terminal-rename',args:{terminal:'$workerTerminalHandle',title:displayName}}
    ],
    forbidden:['manual-terminal-prompt','unsupervised-retain']
  };
}

export function validateSupervisionPolicy(policy){
  const errors=[];
  if(!plain(policy)||policy.schema!==POLICY_SCHEMA)errors.push('Unsupported orchestration supervision policy');
  const ownership=policy?.ownership;
  if(!uniqueStrings(ownership?.workflowWrapper)||!['operation-scheduling','bounded-retry','provider-fallback-with-no-effects','operation-boundary-decision','normalized-workflow-reporting'].every(item=>ownership.workflowWrapper.includes(item))||['implementation-and-repair','test-and-verification-execution','operation-output-production'].some(item=>ownership.workflowWrapper.includes(item)))errors.push('Workflow Manager ownership crosses the operation boundary');
  if(!uniqueStrings(ownership?.operationAgent)||!['implementation-and-repair','test-and-verification-execution','operation-output-production'].every(item=>ownership.operationAgent.includes(item)))errors.push('Operation agent ownership is incomplete');
  const coordinator=policy?.workerLifecycle?.coordinator;
  if(coordinator?.lifetime!=='parent-run'||coordinator?.host!=='orca-main-worktree'||coordinator?.launch!=='persistent-native-agent'||coordinator?.bootstrap!=='external-chat-creates-and-hands-off'||coordinator?.authority!=='owns-plan-run-and-dag'||coordinator?.release!=='after-final-run-settlement')errors.push('Coordinator lifecycle is invalid');
  const workflowWrapper=policy?.workerLifecycle?.workflowWrapper;
  if(workflowWrapper?.lifetime!=='workflow-attempt'||workflowWrapper?.host!=='workflow-child-worktree'||workflowWrapper?.launch!=='persistent-native-manager-agent'||workflowWrapper?.authority!=='owns-operation-dag-and-boundary-loop'||workflowWrapper?.reportsTo!=='parent-coordinator'||workflowWrapper?.worktree!=='one-isolated-child'||workflowWrapper?.release!=='after-reviewed-integration')errors.push('Workflow wrapper lifecycle is invalid');
  const operationAgent=policy?.workerLifecycle?.operationAgent;
  const names=policy?.workerLifecycle?.displayNames;
  const qwenLaunch=operationAgent?.qwenLaunch,nativeFailure=operationAgent?.nativeLaunchFailure;
  if(names?.coordinator!=='[Coordinator] <Plan>'||names?.workflowWorktree!=='[Workflow] <Workflow>'||names?.workflowManager!=='[Coordinator] <Workflow>'||names?.operationAgent!=='[Op] <operation> - <scope>'||names?.applyAgentNameWith!=='terminal-create-and-rename-after-attach')errors.push('Orca display naming contract is invalid');
  if(operationAgent?.lifetime!=='operation-attempt'||operationAgent?.launch!=='supervised-native-agent'||operationAgent?.isolation!=='one-operation-one-agent'||operationAgent?.release!=='after-accepted-worker_done'||operationAgent?.reuse!=='forbidden')errors.push('Operation agent lifecycle is invalid');
  if(qwenLaunch?.agent!=='qwen-code'||qwenLaunch?.command!=='qwen --exclude-tools agent'||qwenLaunch?.create!=='prewarm-native-terminal'||qwenLaunch?.readiness!=='tui-idle'||qwenLaunch?.supervise!=='worker-start-by-terminal-handle'||qwenLaunch?.promptDelivery!=='supervised-worker-start-only'||qwenLaunch?.directAgentStart!=='forbidden-until-adapter-ack-compatible'||qwenLaunch?.nestedAgents!=='forbidden')errors.push('Qwen supervised launch is invalid');
  if(!uniqueStrings(nativeFailure?.recognizedFailures)||!['agent_prompt_stalled','session_not_reported'].every(reason=>nativeFailure.recognizedFailures.includes(reason))||nativeFailure?.action!=='fence-and-reconcile-exact-attempt'||nativeFailure?.nextCandidate!=='only-after-verified-no-effects'||nativeFailure?.unsupervisedFallback!=='forbidden'||nativeFailure?.release!=='release-or-retain-from-worker-receipt'||nativeFailure?.duplicateSubmit!=='forbidden')errors.push('Native operation failure policy is invalid');
  const routing=policy?.routing;
  if(routing?.operationToWorkflow?.recipient!=='workflow-manager'||!uniqueStrings(routing?.operationToWorkflow?.events)||!['question','escalation','heartbeat','worker_done','worker_failed'].every(event=>routing.operationToWorkflow.events.includes(event)))errors.push('Operation events must route to the Workflow Manager');
  if(routing?.workflowInternal?.execution!=='operation-agent-only'||!uniqueStrings(routing?.workflowInternal?.resolveWithoutCoordinator)||routing?.workflowInternal?.coordinatorNotification!=='none')errors.push('Workflow-local resolution is invalid');
  if(!uniqueStrings(routing?.workflowToCoordinator?.onlyWhen)||routing?.workflowToCoordinator?.envelope!=='normalized-workflow-boundary')errors.push('Workflow-to-Coordinator routing is invalid');
  if(routing?.coordinatorToWorkflow?.recipient!=='workflow-manager'||routing?.coordinatorToWorkflow?.transport!=='orchestration-send'||routing?.coordinatorToWorkflow?.eventType!=='escalation'||routing?.coordinatorToWorkflow?.statusEvent!=='forbidden-for-control-instruction')errors.push('Coordinator instructions must wake the Workflow Manager through escalation');
  if(routing?.coordinatorToOperation?.direct!=='forbidden'||routing?.coordinatorToOperation?.route!=='coordinator-to-workflow-manager-to-operation')errors.push('Coordinator must route through the Workflow Manager');
  if(routing?.managerRecovery?.onManagerFailure!=='coordinator-replaces-or-recovers-manager'||routing?.managerRecovery?.bypassManager!=='forbidden')errors.push('Workflow Manager recovery is invalid');
  const waitHierarchy=policy?.waitHierarchy;
  if(waitHierarchy?.workflowManager?.waitsFor!=='operation-boundary'||!uniqueStrings(waitHierarchy?.workflowManager?.accepts)||!['question','escalation','heartbeat','worker_done','worker_failed'].every(event=>waitHierarchy.workflowManager.accepts.includes(event))||waitHierarchy?.workflowManager?.actsBy!=='decide-dispatch-retry-or-replace-operation'||waitHierarchy?.workflowManager?.directExecution!=='forbidden')errors.push('Workflow Manager wait hierarchy is invalid');
  if(waitHierarchy?.coordinator?.waitsFor!=='normalized-workflow-boundary'||!uniqueStrings(waitHierarchy?.coordinator?.accepts)||!['cross-workflow-dependency','shared-owner-change','cross-workflow-conflict','accepted-scope-or-authority-change','human-product-decision','workflow-manager-terminal-failure','normalized-workflow-done'].every(event=>waitHierarchy.coordinator.accepts.includes(event))||waitHierarchy?.coordinator?.actsBy!=='decide-schedule-recover-or-replace-workflow-manager'||waitHierarchy?.coordinator?.workflowLocalExecution!=='forbidden'||waitHierarchy?.coordinator?.operationExecution!=='forbidden')errors.push('Coordinator wait hierarchy is invalid');
  if(policy?.wait?.mode!=='blocking-event-wait')errors.push('Coordinator wait must be event-driven');
  if(!uniqueStrings(policy?.wait?.subscribe)||![...BOUNDARY_EVENTS].every(event=>policy.wait.subscribe.includes(event)))errors.push('Boundary event subscriptions are incomplete');
  if(policy?.wait?.onTimeout?.action!=='rearm'||policy?.wait?.onTimeout?.inspectWorker!==false||policy?.wait?.onTimeout?.notifyUser!==false)errors.push('Wait timeout must only rearm');
  if(policy?.wait?.onHealthyHeartbeat?.action!=='none'||policy?.wait?.onHealthyHeartbeat?.inspectWorker!==false||policy?.wait?.onHealthyHeartbeat?.notifyUser!==false)errors.push('Healthy heartbeat must be non-actionable');
  if(!uniqueStrings(policy?.liveness?.checkWhen)||!['heartbeat-grace-expired','workflow-deadline-expired','terminal-closed','terminal-crashed'].every(trigger=>policy.liveness.checkWhen.includes(trigger)))errors.push('Liveness triggers are incomplete');
  if(!uniqueStrings(policy?.liveness?.inspectionOrder)||policy.liveness.inspectionOrder.at(-1)!=='bounded-terminal-tail'||policy?.liveness?.maxTerminalTailReads!==1)errors.push('Liveness inspection must end with one bounded terminal tail');
  const required=policy?.messages?.identity?.required;
  if(!uniqueStrings(required)||!['messageId','deliveryId','runId','workflowTaskId','dispatchId','attempt','eventType','emittedAt'].every(field=>required.includes(field)))errors.push('Message identity fields are incomplete');
  if(policy?.messages?.deduplicateBy!=='messageId'||policy?.messages?.acknowledgeAfter!=='successful-processing'||policy?.messages?.changedRedelivery!=='reject')errors.push('Message delivery semantics are invalid');
  for(const event of BOUNDARY_EVENTS)if(!plain(policy?.transitions?.[event])||typeof policy.transitions[event].action!=='string'||typeof policy.transitions[event].next!=='string')errors.push(`Missing transition ${event}`);
  if(!uniqueStrings(policy?.forbidden)||!['external-bootstrap-retains-coordinator-loop','shell-only-main-without-coordinator-agent','workflow-child-without-manager-agent','operation-agent-acts-as-workflow-manager','operation-agent-creates-nested-agent','operation-agent-messages-parent-coordinator-directly','parent-coordinator-controls-operation-directly','workflow-manager-implements-operation','workflow-manager-runs-operation-tests','coordinator-performs-workflow-local-work','higher-manager-performs-lower-layer-work','periodic-terminal-poll','periodic-log-read','periodic-diff-read','progress-prompt','restart-healthy-workflow','coordinator-implements-worker-scope','user-report-on-unchanged-state'].every(rule=>policy.forbidden.includes(rule)))errors.push('Coordinator anti-polling and layer-ownership invariants are incomplete');
  return {ok:errors.length===0,errors};
}

export function loadSupervisionPolicy(){
  const policy=readDistJson('workflows','supervision.json');
  const checked=validateSupervisionPolicy(policy);
  need(checked.ok,checked.errors.join('; '));
  return policy;
}

function validateState(state){
  need(plain(state)&&state.schema===STATE_SCHEMA,'Invalid orchestration supervision state');
  for(const field of ['runId','workflowTaskId','dispatchId'])text(state[field],field);
  positive(state.attempt,'attempt');
  finite(state.startedAt,'startedAt');finite(state.latestHeartbeatAt,'latestHeartbeatAt');finite(state.deadlineAt,'deadlineAt');
  positive(state.heartbeatIntervalMs,'heartbeatIntervalMs');positive(state.heartbeatGraceMs,'heartbeatGraceMs');
  need(state.deadlineAt>state.startedAt,'deadlineAt must follow startedAt');
  need(Array.isArray(state.processedMessages)&&Array.isArray(state.pendingAcknowledgements)&&Array.isArray(state.acknowledgedDeliveries),'Invalid message state');
  need(Number.isSafeInteger(state.terminalTailReads)&&state.terminalTailReads>=0,'Invalid terminal tail read count');
  return state;
}

export function createSupervisionState({runId,workflowTaskId,dispatchId,attempt=1,cursor=null,startedAt=Date.now(),latestHeartbeatAt=startedAt,deadlineAt,heartbeatIntervalMs,heartbeatGraceMs}){
  const state={
    schema:STATE_SCHEMA,runId:text(runId,'runId'),workflowTaskId:text(workflowTaskId,'workflowTaskId'),dispatchId:text(dispatchId,'dispatchId'),
    attempt:positive(attempt,'attempt'),cursor,startedAt:finite(startedAt,'startedAt'),latestHeartbeatAt:finite(latestHeartbeatAt,'latestHeartbeatAt'),
    deadlineAt:finite(deadlineAt,'deadlineAt'),heartbeatIntervalMs:positive(heartbeatIntervalMs,'heartbeatIntervalMs'),heartbeatGraceMs:positive(heartbeatGraceMs,'heartbeatGraceMs'),
    status:'waiting',processedMessages:[],pendingAcknowledgements:[],acknowledgedDeliveries:[],terminalTailReads:0
  };
  return validateState(state);
}

function logicalEvent(event){const value=copy(event);delete value.deliveryId;return value;}
function eventDigest(event){return sha256(canonicalJSON(logicalEvent(event)));}
function validateEvent(policy,state,event){
  need(plain(event),'Invalid orchestration event');
  for(const field of policy.messages.identity.required)need(event[field]!==undefined&&event[field]!==null,`Missing event ${field}`);
  for(const field of ['messageId','deliveryId','runId','workflowTaskId','dispatchId','eventType'])text(event[field],`event ${field}`);
  positive(event.attempt,'event attempt');finite(event.emittedAt,'event emittedAt');
  need(event.runId===state.runId&&event.workflowTaskId===state.workflowTaskId&&event.dispatchId===state.dispatchId&&event.attempt===state.attempt,'Event does not belong to the active workflow attempt');
  need(event.eventType==='heartbeat'||BOUNDARY_EVENTS.has(event.eventType),'Unsupported orchestration event');
  return event;
}

function pendingAck(state,messageId,deliveryId){
  if(state.acknowledgedDeliveries.some(item=>item.deliveryId===deliveryId))return false;
  if(!state.pendingAcknowledgements.some(item=>item.deliveryId===deliveryId))state.pendingAcknowledgements.push({messageId,deliveryId});
  return true;
}

export function observeSupervision(policy,inputState,observation,{now=Date.now()}={}){
  const checked=validateSupervisionPolicy(policy);need(checked.ok,checked.errors.join('; '));
  const state=copy(validateState(inputState));finite(now,'observation time');need(plain(observation),'Invalid supervision observation');
  if(observation.type==='wait_timeout'){
    if(observation.cursor!==undefined)state.cursor=observation.cursor;
    state.status='waiting';
    return {state,action:'rearm',inspectWorker:false,notifyUser:false,ackRequired:false};
  }
  if(observation.type==='terminal_state'){
    const terminalState=text(observation.terminalState,'terminal state');
    if(TERMINAL_SIGNALS.has(terminalState)){state.status='checking-liveness';return {state,action:'check-liveness',reason:`terminal-${terminalState}`,inspectWorker:true,notifyUser:false,ackRequired:false};}
    return {state,action:'none',inspectWorker:false,notifyUser:false,ackRequired:false};
  }
  need(observation.type==='event','Unsupported supervision observation');
  const event=validateEvent(policy,state,observation.event),digest=eventDigest(event);
  if(observation.cursor!==undefined)state.cursor=observation.cursor;
  const prior=state.processedMessages.find(item=>item.messageId===event.messageId);
  if(prior){
    need(prior.digest===digest,'Changed redelivery for an existing messageId');
    const ackRequired=pendingAck(state,event.messageId,event.deliveryId);
    return {state,action:'ack-existing',inspectWorker:false,notifyUser:false,ackRequired};
  }
  state.processedMessages.push({messageId:event.messageId,digest,eventType:event.eventType,processedAt:now});
  const ackRequired=pendingAck(state,event.messageId,event.deliveryId);
  if(event.eventType==='heartbeat'){
    state.latestHeartbeatAt=Math.max(state.latestHeartbeatAt,event.emittedAt);state.status='waiting';
    return {state,action:'none',inspectWorker:false,notifyUser:false,ackRequired};
  }
  const transition=policy.transitions[event.eventType];state.status='boundary-event';
  return {state,action:transition.action,next:transition.next,event:copy(event),inspectWorker:false,notifyUser:false,ackRequired};
}

export function acknowledgeSupervisionDelivery(inputState,{messageId,deliveryId}){
  const state=copy(validateState(inputState)),m=text(messageId,'messageId'),d=text(deliveryId,'deliveryId');
  if(state.acknowledgedDeliveries.some(item=>item.deliveryId===d)){need(state.acknowledgedDeliveries.some(item=>item.deliveryId===d&&item.messageId===m),'Delivery ID belongs to another message');return state;}
  const index=state.pendingAcknowledgements.findIndex(item=>item.messageId===m&&item.deliveryId===d);
  need(index>=0,'Delivery cannot be acknowledged before successful processing');
  state.pendingAcknowledgements.splice(index,1);state.acknowledgedDeliveries.push({messageId:m,deliveryId:d});
  return state;
}

export function assessSupervisionLiveness(policy,inputState,{now=Date.now(),terminalState='running'}={}){
  const checked=validateSupervisionPolicy(policy);need(checked.ok,checked.errors.join('; '));
  const state=validateState(inputState);finite(now,'liveness time');
  if(TERMINAL_SIGNALS.has(terminalState))return {action:'check-liveness',reason:`terminal-${terminalState}`,inspectionOrder:copy(policy.liveness.inspectionOrder)};
  if(now>=state.deadlineAt)return {action:'check-liveness',reason:'workflow-deadline-expired',inspectionOrder:copy(policy.liveness.inspectionOrder)};
  if(now>=state.latestHeartbeatAt+state.heartbeatIntervalMs+state.heartbeatGraceMs)return {action:'check-liveness',reason:'heartbeat-grace-expired',inspectionOrder:copy(policy.liveness.inspectionOrder)};
  return {action:'wait',reason:'healthy',inspectionOrder:[]};
}

export function recordBoundedTerminalTail(inputState){
  const state=copy(validateState(inputState));need(state.status==='checking-liveness','Terminal tail is allowed only during liveness inspection');
  need(state.terminalTailReads<1,'Only one bounded terminal tail is allowed per liveness inspection');
  state.terminalTailReads+=1;return state;
}
