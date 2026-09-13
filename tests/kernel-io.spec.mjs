import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {DESIGN_KINDS} from '../kernel/kernel.mjs';
import {RECORD_KINDS,decisionKindFor,intakeKindFor,ioBlock,ioPayload,kindsReadingBrand,recordKindOfPath,
  undeclaredWrites} from '../kernel/io.mjs';

/**
 * The kernel no longer remembers which kinds read the brand, which operation answers a decision node or which
 * one authors a feature: it asks `kernel/io.mjs`, and `kernel/io.mjs` asks the kinds profile. These tests hold
 * the derivation to the answer the hard-coded lists gave, so the move is provably a move and not a rewrite,
 * and they hold the record catalog - what a changed file IS - to the layout of the design.
 */
const authored=parseYaml(fs.readFileSync(new URL('../model/kinds.yaml',import.meta.url),'utf8'));
const sorted=list=>[...list].sort();
/** The list the 5.1 kernel carried as `DESIGN_KINDS`; the derivation must reproduce it, in whatever order. */
const BRAND_READERS=['interface.draw','interface.asset','frontend.implement','uat.verify','grammar.update'];

test('the kinds that read the brand are derived from the profile and are exactly the list the kernel used to carry',()=>{
  // The lanes that draw or build an interface, plus the kind that grows the language they are drawn in.
  assert.deepEqual(sorted(kindsReadingBrand({profile:authored})),sorted(BRAND_READERS));
  // The kernel's own exported snapshot is that derivation over the compiled profile, so both agree.
  assert.deepEqual(sorted(DESIGN_KINDS),sorted(BRAND_READERS));
  // The kind that WRITES the brand is not one that reads it: a decision is not derived from itself.
  assert.equal(kindsReadingBrand({profile:authored}).includes('brand.decide'),false);
});

test('a profile that declares reads answers outright: the kinds that read brand, plus the walk of the surface',()=>{
  const profile={kinds:{
    'interface.draw':{family:'design',role:'write',reads:['srs','brand'],writes:['design']},
    'backend.implement':{family:'build',role:'implement',reads:['srs','code'],writes:['code']},
    'uat.verify':{family:'prove',role:'verify',reads:['srs','design'],writes:['evidence']}
  }};
  assert.deepEqual(kindsReadingBrand({profile}),['interface.draw','uat.verify']);
});

test('a profile nobody can read falls back to the list of 5.1 instead of answering nothing',()=>{
  assert.deepEqual(kindsReadingBrand({profile:{}}),
    ['interface.draw','interface.asset','frontend.implement','uat.verify','grammar.update']);
});

test('the intake kind and the decision kind are the lane of the node, never a map in the kernel',()=>{
  assert.equal(intakeKindFor('brand',{profile:authored}),'brand.decide');
  assert.equal(intakeKindFor('collab',{profile:authored}),'work.author');
  assert.equal(intakeKindFor('features/collab/',{profile:authored}),'work.author');
  for(const [nodeKind,kind] of [['architecture','architecture.decide'],['business','business.decide'],
    ['business-overview','business.decide'],['brand','brand.decide']])
    assert.equal(decisionKindFor(nodeKind,{profile:authored}),kind,nodeKind);
  // A node kind whose lane builds and proves is no decision at all: the fallback answers, it does not invent.
  assert.equal(decisionKindFor('implementation',{profile:authored}),'business.decide');
  assert.equal(decisionKindFor('nothing-like-it',{profile:authored}),'business.decide');
});

/** A profile of the 5.1 shape: it declares what a kind changes and says nothing about what it reads. */
const mutatesOnly={kinds:{'interface.draw':{family:'design',role:'write',mutates:['design']}}};

test('the contract block and the validator payload are what the profile declares, and nothing when it declares nothing',()=>{
  // A profile that declares `mutates` only carries an output rule and no input rule, and the block says so.
  const block=ioBlock('interface.draw',{profile:mutatesOnly});
  assert.equal(block.includes('## Reads'),false,'no input is declared, so no heading is printed over an empty list');
  assert.ok(block.includes('## Produces'));
  assert.ok(block.includes('- `design`'));
  assert.deepEqual(ioPayload('interface.draw',{profile:mutatesOnly}),{reads:[],writes:['design']});
  // A profile that declares both prints both.
  const profile={kinds:{'interface.draw':{family:'design',role:'write',reads:['srs','brand'],writes:['design']}}};
  const declared=ioBlock('interface.draw',{profile});
  assert.ok(declared.includes('## Reads')&&declared.includes('- `srs`')&&declared.includes('- `brand`'));
  assert.deepEqual(ioPayload('interface.draw',{profile}),{reads:['srs','brand'],writes:['design']});
  // A kind the catalog does not carry declares nothing at all rather than throwing at a contract render.
  assert.deepEqual(ioBlock('task.execute',{profile:authored}),[]);
  assert.deepEqual(ioPayload('task.execute',{profile:authored}),{reads:[],writes:[]});
});

test('a path is mapped to the record kind it IS, most specific first',()=>{
  const cases=[
    ['.starciwork/features/sales/business/srs/decisions/d-1/index.yaml','decision'],
    ['.starciwork/features/sales/business/srs/rule-refund/index.yaml','srs'],
    ['features/sales/architecture/sds/flow/index.yaml','sds'],
    ['.starciwork/features/sales/integration/telegram/index.yaml','integration'],
    ['.starciwork/features/sales/ui/index.yaml','design'],
    ['.starciwork/features/sales/ui/assets/home.png','asset'],
    ['.starciwork/brand/index.yaml','brand'],
    ['.starciwork/brand/assets/mascot.png','asset'],
    ['.starciwork/features/sales/implementation/backend/intake/evidence/e-1/manifest.yaml','evidence'],
    ['.starciwork/features/sales/implementation/backend/intake/index.yaml','record'],
    ['repository:src/sales/intake.ts','code'],
    ['src/sales/intake.ts','code'],
    ['grammar:card','grammar'],
    ['knowledge/grammars/starci/DNA.yaml','grammar']
  ];
  for(const [file,kind] of cases)assert.equal(recordKindOfPath(file),kind,file);
  // The one thing a path cannot say on its own: a ui node's own record IS the interface design.
  assert.equal(recordKindOfPath('.starciwork/features/sales/ui-node/index.yaml',{nodeKind:'ui'}),'design');
  assert.equal(recordKindOfPath('.starciwork/features/sales/ui-node/index.yaml',{nodeKind:'implementation'}),'record');
  assert.equal(recordKindOfPath(''),null);
  // `runtime` is declared, never written as a file, so nothing maps to it.
  assert.equal(RECORD_KINDS.includes('runtime'),true);
  assert.equal(cases.some(([,kind])=>kind==='runtime'),false);
});

test('an undeclared write is named only when the profile declares what the kind writes',()=>{
  const files=['src/sales/intake.ts','.starciwork/features/sales/business/rule/index.yaml'];
  // A profile that carries no `writes` carries no rule either, so nothing is refused before the data exists.
  assert.deepEqual(undeclaredWrites('backend.implement',files,
    {profile:{kinds:{'backend.implement':{family:'build',role:'implement',mutates:['code']}}}}),[]);
  const profile={kinds:{'backend.implement':{family:'build',role:'implement',reads:['srs'],writes:['code']}}};
  assert.deepEqual(undeclaredWrites('backend.implement',files,{profile}),
    [{file:'.starciwork/features/sales/business/rule/index.yaml',record:'srs'}]);
  // A file of a record kind the op does declare is not a finding, and neither is a path nothing maps to.
  assert.deepEqual(undeclaredWrites('backend.implement',['src/sales/intake.ts'],{profile}),[]);
  assert.deepEqual(undeclaredWrites('unknown.kind',files,{profile}),[]);
});
