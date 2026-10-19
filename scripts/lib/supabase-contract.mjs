/** Fixed public codes from Supabase adapters; private provider error strings never become receipts. */
export const supabaseResultCodes = new Set([
  'provider-operation-failed', 'supabase-action-invalid', 'supabase-action-policy-unavailable',
  'supabase-target-invalid', 'supabase-target-unavailable', 'supabase-resource-invalid',
  'supabase-project-ref-invalid', 'supabase-destination-required', 'supabase-credential-unavailable',
  'supabase-readback-unavailable', 'supabase-write-unknown', 'supabase-request-failed',
  'supabase-public-config-matches-secret-unverified', 'supabase-config-reconcile-unresolved',
  'supabase-config-applied-consumer-unverified', 'supabase-config-readback-mismatch',
  'supabase-declared-consumer-unavailable', 'supabase-edge-secret-present-consumer-unverified',
  'supabase-edge-secret-readback-mismatch', 'supabase-project-identity-mismatch',
  'supabase-project-list-invalid', 'supabase-project-identity-ambiguous', 'supabase-project-present',
  'supabase-project-create-unresolved', 'supabase-project-created-identity-unresolved',
  'supabase-project-created-readback', 'supabase-project-readback-mismatch',
  'supabase-api-key-list-invalid', 'supabase-selected-api-key-unavailable',
  'supabase-api-key-custody-matches', 'supabase-api-key-custody-unresolved',
  'supabase-api-key-custody-unknown', 'supabase-api-key-custody-failed', 'supabase-api-key-captured',
  'supabase-user-readback-unavailable', 'supabase-user-create-unknown', 'supabase-auth-request-failed',
  'supabase-user-list-invalid', 'supabase-user-identity-ambiguous', 'supabase-user-list-incomplete',
  'supabase-user-confirmation-mismatch', 'supabase-user-present', 'supabase-user-create-unresolved',
  'supabase-new-user-password-required', 'supabase-created-user-unresolved',
  'supabase-user-created-login-unverified', 'supabase-user-readback-mismatch',
  'supabase-auth-action-invalid', 'supabase-auth-target-invalid', 'supabase-auth-target-unavailable',
]);

/** Build a provider result from safe scalar facts; write acknowledgement and consumer verification remain separate. */
export const supabaseActionResult = (outcome, code, details = {}) => ({
  outcome, code: supabaseResultCodes.has(code) ? code : 'provider-operation-failed',
  writeAck: false, publicReadback: false, consumerVerified: false, ...details,
});

/** Return a finite preflight refusal without passing a target or provider body through the CLI. */
export const supabaseRefusal = (code) => ({
  code: 2, data: { schema: 'starci/provision-operation@1', ok: false,
    code: supabaseResultCodes.has(code) ? code : 'provider-operation-failed' },
});

/** Validate the declared email's basic shape with one linear scan and no ambiguous regex backtracking. */
export function supabaseEmailAddress(value) {
  if (typeof value !== 'string' || /\s/u.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const dot = parts[1].indexOf('.', 1);
  return dot > 0 && dot < parts[1].length - 1;
}

/** Classify usable key material in memory; masked values and unsupported shapes cannot become stored credentials. */
export function supabaseApiKeyKind(value) {
  if (typeof value !== 'string' || /[\r\n]/u.test(value)) return null;
  const modern = /^sb_(secret|publishable)_[A-Za-z0-9_-]{16,}$/u.exec(value);
  if (modern) return modern[1];
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value) ? 'legacy' : null;
}
