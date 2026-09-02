import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const localHead = 'b'.repeat(40);
const remoteHead = 'e'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';

const validInput = {
  schemaVersion: 8,
  operatorId: 'git.publish',
  context: {
    routeReceipt: {
      ref: '.v8/artifacts/invocation-bind-1/route-receipt.json',
      fingerprint: hash,
      status: 'bound',
      project: 'starci-academy',
      role: 'be',
      checkoutDiskPath: 'D:/Repositories/starci-academy-backend',
      sourceHead: localHead,
    },
    approval: {
      ref: 'approval://mission-dashboard/api.core',
      fingerprint: hash,
      scopeUnit: 'api.core',
      approvedAt: observedAt,
    },
    gitPolicy: {
      worktreeBranches: 'forbidden',
      mutationBranch: 'mtp',
      forcePush: false,
      historyRewrite: false,
    },
    hookInventory: [
      { hook: 'pre-commit', ref: '.husky/pre-commit', fingerprint: hash, enforced: true },
      { hook: 'pre-push', ref: '.husky/pre-push', fingerprint: otherHash, enforced: true },
    ],
    remote: {
      name: 'origin',
      ref: 'refs/heads/mtp',
      remoteHead,
      observedAt,
    },
    completionProofRefs: ['quality://mission-dashboard/lint', 'quality://mission-dashboard/typecheck'],
  },
  input: {
    invocationId: 'invocation-publish-1',
    missionId: 'mission-dashboard',
    project: 'starci-academy',
    boundary: {
      unit: 'api.core',
      targetRefs: ['src/features/api/core'],
      writeRoots: ['src/features/api/core'],
      exclusionRefs: ['src/features/socketio'],
    },
    sourceHeads: [
      {
        checkoutRef: '.v8/artifacts/invocation-bind-1/route-receipt.json',
        branch: 'mtp',
        head: localHead,
        upstreamHead: remoteHead,
        aheadCount: 4,
        behindCount: 0,
      },
    ],
    workingTree: {
      dirtyPaths: [],
      untrackedPaths: [],
    },
    publication: {
      branchRef: 'refs/heads/mtp',
      mode: 'fast-forward-only',
      annotatedTag: {
        name: 'continuation-mission-dashboard-1',
        message: 'Continuation checkpoint for the api.core boundary.',
        annotated: true,
      },
    },
    destructiveOperations: {
      forcePush: false,
      historyRewrite: false,
      resetHard: false,
      clean: false,
      stash: false,
      branchDelete: false,
      hookBypass: false,
    },
    artifactRootRef: '.v8/artifacts/invocation-publish-1',
    resume: null,
  },
};

const publicationRecordRef = `${validInput.input.artifactRootRef}/publication.json`;
const evidenceRefs = [
  '.v8/artifacts/invocation-bind-1/route-receipt.json',
  'approval://mission-dashboard/api.core',
  '.husky/pre-push',
];

const binding = {
  projectId: 'starci-academy',
  routeReceiptRef: '.v8/artifacts/invocation-bind-1/route-receipt.json',
  approvalRef: 'approval://mission-dashboard/api.core',
  boundaryUnit: 'api.core',
  worktreeBranches: 'forbidden',
  mutationBranch: 'mtp',
  frozenSourceHead: localHead,
  artifactRootRef: validInput.input.artifactRootRef,
  inputFingerprint: hash,
  progressFingerprint: otherHash,
};

const validPublishedOutput = {
  schemaVersion: 8,
  operatorId: 'git.publish',
  output: {
    outcome: 'published',
    receipt: {
      receiptType: 'git-publication',
      receiptId: 'receipt:api-core-publication',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'published',
      binding,
      publication: {
        publicationRecordRef,
        remoteName: 'origin',
        branchRef: 'refs/heads/mtp',
        mode: 'fast-forward-only',
        forced: false,
        publishedHeads: [
          {
            checkoutRef: '.v8/artifacts/invocation-bind-1/route-receipt.json',
            branch: 'mtp',
            head: localHead,
            previousRemoteHead: remoteHead,
            commitCount: 4,
          },
        ],
        annotatedTag: {
          name: 'continuation-mission-dashboard-1',
          ref: 'refs/tags/continuation-mission-dashboard-1',
          head: localHead,
          annotated: true,
        },
        hookResults: [
          { hook: 'pre-commit', ref: '.husky/pre-commit', outcome: 'passed' },
          { hook: 'pre-push', ref: '.husky/pre-push', outcome: 'passed' },
        ],
      },
      findings: [
        {
          code: 'HOOK_ENFORCED',
          subject: 'pre-commit',
          statement: 'The pre-commit hook ran and was not bypassed.',
        },
        {
          code: 'HOOK_ENFORCED',
          subject: 'pre-push',
          statement: 'The pre-push hook ran and was not bypassed.',
        },
        {
          code: 'BOUNDARY_CLEAN',
          subject: 'src/features/api/core',
          statement: 'Nothing dirty lay outside the declared boundary.',
        },
        {
          code: 'REMOTE_FAST_FORWARDED',
          subject: '.v8/artifacts/invocation-bind-1/route-receipt.json',
          statement: 'The remote ref advanced by four commits from the head it carried.',
        },
        {
          code: 'CONTINUATION_TAG_PUBLISHED',
          subject: 'continuation-mission-dashboard-1',
          statement: 'One annotated tag was pushed on the published head.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [publicationRecordRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'git.publish',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'git-publication',
      receiptId: 'receipt:api-core-publication-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      publication: null,
      findings: [
        {
          code: 'BOUNDARY_CLEAN',
          subject: 'src/features/api/core',
          statement: 'Nothing dirty lay outside the declared boundary.',
        },
      ],
      evidenceRefs,
      failure: {
        code: 'NON_FAST_FORWARD',
        message: 'The remote carries commits the local ref does not; reconciling that history is the branch owner\u2019s decision.',
        subjects: ['f'.repeat(40)],
        missingRefs: ['refs/heads/mtp'],
        retryable: true,
        owningDomain: 'remote',
      },
      resume: {
        resumeToken: 'resume-git-publish-1',
        requiredDelta: ['A reconciled mtp branch and a re-observed remote head.'],
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

// A publish never resolves its own checkout; an unbound route receipt is unrepresentable.
const unboundRoute = structuredClone(validInput);
unboundRoute.context.routeReceipt.status = 'blocked';
assert.equal(validateInput(unboundRoute).valid, false);

// Completion is not approval, and an approval for another unit is somebody else's boundary.
const foreignApproval = structuredClone(validInput);
foreignApproval.context.approval.scopeUnit = 'socketio.gateway';
const foreignApprovalResult = validateInput(foreignApproval);
assert.equal(foreignApprovalResult.valid, false);
assert.ok(foreignApprovalResult.errors.some((error) => error.includes('covers socketio.gateway')));

// The pre-push hook is the last gate before the remote; an inventory without it describes a
// checkout where that gate does not exist.
const noPrePushHook = structuredClone(validInput);
noPrePushHook.context.hookInventory = noPrePushHook.context.hookInventory.filter((item) => item.hook !== 'pre-push');
assert.equal(validateInput(noPrePushHook).valid, false);

// A bypass is not a request this contract can express, under any justification.
const requestedBypass = structuredClone(validInput);
requestedBypass.input.destructiveOperations.hookBypass = true;
assert.equal(validateInput(requestedBypass).valid, false);

// Neither is a force push, which is what a rejected publish invites.
const requestedForce = structuredClone(validInput);
requestedForce.input.destructiveOperations.forcePush = true;
assert.equal(validateInput(requestedForce).valid, false);

// Nor reset --hard, clean, or stash, which each destroy or hide evidence no receipt recorded.
for (const operation of ['resetHard', 'clean', 'stash', 'branchDelete']) {
  const requested = structuredClone(validInput);
  requested.input.destructiveOperations[operation] = true;
  assert.equal(validateInput(requested).valid, false, `${operation} must be unrepresentable`);
}

// The routed policy forbids worktree branches, so a feature branch cannot be a publish source.
const featureBranch = structuredClone(validInput);
featureBranch.input.sourceHeads[0].branch = 'feature/dashboard';
featureBranch.input.publication.branchRef = 'refs/heads/feature/dashboard';
featureBranch.context.remote.ref = 'refs/heads/feature/dashboard';
assert.equal(validateInput(featureBranch).valid, false);

// A publication that advances nothing is not a publication.
const nothingAhead = structuredClone(validInput);
nothingAhead.input.sourceHeads[0].aheadCount = 0;
nothingAhead.input.sourceHeads[0].head = remoteHead;
assert.equal(validateInput(nothingAhead).valid, false);

// Something dirty outside the boundary would ride along on the push, unreviewed.
const dirtyOutside = structuredClone(validInput);
dirtyOutside.input.workingTree.dirtyPaths = ['src/features/socketio/gateway.ts'];
assert.equal(validateInput(dirtyOutside).valid, false);

// The observed remote must be the ref being published, or the fast-forward check watched the
// wrong branch.
const remoteRefMismatch = structuredClone(validInput);
remoteRefMismatch.context.remote.ref = 'refs/heads/main';
assert.equal(validateInput(remoteRefMismatch).valid, false);

// A failed hook and a publication cannot coexist; shipping over a red gate is the defect.
const publishedOverRedHook = structuredClone(validPublishedOutput);
publishedOverRedHook.output.receipt.publication.hookResults[1].outcome = 'failed';
const redHookResult = validateOutput(publishedOverRedHook);
assert.equal(redHookResult.valid, false);
assert.ok(redHookResult.errors.some((error) => error.includes('pre-push hook failed')));

// A publication without the pre-push result either bypassed it or never ran it.
const missingPrePushResult = structuredClone(validPublishedOutput);
missingPrePushResult.output.receipt.publication.hookResults =
  missingPrePushResult.output.receipt.publication.hookResults.filter((item) => item.hook !== 'pre-push');
missingPrePushResult.output.receipt.findings = missingPrePushResult.output.receipt.findings.filter(
  (item) => !(item.code === 'HOOK_ENFORCED' && item.subject === 'pre-push'),
);
assert.equal(validateOutput(missingPrePushResult).valid, false);

// A hook that ran without its enforcement recorded reads exactly like one that was skipped.
const unrecordedHook = structuredClone(validPublishedOutput);
unrecordedHook.output.receipt.findings = unrecordedHook.output.receipt.findings.filter(
  (item) => !(item.code === 'HOOK_ENFORCED' && item.subject === 'pre-commit'),
);
assert.equal(validateOutput(unrecordedHook).valid, false);

// A force push is unrepresentable in the receipt as well as in the request.
const forcedPublication = structuredClone(validPublishedOutput);
forcedPublication.output.receipt.publication.forced = true;
assert.equal(validateOutput(forcedPublication).valid, false);

// A ref that ends where it started did not move, so reporting it hides a push that never happened.
const unmovedRef = structuredClone(validPublishedOutput);
unmovedRef.output.receipt.publication.publishedHeads[0].previousRemoteHead = localHead;
assert.equal(validateOutput(unmovedRef).valid, false);

// Creating a remote ref and fast-forwarding one are different acts, and the receipt must say which.
const misreportedCreation = structuredClone(validPublishedOutput);
misreportedCreation.output.receipt.publication.publishedHeads[0].previousRemoteHead = null;
const misreportedResult = validateOutput(misreportedCreation);
assert.equal(misreportedResult.valid, false);
assert.ok(misreportedResult.errors.some((error) => error.includes('REMOTE_REF_CREATED')));

// A continuation tag is portable only if it points at something this publication pushed.
const danglingTag = structuredClone(validPublishedOutput);
danglingTag.output.receipt.publication.annotatedTag.head = 'd'.repeat(40);
assert.equal(validateOutput(danglingTag).valid, false);

// Under a forbidden worktree policy no published head may come from another branch.
const publishedFromFeature = structuredClone(validPublishedOutput);
publishedFromFeature.output.receipt.publication.publishedHeads[0].branch = 'feature/dashboard';
assert.equal(validateOutput(publishedFromFeature).valid, false);

// A rejected push must name the remote head it saw, or the reconciliation has no address.
const anonymousRejection = structuredClone(validBlockedOutput);
anonymousRejection.output.receipt.failure.subjects = [];
assert.equal(validateOutput(anonymousRejection).valid, false);

// A remote divergence filed against the caller returns to someone who cannot reconcile it.
const misfiledRejection = structuredClone(validBlockedOutput);
misfiledRejection.output.receipt.failure.owningDomain = 'caller';
assert.equal(validateOutput(misfiledRejection).valid, false);

// A blocked hook belongs to the source, not to the caller who requested the publish.
const misfiledHookBlock = structuredClone(validBlockedOutput);
misfiledHookBlock.output.receipt.failure.code = 'HOOK_BLOCKED';
misfiledHookBlock.output.receipt.failure.owningDomain = 'caller';
assert.equal(validateOutput(misfiledHookBlock).valid, false);

// A blocked receipt never carries a publication.
const blockedWithPublication = structuredClone(validBlockedOutput);
blockedWithPublication.output.receipt.publication = validPublishedOutput.output.receipt.publication;
assert.equal(validateOutput(blockedWithPublication).valid, false);

// Nor a finding that describes a write it never performed.
const blockedClaimingPush = structuredClone(validBlockedOutput);
blockedClaimingPush.output.receipt.findings.push({
  code: 'REMOTE_FAST_FORWARDED',
  subject: '.v8/artifacts/invocation-bind-1/route-receipt.json',
  statement: 'The remote ref advanced.',
});
assert.equal(validateOutput(blockedClaimingPush).valid, false);

// The publication record must be registered, or nothing later can cite what was pushed.
const unregisteredRecord = structuredClone(validPublishedOutput);
unregisteredRecord.output.artifactRefs = [];
assert.equal(validateOutput(unregisteredRecord).valid, false);

console.log('git.publish self-test passed');
