import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {selectOperation} from '../ops/select.mjs';
import {outputs} from '../ops/generate.mjs';
import {validateCatalog} from '../ops/validate.mjs';
import {validateGoal} from '../workflows/lifecycle.mjs';

const contract=parseYaml(fs.readFileSync(new URL('../ops/review.verify/operator.yaml',import.meta.url),'utf8'));

test('review-code goals select delivery, stale, or lint contracts without inventing another job',()=>{
  const goal={schema:'starci/goal@1',id:'source-audit',originalRequest:'Inspect source freshness',requestId:'source-request',
    finalOutcome:'A reproducible report for the selected scope',workflow:'review-code',
    scope:{business:['Source freshness'],paths:[],resources:['audit-report'],exclusions:['Source repair']},
    criteria:['measured'],businessChanges:['No product behavior change'],impacts:[],
    resourceEffects:[{target:'audit-report',operation:'write-report',postcondition:'Machine findings retained'}],
    workTargets:['audit-record'],inputs:{request:'Inspect source freshness'},
    cells:[{id:'review-code',op:'review.verify',operation:'delivery',purpose:'Measure inputs',finalOutput:'Audit report',
      criteria:['measured'],outputSchema:{type:'string'},inputs:{request:{from:'request',key:'request'}}}]};
  for(const operation of ['delivery','stales','lint']){
    goal.cells[0].operation=operation;assert.equal(validateGoal(goal).ok,true);
  }
  goal.cells[0].operation='repair';assert.throws(()=>validateGoal(goal),/supported workflow operation/);
});

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
