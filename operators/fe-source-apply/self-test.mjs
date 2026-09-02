import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const staleHash = `sha256:${'d'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const resolutionBinding = {
  receiptRef: 'receipt://dashboard-presentation',
  receiptId: 'receipt:dashboard-presentation',
  fingerprint: hash,
  resolvedTreeRef: '.v8/artifacts/invocation-dashboard-1/dashboard.resolved.tsx',
  resolvedTreeFingerprint: otherHash,
  contractEmission: 'attribute',
  classNames: ['flex flex-col gap-6', 'flex flex-col gap-4', 'flex flex-col gap-1'],
  appliedRuleIds: ['GAP-5', 'GAP-4', 'GAP-1'],
};

const validInput = {
  schemaVersion: 8,
  operatorId: 'fe.source.apply',
  context: {
    resolution: resolutionBinding,
    sourceRefs: [contextRef('source://starci-academy-fe', sourceHead)],
    directionRefs: [contextRef('direction://dashboard-primary')],
    auditRefs: [],
  },
  input: {
    invocationId: 'invocation-dashboard-apply-1',
    missionId: 'mission-dashboard',
    project: {
      id: 'starci-academy',
      frontendSourceRef: 'source://starci-academy-fe',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-dashboard-apply-1',
    },
    target: { id: 'dashboard', kind: 'page', ownerRef: 'owner://dashboard' },
    resolution: { receiptRef: resolutionBinding.receiptRef, fingerprint: hash },
    scope: {
      mutableOwners: [{ ownerRef: 'owner://dashboard', rootPath: 'src/app/dashboard' }],
      observationOnlyOwnerRefs: ['owner://global-shell'],
    },
    writeSet: [
      { path: 'src/app/dashboard/page.tsx', ownerRef: 'owner://dashboard', intent: 'modify' },
      { path: 'src/app/dashboard/summary-section.tsx', ownerRef: 'owner://dashboard', intent: 'create' },
      { path: 'src/app/dashboard/legend.tsx', ownerRef: 'owner://dashboard', intent: 'modify' },
    ],
    resume: null,
  },
};

const evidenceRefs = [resolutionBinding.receiptRef, resolutionBinding.resolvedTreeRef, 'source://starci-academy-fe'];

const binding = {
  projectId: 'starci-academy',
  frontendSourceRef: 'source://starci-academy-fe',
  sourceHead,
  artifactRootRef: validInput.input.project.artifactRootRef,
  targetId: 'dashboard',
  resolutionReceiptRef: resolutionBinding.receiptRef,
  resolutionFingerprint: hash,
  mutableOwners: [{ ownerRef: 'owner://dashboard', rootPath: 'src/app/dashboard' }],
  observationOnlyOwnerRefs: ['owner://global-shell'],
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const validAppliedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.source.apply',
  output: {
    outcome: 'applied',
    receipt: {
      receiptType: 'fe-source-application',
      receiptId: 'receipt:dashboard-application',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'applied',
      binding,
      application: {
        appliedResolution: {
          receiptRef: resolutionBinding.receiptRef,
          fingerprint: hash,
          resolvedTreeRef: resolutionBinding.resolvedTreeRef,
          resolvedTreeFingerprint: otherHash,
        },
        contractEmission: 'attribute',
        declaredWriteSet: validInput.input.writeSet,
        writes: [
          {
            path: 'src/app/dashboard/page.tsx',
            ownerRef: 'owner://dashboard',
            action: 'modified',
            fingerprintBefore: staleHash,
            fingerprintAfter: otherHash,
            nodePaths: ['main'],
            classNames: ['flex flex-col gap-6'],
            ruleIds: ['GAP-5'],
            contractAttributeWritten: true,
          },
          {
            path: 'src/app/dashboard/summary-section.tsx',
            ownerRef: 'owner://dashboard',
            action: 'created',
            fingerprintBefore: null,
            fingerprintAfter: hash,
            nodePaths: ['main/section[1]', 'main/section[1]/div[1]'],
            classNames: ['flex flex-col gap-4', 'flex flex-col gap-1'],
            ruleIds: ['GAP-4', 'GAP-1'],
            contractAttributeWritten: true,
          },
        ],
        resolutionClassNames: resolutionBinding.classNames,
        appliedRuleIds: resolutionBinding.appliedRuleIds,
      },
      findings: [
        {
          code: 'FILE_CREATED',
          path: 'src/app/dashboard/summary-section.tsx',
          statement: 'The summary section file did not exist and was created from the resolved tree.',
        },
        {
          code: 'WRITE_SET_PATH_UNUSED',
          path: 'src/app/dashboard/legend.tsx',
          statement: 'The resolution carries no decision for the legend, so the declared path was not opened.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: ['src/app/dashboard/page.tsx', 'src/app/dashboard/summary-section.tsx'],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.source.apply',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'fe-source-application',
      receiptId: 'receipt:dashboard-application-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      application: null,
      findings: [],
      evidenceRefs,
      failure: {
        code: 'WRITE_REJECTED',
        message: 'The resolved tree changes a shell file that the declared write set does not contain.',
        paths: ['src/app/layout.tsx'],
        missingRefs: ['owner://global-shell'],
        retryable: true,
        owningDomain: 'caller',
      },
      resume: {
        resumeToken: 'resume-dashboard-application-1',
        requiredDelta: ['Declare the shell path under a mutable owner, or re-resolve without it.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validAppliedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// Naming one resolution receipt while binding another is how superseded decisions reach source.
const mismatchedResolution = structuredClone(validInput);
mismatchedResolution.input.resolution.fingerprint = staleHash;
assert.equal(validateInput(mismatchedResolution).valid, false);

// A write set path may only sit under the root of the owner that declares it.
const pathOutsideOwnerRoot = structuredClone(validInput);
pathOutsideOwnerRoot.input.writeSet[0].path = 'src/app/layout.tsx';
const outsideRootResult = validateInput(pathOutsideOwnerRoot);
assert.equal(outsideRootResult.valid, false);
assert.ok(outsideRootResult.errors.some((error) => error.includes('lies outside the root')));

// An observation-only owner can never acquire a write by being named in the write set.
const observationOnlyWrite = structuredClone(validInput);
observationOnlyWrite.input.writeSet[0].ownerRef = 'owner://global-shell';
assert.equal(validateInput(observationOnlyWrite).valid, false);

// The frozen head must be the head that was actually observed.
const staleSource = structuredClone(validInput);
staleSource.context.sourceRefs[0].sourceHead = 'e'.repeat(40);
assert.equal(validateInput(staleSource).valid, false);

// The resolution read must be the resolution bound; a newer receipt under an older binding is stale.
const staleAppliedResolution = structuredClone(validAppliedOutput);
staleAppliedResolution.output.receipt.application.appliedResolution.fingerprint = staleHash;
const staleResult = validateOutput(staleAppliedResolution);
assert.equal(staleResult.valid, false);
assert.ok(staleResult.errors.some((error) => error.includes('applied resolution fingerprint')));

// A file written but absent from the declared write set is the escape this operator exists to block.
const undeclaredWrite = structuredClone(validAppliedOutput);
undeclaredWrite.output.receipt.application.writes[0].path = 'src/app/dashboard/other.tsx';
undeclaredWrite.output.artifactRefs.push('src/app/dashboard/other.tsx');
const undeclaredResult = validateOutput(undeclaredWrite);
assert.equal(undeclaredResult.valid, false);
assert.ok(undeclaredResult.errors.some((error) => error.includes('absent from the declared write set')));

// A class the resolution never published is a value this operator invented.
const inventedClass = structuredClone(validAppliedOutput);
inventedClass.output.receipt.application.writes[0].classNames = ['flex flex-col gap-5'];
const inventedResult = validateOutput(inventedClass);
assert.equal(inventedResult.valid, false);
assert.ok(inventedResult.errors.some((error) => error.includes('the resolution never published')));

// A rule identifier carried into source must be one the resolution actually applied.
const inventedRule = structuredClone(validAppliedOutput);
inventedRule.output.receipt.application.writes[0].ruleIds = ['GAP-3'];
assert.equal(validateOutput(inventedRule).valid, false);

// An application that changes nothing is NO_PROGRESS, not a quiet success.
const noEffectiveWrite = structuredClone(validAppliedOutput);
for (const write of noEffectiveWrite.output.receipt.application.writes) {
  write.action = 'unchanged';
  write.fingerprintBefore = write.fingerprintAfter;
  write.classNames = [];
  write.contractAttributeWritten = false;
}
noEffectiveWrite.output.receipt.findings = [
  { code: 'FILE_UNCHANGED', path: 'src/app/dashboard/page.tsx', statement: 'No content delta.' },
  { code: 'FILE_UNCHANGED', path: 'src/app/dashboard/summary-section.tsx', statement: 'No content delta.' },
  { code: 'WRITE_SET_PATH_UNUSED', path: 'src/app/dashboard/legend.tsx', statement: 'Not opened.' },
];
const noProgressResult = validateOutput(noEffectiveWrite);
assert.equal(noProgressResult.valid, false);
assert.ok(noProgressResult.errors.some((error) => error.includes('at least one declared path')));

// A created file cannot report a fingerprint it had before it existed.
const createdWithHistory = structuredClone(validAppliedOutput);
createdWithHistory.output.receipt.application.writes[1].fingerprintBefore = staleHash;
assert.equal(validateOutput(createdWithHistory).valid, false);

// Contract emission is the resolution's decision; receipt-only must not grow an attribute here.
const attributeUnderReceiptOnly = structuredClone(validAppliedOutput);
attributeUnderReceiptOnly.output.receipt.application.contractEmission = 'receipt-only';
const emissionResult = validateOutput(attributeUnderReceiptOnly);
assert.equal(emissionResult.valid, false);
assert.ok(emissionResult.errors.some((error) => error.includes('receipt-only emission')));

// Resolved classes must carry their claims, or the later audit has nothing to contradict.
const classesWithoutContract = structuredClone(validAppliedOutput);
classesWithoutContract.output.receipt.application.writes[0].contractAttributeWritten = false;
assert.equal(validateOutput(classesWithoutContract).valid, false);

// A declared path that produced nothing must say so; a silent skip reads as a completed apply.
const silentSkip = structuredClone(validAppliedOutput);
silentSkip.output.receipt.findings = silentSkip.output.receipt.findings.filter(
  (item) => item.code !== 'WRITE_SET_PATH_UNUSED',
);
const silentSkipResult = validateOutput(silentSkip);
assert.equal(silentSkipResult.valid, false);
assert.ok(silentSkipResult.errors.some((error) => error.includes('no write and no unused finding')));

// A written path must be registered as an artifact of the invocation.
const unregisteredArtifact = structuredClone(validAppliedOutput);
unregisteredArtifact.output.artifactRefs = ['src/app/dashboard/page.tsx'];
assert.equal(validateOutput(unregisteredArtifact).valid, false);

// A blocked receipt never carries an application.
const blockedWithApplication = structuredClone(validBlockedOutput);
blockedWithApplication.output.receipt.application = validAppliedOutput.output.receipt.application;
assert.equal(validateOutput(blockedWithApplication).valid, false);

console.log('fe.source.apply self-test passed');
