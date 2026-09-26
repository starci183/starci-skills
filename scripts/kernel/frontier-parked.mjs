// frontier-parked.mjs - which queued jobs are parked behind a recorded wait through their dependency chain.
//
// A job queued `--after` (or behind an earlier leg, its cut's seam, a record it dependsOn) a job that a
// typed wait holds reads queuedBecause dependency, yet nothing but that wait can release it: it runs only
// after the held job does. api status counted it as engaged work, so a workflow whose only open operations
// were a peer-wait-held job and its dependant read frontier `engaged` instead of `peer-wait`, and the
// supervisor's stall check (scripts/supervisor/stall.mjs, which reads that frontier) alerted STALLED on a
// workflow correctly parked on its peer (starci-next wf-sn-subscription-mufrhhro inc-56d621d6359e: ord-6
// --after ord-3, ord-3 held by peer-wait; nivo wf-nivo-academy-debt-mugycgwl "queued: peer-wait 1,
// dependency 1"). api status (cmdStatus) is the one place that judges it; stall reads the frontier.

/**
 * The wait at the end of each queued dependant's chain. `queued` is api status frontier.queued
 * ([{jobId, queuedBecause, blockedBy}]), `heldSettle` its heldSettleJobs ([{jobId, heldBecause, blockedBy}]).
 * A queued job held by an owner-gate or peer-wait, or a settle a wait defers, is a root; a queued job whose
 * queuedBecause is `dependency` and whose blockedBy.job is a root or another parked dependant is parked
 * behind that root. Returns Map jobId -> {heldBecause, incident, peer?, via, settle?} for the dependants only
 * (`via` is the held job the chain ends in; `settle` when that job's settle is what the wait holds). A chain
 * that ends in anything else (a running job, a ready or capacity-queued job, a cycle) parks nothing.
 */
export function parkedBehindWaits(queued = [], heldSettle = []) {
  const roots = new Map();
  for (const item of queued) {
    if (['owner-gate', 'peer-wait'].includes(item.queuedBecause) && item.blockedBy?.incident) {
      roots.set(item.jobId, { heldBecause: item.queuedBecause, incident: item.blockedBy.incident, ...(item.blockedBy.peer ? { peer: item.blockedBy.peer } : {}), via: item.jobId });
    }
  }
  for (const item of heldSettle) {
    if (item.blockedBy?.incident) roots.set(item.jobId, { heldBecause: item.heldBecause, incident: item.blockedBy.incident, ...(item.blockedBy.peer ? { peer: item.blockedBy.peer } : {}), via: item.jobId, settle: true });
  }
  const byId = new Map(queued.map((item) => [item.jobId, item]));
  const memo = new Map();
  const rootOf = (jobId, seen) => {
    if (roots.has(jobId)) return roots.get(jobId);
    if (memo.has(jobId)) return memo.get(jobId);
    const item = byId.get(jobId);
    if (!item || item.queuedBecause !== 'dependency' || !item.blockedBy?.job || seen.has(jobId)) return null;
    seen.add(jobId);
    const root = rootOf(item.blockedBy.job, seen);
    memo.set(jobId, root);
    return root;
  };
  const out = new Map();
  for (const item of queued) {
    if (item.queuedBecause !== 'dependency') continue;
    const root = rootOf(item.jobId, new Set());
    if (root) out.set(item.jobId, root);
  }
  return out;
}

/**
 * Open operations a recorded wait holds, as the frontier's engaged test counts them: every queued job a
 * peer-wait holds, every settle a wait defers, and every dependant parked behind either (a dependant
 * parked behind an owner-gate-held queued job counts like that job does: as open). `parked` is
 * parkedBehindWaits' map.
 */
export function waitHeldOperations(queued = [], heldSettle = [], parked = new Map()) {
  const peerHeld = queued.filter((item) => item.queuedBecause === 'peer-wait').length;
  const behind = [...parked.values()].filter((root) => root.settle || root.heldBecause === 'peer-wait').length;
  return peerHeld + heldSettle.length + behind;
}
