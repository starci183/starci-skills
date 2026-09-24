import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {openLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const ROUTE=path.join(ROOT,'scripts','route','route-model.mjs');
// Lane m13: route-model.mjs is the selection.yaml executor. --plan is a
// what-if view (walks the runtimes.yaml difficulty tier, annotates missing
// evidence instead of failing on it) and must never write. A route is a pick
// or a typed refusal ('no eligible model', exit 1) — never a silent swap.

// Kernel-function kinds probe provider quota through Orca `account list`; every run here answers from
// the canned Orca so no spec reads a real account window.
const FAKE_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'starci-route-orca-'));
const FAKE=path.join(FAKE_DIR,'fake-orca.mjs');fs.writeFileSync(FAKE,FAKE_ORCA);
process.on('exit',()=>fs.rmSync(FAKE_DIR,{recursive:true,force:true}));
const run=(args,cwd=ROOT,env={})=>spawnSync(process.execPath,[ROUTE,...args],{cwd,encoding:'utf8',windowsHide:true,timeout:60000,
  env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([FAKE]),...env}});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {dir(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'starci-route-'));dirs.push(d);return d;}};
};

test('--plan --kind code.refactor --difficulty hard walks the tier in declared order and annotates',t=>{
  // Isolate from the real owner config: preferredProvider is a documented pick bias,
  // so the declared-tier assertion runs with no owner config at all.
  const ownerRoot=fixture(t).dir();
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.equal(body.plan,true);
  // roleOfKind pins code.refactor -> implement; the hard tier's implement chain is the contract.
  // Owner decision 2026-09-25 (72h scorecard): Devin leads hands-on implementation, Qwen seconds it.
  assert.deepEqual(body.tier?.chain,['devin-agent','qwen-agent','codex-agent','claude-agent'],'plan must walk runtimes.yaml allocation.tiers.hard.implement in order');
  assert.ok(Array.isArray(body.candidates)&&body.candidates.length===body.tier.chain.length);
  // qualifications.yaml ships empty: every candidate must carry an evidence annotation, not a silent pass.
  for(const c of body.candidates)
    assert.ok(c.status==='qualified'||typeof c.evidence==='string'||(c.reasons??[]).length>0,
      `candidate ${c.target} has neither qualification nor an annotation — evidence gaps must be visible`);
  assert.equal(body.pick?.primary?.target,'devin-agent','tier order picks the first previewable runtime');
});

test('--plan honours config.yaml allocation.preferredProvider as a pick bias',t=>{
  const ownerRoot=fixture(t).dir();
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),
    'language: vi\nmodel: null\neffort: medium\nallocation: {mode: adaptive, preferredProvider: codex}\n');
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.equal(body.config?.preferredProvider,'codex','the bias must be reported, never hidden');
  assert.deepEqual(body.tier?.chain,['devin-agent','qwen-agent','codex-agent','claude-agent'],'bias permutes the pick, never the declared tier chain');
  assert.equal(body.pick?.primary?.target,'codex-agent','preferredProvider hoists the first pickable candidate of that provider');
  // Bias is bounded: the non-preferred tier members remain as fallbacks, never removed.
  assert.deepEqual(body.pick?.fallbacks?.map(f=>f.target),['devin-agent','qwen-agent','claude-agent']);
});

// The kernel route is the think group: Claude Opus 5.5 first, GPT-6 Sol when Claude is unavailable.
// selection.yaml decisionFlow kernel-function admits it with an empty qualification store.
const kernelRoute=(t,env={},extra=[])=>{
  const r=run(['--kind','model.manageWorkflow','--risk','high',...extra,'--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir(),...env});
  return {r,body:out(r)};
};

test('the unpinned --risk high kernel route resolves through the think group to Claude Opus 5.5',t=>{
  const {r,body}=kernelRoute(t);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.pick.target,body.pick.model,body.pick.mode],['claude-agent','claude-opus-5-5','kernel-function']);
  assert.match(body.rule,/decisionFlow\.kernel-function/);
  assert.deepEqual(body.fallbackChain.map(f=>[f.target,f.model]),[['codex-agent','gpt-6-sol']]);
  assert.equal(body.availability['claude-agent'].state,'available');
});

test('Claude limited or dead routes the kernel to GPT-6 Sol',t=>{
  const limited=kernelRoute(t,{STARCI_FAKE_ORCA_LIMITED:'claude'});
  assert.equal(limited.r.status,0,limited.r.stderr);
  assert.deepEqual([limited.body.pick.target,limited.body.pick.model],['codex-agent','gpt-6-sol']);
  assert.deepEqual(limited.body.fallbackChain.map(f=>f.target),['claude-agent'],'a limited member stays launchable, last');
  const dead=kernelRoute(t,{STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.pick.target,dead.body.pick.model],['codex-agent','gpt-6-sol']);
  assert.deepEqual(dead.body.fallbackChain,[]);
  assert.match(dead.body.rejected.find(x=>x.target==='claude-agent').reasons[0],/provider claude unavailable: quota probe dead/);
});

test('an open provider circuit in the --repo ledger routes the kernel to GPT-6 Sol',t=>{
  const repo=fixture(t).dir();
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const now=Date.now();
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('provider-health','claude',NULL,NULL,?,?,?)")
      .run(JSON.stringify({schema:'starci/provider-health@1',provider:'claude',status:'unavailable',failureKind:'auth'}),now,now+3600000);
  }finally{ledger.close();}
  const {r,body}=kernelRoute(t,{},['--repo',repo]);
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual([body.pick.target,body.pick.model],['codex-agent','gpt-6-sol']);
  assert.match(body.rejected.find(x=>x.target==='claude-agent').reasons[0],/provider circuit open \(auth\)/);
});

test('both think-group members unavailable is a typed refusal naming both',t=>{
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

test('host-tool gate: interface.draw cannot be hoisted onto a pool whose agent lacks image_gen.imagegen',t=>{
  // regression: prefer devin-agent hoisted devin ahead of codex on
  // interface.draw, whose contract requires built-in image_gen.imagegen that
  // only the codex agent card lists — one burned dispatch. route.riskHints
  // host-tool-required + capabilities.hostTools make the rejection structural and named.
  const ownerRoot=fixture(t).dir();
  // interface.draw walks the draw order (runtimes.yaml allocation.preference.draw): Codex alone, so neither
  // devin-agent nor claude-agent is on its chain at all, whatever the prefer bias.
  const r=run(['--kind','interface.draw','--difficulty','medium','--prefer','devin-agent,claude-agent','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.deepEqual((body.candidates??[]).map(c=>c.target),['codex-agent'],'the draw order is Codex alone');
  assert.equal(body.pick?.primary?.target,'codex-agent','the only imagegen pool takes the pick even under a prefer bias');
  // A chain with a pool that lacks the tool rejects it by name: interface.audit needs browser-dom. It walks the
  // review order (owner decision 2026-09-25 review-hands), where Devin and Codex carry the tool.
  const audit=out(run(['--kind','interface.audit','--difficulty','hard','--prefer','qwen-agent,claude-agent','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot}));
  for(const target of ['qwen-agent','claude-agent']){
    const c=(audit.candidates??[]).find(x=>x.target===target);
    assert.ok(c,`${target} must appear in the walked chain`);
    assert.equal(c.status,'rejected');
    assert.ok((c.reasons??[]).some(x=>/browser-dom/.test(x)),`${target} rejection must name the browser-dom capability, got ${JSON.stringify(c.reasons)}`);
  }
  assert.equal(audit.pick?.primary?.target,'devin-agent');
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

// The model catalog is GPT-6 Sol/Luna on the codex-agent window and Claude Opus 5.5 on
// claude-agent (modules/models/runtimes.yaml). The launch model is the pool's difficulty pin.
const planModels=(t,kind,difficulty)=>{
  const r=run(['--kind',kind,'--difficulty',difficulty,'--plan','--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir()});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  return {body,model:target=>body.candidates.find(c=>c.target===target)?.model};
};

test('codex-agent launches gpt-6-sol on the hard tier and gpt-6-luna on the easy tier',t=>{
  const hard=planModels(t,'architecture.decide','hard');
  assert.deepEqual(hard.body.tier?.chain,['claude-agent','codex-agent'],'think work is Opus then Sol only');
  assert.equal(hard.body.pick?.primary?.target,'claude-agent');
  assert.equal(hard.model('codex-agent'),'gpt-6-sol');
  assert.equal(planModels(t,'architecture.decide','insane').model('codex-agent'),'gpt-6-sol');
  assert.equal(planModels(t,'code.refactor','easy').model('codex-agent'),'gpt-6-luna');
  assert.equal(planModels(t,'code.refactor','medium').model('codex-agent'),'gpt-6-luna');
});

test('claude-agent launches claude-opus-5-5 at the default difficulty and every tier',t=>{
  const r=run(['--kind','architecture.decide','--prefer','claude-agent','--json'],ROOT,{STARCI_OWNER_ROOT:fixture(t).dir()});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.deepEqual([out(r)?.pick?.target,out(r)?.pick?.model],['claude-agent','claude-opus-5-5']);
  for(const difficulty of ['easy','medium','hard','insane'])
    assert.equal(planModels(t,'code.refactor',difficulty).model('claude-agent'),'claude-opus-5-5',difficulty);
});

test('an explicit --model naming a removed catalog id fails closed as unknown',()=>{
  const DISPATCH=path.join(ROOT,'scripts','route','dispatch-op.mjs');
  const dispatch=model=>spawnSync(process.execPath,[DISPATCH,'--op','code.refactor','--model',model,'--dry-run','--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
  for(const removed of ['gpt-5.6-sol','claude-fable']){
    const r=dispatch(removed);
    assert.equal(r.status,1,`--model ${removed} must refuse, got ${r.status}: ${r.stdout}`);
    assert.match(r.stderr,new RegExp(`no model profile ${removed.replaceAll('.','\\.')}`));
  }
  for(const current of ['gpt-6-sol','gpt-6-luna']){
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

test('a decide op measured medium routes to Claude Opus 5.5, and to GPT-6 Sol when Claude is unavailable',t=>{
  const body=pick(t,['--kind','business.decide','--difficulty','medium']);
  assert.deepEqual([body.pick.target,body.pick.model],['claude-agent','claude-opus-5-5']);
  assert.deepEqual(body.workload.difficulty,{measured:'medium',floor:'hard',effective:'hard'});
  const fallback=pick(t,['--kind','business.decide','--difficulty','medium','--avoid','claude-agent']);
  assert.deepEqual([fallback.pick.target,fallback.pick.model],['codex-agent','gpt-6-sol']);
});

test('the unpinned kernel route resolves to Claude Opus 5.5',t=>{
  const body=pick(t,['--kind','model.manageWorkflow']);
  assert.deepEqual([body.pick.target,body.pick.model],['claude-agent','claude-opus-5-5']);
  assert.equal(body.workload.work,'think');
});

test('backend.implement measured medium routes to Qwen or Devin, and grammar.update at its hard floor starts at Qwen',t=>{
  const body=pick(t,['--kind','backend.implement','--difficulty','medium']);
  assert.ok(['qwen-agent','devin-agent'].includes(body.pick.target),body.pick.target);
  assert.deepEqual(body.fallbackChain.slice(-2).map(f=>f.target),['codex-agent','claude-agent']);
  const hard=pick(t,['--kind','grammar.update','--difficulty','easy']);
  assert.deepEqual([hard.pick.target,hard.pick.model],['qwen-agent','deepseek-v4.1-flash']);
  assert.equal(hard.fallbackChain[0]?.target,'devin-agent','Devin follows Qwen on the scaffold order');
});

test('preferredProvider never moves strategy work onto a non-frontier pool',t=>{
  const config='language: vi\nmodel: null\neffort: medium\nallocation: {mode: adaptive, preferredProvider: devin}\n';
  const body=pick(t,['--kind','business.decide','--difficulty','easy'],config);
  assert.equal(body.config.preferredProvider,'devin');
  assert.deepEqual([body.pick.target,body.pick.model],['claude-agent','claude-opus-5-5']);
  const devin=body.rejected.find(r=>r.target==='devin-agent');
  assert.match(devin?.reasons?.[0]??'',/think work runs only on runtimes.yaml allocation.preference.think/);
  // A verdict walks the review order (owner decision 2026-09-25 review-hands): the hands are on it.
  const review=pick(t,['--kind','review.verify','--difficulty','easy'],config);
  assert.ok(['devin-agent','qwen-agent'].includes(review.pick.target),review.pick.target);
  assert.match(review.orderSource,/registry.yaml operators.review.verify.chain/);
});
