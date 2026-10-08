// A provider whose login Orca reports as expired: the one detection and the one sentence every surface shows the owner
// (admission refusals of `supervisor start` and `workflow start`, the host checklist row). Pure.
export const LOGIN_EXPIRED_KIND = 'login-expired';
const EXPIRED_TEXT = /expired|re-?authenticate|log ?in again|sign ?in again|unauthori[sz]ed/i;

/** {provider, hostMessage, action} when the account entry says the login expired, else null. */
export function loginExpiredOf(provider, entry) {
  if (!entry || entry.status === 'ok') return null;
  const message = typeof entry.error === 'string' ? entry.error.trim() : '';
  const kind = entry.usageMetadata?.failureKind;
  if (kind === 'stale-token') return null; // Orca refreshes a stale token itself
  if (!EXPIRED_TEXT.test(message) && kind !== LOGIN_EXPIRED_KIND) return null;
  return { provider, hostMessage: message || 'the login has expired', action: `log in to ${provider} again in Orca (Settings > Accounts), then retry` };
}

/** The sentence naming the provider, the host's own message and the action. */
export const loginExpiredText = ({ provider, hostMessage, action }) => `the ${provider} login has expired (Orca says: "${hostMessage}"); ${action}`;
