import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * The closed coverage surface. A published promise answers every one of these, so a dimension
 * nobody thought about cannot simply be absent from the matrix.
 */
const ALL_DIMENSIONS = [
  'actor-eligibility',
  'offer-entry',
  'read-entry',
  'purchase-side-effect',
  'external-payment',
  'settlement',
  'idempotency',
  'entitlement-consumer',
  'quota-consumer',
  'renewal',
  'cancellation',
  'expiry',
  'denial',
  'recovery',
  'refund',
  'legacy-create',
  'legacy-read',
  'legacy-settle',
];

/**
 * A promise always has an actor, an entry, a purchase effect, a settlement, an idempotency answer,
 * an entitlement consumer, and a denial path. Marking one of these "not applicable" is how
 * "full access" was published while its downstream consumers were never proved.
 */
const MANDATORY_DIMENSIONS = new Set([
  'actor-eligibility',
  'offer-entry',
  'read-entry',
  'purchase-side-effect',
  'settlement',
  'idempotency',
  'entitlement-consumer',
  'denial',
]);

const LEGAL_TRANSITIONS = {
  'absent->pending': { from: null, to: 'pending' },
  'pending->in-progress': { from: 'pending', to: 'in-progress' },
  'pending->rejected': { from: 'pending', to: 'rejected' },
  'in-progress->implemented': { from: 'in-progress', to: 'implemented' },
  'in-progress->rejected': { from: 'in-progress', to: 'rejected' },
  'implemented->in-progress': { from: 'implemented', to: 'in-progress' },
  'implemented->rejected': { from: 'implemented', to: 'rejected' },
  'rejected->pending': { from: 'rejected', to: 'pending' },
};

function sameSet(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, evidenceRefs, artifactRefs, handoff } = value.output;
  const { status, binding, decision, findings, failure, resume } = receipt;

  if (handoff !== null) errors.push('business.decide never emits a handoff');
  if (outcome !== status) errors.push('output.outcome must equal receipt.status');
  if (!sameSet(receipt.evidenceRefs, evidenceRefs)) {
    errors.push('receipt.evidenceRefs and output.evidenceRefs must be identical sets');
  }

  if (outcome === 'published') {
    if (decision === null) errors.push('a published receipt requires a decision');
    if (failure !== null) errors.push('a published receipt cannot carry a failure');
    if (resume !== null) errors.push('a published receipt cannot carry a resume');
    if (findings.some((item) => item.severity === 'error')) {
      errors.push('a published receipt cannot retain an error finding');
    }
  } else {
    if (decision !== null) errors.push('a blocked receipt cannot carry a decision');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    if (binding.coverageFingerprint !== null) {
      errors.push('a blocked receipt cannot freeze a coverage fingerprint');
    }
  }

  if (failure !== null && failure.retryable !== (resume !== null)) {
    errors.push('a retryable failure requires a resume and a non-retryable failure forbids one');
  }

  if (decision === null) return errors;

  // Authority boundary. The head is one flat segment below the businesses root, and every artifact
  // this operator writes stays inside that root.
  const root = binding.businessesRootRef.replace(/[\\/]+$/, '');
  const expectedHeadRef = `${root}/features/${decision.featureId}`;
  if (decision.headRef !== expectedHeadRef) {
    errors.push(`head ${decision.headRef} must be exactly ${expectedHeadRef}: the feature directory, with no project segment below the businesses root`);
  }
  if (!artifactRefs.includes(decision.headRef)) {
    errors.push('artifactRefs must register the published feature head');
  }
  for (const ref of artifactRefs) {
    if (!(ref === root || ref.startsWith(`${root}/`))) {
      errors.push(`artifact ref must stay under the businesses root: ${ref}`);
    }
  }

  if (binding.featureId !== decision.featureId) errors.push('binding.featureId must equal decision.featureId');
  if (binding.targetState !== decision.state) errors.push('binding.targetState must equal decision.state');
  if (binding.coverageFingerprint !== decision.coverage.matrixFingerprint) {
    errors.push('binding.coverageFingerprint must equal the coverage matrix fingerprint, or backend and UAT cannot correlate the same matrix');
  }

  // Lifecycle. A state that arrives through an unlisted transition has no lineage behind it.
  const transition = LEGAL_TRANSITIONS[decision.lineage.transition];
  if (transition) {
    if (transition.from !== decision.lineage.previousState) {
      errors.push(`transition ${decision.lineage.transition} contradicts previousState ${String(decision.lineage.previousState)}`);
    }
    if (transition.to !== decision.state) {
      errors.push(`transition ${decision.lineage.transition} contradicts published state ${decision.state}`);
    }
  }
  if (decision.lineage.previousState === null && decision.lineage.previousHeadRef !== null) {
    errors.push('a first publication cannot name a previous head');
  }
  if (decision.lineage.previousState !== null && decision.lineage.previousHeadRef === null) {
    errors.push('a transition from an existing state must name the previous head, because rejection preserves lineage');
  }
  if (decision.state === 'implemented') {
    if (decision.reconciliation === null) {
      errors.push('an implemented head requires reconciliation against delivered source');
    } else if (decision.reconciliation.discrepancies.length > 0) {
      errors.push('an implemented head cannot carry an unresolved reconciliation discrepancy');
    }
  }

  const citedById = new Map(decision.citedClaims.map((item) => [item.claimId, item]));
  if (citedById.size !== decision.citedClaims.length) {
    errors.push('citedClaims must not repeat a claim identifier');
  }
  for (const claim of decision.citedClaims) {
    if (claim.lineEnd < claim.lineStart) errors.push(`cited claim ${claim.claimId} has an inverted line range`);
    if (claim.kind === 'fact' && claim.sourceHead === null) {
      errors.push(`cited fact claim ${claim.claimId} must bind the observed source head`);
    }
  }

  // Coverage completeness.
  const { coverage } = decision;
  const rowByDimension = new Map();
  for (const row of coverage.rows) {
    if (rowByDimension.has(row.dimension)) {
      errors.push(`coverage dimension ${row.dimension} appears in more than one row`);
    }
    rowByDimension.set(row.dimension, row);
  }
  for (const dimension of ALL_DIMENSIONS) {
    if (!rowByDimension.has(dimension)) {
      errors.push(`coverage dimension ${dimension} has no disposition`);
    }
  }

  const claimedConsumers = new Map();
  for (const row of coverage.rows) {
    const { dimension, disposition } = row;

    if (disposition === 'not-applicable' && MANDATORY_DIMENSIONS.has(dimension)) {
      errors.push(`${dimension} is mandatory for a published promise and cannot be marked not-applicable`);
    }

    if (disposition === 'preserve' || disposition === 'replace') {
      if (row.enforcementOwner === null) errors.push(`${dimension} names no enforcement owner`);
      if (row.sourceRef === null) errors.push(`${dimension} names no enforcing source`);
      if (row.positiveProofRef === null) errors.push(`${dimension} has no positive proof`);
      if (row.negativeProofRef === null) {
        errors.push(`${dimension} has no negative proof, so nothing shows the promise is denied when it should be`);
      }
    }
    if (disposition === 'retire') {
      if (row.enforcementOwner === null) errors.push(`retired ${dimension} names no owner of the retirement`);
      if (row.sourceRef === null) errors.push(`retired ${dimension} names no source where the path was closed`);
      if (row.positiveProofRef === null) errors.push(`retired ${dimension} has no proof the path is closed`);
    }
    if (disposition === 'defer') {
      if (row.deferralRef === null) errors.push(`deferred ${dimension} names no deferral owner reference`);
      if (row.positiveProofRef !== null || row.negativeProofRef !== null) {
        errors.push(`deferred ${dimension} cannot claim proof for work that has not happened`);
      }
    }
    if (disposition === 'not-applicable') {
      if (
        row.enforcementOwner !== null ||
        row.sourceRef !== null ||
        row.positiveProofRef !== null ||
        row.negativeProofRef !== null ||
        row.deferralRef !== null ||
        row.consumerIds.length > 0 ||
        row.claimIds.length > 0
      ) {
        errors.push(`${dimension} is marked not-applicable but still carries owners, proof, consumers, or claims`);
      }
    }

    for (const claimId of row.claimIds) {
      if (!citedById.has(claimId)) errors.push(`${dimension} cites claim ${claimId}, which is absent from citedClaims`);
    }
    // An example or a screenshot illustrates a promise; it never creates one. A disposition that
    // asserts enforcement must rest on at least one observed fact.
    if (disposition === 'preserve' || disposition === 'replace' || disposition === 'retire') {
      const kinds = row.claimIds.map((claimId) => citedById.get(claimId)?.kind);
      if (!kinds.includes('fact')) {
        errors.push(`${dimension} asserts enforcement without one fact claim; examples and intent never create product truth`);
      }
    }

    for (const consumerId of row.consumerIds) {
      if (claimedConsumers.has(consumerId)) {
        errors.push(`consumer ${consumerId} is disposed in more than one row`);
      }
      claimedConsumers.set(consumerId, dimension);
    }
  }

  // The rule the "full access" release lacked: nothing discovered may pass without a disposition.
  for (const consumer of coverage.discoveredConsumers) {
    const disposedAt = claimedConsumers.get(consumer.consumerId);
    if (disposedAt === undefined) {
      errors.push(`discovered consumer ${consumer.consumerId} has no disposition in the coverage matrix`);
    } else if (disposedAt !== consumer.dimension) {
      errors.push(`discovered consumer ${consumer.consumerId} was discovered under ${consumer.dimension} but disposed under ${disposedAt}`);
    }
  }
  for (const consumerId of claimedConsumers.keys()) {
    if (!coverage.discoveredConsumers.some((item) => item.consumerId === consumerId)) {
      errors.push(`row consumer ${consumerId} was never discovered, so no evidence supports it`);
    }
  }
  for (const branch of coverage.discoveredLifecycleBranches) {
    const row = rowByDimension.get(branch);
    if (row && row.disposition === 'not-applicable') {
      errors.push(`lifecycle branch ${branch} was discovered in the source and cannot be marked not-applicable`);
    }
  }

  if (!artifactRefs.includes(coverage.matrixRef)) {
    errors.push('artifactRefs must register the coverage matrix');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
