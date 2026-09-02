import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = (seed) => `sha256:${seed.repeat(64).slice(0, 64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';

const account = {
  identityKind: 'account',
  accountRef: 'account://fresh/course-enroll/run-8821',
  provisioningMode: 'control-panel-auto-create',
  provisioningOwnerRef: 'control-panel://starci-academy/uat',
  identityRecordRef: 'keycloak-user://academy/uat-learner-8821',
  applicationRecordRef: 'database-user://academy/uat-learner-8821',
  principalFingerprint: hash('c'),
  fixtureNamespace: 'uat-course-enroll-8821',
  credentialCustody: 'control-panel-ephemeral',
  state: 'authenticated',
};

const lease = {
  leaseRef: 'browser-lease://starci-academy/uat/8821',
  missionRef: 'mission-course-enroll',
  accountRef: account.accountRef,
  accountRecordRef: '.worktrees/uat/course-enroll/paid-enrollment/snapshot.json#account',
  provisioningEvidenceRefs: [
    'keycloak-user://academy/uat-learner-8821',
    'database-user://academy/uat-learner-8821',
  ],
  credentialCustody: 'control-panel-ephemeral',
  browserContextRef: 'browser-context://uat/8821',
  principalFingerprint: account.principalFingerprint,
  runtimeGeneration: 4,
  origin: 'http://localhost:3000',
  fixtureNamespace: account.fixtureNamespace,
  expiresAt: '2026-09-02T02:00:00.000Z',
  state: 'authenticated',
  executionMode: 'consumer-materialized',
  executionOwnerRef: 'mission-course-enroll',
  consumerTabRef: 'tab://uat/8821',
  evidenceBrokerRef: null,
  materializationStatus: 'materialized',
};

const validInput = {
  schemaVersion: 8,
  operatorId: 'uat.verify',
  context: {
    backendSource: { ref: 'source://starci-academy-be', sourceHead, fingerprint: hash('a') },
    protocol: { ref: 'knowledge://uat/protocol', fingerprint: hash('d'), revision: '8.0.0' },
    templates: { ref: 'templates://uat', fingerprint: hash('e') },
    admission: {
      blindVisualPassRef: 'receipt:blind-visual-course-enroll',
      blindVisualPassedAt: '2026-09-01T22:00:00.000Z',
      qualityPassRef: 'receipt:quality-course-enroll',
      qualityPassedAt: '2026-09-01T23:00:00.000Z',
    },
    runtime: {
      ownerRef: 'runtime-owner://starci-academy/4',
      generation: 4,
      status: 'ready',
      frontendOrigin: 'http://localhost:3000',
      apiOrigin: 'http://localhost:3001',
      identityOrigin: 'http://localhost:8080',
      authorityFingerprint: hash('f'),
    },
    evidenceRefs: [
      { ref: 'receipt:blind-visual-course-enroll', fingerprint: hash('1'), sourceHead, observedAt },
    ],
  },
  input: {
    invocationId: 'invocation-uat-8821',
    missionId: 'mission-course-enroll',
    project: { id: 'starci-academy', artifactRootRef: '.v8/artifacts/invocation-uat-8821' },
    feature: 'course-enroll',
    flow: 'paid-enrollment',
    runId: 'run-8821',
    sourceHead,
    identity: account,
    lease,
    fixture: {
      namespace: 'uat-course-enroll-8821',
      preflightRef: 'fixture://preflight/8821',
      prepareRefs: ['fixture://prepare/course-8821'],
      cleanupSelector: { usesUatFlag: true, namespace: 'uat-course-enroll-8821' },
    },
    cases: [
      {
        caseId: 'enrol-paid-course',
        order: 1,
        actorKind: 'authenticated',
        entryRef: 'route://courses/checkout',
        precondition: 'A fresh learner holds no enrollment for the target course.',
        expectedOutcome: 'The enrollment exists and the course opens from the learner dashboard.',
        requiredCheckpoints: ['entry', 'commitment', 'terminal'],
      },
      {
        caseId: 'recover-declined-payment',
        order: 2,
        actorKind: 'authenticated',
        entryRef: 'route://courses/checkout',
        precondition: 'The same learner reaches checkout with a gateway that declines once.',
        expectedOutcome: 'The decline is shown and a retry reaches the enrolled terminal state.',
        requiredCheckpoints: ['entry', 'feedback', 'recovery', 'terminal'],
      },
    ],
    resume: null,
  },
};

const snapshotRef = '.worktrees/uat/course-enroll/paid-enrollment/snapshot.json';
const resultRef = '.worktrees/uat/course-enroll/paid-enrollment/result.json';
const snapshotFingerprint = hash('2');

const binding = {
  projectId: 'starci-academy',
  backendSourceRef: 'source://starci-academy-be',
  sourceHead,
  feature: 'course-enroll',
  flow: 'paid-enrollment',
  runId: 'run-8821',
  artifactRootRef: '.v8/artifacts/invocation-uat-8821',
  protocolFingerprint: hash('d'),
  templateFingerprint: hash('e'),
  runtimeGeneration: 4,
  blindVisualPassRef: 'receipt:blind-visual-course-enroll',
  qualityPassRef: 'receipt:quality-course-enroll',
  inputFingerprint: hash('3'),
  progressFingerprint: hash('4'),
};

const freeze = {
  snapshotRef,
  snapshotFingerprint,
  frozenAt: '2026-09-02T00:10:00.000Z',
  fixtureNamespace: 'uat-course-enroll-8821',
  account,
  frozenCases: [
    { caseId: 'enrol-paid-course', order: 1, requiredCheckpoints: ['entry', 'commitment', 'terminal'] },
    {
      caseId: 'recover-declined-payment',
      order: 2,
      requiredCheckpoints: ['entry', 'feedback', 'recovery', 'terminal'],
    },
  ],
};

const capture = (caseId, checkpoint) => ({
  captureRef: `capture://${caseId}/${checkpoint}`,
  checkpoint,
  framing: 'full-viewport',
  assertionId: `${caseId}-${checkpoint}`,
  runtimeEvidenceRef: `runtime-evidence://${caseId}/${checkpoint}`,
});

const evidenceRefs = [
  'receipt:blind-visual-course-enroll',
  'receipt:quality-course-enroll',
  'browser-lease://starci-academy/uat/8821',
];

const validPassedOutput = {
  schemaVersion: 8,
  operatorId: 'uat.verify',
  output: {
    outcome: 'passed',
    receipt: {
      receiptType: 'uat-flow-verification',
      receiptId: 'receipt:uat-course-enroll-paid',
      invocationId: 'invocation-uat-8821',
      missionId: 'mission-course-enroll',
      status: 'passed',
      binding,
      freeze,
      publication: {
        resultRef,
        resultFingerprint: hash('5'),
        snapshotFingerprint,
        verdict: 'passed',
        publishedAt: '2026-09-02T00:45:00.000Z',
      },
      lanes: [
        {
          lane: 'behavior',
          verdict: 'pass',
          statement: 'The enrollment row exists once and the payment settles once.',
          evidenceRefs: ['runtime-evidence://enrol-paid-course/terminal'],
        },
        {
          lane: 'ux',
          verdict: 'pass',
          statement: 'The decline is announced before the retry and the retry reaches the same terminal.',
          evidenceRefs: ['capture://recover-declined-payment/feedback'],
        },
        {
          lane: 'ui',
          verdict: 'pass',
          statement: 'Ownership, order, and reachability hold at every declared viewport.',
          evidenceRefs: ['capture://enrol-paid-course/terminal'],
        },
      ],
      caseResults: [
        {
          caseId: 'enrol-paid-course',
          order: 1,
          executedAt: '2026-09-02T00:20:00.000Z',
          outcome: 'pass',
          postExecutionMutation: false,
          captures: [
            capture('enrol-paid-course', 'entry'),
            capture('enrol-paid-course', 'commitment'),
            capture('enrol-paid-course', 'terminal'),
          ],
          statement: 'The learner enrolled and the course opened from the dashboard.',
        },
        {
          caseId: 'recover-declined-payment',
          order: 2,
          executedAt: '2026-09-02T00:32:00.000Z',
          outcome: 'pass',
          postExecutionMutation: false,
          captures: [
            capture('recover-declined-payment', 'entry'),
            capture('recover-declined-payment', 'feedback'),
            capture('recover-declined-payment', 'recovery'),
            capture('recover-declined-payment', 'terminal'),
          ],
          statement: 'The decline was shown and the retry reached the enrolled terminal state.',
        },
      ],
      cleanup: { performed: true, usesUatFlag: true, namespace: 'uat-course-enroll-8821' },
      findings: [],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: '2026-09-02T00:45:00.000Z',
    },
    evidenceRefs,
    artifactRefs: [snapshotRef, resultRef],
    handoff: null,
  },
};

const validFailedOutput = structuredClone(validPassedOutput);
validFailedOutput.output.outcome = 'failed';
validFailedOutput.output.receipt.status = 'failed';
validFailedOutput.output.receipt.receiptId = 'receipt:uat-course-enroll-paid-failed';
validFailedOutput.output.receipt.publication.verdict = 'failed';
validFailedOutput.output.receipt.lanes[1].verdict = 'fail';
validFailedOutput.output.receipt.lanes[1].statement =
  'The decline is never announced, so the learner retries against an unexplained failure.';
validFailedOutput.output.receipt.caseResults[1].outcome = 'fail';
validFailedOutput.output.receipt.findings = [
  {
    code: 'UX_CONTRADICTION',
    severity: 'hard',
    state: 'open',
    caseId: 'recover-declined-payment',
    lane: 'ux',
    statement: 'Behavior records the decline while the surface shows no failure feedback.',
  },
];

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'uat.verify',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'uat-flow-verification',
      receiptId: 'receipt:uat-course-enroll-paid-blocked',
      invocationId: 'invocation-uat-8821',
      missionId: 'mission-course-enroll',
      status: 'blocked',
      binding,
      freeze,
      publication: null,
      lanes: [
        {
          lane: 'behavior',
          verdict: 'pass',
          statement: 'The enrollment row exists once.',
          evidenceRefs: ['runtime-evidence://enrol-paid-course/terminal'],
        },
        {
          lane: 'ux',
          verdict: 'unavailable',
          statement: 'The gateway sandbox stopped answering before the decline case ran.',
          evidenceRefs: [],
        },
      ],
      caseResults: [
        {
          caseId: 'enrol-paid-course',
          order: 1,
          executedAt: '2026-09-02T00:20:00.000Z',
          outcome: 'pass',
          postExecutionMutation: false,
          captures: [
            capture('enrol-paid-course', 'entry'),
            capture('enrol-paid-course', 'commitment'),
            capture('enrol-paid-course', 'terminal'),
          ],
          statement: 'The learner enrolled and the course opened from the dashboard.',
        },
      ],
      cleanup: { performed: false, usesUatFlag: false, namespace: null },
      findings: [],
      evidenceRefs,
      failure: {
        code: 'EVIDENCE_UNAVAILABLE',
        message: 'The payment sandbox is unreachable, so the decline case produced no runtime evidence.',
        caseIds: ['recover-declined-payment'],
        missingRefs: ['runtime-evidence://recover-declined-payment/feedback'],
        retryable: true,
        owningDomain: 'runtime',
      },
      resume: {
        resumeToken: 'resume-uat-8821-1',
        requiredDelta: ['Restore the payment sandbox, then rerun the frozen decline case.'],
      },
      createdAt: '2026-09-02T00:40:00.000Z',
    },
    evidenceRefs,
    artifactRefs: [snapshotRef],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validPassedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validFailedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// The account record is a closed set of non-secret fields, so a password has nowhere to live.
const secretInRecord = structuredClone(validInput);
secretInRecord.input.identity.password = 'Uat-Temp-1!';
assert.equal(validateInput(secretInRecord).valid, false);

// An authenticated flow with no Control-Panel lease is the shape that would be repaired by asking the
// user to sign in. Provisioning unavailability is BLOCKED instead.
const noLease = structuredClone(validInput);
noLease.input.lease = null;
const noLeaseResult = validateInput(noLease);
assert.equal(noLeaseResult.valid, false);
assert.ok(noLeaseResult.errors.some((error) => error.includes('never a sign-in request')));

// A lease bound to a different principal is another run's identity.
const foreignPrincipal = structuredClone(validInput);
foreignPrincipal.input.lease.principalFingerprint = hash('9');
assert.equal(validateInput(foreignPrincipal).valid, false);

// A lease whose account fragment names another flow would freeze this run into a foreign snapshot.
const foreignFragment = structuredClone(validInput);
foreignFragment.input.lease.accountRecordRef =
  '.worktrees/uat/course-enroll/free-enrollment/snapshot.json#account';
assert.equal(validateInput(foreignFragment).valid, false);

// Anonymous entry records no account and therefore holds no authenticated lease.
const anonymousWithLease = structuredClone(validInput);
anonymousWithLease.input.identity = {
  identityKind: 'anonymous',
  anonymousRef: 'anonymous://explicit/course-browse',
  fixtureNamespace: 'uat-course-enroll-8821',
};
assert.equal(validateInput(anonymousWithLease).valid, false);

// Sequential execution is declared, so the frozen order is a complete sequence, not a set of hints.
const gappedOrder = structuredClone(validInput);
gappedOrder.input.cases[1].order = 3;
assert.equal(validateInput(gappedOrder).valid, false);

// A resume that adds nothing is NO_PROGRESS.
const emptyResume = structuredClone(validInput);
emptyResume.input.resume = {
  blockedReceiptRef: 'receipt:uat-course-enroll-paid-blocked',
  resumeToken: 'resume-uat-8821-1',
  addedContextRefs: [],
};
assert.equal(validateInput(emptyResume).valid, false);

// Inputs freeze before execution: a case executed at or before the freeze proves nothing.
const executedBeforeFreeze = structuredClone(validPassedOutput);
executedBeforeFreeze.output.receipt.caseResults[0].executedAt = '2026-09-02T00:05:00.000Z';
const beforeFreezeResult = validateOutput(executedBeforeFreeze);
assert.equal(beforeFreezeResult.valid, false);
assert.ok(beforeFreezeResult.errors.some((error) => error.includes('before the snapshot freeze')));

// A case the snapshot never froze cannot contribute a result.
const unfrozenCase = structuredClone(validPassedOutput);
unfrozenCase.output.receipt.caseResults[1].caseId = 'enrol-with-coupon';
assert.equal(validateOutput(unfrozenCase).valid, false);

// A contradicted lane is FAIL; it can never be narrated into a pass.
const contradictionPassed = structuredClone(validPassedOutput);
contradictionPassed.output.receipt.lanes[2].verdict = 'fail';
const contradictionResult = validateOutput(contradictionPassed);
assert.equal(contradictionResult.valid, false);
assert.ok(contradictionResult.errors.some((error) => error.includes('is FAIL, not passed')));

// Unavailable evidence is BLOCKED; charging it as FAIL would blame a product nobody observed.
const unavailableFailed = structuredClone(validFailedOutput);
unavailableFailed.output.receipt.lanes[2].verdict = 'unavailable';
const unavailableResult = validateOutput(unavailableFailed);
assert.equal(unavailableResult.valid, false);
assert.ok(unavailableResult.errors.some((error) => error.includes('is BLOCKED, not failed')));

// A crop is supplementary; a required checkpoint needs the full viewport.
const cropOnly = structuredClone(validPassedOutput);
cropOnly.output.receipt.caseResults[1].captures[1].framing = 'crop';
const cropResult = validateOutput(cropOnly);
assert.equal(cropResult.valid, false);
assert.ok(cropResult.errors.some((error) => error.includes('crops are supplementary only')));

// Post-journey mutation can manufacture the expected outcome, so it cannot pass.
const manufactured = structuredClone(validPassedOutput);
manufactured.output.receipt.caseResults[0].postExecutionMutation = true;
assert.equal(validateOutput(manufactured).valid, false);

// A result must bind the parsed sibling snapshot, not a fingerprint of its own choosing.
const unboundResult = structuredClone(validPassedOutput);
unboundResult.output.receipt.publication.snapshotFingerprint = hash('7');
assert.equal(validateOutput(unboundResult).valid, false);

// Blocking publishes nothing; a half-published result reads as a decision.
const blockedWithPublication = structuredClone(validBlockedOutput);
blockedWithPublication.output.receipt.publication = validPassedOutput.output.receipt.publication;
assert.equal(validateOutput(blockedWithPublication).valid, false);

// Cleanup without the UAT flag reaches records this run does not own.
const unscopedCleanup = structuredClone(validPassedOutput);
unscopedCleanup.output.receipt.cleanup.usesUatFlag = false;
assert.equal(validateOutput(unscopedCleanup).valid, false);

// A pass published without its admitting receipts is a UAT that started before it was allowed to.
const unadmittedPass = structuredClone(validPassedOutput);
unadmittedPass.output.receipt.evidenceRefs = evidenceRefs.filter(
  (ref) => ref !== 'receipt:blind-visual-course-enroll',
);
assert.equal(validateOutput(unadmittedPass).valid, false);

// One authenticated lease runs one case at a time, so the clock must follow the frozen order.
const outOfOrder = structuredClone(validPassedOutput);
outOfOrder.output.receipt.caseResults[1].executedAt = '2026-09-02T00:15:00.000Z';
const orderResult = validateOutput(outOfOrder);
assert.equal(orderResult.valid, false);
assert.ok(orderResult.errors.some((error) => error.includes('did not execute after')));

console.log('uat.verify self-test passed');
