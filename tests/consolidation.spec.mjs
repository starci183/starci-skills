import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectOperation} from '../ops/select.mjs';
import {validateCatalog} from '../ops/validate.mjs';
import {validateJobMatrices} from '../workflows/matrix.mjs';
const json=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const catalogue=json('../ops/catalog.json');
const registry=json('../ops/registry.json');
const matrices=json('../workflows/jobs.json');
const contract=id=>catalogue.ops.find(o=>o.id===id).contract;

test('fourteen complete jobs replace the old catalogue; twenty-two extras have explicit ownership',()=>{
  assert.equal(catalogue.ops.length,14);
  assert.equal(registry.consolidation.basic.length,6);
  assert.equal(registry.consolidation.supporting.length,8);
  assert.equal(registry.consolidation.mappings.length+registry.consolidation.unchanged.length,22);
  for(const mapping of registry.consolidation.mappings){
    assert.equal(catalogue.ops.some(op=>op.id===mapping.from),false);
    for(const to of mapping.to)assert.ok(catalogue.ops.some(op=>op.id===to));
  }
  for(const id of ['identity.provision','data.plan','data.seed'])assert.equal(catalogue.ops.some(op=>op.id===id),false);
  assert.match(JSON.stringify(contract('uat.verify')),/No plan\/account\/seed predecessor/);
});
test('English-only JSON is the maintained operator source with no runtime mirrors',()=>{
  function inspect(value){if(Array.isArray(value))value.forEach(inspect);else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){assert.notEqual(k,'vi');assert.notEqual(k,'mirror');assert.equal(k.endsWith('Vi'),false);inspect(v);}}
  inspect(catalogue);
  for(const id of registry.ops){const authored=json(`../ops/${id}/operator.json`);assert.equal(authored.id,id);inspect(authored);assert.equal(fs.existsSync(new URL(`../ops/${id}.vi.md`,import.meta.url)),false);}
  const changed=structuredClone(catalogue);changed.ops[0].contract.goal.vi='retired';assert.equal(validateCatalog(changed).ok,false);
});
test('operation selection cannot default, combine permissions or reuse a different completion profile',()=>{
  for(const id of ['workspace.manage','runtime.operate','release.deliver','review.verify']){
    assert.throws(()=>selectOperation(contract(id)));
    assert.throws(()=>selectOperation(contract(id),['publish','deploy']));
    assert.throws(()=>selectOperation(contract(id),'unknown'));
  }
  const inspect=selectOperation(contract('runtime.operate'),'inspect');
  assert.equal(inspect.writes.some(w=>w.id==='source'||w.id==='resource'),false);
  const visual=selectOperation(contract('review.verify'),'visual');
  assert.equal(visual.completionProfile,'uat.ui');
  const api=selectOperation(contract('review.verify'),'api');
  assert.equal(api.completionProfile,'uat.ux');
  assert.notDeepEqual(selectOperation(contract('release.deliver'),'publish').sideEffects,selectOperation(contract('release.deliver'),'deploy').sideEffects);
  const review=selectOperation(contract('review.verify'),'delivery');
  assert.deepEqual(review.sideEffects,[]);
  assert.match(review.steps[0].action.en,/Do not execute gates/);
  assert.throws(()=>selectOperation(contract('backend.implement'),'publish'));
  const changed=structuredClone(catalogue);changed.ops.find(o=>o.id==='release.deliver').contract.modePolicy.permissionUnion=true;
  assert.equal(validateCatalog(changed).ok,false);
});
test('job matrices bind the sixteen bounded jobs and enforce matrix limits and operation modes',()=>{
  assert.deepEqual(validateJobMatrices(matrices,catalogue),{ok:true,errors:[]});
  assert.ok(matrices.workflows.every(w=>w.matrix.length<=3&&w.matrix.every(row=>row.length<=3)));
  const reject=change=>{const next=structuredClone(matrices);change(next);assert.equal(validateJobMatrices(next,catalogue).ok,false);};
  reject(b=>{const w=b.workflows[0];w.matrix=[w.matrix[0],w.matrix[0],w.matrix[0],w.matrix[0]];});
  reject(b=>{const w=b.workflows[0];w.matrix[0]=[w.matrix[0][0],w.matrix[0][0],w.matrix[0][0],w.matrix[0][0]];});
  reject(b=>b.workflows[0].matrix[0][0].inputs.request={parameter:'missing'});
  reject(b=>b.workflows[0].matrix[0][0].op='identity.provision');
  reject(b=>delete b.workflows.find(w=>w.id==='publish-code').matrix[0][0].operation);
  reject(b=>b.workflows[0].transition.advance='any-criterion-pass');
});
