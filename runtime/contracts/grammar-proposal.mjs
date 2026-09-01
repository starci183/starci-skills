import { createHash } from 'node:crypto';
import { validatorFor } from '../../operators/validation.mjs';

const sortValue = (value) => Array.isArray(value)
  ? value.map(sortValue)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]))
    : value;

export const fingerprintGrammarPattern = (value) => {
  const body = {
    contractVersion: value.contractVersion,
    proposalId: value.proposalId,
    patternName: value.patternName,
    scope: value.scope,
    anatomy: value.anatomy,
    universalInvariantRefs: value.universalInvariantRefs,
    consumerRefs: value.consumerRefs,
    platformInvariantRefs: value.platformInvariantRefs,
    responsiveBehaviorRefs: value.responsiveBehaviorRefs,
    focusBehaviorRefs: value.focusBehaviorRefs,
    scrollBehaviorRefs: value.scrollBehaviorRefs,
    alternativeRefs: value.alternativeRefs,
    migrationRefs: value.migrationRefs,
    riskRefs: value.riskRefs,
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(sortValue(body))).digest('hex')}`;
};

const semanticErrors = (value) => {
  const errors = [];
  const fingerprint = fingerprintGrammarPattern(value);
  if (value.patternFingerprint !== fingerprint) errors.push('$.patternFingerprint: must bind the exact proposed anatomy and evidence');
  if (value.consumerRefs.length < 2 && value.platformInvariantRefs.length === 0) errors.push('$.consumerRefs: require two independent consumers or one platform invariant');
  if (value.status === 'proposal' && value.approval !== null) errors.push('$.approval: an unreviewed proposal must not carry publication authority');
  if (value.status === 'approved' && (value.approval?.decision !== 'approve' || value.approval.patternFingerprint !== fingerprint)) {
    errors.push('$.approval: approved publication requires teacher authority bound to the exact pattern fingerprint');
  }
  if (value.status === 'rejected' && (value.approval?.decision !== 'reject' || value.approval.patternFingerprint !== fingerprint)) {
    errors.push('$.approval: rejection must bind teacher authority to the exact pattern fingerprint');
  }
  return errors;
};

export const validateGrammarProposal = validatorFor(new URL('./grammar-proposal.schema.json', import.meta.url), semanticErrors);
