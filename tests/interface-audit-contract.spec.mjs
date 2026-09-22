import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadOp, root, proof, blocker, readOf, writeOf, statesOnce, states, assertParam } from './helpers/op-contract.mjs';

// What interface.audit promises, asserted as structure. The manifest's wording
// is free to change; its params, proof ids, blocker codes, policy keys and the
// one place each rule lives are not.
const op = loadOp('interface.audit');
const docs = fs.readFileSync(path.join(root, 'docs/interface-audit.md'), 'utf8');
const policy = op.policy.auditPolicy;

test('the manifest holds the one op shape, with its policy in one map', () => {
  assert.equal(op.schema, 'starci/op@1');
  assert.equal(op.id, 'interface.audit');
  assert.ok(!Object.hasOwn(op, 'business'), 'the business summary is generated into modules/ops/registry.yaml, not authored here');
  for (const stray of ['readOnlyPolicy', 'auditPolicy', 'findingSchema']) {
    assert.ok(!Object.hasOwn(op, stray), `${stray} belongs under policy:`);
    assert.ok(Object.hasOwn(op.policy, stray), `policy.${stray} is missing`);
  }
  for (const write of op.writes) assert.ok(!write.path.includes(' + '), `${write.id} joins paths: ${write.path}`);
});

test('audit inspects and routes; it never repairs and never accepts', () => {
  assert.equal(op.graphPolicy.mode, 'read-only');
  assert.equal(op.graphPolicy.dispatch, 'never');
  assert.equal(op.policy.readOnlyPolicy.productSource, true);
  assert.equal(op.policy.readOnlyPolicy.productData, true);
  assert.ok(op.writes.every((write) => !String(write.path).startsWith('repository:')));
  const forbidden = JSON.stringify(op.policy.readOnlyPolicy.forbiddenEffects).toLowerCase();
  for (const effect of ['commit', 'replace product renders', 'dispatch or perform a repair', 'certify review.verify'])
    assert.ok(forbidden.includes(effect), `forbiddenEffects should cover ${effect}`);
  assert.deepEqual(policy.completion.neverMeans,
    ['review.verify acceptance', 'uat.verify business journey proof', 'permission to waive hard constraints']);
  states(assert, op, ['review.verify', 'independent'], { section: '$.proofs' });
});

test('the round ceiling is a param, not a number spelled into the prose', () => {
  assertParam(assert, op, 'maxRounds', { type: 'integer', default: 5, setBy: 'kernel' });
  assert.equal(policy.roundLimit, 'params.maxRounds');
  // Whatever the ceiling is set to, the manifest cites it by name.
  const spelled = JSON.stringify([op.steps, op.proofs, op.blockers]).match(/\b(five|5)[\s-]+rounds?\b/i);
  assert.equal(spelled, null, `the round ceiling is restated as a literal: ${spelled?.[0]}`);
  assert.ok(blocker(op, 'AUDIT_ROUND_LIMIT'), 'no AUDIT_ROUND_LIMIT blocker');
  assert.ok(proof(op, 'bounded-loop'), 'no bounded-loop proof');
  statesOnce(assert, op, ['params.maxRounds'], { section: '$.proofs', label: 'the loop never exceeds the ceiling' });
});

test('the audit measures the served render itself and reads the producer as context', () => {
  const runner = readOf(op, 'runner');
  assert.ok(runner, 'the audit declares no runner read');
  assert.match(runner.path, /playwright/i);
  const selfReport = readOf(op, 'producer-measurements');
  assert.ok(selfReport, 'the producer self-report is not a distinct read');
  assert.match(selfReport.path, /interface\.implement/);
  assert.match(selfReport.purpose.en, /self-report|context/i);

  const measuring = op.steps.find((s) => s.reads.includes('runner'));
  assert.ok(measuring, 'no step reads the runner');
  assert.ok(measuring.reads.includes('producer-measurements'), 'the measuring step does not read the producer self-report');
  statesOnce(assert, op, ['playwright', 'measure'], { section: '$.steps', label: 'the audit measures with the locked runner' });
  assert.match(policy.measurementAuthority, /audit-measures/);
  // A1: the producer's own numbers never close a cell.
  states(assert, op, ['self-report', 'never'], { section: '$.steps' });
});

test('the audit declares the host tool it cannot work without', () => {
  assert.ok(op.route.riskHints.includes('host-tool-required:browser-dom'),
    `route.riskHints must name the browser-dom requirement, got ${op.route.riskHints.join(', ')}`);
  assert.ok(blocker(op, 'CAPTURE_OR_MEASUREMENT_UNAVAILABLE'), 'no blocker for missing instrumentation');
});

test('the latest explicit owner acceptance is the baseline, and ambiguity blocks', () => {
  const lineage = readOf(op, 'accepted-draw-lineage');
  assert.ok(lineage);
  assert.equal(policy.acceptedDrawLineage.selection, 'latest-causally-ordered-explicit-owner-acceptance-for-selected-scope');
  assert.equal(policy.acceptedDrawLineage.precedence, 'latest-explicit-owner-acceptance-over-older-canonical-or-generated-directions');
  assert.equal(policy.acceptedDrawLineage.history, 'append-only-never-rewrite-or-relabel');
  assert.equal(policy.acceptedDrawLineage.ambiguity, 'block');
  for (const binding of ['acceptanceEventId', 'drawReceiptSha256', 'imagePathsAndSha256', 'promptPathsAndSha256', 'coverageContentSha256'])
    assert.ok(policy.acceptedDrawLineage.requiredBindings.includes(binding), `missing required binding ${binding}`);
  assert.ok(blocker(op, 'ACCEPTED_DRAW_LINEAGE_MISSING'));
  assert.ok(blocker(op, 'ACCEPTED_DRAW_LINEAGE_AMBIGUOUS'));
  assert.ok(proof(op, 'accepted-draw-lineage'));
});

test('visual equivalence is an untransformed pair at one identical cell', () => {
  assert.deepEqual(policy.sideBySide.cellIdentity, ['surface', 'state', 'viewport', 'theme']);
  assert.equal(policy.sideBySide.requiredFor, 'every-draw-backed-representative-cell');
  assert.deepEqual(policy.sideBySide.lenses,
    ['composition-hierarchy', 'section-order', 'light-dark-rhythm', 'imagery', 'creative-intent']);
  assert.deepEqual(policy.sideBySide.resultStates, ['pass', 'fail', 'inconclusive']);
  assert.equal(policy.visualEquivalenceRule, 'every-required-side-by-side-lens-pass');
  assert.equal(policy.technicalEvidenceRule, 'corroborating-only-never-substitutes-for-visual-equivalence');
  for (const forbidden of ['resize', 'crop', 'recolor', 'regenerate', 'cross-cell-substitution'])
    assert.ok(policy.sideBySide.transformsForbidden.includes(forbidden), `missing forbidden transform ${forbidden}`);
  assert.ok(blocker(op, 'SIDE_BY_SIDE_CELL_MISMATCH'));
  assert.ok(proof(op, 'side-by-side-visual-equivalence'));
  // Each lens is a finding category, so a failed lens has somewhere to land.
  for (const category of ['composition.hierarchy', 'section.order', 'light-dark.rhythm', 'imagery', 'creative.intent'])
    assert.ok(op.policy.findingSchema.categories.includes(category), `missing finding category ${category}`);
  statesOnce(assert, op, ['side by side'], { section: '$.steps', label: 'the pairing rule' });
  states(assert, op, ['identical'], { section: '$.proofs', label: 'the pair is at one identical cell' });
});

test('hard coverage is deterministic and Grammar anatomy cannot be taste-waived', () => {
  assert.equal(policy.hardConstraintRule, 'every-required-hard-cell-pass');
  assert.deepEqual(op.policy.findingSchema.constraintClasses, ['hard', 'creative-rubric']);
  assert.deepEqual(op.policy.findingSchema.statuses, ['open', 'resolved', 'unchanged', 'new', 'reopened', 'blocked']);
  for (const category of ['geometry', 'content', 'icon', 'asset', 'responsive', 'interaction',
    'grammar.anatomy', 'grammar.token', 'realization.mode', 'symbol.fit', 'symbol.family',
    'accessibility', 'render.truth', 'taste'])
    assert.ok(op.policy.findingSchema.categories.includes(category), `missing finding category ${category}`);
  assert.ok(proof(op, 'grammar-hard-authority'));
  assert.ok(proof(op, 'deterministic-coverage'));
  assert.ok(blocker(op, 'GRAMMAR_AUTHORITY_UNPROVEN'));
  statesOnce(assert, op, ['grammar.anatomy', 'waive'], { label: 'a taste score cannot waive a Grammar anatomy finding' });
  assert.equal(policy.creativeRubric.calibration, 'same-round-low-mid-high-required');
  assert.equal(policy.creativeRubric.completionVerdict, 'ship');
  assert.ok(proof(op, 'bounded-creative-rubric'));
});

test('a prominent symbol is a product claim its label cannot rescue', () => {
  assert.deepEqual(policy.symbolReview.questions, [
    'exact-product-concept', 'alternate-reading-without-label', 'audience-category-maturity', 'generic-cliche-risk',
    'sibling-distinction', 'family-camera-base-material-light-scale-density', 'reduced-scale-legibility', 'truthful-realization-medium',
  ]);
  assert.equal(policy.symbolReview.boundedDriftRoute, 'interface.implement');
  assert.equal(policy.symbolReview.systemicLanguageRoute, 'interface.draw');
  assert.ok(proof(op, 'symbolic-integrity'));
  assert.ok(blocker(op, 'SYMBOL_INTENT_UNRESOLVED'));
  statesOnce(assert, op, ['alternate', 'label'], { section: '$.steps', label: 'the reading a symbol has without its label' });
});

test('every region keeps the realization mode the accepted direction gave it', () => {
  const map = readOf(op, 'realization-map');
  assert.ok(map);
  assert.match(map.path, /realization-check\.json/, 'the audit reads what interface.implement actually writes');
  assert.ok(op.policy.findingSchema.categories.includes('realization.mode'));
  assert.ok(proof(op, 'realization-fidelity'));
  assert.ok(blocker(op, 'REALIZATION_MODE_UNRESOLVED'));
  statesOnce(assert, op, ['flattened screenshot', 'code-native'], { section: '$.steps', label: 'a flattened screenshot cannot stand for code-native UI' });
});

test('repair routes by cause and blast radius, and refactor is secondary only', () => {
  assert.equal(policy.routingPriority, 'root-cause-then-blast-radius-never-raw-finding-count');
  assert.deepEqual(op.policy.findingSchema.routing.primaryOps, ['interface.implement', 'interface.draw']);
  assert.deepEqual(policy.primaryRoutes.boundedImplementation.chain, ['interface.implement', 'interface.audit']);
  assert.deepEqual(policy.primaryRoutes.systemicDirection.chain, ['interface.draw', 'interface.implement', 'interface.audit']);
  assert.equal(policy.optionalMechanicalRoute.op, 'code.refactor');
  assert.match(policy.optionalMechanicalRoute.onlyWhen, /behavior-invariant/);
  assert.ok(proof(op, 'actionable-routing'));
  for (const required of ['primaryOp', 'rationale', 'affectedPaths', 'recheckMatrix', 'nextChain'])
    assert.ok(op.policy.findingSchema.routing.required.includes(required), `routing must require ${required}`);
});

test('a repair produces fresh captures before the next audit', () => {
  assert.equal(policy.freshCaptureRule, 'every-repair-produces-new-interface-implement-captures-before-audit');
  const captures = readOf(op, 'implementation-captures');
  assert.match(captures.path, /interface\.implement/);
  statesOnce(assert, op, ['stale capture'], { section: '$.steps', label: 'a stale capture is rejected' });
});

test('a claimed intentional departure stays open until the owner decides', () => {
  const governance = policy.deviationGovernance;
  assert.equal(governance.defaultState, 'drift-open');
  assert.equal(governance.approvalAuthority, 'explicit-owner-only');
  assert.equal(governance.approvalBinding, 'exact-deviation-case-digest-and-exact-draw/capture-hashes');
  assert.equal(governance.approvalEffect, 'new-accepted-direction-lineage-input-never-audit-self-waiver');
  assert.equal(governance.history, 'append-only-and-queryable-after-the-run');
  for (const evidence of ['deviations.json', 'deviation-brief.md', 'accepted-draw-hash', 'implementation-capture-hash',
    'measured-regions', 'alternatives', 'counterargument', 'risks', 'rollback', 'recheck-matrix'])
    assert.ok(governance.evidence.includes(evidence), `missing deviation evidence ${evidence}`);
  for (const implicit of ['silence', 'technical-pass', 'auditor-verdict', 'implementer-claim', 'taste-score'])
    assert.ok(governance.implicitApprovalForbidden.includes(implicit), `${implicit} must not imply approval`);
  assert.ok(blocker(op, 'OWNER_DEVIATION_DECISION_REQUIRED'));
  assert.ok(proof(op, 'owner-governed-deviation'));
  assert.deepEqual(policy.reportMapping.intentionalDeviationPendingOwner,
    { outcome: 'blocked', blocker: 'interface-gap', code: 'OWNER_DEVIATION_DECISION_REQUIRED', route: 'interface.draw' });
  statesOnce(assert, op, ['counterargument'], { section: '$.steps', label: 'the auditor writes the strongest counterargument' });
});

test('no-actionable-drift is the only pass, and it needs the whole proof', () => {
  assert.equal(policy.completion.status, 'no-actionable-drift');
  assert.equal(policy.completion.requires.length, 9);
  const required = policy.completion.requires.join(' | ').toLowerCase();
  for (const term of ['owner-accepted', 'side-by-side', 'symbol', 'freshly inspected', 'hard constraint',
    'actionable finding', 'taste verdict', 'lineage'])
    assert.ok(required.includes(term), `completion.requires should cover ${term}`);
  assert.ok(proof(op, 'no-actionable-drift'));
  assert.deepEqual(policy.reportMapping.noActionableDrift, { outcome: 'done', route: 'none' });
  assert.equal(policy.reportMapping.boundedImplementationDrift.route, 'interface.implement');
  assert.equal(policy.reportMapping.systemicOrDirectionDrift.route, 'interface.draw');
  assert.equal(policy.reportMapping.grammarMissingFromCanonicalPackage.route, 'grammar.update');
});

test('the audit writes one evidence bundle and nothing else', () => {
  assert.deepEqual(op.writes.map((w) => w.id).sort(), ['evidence', 'node']);
  const evidence = writeOf(op, 'evidence');
  for (const artifact of ['findings.json', 'routing.json', 'draw-lineage.json', 'side-by-side.json',
    'realization.json', 'deviations.json', 'deviation-brief.md', 'measurements.json'])
    assert.ok(evidence.artifacts.includes(artifact), `the evidence bundle should name ${artifact}`);
  assert.deepEqual(writeOf(op, 'node').fields, ['state', 'blockedBy', 'completion.inputDigest', 'completion.evidence']);
});

test('docs/interface-audit.md explains this op by its stable identifiers', () => {
  // The doc's prose is Lane E's to rewrite; what it must keep naming are the
  // ids this manifest owns — the op, its completion status, its repair routes
  // and the rubric rows its policy bounds.
  assert.match(docs, /interface\.audit/);
  assert.ok(docs.includes(policy.completion.status), `the doc never names the completion status ${policy.completion.status}`);
  for (const route of [...op.policy.findingSchema.routing.primaryOps, policy.optionalMechanicalRoute.op])
    assert.ok(docs.includes(route), `the doc never names the repair route ${route}`);
  const [first, last] = policy.creativeRubric.rules.split('..');
  assert.ok(docs.includes(first) && docs.includes(last), `the doc never names the rubric range ${policy.creativeRubric.rules}`);
});
