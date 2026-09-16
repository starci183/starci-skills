import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {GOAL_PREDICATE,KIND_GRAPH,assertGraph,familyOf,goalMetricRequired,kindList,kindRecord,laneById,nextKind,
  propagateInvalidation,readsOf,roleOf,routeFor,skippedKinds,validateGraph,writesOf} from '../kernel/graph.mjs';

const read=name=>parseYaml(fs.readFileSync(new URL(`../model/${name}`,import.meta.url),'utf8'));
const profile=read('kinds.yaml');
const records=read('records.yaml');
const codes=errors=>errors.map(error=>error.code);
const clone=()=>structuredClone(profile);

/**
 * The catalog the kinds worktree lands: `test-gap` on the blocker vocabulary with its bounded route to
 * `test.author`, the `goal.revise`/`goal.validate` kinds, the goal-metric predicates, and a lane whose prove
 * steps are optional on them. Built as a fixture here so the graph's answers are tested against the catalog
 * itself, not against names compiled into `kernel/graph.mjs`.
 */
const extended=()=>{
  const fixture=clone();
  if(!fixture.vocabularies.blockers.includes('test-gap'))
    fixture.vocabularies.blockers=[...fixture.vocabularies.blockers,'test-gap'];
  fixture.predicates={...fixture.predicates,
    'goal.requiresSecurity':'The goal metrics block declares a security requirement the workflow must prove.',
    'goal.requiresPerf':'The goal metrics block declares a performance requirement the workflow must prove.'};
  for(const [name,kind] of Object.entries({
    'code.refactor':{family:'build',role:'implement',readOnly:false,reads:['sds','code'],writes:['code'],
      purpose:'Restructure code with behaviour invariant; reports test-gap when no regression coverage exists.',
      reports:{outcomes:['done','partial','failed','ask','blocked'],blockers:['test-gap','environment','authority']}},
    'test.author':{family:'build',role:'implement',readOnly:false,reads:['sds','code'],writes:['code'],
      purpose:'Author the test files of a bounded slice; writes tests, never judges them.',
      reports:{outcomes:['done','partial','failed','ask','blocked'],blockers:['environment','authority']}},
    'security.verify':{family:'prove',role:'verify',readOnly:false,reads:['code','asset'],writes:['evidence'],
      purpose:'Inspect code and config for vulnerabilities and leave the findings as evidence.',
      reports:{outcomes:['done','partial','failed','blocked'],blockers:['environment','authority']}},
    'perf.verify':{family:'prove',role:'verify',readOnly:false,reads:['code','asset'],writes:['evidence'],
      purpose:'Observe performance on the running product and leave the evidence.',
      reports:{outcomes:['done','partial','failed','blocked'],blockers:['environment','authority']}},
    'goal.revise':{family:'design',role:'decide',readOnly:false,reads:['record'],writes:['record'],
      purpose:'Produce goal v(n+1) with an explicit diff and a rev bump.',
      reports:{outcomes:['done','partial','failed','ask','blocked'],blockers:['authority']}},
    'goal.validate':{family:'prove',role:'verify',readOnly:true,reads:['record'],writes:[],
      purpose:'Check a proposed goal revision against the goal contract.',
      reports:{outcomes:['done','failed'],blockers:[]}}}))if(!fixture.kinds[name])fixture.kinds[name]=kind;
  if(!fixture.routes.some(route=>route.id==='test-gap-authors-the-tests'))
    fixture.routes.push({id:'test-gap-authors-the-tests',on:{blocker:'test-gap'},from:'any',
      to:{kind:'test.author',origin:'gate'},limit:2,then:'reopen',
      purpose:'A behaviour-invariant change with no regression coverage gets the tests it needs first.'});
  fixture.lanes.push({id:'fixture/goal-gated',match:[{kind:'fixture-node'}],
    purpose:'A lane whose two goal-gated proofs exist only when the goal asks for them.',
    steps:[{kind:'backend.implement'},
      {kind:'security.verify',optionalWhen:'goal.requiresSecurity'},
      {kind:'perf.verify',optionalWhen:'goal.requiresPerf'},
      {kind:'e2e.verify'},{kind:'review.verify'}]});
  return fixture;
};
const gatedLane=fixture=>laneById('fixture/goal-gated',{profile:fixture});

test('the catalog alone decides what a kind is: added kinds validate, route and answer without a compiled list',()=>{
  const fixture=extended();
  assert.deepEqual(validateGraph(fixture,{records}),[],'the extended catalog is valid with no kind name compiled into the graph');
  assert.equal(assertGraph(fixture,{records}),fixture);
  // The new kinds are first-class: catalog order, reads, writes, family and role all answer for them.
  for(const kind of ['code.refactor','test.author','security.verify','perf.verify','goal.revise','goal.validate'])
    assert.ok(kindList({profile:fixture}).includes(kind),kind);
  assert.equal(familyOf('goal.revise',{profile:fixture}),'design');
  assert.equal(roleOf('goal.revise',{profile:fixture}),'decide');
  assert.deepEqual(readsOf('goal.revise',{profile:fixture}),['record']);
  assert.deepEqual(writesOf('goal.revise',{profile:fixture}),['record']);
  assert.equal(kindRecord('goal.validate',{profile:fixture}).readOnly,true);
  // The new blocker routes to the new kind, bounded, and the requester reopens behind it.
  const route=routeFor({outcome:'blocked',blocker:'test-gap',kind:'code.refactor'},{profile:fixture});
  assert.equal(route.schema,KIND_GRAPH);
  assert.deepEqual({route:route.route,kind:route.kind,origin:route.origin,then:route.then,limit:route.limit},
    {route:'test-gap-authors-the-tests',kind:'test.author',origin:'gate',then:'reopen',limit:2});
  assert.equal(route.unresolved,null);
});

test('a goal.* optionalWhen is answered by the goal metrics block: required runs the step, missing skips it',()=>{
  const fixture=extended(),lane=gatedLane(fixture);
  assert.equal(GOAL_PREDICATE,'goal.');
  // The goal asks for neither proof: both optional steps retire and the lane goes straight to the API proof.
  assert.equal(nextKind(lane,['backend.implement'],{goal:{done:{}},profile:fixture}),'e2e.verify');
  // A goal that cannot be read retires them too - a missing metric is never a reason to run the step.
  for(const goal of [null,undefined,'goal',42,{done:null}])
    assert.equal(nextKind(lane,['backend.implement'],{goal,profile:fixture}),'e2e.verify',JSON.stringify(goal));
  // The goal asks for security: the step runs, in order, before the rest of the lane.
  assert.equal(nextKind(lane,['backend.implement'],{goal:{done:{requiresSecurity:true}},profile:fixture}),'security.verify');
  assert.equal(nextKind(lane,['backend.implement','security.verify'],{goal:{done:{requiresSecurity:true}},profile:fixture}),'e2e.verify');
  // And for perf, through either spelling of the metrics block.
  assert.equal(nextKind(lane,['backend.implement'],{goal:{metrics:{requiresPerf:true}},profile:fixture}),'perf.verify');
  assert.equal(nextKind(lane,['backend.implement'],{goal:{done:[{name:'requiresPerf'}]},profile:fixture}),'perf.verify');
  // An explicit false and a `required: false` entry both retire the step exactly like a missing metric.
  assert.equal(nextKind(lane,['backend.implement'],{goal:{done:{requiresSecurity:false}},profile:fixture}),'e2e.verify');
  assert.equal(nextKind(lane,['backend.implement'],{goal:{done:[{name:'requiresSecurity',required:false}]},profile:fixture}),'e2e.verify');
  // A predicate value the caller computed wins over the goal evaluation.
  assert.equal(nextKind(lane,['backend.implement'],{goal:{done:{requiresSecurity:true}},
    predicates:{'goal.requiresSecurity':true},profile:fixture}),'e2e.verify','a caller-satisfied predicate retires the step even when the goal declares the metric');
  // skippedKinds reports the retired steps so the status view prints the lane as it is walked.
  assert.deepEqual(skippedKinds(lane,['backend.implement'],{goal:{done:{}},profile:fixture}),['security.verify','perf.verify']);
  assert.deepEqual(skippedKinds(lane,['backend.implement'],{goal:{done:{requiresPerf:true}},profile:fixture}),['security.verify']);
});

test('goalMetricRequired reads the metrics block in both spellings and never errors',()=>{
  assert.equal(goalMetricRequired({done:{requiresSecurity:true}},'requiresSecurity'),true);
  assert.equal(goalMetricRequired({done:{requiresSecurity:false}},'requiresSecurity'),false);
  assert.equal(goalMetricRequired({done:{requiresSecurity:{required:false}}},'requiresSecurity'),false);
  assert.equal(goalMetricRequired({done:{requiresSecurity:{target:'no-findings'}}},'requiresSecurity'),true);
  assert.equal(goalMetricRequired({metrics:{requiresPerf:true}},'requiresPerf'),true);
  assert.equal(goalMetricRequired({done:['requiresSecurity']},'requiresSecurity'),true);
  assert.equal(goalMetricRequired({done:[{id:'requiresSecurity'}]},'requiresSecurity'),true);
  assert.equal(goalMetricRequired({done:[{metric:'requiresSecurity',required:false}]},'requiresSecurity'),false);
  for(const goal of [null,undefined,0,'x',{}, {done:{}},{metrics:[]}])
    assert.equal(goalMetricRequired(goal,'requiresSecurity'),false,JSON.stringify(goal));
});

test('a settled revision marks every artifact and op whose inputs covered the record stale, and reverts their metrics',()=>{
  const state={
    ops:[
      {id:'build-1',status:'done',inputDigests:{srs:'srs@1',code:'c1'},metrics:['requirement-settled']},
      {id:'build-2',status:'done',inputDigests:{sds:'d2'},metrics:['design-settled']},
      {id:'build-3',status:'running',inputs:[{record:'srs',digest:'srs@1'}]},
      {id:'walk-1',status:'done',inputDigests:{srs:'srs@2'}},
      {id:'scribe-1',status:'done',references:['features/cart/business/index.yaml']}],
    artifacts:[{id:'srs-artifact',inputs:{srs:'srs@1'},satisfies:['srs-accepted']}],
    metrics:{
      'requirement-settled':{met:true,by:'build-1'},
      'design-settled':{met:true,by:'build-2'},
      'srs-accepted':{met:true,by:'srs-artifact'},
      'untouched':{met:true}}};
  const report=propagateInvalidation(state,'srs','srs@2');
  // Every entry whose inputs covered srs with the old digest went stale; the new digest and the untouched did not.
  assert.equal(state.ops[0].stale,true);
  assert.deepEqual(state.ops[0].staleBy,{record:'srs',was:'srs@1',now:'srs@2'});
  assert.equal(state.ops[1].stale,undefined,'an op that never read the record is unaffected');
  assert.equal(state.ops[2].stale,true,'an in-flight op re-validates too');
  assert.equal(state.ops[3].stale,undefined,'an input already bound to the new digest is provably unaffected');
  assert.equal(state.artifacts[0].stale,true);
  // The metrics the stale entries satisfied revert to unmet - by their own credit and by the metric's `by`.
  assert.equal(state.metrics['requirement-settled'].met,false);
  assert.equal(state.metrics['requirement-settled'].stale,true);
  assert.equal(state.metrics['design-settled'].met,true,'a metric of a fresh op stays met');
  assert.equal(state.metrics['srs-accepted'].met,false,'the metric a stale artifact carried reverts');
  assert.equal(state.metrics['untouched'].met,true);
  assert.deepEqual(report.stale,['build-1','build-3','srs-artifact']);
  assert.deepEqual([...report.unmet].sort(),['requirement-settled','srs-accepted']);
  assert.equal(report.digest,'srs@2');
  // A cited record path covers the record without a digest: it cannot prove itself unaffected, so it goes stale.
  const cited={ops:[{id:'walk-2',status:'done',references:['features/cart/business/index.yaml']}]};
  const named=propagateInvalidation(cited,{id:'biz.cart',kind:'srs',path:'features/cart/business/index.yaml'},'p2');
  assert.equal(cited.ops[0].stale,true);
  assert.deepEqual(named.stale,['walk-2']);
  // Re-running the same revision is a no-op for entries already bound to it.
  const again={ops:[{id:'build-4',inputDigests:{srs:'srs@2'}}]};
  assert.deepEqual(propagateInvalidation(again,'srs','srs@2').stale,[]);
});

test('propagateInvalidation is total and deterministic: odd state, odd records, same answer twice',()=>{
  for(const [state,record] of [[null,'srs'],[{},'srs'],[{ops:'x'},'srs'],[{ops:[null,42]},'srs'],[{ops:[{id:'a'}]},null],[{ops:[{id:'a',inputs:{srs:'d'}}]},{}]]){
    const report=propagateInvalidation(state,record,'d2');
    assert.deepEqual(report.stale,[]);
    assert.deepEqual(report.unmet,[]);
  }
  const state={ops:[{id:'a',status:'done',digests:{sds:'sds@1'},metric:'design-approved'}],goalMetrics:[{name:'design-approved',met:true}]};
  const first=propagateInvalidation(state,'sds','sds@2');
  assert.deepEqual(first.stale,['a']);
  assert.deepEqual(first.unmet,['design-approved']);
  assert.equal(state.goalMetrics[0].met,false);
  assert.equal(state.goalMetrics[0].stale,true);
  const second=propagateInvalidation(state,'sds','sds@2');
  assert.deepEqual(second.stale,['a'],'marking is idempotent: a stale entry stays stale');
});

test('validateGraph names a stray roleOfKind key and a revision that rewrites what it never read',()=>{
  // Every roleOfKind key must be a kind: an operator name there resolves to nothing the allocator can launch.
  const clean={roleOfKind:Object.fromEntries(kindList({profile}).map(kind=>[kind,roleOf(kind,{profile})]))};
  assert.deepEqual(validateGraph(profile,{runtimes:clean,records}),[]);
  const strayed={roleOfKind:{...clean.roleOfKind,'interface.implement':'implement'}};
  const stray=validateGraph(profile,{runtimes:strayed,records});
  assert.deepEqual(codes(stray),['role-map-unknown-kind']);
  assert.equal(stray[0].kind,'interface.implement');
  // A revision kind must read the record it rewrites: goal.revise reads+writes the goal record, and a repair
  // that dropped the record from its reads is the blind restatement the check exists to catch.
  const blind=clone();
  blind.kinds['architecture.revise'].reads=['decision'];
  const blindErrors=validateGraph(blind,{records});
  assert.ok(codes(blindErrors).includes('writes-unread'));
  assert.equal(blindErrors.find(error=>error.code==='writes-unread').record,'sds');
  assert.deepEqual(codes(validateGraph(extended(),{records})).filter(code=>code==='writes-unread'),[],
    'goal.revise reads the goal record it rewrites, and the added catalog stays clean');
  // The existing existence checks are unchanged: a lane step and a route target must still be kinds.
  const badLane=clone();badLane.lanes[0].steps[1].kind='interface.paint';
  assert.ok(codes(validateGraph(badLane)).includes('lane-unknown-kind'));
  const badRoute=clone();badRoute.routes[4].to.kind='goal.remodel';
  assert.ok(codes(validateGraph(badRoute)).includes('route-unknown-kind'));
});
