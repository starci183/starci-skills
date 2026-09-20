import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readPublicJson} from './helpers/read-public.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const AGENTS_DIR=path.join(ROOT,'modules','models','agents');
const WRAPPERS_DIR=path.join(ROOT,'scripts','api','orca');

// The providers/ registry is dissolved: the Orca host contract lives at
// modules/host/orca/*.yaml (index, api, calls, capabilities, recipes,
// validation, envelopes) and every per-agent spawn card is
// modules/models/agents/<agent>.yaml (schema starci/agent-card@1 — the old
// adapter card at top level plus an optional capabilities: key).
const hostDoc=name=>readPublicJson('modules','host','orca',`${name}.yaml`);
const agentCard=name=>readPublicJson('modules','models','agents',`${name}.yaml`);

test('Orca host index fixes hierarchy names and exact native API calls',()=>{
  const contract=hostDoc('index');
  assert.equal(contract.schema,'starci/orca-provider@1');
  assert.deepEqual(Object.keys(contract.names).sort(),['operationAgent','rule','workflowKernel','workflowWorktree']);
  assert.equal(contract.names.workflowWorktree,'[Workflow] <Workflow>');
  assert.equal(contract.names.workflowKernel,'[Kernel] <Workflow>');
  assert.equal(contract.names.operationAgent,'[Op] <operation> - <scope>');
  assert.equal(contract.environmentBinding.currentRuntime,'omit---on');
  assert.equal(contract.environmentBinding.namedRuntimeAuthority,'live-runtime-inventory-only');
  // The 4.x supervisor layers are gone from the host canon, not renamed inside it.
  assert.equal(contract.planCoordinator,undefined);
  assert.equal(contract.workflowMonitor,undefined);
  assert.equal(contract.workflowKernel.role,'one-local-process-per-workflow-in-the-workflow-worktree');
  assert.match(contract.workflowKernel.calls.bindRun.cli,/orchestration run-create/);
  assert.match(contract.workflowKernel.calls.nameSelf.cli,/terminal rename .*\[Kernel\] <Workflow>/);
  assert.match(contract.workflowKernel.calls.attestWorktree.cli,/worktree show/);
  assert.match(contract.workflowKernel.calls.waitOperationBoundary.cli,/orchestration check --wait/);
  assert.match(contract.workflowKernel.calls.answerOperation.cli,/terminal send .*--enter/);
  assert.equal(contract.operationAgent.canonicalLauncher.module,'scripts/kernel/api.mjs');
  assert.equal(contract.operationAgent.canonicalLauncher.command,'dispatch');
  assert.equal(contract.operationAgent.canonicalLauncher.authority,'exclusive-effectful-construction-path');
  assert.equal(contract.operationAgent.qwen38Flash.launch,'command-terminal');
  assert.equal(contract.operationAgent.qwen38Flash.agent,'qwen');
  assert.equal(contract.operationAgent.qwen38Flash.model,'qwen3.8-flash');
  assert.equal(contract.operationAgent.qwen38Flash.nestedAgents,'forbidden');
  assert.equal(contract.operationAgent.devin.launch,'command-terminal');
  assert.equal(contract.operationAgent.devin.capacityAuthority,'explicit-workflow-quota');
  assert.equal(contract.operationAgent.devin.quotaTelemetry,'launch-status');
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

test('agent cards carry the spawn contract the host drives',()=>{
  // Solo providers codex/claude are native-managed agents: the host starts a
  // supervised worker and the terminal fallback is the escape hatch.
  for(const name of ['codex','claude']){
    const card=agentCard(name);
    assert.equal(card.schema,'starci/agent-card@1',`${name} schema`);
    assert.equal(card.agent,name,`${name} agent name must equal the filename`);
    assert.equal(card.kind,'native-managed-agent',`${name} kind`);
    assert.equal(card.start?.api,'orchestration.worker-start',`${name} start api`);
    assert.equal(typeof card.terminalFallback?.command,'string',`${name} terminalFallback.command`);
  }
  const qwen=agentCard('qwen');
  assert.equal(qwen.schema,'starci/agent-card@1');
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
  const devin=agentCard('devin');
  assert.equal(devin.schema,'starci/agent-card@1');
  assert.equal(devin.kind,'command-terminal-agent');
  assert.equal(devin.modelAuthority,'configured-logical-runtime');
  assert.match(devin.commandPrefix.win32,/models list --format json/);
  assert.doesNotMatch(devin.commandPrefix.win32+devin.commandPrefix.posix,/cog_|Bearer|DEVIN_API_KEY=/);
  assert.ok(devin.forbidden.includes('cloud-handoff'));
  assert.ok(devin.forbidden.includes('inferred-underlying-model'));
});

test('the Orca host contract tree is complete and internally consistent',()=>{
  // The dissolved catalog's job, done directly: every host document must be
  // present and parse, the API inventory must be exact, and every typed call
  // must name a real, allowed command.
  for(const doc of ['index','api','calls','capabilities','recipes','validation','envelopes']){
    const parsed=hostDoc(doc);
    assert.ok(parsed&&typeof parsed==='object',`modules/host/orca/${doc}.yaml did not parse to an object`);
    assert.match(parsed.schema,/^starci\//,`modules/host/orca/${doc}.yaml schema`);
  }
  const api=hostDoc('api');
  assert.equal(api.publicCommands.length,api.snapshot.observedCommandCount);
  assert.equal(new Set(api.publicCommands).size,api.publicCommands.length);
  const publicCommands=new Set(api.publicCommands);
  for(const commands of Object.values(api.starciOrchestrationAllowlist)){
    for(const command of commands)assert.ok(publicCommands.has(command),`unknown Orca command ${command}`);
  }
  const calls=hostDoc('calls');
  assert.equal(calls.schema,'starci/orca-calls@1');
  assert.equal(calls.envelope?.schema,'starci/orca-call-result@1');
  assert.equal(calls.idempotency?.flag,'retry-request');
  const forbidden=new Set(calls.forbiddenCalls??[]);
  for(const [name,call] of Object.entries(calls.calls??{})){
    assert.ok(publicCommands.has(call?.command),`calls.${name} names an unknown command: ${call?.command}`);
    assert.ok(!forbidden.has(call?.command),`calls.${name} names a forbidden command: ${call?.command}`);
    assert.ok(['read','mutation'].includes(call?.kind),`calls.${name} has an invalid kind`);
  }
  const cards=fs.readdirSync(AGENTS_DIR).filter(f=>f.endsWith('.yaml')).sort();
  assert.ok(cards.length>0,'modules/models/agents holds no agent cards');
  for(const file of cards){
    const card=agentCard(path.basename(file,'.yaml'));
    assert.equal(card.schema,'starci/agent-card@1',`${file} schema`);
    assert.equal(card.agent,path.basename(file,'.yaml'),`${file} agent name must equal the filename`);
  }
});

test('every scripts/api/orca terminal wrapper is backed by a calls.yaml entry',()=>{
  // calls.yaml is the typed contract the thin wrappers implement — this parity
  // check keeps it enforced, not documentary. A wrapper verb or --flag missing
  // from calls.yaml means argv is built outside the contract.
  const calls=hostDoc('calls');
  const entries=Object.values(calls.calls??{});
  // defaults.jsonFlag ('json') is a contract-level default every wrapper sends;
  // it is covered without appearing in each call's flags list.
  const covered=call=>new Set([...(call?.flags??[]),calls.defaults?.jsonFlag].filter(Boolean));
  const wrappers=fs.readdirSync(WRAPPERS_DIR).filter(f=>/^terminal-.*\.mjs$/.test(f)).sort();
  assert.ok(wrappers.length>0,'scripts/api/orca holds no terminal-* wrappers');
  for(const file of wrappers){
    const source=fs.readFileSync(path.join(WRAPPERS_DIR,file),'utf8');
    // The wrapper's argv literal leads with the orca verb: ['terminal','<verb>',...].
    const verbMatch=source.match(/\[\s*'terminal'\s*,\s*'([a-z-]+)'/);
    assert.ok(verbMatch,`${file}: could not extract the orca verb from its argv literal`);
    const verb=`terminal ${verbMatch[1]}`;
    const entry=entries.find(c=>c?.command===verb);
    assert.ok(entry,`${file}: calls.yaml has no calls: entry with command '${verb}'`);
    // Every '--flag' literal the wrapper builds into argv must be declared.
    const built=new Set([...source.matchAll(/'--([a-z][a-z-]*)'/g)].map(m=>m[1]));
    const declared=covered(entry);
    for(const flag of built){
      assert.ok(declared.has(flag),`${file}: builds --${flag} but calls.yaml '${verb}' flags lack it`);
    }
  }
});
