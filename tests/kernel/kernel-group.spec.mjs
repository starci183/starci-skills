import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {openMachine} from '../../engine/db/machine.mjs';
import {writeProviderCircuit} from '../../scripts/machine/provider-circuit.mjs';
import {inspectOwnerConfig} from '../../engine/config.mjs';
import { senderEnv } from '../helpers/sender-env.mjs';

// The Kernel seat takes the `high` tier of modules/models/tiers.yaml: its members are tried in chain order through the
// common picker (bias, balance, token use); config.yaml `kernel: {agent?, model?}` is the bias `only` over that tier and
// keeps its fail-closed meaning.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const TIER='kernel: {effort: high}';

const fixture=(t,kernelLine,modelsLine=null)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kernel-group-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json'),log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner'),trustHome=path.join(root,'trust-home');
  fs.mkdirSync(ownerRoot);fs.mkdirSync(trustHome);
  // Adoption and provider trust files belong only to this private fixture's exact repository root.
  const launchTrust={profile:'automatic',approvedBy:'owner',approvalRef:'private kernel-group fixture adoption',roots:[repo]};
  const config=fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8')
    .replace(/^launchTrust:.*$/m,`launchTrust: ${JSON.stringify(launchTrust)}`)
    .replace(/^kernel:.*$/m,kernelLine??'')
    .replace(/^models:.*$/m,modelsLine??'models: {}');
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),config);
  const owner=inspectOwnerConfig(ownerRoot);
  assert.equal(owner.error,null,'the private owner configuration must parse');
  assert.equal(owner.invalid,null,'launch must consume the complete validated owner configuration');
  assert.deepEqual(owner.config.launchTrust,launchTrust,'only this private repository has fixture trust adoption');
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot,
    STARCI_AGENT_TRUST_HOME:trustHome,STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite')};
  const run=(script,args,extra={},loaders=[])=>spawnSync(process.execPath,['--loader',new URL('../helpers/workflow-startup-loader.mjs',import.meta.url).href,...loaders.flatMap(file=>['--loader',pathToFileURL(file).href]),script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:senderEnv(script,{...env,...extra})});
  const defined=run(DEFINE_GOAL,['--repo',repo,'--text','boot the kernel group','--json']);
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const plan=(extra={})=>{const r=run(START_WORKFLOW,['--repo',repo,'--goal',workflowId,'--plan','--json'],extra);return {r,body:json(r.stdout)};};
  return {root,repo,state,workflowId,run,plan,launchTrust,machineFile:env.STARCI_TEST_MACHINE_FILE};
};

test('the unpinned Kernel plans the high tier: Claude Sonnet 5.5 first with GPT-6.1 Sol behind it',t=>{
  const {r,body}=fixture(t,TIER).plan();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.agent,body.model,body.effort,body.routedBy],['claude','claude-sonnet-5-5','high','tier']);
  assert.deepEqual(body.group.map(m=>[m.agent,m.model,m.effort]),[['claude','claude-sonnet-5-5','high'],['codex','gpt-6.1-sol','high']]);
  assert.equal(body.fallThrough,true);
  assert.equal(body.launch,'worker','every Kernel starts through orchestration worker-start');
  assert.deepEqual(body.admission.pick.chosen,{id:'claude/claude-sonnet-5-5',by:'chain-order'});
  assert.deepEqual(body.admission.pick.steps.map(step=>step.step),['hard-filter','bias','balance','tokens']);
});

test('at 90 percent of its tokens Claude is skipped for this pick and stays in the chain; Sol leads the plan',t=>{
  const f=fixture(t,TIER);
  const limited=f.plan({STARCI_FAKE_ORCA_LIMITED:'claude'});
  assert.equal(limited.r.status,0,limited.r.stderr||limited.r.stdout);
  assert.deepEqual([limited.body.agent,limited.body.model],['codex','gpt-6.1-sol']);
  assert.deepEqual(limited.body.group.map(m=>[m.agent,m.model]),[['claude','claude-sonnet-5-5'],['codex','gpt-6.1-sol']],'the skipped member stays in the chain');
  const skipped=limited.body.admission.pick.dropped.find(row=>row.id==='claude/claude-sonnet-5-5');
  assert.equal(skipped?.step,'tokens');
  assert.match(skipped.reason,/9[05]% or more of its tokens/);
  assert.deepEqual(limited.body.admission.pick.chosen,{id:'codex/gpt-6.1-sol',by:'tokens'});
  const normal=f.plan();
  assert.deepEqual([normal.body.agent,normal.body.model],['claude','claude-sonnet-5-5'],'the next pick sees Claude again');
});

test('the plan skips a dead or circuit-open Claude and refuses when the whole tier is down',t=>{
  const f=fixture(t,TIER);
  const dead=f.plan({STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.agent,dead.body.model],['codex','gpt-6.1-sol']);
  assert.equal(dead.body.admission.pick.dropped.find(row=>row.id==='claude/claude-sonnet-5-5')?.step,'hard-filter');
  // Provider health is worker-wide machine state now (the ledger's signals table no longer carries it).
  const machine=openMachine({file:f.machineFile});
  try{
    writeProviderCircuit('claude',{machine,expiresAt:Date.now()+3600000,
      value:{schema:'starci/provider-health@1',provider:'claude',status:'unavailable',failureKind:'auth'}});
  }finally{machine.close();}
  const circuit=f.plan();
  assert.equal(circuit.r.status,0,circuit.r.stderr);
  assert.deepEqual([circuit.body.agent,circuit.body.model],['codex','gpt-6.1-sol']);
  assert.equal(circuit.body.group.length,2,'an open circuit parks a member for the pick; it does not remove it from the chain');
  const both=f.plan({STARCI_FAKE_ORCA_DEAD:'claude,codex'});
  assert.equal(both.r.status,1);
  assert.equal(both.body.step,'kernel-group-unavailable');
  assert.match(both.body.routeError,/claude\/claude-sonnet-5-5 skipped.*codex\/gpt-6\.1-sol skipped/s);
});

test('a seat pin is the bias only over the tier: it keeps the tier model of that agent, has no fall-through target and fails closed',t=>{
  const f=fixture(t,'kernel: {agent: codex, effort: high}');
  const pinned=f.plan();
  assert.equal(pinned.r.status,0,pinned.r.stderr);
  assert.deepEqual([pinned.body.agent,pinned.body.model,pinned.body.routedBy],['codex','gpt-6.1-sol','config']);
  assert.equal(pinned.body.group.length,1);
  const dead=f.plan({STARCI_FAKE_ORCA_DEAD:'codex'});
  assert.equal(dead.r.status,1,'a dead pinned agent is never substituted');
  assert.equal(dead.body.step,'kernel-pin-unavailable');
  const outside=fixture(t,'kernel: {agent: claude, model: claude-opus-5-5, effort: high}').plan();
  assert.equal(outside.r.status,1,'a model the high tier does not hold is not launched');
  assert.equal(outside.body.step,'kernel-pin-unavailable');
  assert.match(outside.body.routeError,/names no member of tier high/);
});

const kernelEvents=(repo,workflowId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{
    return ledger.db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind LIKE 'kernel-%' ORDER BY seq").all(workflowId)
      .map(row=>({kind:row.kind,payload:json(row.payload_json)}));
  }finally{ledger.close();}
};
const readState=f=>json(fs.readFileSync(f.state,'utf8'));
const boot=(f,extra={})=>{const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],extra);return {r,body:json(r.stdout)};};

test('a Claude worker that never reaches readiness falls through to GPT-6.1 Sol in the same boot',t=>{
  // worker-start refused before a Dispatch existed: no effect, so the group hands the boot to the next member.
  const f=fixture(t,TIER);
  const {r,body}=boot(f,{STARCI_FAKE_ORCA_START_REFUSE:'claude'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.agent,body.model,body.routedBy,body.launch],['codex','gpt-6.1-sol','tier','worker']);
  assert.deepEqual(body.fellThrough.map(x=>[x.agent,x.model,x.step]),[['claude','claude-sonnet-5-5','worker-start']]);
  const events=kernelEvents(f.repo,f.workflowId);
  assert.deepEqual(events.map(e=>e.kind),['kernel-start-failed','kernel-booted']);
  const [failed,booted]=events;
  assert.deepEqual([failed.payload.step,failed.payload.effectState],['worker-start','none']);
  assert.deepEqual(failed.payload.fellThroughTo,{agent:'codex',model:'gpt-6.1-sol'});
  assert.deepEqual([booted.payload.agent,booted.payload.model,booted.payload.launch],['codex','gpt-6.1-sol','worker']);
  assert.equal(body.modelAttested,true);assert.equal(body.effectiveModel,'gpt-6.1-sol');assert.equal(booted.payload.modelAttested,true);
  assert.equal(booted.payload.fellThrough.length,1);
  const state=readState(f);
  assert.deepEqual(state.refusedStarts,['claude']);
  assert.deepEqual(state.workerStarts.map(w=>[w.agent,w.model]),[['codex','gpt-6.1-sol']],'one live Kernel worker, the booted one');
  assert.equal(body.terminal,state.workerStarts[0].handle);
});

test('fall-through never happens for a single pin, a start with effect, or the last member',t=>{
  const pinned=fixture(t,'kernel: {agent: claude, effort: high}');
  const p=boot(pinned,{STARCI_FAKE_ORCA_START_REFUSE:'claude'});
  assert.equal(p.r.status,1,'a refused single pin fails closed');
  assert.deepEqual(kernelEvents(pinned.repo,pinned.workflowId).map(e=>e.kind),['kernel-start-failed']);
  assert.deepEqual(readState(pinned).refusedStarts,['claude'],'no second member is tried');

  // A start that failed after its Dispatch existed and whose release Orca refused keeps its effect: the next
  // member would run beside a worker nobody proved gone.
  const partial=fixture(t,TIER);
  const c=boot(partial,{STARCI_FAKE_ORCA_START_PARTIAL:'claude',STARCI_FAKE_ORCA_RELEASE_FAILS:'1'});
  assert.equal(c.r.status,1,'a start with a surviving effect must not fall through');
  const [event]=kernelEvents(partial.repo,partial.workflowId);
  assert.notEqual(event.payload.effectState,'none');
  assert.match(event.payload.fallThroughRefused,/effect/);
  assert.deepEqual(readState(partial).refusedStarts,['claude']);

  const both=fixture(t,TIER);
  const b=boot(both,{STARCI_FAKE_ORCA_START_REFUSE:'claude,codex'});
  assert.equal(b.r.status,1);
  const events=kernelEvents(both.repo,both.workflowId);
  assert.deepEqual(events.map(e=>[e.kind,e.payload.agent,e.payload.step]),
    [['kernel-start-failed','claude','worker-start'],['kernel-start-failed','codex','worker-start']]);
  assert.deepEqual(events[1].payload.fellThrough?.map(x=>x.agent),['claude']);
  assert.equal((readState(both).workerStarts??[]).length,0,'no worker after an exhausted group');
  const ledger=inspectLedger({file:ledgerFileFor(both.repo)});
  try{assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM signals WHERE scope='kernel' AND key=?").get(both.workflowId).n,0,'the startup reservation is released');}
  finally{ledger.close();}
});

test('with no owner configuration the unpinned route is the high tier',t=>{
  // This plan-only probe uses an absent private owner root: the shipped tiers.yaml alone decides.
  const f=fixture(t,null),noOwner={STARCI_OWNER_ROOT:path.join(f.root,'absent-owner')};
  assert.equal(fs.existsSync(noOwner.STARCI_OWNER_ROOT),false,'the default route needs an actually absent owner configuration');
  const {r,body}=f.plan(noOwner);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual(body.config,{file:null},'the plan must observe absence rather than a configured owner');
  assert.deepEqual([body.agent,body.model,body.routedBy],['claude','claude-sonnet-5-5','tier']);
  assert.deepEqual(body.group.map(m=>[m.agent,m.model]),[['claude','claude-sonnet-5-5'],['codex','gpt-6.1-sol']]);
  const dead=f.plan({...noOwner,STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.agent,dead.body.model],['codex','gpt-6.1-sol']);
});

test('a logical runtime Kernel retains its requested route without claiming a concrete model attestation',t=>{
  // Devin takes the Kernel seat only when the owner writes it into the high tier (config.yaml models.tiers); a pin names its
  // agent alone - a concrete model named by `only` is unverifiable on a logical runtime and refused.
  const f=fixture(t,'kernel: {agent: devin}','models: {tiers: {high: [{agent: devin, model: swe-2-max}]}}');
  const loader=path.join(f.root,'private-quota-loader.mjs'),owner=new URL('../../scripts/agent/quota/devin.mjs',import.meta.url).href;
  // Only provider quota is recorded here; the real admission/store, worker lifecycle and Kernel writer still execute.
  const source='export function probe({account="default",now=Date.now()}={}){const at=typeof now==="function"?now():now;return {provider:"devin",account,auth:"ok",observedAt:at,windows:[{id:"private-weekly",usedPercent:12,observedAt:at,resetsAt:at+3600000}]};}';
  fs.writeFileSync(loader,'const owner='+JSON.stringify(owner)+';const source='+JSON.stringify(source)+';export async function load(url,context,nextLoad){return url===owner?{format:"module",source,shortCircuit:true}:nextLoad(url,context);}');
  const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{},[loader]);
  assert.equal(r.status,0,r.stderr||r.stdout);const body=json(r.stdout),event=kernelEvents(f.repo,f.workflowId).find(e=>e.kind==='kernel-booted');
  assert.equal(body.agent,'devin');assert.equal(body.model,'swe-2-max');assert.equal(body.modelAuthority,'configured-logical-runtime');
  assert.equal(body.effectiveModel,null);assert.equal(body.modelAttested,false);
  assert.equal(event.payload.modelAuthority,body.modelAuthority);assert.equal(event.payload.effectiveModel,null);assert.equal(event.payload.modelAttested,false);
  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const signal=json(ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(f.workflowId).value_json);
    const payload=json(ledger.db.prepare("SELECT payload_json FROM jobs WHERE job_id=?").get('kernel-'+f.workflowId).payload_json);
    assert.equal(signal.modelAttested,false);assert.equal(signal.effectiveModel,null);
    assert.equal(payload.route.modelAttested,false);assert.equal(payload.hierarchy.runtime.modelAttested,false);
  }finally{ledger.close();}
  assert.equal(readState(f).workerStarts.length,1);
});
