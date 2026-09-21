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
  const v2State=schema.$defs.node.allOf.find(rule=>rule?.if?.properties?.schema?.const==='work/node@1')
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

test('workspace canonicalization test author accepts only its explicitly bound direct-predecessor proposal',()=>{
  const contract=load('test.author');
  assert.equal(contract.graphPolicy.prerequisiteState,'done-or-exact-direct-predecessor-proposal');
  assert.equal(contract.proposalAuthority.scope,'workspace-canonicalization-only');
  const authority=prose(contract.proposalAuthority);
  assert.match(authority,/one scope record explicitly bound in packet context\.records/);
  assert.match(authority,/passed scope\.define output immediately preceding this test\.author leg/);
  assert.match(authority,/proposed id must equal the selected target id/);
  assert.match(authority,/repository-wide discovery/);
  assert.match(authority,/workspace\.manage owns later reconstruction/);

  const target=contract.reads.find(read=>read.id==='target');
  assert.match(target.path,/packet context\.records -> exact bound scope\.define record/);
  assert.match(prose(target),/do not scan \.starciwork for alternatives/);
  assert.match(prose(target),/packet context\.workflow binds the approved goal identity\/revision/);

  const nodeWrite=contract.writes.find(write=>write.id==='node');
  assert.match(prose(nodeWrite),/When proposalAuthority is in use because N does not exist, omit this write entirely/);
  assert.match(prose(nodeWrite),/workspace\.manage to materialize later/);
});

test('workspace canonicalization refactor consumes the same bound proposal only after regression proof',()=>{
  const contract=load('code.refactor');
  assert.equal(contract.graphPolicy.prerequisiteState,'done-or-exact-workspace-canonicalization-proposal-with-regression');
  assert.equal(contract.proposalAuthority.scope,'workspace-canonicalization-only');
  const authority=prose(contract.proposalAuthority);
  assert.match(authority,/one scope\.define record explicitly bound in packet context\.records/);
  assert.match(authority,/after a passed test\.author leg/);
  assert.match(authority,/same covering regression command must run under the applicable refactor or migration proof/);
  assert.match(authority,/repository-wide discovery/);
  assert.match(authority,/workspace\.manage owns later reconstruction/);

  assert.equal(contract.migrationAuthority.scope,'workspace-canonicalization-only');
  const migration=prose(contract.migrationAuthority);
  assert.match(migration,/red before source edits/);
  assert.match(migration,/green after/);
  assert.match(migration,/any unrelated failure blocks before edits/);
  assert.match(migration,/collection-only check/);
  assert.match(contract.refactorPolicy.workspaceCanonicalizationMigration,/red-before-green-after/);

  const target=contract.reads.find(read=>read.id==='target');
  assert.match(target.path,/packet context\.records -> exact bound scope\.define record/);
  assert.match(prose(target),/Do not scan \.starciwork for alternatives/);
  assert.match(prose(target),/packet context\.workflow binds the approved goal identity\/revision/);

  const nodeWrite=contract.writes.find(write=>write.id==='node');
  assert.match(prose(nodeWrite),/omit this write entirely/);
  assert.match(prose(nodeWrite),/workspace\.manage to materialize later/);
});
