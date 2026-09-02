import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'c'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const validInput = {
  schemaVersion: 8,
  operatorId: 'fe.surface.audit',
  context: {
    knowledge: {
      indexRef: 'knowledge://ui',
      fingerprint: hash,
      topics: [
        {
          topic: 'gap',
          ref: 'knowledge://ui/gap',
          fingerprint: hash,
          rulePrefix: 'GAP',
          ruleIds: ['GAP-1', 'GAP-2', 'GAP-4', 'GAP-5'],
        },
        {
          topic: 'padding',
          ref: 'knowledge://ui/padding',
          fingerprint: hash,
          rulePrefix: 'PADDING',
          ruleIds: ['PADDING-4', 'PADDING-5'],
        },
        {
          topic: 'contrast',
          ref: 'knowledge://ui/proof/contrast',
          fingerprint: hash,
          rulePrefix: 'COLOR',
          ruleIds: ['COLOR-3', 'COLOR-5'],
        },
      ],
    },
    applied: {
      receiptRef: 'receipt://dashboard-application',
      receiptId: 'receipt:dashboard-application',
      fingerprint: hash,
      appliedSourceHead: sourceHead,
      contractEmission: 'attribute',
      claims: [
        { nodePath: 'main', claimedIdentifiers: ['GAP-5'] },
        { nodePath: 'main/section[1]', claimedIdentifiers: ['GAP-4'] },
        { nodePath: 'main/section[2]', claimedIdentifiers: ['GAP-9'] },
        { nodePath: 'main/section[1]/p', claimedIdentifiers: ['COLOR-5'] },
      ],
    },
    sourceRefs: [contextRef('source://starci-academy-fe', sourceHead)],
    auditRefs: [],
  },
  input: {
    invocationId: 'invocation-dashboard-audit-1',
    missionId: 'mission-dashboard',
    project: {
      id: 'starci-academy',
      frontendSourceRef: 'source://starci-academy-fe',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-dashboard-audit-1',
    },
    target: { id: 'dashboard', kind: 'page', ownerRef: 'owner://dashboard' },
    runtime: {
      endpointRef: 'runtime://starci-academy-fe/local',
      routePath: '/dashboard',
      readinessProbe: 'route-and-data-served',
    },
    matrix: [
      { matrixId: 'desktop-light-idle', viewportWidth: 1440, viewportHeight: 900, colorScheme: 'light', state: 'idle' },
      { matrixId: 'mobile-dark-idle', viewportWidth: 390, viewportHeight: 844, colorScheme: 'dark', state: 'idle' },
    ],
    scope: { observedOwnerRefs: ['owner://dashboard', 'owner://global-shell'] },
    resume: null,
  },
};

const captureRef = (matrixId) => `.v8/artifacts/invocation-dashboard-audit-1/${matrixId}.capture.json`;
const evidenceRefs = ['knowledge://ui', 'receipt://dashboard-application', 'source://starci-academy-fe'];

const binding = {
  projectId: 'starci-academy',
  frontendSourceRef: 'source://starci-academy-fe',
  sourceHead,
  artifactRootRef: validInput.input.project.artifactRootRef,
  targetId: 'dashboard',
  appliedReceiptRef: 'receipt://dashboard-application',
  appliedFingerprint: hash,
  appliedSourceHead: sourceHead,
  knowledgeFingerprint: hash,
  boundRuleIds: ['GAP-1', 'GAP-2', 'GAP-4', 'GAP-5', 'PADDING-4', 'PADDING-5', 'COLOR-3', 'COLOR-5'],
  runtimeEndpointRef: 'runtime://starci-academy-fe/local',
  routePath: '/dashboard',
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const validAuditedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.surface.audit',
  output: {
    outcome: 'audited',
    receipt: {
      receiptType: 'fe-surface-audit',
      receiptId: 'receipt:dashboard-surface-audit',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'audited',
      binding,
      audit: {
        captures: [
          {
            matrixId: 'desktop-light-idle',
            evidenceRef: captureRef('desktop-light-idle'),
            fingerprint: hash,
            viewportWidth: 1440,
            viewportHeight: 900,
            colorScheme: 'light',
            state: 'idle',
            observedAt,
          },
          {
            matrixId: 'mobile-dark-idle',
            evidenceRef: captureRef('mobile-dark-idle'),
            fingerprint: otherHash,
            viewportWidth: 390,
            viewportHeight: 844,
            colorScheme: 'dark',
            state: 'idle',
            observedAt,
          },
        ],
        observations: [
          {
            matrixId: 'desktop-light-idle',
            nodePath: 'main',
            property: 'gap',
            measuredValue: '1.5rem',
            claimedRuleIds: ['GAP-5'],
            unknownClaimedIdentifiers: [],
          },
          {
            matrixId: 'desktop-light-idle',
            nodePath: 'main/section[1]',
            property: 'gap',
            measuredValue: '1rem',
            claimedRuleIds: ['GAP-4'],
            unknownClaimedIdentifiers: [],
          },
          {
            matrixId: 'desktop-light-idle',
            nodePath: 'main/section[2]',
            property: 'gap',
            measuredValue: '0.75rem',
            claimedRuleIds: [],
            unknownClaimedIdentifiers: ['GAP-9'],
          },
          {
            matrixId: 'desktop-light-idle',
            nodePath: 'main/section[1]/aside',
            property: 'padding',
            measuredValue: '0.5rem',
            claimedRuleIds: [],
            unknownClaimedIdentifiers: [],
          },
          {
            matrixId: 'mobile-dark-idle',
            nodePath: 'main',
            property: 'gap',
            measuredValue: '1rem',
            claimedRuleIds: ['GAP-5'],
            unknownClaimedIdentifiers: [],
          },
          {
            matrixId: 'mobile-dark-idle',
            nodePath: 'main/section[1]/p',
            property: 'contrast-ratio',
            measuredValue: '5.1:1 (color oklch(70.5% 0.003 354.13) over composed oklch(21.03% 0.003 354.13))',
            claimedRuleIds: ['COLOR-5'],
            unknownClaimedIdentifiers: [],
          },
        ],
        findings: [
          {
            findingId: 'finding-1',
            matrixId: 'desktop-light-idle',
            nodePath: 'main/section[1]',
            property: 'gap',
            verdict: 'PASS',
            causeTags: [],
            ruleId: 'GAP-4',
            claimedIdentifier: null,
            evidenceRef: captureRef('desktop-light-idle'),
            statement: 'The measured gap agrees with the value the claimed rule declares.',
          },
          {
            findingId: 'finding-2',
            matrixId: 'mobile-dark-idle',
            nodePath: 'main',
            property: 'gap',
            verdict: 'APP_OVERRIDE',
            causeTags: ['VALUE_DRIFT', 'STATE_OR_VIEWPORT_DRIFT'],
            ruleId: 'GAP-5',
            claimedIdentifier: null,
            evidenceRef: captureRef('mobile-dark-idle'),
            statement: 'The node claims GAP-5 but the narrow viewport renders the region gap one step lower.',
          },
          {
            findingId: 'finding-3',
            matrixId: 'desktop-light-idle',
            nodePath: 'main/section[1]/aside',
            property: 'padding',
            verdict: 'PROOF_MISSING',
            causeTags: ['WRONG_OWNER'],
            ruleId: null,
            claimedIdentifier: null,
            evidenceRef: captureRef('desktop-light-idle'),
            statement: 'The aside renders an inset that no contract claims, so no owner is named for it.',
          },
          {
            findingId: 'finding-4',
            matrixId: 'desktop-light-idle',
            nodePath: 'main/section[2]',
            property: 'gap',
            verdict: 'PROOF_MISSING',
            causeTags: [],
            ruleId: null,
            claimedIdentifier: 'GAP-9',
            evidenceRef: captureRef('desktop-light-idle'),
            statement: 'The node claims an identifier the bound knowledge does not publish.',
          },
          {
            findingId: 'finding-contrast',
            matrixId: 'mobile-dark-idle',
            nodePath: 'main/section[1]/p',
            property: 'contrast-ratio',
            verdict: 'PASS',
            causeTags: [],
            ruleId: 'COLOR-5',
            claimedIdentifier: null,
            evidenceRef: captureRef('mobile-dark-idle'),
            statement: 'Muted body text measures 5.1:1 over the composed dark surface, clearing the normal-text floor the claimed rule declares.',
          },
        ],
      },
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [captureRef('desktop-light-idle'), captureRef('mobile-dark-idle')],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.surface.audit',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'fe-surface-audit',
      receiptId: 'receipt:dashboard-surface-audit-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding: { ...binding, appliedSourceHead: 'f'.repeat(40) },
      audit: null,
      evidenceRefs,
      failure: {
        code: 'SOURCE_DRIFT',
        message: 'The routed checkout moved after the application receipt was written.',
        matrixIds: [],
        nodePaths: [],
        missingRefs: ['source://starci-academy-fe'],
        retryable: true,
        owningDomain: 'frontend',
      },
      resume: {
        resumeToken: 'resume-dashboard-surface-audit-1',
        requiredDelta: ['Re-apply the resolved tree at the current head, then rebind the application receipt.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validAuditedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// A rule identifier filed under a topic whose prefix it does not carry is a fabricated rule.
const crossFiledRule = structuredClone(validInput);
crossFiledRule.context.knowledge.topics[1].ruleIds.push('GAP-7');
const crossFiledResult = validateInput(crossFiledRule);
assert.equal(crossFiledResult.valid, false);
assert.ok(crossFiledResult.errors.some((error) => error.includes('does not carry the PADDING prefix')));

// The surface under observation must be the surface that was applied.
const appliedHeadMismatch = structuredClone(validInput);
appliedHeadMismatch.context.applied.appliedSourceHead = 'e'.repeat(40);
assert.equal(validateInput(appliedHeadMismatch).valid, false);

// Two matrix ids describing the same condition make one capture stand in for two.
const duplicateCondition = structuredClone(validInput);
duplicateCondition.input.matrix[1] = { ...duplicateCondition.input.matrix[0], matrixId: 'desktop-light-again' };
assert.equal(validateInput(duplicateCondition).valid, false);

// The target owner must be inside the observed scope.
const unobservedTarget = structuredClone(validInput);
unobservedTarget.input.scope.observedOwnerRefs = ['owner://global-shell'];
assert.equal(validateInput(unobservedTarget).valid, false);

// A verdict may cite only an identifier the bound knowledge publishes.
const unknownRuleCited = structuredClone(validAuditedOutput);
unknownRuleCited.output.receipt.audit.findings[0].ruleId = 'GAP-42';
const unknownRuleResult = validateOutput(unknownRuleCited);
assert.equal(unknownRuleResult.valid, false);
assert.ok(unknownRuleResult.errors.some((error) => error.includes('does not publish')));

// A topic may publish a non-contiguous series; the retired numbers between them stay unciteable.
const retiredContrastRule = structuredClone(validAuditedOutput);
retiredContrastRule.output.receipt.audit.findings[4].ruleId = 'COLOR-4';
const retiredContrastResult = validateOutput(retiredContrastRule);
assert.equal(retiredContrastResult.valid, false);
assert.ok(retiredContrastResult.errors.some((error) => error.includes('COLOR-4, which the bound knowledge does not publish')));

// A published rule cannot be laundered into the unpublished-claim channel, or vice versa.
const misfiledUnknownClaim = structuredClone(validAuditedOutput);
misfiledUnknownClaim.output.receipt.audit.findings[3].claimedIdentifier = 'GAP-4';
assert.equal(validateOutput(misfiledUnknownClaim).valid, false);

// An unpublished claim that nothing reports would leave a fabricated identifier standing.
const unreportedUnknownClaim = structuredClone(validAuditedOutput);
unreportedUnknownClaim.output.receipt.audit.findings = unreportedUnknownClaim.output.receipt.audit.findings.filter(
  (item) => item.findingId !== 'finding-4',
);
const unreportedResult = validateOutput(unreportedUnknownClaim);
assert.equal(unreportedResult.valid, false);
assert.ok(unreportedResult.errors.some((error) => error.includes('unpublished identifier GAP-9')));

// Drift is a disagreement with a claim, so the drifting rule must be one that node claimed.
const driftWithoutClaim = structuredClone(validAuditedOutput);
driftWithoutClaim.output.receipt.audit.findings[1].ruleId = 'GAP-2';
const driftResult = validateOutput(driftWithoutClaim);
assert.equal(driftResult.valid, false);
assert.ok(driftResult.errors.some((error) => error.includes('never claimed')));

// A rendered value nobody claims must be reported; silence is what makes it unowned forever.
const unownedValueIgnored = structuredClone(validAuditedOutput);
unownedValueIgnored.output.receipt.audit.findings = unownedValueIgnored.output.receipt.audit.findings.filter(
  (item) => item.findingId !== 'finding-3',
);
const unownedResult = validateOutput(unownedValueIgnored);
assert.equal(unownedResult.valid, false);
assert.ok(unownedResult.errors.some((error) => error.includes('no claim and no PROOF_MISSING')));

// A verdict without a measurement is a claim, which is the thing this operator refuses to accept.
const verdictWithoutMeasurement = structuredClone(validAuditedOutput);
verdictWithoutMeasurement.output.receipt.audit.findings[0].nodePath = 'main/section[9]';
const unmeasuredResult = validateOutput(verdictWithoutMeasurement);
assert.equal(unmeasuredResult.valid, false);
assert.ok(unmeasuredResult.errors.some((error) => error.includes('with no measurement')));

// PASS cannot stand beside a failure finding on the same node and property.
const passBesideFailure = structuredClone(validAuditedOutput);
passBesideFailure.output.receipt.audit.findings.push({
  findingId: 'finding-5',
  matrixId: 'desktop-light-idle',
  nodePath: 'main/section[1]',
  property: 'gap',
  verdict: 'APP_REIMPLEMENTATION',
  causeTags: ['DOUBLE_OWNER'],
  ruleId: 'GAP-4',
  claimedIdentifier: null,
  evidenceRef: captureRef('desktop-light-idle'),
  statement: 'The application rewrites a relationship a component already owns.',
});
const passBesideResult = validateOutput(passBesideFailure);
assert.equal(passBesideResult.valid, false);
assert.ok(passBesideResult.errors.some((error) => error.includes('while a failure finding stands')));

// A finding must cite the capture of the matrix entry it names.
const wrongEvidence = structuredClone(validAuditedOutput);
wrongEvidence.output.receipt.audit.findings[1].evidenceRef = captureRef('desktop-light-idle');
assert.equal(validateOutput(wrongEvidence).valid, false);

// A matrix entry that produced no capture cannot be judged.
const missingCapture = structuredClone(validAuditedOutput);
missingCapture.output.receipt.audit.captures.pop();
missingCapture.output.artifactRefs.pop();
const missingCaptureResult = validateOutput(missingCapture);
assert.equal(missingCaptureResult.valid, false);
assert.ok(missingCaptureResult.errors.some((error) => error.includes('with no capture')));

// Capture evidence must be registered, or a finding cites a file the receipt never produced.
const unregisteredCapture = structuredClone(validAuditedOutput);
unregisteredCapture.output.artifactRefs = [captureRef('desktop-light-idle')];
assert.equal(validateOutput(unregisteredCapture).valid, false);

// An audited surface must be measured at the applied head.
const auditedAtDriftedHead = structuredClone(validAuditedOutput);
auditedAtDriftedHead.output.receipt.binding.appliedSourceHead = 'f'.repeat(40);
assert.equal(validateOutput(auditedAtDriftedHead).valid, false);

// A blocked receipt never carries an audit.
const blockedWithAudit = structuredClone(validBlockedOutput);
blockedWithAudit.output.receipt.audit = validAuditedOutput.output.receipt.audit;
assert.equal(validateOutput(blockedWithAudit).valid, false);

console.log('fe.surface.audit self-test passed');
