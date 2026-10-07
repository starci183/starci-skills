// worker-pool.mjs - which model pool a [Worker] job runs on (scripts/supervisor/workers.mjs routeWorker): the equal-share default and
// the pool pick, pure given their inputs.
/** Registry pool -> provider, for a pool the registry does not name. */
const AGENTS = Object.freeze({ 'claude-agent': 'claude', 'codex-agent': 'codex', 'devin-agent': 'devin' });


/** Equal weight for every pool the model registry declares — the absent-shares meaning. */
export const equalPoolShares = (runtimes) => Object.fromEntries(Object.keys(runtimes?.runtimes ?? {}).map((pool) => [pool, 1]));

/**
 * Pick the worker's pool: among config allocation.shares pools with a hard-tier model and an available
 * provider, the one furthest below its share. `recent` = {pool: count}; `availabilityOf(provider)` ->
 * {state, reason}. Pure given its inputs. Returns {pool, agent, model, effort, deficits, skipped} or {error}.
 */
export async function pickWorkerPool({ shares, runtimes, recent = {}, availabilityOf = () => ({ state: 'available' }), prefer = null, avoid = [] }) {
  const { balanceDeficits, resolveLaunchModel } = await import('../agent/models.mjs');
  const skipped = [];
  const candidates = [];
  for (const pool of Object.keys(shares ?? {})) {
    const provider = runtimes?.runtimes?.[pool]?.provider ?? AGENTS[pool] ?? null;
    if (!provider) { skipped.push({ pool, reason: 'no registry.yaml pool' }); continue; }
    if (prefer && provider !== prefer) continue;
    if (avoid.includes(provider)) { skipped.push({ pool, reason: `${provider} failed worker readiness` }); continue; }
    const launch = resolveLaunchModel(pool, 'hard', { runtimes });
    if (launch.error) { skipped.push({ pool, reason: launch.error }); continue; }
    const availability = availabilityOf(provider);
    if (availability?.state === 'unavailable') { skipped.push({ pool, reason: availability.reason }); continue; }
    candidates.push({ pool, agent: provider, model: launch.modelId, effort: launch.effort ?? null, limited: availability?.state === 'limited' });
  }
  if (!candidates.length) return { error: prefer ? `agent '${prefer}' is not available for a worker` : 'no worker pool is available', skipped };
  const deficits = balanceDeficits(candidates.map((c) => c.pool), { shares, recent });
  const best = candidates.reduce((a, c) => {
    if (!a) return c;
    if (a.limited !== c.limited) return a.limited ? c : a;
    return deficits[c.pool].deficit > deficits[a.pool].deficit + 1e-9 ? c : a;
  }, null);
  return { ...best, deficits, skipped, allowGroup: candidates.map(({ agent, model, pool, effort }) => ({ provider: agent, model, pool, effort })) };
}
