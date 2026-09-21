import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';

const root=path.resolve(import.meta.dirname,'..');
const op=parseYaml(fs.readFileSync(path.join(root,'modules/ops/ops/interface.audit.yaml'),'utf8'));
const docs=fs.readFileSync(path.join(root,'docs/interface-audit.md'),'utf8');
const prose=value=>JSON.stringify(value);

test('interface audit only inspects implementation captures and cannot replace acceptance',()=>{
  assert.equal(op.id,'interface.audit');
  assert.equal(op.graphPolicy.mode,'read-only');
  assert.equal(op.readOnlyPolicy.productSource,true);
  assert.equal(op.readOnlyPolicy.productData,true);
  assert.ok(op.writes.every(write=>!String(write.path).startsWith('repository:')));
  assert.match(prose(op.readOnlyPolicy.forbiddenEffects),/edit, format, generate or commit product, design, asset or Grammar source/);
  assert.match(prose(op.readOnlyPolicy.forbiddenEffects),/generate, retouch or replace product renders or captures/);
  assert.match(prose(op.auditPolicy.completion.neverMeans),/review\.verify acceptance/);
  assert.match(prose(op.auditPolicy.completion.neverMeans),/uat\.verify business journey proof/);
  assert.match(prose(op.proofs),/leaves review\.verify and UAT independent/);
});

test('hard coverage is deterministic and Grammar anatomy cannot be taste-waived',()=>{
  assert.deepEqual(op.findingSchema.categories,[
    'geometry','content','icon','asset','responsive','interaction','grammar.anatomy','grammar.token',
    'accessibility','render.truth','taste',
  ]);
  const grammar=op.reads.find(read=>read.id==='grammar');
  assert.match(prose(grammar),/exact version/);
  assert.match(prose(grammar),/matching real reference renders/);
  assert.match(prose(grammar),/winning token\/declaration provenance/);
  assert.match(prose(op.steps),/canonical primitive\/reference has no border/);
  assert.match(prose(op.steps),/hard `grammar\.anatomy` finding/);
  assert.match(prose(op.proofs),/Unexpected border, surface, shadow, radius/);
  assert.match(prose(op.proofs),/no visual or creative score can waive it/);
  assert.match(docs,/border-style: none/);
  assert.match(docs,/border-width: 0/);
  assert.match(docs,/taste score of 5/);
  assert.match(docs,/A screenshot alone cannot establish this finding/);
});

test('repair routing follows cause and blast radius, with refactor secondary only',()=>{
  assert.equal(op.auditPolicy.routingPriority,'root-cause-then-blast-radius-never-raw-finding-count');
  assert.deepEqual(op.findingSchema.routing.primaryOps,['interface.implement','interface.draw']);
  assert.deepEqual(op.auditPolicy.primaryRoutes.boundedImplementation.chain,['interface.implement','interface.audit']);
  assert.deepEqual(op.auditPolicy.primaryRoutes.systemicDirection.chain,['interface.draw','interface.implement','interface.audit']);
  assert.equal(op.auditPolicy.optionalMechanicalRoute.op,'code.refactor');
  assert.match(op.auditPolicy.optionalMechanicalRoute.onlyWhen,/behavior-invariant/);
  assert.match(prose(op.steps),/optional secondary advice/);
  assert.match(docs,/Root cause and blast radius outrank raw finding count/);
});

test('repairs create fresh real renders before the audit-only recheck',()=>{
  assert.equal(op.auditPolicy.freshCaptureRule,'every-repair-produces-new-interface-implement-captures-before-audit');
  const captures=op.reads.find(read=>read.id==='implementation-captures');
  assert.match(prose(captures),/fresh real route x viewport captures produced by interface\.implement/);
  assert.match(prose(captures),/never generates replacement renders/);
  assert.match(prose(op.steps),/stale capture or capture made before the routed repair/);
  assert.match(docs,/interface\.audit \(inspect only\)/);
  assert.match(docs,/Reusing pre-repair captures, model-generating\s+a\s+replacement/);
});

test('five-round lineage rechecks one matrix and never converts exhaustion into pass',()=>{
  assert.equal(op.auditPolicy.roundLimit,5);
  assert.equal(op.auditPolicy.lineage,'immediate-predecessor-required');
  assert.equal(op.auditPolicy.matrixRecheck,'immutable-route-state-viewport-theme-plus-additions');
  assert.equal(op.auditPolicy.completion.status,'no-actionable-drift');
  assert.match(prose(op.steps),/no-progress/);
  assert.match(prose(op.steps),/oscillation/);
  assert.match(prose(op.steps),/On round 5 any known/);
  assert.ok(op.blockers.some(blocker=>blocker.code==='AUDIT_ROUND_LIMIT'));
  assert.match(docs,/There is no sixth audit and no last-round courtesy pass/);
});

test('no-actionable-drift needs complete hard proof and calibrated bounded taste',()=>{
  assert.equal(op.auditPolicy.hardConstraintRule,'every-required-hard-cell-pass');
  assert.equal(op.auditPolicy.creativeRubric.calibration,'same-round-low-mid-high-required');
  assert.equal(op.auditPolicy.creativeRubric.completionVerdict,'ship');
  assert.deepEqual(op.auditPolicy.completion.requires,[
    'every selected matrix cell was freshly inspected on one verified served revision',
    'every required hard constraint passed with actual measurements and authority',
    'no open, unchanged, new, reopened or blocked actionable finding remains',
    'calibrated taste verdict is ship for the selected applicable scope',
    'round and trend lineage are valid and the immutable matrix was rechecked',
  ]);
  assert.match(prose(op.proofs),/zero actionable findings/);
});
