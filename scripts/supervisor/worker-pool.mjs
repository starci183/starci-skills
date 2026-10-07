// worker-pool.mjs - which model a [Worker] job runs on (scripts/supervisor/workers.mjs routeWorker): the worker seat's tier
// chain (modules/models/tiers.yaml seats.worker) minus the agents the job avoids or that are unavailable. The launch itself
// goes through the common picker (admission), which applies bias, balance and token use to the chain it is given.
/**
 * Pick the worker's member: the first member of `members` whose provider is not avoided and is available. `availabilityOf(provider)`
 * -> {state, reason}; `prefer` keeps one provider. Pure given its inputs. Returns {pool, agent, model, effort, tier, skipped, allowGroup} or {error}.
 */
export function pickWorkerPool({ members, availabilityOf = () => ({ state: 'available' }), prefer = null, avoid = [] }) {
  const skipped = [];
  const candidates = [];
  for (const member of members) {
    if (prefer && member.provider !== prefer) continue;
    if (avoid.includes(member.provider)) { skipped.push({ pool: member.pool, reason: `${member.provider} failed worker readiness` }); continue; }
    const availability = availabilityOf(member.provider);
    if (availability?.state === 'unavailable') { skipped.push({ pool: member.pool, reason: availability.reason }); continue; }
    candidates.push({ pool: member.pool, agent: member.provider, model: member.model, effort: member.effort ?? null, tier: member.tier });
  }
  if (!candidates.length) return { error: prefer ? `agent '${prefer}' is not available for a worker` : 'no worker pool is available', skipped };
  return { ...candidates[0], skipped, allowGroup: candidates.map(({ agent, model, pool, effort }) => ({ provider: agent, model, pool, effort })) };
}
