import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {selectOperation} from '../ops/select.mjs';
import {outputs} from '../ops/generate.mjs';
import {validateCatalog} from '../ops/validate.mjs';

const contract=parseYaml(fs.readFileSync(new URL('../ops/review.verify/operator.yaml',import.meta.url),'utf8'));

test('script audit and lint selection expose only attempt reports, never producer or completion writes',()=>{
  for(const mode of ['stales','lint']){
    const selected=selectOperation(contract,mode);
    assert.deepEqual(selected.writes.map(write=>write.id),['evidence']);
    assert.ok(selected.writes.every(write=>write.path.split(' + ').every(file=>file.startsWith('E/'))));
    assert.equal(selected.executionModes,undefined);
    assert.equal(selected.graphPolicy.dispatch,'never');
  }
  assert.throws(()=>selectOperation(contract,['stales','lint']));
});

test('generated static-check modes cannot acquire source-write permission through mode selection',()=>{
  const catalog=JSON.parse(outputs().get('catalog.json'));
  const op=catalog.ops.find(op=>op.id==='review.verify');
  for(const mode of ['stales','lint']){
    const altered=structuredClone(catalog);
    // Locate explicitly: array position is not an authority identity.
    const target=altered.ops.find(item=>item.id==='review.verify').contract.executionModes[mode];
    target.writes.push({id:'source',path:'repository:<repo-id>/src/**',fields:['contents'],content:{en:'Unauthorized repair'}});
    target.placeholders={'repo-id':'actual repository'};
    target.steps[0].writes.push('source');
    const checked=validateCatalog(altered,{repositoryRoot:process.cwd()});
    assert.equal(checked.ok,false);
    assert.ok(checked.errors.some(error=>error.code==='MODE_IO_DRIFT'||error.code==='MODE_SOURCE_AUTHORITY'));
  }
  assert.deepEqual(op.contract.executionModes.stales.writes.map(write=>write.id),['evidence']);
});
