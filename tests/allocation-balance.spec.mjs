import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';
import {configuredAllocationPolicy,parseAllocationGrant,validateConfig} from '../engine/config.mjs';
import {balanceDeficits,selectPool} from '../scripts/agent/models.mjs';
import {buildSpawnCommand,credentialRefreshCommand,loadAdapter} from '../scripts/agent/lib.mjs';
import {auditAuthorOf,recentDispatchCounts,recentPoolCounts,thinkAuthorOf} from '../scripts/agent/balance.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// Owner goal 2026-09-24: spread jobs over Opus, Sol, Devin and Qwen (DeepSeek V4.1 Flash), open Devin by a
// default owner grant, and review think output with the other frontier family. Owner decision 2026-09-25
// (amending the 2026-09-24 Qwen-base ruling, from the 72h scripts/agent/model-scorecard.mjs evidence): each
// kind walks its evidence order - implementation Devin then Qwen, scaffold/docs/grammar and fan-out slices Qwen
// first, think work Opus then Sol only, interface.draw Codex only - and balanced ranks by that order and caps by
// the owner shares (devin 35, qwen 35, claude 20, codex 10). Owner decision 2026-09-25 review-hands (amending it):
// Opus and Sol keep strategy only; every verify kind and work.author walk the review order - Devin and Qwen, each
// reviewing the other's work (cross-family), Opus and Sol overflow only. These specs hold that contract on the
// shipped runtimes.yaml.
const ROOT=path.resolve(import.meta.dirname,'..');
const read=file=>parseYaml(fs.readFileSync(path.join(ROOT,file),'utf8'));
const runtimes=read('modules/models/runtimes.yaml');
const EVEN={'claude-agent':25,'codex-agent':25,'devin-agent':25,'qwen-agent':25};
const OWNER={'devin-agent':35,'qwen-agent':35,'claude-agent':20,'codex-agent':10};
const balanced=(opts)=>selectPool({runtimes,policy:'balanced',shares:EVEN,...opts});
const REVIEW_KINDS=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.order==='review').map(([k])=>k);
const STRATEGY_KINDS=Object.entries(runtimes.roleOfKind).filter(([,e])=>e.work==='think'&&!e.order).map(([k])=>k);

test('balanced: the order ranks and the share caps - the first eligible pool still below its share wins',()=>{
  // medium implementation: Devin leads its order and sits below 25%, so it takes it although Qwen is further below.
  const r=balanced({kind:'backend.implement',difficulty:'medium',recent:{'claude-agent':60,'codex-agent':30,'devin-agent':9,'qwen-agent':1}});
  assert.equal(r.policy,'balanced');
  assert.deepEqual([r.target,r.modelId,r.order,r.balance.rule],['devin-agent','swe-2-max','implement','first-under-share']);
  assert.deepEqual(r.balance.candidates,['devin-agent','qwen-agent','codex-agent']);
  assert.ok(r.balance.deficits['qwen-agent'].deficit>r.balance.deficits['devin-agent'].deficit,'the rank, not the largest deficit, decides');
  // Devin at its share: the next pool of the order still below its share takes it.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{'claude-agent':40,'codex-agent':29,'devin-agent':30,'qwen-agent':1}}).target,'qwen-agent');
  // No history: the order's first pool.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{}}).target,'devin-agent');
  assert.equal(balanced({kind:'backend.scaffold',difficulty:'medium',recent:{}}).target,'qwen-agent');
  // Every eligible pool at or over its share: the least over takes it.
  const over=balanced({kind:'backend.implement',difficulty:'medium',recent:{'claude-agent':4,'devin-agent':34,'qwen-agent':30,'codex-agent':32}});
  assert.deepEqual([over.target,over.balance.rule],['qwen-agent','least-over']);
  const d=balanceDeficits(['a','b'],{shares:{a:3,b:1},recent:{a:1,b:1}});
  assert.deepEqual([d.a.target,d.b.target,d.a.actual],[0.75,0.25,0.5]);
});

test('balanced: an ineligible pool is never chosen, however far below its share it is',()=>{
  const recent={'claude-agent':50,'codex-agent':50};
  // Qwen auth dead, Devin full: Codex takes it although both are at 0%.
  const r=balanced({kind:'backend.implement',difficulty:'medium',recent,
    capacity:{'qwen-agent':{auth:'dead'},'devin-agent':{running:10}}});
  assert.equal(r.target,'codex-agent');
  assert.deepEqual(r.rejected.map(x=>x.target).sort(),['devin-agent','qwen-agent']);
  // Easy: Devin pins no easy model, so it is not a candidate at all.
  const easy=balanced({kind:'code.refactor',difficulty:'easy',recent});
  assert.equal(easy.target,'qwen-agent');
  assert.ok(!easy.chain.includes('devin-agent'));
  // Insane: the frontier pools and Qwen pin a model; Devin does not.
  const insane=balanced({kind:'backend.implement',difficulty:'insane',recent:{'claude-agent':90,'codex-agent':10,'qwen-agent':30}});
  assert.deepEqual([insane.target,insane.balance.candidates],['codex-agent',['claude-agent','codex-agent','qwen-agent']]);
  // --avoid removes a pool under balanced too.
  assert.notEqual(balanced({kind:'backend.implement',difficulty:'medium',recent,bias:{avoid:['qwen-agent','devin-agent']}}).target,'qwen-agent');
});

test('balanced: Opus is hands-on overflow only, and --prefer only breaks ties',()=>{
  // Claude has the biggest deficit but stays out of hands-on work while another pool is eligible.
  const r=balanced({kind:'backend.implement',difficulty:'hard',recent:{'codex-agent':10,'devin-agent':10,'qwen-agent':10}});
  assert.notEqual(r.target,'claude-agent');
  const full={'devin-agent':{running:10},'qwen-agent':{running:10},'codex-agent':{running:10}};
  assert.equal(balanced({kind:'backend.implement',difficulty:'hard',recent:{},capacity:full}).target,'claude-agent','overflow when nothing else is eligible');
  // A prefer bias does not override the order's pick of a pool below its share...
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{'devin-agent':5},bias:{prefer:['devin-agent']}}).target,'qwen-agent');
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{},bias:{prefer:['codex-agent']}}).target,'devin-agent');
  // ...but wins a tie between pools equally over their shares.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{'devin-agent':1,'qwen-agent':1,'codex-agent':1},bias:{prefer:['codex-agent']}}).target,'codex-agent');
});

test('strategy runs on Opus then Sol under balanced - never Qwen or Devin, whatever their deficits',()=>{
  assert.ok(STRATEGY_KINDS.length>=15);
  for(const kind of ['request.analyze','scope.define','business.decide','architecture.decide','brand.decide','decision.prepare',
    'implementation.plan','provision.ask','goal.revise','workspace.manage'])
    assert.ok(STRATEGY_KINDS.includes(kind),`${kind} is strategy`);
  const starved={'claude-agent':100,'codex-agent':100};// Devin and Qwen at 0% - the largest deficits
  for(const kind of STRATEGY_KINDS){
    const r=balanced({kind,difficulty:'medium',recent:starved});
    assert.ok(['claude-agent','codex-agent'].includes(r.target),`${kind} -> ${r.target}`);
    if(kind!=='brand.decide')assert.equal(r.target,'claude-agent',`${kind}: Opus leads the think order`);
    for(const d of ['easy','medium','hard','insane'])
      assert.ok(!selectPool({kind,difficulty:d,runtimes,policy:'balanced',shares:OWNER,recent:starved}).chain.some(p=>p==='qwen-agent'||p==='devin-agent'),`${kind}@${d}`);
  }
  // Under the owner shares Opus takes think work until it reaches 20%, Sol after it.
  assert.equal(balanced({kind:'business.decide',difficulty:'medium',shares:OWNER,recent:{'claude-agent':10,'codex-agent':0,'devin-agent':45,'qwen-agent':45}}).target,'claude-agent');
  assert.equal(balanced({kind:'business.decide',difficulty:'medium',shares:OWNER,recent:{'claude-agent':30,'codex-agent':2,'devin-agent':34,'qwen-agent':34}}).target,'codex-agent');
  // The default policy keeps Claude first.
  assert.equal(selectPool({kind:'business.decide',difficulty:'medium',runtimes}).target,'claude-agent');
});

test('the evidence orders: implementation Devin then Qwen, scaffold and fan-out Qwen first, draw Codex only',()=>{
  const route=(kind,difficulty,extra={})=>selectPool({kind,difficulty,runtimes,policy:'balanced',shares:OWNER,recent:{},...extra});
  for(const kind of ['backend.implement','interface.implement','code.refactor','test.author','runtime.operate','integration.verify','release.deliver'])
    for(const d of ['medium','hard']){
      const r=route(kind,d);
      assert.deepEqual([r.target,r.chain.slice(0,2)],['devin-agent',['devin-agent','qwen-agent']],`${kind}@${d}`);
      assert.equal(route(kind,d,{capacity:{'devin-agent':{running:10}}}).target,'qwen-agent',`${kind}@${d}: Qwen seconds Devin`);
    }
  for(const kind of ['backend.scaffold','interface.scaffold','package.scaffold','docs.author','content.generate','grammar.update'])
    for(const d of ['easy','medium','hard']){
      const r=route(kind,d);
      assert.deepEqual([r.target,r.order],['qwen-agent','scaffold'],`${kind}@${d}`);
      if(r.difficulty!=='easy')assert.equal(route(kind,d,{capacity:{'qwen-agent':{auth:'dead'}}}).target,'devin-agent',`${kind}@${d}: Devin seconds Qwen`);
    }
  // A hands-on cut slice walks the scaffold order whatever its kind; think work never leaves the think order.
  const slice=route('backend.implement','medium',{fanOut:true});
  assert.deepEqual([slice.target,slice.order],['qwen-agent','scaffold']);
  const thinkSlice=route('architecture.decide','hard',{fanOut:true});
  assert.deepEqual([thinkSlice.target,thinkSlice.order],['claude-agent','think']);
  // interface.draw and interface.asset: Codex alone, never a fallback.
  for(const kind of ['interface.draw','interface.asset']){
    const r=route(kind,'hard');
    assert.deepEqual([r.target,r.chain,r.order],['codex-agent',['codex-agent'],'draw'],kind);
    assert.ok(route(kind,'hard',{capacity:{'codex-agent':{auth:'dead'}}}).error,`${kind} refuses with Codex down`);
  }
});

test('review work walks the review order: Devin and Qwen, Opus and Sol overflow only - never ahead by share or prefer',()=>{
  for(const kind of ['review.verify','handover.review','work.author','security.verify','uat.assisted.verify','goal.validate',
    'interface.audit','e2e.verify','integration.verify','perf.verify','uat.verify'])
    assert.ok(REVIEW_KINDS.includes(kind),`${kind} walks the review order`);
  assert.deepEqual(runtimes.allocation.preference.review,['devin-agent','qwen-agent','claude-agent','codex-agent']);
  assert.deepEqual(runtimes.allocation.overflowByOrder.review,['claude-agent','codex-agent']);
  assert.deepEqual(runtimes.allocation.hands,['devin-agent','qwen-agent']);
  const registry=read('modules/models/registry.yaml');
  // Opus and Sol far below their shares, Devin and Qwen far over theirs: the hands still take every review.
  const starvedFrontier={'devin-agent':100,'qwen-agent':100};
  for(const kind of REVIEW_KINDS){
    if(runtimes.roleOfKind[kind].work==='think')assert.equal(runtimes.roleOfKind[kind].floor,'hard',kind);
    const chain=registry.operators[kind]?.chain;
    if(chain)assert.deepEqual(chain,['devin-agent','qwen-agent','claude-agent','codex-agent'],`${kind} chain`);
    for(const policy of ['balanced','prefer-then-overflow']){
      const r=selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,recent:starvedFrontier,bias:{prefer:['claude-agent','codex-agent']}});
      assert.equal(r.order,'review',kind);
      assert.ok(['devin-agent','qwen-agent'].includes(r.target),`${kind}/${policy} -> ${r.target}`);
      assert.equal(r.overflow.used,false);
      // Both hands unavailable: the overflow takes it - Opus first for a think verdict, Sol for the browser-dom
      // audit, and under balanced Sol before Opus on hands-on verify (Opus stays hands-on overflow).
      const out=selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,recent:{},
        capacity:{'devin-agent':{auth:'dead'},'qwen-agent':{quota:{state:'dead'}}}});
      const want=kind==='interface.audit'||(policy==='balanced'&&runtimes.roleOfKind[kind].work==='hands-on')?'codex-agent':'claude-agent';
      assert.deepEqual([out.target,out.overflow.used],[want,true],`${kind}/${policy} overflow`);
    }
  }
  // Insane: Devin pins no insane model, so an insane review is Qwen's.
  assert.equal(selectPool({kind:'review.verify',difficulty:'insane',runtimes}).target,'qwen-agent');
  // A review cut slice keeps the review order, never the scaffold order.
  assert.equal(selectPool({kind:'e2e.verify',difficulty:'medium',runtimes,fanOut:true}).order,'review');
});

test('interface.audit walks the review order: Devin and Codex hold its browser-dom tool, Qwen and Claude are passed over',()=>{
  const r=selectPool({kind:'interface.audit',difficulty:'hard',runtimes,policy:'balanced',shares:OWNER,recent:{}});
  assert.deepEqual([r.target,r.chain],['devin-agent',['devin-agent','qwen-agent','claude-agent','codex-agent']]);
  assert.match(r.rejected.find(x=>x.target==='qwen-agent').reason,/browser-dom/);
  // Devin implemented the interface: the other families' only holder of the tool is Codex (overflow).
  const cross=selectPool({kind:'interface.audit',difficulty:'hard',runtimes,policy:'balanced',shares:OWNER,recent:{},auditOf:'devin-agent'});
  assert.deepEqual([cross.target,cross.crossFamily.applied,cross.overflow.used],['codex-agent',true,true]);
  // Qwen implemented it: Devin audits.
  assert.equal(selectPool({kind:'interface.audit',difficulty:'hard',runtimes,auditOf:'qwen-agent'}).target,'devin-agent');
  // Devin and Codex both down: no pool has the tool - a typed refusal, never Qwen or Claude.
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
  for(const kind of ['business.decide','architecture.decide','workspace.manage','provision.ask'])
    assert.ok([...byKind[kind]].every(p=>['claude-agent','codex-agent'].includes(p)),`${kind}: ${[...byKind[kind]]}`);
  assert.deepEqual([...byKind['interface.draw']],['codex-agent']);
  // Review work never reaches Opus or Sol while a hand is eligible.
  for(const kind of ['work.author','interface.audit','integration.verify'])
    assert.ok([...byKind[kind]].every(p=>['devin-agent','qwen-agent'].includes(p)),`${kind}: ${[...byKind[kind]]}`);
  assert.deepEqual([...byKind['backend.implement']],['devin-agent'],'implementation stays on Devin while it is below 35%');
  assert.deepEqual([...byKind['backend.scaffold']],['qwen-agent'],'scaffold stays on Qwen while it is below 35%');
  assert.equal(Object.values(recent).reduce((a,b)=>a+b,0),200);
});

test('cross-family review: Qwen reviews what Devin implemented, Devin what Qwen implemented, Opus and Sol only as overflow',()=>{
  for(const policy of ['balanced','prefer-then-overflow']){
    const route=(kind,extra)=>selectPool({kind,difficulty:'hard',runtimes,policy,shares:OWNER,...extra});
    // Devin implemented: Qwen reviews, even with Qwen far over its share and Devin far under it.
    const ofDevin=route('review.verify',{auditOf:'devin-agent',recent:{'qwen-agent':90,'devin-agent':1}});
    assert.deepEqual([ofDevin.target,ofDevin.crossFamily.applied,ofDevin.crossFamily.authorFamily],['qwen-agent',true,'devin'],policy);
    // Qwen implemented: Devin reviews.
    const ofQwen=route('review.verify',{auditOf:'qwen-agent',recent:{'devin-agent':90,'qwen-agent':1}});
    assert.deepEqual([ofQwen.target,ofQwen.crossFamily.applied],['devin-agent',true],policy);
    // Hands-on verify kinds follow the same rule.
    assert.equal(route('e2e.verify',{auditOf:'devin-agent',recent:{}}).target,'qwen-agent',policy);
    // Devin implemented and Qwen is out: the reviewer still differs from the implementer - the overflow takes it.
    const qwenOut=route('review.verify',{auditOf:'devin-agent',recent:{},capacity:{'qwen-agent':{auth:'dead'}}});
    assert.deepEqual([qwenOut.target,qwenOut.crossFamily.applied,qwenOut.overflow.used],['claude-agent',true,true],policy);
    // Every other family out: the author's own family is the last resort, and the route says so.
    const alone=route('review.verify',{auditOf:'devin-agent',recent:{},capacity:{'qwen-agent':{auth:'dead'},'claude-agent':{auth:'dead'},'codex-agent':{auth:'dead'}}});
    assert.deepEqual([alone.target,alone.crossFamily.applied],['devin-agent',false],policy);
    // A strategy author (Opus) is reviewed by the hands, not by Sol.
    assert.equal(route('review.verify',{auditOf:'claude-agent',recent:{}}).target,'devin-agent',policy);
  }
  // Non-verify kinds are untouched.
  assert.equal(balanced({kind:'backend.implement',difficulty:'medium',recent:{},auditOf:'claude-agent'}).crossFamily,undefined);
  assert.equal(balanced({kind:'work.author',difficulty:'hard',recent:{},auditOf:'devin-agent'}).crossFamily,undefined);
});

test('Devin opens by an owner grant: none declared keeps it ungated, a declared list gates it',()=>{
  // Devin leads the implementation order, so its gate is what decides; Qwen is avoided so a closed grant falls past it.
  const medium={kind:'backend.implement',difficulty:'medium',runtimes,bias:{avoid:['qwen-agent']}};
  assert.equal(selectPool(medium).target,'devin-agent','no grants passed: legacy ungated routing');
  const closed=selectPool({...medium,grants:{}});
  assert.notEqual(closed.target,'devin-agent');
  assert.match(closed.rejected.find(x=>x.target==='devin-agent').reason,/owner grant/);
  const grants={'devin-agent':{slots:2,roles:['implement','verify','write']}};
  assert.equal(selectPool({...medium,grants}).target,'devin-agent');
  const capped=selectPool({...medium,grants,capacity:{'devin-agent':{running:2}}});
  assert.match(capped.rejected.find(x=>x.target==='devin-agent').reason,/granted capacity \(2\/2/);
  const noWrite=selectPool({kind:'docs.author',difficulty:'medium',runtimes,bias:{avoid:['qwen-agent']},grants:{'devin-agent':{slots:10,roles:['implement']}}});
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
  assert.deepEqual([ok.policy,ok.windowHours,ok.shares['qwen-agent'],ok.grants['devin-agent']],['balanced',12,25,{slots:4,roles:['implement','verify']}]);
  const bare=configuredAllocationPolicy(validateConfig(withAllocation({})));
  assert.deepEqual([bare.policy,bare.shares,bare.windowHours,bare.grants],[null,null,24,null]);
  for(const [bad,why] of [
    [{policy:'round-robin'},/policy must be one of/],
    [{shares:{'nope-agent':1}},/not a modules\/models\/runtimes.yaml pool/],
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

test('the qwen pool runs DeepSeek V4.1 Flash and attests it from the rendered footer',()=>{
  const pool=runtimes.runtimes['qwen-agent'];
  assert.deepEqual(pool.models,{easy:'deepseek-v4.1-flash',medium:'deepseek-v4.1-flash',hard:'deepseek-v4.1-flash',insane:'deepseek-v4.1-flash'});
  const card=loadAdapter('qwen').card;
  assert.equal(card.model,'deepseek-v4.1-flash');
  assert.equal(card.modelMarker,'deepseek-v4.1-flash');
  const identity=new RegExp(card.readiness.identityPattern,'i');
  assert.ok(identity.test('  ➜ repo · git:(main) · deepseek-v4.1-flash (Token Plan Singapore)'));
  assert.ok(!identity.test('  ➜ repo · qwen3.8-flash (Token Plan Singapore)'));
  assert.ok(!identity.test('deepseek-v4x1-flash'),'the dot is literal');
  const profile=read('modules/models/profiles/qwen-agent.yaml');
  const command=profile.launch.orca.command;
  assert.match(command,/--model deepseek-v4\.1-flash\b/);
  assert.match(command,/--yolo\b/);
  assert.doesNotMatch(command,/--approval-mode/,'Qwen Code 0.24 refuses --yolo together with --approval-mode');
  assert.equal(profile.identity.requestedModel,'deepseek-v4.1-flash');
  const registry=read('modules/models/registry.yaml');
  assert.equal(registry.targets['qwen-agent'].requestedModel,'deepseek-v4.1-flash');
  assert.equal(registry.targetAliases['deepseek-v4.1-flash'],'qwen-agent');
  // The spawn command sets the key from the runtime secrets file by path, never by value.
  const built=buildSpawnCommand({provider:'qwen',command});
  assert.ok(!built.error,built.error);
  assert.doesNotMatch(built.command,/sk-/);
  assert.ok(!built.command.includes('--approval-mode'));
  for(const plat of ['win32','posix']){
    const step=credentialRefreshCommand(card,plat);
    assert.ok(step.includes(path.join(ROOT,'.secrets','models.env').replace(/\\/g,'/')),plat);
    assert.match(step,/QWENCLOUD_API_KEY/);
    assert.match(step,/BAILIAN_TOKEN_PLAN_API_KEY/);
    assert.ok(!step.includes('<secrets-file>'),plat);
  }
  assert.equal(credentialRefreshCommand({credentialRefresh:{win32:'x <secrets-file>',secretsFile:'../escape.env'}},'win32'),null,'a secrets file outside the runtime root is refused');
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
      job('v1',{op:'e2e.verify',pool:'qwen-agent',createdAt:T-2*H,owned:['.starciwork/features/pay/impl/api']}),
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
