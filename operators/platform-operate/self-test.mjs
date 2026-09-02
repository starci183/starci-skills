import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const prometheus = 'service://observability/prometheus';
const grafana = 'service://observability/grafana';
const productWeb = 'service://product/academy-web';

const validInput = {
  schemaVersion: 8,
  operatorId: 'platform.operate',
  context: {
    knowledge: {
      indexRef: 'knowledge://platform',
      fingerprint: hash,
      records: [
        { knowledgeId: 'platform.observability', ref: 'knowledge://platform/observability', fingerprint: hash },
        { knowledgeId: 'platform.tunnel', ref: 'knowledge://platform/tunnel', fingerprint: hash },
      ],
    },
    authority: {
      approvalRef: 'approval://platform/observability-round-4',
      planSha256: hash,
      allowedEffects: ['update-config', 'update-remote-write', 'upsert-dashboard'],
      evidenceRef: 'evidence://approval/observability-round-4',
    },
    capabilities: [
      {
        handleRef: 'capability://starci/metrics-remote-write',
        capability: 'metrics:remote-write',
        custodyEvidenceRef: 'custody://control-panel/metrics-remote-write',
      },
    ],
    inventory: {
      inventoryRef: 'inventory://platform/observability',
      fingerprint: hash,
      resources: [
        { resourceRef: prometheus, kind: 'observability', revision: 'rev-41', ownerRef: 'owner://platform' },
        { resourceRef: grafana, kind: 'observability', revision: 'rev-12', ownerRef: 'owner://platform' },
      ],
      portHolders: [{ port: 3000, holderRef: productWeb, evidenceRef: 'evidence://ports/3000' }],
      evidenceRefs: ['evidence://inventory/observability'],
    },
    sourceRefs: [contextRef('source://starci-academy-workspace', sourceHead)],
    auditRefs: [],
  },
  input: {
    invocationId: 'invocation-observability-1',
    missionId: 'mission-platform',
    project: {
      id: 'starci-academy',
      workspaceSourceRef: 'source://starci-academy-workspace',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-observability-1',
    },
    service: { kind: 'observability', serviceRef: prometheus, ownerRef: 'owner://platform' },
    desiredState: {
      planSha256: hash,
      resourceRefs: [prometheus, grafana],
      effects: ['update-config', 'update-remote-write'],
      requiredCheckNames: [
        'service-health',
        'target-boundary',
        'label-boundary',
        'remote-write-delivery',
        'sample-ordering',
        'retry-backoff',
        'sensitive-data-filter',
      ],
    },
    portClaims: [{ port: 9090, resourceRef: prometheus }],
    scope: {
      mutableResourceRefs: [prometheus, grafana],
      observationOnlyResourceRefs: [productWeb],
    },
    resume: null,
  },
};

const artifactRoot = validInput.input.project.artifactRootRef;
const receiptArtifactRef = `${artifactRoot}/observability.receipt.json`;
const evidenceRefs = [
  'evidence://approval/observability-round-4',
  'evidence://inventory/observability',
  'evidence://proof/remote-write',
];

const binding = {
  projectId: 'starci-academy',
  workspaceSourceRef: 'source://starci-academy-workspace',
  sourceHead,
  artifactRootRef: artifactRoot,
  serviceRef: prometheus,
  serviceKind: 'observability',
  ownerRef: 'owner://platform',
  planSha256: hash,
  knowledgeFingerprint: hash,
  inventoryFingerprint: hash,
  inputFingerprint: hash,
  progressFingerprint: hash,
};

const check = (name, resourceRef) => ({
  name,
  resourceRef,
  status: 'passed',
  evidenceRef: `evidence://check/${name}`,
});

const validOperatedOutput = {
  schemaVersion: 8,
  operatorId: 'platform.operate',
  output: {
    outcome: 'operated',
    receipt: {
      receiptType: 'platform-operation-receipt',
      receiptId: 'receipt:observability-operation',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'operated',
      binding,
      operation: {
        convergence: 'converged',
        inventoriedResourceRefs: [prometheus, grafana, productWeb],
        observedPortHolders: [{ port: 3000, holderRef: productWeb }],
        appliedEffects: ['update-config', 'update-remote-write'],
        mutations: [
          {
            effect: 'update-config',
            resourceRef: prometheus,
            beforeRevision: 'rev-41',
            afterRevision: 'rev-42',
          },
          {
            effect: 'update-remote-write',
            resourceRef: prometheus,
            beforeRevision: 'rev-42',
            afterRevision: 'rev-43',
          },
        ],
        checks: [
          check('service-health', prometheus),
          check('target-boundary', prometheus),
          check('label-boundary', prometheus),
          check('remote-write-delivery', prometheus),
          check('sample-ordering', prometheus),
          check('retry-backoff', prometheus),
          check('sensitive-data-filter', grafana),
        ],
        receiptArtifactRef,
        receiptArtifactFingerprint: hash,
      },
      findings: [
        {
          code: 'SHARED_SERVICE_INVENTORIED',
          resourceRef: prometheus,
          port: null,
          holderRef: null,
          statement: 'The scrape stack was inventoried at revision rev-41 before any effect was applied.',
        },
      ],
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [receiptArtifactRef],
    handoff: null,
  },
};

const validBlockedOutput = {
  schemaVersion: 8,
  operatorId: 'platform.operate',
  output: {
    outcome: 'blocked',
    receipt: {
      receiptType: 'platform-operation-receipt',
      receiptId: 'receipt:observability-operation-blocked',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'blocked',
      binding,
      operation: null,
      findings: [
        {
          code: 'PORT_COORDINATION_REQUIRED',
          resourceRef: grafana,
          port: 3000,
          holderRef: productWeb,
          statement: 'Port 3000 is held by the product web service; the owners must agree on a port before Grafana binds.',
        },
      ],
      evidenceRefs,
      failure: {
        code: 'PORT_CONFLICT',
        message: 'The dashboard port this plan claims is already bound by another declared process.',
        resourceRefs: [grafana, productWeb],
        missingRefs: ['coordination://platform/port-3000'],
        retryable: true,
        owningDomain: 'platform',
      },
      resume: {
        resumeToken: 'resume-observability-1',
        requiredDelta: ['Agree a free dashboard port with the product owner, then rebind the inventory fingerprint.'],
      },
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [],
    handoff: null,
  },
};

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validOperatedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedOutput), { valid: true, errors: [] });

// An effect filed under the wrong service kind is how a Sonar change enters an observability plan.
const crossKindEffect = structuredClone(validInput);
crossKindEffect.input.desiredState.effects.push('assign-gate');
assert.equal(validateInput(crossKindEffect).valid, false);

// The caller cannot narrow the proof set; a green dashboard alone never proved delivery or redaction.
const narrowedProof = structuredClone(validInput);
narrowedProof.input.desiredState.requiredCheckNames = narrowedProof.input.desiredState.requiredCheckNames.filter(
  (name) => name !== 'sensitive-data-filter',
);
assert.equal(validateInput(narrowedProof).valid, false);

// A shared service is inventoried before it is changed, so an uninventoried resource cannot be desired.
const uninventoriedDesire = structuredClone(validInput);
uninventoriedDesire.input.desiredState.resourceRefs.push('service://observability/loki');
uninventoriedDesire.input.scope.mutableResourceRefs.push('service://observability/loki');
assert.equal(validateInput(uninventoriedDesire).valid, false);

// The capability the kind needs is required; without it the operation would be attempted unauthorised.
const missingCapability = structuredClone(validInput);
missingCapability.context.capabilities = [
  {
    handleRef: 'capability://starci/sonar-project-admin',
    capability: 'sonar:project-admin',
    custodyEvidenceRef: 'custody://control-panel/sonar',
  },
];
assert.equal(validateInput(missingCapability).valid, false);

// A credential value is resolved for use, never carried inside the operator contract.
const rawCredential = structuredClone(validInput);
rawCredential.context.capabilities[0].custodyEvidenceRef = 'custody://control-panel/token=AbCdEfGhIjKlMnOpQrStUvWxYz012345';
assert.equal(validateInput(rawCredential).valid, false);

// Mutating a resource the inventory never listed is the unbounded change this operator forbids.
const uninventoriedMutation = structuredClone(validOperatedOutput);
uninventoriedMutation.output.receipt.operation.mutations[0].resourceRef = 'service://observability/loki';
const uninventoriedResult = validateOutput(uninventoriedMutation);
assert.equal(uninventoriedResult.valid, false);
assert.ok(uninventoriedResult.errors.some((error) => error.includes('without being inventoried first')));

// A failed check cannot be reported as an operated service.
const failedCheck = structuredClone(validOperatedOutput);
failedCheck.output.receipt.operation.checks[3].status = 'failed';
assert.equal(validateOutput(failedCheck).valid, false);

// Nor can a missing one: the whole published proof set is required before the service is proved.
const missingCheck = structuredClone(validOperatedOutput);
missingCheck.output.receipt.operation.checks.pop();
const missingCheckResult = validateOutput(missingCheck);
assert.equal(missingCheckResult.valid, false);
assert.ok(missingCheckResult.errors.some((error) => error.includes('sensitive-data-filter')));

// An already-converged service is a proved no-op and can report no mutation.
const noopWithMutation = structuredClone(validOperatedOutput);
noopWithMutation.output.receipt.operation.convergence = 'already-converged';
assert.equal(validateOutput(noopWithMutation).valid, false);

// A port already in use is a coordination finding, never an operated outcome.
const portFindingOperated = structuredClone(validOperatedOutput);
portFindingOperated.output.receipt.findings.push({
  code: 'PORT_COORDINATION_REQUIRED',
  resourceRef: grafana,
  port: 3000,
  holderRef: productWeb,
  statement: 'Port 3000 is already bound.',
});
assert.equal(validateOutput(portFindingOperated).valid, false);

// The finding must name who holds the port; an unnamed holder cannot be coordinated with.
const unnamedHolder = structuredClone(validBlockedOutput);
unnamedHolder.output.receipt.findings[0].holderRef = null;
assert.equal(validateOutput(unnamedHolder).valid, false);

// Freeing a claimed port by mutating the process that holds it is exactly what is forbidden.
const holderMutated = structuredClone(validOperatedOutput);
holderMutated.output.receipt.operation.mutations.push({
  effect: 'restart-service',
  resourceRef: productWeb,
  beforeRevision: 'rev-7',
  afterRevision: 'rev-8',
});
holderMutated.output.receipt.operation.appliedEffects.push('restart-service');
const holderResult = validateOutput(holderMutated);
assert.equal(holderResult.valid, false);
assert.ok(holderResult.errors.some((error) => error.includes('must never be mutated to free it')));

// A capability handle written into the receipt is a persisted credential.
const leakedHandle = structuredClone(validOperatedOutput);
leakedHandle.output.evidenceRefs.push('capability://starci/metrics-remote-write');
assert.equal(validateOutput(leakedHandle).valid, false);

// A blocked receipt never carries an operation.
const blockedWithOperation = structuredClone(validBlockedOutput);
blockedWithOperation.output.receipt.operation = validOperatedOutput.output.receipt.operation;
assert.equal(validateOutput(blockedWithOperation).valid, false);

console.log('platform.operate self-test passed');
