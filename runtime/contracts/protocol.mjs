import { createHash } from 'node:crypto';

const sha = /^sha256:[0-9a-f]{64}$/;
const session = /^session:\/\/tasks\/[A-Za-z0-9._-]+\/.+$/;
const capability = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const kinds = new Set(['observed-fact', 'approved-intent', 'constraint', 'inference', 'hypothesis', 'proposed-target']);
const risks = new Set(['read-only', 'source-write', 'business-change', 'database-change', 'external']);
const necessities = new Set(['required', 'recommended', 'optional']);
const authorizationKinds = new Set(['objective', 'approval']);

export const stableFingerprint = (value) => {
  const normalize = (item) => Array.isArray(item)
    ? item.map(normalize)
    : item && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]))
      : item;
  return `sha256:${createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex')}`;
};

export function validateClaim(claim) {
  const errors = [];
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return { valid: false, errors: ['claim must be an object'] };
  if (!kinds.has(claim.kind)) errors.push('claim.kind is invalid');
  if (!claim.id || !claim.statement) errors.push('claim identity and statement are required');
  if (!Array.isArray(claim.evidenceRefs)) errors.push('claim.evidenceRefs must be an array');
  if (['observed-fact', 'approved-intent', 'constraint'].includes(claim.kind) && claim.evidenceRefs?.length === 0) errors.push(`${claim.kind} requires evidence`);
  if (claim.kind === 'hypothesis' && claim.confidence === 'high') errors.push('a hypothesis cannot claim high confidence');
  return { valid: errors.length === 0, errors };
}

export function validateHandoff(value) {
  const errors = [];
  if (!value?.objectiveId || !capability.test(value?.fromCapability ?? '')) errors.push('handoff identity is invalid');
  if (!Array.isArray(value?.artifacts) || !Array.isArray(value?.nextCandidates)) errors.push('artifacts and nextCandidates are required arrays');
  for (const [index, candidate] of (value?.nextCandidates ?? []).entries()) {
    if (!capability.test(candidate.capability ?? '')) errors.push(`nextCandidates[${index}].capability is invalid`);
    if (!necessities.has(candidate.necessity)) errors.push(`nextCandidates[${index}].necessity is invalid`);
    if (!risks.has(candidate.risk)) errors.push(`nextCandidates[${index}].risk is invalid`);
    if (!['sequential', 'side-branch'].includes(candidate.transitionKind)) errors.push(`nextCandidates[${index}].transitionKind is invalid`);
    if (typeof candidate.objectiveAuthorized !== 'boolean') errors.push(`nextCandidates[${index}].objectiveAuthorized is required`);
    if (candidate.authorizationKind !== undefined && !authorizationKinds.has(candidate.authorizationKind)) errors.push(`nextCandidates[${index}].authorizationKind is invalid`);
    if (candidate.authorizationKind === 'approval' && !session.test(candidate.authorizationRef ?? '')) errors.push(`nextCandidates[${index}].authorizationRef is invalid`);
    if (!session.test(candidate.inputRef ?? '')) errors.push(`nextCandidates[${index}].inputRef is invalid`);
    const authorityChanging = ['business-change', 'database-change', 'external'].includes(candidate.risk);
    if (authorityChanging && candidate.requiresApproval !== true) errors.push(`nextCandidates[${index}] authority-changing mutation requires approval`);
    if (candidate.risk === 'source-write' && !candidate.objectiveAuthorized && candidate.requiresApproval !== true) errors.push(`nextCandidates[${index}] unauthorized source write requires approval`);
    if (candidate.transitionKind === 'side-branch' && !candidate.resumeCapability) errors.push(`nextCandidates[${index}] side branch requires resumeCapability`);
    if (candidate.transitionKind === 'sequential' && candidate.resumeCapability !== null) errors.push(`nextCandidates[${index}] sequential transition cannot declare resumeCapability`);
  }
  const retained = new Set(value?.cleanup?.retainUntilAck ?? []);
  for (const artifact of value?.artifacts ?? []) {
    if (!session.test(artifact.ref ?? '') || !sha.test(artifact.contentSha256 ?? '')) errors.push(`artifact ${artifact.artifactId ?? '?'} has invalid identity`);
    if ((value?.nextCandidates?.length ?? 0) > 0 && !retained.has(artifact.ref)) errors.push(`artifact ${artifact.artifactId ?? '?'} must be retained until ACK`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateAck(handoff, ack) {
  const errors = [];
  if (handoff?.objectiveId !== ack?.objectiveId) errors.push('ACK objective differs from handoff');
  const artifacts = new Map((handoff?.artifacts ?? []).map((artifact) => [artifact.ref, artifact.contentSha256]));
  if (!Array.isArray(ack?.artifactRefs) || ack.artifactRefs.length === 0) errors.push('ACK needs artifactRefs');
  if (ack?.artifactRefs?.length !== ack?.acceptedSha256?.length) errors.push('ACK artifact and hash counts differ');
  for (const [index, ref] of (ack?.artifactRefs ?? []).entries()) {
    if (!artifacts.has(ref)) errors.push(`ACK references unknown artifact ${ref}`);
    if (artifacts.get(ref) !== ack?.acceptedSha256?.[index]) errors.push(`ACK hash mismatch for ${ref}`);
  }
  return { valid: errors.length === 0, errors };
}

export function contextFreshness(receipt, expected) {
  if (!receipt) return { decision: 'initialize-required', reason: 'missing' };
  if (receipt.status === 'invalid') return { decision: 'blocked', reason: 'invalid' };
  for (const field of ['project', 'contextKind', 'sourceFingerprint', 'generatorFingerprint', 'schemaVersion']) {
    if (receipt[field] !== expected[field]) return { decision: 'initialize-required', reason: `${field}-drift` };
  }
  if (!sha.test(receipt.artifactSha256 ?? '') || !session.test(receipt.receiptId ?? '')) return { decision: 'blocked', reason: 'malformed-receipt' };
  return { decision: 'fresh', reason: 'current' };
}

export function validateTechStackModel(model) {
  const errors = [];
  if (!model?.observed || !model?.target) return { valid: false, errors: ['observed and target stack models are required'] };
  for (const [side, stack] of [['observed', model.observed], ['target', model.target]]) {
    const componentIds = new Set();
    for (const component of stack.components ?? []) {
      if (componentIds.has(component.id)) errors.push(`${side}: duplicate component ${component.id}`);
      componentIds.add(component.id);
      if (!component.deployableUnit) errors.push(`${side}: ${component.id} lacks a deployable unit`);
    }
    const storeIds = new Set();
    for (const store of stack.stores ?? []) {
      if (storeIds.has(store.id)) errors.push(`${side}: duplicate store ${store.id}`);
      storeIds.add(store.id);
      for (const field of ['physicalInstance', 'database', 'namespace', 'owner', 'migrationOwner']) {
        if (!store[field] || ['unknown', 'default', 'database'].includes(String(store[field]).toLowerCase())) errors.push(`${side}: ${store.id} has generic or missing ${field}`);
      }
      if (!componentIds.has(store.owner)) errors.push(`${side}: ${store.id} owner is not a declared component`);
      if (!componentIds.has(store.migrationOwner)) errors.push(`${side}: ${store.id} migration owner is not a declared component`);
    }
    for (const edge of stack.communications ?? []) {
      if (!componentIds.has(edge.from) || !componentIds.has(edge.to)) errors.push(`${side}: communication edge has an unknown endpoint`);
      if (!edge.failurePolicyRef) errors.push(`${side}: communication edge lacks failure policy`);
    }
  }
  if (model.status === 'approved' && (model.contradictions ?? []).some((item) => item.severity === 'critical' && item.disposition === 'unresolved')) {
    errors.push('approved stack contains an unresolved critical contradiction');
  }
  return { valid: errors.length === 0, errors };
}
