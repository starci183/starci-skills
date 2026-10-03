// Provider receipt SQL participates in the machine writer's existing fenced transactions.
import { hasTable } from '../../scripts/lib/sqlite.mjs';

export function providerReservationMethods({ need, parse, toJson, hex }) {
  // Provider/account slots are shared by all five agent roles. A clock timeout is not exit evidence.
  const providerReservationRow = (row) => row ? { id: row.id, fence: row.fence, attemptId: row.attempt_id,
    provider: row.provider, account: row.account, model: row.model, role: row.role, state: row.state,
    slots: row.slots, amountUnit: 'concurrent-launch', maxParallel: row.max_parallel,
    handle: row.handle, pid: row.pid, launchIdentity: row.launch_identity, hostRequestId: row.host_request_id, createdAt: row.created_at, updatedAt: row.updated_at,
    scope: parse(row.scope_json), estimate: parse(row.estimate_json), quota: parse(row.quota_json),
    override: parse(row.override_json), releasedAt: row.released_at, proof: parse(row.proof_json) } : null;
  function providerReservations(m, { provider = null, account = null, activeOnly = false } = {}) {
    if (!hasTable(m.db, 'provider_reservations')) return []; // A compatible v1 reader has never held these v2 receipts.
    const where = [], args = [];
    if (provider !== null) { where.push('provider=?'); args.push(provider); }
    if (account !== null) { where.push('account=?'); args.push(account); }
    if (activeOnly) where.push("state<>'released'");
    return m.db.prepare(`SELECT * FROM provider_reservations${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY fence`).all(...args).map(providerReservationRow);
  }
  function providerReservationUsage(m, { provider, account = 'default' } = {}) {
    if (!hasTable(m.db, 'provider_reservations')) return { running: null, reservations: [], observed: false };
    const reservations = providerReservations(m, { provider, account, activeOnly: true });
    return { running: reservations.length, reservations, observed: true };
  }
  /** Atomic last-slot admission. Replays preserve the original receipt; changed attempt meaning refuses. */
  function reserveProvider(m, { provider, account = 'default', attemptId, role, model, maxParallel, scope = null, quota = null, estimate = null, override = null } = {}) {
    need([provider, account, attemptId, model].every((value) => typeof value === 'string' && value.trim()), 'provider reservation needs provider, account, attemptId and concrete model');
    need(typeof role === 'string' && role.trim(), 'provider reservation needs one agent role'); // The DDL owns the allowed role domain.
    need(Number.isInteger(maxParallel) && maxParallel >= 0, 'provider reservation needs nonnegative integer maxParallel');
    return m.transaction((db) => {
      const existing = db.prepare('SELECT * FROM provider_reservations WHERE attempt_id=?').get(attemptId);
      if (existing) {
        if (existing.provider !== provider || existing.account !== account || existing.model !== model || existing.role !== role || existing.scope_json !== toJson(scope))
          return { ok: false, reason: 'attempt-conflict', reservation: providerReservationRow(existing) };
        return { ok: existing.state !== 'released', reason: existing.state === 'released' ? 'attempt-released' : 'reserved', reused: true, reservation: providerReservationRow(existing) };
      }
      const running = Number(db.prepare("SELECT count(*) n FROM provider_reservations WHERE provider=? AND account=? AND state<>'released'").get(provider, account).n);
      if (running >= maxParallel) return { ok: false, reason: 'capacity', running, maxParallel };
      const id = hex(16), at = m.now();
      const result = db.prepare("INSERT INTO provider_reservations(id,attempt_id,provider,account,model,role,scope_json,state,max_parallel,quota_json,estimate_json,override_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'reserved',?,?,?,?,?,?)")
        .run(id, attemptId, provider, account, model, role, toJson(scope), maxParallel, toJson(quota), toJson(estimate), toJson(override), at, at);
      db.prepare("INSERT INTO provider_reservation_events(reservation_id,at,from_state,to_state) VALUES(?,?,NULL,'reserved')").run(id, at);
      return { ok: true, reason: 'reserved', reused: false, reservation: providerReservationRow(db.prepare('SELECT * FROM provider_reservations WHERE fence=?').get(result.lastInsertRowid)) };
    });
  }
  const fencedProviderRow = (db, { id, fence, attemptId } = {}) => {
    const row = db.prepare('SELECT * FROM provider_reservations WHERE id=? AND fence=?').get(id ?? '', fence ?? -1);
    return row && (attemptId === undefined || row.attempt_id === attemptId) ? row : null;
  };
  /** Observe launch progress under its original fence; unknown still occupies its slot. */
  function markProviderReservation(m, { id, fence, attemptId, provider, account, model, role, state, launchIdentity = null, hostRequestId = null, handle = null, pid = null } = {}) {
    need(['launching', 'live', 'unknown'].includes(state), 'provider reservation observation needs launching, live or unknown');
    return m.transaction((db) => {
      const row = fencedProviderRow(db, { id, fence, attemptId });
      if (!row) return { ok: false, reason: 'fenced' };
      if (Object.entries({ provider, account, model, role }).some(([key, value]) => value !== undefined && row[key] !== value)) return { ok: false, reason: 'identity-conflict' };
      if (row.state === 'released') return { ok: false, reason: 'released' };
      if (state === 'launching' && (typeof launchIdentity !== 'string' || !launchIdentity.trim())) return { ok: false, reason: 'launch-identity-required' };
      if (launchIdentity !== null && row.launch_identity && row.launch_identity !== launchIdentity) return { ok: false, reason: 'launch-identity-conflict', reservation: providerReservationRow(row) };
      if (hostRequestId !== null && row.host_request_id && row.host_request_id !== hostRequestId) return { ok: false, reason: 'host-request-conflict', reservation: providerReservationRow(row) };
      if (state === 'launching' && row.state !== 'reserved' && row.state !== 'launching') return { ok: false, reason: 'state-regression' };
      if ((row.handle && handle && row.handle !== handle) || (row.pid && pid && row.pid !== pid)) return { ok: false, reason: 'identity-conflict' };
      const at = m.now();
      db.prepare('UPDATE provider_reservations SET state=?,launch_identity=coalesce(launch_identity,?),host_request_id=coalesce(host_request_id,?),handle=coalesce(handle,?),pid=coalesce(pid,?),updated_at=? WHERE id=? AND fence=?')
        .run(state, launchIdentity, hostRequestId, handle, pid, at, id, fence);
      if (row.state !== state) db.prepare('INSERT INTO provider_reservation_events(reservation_id,at,from_state,to_state) VALUES(?,?,?,?)').run(id, at, row.state, state);
      return { ok: true, reservation: providerReservationRow(db.prepare('SELECT * FROM provider_reservations WHERE id=?').get(id)) };
    });
  }
  /** Only the launcher/reconciler's definitive matching exit/no-effect receipt releases capacity. */
  function releaseProviderReservation(m, { id, fence, attemptId, proof } = {}) {
    return m.transaction((db) => {
      const row = fencedProviderRow(db, { id, fence, attemptId });
      if (!row) return { ok: false, reason: 'fenced' };
      if (row.state === 'released') return { ok: true, reused: true, reservation: providerReservationRow(row) };
      const affirmation = proof?.hostAffirmation;
      const reply = affirmation?.receipt, result = reply?.result;
      const residual = result?.residualResources ?? result?.worker?.residualResources;
      const identities = [result, result?.worker, result?.terminal].filter((value) => value && typeof value === 'object');
      const hostNoEffect = reply && typeof reply === 'object' && !['unknown', 'outcome_unknown'].includes(result?.state)
        && !['unknown', 'outcome_unknown'].includes(result?.worker?.state)
        && !(residual && typeof residual === 'object' && Object.keys(residual).length > 0)
        && !identities.some((value) => ['agentTerminalHandle', 'terminalHandle', 'handle', 'pid', 'processId', 'dispatchId'].some((key) => value[key] !== undefined && value[key] !== null && value[key] !== ''))
        && (result?.failedStage !== undefined || result?.stage !== undefined || typeof reply.error?.code === 'string' && reply.error.code.trim());
      const resolvedUnknown = row.state === 'unknown' && row.launch_identity && proof?.launchIdentity === row.launch_identity
        && row.host_request_id && affirmation?.requestId === row.host_request_id && affirmation.kind === 'worker-start-replay'
        && affirmation.replayed === true && affirmation.outcome === 'failed' && affirmation.effectState === 'none'
        && hostNoEffect;
      const noEffect = proof?.kind === 'failed-before-launch' && proof.confirmed === true && !row.handle && !row.pid
        && (['reserved', 'launching'].includes(row.state) || resolvedUnknown);
      const terminalEnded = row.handle && proof?.kind === 'closed' && proof.handle === row.handle
        && ['gone', 'disconnected'].includes(proof.terminalProof) && ['none', 'stopped'].includes(proof.processVerdict);
      const processEnded = !row.handle && row.pid && proof?.kind === 'process-exited' && proof.pid === row.pid;
      const ended = proof?.confirmed === true && (terminalEnded || processEnded)
        && (!row.pid || proof.pid == null || proof.pid === row.pid);
      if (!noEffect && !ended) return { ok: false, reason: 'exit-unproven', reservation: providerReservationRow(row) };
      const at = m.now();
      db.prepare("UPDATE provider_reservations SET state='released',released_at=?,updated_at=?,proof_json=? WHERE id=? AND fence=?").run(at, at, toJson(proof), id, fence);
      db.prepare("INSERT INTO provider_reservation_events(reservation_id,at,from_state,to_state,proof_json) VALUES(?,?,?,'released',?)").run(id, at, row.state, toJson(proof));
      return { ok: true, reused: false, reservation: providerReservationRow(db.prepare('SELECT * FROM provider_reservations WHERE id=?').get(id)) };
    });
  }
  return { reserveProvider, providerReservations, providerReservationUsage, markProviderReservation, releaseProviderReservation };
}
