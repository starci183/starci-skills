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
  assert.deepEqual(Object.keys(contract.names).sort(),['operation','rule','workflowKernel','workflowWorktree']);
  assert.equal(contract.names.workflowWorktree,'[Workflow] <Workflow>');
  assert.equal(contract.names.workflowKernel,'[Kernel] <Workflow>');
  assert.match(contract.names.operation,/^modules\/kernel\/start-workflow\.yaml orcaTree\.titles/);
  assert.equal(contract.environmentBinding.currentRuntime,'omit---on');
  assert.equal(contract.environmentBinding.namedRuntimeAuthority,'live-runtime-inventory-only');
  // The 4.x supervisor layers are gone from the host canon, not renamed inside it.
  assert.equal(contract.planCoordinator,undefined);
  assert.equal(contract.workflowMonitor,undefined);
  assert.equal(contract.workflowKernel.role,'one-dedicated-agent-terminal-per-workflow');
  assert.equal(contract.ui.semanticHierarchy.schema,'starci/agent-hierarchy@1');
  assert.equal(contract.ui.semanticHierarchy.projection,'workflow -> Kernel -> Op');
  assert.match(contract.workflowKernel.calls.bindRun.cli,/orchestration run-create/);
  assert.match(contract.workflowKernel.calls.boot.cli,/terminal create .*--title "\[Kernel\] <Workflow>"/);
  assert.match(contract.workflowKernel.calls.answerOperation.cli,/terminal send .*--enter/);
  assert.equal(contract.operationAgent.canonicalLauncher.module,'scripts/kernel/api.mjs');
  assert.equal(contract.operationAgent.canonicalLauncher.command,'dispatch');
  assert.equal(contract.operationAgent.canonicalLauncher.authority,'exclusive-effectful-construction-path');
  assert.equal(contract.operationAgent.qwen.launch,'command-terminal');
  assert.equal(contract.operationAgent.qwen.agent,'qwen');
  assert.equal(contract.operationAgent.qwen.model,'deepseek-v4.1-flash');
  assert.equal(contract.operationAgent.qwen.nestedAgents,'forbidden');
  assert.equal(contract.operationAgent.devin.launch,'command-terminal');
  assert.equal(contract.operationAgent.devin.capacityAuthority,'explicit-workflow-quota');
  assert.equal(contract.operationAgent.devin.quotaTelemetry,'launch-status');
  assert.equal(contract.operationAgent.admission.expectedOperation,'approved-goal-operation');
  assert.equal(contract.operationAgent.admission.providerSelection,'profiles-registry-resolver-output');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.api,'orchestration.worker-show');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.beforeEffectAcceptance,'required');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.canonicalizeTitle.renameApi,'terminal.rename');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.canonicalizeTitle.failureEffect,'record-ui-defect-without-rejecting-valid-operation-effects');
  assert.equal(contract.operationAgent.admission.afterWorkerStart.runtimeTitleDrift.whenImmutableIdentityRemainsExact,'recanonicalize-without-fencing');
  assert.equal(contract.operationAgent.admission.architectureSidearm.onlyTrigger,'active implementation secondary_request');
  assert.equal(contract.operationAgent.admission.architectureSidearm.exactReason,'sds-technical-gap');
  assert.match(contract.operationAgent.qwen.calls.createTerminal.cli,/terminal create .*--command/);
  assert.match(contract.operationAgent.qwen.calls.returnPreamble.cli,/orchestration dispatch .*--return-preamble/);
  assert.doesNotMatch(contract.operationAgent.qwen.calls.returnPreamble.cli,/--inject/);
  assert.match(contract.operationAgent.qwen.calls.submitPrompt.cli,/terminal send .*--enter/);
  assert.match(contract.operationAgent.qwen.calls.createTerminal.cli,/--title "\[Op\] <operation> a<attempt> · <Workflow>"/);
  assert.match(contract.operationAgent.admission.afterWorkerStart.canonicalizeTitle.renameCli,/--title "\[Op\] <operation>"/);
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

test('every scripts/api/orca wrapper is backed by a calls.yaml entry',()=>{
  // calls.yaml is the argv source: scripts/api/orca/lib.mjs loads it and
  // orcaCall(verb, params) builds the command line. A wrapper therefore names
  // a verb and never a command word or a --flag; this check keeps the file the
  // single construction path. lib.mjs is the shared mechanics, not a verb.
  const calls=hostDoc('calls');
  const declared=new Set(Object.keys(calls.calls??{}));
  const wrappers=fs.readdirSync(WRAPPERS_DIR).filter(f=>f.endsWith('.mjs')&&!['lib.mjs','index.mjs'].includes(f)).sort();
  assert.ok(wrappers.length>0,'scripts/api/orca holds no verb wrappers');
  for(const file of wrappers){
    const source=fs.readFileSync(path.join(WRAPPERS_DIR,file),'utf8');
    const verbs=[...source.matchAll(/orcaCall\(\s*'([a-z][a-z-]*)'/g)].map(m=>m[1]);
    assert.ok(verbs.length>0,`${file}: builds no orcaCall(<verb>) — argv must come from calls.yaml`);
    for(const verb of verbs)assert.ok(declared.has(verb),`${file}: calls.yaml has no calls.${verb} entry`);
    assert.doesNotMatch(source,/orcaRun\(/,`${file}: calls orcaRun directly — argv belongs to calls.yaml via orcaCall`);
    assert.doesNotMatch(source,/spawnSync/,`${file}: spawns Orca itself — lib.mjs owns the process boundary`);
  }
  // Every param key a wrapper hands orcaCall is a declared flag of that verb —
  // orcaCall refuses an undeclared one at runtime, this catches it at rest.
  for(const file of wrappers){
    const source=fs.readFileSync(path.join(WRAPPERS_DIR,file),'utf8');
    for(const m of source.matchAll(/orcaCall\(\s*'([a-z][a-z-]*)'\s*,\s*\{([^}]*)\}/g)){
      const entry=calls.calls[m[1]];
      const flags=new Set([...(entry.flags??[]),calls.defaults?.jsonFlag].filter(Boolean));
      for(const key of [...m[2].matchAll(/(?:^|,)\s*'?([a-zA-Z][a-zA-Z-]*)'?\s*(?=[:,\n]|$)/g)].map(k=>k[1])){
        assert.ok(flags.has(key),`${file}: hands orcaCall('${m[1]}') a --${key} that calls.yaml does not declare`);
      }
    }
  }
});

test('calls.yaml declares the live agent-context guard the runner executes',()=>{
  const calls=hostDoc('calls');
  assert.equal(calls.runner,'scripts/api/orca/lib.mjs');
  assert.deepEqual(calls.liveSchema?.compare,['command','flags']);
  assert.equal(calls.liveSchema?.source,'agent-context');
  assert.equal(calls.liveSchema?.onMismatch,'refuse-before-effects');
  assert.equal(calls.liveSchema?.before,'first-call-of-kind-mutation');
  assert.match(calls.liveSchema?.envOverride??'',/STARCI_ORCA_SKIP_LIVE_CHECK=1/);
  assert.ok(calls.calls['agent-context'],'the guard needs an agent-context entry to issue');
  const lib=fs.readFileSync(path.join(WRAPPERS_DIR,'lib.mjs'),'utf8');
  assert.match(lib,/STARCI_ORCA_SKIP_LIVE_CHECK/,'the documented override must exist in the runner');
  assert.match(lib,/host-contract-drift/,'the documented refusal must exist in the runner');
  // A classify block is evaluated in order and the first match wins, so the
  // last rule must be unconditional — otherwise the contract has a hole the
  // runner fills with a default nobody declared.
  for(const [name,call] of Object.entries(calls.calls)){
    if(!call.classify)continue;
    const last=call.classify.at(-1);
    assert.deepEqual(last.when??{},{},`calls.${name} classify must end with an unconditional rule`);
    assert.ok(['ok','failed','unknown'].includes(last.outcome),`calls.${name} classify tail outcome`);
  }
});

// The host index documents the calls StarCi issues; a call no scripts/api/orca
// wrapper issues (worktree set/show, orchestration check/send, a rename before
// release) is not documented as if it ran, and op titles use the spellings
// api dispatch writes (modules/kernel/start-workflow.yaml orcaTree.titles).
test('every call the Orca host index names is one a scripts/api/orca wrapper issues',()=>{
  const issued=new Set(fs.readdirSync(WRAPPERS_DIR).filter(f=>f.endsWith('.mjs'))
    .flatMap(f=>[...fs.readFileSync(path.join(WRAPPERS_DIR,f),'utf8').matchAll(/orcaCall\(\s*'([a-z][a-z-]*)'/g)].map(m=>m[1])));
  const named=[];
  const walk=(node,at)=>{
    if(!node||typeof node!=='object')return;
    for(const [key,value] of Object.entries(node)){
      if((key==='api'||key==='renameApi')&&typeof value==='string'&&/^(?:orchestration|terminal|worktree)\.[a-z-]+$/.test(value))named.push([at,value]);
      else walk(value,at+'.'+key);
    }
  };
  walk(hostDoc('index'),'index');
  assert.ok(named.length>10,'the walk found the index calls');
  for(const [at,api] of named){
    const verb=api.startsWith('orchestration.')?api.slice('orchestration.'.length):api.replace('.','-');
    assert.ok(issued.has(verb),at+' names '+api+', which no scripts/api/orca wrapper issues');
  }
  for(const doc of ['index','recipes','validation']){
    const text=fs.readFileSync(path.join(ROOT,'modules','host','orca',doc+'.yaml'),'utf8');
    assert.doesNotMatch(text,/\[Op\] <operation> - <scope>/,doc+'.yaml uses the retired op title');
  }
});
