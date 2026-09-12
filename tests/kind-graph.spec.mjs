import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {BLOCKERS,KINDS,KIND_GRAPH,LANE_BUILD,OUTCOMES,SAME,assertGraph,describeLane,familyOf,isReadOnly,
  kindList,laneById,laneFor,laneRecordFor,mutationsOf,nextKind,operatorOf,predicatesOf,reportsOf,roleOf,
  routeFor,routeList,validateGraph} from '../execution/kind-graph.mjs';

const read=name=>parseYaml(fs.readFileSync(new URL(`../profiles/${name}`,import.meta.url),'utf8'));
const profile=read('kinds.yaml');
const runtimes=read('runtimes.yaml');
const operators=fs.readdirSync(new URL('../ops/',import.meta.url),{withFileTypes:true})
  .filter(entry=>entry.isDirectory()).map(entry=>entry.name);
const codes=errors=>errors.map(error=>error.code);
const clone=()=>structuredClone(profile);
const lane=id=>laneFor(id==='frontend'?{kind:'implementation',layout:'frontend'}:{kind:'implementation',layout:'backend'},{profile});

test('the shipped catalog validates against the allocator profile and the operator catalog',()=>{
  assert.deepEqual(validateGraph(profile,{runtimes,operators}),[]);
  assert.equal(assertGraph(profile,{runtimes,operators}),profile);
  assert.equal(profile.schema,'starci/kinds@1');
  // The catalog is the closed list: the profile and the compiled constant agree in both directions.
  assert.deepEqual(kindList({profile}).sort(),[...KINDS].sort());
  for(const kind of KINDS){
    assert.ok(['design','build','prove','repair'].includes(familyOf(kind,{profile})),kind);
    assert.ok(['decide','plan','implement','verify','write'].includes(roleOf(kind,{profile})),kind);
    assert.equal(typeof isReadOnly(kind,{profile}),'boolean',kind);
    assert.ok(operators.includes(operatorOf(kind,{profile})),kind);
    const reports=reportsOf(kind,{profile});
    assert.ok(reports.outcomes.length,kind);
    for(const outcome of reports.outcomes)assert.ok(OUTCOMES.includes(outcome),`${kind}/${outcome}`);
    for(const blocker of reports.blockers)assert.ok(BLOCKERS.includes(blocker),`${kind}/${blocker}`);
    // Every kind's allocator role is the role the runtime profile would actually allocate it with.
    assert.equal(runtimes.roleOfKind[kind],roleOf(kind,{profile}),kind);
  }
  // The prover is the only read-only kind, and the only one that may change nothing.
  assert.equal(isReadOnly('review.verify',{profile}),true);
  assert.deepEqual(mutationsOf('review.verify',{profile}),[]);
  assert.deepEqual(mutationsOf('architecture.revise',{profile}),['sds']);
  assert.equal(familyOf('architecture.revise',{profile}),'repair');
  assert.equal(operatorOf('frontend.implement',{profile}),'interface.implement');
  assert.equal(roleOf('architecture.revise',{profile}),'decide');
});

test('every lane is a sequence of catalogued kinds, and every declared node shape reaches one',()=>{
  const catalogue=new Set(kindList({profile}));
  for(const entry of profile.lanes){
    assert.ok(entry.steps.length,entry.id);
    for(const step of entry.steps){
      assert.ok(catalogue.has(step.kind),`${entry.id}/${step.kind}`);
      if(step.optionalWhen)assert.ok(Object.hasOwn(predicatesOf({profile}),step.optionalWhen),step.optionalWhen);
    }
  }
  assert.deepEqual(laneFor({kind:'implementation',layout:'backend'},{profile}),['backend.implement','e2e.verify','review.verify'],'a backend slice is proven through its API before it is read');
  assert.deepEqual(laneFor({kind:'implementation',layout:'frontend'},{profile}),['interface.draw','frontend.implement','uat.verify']);
  assert.deepEqual(laneFor({kind:'uat',layout:null},{profile}),['e2e.verify'],'a scenario node outside the frontend is an API scenario');
  assert.deepEqual(laneFor({kind:'uat',layout:'frontend'},{profile}),['uat.verify'],'a frontend scenario node walks the surface');
  assert.deepEqual(laneFor({kind:'operations',layout:null},{profile}),['runtime.operate','review.verify']);
  assert.deepEqual(laneFor({kind:'architecture',layout:null},{profile}),['architecture.decide']);
  assert.deepEqual(laneFor({kind:'business',layout:null},{profile}),['business.decide']);
  assert.deepEqual(laneFor({kind:'business-overview',layout:null},{profile}),['business.decide']);
  // A ledger node that names no layout but is delivered in a frontend repository still walks the frontend lane.
  assert.deepEqual(laneFor({kind:'implementation',layout:null,repositoryRole:'frontend'},{profile}),
    ['interface.draw','frontend.implement','uat.verify']);
  // A node that names neither is behind-the-interface work; a kind no lane claims is never given a default.
  assert.deepEqual(laneFor({kind:'implementation',layout:null},{profile}),['backend.implement','e2e.verify','review.verify']);
  assert.deepEqual(laneFor({kind:'knowledge',layout:null},{profile}),[]);
  assert.equal(laneRecordFor({kind:'knowledge',layout:null},{profile}),null);
  assert.equal(laneRecordFor({kind:'ui',layout:null},{profile}).id,'implementation/frontend');
  assert.equal(laneById('implementation/frontend',{profile}).steps.length,3);
  assert.equal(describeLane(lane('frontend'),{profile}),
    'implementation/frontend: `interface.draw` (optional when `node.hasInterfaceDesign`) -> `frontend.implement` -> `uat.verify`');
  assert.equal(describeLane('uat',{profile}),'uat: `e2e.verify`');
});

test('the frontend lane order is mandatory: draw, then build, then walk',()=>{
  const frontend=lane('frontend');
  assert.equal(nextKind(frontend,[],{profile}),'interface.draw');
  assert.equal(nextKind(frontend,['interface.draw'],{profile}),'frontend.implement');
  assert.equal(nextKind(frontend,['interface.draw','frontend.implement'],{profile}),'uat.verify');
  assert.equal(nextKind(frontend,['interface.draw','frontend.implement','uat.verify'],{profile}),null);
  // A step cannot be skipped: with the drawing missing the lane asks for the drawing again, whatever else ran.
  assert.equal(nextKind(frontend,['frontend.implement'],{profile}),'interface.draw');
  assert.equal(nextKind(frontend,['frontend.implement','uat.verify'],{profile}),'interface.draw');
  // The same answers from a lane id and from a lane record, so a status view and the kernel agree.
  assert.equal(nextKind('implementation/frontend',[],{profile}),'interface.draw');
  assert.equal(nextKind(laneById('implementation/frontend',{profile}),['interface.draw'],{profile}),'frontend.implement');
  assert.equal(nextKind(lane('backend'),[],{profile}),'backend.implement');
  assert.equal(nextKind(lane('backend'),['backend.implement'],{profile}),'e2e.verify');
  assert.equal(nextKind(lane('backend'),['backend.implement','e2e.verify'],{profile}),'review.verify');
  assert.equal(nextKind(lane('backend'),['backend.implement','e2e.verify','review.verify'],{profile}),null);
});

test('optionalWhen skips a step only for a named predicate the kernel satisfied',()=>{
  const frontend=lane('frontend');
  assert.deepEqual(Object.keys(predicatesOf({profile})),['node.hasInterfaceDesign']);
  assert.equal(nextKind(frontend,[],{predicates:{'node.hasInterfaceDesign':true},profile}),'frontend.implement');
  assert.equal(nextKind(frontend,[],{predicates:{'node.hasInterfaceDesign':()=>true},profile}),'frontend.implement');
  // False, absent or unknown: the default is to run the mandatory step, never to assume it away.
  assert.equal(nextKind(frontend,[],{predicates:{'node.hasInterfaceDesign':false},profile}),'interface.draw');
  assert.equal(nextKind(frontend,[],{predicates:{},profile}),'interface.draw');
  assert.equal(nextKind(frontend,[],{predicates:{'node.somethingElse':true},profile}),'interface.draw');
  // A satisfied optional step does not let the rest of the lane be skipped either.
  assert.equal(nextKind(frontend,['frontend.implement'],{predicates:{'node.hasInterfaceDesign':true},profile}),'uat.verify');
  // No step of the backend lane is optional.
  for(const step of laneById('implementation/backend',{profile}).steps)assert.equal(step.optionalWhen,undefined);
});

test('every declared route resolves, carries a limit and says what happens to the requester',()=>{
  const routes=routeList({profile});
  assert.equal(routes.length,profile.routes.length);
  for(const route of routes){
    assert.ok(route.id,'a route needs an id');
    assert.ok(Object.keys(route.on).length,route.id);
    assert.ok(Number.isInteger(route.limit)&&route.limit>0,route.id);
    assert.ok(['retry','reopen','pause','settle','needUser'].includes(route.then),route.id);
    assert.ok(route.to.needUser===true||typeof route.to.kind==='string',route.id);
  }
  // Every blocker the vocabulary declares is answered by exactly one first-matching route.
  for(const blocker of BLOCKERS){
    const routed=routeFor({outcome:'blocked',blocker,kind:'backend.implement',lane:lane('backend')},{profile});
    assert.ok(routed,blocker);
    assert.equal(routed.schema,KIND_GRAPH);
  }
  const sdsGap=routeFor({outcome:'blocked',blocker:'sds-gap',kind:'backend.implement',lane:lane('backend')},{profile});
  assert.deepEqual({kind:sdsGap.kind,origin:sdsGap.origin,then:sdsGap.then,limit:sdsGap.limit},
    {kind:'architecture.revise',origin:'architecture',then:'reopen',limit:2});
  const interfaceGap=routeFor({outcome:'blocked',blocker:'interface-gap',kind:'frontend.implement',lane:lane('frontend')},{profile});
  assert.deepEqual({kind:interfaceGap.kind,origin:interfaceGap.origin,then:interfaceGap.then},
    {kind:'interface.draw',origin:'architecture',then:'reopen'});
  // A shared change is the requester's own kind, scoped, and the requester waits for it.
  const sharedFrontend=routeFor({outcome:'blocked',blocker:'shared-change',kind:'frontend.implement',lane:lane('frontend')},{profile});
  assert.deepEqual({kind:sharedFrontend.kind,origin:sharedFrontend.origin,then:sharedFrontend.then},
    {kind:'frontend.implement',origin:'shared',then:'pause'});
  assert.equal(routeFor({outcome:'blocked',blocker:'shared-change',kind:'runtime.operate'},{profile}).kind,'runtime.operate');
  // Review findings and a red walk both repair the build kind of the lane they came from, never a fixed one.
  const findings=routeFor({verdict:'findings',kind:'review.verify',lane:lane('backend')},{profile});
  assert.deepEqual({kind:findings.kind,origin:findings.origin,then:findings.then,limit:findings.limit},
    {kind:'backend.implement',origin:'repair',then:'settle',limit:3});
  assert.equal(routeFor({verdict:'findings',kind:'review.verify',lane:['runtime.operate','review.verify']},{profile}).kind,'runtime.operate');
  const red=routeFor({outcome:'failed',kind:'uat.verify',lane:lane('frontend')},{profile});
  assert.deepEqual({kind:red.kind,origin:red.origin,then:red.then,limit:red.limit},
    {kind:'frontend.implement',origin:'repair',then:'reopen',limit:3},'a red walk repairs the build and the walk runs again behind it');
  // A rejected report is the same operation again, bounded, with no new operation and no new origin.
  const rejected=routeFor({verdict:'rejected',kind:'backend.implement'},{profile});
  assert.deepEqual({kind:rejected.kind,origin:rejected.origin,then:rejected.then,limit:rejected.limit},
    {kind:'backend.implement',origin:null,then:'retry',limit:2});
  // A runtime that cannot start is the user's, not a model's: no kind, and the workflow stops.
  const environment=routeFor({outcome:'blocked',blocker:'environment',kind:'runtime.operate'},{profile});
  assert.deepEqual({kind:environment.kind,needUser:environment.needUser,then:environment.then},
    {kind:null,needUser:true,then:'needUser'});
  assert.equal(routeFor({outcome:'ask',kind:'backend.implement'},{profile}).needUser,true);
  assert.equal(routeFor({outcome:'partial',kind:'backend.implement'},{profile}).then,'retry');
  // A clean result is not routed at all: the lane simply advances.
  assert.equal(routeFor({outcome:'done',kind:'backend.implement'},{profile}),null);
  assert.equal(routeFor({verdict:'pass',kind:'review.verify'},{profile}),null);
  assert.equal(routeFor({},{profile}),null);
  // A symbolic target without the context to resolve it is named unresolved, never defaulted to a kind.
  const blind=routeFor({verdict:'findings',kind:'review.verify'},{profile});
  assert.equal(blind.kind,null);
  assert.equal(blind.unresolved,LANE_BUILD);
  assert.equal(routeFor({verdict:'rejected'},{profile}).unresolved,SAME);
});

test('an invalid profile is rejected with a named error, never silently repaired',()=>{
  assert.deepEqual(codes(validateGraph({})),['profile-shape']);
  const unknownLaneKind=clone();
  unknownLaneKind.lanes[0].steps[1].kind='frontend.build';
  assert.ok(codes(validateGraph(unknownLaneKind)).includes('lane-unknown-kind'));
  const unknownRouteKind=clone();
  unknownRouteKind.routes[4].to.kind='architecture.rewrite';
  assert.ok(codes(validateGraph(unknownRouteKind)).includes('route-unknown-kind'));
  const extra=clone();
  extra.kinds['content.generate']={family:'build',role:'write',readOnly:false,mutates:['code'],purpose:'x',
    reports:{outcomes:['done'],blockers:[]}};
  assert.ok(codes(validateGraph(extra)).includes('catalog-drift'));
  const dropped=clone();
  delete dropped.kinds['interface.draw'];
  assert.ok(codes(validateGraph(dropped)).includes('catalog-drift'));
  // A lane is a sequence, not a loop, and it never builds without proving afterwards.
  const looping=clone();
  looping.lanes[1].steps.push({kind:'backend.implement'});
  assert.ok(codes(validateGraph(looping)).includes('lane-duplicate-step'));
  const unproven=clone();
  unproven.lanes[1].steps=[{kind:'backend.implement'}];
  assert.ok(codes(validateGraph(unproven)).includes('lane-build-without-proof'));
  const lateDesign=clone();
  lateDesign.lanes[0].steps=[{kind:'frontend.implement'},{kind:'interface.draw'},{kind:'uat.verify'}];
  assert.ok(codes(validateGraph(lateDesign)).includes('lane-design-after-build'));
  const unknownPredicate=clone();
  unknownPredicate.lanes[0].steps[0].optionalWhen='node.looksFine';
  assert.ok(codes(validateGraph(unknownPredicate)).includes('lane-unknown-predicate'));
  // Two named kinds that hand the work back and forth are a cycle, however bounded each hop is.
  const cyclic=clone();
  cyclic.routes.push({id:'a',on:{verdict:'findings'},from:'backend.implement',to:{kind:'runtime.operate',origin:'repair'},limit:1,then:'settle',purpose:'x'});
  cyclic.routes.push({id:'b',on:{verdict:'gate-failed'},from:'runtime.operate',to:{kind:'backend.implement',origin:'repair'},limit:1,then:'settle',purpose:'x'});
  assert.ok(codes(validateGraph(cyclic)).includes('route-cycle'));
  // A prover may ask for a redesign; it may never be routed into one.
  const proverDesigns=clone();
  proverDesigns.routes.push({id:'c',on:{verdict:'findings'},from:'review.verify',to:{kind:'interface.draw',origin:'architecture'},limit:1,then:'settle',purpose:'x'});
  const proverCodes=codes(validateGraph(proverDesigns));
  assert.ok(proverCodes.includes('prove-to-design'));
  assert.ok(proverCodes.includes('design-target-must-wait'));
  // Limits, origins and the requester's fate are all mandatory.
  const unbounded=clone();
  delete unbounded.routes[0].limit;
  assert.ok(codes(validateGraph(unbounded)).includes('route-missing-limit'));
  const unknownOrigin=clone();
  unknownOrigin.routes[0].to.origin='design';
  assert.ok(codes(validateGraph(unknownOrigin)).includes('route-unknown-origin'));
  const noThen=clone();
  delete noThen.routes[0].then;
  assert.ok(codes(validateGraph(noThen)).includes('route-unknown-then'));
  // A route no query can reach, because an earlier one already matches everything it would.
  const shadowed=clone();
  shadowed.routes.push({id:'d',on:{outcome:'failed'},from:'backend.implement',to:{kind:'same'},limit:1,then:'retry',purpose:'x'});
  assert.ok(codes(validateGraph(shadowed)).includes('route-shadowed'));
  // A blocker with no route would stall a workflow in silence.
  const unrouted=clone();
  unrouted.routes=unrouted.routes.filter(route=>route.on.blocker!=='environment');
  assert.ok(codes(validateGraph(unrouted)).includes('unrouted-blocker'));
  // A read-only kind that mutates, and a kind the allocator cannot place.
  const mutatingProver=clone();
  mutatingProver.kinds['review.verify'].mutates=['code'];
  assert.ok(codes(validateGraph(mutatingProver)).includes('readonly-mutates'));
  const misrouted=clone();
  misrouted.kinds['architecture.revise'].role='implement';
  assert.ok(codes(validateGraph(misrouted,{runtimes})).includes('role-mismatch'));
  assert.ok(codes(validateGraph(clone(),{runtimes:{roleOfKind:{}}})).includes('role-not-allocatable'));
  const badOperator=clone();
  badOperator.kinds['frontend.implement'].operator='frontend.implement';
  assert.ok(codes(validateGraph(badOperator,{operators})).includes('unknown-operator'));
  assert.throws(()=>assertGraph(badOperator,{operators}),/unknown-operator/);
  assert.throws(()=>roleOf('frontend.build',{profile}),/Unknown operation kind/);
});

test('the compiled profile is the one the kernel will read at run time',()=>{
  const dist=new URL('../.dist/profiles/kinds.json',import.meta.url);
  if(!fs.existsSync(dist))return;
  const compiled=JSON.parse(fs.readFileSync(dist,'utf8'));
  assert.deepEqual(compiled,profile);
  assert.deepEqual(validateGraph(compiled,{runtimes,operators}),[]);
});
