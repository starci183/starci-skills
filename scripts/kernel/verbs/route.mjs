// starci kernel route: choose and persist one pool for a queued operation.
//
// Precedence among the pool choosers (beside route-model's explicit --agent > config > default): a
// Kernel-recorded op-override model — kernel-op-override events from `starci kernel op-override`, plus the
// job's own kernelModel/kernelOverride — is the Kernel's explicit decision for that op in that workflow, so it
// outranks the retry lineage's DEMOTION of the pinned pool (lineage is evidence, the recorded decision is
// authority). It never outranks eligibility itself: a pin outside the op's order, a pool the lineage excluded
// after two pool-attributable failures, a dead provider circuit or a missing host tool refuses typed with
// 'op-override-ineligible' naming why — never a silent different pool.
import { updateJob } from '../../../engine/db/ledger.mjs';
import { escalateExhaustedMembers } from './shared/member-exhaustion.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';
import { jobResultOf,jobRowOf } from './shared/rows.mjs';
import { queuedJobOp, refuseOwnerGate, refusePeerWait, opSlotsOrRefuse } from './shared/job-gates.mjs';
import { biasForRole, asSelector } from '../../lib/owner-routing-bias.mjs';
import { ownerReserveGrant, ownerBiasTrust, quotaForAdmission, admissionPolicyOf } from '../../agent/admission.mjs';
import { pickOpModel } from '../../agent/op-pick.mjs';
import { tierHistory } from '../../agent/tier-history.mjs';
import { pickRecordText } from '../../lib/pick-record.mjs';
import { prepareProviderBudget, providerBudgetUsage } from '../../agent/provider-budget.mjs';
import { kernelOverrideFor } from '../kernel-authority.mjs';
import { VerbExit } from './shared/verb-exit.mjs';

function routeHumanOf({ jobId, kind, difficulty, decided, lineageAdjust, blockingView, overrideModel }) {
  const lines = [
    `route ${jobId} (${kind}, ${difficulty}) → ${decided.model} model=${decided.modelId ?? '-'} effort=${decided.effort ?? '-'}`,
  ];
  if (overrideModel) lines.push(`  op-override: ${overrideModel} — the Kernel's recorded pin decides; it outranks a lineage demotion, never an eligibility refusal`);
  if (lineageAdjust && (lineageAdjust.demoted.length || lineageAdjust.excluded.length)) {
    const changedPools = [...lineageAdjust.demoted.map((pool) => `${pool} demoted`), ...lineageAdjust.excluded.map((pool) => `${pool} excluded`)].join(', ');
    const causes = Object.entries(lineageAdjust.pools).map(([pool, item]) => `${pool}: ${item.causes.join(', ')}`).join('; ');
    const takenNote = lineageAdjust.demotedTaken
      ? (overrideModel ? '; taken anyway — the recorded op-override pins it' : '; no other pool was eligible')
      : '';
    lines.push(`  retry lineage: ${changedPools} (${causes})${takenNote}`);
  }
  lines.push(...pickRecordText(decided.pick).map((line) => `  ${line}`));
  if (blockingView?.waiters) {
    lines.push(`  blocking: ${blockingView.waiters} waiter(s) (${blockingView.workflows.length} other workflow(s)) wait on ${jobId}, weight ${blockingView.weight}: dispatch it first`);
  }
  if (blockingView?.outrankedBy.length) {
    const preferred = blockingView.outrankedBy.length === 1 ? 'it' : 'them';
    const jobs = blockingView.outrankedBy.map((item) => `${item.jobId} (${item.opId ?? '-'}, weight ${item.weight}, ${item.workflows.length} workflow(s) wait)`).join(', ');
    lines.push(`  outranked: ${jobs}; prefer dispatching ${preferred} before ${jobId}`);
  }
  return lines.join('\n');
}

/** Pool-load holders on this provider that hold no budget reservation of this ledger (their running jobs count locally). */
function unreservedLocalOf({ db, poolLoad, budget, ledger, pools, provider }) {
  const reservedJobs = new Set((budget?.reservations ?? []).filter((receipt) => receipt.scope?.scopeId?.startsWith(`${ledger.ledgerId ?? ledger.path}:`))
    .map((receipt) => receipt.scope?.jobId).filter(Boolean));
  return [...poolLoad.holders].filter((holder) => {
    if (reservedJobs.has(holder)) return false;
    const row = db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(holder);
    let payload;
    try { payload = JSON.parse(row?.payload_json ?? '{}'); } catch (error) { throw new Error(`routing capacity is unreadable for ${holder}: ${error.message}`); }
    const ownerPool = pools[payload.model] ?? Object.values(pools).find((pool) => pool.target === payload.model);
    return ownerPool?.provider === provider;
  }).length;
}

/** The auth detail of a pool: the quota detail, or the open circuit's failure and clear hint. */
function authDetailOf(quota, providerHealth, circuitClearHint) {
  if (!providerHealth) return quota?.detail ?? null;
  const failure = providerHealth.detail ?? providerHealth.signal ?? providerHealth.failureKind ?? 'circuit open';
  const expires = providerHealth.expiresAt ? new Date(providerHealth.expiresAt).toISOString() : 'explicit recovery';
  return `${failure} (circuit open until ${expires}${circuitClearHint(providerHealth)})`;
}

async function capacityForPools({ db, jobId, ledger, pools, rtDoc, rtMerged, regDoc, kind, difficulty, scopeId,
  poolLoadOf, accountList, normalizeProvider, probeQuotaSafe, providerHealthOf, circuitClearHint }) {
  const poolLoad = poolLoadOf(db, { excludeJobId: jobId });
  const runningByModel = poolLoad.byModel;
  let accounts = null;
  try { accounts = await accountList() ?? null; } catch { accounts = null; }
  const quotaByProvider = new Map();
  const budgetByProvider = new Map();
  const capacity = {};
  await eachInOrder(Object.entries(pools), async ([poolId, rt]) => {
    const target = rt?.target ?? poolId;
    const provider = rt?.provider ?? null;
    const providerKey = normalizeProvider(provider);
    if (provider && !quotaByProvider.has(providerKey)) quotaByProvider.set(providerKey, await probeQuotaSafe(provider));
    const measuredQuota = provider ? quotaByProvider.get(providerKey)
      : { state: 'unknown', usedPercent: null, detail: 'pool declares no provider' };
    const quota = quotaForAdmission({ quota: measuredQuota, provider: providerKey, pool: poolId, role: 'op', kind, difficulty,
      scopeId, registry: regDoc, runtimes: rtMerged, policy: admissionPolicyOf(rtMerged) });
    if (provider && !budgetByProvider.has(providerKey)) budgetByProvider.set(providerKey, providerBudgetUsage(providerKey, quota.account));
    const budget = budgetByProvider.get(providerKey);
    const unreservedLocal = unreservedLocalOf({ db, poolLoad, budget, ledger, pools, provider });
    const providerHealth = provider ? providerHealthOf(db, provider) : null;
    capacity[target] = {
      running: Number.isInteger(budget?.running) ? budget.running + unreservedLocal : null,
      maxParallel: rt?.maxParallel ?? null,
      quota,
      auth: providerHealth || quota?.state === 'dead' ? 'dead' : 'ok',
      authDetail: authDetailOf(quota, providerHealth, circuitClearHint),
      providerHealth,
      openIncident: false,
    };
  });
  return { accounts, poolLoad, runningByModel, capacity };
}

function planRoute({ db, ledger, payload, kind, difficulty, rtDoc, rtMerged, regDoc, ownerRoot,
  configuredAllocationPolicy, loadConfig, lineage, lineageError, scopeId, bias, biasTrusted, capacity, env, overrideModel }) {
  let allocation = null;
  try { allocation = configuredAllocationPolicy(loadConfig(ownerRoot)); } catch { allocation = null; }
  const redesignAs = typeof payload.redesign?.routeAs === 'string' ? payload.redesign.routeAs : null;
  const historyOf = (tier) => tierHistory({ tier, db, ledgerFile: ledger.path ?? null, env, routeHoldMs: rtDoc?.allocation?.routeHoldMs });
  // The recorded op-override rides the `only` selector an owner routing_bias.only uses: every other member is dropped at the
  // bias step, so no eligible substitute can be taken, while the hard filter (role, host tool, retry-lineage exclusion,
  // provider circuit, capacity) still applies to the pin and the lineage demotion only reorders.
  const decision = pickOpModel({ kind: redesignAs ?? kind, difficulty, bias: pinnedBias(bias, overrideModel, rtMerged.runtimes), biasTrusted, capacity, runtimes: rtMerged,
    scopeId, attemptId: scopeId, now: Date.now(), modelRegistry: regDoc, grants: allocation?.grants ?? undefined, historyOf,
    lineage: lineage && (lineage.demote.length || lineage.exclude.length) ? lineage : null });
  let lineageAdjust = null;
  if (lineage) {
    lineageAdjust = { demoted: lineage.demote, excluded: lineage.exclude, pools: lineage.pools,
      attempts: lineage.attempts, demotedTaken: decision?.lineage?.demotedTaken ?? false };
  } else if (lineageError) lineageAdjust = { demoted: [], excluded: [], error: lineageError };
  return { redesignAs, decision, lineageAdjust };
}

/** The registry pool [id, runtime] an op-override model names (its pool id or its target). */
const pinPoolOf = (pools, model) => Object.entries(pools ?? {}).find(([id, rt]) => id === model || rt?.target === model) ?? null;

/** The bias with the Kernel's recorded pin as `only`: it narrows an owner `only` to the pinned pool (an owner `only` that excludes the pin keeps the pin dropped, so the route refuses). */
function pinnedBias(bias, overrideModel, pools) {
  if (!overrideModel) return bias;
  const pinPool = pinPoolOf(pools, overrideModel)?.[0] ?? overrideModel;
  const owner = bias?.only ?? [];
  if (!owner.length) return { ...bias, only: [{ pool: pinPool }] };
  const narrowed = owner.map((item) => asSelector(item)).filter((item) => item.pool === undefined || item.pool === pinPool);
  return { ...bias, only: narrowed.length ? narrowed.map((item) => ({ ...item, pool: pinPool })) : owner };
}

/** Why the pinned pool's members cannot take the job, from the tier pick record: a member's rejection or drop, or the pool's absence from the tier chain. */
function overrideIneligibility({ decision, overrideModel, pinProvider, kind, difficulty }) {
  const chain = Array.isArray(decision?.chain) ? decision.chain : [];
  const ids = pinProvider ? chain.filter((id) => id.startsWith(`${pinProvider}/`)) : [];
  if (decision?.chain && !ids.length) return `it is outside ${kind}'s tier ${decision.tier ?? '?'} at ${decision.difficulty ?? difficulty} [${chain.join(', ')}]`;
  const record = decision?.pick?.record ?? decision?.pick ?? null;
  const own = decision?.rejected?.find((row) => ids.includes(row.target));
  const dropped = record?.dropped?.find((row) => ids.includes(row.id) && row.step !== 'tokens') ?? record?.dropped?.find((row) => ids.includes(row.id));
  return own?.reason ?? (dropped ? `${dropped.id} dropped at ${dropped.step}: ${dropped.reason}` : null) ?? decision?.error ?? 'pickOpModel returned no decision';
}

/**
 * The Kernel's recorded op-override pin never falls through to another pool: when the pinned pool cannot take
 * this job the route is a typed refusal naming the real ineligibility — the pinned member's own rejection line,
 * or its absence from the op's tier chain — and naming the verb that clears it. No route-decided is written; the job
 * stays queued for the Kernel to retarget or clear the override.
 */
function refuseIneligibleOverride({ decision, overrideModel, pinProvider, kind, jobId, workflowId, difficulty, bias, routeFacts, runningByModel, poolLoad, emit, args }) {
  if (!overrideModel) return;
  if (decision && !decision.error && !decision.toolUnavailable && decision.target === overrideModel) return;
  const why = overrideIneligibility({ decision, overrideModel, pinProvider, kind, difficulty });
  const detail = `the recorded op-override pins ${overrideModel} for ${kind}, which is ineligible here: ${why}. Retarget or clear it with starci kernel op-override --workflow ${workflowId} --op ${kind}; route never silently takes another pool`;
  const out = { ok: false, jobId, kind, difficulty, bias, ...routeFacts,
    reason: 'op-override-ineligible', override: routeFacts.opOverride, detail,
    rejected: decision?.rejected ?? [], poolLoad: { running: runningByModel, routeHoldMs: poolLoad.routeHoldMs } };
  emit(out, `route REFUSED for ${jobId} (${kind}, ${difficulty}): op-override-ineligible — ${detail}`, args.json);
  throw new VerbExit(1);
}

function refuseRouteDecision({ decision, bias, routeFacts, kind, jobId, difficulty, runningByModel, poolLoad, emit, args }) {
  if (decision?.toolUnavailable) {
    const { tools, holders } = decision.toolUnavailable;
    const serving = holders.filter((h) => h.roles.includes(decision.role) || (decision.order && h.roles.includes(decision.order)));
    const avoided = bias.avoid.filter((p) => serving.some((h) => h.target === p));
    let exclusionNote;
    if (avoided.length) exclusionNote = `; ${avoided.join(', ')} has it and is excluded by the goal's routing_bias avoid (the owner's). Only the owner changes that bias.`;
    else {
      const toolOwners = serving.length ? `the agents that have it (${serving.map((h) => h.target).join(', ')}) are outside that order` : 'no agent card lists it under capabilities.hostTools';
      exclusionNote = `; ${toolOwners}. Raise starci kernel incident --kind tool-unavailable for the owner.`;
    }
    const detail = `${kind} needs host tool ${tools.join(', ')} (route.riskHints host-tool-required on modules/ops/ops/${kind}.yaml) and no agent in its ${decision.work ?? decision.role} order at ${decision.difficulty} [${decision.chain.join(', ')}] has it`
      + exclusionNote + ' The job stays queued; never dispatch it on an agent without the tool.';
    const out = { ok: false, jobId, kind, difficulty: decision.difficulty, bias, ...routeFacts, reason: 'tool-unavailable', tools, holders: serving, detail };
    emit(out, `route REFUSED for ${jobId} (${kind}): tool-unavailable — ${detail}`, args.json);
    throw new VerbExit(1);
  }
  if (!decision || decision.error) {
    const out = { ok: false, jobId, kind, difficulty, bias, ...routeFacts, error: decision?.error ?? 'pickOpModel returned no decision', rejected: decision?.rejected ?? [], poolLoad: { running: runningByModel, routeHoldMs: poolLoad.routeHoldMs } };
    emit(out, `route REFUSED for ${jobId} (${kind}, ${difficulty}): ${out.error}`, args.json);
    throw new VerbExit(1);
  }
}

/** The job row of a route call; an unknown, unreconciled, settled or non-routable job refuses with its code. */
function routableJobOrThrow(db, jobId, finalSettled) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.status === 'effect_unknown') throw Object.assign(new Error(`job ${jobId} requires reconcile before it can be routed`), { code: 'job-reconcile-required' });
  if (finalSettled.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  const lastResult=job.status==='ready'?jobResultOf(jobRowOf(db,jobId)):null;
  const reusableReady=job.status==='ready'&&['dispatch-rejected','dispatch-reconciled'].includes(lastResult?.reason)
    &&lastResult.effectState==='none'&&lastResult.attemptConsumed===false;
  if (job.status !== 'queued'&&!reusableReady) throw Object.assign(new Error(`job ${jobId} cannot be routed while ${job.status}; only queued jobs and proven no-effect launch rejections are routable`), { code: 'job-not-queued' });
  return job;
}

/** The persisted route decision: pool, effort, chain, policy, balance and cross-family facts of the selected pool. */
function routeDecidedOf({ decision, redesignAs, payload, rtDoc, overrideModel, kind }) {
  const record = decision.pick ?? null;
  return {
    admission: decision.admission ?? null,
    // A redesign leg reasons at high effort even on a member that pins none (runtimes.yaml allocation.redesign.effort).
    model: decision.target, modelId: decision.modelId ?? null, effort: decision.effort ?? (redesignAs ? (payload.redesign?.effort ?? rtDoc?.allocation?.redesign?.effort ?? null) : null),
    tier: decision.tier ?? null, routeChain: decision.chain ?? [], routeRejected: decision.rejected ?? [],
    // Always written (null when absent) so a reroute never keeps the previous pin's record.
    routeOverride: overrideModel ? { op: kind, model: overrideModel } : null,
    // The one pick record (scripts/lib/tier-pick.mjs): tier, chain after each step, who was dropped and why, who was chosen and by which step.
    pick: record ? { tier: decision.tier, member: record.chosen?.id ?? null, by: record.chosen?.by ?? null, at: Date.now(), record } : null,
  };
}

export default {
  verb: 'route',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  async run({ ledger, args, emit, internals }) {
    const { FINAL_SETTLED, deferQueuedTestLeg, releaseTypedWaits,
      livePathLeaseWait, goalJsonOf, latestGoal,
      refuseKernelBias, lineageRouteAdjust, path, fs, skillRoot, parseYaml,
      poolLoadOf, accountList, normalizeProvider, probeQuotaSafe, providerHealthOf,
      circuitClearHint, ownerRoot, configuredAllocationPolicy, loadConfig, AGENT_HIERARCHY_SCHEMA,
      operationNodeId, kernelNodeId, blockingViewOf } = internals;
  refuseKernelBias('route', args);
  const db = ledger.db, jobId = args.job;
  const job = routableJobOrThrow(db, jobId, FINAL_SETTLED);
  // SETTLE-FIRST (driver-loop.yaml progress.settleFirst): no new route while filed reports wait unconsumed.
  const { payload, op: kind } = queuedJobOp(ledger, { job, verb: 'route', liveHint: 'rerouting', internals });
  if (deferQueuedTestLeg(ledger, { job, op: kind, payload, via: 'route', args })) return;

  // Concurrency admission BEFORE the pool decision: a route that lands on a
  // full workflow is a decision the kernel cannot spend. The ceiling is the
  // lower of the owner's budgets.maxOps and the workers' maxParallelOps.
  // A wait whose typed --until-* conditions already hold is released before the gates below read it.
  releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()), workflowId: job.workflow_id });
  // An owner-gate incident naming this job refuses first: no pool can run a
  // step only the owner drives.
  refuseOwnerGate(ledger, { job, op: kind, opKey: 'kind', verb: 'route', suffix: '', emit, args, internals });
  refusePeerWait(ledger, { job, op: kind, opKey: 'kind', verb: 'route', suffix: '', emit, args, internals });
  opSlotsOrRefuse(ledger, { job, op: kind, opKey: 'kind', verb: 'route', suffix: '', emit, args, internals });
  // A live lease on the write set: no pool decision is spent (a route-decided per wake would read as a
  // reroute loop); the job waits queued path-lease and routes once the holder releases it.
  const leaseWait = livePathLeaseWait(db, job, payload, { repo: path.resolve(args.repo ?? process.cwd()) });
  if (leaseWait) {
    emit({ ok: false, jobId, kind, reason: 'path-lease', waiting: true, ...leaseWait },
      `route WAITING for ${jobId} (${kind}): path-lease — ${leaseWait.detail}`, args.json);
    throw new VerbExit(1);
  }

  const goalRow = latestGoal(db, job.workflow_id);
  prepareProviderBudget();
  const gj = goalJsonOf(goalRow);
  const goalBias = gj.routing_bias ?? {};
  const scopeId = `${ledger.ledgerId ?? ledger.path}:${jobId}:attempt:${job.try_no ?? 0}`;
  const bias = biasForRole(goalBias, 'op', scopeId);
  if (!ownerReserveGrant(goalRow)) delete bias.reserveOverride;
  // A retry learns from its own lineage: pools its earlier attempts failed on for a pool-attributable
  // cause are demoted (once) or excluded (twice) for it (scripts/kernel/lineage-route.mjs).
  // A lineage read that throws never blocks the route: it routes unadjusted and says why.
  let lineage = null, lineageError = null;
  try { lineage = lineageRouteAdjust(db, job); } catch (e) { lineageError = String(e?.message ?? e); }
  const difficulty = args.difficulty ?? payload.difficulty ?? 'medium';
  // The Kernel's recorded pool pin for this op in this workflow: the job's own kernelModel, else the merged
  // op-override model (kernel-authority.mjs kernelOverrideFor — workflow op-override under the job's own
  // kernelOverride). It pins the selection below; when the pin cannot take the job the route refuses typed.
  const overrideModel = payload.kernelModel ?? kernelOverrideFor(db, job.workflow_id, kind, payload)?.model ?? null;

  // Capacity per registry.yaml pool includes the live running count, quota and typed provider-health circuit.
  const rtFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  const rtDoc = fs.existsSync(rtFile) ? parseYaml(fs.readFileSync(rtFile, 'utf8')) : null;
  const regFile = path.join(skillRoot, 'modules', 'models', 'registry.yaml');
  const regDoc = fs.existsSync(regFile) ? parseYaml(fs.readFileSync(regFile, 'utf8')) : null;
  const pools = regDoc?.pools ?? {};
  // The one merged view the router's helpers expect: allocation policy + pools.
  const rtMerged = { ...(rtDoc), runtimes: pools };
  const capacityResult = await capacityForPools({ db, jobId, ledger, pools, rtDoc, rtMerged, regDoc, kind, difficulty, scopeId,
    poolLoadOf, accountList, normalizeProvider, probeQuotaSafe, providerHealthOf, circuitClearHint });
  const { accounts, poolLoad, runningByModel, capacity } = capacityResult;

  const plan = planRoute({ db, ledger, payload, kind, difficulty, rtDoc, rtMerged, regDoc, ownerRoot,
    configuredAllocationPolicy, loadConfig, lineage, lineageError, scopeId, bias, biasTrusted: ownerBiasTrust(goalRow),
    capacity, env: process.env, overrideModel });
  const { redesignAs, decision, lineageAdjust } = plan;
  const routeFacts = { ...(lineageAdjust ? { lineageAdjust } : {}),
    ...(overrideModel ? { opOverride: { op: kind, model: overrideModel } } : {}) };
  refuseIneligibleOverride({ decision, overrideModel, pinProvider: pinPoolOf(pools, overrideModel)?.[1]?.provider ?? null, kind, jobId, workflowId: job.workflow_id, difficulty, bias, routeFacts, runningByModel, poolLoad, emit, args });
  escalateExhaustedMembers(ledger, { job, decision, lineage });
  refuseRouteDecision({ decision, bias, routeFacts, kind, jobId, difficulty, runningByModel, poolLoad, emit, args });

  const decided = routeDecidedOf({ decision, redesignAs, payload, rtDoc, overrideModel, kind });
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
      ...(hierarchy.runtime), host: 'orca',
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
  emit(out, routeHumanOf({ jobId, kind, difficulty, decided, lineageAdjust, blockingView, overrideModel }), args.json);

  },
};
