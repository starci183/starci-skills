// release-host-live.mjs - what the LIVE settle smokes (tests/api-orca/orca-settle-live.spec.mjs) need of the release host, read in seconds before the suite starts:
//   trust   the launch repository (the checkout the cut runs in) lies inside the owner's launchTrust roots: a lane clone does not, the live checkout does
//   quota   each provider the smokes launch whose quota Orca polls (its agent card says quota.probe orca-account: claude, codex) has fresh, usable host-polled quota evidence: Orca refreshes a provider's usage only while its window is focused,
//           and a stale poll (or a session window that already reset) makes admission answer no-eligible-candidate
// Policy for a provider the host cannot admit (logged out, out of quota, no fresh poll): its smoke is a RED row, never a skip. The smoke proves "settle works with provider X";
// a provider with no quota is not missing infrastructure of the runtime, but the proof is then absent, and a cut over an absent proof is refused here by name.
// The readers are injected: `probe(provider)` answers the normalized quota snapshot, `trust()` the launchTrust verdict, `policy` the admission policy, `now` the clock.
import { accountList } from '../api/orca/account-list.mjs';
import { probeOrcaAccount } from '../agent/quota/orca-account.mjs';
import { agentCardOf } from '../agent/credential-fingerprint.mjs';
import { launchTrustVerdict } from '../agent/launch-trust-policy.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { quotaMaxAgeMs } from '../lib/quota-evidence.mjs';
import { SETTLE_SMOKE_PROVIDERS } from '../kernel/launch-smoke-models.mjs';

const seconds = (ms) => Math.round(ms / 1000);
const FOCUS_FIX = 'focus the Orca window until the usage panel refreshes, then cut again';

/** Why a snapshot that is not fresh is not: the age of Orca's last poll against the limit, or a window that reset since the poll. */
function staleWhy(provider, snapshot, now, policy) {
  const limit = quotaMaxAgeMs(snapshot, policy);
  const at = snapshot.observedAt;
  if (at === null || at === undefined) return `Orca has no usage poll for ${provider} (the entry carries no poll time)`;
  const age = now - at;
  if (age > limit) return `Orca's last ${provider} usage poll is ${seconds(age)} s old (limit ${seconds(limit)} s)`;
  return `the ${provider} quota window Orca polled ${seconds(age)} s ago already reset or is invalid, so admission treats it as stale`;
}

/** The need of one provider's quota, or null when the live smoke can launch it. */
function quotaNeed(provider, snapshot, { now, policy }) {
  if (snapshot.state === 'dead') {
    return { need: `an admissible ${provider} account`, why: `${provider} cannot be admitted (${String(snapshot.detail ?? snapshot.state).slice(0, 140)}); its settle smoke is a red row, never a skip`, fix: `log ${provider} in on the release host or wait for its quota to reset, then cut again` };
  }
  if (snapshot.fresh !== true) return { need: `fresh ${provider} quota evidence`, why: staleWhy(provider, snapshot, now, policy), fix: FOCUS_FIX };
  return null;
}

/** The needs of the live settle smokes that the host does not meet: [{need, why, fix}], empty when they can launch. */
export function liveRowsMissing({ repo, providers = SETTLE_SMOKE_PROVIDERS, now = Date.now(), policy = allocationSettings()?.admission, probe = null, trust = null, polled = (provider) => agentCardOf(provider)?.quota?.probe === 'orca-account' } = {}) {
  const missing = [];
  const verdict = (trust ?? (() => launchTrustVerdict({ cwd: repo })))();
  if (!verdict.ok) {
    missing.push({ need: 'a checkout inside launchTrust', why: `${repo} cannot launch the live smokes: ${verdict.reason}`, fix: 'cut from the live checkout whose root config.yaml launchTrust.roots names (a lane clone is outside it)' });
  }
  let listed = null;
  const once = () => { listed ??= accountList(); return listed; };
  const read = probe ?? ((provider) => probeOrcaAccount(provider, { now, policy, accountList: once }));
  for (const provider of providers.filter((provider) => polled(provider))) {
    const need = quotaNeed(provider, read(provider), { now, policy });
    if (need) missing.push(need);
  }
  return missing;
}
