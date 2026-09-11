import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acknowledgeSupervisionDelivery,
  assessSupervisionLiveness,
  createSupervisionState,
  formatOrcaDisplayName,
  loadSupervisionPolicy,
  observeSupervision,
  planOperationAgentLaunch,
  recordBoundedTerminalTail,
  validateSupervisionPolicy
} from '../execution/supervision.mjs';

const policy=loadSupervisionPolicy();
const state=()=>createSupervisionState({
  runId:'run-1',workflowTaskId:'task-workflow-1',dispatchId:'dispatch-workflow-1',attempt:2,
  startedAt:1000,latestHeartbeatAt:1000,deadlineAt:10000,heartbeatIntervalMs:1000,heartbeatGraceMs:500
});
const event=(eventType,overrides={})=>({
  messageId:`msg-${eventType}`,deliveryId:`delivery-${eventType}`,runId:'run-1',workflowTaskId:'task-workflow-1',
  dispatchId:'dispatch-workflow-1',attempt:2,eventType,emittedAt:1200,...overrides
});

test('supervision policy is a strict event-driven coordinator contract',()=>{
  assert.equal(validateSupervisionPolicy(policy).ok,true);
  assert.equal(policy.wait.mode,'blocking-event-wait');
  assert.equal(policy.wait.onTimeout.inspectWorker,false);
  assert.equal(policy.workerLifecycle.coordinator.lifetime,'parent-run');
  assert.equal(policy.workerLifecycle.coordinator.host,'orca-main-worktree');
  assert.equal(policy.workerLifecycle.coordinator.launch,'persistent-native-agent');
  assert.equal(policy.workerLifecycle.coordinator.bootstrap,'external-chat-creates-and-hands-off');
  assert.equal(policy.workerLifecycle.coordinator.authority,'owns-plan-run-and-dag');
  assert.equal(policy.workerLifecycle.workflowWrapper.host,'workflow-child-worktree');
  assert.equal(policy.workerLifecycle.workflowWrapper.launch,'persistent-native-manager-agent');
  assert.equal(policy.workerLifecycle.workflowWrapper.authority,'owns-operation-dag-and-boundary-loop');
  assert.equal(policy.workerLifecycle.workflowWrapper.reportsTo,'parent-coordinator');
  assert.deepEqual(policy.ownership.workflowWrapper,[
    'operation-scheduling','bounded-retry','provider-fallback-with-no-effects','operation-boundary-decision','normalized-workflow-reporting'
  ]);
  assert.deepEqual(policy.ownership.operationAgent,[
    'implementation-and-repair','test-and-verification-execution','operation-output-production'
  ]);
  assert.equal(policy.routing.operationToWorkflow.recipient,'workflow-manager');
  assert.ok(policy.routing.workflowInternal.resolveWithoutCoordinator.includes('bounded-retry'));
  assert.equal(policy.routing.workflowInternal.execution,'operation-agent-only');
  assert.equal(policy.routing.workflowInternal.coordinatorNotification,'none');
  assert.equal(policy.routing.workflowToCoordinator.envelope,'normalized-workflow-boundary');
  assert.equal(policy.routing.coordinatorToOperation.direct,'forbidden');
  assert.equal(policy.routing.managerRecovery.bypassManager,'forbidden');
  assert.equal(policy.waitHierarchy.workflowManager.waitsFor,'operation-boundary');
  assert.equal(policy.waitHierarchy.workflowManager.actsBy,'decide-dispatch-retry-or-replace-operation');
  assert.equal(policy.waitHierarchy.workflowManager.directExecution,'forbidden');
  assert.equal(policy.waitHierarchy.coordinator.waitsFor,'normalized-workflow-boundary');
  assert.equal(policy.waitHierarchy.coordinator.actsBy,'decide-schedule-recover-or-replace-workflow-manager');
  assert.equal(policy.waitHierarchy.coordinator.workflowLocalExecution,'forbidden');
  assert.equal(policy.waitHierarchy.coordinator.operationExecution,'forbidden');
  assert.equal(policy.workerLifecycle.displayNames.workflowManager,'[Coordinator] <Workflow>');
  assert.equal(policy.workerLifecycle.displayNames.operationAgent,'[Op] <operation> - <scope>');
  assert.equal(policy.workerLifecycle.displayNames.applyAgentNameWith,'terminal-create-and-rename-after-attach');
  assert.equal(policy.workerLifecycle.operationAgent.launch,'supervised-native-agent');
  assert.equal(policy.workerLifecycle.operationAgent.release,'after-accepted-worker_done');
  assert.equal(policy.workerLifecycle.operationAgent.reuse,'forbidden');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.supervise,'worker-start-by-terminal-handle');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.promptDelivery,'supervised-worker-start-only');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.command,'qwen --exclude-tools agent');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.nestedAgents,'forbidden');
  assert.deepEqual(policy.workerLifecycle.operationAgent.nativeLaunchFailure.recognizedFailures,['agent_prompt_stalled','session_not_reported']);
  assert.equal(policy.workerLifecycle.operationAgent.nativeLaunchFailure.unsupervisedFallback,'forbidden');
  assert.equal(policy.workerLifecycle.operationAgent.nativeLaunchFailure.duplicateSubmit,'forbidden');
  assert.ok(policy.forbidden.includes('external-bootstrap-retains-coordinator-loop'));
  assert.ok(policy.forbidden.includes('shell-only-main-without-coordinator-agent'));
  assert.ok(policy.forbidden.includes('workflow-child-without-manager-agent'));
  assert.ok(policy.forbidden.includes('operation-agent-acts-as-workflow-manager'));
  assert.ok(policy.forbidden.includes('operation-agent-creates-nested-agent'));
  assert.ok(policy.forbidden.includes('operation-agent-messages-parent-coordinator-directly'));
  assert.ok(policy.forbidden.includes('parent-coordinator-controls-operation-directly'));
  assert.ok(policy.forbidden.includes('workflow-manager-implements-operation'));
  assert.ok(policy.forbidden.includes('workflow-manager-runs-operation-tests'));
  assert.ok(policy.forbidden.includes('coordinator-performs-workflow-local-work'));
  assert.ok(policy.forbidden.includes('higher-manager-performs-lower-layer-work'));
  assert.ok(policy.forbidden.includes('periodic-terminal-poll'));
});

test('display names distinguish plan coordinator, workflow coordinator and operation roles',()=>{
  assert.equal(formatOrcaDisplayName('coordinator',{plan:'AgentOS Backend'}),'[Coordinator] AgentOS Backend');
  assert.equal(formatOrcaDisplayName('workflow-worktree',{workflow:'Chatbot'}),'[Workflow] Chatbot');
  assert.equal(formatOrcaDisplayName('workflow-manager',{workflow:'Chatbot'}),'[Coordinator] Chatbot');
  assert.equal(formatOrcaDisplayName('operation-agent',{operation:'review.verify',scope:'Chatbot'}),'[Op] review.verify - Chatbot');
});

test('Qwen operation launch is named, prewarmed and attached as one supervised worker',()=>{
  const launch=planOperationAgentLaunch({
    taskId:'task-1',worktree:'path:C:/work/chatbot',operation:'backend.implement',scope:'Chatbot',
    selection:{orcaLaunch:{kind:'managed-agent',agent:'qwen-code',command:'qwen --exclude-tools agent'}}
  });
  assert.equal(launch.mode,'prewarm-and-attach');
  assert.equal(launch.displayName,'[Op] backend.implement - Chatbot');
  assert.deepEqual(launch.steps.map(step=>step.command),['terminal-create','terminal-wait','worker-start','terminal-rename']);
  assert.deepEqual(launch.steps[0].args,{worktree:'path:C:/work/chatbot',title:'[Op] backend.implement - Chatbot',command:'qwen --exclude-tools agent'});
  assert.deepEqual(launch.steps[2].args,{task:'task-1',terminal:'$terminalHandle'});
  assert.ok(launch.forbidden.includes('dispatch-return-preamble'));
  assert.ok(launch.forbidden.includes('unsupervised-retain'));
});

test('a management layer cannot claim operation execution work',()=>{
  const invalid=structuredClone(policy);
  invalid.ownership.workflowWrapper.push('implementation-and-repair');
  assert.equal(validateSupervisionPolicy(invalid).ok,false);
  assert.match(validateSupervisionPolicy(invalid).errors.join('; '),/crosses the operation boundary/);
});

test('wait timeout only rearms and a healthy heartbeat produces no coordinator action',()=>{
  const timeout=observeSupervision(policy,state(),{type:'wait_timeout',cursor:'cursor-1'},{now:1100});
  assert.deepEqual({action:timeout.action,inspectWorker:timeout.inspectWorker,notifyUser:timeout.notifyUser},{action:'rearm',inspectWorker:false,notifyUser:false});
  assert.equal(timeout.state.cursor,'cursor-1');
  const heartbeat=observeSupervision(policy,timeout.state,{type:'event',event:event('heartbeat'),cursor:'cursor-2'},{now:1200});
  assert.equal(heartbeat.action,'none');assert.equal(heartbeat.inspectWorker,false);assert.equal(heartbeat.notifyUser,false);
  assert.equal(heartbeat.state.latestHeartbeatAt,1200);assert.equal(heartbeat.ackRequired,true);
});

test('boundary messages require the exact active workflow attempt and transition once',()=>{
  assert.throws(()=>observeSupervision(policy,state(),{type:'event',event:event('question',{dispatchId:'stale'})}),/active workflow attempt/);
  const first=observeSupervision(policy,state(),{type:'event',event:event('question')},{now:1300});
  assert.equal(first.action,'reply');assert.equal(first.next,'wait');assert.equal(first.ackRequired,true);
  const acknowledged=acknowledgeSupervisionDelivery(first.state,{messageId:'msg-question',deliveryId:'delivery-question'});
  const replay=observeSupervision(policy,acknowledged,{type:'event',event:event('question',{deliveryId:'delivery-question-redelivery'})},{now:1400});
  assert.equal(replay.action,'ack-existing');assert.equal(replay.ackRequired,true);
  assert.throws(()=>observeSupervision(policy,replay.state,{type:'event',event:event('question',{deliveryId:'delivery-changed',emittedAt:1401})}),/Changed redelivery/);
});

test('delivery acknowledgement is impossible before processing and idempotent afterward',()=>{
  assert.throws(()=>acknowledgeSupervisionDelivery(state(),{messageId:'msg-worker_done',deliveryId:'delivery-worker_done'}),/before successful processing/);
  const done=observeSupervision(policy,state(),{type:'event',event:event('worker_done')},{now:1300});
  assert.equal(done.action,'validate-review-release');
  const once=acknowledgeSupervisionDelivery(done.state,{messageId:'msg-worker_done',deliveryId:'delivery-worker_done'});
  const twice=acknowledgeSupervisionDelivery(once,{messageId:'msg-worker_done',deliveryId:'delivery-worker_done'});
  assert.deepEqual(twice,once);
});

test('liveness inspection starts only from a real trigger and permits one bounded terminal tail',()=>{
  assert.deepEqual(assessSupervisionLiveness(policy,state(),{now:2000}),{action:'wait',reason:'healthy',inspectionOrder:[]});
  assert.equal(assessSupervisionLiveness(policy,state(),{now:2500}).reason,'heartbeat-grace-expired');
  assert.equal(assessSupervisionLiveness(policy,state(),{now:10000}).reason,'workflow-deadline-expired');
  const stopped=observeSupervision(policy,state(),{type:'terminal_state',terminalState:'crashed'},{now:1400});
  assert.equal(stopped.action,'check-liveness');
  const tailed=recordBoundedTerminalTail(stopped.state);assert.equal(tailed.terminalTailReads,1);
  assert.throws(()=>recordBoundedTerminalTail(tailed),/Only one bounded terminal tail/);
});
