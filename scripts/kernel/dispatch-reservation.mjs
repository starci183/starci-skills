/**
 * Reserve a dispatch's scoped leases under its actual workflow cap before a worker starts.
 * Preserve typed queued waits and refusal attribution; only a successful durable reservation returns.
 */
import { VerbExit } from './verbs/shared/verb-exit.mjs';
export function reserveDispatch({ledger,args,job,jobId,payload,packet,op,model,repo,emit,internals}){
  const {reserveOpLeases,DISPATCH_LEASE_TTL_MS,livePathLeaseWait,rejectDispatch}=internals,db=ledger.db;
  const leaseTtlMs = Number(args['lease-ttl'] ?? payload.leaseTtlMs ?? 0) || DISPATCH_LEASE_TTL_MS;
  let reserve;
  try {
    reserve = reserveOpLeases(ledger, job, payload, { ttlMs: leaseTtlMs, repo });
  } catch (e) {
    // Identity/status refusal (job already leased/running, or row drift): the
    // job is left untouched — an operator error, not a dispatch rejection.
    const error = String(e?.message ?? e);
    emit({ ok: false, jobId, refused: 'reserve-failed', error }, `dispatch REFUSED for ${jobId}: ${error}`, args.json);
    throw new VerbExit(1);
  }
  if (!reserve.ok) {
    if (reserve.reason === 'max-ops') {
      emit({ ok: false, jobId, reason: 'max-ops', slots: reserve.slots }, `dispatch WAITING for ${jobId}: max-ops; the job stays queued`, args.json); throw new VerbExit(1);
    }
    const reason = (reserve.reasons ?? [reserve.reason]).filter(Boolean).join('; ') || 'reservation refused';
    // A holder that took the lease between the pre-check and reserve is the same wait. Only when every
    // refusal reason is about a conflicting path (the overlap, or the capacity-1 row it fills) — a
    // missing capacity or the machine arbiter is still a rejection.
    const conflictKeys = new Set((reserve.pathConflicts ?? []).flatMap((c) => [c.requested, c.held]));
    const pathOnly = (reserve.reasons ?? []).length > 0 && reserve.reasons.every((r) => /overlaps durable lease/.test(r)
      || [...conflictKeys].some((key) => r.startsWith(`resource ${key} capacity `)));
    const raceWait = pathOnly ? livePathLeaseWait(db, job, payload, { conflicts: reserve.pathConflicts }) : null;
    if (raceWait) {
      emit({ ok: false, jobId, op, reason: 'path-lease', waiting: true, ...raceWait },
        `dispatch WAITING for ${jobId} (${op}): path-lease — ${raceWait.detail}`, args.json);
      throw new VerbExit(1);
    }
    const rejection = rejectDispatch(ledger, job, jobId, op, model, { step: 'reserve', error: reason });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, reserve, rejection },
      `dispatch REJECTED for ${jobId} (reserve): ${reason} — job status=${rejection.status}`, args.json);
    throw new VerbExit(1);
  }
  return reserve;
}
