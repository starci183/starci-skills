import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(import.meta.dirname,'..');
const ROUTE=path.join(ROOT,'scripts','route','route-model.mjs');
// Lane m13: route-model.mjs is the selection.yaml executor. --plan is a
// what-if view (walks the runtimes.yaml difficulty tier, annotates missing
// evidence instead of failing on it) and must never write. A route is a pick
// or a typed refusal ('no eligible model', exit 1) — never a silent swap.

const run=(args,cwd=ROOT,env={})=>spawnSync(process.execPath,[ROUTE,...args],{cwd,encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,...env}});
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
  assert.deepEqual(body.tier?.chain,['devin-agent','codex-agent','claude-agent'],'plan must walk runtimes.yaml allocation.tiers.hard.implement in order');
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
  assert.deepEqual(body.tier?.chain,['devin-agent','codex-agent','claude-agent'],'bias permutes the pick, never the declared tier chain');
  assert.equal(body.pick?.primary?.target,'codex-agent','preferredProvider hoists the first pickable candidate of that provider');
  // Bias is bounded: the non-preferred tier members remain as fallbacks, never removed.
  assert.deepEqual(body.pick?.fallbacks?.map(f=>f.target),['devin-agent','claude-agent']);
});

test('--kind model.manageWorkflow --risk high resolves or fails typed, never silently',t=>{
  const r=run(['--kind','model.manageWorkflow','--risk','high','--json']);
  const body=out(r);
  if(r.status===0){
    assert.ok(body?.pick,'exit 0 without a pick is a silent route');
  }else{
    // Elevated kernel-function work with no qualification store: the only honest answer is a typed refusal.
    assert.equal(r.status,1,`route refusal must exit 1, got ${r.status}: ${r.stderr}`);
    assert.ok(body,`a refusal must still print the JSON verdict, got: ${r.stdout}`);
    assert.match(body.rule??'',/no eligible model/);
    assert.ok((body.rejected??[]).length>0&&body.rejected.every(c=>(c.reasons??[]).length>0),
      'every rejected candidate must name its reasons');
  }
});

test('host-tool gate: interface.draw cannot be hoisted onto a pool whose agent lacks image_gen.imagegen',t=>{
  // regression: prefer devin-agent hoisted devin ahead of codex on
  // interface.draw, whose contract requires built-in image_gen.imagegen that
  // only the codex agent card lists — one burned dispatch. route.riskHints
  // host-tool-required + capabilities.hostTools make the rejection structural and named.
  const ownerRoot=fixture(t).dir();
  // interface.draw is think work, so a non-frontier pool is not on its chain at all; the frontier pool
  // without imagegen is on it and must be rejected by name.
  const r=run(['--kind','interface.draw','--difficulty','medium','--prefer','devin-agent,claude-agent','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.ok(!(body.candidates??[]).some(c=>c.target==='devin-agent'),'a prefer bias cannot put devin-agent on a think chain');
  const claude=(body.candidates??[]).find(c=>c.target==='claude-agent');
  assert.ok(claude,'claude-agent must appear in the walked chain');
  assert.equal(claude.status,'rejected');
  assert.ok((claude.reasons??[]).some(x=>/imagegen/.test(x)),`claude rejection must name the imagegen capability, got ${JSON.stringify(claude.reasons)}`);
  assert.equal(body.pick?.primary?.target,'codex-agent','the only imagegen pool takes the pick even under a prefer bias');
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
  assert.deepEqual(hard.body.tier?.chain,['claude-agent','codex-agent'],'think work leads with the Claude pool');
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

test('backend.implement measured medium routes to Qwen or Devin, and a hard floor never lands on Qwen',t=>{
  const body=pick(t,['--kind','backend.implement','--difficulty','medium']);
  assert.ok(['qwen-agent','devin-agent'].includes(body.pick.target),body.pick.target);
  assert.deepEqual(body.fallbackChain.slice(-2).map(f=>f.target),['codex-agent','claude-agent']);
  const hard=pick(t,['--kind','grammar.update','--difficulty','easy']);
  assert.deepEqual([hard.pick.target,hard.pick.model],['devin-agent','swe-2-max']);
});

test('preferredProvider never moves think work onto a non-frontier pool',t=>{
  const config='language: vi\nmodel: null\neffort: medium\nallocation: {mode: adaptive, preferredProvider: devin}\n';
  const body=pick(t,['--kind','review.verify','--difficulty','easy'],config);
  assert.equal(body.config.preferredProvider,'devin');
  assert.deepEqual([body.pick.target,body.pick.model],['claude-agent','claude-opus-5-5']);
  const devin=body.rejected.find(r=>r.target==='devin-agent');
  assert.match(devin?.reasons?.[0]??'',/think work runs only on/);
});
