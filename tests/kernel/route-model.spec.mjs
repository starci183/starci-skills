import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {openLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {openMachine} from '../../engine/db/machine.mjs';
import {writeProviderCircuit} from '../../scripts/machine/provider-circuit.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const ROUTE=path.join(ROOT,'scripts','route','route-model.mjs');
// Lane m13: route-model.mjs is the selection.yaml executor. --plan is a
// what-if view (walks the tiers.yaml tier of the workload, annotates missing
// evidence instead of failing on it) and must never write. A route is a pick
// or a typed refusal ('no eligible model', exit 1) — never a silent swap.

// Kernel-function kinds probe provider quota through Orca `account list`; every run here answers from
// the canned Orca so no spec reads a real account window.
const FAKE_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'starci-route-orca-'));
const FAKE=path.join(FAKE_DIR,'fake-orca.mjs');fs.writeFileSync(FAKE,FAKE_ORCA);
// after(), not process.on('exit'): the suite's temp-root guard reads the root at 'exit' before any later
// 'exit' listener could remove this, while a test-runner after-hook has already run by then.
after(()=>{try{fs.rmSync(FAKE_DIR,{recursive:true,force:true,maxRetries:20,retryDelay:25});}catch{/* a spawned child may still hold it */}});
let runSequence=0;
const run=(args,cwd=ROOT,env={})=>{
  const scopedEnv={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([FAKE]),
    APPDATA:path.join(FAKE_DIR,'appdata'),...env};
  if(!Object.hasOwn(env,'STARCI_TEST_MACHINE_FILE')){
    scopedEnv.STARCI_TEST_MACHINE_FILE=path.join(FAKE_DIR,`machine-${++runSequence}.sqlite`);
    const machine=openMachine({file:scopedEnv.STARCI_TEST_MACHINE_FILE,env:scopedEnv});machine.close();
  }
  return spawnSync(process.execPath,[ROUTE,...args],{cwd,encoding:'utf8',windowsHide:true,timeout:60000,env:scopedEnv});
};
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {dir(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'starci-route-'));dirs.push(d);return d;}};
};

test('--plan --kind code.refactor --difficulty hard walks the high tier in declared order and prints the pick record',t=>{
  // Isolate from the real owner config: the declared-tier assertion runs with no owner config at all.
  const ownerRoot=fixture(t).dir();
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.equal(body.plan,true);
  // A hard operation takes the high tier (modules/models/tiers.yaml): Sonnet 5.5, then Sol.
  assert.equal(body.tier?.name,'high');
  assert.deepEqual(body.tier?.chain,['claude/claude-sonnet-5-5','codex/gpt-6.1-sol'],'plan must walk tiers.yaml tiers.high in order');
  assert.ok(Array.isArray(body.candidates)&&body.candidates.length===body.tier.chain.length);
  // qualifications.yaml ships empty: every candidate must carry an evidence annotation, not a silent pass.
  for(const c of body.candidates)
    assert.ok(c.status==='qualified'||typeof c.evidence==='string'||(c.reasons??[]).length>0,
      `candidate ${c.target} has neither qualification nor an annotation — evidence gaps must be visible`);
  assert.equal(body.pick?.primary?.target,'claude-agent','tier order picks the first previewable member');
  // The per-step selection record of the common picker: chain after every step, who was dropped, who was chosen and by which step.
  const record=body.pickRecord;
  assert.deepEqual(record.steps.map(step=>step.step),['hard-filter','bias','balance','tokens']);
  assert.deepEqual(record.chain,body.tier.chain);
  assert.deepEqual(record.dropped,[]);
  assert.deepEqual(record.chosen,{id:'claude/claude-sonnet-5-5',by:'chain-order'});
  const text=run(['--kind','code.refactor','--difficulty','hard','--plan'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.match(text.stdout,/tier high: claude\/claude-sonnet-5-5 > codex\/gpt-6\.1-sol/);
  assert.match(text.stdout,/after tokens: /);
  assert.match(text.stdout,/chosen claude\/claude-sonnet-5-5 by chain-order/);
});

test('--plan reports a removed allocation key as an invalid config and never lets it bias the pick',t=>{
  const ownerRoot=fixture(t).dir();
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),
    'language: vi\nmodel: null\neffort: medium\nallocation: {mode: adaptive, preferredProvider: codex}\n');
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.match(body.config?.configInvalid,/allocation\.preferredProvider is removed/,'the removed key must be reported, never hidden');
  assert.deepEqual(body.tier?.chain,['claude/claude-sonnet-5-5','codex/gpt-6.1-sol']);
  assert.equal(body.pick?.primary?.target,'claude-agent','a removed key moves nothing: an owner preference is a goal routing bias');
  assert.deepEqual(body.pick?.fallbacks?.map(f=>f.target),['codex-agent']);
});

// The kernel's own model calls take the tier of their seat (tiers.yaml kindSeats): model.manageWorkflow is the kernel
// manager's, the frontier tier - Claude Opus 5.5 first, GPT-6.1 Sol second. selection.yaml decisionFlow kernel-function
// admits it with an empty qualification store.
const kernelRoute=(t,env={},extra=[])=>{
  const r=run(['--kind','model.manageWorkflow','--risk','high',...extra,'--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir(),...env});
  return {r,body:out(r)};
};

test('the unpinned --risk high kernel route resolves through the frontier tier to Claude Opus 5.5, Sol second',t=>{
  const {r,body}=kernelRoute(t);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.tier,'frontier');
  assert.deepEqual([body.pick.target,body.pick.model,body.pick.mode],['claude-agent','claude-opus-5-5','kernel-function']);
  assert.match(body.rule,/decisionFlow\.kernel-function/);
  assert.deepEqual(body.fallbackChain.map(f=>[f.target,f.model]),[['codex-agent','gpt-6.1-sol']]);
  assert.equal(body.availability['claude-agent'].state,'available');
  assert.deepEqual(body.pickRecord.chosen,{id:'claude/claude-opus-5-5',by:'chain-order'});
});

test('Opus at 90 percent of its tokens or a dead probe leaves the kernel to Sol',t=>{
  const limited=kernelRoute(t,{STARCI_FAKE_ORCA_LIMITED:'claude'});
  assert.equal(limited.r.status,0,limited.r.stderr);
  assert.deepEqual([limited.body.pick.target,limited.body.pick.model],['codex-agent','gpt-6.1-sol']);
  assert.deepEqual(limited.body.fallbackChain,[],'a reserve window cannot authorize an ordinary fallback launch');
  const skipped=limited.body.pickRecord.dropped.find(row=>row.id==='claude/claude-opus-5-5');
  assert.equal(skipped?.step,'tokens');
  assert.match(skipped.reason,/9[05]% or more of its tokens/);
  assert.equal(limited.body.pickRecord.chosen.id,'codex/gpt-6.1-sol');
  const dead=kernelRoute(t,{STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.pick.target,dead.body.pick.model],['codex-agent','gpt-6.1-sol']);
  assert.deepEqual(dead.body.fallbackChain,[]);
  assert.match(dead.body.rejected.find(x=>x.target==='claude-agent').reasons[0],/provider claude unavailable: quota probe dead/);
});

test('actual shared reservations count against capacity: a full Claude pool leaves the kernel to Sol',t=>{
  const machineFile=path.join(fixture(t).dir(),'machine.sqlite');
  const machine=openMachine({file:machineFile});
  try{
    for(let slot=0;slot<3;slot++)assert.equal(machine.reserveProvider({provider:'claude',account:'default',
      model:'claude-opus-5-5',role:'worker',attemptId:`route-pressure-${slot}`,maxParallel:6}).ok,true);
  }finally{machine.close();}
  const partly=kernelRoute(t,{STARCI_TEST_MACHINE_FILE:machineFile});
  assert.equal(partly.r.status,0,partly.r.stderr||partly.r.stdout);
  assert.equal(partly.body.pick.target,'claude-agent','free slots keep the head of the chain: reservations never reorder it');
  assert.equal(partly.body.admission.selected.capacity.running,3);
  const machineFull=openMachine({file:machineFile});
  try{
    for(let slot=3;slot<6;slot++)assert.equal(machineFull.reserveProvider({provider:'claude',account:'default',
      model:'claude-opus-5-5',role:'worker',attemptId:`route-pressure-${slot}`,maxParallel:6}).ok,true);
  }finally{machineFull.close();}
  const full=kernelRoute(t,{STARCI_TEST_MACHINE_FILE:machineFile});
  assert.equal(full.r.status,0,full.r.stderr||full.r.stdout);
  assert.deepEqual([full.body.pick.target,full.body.pick.model],['codex-agent','gpt-6.1-sol']);
  assert.equal(full.body.pickRecord.dropped.find(row=>row.id==='claude/claude-opus-5-5')?.step,'hard-filter');
});

test('an open provider circuit in the --repo ledger routes the kernel to Sol',t=>{
  const repo=fixture(t).dir();
  // The provider circuit is worker-wide machine state (provider-health moved out of the ledger's signals table);
  // --repo still gates the read on the repo having a ledger.
  const ledger=openLedger({file:ledgerFileFor(repo)});
  ledger.close();
  const machineFile=path.join(fixture(t).dir(),'machine.sqlite');
  const machine=openMachine({file:machineFile});
  try{
    writeProviderCircuit('claude',{machine,expiresAt:Date.now()+3600000,
      value:{schema:'starci/provider-health@1',provider:'claude',status:'unavailable',failureKind:'auth'}});
  }finally{machine.close();}
  const {r,body}=kernelRoute(t,{STARCI_TEST_MACHINE_FILE:machineFile},['--repo',repo]);
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual([body.pick.target,body.pick.model],['codex-agent','gpt-6.1-sol']);
  assert.match(body.rejected.find(x=>x.target==='claude-agent').reasons[0],/provider circuit open \(auth\)/);
});

test('both frontier members unavailable is a typed refusal naming both',t=>{
  const {r,body}=kernelRoute(t,{STARCI_FAKE_ORCA_DEAD:'claude,codex'});
  assert.equal(r.status,1,`route refusal must exit 1, got ${r.status}: ${r.stderr}`);
  assert.equal(body.pick,null);
  assert.match(body.rule,/no eligible model/);
  for(const [target,provider] of [['claude-agent','claude'],['codex-agent','codex']])
    assert.match(body.rejected.find(x=>x.target===target)?.reasons?.[0]??'',new RegExp(`provider ${provider} unavailable`));
});

test('operation kinds never take the kernel-function step',t=>{
  const r=run(['--kind','architecture.decide','--risk','high','--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir()});
  assert.equal(r.status,1,r.stdout);
  assert.match(out(r).rule,/no eligible model/);
});

test('drawing and host-tool gate: interface.draw takes the tier of its difficulty; a member lacking a required host tool is dropped by name',t=>{
  // interface.draw takes the high tier at medium (its hard floor) and declares no host tool (the runtime verbs drive the browser), so Claude
  // leads; a member lacking a host tool an op does declare is dropped by name. The imagegen call tier is never an op's tier.
  const ownerRoot=fixture(t).dir();
  const r=run(['--kind','interface.draw','--difficulty','medium','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.equal(body.tier?.name,'high');
  assert.deepEqual((body.candidates??[]).map(c=>c.target),['claude-agent','codex-agent']);
  assert.equal(body.pick?.primary?.target,'claude-agent','no host tool is required of the drawer: Claude leads the high tier');
  // interface.audit needs browser-dom, which the Claude host lacks: its high tier drops Sonnet by name and Sol takes it.
  const audit=out(run(['--kind','interface.audit','--difficulty','hard','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot}));
  assert.deepEqual((audit.candidates??[]).map(x=>x.target),['claude-agent','codex-agent']);
  const dropped=audit.pickRecord.dropped.find(row=>row.id==='claude/claude-sonnet-5-5');
  assert.equal(dropped?.step,'hard-filter');
  assert.match(dropped.reason,/lacks host tool 'browser-dom'/);
  assert.equal(audit.pick?.primary?.target,'codex-agent','Sol carries the tool and takes it');
});

test('--plan writes nothing to the working directory',t=>{
  const dir=fixture(t).dir();
  const before=fs.readdirSync(dir);
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],dir);
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual(fs.readdirSync(dir),before,'--plan is a view: it must not leave files behind');
});

test('--help prints the CLI usage and exits 0',()=>{
  const r=run(['--help']);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/--kind <kind>/);
});

// The model catalog is GPT-6.1 Sol/Luna on the codex-agent window, Claude Opus 5.5 / Sonnet 5.5 on claude-agent and
// SWE-2-Max on devin-agent. The launch model is the tier member (modules/models/tiers.yaml), never a per-pool difficulty pin.
const planModels=(t,kind,difficulty)=>{
  const r=run(['--kind',kind,'--difficulty',difficulty,'--plan','--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir()});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  return {body,model:target=>body.candidates.find(c=>c.target===target)?.model};
};

test('codex-agent launches gpt-6.1-sol in the frontier, high and medium tiers and gpt-6-luna in the low tier',t=>{
  const hard=planModels(t,'architecture.decide','hard');
  assert.deepEqual(hard.body.tier?.chain,['claude/claude-sonnet-5-5','codex/gpt-6.1-sol'],'hard work is Sonnet then Sol');
  assert.equal(hard.body.pick?.primary?.target,'claude-agent');
  assert.equal(hard.model('codex-agent'),'gpt-6.1-sol');
  const insane=planModels(t,'architecture.decide','insane');
  assert.deepEqual(insane.body.tier?.chain,['claude/claude-opus-5-5','codex/gpt-6.1-sol'],'insane work is Opus then Sol');
  assert.equal(insane.model('codex-agent'),'gpt-6.1-sol');
  assert.equal(planModels(t,'code.refactor','easy').model('codex-agent'),'gpt-6-luna');
  assert.equal(planModels(t,'code.refactor','medium').model('codex-agent'),'gpt-6.1-sol');
});

test('claude-agent launches claude-sonnet-5-5 at hard, claude-opus-5-5 at insane and sits in no lower tier',t=>{
  const r=run(['--kind','architecture.decide','--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir()});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.deepEqual([out(r)?.pick?.target,out(r)?.pick?.model],['claude-agent','claude-sonnet-5-5']);
  for(const [difficulty,model] of [['easy',undefined],['medium',undefined],['hard','claude-sonnet-5-5'],['insane','claude-opus-5-5']])
    assert.equal(planModels(t,'code.refactor',difficulty).model('claude-agent'),model,difficulty);
});

test('an explicit --model naming a removed catalog id fails closed as unknown',()=>{
  const DISPATCH=path.join(ROOT,'scripts','kernel','dispatch-op.mjs');
  const dispatch=model=>spawnSync(process.execPath,[DISPATCH,'--op','code.refactor','--model',model,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
  for(const removed of ['gpt-5.6-sol','claude-fable']){
    const r=dispatch(removed);
    assert.equal(r.status,1,`--model ${removed} must refuse, got ${r.status}: ${r.stdout}`);
    assert.match(r.stderr,new RegExp(`no model target '${removed.replaceAll('.','\\.')}' in modules/models/registry\\.yaml`));
  }
  for(const current of ['gpt-6.1-sol','gpt-6-luna']){
    const r=dispatch(current);
    assert.equal(r.status,0,r.stderr);
    assert.equal(out(r)?.constraints?.model??out(r)?.packet?.constraints?.model,current);
  }
});

const pick=(t,args,config=null)=>{
  const ownerRoot=fixture(t).dir();
  if(config)fs.writeFileSync(path.join(ownerRoot,'config.yaml'),config);
  const r=run([...args,'--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.stdout);
  return out(r);
};

test('a decide op measured medium is raised to hard and routes to Claude Sonnet 5.5; --prefer/--avoid are unknown args',t=>{
  const body=pick(t,['--kind','business.decide','--difficulty','medium']);
  assert.deepEqual([body.tier,body.pick.target,body.pick.model],['high','claude-agent','claude-sonnet-5-5']);
  assert.deepEqual(body.workload.difficulty,{measured:'medium',floor:'hard',effective:'hard'});
  for(const flag of ['--prefer','--avoid']){
    const r=run(['--kind','business.decide','--difficulty','medium',flag,'claude-agent','--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir()});
    assert.equal(r.status,2,`${flag} is refused`);
    assert.match(r.stderr,new RegExp(`unknown arg ${flag}`));
  }
});

test('the unpinned kernel route resolves to Claude Opus 5.5 of the frontier tier',t=>{
  const body=pick(t,['--kind','model.manageWorkflow']);
  assert.deepEqual([body.tier,body.pick.target,body.pick.model],['frontier','claude-agent','claude-opus-5-5']);
  assert.equal(body.workload.work,'think');
});

test('operation routes exclude unknown Devin quota and fall to the next member of the tier',t=>{
  const body=pick(t,['--kind','backend.implement','--difficulty','medium']);
  assert.deepEqual([body.tier,body.pick.target,body.pick.model],['medium','codex-agent','gpt-6.1-sol']);
  assert.ok(body.admission.rejected.find(row=>row.provider==='devin').codes.includes('quota-unknown'));
  assert.deepEqual(body.fallbackChain,[],'Sol is the last member of the medium tier');
  assert.equal(body.pickRecord.dropped.find(row=>row.id==='devin/swe-2-max')?.step,'hard-filter');
  const easy=pick(t,['--kind','code.refactor','--difficulty','easy']);
  assert.deepEqual([easy.tier,easy.pick.target,easy.pick.model],['low','codex-agent','gpt-6-luna']);
  assert.ok(easy.admission.rejected.find(row=>row.provider==='devin').codes.includes('quota-unknown'));
  assert.deepEqual(easy.fallbackChain,[]);
});

test('a removed allocation key never moves strategy work: it is reported and the tier decides',t=>{
  const config='language: vi\nmodel: null\neffort: medium\nallocation: {mode: adaptive, preferredProvider: devin}\n';
  const body=pick(t,['--kind','business.decide','--difficulty','easy'],config);
  assert.match(body.config.configInvalid,/allocation\.preferredProvider is removed/);
  assert.deepEqual([body.tier,body.pick.target,body.pick.model],['high','claude-agent','claude-sonnet-5-5']);
  assert.equal(body.rejected.find(r=>r.target==='devin-agent'),undefined,'Devin is not a member of the high tier at all');
  const review=pick(t,['--kind','review.verify','--difficulty','easy'],config);
  assert.equal(review.pick.target,'claude-agent','a removed key cannot manufacture Devin quota evidence');
  assert.equal(review.orderSource,'tiers.yaml tiers.high');
});
