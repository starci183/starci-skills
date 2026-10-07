// start-worker.mjs — start one [Worker] agent from a worker route: the Supervisor's job launch
// (scripts/supervisor/workers.mjs spawnWorkers) and the launch smoke's supervisor-worker tree (scripts/kernel/launch-smoke.mjs).

/**
 * Start one [Worker] agent: a worker of its own Run, which the Supervisor's terminal `entry` creates and coordinates
 * (scripts/agent/lib.mjs startAgent: run-create --from entry, worker-start --spec --agent --model --effort,
 * worker-show attestation). `route` {agent, model, effort} from routeWorker; `worktree` its placement (a staging
 * checkout); `request` the launch's ledger identity; `start` replaces startAgent (specs). The startAgent receipt.
 */
export async function startWorkerAgent({ route, worktree, title, prompt, specFile = null, objective, entry = null, request, onCreated = null, start = null, env = process.env }) {
  const launch = start ?? (await import('./lib.mjs')).startAgent;
  return launch({ provider: route.agent, model: route.model, effort: route.effort, worktree, title, prompt, specFile, objective, entry, request, onCreated,
    role: 'worker', tier: route.tier ?? null, allowGroup: route.allowGroup ?? [{ provider: route.agent, model: route.model, pool: route.pool, effort: route.effort }],
    admission: route.admission ?? null, env });
}
