import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalJSON,sha256,validateWorkspace} from './core/index.mjs';

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
  assert.equal(f.run().nodes.find(n=>n.id==='biz.leaf').effectiveState,'stale');
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
  const changed=f.run();assert.equal(changed.nodes.find(n=>n.id==='flow.b').effectiveState,'stale');assert.equal(changed.nodes.find(n=>n.id==='flow.a').effectiveState,'done');
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
  f.node('biz',{...f.metas.get('biz'),extensions:{...extensions,anotherNamespace:{newValue:1}}});assert.equal(f.run().nodes[0].effectiveState,'stale');
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
  const f=fixture(t);f.node('applicability',{state:'na',naReason:'No regulated records are processed.'});f.node('consumer',{dependsOn:['applicability']});f.done('consumer');
  assert.equal(f.run().ok,true);const before=f.run().nodes.find(n=>n.id==='consumer').inputDigest;
  f.node('applicability',{...f.metas.get('applicability'),state:'todo'});
  const stateOnly=f.run();assert.equal(stateOnly.nodes.find(n=>n.id==='consumer').inputDigest,before);assert.equal(stateOnly.nodes.find(n=>n.id==='consumer').effectiveState,'blocked');
  f.node('applicability',{...f.metas.get('applicability'),state:'na',naReason:'Regulated records are handled by an external service.'});
  const changed=f.run();assert.notEqual(changed.nodes.find(n=>n.id==='consumer').inputDigest,before);assert.equal(changed.nodes.find(n=>n.id==='consumer').effectiveState,'stale');
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
  const changed=f.run();assert.ok(!codes(changed).includes('CYCLE'));assert.equal(changed.nodes.find(n=>n.id==='goal.implementation').effectiveState,'stale');
});
test('explicit self references and ancestor dependency loops still fail cycle detection',t=>{
  const f=fixture(t);f.node('self',{refs:['self']});assert.ok(codes(f.run()).includes('CYCLE'));
  const g=fixture(t);g.write('goal/node.md',`---\n${JSON.stringify({schema:'work/node@1',id:'goal',kind:'business',required:true,dependsOn:['child']})}\n---\nInvalid self-blocking prerequisite.`);g.node('goal/child',{id:'child'});assert.ok(codes(g.run()).includes('CYCLE'));
});
