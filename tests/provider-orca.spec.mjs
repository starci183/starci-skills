import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicJson} from './helpers/read-public.mjs';
import {loadProviderContract,validateProviderContracts} from '../providers/validate.mjs';

test('Orca provider contract fixes hierarchy names and exact native API calls',()=>{
  const contract=readPublicJson('providers/orca/index.json');
  assert.equal(contract.schema,'starci/orca-provider@1');
  assert.deepEqual(Object.keys(contract.names).sort(),['operationAgent','rule','workflowKernel','workflowWorktree']);
  assert.equal(contract.names.workflowWorktree,'[Workflow] <Workflow>');
  assert.equal(contract.names.workflowKernel,'[Kernel] <Workflow>');
  assert.equal(contract.names.operationAgent,'[Op] <operation> - <scope>');
  assert.equal(contract.environmentBinding.currentRuntime,'omit---on');
  assert.equal(contract.environmentBinding.namedRuntimeAuthority,'live-runtime-inventory-only');
  // The 4.x supervisor layers are gone from the provider canon, not renamed inside it.
  assert.equal(contract.planCoordinator,undefined);
  assert.equal(contract.workflowMonitor,undefined);
  assert.equal(contract.workflowKernel.role,'one-local-process-per-workflow-in-the-workflow-worktree');
  assert.match(contract.workflowKernel.calls.bindRun.cli,/orchestration run-create/);
  assert.match(contract.workflowKernel.calls.nameSelf.cli,/terminal rename .*\[Kernel\] <Workflow>/);
  assert.match(contract.workflowKernel.calls.attestWorktree.cli,/worktree show/);
  assert.match(contract.workflowKernel.calls.waitOperationBoundary.cli,/orchestration check --wait/);
  assert.match(contract.workflowKernel.calls.answerOperation.cli,/terminal send .*--enter/);
  assert.equal(contract.operationAgent.canonicalLauncher.module,'execution/orca-supervised-launch.mjs');
  assert.equal(contract.operationAgent.canonicalLauncher.command,'start-op');
  assert.equal(contract.operationAgent.canonicalLauncher.authority,'exclusive-effectful-construction-path');
  assert.equal(contract.operationAgent.qwen38Flash.launch,'command-terminal');
  assert.equal(contract.operationAgent.qwen38Flash.agent,'qwen');
  assert.equal(contract.operationAgent.qwen38Flash.model,'qwen3.8-flash');
  assert.equal(contract.operationAgent.qwen38Flash.nestedAgents,'forbidden');
  assert.equal(contract.operationAgent.admission.expectedOperation,'approved-goal-operation');
  assert.equal(contract.operationAgent.admission.providerSelection,'profiles-registry-resolver-output');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.api,'orchestration.worker-show');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.beforeEffectAcceptance,'required');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.canonicalizeTitle.renameApi,'terminal.rename');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.canonicalizeTitle.verifyApi,'orchestration.worker-show');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.runtimeTitleDrift.whenImmutableIdentityRemainsExact,'recanonicalize-without-fencing');
  assert.equal(contract.operationAgent.admission.architectureSidearm.onlyTrigger,'active implementation secondary_request');
  assert.equal(contract.operationAgent.admission.architectureSidearm.exactReason,'sds-technical-gap');
  assert.match(contract.operationAgent.qwen38Flash.calls.createTerminal.cli,/terminal create .*--command/);
  assert.match(contract.operationAgent.qwen38Flash.calls.returnPreamble.cli,/orchestration dispatch .*--return-preamble/);
  assert.doesNotMatch(contract.operationAgent.qwen38Flash.calls.returnPreamble.cli,/--inject/);
  assert.match(contract.operationAgent.qwen38Flash.calls.submitPrompt.cli,/terminal send .*--enter/);
  assert.match(contract.operationAgent.qwen38Flash.calls.restoreName.cli,/terminal rename .*\[Op\] <operation> - <scope>/);
  assert.equal(contract.routing.operationToOperation,'forbidden');
  assert.match(contract.routing.kernelToOperation.cli,/terminal send .*--enter/);
  assert.equal(contract.routing.kernelToOperation.forbiddenType,'status');
  assert.equal(contract.routing.kernelToOperation.proveDeliveryFrom,'terminal-screen-not-send-receipt');
  assert.equal(contract.routing.operationToKernel.authority,'report-file-then-signal');
  assert.equal(contract.routing.operationToKernel.onceOnly,true);
  assert.deepEqual(Object.keys(contract.operationAgent.canonicalLauncher.companions).filter(name=>/monitor/i.test(name)),[]);
  assert.ok(contract.forbiddenCalls.includes('terminal-send-outside-canonical-launcher'));
  assert.ok(contract.forbiddenCalls.includes('orchestration.dispatch-to-reused-terminal-for-operation'));
  assert.ok(contract.forbiddenCalls.includes('operation-agent-tool-agent'));
  assert.doesNotMatch(contract.operationAgent.managedFallback.calls.startAgent.cli,/--on\s+(?:windows|macos|linux)(?:\s|$)/i);
});

test('Codex and Claude contracts expose solo operation APIs but forbid hosted orchestration',()=>{
  const codex=readPublicJson('providers/codex/index.json');
  const claude=readPublicJson('providers/claude/index.json');
  assert.equal(codex.schema,'starci/codex-provider@1');
  assert.equal(codex.modes.solo.controlPlane,'combined-plan-coordinator-workflow-wrapper');
  assert.equal(codex.modes.solo.operationForm,'isolated-background-subagent');
  assert.equal(codex.soloOperation.calls.create.api,'collaboration.spawn_agent');
  assert.equal(codex.soloOperation.calls.wait.api,'collaboration.wait_agent');
  assert.equal(codex.modes.orchestratedHost.supported,false);
  assert.ok(codex.forbidden.includes('codex-hosted-orchestration'));
  assert.equal(claude.schema,'starci/claude-provider@1');
  assert.equal(claude.modes.solo.controlPlane,'combined-plan-coordinator-workflow-wrapper');
  assert.equal(claude.modes.solo.operationForm,'isolated-task-subagent');
  assert.equal(claude.soloOperation.calls.createAndWait.api,'Task');
  assert.equal(claude.modes.orchestratedHost.supported,false);
  assert.ok(claude.forbidden.includes('claude-hosted-orchestration'));
  for(const contract of [codex,claude]){
    assert.equal(contract.modes.solo.maximumConcurrentOperations,3);
    assert.ok(contract.soloOperation.invariants.includes('one-operation-instance-one-agent'));
    assert.ok(contract.soloOperation.invariants.includes('no-subagent-created-by-operation-agent'));
    assert.match(contract.orcaManagedForm.start.cli,/orchestration worker-start/);
    assert.equal(contract.orcaManagedForm.environmentBinding.currentRuntime,'omit---on');
    assert.doesNotMatch(contract.orcaManagedForm.start.cli,/--on\s+(?:windows|macos|linux)(?:\s|$)/i);
  }
});

test('provider catalog exposes explicit API and validation contracts',()=>{
  const catalog=readPublicJson('providers/catalog.json');
  assert.equal(catalog.schema,'starci/provider-catalog@1');
  assert.equal(catalog.selection.orchestrated,'orca');
  for(const provider of ['orca','codex','claude']){
    assert.match(catalog.providers[provider].api,/api\.json$/);
    assert.match(catalog.providers[provider].validation,/validation\.json$/);
  }
  const orcaApi=readPublicJson('providers/orca/api.json');
  assert.equal(orcaApi.publicCommands.length,orcaApi.snapshot.observedCommandCount);
  assert.equal(new Set(orcaApi.publicCommands).size,orcaApi.publicCommands.length);
  const publicCommands=new Set(orcaApi.publicCommands);
  for(const commands of Object.values(orcaApi.starciOrchestrationAllowlist)){
    for(const command of commands)assert.ok(publicCommands.has(command),`unknown Orca command ${command}`);
  }
  const codexApi=readPublicJson('providers/codex/api.json');
  assert.deepEqual(Object.keys(codexApi.collaborationApi).sort(),[
    'followup_task','interrupt_agent','list_agents','send_message','spawn_agent','wait_agent'
  ]);
  assert.equal(codexApi.operationProtocol.create,'collaboration.spawn_agent');
  assert.equal(codexApi.operationProtocol.observe,'collaboration.wait_agent');
  const claudeApi=readPublicJson('providers/claude/api.json');
  assert.equal(claudeApi.subagentApi.task.call,'Task');
  assert.deepEqual(Object.keys(claudeApi.subagentApi.task.input.required).sort(),['description','prompt','subagent_type']);
  assert.equal(claudeApi.unavailableAssumptions.Agent,false);
  assert.equal(claudeApi.unavailableAssumptions.AgentOutput,false);
  assert.equal(validateProviderContracts().ok,true);
  const qwen=loadProviderContract('orca').adapters.qwen;
  assert.equal(qwen.kind,'command-terminal-agent');
  assert.equal(qwen.start[0].api,'terminal.create');
  assert.equal(qwen.start[2].api,'orchestration.dispatch');
  assert.equal(qwen.start[2].binding,'return-preamble');
  assert.equal(qwen.start[3].api,'terminal.send');
  assert.equal(qwen.start[5].api,'orchestration.dispatch-show');
  assert.equal(qwen.credentialRefresh.envKey,'BAILIAN_TOKEN_PLAN_API_KEY');
  assert.doesNotMatch(qwen.credentialRefresh.win32+qwen.credentialRefresh.posix,/sk-/);
  assert.ok(qwen.forbidden.includes('dispatch-inject'));
  assert.ok(qwen.forbidden.includes('qwen-agent-tool'));
});
