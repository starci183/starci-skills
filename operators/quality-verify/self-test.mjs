import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const otherHead = 'd'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const validInput = {
  schemaVersion: 8,
  operatorId: 'quality.verify',
  context: {
    predecessors: [
      {
        receiptRef: 'receipt://course-enrol-implementation',
        receiptType: 'backend-implementation',
        fingerprint: hash,
        sourceHead,
      },
    ],
    gateConfigRefs: [contextRef('config://package.json#scripts'), contextRef('config://sonar-project.properties')],
    sourceRefs: [contextRef('source://starci-academy-backend', sourceHead)],
    knowledgeRefs: [contextRef('knowledge://quality/source-gates')],
    approvalRefs: [],
  },
  input: {
    invocationId: 'invocation-quality-1',
    missionId: 'mission-course-enrol',
    observedAt,
    project: {
      id: 'starci-academy',
      sourceRef: 'source://starci-academy-backend',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-quality-1',
    },
    delivery: {
      id: 'course-enrol-gateway-capability',
      kind: 'backend',
      boundaryRefs: ['src/features/api/core/graphql/mutations/courses/course-enroll'],
    },
    gates: [
      { gate: 'format', commandRef: 'npx prettier --check', configRef: 'config://prettier', required: true },
      { gate: 'lint', commandRef: 'npm run lint:check', configRef: 'config://eslint', required: true },
      { gate: 'typecheck', commandRef: 'npm run typecheck', configRef: 'config://tsconfig', required: true },
      { gate: 'build', commandRef: 'npm run build', configRef: 'config://nest-cli', required: true },
      { gate: 'unit-coverage', commandRef: 'npm run test:ci', configRef: 'config://jest', required: true },
      { gate: 'e2e', commandRef: 'npm run test:e2e', configRef: 'config://e2e-runner', required: false },
      { gate: 'sonar', commandRef: 'npm run sonar:check', configRef: 'config://sonar', required: true },
    ],
    thresholds: { statements: 80, lines: 80, functions: 75, branches: 65 },
    explicitE2eRequest: true,
    sonarScope: 'new-code',
    cachePolicy: 'fingerprint-exact',
    declaredDebts: [],
    resume: null,
  },
};

const artifactRoot = validInput.input.project.artifactRootRef;
const evidenceFor = (gate) => `${artifactRoot}/gates/${gate}.json`;
const coverageEvidenceRef = `${artifactRoot}/gates/unit-coverage.coverage.json`;
const evidenceRefs = ['receipt://course-enrol-implementation', 'source://starci-academy-backend'];

const binding = {
  projectId: 'starci-academy',
  sourceRef: 'source://starci-academy-backend',
  sourceHead,
  artifactRootRef: artifactRoot,
  deliveryId: 'course-enrol-gateway-capability',
  deliveryKind: 'backend',
  predecessorRefs: ['receipt://course-enrol-implementation'],
  predecessorFingerprint: hash,
  gatePlanFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const passResult = (gate, commandRef, statement) => ({
  gate,
  status: 'pass',
  commandRef,
  evidenceRef: evidenceFor(gate),
  exitCode: 0,
  classification: null,
  statement,
});

const validVerifiedOutput = {
  schemaVersion: 8,
  operatorId: 'quality.verify',
  output: {
    outcome: 'verified',
    receipt: {
      receiptType: 'quality-verification',
      receiptId: 'receipt:course-enrol-quality',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'verified',
      binding,
      verification: {
        plannedGates: ['format', 'lint', 'typecheck', 'build', 'unit-coverage', 'e2e', 'sonar'],
        requiredGates: ['format', 'lint', 'typecheck', 'build', 'unit-coverage', 'sonar'],
        results: [
          passResult('format', 'npx prettier --check', 'Formatting is check-only and clean.'),
          passResult('lint', 'npm run lint:check', 'Zero errors and zero warnings.'),
          passResult('typecheck', 'npm run typecheck', 'tsc --noEmit reports no diagnostic.'),
          passResult('build', 'npm run build', 'The repository build entrypoint completed.'),
          passResult('unit-coverage', 'npm run test:ci', 'Every metric meets its own threshold.'),
          {
            gate: 'e2e',
            status: 'skipped-not-requested',
            commandRef: 'npm run test:e2e',
            evidenceRef: null,
            exitCode: null,
            classification: null,
            statement: 'The end-to-end suite was not requested for this verification.',
          },
          passResult('sonar', 'npm run sonar:check', 'The pinned quality gate passed on the new code.'),
        ],
        coverage: {
          statements: 86.4,
          lines: 86.1,
          functions: 79.2,
          branches: 68.5,
          thresholds: { statements: 80, lines: 80, functions: 75, branches: 65 },
          evidenceRef: coverageEvidenceRef,
        },
        sonarScope: 'new-code',
        debts: [],
        verdict: 'pass',
      },
      findings: [
        {
          code: 'PREDECESSOR_CONSUMED',
          gate: null,
          statement: 'The backend implementation receipt was consumed unchanged on the same head.',
        },
        {
          code: 'E2E_NOT_REQUESTED',
          gate: 'e2e',
          statement: 'No behaviour was proved end to end, because the suite was not requested.',
        },
        {
          code: 'SONAR_NEW_CODE_ONLY',
          gate: 'sonar',
          statement: 'The gate measured new code only; the project beneath it is not covered by this result.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [
      evidenceFor('format'),
      evidenceFor('lint'),
      evidenceFor('typecheck'),
      evidenceFor('build'),
      evidenceFor('unit-coverage'),
      evidenceFor('sonar'),
      coverageEvidenceRef,
    ],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'quality.verify',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'quality-verification',
      receiptId: 'receipt:course-enrol-quality-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      verification: null,
      findings: [],
      evidenceRefs,
      failure: {
        code: 'PREDECESSOR_STALE',
        message: 'The implementation receipt fingerprint no longer matches the frozen source.',
        gates: [],
        missingRefs: ['receipt://course-enrol-implementation'],
        retryable: true,
        owningDomain: 'backend',
      },
      resume: {
        resumeToken: 'resume-quality-1',
        requiredDelta: ['Re-emit the implementation receipt on the current head, then rebind it.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validVerifiedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// Two predecessors on different heads describe two different deliveries.
const mixedPredecessor = structuredClone(validInput);
mixedPredecessor.context.predecessors.push({
  receiptRef: 'receipt://fe-presentation-resolution',
  receiptType: 'fe-presentation-resolution',
  fingerprint: hash,
  sourceHead: otherHead,
});
const mixedResult = validateInput(mixedPredecessor);
assert.equal(mixedResult.valid, false);
assert.ok(mixedResult.errors.some((error) => error.includes('disagree about the source head')));

// The e2e suite is never run unless this invocation explicitly asked for it.
const unrequestedE2e = structuredClone(validInput);
unrequestedE2e.input.explicitE2eRequest = false;
const e2eResult = validateInput(unrequestedE2e);
assert.equal(e2eResult.valid, false);
assert.ok(e2eResult.errors.some((error) => error.includes('without an explicit request')));

// A Sonar gate with no declared scope leaves the receipt unable to say what was measured.
const undeclaredSonarScope = structuredClone(validInput);
undeclaredSonarScope.input.sonarScope = 'not-planned';
assert.equal(validateInput(undeclaredSonarScope).valid, false);

// An expired approval is not a debt.
const expiredDebt = structuredClone(validInput);
expiredDebt.input.declaredDebts = [
  {
    debtId: 'debt-lint-1',
    gate: 'lint',
    approvalRef: 'approval://backend-owner/lint-debt',
    ownerRef: 'owner://backend',
    expiresAt: '2026-08-01T00:00:00.000Z',
  },
];
const expiredResult = validateInput(expiredDebt);
assert.equal(expiredResult.valid, false);
assert.ok(expiredResult.errors.some((error) => error.includes('expired before this verification')));

// A frontend delivery reaching quality is verification-only and cannot owe a gate away.
const frontendDebt = structuredClone(validInput);
frontendDebt.input.delivery.kind = 'frontend';
frontendDebt.input.declaredDebts = [
  {
    debtId: 'debt-lint-2',
    gate: 'lint',
    approvalRef: 'approval://fe-owner/lint-debt',
    ownerRef: 'owner://frontend',
    expiresAt: '2026-12-01T00:00:00.000Z',
  },
];
const frontendResult = validateInput(frontendDebt);
assert.equal(frontendResult.valid, false);
assert.ok(frontendResult.errors.some((error) => error.includes('verification-only')));

// A pass with a non-zero exit code is a narrated result, not a measured one.
const narratedPass = structuredClone(validVerifiedOutput);
narratedPass.output.receipt.verification.results[1].exitCode = 1;
const narratedResult = validateOutput(narratedPass);
assert.equal(narratedResult.valid, false);
assert.ok(narratedResult.errors.some((error) => error.includes('non-zero exit code')));

// A green new-code Sonar gate read as project health is the misreading to prevent.
const silentSonarScope = structuredClone(validVerifiedOutput);
silentSonarScope.output.receipt.findings = silentSonarScope.output.receipt.findings.filter(
  (item) => item.code !== 'SONAR_NEW_CODE_ONLY',
);
const sonarResult = validateOutput(silentSonarScope);
assert.equal(sonarResult.valid, false);
assert.ok(sonarResult.errors.some((error) => error.includes('SONAR_NEW_CODE_ONLY')));

// A gate that quietly did not run reads exactly like a gate that passed.
const silentSkip = structuredClone(validVerifiedOutput);
silentSkip.output.receipt.findings = silentSkip.output.receipt.findings.filter(
  (item) => item.code !== 'E2E_NOT_REQUESTED',
);
assert.equal(validateOutput(silentSkip).valid, false);

// Only e2e may be skipped as not requested; any other silent gate is a hole in the receipt.
const skippedBuild = structuredClone(validVerifiedOutput);
const buildResult = skippedBuild.output.receipt.verification.results.find((item) => item.gate === 'build');
buildResult.status = 'skipped-not-requested';
buildResult.exitCode = null;
buildResult.evidenceRef = null;
skippedBuild.output.artifactRefs = skippedBuild.output.artifactRefs.filter((ref) => ref !== evidenceFor('build'));
const skippedBuildResult = validateOutput(skippedBuild);
assert.equal(skippedBuildResult.valid, false);
assert.ok(skippedBuildResult.errors.some((error) => error.includes('cannot be skipped as not requested')));

// A branch metric under its own threshold cannot sit beside a green unit gate.
const coverageRegression = structuredClone(validVerifiedOutput);
coverageRegression.output.receipt.verification.coverage.branches = 61.2;
const coverageResult = validateOutput(coverageRegression);
assert.equal(coverageResult.valid, false);
assert.ok(coverageResult.errors.some((error) => error.includes('below their own threshold')));

// A debt on a boundary-drift failure owes away something that belongs to the boundary owner.
const misdirectedDebt = structuredClone(validVerifiedOutput);
const lintResult = misdirectedDebt.output.receipt.verification.results.find((item) => item.gate === 'lint');
lintResult.status = 'fail';
lintResult.exitCode = 1;
lintResult.classification = 'boundary-drift';
misdirectedDebt.output.receipt.verification.debts = [
  {
    debtId: 'debt-lint-3',
    gate: 'lint',
    approvalRef: 'approval://backend-owner/lint-debt',
    ownerRef: 'owner://backend',
    expiresAt: '2026-12-01T00:00:00.000Z',
    statement: 'The lint failure is accepted for now.',
  },
];
misdirectedDebt.output.receipt.findings.push({
  code: 'DEBT_DECLARED',
  gate: 'lint',
  statement: 'An approved debt keeps the lint gate red.',
});
const misdirectedResult = validateOutput(misdirectedDebt);
assert.equal(misdirectedResult.valid, false);
assert.ok(misdirectedResult.errors.some((error) => error.includes('belongs to the boundary owner')));

// A required gate that failed with no debt cannot produce a green verdict.
const greenOverRed = structuredClone(validVerifiedOutput);
const typecheckResult = greenOverRed.output.receipt.verification.results.find((item) => item.gate === 'typecheck');
typecheckResult.status = 'fail';
typecheckResult.exitCode = 2;
typecheckResult.classification = 'in-boundary';
const greenOverRedResult = validateOutput(greenOverRed);
assert.equal(greenOverRedResult.valid, false);
assert.ok(greenOverRedResult.errors.some((error) => error.includes('neither passed nor carry a debt')));

// Quality writes nothing but gate evidence; a stray artifact is a repair it may not make.
const strayWrite = structuredClone(validVerifiedOutput);
strayWrite.output.artifactRefs.push('src/features/api/core/graphql/mutations/courses/course-enroll/course-enroll.handler.ts');
const strayResult = validateOutput(strayWrite);
assert.equal(strayResult.valid, false);
assert.ok(strayResult.errors.some((error) => error.includes('which no gate result produced')));

// A blocked receipt never carries a verification.
const blockedWithVerification = structuredClone(validBlockedOutput);
blockedWithVerification.output.receipt.verification = validVerifiedOutput.output.receipt.verification;
assert.equal(validateOutput(blockedWithVerification).valid, false);

console.log('quality.verify self-test passed');
