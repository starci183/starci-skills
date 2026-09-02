import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = (seed) => `sha256:${seed.repeat(64).slice(0, 64)}`;
const sourceHead = 'c'.repeat(40);
const digest = hash('a');
const previousDigest = hash('b');
const releaseId = 'release:2026-09-02.1';
const previousReleaseId = 'release:2026-09-01.3';
const authorizationRef = 'authorization://starci-academy/production/deploy-2026-09-02';
const targetRef = 'target://starci-academy/production/api';

const validInput = {
  schemaVersion: 8,
  operatorId: 'release.deploy',
  context: {
    intent: {
      stackRef: '.stacks/production/starci-academy.yaml',
      fingerprint: hash('d'),
      environment: 'production',
      topology: 'compose',
    },
    lifecycle: { ref: 'knowledge://deployment/lifecycle', fingerprint: hash('e') },
    manifest: {
      ref: '.infra/production/manifest.yaml',
      fingerprint: hash('f'),
      validatedAgainstReleaseId: releaseId,
    },
    authorization: {
      ref: authorizationRef,
      action: 'deploy',
      scope: { projectId: 'starci-academy', environment: 'production', targetRef },
      grantedAt: '2026-09-02T08:00:00.000Z',
      expiresAt: '2026-09-02T20:00:00.000Z',
    },
    credentials: [
      { handle: 'secret-ref://registry/ghcr-push', custodyRef: 'custody://sops/production', scope: 'registry' },
      { handle: 'secret-ref://host/deploy-key', custodyRef: 'custody://sops/production', scope: 'host' },
    ],
    observed: {
      targetRef,
      revision: 4,
      activeReleaseId: previousReleaseId,
      activeDigest: previousDigest,
      observedAt: '2026-09-02T09:00:00.000Z',
    },
    evidenceRefs: [
      { ref: 'workflow-run://github-actions/deploy/8821', fingerprint: hash('1'), sourceHead, observedAt: '2026-09-02T09:00:00.000Z' },
    ],
  },
  input: {
    invocationId: 'invocation-release-8821',
    missionId: 'mission-release-2026-09-02',
    project: { id: 'starci-academy', artifactRootRef: '.v8/artifacts/invocation-release-8821' },
    release: {
      releaseId,
      artifactRef: 'oci://ghcr.io/starci/academy-api@sha256:deadbeef',
      digest,
      sourceHead,
      immutable: true,
    },
    target: {
      targetRef,
      environment: 'production',
      strategy: 'rolling',
      declaredTargets: 2,
      replacedReleaseId: previousReleaseId,
    },
    steady: { windowSeconds: 300, deadlineSeconds: 900, backoffSeconds: 15 },
    probes: [
      {
        probeId: 'graphql-typename',
        kind: 'public-graphql-typename',
        endpointRef: 'https://api.starci.dev/graphql',
        expectStatus: 200,
      },
      {
        probeId: 'landing-http',
        kind: 'public-http',
        endpointRef: 'https://starci.dev/',
        expectStatus: 200,
      },
    ],
    rollbackIdentity: {
      releaseId: previousReleaseId,
      artifactRef: 'oci://ghcr.io/starci/academy-api@sha256:cafebabe',
      digest: previousDigest,
      dataCompatible: true,
    },
    resume: null,
  },
};

const binding = {
  projectId: 'starci-academy',
  releaseId,
  artifactRef: 'oci://ghcr.io/starci/academy-api@sha256:deadbeef',
  digest,
  sourceHead,
  targetRef,
  environment: 'production',
  strategy: 'rolling',
  declaredTargets: 2,
  replacedReleaseId: previousReleaseId,
  authorizationRef,
  manifestFingerprint: hash('f'),
  intentFingerprint: hash('d'),
  steadyWindowSeconds: 300,
  deadlineSeconds: 900,
  artifactRootRef: '.v8/artifacts/invocation-release-8821',
  inputFingerprint: hash('2'),
  progressFingerprint: hash('3'),
};

const readStep = (step, statement) => ({
  step,
  state: 'applied',
  revisionBefore: null,
  revisionAfter: null,
  statement,
  evidenceRefs: [],
});

const probePass = (probeId, observedAt) => ({ probeId, status: 'pass', observedStatus: 200, observedAt });
const probeFail = (probeId, observedAt) => ({ probeId, status: 'fail', observedStatus: 503, observedAt });

const evidenceRefs = [authorizationRef, 'workflow-run://github-actions/deploy/8821', 'probe://graphql-typename/8821'];

const validDeployedOutput = {
  schemaVersion: 8,
  operatorId: 'release.deploy',
  output: {
    outcome: 'deployed',
    receipt: {
      receiptType: 'release-deployment',
      receiptId: 'receipt:release-2026-09-02-1',
      invocationId: 'invocation-release-8821',
      missionId: 'mission-release-2026-09-02',
      status: 'deployed',
      binding,
      credentialRefs: ['secret-ref://registry/ghcr-push', 'secret-ref://host/deploy-key'],
      declaredProbeIds: ['graphql-typename', 'landing-http'],
      steps: [
        readStep('authorize', 'The declared production deploy authorization covers this target and has not expired.'),
        readStep('manifest-validate', 'The manifest is pinned to this release and matches the frozen intent.'),
        readStep('plan', 'The plan compiles the declared intent against the observed revision 4.'),
        readStep('credential-resolve', 'Both handles resolved through existing custody; no value entered the plan.'),
        {
          step: 'host-prepare',
          state: 'no-op',
          revisionBefore: 7,
          revisionAfter: 7,
          statement: 'The host already matches its declared preparation, so the desired state is a proved no-op.',
          evidenceRefs: ['host://starci-prod/state'],
        },
        {
          step: 'artifact-publish',
          state: 'applied',
          revisionBefore: 11,
          revisionAfter: 12,
          statement: 'The immutable digest was published once to the approved registry.',
          evidenceRefs: ['registry://ghcr/academy-api/12'],
        },
        {
          step: 'migrate',
          state: 'applied',
          revisionBefore: 3,
          revisionAfter: 4,
          statement: 'One additive migration applied ahead of the rollout.',
          evidenceRefs: ['migration://academy/4'],
        },
        {
          step: 'domain-reconcile',
          state: 'no-op',
          revisionBefore: 2,
          revisionAfter: 2,
          statement: 'Domain and TLS already match the declared state.',
          evidenceRefs: ['domain://starci.dev/state'],
        },
        {
          step: 'rollout',
          state: 'applied',
          revisionBefore: 4,
          revisionAfter: 5,
          statement: 'The push to main triggered the workflow and the target moved to revision 5.',
          evidenceRefs: ['workflow-run://github-actions/deploy/8821'],
        },
        readStep('monitor', 'The target was observed under backoff until the steady window closed.'),
        readStep('proof', 'Public probes and the active digest were reread after the window.'),
      ],
      monitoring: {
        deadlineSeconds: 900,
        elapsedSeconds: 540,
        backoffSeconds: 15,
        observations: [
          {
            observedAt: '2026-09-02T09:01:00.000Z',
            condition: 'progressing',
            activeReleaseIds: [previousReleaseId, releaseId],
            activeDigest: previousDigest,
            availableTargets: 1,
            probeResults: [probeFail('graphql-typename', '2026-09-02T09:01:00.000Z')],
          },
          {
            observedAt: '2026-09-02T09:06:00.000Z',
            condition: 'progressing',
            activeReleaseIds: [releaseId],
            activeDigest: digest,
            availableTargets: 2,
            probeResults: [
              probePass('graphql-typename', '2026-09-02T09:06:00.000Z'),
              probePass('landing-http', '2026-09-02T09:06:00.000Z'),
            ],
          },
          {
            observedAt: '2026-09-02T09:09:00.000Z',
            condition: 'steady',
            activeReleaseIds: [releaseId],
            activeDigest: digest,
            availableTargets: 2,
            probeResults: [
              probePass('graphql-typename', '2026-09-02T09:09:00.000Z'),
              probePass('landing-http', '2026-09-02T09:09:00.000Z'),
            ],
          },
        ],
        finalCondition: 'steady',
      },
      steadyState: {
        provedAt: '2026-09-02T09:11:00.000Z',
        windowSeconds: 300,
        activeDigest: digest,
        availableTargets: 2,
        declaredTargets: 2,
        supersededActive: 0,
        probeResults: [
          probePass('graphql-typename', '2026-09-02T09:11:00.000Z'),
          probePass('landing-http', '2026-09-02T09:11:00.000Z'),
        ],
      },
      branch: 'none',
      recovery: null,
      rollback: null,
      findings: [
        {
          code: 'IDEMPOTENT_NO_OP',
          step: 'host-prepare',
          statement: 'The host already matched its declared preparation.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: '2026-09-02T09:12:00.000Z',
    },
    evidenceRefs,
    artifactRefs: ['.v8/artifacts/invocation-release-8821/deployment-receipt.json'],
    handoff: null,
  },
};

const validRolledBackOutput = structuredClone(validDeployedOutput);
{
  const receipt = validRolledBackOutput.output.receipt;
  validRolledBackOutput.output.outcome = 'rolled-back';
  receipt.receiptId = 'receipt:release-2026-09-02-1-rolled-back';
  receipt.status = 'rolled-back';
  receipt.steadyState = null;
  receipt.branch = 'rollback';
  receipt.monitoring.finalCondition = 'failing';
  receipt.monitoring.elapsedSeconds = 780;
  receipt.monitoring.observations[1].condition = 'failing';
  receipt.monitoring.observations[1].probeResults = [probeFail('graphql-typename', '2026-09-02T09:06:00.000Z')];
  receipt.monitoring.observations[2].condition = 'failing';
  receipt.monitoring.observations[2].probeResults = [probeFail('graphql-typename', '2026-09-02T09:09:00.000Z')];
  receipt.monitoring.observations[2].availableTargets = 1;
  receipt.recovery = {
    attempts: [
      {
        attempt: 1,
        action: 'resume-rollout',
        releaseId,
        outcome: 'failed',
        evidenceRefs: ['workflow-run://github-actions/deploy/8821'],
      },
      {
        attempt: 2,
        action: 'restart-target',
        releaseId,
        outcome: 'failed',
        evidenceRefs: ['host://starci-prod/restart/2'],
      },
    ],
    exhausted: true,
  };
  receipt.rollback = {
    toReleaseId: previousReleaseId,
    toDigest: previousDigest,
    revisionBefore: 5,
    revisionAfter: 6,
    dataBoundaryPreserved: true,
    verifiedAt: '2026-09-02T09:20:00.000Z',
    evidenceRefs: ['workflow-run://github-actions/rollback/8822'],
  };
  receipt.steps.push({
    step: 'recover',
    state: 'failed',
    revisionBefore: 5,
    revisionAfter: 5,
    statement: 'Two approved reversible actions were repeated and the target stayed unavailable.',
    evidenceRefs: ['host://starci-prod/restart/2'],
  });
  receipt.steps.push({
    step: 'rollback',
    state: 'applied',
    revisionBefore: 5,
    revisionAfter: 6,
    statement: 'The previous release was restored and its data boundary was preserved.',
    evidenceRefs: ['workflow-run://github-actions/rollback/8822'],
  });
  receipt.findings = [
    {
      code: 'TARGET_UNAVAILABLE',
      step: 'monitor',
      statement: 'One of two targets never became available under the new digest.',
    },
  ];
}

const validBlockedOutput = structuredClone(validDeployedOutput);
{
  const receipt = validBlockedOutput.output.receipt;
  validBlockedOutput.output.outcome = 'blocked';
  receipt.receiptId = 'receipt:release-2026-09-02-1-blocked';
  receipt.status = 'blocked';
  receipt.steadyState = null;
  receipt.monitoring.finalCondition = 'deadline-exceeded';
  receipt.monitoring.elapsedSeconds = 960;
  receipt.monitoring.observations[2].condition = 'progressing';
  receipt.failure = {
    code: 'STEADY_STATE_UNPROVEN',
    message: 'The declared steady window never closed before the deadline; boot normally completes in eight to nine minutes.',
    steps: ['monitor'],
    missingRefs: ['probe://landing-http/8821'],
    retryable: true,
    owningDomain: 'deployment',
  };
  receipt.resume = {
    resumeToken: 'resume-release-8821-1',
    requiredDelta: ['Extend the observation with a fresh probe series after the platform restores the target.'],
  };
}

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validDeployedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validRolledBackOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// Deployment authority is declared. Authority for another environment is the same as none.
const foreignScope = structuredClone(validInput);
foreignScope.context.authorization.scope.environment = 'staging';
assert.equal(validateInput(foreignScope).valid, false);

// An authorization that had already expired when the target was observed authorizes nothing.
const expiredAuthorization = structuredClone(validInput);
expiredAuthorization.context.authorization.expiresAt = '2026-09-02T08:30:00.000Z';
assert.equal(validateInput(expiredAuthorization).valid, false);

// A manifest pinned to another release is how an unreviewed image reaches a reviewed target.
const foreignManifest = structuredClone(validInput);
foreignManifest.context.manifest.validatedAgainstReleaseId = 'release:2026-08-30.7';
assert.equal(validateInput(foreignManifest).valid, false);

// A credential value can never take the place of a handle.
const inlineCredential = structuredClone(validInput);
inlineCredential.context.credentials[0].handle = 'ghp_realTokenValue0000';
assert.equal(validateInput(inlineCredential).valid, false);

// Steady state is public, so a run with only runtime probes proves nothing a user could see.
const privateProbesOnly = structuredClone(validInput);
privateProbesOnly.input.probes = [
  { probeId: 'container-health', kind: 'runtime', endpointRef: 'docker://api/health', expectStatus: 200 },
];
const privateProbeResult = validateInput(privateProbesOnly);
assert.equal(privateProbeResult.valid, false);
assert.ok(privateProbeResult.errors.some((error) => error.includes('typename probe returning 200')));

// A deadline shorter than the window it must contain is a guaranteed false failure.
const shortDeadline = structuredClone(validInput);
shortDeadline.input.steady.deadlineSeconds = 200;
assert.equal(validateInput(shortDeadline).valid, false);

// A rollback identity naming the release under deployment is not a rollback target.
const selfRollback = structuredClone(validInput);
selfRollback.input.rollbackIdentity.releaseId = releaseId;
assert.equal(validateInput(selfRollback).valid, false);

// The release being replaced must be the one actually observed as active.
const mismatchedReplacement = structuredClone(validInput);
mismatchedReplacement.input.target.replacedReleaseId = 'release:2026-08-30.7';
assert.equal(validateInput(mismatchedReplacement).valid, false);

// A resume that adds nothing is NO_PROGRESS.
const emptyResume = structuredClone(validInput);
emptyResume.input.resume = {
  blockedReceiptRef: 'receipt:release-2026-09-02-1-blocked',
  resumeToken: 'resume-release-8821-1',
  addedContextRefs: [],
};
assert.equal(validateInput(emptyResume).valid, false);

// A matching desired state is a proved idempotent no-op, never a claimed application.
const falseApplication = structuredClone(validDeployedOutput);
falseApplication.output.receipt.steps[4].state = 'applied';
const falseApplicationResult = validateOutput(falseApplication);
assert.equal(falseApplicationResult.valid, false);
assert.ok(falseApplicationResult.errors.some((error) => error.includes('without moving the observed revision')));

// A read step that reports a revision has invented a fact about a boundary it never touched.
const inventedRevision = structuredClone(validDeployedOutput);
inventedRevision.output.receipt.steps[2].revisionBefore = 4;
inventedRevision.output.receipt.steps[2].revisionAfter = 5;
assert.equal(validateOutput(inventedRevision).valid, false);

// Steady state means this release's immutable digest is the active one.
const foreignDigestSteady = structuredClone(validDeployedOutput);
foreignDigestSteady.output.receipt.steadyState.activeDigest = previousDigest;
assert.equal(validateOutput(foreignDigestSteady).valid, false);

// Every declared probe has to pass; a probe quietly dropped from the window proves less than claimed.
const droppedProbe = structuredClone(validDeployedOutput);
droppedProbe.output.receipt.steadyState.probeResults =
  droppedProbe.output.receipt.steadyState.probeResults.slice(0, 1);
assert.equal(validateOutput(droppedProbe).valid, false);

// Steady state requires every declared target, not most of them.
const partialAvailability = structuredClone(validDeployedOutput);
partialAvailability.output.receipt.steadyState.availableTargets = 1;
assert.equal(validateOutput(partialAvailability).valid, false);

// A rolling strategy does not permit a superseded target to stay active.
const lingeringTarget = structuredClone(validDeployedOutput);
lingeringTarget.output.receipt.steadyState.supersededActive = 1;
assert.equal(validateOutput(lingeringTarget).valid, false);

// The steady window has to elapse before steady state is declared.
const shortWindow = structuredClone(validDeployedOutput);
shortWindow.output.receipt.steadyState.windowSeconds = 60;
assert.equal(validateOutput(shortWindow).valid, false);

// Monitoring proves steady state; a deployment cannot assume it.
const assumedSteady = structuredClone(validDeployedOutput);
assumedSteady.output.receipt.steadyState = null;
assert.equal(validateOutput(assumedSteady).valid, false);

// One transient probe never becomes recovery.
const transientRecovery = structuredClone(validRolledBackOutput);
transientRecovery.output.receipt.monitoring.observations[1].condition = 'progressing';
const transientResult = validateOutput(transientRecovery);
assert.equal(transientResult.valid, false);
assert.ok(transientResult.errors.some((error) => error.includes('one transient probe is not a failure')));

// Recovery preserves the release identity it is recovering.
const foreignRecovery = structuredClone(validRolledBackOutput);
foreignRecovery.output.receipt.recovery.attempts[1].releaseId = 'release:hotfix.9';
assert.equal(validateOutput(foreignRecovery).valid, false);

// A release that appears mid-run and belongs to nobody here is drift, not something to recover.
const drift = structuredClone(validDeployedOutput);
drift.output.receipt.monitoring.observations[1].activeReleaseIds = [releaseId, 'release:hotfix.9'];
const driftResult = validateOutput(drift);
assert.equal(driftResult.valid, false);
assert.ok(driftResult.errors.some((error) => error.includes('CONCURRENT_DRIFT')));

// A rolled-back run is its own terminal outcome and never reports delivery of the rejected release.
const rollbackAsDelivery = structuredClone(validRolledBackOutput);
rollbackAsDelivery.output.receipt.rollback.toReleaseId = releaseId;
assert.equal(validateOutput(rollbackAsDelivery).valid, false);

// A rolled-back run never reaches steady state for the release it rejected.
const rolledBackSteady = structuredClone(validRolledBackOutput);
rolledBackSteady.output.receipt.steadyState = validDeployedOutput.output.receipt.steadyState;
assert.equal(validateOutput(rolledBackSteady).valid, false);

// A blocked receipt cannot claim the state it failed to prove.
const blockedSteady = structuredClone(validBlockedOutput);
blockedSteady.output.receipt.steadyState = validDeployedOutput.output.receipt.steadyState;
assert.equal(validateOutput(blockedSteady).valid, false);

// A deployment must carry the authorization that permitted it.
const unauthorizedEvidence = structuredClone(validDeployedOutput);
unauthorizedEvidence.output.receipt.evidenceRefs = evidenceRefs.filter((ref) => ref !== authorizationRef);
assert.equal(validateOutput(unauthorizedEvidence).valid, false);

// Exhausted recovery cannot end in a successful deployment.
const exhaustedDeployed = structuredClone(validDeployedOutput);
exhaustedDeployed.output.receipt.branch = 'recover';
exhaustedDeployed.output.receipt.monitoring.observations[0].condition = 'failing';
exhaustedDeployed.output.receipt.monitoring.observations[1].condition = 'failing';
exhaustedDeployed.output.receipt.recovery = {
  attempts: [{ attempt: 1, action: 'restart-target', releaseId, outcome: 'failed', evidenceRefs: [] }],
  exhausted: true,
};
const exhaustedResult = validateOutput(exhaustedDeployed);
assert.equal(exhaustedResult.valid, false);
assert.ok(exhaustedResult.errors.some((error) => error.includes('exhausted recovery cannot end')));

console.log('release.deploy self-test passed');
