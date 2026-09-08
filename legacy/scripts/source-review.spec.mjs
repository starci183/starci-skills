import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import { runSourceReviewLifecycle, sealForecast, revision, diagnostic } from './source-review-fixture.mjs';
import {createSourceFixture,acceptArchitecture,acceptBackend,current,branch,put,sha,git} from './workflow-source-fixture.mjs';

test('accepted source → real red review → normal repair rejects stale authority and preserves immutable proof', async t => {
  let peer,imports;
  await runSourceReviewLifecycle(t,{afterOriginal:async({f,original})=>{
    peer=await createSourceFixture(t,{sessionId:'source-review-peer',existing:f});imports=await f.load('scripts/producer-import.mjs');
    await imports.importProducer({root:f.root,hostRoot:f.source,sourceSessionId:f.sessionId,sourceStep:original.step,sourceParallel:1,targetSessionId:peer.sessionId,targetStep:100,targetParallel:1});
  },checkpoint:async({phase,f,original,review,repaired,forecast})=>{
    const api=await f.load('scripts/source-review.mjs');
    if(phase==='scheduled') {
      const [cell,binding]=Object.entries(forecast.sourceReviews)[0],step=Number(cell.split('/')[0]);
      const request=current(f,{operatorId:'quality.verify',contexts:[{alias:'@workspaces/be',head:original.head}],requirements:forecast.presets[cell],inputs:{'backend-source-application':original.ref}},step,{goal:forecast.goals[cell],mode:'inline'});request.frozenInputs=[binding.method];
      for(const [name,mutate,pattern] of [
        ['method',r=>{r.frozenInputs=[];},/new method/],
        ['write',r=>{r.environment.writes=['@workspaces/be/other'];},/readonly/],
        ['role',r=>{r.environment.workspace.alias='@workspaces/fe';},/readonly/],
        ['checkout',r=>{r.environment.workspace.worktree=f.repository;},/readonly/],
        ['source',r=>{r.inputs['backend-source-application']='step-1/parallel-1/response/response.md';},/exact source/],
        ['debt',r=>{r.requirements.declaredDebts=[{gate:'integration'}];},/debt-free/]
      ]) {const changed=structuredClone(request);mutate(changed);assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),changed,forecast)).join('\n'),pattern,name);}
      const stale=structuredClone(f.state());stale.mission.version++;
      assert.match((await api.sourceReviewCoverage(f.root,f.session,stale,forecast)).errors.join('\n'),/same current mission/);
      const corrupted=structuredClone(forecast);corrupted.sourceReviews[cell].subject.proof.requestHash='sha256:'+'0'.repeat(64);
      assert.match((await api.sourceReviewCoverage(f.root,f.session,f.state(),corrupted)).errors.join('\n'),/original request/);
      assert.deepEqual(await imports.validateImportedInput(f.root,peer.session,'step-100/parallel-1/response/response.md','backend-source-application',{hostRoot:f.source}),[],'historical imported bytes remain valid');
      assert.match((await imports.validateImportedInput(f.root,peer.session,'step-100/parallel-1/response/response.md','backend-source-application',{hostRoot:f.source,freshDelivery:true})).join('\n'),/SOURCE_REVIEW_PENDING/);
      await assert.rejects(imports.importProducer({root:f.root,hostRoot:f.source,sourceSessionId:f.sessionId,sourceStep:original.step,sourceParallel:1,targetSessionId:peer.sessionId,targetStep:101,targetParallel:1}),/SOURCE_REVIEW_PENDING/);
      // Exercise the public projection with genuine retained source proof and an unopened lane
      // displayed before that source. It must not consume fresh coordinates before the review.
      const plans=await f.load('scripts/plan-history.mjs'),beforeReview=structuredClone(forecast);
      delete beforeReview.sourceReviews;
      beforeReview.chain=beforeReview.chain.filter(group=>!group.includes(cell));
      for(const field of ['steps','goals','presets','nodes','dependencies','evidenceDependencies','handoffs','requestRefs']) delete beforeReview[field]?.[cell];
      for(const field of ['dependencies','evidenceDependencies']) for(const target of Object.keys(beforeReview[field])) beforeReview[field][target]=beforeReview[field][target].filter(dependency=>dependency!==cell);
      const independent='90/1',sourceCell=`${original.step}/1`,apiCell=Object.keys(beforeReview.steps).find(target=>beforeReview.steps[target]==='api.verify');
      beforeReview.steps[independent]='uat.plan';beforeReview.nodes[independent]='independent-before-retained-source';beforeReview.goals[independent]={prerequisite:apiCell};beforeReview.presets[independent]={};
      beforeReview.dependencies[independent]=[sourceCell];beforeReview.evidenceDependencies[independent]=[];
      beforeReview.chain.splice(beforeReview.chain.findIndex(group=>group.includes(sourceCell)),0,[independent]);
      const projected=await plans.editForecast(f.root,f.session,f.state(),beforeReview,{kind:'review',cell:sourceCell,criterionId:binding.criterionId,method:binding.method,gates:binding.gates},original.step);
      const projectedReview=Object.keys(projected.sourceReviews)[0],firstPending=projected.chain.find(group=>!group.some(target=>f.state().attempts[target]))[0];
      assert.equal(firstPending,projectedReview,'review gets the first fresh coordinate even with earlier unopened display rows');
      assert.equal(Number(projectedReview.split('/')[0]),original.step+1,'unopened work does not consume review coordinate budget');
      assert.deepEqual(projected.chain.filter(group=>group.some(target=>f.state().attempts[target])),f.state().chain.filter(group=>group.some(target=>f.state().attempts[target])),'review retains actual invocation coordinates');
    }
    if(phase==='red') {
      for(const field of ['startedAt','endedAt']) {const state=structuredClone(f.state());state.attempts[`${review.step}/1`][field]='not-a-time';assert.match((await api.sourceReviewCoverage(f.root,f.session,state,forecast)).errors.join('\n'),/measured inside/);}
      const file=path.join(review.dir,'response/artifacts/integration.log'),bytes=readFileSync(file);
      try {put(file,'A rewritten diagnostic is not the accepted failing measurement.\n');assert.match((await api.sourceReviewCoverage(f.root,f.session,f.state(),forecast)).errors.join('\n'),/evidenceManifest/);} finally {put(file,bytes);}
      const plans=await f.load('scripts/plan-history.mjs');
      await assert.rejects(plans.previewRevision(f.root,f.session,{requirements:{'backend.generate':{scope:'full'}}}),/SOURCE_REVIEW_PENDING/);
      // The real accepted review may also enable an independent unopened planning lane. Its
      // availability cannot move the source repair behind a Next table that cannot return to it.
      const extended=structuredClone(forecast),independent='90/1',reviewCell=`${review.step}/1`;
      const quality=extended.goals[reviewCell].prerequisite,apiCell=Object.keys(extended.steps).find(cell=>extended.steps[cell]==='api.verify');
      extended.steps[independent]='uat.plan';extended.nodes[independent]='independent-journey-plan';extended.goals[independent]={prerequisite:apiCell};extended.presets[independent]={};
      extended.dependencies[independent]=[reviewCell];extended.evidenceDependencies[independent]=[];
      extended.chain=extended.chain.filter(group=>!group.includes(quality));
      extended.chain.splice(extended.chain.findIndex(group=>group.includes(reviewCell)),0,[quality],[independent]);
      const projected=await plans.editForecast(f.root,f.session,f.state(),extended,{kind:'source-repair',cell:`${original.step}/1`,review:reviewCell,gateRef:'response/data/gates/integration.json'},review.step);
      const replacement=Object.keys(projected.sourceRepairs)[0],lane=Object.keys(projected.nodes).find(cell=>projected.nodes[cell]==='independent-journey-plan');
      assert.ok(projected.chain.findIndex(group=>group.includes(replacement))<projected.chain.findIndex(group=>group.includes(lane)),'source repair precedes independent unopened planning');
      assert.equal(Number(replacement.split('/')[0]),review.step+1,'earlier unopened display rows do not consume repair coordinate budget');
      assert.deepEqual(projected.chain.filter(group=>group.some(cell=>f.state().attempts[cell])),f.state().chain.filter(group=>group.some(cell=>f.state().attempts[cell])),'retained execution coordinates remain fixed');
      const {validateChain,loadOperatorGraph,loadMaxParallel}=await f.load('scripts/validate-chain.mjs'),{loadOperatorPackages}=await f.load('scripts/operator-md.mjs');
      const packages=await loadOperatorPackages(f.root),planned=Object.fromEntries(Object.keys(projected.steps).map(cell=>[cell,{requirements:projected.presets[cell]??{}}]));
      const requests=Object.fromEntries(Object.keys(projected.steps).map(cell=>[cell,{operatorId:projected.steps[cell],goal:projected.goals[cell],requirements:projected.presets[cell]??{}}]));
      assert.deepEqual(validateChain(f.root,packages,projected.chain,projected.steps,requests,{graph:await loadOperatorGraph(f.root,packages),forecast:projected,mission:f.state().mission,maxParallel:await loadMaxParallel(f.root),planned}),[],'the projected repair uses existing authored transitions');
    }
    if(phase==='repaired') {
      const staleReview=structuredClone(forecast),oldReviewCell=`${review.step}/1`;
      staleReview.sourceReviews['99/1']=structuredClone(forecast.sourceReviews[oldReviewCell]);
      const newReview=structuredClone(review.request);newReview.step=99;newReview.attempt={id:'99/1:a1',number:1,kind:'initial',previous:null};
      assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),newReview,staleReview)).join('\n'),/actual subject checkout HEAD/,'new review cannot relabel a live later checkout as the original source head');
      const pair=Object.values(forecast.sourceRepairs)[0],corrupted=structuredClone(forecast);
      corrupted.sourceRepairs={...corrupted.sourceRepairs,[`${original.step}/1`]:pair};delete corrupted.sourceRepairs[`${repaired.step}/1`];
      assert.match((await api.sourceReviewCoverage(f.root,f.session,f.state(),corrupted)).errors.join('\n'),/original owner|successor|repair must/);
      const request=structuredClone(repaired.request);request.goal={doneWhen:1};
      assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),request,forecast)).join('\n'),/original source goal/);
      request.goal=original.request.goal;request.expected.criteria=[];
      assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),request,forecast)).join('\n'),/required|missing/);
      const consumer=current(f,{operatorId:'quality.verify',contexts:[{alias:'@workspaces/be',head:original.head}],requirements:{},inputs:{'backend-source-application':original.ref}},99,{goal:{doneWhen:1},mode:'inline'});
      assert.match((await api.sourceReviewAdmissionErrors(f.root,f.session,f.state(),consumer,forecast)).join('\n'),/SOURCE_REVIEW_PENDING/,'old intact proof remains unavailable to fresh consumers after repair');
      assert.equal(git(f.worktree,'rev-parse','HEAD'),repaired.head);
      assert.equal((await imports.acceptedProducerProof(f.root,f.sessionId,original.step,1,'backend-source-application',{hostRoot:f.source})).manifestFingerprint,f.state().attempts[`${original.step}/1`].evidenceManifest.fingerprint);
      await assert.rejects(imports.importProducer({root:f.root,hostRoot:f.source,sourceSessionId:f.sessionId,sourceStep:original.step,sourceParallel:1,targetSessionId:peer.sessionId,targetStep:101,targetParallel:1}),/SOURCE_REVIEW_PENDING/);
      await imports.importProducer({root:f.root,hostRoot:f.source,sourceSessionId:f.sessionId,sourceStep:repaired.step,sourceParallel:1,targetSessionId:peer.sessionId,targetStep:102,targetParallel:1});
      assert.deepEqual(await imports.validateImportedInput(f.root,peer.session,'step-102/parallel-1/response/response.md','backend-source-application',{hostRoot:f.source,freshDelivery:true}),[],'exact repaired successor is fresh delivery evidence');
    }
  }});
});

test('an actually green source-only review keeps original credit and cannot authorize a repair',async t=>{
  const f=await createSourceFixture(t,{sessionId:'source-review-green'}),architecture=await acceptArchitecture(f),source=await acceptBackend(f,architecture);
  await sealForecast(f,source);
  const method=`import assert from 'node:assert/strict'; import {runFixtureWorker} from ${JSON.stringify(pathToFileURL(path.join(f.worktree,'src/modules/fixture/worker.mjs')).href)}; assert.equal(runFixtureWorker(' hello '),' HELLO '); console.log('Actual whitespace contract passed');\n`;
  const forecast=await revision(f,{kind:'review',cell:`${source.step}/1`,criterionId:'delivery',method:{ref:'request/check.mjs',sha256:sha(method)},gates:[{gate:'integration',required:true,commandRef:'node request/check.mjs',configRef:'request/check.mjs'}]}),cell=Object.keys(forecast.sourceReviews)[0];
  await diagnostic(f,source,forecast,cell,method,{expectedExit:0});
  const api=await f.load('scripts/source-review.mjs'),coverage=await api.sourceReviewCoverage(f.root,f.session,f.state(),forecast);
  assert.deepEqual(coverage,{errors:[],pending:[],retiredSources:[]});
  await assert.rejects(revision(f,{kind:'source-repair',cell:`${source.step}/1`,review:cell,gateRef:'response/data/gates/integration.json'}),/executed required in-boundary red gate/);
});
