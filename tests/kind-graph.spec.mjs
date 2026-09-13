import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {BLOCKERS,CAPABILITIES,KINDS,KIND_GRAPH,LANE_BUILD,OUTCOMES,SAME,assertGraph,describeLane,familyOf,isReadOnly,
  kindList,laneById,laneFor,laneRecordFor,mutationsOf,needsOf,nextKind,operatorOf,predicatesOf,reportsOf,roleOf,
  routeFor,routeList,validateGraph} from '../execution/kind-graph.mjs';

const read=name=>parseYaml(fs.readFileSync(new URL(`../profiles/${name}`,import.meta.url),'utf8'));
const profile=read('kinds.yaml');
const runtimes=read('runtimes.yaml');
const operators=fs.readdirSync(new URL('../ops/',import.meta.url),{withFileTypes:true})
  .filter(entry=>entry.isDirectory()).map(entry=>entry.name);
const codes=errors=>errors.map(error=>error.code);
const clone=()=>structuredClone(profile);
const lane=id=>laneFor(id==='frontend'?{kind:'implementation',layout:'frontend'}:id==='ui'?{kind:'ui',layout:null}:{kind:'implementation',layout:'backend'},{profile});

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
  // The API prove step launches under its own contract, not the frontend walk's.
  assert.equal(operatorOf('e2e.verify',{profile}),'e2e.verify');
  assert.equal(operatorOf('uat.verify',{profile}),'uat.verify');
  assert.equal(roleOf('architecture.revise',{profile}),'decide');
  // The record-authoring kind completes the fields a node needs before its lane may start, and no lane walks it.
  assert.deepEqual(mutationsOf('work.author',{profile}),['record']);
  assert.equal(familyOf('work.author',{profile}),'design');
  assert.equal(roleOf('work.author',{profile}),'plan');
  assert.equal(operatorOf('work.author',{profile}),'work.author');
  assert.deepEqual(reportsOf('work.author',{profile}),{outcomes:['done','partial','failed','ask'],blockers:[]});
  // The identity kind is the other one that writes an authored record, because that record IS its decision, and
  // the only kind that may produce asset bytes: a placeholder mascot the product does not have yet.
  assert.equal(familyOf('brand.decide',{profile}),'design');
  assert.equal(roleOf('brand.decide',{profile}),'write');
  assert.equal(isReadOnly('brand.decide',{profile}),false);
  assert.equal(operatorOf('brand.decide',{profile}),'brand.decide');
  assert.deepEqual(mutationsOf('brand.decide',{profile}),['record','asset']);
  assert.deepEqual(reportsOf('brand.decide',{profile}),{outcomes:['done','partial','failed','ask','blocked'],blockers:['environment','authority']});
  assert.deepEqual(Object.keys(profile.kinds).filter(kind=>mutationsOf(kind,{profile}).includes('asset')),['brand.decide','interface.asset'],'asset bytes come from the brand decision (a placeholder mascot) or the artwork step, nowhere else');
  assert.deepEqual(Object.keys(profile.kinds).filter(kind=>mutationsOf(kind,{profile}).includes('record')),['brand.decide','work.author']);
  // A drawing that finds no settled identity says so with its own blocker; it never invents a colour instead.
  assert.ok(reportsOf('interface.draw',{profile}).blockers.includes('brand-gap'));
  // The language itself is grown by one kind, which belongs to no lane and is the only one that may change it.
  assert.equal(familyOf('grammar.update',{profile}),'build');
  assert.equal(roleOf('grammar.update',{profile}),'implement');
  assert.equal(isReadOnly('grammar.update',{profile}),false);
  assert.equal(operatorOf('grammar.update',{profile}),'grammar.update');
  assert.ok(operators.includes('grammar.update'));
  assert.equal(runtimes.roleOfKind['grammar.update'],'implement');
  assert.deepEqual(mutationsOf('grammar.update',{profile}),['code','grammar']);
  assert.deepEqual(Object.keys(profile.kinds).filter(kind=>mutationsOf(kind,{profile}).includes('grammar')),['grammar.update'],'only one kind may grow the installed grammar');
  assert.deepEqual(reportsOf('grammar.update',{profile}),{outcomes:['done','partial','failed','ask','blocked'],blockers:['shared-change','environment','authority']});
  // It never raises the gap it answers, and it is not part of any lane - like `architecture.revise`, a report creates it.
  assert.equal(reportsOf('grammar.update',{profile}).blockers.includes('grammar-gap'),false);
  for(const entry of profile.lanes)assert.equal(entry.steps.some(step=>step.kind==='grammar.update'),false,entry.id);
  // Exactly the two kinds that render a surface may say the language lacks the word.
  assert.deepEqual(Object.keys(profile.kinds).filter(kind=>reportsOf(kind,{profile}).blockers.includes('grammar-gap')),['interface.draw','frontend.implement']);
  for(const entry of profile.lanes)assert.equal(entry.steps.some(step=>step.kind==='work.author'),false,entry.id);
  // And no route creates it: the kernel starts it itself when the ledger reports a node incomplete.
  for(const route of profile.routes)assert.notEqual(route.to?.kind,'work.author');
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
  // The ui node is the design record: drawn, then the artwork its candidate embeds generated - the files exist
  // before anything imports them, and that step is optional only for a record that declares no artwork slot.
  // The implementation node of the feature builds against that record and walks the result.
  assert.deepEqual(laneFor({kind:'ui',layout:null},{profile}),['interface.draw','interface.asset']);
  assert.deepEqual(laneFor({kind:'implementation',layout:'frontend'},{profile}),['frontend.implement','uat.verify']);
  assert.deepEqual(laneFor({kind:'uat',layout:null},{profile}),['e2e.verify'],'a scenario node outside the frontend is an API scenario');
  assert.deepEqual(laneFor({kind:'uat',layout:'frontend'},{profile}),['uat.verify'],'a frontend scenario node walks the surface');
  assert.deepEqual(laneFor({kind:'e2e',layout:null},{profile}),['e2e.verify'],'an e2e node is proven through the API');
  assert.deepEqual(laneFor({kind:'operations',layout:null},{profile}),['runtime.operate','review.verify']);
  assert.deepEqual(laneFor({kind:'architecture',layout:null},{profile}),['architecture.decide']);
  assert.deepEqual(laneFor({kind:'business',layout:null},{profile}),['business.decide']);
  assert.deepEqual(laneFor({kind:'business-overview',layout:null},{profile}),['business.decide']);
  // One identity record, one operation: a brand node has nothing to build and nothing to walk.
  assert.deepEqual(laneFor({kind:'brand',layout:null},{profile}),['brand.decide']);
  assert.deepEqual(laneFor({kind:'brand',layout:'frontend'},{profile}),['brand.decide']);
  assert.equal(laneRecordFor({kind:'brand',layout:null},{profile}).id,'brand');
  assert.equal(nextKind(laneFor({kind:'brand',layout:null},{profile}),['brand.decide'],{profile}),null);
  // A ledger node that names no layout but is delivered in a frontend repository still walks the frontend lane.
  assert.deepEqual(laneFor({kind:'implementation',layout:null,repositoryRole:'frontend'},{profile}),['frontend.implement','uat.verify']);
  // A node that names neither is behind-the-interface work; a kind no lane claims is never given a default.
  assert.deepEqual(laneFor({kind:'implementation',layout:null},{profile}),['backend.implement','e2e.verify','review.verify']);
  assert.deepEqual(laneFor({kind:'knowledge',layout:null},{profile}),[]);
  assert.equal(laneRecordFor({kind:'knowledge',layout:null},{profile}),null);
  assert.equal(laneRecordFor({kind:'ui',layout:null},{profile}).id,'design/ui');
  assert.equal(laneById('design/ui',{profile}).steps.length,2);
  assert.equal(laneById('implementation/frontend',{profile}).steps.length,2);
  assert.equal(describeLane(lane('ui'),{profile}),'design/ui: `interface.draw` -> `interface.asset` (optional when `node.hasNoArtworkSlots`)');
  assert.equal(describeLane(lane('frontend'),{profile}),'implementation/frontend: `frontend.implement` -> `uat.verify`');
  assert.equal(describeLane('uat',{profile}),'uat: `e2e.verify`');
});

test('the interface lanes are mandatory in order: the ui node is drawn then its artwork generated; the implementation is built then walked',()=>{
  const ui=lane('ui'),frontend=lane('frontend');
  assert.equal(nextKind(ui,[],{profile}),'interface.draw');
  assert.equal(nextKind(ui,['interface.draw'],{profile}),'interface.asset');
  assert.equal(nextKind(ui,['interface.draw','interface.asset'],{profile}),null);
  assert.equal(nextKind(frontend,[],{profile}),'frontend.implement');
  assert.equal(nextKind(frontend,['frontend.implement'],{profile}),'uat.verify');
  assert.equal(nextKind(frontend,['frontend.implement','uat.verify'],{profile}),null);
  // A step cannot be skipped: with the drawing missing the ui lane asks for the drawing again, whatever else ran.
  assert.equal(nextKind(ui,['interface.asset'],{profile}),'interface.draw');
  // Nor may the walk stand in for the build: without the build the frontend lane asks for the build.
  assert.equal(nextKind(frontend,['uat.verify'],{profile}),'frontend.implement');
  // Without the predicate the asset step is due: artwork that was never generated is never assumed.
  assert.equal(nextKind(ui,['interface.draw'],{profile}),'interface.asset');
  // The same answers from a lane id and from a lane record, so a status view and the kernel agree.
  assert.equal(nextKind('design/ui',[],{profile}),'interface.draw');
  assert.equal(nextKind(laneById('design/ui',{profile}),['interface.draw'],{profile}),'interface.asset');
  assert.equal(nextKind('implementation/frontend',[],{profile}),'frontend.implement');
  assert.equal(nextKind(lane('backend'),[],{profile}),'backend.implement');
  assert.equal(nextKind(lane('backend'),['backend.implement'],{profile}),'e2e.verify');
  assert.equal(nextKind(lane('backend'),['backend.implement','e2e.verify'],{profile}),'review.verify');
  assert.equal(nextKind(lane('backend'),['backend.implement','e2e.verify','review.verify'],{profile}),null);
});

test('optionalWhen skips a step only for a named predicate the kernel satisfied',()=>{
  const ui=lane('ui');
  assert.deepEqual(Object.keys(predicatesOf({profile})),['node.hasInterfaceDesign','node.hasNoArtworkSlots']);
  assert.equal(nextKind(ui,['interface.draw'],{predicates:{'node.hasNoArtworkSlots':true},profile}),null);
  assert.equal(nextKind(ui,['interface.draw'],{predicates:{'node.hasNoArtworkSlots':()=>true},profile}),null);
  // False, absent or unknown: the default is to run the mandatory step, never to assume it away.
  assert.equal(nextKind(ui,['interface.draw'],{predicates:{'node.hasNoArtworkSlots':false},profile}),'interface.asset');
  assert.equal(nextKind(ui,['interface.draw'],{predicates:{},profile}),'interface.asset');
  assert.equal(nextKind(ui,['interface.draw'],{predicates:{'node.somethingElse':true},profile}),'interface.asset');
  // The drawing itself is never optional on the ui lane: a satisfied predicate for a step the lane does not
  // mark optional changes nothing, because the record, not the predicate, is what the lane reads.
  assert.equal(nextKind(ui,[],{predicates:{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':true},profile}),'interface.draw');
  // Satisfied predicates never let a mandatory step of the frontend lane be skipped either.
  const frontend=lane('frontend');
  assert.equal(nextKind(frontend,[],{predicates:{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':true},profile}),'frontend.implement');
  assert.equal(nextKind(frontend,['frontend.implement'],{predicates:{'node.hasInterfaceDesign':true,'node.hasNoArtworkSlots':true},profile}),'uat.verify');
  // No step of the backend lane is optional.
  for(const step of laneById('implementation/backend',{profile}).steps)assert.equal(step.optionalWhen,undefined);
});

test('the artwork kind writes assets and the design record, runs on the image-model role, and a brand gap goes back to the drawing',()=>{
  // It produces images like the drawing does, so it carries the same allocator role, and its operator is its own.
  assert.equal(familyOf('interface.asset',{profile}),'design');
  assert.equal(roleOf('interface.asset',{profile}),roleOf('interface.draw',{profile}));
  assert.equal(roleOf('interface.asset',{profile}),'write');
  assert.equal(runtimes.roleOfKind['interface.asset'],'write');
  assert.equal(isReadOnly('interface.asset',{profile}),false);
  assert.deepEqual(mutationsOf('interface.asset',{profile}),['asset','design']);
  assert.equal(operatorOf('interface.asset',{profile}),'interface.asset');
  assert.ok(operators.includes('interface.asset'));
  // It never writes the authored Work record; asset bytes come from it or from the brand decision, nowhere else.
  assert.equal(mutationsOf('interface.asset',{profile}).includes('record'),false);
  assert.deepEqual(Object.keys(profile.kinds).filter(kind=>mutationsOf(kind,{profile}).includes('asset')),['brand.decide','interface.asset']);
  // A brief the brand rules cannot satisfy means the brand record is missing or silent: the brand is settled first,
  // then the reporting step reads it again. The build may raise the same blocker.
  assert.ok(reportsOf('interface.asset',{profile}).blockers.includes('brand-gap'));
  assert.ok(reportsOf('frontend.implement',{profile}).blockers.includes('brand-gap'));
  assert.ok(BLOCKERS.includes('brand-gap'));
  const brandGap=routeFor({outcome:'blocked',blocker:'brand-gap',kind:'interface.asset',lane:lane('frontend')},{profile});
  assert.deepEqual({kind:brandGap.kind,origin:brandGap.origin,then:brandGap.then,limit:brandGap.limit},
    {kind:'brand.decide',origin:'architecture',then:'reopen',limit:2});
  // From the build it is the same answer: the brand is settled, never invented in code or in an image.
  assert.equal(routeFor({outcome:'blocked',blocker:'brand-gap',kind:'frontend.implement',lane:lane('frontend')},{profile}).kind,'brand.decide');
  // A red walk still repairs the build of the lane, not the asset step: the lane's build kind is unchanged.
  assert.equal(routeFor({outcome:'failed',kind:'uat.verify',lane:lane('frontend')},{profile}).kind,'frontend.implement');
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
  // A missing identity is settled in the brand record, bounded, and the requester reads it again afterwards.
  const brandGap=routeFor({outcome:'blocked',blocker:'brand-gap',kind:'interface.draw',lane:lane('frontend')},{profile});
  assert.deepEqual({kind:brandGap.kind,origin:brandGap.origin,then:brandGap.then,limit:brandGap.limit},
    {kind:'brand.decide',origin:'architecture',then:'reopen',limit:2});
  // It is declared from `any`, so whichever operation discovers the gap waits for the same one record.
  assert.equal(routeFor({outcome:'blocked',blocker:'brand-gap',kind:'backend.implement',lane:lane('backend')},{profile}).kind,'brand.decide');
  assert.equal(routeFor({outcome:'blocked',blocker:'brand-gap',kind:'interface.draw'},{profile}).unresolved,null,'a named target needs no lane context');
  // A shape the grammar cannot render is grown into the grammar once, bounded at two rounds, and the two kinds
  // that render a surface are the only ones that can reach this route at all.
  for(const kind of ['interface.draw','frontend.implement']){
    const grammarGap=routeFor({outcome:'blocked',blocker:'grammar-gap',kind,lane:lane('frontend')},{profile});
    assert.deepEqual({kind:grammarGap.kind,origin:grammarGap.origin,then:grammarGap.then,limit:grammarGap.limit},
      {kind:'grammar.update',origin:'architecture',then:'reopen',limit:2},kind);
    assert.equal(grammarGap.unresolved,null,'a named target needs no lane context');
  }
  assert.equal(reportsOf('uat.verify',{profile}).blockers.includes('grammar-gap'),false);
  assert.equal(routeFor({outcome:'blocked',blocker:'grammar-gap',kind:'uat.verify',lane:lane('frontend')},{profile})?.kind,'grammar.update',
    'the route is declared from any, so it resolves; what stops a walk from taking it is its own report vocabulary');
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
  looping.lanes[2].steps.push({kind:'backend.implement'});
  assert.ok(codes(validateGraph(looping)).includes('lane-duplicate-step'));
  const unproven=clone();
  unproven.lanes[2].steps=[{kind:'backend.implement'}];
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

test('a kind may need a host capability from the closed vocabulary: the drawing needs the design tool and every other kind runs on any host',()=>{
  assert.deepEqual([...CAPABILITIES],['design-tool']);
  assert.deepEqual(profile.vocabularies.capabilities,[...CAPABILITIES]);
  assert.deepEqual(needsOf('interface.asset',{profile}),['design-tool'],'the artwork needs the image model');
  assert.deepEqual(needsOf('interface.draw',{profile}),[],'the drawing renders the grammar in a browser and runs on every host');
  for(const kind of KINDS.filter(kind=>kind!=='interface.asset'))assert.deepEqual(needsOf(kind,{profile}),[],kind);
  const unknown=clone();unknown.kinds['backend.implement'].needs=['orca-browser'];
  assert.deepEqual(codes(validateGraph(unknown,{runtimes,operators})),['unknown-capability']);
  const shape=clone();shape.kinds['backend.implement'].needs='design-tool';
  assert.deepEqual(codes(validateGraph(shape,{runtimes,operators})),['needs-shape']);
});
