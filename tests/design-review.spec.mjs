import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateWorkspace, previewCompletion} from '../core/index.mjs';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';
import {documentSDS} from '../fixtures/sds.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-design-review-'));
  fs.cpSync(new URL('../examples/nested-business/',import.meta.url),root,{recursive:true});
  t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-design-review-'));fs.rmSync(root,{recursive:true,force:true});});
  const read=p=>parseYaml(fs.readFileSync(path.join(root,p),'utf8'));
  const put=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(v));};
  const overview='knowledge/business/overview/index.yaml',srs='knowledge/business/srs/documents/update/index.yaml',sds='knowledge/architecture/sds/index.yaml';
  for(const file of [overview,srs]){const n=read(file);n.state='todo';n.assertions=['scope-reviewed'];
    if(n.extensions?.work3?.specification){const s=n.extensions.work3.specification;s.status='pass';for(const r of s.requirements)r.authority='accepted';for(const source of s.sources)source.kind='accepted-intent';for(const d of s.decisions){d.status='accepted';d.blocking=false;}}
    put(file,n);
  }
  const spec=documentSDS();spec.status='pass';for(const d of spec.decisions){d.status='accepted';d.blocking=false;}
  put('knowledge/architecture/index.yaml',{schema:'work/node@2',id:'example.architecture',kind:'architecture',required:true,description:'Synthetic architecture scope.',dependsOn:['example.business.srs']});
  put('knowledge/architecture/overview/index.yaml',{schema:'work/node@2',id:'example.architecture.overview',kind:'architecture',required:true,state:'todo',description:'Synthetic design overview, not a completed design.'});
  put(sds,{schema:'work/node@2',id:'example.sds',kind:'architecture',required:true,state:'todo',description:'Synthetic source-independent document design.',assertions:['scope-reviewed'],dependsOn:['example.business.srs'],extensions:{work3:{specification:spec}}});
  const review=()=>({schema:'starci/design-review@1',reviewer:'Synthetic reviewer',authority:'Synthetic test authority only, not a real product decision.',reviewedAt:'2026-09-09T00:00:00Z',observations:[{id:'scope-reviewed',outcome:'pass',observation:'Synthetic test of binding and coverage; no real design acceptance claimed.'}],limitations:['Fixture only; no product code or execution verified.']});
  const completion=file=>({inputDigest:validateWorkspace(root).nodes.find(n=>n.id===read(file).id).inputDigest,review:review()});
  const complete=file=>{const n=read(file);n.state='done';n.completion=completion(file);put(file,n);};
  const run=()=>validateWorkspace(root);
  return {root,read,put,overview,srs,sds,review,completion,complete,run};
}

test('current SRS and SDS complete with collocated review and no evidence directories',t=>{
  const f=fixture(t);assert.ok(f.run().ok,JSON.stringify(f.run().errors));
  f.complete(f.overview);f.complete(f.srs);
  const before=fs.readFileSync(path.join(f.root,f.sds));
  const preview=previewCompletion(f.root,{'example.sds':f.completion(f.sds)});
  assert.ok(preview.ok,JSON.stringify(preview.errors));assert.equal(preview.nodes.find(n=>n.id==='example.sds').effectiveState,'done');
  assert.deepEqual(fs.readFileSync(path.join(f.root,f.sds)),before);
  f.complete(f.sds);assert.ok(f.run().ok,JSON.stringify(f.run().errors));
  for(const file of [f.overview,f.srs,f.sds])assert.equal(fs.existsSync(path.join(path.dirname(path.join(f.root,file)),'evidence')),false);
});

test('inline review cannot accept draft requirements, incomplete upstream design or operational effects',t=>{
  const f=fixture(t);f.complete(f.sds);assert.notEqual(f.run().nodes.find(n=>n.id==='example.sds').effectiveState,'done');
  const overview=f.read('knowledge/architecture/overview/index.yaml');overview.assertions=['scope-reviewed'];overview.extensions={work3:{sds:{schema:'starci/sds-overview@1',id:'OVERVIEW-TEST',title:'Synthetic overview',status:'draft',businessRefs:['FR-KNOW-03'],designGoals:['Implement the accepted update flow.'],scope:{in:['Document update.'],out:['Import.']},actors:['Owner'],systemContext:['Owner uses the product.'],qualityStrategy:['Protect ownership.'],decisions:[{concern:'Update boundary',disposition:'add',rationale:'The accepted flow requires it.',impact:'Adds a target boundary.',migration:'Fixture-only migration.'}],constraints:['Synthetic scope.'],topologyRefs:['missing-topology'],implementationHandoff:['Implement and verify later.']}}};f.put('knowledge/architecture/overview/index.yaml',overview);f.complete('knowledge/architecture/overview/index.yaml');assert.ok(f.run().errors.some(e=>e.code==='SDS_NOT_ACCEPTED'));
  const n=f.read(f.srs);n.extensions.work3.specification.status='draft';f.put(f.srs,n);f.complete(f.srs);
  assert.ok(f.run().errors.some(e=>e.code==='SPECIFICATION_NOT_ACCEPTED'));
  for(const kind of ['implementation','ui','uat','operations','business']){
    const p=`other-${kind}/index.yaml`;f.put(p,{schema:'work/node@2',id:`other-${kind}`,kind,required:true,state:'todo',assertions:['scope-reviewed']});f.complete(p);
    assert.ok(f.run().errors.some(e=>e.code==='DESIGN_REVIEW_SCOPE'&&e.path===p));
  }
});

test('inline review rejects mixed, missing, duplicate, failed and unauthored review fields',t=>{
  for(const mutate of [
    c=>c.evidence=['unrelated'],c=>c.codeRefs=[],c=>delete c.review.authority,
    c=>c.review.reviewedAt='yesterday',c=>c.review.observations=[],
    c=>c.review.observations.push({...c.review.observations[0]}),
    c=>c.review.observations[0].outcome='not-run',c=>c.review.observations[0].id='unknown',
    c=>c.review.observations[0].observation='',c=>delete c.review.limitations,
    c=>c.review.extra='unsupported'
  ]){const f=fixture(t),n=f.read(f.overview);n.state='done';n.completion=f.completion(f.overview);mutate(n.completion);f.put(f.overview,n);assert.equal(f.run().ok,false,mutate.toString());}
});

test('semantic root edits invalidate direct review through SRS and SDS without changing stored records',t=>{
  const f=fixture(t);f.complete(f.overview);f.complete(f.srs);f.complete(f.sds);assert.ok(f.run().ok);
  const before=fs.readFileSync(path.join(f.root,f.sds));
  const overview=f.read(f.overview);overview.businessOverview.scope+=' Changed synthetic accepted scope.';f.put(f.overview,overview);
  const result=f.run();for(const id of ['example.business.overview','example.business.srs.documents.update','example.sds'])assert.equal(result.nodes.find(n=>n.id===id).effectiveState,'uninvestigate',id);
  assert.deepEqual(fs.readFileSync(path.join(f.root,f.sds)),before);
});

test('non-semantic activity does not invalidate current direct design review',t=>{
  const f=fixture(t);f.complete(f.overview);const before=f.run().nodes.find(n=>n.id==='example.business.overview');
  const n=f.read(f.overview);n.activity='verifying';f.put(f.overview,n);
  const after=f.run().nodes.find(item=>item.path===f.overview);
  assert.equal(after.inputDigest,before.inputDigest);assert.equal(after.effectiveState,'done');
});

test('accepted structured overview completes against current SRS and topology then invalidates with its dependency',t=>{
  const f=fixture(t);f.complete(f.overview);f.complete(f.srs);
  f.put(f.sds,{schema:'work/node@2',id:'example.sds',kind:'architecture',required:true,description:'SDS aggregate.',extensions:{work3:{sds:{schema:'starci/sds-aggregate@1'}}}});
  f.put('knowledge/architecture/sds/code-map/index.yaml',{schema:'work/node@2',id:'example.sds.code-map',kind:'architecture',required:true,description:'Code aggregate.',extensions:{work3:{sds:{schema:'starci/sds-aggregate@1'}}}});
  f.put('knowledge/architecture/sds/code-map/backend/index.yaml',{schema:'work/node@2',id:'example.sds.backend',kind:'architecture',required:true,description:'Backend aggregate.',extensions:{work3:{sds:{schema:'starci/sds-aggregate@1'}}}});
  f.put('knowledge/architecture/sds/code-map/backend/update/index.yaml',{schema:'work/node@2',id:'example.sds.update-unit',kind:'architecture',required:true,state:'todo',description:'Target update unit.',extensions:{work3:{sds:{schema:'starci/sds-code-unit@1',id:'CU-UPDATE',title:'Update unit',status:'accepted',side:'backend',repositoryRole:'backend',path:'src/knowledge/update.ts',symbols:[{name:'update',kind:'function',signature:'update(input): Promise<Result>',responsibility:'Apply the accepted update contract.'}],callers:[],callees:[],contractRefs:[],dataRefs:[],qualityRefs:[],verificationRefs:[]}}}});
  f.put('knowledge/architecture/sds/deployment/index.yaml',{schema:'work/node@2',id:'example.sds.deployment',kind:'architecture',required:true,description:'Deployment aggregate.',extensions:{work3:{sds:{schema:'starci/sds-aggregate@1'}}}});
  f.put('knowledge/architecture/sds/deployment/local/index.yaml',{schema:'work/node@2',id:'example.sds.deployment.local',kind:'architecture',required:true,state:'todo',description:'Target topology.',extensions:{work3:{sds:{schema:'starci/sds-deployment@1',id:'DEPLOY-LOCAL',title:'Local topology',status:'accepted',topology:'One process.',placements:[{codeUnitRef:'CU-UPDATE',runtime:'backend'}],connections:[],configuration:{owner:'Platform'},credentials:{owner:'Platform'},scaling:'One process.',failureDomains:['Process'],rollout:'Compatible release.',rollback:'Prior compatible release.',recovery:{owner:'Platform'}}}}});
  const p='knowledge/architecture/overview/index.yaml',n=f.read(p);Object.assign(n,{assertions:['scope-reviewed'],dependsOn:['example.business.srs.documents.update'],refs:['example.business.srs.documents.update'],extensions:{work3:{sds:{schema:'starci/sds-overview@1',id:'OVERVIEW-UPDATE',title:'Update architecture',status:'accepted',businessRefs:['example.business.srs.documents.update'],designGoals:['Realize the accepted update flow.'],scope:{in:['Document update.'],out:['Import.']},actors:['Owner'],systemContext:['Owner reaches one backend.'],qualityStrategy:['Authorize ownership.'],decisions:[{concern:'Update target',disposition:'add',rationale:'The accepted flow requires an update boundary.',impact:'Adds the prescribed update unit.',migration:'Implement before enabling the flow.'}],constraints:['SRS remains authoritative.'],topologyRefs:['DEPLOY-LOCAL'],implementationHandoff:['Implement targets and execute checks.']}}}});f.put(p,n);f.complete(p);const current=f.run();assert.equal(current.nodes.find(x=>x.id===n.id).effectiveState,'done',JSON.stringify(current.errors));
  const s=f.read(f.srs);s.description+=' Semantic change.';f.put(f.srs,s);assert.equal(f.run().nodes.find(x=>x.id===n.id).effectiveState,'uninvestigate');
});
