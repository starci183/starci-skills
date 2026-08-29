import test from 'node:test';
import assert from 'node:assert/strict';
import { contextFreshness, stableFingerprint, validateAck, validateClaim, validateHandoff, validateTechStackModel } from './protocol.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const artifactRef = 'session://tasks/task-1/artifacts/stack';
const baseHandoff = {
  objectiveId: 'objective-1', fromCapability: 'tech-stack.define', terminalState: { status: 'handoff', code: 'architecture-review-required' },
  artifacts: [{ artifactId: 'stack', ref: artifactRef, schemaId: 'tech-stack/v1', contentSha256: hash, producerCapability: 'tech-stack.define', state: 'approved' }],
  potentialSignals: ['architecture-review'],
  nextCandidates: [{ capability: 'architecture.critique', necessity: 'required', reasonCode: 'stack-boundary-review', risk: 'read-only', transitionKind: 'side-branch', objectiveAuthorized: true, requiresApproval: false, inputRef: artifactRef, resumeCapability: 'tech-stack.define' }],
  cleanup: { retainUntilAck: [artifactRef], purgeNow: [] }
};

test('claims distinguish evidence-backed observation from creative target', () => {
  assert.equal(validateClaim({ id: 'c1', kind: 'observed-fact', statement: 'NestJS is configured', evidenceRefs: [], confidence: 'high', status: 'active' }).valid, false);
  assert.equal(validateClaim({ id: 'c2', kind: 'proposed-target', statement: 'Split the writer service', evidenceRefs: [], confidence: 'medium', status: 'active' }).valid, true);
});

test('handoff retains typed artifacts and side branches declare resume', () => {
  assert.equal(validateHandoff(baseHandoff).valid, true);
  const invalid = structuredClone(baseHandoff);
  invalid.nextCandidates[0].resumeCapability = null;
  invalid.cleanup.retainUntilAck = [];
  assert.equal(validateHandoff(invalid).valid, false);
});

test('sequential source writes reuse objective authority without a redundant approval', () => {
  const handoff = structuredClone(baseHandoff);
  handoff.nextCandidates = [{ capability: 'frontend.implementation', necessity: 'required', reasonCode: 'approved-design-ready', risk: 'source-write', transitionKind: 'sequential', objectiveAuthorized: true, requiresApproval: false, inputRef: artifactRef, resumeCapability: null }];
  assert.equal(validateHandoff(handoff).valid, true);
  handoff.nextCandidates[0].objectiveAuthorized = false;
  assert.equal(validateHandoff(handoff).valid, false);
});

test('business, database and external changes require explicit approval', () => {
  for (const risk of ['business-change', 'database-change', 'external']) {
    const handoff = structuredClone(baseHandoff);
    handoff.nextCandidates = [{ capability: 'business.authority', necessity: 'required', reasonCode: 'authority-change', risk, transitionKind: 'sequential', objectiveAuthorized: true, requiresApproval: false, inputRef: artifactRef, resumeCapability: null }];
    assert.equal(validateHandoff(handoff).valid, false, risk);
    handoff.nextCandidates[0].requiresApproval = true;
    assert.equal(validateHandoff(handoff).valid, true, risk);
    handoff.nextCandidates[0].requiresApproval = false;
    handoff.nextCandidates[0].authorizationKind = 'objective';
    assert.equal(validateHandoff(handoff).valid, false, `${risk} rejects objective-only authority`);
  }
});

test('consumer ACK must bind exact artifact hashes', () => {
  assert.equal(validateAck(baseHandoff, { objectiveId: 'objective-1', consumerCapability: 'architecture.critique', artifactRefs: [artifactRef], acceptedSha256: [hash], status: 'accepted' }).valid, true);
  assert.equal(validateAck(baseHandoff, { objectiveId: 'objective-1', consumerCapability: 'architecture.critique', artifactRefs: [artifactRef], acceptedSha256: [`sha256:${'b'.repeat(64)}`], status: 'accepted' }).valid, false);
  assert.equal(validateAck(baseHandoff, { objectiveId: 'objective-1', consumerCapability: 'architecture.critique', artifactRefs: [artifactRef], acceptedSha256: [], status: 'accepted' }).valid, false);
});

test('context cache reuses only an exact source, generator and schema fingerprint', () => {
  const expected = { project: 'nivo', contextKind: 'tech-stack', sourceFingerprint: hash, generatorFingerprint: hash, schemaVersion: 1 };
  const receipt = { ...expected, receiptId: 'session://tasks/task-1/receipts/context', artifactRef: '.worktrees/sessions/task-1/receipts/tech-stack.json', artifactSha256: hash, status: 'fresh' };
  assert.deepEqual(contextFreshness(receipt, expected), { decision: 'fresh', reason: 'current' });
  assert.equal(contextFreshness(null, expected).decision, 'initialize-required');
  assert.equal(contextFreshness({ ...receipt, schemaVersion: 2 }, expected).decision, 'initialize-required');
  assert.equal(contextFreshness({ ...receipt, status: 'invalid' }, expected).decision, 'blocked');
  assert.equal(contextFreshness({ ...receipt, artifactSha256: 'bad' }, expected).decision, 'blocked');
  assert.equal(stableFingerprint({ b: 2, a: 1 }), stableFingerprint({ a: 1, b: 2 }));
});

const stackSide = {
  languages: ['TypeScript'], frameworks: ['NestJS'], packageManagers: ['npm'], versionConstraints: [],
  components: [{ id: 'api', kind: 'api', runtime: 'node-24', deployableUnit: 'api-image', evidenceRefs: ['manifest:api'] }],
  communications: [],
  stores: [{ id: 'primary-store', engine: 'postgresql', physicalInstance: 'postgres-primary', database: 'academy', namespace: 'public', owner: 'api', migrationOwner: 'api', authority: 'authoritative', evidenceRefs: ['config:db'] }],
  operations: { deploymentStrategy: 'rolling', scalingModel: 'horizontal', healthChecks: ['http'], observability: ['otel'], secretBoundary: 'runtime-secret', backupRestoreUnit: 'academy-database' }
};

test('tech-stack model requires exact operational ownership', () => {
  const model = { schemaVersion: 1, project: 'starci', observed: structuredClone(stackSide), target: structuredClone(stackSide), claims: [], contradictions: [], status: 'approved' };
  assert.equal(validateTechStackModel(model).valid, true);
  const generic = structuredClone(model); generic.target.stores[0].database = 'database';
  assert.equal(validateTechStackModel(generic).valid, false);
  const missingOwner = structuredClone(model); missingOwner.target.stores[0].migrationOwner = 'unknown-service';
  assert.equal(validateTechStackModel(missingOwner).valid, false);
  const unknownEndpoint = structuredClone(model); unknownEndpoint.target.communications.push({ from: 'api', to: 'queue-worker', mode: 'async', protocol: 'amqp', failurePolicyRef: 'retry' });
  assert.equal(validateTechStackModel(unknownEndpoint).valid, false);
  const contradicted = structuredClone(model); contradicted.contradictions.push({ id: 'x', leftClaimId: 'a', rightClaimId: 'b', severity: 'critical', disposition: 'unresolved', resolutionRef: null });
  assert.equal(validateTechStackModel(contradicted).valid, false);
});
