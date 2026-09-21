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
  assert.match(prose(op.readOnlyPolicy.forbiddenEffects),/technical test success for visual equivalence/);
  assert.match(prose(op.auditPolicy.completion.neverMeans),/review\.verify acceptance/);
  assert.match(prose(op.auditPolicy.completion.neverMeans),/uat\.verify business journey proof/);
  assert.match(prose(op.proofs),/leaves review\.verify and UAT independent/);
});

test('latest explicit owner-accepted draw receipt is the immutable visual baseline',()=>{
  const lineage=op.reads.find(read=>read.id==='accepted-draw-lineage');
  assert.ok(lineage);
  assert.match(prose(lineage),/latest causally ordered explicit owner acceptance/);
  assert.match(prose(lineage),/receipt path and sha256/);
  assert.match(prose(lineage),/image path\/sha256 plus exact prompt path\/sha256/);
  assert.match(prose(lineage),/coverage\/content digest/);
  assert.equal(op.auditPolicy.acceptedDrawLineage.selection,'latest-causally-ordered-explicit-owner-acceptance-for-selected-scope');
  assert.equal(op.auditPolicy.acceptedDrawLineage.precedence,'latest-explicit-owner-acceptance-over-older-canonical-or-generated-directions');
  assert.equal(op.auditPolicy.acceptedDrawLineage.history,'append-only-never-rewrite-or-relabel');
  assert.equal(op.auditPolicy.acceptedDrawLineage.ambiguity,'block');
  assert.ok(op.blockers.some(blocker=>blocker.code==='ACCEPTED_DRAW_LINEAGE_MISSING'));
  assert.ok(op.blockers.some(blocker=>blocker.code==='ACCEPTED_DRAW_LINEAGE_AMBIGUOUS'));
  assert.match(docs,/latest explicit\s+owner acceptance outranks older canonical or generated directions/);
  assert.match(docs,/later generated but unaccepted draw is not a\s+baseline/);
  assert.match(docs,/not rewritten, relabelled or deleted/);
});

test('visual equivalence uses untransformed side-by-side pairs at identical cells',()=>{
  assert.deepEqual(op.auditPolicy.sideBySide.cellIdentity,['surface','state','viewport','theme']);
  assert.equal(op.auditPolicy.sideBySide.requiredFor,'every-draw-backed-representative-cell');
  assert.deepEqual(op.auditPolicy.sideBySide.lenses,[
    'composition-hierarchy','section-order','light-dark-rhythm','imagery','creative-intent',
  ]);
  assert.deepEqual(op.auditPolicy.sideBySide.resultStates,['pass','fail','inconclusive']);
  assert.equal(op.auditPolicy.visualEquivalenceRule,'every-required-side-by-side-lens-pass');
  assert.equal(op.auditPolicy.technicalEvidenceRule,'corroborating-only-never-substitutes-for-visual-equivalence');
  assert.ok(op.blockers.some(blocker=>blocker.code==='SIDE_BY_SIDE_CELL_MISMATCH'));
  for(const category of ['composition.hierarchy','section.order','light-dark.rhythm','imagery','creative.intent']){
    assert.ok(op.findingSchema.categories.includes(category),`missing ${category}`);
  }
  assert.match(prose(op.steps),/place the accepted direction bytes and implementation capture side by side/);
  assert.match(prose(op.steps),/surface, state, viewport and theme identities are equal/);
  assert.match(prose(op.steps),/DOM, lint, tests and build\s+pass/);
  assert.match(docs,/a mobile image cannot stand\s+in for desktop/);
  assert.match(docs,/never substitute for\s+visual equivalence/);
});

test('hard coverage is deterministic and Grammar anatomy cannot be taste-waived',()=>{
  assert.deepEqual(op.findingSchema.categories,[
    'geometry','content','icon','asset','responsive','interaction','grammar.anatomy','grammar.token',
    'realization.mode','symbol.fit','symbol.family','accessibility','render.truth','composition.hierarchy','section.order','light-dark.rhythm','imagery',
    'creative.intent','taste',
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

test('audit treats prominent symbols as defensible product claims',()=>{
  assert.ok(op.findingSchema.categories.includes('symbol.fit'));
  assert.ok(op.findingSchema.categories.includes('symbol.family'));
  assert.deepEqual(op.auditPolicy.symbolReview.questions,[
    'exact-product-concept','alternate-reading-without-label','audience-category-maturity','generic-cliche-risk',
    'sibling-distinction','family-camera-base-material-light-scale-density','reduced-scale-legibility','truthful-realization-medium',
  ]);
  assert.equal(op.auditPolicy.symbolReview.boundedDriftRoute,'interface.implement');
  assert.equal(op.auditPolicy.symbolReview.systemicLanguageRoute,'interface.draw');
  assert.match(prose(op.steps),/strongest plausible alternate\s+reading without its label/);
  assert.match(prose(op.steps),/camera\/base\/material\/light\/scale\/density/);
  assert.ok(op.proofs.some(proof=>proof.id==='symbolic-integrity'));
  assert.ok(op.blockers.some(blocker=>blocker.code==='SYMBOL_INTENT_UNRESOLVED'));
  assert.match(docs,/A symbol is a product claim/);
  assert.match(docs,/A label does not rescue/);
});

test('audit enforces raster artwork versus code-native UI realization',()=>{
  const realization=op.reads.find(read=>read.id==='realization-map');
  assert.ok(realization);
  assert.match(prose(realization),/raster-asset/);
  assert.match(prose(realization),/code-native/);
  assert.ok(op.findingSchema.categories.includes('realization.mode'));
  assert.match(prose(op.steps),/flattened screenshot used for code-native UI/);
  assert.match(prose(op.proofs),/Raster artwork binds exact retained asset identity/);
  assert.ok(op.blockers.some(blocker=>blocker.code==='REALIZATION_MODE_UNRESOLVED'));
  assert.match(docs,/textured planet/);
  assert.match(docs,/flatten code-native UI into a\s+screenshot/);
  assert.match(docs,/hard `realization\.mode` finding/);
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
  assert.match(prose(captures),/fresh real route x state x viewport x theme captures produced by interface\.implement/);
  assert.match(prose(captures),/never generates replacement renders/);
  assert.match(prose(op.steps),/stale capture or capture made before the routed repair/);
  assert.match(docs,/interface\.audit \(inspect only\)/);
  assert.match(docs,/Reusing pre-repair captures, model-generating\s+a\s+replacement/);
});

test('intentional visual departures stay open until an exact owner-bound decision',()=>{
  const policy=op.auditPolicy.deviationGovernance;
  assert.equal(policy.defaultState,'drift-open');
  assert.equal(policy.approvalAuthority,'explicit-owner-only');
  assert.equal(policy.approvalBinding,'exact-deviation-case-digest-and-exact-draw/capture-hashes');
  assert.equal(policy.approvalEffect,'new-accepted-direction-lineage-input-never-audit-self-waiver');
  assert.equal(policy.history,'append-only-and-queryable-after-the-run');
  for(const evidence of [
    'deviations.json','deviation-brief.md','accepted-draw-hash','implementation-capture-hash',
    'measured-regions','alternatives','counterargument','risks','rollback','recheck-matrix',
  ]) assert.ok(policy.evidence.includes(evidence),`missing deviation evidence ${evidence}`);
  assert.match(prose(op.readOnlyPolicy.forbiddenEffects),/deviation rationale as owner approval/);
  assert.match(prose(op.steps),/strongest counterargument/);
  assert.match(prose(op.steps),/exact deviation\s+case digest/);
  assert.ok(op.blockers.some(blocker=>blocker.code==='OWNER_DEVIATION_DECISION_REQUIRED'));
  assert.deepEqual(op.auditPolicy.reportMapping.intentionalDeviationPendingOwner,{
    outcome:'blocked',blocker:'interface-gap',code:'OWNER_DEVIATION_DECISION_REQUIRED',route:'interface.draw',
  });
  assert.match(docs,/finding stays open/);
  assert.match(docs,/exact deviation-case digest plus the draw\/capture hashes/);
  assert.match(docs,/strongest counterargument/);
  assert.match(docs,/queryable when the owner asks why the implementation diverged/);
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
    'latest explicit owner-accepted interface.draw receipt and all receipt/image/prompt/content hashes are exact and unambiguous',
    'every draw-backed representative cell has an untransformed side-by-side pair at identical surface/state/viewport/theme',
    'composition hierarchy, section order, light-dark rhythm, imagery and creative intent equivalence all passed',
    'every prominent symbol passed concept fit, audience maturity, family coherence, sibling distinction, reduced-scale legibility and truthful-medium review',
    'every selected matrix cell was freshly inspected on one verified served revision',
    'every required hard constraint passed with actual measurements and authority',
    'no open, unchanged, new, reopened or blocked actionable finding remains',
    'calibrated taste verdict is ship for the selected applicable scope',
    'round and trend lineage are valid and the immutable matrix was rechecked',
  ]);
  assert.match(prose(op.proofs),/zero actionable findings/);
});
