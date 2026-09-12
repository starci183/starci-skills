import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acknowledgeSupervisionDelivery,
  assessSupervisionLiveness,
  attestOperationWorker,
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

test('the supervision policy is the 5.0 contract: one kernel owns the loop, operations report once',()=>{
  assert.equal(validateSupervisionPolicy(policy).ok,true);
  assert.equal(policy.wait.mode,'blocking-event-wait');
  assert.equal(policy.wait.onTimeout.inspectWorker,true);
  assert.equal(policy.wait.owner,'launcher-wait-tick');
  assert.deepEqual(policy.wait.endsTurnOnlyOn,['workflow-goal','blocked-need-user']);
  // Two roles and no layer between them: the 4.x Coordinator and Workflow Manager are gone, not renamed.
  assert.deepEqual(Object.keys(policy.ownership),['kernel','operationAgent']);
  assert.deepEqual(policy.ownership.kernel,[
    'goal-assessment-and-one-user-approval','operation-scheduling','runtime-allocation',
    'machine-verified-acceptance','commit-and-ledger-write','bounded-retry','gate-execution','final-reporting'
  ]);
  assert.deepEqual(policy.ownership.operationAgent,[
    'implementation-and-repair','test-and-verification-execution','operation-output-production'
  ]);
  assert.deepEqual(Object.keys(policy.workerLifecycle),['displayNames','kernel','operationAgent']);
  assert.deepEqual(Object.keys(policy.waitHierarchy),['kernel']);
  assert.equal(policy.workerLifecycle.kernel.lifetime,'one-workflow');
  assert.equal(policy.workerLifecycle.kernel.host,'workflow-worktree');
  assert.equal(policy.workerLifecycle.kernel.launch,'local-process-never-an-orca-worker');
  assert.equal(policy.workerLifecycle.kernel.state,'one-workflow-directory-with-an-append-only-event-log');
  assert.equal(policy.workerLifecycle.kernel.authority,'owns-the-loop-after-one-user-approval');
  assert.equal(policy.workerLifecycle.kernel.release,'after-the-final-report');
  assert.equal(policy.routing.operationToKernel.recipient,'workflow-kernel');
  assert.equal(policy.routing.operationToKernel.transport,'one-report-file-per-dispatch');
  assert.equal(policy.routing.operationToKernel.authority,'report-file-then-signal');
  assert.equal(policy.routing.kernelToOperation.recipient,'own-operation-terminal');
  assert.equal(policy.routing.kernelToOperation.transport,'launcher-notify');
  assert.equal(policy.routing.kernelToOperation.statusEvent,'forbidden-for-control-instruction');
  assert.deepEqual(policy.routing.kernelToOperation.when,['answer-a-question','nudge-a-stalled-idle-operation']);
  assert.equal(policy.routing.operationToOperation.direct,'forbidden');
  assert.ok(policy.routing.kernelLocal.resolveWithoutUser.includes('bounded-retry'));
  assert.ok(policy.routing.kernelLocal.resolveWithoutUser.includes('runtime-allocation-and-overflow'));
  assert.equal(policy.routing.kernelLocal.execution,'operation-agent-only');
  assert.equal(policy.routing.kernelLocal.userNotification,'none');
  assert.equal(policy.routing.kernelToUser.envelope,'final-report-need-user');
  assert.equal(policy.waitHierarchy.kernel.waitsFor,'operation-boundary');
  assert.equal(policy.waitHierarchy.kernel.actsBy,'verify-accept-commit-retry-or-reallocate');
  assert.equal(policy.waitHierarchy.kernel.directExecution,'forbidden');
  assert.equal(policy.waitHierarchy.kernel.loopOwner,'code-never-a-model');
  assert.deepEqual(policy.waitHierarchy.kernel.modelCalls,['assessGoal','planOp','decide']);
  assert.equal(policy.workerLifecycle.displayNames.workflowWorktree,'[Workflow] <Workflow>');
  assert.equal(policy.workerLifecycle.displayNames.workflowKernel,'[Kernel] <Workflow>');
  assert.equal(policy.workerLifecycle.displayNames.operationAgent,'[Op] <operation> - <scope>');
  assert.equal(policy.workerLifecycle.displayNames.applyAgentNameWith,'task-display-name-then-provider-attestation-then-terminal-canonicalization');
  assert.equal(policy.workerLifecycle.operationAgent.launch,'supervised-native-agent');
  assert.equal(policy.workerLifecycle.operationAgent.release,'after-accepted-worker_done');
  assert.equal(policy.workerLifecycle.operationAgent.reuse,'forbidden');
  assert.equal(policy.workerLifecycle.operationAgent.parallelism,'disjoint-allowlist-under-one-worktree');
  // Acceptance is the kernel's, not the agent's claim.
  assert.deepEqual(policy.workerLifecycle.operationAgent.acceptance,{
    authority:'kernel-re-runs-every-declared-check-itself',
    changedFiles:'computed-from-git-never-from-the-report',
    allowlist:'every-changed-file-inside-the-operation-allowlist',
    commit:'one-operation-one-commit',
    selfDeclaredDone:'never-sufficient'
  });
  assert.deepEqual(policy.workerLifecycle.operationAgent.displayNameStability,{
    identityAuthority:'task-display-name-plus-worker-provider-receipt',
    terminalTitle:'mutable-native-ui-metadata',
    launch:'provider-attest-then-rename-and-verify',
    runtimeDrift:'recanonicalize-without-fencing-when-immutable-identity-is-exact',
    settlement:'recanonicalize-before-release',
    effectDecision:'never-reject-solely-for-runtime-terminal-title-drift'
  });
  assert.deepEqual(policy.workerLifecycle.operationAgent.dispatchAdmission.required,[
    'expected-operation-from-the-approved-goal','exact-operation-contract','allocated-runtime-selection','canonical-display-name'
  ]);
  assert.equal(policy.workerLifecycle.operationAgent.dispatchAdmission.providerProof,'worker-show-exact-effective-agent-model');
  assert.equal(policy.workerLifecycle.operationAgent.dispatchAdmission.effectAcceptance,'only-after-provider-proof');
  assert.equal(policy.workerLifecycle.operationAgent.deadTerminals.owner,'workflow-kernel');
  assert.equal(policy.workerLifecycle.operationAgent.architectureSidearm.onlyTrigger,'active-implementation-secondary_request');
  assert.equal(policy.workerLifecycle.operationAgent.architectureSidearm.requiredReason,'sds-technical-gap');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.supervise,'dispatch-return-preamble');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.promptDelivery,'terminal-send-with-submit-verification');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.create,'command-terminal-per-attempt');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.terminalCommand,'declared-target-command-only');
  assert.equal(policy.workerLifecycle.operationAgent.qwenLaunch.nestedAgents,'forbidden');
  assert.deepEqual(policy.workerLifecycle.operationAgent.nativeLaunchFailure.recognizedFailures,['agent_prompt_stalled','session_not_reported']);
  assert.equal(policy.workerLifecycle.operationAgent.nativeLaunchFailure.unsupervisedFallback,'forbidden');
  assert.equal(policy.workerLifecycle.operationAgent.nativeLaunchFailure.duplicateSubmit,'forbidden');
  assert.equal(policy.workerLifecycle.operationAgent.nativeLaunchFailure.onExhaustedRuntimes,'release-the-slot-cool-the-pool-and-allocate-another-runtime');
  assert.ok(policy.forbidden.includes('model-owned-control-loop'));
  assert.ok(policy.forbidden.includes('supervisor-layer-between-kernel-and-operation'));
  assert.ok(policy.forbidden.includes('operation-agent-acts-as-the-kernel'));
  assert.ok(policy.forbidden.includes('operation-agent-creates-nested-agent'));
  assert.ok(policy.forbidden.includes('operation-agent-controls-another-operation'));
  assert.ok(policy.forbidden.includes('kernel-implements-operation-scope'));
  assert.ok(policy.forbidden.includes('accept-self-declared-done-without-machine-verification'));
  assert.ok(policy.forbidden.includes('commit-outside-the-operation-allowlist'));
  assert.ok(policy.forbidden.includes('periodic-terminal-poll'));
  assert.ok(policy.forbidden.includes('dispatch-operation-to-existing-terminal'));
  // The retired layers cannot come back through the policy file.
  const revived=structuredClone(policy);
  revived.waitHierarchy.coordinator={waitsFor:'normalized-workflow-boundary'};
  assert.equal(validateSupervisionPolicy(revived).ok,false);
  assert.match(validateSupervisionPolicy(revived).errors.join('; '),/supervisor layer between the kernel and an operation/);
});

test('display names distinguish the workflow worktree, its kernel and each operation',()=>{
  assert.equal(formatOrcaDisplayName('workflow-worktree',{workflow:'Chatbot'}),'[Workflow] Chatbot');
  assert.equal(formatOrcaDisplayName('workflow-kernel',{workflow:'Chatbot'}),'[Kernel] Chatbot');
  assert.equal(formatOrcaDisplayName('operation-agent',{operation:'review.verify',scope:'Chatbot'}),'[Op] review.verify - Chatbot');
  for(const retired of ['coordinator','coordinator-worktree','workflow-manager'])
    assert.throws(()=>formatOrcaDisplayName(retired,{plan:'AgentOS Backend',workflow:'Chatbot'}),/Unsupported Orca display-name kind/);
});

test('Qwen operation launch is one command terminal per attempt fed by dispatch --return-preamble',()=>{
  const command='qwen --model qwen3.8-flash --approval-mode yolo --exclude-tools agent --max-session-turns 240 --max-wall-time 90m --max-tool-calls 600 --chat-recording false';
  const launch=planOperationAgentLaunch({
    taskId:'task-1',worktree:'path:C:/work/chatbot',operation:'backend.implement',scope:'Chatbot',
    selection:{model:'qwen3.8-flash',orcaLaunch:{kind:'command-terminal',command,dispatch:'return-preamble-and-send'}}
  });
  assert.equal(launch.mode,'command-terminal');
  assert.equal(launch.displayName,'[Op] backend.implement - Chatbot');
  assert.deepEqual(launch.steps.map(step=>step.command),['terminal-create','terminal-read','dispatch','terminal-send','terminal-read','dispatch-show']);
  assert.deepEqual(launch.steps[0].args,{worktree:'path:C:/work/chatbot',title:'[Op] backend.implement - Chatbot',command});
  assert.deepEqual(launch.steps[2].args,{task:'task-1',to:'$terminalHandle','return-preamble':true});
  assert.ok(launch.forbidden.includes('dispatch-inject'));
  assert.ok(launch.forbidden.includes('reuse-existing-terminal'));
  assert.throws(()=>planOperationAgentLaunch({taskId:'task-1',worktree:'path:C:/work/chatbot',operation:'backend.implement',scope:'Chatbot',selection:{model:'qwen3.8-flash',orcaLaunch:{kind:'command-terminal',command:'qwen --approval-mode yolo',dispatch:'return-preamble-and-send'}}}),/exclude the provider agent tool/);
  assert.throws(()=>planOperationAgentLaunch({taskId:'task-1',worktree:'path:C:/work/chatbot',operation:'backend.implement',scope:'Chatbot',selection:{model:'qwen3.8-flash',orcaLaunch:{kind:'managed-agent',agent:'qwen-code'}}}),/retired/);
});

test('managed operation launch carries the exact resolved model and effort',()=>{
  const launch=planOperationAgentLaunch({
    taskId:'task-2',worktree:'path:C:/work/accounting',operation:'architecture.decide',scope:'Accounting',
    selection:{model:'gpt-6-astra',effort:'high',orcaLaunch:{kind:'managed-agent',agent:'codex'}}
  });
  assert.deepEqual(launch.steps[0].args,{
    task:'task-2',worktree:'path:C:/work/accounting',agent:'codex',model:'gpt-6-astra',effort:'high'
  });
});

test('worker provider attestation rejects Sol when the resolved operation target is Qwen',()=>{
  const operation='backend.implement',scope='Accounting',displayName='[Op] backend.implement - Accounting';
  const selection={target:'qwen3.8-flash',model:'qwen3.8-flash',orcaLaunch:{kind:'managed-agent',agent:'qwen-code'}};
  const taskRecord={id:'task-1',display_name:displayName};
  const receipt=(agent='qwen-code',model='qwen3.8-flash')=>({result:{
    dispatch:{id:'ctx-1',task_id:'task-1'},
    worker:{state:'ready',agent_terminal_handle:'term-1',startOptions:{launch:{effective:{agent,model}}}},
    observation:{exactWorker:true},terminal:{title:displayName}
  }});
  assert.deepEqual(attestOperationWorker({taskId:'task-1',operation,scope,selection,taskRecord,workerShow:receipt()}),{
    schema:'starci/orca-operation-provider-attestation@1',ok:true,taskId:'task-1',dispatchId:'ctx-1',terminalHandle:'term-1',
    displayName,target:'qwen3.8-flash',agent:'qwen-code',model:'qwen3.8-flash',
    terminalTitle:{observed:displayName,canonical:true,mutableUiMetadata:true,action:'none'}
  });
  assert.throws(()=>attestOperationWorker({taskId:'task-1',operation,scope,selection,taskRecord,workerShow:receipt('codex','gpt-5.6-sol')}),/Provider mismatch/);
  assert.throws(()=>attestOperationWorker({taskId:'task-1',operation,scope,selection,taskRecord:{...taskRecord,display_name:'worker-task_1'},workerShow:receipt()}),/Task name mismatch/);
  assert.throws(()=>attestOperationWorker({taskId:'task-1',operation,scope,selection,taskRecord,workerShow:{result:{...receipt().result,terminal:{title:'Qwen - accounting'}}}}),/terminal name mismatch/);
  assert.deepEqual(
    attestOperationWorker({taskId:'task-1',operation,scope,selection,taskRecord,workerShow:{result:{...receipt().result,terminal:{title:'Report terminal task outcome | accounting'}}},phase:'runtime'}).terminalTitle,
    {observed:'Report terminal task outcome | accounting',canonical:false,mutableUiMetadata:true,action:'recanonicalize-without-fencing'}
  );
});

test('the kernel cannot claim operation execution work',()=>{
  const invalid=structuredClone(policy);
  invalid.ownership.kernel.push('implementation-and-repair');
  assert.equal(validateSupervisionPolicy(invalid).ok,false);
  assert.match(validateSupervisionPolicy(invalid).errors.join('; '),/crosses the operation boundary/);
});

test('wait timeout is a wait tick that inspects live workers, and a healthy heartbeat produces no kernel action',()=>{
  const timeout=observeSupervision(policy,state(),{type:'wait_timeout',cursor:'cursor-1'},{now:1100});
  assert.deepEqual({action:timeout.action,inspectWorker:timeout.inspectWorker,notifyUser:timeout.notifyUser},{action:'wait-again',inspectWorker:true,notifyUser:false});
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
