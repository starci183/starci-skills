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
  assert.deepEqual(body.tier?.chain,['claude-agent','devin-agent','codex-agent'],'plan must walk runtimes.yaml allocation.tiers.hard.implement in order');
  assert.ok(Array.isArray(body.candidates)&&body.candidates.length===body.tier.chain.length);
  // qualifications.yaml ships empty: every candidate must carry an evidence annotation, not a silent pass.
  for(const c of body.candidates)
    assert.ok(c.status==='qualified'||typeof c.evidence==='string'||(c.reasons??[]).length>0,
      `candidate ${c.target} has neither qualification nor an annotation — evidence gaps must be visible`);
  assert.equal(body.pick?.primary?.target,'claude-agent','tier order picks the first previewable runtime');
});

test('--plan honours config.yaml allocation.preferredProvider as a pick bias',t=>{
  const ownerRoot=fixture(t).dir();
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),
    'language: vi\nmodel: null\neffort: medium\nallocation: {mode: adaptive, preferredProvider: devin}\n');
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  assert.equal(body.config?.preferredProvider,'devin','the bias must be reported, never hidden');
  assert.deepEqual(body.tier?.chain,['claude-agent','devin-agent','codex-agent'],'bias permutes the pick, never the declared tier chain');
  assert.equal(body.pick?.primary?.target,'devin-agent','preferredProvider hoists the first pickable candidate of that provider');
  // Bias is bounded: the non-preferred tier members remain as fallbacks, never removed.
  assert.deepEqual(body.pick?.fallbacks?.map(f=>f.target),['claude-agent','codex-agent']);
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

test('kindRequires capability gate: interface.draw cannot be hoisted onto a pool without imagegen',t=>{
  // regression: prefer devin-agent hoisted devin ahead of codex on
  // interface.draw, whose contract requires built-in image_gen.imagegen that
  // only the codex pool provides — one burned dispatch. kindRequires makes the
  // rejection structural and named.
  const ownerRoot=fixture(t).dir();
  const r=run(['--kind','interface.draw','--difficulty','medium','--prefer','devin-agent','--plan','--json'],ROOT,{STARCI_OWNER_ROOT:ownerRoot});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  const devin=(body.candidates??[]).find(c=>c.target==='devin-agent'||c.id==='devin-agent');
  assert.ok(devin,'devin-agent must appear in the walked chain');
  assert.equal(devin.status,'rejected');
  assert.ok((devin.reasons??[]).some(x=>/imagegen/.test(x)),`devin rejection must name the imagegen capability, got ${JSON.stringify(devin.reasons)}`);
  assert.equal(body.pick?.primary?.target,'codex-agent','the only imagegen pool takes the pick even under a devin prefer');
});

test('--plan writes nothing to the working directory',t=>{
  const dir=fixture(t).dir();
  const before=fs.readdirSync(dir);
  const r=run(['--kind','code.refactor','--difficulty','hard','--plan','--json'],dir);
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual(fs.readdirSync(dir),before,'--plan is a view: it must not leave files behind');
});
