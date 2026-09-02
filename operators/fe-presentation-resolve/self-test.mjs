import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const validInput = {
  schemaVersion: 8,
  operatorId: 'fe.presentation.resolve',
  context: {
    knowledge: {
      indexRef: 'knowledge://ui/presentation',
      fingerprint: hash,
      topics: [
        { topic: 'gap', ref: 'knowledge://ui/presentation/gap', fingerprint: hash, ruleIds: ['GAP-0', 'GAP-1', 'GAP-2', 'GAP-3', 'GAP-4', 'GAP-5', 'GAP-6'] },
        { topic: 'padding', ref: 'knowledge://ui/presentation/padding', fingerprint: hash, ruleIds: ['PADDING-0', 'PADDING-3', 'PADDING-4', 'PADDING-5', 'PADDING-7', 'PADDING-8'] },
        { topic: 'surface', ref: 'knowledge://ui/presentation/surface', fingerprint: hash, ruleIds: ['SURFACE-1', 'SURFACE-3', 'SURFACE-4'] },
        { topic: 'boundary', ref: 'knowledge://ui/presentation/boundary', fingerprint: hash, ruleIds: ['BOUNDARY-1', 'BOUNDARY-2'] },
        { topic: 'font', ref: 'knowledge://ui/presentation/font', fingerprint: hash, ruleIds: ['FONT-1', 'FONT-2', 'FONT-3'] },
      ],
    },
    grammar: {
      packageRef: 'grammar-package://starci-core',
      manifestRef: 'grammar://starci-core',
      fingerprint: hash,
      status: 'published',
      ownedRelationships: [
        { component: 'SurfaceCopyGroup', property: 'gap', ruleId: 'GAP-2' },
        { component: 'SurfaceCard', property: 'padding', ruleId: 'PADDING-4' },
      ],
    },
    sourceRefs: [contextRef('source://starci-academy-fe', sourceHead)],
    directionRefs: [contextRef('direction://dashboard-primary')],
    auditRefs: [],
  },
  input: {
    invocationId: 'invocation-dashboard-1',
    missionId: 'mission-dashboard',
    project: {
      id: 'starci-academy',
      frontendSourceRef: 'source://starci-academy-fe',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-dashboard-1',
    },
    target: { id: 'dashboard', kind: 'page', ownerRef: 'owner://dashboard' },
    tree: { treeRef: 'tree://dashboard/raw', fingerprint: hash, format: 'tsx', nodeCount: 12 },
    scope: {
      mutableOwnerRefs: ['owner://dashboard'],
      observationOnlyOwnerRefs: ['owner://global-shell'],
    },
    contractEmission: 'attribute',
    resume: null,
  },
};

const artifactRoot = validInput.input.project.artifactRootRef;
const resolvedTreeRef = `${artifactRoot}/dashboard.resolved.tsx`;
const evidenceRefs = ['knowledge://ui/presentation', 'grammar://starci-core', 'tree://dashboard/raw'];

const binding = {
  projectId: 'starci-academy',
  frontendSourceRef: 'source://starci-academy-fe',
  sourceHead,
  artifactRootRef: artifactRoot,
  targetId: 'dashboard',
  treeFingerprint: hash,
  knowledgeFingerprint: hash,
  grammarFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const validResolvedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.presentation.resolve',
  output: {
    outcome: 'resolved',
    receipt: {
      receiptType: 'fe-presentation-resolution',
      receiptId: 'receipt:dashboard-presentation',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'resolved',
      binding,
      resolution: {
        resolvedTreeRef,
        resolvedTreeFingerprint: hash,
        contractEmission: 'attribute',
        decisions: [
          {
            nodePath: 'main',
            property: 'gap',
            owner: 'app',
            ruleId: 'GAP-5',
            className: 'flex flex-col gap-6',
            condition: 'Two page regions with distinct purposes and separate headings.',
          },
          {
            nodePath: 'main/section[1]',
            property: 'gap',
            owner: 'app',
            ruleId: 'GAP-4',
            className: 'flex flex-col gap-4',
            condition: 'Sibling blocks under one section heading.',
          },
          {
            nodePath: 'main/section[1]/SurfaceCard[1]',
            property: 'padding',
            owner: 'grammar',
            ruleId: 'PADDING-4',
            className: null,
            condition: 'Card content inset is owned by the card.',
          },
          {
            nodePath: 'main/section[1]/div[1]',
            property: 'gap',
            owner: 'none',
            ruleId: 'GAP-1',
            className: 'flex flex-col gap-1',
            condition: 'Title and its short qualifier read as one identity.',
          },
        ],
        contracts: [
          { nodePath: 'main', ruleIds: ['GAP-5'] },
          { nodePath: 'main/section[1]', ruleIds: ['GAP-4'] },
          { nodePath: 'main/section[1]/div[1]', ruleIds: ['GAP-1'] },
        ],
        appliedRuleIds: ['GAP-5', 'GAP-4', 'GAP-1'],
      },
      findings: [
        {
          code: 'GRAMMAR_OWNED',
          nodePath: 'main/section[1]/SurfaceCard[1]',
          property: 'padding',
          ruleId: 'PADDING-4',
          statement: 'SurfaceCard already applies the content inset.',
        },
        {
          code: 'COMMON_CAPABILITY_MISSING',
          nodePath: 'main/section[1]/div[1]',
          property: 'gap',
          ruleId: 'GAP-1',
          statement: 'Common exposes no compact identity path; the class stays a recorded workaround.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [resolvedTreeRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.presentation.resolve',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'fe-presentation-resolution',
      receiptId: 'receipt:dashboard-presentation-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      resolution: null,
      findings: [],
      evidenceRefs,
      failure: {
        code: 'RULE_MISSING',
        message: 'No published gap case matches a wrapping row whose axes carry different relationships.',
        nodePaths: ['main/section[2]/ul'],
        missingRefs: ['knowledge://ui/presentation/gap'],
        retryable: true,
        owningDomain: 'knowledge',
      },
      resume: {
        resumeToken: 'resume-dashboard-presentation-1',
        requiredDelta: ['Publish the missing gap case, then rebind the gap topic fingerprint.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validResolvedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// Surface and boundary are app-owned presentation topics with no value ramp; the ordinal-to-step
// check must skip them rather than demanding a Tailwind step that does not exist.
const surfaceDecision = structuredClone(validResolvedOutput);
surfaceDecision.output.receipt.resolution.decisions.push({
  nodePath: 'main/section[1]/div[2]',
  property: 'surface',
  owner: 'app',
  ruleId: 'SURFACE-3',
  className: 'bg-surface-secondary text-foreground',
  condition: 'A neutral band inside a joined surface.',
});
surfaceDecision.output.receipt.resolution.contracts.push({ nodePath: 'main/section[1]/div[2]', ruleIds: ['SURFACE-3'] });
surfaceDecision.output.receipt.resolution.appliedRuleIds.push('SURFACE-3');
assert.deepEqual(validateOutput(surfaceDecision), { valid: true, errors: [] });

// A rule identifier filed under the wrong topic is how a fabricated rule enters.
const crossFiledTopic = structuredClone(validInput);
crossFiledTopic.context.knowledge.topics[1].ruleIds.push('GAP-9');
assert.equal(validateInput(crossFiledTopic).valid, false);

// Grammar cannot claim to own a relationship the knowledge never published.
const unpublishedOwnership = structuredClone(validInput);
unpublishedOwnership.context.grammar.ownedRelationships.push({ component: 'Invented', property: 'gap', ruleId: 'GAP-9' });
assert.equal(validateInput(unpublishedOwnership).valid, false);

// The ordinal is not the Tailwind step: GAP-5 must render gap-6.
const ordinalMistake = structuredClone(validResolvedOutput);
ordinalMistake.output.receipt.resolution.decisions[0].className = 'flex flex-col gap-5';
const ordinalResult = validateOutput(ordinalMistake);
assert.equal(ordinalResult.valid, false);
assert.ok(ordinalResult.errors.some((error) => error.includes('expected step 6')));

// A contract cannot claim a rule the resolution never applied.
const fabricatedClaim = structuredClone(validResolvedOutput);
fabricatedClaim.output.receipt.resolution.contracts[0].ruleIds.push('GAP-3');
assert.equal(validateOutput(fabricatedClaim).valid, false);

// An application-owned node must publish its claim, or a later audit has nothing to check.
const silentNode = structuredClone(validResolvedOutput);
silentNode.output.receipt.resolution.contracts.pop();
assert.equal(validateOutput(silentNode).valid, false);

// Writing a class for a property Grammar owns is the reimplementation this operator prevents.
const grammarOverwritten = structuredClone(validResolvedOutput);
grammarOverwritten.output.receipt.resolution.decisions[2].className = 'p-4';
assert.equal(validateOutput(grammarOverwritten).valid, false);

// A workaround must record the missing capability rather than passing quietly.
const unrecordedWorkaround = structuredClone(validResolvedOutput);
unrecordedWorkaround.output.receipt.findings = unrecordedWorkaround.output.receipt.findings.filter(
  (item) => item.code !== 'COMMON_CAPABILITY_MISSING',
);
assert.equal(validateOutput(unrecordedWorkaround).valid, false);

// A blocked receipt never carries a resolution.
const blockedWithResolution = structuredClone(validBlockedOutput);
blockedWithResolution.output.receipt.resolution = validResolvedOutput.output.receipt.resolution;
assert.equal(validateOutput(blockedWithResolution).valid, false);

console.log('fe.presentation.resolve self-test passed');
