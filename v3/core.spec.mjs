import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalJSON,sha256,validateWorkspace,impactWorkspace} from './core/index.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'work-core-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  function write(p,value) {const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2));}
  write('workspace.yaml',{schema:'work/workspace@1',id:'test-workspace'});
  const metas=new Map();
  function node(p,overrides={},body='Scope: synthetic unit fixture. Done when declared test assertions are observed.') {
    const m={schema:'work/node@1',id:p.replaceAll('/','.'),kind:'business',required:true,state:'todo',assertions:['synthetic-check'],...overrides};
    metas.set(p,m);write(`${p}/node.md`,`---\n${JSON.stringify(m)}\n---\n${body}\n`);return m;
  }
  function done(p,overrides={}) {
    const m=metas.get(p), inputDigest=validateWorkspace(root).nodes.find(n=>n.id===m.id).inputDigest;
    const e={schema:'work/evidence@1',id:`proof.${m.id}`,nodeId:m.id,inputDigest,outcome:'pass',assertions:[{id:'synthetic-check',outcome:'pass',observation:'Synthetic test assertion evaluated by unit harness, not product proof.'}],assets:[],...overrides};
    write(`${p}/evidence/check/manifest.yaml`,e);
    node(p,{...m,state:'done',completion:{inputDigest,evidence:[e.id]}});return e;
  }
  return {root,write,node,done,metas,run:()=>validateWorkspace(root)};
}
const codes=r=>r.errors.map(e=>e.code);

test('canonical hashes are order independent, array order sensitive and SHA-256 exact',()=>{
  assert.equal(canonicalJSON({z:2,a:{b:1}}),canonicalJSON({a:{b:1},z:2}));
  assert.notEqual(sha256(canonicalJSON([1,2])),sha256(canonicalJSON([2,1])));
  assert.equal(sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('missing root and unsupported metadata fail safely without execution',t=>{
  const f=fixture(t);assert.equal(validateWorkspace(path.join(f.root,'missing')).ok,false);
  f.write('workspace.yaml','schema: work/workspace@1\nid: !!js/function function() {}');
  assert.ok(codes(f.run()).includes('UNSUPPORTED_METADATA'));
});
test('valid todo spec and synthetic done are different; validation is read-only',t=>{
  const f=fixture(t);f.node('biz');assert.equal(f.run().nodes[0].effectiveState,'todo');
  f.done('biz');const before=fs.readFileSync(path.join(f.root,'biz/node.md'));
  assert.equal(f.run().ok,true);assert.equal(f.run().nodes[0].effectiveState,'done');
  assert.deepEqual(fs.readFileSync(path.join(f.root,'biz/node.md')),before);
});
test('branch rollup ignores optional unmet children with explicit warning',t=>{
  const f=fixture(t);f.node('biz');const branch=f.metas.get('biz');delete branch.state;f.node('biz',branch);
  // node helper defaults state for leaves; remove it explicitly from the serialized branch.
  delete branch.state;f.write('biz/node.md',`---\n${JSON.stringify(branch)}\n---\nSynthetic branch scope.`);
  f.node('biz/required');f.node('biz/optional',{required:false});f.done('biz/required');
  const r=f.run();assert.equal(r.ok,true);assert.equal(r.nodes.find(n=>n.id==='biz').effectiveState,'done');assert.ok(r.warnings.some(w=>w.code==='OPTIONAL_UNMET'));
});
test('branch cannot manually claim state; leaves need blocker and NA reason',t=>{
  const f=fixture(t);f.node('biz');f.node('biz/a',{state:'blocked'});f.node('biz/b',{state:'na'});
  const c=codes(f.run());for(const code of ['BRANCH_STATE','BLOCKER','NA_REASON'])assert.ok(c.includes(code));
});
test('ancestor semantic edit stales descendant while timestamps do not',t=>{
  const f=fixture(t);f.node('biz/leaf');const b={schema:'work/node@1',id:'biz',kind:'group',required:true};
  f.write('biz/node.md',`---\n${JSON.stringify(b)}\n---\nApproved scope A.`);f.done('biz/leaf');
  const initial=f.run().nodes.find(n=>n.id==='biz.leaf').inputDigest;
  f.write('biz/node.md',`---\n${JSON.stringify({...b,updatedAt:'2099-01-01'})}\n---\nApproved scope A.`);
  assert.equal(f.run().nodes.find(n=>n.id==='biz.leaf').inputDigest,initial);
  f.write('biz/node.md',`---\n${JSON.stringify(b)}\n---\nApproved scope B.`);
  assert.equal(f.run().nodes.find(n=>n.id==='biz.leaf').effectiveState,'suspended');
});
test('stable ID survives same-parent directory rename',t=>{
  const f=fixture(t);f.node('original',{id:'stable-piece'});f.done('original');const before=f.run().nodes[0].inputDigest;
  fs.renameSync(path.join(f.root,'original'),path.join(f.root,'renamed'));
  assert.equal(f.run().nodes[0].inputDigest,before);assert.equal(f.run().ok,true);
});
test('inherited prerequisite blocks child even when its own refs are empty',t=>{
  const f=fixture(t);f.node('contract');f.node('group/child');
  f.write('group/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'group',kind:'group',required:true,dependsOn:['contract']})}\n---\nBounded implementation group.`);
  f.done('group/child');const r=f.run();assert.equal(r.nodes.find(n=>n.id==='group.child').eligible,false);assert.ok(codes(r).includes('DEPENDENCY_NOT_DONE'));
});
test('extension semantics are hashed and prototype names cannot become supported profiles',t=>{
  const f=fixture(t);f.node('biz',{extensions:{future:{value:1}}});f.done('biz');const old=f.run().nodes[0].inputDigest;
  f.node('biz',{...f.metas.get('biz'),extensions:{future:{value:2}}});assert.notEqual(f.run().nodes[0].inputDigest,old);
  f.node('unknown',{kind:'toString'});f.done('unknown');assert.ok(codes(f.run()).includes('UNSUPPORTED_PROFILE'));
});
test('failed, empty, wrong-owner and uncovered assertions reject fake done',t=>{
  for(const change of [{outcome:'fail'},{assertions:[]},{nodeId:'absent'},{assertions:[{id:'other',outcome:'pass',observation:'Synthetic'}]},{assertions:[null]}]){
    const f=fixture(t);f.node('biz');f.done('biz',change);const r=f.run();assert.equal(r.ok,false);assert.notEqual(r.nodes[0]?.effectiveState,'done');assert.ok(!codes(r).includes('MALFORMED_WORKSPACE'));
  }
});
test('asset bytes, traversal and platform-specific absolute paths fail closed',t=>{
  for(const assetPath of ['../secret','/etc/passwd','C:\\private\\secret','C:relative','nested/../../secret','https://host/file','missing.png']){
    const f=fixture(t);f.node('biz');f.done('biz',{assets:[{path:assetPath,sha256:'a'.repeat(64)}]});assert.equal(f.run().ok,false);
  }
  const f=fixture(t);f.node('biz');f.write('biz/evidence/check/proof.txt','actual');f.done('biz',{assets:[{path:'proof.txt',sha256:sha256('changed')}]});assert.ok(codes(f.run()).includes('ASSET_HASH'));
});
test('plaintext known secret fields are rejected without leaking values in results',t=>{
  const f=fixture(t);f.node('biz');f.write('_resources/identities/test/resource.yaml',{schema:'work/resource@1',id:'identity',kind:'identity',owner:'test',revision:'1',details:{password:'DO-NOT-PRINT-THIS'}});
  const r=f.run();assert.ok(codes(r).includes('PLAINTEXT_SECRET'));assert.ok(!JSON.stringify(r).includes('DO-NOT-PRINT-THIS'));
});
test('missing resources, duplicate identities and circular refs fail closed',t=>{
  const f=fixture(t);f.node('a',{refs:['absent'],dependsOn:['b']});f.node('b',{dependsOn:['a']});f.node('duplicate',{id:'a'});
  const c=codes(f.run());for(const code of ['MISSING_REF','DUPLICATE_ID','CYCLE'])assert.ok(c.includes(code));
});
test('local scratch is ignored and never promoted as canonical evidence',t=>{
  const f=fixture(t);f.node('biz');f.write('_local/cache/node.md','malformed scratch');assert.equal(f.run().ok,true);
  f.done('biz',{assets:[{path:'../../../_local/cache/node.md',sha256:sha256('malformed scratch')}]});assert.equal(f.run().ok,false);
});
test('one evidence bundle supports explicitly bound leaves without copying assets',t=>{
  const f=fixture(t);f.node('flow/a');f.node('flow/b');f.node('flow/unbound');
  const initial=f.run();const da=initial.nodes.find(n=>n.id==='flow.a').inputDigest, db=initial.nodes.find(n=>n.id==='flow.b').inputDigest;
  const proof={schema:'work/evidence@1',id:'shared-proof',nodeId:'flow.a',inputDigest:da,bindings:[{nodeId:'flow.b',inputDigest:db}],outcome:'pass',assertions:[{id:'synthetic-check',outcome:'pass',observation:'Synthetic shared run, not product acceptance.'}],assets:[]};
  f.write('flow/evidence/shared/manifest.yaml',proof);
  for(const [p,d]of [['flow/a',da],['flow/b',db]])f.node(p,{...f.metas.get(p),state:'done',completion:{inputDigest:d,evidence:['shared-proof']}});
  assert.equal(f.run().ok,true);
  const du=f.run().nodes.find(n=>n.id==='flow.unbound').inputDigest;
  f.node('flow/unbound',{...f.metas.get('flow/unbound'),state:'done',completion:{inputDigest:du,evidence:['shared-proof']}});
  assert.ok(codes(f.run()).includes('EVIDENCE_OWNER'));
  f.node('flow/unbound',{state:'todo'});
  f.node('flow/b',{...f.metas.get('flow/b'),extensions:{changed:true}});
  const changed=f.run();assert.equal(changed.nodes.find(n=>n.id==='flow.b').effectiveState,'suspended');assert.equal(changed.nodes.find(n=>n.id==='flow.a').effectiveState,'done');
});
test('shared bundle refuses duplicate and malformed binding targets',t=>{
  for(const bindings of [[{nodeId:'biz',inputDigest:'a'.repeat(64)}],[{nodeId:'missing',inputDigest:'a'.repeat(64)}],[null]]){
    const f=fixture(t);f.node('biz');f.done('biz',{bindings});const r=f.run();assert.equal(r.ok,false);assert.ok(!codes(r).includes('MALFORMED_WORKSPACE'));
  }
});
test('misspelled dependency and nested reserved keys cannot silently certify done',t=>{
  const f=fixture(t);f.node('prerequisite');f.node('consumer',{dependOn:['prerequisite']});f.done('consumer');
  const r=f.run();assert.ok(codes(r).includes('UNKNOWN_FIELD'));assert.equal(r.nodes.find(n=>n.id==='consumer').effectiveState,'invalid');assert.equal(r.nodes.find(n=>n.id==='consumer').eligible,false);
  const g=fixture(t);g.node('consumer');g.done('consumer');const m=g.metas.get('consumer');g.node('consumer',{...m,completion:{...m.completion,evidences:['ignored-proof']}});
  assert.ok(codes(g.run()).includes('UNKNOWN_FIELD'));
});
test('arbitrary extension namespaces and resource details remain preserved and hashed',t=>{
  const f=fixture(t);const extensions={'vendor.future':{arbitrary:{dependOn:'data, not an instruction'},list:[1,2]}};
  f.node('biz',{extensions,refs:['custom-resource']});f.write('_resources/custom/resource.yaml',{schema:'work/resource@1',id:'custom-resource',kind:'future-kind',owner:'test',revision:'1',details:{custom:{shape:['future',true]}},extensions});
  f.done('biz');const before=fs.readFileSync(path.join(f.root,'biz/node.md'),'utf8');const r=f.run();assert.equal(r.ok,true);assert.equal(fs.readFileSync(path.join(f.root,'biz/node.md'),'utf8'),before);
  f.node('biz',{...f.metas.get('biz'),extensions:{...extensions,anotherNamespace:{newValue:1}}});assert.equal(f.run().nodes[0].effectiveState,'suspended');
});
test('workspace plaintext credential fields are rejected without printing values',t=>{
  const f=fixture(t);f.node('biz');f.write('workspace.yaml',{schema:'work/workspace@1',id:'test-workspace',extensions:{vault:{password:'DO-NOT-ECHO-WORKSPACE-SECRET'}}});
  const r=f.run();assert.ok(codes(r).includes('PLAINTEXT_SECRET'));assert.ok(!JSON.stringify(r).includes('DO-NOT-ECHO-WORKSPACE-SECRET'));assert.equal(r.nodes[0].eligible,false);
});
test('artifact directories cannot smuggle completion nodes into the tree',t=>{
  for(const p of ['biz/evidence/run/hidden','biz/assets/hidden','_resources/custom/hidden','biz/EVIDENCE/run/hidden']) {
    const f=fixture(t);f.node('biz');f.node(p,{id:'smuggled',state:'na',naReason:'fake artifact completion'});
    const r=f.run();assert.ok(codes(r).includes('LAYOUT'));assert.ok(!r.nodes.some(n=>n.id==='smuggled'));assert.equal(r.nodes[0].effectiveState,'invalid');
  }
});
test('changing reasoned NA scope invalidates dependent proof while bare state does not change digest',t=>{
  const f=fixture(t);f.node('applicability',{state:'na',naReason:'No regulated records are processed.'});f.node('consumer',{refs:['applicability']});f.done('consumer');
  assert.equal(f.run().ok,true);const before=f.run().nodes.find(n=>n.id==='consumer').inputDigest;
  f.node('applicability',{...f.metas.get('applicability'),state:'todo'});
  const stateOnly=f.run();assert.equal(stateOnly.nodes.find(n=>n.id==='consumer').inputDigest,before);assert.equal(stateOnly.nodes.find(n=>n.id==='consumer').effectiveState,'done');
  f.node('applicability',{...f.metas.get('applicability'),state:'na',naReason:'Regulated records are handled by an external service.'});
  const changed=f.run();assert.notEqual(changed.nodes.find(n=>n.id==='consumer').inputDigest,before);assert.equal(changed.nodes.find(n=>n.id==='consumer').effectiveState,'suspended');
});
test('goal refs its requirements subtree while sibling implementation depends on requirements without a false cycle',t=>{
  const f=fixture(t);
  f.write('goal/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'goal',kind:'business',required:true,refs:['requirements']})}\n---\nDeliver the bounded business goal.`);
  f.write('goal/business/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'requirements',kind:'business',required:true})}\n---\nApproved requirement set.`);
  f.write('_resources/repositories/backend/resource.yaml',{schema:'work/resource@1',id:'backend',kind:'repository',owner:'test',revision:'1',details:{scope:'Synthetic repository binding; no Git object claim.'}});
  f.node('goal/business/fr',{id:'functional-requirement'});f.node('goal/business/nfr',{id:'nonfunctional-requirement',state:'na',naReason:'Synthetic baseline has no availability obligation.'});
  f.node('goal/implementation',{kind:'implementation',refs:['backend'],dependsOn:['functional-requirement']});
  f.done('goal/business/fr');const codeRefs=[{repository:'backend',commit:'a'.repeat(40)}];f.done('goal/implementation',{codeRefs});
  const m=f.metas.get('goal/implementation');f.node('goal/implementation',{...m,completion:{...m.completion,codeRefs}});
  const before=f.run();assert.equal(before.ok,true,JSON.stringify(before.errors));assert.equal(before.nodes.find(n=>n.id==='goal.implementation').effectiveState,'done');
  // This sibling is not in implementation.dependsOn: the inherited group ref
  // must still bind it, without making the functional leaf depend on itself.
  f.node('goal/business/nfr',{...f.metas.get('goal/business/nfr'),naReason:'Availability is delegated to a contracted external service.'});
  const changed=f.run();assert.ok(!codes(changed).includes('CYCLE'));assert.equal(changed.nodes.find(n=>n.id==='goal.implementation').effectiveState,'suspended');
});
test('explicit self references and ancestor dependency loops still fail cycle detection',t=>{
  const f=fixture(t);f.node('self',{refs:['self']});assert.ok(codes(f.run()).includes('CYCLE'));
  const g=fixture(t);g.write('goal/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'goal',kind:'business',required:true,dependsOn:['child']})}\n---\nInvalid self-blocking prerequisite.`);g.node('goal/child',{id:'child'});assert.ok(codes(g.run()).includes('CYCLE'));
});
test('module account/chat diamond gates start, suspends on prerequisite regression and never rewrites evidence',t=>{
  const f=fixture(t);f.node('module');f.node('account',{dependsOn:['module']});f.node('permission',{dependsOn:['module']});f.node('chat',{dependsOn:['account','permission']});f.node('unrelated');
  const initial=f.run();assert.deepEqual(initial.nodes.find(n=>n.id==='account').blockedBy,['module']);assert.equal(initial.nodes.find(n=>n.id==='account').eligible,false);
  assert.deepEqual(initial.nodes.find(n=>n.id==='chat').blockedBy,['account','permission']);
  for(const p of ['module','account','permission','chat','unrelated'])f.done(p);
  const before=f.run();assert.equal(before.ok,true);const chat=before.nodes.find(n=>n.id==='chat');const proofBefore=fs.readFileSync(path.join(f.root,'chat/evidence/check/manifest.yaml'));
  f.node('module',{...f.metas.get('module'),state:'todo'});
  const after=f.run();for(const id of ['account','permission','chat']){
    const n=after.nodes.find(n=>n.id===id);assert.equal(n.effectiveState,'suspended');assert.equal(n.state,'done');assert.equal(n.eligible,false);assert.ok(n.suspensionReasons.some(r=>r.code==='PREREQUISITE_NOT_DONE'));
  }
  assert.equal(after.nodes.find(n=>n.id==='chat').inputDigest,chat.inputDigest);assert.equal(after.nodes.find(n=>n.id==='unrelated').effectiveState,'done');assert.deepEqual(fs.readFileSync(path.join(f.root,'chat/evidence/check/manifest.yaml')),proofBefore);
});
test('N/A prerequisites never prove module availability and suspended is not a writable state',t=>{
  const f=fixture(t);f.node('module',{state:'na',naReason:'Module is explicitly out of scope.'});f.node('account',{dependsOn:['module'],state:'doing'});
  assert.deepEqual(f.run().nodes.find(n=>n.id==='account').blockedBy,['module']);assert.equal(f.run().nodes.find(n=>n.id==='account').eligible,false);
  f.done('account');assert.equal(f.run().nodes.find(n=>n.id==='account').effectiveState,'suspended');
  f.node('forged',{state:'suspended'});assert.ok(codes(f.run()).includes('STATE'));
});
test('semantic refs propagate business changes through architecture/code/UAT but do not impose execution gates',t=>{
  const f=fixture(t);f.node('business');f.node('architecture',{refs:['business']});f.node('code',{refs:['architecture']});f.node('uat',{refs:['code']});f.node('unrelated');
  // A semantic ref is deliberately not a prerequisite: consumers can be
  // structurally bound while the referenced spec remains todo.
  for(const p of ['architecture','code','uat','unrelated'])f.done(p);
  assert.equal(f.run().ok,true);const old=f.run().nodes.find(n=>n.id==='uat').inputDigest;
  f.node('business',{extensions:{approvedChange:'A new business constraint'}});
  const r=f.run();for(const id of ['architecture','code','uat']){const n=r.nodes.find(n=>n.id===id);assert.equal(n.effectiveState,'suspended');assert.equal(n.eligible,true);assert.deepEqual(n.blockedBy,[]);}
  assert.notEqual(r.nodes.find(n=>n.id==='uat').inputDigest,old);assert.equal(r.nodes.find(n=>n.id==='unrelated').effectiveState,'done');
  const impacted=impactWorkspace(f.root,'business').affected.map(n=>n.id);assert.deepEqual(impacted,['architecture','code','uat']);
});
test('actual design source bytes suspend only linked UI consumers without a revision bump',t=>{
  const f=fixture(t);const resource={schema:'work/resource@1',id:'design',kind:'design',owner:'test',revision:'1',details:{purpose:'Synthetic design file'},files:[{path:'reference.svg'}]};
  f.write('_resources/design/page/resource.yaml',resource);f.write('_resources/design/page/reference.svg','<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>');
  f.write('feature/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'feature',kind:'group',required:true})}\n---\nSynthetic delivery scope.`);
  f.node('feature/ui',{refs:['design']});f.node('feature/uat',{refs:['feature.ui']});f.node('feature/backend');
  for(const p of ['feature/ui','feature/uat','feature/backend'])f.done(p);
  const before=f.run();assert.equal(before.ok,true);const metaBytes=fs.readFileSync(path.join(f.root,'_resources/design/page/resource.yaml'));
  f.write('_resources/design/page/reference.svg','<svg xmlns="http://www.w3.org/2000/svg"><rect fill="blue"/></svg>');
  const after=f.run();assert.equal(after.nodes.find(n=>n.id==='feature.ui').effectiveState,'suspended');assert.equal(after.nodes.find(n=>n.id==='feature.uat').effectiveState,'suspended');assert.equal(after.nodes.find(n=>n.id==='feature.backend').effectiveState,'done');
  assert.notEqual(after.resources[0].specDigest,before.resources[0].specDigest);assert.deepEqual(fs.readFileSync(path.join(f.root,'_resources/design/page/resource.yaml')),metaBytes);
  const impact=impactWorkspace(f.root,'design');assert.deepEqual(impact.affected.map(n=>n.id),['feature','feature.uat','feature.ui']);assert.ok(impact.affected.find(n=>n.id==='feature').reasons.includes('child-input'));
  assert.ok(!impact.affected.some(n=>n.id==='feature.backend'));
});
test('resource file safety rejects missing/traversal/absolute/duplicate/symlink paths',t=>{
  for(const files of [[{path:'missing.svg'}],[{path:'../escape'}],[{path:'C:\\private\\image.png'}],[{path:'https://host/image.png'}],[{path:'safe.svg'},{path:'safe.svg'}]]){
    const f=fixture(t);f.node('ui',{refs:['design']});f.write('_resources/design/page/resource.yaml',{schema:'work/resource@1',id:'design',kind:'design',owner:'test',revision:'1',details:{},files});f.write('_resources/design/page/safe.svg','synthetic');assert.equal(f.run().ok,false);
  }
  const f=fixture(t);f.node('ui',{refs:['design']});f.write('_resources/design/page/resource.yaml',{schema:'work/resource@1',id:'design',kind:'design',owner:'test',revision:'1',details:{},files:[{path:'link/secret.svg'}]});f.write('outside/secret.svg','synthetic');
  fs.symlinkSync(path.join(f.root,'outside'),path.join(f.root,'_resources/design/page/link'),'junction');const r=f.run();assert.ok(codes(r).includes('RESOURCE_FILE_UNREADABLE'));assert.ok(codes(r).includes('SYMLINK'));
});
test('unreferenced valid resource edits do not invalidate unrelated completion',t=>{
  const f=fixture(t);f.node('backend');f.write('_resources/design/page/resource.yaml',{schema:'work/resource@1',id:'design',kind:'design',owner:'test',revision:'1',details:{},files:[{path:'image.svg'}]});f.write('_resources/design/page/image.svg','old');f.done('backend');const before=f.run().nodes[0].inputDigest;
  f.write('_resources/design/page/image.svg','new');assert.equal(f.run().nodes[0].inputDigest,before);assert.equal(f.run().ok,true);assert.deepEqual(impactWorkspace(f.root,'design').affected,[]);
});
test('impact distinguishes ancestor spec changes from child-input rollup and is read-only',t=>{
  const f=fixture(t);f.write('group/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'group',kind:'group',required:true})}\n---\nSynthetic shared scope.`);f.node('group/a');f.node('group/b');f.node('external',{refs:['group.a']});
  const before=fs.readFileSync(path.join(f.root,'group/node.md'));
  const leafImpact=impactWorkspace(f.root,'group.a');assert.deepEqual(leafImpact.affected.map(n=>n.id),['external','group']);assert.ok(!leafImpact.affected.some(n=>n.id==='group.b'));
  const ancestorImpact=impactWorkspace(f.root,'group');assert.deepEqual(ancestorImpact.affected.map(n=>n.id),['external','group.a','group.b']);assert.ok(ancestorImpact.affected.find(n=>n.id==='group.b').reasons.includes('ancestor-spec'));
  assert.deepEqual(fs.readFileSync(path.join(f.root,'group/node.md')),before);assert.equal(impactWorkspace(f.root,'absent').target,null);
});
