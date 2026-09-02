import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const backendSource = 'source://starci-academy-be';
const businessesRoot = '.worktrees/businesses';
const featureId = 'pro-full-access';
const headRef = `${businessesRoot}/${featureId}`;
const matrixRef = `${headRef}/coverage-matrix.json`;
const evidenceRefs = ['business://evidence/pro-full-access', backendSource, 'architecture://entitlement-boundary'];
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const claimKinds = {
  'claim-actor': 'fact',
  'claim-eligibility': 'fact',
  'claim-offer': 'fact',
  'claim-read': 'fact',
  'claim-purchase': 'fact',
  'claim-payment': 'fact',
  'claim-settlement': 'fact',
  'claim-idempotency': 'fact',
  'claim-entitlement': 'fact',
  'claim-quota': 'fact',
  'claim-renewal': 'fact',
  'claim-cancellation': 'fact',
  'claim-expiry': 'fact',
  'claim-denial': 'fact',
  'claim-recovery': 'fact',
  'claim-legacy': 'fact',
  'claim-owner-intent': 'intent',
  'claim-subscription-screenshot': 'example',
};

let line = 10;
const claims = Object.entries(claimKinds).map(([claimId, kind]) => {
  line += 4;
  return {
    claimId,
    kind,
    role: kind === 'fact' ? 'enforcement source' : 'owner statement',
    statement: `Observed ${claimId} for the paid access promise.`,
    sourceRef: backendSource,
    path: `src/features/api/core/${claimId.replace('claim-', '')}.ts`,
    lineStart: line,
    lineEnd: line + 3,
    sourceHead: kind === 'fact' ? sourceHead : null,
  };
});

const citedClaims = claims.map(({ claimId, kind, role, sourceRef, path, lineStart, lineEnd, sourceHead: head }) => ({
  claimId,
  kind,
  role,
  sourceRef,
  path,
  lineStart,
  lineEnd,
  sourceHead: head,
}));

const discoveredConsumers = [
  { consumerId: 'course-access-guard', dimension: 'entitlement-consumer', sourceRef: backendSource },
  { consumerId: 'community-access-guard', dimension: 'entitlement-consumer', sourceRef: backendSource },
  { consumerId: 'ai-quota-meter', dimension: 'quota-consumer', sourceRef: backendSource },
  { consumerId: 'sepay-webhook-settle', dimension: 'settlement', sourceRef: backendSource },
  { consumerId: 'legacy-checkout-create', dimension: 'legacy-create', sourceRef: backendSource },
];

const discoveredLifecycleBranches = ['renewal', 'cancellation', 'expiry', 'recovery', 'legacy-settle'];

const proved = (dimension, owner, claimIds, consumerIds = [], disposition = 'preserve') => ({
  dimension,
  disposition,
  statement: `${dimension} is enforced by ${owner} for the paid access promise.`,
  enforcementOwner: owner,
  sourceRef: backendSource,
  positiveProofRef: `proof://positive/${dimension}`,
  negativeProofRef: `proof://negative/${dimension}`,
  deferralRef: null,
  consumerIds,
  claimIds,
});

const rows = [
  proved('actor-eligibility', 'EnrollmentGuard', ['claim-actor', 'claim-eligibility']),
  { ...proved('offer-entry', 'SubscriptionOfferResolver', ['claim-offer']), disposition: 'replace' },
  proved('read-entry', 'CourseReadResolver', ['claim-read']),
  { ...proved('purchase-side-effect', 'PurchaseSubscriptionHandler', ['claim-purchase']), disposition: 'replace' },
  proved('external-payment', 'SePayGateway', ['claim-payment']),
  proved('settlement', 'ReconcileTransactionWorker', ['claim-settlement'], ['sepay-webhook-settle']),
  proved('idempotency', 'ReconcileTransactionWorker', ['claim-idempotency']),
  proved('entitlement-consumer', 'AccessGuard', ['claim-entitlement'], ['course-access-guard', 'community-access-guard']),
  proved('quota-consumer', 'AiQuotaMeter', ['claim-quota'], ['ai-quota-meter']),
  proved('renewal', 'MembershipRenewalWorker', ['claim-renewal']),
  proved('cancellation', 'MembershipCancelHandler', ['claim-cancellation']),
  proved('expiry', 'MembershipExpiryWorker', ['claim-expiry']),
  proved('denial', 'AccessGuard', ['claim-denial']),
  {
    dimension: 'recovery',
    disposition: 'defer',
    statement: 'Failed-settlement recovery is deferred to the payment recovery objective.',
    enforcementOwner: null,
    sourceRef: null,
    positiveProofRef: null,
    negativeProofRef: null,
    deferralRef: 'objective://payment-recovery',
    consumerIds: [],
    claimIds: ['claim-recovery'],
  },
  {
    dimension: 'refund',
    disposition: 'not-applicable',
    statement: 'The paid access promise sells no refundable one-off purchase.',
    enforcementOwner: null,
    sourceRef: null,
    positiveProofRef: null,
    negativeProofRef: null,
    deferralRef: null,
    consumerIds: [],
    claimIds: [],
  },
  {
    ...proved('legacy-create', 'LegacyCheckoutHandler', ['claim-legacy'], ['legacy-checkout-create']),
    disposition: 'retire',
    negativeProofRef: null,
  },
  proved('legacy-read', 'LegacyEnrollmentResolver', ['claim-legacy']),
  proved('legacy-settle', 'ReconcileTransactionWorker', ['claim-legacy']),
];

const validInput = {
  schemaVersion: 8,
  operatorId: 'business.decide',
  context: {
    evidence: { indexRef: 'business://evidence/pro-full-access', fingerprint: hash, claims },
    authority: {
      businessesRootRef: businessesRoot,
      fingerprint: hash,
      heads: [{ featureId, headRef, state: 'pending', fingerprint: hash }],
    },
    sourceRefs: [contextRef(backendSource, sourceHead)],
    architectureRefs: [contextRef('architecture://entitlement-boundary')],
  },
  input: {
    invocationId: 'invocation-pro-access-1',
    missionId: 'mission-pro-access',
    project: {
      id: 'starci-academy',
      backendSourceRef: backendSource,
      sourceHead,
      businessesRootRef: businessesRoot,
    },
    objective: { objectiveRef: 'objective://sell-pro-full-access', featureId, intent: 'revise' },
    discovery: {
      consumers: discoveredConsumers,
      lifecycleBranches: discoveredLifecycleBranches,
    },
    publication: { targetState: 'in-progress', headRef, approvalRef: 'approval://owner/pro-full-access' },
    resume: null,
  },
};

const binding = {
  projectId: 'starci-academy',
  backendSourceRef: backendSource,
  sourceHead,
  businessesRootRef: businessesRoot,
  featureId,
  objectiveRef: 'objective://sell-pro-full-access',
  intent: 'revise',
  targetState: 'in-progress',
  evidenceFingerprint: hash,
  authorityFingerprint: hash,
  discoveryFingerprint: hash,
  coverageFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const validPublishedOutput = {
  schemaVersion: 8,
  operatorId: 'business.decide',
  output: {
    outcome: 'published',
    receipt: {
      receiptType: 'business-promise-authority',
      receiptId: 'receipt:pro-full-access',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'published',
      binding,
      decision: {
        featureId,
        headRef,
        headFingerprint: hash,
        state: 'in-progress',
        promise: {
          statement: 'A paying subscriber reads every published course, community space, and AI lane for the paid term.',
          actorStatement: 'An authenticated learner holding an active paid subscription.',
          eligibilityStatement: 'Eligibility begins at settled payment and ends at expiry, cancellation, or denial.',
        },
        lineage: {
          previousHeadRef: headRef,
          previousState: 'pending',
          transition: 'pending->in-progress',
        },
        citedClaims,
        coverage: {
          matrixRef,
          matrixFingerprint: hash,
          discoveredConsumers,
          discoveredLifecycleBranches,
          rows,
        },
        reconciliation: null,
      },
      findings: [
        {
          code: 'LEGACY_COEXISTENCE',
          severity: 'warning',
          dimension: 'legacy-create',
          statement: 'Legacy checkout creation is retired while purchased legacy rights and pending legacy settlement stay readable.',
          evidenceRefs: [backendSource],
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [headRef, matrixRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'business.decide',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'business-promise-authority',
      receiptId: 'receipt:pro-full-access-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding: { ...binding, coverageFingerprint: null },
      decision: null,
      findings: [
        {
          code: 'CONSUMER_UNDISPOSED',
          severity: 'error',
          dimension: 'entitlement-consumer',
          statement: 'The mock-interview reader consumes the entitlement and carries no disposition.',
          evidenceRefs: [backendSource],
        },
      ],
      evidenceRefs,
      failure: {
        code: 'CONSUMER_UNPROVEN',
        message: 'A discovered entitlement consumer has no disposition, so the promise cannot be published.',
        dimensions: ['entitlement-consumer'],
        missingRefs: ['proof://positive/mock-interview-access'],
        retryable: true,
        owningDomain: 'business',
      },
      resume: {
        resumeToken: 'resume-pro-full-access-1',
        requiredDelta: ['Dispose the mock-interview entitlement consumer with positive and negative proof.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validPublishedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// --- input negatives -------------------------------------------------------

// A claim citing a file nobody bound is indistinguishable from an invented claim.
const unboundClaim = structuredClone(validInput);
unboundClaim.context.evidence.claims[0].sourceRef = 'source://never-bound';
assert.equal(validateInput(unboundClaim).valid, false);

// The businesses root is flat. A project segment below it starts a second authority tree.
const nestedHead = structuredClone(validInput);
nestedHead.input.publication.headRef = `${businessesRoot}/starci-academy/${featureId}`;
assert.equal(validateInput(nestedHead).valid, false);

// Publishing pending over a live in-progress head silently discards published authority.
const overwriteLiveHead = structuredClone(validInput);
overwriteLiveHead.context.authority.heads[0].state = 'in-progress';
overwriteLiveHead.input.publication.targetState = 'pending';
assert.equal(validateInput(overwriteLiveHead).valid, false);

// The same consumer declared twice inflates coverage without proving anything.
const duplicateConsumer = structuredClone(validInput);
duplicateConsumer.input.discovery.consumers.push(duplicateConsumer.input.discovery.consumers[0]);
assert.equal(validateInput(duplicateConsumer).valid, false);

// A resume with no added material is NO_PROGRESS wearing a token.
const emptyResume = structuredClone(validInput);
emptyResume.input.resume = {
  blockedReceiptRef: 'receipt:pro-full-access-blocked',
  resumeToken: 'resume-pro-full-access-1',
  addedContextRefs: [],
};
assert.equal(validateInput(emptyResume).valid, false);

// --- output negatives ------------------------------------------------------

// The defect this operator exists for: a discovered consumer published with no disposition.
const undisposedConsumer = structuredClone(validPublishedOutput);
undisposedConsumer.output.receipt.decision.coverage.rows[8].consumerIds = [];
const undisposedResult = validateOutput(undisposedConsumer);
assert.equal(undisposedResult.valid, false);
assert.ok(undisposedResult.errors.some((error) => error.includes('ai-quota-meter') && error.includes('no disposition')));

// A mandatory dimension cannot be waved away as inapplicable.
const waivedMandatory = structuredClone(validPublishedOutput);
waivedMandatory.output.receipt.decision.coverage.rows[12] = {
  dimension: 'denial',
  disposition: 'not-applicable',
  statement: 'Denial was not considered.',
  enforcementOwner: null,
  sourceRef: null,
  positiveProofRef: null,
  negativeProofRef: null,
  deferralRef: null,
  consumerIds: [],
  claimIds: [],
};
const waivedMandatoryResult = validateOutput(waivedMandatory);
assert.equal(waivedMandatoryResult.valid, false);
assert.ok(waivedMandatoryResult.errors.some((error) => error.includes('denial') && error.includes('mandatory')));

// A lifecycle branch observed in the source cannot be declared inapplicable afterwards.
const waivedDiscoveredBranch = structuredClone(validPublishedOutput);
waivedDiscoveredBranch.output.receipt.decision.coverage.rows[9] = {
  dimension: 'renewal',
  disposition: 'not-applicable',
  statement: 'Renewal was skipped.',
  enforcementOwner: null,
  sourceRef: null,
  positiveProofRef: null,
  negativeProofRef: null,
  deferralRef: null,
  consumerIds: [],
  claimIds: [],
};
const waivedBranchResult = validateOutput(waivedDiscoveredBranch);
assert.equal(waivedBranchResult.valid, false);
assert.ok(waivedBranchResult.errors.some((error) => error.includes('renewal') && error.includes('discovered in the source')));

// Happy-path-only proof: nothing shows the promise is denied when it should be.
const noNegativeProof = structuredClone(validPublishedOutput);
noNegativeProof.output.receipt.decision.coverage.rows[7].negativeProofRef = null;
const noNegativeResult = validateOutput(noNegativeProof);
assert.equal(noNegativeResult.valid, false);
assert.ok(noNegativeResult.errors.some((error) => error.includes('negative proof')));

// A screenshot illustrates a promise; it never creates one.
const exampleAsTruth = structuredClone(validPublishedOutput);
exampleAsTruth.output.receipt.decision.coverage.rows[7].claimIds = ['claim-subscription-screenshot'];
const exampleResult = validateOutput(exampleAsTruth);
assert.equal(exampleResult.valid, false);
assert.ok(exampleResult.errors.some((error) => error.includes('never create product truth')));

// A deferred row cannot claim proof for work that has not happened.
const deferredWithProof = structuredClone(validPublishedOutput);
deferredWithProof.output.receipt.decision.coverage.rows[13].positiveProofRef = 'proof://positive/recovery';
const deferredResult = validateOutput(deferredWithProof);
assert.equal(deferredResult.valid, false);
assert.ok(deferredResult.errors.some((error) => error.includes('has not happened')));

// A dropped dimension leaves a silent hole in a matrix that claims to be complete.
const missingDimension = structuredClone(validPublishedOutput);
missingDimension.output.receipt.decision.coverage.rows[16].dimension = 'legacy-settle';
const missingResult = validateOutput(missingDimension);
assert.equal(missingResult.valid, false);
assert.ok(missingResult.errors.some((error) => error.includes('legacy-read') && error.includes('no disposition')));

// A head one segment deeper than the flat root hides authority from every later reader.
const nestedPublishedHead = structuredClone(validPublishedOutput);
nestedPublishedHead.output.receipt.decision.headRef = `${businessesRoot}/starci-academy/${featureId}`;
nestedPublishedHead.output.artifactRefs = [nestedPublishedHead.output.receipt.decision.headRef, matrixRef];
const nestedHeadResult = validateOutput(nestedPublishedHead);
assert.equal(nestedHeadResult.valid, false);
assert.ok(nestedHeadResult.errors.some((error) => error.includes('no project segment below the businesses root')));

// `implemented` without reconciliation is a claim of delivery with no delivered source behind it.
const unreconciledImplemented = structuredClone(validPublishedOutput);
unreconciledImplemented.output.receipt.binding.targetState = 'implemented';
unreconciledImplemented.output.receipt.decision.state = 'implemented';
unreconciledImplemented.output.receipt.decision.lineage = {
  previousHeadRef: headRef,
  previousState: 'in-progress',
  transition: 'in-progress->implemented',
};
const unreconciledResult = validateOutput(unreconciledImplemented);
assert.equal(unreconciledResult.valid, false);
assert.ok(unreconciledResult.errors.some((error) => error.includes('reconciliation')));

// Rejection preserves lineage; a rejected head with no predecessor erases it.
const lineagelessRejection = structuredClone(validPublishedOutput);
lineagelessRejection.output.receipt.binding.targetState = 'rejected';
lineagelessRejection.output.receipt.decision.state = 'rejected';
lineagelessRejection.output.receipt.decision.lineage = {
  previousHeadRef: null,
  previousState: 'in-progress',
  transition: 'in-progress->rejected',
};
const lineagelessResult = validateOutput(lineagelessRejection);
assert.equal(lineagelessResult.valid, false);
assert.ok(lineagelessResult.errors.some((error) => error.includes('rejection preserves lineage')));

// A transition the lifecycle does not publish would let a head skip its unproved states.
const illegalTransition = structuredClone(validPublishedOutput);
illegalTransition.output.receipt.decision.lineage.transition = 'implemented->in-progress';
const illegalResult = validateOutput(illegalTransition);
assert.equal(illegalResult.valid, false);
assert.ok(illegalResult.errors.some((error) => error.includes('contradicts previousState')));

// If the frozen fingerprints disagree, backend and UAT cannot prove they read the same matrix.
const driftedCoverageFingerprint = structuredClone(validPublishedOutput);
driftedCoverageFingerprint.output.receipt.binding.coverageFingerprint = `sha256:${'c'.repeat(64)}`;
const driftResult = validateOutput(driftedCoverageFingerprint);
assert.equal(driftResult.valid, false);
assert.ok(driftResult.errors.some((error) => error.includes('coverageFingerprint')));

// A published promise cannot ship while an error finding stands open.
const publishedWithError = structuredClone(validPublishedOutput);
publishedWithError.output.receipt.findings[0].severity = 'error';
const publishedErrorResult = validateOutput(publishedWithError);
assert.equal(publishedErrorResult.valid, false);
assert.ok(publishedErrorResult.errors.some((error) => error.includes('error finding')));

// A blocked receipt that still carries a decision publishes authority through the failure path.
const blockedWithDecision = structuredClone(validBlockedOutput);
blockedWithDecision.output.receipt.decision = validPublishedOutput.output.receipt.decision;
const blockedDecisionResult = validateOutput(blockedWithDecision);
assert.equal(blockedDecisionResult.valid, false);
assert.ok(blockedDecisionResult.errors.some((error) => error.includes('blocked receipt cannot carry a decision')));

// A non-retryable failure with a resume token invites an endless retry of a dead end.
const nonRetryableResume = structuredClone(validBlockedOutput);
nonRetryableResume.output.receipt.failure.retryable = false;
const nonRetryableResult = validateOutput(nonRetryableResume);
assert.equal(nonRetryableResult.valid, false);
assert.ok(nonRetryableResult.errors.some((error) => error.includes('non-retryable failure forbids one')));

console.log('business.decide self-test passed');
