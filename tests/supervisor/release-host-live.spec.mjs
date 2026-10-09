import test from 'node:test';
import assert from 'node:assert/strict';
import { liveRowsMissing } from '../../scripts/supervisor/release-host-live.mjs';
import { releaseHostMissing, releaseHostWhy } from '../../scripts/supervisor/release-host.mjs';
import { probeOrcaAccount } from '../../scripts/agent/quota/orca-account.mjs';


const NOW = Date.parse('2026-10-09T10:00:00Z');
const POLICY = { version: 1, reservePercent: 80, exhaustedPercent: 100, maxAgeMs: 120_000, hostPolledMaxAgeMs: 300_000 };
const trusted = () => ({ ok: true });
const window = (usedPercent, resetsAt) => ({ usedPercent, resetsAt, windowMinutes: 300 });
// An Orca account list whose entry for `provider` was polled `ageMs` ago, with a session window resetting at `resetsAt`.
const entryList = (ageMs, resetsAt = NOW + 3_600_000, status = 'ok') => () => ({ ok: true, accounts: {}, rateLimits: {
  claude: { status, updatedAt: NOW - ageMs, session: window(10, resetsAt), weekly: window(5, NOW + 86_400_000) } } });
const probeWith = (list) => (provider) => probeOrcaAccount(provider, { now: NOW, policy: POLICY, accountList: list });
const only = (providers, over) => liveRowsMissing({ repo: '/live/checkout', providers, now: NOW, policy: POLICY, trust: trusted, ...over });

test('only the providers whose quota Orca polls are read: claude and codex by their agent cards, devin (its own auth probe) is not', () => {
  const asked = [];
  assert.deepEqual(liveRowsMissing({ repo: '/live/checkout', now: NOW, policy: POLICY, trust: trusted, probe: (provider) => { asked.push(provider); return probeWith(entryList(10_000))(provider); } }).map((m) => m.need), ['an admissible codex account']);
  assert.deepEqual(asked, ['claude', 'codex']);
});



test('a provider with a fresh host-polled quota and a checkout inside launchTrust leave nothing missing', () => {
  assert.deepEqual(only(['claude'], { probe: probeWith(entryList(10_000)) }), []);
});

test('a stale Orca poll is refused naming the provider, the age of the poll and the fix of focusing the Orca window', () => {
  const [need, ...rest] = only(['claude'], { probe: probeWith(entryList(900_000)) });
  assert.equal(rest.length, 0);
  assert.equal(need.need, 'fresh claude quota evidence');
  assert.match(need.why, /Orca's last claude usage poll is 900 s old \(limit 300 s\)/);
  assert.match(need.fix, /focus the Orca window until the usage panel refreshes/);
});

test('a fresh poll whose session window already reset is refused as stale, with the same fix', () => {
  const [need] = only(['claude'], { probe: probeWith(entryList(10_000, NOW - 60_000)) });
  assert.equal(need.need, 'fresh claude quota evidence');
  assert.match(need.why, /claude quota window Orca polled 10 s ago already reset/);
  assert.match(need.fix, /focus the Orca window/);
});

test('an entry without a poll time is refused as having no poll', () => {
  const list = () => ({ ok: true, accounts: {}, rateLimits: { claude: { status: 'ok', session: window(10, NOW + 3_600_000) } } });
  const [need] = only(['claude'], { probe: probeWith(list) });
  assert.match(need.why, /Orca has no usage poll for claude/);
});

test('a provider the host cannot admit (no account entry, unavailable) is a red row named by provider, never a skip', () => {
  const missing = only(['claude', 'codex'], { probe: probeWith(() => ({ ok: true, accounts: {}, rateLimits: { claude: { status: 'unavailable', updatedAt: NOW, error: 'logged out' } } })) });
  assert.deepEqual(missing.map((m) => m.need), ['an admissible claude account', 'an admissible codex account']);
  assert.match(missing[0].why, /logged out.*red row, never a skip/);
  assert.match(missing[0].fix, /log claude in on the release host/);
});

test('a checkout outside launchTrust is refused with the verdict reason and the live checkout as the fix', () => {
  const [need] = only([], { trust: () => ({ ok: false, reason: 'launch repository is outside the exact owner-approved roots' }) });
  assert.equal(need.need, 'a checkout inside launchTrust');
  assert.match(need.why, /\/live\/checkout cannot launch the live smokes: launch repository is outside the exact owner-approved roots/);
  assert.match(need.fix, /live checkout/);
});

test('the release host check carries the live needs into its refusal text, and reads them only with a repository and a reachable Orca', () => {
  const base = { env: { ORCA_TERMINAL_HANDLE: 'term_1' }, orca: () => ({ ok: true, reachable: true }), docker: () => ({ status: 0 }) };
  const live = ({ repo }) => [{ need: 'fresh claude quota evidence', why: `poll old in ${repo}`, fix: 'focus the Orca window until the usage panel refreshes' }];
  assert.deepEqual(releaseHostMissing({ ...base, live }), []);
  const missing = releaseHostMissing({ ...base, repo: '/live/checkout', live });
  assert.match(releaseHostWhy(missing), /fresh claude quota evidence \(poll old in \/live\/checkout; focus the Orca window until the usage panel refreshes\)/);
  const down = releaseHostMissing({ ...base, orca: () => ({ ok: false, reachable: false }), repo: '/live/checkout', live });
  assert.deepEqual(down.map((m) => m.need), ['a reachable Orca']);
});
