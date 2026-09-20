import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WORKFLOW_OPS,buildOpsView,renderOpsView} from '../kernel/view.mjs';

const NOW=1_700_000_000_000;
const MIN=60_000;
const ago=minutes=>NOW-minutes*MIN;

/**
 * A synthetic runtime profile, shaped exactly like `loadRuntimes()`'s `modules/models/runtimes.yaml`: one map of
 * pools pinning a model per role, plus the `roleOfKind` fallback the allocator reads for kinds the graph does
 * not carry. Injected so the spec never depends on what the build resolved.
 */
const PROFILE={
  runtimes:{
    'codex-agent':{target:'codex-agent',provider:'codex',roles:['implement','verify','write','decide','plan'],maxParallel:8,
      models:{implement:'gpt-5.6-sol',verify:'gpt-5.6-sol',write:'gpt-5.6-sol',decide:'gpt-6-astra',plan:'gpt-6-astra'}},
    'claude-agent':{target:'claude-agent',provider:'claude',roles:['implement','verify','write','decide','plan'],maxParallel:6,
      models:{implement:'claude-opus-5',verify:'claude-opus-5',write:'claude-opus-5',decide:'claude-opus-5',plan:'claude-opus-5'}}
  },
  roleOfKind:{'backend.implement':'implement','frontend.implement':'implement','review.verify':'verify','decision.prepare':'decide','work.author':'plan'}
};

const tmp=t=>{
  const dir=path.join(os.tmpdir(),'starci-ops-view-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dir,{recursive:true});
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
};
const writeLines=(file,lines)=>fs.writeFileSync(file,lines.map(line=>JSON.stringify(line)).join('\n')+'\n');
const op=(id,kind,status,extra={})=>({id,kind,goal:id,status,runtime:null,nodeId:null,ledgerIds:[],allowlist:[`src/${id}`],refusal:null,dispatch:null,...extra});

/**
 * One workflow directory the way the kernel leaves it mid-run: two ops running (one allocated adaptively, one
 * launched on an unknown pool whose model only the `model-selected` event knows), two queued behind the
 * canonical writer, one blocked on a native-stop reconciliation still holding its lease, four done, and one
 * node cut into three children.
 */
function fixture(t,id='20260917-000000-ops'){
  const dir=path.join(tmp(t),id);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({
    schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id,dir,
    job:'Deliver the ops fixture',phase:'run',approved:true,iterations:29,
    engine:{schema:'starci/workflow-engine@1',version:1,generation:29,runtimePin:{digest:'eafd53e3c0ffee00'}},
    ops:[
      op('instance_db01','backend.implement','running',{runtime:'codex-agent',nodeId:'sales.db01',dispatch:'ctx_db01'}),
      op('fe-arch-audit','review.verify','running',{runtime:'claude-agent',nodeId:'fe.arch',dispatch:'ctx_audit'}),
      op('edge-op','backend.implement','running',{runtime:'other-agent',dispatch:'ctx_edge'}),
      op('instance_sales04','backend.implement','pending',{runtime:'codex-agent',nodeId:'sales.sales04'}),
      op('ask-4','decision.prepare','ready',{runtime:'claude-agent'}),
      op('ask-1','decision.prepare','blocked',{refusal:'runtime-reconciliation',
        pending:{kind:'native-stop-reconciliation',reasons:['native attempt could not be reconciled']},
        lease:{jobId:'job-ask-1',workflowId:id,opId:'ask-1',attempt:1,generation:29}}),
      op('big-op','work.author','done',{runtime:'claude-agent',nodeId:'big-op',verdict:'split',
        cut:{node:'big-op',reason:'14-file scope past the 12-file cut bound'}}),
      op('big-op-a','backend.implement','done',{runtime:'codex-agent',nodeId:'big-op-a'}),
      op('big-op-b','backend.implement','running',{runtime:'codex-agent',nodeId:'big-op-b',dispatch:'ctx_bigb'}),
      op('big-op-c','backend.implement','pending',{nodeId:'big-op-c'}),
      op('fe-locale-import-inventory-repair','frontend.implement','done',{runtime:'claude-agent',nodeId:'fe.locale'}),
      op('inventory-seed','backend.implement','done',{runtime:'codex-agent',nodeId:'sales.seed'})
    ],
    cuts:{'big-op':{children:['big-op-a','big-op-b','big-op-c'],seam:'big-op-a',assertions:[]}},
    ledger:[],lanes:{},needUser:[],finished:null
  }));
  writeLines(path.join(dir,'events.jsonl'),[
    {at:ago(90),seq:1,event:'approved',ops:12},
    {at:ago(80),seq:2,event:'cut-planned',op:'big-op',node:'big-op',reason:'14-file scope past the 12-file cut bound',files:14},
    {at:ago(70),seq:3,event:'cut-authored',node:'big-op',op:'big-op',children:['big-op-a','big-op-b','big-op-c'],seam:'big-op-a',groupAssertions:0},
    {at:ago(60),seq:4,event:'op-done',op:'big-op',node:'big-op',runtime:'claude-agent'},
    {at:ago(50),seq:5,event:'op-done',op:'big-op-a',node:'big-op-a',runtime:'codex-agent'},
    {at:ago(40),seq:6,event:'allocation-adaptive',op:'instance_db01',runtime:'codex-agent',provider:'codex',
      reason:'medium scope, highest headroom'},
    {at:ago(39),seq:7,event:'launched',op:'instance_db01',kind:'backend.implement',runtime:'codex-agent',attempt:1,dispatch:'ctx_db01'},
    {at:ago(38),seq:8,event:'allocation-adaptive',op:'fe-arch-audit',runtime:'claude-agent',provider:'claude',
      reason:'verify role prefers the audit lane'},
    {at:ago(37),seq:9,event:'launched',op:'fe-arch-audit',kind:'review.verify',runtime:'claude-agent',attempt:1,dispatch:'ctx_audit'},
    {at:ago(36),seq:10,event:'model-selected',function:'planOp',op:'edge-op',runtime:'swe-2-max',provider:'devin',mode:'qualified'},
    {at:ago(35),seq:11,event:'launched',op:'edge-op',kind:'backend.implement',runtime:'other-agent',attempt:1,dispatch:'ctx_edge'},
    {at:ago(30),seq:12,event:'launched',op:'big-op-b',kind:'backend.implement',runtime:'codex-agent',attempt:1,dispatch:'ctx_bigb'},
    {at:ago(20),seq:13,event:'schedule-deferred',op:'instance_sales04',reason:'resource lock clashes a running operation',
      resources:['canonical-writer'],clashes:['instance_db01']},
    {at:ago(19),seq:14,event:'admission-deferred',op:'ask-4',
      reason:'canonical-writer is held by ask-1 (contested lease canonical-writer:9f2e)'},
    {at:ago(18),seq:15,event:'schedule-deferred',op:'big-op-c',reason:'the seam big-op-a of big-op runs alone',parent:'big-op',running:['big-op-b']},
    {at:ago(15),seq:16,event:'op-done',op:'fe-locale-import-inventory-repair',node:'fe.locale',runtime:'claude-agent'},
    {at:ago(10),seq:17,event:'op-done',op:'inventory-seed',node:'sales.seed',runtime:'codex-agent'},
    {at:ago(5),seq:18,event:'candidate-reconciliation-required',op:'ask-1',kind:'native-stop-reconciliation',
      reasons:['native attempt could not be reconciled']}
  ]);
  fs.writeFileSync(path.join(dir,'kernel.lock'),JSON.stringify({pid:process.pid,startedAt:ago(95)}));
  return dir;
}

test('the digest buckets every op and resolves runtime, model and the last deciding event',t=>{
  const dir=fixture(t);
  const view=buildOpsView({dir,now:NOW,runtimes:PROFILE});
  assert.equal(view.schema,WORKFLOW_OPS);
  assert.equal(view.phase,'run');
  assert.equal(view.generation,29);
  assert.equal(view.pin,'eafd53e3');
  assert.equal(view.kernel.alive,true);
  assert.equal(view.kernel.pid,process.pid);
  assert.deepEqual(view.running.map(op=>op.id),['instance_db01','fe-arch-audit','edge-op','big-op-b']);
  assert.deepEqual(view.waiting.map(op=>op.id),['instance_sales04','ask-4','big-op-c']);
  assert.deepEqual(view.blocked.map(op=>op.id),['ask-1']);
  assert.equal(view.done.length,4);
  // The model is the pool's pin for the op's role when the profile resolves it.
  assert.equal(view.running.find(op=>op.id==='instance_db01').model,'gpt-5.6-sol');
  assert.equal(view.running.find(op=>op.id==='fe-arch-audit').model,'claude-opus-5');
  // A pool the profile does not carry falls back to the op's last model-selected event.
  assert.equal(view.running.find(op=>op.id==='edge-op').model,'swe-2-max');
  // why/waits/blocked are the last deciding event's own words and fields, never invented.
  assert.equal(view.running.find(op=>op.id==='instance_db01').why,'medium scope, highest headroom');
  assert.equal(view.waiting.find(op=>op.id==='instance_sales04').waits,
    'resource lock clashes a running operation (canonical-writer; held by instance_db01)');
  assert.equal(view.waiting.find(op=>op.id==='ask-4').waits,'canonical-writer is held by ask-1 (contested lease canonical-writer:9f2e)');
  assert.equal(view.waiting.find(op=>op.id==='big-op-c').waits,'the seam big-op-a of big-op runs alone');
  assert.equal(view.blocked[0].blocked,'native-stop-reconciliation (native attempt could not be reconciled, lease held)');
});

test('the rendered page scans in one screen: runtime+model+reason, the holding resource, the split group',t=>{
  const dir=fixture(t);
  const page=renderOpsView(buildOpsView({dir,now:NOW,runtimes:PROFILE}),{color:false});
  const lines=page.split('\n');
  assert.match(lines[0],/^workflow 20260917-000000-ops {2}phase=run {2}gen=29 {2}kernel=alive {2}pin=eafd53e3$/);
  const row=id=>lines.find(line=>new RegExp(`^\\s+${id}\\s`).test(line));
  assert.match(row('instance_db01'),/instance_db01\s+backend\.implement\s+codex-agent \(gpt-5\.6-sol\)\s+why: medium scope, highest headroom/);
  assert.match(row('fe-arch-audit'),/fe-arch-audit\s+review\.verify\s+claude-agent \(claude-opus-5\)\s+why: verify role prefers the audit lane/);
  assert.match(row('edge-op'),/edge-op\s+backend\.implement\s+other-agent \(swe-2-max\)\s+why: launched on other-agent/);
  // A queued op names the resource it waits on and who holds it.
  assert.match(row('instance_sales04'),/waits: resource lock clashes a running operation \(canonical-writer; held by instance_db01\)/);
  assert.match(row('ask-4'),/waits: canonical-writer is held by ask-1/);
  assert.match(row('ask-1'),/ask-1\s+decision\.prepare\s+-\s+blocked: native-stop-reconciliation.*lease held/);
  assert.ok(lines.includes('RUNNING (4)')&&lines.includes('WAITING (3)')&&lines.includes('BLOCKED (1)')&&lines.includes('DONE (4)'));
  assert.match(row('fe-locale-import-inventory-repair'),/fe-locale-import-inventory-repair\s+frontend\.implement\s+claude-agent/);
  // The split group lists its children and their runtimes, with the cut's own reason.
  const split=lines.find(line=>line.includes('→'));
  assert.match(split,/big-op {2}→ {2}big-op-a \(codex-agent\), big-op-b \(codex-agent\), big-op-c/);
  assert.match(split,/reason: 14-file scope past the 12-file cut bound/);
});

test('colour adds the same ANSI tones the tail uses and --color false strips them',t=>{
  const dir=fixture(t);
  const view=buildOpsView({dir,now:NOW,runtimes:PROFILE});
  const coloured=renderOpsView(view,{color:true});
  assert.match(coloured,/\x1b\[36m\x1b\[1mRUNNING \(4\)\x1b\[0m/);
  assert.match(coloured,/\x1b\[31m\x1b\[1mBLOCKED \(1\)\x1b\[0m/);
  assert.match(coloured,/\x1b\[2mwhy: medium scope, highest headroom\x1b\[0m/);
  assert.ok(!renderOpsView(view,{color:false}).includes('\x1b['));
});

test('a retry split of one op into ops groups by its split-of origin',t=>{
  const dir=fixture(t,'20260917-000000-retry');
  const state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));
  state.ops.push(op('wide-op-a','backend.implement','ready',{origin:'split of wide-op',runtime:'codex-agent'}),
    op('wide-op-b','backend.implement','pending',{origin:'split of wide-op'}));
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state));
  const view=buildOpsView({dir,now:NOW,runtimes:PROFILE});
  const group=view.splits.find(split=>split.parent==='wide-op');
  assert.deepEqual(group.children.map(child=>child.label),['wide-op-a','wide-op-b']);
  assert.equal(group.children[0].runtime,'codex-agent');
});
