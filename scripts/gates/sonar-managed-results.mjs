// One closed result vocabulary for the managed Sonar provider actions.
export const resultCodes = new Set([
  'sonar-action-unsupported', 'sonar-analysis-not-verified', 'sonar-analysis-processed',
  'sonar-analysis-readback-unreconciled', 'sonar-analysis-revision-mismatch', 'sonar-analysis-revision-required',
  'sonar-analysis-source-mismatch', 'sonar-browse-incomplete', 'sonar-browse-read', 'sonar-browse-unavailable', 'sonar-gate-api-unsupported', 'sonar-gate-condition-unreconciled',
  'sonar-gate-create-unreconciled', 'sonar-gate-name-mismatch', 'sonar-gate-not-observed', 'sonar-gate-read-unavailable',
  'sonar-gate-readback', 'sonar-gate-select-unreconciled',
  'sonar-local-users-readback', 'sonar-new-code-api-unsupported', 'sonar-new-code-read-unavailable', 'sonar-new-code-readback',
  'sonar-new-code-unreconciled', 'sonar-new-user-password-required', 'sonar-project-api-unsupported',
  'sonar-project-conflict', 'sonar-project-create-unreconciled', 'sonar-project-exists',
  'sonar-project-not-observed', 'sonar-project-read-unavailable', 'sonar-project-readback',
  'sonar-project-rekey-conflict', 'sonar-project-rekey-not-observed', 'sonar-project-rekey-readback',
  'sonar-project-rekey-source-missing', 'sonar-project-rekey-undeclared', 'sonar-project-rekey-unreconciled',
  'sonar-setting-api-unsupported', 'sonar-setting-read-unavailable', 'sonar-setting-readback-mismatch',
  'sonar-setting-readback', 'sonar-setting-write-unreconciled', 'sonar-token-absent',
  'sonar-token-api-unsupported', 'sonar-token-existing-credential-unverified',
  'sonar-token-generate-unreconciled', 'sonar-token-generated-auth-unverified', 'sonar-token-generated-identity-unverified',
  'sonar-token-generation-not-observed', 'sonar-token-read-unavailable', 'sonar-token-revocation-not-observed',
  'sonar-token-revoke-unreconciled', 'sonar-token-revoked', 'sonar-token-rotation-old-revoke-unreconciled',
  'sonar-token-rotation-source-missing', 'sonar-token-scope-conflict', 'sonar-token-seal-unreconciled',
  'sonar-token-sealed', 'sonar-token-value-binding-unverified', 'sonar-token-value-unrecoverable',
  'sonar-user-api-unsupported', 'sonar-user-conflict', 'sonar-user-create-unreconciled',
  'sonar-user-create-only-unsupported', 'sonar-user-inactive', 'sonar-user-not-observed', 'sonar-user-read-unavailable',
]);

export const fail = (code, extra = {}) => ({outcome: 'failed', code, writeAck: false, publicReadback: false, consumerVerified: false, ...extra});
export const verified = (code, extra = {}) => ({outcome: 'verified', code, writeAck: false, publicReadback: true, consumerVerified: false, ...extra});
export const uncertain = (code, extra = {}) => fail(code, {outcome: 'unknown', ...extra});
