// api route: choose and persist one pool for a queued operation.
import { updateJob } from '../../../engine/ledger-db.mjs';
export default {
  verb: 'route',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  async run({ ledger, args, emit, internals }) {
    const { FINAL_SETTLED, refuseSettleBacklog, operationTerminalHandleOf, observeOperationWorker,
      jobPayloadOf, deferQueuedTestLeg, releaseTypedWaits, ownerGateOf, openOwnerGates, openPeerWaits,
      PEER_WAIT, opSlotAdmission, livePathLeaseWait, goalJsonOf, latestGoal, csvList,
      kernelBiasIgnored, biasIgnoredText, lineageRouteAdjust, path, fs, skillRoot, parseYaml,
      poolLoadOf, accountList, normalizeProviderId, probeQuotaSafe, providerHealthOf,
      circuitClearHint, ownerRoot, configuredAllocationPolicy, loadConfig, recentDispatchCounts,
      kindRouteOf, auditAuthorOf, isFanOutSlice, selectPool, AGENT_HIERARCHY_SCHEMA,
      operationNodeId, kernelNodeId, blockingViewOf } = internals;
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.status === 'effect_unknown') throw Object.assign(new Error(`job ${jobId} requires reconcile before it can be routed`), { code: 'job-reconcile-required' });
  if (FINAL_SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  if (job.status !== 'queued') throw Object.assign(new Error(`job ${jobId} cannot be routed while ${job.status}; only queued jobs are routable`), { code: 'job-not-queued' });
  // SETTLE-FIRST (driver-loop.yaml progress.settleFirst): no new route while filed reports wait unconsumed.
  refuseSettleBacklog(db, job.workflow_id, 'route');
  const priorWorker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${jobId} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of rerouting`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const kind = job.op_id ?? payload.opId;
  if (!kind) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });
  if (deferQueuedTestLeg(ledger, { job, op: kind, payload, via: 'route', args })) return;

  // Concurrency admission BEFORE the pool decision: a route that lands on a
  // full workflow is a decision the kernel cannot spend. The ceiling is the
  // lower of the owner's budgets.maxOps and the fleet's maxParallelOps.
  // A wait whose typed --until-* conditions already hold is released before the gates below read it.
  releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()), workflowId: job.workflow_id });
  // An owner-gate incident naming this job refuses first: no pool can run a
  // step only the owner drives.
  const heldBy = ownerGateOf(openOwnerGates(db, job.workflow_id), job);
  if (heldBy) {
    const out = { ok: false, jobId, kind, reason: heldBy.kind ?? 'owner-gate', incident: heldBy.incidentId };
    emit(out, `route REFUSED for ${jobId} (${kind}): ${heldBy.kind ?? 'owner-gate'} — incident ${heldBy.incidentId} holds it until the Kernel resolves it`, args.json);
    process.exit(1);
  }
  const peerHeldBy = ownerGateOf(openPeerWaits(db, job.workflow_id), job);
  if (peerHeldBy) {
    const out = { ok: false, jobId, kind, reason: PEER_WAIT, incident: peerHeldBy.incidentId, peer: peerHeldBy.peer };
    emit(out, `route REFUSED for ${jobId} (${kind}): peer-wait — incident ${peerHeldBy.incidentId} holds it until peer ${peerHeldBy.peer} lands what it waits on and the wait is resolved`, args.json);
    process.exit(1);
  }
  const slots = opSlotAdmission(db, job.workflow_id, { excludeJobId: jobId });
  if (!slots.ok) {
    const out = { ok: false, jobId, kind, reason: 'max-ops', slots };
    emit(out, `route REFUSED for ${jobId} (${kind}): max-ops — ${slots.running} operation(s) already hold a slot at ceiling ${slots.ceiling} (${slots.ceilingSource})`, args.json);
    process.exit(1);
  }
  // A live lease on the write set: no pool decision is spent (a route-decided per wake would read as a
  // reroute loop); the job waits queued path-lease and routes once the holder releases it.
  const leaseWait = livePathLeaseWait(db, job, payload, { repo: path.resolve(args.repo ?? process.cwd()) });
  if (leaseWait) {
    emit({ ok: false, jobId, kind, reason: 'path-lease', waiting: true, ...leaseWait },
      `route WAITING for ${jobId} (${kind}): path-lease — ${leaseWait.detail}`, args.json);
    process.exit(1);
  }

  const gj = goalJsonOf(latestGoal(db, job.workflow_id));
  const goalBias = gj.routing_bias ?? {};
  const bias = { prefer: [...new Set(csvList(goalBias.prefer))], avoid: [...new Set(csvList(goalBias.avoid))] };
  const biasIgnored = kernelBiasIgnored(args);
  if (biasIgnored) console.error(`api route WARNING: ${biasIgnoredText(biasIgnored)}`);
  // A retry learns from its own lineage: pools its earlier attempts failed on for a pool-attributable
  // cause are demoted (once) or excluded (twice) for it (scripts/kernel/lineage-route.mjs).
  // A lineage read that throws never blocks the route: it routes unadjusted and says why.
  let lineage = null, lineageError = null;
  try { lineage = lineageRouteAdjust(db, job); } catch (e) { lineageError = String(e?.message ?? e); }
  const difficulty = args.difficulty ?? payload.difficulty ?? 'medium';

  // Capacity per runtimes.yaml pool: live running count, declared maxParallel,
  // the provider quota probe and the typed, expiring provider-health circuit.
  // Generic workflow incidents are evidence for the Kernel, not provider
  // health. Their free-form text can mention every fallback provider (for
  // example while documenting a recovered dispatch failure), so substring
  // matching them here would permanently poison every pool because incidents
  // are intentionally append-only until workflow finish.
  const rtFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  const rtDoc = fs.existsSync(rtFile) ? parseYaml(fs.readFileSync(rtFile, 'utf8')) : null;
  const pools = rtDoc?.runtimes ?? {};
  // Pool load (poolLoadOf, shared with api status): running, leased and answering jobs hold their pool slot, and a
  // routed-but-queued one while its route hold lasts, so sequential route calls in one fan-out see the fleet filling
  // instead of piling every slice onto the first preferred pool. The job being routed holds nothing yet.
  const poolLoad = poolLoadOf(db, { excludeJobId: jobId });
  const runningByModel = poolLoad.byModel;
  let accounts = null;
  try { accounts = await accountList() ?? null; } catch { accounts = null; }
  const quotaByProvider = new Map();
  const capacity = {};
  for (const [poolId, rt] of Object.entries(pools)) {
    const target = rt?.target ?? poolId;
    const provider = rt?.provider ?? null;
    const providerKey = normalizeProviderId(provider);
    if (provider && !quotaByProvider.has(providerKey)) quotaByProvider.set(providerKey, await probeQuotaSafe(provider));
    const quota = provider ? quotaByProvider.get(providerKey)
      : { state: 'unknown', usedPercent: null, detail: 'pool declares no provider' };
    const providerHealth = provider ? providerHealthOf(db, provider) : null;
    capacity[target] = {
      running: runningByModel[target] ?? 0,
      maxParallel: rt?.maxParallel ?? null,
      quota,
      auth: providerHealth || quota?.state === 'dead' ? 'dead' : 'ok',
      authDetail: providerHealth
        ? `${providerHealth.detail ?? providerHealth.signal ?? providerHealth.failureKind ?? 'circuit open'} (circuit open until ${providerHealth.expiresAt ? new Date(providerHealth.expiresAt).toISOString() : 'explicit recovery'}${circuitClearHint(providerHealth)})`
        : quota?.detail ?? null,
      providerHealth,
      openIncident: false,
    };
  }

  // Owner allocation (config.yaml allocation, engine/config.mjs configuredAllocationPolicy): the policy,
  // target shares and window of the balanced allocator, and the grants that open an
  // explicit-workflow-quota pool (Devin). A declared grants list is the whole set of grants; with none
  // declared, or no readable config, routing keeps the runtimes.yaml default policy and ungated pools.
  let allocation = null;
  try { allocation = configuredAllocationPolicy(loadConfig(ownerRoot)); } catch { allocation = null; }
  const balancedRoute = (allocation?.policy ?? rtDoc?.allocation?.policy) === 'balanced';
  const recent = balancedRoute
    ? recentDispatchCounts({ db, ledgerFile: ledger.path ?? null, windowHours: allocation?.windowHours })
    : null;
  const routeKind = kindRouteOf(kind, rtDoc);
  // Every verify kind looks up the op whose output it reviews - a think record or, since the owner decision
  // of 2026-09-25 (review-hands), hands-on implementation - so the reviewer's family differs from the author's.
  const author = routeKind.role === 'verify'
    ? (() => { try { return auditAuthorOf(db, job, { runtimes: rtDoc }); } catch { return null; } })()
    : null;
  // A cut slice of a fan-out (payload.cut, ordinal of total >= 2) is small bounded work: hands-on slices walk
  // the fan-out order (runtimes.yaml allocation.preference.scaffold, Qwen first; owner decision 2026-09-25).
  const fanOut = isFanOutSlice(payload);
  // A redesign leg (api redesign; runtimes.yaml allocation.redesign) routes as its strong-reasoning alias, so the op
  // that re-cuts, re-scopes or re-plans from an RCA reasons on the plan/think pools whatever its usual order.
  const redesignAs = typeof payload.redesign?.routeAs === 'string' ? payload.redesign.routeAs : null;
  const decision = selectPool({ kind: redesignAs ?? kind, difficulty, bias, capacity,
    policy: allocation?.policy ?? undefined,
    shares: allocation?.shares ?? undefined,
    recent: recent?.counts,
    grants: allocation?.grants ?? undefined,
    auditOf: author?.pool ?? undefined,
    fanOut,
    lineage: lineage && (lineage.demote.length || lineage.exclude.length) ? lineage : null });
  const lineageAdjust = lineage ? {
    demoted: lineage.demote, excluded: lineage.exclude, pools: lineage.pools,
    attempts: lineage.attempts, demotedTaken: decision?.lineage?.demotedTaken ?? false,
  } : lineageError ? { demoted: [], excluded: [], error: lineageError } : null;
  const routeFacts = { ...(biasIgnored ? { biasIgnored } : {}), ...(lineageAdjust ? { lineageAdjust } : {}) };
  if (decision?.toolUnavailable) {
    const { tools, holders } = decision.toolUnavailable;
    const serving = holders.filter((h) => h.roles.includes(decision.role) || (decision.order && h.roles.includes(decision.order)));
    const avoided = bias.avoid.filter((p) => serving.some((h) => h.target === p));
    const detail = `${kind} needs host tool ${tools.join(', ')} (route.riskHints host-tool-required on modules/ops/ops/${kind}.yaml) and no agent in its ${decision.work ?? decision.role} order at ${decision.difficulty} [${decision.chain.join(', ')}] has it`
      + (avoided.length
        ? `; ${avoided.join(', ')} has it and is excluded by the goal's routing_bias avoid (the owner's). Only the owner changes that bias.`
        : `; ${serving.length ? `the agents that have it (${serving.map((h) => h.target).join(', ')}) are outside that order` : 'no agent card lists it under capabilities.hostTools'}. Raise api incident --kind tool-unavailable for the owner.`)
      + ' The job stays queued; never dispatch it on an agent without the tool.';
    const out = { ok: false, jobId, kind, difficulty: decision.difficulty, bias, ...routeFacts, reason: 'tool-unavailable', tools, holders: serving, detail };
    emit(out, `route REFUSED for ${jobId} (${kind}): tool-unavailable — ${detail}`, args.json);
    process.exit(1);
  }
  if (!decision || decision.error) {
    const out = { ok: false, jobId, kind, difficulty, bias, ...routeFacts, error: decision?.error ?? 'selectPool returned no decision', poolLoad: { running: runningByModel, routeHoldMs: poolLoad.routeHoldMs } };
    emit(out, `route REFUSED for ${jobId} (${kind}, ${difficulty}): ${out.error}`, args.json);
    process.exit(1);
  }

  const decided = {
    // A redesign leg reasons at high effort even on a pool that pins none (runtimes.yaml allocation.redesign.effort).
    model: decision.target, modelId: decision.modelId ?? null, effort: decision.effort ?? (redesignAs ? (payload.redesign?.effort ?? 'high') : null),
    routeChain: decision.chain ?? [], routeRejected: decision.rejected ?? [], routeOrder: decision.order ?? null,
    // Always written (null when absent) so a reroute never keeps the previous decision's values.
    routePolicy: decision.policy ?? null,
    routeBalance: decision.balance ? {
      windowHours: recent?.windowHours ?? null, recentTotal: recent?.total ?? null, ledgers: recent?.ledgers?.length ?? 0,
      candidates: decision.balance.candidates, rule: decision.balance.rule ?? null,
      deficits: Object.fromEntries(Object.entries(decision.balance.deficits).map(([pool, d]) => [pool, {
        target: Number(d.target.toFixed(3)), actual: Number(d.actual.toFixed(3)), deficit: Number(d.deficit.toFixed(3)) }])),
    } : null,
    routeCrossFamily: decision.crossFamily
      ? { ...decision.crossFamily, authorJob: author?.jobId ?? null, authorOp: author?.opId ?? null } : null,
  };
  const selectedRuntime = Object.entries(pools)
    .find(([poolId, runtime]) => (runtime?.target ?? poolId) === decision.target)?.[1] ?? null;
  ledger.transaction(() => {
    const now = Date.now();
    const hierarchy = payload.hierarchy ?? {
      schema: AGENT_HIERARCHY_SCHEMA,
      nodeId: operationNodeId(jobId), parentNodeId: kernelNodeId(job.workflow_id),
      role: 'operation', workflowId: job.workflow_id, jobId, opId: kind,
      attempt: job.try_no, generation: job.generation,
    };
    hierarchy.runtime = {
      ...(hierarchy.runtime ?? {}), host: 'orca',
      agent: selectedRuntime?.provider ?? null,
      provider: selectedRuntime?.provider ?? null,
      model: decided.modelId,
      profile: decided.model,
      runtimePool: decided.model,
    };
    updateJob(db, { jobId, payload: { ...payload, ...decided, difficulty, hierarchy, routedAt: now }, at: now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'route-decided', payload: { kind, difficulty, bias, ...routeFacts, ...decided },
    });
  });

  const out = { ok: true, jobId, kind, difficulty, bias, ...routeFacts, decision: decided, rejected: decided.routeRejected, poolLoad: { running: runningByModel, routeHoldMs: poolLoad.routeHoldMs }, ...(accounts ? { accounts } : {}) };
  // Waiter priority (waiter-priority.mjs): who waits on this job, and which heavier queued job of the
  // same workflow other workflows wait on and should be dispatched first.
  const blockingView = blockingViewOf(db, job);
  if (blockingView) out.blocking = blockingView;
  emit(out, [
    `route ${jobId} (${kind}, ${difficulty}) → ${decided.model} model=${decided.modelId ?? '-'} effort=${decided.effort ?? '-'}`,
    `  chain: ${decided.routeChain.join(' → ') || '(none)'}`,
    ...(biasIgnored ? [`  bias IGNORED: ${biasIgnoredText(biasIgnored)}`] : []),
    ...(lineageAdjust && (lineageAdjust.demoted.length || lineageAdjust.excluded.length)
      ? [`  retry lineage: ${[...lineageAdjust.demoted.map((p) => `${p} demoted`), ...lineageAdjust.excluded.map((p) => `${p} excluded`)].join(', ')} (${Object.entries(lineageAdjust.pools).map(([p, v]) => `${p}: ${v.causes.join(', ')}`).join('; ')})${lineageAdjust.demotedTaken ? '; no other pool was eligible' : ''}`]
      : []),
    ...(decided.routeBalance
      ? [`  balanced (last ${decided.routeBalance.windowHours}h, ${decided.routeBalance.recentTotal} jobs): ${Object.entries(decided.routeBalance.deficits)
        .map(([pool, d]) => `${pool} ${Math.round(d.actual * 100)}%/${Math.round(d.target * 100)}%`).join(', ')}`]
      : []),
    ...(decided.routeCrossFamily?.applied
      ? [`  cross-family audit: ${decided.routeCrossFamily.authorOp ?? 'author op'} ran on ${decided.routeCrossFamily.author}; the auditor takes the other family`]
      : []),
    ...(decided.routeRejected.length
      ? ['  rejected:', ...decided.routeRejected.map((r) => `    ${r.target}: ${r.reason}`)]
      : []),
    ...(blockingView?.waiters ? [`  blocking: ${blockingView.waiters} waiter(s) (${blockingView.workflows.length} other workflow(s)) wait on ${jobId}, weight ${blockingView.weight}: dispatch it first`] : []),
    ...(blockingView?.outrankedBy.length ? [`  outranked: ${blockingView.outrankedBy.map((b) => `${b.jobId} (${b.opId ?? '-'}, weight ${b.weight}, ${b.workflows.length} workflow(s) wait)`).join(', ')}; prefer dispatching ${blockingView.outrankedBy.length === 1 ? 'it' : 'them'} before ${jobId}`] : []),
  ].join('\n'), args.json);

  },
};
