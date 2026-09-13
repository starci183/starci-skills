import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {RECORD_KINDS,RECORDS_SCHEMA,decisionKindFor,intakeKindFor,ioBlock,ioPayload,kindsReadingBrand,loadRecords,
  recordKindOfPath,recordReads,undeclaredWrites,validateRecords} from '../kernel/io.mjs';

const read=name=>parseYaml(fs.readFileSync(new URL(`../model/${name}`,import.meta.url),'utf8'));
const records=read('records.yaml');
const profile=read('kinds.yaml');
const clone=()=>structuredClone(records);
const codes=errors=>errors.map(error=>error.code);

test('the record catalog is the closed list, validates, and compiles to what the kernel reads at run time',()=>{
  assert.equal(records.schema,RECORDS_SCHEMA);
  assert.deepEqual(Object.keys(records.records),[...RECORD_KINDS]);
  assert.deepEqual(validateRecords(records),[]);
  // Every record kind says what it is, where it lives and which node kinds carry it, and every derivation
  // source it names is another kind of this same catalog.
  for(const [record,entry] of Object.entries(records.records)){
    assert.ok(entry.purpose.trim(),record);
    for(const field of ['layout','nodeKinds','reads'])assert.ok(Array.isArray(entry[field]),`${record}/${field}`);
    for(const source of entry.reads)assert.ok(RECORD_KINDS.includes(source),`${record}/${source}`);
  }
  // The derivations of the 5-plus design: a requirement is settled from the owner's decisions, a design from
  // the requirement, code from the design, evidence from the code it proved.
  assert.deepEqual(recordReads('record',{records}),[]);
  assert.deepEqual(recordReads('decision',{records}),[]);
  assert.deepEqual(recordReads('srs',{records}),['decision']);
  assert.deepEqual(recordReads('sds',{records}),['srs','decision']);
  assert.deepEqual(recordReads('design',{records}),['srs','sds','brand','grammar']);
  assert.deepEqual(recordReads('asset',{records}),['design','brand']);
  assert.deepEqual(recordReads('brand',{records}),['code']);
  assert.deepEqual(recordReads('evidence',{records}),['code','design','srs']);
  assert.deepEqual(recordReads('integration',{records}),['srs','sds']);
  assert.deepEqual(recordReads('runtime',{records}),['code']);
  // A runtime is a fact about a machine, recorded in the node that operates it; no path in the tree is one.
  assert.deepEqual(records.records.runtime.layout,[]);
  const dist=new URL('../.dist/model/records.json',import.meta.url);
  if(!fs.existsSync(dist))return;
  assert.deepEqual(JSON.parse(fs.readFileSync(dist,'utf8')),records);
  assert.deepEqual(loadRecords(),records,'the compiled catalog is the authored one');
});

test('a record catalog that is wrong is rejected with its named error, never silently repaired',()=>{
  assert.deepEqual(codes(validateRecords({})),['record-shape']);
  const unknownSource=clone();unknownSource.records.srs.reads=['telemetry'];
  assert.ok(codes(validateRecords(unknownSource)).includes('unknown-record-read'));
  // A record derived from itself would make every restatement of it legal by declaration.
  const selfDerived=clone();selfDerived.records.srs.reads=['srs'];
  assert.ok(codes(validateRecords(selfDerived)).includes('unknown-record-read'));
  const shapeless=clone();delete shapeless.records.brand.layout;
  assert.ok(codes(validateRecords(shapeless)).includes('record-shape'));
  const silent=clone();silent.records.code.purpose='';
  assert.ok(codes(validateRecords(silent)).includes('record-shape'));
  // The catalog is closed in both directions, exactly as the operation catalog is.
  const extra=clone();extra.records.telemetry={purpose:'x',layout:[],nodeKinds:[],reads:[]};
  assert.ok(codes(validateRecords(extra)).includes('catalog-drift'));
  const dropped=clone();delete dropped.records.grammar;
  assert.ok(codes(validateRecords(dropped)).includes('catalog-drift'));
});

test('every path a workflow touches maps to the record kind the catalog says it is',()=>{
  const table=[
    // The Work tree, most specific first: a decision lives inside the business tree it decides.
    ['features/collab/business/srs/decisions/d-intake/index.yaml','decision'],
    ['features/collab/business/srs/fr/share-thread/index.yaml','srs'],
    ['features/collab/business/overview/index.yaml','srs'],
    ['features/collab/architecture/sds/flows/share/index.yaml','sds'],
    ['features/collab/integration/telegram/index.yaml','integration'],
    ['features/collab/ui/thread/index.yaml','design'],
    ['brand/index.yaml','brand'],
    // Bytes and proofs belong to whatever record they sit beside, whichever folder that is.
    ['brand/assets/mascot/rest.png','asset'],
    ['features/collab/ui/thread/assets/candidates/desktop.png','asset'],
    ['features/collab/implementation/backend/api/evidence/run-1/manifest.yaml','evidence'],
    // An evidence bundle that keeps a capture is still evidence; the capture is not artwork.
    ['features/collab/uat/share/evidence/walk-1/assets/step-3.png','evidence'],
    // Outside the Work tree is the product, whatever the operator calls the path.
    ['repository:collab-api/src/share/service.ts','code'],
    ['repository:collab-web/public/images/hero.webp','code'],
    ['apps/web/src/app/page.tsx','code'],
    ['grammar:starci-ui/src/units/thread-list.tsx','grammar'],
    ['knowledge/grammars/starci-ui/index.yaml','grammar'],
    // The runtime's own state is not a record, so an operation that touches it declares nothing.
    ['.starciwork/_resources/environments/staging/resource.yaml',null],
    ['.starciwork/_local/plans/p-1/index.yaml',null],
    ['.starciwork/workspace.yaml',null],
    ['',null],
    [null,null],
  ];
  for(const [path,expected] of table)assert.equal(recordKindOfPath(path),expected,String(path));
  // Windows separators are the same paths; a report written on Windows maps like every other one.
  assert.equal(recordKindOfPath('features\\collab\\ui\\thread\\index.yaml'),'design');
  // An operator contract writes templates, and `nodeKind` resolves the node's own folder: the same
  // `N/index.yaml` is the design record of a ui node and the authored record of an implementation node.
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'ui'}),'design');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'brand'}),'brand');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'business'}),'srs');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'business-overview'}),'srs');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'architecture'}),'sds');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'integration'}),'integration');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'implementation'}),'record');
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'operations'}),'record');
  // A completion profile stands in for a node kind in some contracts; the family before the dot decides.
  assert.equal(recordKindOfPath('N/index.yaml',{nodeKind:'uat.ux'}),'record');
  assert.equal(recordKindOfPath('N/index.yaml'),'record');
  assert.equal(recordKindOfPath('N/assets/<asset>'),'asset');
  assert.equal(recordKindOfPath('E/manifest.yaml'),'evidence');
  // A catalog that does not declare a kind cannot have a path resolve to it.
  const partial=clone();delete partial.records.design;delete partial.records.asset;
  assert.equal(recordKindOfPath('features/collab/ui/thread/index.yaml',{records:partial}),null);
});

test('a file an operation produced that its kind never declared is a named finding, not a silent write',()=>{
  // `e2e.verify` leaves its scenario and its evidence; a business record is not its to write.
  assert.deepEqual(undeclaredWrites('e2e.verify',[
    'features/collab/implementation/backend/api/evidence/run-1/manifest.yaml',
    'repository:collab-api/test/e2e/share.spec.ts',
  ],{profile}),[]);
  assert.deepEqual(undeclaredWrites('e2e.verify',['features/collab/business/srs/fr/share-thread/index.yaml'],{profile}),
    [{file:'features/collab/business/srs/fr/share-thread/index.yaml',record:'srs'}]);
  // The read-only prover declares nothing, so every record it touched is a finding.
  assert.deepEqual(undeclaredWrites('review.verify',['repository:collab-api/src/share/service.ts'],{profile}),
    [{file:'repository:collab-api/src/share/service.ts',record:'code'}]);
  // A path that is not a record at all is not a finding: the kernel's own state is not the operation's output.
  assert.deepEqual(undeclaredWrites('review.verify',['.starciwork/_local/plans/p-1/run/index.yaml'],{profile}),[]);
  // One file is accepted as a list of one, the way a report with a single changed path arrives.
  assert.deepEqual(undeclaredWrites('backend.implement','repository:collab-api/src/share/service.ts',{profile}),[]);
  // The drawing may capture its candidates; it may not author the requirement it drew against.
  assert.deepEqual(undeclaredWrites('interface.draw',['features/collab/ui/thread/assets/desktop.png'],{profile}),[]);
  assert.deepEqual(undeclaredWrites('interface.draw',['features/collab/business/srs/index.yaml'],{profile}).map(row=>row.record),['srs']);
});

test('the contract prints the declaration under the goal, so an operation knows what it may cite and produce',()=>{
  const block=ioBlock('integration.verify',{profile,records});
  assert.match(block,/^## Reads\n/);
  assert.match(block,/\n## Produces\n/);
  for(const record of ['integration','sds','code'])assert.match(block,new RegExp(`- \`${record}\` - `),record);
  assert.match(block,/- `evidence` - /);
  assert.equal(block.includes('- `srs` - '),false,'a record it may not cite is not offered to it');
  // A read-only kind is told plainly that it produces nothing, rather than being given an empty heading.
  assert.match(ioBlock('review.verify',{profile,records}),/## Produces\n- nothing: this operation reads and reports/);
  // The same declaration reaches the validator as data, with the same two lists.
  assert.deepEqual(ioPayload('integration.verify',{profile}),{reads:['integration','sds','code'],writes:['evidence']});
  assert.deepEqual(ioPayload('review.verify',{profile}).writes,[]);
});

test('the kernel asks the catalog instead of keeping its own sets of kinds',()=>{
  // This replaces the hard-coded DESIGN_KINDS: the brand payload goes to the kinds that declare they read it.
  assert.deepEqual([...kindsReadingBrand({profile})].sort(),
    ['interface.draw','interface.asset','frontend.implement','uat.verify','grammar.update'].sort());
  // The product's identity is authored by the one kind that settles it; every other scope is authored as Work.
  assert.equal(intakeKindFor('brand'),'brand.decide');
  assert.equal(intakeKindFor('collab'),'work.author');
  assert.equal(intakeKindFor(''),'work.author');
  assert.equal(intakeKindFor(null),'work.author');
  // This replaces DECISION_OPERATION: a decision node's lane is one step, and that step is the answer.
  assert.equal(decisionKindFor('architecture',{profile}),'architecture.decide');
  assert.equal(decisionKindFor('business',{profile}),'business.decide');
  assert.equal(decisionKindFor('business-overview',{profile}),'business.decide');
  assert.equal(decisionKindFor('brand',{profile}),'brand.decide');
  // A node that must be built and then proven is not settled by one decision, and an unclaimed kind has none.
  assert.equal(decisionKindFor('implementation',{profile}),null);
  assert.equal(decisionKindFor('knowledge',{profile}),null);
});
