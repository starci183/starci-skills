import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const handlerRef = 'src/features/api/core/graphql/mutations/courses/course-enroll/course-enroll.handler.ts';
const moduleRef = 'src/features/api/core/graphql/mutations/courses/courses.module.ts';
const exceptionRef = 'src/modules/platform/exceptions/errors/payment/voucher-not-supported-for-gateway.ts';

const validInput = {
  schemaVersion: 8,
  operatorId: 'backend.implement',
  context: {
    authority: {
      authorityRef: 'authority://courses/enrolment-payment',
      fingerprint: hash,
      status: 'approved',
      decisions: [
        { decisionId: 'BA-1', statement: 'A flat voucher is denominated in VND and is refused on a foreign-currency gateway.' },
        { decisionId: 'BA-2', statement: 'Installments are collected in VND only, so a non-domestic gateway refuses them.' },
        { decisionId: 'BA-3', statement: 'A learner already enrolled in a course cannot enrol again.' },
      ],
    },
    patterns: [
      { aspect: 'transport', patternRef: `${handlerRef}#ICQRSHandler`, fingerprint: hash },
      { aspect: 'module-layering', patternRef: moduleRef, fingerprint: hash },
      { aspect: 'data-access', patternRef: 'src/modules/databases/postgresql/primary/primary.decorators.ts', fingerprint: hash },
      { aspect: 'exception-identity', patternRef: exceptionRef, fingerprint: hash },
      { aspect: 'authorization', patternRef: 'src/modules/platform/exceptions/errors/users/user.ts', fingerprint: hash },
      { aspect: 'transaction-boundary', patternRef: 'src/modules/databases/postgresql/primary/primary.module.ts', fingerprint: hash },
      { aspect: 'idempotency', patternRef: 'src/features/api/processors/reconcile-transaction/reconcile-transaction.worker.ts', fingerprint: hash },
    ],
    sourceRefs: [contextRef('source://starci-academy-backend', sourceHead)],
    knowledgeRefs: [contextRef('knowledge://be/implementation')],
    priorReceiptRefs: [],
  },
  input: {
    invocationId: 'invocation-course-enrol-1',
    missionId: 'mission-course-enrol',
    project: {
      id: 'starci-academy',
      backendSourceRef: 'source://starci-academy-backend',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-course-enrol-1',
    },
    outcome: {
      id: 'course-enrol-gateway-capability',
      kind: 'feature',
      statement: 'Refuse an unsupported installment or voucher combination before any transaction row exists.',
    },
    contract: {
      contractRef: 'contract://courses/course-enroll',
      fingerprint: hash,
      status: 'frozen',
      operations: [
        {
          operationId: 'courseEnroll',
          name: 'courseEnroll',
          transport: 'graphql-mutation',
          writerRef: handlerRef,
          storeRefs: ['postgres://primary/enrollments', 'postgres://primary/transactions'],
          transactionBoundary: 'single-transaction',
          idempotencyKind: 'natural-key',
          migrationRefs: [],
          authorityDecisionIds: ['BA-1', 'BA-2', 'BA-3'],
          facets: ['transport', 'writer', 'transaction', 'idempotency', 'exception-identity', 'authorization'],
          proofKinds: ['unit', 'integration'],
        },
      ],
    },
    scope: {
      mutableFileRefs: [handlerRef, moduleRef, exceptionRef],
      observationOnlyFileRefs: ['src/modules/bussiness/rewards/voucher.service.ts'],
    },
    resume: null,
  },
};

const artifactRoot = validInput.input.project.artifactRootRef;
const unitProofRef = `${artifactRoot}/proofs/course-enroll.unit.json`;
const integrationProofRef = `${artifactRoot}/proofs/course-enroll.integration.json`;
const evidenceRefs = ['contract://courses/course-enroll', 'authority://courses/enrolment-payment', handlerRef];

const binding = {
  projectId: 'starci-academy',
  backendSourceRef: 'source://starci-academy-backend',
  sourceHead,
  artifactRootRef: artifactRoot,
  outcomeId: 'course-enrol-gateway-capability',
  contractRef: 'contract://courses/course-enroll',
  contractFingerprint: hash,
  authorityFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const conformanceFor = (facet, statement) => ({
  operationId: 'courseEnroll',
  facet,
  verdict: 'conforms',
  evidenceRef: `${artifactRoot}/conformance/course-enroll.${facet}.json`,
  statement,
});

const validImplementedOutput = {
  schemaVersion: 8,
  operatorId: 'backend.implement',
  output: {
    outcome: 'implemented',
    receipt: {
      receiptType: 'backend-implementation',
      receiptId: 'receipt:course-enrol-implementation',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'implemented',
      binding,
      implementation: {
        operations: [
          {
            operationId: 'courseEnroll',
            transport: 'graphql-mutation',
            facets: ['transport', 'writer', 'transaction', 'idempotency', 'exception-identity', 'authorization'],
            proofKinds: ['unit', 'integration'],
            authorityDecisionIds: ['BA-1', 'BA-2', 'BA-3'],
          },
        ],
        changes: [
          {
            fileRef: handlerRef,
            operationId: 'courseEnroll',
            changeKind: 'modified',
            beforeHash: hash,
            afterHash: otherHash,
            statement: 'Reject an unsupported installment or voucher discount type before any row or checkout exists.',
          },
          {
            fileRef: exceptionRef,
            operationId: 'courseEnroll',
            changeKind: 'added',
            beforeHash: null,
            afterHash: otherHash,
            statement: 'Add the gateway voucher refusal exception on the published AbstractException family.',
          },
        ],
        conformance: [
          conformanceFor('transport', 'The GraphQL mutation is the only entry point the contract names.'),
          conformanceFor('writer', 'The command handler remains the single writer.'),
          conformanceFor('transaction', 'Enrolment and transaction rows are written in one transaction.'),
          conformanceFor('idempotency', 'The enrolment natural key refuses a duplicate enrolment.'),
          conformanceFor('exception-identity', 'Each refusal raises a published exception rather than a generic error.'),
          conformanceFor('authorization', 'An absent viewer is refused before any pricing work runs.'),
        ],
        proofs: [
          {
            operationId: 'courseEnroll',
            proofKind: 'unit',
            commandRef: 'npm run test:unit -- course-enroll',
            resultRef: unitProofRef,
            result: 'passed',
            statement: 'Each refusal branch raises its published exception.',
          },
          {
            operationId: 'courseEnroll',
            proofKind: 'integration',
            commandRef: 'npm run test:int -- course-enroll',
            resultRef: integrationProofRef,
            result: 'passed',
            statement: 'A refused combination leaves no enrolment and no transaction row behind.',
          },
        ],
        appliedOperationIds: ['courseEnroll'],
      },
      findings: [
        {
          code: 'PATTERN_BOUND',
          operationId: 'courseEnroll',
          fileRef: handlerRef,
          statement: 'The handler mirrors the observed ICQRSHandler command family.',
        },
        {
          code: 'EXCEPTION_IDENTITY_REUSED',
          operationId: 'courseEnroll',
          fileRef: exceptionRef,
          statement: 'The new refusal derives from AbstractException like every sibling error.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [unitProofRef, integrationProofRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'backend.implement',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'backend-implementation',
      receiptId: 'receipt:course-enrol-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      implementation: null,
      findings: [
        {
          code: 'BUSINESS_QUESTION_RAISED',
          operationId: 'courseEnroll',
          fileRef: handlerRef,
          statement: 'No approved decision says whether a percent voucher survives a partial refund.',
        },
      ],
      evidenceRefs,
      failure: {
        code: 'BUSINESS_AUTHORITY_MISSING',
        message: 'The refund path needs a business decision about voucher survival that no approved authority states.',
        operationIds: ['courseEnroll'],
        fileRefs: [handlerRef],
        missingRefs: ['authority://courses/enrolment-payment#refund-voucher'],
        retryable: true,
        owningDomain: 'business',
      },
      resume: {
        resumeToken: 'resume-course-enrol-1',
        requiredDelta: ['Approve the refund voucher decision, then rebind the authority fingerprint.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validImplementedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// A business rule nobody approved is exactly what a passing test can legitimise.
const inventedBusinessRule = structuredClone(validInput);
inventedBusinessRule.input.contract.operations[0].authorityDecisionIds.push('BA-9');
const inventedResult = validateInput(inventedBusinessRule);
assert.equal(inventedResult.valid, false);
assert.ok(inventedResult.errors.some((error) => error.includes('unapproved business decision BA-9')));

// The contract cannot name a writer this invocation has no authority to touch.
const writerOutsideCeiling = structuredClone(validInput);
writerOutsideCeiling.input.contract.operations[0].writerRef = 'src/modules/bussiness/rewards/voucher.service.ts';
assert.equal(validateInput(writerOutsideCeiling).valid, false);

// A migration without a replay proof is a schema change nobody re-ran.
const migrationWithoutReplay = structuredClone(validInput);
migrationWithoutReplay.input.contract.operations[0].migrationRefs = [
  'src/modules/databases/postgresql/primary/migrations/1730000000000-add-voucher-gateway.ts',
];
migrationWithoutReplay.input.contract.operations[0].facets.push('migration');
const migrationResult = validateInput(migrationWithoutReplay);
assert.equal(migrationResult.valid, false);
assert.ok(migrationResult.errors.some((error) => error.includes('migration-replay')));

// A redelivered event applies twice unless something makes the write idempotent.
const nonIdempotentConsumer = structuredClone(validInput);
nonIdempotentConsumer.input.contract.operations[0].transport = 'event-consumer';
nonIdempotentConsumer.input.contract.operations[0].idempotencyKind = 'none';
const consumerResult = validateInput(nonIdempotentConsumer);
assert.equal(consumerResult.valid, false);
assert.ok(consumerResult.errors.some((error) => error.includes('apply twice on redelivery')));

// Two families bound for one aspect means no family is actually bound.
const ambiguousPattern = structuredClone(validInput);
ambiguousPattern.context.patterns.push({ aspect: 'transport', patternRef: moduleRef, fingerprint: hash });
assert.equal(validateInput(ambiguousPattern).valid, false);

// Filling a wider boundary than the frozen contract cannot be reported as implemented.
const widenedContract = structuredClone(validImplementedOutput);
widenedContract.output.receipt.implementation.conformance[2].verdict = 'widened';
const widenedResult = validateOutput(widenedContract);
assert.equal(widenedResult.valid, false);
assert.ok(widenedResult.errors.some((error) => error.includes('widened transaction conformance')));

// Silence about a declared facet reads exactly like a pass.
const unprovenFacet = structuredClone(validImplementedOutput);
unprovenFacet.output.receipt.implementation.conformance =
  unprovenFacet.output.receipt.implementation.conformance.filter((item) => item.facet !== 'idempotency');
const facetResult = validateOutput(unprovenFacet);
assert.equal(facetResult.valid, false);
assert.ok(facetResult.errors.some((error) => error.includes('proves no conformance for it')));

// A declared proof that never ran is conformance asserted rather than measured.
const unrunProof = structuredClone(validImplementedOutput);
unrunProof.output.receipt.implementation.proofs =
  unrunProof.output.receipt.implementation.proofs.filter((item) => item.proofKind !== 'integration');
const unrunResult = validateOutput(unrunProof);
assert.equal(unrunResult.valid, false);
assert.ok(unrunResult.errors.some((error) => error.includes('never ran it')));

// A failed proof cannot be reclassified into a delivery.
const failedProof = structuredClone(validImplementedOutput);
failedProof.output.receipt.implementation.proofs[0].result = 'failed';
assert.equal(validateOutput(failedProof).valid, false);

// A `modified` record whose hashes agree describes a mutation that never happened.
const phantomMutation = structuredClone(validImplementedOutput);
phantomMutation.output.receipt.implementation.changes[0].afterHash =
  phantomMutation.output.receipt.implementation.changes[0].beforeHash;
const phantomResult = validateOutput(phantomMutation);
assert.equal(phantomResult.valid, false);
assert.ok(phantomResult.errors.some((error) => error.includes('hashes are identical')));

// A proof result nobody can open is not evidence.
const unregisteredProof = structuredClone(validImplementedOutput);
unregisteredProof.output.artifactRefs = [unitProofRef];
assert.equal(validateOutput(unregisteredProof).valid, false);

// Raising the business question and shipping anyway is the contradiction the check exists for.
const shippedPastTheQuestion = structuredClone(validImplementedOutput);
shippedPastTheQuestion.output.receipt.findings.push({
  code: 'BUSINESS_QUESTION_RAISED',
  operationId: 'courseEnroll',
  fileRef: handlerRef,
  statement: 'Nobody decided whether a percent voucher survives a partial refund.',
});
const shippedResult = validateOutput(shippedPastTheQuestion);
assert.equal(shippedResult.valid, false);
assert.ok(shippedResult.errors.some((error) => error.includes('unresolved business question')));

// A blocked receipt never carries an implementation.
const blockedWithImplementation = structuredClone(validBlockedOutput);
blockedWithImplementation.output.receipt.implementation = validImplementedOutput.output.receipt.implementation;
assert.equal(validateOutput(blockedWithImplementation).valid, false);

console.log('backend.implement self-test passed');
