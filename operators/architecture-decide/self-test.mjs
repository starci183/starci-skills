import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const otherHead = 'd'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const backendSource = 'source://starci-academy-be';
const manifestRef = 'source://starci-academy-be/package.json';
const composeRef = 'source://starci-academy-be/compose.yaml';
const artifactRoot = '.v8/artifacts/invocation-entitlement-1';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const tradeoffAxes = ['correctness', 'consistency', 'operability', 'latency', 'migration'];
const compatibilityAxes = [
  'runtime-version',
  'deployable-unit',
  'communication-failure',
  'datastore-ownership',
  'backup-restore',
];

const validInput = {
  schemaVersion: 8,
  operatorId: 'architecture.decide',
  context: {
    businessRefs: [contextRef('business://pro-full-access')],
    sourceRefs: [contextRef(backendSource, sourceHead), contextRef(manifestRef, sourceHead), contextRef(composeRef, sourceHead)],
    inventory: {
      inventoryRef: 'inventory://starci-academy-be',
      fingerprint: hash,
      components: [
        { componentId: 'nestjs', layer: 'framework', name: 'NestJS', version: '10.4.0', evidenceRef: manifestRef },
        { componentId: 'postgres', layer: 'persistence', name: 'PostgreSQL', version: '16.2', evidenceRef: composeRef },
        { componentId: 'redis-entitlement-cache', layer: 'persistence', name: 'Redis', version: '7.2', evidenceRef: composeRef },
      ],
    },
    patternRefs: [contextRef('pattern://single-writer-store')],
    priorDecisionRefs: [],
  },
  input: {
    invocationId: 'invocation-entitlement-1',
    missionId: 'mission-entitlement',
    project: {
      id: 'starci-academy',
      backendSourceRef: backendSource,
      sourceHead,
      artifactRootRef: artifactRoot,
    },
    objective: {
      objectiveRef: 'objective://one-entitlement-read-path',
      decisionId: 'entitlement-read-path',
      tradeoffAxes,
    },
    constraints: [
      {
        constraintId: 'one-answer-per-viewer',
        kind: 'fixed-intent',
        statement: 'Every consumer of paid access must reach the same answer for the same viewer.',
      },
      {
        constraintId: 'read-budget',
        kind: 'measurable',
        statement: 'An entitlement read completes within 40ms at the ninety-ninth percentile.',
      },
      {
        constraintId: 'no-new-datastore-vendor',
        kind: 'measurable',
        statement: 'The decision adds no persistence vendor beyond the two already operated.',
      },
      {
        constraintId: 'operator-familiarity',
        kind: 'preference',
        statement: 'Operators prefer components they already run in production.',
      },
      {
        constraintId: 'quota-growth',
        kind: 'assumption',
        statement: 'AI quota reads grow faster than course reads over the next two terms.',
      },
    ],
    selectionPolicy: 'approval-required',
    approval: {
      approvalRef: 'approval://owner/entitlement-read-path',
      approvedAlternativeId: 'shared-entitlement-service',
      fingerprint: hash,
    },
    resume: null,
  },
};

const criteriaFor = (id) =>
  tradeoffAxes.map((axis) => ({ axis, assessment: `${id} assessed for ${axis} against the frozen constraints.` }));

const alternatives = [
  {
    id: 'shared-entitlement-service',
    summary: 'One entitlement boundary answers every consumer over a synchronous read interface.',
    materialDifference: 'A single boundary owns the entitlement store and every other boundary reads through it.',
    verdict: 'selected',
    rejectionReason: null,
    criteria: criteriaFor('shared-entitlement-service'),
  },
  {
    id: 'per-feature-guards',
    summary: 'Each feature keeps its own guard and reads the subscription tables directly.',
    materialDifference: 'No boundary owns the answer; every feature derives it independently.',
    verdict: 'rejected',
    rejectionReason: 'Independent derivation is what let the published promise disagree with the guards.',
    criteria: criteriaFor('per-feature-guards'),
  },
  {
    id: 'edge-cached-claims',
    summary: 'Entitlements are minted into signed claims and cached at the edge.',
    materialDifference: 'The answer becomes a token with a lifetime instead of a read.',
    verdict: 'rejected',
    rejectionReason: 'Cancellation and denial cannot take effect inside the claim lifetime.',
    criteria: criteriaFor('edge-cached-claims'),
  },
];

const boundaries = [
  {
    boundaryId: 'entitlement-authority',
    responsibility: 'Owns whether a viewer currently holds paid access and answers every consumer.',
    ownerRef: 'team://backend-core',
    interfaceRefs: ['contract://entitlement/read'],
    ownsData: true,
  },
  {
    boundaryId: 'course-delivery',
    responsibility: 'Serves course content once entitlement has answered.',
    ownerRef: 'team://backend-learning',
    interfaceRefs: ['contract://course/read'],
    ownsData: false,
  },
  {
    boundaryId: 'payment-settlement',
    responsibility: 'Settles external payments and records the ledger entry that grants access.',
    ownerRef: 'team://backend-payments',
    interfaceRefs: ['contract://settlement/webhook'],
    ownsData: true,
  },
];

const dataOwnership = [
  {
    storeId: 'entitlement-db',
    owningBoundaryId: 'entitlement-authority',
    writerBoundaryIds: ['entitlement-authority'],
    readerBoundaryIds: ['entitlement-authority'],
    migratorBoundaryIds: ['entitlement-authority'],
    transactionScope: 'One transaction per entitlement grant, revoke, or expiry.',
    backupRef: 'runbook://backup/entitlement-db',
    restoreRef: 'runbook://restore/entitlement-db',
    sharedWriteJustification: null,
  },
  {
    storeId: 'settlement-ledger',
    owningBoundaryId: 'payment-settlement',
    writerBoundaryIds: ['payment-settlement', 'entitlement-authority'],
    readerBoundaryIds: ['payment-settlement', 'entitlement-authority'],
    migratorBoundaryIds: ['payment-settlement'],
    transactionScope: 'One transaction per settled payment, keyed by the gateway reference.',
    backupRef: 'runbook://backup/settlement-ledger',
    restoreRef: 'runbook://restore/settlement-ledger',
    sharedWriteJustification:
      'Entitlement writes the compensating reversal row in the same transaction that revokes access, so the ledger and the grant cannot diverge.',
  },
];

const component = (componentId, name, version, role, status, justificationKind, justification) => ({
  componentId,
  name,
  version,
  role,
  status,
  justificationKind,
  justification,
  evidenceRefs: [manifestRef, composeRef],
  compatibility: {
    verdict: 'verified',
    checkedAxes: [...compatibilityAxes],
    evidenceRefs: [`proof://compatibility/${componentId}`],
  },
});

const stackComponents = [
  component('nestjs', 'NestJS', '10.4.0', 'Hosts every boundary as a module.', 'existing', 'observed-evidence', 'The framework is observed in the manifest and satisfies the module boundary requirement.'),
  component('postgres', 'PostgreSQL', '16.2', 'Holds the entitlement store and the settlement ledger.', 'existing', 'measured-constraint', 'Transactional single-writer ownership is required and measured at the read budget.'),
  component('kafka-debezium', 'Kafka with Debezium', '3.7.0', 'Feeds the entitlement projection from settlement changes.', 'added', 'requirement-fit', 'Change capture is the only path that keeps the projection consistent without a second writer.'),
  {
    ...component('redis-entitlement-cache', 'Redis', '7.2', 'Previously cached derived entitlement answers.', 'removed', 'observed-evidence', 'The cache is removed because the owning boundary now answers directly.'),
    compatibility: { verdict: 'unverified', checkedAxes: [], evidenceRefs: [] },
  },
];

const attacks = [
  ['partial-failure', 'The settlement write succeeds while the projection feed is down.', 'The grant stays unread until the projection catches up, and the read returns denied rather than a guess.'],
  ['retry-idempotency', 'A gateway webhook is delivered twice for one payment.', 'The ledger is keyed by the gateway reference, so the second delivery updates nothing.'],
  ['concurrency', 'A renewal and a cancellation are processed at the same instant.', 'Both take the store row lock in the owning boundary, so the later one observes the earlier.'],
  ['stale-state', 'A consumer holds a read answer from before a revocation.', 'The read carries no lifetime, so the next consumer read observes the revocation immediately.'],
  ['deletion', 'A learner account is deleted while entitlements remain.', 'Deletion cascades from the owning boundary and the ledger keeps an anonymised settlement row.'],
  ['recovery', 'The entitlement store is restored from backup after corruption.', 'The projection is rebuilt from the ledger, which is the durable record of every grant.'],
  ['dependency-outage', 'The change-capture pipeline is unavailable for an hour.', 'Reads continue against the last consistent projection and settlement queues rather than failing open.'],
  ['rollback', 'The decision is reverted after partial migration.', 'Per-feature guards are still readable during the migration window, so the rollback restores them without data loss.'],
].map(([adversePath, statement, resolution]) => ({
  adversePath,
  targetAlternativeId: 'shared-entitlement-service',
  statement,
  resolution,
  residualRisk: null,
}));

attacks.push({
  adversePath: 'stale-state',
  targetAlternativeId: 'edge-cached-claims',
  statement: 'A cancelled viewer keeps a valid signed claim until it expires.',
  resolution: 'The alternative was rejected for exactly this reason.',
  residualRisk: null,
});

const comparisonArtifactRef = `${artifactRoot}/entitlement-alternatives.html`;
const currentStateRef = `${artifactRoot}/current-state.json`;
const stackModelRef = `${artifactRoot}/stack-model.json`;
const critiqueRef = `${artifactRoot}/independent-critique.json`;
const artifactRefs = [currentStateRef, comparisonArtifactRef, stackModelRef, critiqueRef];
const evidenceRefs = ['business://pro-full-access', backendSource, manifestRef, composeRef, 'inventory://starci-academy-be'];

const binding = {
  projectId: 'starci-academy',
  backendSourceRef: backendSource,
  sourceHead,
  artifactRootRef: artifactRoot,
  decisionId: 'entitlement-read-path',
  objectiveRef: 'objective://one-entitlement-read-path',
  tradeoffAxes,
  selectionPolicy: 'approval-required',
  approvedAlternativeId: 'shared-entitlement-service',
  businessFingerprint: hash,
  inventoryFingerprint: hash,
  constraintFingerprint: hash,
  currentStateFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const validDecidedOutput = {
  schemaVersion: 8,
  operatorId: 'architecture.decide',
  output: {
    outcome: 'decided',
    receipt: {
      receiptType: 'architecture-decision',
      receiptId: 'receipt:entitlement-read-path',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'decided',
      binding,
      decision: {
        authorRef: 'role://architecture-decider',
        selectedAlternativeId: 'shared-entitlement-service',
        comparisonArtifactRef,
        currentState: {
          observedRef: currentStateRef,
          fingerprint: hash,
          observedSourceHead: sourceHead,
          boundaries: [
            {
              name: 'course guard',
              responsibility: 'Derives paid access from subscription rows inside the course resolver.',
              evidenceRef: backendSource,
            },
            {
              name: 'community guard',
              responsibility: 'Derives paid access again, with a different expiry comparison.',
              evidenceRef: backendSource,
            },
            {
              name: 'settlement worker',
              responsibility: 'Writes the ledger row and updates the subscription state.',
              evidenceRef: backendSource,
            },
          ],
        },
        alternatives,
        boundaries,
        dataOwnership,
        stack: { modelRef: stackModelRef, fingerprint: hash, components: stackComponents },
        critique: {
          critiqueRef,
          fingerprint: hash,
          reviewerRef: 'role://architecture-reviewer',
          attacks,
        },
        migration: {
          steps: [
            'Stand up the entitlement boundary behind the existing guards and compare answers.',
            'Move each consumer to the boundary read one at a time.',
            'Remove the derived guards and the cache once no consumer reads them.',
          ],
          rollbackRef: 'runbook://rollback/entitlement-read-path',
        },
        invariants: [
          'Exactly one boundary answers whether a viewer holds paid access.',
          'The settlement ledger stays the durable record from which entitlements can be rebuilt.',
        ],
        risks: [
          'The projection lag becomes visible to a viewer immediately after payment.',
          'Two writers on the settlement ledger require the compensating write to stay in one transaction.',
        ],
        affectedContractRefs: ['contract://entitlement/read', 'contract://settlement/webhook'],
        proofExpectations: [
          'A denied read is proved for an expired, a cancelled, and a never-purchased viewer.',
          'A restore from backup rebuilds the projection from the ledger alone.',
        ],
        unknowns: ['The quota read growth assumption has no measurement behind it yet.'],
      },
      findings: [
        {
          code: 'PROJECTION_LAG',
          severity: 'warning',
          statement: 'A viewer may observe denial for the duration of the projection lag immediately after settlement.',
          evidenceRefs: [backendSource],
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs,
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'architecture.decide',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'architecture-decision',
      receiptId: 'receipt:entitlement-read-path-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding: { ...binding, approvedAlternativeId: null, currentStateFingerprint: hash },
      decision: null,
      findings: [
        {
          code: 'ALTERNATIVES_MATERIAL',
          severity: 'error',
          statement: 'The shared boundary and the edge claims differ on latency and on cancellation timing, and neither dominates.',
          evidenceRefs: [backendSource],
        },
      ],
      evidenceRefs,
      failure: {
        code: 'ALTERNATIVE_CHOICE_REQUIRED',
        message: 'Two alternatives survive the frozen constraints and product authority must choose between them.',
        missingRefs: ['approval://owner/entitlement-read-path'],
        retryable: true,
        owningDomain: 'architecture',
      },
      resume: {
        resumeToken: 'resume-entitlement-read-path-1',
        requiredDelta: ['Bind the owner approval naming one surviving alternative.'],
        candidateAlternativeIds: ['shared-entitlement-service', 'edge-cached-claims'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [comparisonArtifactRef],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validDecidedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// --- input negatives -------------------------------------------------------

// Without a measurable constraint no alternative can be compared on any axis.
const noMeasurable = structuredClone(validInput);
noMeasurable.input.constraints = noMeasurable.input.constraints.filter((item) => item.kind !== 'measurable');
const noMeasurableResult = validateInput(noMeasurable);
assert.equal(noMeasurableResult.valid, false);
assert.ok(noMeasurableResult.errors.some((error) => error.includes('measurable constraint')));

// An inventory entry nobody evidenced is a component somebody remembers, not one that exists.
const unevidencedComponent = structuredClone(validInput);
unevidencedComponent.context.inventory.components[0].evidenceRef = 'source://never-bound';
assert.equal(validateInput(unevidencedComponent).valid, false);

// Carrying an approval under an automatic policy hides which one actually decided.
const automaticWithApproval = structuredClone(validInput);
automaticWithApproval.input.selectionPolicy = 'automatic';
assert.equal(validateInput(automaticWithApproval).valid, false);

// Evidence observed at another head cannot bind this decision.
const driftedSource = structuredClone(validInput);
driftedSource.context.sourceRefs[0].sourceHead = otherHead;
assert.equal(validateInput(driftedSource).valid, false);

// A resume with no added material is NO_PROGRESS wearing a token.
const emptyResume = structuredClone(validInput);
emptyResume.input.resume = {
  blockedReceiptRef: 'receipt:entitlement-read-path-blocked',
  resumeToken: 'resume-entitlement-read-path-1',
  addedContextRefs: [],
};
assert.equal(validateInput(emptyResume).valid, false);

// --- output negatives ------------------------------------------------------

// A proposal built on an observation of a different head describes a system that no longer exists.
const staleObservation = structuredClone(validDecidedOutput);
staleObservation.output.receipt.decision.currentState.observedSourceHead = otherHead;
const staleResult = validateOutput(staleObservation);
assert.equal(staleResult.valid, false);
assert.ok(staleResult.errors.some((error) => error.includes('different source head')));

// One option dressed as a comparison: nothing was genuinely considered and rejected.
const noRejectedAlternative = structuredClone(validDecidedOutput);
noRejectedAlternative.output.receipt.decision.alternatives = [
  alternatives[0],
  { ...alternatives[1], verdict: 'selected', rejectionReason: null },
];
const noRejectedResult = validateOutput(noRejectedAlternative);
assert.equal(noRejectedResult.valid, false);
assert.ok(noRejectedResult.errors.some((error) => error.includes('rejected with a reason')));

// A rejection with no reason records a preference, not an analysis.
const reasonlessRejection = structuredClone(validDecidedOutput);
reasonlessRejection.output.receipt.decision.alternatives[1].rejectionReason = null;
assert.equal(validateOutput(reasonlessRejection).valid, false);

// Alternatives compared on different criteria cannot be compared at all.
const unevenCriteria = structuredClone(validDecidedOutput);
unevenCriteria.output.receipt.decision.alternatives[2].criteria =
  unevenCriteria.output.receipt.decision.alternatives[2].criteria.filter((item) => item.axis !== 'latency');
const unevenResult = validateOutput(unevenCriteria);
assert.equal(unevenResult.valid, false);
assert.ok(unevenResult.errors.some((error) => error.includes('same criteria')));

// Incumbency is not a justification: an existing framework is a constraint or evidence, never truth.
const incumbentJustification = structuredClone(validDecidedOutput);
incumbentJustification.output.receipt.decision.stack.components[0].justificationKind = 'incumbency';
const incumbentResult = validateOutput(incumbentJustification);
assert.equal(incumbentResult.valid, false);
assert.ok(incumbentResult.errors.some((error) => error.includes('incumbency')));

// Compatibility assumed rather than verified is the defect the tech-stack check exists to catch.
const assumedCompatibility = structuredClone(validDecidedOutput);
assumedCompatibility.output.receipt.decision.stack.components[2].compatibility.verdict = 'unverified';
assert.equal(validateOutput(assumedCompatibility).valid, false);

// A verdict of verified that skipped an axis is a partial check wearing a complete label.
const skippedAxis = structuredClone(validDecidedOutput);
skippedAxis.output.receipt.decision.stack.components[2].compatibility.checkedAxes =
  skippedAxis.output.receipt.decision.stack.components[2].compatibility.checkedAxes.filter(
    (axis) => axis !== 'backup-restore',
  );
const skippedAxisResult = validateOutput(skippedAxis);
assert.equal(skippedAxisResult.valid, false);
assert.ok(skippedAxisResult.errors.some((error) => error.includes('backup-restore')));

// A boundary that claims data without owning a store leaves the data question unanswered.
const unownedData = structuredClone(validDecidedOutput);
unownedData.output.receipt.decision.boundaries[1].ownsData = true;
const unownedResult = validateOutput(unownedData);
assert.equal(unownedResult.valid, false);
assert.ok(unownedResult.errors.some((error) => error.includes('course-delivery')));

// Two writers with no justification is how a store ends up with no real owner.
const unjustifiedSharedWrite = structuredClone(validDecidedOutput);
unjustifiedSharedWrite.output.receipt.decision.dataOwnership[1].sharedWriteJustification = null;
const sharedWriteResult = validateOutput(unjustifiedSharedWrite);
assert.equal(sharedWriteResult.valid, false);
assert.ok(sharedWriteResult.errors.some((error) => error.includes('shared-write justification')));

// A store owned by a boundary that never writes it names an owner in title only.
const nonWritingOwner = structuredClone(validDecidedOutput);
nonWritingOwner.output.receipt.decision.dataOwnership[0].writerBoundaryIds = ['course-delivery'];
assert.equal(validateOutput(nonWritingOwner).valid, false);

// A critique that skips an adverse path has described the decision under good weather.
const missingRollbackAttack = structuredClone(validDecidedOutput);
missingRollbackAttack.output.receipt.decision.critique.attacks =
  missingRollbackAttack.output.receipt.decision.critique.attacks.filter(
    (attack) => !(attack.adversePath === 'rollback' && attack.targetAlternativeId === 'shared-entitlement-service'),
  );
missingRollbackAttack.output.receipt.decision.critique.attacks.push({
  adversePath: 'concurrency',
  targetAlternativeId: 'per-feature-guards',
  statement: 'Two guards disagree during a concurrent renewal.',
  resolution: 'The alternative was rejected for this reason.',
  residualRisk: null,
});
const missingRollbackResult = validateOutput(missingRollbackAttack);
assert.equal(missingRollbackResult.valid, false);
assert.ok(missingRollbackResult.errors.some((error) => error.includes('rollback')));

// Attacking only the options that lost is restating the decision, not testing it.
const attacksOnLosersOnly = structuredClone(validDecidedOutput);
attacksOnLosersOnly.output.receipt.decision.critique.attacks =
  attacksOnLosersOnly.output.receipt.decision.critique.attacks.map((attack) => ({
    ...attack,
    targetAlternativeId: 'per-feature-guards',
  }));
const losersResult = validateOutput(attacksOnLosersOnly);
assert.equal(losersResult.valid, false);
assert.ok(losersResult.errors.length >= 8);

// A critique written by the decider is a second draft, not a review.
const selfCritique = structuredClone(validDecidedOutput);
selfCritique.output.receipt.decision.critique.reviewerRef = 'role://architecture-decider';
const selfCritiqueResult = validateOutput(selfCritique);
assert.equal(selfCritiqueResult.valid, false);
assert.ok(selfCritiqueResult.errors.some((error) => error.includes('not independent')));

// Prose alone is not architecture proof; the comparison must be inspectable.
const proseComparison = structuredClone(validDecidedOutput);
proseComparison.output.receipt.decision.comparisonArtifactRef = `${artifactRoot}/entitlement-alternatives.md`;
proseComparison.output.artifactRefs = [
  currentStateRef,
  `${artifactRoot}/entitlement-alternatives.md`,
  stackModelRef,
  critiqueRef,
];
const proseResult = validateOutput(proseComparison);
assert.equal(proseResult.valid, false);
assert.ok(proseResult.errors.some((error) => error.includes('inspectable HTML page')));

// The handoff freezes contracts. Naming source files hands implementation choices to the decider.
const implementationHandoff = structuredClone(validDecidedOutput);
implementationHandoff.output.receipt.decision.affectedContractRefs = [
  'contract://entitlement/read',
  'src/features/api/core/entitlement.service.ts',
];
const implementationResult = validateOutput(implementationHandoff);
assert.equal(implementationResult.valid, false);
assert.ok(implementationResult.errors.some((error) => error.includes('implementation file')));

// Selecting something other than what the owner approved bypasses the approval.
const unapprovedSelection = structuredClone(validDecidedOutput);
unapprovedSelection.output.receipt.binding.approvedAlternativeId = 'edge-cached-claims';
const unapprovedResult = validateOutput(unapprovedSelection);
assert.equal(unapprovedResult.valid, false);
assert.ok(unapprovedResult.errors.some((error) => error.includes('the owner approved')));

// A fingerprint that does not match the observed state lets a later reader bind the wrong snapshot.
const driftedCurrentState = structuredClone(validDecidedOutput);
driftedCurrentState.output.receipt.binding.currentStateFingerprint = otherHash;
assert.equal(validateOutput(driftedCurrentState).valid, false);

// An artifact written outside the invocation root escapes the operator's declared boundary.
const escapedArtifact = structuredClone(validDecidedOutput);
escapedArtifact.output.artifactRefs = [...artifactRefs, '.v8/artifacts/another-invocation/notes.json'];
const escapedResult = validateOutput(escapedArtifact);
assert.equal(escapedResult.valid, false);
assert.ok(escapedResult.errors.some((error) => error.includes('artifactRootRef')));

// A blocked receipt that still carries a decision publishes architecture through the failure path.
const blockedWithDecision = structuredClone(validBlockedOutput);
blockedWithDecision.output.receipt.decision = validDecidedOutput.output.receipt.decision;
const blockedDecisionResult = validateOutput(blockedWithDecision);
assert.equal(blockedDecisionResult.valid, false);
assert.ok(blockedDecisionResult.errors.some((error) => error.includes('blocked receipt cannot carry a decision')));

// A non-retryable failure with a resume token invites an endless retry of a dead end.
const nonRetryableResume = structuredClone(validBlockedOutput);
nonRetryableResume.output.receipt.failure.retryable = false;
const nonRetryableResult = validateOutput(nonRetryableResume);
assert.equal(nonRetryableResult.valid, false);
assert.ok(nonRetryableResult.errors.some((error) => error.includes('non-retryable failure forbids one')));

console.log('architecture.decide self-test passed');
