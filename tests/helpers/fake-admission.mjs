// Explicit isolated admission evidence for host-free launch specs; never reads the owner's quota/database.
export function fakeAdmission({ used = {}, auth = 'ok', capacity = 0, onReserve = null } = {}) {
  const reservations = new Map(), calls = [];
  const record = (name, value) => calls.push([name, value]);
  return {
    calls, reservations,
    prepare: () => ({ ok: true, file: null }),
    circuit: () => null,
    quota(provider, { account = 'default', now = Date.now() } = {}) {
      const pressure = used[provider] ?? 10;
      return { schema: 'starci/quota-snapshot@1', provider, account, authority: 'provider-windows', auth,
        observedAt: now, fresh: true, state: pressure >= 100 ? 'dead' : pressure >= 90 ? 'limited' : 'ok',
        normalAdmission: pressure < 90, allowLaunchAttempt: pressure < 100,
        windows: [{ id: 'test-weekly', usedPercent: pressure, observedAt: now, resetsAt: now + 3600_000 }] };
    },
    usage: () => ({ running: capacity }),
    reserve(input) {
      record('reserve', input);
      const injected = onReserve?.(input);
      if (injected) return injected;
      const previous = reservations.get(input.attemptId);
      if (previous?.state === 'released') return { ok: false, reason: 'attempt-released' };
      const reservation = previous ?? { id: input.attemptId, attemptId: input.attemptId, fence: 1, provider: input.provider,
        account: input.account, model: input.model, role: input.role, state: 'reserved' };
      reservations.set(input.attemptId, reservation);
      return { ok: true, reservation, reused: Boolean(previous) };
    },
    mark(receipt, observation) {
      record('mark', observation);
      const stored = reservations.get(receipt.attemptId);
      if (!stored || stored.fence !== receipt.fence || stored.state === 'released') return { ok: false, reason: 'fenced' };
      if (observation.state === 'launching' && stored.launchIdentity && stored.launchIdentity !== observation.launchIdentity)
        return { ok: false, reason: 'launch-identity-conflict', reservation: stored };
      Object.assign(stored, observation);
      return { ok: true, reservation: stored };
    },
    release(receipt, proof) {
      record('release', proof);
      const stored = reservations.get(receipt.attemptId);
      if (!stored || !proof.confirmed) return { ok: false, reason: 'unproven' };
      stored.state = 'released';
      return { ok: true, reservation: stored };
    },
  };
}

/** Explicit provider observations for pure pool-policy specs. Missing production evidence stays refused. */
export function fakePoolCapacity(runtimes, overrides = {}, { now = Date.now() } = {}) {
  const io = fakeAdmission();
  return Object.fromEntries(Object.entries(runtimes?.runtimes ?? runtimes?.pools ?? {}).map(([id, pool]) => [pool.target ?? id, {
    running: 0, maxParallel: pool.maxParallel, auth: 'ok', quota: io.quota(pool.provider, { now }),
    openIncident: false, ...overrides[pool.target ?? id],
  }]));
}
import { loadRuntimes } from '../../scripts/agent/models.mjs';
import { pickOpModel } from '../../scripts/agent/op-pick.mjs';

/** The op router over explicit provider observations: `capacity` overrides per pool target; no capacity is a static plan. */
export function fakePoolSelection(options) {
  const runtimes = options.runtimes ?? loadRuntimes();
  return pickOpModel({ ...options, runtimes,
    ...(options.capacity ? { capacity: fakePoolCapacity(runtimes, options.capacity) } : {}) });
}
