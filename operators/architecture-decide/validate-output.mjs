import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * The adverse paths a decision must survive. A critique that skips one has not attacked the
 * decision; it has described it under good weather.
 */
const ADVERSE_PATHS = [
  'partial-failure',
  'retry-idempotency',
  'concurrency',
  'stale-state',
  'deletion',
  'recovery',
  'dependency-outage',
  'rollback',
];

/** Every axis a retained stack component must actually have been checked against. */
const COMPATIBILITY_AXES = [
  'runtime-version',
  'deployable-unit',
  'communication-failure',
  'datastore-ownership',
  'backup-restore',
];

const IMPLEMENTATION_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rb|rs|php|sql)$/i;

function sameSet(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, evidenceRefs, artifactRefs, handoff } = value.output;
  const { status, binding, decision, findings, failure, resume } = receipt;

  if (handoff !== null) errors.push('architecture.decide never emits a handoff');
  if (outcome !== status) errors.push('output.outcome must equal receipt.status');
  if (!sameSet(receipt.evidenceRefs, evidenceRefs)) {
    errors.push('receipt.evidenceRefs and output.evidenceRefs must be identical sets');
  }

  if (outcome === 'decided') {
    if (decision === null) errors.push('a decided receipt requires a decision');
    if (failure !== null) errors.push('a decided receipt cannot carry a failure');
    if (resume !== null) errors.push('a decided receipt cannot carry a resume');
    if (findings.some((item) => item.severity === 'error')) {
      errors.push('a decided receipt cannot retain an error finding');
    }
  } else {
    if (decision !== null) errors.push('a blocked receipt cannot carry a decision');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    if (binding.currentStateFingerprint !== null && failure?.code === 'CURRENT_STATE_UNOBSERVED') {
      errors.push('CURRENT_STATE_UNOBSERVED cannot freeze a current-state fingerprint');
    }
  }

  if (failure !== null && failure.retryable !== (resume !== null)) {
    errors.push('a retryable failure requires a resume and a non-retryable failure forbids one');
  }

  if (decision === null) return errors;

  const root = binding.artifactRootRef.replace(/[\\/]+$/, '');
  const registered = new Set(artifactRefs);
  for (const ref of artifactRefs) {
    if (!(ref === root || ref.startsWith(`${root}/`))) {
      errors.push(`artifact ref must stay under artifactRootRef: ${ref}`);
    }
  }

  // Observed current state, at the frozen head, before any proposal.
  if (decision.currentState.observedSourceHead !== binding.sourceHead) {
    errors.push('the current state was observed at a different source head than the decision is bound to');
  }
  if (binding.currentStateFingerprint !== decision.currentState.fingerprint) {
    errors.push('binding.currentStateFingerprint must equal the observed current-state fingerprint');
  }
  if (!registered.has(decision.currentState.observedRef)) {
    errors.push('artifactRefs must register the observed current state');
  }

  // The rendered comparison. Prose and diagrams alone are not architecture proof, so the comparison
  // is an inspectable page and it is registered as an artifact.
  if (!decision.comparisonArtifactRef.toLowerCase().endsWith('.html')) {
    errors.push('the alternative comparison must be an inspectable HTML page, not prose or a diagram reference');
  }
  if (!registered.has(decision.comparisonArtifactRef)) {
    errors.push('artifactRefs must register the alternative comparison');
  }
  if (!registered.has(decision.stack.modelRef)) errors.push('artifactRefs must register the stack model');
  if (!registered.has(decision.critique.critiqueRef)) errors.push('artifactRefs must register the critique');

  // Alternatives: one selected, at least one genuinely rejected, all compared on the same axes.
  const alternativeIds = decision.alternatives.map((item) => item.id);
  if (new Set(alternativeIds).size !== alternativeIds.length) {
    errors.push('alternative identifiers must be unique');
  }
  const selected = decision.alternatives.filter((item) => item.verdict === 'selected');
  const rejected = decision.alternatives.filter((item) => item.verdict === 'rejected');
  if (selected.length !== 1) errors.push('exactly one alternative may be selected');
  else if (selected[0].id !== decision.selectedAlternativeId) {
    errors.push('selectedAlternativeId must name the selected alternative');
  }
  if (rejected.length === 0) {
    errors.push('at least one genuine alternative must be considered and rejected with a reason');
  }
  for (const alternative of decision.alternatives) {
    if (alternative.verdict === 'rejected' && alternative.rejectionReason === null) {
      errors.push(`alternative ${alternative.id} was rejected without a reason`);
    }
    if (alternative.verdict === 'selected' && alternative.rejectionReason !== null) {
      errors.push(`selected alternative ${alternative.id} cannot carry a rejection reason`);
    }
    const axes = alternative.criteria.map((item) => item.axis);
    if (new Set(axes).size !== axes.length) {
      errors.push(`alternative ${alternative.id} assesses one axis more than once`);
    }
    if (!sameSet(axes, binding.tradeoffAxes)) {
      errors.push(`alternative ${alternative.id} is not assessed on the same criteria as the decision, so the comparison proves nothing`);
    }
  }

  if (binding.selectionPolicy === 'approval-required') {
    if (binding.approvedAlternativeId === null) {
      errors.push('an approval-required decision must bind the approved alternative');
    } else if (binding.approvedAlternativeId !== decision.selectedAlternativeId) {
      errors.push('the selected alternative differs from the alternative the owner approved');
    }
  } else if (binding.approvedAlternativeId !== null) {
    errors.push('an automatic selection policy cannot bind an owner approval');
  }

  // Boundaries and data ownership. Every boundary answers the data question, one way or the other.
  const boundaryIds = decision.boundaries.map((item) => item.boundaryId);
  if (new Set(boundaryIds).size !== boundaryIds.length) errors.push('boundary identifiers must be unique');
  const knownBoundary = new Set(boundaryIds);
  const owningBoundaries = new Set();
  const storeIds = new Set();

  for (const store of decision.dataOwnership) {
    if (storeIds.has(store.storeId)) errors.push(`store ${store.storeId} is modelled more than once`);
    storeIds.add(store.storeId);
    if (!knownBoundary.has(store.owningBoundaryId)) {
      errors.push(`store ${store.storeId} is owned by unknown boundary ${store.owningBoundaryId}`);
    }
    owningBoundaries.add(store.owningBoundaryId);
    for (const id of [...store.writerBoundaryIds, ...store.readerBoundaryIds, ...store.migratorBoundaryIds]) {
      if (!knownBoundary.has(id)) errors.push(`store ${store.storeId} names unknown boundary ${id}`);
    }
    if (!store.writerBoundaryIds.includes(store.owningBoundaryId)) {
      errors.push(`store ${store.storeId} is owned by a boundary that never writes it`);
    }
    // A second writer is possible, but it is never accidental. Unjustified shared write is how a
    // store ends up with no real owner at all.
    if (store.writerBoundaryIds.length > 1 && store.sharedWriteJustification === null) {
      errors.push(`store ${store.storeId} has more than one writing boundary and no shared-write justification`);
    }
    if (store.writerBoundaryIds.length === 1 && store.sharedWriteJustification !== null) {
      errors.push(`store ${store.storeId} justifies a shared write it does not have`);
    }
  }

  for (const boundary of decision.boundaries) {
    if (boundary.ownsData && !owningBoundaries.has(boundary.boundaryId)) {
      errors.push(`boundary ${boundary.boundaryId} claims to own data but no store names it as owner`);
    }
    if (!boundary.ownsData && owningBoundaries.has(boundary.boundaryId)) {
      errors.push(`boundary ${boundary.boundaryId} owns a store while declaring that it owns no data`);
    }
  }

  // Tech stack. Compatibility is verified, never assumed, and incumbency is not a justification.
  const stackIds = new Set();
  for (const component of decision.stack.components) {
    if (stackIds.has(component.componentId)) {
      errors.push(`stack component ${component.componentId} appears more than once`);
    }
    stackIds.add(component.componentId);

    if (component.justificationKind === 'incumbency') {
      errors.push(`stack component ${component.componentId} is justified by incumbency; an existing choice is a constraint or evidence, never truth`);
    }

    if (component.status === 'removed') {
      if (component.compatibility.verdict !== 'unverified' || component.compatibility.checkedAxes.length > 0) {
        errors.push(`removed component ${component.componentId} cannot carry a compatibility verdict for a stack it has left`);
      }
    } else {
      if (component.compatibility.verdict !== 'verified') {
        errors.push(`retained component ${component.componentId} carries an unverified compatibility verdict`);
      }
      if (component.compatibility.evidenceRefs.length === 0) {
        errors.push(`component ${component.componentId} claims compatibility with no evidence behind it`);
      }
      for (const axis of COMPATIBILITY_AXES) {
        if (!component.compatibility.checkedAxes.includes(axis)) {
          errors.push(`component ${component.componentId} was never checked against ${axis}`);
        }
      }
    }
  }

  // Independent critique. It must be written by someone other than the decider, and it must attack
  // the decision that was actually taken.
  if (decision.critique.reviewerRef === decision.authorRef) {
    errors.push('the critique is authored by the deciding role, so it is not independent');
  }
  const attacksOnSelected = new Set();
  for (const attack of decision.critique.attacks) {
    if (!alternativeIds.includes(attack.targetAlternativeId)) {
      errors.push(`critique attacks unknown alternative ${attack.targetAlternativeId}`);
    }
    if (attack.targetAlternativeId === decision.selectedAlternativeId) {
      attacksOnSelected.add(attack.adversePath);
    }
  }
  for (const path of ADVERSE_PATHS) {
    if (!attacksOnSelected.has(path)) {
      errors.push(`the selected architecture was never attacked under ${path}`);
    }
  }

  // The handoff freezes the decision; it never names the files that will implement it.
  for (const ref of decision.affectedContractRefs) {
    if (IMPLEMENTATION_FILE.test(ref)) {
      errors.push(`affected contract ${ref} names an implementation file; the handoff freezes contracts, not source`);
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
