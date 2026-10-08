// The host checklist rows of provider logins: a provider whose login Orca reports as expired is red, naming the provider,
// Orca's own message and the action (the owner logs in again in Orca; nothing in the runtime can do that for him).
import { accountList } from '../api/orca/account-list.mjs';
import { loginExpiredOf, loginExpiredText } from '../lib/login-expired.mjs';
import { red } from './checklist-items.mjs';

/** One red row per provider whose login expired; none when Orca cannot list its accounts (the Orca row says so). Seam: list. */
export function loginRows({ list = accountList } = {}) {
  let listed = null;
  try { listed = list(); } catch { listed = null; }
  if (!listed?.ok) return [];
  return Object.entries(listed.rateLimits ?? {}).map(([provider, entry]) => loginExpiredOf(provider, entry)).filter(Boolean)
    .map((expired) => red('providers', `login:${expired.provider}`, `${expired.provider} login`, loginExpiredText(expired), expired.action));
}
