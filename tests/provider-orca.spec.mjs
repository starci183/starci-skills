import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicJson} from './helpers/read-public.mjs';
import {loadProviderContract,validateProviderContracts} from '../providers/validate.mjs';

test('Orca provider contract fixes hierarchy names and exact native API calls',()=>{
  const contract=readPublicJson('providers/orca/index.json');
  assert.equal(contract.schema,'starci/orca-provider@1');
  assert.equal(contract.names.planCoordinator,'[Coordinator] <Plan>');
  assert.equal(contract.names.workflowWorktree,'[Workflow] <Workflow>');
  assert.equal(contract.names.workflowCoordinator,'[Coordinator] <Workflow>');
  assert.equal(contract.names.operationAgent,'[Op] <operation> - <scope>');
  assert.match(contract.planCoordinator.calls.startAgent.cli,/orchestration worker-start .*--agent codex/);
  assert.match(contract.workflowCoordinator.calls.startChildAgent.cli,/--worktree new-child .*--agent codex/);
  assert.match(contract.workflowCoordinator.calls.nameAgent.cli,/\[Coordinator\] <Workflow>/);
  assert.equal(contract.operationAgent.qwen38Flash.command,'qwen --exclude-tools agent');
  assert.equal(contract.operationAgent.qwen38Flash.nestedAgents,'forbidden');
  assert.match(contract.operationAgent.qwen38Flash.calls.createAgent.cli,/terminal create .*qwen --exclude-tools agent/);
  assert.match(contract.operationAgent.qwen38Flash.calls.attachTask.cli,/worker-start .*--terminal <terminal-handle>/);
  assert.equal(contract.routing.coordinatorToOperation,'forbidden');
  assert.ok(contract.forbiddenCalls.includes('terminal-send-operation-prompt'));
  assert.ok(contract.forbiddenCalls.includes('operation-agent-tool-agent'));
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
  assert.equal(loadProviderContract('orca').adapters.qwen.launchCommand,'qwen --exclude-tools agent');
});
