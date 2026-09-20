import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalJSON,sha256,validateWorkspace,impactWorkspace} from '../engine/index.mjs';

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

/**
 * A migration writes the typed reconciliation and the declared integrations onto a decided module record. Those
 * two are the kernel's reading of the record's relations, not decided content, so the digest leaves them out:
 * every completion beneath the module stays bound. Any other change to the module still stales its children.
 */
test('the reconciliation and integration declarations of a module record are outside the semantic digest, so a migration stales nothing beneath it',t=>{
  const f=fixture(t);
  f.node('feat',{state:'todo'});
  f.node('feat/leaf',{state:'todo'});
  f.done('feat/leaf');
  assert.equal(codes(f.run()).includes('STALE_COMPLETION'),false,'the leaf is bound to its inputs');
  const module=f.metas.get('feat');
  f.node('feat',{...module,extensions:{work3:{reconciliation:[{case:'reference',record:'other.business.overview',decision:null,reads:[],hands:[],detail:'cited'}],
    integrations:[{id:'telegram',provider:'telegram-bot-api',credential:{name:'TELEGRAM_BOT_TOKEN',providedBy:'owner',custody:'identity:telegram'}}]}}});
  assert.equal(codes(f.run()).includes('STALE_COMPLETION'),false,'declaring the relations of the module changes no completion beneath it');
  // A decided statement of the module is still semantic: changing it stales the leaf.
  f.node('feat',{...f.metas.get('feat'),assertions:['synthetic-check','one-more']});
  assert.ok(codes(f.run()).includes('STALE_COMPLETION'),'a real change to the module stales its children');
});

/**
 * A question put to the owner is not yet a requirement. An open policy decision written beside a decided branch
 * changes no digest and no rollup - the branch stays done and its dependents stay bound - and only its answer
 * (state done) makes it part of the requirement everything downstream is re-verified against.
 */
test('an open policy decision beside a decided branch binds nothing and derives nothing until it is decided',t=>{
  const f=fixture(t);
  // A branch stores no state of its own: it derives one from its children.
  f.node('feat',{state:undefined});
  f.node('feat/leaf',{state:'todo'});
  f.done('feat/leaf');
  f.node('client',{state:'todo',dependsOn:['feat']});
  f.done('client');
  const before=f.run();
  assert.equal(before.nodes.find(n=>n.id==='feat').effectiveState,'done');
  assert.equal(codes(before).includes('STALE_COMPLETION'),false);
  const featDigest=before.nodes.find(n=>n.id==='feat').inputDigest;
  f.node('feat/d-open',{state:'todo',extensions:{work3:{srs:{schema:'starci/srs-policy-decision@1',decisionStatus:'open',id:'D-OPEN'}}}});
  const open=f.run();
  assert.equal(open.nodes.find(n=>n.id==='feat').effectiveState,'done','an open decision does not un-do the branch');
  assert.equal(open.nodes.find(n=>n.id==='feat').inputDigest,featDigest,'an open decision is not an input of the branch');
  assert.equal(codes(open).includes('STALE_COMPLETION'),false);
  assert.equal(codes(open).includes('DEPENDENCY_NOT_DONE'),false,'a dependent of the branch is still satisfied');
  assert.ok(open.warnings.some(w=>w.code==='OPEN_DECISION'),'the open decision is visible as a warning');
  f.done('feat/d-open');
  const decided=f.run();
  assert.notEqual(decided.nodes.find(n=>n.id==='feat').inputDigest,featDigest,'the answer is part of the requirement');
  assert.ok(codes(decided).includes('STALE_COMPLETION'),'what rested on the requirement is re-verified');
});

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
/**
 * An external integration is a node kind of its own, with a completion profile of its own: assertions, no
 * code binding and no capture. Its evidence says what it was proven against, which is the whole point of
 * the kind - a manifest with `proof: {boundary: live, fakes: []}` must validate, and so must the
 * `boundary: api` form an e2e run writes when it names the providers it faked.
 */
test('an integration node completes on its own profile and its evidence may declare the boundary it proved',t=>{
  const f=fixture(t);
  f.node('checkout-telegram',{kind:'integration'});
  f.done('checkout-telegram',{proof:{boundary:'live',fakes:[]}});
  const r=f.run();
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.ok(!codes(r).includes('UNSUPPORTED_PROFILE'),'`integration` is a published completion profile');
  assert.equal(r.nodes.find(n=>n.id==='checkout-telegram').effectiveState,'done');
  assert.ok(!r.warnings.some(w=>w.code==='UNSUPPORTED_PROFILE'));

  // The api form, with the providers a run faked, is equally valid; an invented boundary is not.
  const api=fixture(t);api.node('checkout-api',{kind:'e2e'});api.done('checkout-api',{proof:{boundary:'api',fakes:['telegram-bot-api']}});
  assert.equal(api.run().ok,true);
  const bogus=fixture(t);bogus.node('checkout-bogus',{kind:'e2e'});bogus.done('checkout-bogus',{proof:{boundary:'recorded'}});
  assert.ok(codes(bogus.run()).includes('SCHEMA_VALUE'),'`recorded` is not one of the two boundaries a proof may claim');
  const unknown=fixture(t);unknown.node('checkout-unknown',{kind:'e2e'});unknown.done('checkout-unknown',{proof:{boundary:'live',mocked:['x']}});
  assert.ok(codes(unknown.run()).includes('UNKNOWN_FIELD'),'a proof names its fakes under `fakes` or not at all');
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
  // kernel-strays is the runtime custody dir the rule exercises.
  const f=fixture(t);f.node('biz');f.write('kernel-strays/cache/node.md','malformed scratch');assert.equal(f.run().ok,true);
  f.done('biz',{assets:[{path:'../../../kernel-strays/cache/node.md',sha256:sha256('malformed scratch')}]});assert.equal(f.run().ok,false);
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
    const r=f.run();assert.ok(!r.nodes.some(n=>n.id==='smuggled'));
    if(p.startsWith('biz/assets/')){assert.ok(r.ok);assert.equal(r.nodes[0].effectiveState,'todo');}
    else {assert.ok(codes(r).includes('LAYOUT'));assert.equal(r.nodes[0].effectiveState,'invalid');}
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
test('N/A prerequisites never prove module availability and authored suspended needs a concrete reason',t=>{
  const f=fixture(t);f.node('module',{state:'na',naReason:'Module is explicitly out of scope.'});f.node('account',{dependsOn:['module'],state:'doing'});
  assert.deepEqual(f.run().nodes.find(n=>n.id==='account').blockedBy,['module']);assert.equal(f.run().nodes.find(n=>n.id==='account').eligible,false);
  f.done('account');assert.equal(f.run().nodes.find(n=>n.id==='account').effectiveState,'suspended');
  f.node('forged',{state:'suspended'});assert.ok(codes(f.run()).includes('SUSPENSION_REASON'));
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
test('source-imported suspended scope needs no fabricated prior done or evidence and never satisfies prerequisites',t=>{
  const f=fixture(t);f.node('imported-business',{state:'suspended',suspensionReason:'Inferred from inspected source; business owner has not approved the requirements.'});f.node('implementation',{dependsOn:['imported-business']});
  const before=fs.readFileSync(path.join(f.root,'imported-business/node.md'));const r=f.run();assert.equal(r.ok,true);
  const imported=r.nodes.find(n=>n.id==='imported-business');assert.equal(imported.state,'suspended');assert.equal(imported.effectiveState,'suspended');assert.ok(imported.suspensionReasons.some(reason=>reason.code==='DECLARED_SUSPENSION'));
  assert.equal(f.metas.get('imported-business').completion,undefined);assert.equal(fs.existsSync(path.join(f.root,'imported-business/evidence')),false);assert.deepEqual(fs.readFileSync(path.join(f.root,'imported-business/node.md')),before);
  const consumer=r.nodes.find(n=>n.id==='implementation');assert.equal(consumer.eligible,false);assert.deepEqual(consumer.blockedBy,['imported-business']);
});
test('authored suspension reason is operational, missing/blank reason fails, and fake done still needs proof',t=>{
  const f=fixture(t);f.node('imported',{state:'suspended',suspensionReason:'Source-derived inventory awaits requirement review.'});const before=f.run().nodes[0].inputDigest;
  f.node('imported',{...f.metas.get('imported'),suspensionReason:'Scope review remains outstanding; no acceptance claimed.'});assert.equal(f.run().nodes[0].inputDigest,before);
  f.node('imported',{...f.metas.get('imported'),suspensionReason:'   '});assert.ok(codes(f.run()).includes('SUSPENSION_REASON'));assert.equal(f.run().nodes[0].effectiveState,'invalid');
  f.node('imported',{...f.metas.get('imported'),state:'done'});assert.ok(codes(f.run()).includes('COMPLETION'));assert.equal(f.run().nodes[0].effectiveState,'invalid');
});

test('canonical v2 accepts typed encrypted identity custody at root _resources without changing payload bytes',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'work-custody-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(file,bytes)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);};
  write('workspace.yaml','schema: work/workspace@1\nid: custody-fixture\n');
  write('features/index.yaml','schema: work/node@2\nid: features\nkind: business\nrequired: true\nstate: todo\nassertions:\n  - synthetic-custody-contract\ndescription: Synthetic feature catalog.\n');
  write('_resources/identity/service/resource.yaml',
    'schema: work/resource@1\nid: identity:service\nkind: identity\nowner: test-owner\nrevision: "1"\ndetails:\n  custody: sops\n');
  const encrypted=Buffer.from('sops:\n  version: 3.9.0\nservice_token: ENC[AES256_GCM,data:opaque-fixture,iv:fixture,tag:fixture,type:str]\n','utf8');
  write('_resources/identity/service/secrets.enc.yaml',encrypted);
  const before=fs.readFileSync(path.join(root,'_resources','identity','service','secrets.enc.yaml'));
  const result=validateWorkspace(root);
  assert.equal(result.ok,true,JSON.stringify(result.errors));
  assert.deepEqual(result.resources.map(item=>[item.id,item.path,item.kind]),[['identity:service','_resources/identity/service/resource.yaml','identity']]);
  assert.deepEqual(fs.readFileSync(path.join(root,'_resources','identity','service','secrets.enc.yaml')),before);
  assert.equal(JSON.stringify(result).includes('opaque-fixture'),false,'validation never exposes encrypted payload bytes');
});

// --------------------------------------------------------------------------- the product brand
// One record at the tree root, decided by its owner, that every frontend-facing node binds. Synthetic
// names only: no product brand, no real token file and no claimed design review.
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4MsAAAAASUVORK5CYII=','base64');

function brandRecord({rev='1',primary='"#c0203c"',danger='"#c0203c"',dangerMayMatchPrimary='true',mascot='brand/assets/mascot/rest.png',sources=true}={}) {
  return `schema: work/node@2
id: product.brand
kind: brand
required: true
state: todo
assertions:
  - brand-tokens-match-source
assets:
  - path: assets/mascot/rest.png
    description: Mascot master at rest.
brand:
  rev: "${rev}"
  identity:
    name: Example Product
    family: starci
    owner: Product owner
  color:
    tokens:
      - token: --example-core-primary
        value: ${primary}
        foreground: "#ffffff"
        role: primary
      - token: --example-core-danger
        value: ${danger}
        role: danger
        note: The brand decides whether danger carries the primary value.
    policy:
      dangerMayMatchPrimary: ${dangerMayMatchPrimary}
  typography:
    family: Example Sans, system-ui, sans-serif
  mascot:
    name: Example Mascot
    component: ExampleMascot
    assets:
      - path: ${mascot}
        purpose: Resting pose for empty states.
    allowedIn:
      - Empty states
    forbiddenIn:
      - Destructive confirmations
    rules:
      - Render the grammar leaf; never redraw the artwork.
  iconography:
    set:
      - "@example/icons"
  imagery:
    style:
      - Warm studio light on a plain ground.
  forbidden:
    - Never recolour the mascot.
${sources?`  sources:
    - repository: example-frontend
      path: src/app/globals.css
      kind: css
`:'  sources: []\n'}`;
}
const uiNode=(state='todo',trailer='')=>`schema: work/node@2
id: sales.ui
kind: ui
required: true
state: ${state}
assertions:
  - ui-quality
description: Sales surfaces and the states they reach.
${trailer}`;
const leaf=(id,kind)=>`schema: work/node@2
id: ${id}
kind: ${kind}
required: true
state: todo
assertions:
  - synthetic-check
description: Synthetic ${kind} scope for the brand binding fixture.
`;

function brandFixture(t,record=brandRecord()) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'work-brand-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(p,value)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  write('workspace.yaml','schema: work/workspace@1\nid: brand-fixture\n');
  write('brand/assets/mascot/rest.png',PNG);
  write('brand/index.yaml',record);
  write('features/index.yaml','schema: work/node@2\nid: features\nkind: business\nrequired: true\ndescription: Product catalog.\n');
  write('features/sales/index.yaml','schema: work/node@2\nid: sales\nkind: business\nrequired: true\ndescription: Sales feature.\n');
  write('features/sales/ui/index.yaml',uiNode());
  write('features/sales/implementation/frontend/cart/index.yaml',leaf('sales.impl.fe.cart','implementation'));
  write('features/sales/implementation/backend/cart/index.yaml',leaf('sales.impl.be.cart','implementation'));
  return {root,write,run:()=>validateWorkspace(root),digestOf:id=>validateWorkspace(root).nodes.find(n=>n.id===id).inputDigest};
}

test('one brand record at the tree root is bound by every frontend-facing node and by nothing else',t=>{
  const f=brandFixture(t);
  const r=f.run();
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(r.brand.id,'product.brand');
  assert.equal(r.brand.path,'brand/index.yaml');
  assert.equal(r.brand.rev,'1');
  assert.match(r.brand.digest,/^[a-f0-9]{64}$/);
  assert.deepEqual(r.brand.boundNodes,['sales.impl.fe.cart','sales.ui']);
  const by=id=>r.nodes.find(n=>n.id===id);
  assert.deepEqual(by('sales.ui').brand,{id:'product.brand',rev:'1',digest:r.brand.digest});
  assert.deepEqual(by('sales.impl.fe.cart').brand,{id:'product.brand',rev:'1',digest:r.brand.digest});
  assert.equal(by('sales.impl.be.cart').brand,null,'backend work does not wear the brand');
  assert.equal(by('product.brand').brand,null,'the brand does not bind itself');
});

test('a node that names the brand in refs binds it even outside a frontend layout',t=>{
  const f=brandFixture(t);
  f.write('features/sales/implementation/backend/cart/index.yaml',`${leaf('sales.impl.be.cart','implementation')}refs:\n  - product.brand\n`);
  const r=f.run();
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(r.nodes.find(n=>n.id==='sales.impl.be.cart').brand.id,'product.brand');
  assert.ok(r.brand.boundNodes.includes('sales.impl.be.cart'));
});

test('a brand whose colour, masters, sources or rev cannot be read by a machine is refused',t=>{
  const f=brandFixture(t,brandRecord({rev:'',primary:'crimson',mascot:'assets/mascot/rest.png',sources:false}));
  const c=codes(f.run());
  for(const code of ['BRAND_REV','BRAND_COLOR','BRAND_ASSET_PATH','BRAND_SOURCES'])assert.ok(c.includes(code),`${code}: ${JSON.stringify(c)}`);
  const g=brandFixture(t,brandRecord({dangerMayMatchPrimary:'false'}));
  assert.ok(codes(g.run()).includes('BRAND_POLICY'),'an undecided danger/primary collision is not a silent grammar override');
  const h=brandFixture(t,brandRecord({mascot:'brand/assets/mascot/absent.png'}));
  assert.ok(codes(h.run()).includes('BRAND_ASSET_BINDING'),'a master outside the node assets binds no bytes');
});

test('a second brand and a brand outside the tree root leave no canonical record',t=>{
  const f=brandFixture(t);
  f.write('features/sales/brand/index.yaml',brandRecord().replace('id: product.brand','id: sales.brand'));
  const two=f.run();
  assert.equal(two.ok,false);
  assert.equal(two.brand,null);
  assert.equal(codes(two).filter(code=>code==='BRAND_SINGLETON').length,2,'both claimants are named');
  assert.ok(two.errors.some(e=>e.code==='LAYOUT'&&e.path==='features/sales/brand/index.yaml'));
  const g=brandFixture(t);
  fs.rmSync(path.join(g.root,'brand/index.yaml'));
  g.write('features/sales/brand/index.yaml',brandRecord());
  const moved=g.run();
  assert.equal(moved.ok,false);
  assert.equal(moved.brand,null,'a brand under features is not the product brand');
  assert.ok(moved.errors.some(e=>e.code==='LAYOUT'&&e.path==='features/sales/brand/index.yaml'));
  const h=brandFixture(t);
  h.write('features/sales/ui/index.yaml',`${uiNode()}brand:\n  rev: "1"\n`);
  assert.ok(codes(h.run()).includes('MODULE_SPEC_OWNER'),'a ui node cannot author a brand of its own');
});

test('a brand rev or colour change suspends a completed UI node and leaves backend work alone',t=>{
  const f=brandFixture(t);
  f.write('features/sales/ui/evidence/current/capture.png',PNG);
  const bound=f.digestOf('sales.ui');
  f.write('features/sales/ui/evidence/current/manifest.yaml',`schema: work/evidence@1
id: sales.ui.proof
nodeId: sales.ui
inputDigest: ${bound}
outcome: pass
assertions:
  - id: ui-quality
    outcome: pass
    observation: Synthetic fixture observation from the unit harness, not product proof.
assets:
  - path: capture.png
    sha256: ${sha256(PNG)}
`);
  f.write('features/sales/ui/index.yaml',uiNode('done',`completion:\n  inputDigest: ${bound}\n  evidence:\n    - sales.ui.proof\n`));
  let r=f.run();
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(r.nodes.find(n=>n.id==='sales.ui').effectiveState,'done');
  const backend=r.nodes.find(n=>n.id==='sales.impl.be.cart').inputDigest;

  f.write('brand/index.yaml',brandRecord({rev:'2'}));
  r=f.run();
  assert.ok(codes(r).includes('STALE_COMPLETION'));
  const stale=r.nodes.find(n=>n.id==='sales.ui');
  assert.notEqual(stale.inputDigest,bound);
  assert.equal(stale.effectiveState,'uninvestigate','a v2 node whose inputs moved is no longer investigated');
  assert.ok(stale.suspensionReasons.some(reason=>reason.code==='INPUT_CHANGED'));
  assert.equal(stale.brand.rev,'2');
  assert.equal(r.nodes.find(n=>n.id==='sales.impl.be.cart').inputDigest,backend,'backend work is untouched by a brand revision');

  f.write('brand/index.yaml',brandRecord({primary:'"oklch(0.55 0.18 18)"'}));
  const recoloured=f.run().nodes.find(n=>n.id==='sales.ui');
  assert.notEqual(recoloured.inputDigest,bound,'a changed value invalidates even at the same rev');
  assert.equal(recoloured.effectiveState,'uninvestigate');
});

test('a brand is decided by a review of its assertions, never by an execution receipt',t=>{
  const f=brandFixture(t);
  const bound=f.digestOf('product.brand');
  const review=`completion:
  inputDigest: ${bound}
  review:
    schema: starci/design-review@1
    reviewer: Product owner
    authority: Synthetic fixture authority; no real review is claimed
    reviewedAt: "2026-09-13T00:00:00.000Z"
    observations:
      - id: brand-tokens-match-source
        outcome: pass
        observation: Every declared token equals the value in the named source file.
    limitations: []
`;
  f.write('brand/index.yaml',`${brandRecord().replace('state: todo','state: done')}${review}`);
  const decided=f.run();
  assert.equal(decided.ok,true,JSON.stringify(decided.errors));
  assert.equal(decided.nodes.find(n=>n.id==='product.brand').effectiveState,'done');
  f.write('brand/index.yaml',`${brandRecord().replace('state: todo','state: done')}completion:\n  inputDigest: ${bound}\n  evidence:\n    - sales.ui.proof\n`);
  assert.ok(codes(f.run()).includes('BRAND_DECISION'));
});

test('a tree with no brand record hashes exactly as it did before the brand existed',t=>{
  const f=brandFixture(t);
  const withBrand=f.digestOf('sales.impl.be.cart');
  fs.rmSync(path.join(f.root,'brand'),{recursive:true,force:true});
  const without=f.run();
  assert.equal(without.ok,true,JSON.stringify(without.errors));
  assert.equal(without.brand,null);
  assert.equal(without.nodes.find(n=>n.id==='sales.impl.be.cart').inputDigest,withBrand,'an unbound node never saw the brand');
  assert.equal(without.nodes.find(n=>n.id==='sales.ui').brand,null);
});

/**
 * One project has one Work tree, owned by the backend and written by the frontend too, so a drawing operation's
 * unrendered images sit in the same tree as every backend proof. A `todo` node's declared asset that is not on
 * disk yet is therefore pending work - a warning, a valid tree, and no bytes in the digest - while the very same
 * absence under a node that is done, where the asset is what the proof rests on, stays an error.
 */
test('a declared asset that has not been drawn yet is pending on a todo node and missing on a done one',t=>{
  const f=fixture(t);
  f.node('ui/screen',{assets:[{path:'assets/desktop.png'}]});
  const pending=f.run();
  assert.equal(pending.ok,true,JSON.stringify(pending.errors));
  assert.deepEqual(pending.warnings.filter(w=>w.code==='NODE_ASSET_PENDING').map(w=>w.path),['ui/screen/node.md']);
  assert.equal(pending.errors.some(e=>e.code==='NODE_ASSET_UNREADABLE'),false);
  const waiting=pending.nodes.find(n=>n.id==='ui.screen').specDigest;

  // The asset lands: it is the node's own input now, so the digest moves, which is what re-verifies anything
  // resting on it. Nothing about the tree was red while it was being drawn.
  f.write('ui/screen/assets/desktop.png','Synthetic render bytes, not an actual screenshot.');
  const drawn=f.run();
  assert.equal(drawn.ok,true,JSON.stringify(drawn.errors));
  assert.equal(drawn.warnings.some(w=>w.code==='NODE_ASSET_PENDING'),false);
  assert.notEqual(drawn.nodes.find(n=>n.id==='ui.screen').specDigest,waiting);

  // The other half: a node that is not `todo` holds every asset it declares. Removing the file the done record
  // was proved against is the error it always was.
  f.done('ui/screen');
  const proved=f.run();
  assert.equal(proved.ok,true,JSON.stringify(proved.errors));
  fs.rmSync(path.join(f.root,'ui/screen/assets/desktop.png'));
  const gone=f.run();
  assert.equal(gone.ok,false);
  assert.deepEqual(gone.errors.filter(e=>e.code==='NODE_ASSET_UNREADABLE').map(e=>e.path),['ui/screen/node.md']);
  assert.equal(gone.warnings.some(w=>w.code==='NODE_ASSET_PENDING'),false);
});
