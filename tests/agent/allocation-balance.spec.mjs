import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../../engine/yaml.mjs';
import {configuredAllocationPolicy,parseAllocationGrant,validateConfig} from '../../engine/config.mjs';
import {balanceDeficits,loadRuntimes} from '../../scripts/agent/models.mjs';
import {fakePoolSelection as selectPool} from '../helpers/fake-admission.mjs';
import {auditAuthorOf,recentDispatchCounts,recentPoolCounts,thinkAuthorOf} from '../../scripts/agent/balance.mjs';
import {isFixtureLedgerPath,machineLedgerFiles} from '../../scripts/machine/ledger-files.mjs';
import {openLedger} from '../../engine/db/ledger.mjs';
import {withLedger,seedWorkflow,sameDriveTmp} from '../helpers/ledger-fixture.mjs';

// Owner goal 2026-09-24: spread jobs over Opus, Sol and Devin, open Devin by a default owner grant, and review think
// output with the other frontier family. Owner decision 2026-09-25 (from the 72h scripts/agent/model-scorecard.mjs
// evidence): each kind walks its evidence order - implementation and scaffold Devin first, think work Opus then Sol
// only, interface.draw Devin then Codex - and balanced ranks by that order and caps by the owner shares. Owner
// decision 2026-09-25 review-hands: Opus and Sol keep strategy only; the verify kinds left on review and
// work.author walk the review order - Devin, Opus and Sol overflow only (a review of Devin's work goes to them).
// Owner routing 2026-09-26: the UI verifications (interface.audit, e2e.verify, security.verify,
// uat.assisted.verify) walk the ui order - Sol first, Devin behind it; the mechanical ops provision.ask,
// workspace.manage, task.execute and knowledge.repair walk the implement order the hands serve; the kernel's own
// model calls walk sol-think (Sol first, Opus overflow). Owner ruling 2026-09-29: the Qwen pool is removed. These
// specs hold that contract on the shipped runtimes.yaml (allocation policy) and registry.yaml (the pool map).
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const read=file=>parseYaml(fs.readFileSync(path.join(ROOT,file),'utf8'));
const runtimes=loadRuntimes(path.join(ROOT,'modules','models'));
const EVEN={'claude-agent':25,'codex-agent':25,'devin-agent':25};
const OWNER={'devin-agent':35,'claude-agent':20,'codex-agent':10};
const balanced=(opts)=>selectPool({runtimes,policy:'balanced',shares:EVEN,...opts});
const REVIEW_KINDS=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.order==='review').map(([k])=>k);
// brand.decide walks its own brand order (Opus, then Sol; owner ruling 2026-09-27) - still strategy.
const STRATEGY_KINDS=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='think'&&(!e.order||e.order==='brand')).map(([k])=>k);
const UI_KINDS=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.order==='ui').map(([k])=>k);
const KERNEL_KINDS=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.order==='sol-think').map(([k])=>k);
const MECHANICAL_KINDS=['provision.ask','workspace.manage','task.execute','knowledge.repair'];

test('live pool selection refuses a concrete opaque model requirement and accepts the provider alone',()=>{
  const options={kind:'backend.implement',difficulty:'medium',runtimes,capacity:{},scopeId:'pool-authority-proof'};
  const required=selectPool({...options,bias:{require:{provider:'devin',model:'swe-2-max'}}});
  assert.equal(required.admission.reason,'required-unavailable');
  assert.ok(required.error&&!required.target,'another available provider cannot satisfy a hard requirement');
  assert.ok(required.admission.rejected.find(row=>row.id==='devin-agent').codes.includes('required-model-unverifiable'));
  const provider=selectPool({...options,bias:{require:{provider:'devin'}}});
  assert.equal(provider.target,'devin-agent');
  assert.equal(provider.admission.selected.modelAuthority,'configured-logical-runtime');
});

test('balanced: the order ranks and the share caps - the first eligible pool still below its share wins',()=>{
  // medium implementation: Devin leads its order and sits below its share, so it takes it although Codex is further below.
  const r=balanced({kind:'backend.implement',difficulty:'medium',recent:{'claude-agent':60,'codex-agent':1,'devin-agent':29}});
  assert.equal(r.policy,'balanced');
  assert.deepEqual([r.target,r.modelId,r.order,r.balance.rule],['devin-agent','swe-2-max','implement','first-under-share']);
  assert.deepEqual(r.balance.candidates,['devin-agent','codex-agent']);
  assert.ok(r.balance.deficits['codex-agent'].deficit>r.balance.deficits['devin-agent'].deficit,'the rank, not the largest deficit, decides');
  // Devin at its share: the next pool of the order still below its share takes it.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{'claude-agent':36,'codex-agent':30,'devin-agent':34}}).target,'codex-agent');
  // No history: the order's first pool.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{}}).target,'devin-agent');
  assert.equal(balanced({kind:'backend.scaffold',difficulty:'medium',recent:{}}).target,'devin-agent');
  // Every eligible pool at or over its share: the least over takes it.
  const over=balanced({kind:'backend.implement',difficulty:'medium',recent:{'claude-agent':4,'devin-agent':34,'codex-agent':32}});
  assert.deepEqual([over.target,over.balance.rule],['codex-agent','least-over']);
  const d=balanceDeficits(['a','b'],{shares:{a:3,b:1},recent:{a:1,b:1}});
  assert.deepEqual([d.a.target,d.b.target,d.a.actual],[0.75,0.25,0.5]);
});

test('balanced: an ineligible pool is never chosen, however far below its share it is',()=>{
  const recent={'claude-agent':50,'codex-agent':50};
  // Devin full: Codex takes it although both are at 0%.
  const r=balanced({kind:'backend.implement',difficulty:'medium',recent,capacity:{'devin-agent':{running:10}}});
  assert.equal(r.target,'codex-agent');
  assert.deepEqual(r.rejected.map(x=>x.target).sort(),['devin-agent']);
  // Easy: Devin pins no easy model, so it is not a candidate at all.
  const easy=balanced({kind:'code.refactor',difficulty:'easy',recent});
  assert.equal(easy.target,'codex-agent');
  assert.ok(!easy.chain.includes('devin-agent'));
  // Insane: only the frontier pools pin a model; Devin does not.
  const insane=balanced({kind:'backend.implement',difficulty:'insane',recent:{'claude-agent':90,'codex-agent':10}});
  assert.deepEqual([insane.target,insane.balance.candidates],['codex-agent',['claude-agent','codex-agent']]);
  // an owner avoid bias removes a pool under balanced too.
  assert.notEqual(balanced({kind:'backend.implement',difficulty:'medium',recent,bias:{avoid:['devin-agent']}}).target,'devin-agent');
});

test('balanced: Opus is hands-on overflow only, and an owner prefer bias only breaks ties',()=>{
  // Claude has the biggest deficit but stays out of hands-on work while another pool is eligible.
  const r=balanced({kind:'backend.implement',difficulty:'hard',recent:{'codex-agent':10,'devin-agent':10}});
  assert.notEqual(r.target,'claude-agent');
  const full={'devin-agent':{running:10},'codex-agent':{running:10}};
  assert.equal(balanced({kind:'backend.implement',difficulty:'hard',recent:{},capacity:full}).target,'claude-agent','overflow when nothing else is eligible');
  // A prefer bias does not override the order's pick of a pool below its share...
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{'devin-agent':5},bias:{prefer:['devin-agent']}}).target,'codex-agent');
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{},bias:{prefer:['codex-agent']}}).target,'devin-agent');
  // ...but wins a tie between pools equally over their shares.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{'devin-agent':1,'codex-agent':1},bias:{prefer:['codex-agent']}}).target,'codex-agent');
});

test('strategy runs on Opus then Sol under balanced - never Devin, whatever its deficit',()=>{
  // Owner routing 2026-09-26 shrank the strategy set: the mechanical ops walk implement, the UI verdicts walk
  // ui, the kernel calls walk sol-think. What is left - the Opus-led think kinds - never routes to the hands.
  assert.deepEqual([...STRATEGY_KINDS].sort(),
    ['architecture.decide','architecture.revise','brand.decide','business.decide','business.revise','decision.prepare',
      'goal.revise','implementation.plan','request.analyze','scope.define']);
  for(const kind of ['request.analyze','scope.define','business.decide','architecture.decide','brand.decide','decision.prepare',
    'implementation.plan','goal.revise'])
    assert.ok(STRATEGY_KINDS.includes(kind),`${kind} is strategy`);
  const starved={'claude-agent':100,'codex-agent':100};// Devin at 0% - the largest deficit
  for(const kind of STRATEGY_KINDS){
    const r=balanced({kind,difficulty:'medium',recent:starved});
    assert.ok(['claude-agent','codex-agent'].includes(r.target),`${kind} -> ${r.target}`);
    if(kind!=='brand.decide')assert.equal(r.target,'claude-agent',`${kind}: Opus leads the think order`);
    for(const d of ['easy','medium','hard','insane'])
      assert.ok(!selectPool({kind,difficulty:d,runtimes,policy:'balanced',shares:OWNER,recent:starved}).chain.includes('devin-agent'),`${kind}@${d}`);
  }
  // Under the owner shares Opus takes think work until it reaches 20%, Sol after it.
  assert.equal(balanced({kind:'business.decide',difficulty:'medium',shares:OWNER,recent:{'claude-agent':10,'codex-agent':0,'devin-agent':45}}).target,'claude-agent');
  assert.equal(balanced({kind:'business.decide',difficulty:'medium',shares:OWNER,recent:{'claude-agent':30,'codex-agent':2,'devin-agent':34}}).target,'codex-agent');
  // The default policy keeps Claude first.
  assert.equal(selectPool({kind:'business.decide',difficulty:'medium',runtimes}).target,'claude-agent');
  // The kernel's own model calls are frontier work too, Sol first on sol-think - never the hands.
  assert.ok(KERNEL_KINDS.length>=7);
  for(const kind of KERNEL_KINDS){
    const r=balanced({kind,difficulty:'medium',recent:starved});
    assert.equal(r.order,'sol-think',kind);
    assert.equal(r.target,'codex-agent',`${kind}: Sol leads the kernel calls`);
    for(const d of ['easy','medium','hard','insane'])
      assert.ok(!selectPool({kind,difficulty:d,runtimes,policy:'balanced',shares:OWNER,recent:starved}).chain.includes('devin-agent'),`${kind}@${d}`);
  }
});

test('the mechanical ops walk the implement order the hands serve - whatever their kind role',()=>{
  // Owner routing 2026-09-26: provision.ask (decide), workspace.manage and task.execute (plan) and
  // knowledge.repair (write) are think work on the implement order, so the hands take them although their
  // kind roles are not hands roles.
  for(const kind of MECHANICAL_KINDS){
    assert.equal(runtimes.roleOfKind[kind].order,'implement',kind);
    const r=balanced({kind,difficulty:'medium',recent:{}});
    assert.deepEqual([r.order,r.target],['implement','devin-agent'],`${kind} -> ${r.target}`);
    assert.equal(balanced({kind,difficulty:'medium',recent:{},capacity:{'devin-agent':{running:10}}}).target,'codex-agent',`${kind}: Codex seconds Devin`);
    // The hard floor raises an easy measure to the hard tier, where Devin leads the implement order.
    const easy=selectPool({kind,difficulty:'easy',runtimes});
    assert.deepEqual([easy.difficulty,easy.target],['hard','devin-agent'],`${kind}@easy -> hard floor`);
  }
});

test('the evidence orders: implementation and scaffold Devin first, draw Devin then Codex, asset Codex only',()=>{
  const route=(kind,difficulty,extra={})=>selectPool({kind,difficulty,runtimes,policy:'balanced',shares:OWNER,recent:{},...extra});
  for(const kind of ['backend.implement','interface.implement','code.refactor','test.author','runtime.operate','release.deliver'])
    for(const d of ['medium','hard']){
      const r=route(kind,d);
      assert.deepEqual([r.target,r.chain.slice(0,2)],['devin-agent',['devin-agent','codex-agent']],`${kind}@${d}`);
      assert.equal(route(kind,d,{capacity:{'devin-agent':{running:10}}}).target,'codex-agent',`${kind}@${d}: Codex seconds Devin`);
    }
  for(const kind of ['backend.scaffold','interface.scaffold','package.scaffold','docs.author','content.generate','grammar.update'])
    for(const d of ['easy','medium','hard']){
      const r=route(kind,d);
      // Devin pins no easy model, so easy scaffold work starts at Codex.
      assert.deepEqual([r.target,r.order],[r.difficulty==='easy'?'codex-agent':'devin-agent','scaffold'],`${kind}@${d}`);
      if(r.difficulty!=='easy')assert.equal(route(kind,d,{capacity:{'devin-agent':{auth:'dead'}}}).target,'codex-agent',`${kind}@${d}: Codex seconds Devin`);
    }
  // A hands-on cut slice walks the scaffold order whatever its kind; think work never leaves the think order.
  const slice=route('backend.implement','medium',{fanOut:true});
  assert.deepEqual([slice.target,slice.order],['devin-agent','scaffold']);
  const thinkSlice=route('architecture.decide','hard',{fanOut:true});
  assert.deepEqual([thinkSlice.target,thinkSlice.order],['claude-agent','think']);
  // interface.draw: Devin first, Codex the fallback (owner ruling 2026-09-27); interface.asset: the Codex image tool alone.
  const draw=route('interface.draw','hard');
  assert.deepEqual([draw.target,draw.chain,draw.order],['devin-agent',['devin-agent','codex-agent'],'draw']);
  assert.equal(route('interface.draw','hard',{capacity:{'devin-agent':{auth:'dead'}}}).target,'codex-agent','Codex draws when Devin cannot');
  const asset=route('interface.asset','hard');
  assert.deepEqual([asset.target,asset.chain,asset.order],['codex-agent',['codex-agent'],'asset']);
  assert.ok(route('interface.asset','hard',{capacity:{'codex-agent':{auth:'dead'}}}).error,'interface.asset refuses with Codex down');
});

test('review work walks the review order: Devin, Opus and Sol overflow only - never ahead by share or prefer',()=>{
  // Owner routing 2026-09-26 took the UI verifications (interface.audit, e2e.verify, security.verify,
  // uat.assisted.verify) off the review order onto ui; the review order keeps the rest.
  for(const kind of ['review.verify','handover.review','work.author','goal.validate','integration.verify','perf.verify','uat.verify'])
    assert.ok(REVIEW_KINDS.includes(kind),`${kind} walks the review order`);
  assert.deepEqual(runtimes.allocation.preference.review,['devin-agent','claude-agent','codex-agent']);
  assert.deepEqual(runtimes.allocation.overflowByOrder.review,['claude-agent','codex-agent']);
  assert.deepEqual(runtimes.allocation.hands,['devin-agent']);
  const registry=read('modules/models/registry.yaml');
  // Opus and Sol far below their shares, Devin far over its: the hands still take every review.
  const starvedFrontier={'devin-agent':100};
  for(const kind of REVIEW_KINDS){
    if(runtimes.roleOfKind[kind].work==='think')assert.equal(runtimes.roleOfKind[kind].floor,'hard',kind);
    const chain=registry.operators[kind]?.chain;
    if(chain)assert.deepEqual(chain,['devin-agent','claude-agent','codex-agent'],`${kind} chain`);
    for(const policy of ['balanced','prefer-then-overflow']){
      const r=selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,recent:starvedFrontier,bias:{prefer:['claude-agent','codex-agent']}});
      assert.equal(r.order,'review',kind);
      assert.equal(r.target,'devin-agent',`${kind}/${policy} -> ${r.target}`);
      assert.equal(r.overflow.used,false);
      // Devin unavailable: the overflow takes it - Opus first for a think verdict and, under balanced,
      // Sol before Opus on hands-on verify (Opus stays hands-on overflow).
      const out=selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,recent:{},
        capacity:{'devin-agent':{auth:'dead'}}});
      const want=policy==='balanced'&&runtimes.roleOfKind[kind].work==='hands-on'?'codex-agent':'claude-agent';
      assert.deepEqual([out.target,out.overflow.used],[want,true],`${kind}/${policy} overflow`);
    }
  }
  // Insane: Devin pins no insane model, so an insane review is Opus's.
  assert.equal(selectPool({kind:'review.verify',difficulty:'insane',runtimes}).target,'claude-agent');
  // A review cut slice keeps the review order, never the scaffold order; a ui slice keeps ui.
  assert.equal(selectPool({kind:'uat.verify',difficulty:'medium',runtimes,fanOut:true}).order,'review');
  assert.equal(selectPool({kind:'e2e.verify',difficulty:'medium',runtimes,fanOut:true}).order,'ui');
});

test('UI verification walks the ui order: Sol first, Devin behind it, never the review overflow',()=>{
  // Owner routing 2026-09-26: interface.audit, e2e.verify, security.verify and uat.assisted.verify lead with
  // Codex; the hands are the fallback when the Codex quota circuit opens - there is no frontier overflow.
  assert.deepEqual([...UI_KINDS].sort(),['e2e.verify','interface.audit','security.verify','uat.assisted.verify']);
  assert.deepEqual(runtimes.allocation.preference.ui,['codex-agent','devin-agent']);
  const registry=read('modules/models/registry.yaml');
  for(const kind of UI_KINDS){
    const chain=registry.operators[kind]?.chain;
    if(chain)assert.deepEqual(chain,['codex-agent','devin-agent'],`${kind} chain`);
    for(const policy of ['balanced','prefer-then-overflow']){
      const r=selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,recent:{}});
      assert.equal(r.order,'ui',kind);
      assert.equal(r.target,'codex-agent',`${kind}/${policy} -> ${r.target}`);
      // Sol down: the order falls to the hands, Devin.
      const out=selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,recent:{},capacity:{'codex-agent':{auth:'dead'}}});
      assert.equal(out.target,'devin-agent',`${kind}/${policy} with Sol down -> ${out.target}`);
      // Every declared pool down: a typed refusal, never a sideways pick off the order.
      const down=selectPool({kind,difficulty:'hard',runtimes,capacity:{'codex-agent':{auth:'dead'},'devin-agent':{auth:'dead'}}});
      assert.ok(down.error&&!down.target,`${kind} refuses rather than land on Opus`);
    }
  }
});

test('interface.audit walks the ui order: Sol leads it and Devin follows, both hold the browser-dom tool',()=>{
  const r=selectPool({kind:'interface.audit',difficulty:'hard',runtimes,policy:'balanced',shares:OWNER,recent:{}});
  assert.deepEqual([r.target,r.order,r.chain],['codex-agent','ui',['codex-agent','devin-agent']]);
  // Devin implemented the interface: the cross-family candidate is Codex.
  const cross=selectPool({kind:'interface.audit',difficulty:'hard',runtimes,policy:'balanced',shares:OWNER,recent:{},auditOf:'devin-agent'});
  assert.deepEqual([cross.target,cross.crossFamily.applied],['codex-agent',true]);
  // Codex and Devin both down: no pool left on the order - a typed refusal, never Claude, which lacks the tool.
  const down=selectPool({kind:'interface.audit',difficulty:'hard',runtimes,capacity:{'devin-agent':{auth:'dead'},'codex-agent':{auth:'dead'}}});
  assert.ok(down.error&&!down.target,'refuse rather than audit without the browser');
});

test('200 balanced routes over the 72h kind mix: each family stays on its order and the shares cap the leaders',()=>{
  // The 72h scorecard mix, per 100 jobs: think 60 (decide 35, workspace 10, draw 7, author 5, provision 3),
  // implementation 17, scaffold 12, audit 3, other hands-on 8.
  const mix=[['business.decide',18],['architecture.decide',17],['workspace.manage',10],['interface.draw',7],['work.author',5],
    ['provision.ask',3],['backend.implement',10],['interface.implement',6],['integration.verify',1],['backend.scaffold',8],
    ['interface.scaffold',4],['interface.audit',3],['code.refactor',4],['docs.author',4]];
  const bag=mix.flatMap(([k,n])=>Array(n).fill(k));
  const recent={};const byKind={};
  for(let i=0;i<200;i+=1){
    const kind=bag[(i*37)%bag.length];
    const r=selectPool({kind,difficulty:'medium',runtimes,policy:'balanced',shares:OWNER,recent});
    assert.ok(r.target,`${kind}: ${r.error}`);
    recent[r.target]=(recent[r.target]??0)+1;
    (byKind[kind]??=new Set()).add(r.target);
  }
  for(const kind of ['business.decide','architecture.decide'])
    assert.ok([...byKind[kind]].every(p=>['claude-agent','codex-agent'].includes(p)),`${kind}: ${[...byKind[kind]]}`);
  // The mechanical ops stay on the hands now (implement order; owner routing 2026-09-26).
  for(const kind of ['workspace.manage','provision.ask'])
    assert.ok([...byKind[kind]].every(p=>['devin-agent','codex-agent','claude-agent'].includes(p)),`${kind}: ${[...byKind[kind]]}`);
  assert.ok([...byKind['interface.draw']].every(p=>['devin-agent','codex-agent'].includes(p)),`interface.draw: ${[...byKind['interface.draw']]}`);
  // Review work never reaches Opus or Sol while Devin is eligible; the ui order leads with Sol.
  for(const kind of ['work.author','integration.verify'])
    assert.ok([...byKind[kind]].every(p=>p==='devin-agent'),`${kind}: ${[...byKind[kind]]}`);
  assert.ok([...byKind['interface.audit']].every(p=>['codex-agent','devin-agent'].includes(p)),`interface.audit: ${[...byKind['interface.audit']]}`);
  // The implement order's mechanical ops draw Devin down, so implementation and scaffold work can
  // spill to the second pool of their order - but never past it.
  assert.ok([...byKind['backend.implement']].every(p=>['devin-agent','codex-agent'].includes(p)),`backend.implement: ${[...byKind['backend.implement']]}`);
  assert.ok([...byKind['backend.scaffold']].every(p=>['devin-agent','codex-agent'].includes(p)),`backend.scaffold: ${[...byKind['backend.scaffold']]}`);
  assert.equal(Object.values(recent).reduce((a,b)=>a+b,0),200);
});

test('cross-family review: what Devin implemented is reviewed by Opus or Sol as overflow, what Opus wrote by Devin',()=>{
  for(const policy of ['balanced','prefer-then-overflow']){
    const route=(kind,extra)=>selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,...extra});
    // Devin implemented: the review goes to the other family, Opus first (Sol before Opus on hands-on verify under balanced).
    const ofDevin=route('review.verify',{auditOf:'devin-agent',recent:{'devin-agent':1}});
    assert.deepEqual([ofDevin.target,ofDevin.crossFamily.applied,ofDevin.crossFamily.authorFamily,ofDevin.overflow.used],['claude-agent',true,'devin',true],policy);
    // Hands-on verify kinds still on the review order follow the same rule.
    const uat=route('uat.verify',{auditOf:'devin-agent',recent:{}});
    assert.deepEqual([['claude-agent','codex-agent'].includes(uat.target),uat.crossFamily.applied],[true,true],policy);
    // Opus out: Sol reviews.
    const opusOut=route('review.verify',{auditOf:'devin-agent',recent:{},capacity:{'claude-agent':{auth:'dead'}}});
    assert.deepEqual([opusOut.target,opusOut.crossFamily.applied,opusOut.overflow.used],['codex-agent',true,true],policy);
    // Every other family out: the author's own family is the last resort, and the route says so.
    const alone=route('review.verify',{auditOf:'devin-agent',recent:{},capacity:{'claude-agent':{auth:'dead'},'codex-agent':{auth:'dead'}}});
    assert.deepEqual([alone.target,alone.crossFamily.applied],['devin-agent',false],policy);
    // A strategy author (Opus) is reviewed by the hands, not by Sol.
    assert.equal(route('review.verify',{auditOf:'claude-agent',recent:{}}).target,'devin-agent',policy);
  }
  // Non-verify kinds are untouched.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{},auditOf:'claude-agent'}).crossFamily,undefined);
  assert.equal(balanced({kind:'work.author',difficulty:'hard',recent:{},auditOf:'devin-agent'}).crossFamily,undefined);
});

test('Devin opens by an owner grant: none declared keeps it ungated, a declared list gates it',()=>{
  // Devin leads the implementation order, so its gate is what decides; a closed grant falls past it.
  const medium={kind:'backend.implement',difficulty:'medium',runtimes};
  assert.equal(selectPool(medium).target,'devin-agent','no grants passed: legacy ungated routing');
  const closed=selectPool({...medium,grants:{}});
  assert.notEqual(closed.target,'devin-agent');
  assert.match(closed.rejected.find(x=>x.target==='devin-agent').reason,/owner grant/);
  const grants={'devin-agent':{slots:2,roles:['implement','verify','write']}};
  assert.equal(selectPool({...medium,grants}).target,'devin-agent');
  const capped=selectPool({...medium,grants,capacity:{'devin-agent':{running:2}}});
  assert.match(capped.rejected.find(x=>x.target==='devin-agent').reason,/granted capacity \(2\/2/);
  const noWrite=selectPool({kind:'docs.author',difficulty:'medium',runtimes,grants:{'devin-agent':{slots:10,roles:['implement']}}});
  assert.match(noWrite.rejected.find(x=>x.target==='devin-agent').reason,/does not cover role 'write'/);
  // The shipped default grant opens Devin for every workflow at its maxParallel.
  const example=configuredAllocationPolicy(validateConfig(read('config.example.yaml')));
  assert.deepEqual(example.grants,{'devin-agent':{slots:10,roles:['implement','verify','write']}});
  assert.equal(runtimes.runtimes['devin-agent'].maxParallel,10);
  assert.deepEqual(runtimes.runtimes['devin-agent'].roles,['implement','verify','write']);
  assert.deepEqual(Object.keys(runtimes.runtimes['devin-agent'].models).sort(),['hard','medium']);
});

test('config.yaml allocation validates policy, shares, window and grants',()=>{
  const base=read('config.example.yaml');
  const withAllocation=allocation=>({...base,allocation:{mode:'adaptive',...allocation}});
  const ok=configuredAllocationPolicy(validateConfig(withAllocation({policy:'balanced',shares:EVEN,windowHours:12,grants:['devin-agent=4@implement+verify']})));
  assert.deepEqual([ok.policy,ok.windowHours,ok.shares['claude-agent'],ok.grants['devin-agent']],['balanced',12,25,{slots:4,roles:['implement','verify']}]);
  const bare=configuredAllocationPolicy(validateConfig(withAllocation({})));
  assert.deepEqual([bare.policy,bare.shares,bare.windowHours,bare.grants],[null,null,24,null]);
  for(const [bad,why] of [
    [{policy:'round-robin'},/policy must be one of/],
    [{shares:{'nope-agent':1}},/not a modules\/models\/registry.yaml pool/],
    [{shares:{'claude-agent':-1}},/non-negative/],
    [{shares:{'claude-agent':0}},/at least one pool a positive weight/],
    [{windowHours:0},/windowHours/],
    [{grants:'devin-agent=2@implement'},/must be a list/],
    [{grants:['devin-agent=2']},/is not "<pool>=<slots>@<role>/],
    [{grants:['devin-agent=11@implement']},/slots must be 1..10/],
    [{grants:['devin-agent=2@plan']},/does not serve role plan/],
    [{grants:['devin-agent=2@implement','devin-agent=3@verify']},/more than once/],
    [{bogus:true},/allocation must be/],
  ])assert.throws(()=>validateConfig(withAllocation(bad)),why,JSON.stringify(bad));
  assert.deepEqual(parseAllocationGrant('devin-agent=10@implement+verify+write'),{pool:'devin-agent',slots:10,roles:['implement','verify','write']});
  assert.equal(parseAllocationGrant('devin-agent@implement'),null);
});

const T=Date.now();
const H=3600000;
const job=(jobId,{op,pool=null,status='succeeded',createdAt,records=[],owned=[]})=>({
  jobId,opId:op,kind:'op',status,createdAt,updatedAt:createdAt+60000,
  payload:{opId:op,...(pool?{model:pool}:{}),records,owned_paths:owned},
});

test('recent dispatch counts come from routed op jobs in the window; a fixture ledger is never mixed with the host',t=>{
  withLedger(t,({ledger,ledgerFile})=>{
    seedWorkflow(ledger,{id:'wf-balance',now:T,jobs:[
      job('a',{op:'backend.implement',pool:'claude-agent',createdAt:T-2*H}),
      job('b',{op:'backend.implement',pool:'claude-agent',status:'running',createdAt:T-H}),
      job('c',{op:'business.decide',pool:'codex-agent',createdAt:T-3*H}),
      job('d',{op:'backend.implement',createdAt:T-H}),// never routed
      job('e',{op:'backend.implement',pool:'devin-agent',createdAt:T-30*H}),// outside 24h
    ]});
    assert.deepEqual(recentPoolCounts(ledger.db,T-24*H),{'claude-agent':2,'codex-agent':1});
    const r=recentDispatchCounts({db:ledger.db,ledgerFile,windowHours:24,now:T});
    assert.deepEqual([r.counts,r.total,r.ledgers.length],[{'claude-agent':2,'codex-agent':1},3,1]);
    assert.equal(recentDispatchCounts({db:ledger.db,ledgerFile,windowHours:48,now:T}).counts['devin-agent'],1);
  });
});

test('the think author of an audit is the latest settled think op whose output the audit reads',t=>{
  withLedger(t,({ledger})=>{
    seedWorkflow(ledger,{id:'wf-audit',now:T,jobs:[
      job('w1',{op:'work.author',pool:'claude-agent',createdAt:T-5*H,owned:['.starciwork/features/pay/**']}),
      job('s1',{op:'scope.define',pool:'codex-agent',createdAt:T-4*H,owned:['.starciwork/features/pay/business']}),
      job('i1',{op:'backend.implement',pool:'devin-agent',createdAt:T-3*H,owned:['.starciwork/features/pay/business/impl']}),
      job('f1',{op:'scope.define',pool:'claude-agent',status:'failed',createdAt:T-2*H,owned:['.starciwork/features/pay/business']}),
      job('o1',{op:'work.author',pool:'claude-agent',createdAt:T-2*H,owned:['.starciwork/features/other']}),
      job('r1',{op:'review.verify',status:'queued',createdAt:T-H,records:['.starciwork/features/pay/business/report.json']}),
      job('r2',{op:'review.verify',status:'queued',createdAt:T-H,records:[]}),
    ]});
    const byId=id=>ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(id);
    // s1 is the latest succeeded think op writing what r1 reads; the hands-on i1 and the failed f1 never count.
    assert.deepEqual(thinkAuthorOf(ledger.db,byId('r1'),{runtimes}),{jobId:'s1',opId:'scope.define',pool:'codex-agent'});
    assert.equal(thinkAuthorOf(ledger.db,byId('r2'),{runtimes}),null,'an audit that reads no record has no author');
  });
});

test('the author of a review is the latest settled non-verify op - implementation included - whose output it reads',t=>{
  withLedger(t,({ledger})=>{
    seedWorkflow(ledger,{id:'wf-review',now:T,jobs:[
      job('s1',{op:'scope.define',pool:'claude-agent',createdAt:T-5*H,owned:['.starciwork/features/pay/business']}),
      job('i1',{op:'backend.implement',pool:'devin-agent',createdAt:T-3*H,owned:['src/pay'],records:['.starciwork/features/pay/impl/api/index.yaml']}),
      job('v1',{op:'e2e.verify',pool:'codex-agent',createdAt:T-2*H,owned:['.starciwork/features/pay/impl/api']}),
      job('r1',{op:'review.verify',status:'queued',createdAt:T-H,records:['.starciwork/features/pay/impl/api/index.yaml']}),
      job('r2',{op:'review.verify',status:'queued',createdAt:T-H,records:['.starciwork/features/pay/business/rules.yaml']}),
    ]});
    const byId=id=>ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(id);
    // i1 implemented what r1 reads; the later verify v1 is never an author.
    assert.deepEqual(auditAuthorOf(ledger.db,byId('r1'),{runtimes}),{jobId:'i1',opId:'backend.implement',pool:'devin-agent'});
    assert.deepEqual(auditAuthorOf(ledger.db,byId('r2'),{runtimes}),{jobId:'s1',opId:'scope.define',pool:'claude-agent'});
    assert.equal(thinkAuthorOf(ledger.db,byId('r1'),{runtimes}),null,'the think-only reading skips implementation');
  });
});

test('a fixture-shaped path is never a product ledger: temp roots and fixture/fixtures directories',()=>{
  const T=os.tmpdir().replace(/\\/g,'/'),DRV=path.parse(os.tmpdir()).root.replace(/\\/g,'/'),env={TEMP:T,TMP:T};
  assert.equal(isFixtureLedgerPath(`${DRV}fixture/.starciwork/runtime.sqlite`,{env}),true,'the stale fixture-root ledger');
  assert.equal(isFixtureLedgerPath(`${DRV}work/tests/fixtures/repo/.starciwork/runtime.sqlite`,{env}),true);
  assert.equal(isFixtureLedgerPath(`${T}/w1-x/repo/.starciwork/runtime.sqlite`,{env}),true);
  assert.equal(isFixtureLedgerPath(path.join(os.tmpdir(),'starci-x','.starciwork','runtime.sqlite')),true);
  assert.equal(isFixtureLedgerPath(`${DRV}Repositories/shop-be/.starciwork/runtime.sqlite`,{env}),false);
  assert.equal(isFixtureLedgerPath(`${DRV}Repositories/fixture-shop/.starciwork/runtime.sqlite`,{env}),false,'only a whole segment names a fixture');
  assert.equal(isFixtureLedgerPath(null,{env}),false);
});

test('the machine scan counts registered product ledgers only: never a fixture path, a temp path or a missing file',t=>{
  // Everything lives under a temp root the spec made, on the runtime's drive (not os.tmpdir(), which the scan
  // skips), and the registry is injected: the host's machine.sqlite is never read or written.
  withLedger(t,({root,ledger,ledgerFile,machine,machineFile,track})=>{
    // The scan's temp directory is whatever os.tmpdir() answers: a spec-owned one, so the fixture root (also a temp dir on a host with one
    // filesystem tree) is not under it, and the temp ledger is.
    const scanTemp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-balance-scan-'));
    const tempRoot=fs.mkdtempSync(path.join(scanTemp,'starci-balance-temp-'));
    const saved=['TMPDIR','TEMP','TMP'].map(key=>[key,process.env[key]]);
    t.after(()=>{for(const [key,value] of saved){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(scanTemp,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
    // A ledger opened by file path (not ledgerFileFor) seeds no meta.repo_root; registerLedger refuses a
    // new row without one (registry-no-repo-root), so the fixture names its root at open.
    const other=(dir,id,pool)=>{
      const file=path.join(dir,'.starciwork','runtime.sqlite');
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const handle=track(openLedger({file,machine,repoRoot:dir}));
      seedWorkflow(handle,{id,now:T,jobs:[job(`${id}-1`,{op:'backend.implement',pool,createdAt:T-H})]});
      return file;
    };
    const product=other(path.join(root,'product'),'wf-product','claude-agent');
    const fixture=other(path.join(root,'fixture'),'wf-fixture','codex-agent');
    const temp=other(path.join(tempRoot,'temp-repo'),'wf-temp','codex-agent');
    machine.registerLedger({file:path.join(root,'gone','.starciwork','runtime.sqlite'),ledgerId:'ledger-gone',repoRoot:path.join(root,'gone')});
    seedWorkflow(ledger,{id:'wf-repo',now:T,jobs:[job('r-1',{op:'backend.implement',pool:'devin-agent',createdAt:T-H})]});

    for(const [key] of saved)process.env[key]=scanTemp;
    const registered=machine.db.prepare('SELECT file FROM ledgers').all().map(row=>path.resolve(row.file));
    assert.equal(registered.length,5,'the repo ledger, product, fixture, temp and the missing ledger are all registered');
    const scanned=machineLedgerFiles({machineFile,exclude:[ledgerFile]}).map(file=>path.resolve(file).toLowerCase());
    assert.deepEqual(scanned,[fs.realpathSync(product).toLowerCase()]);
    assert.equal(scanned.includes(path.resolve(fixture).toLowerCase()),false,'a fixture directory never counts');
    assert.equal(scanned.includes(path.resolve(temp).toLowerCase()),false,'a temp ledger never counts');

    const r=recentDispatchCounts({db:ledger.db,ledgerFile,windowHours:24,now:T,machineFile});
    assert.deepEqual(r.counts,{'devin-agent':1,'claude-agent':1},'repo plus the one product ledger; no fixture share');
    assert.equal(r.ledgers.length,2);
    assert.deepEqual(r.unreadable,[]);

    // A ledger that is itself a fixture is balanced on its own jobs only.
    const own=track(openLedger({file:fixture}));
    const f=recentDispatchCounts({db:own.db,ledgerFile:fixture,windowHours:24,now:T,machineFile});
    assert.deepEqual([f.counts,f.ledgers.length],[{'codex-agent':1},1]);
  },{parentDir:sameDriveTmp()});
});
