import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';

const root=path.resolve(import.meta.dirname,'..');
const load=id=>parseYaml(fs.readFileSync(path.join(root,'modules/ops/ops',`${id}.yaml`),'utf8'));
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const prose=value=>JSON.stringify(value);

test('SRS and SDS ops seed only the selected decision-complete slice and refine from evidence',()=>{
  const business=prose(load('business.decide'));
  assert.match(business,/minimum complete observable behavior/);
  assert.match(business,/smallest decision-complete contract/);
  assert.match(business,/state todo while implementation, test\/E2E or UAT evidence is still open/);
  assert.match(business,/passing business\.decide job means the current SRS seed is reviewed/);
  assert.match(business,/Work state done is reserved for final reconciliation/);
  assert.match(business,/implementation feedback as evidence/);
  assert.match(business,/speculative completeness/);
  assert.doesNotMatch(business,/reviewed SRS leaf may be done/);

  const architecture=prose(load('architecture.decide'));
  assert.match(architecture,/minimum complete flow-led/);
  assert.match(architecture,/smallest design-complete map/);
  assert.match(architecture,/selected SDS leaves at state todo while implementation, test\/E2E or UAT evidence is still open/);
  assert.match(architecture,/passing architecture\.decide job means the current SDS seed is reviewed/);
  assert.match(architecture,/Work state done is reserved for final reconciliation/);
  assert.match(architecture,/Classify implementation feedback before revising/);
  assert.match(architecture,/Reversible source-local mechanics/);
  assert.doesNotMatch(architecture,/target repo\/path\/symbol\/signature/);
  assert.doesNotMatch(architecture,/reviewed SDS leaf may be done/);
});

test('Work lifecycle keeps the closed state enum and represents progress through activity',()=>{
  const schema=parseYaml(read('modules/schemas/work.schema.yaml'));
  const v2State=schema.$defs.node.allOf.find(rule=>rule?.if?.properties?.schema?.const==='work/node@2')
    .then.properties.state.enum;
  assert.deepEqual(v2State,['uninvestigate','todo','done']);
  assert.deepEqual(schema.$defs.node.properties.activity.enum,['idle','investigating','implementing','verifying']);

  const doctrine=read('modules/schemas/work-layout.yaml');
  assert.match(doctrine,/todo \+ activity: idle/);
  assert.match(doctrine,/Never add an inprogress state/);
  assert.match(doctrine,/final reconciliation/);
});

test('final delivery verification requires one current full-chain revision',()=>{
  const review=prose(load('review.verify'));
  assert.match(review,/SRS\/SDS\/implementation\/test\/E2E\/UAT/);
  assert.match(review,/same delivery revision/);
  assert.match(review,/DELIVERY_CHAIN_INCOMPLETE/);

  const driver=read('modules/kernel/driver-loop.yaml');
  assert.match(driver,/current reconciliation\s+proving SRS, SDS/);
  const verdict=read('modules/kernel/verdict-contract.yaml');
  assert.match(verdict,/delivery-done-with-incomplete-chain/);
});

test('implementation and verification ops distinguish material spec gaps from local choices',()=>{
  for(const id of ['backend.implement','interface.implement']){
    const contract=prose(load(id));
    assert.match(contract,/Classify implementation feedback before stopping/,id);
    assert.match(contract,/Reversible source-local choices are implementation work/,id);
    assert.match(contract,/smallest proposed delta/,id);
  }

  const refactor=prose(load('code.refactor'));
  assert.match(refactor,/A source-local refactoring choice is not an SRS gap/);
  assert.match(refactor,/private helper choices are owned by this refactor/);

  const tests=prose(load('test.author'));
  assert.match(tests,/REQUIREMENT_UNSETTLED/);
  assert.match(tests,/suite-local mechanics are not spec gaps/);
});
