const roleRejectionReasons = ({ pool, role, order }) => {
  if (!role || !Array.isArray(pool.roles) || !pool.roles.length || pool.roles.includes(role) || pool.roles.includes(order)) return [];
  const orderServed = order && order !== role ? ` or order '${order}'` : '';
  return [`pool does not serve role '${role}'${orderServed}`];
};

const grantRejectionReasons = ({ pool, target, role, order, grants, capacity }) => {
  if (!grants || pool.capacityAuthority !== 'explicit-workflow-quota') return [];
  const grant = grants[pool.target ?? target] ?? grants[target] ?? null;
  if (!grant) return [`pool needs an owner grant (capacityAuthority explicit-workflow-quota; config.yaml allocation.grants names none for ${target})`];
  const reasons = [];
  const orderServed = order && order !== role ? ` or order '${order}'` : '';
  if (role && Array.isArray(grant.roles) && !grant.roles.includes(role) && !grant.roles.includes(order))
    reasons.push(`owner grant ${target}=${grant.slots}@${(grant.roles ?? []).join('+')} does not cover role '${role}'${orderServed}`);
  const running = Number(capacity?.[target]?.running ?? 0);
  if (Number.isFinite(Number(grant.slots)) && running >= Number(grant.slots))
    reasons.push(`pool at granted capacity (${running}/${grant.slots} granted)`);
  return reasons;
};

const toolRejectionReasons = ({ pool, kind, modelsDir, opsDir }, { missingHostTools }) =>
  missingHostTools({ pool, kind, modelsDir, opsDir }).map((tool) =>
    `pool agent '${pool.provider}' lacks host tool '${tool}' required by kind '${kind}' (route.riskHints host-tool-required:${tool})`);

const capacityRejectionReasons = ({ pool, target, capacity, backoff = {} }) => {
  const cap = capacity?.[target];
  if (!cap) return [];
  const reasons = [];
  if (cap.auth === 'dead') {
    const kind = cap.providerHealth ? cap.providerHealth.failureKind ?? 'auth' : 'auth';
    const detail = cap.authDetail ? `: ${cap.authDetail}` : '';
    reasons.push(`provider ${kind} is unavailable${detail}`);
  }
  if (cap.quota?.state === 'dead') reasons.push('capacity quota is dead');
  const max = Number(pool.maxParallel);
  const running = Number(cap.running ?? 0);
  if (Number.isFinite(max) && Number.isFinite(running) && running >= max)
    reasons.push(`pool at capacity (${running}/${max} running)`);
  const backedOff = Number(backoff?.[target]);
  if (Number.isInteger(backedOff) && backedOff > 0 && Number.isFinite(running) && running >= backedOff && !(Number.isFinite(max) && running >= max))
    reasons.push(`pool backed off after provider rate limits (${running}/${backedOff} running, maxParallel ${Number.isFinite(max) ? max : '-'})`);
  if (cap.openIncident === true) reasons.push('pool has an open incident');
  return reasons;
};

const poolRejectionReasons = (input, helpers) => {
  const { pool, target, role, kind, order = null, difficulty, capacity, grants, runtimes, modelsDir, opsDir, backoff } = input;
  if (!pool) return [`no registry.yaml pool '${target}'`];
  const reasons = roleRejectionReasons({ pool, role, order });
  reasons.push(...grantRejectionReasons({ pool, target, role, order, grants, capacity }));
  reasons.push(...toolRejectionReasons({ pool, kind, modelsDir, opsDir }, helpers));
  const launch = helpers.resolveLaunchModel(target, difficulty, { runtimes });
  if (launch.error) reasons.push(launch.error);
  reasons.push(...capacityRejectionReasons({ pool, target, capacity, backoff }));
  return reasons;
};

const auditFamilyOf = (rt, target) => {
  const frontier = rt?.allocation?.frontier ?? rt?.allocation?.preference?.think ?? [];
  const hands = Array.isArray(rt?.allocation?.hands) ? rt.allocation.hands : [];
  if (!frontier.includes(target) && !hands.includes(target)) return null;
  return rt?.runtimes?.[target]?.provider ?? target;
};

const prepareSelection = (input, helpers) => {
  const { kind, role, difficulty, bias, capacity, runtimes, modelsDir, policy, lineage, backoff, fanOut, now = Date.now() } = input;
  const backoffCaps = backoff ?? (capacity ? helpers.poolCapsNow() : {});
  const order = helpers.kindOrder({ kind, role, difficulty, fanOut, runtimes, modelsDir });
  if (order.error) return { error: order.error };
  const { rt, route, measured, difficulty: resolvedDifficulty, role: resolvedRole, orderKey, chain: unbiased, tierSource } = order;
  let allocationPolicy = 'prefer-then-overflow';
  if (helpers.allocationPolicies.includes(policy)) allocationPolicy = policy;
  else if (helpers.allocationPolicies.includes(rt?.allocation?.policy)) allocationPolicy = rt.allocation.policy;
  const balanced = allocationPolicy === 'balanced';
  let biased = unbiased;
  if (!capacity) biased = balanced ? helpers.applyBias(unbiased, { avoid: bias?.avoid ?? [] }) : helpers.applyBias(unbiased, bias);
  const demote = (lineage?.demote ?? []).filter(Boolean), exclude = (lineage?.exclude ?? []).filter(Boolean);
  const chain = [...biased.filter((target) => !demote.includes(target)), ...biased.filter((target) => demote.includes(target))];
  return { input, backoffCaps, order, rt, route, measured, difficulty: resolvedDifficulty, role: resolvedRole,
    orderKey, unbiased, tierSource, allocationPolicy, balanced, demote, exclude, chain, now, overflow: helpers.orderOverflowOf(rt, orderKey) };
};

const collectCandidates = (context, helpers) => {
  const { input, rt, chain, exclude, role, orderKey, difficulty, backoffCaps } = context;
  const { kind, capacity, grants, modelsDir, opsDir, lineage } = input;
  const rejected = [];
  const eligible = [];
  for (const target of chain) {
    const pool = rt?.runtimes?.[target] ?? null;
    if (exclude.includes(target)) {
      const seen = lineage?.pools?.[target];
      const causes = seen?.causes?.length ? ` (${seen.causes.join(', ')})` : '';
      const reason = `excluded for this retry lineage: failed ${seen?.failures ?? 'twice'}x on it${causes}`;
      rejected.push({ target, reason, reasons: [reason] });
      continue;
    }
    const reasons = poolRejectionReasons({ pool, target, role, kind, order: orderKey, difficulty, capacity, grants,
      runtimes: rt, modelsDir, opsDir, backoff: backoffCaps }, helpers);
    if (reasons.length) { rejected.push({ target, reason: reasons[0], reasons }); continue; }
    eligible.push(target);
    if (!capacity && !context.balanced && !input.auditOf && !context.overflow.includes(target)) break;
  }
  return { eligible, rejected };
};

const admitCandidates = (context, candidates, helpers) => {
  const { input, rt, role, difficulty, unbiased, backoffCaps } = context;
  const { admission, constraintError } = helpers.selectPoolAdmission({ rt, targets: candidates.eligible, allowTargets: unbiased,
    capacity: input.capacity, bias: input.bias, kind: input.kind, role, difficulty, scopeId: input.scopeId,
    attemptId: input.attemptId, now: context.now, modelRegistry: input.modelRegistry, modelsDir: input.modelsDir,
    qualityFloor: input.qualityFloor, backoffCaps,
    launchModel: (target) => helpers.resolveLaunchModel(target, difficulty, { runtimes: rt }) });
  if (input.capacity) {
    for (const row of admission.rejected) candidates.rejected.push({ target: row.id, reason: row.codes[0], reasons: row.codes });
    candidates.eligible = admission.eligible.map((candidate) => candidate.id);
    if (!admission.ok && admission.reason !== 'no-eligible-candidate') return { error: `agent admission refused: ${admission.reason}`, admission,
      role, work: context.route.work, difficulty, measuredDifficulty: context.measured, floor: context.route.floor,
      order: context.orderKey, chain: context.chain, tierSource: context.tierSource, rejected: candidates.rejected };
  } else if (constraintError) return { error: constraintError, admission, rejected: candidates.rejected };
  return { admission, eligible: candidates.eligible, rejected: candidates.rejected };
};

const balancedTargetOf = (candidates, context, helpers) => {
  const { input, rt, route, difficulty } = context;
  const workClass = route.work ?? 'hands-on';
  const declared = rt?.allocation?.balanced?.overflowOnly?.[workClass];
  const overflowOnly = (Array.isArray(declared) ? declared : declared?.[difficulty]) ?? [];
  const primary = candidates.filter((target) => !overflowOnly.includes(target));
  if (primary.length) candidates = primary;
  const deficits = helpers.balanceDeficits(candidates, { shares: input.shares, recent: input.recent });
  const preferred = new Set((input.bias?.prefer ?? []).map((item) => typeof item === 'string' ? item : item?.pool).filter(Boolean));
  const EPS = 1e-9;
  const underShare = candidates.find((target) => deficits[target].deficit > EPS) ?? null;
  const target = underShare ?? candidates.reduce((best, candidate) => {
    if (best === null) return candidate;
    const difference = deficits[candidate].deficit - deficits[best].deficit;
    if (difference > EPS) return candidate;
    if (Math.abs(difference) <= EPS && preferred.has(candidate) && !preferred.has(best)) return candidate;
    return best;
  }, null);
  return { candidates, target, balance: { candidates, deficits, rule: underShare ? 'first-under-share' : 'least-over' } };
};

const rankCandidates = (context, admission, helpers) => {
  const { input, rt, route, measured, difficulty, role, orderKey, tierSource, chain, overflow, demote, balanced } = context;
  const { auditOf, lineage, bias } = input;
  if (!admission.eligible.length) return null;
  let candidates = admission.eligible;
  let crossFamily = null;
  const authorFamily = auditOf && role === 'verify' && rt?.allocation?.thinkAuditCrossFamily !== false
    ? auditFamilyOf(rt, auditOf) : null;
  if (authorFamily) {
    const other = candidates.filter((target) => {
      const family = auditFamilyOf(rt, target);
      return family && family !== authorFamily;
    });
    crossFamily = { author: auditOf, authorFamily, applied: other.length > 0 };
    if (other.length) candidates = other;
  }
  let overflowUsed = false;
  if (overflow.length) {
    const primary = candidates.filter((target) => !overflow.includes(target));
    if (primary.length) candidates = primary;
    else overflowUsed = true;
  }
  if (demote.length) {
    const primary = candidates.filter((target) => !demote.includes(target));
    if (primary.length) candidates = primary;
  }
  let balance = null;
  let target;
  if (balanced) {
    const picked = balancedTargetOf(candidates, context, helpers);
    candidates = picked.candidates;
    target = picked.target;
    balance = picked.balance;
  } else target = candidates[0];
  const shownRejected = balanced ? admission.rejected : admission.rejected.filter((row) => chain.indexOf(row.target) < chain.indexOf(target));
  const pool = rt.runtimes[target];
  const { modelId, effort } = helpers.resolveLaunchModel(target, difficulty, { runtimes: rt });
  return { target: pool.target ?? target, modelId, effort, role, work: route.work, difficulty,
    measuredDifficulty: measured, floor: route.floor, order: orderKey, chain, tierSource, rejected: shownRejected, policy: context.allocationPolicy,
    admission: input.capacity ? { ...admission.admission, selected: admission.admission.eligible.find((candidate) => candidate.id === target) } : admission.admission,
    ...(balance ? { balance } : {}), ...(crossFamily ? { crossFamily } : {}),
    ...(overflow.length ? { overflow: { pools: overflow, used: overflowUsed } } : {}),
    ...(lineage ? { lineage: { demoted: demote, excluded: context.exclude, demotedTaken: demote.includes(target) } } : {}) };
};

const noEligiblePool = (context, admission, helpers) => {
  const { input, rt, route, measured, difficulty, role, orderKey, tierSource, chain } = context;
  const { kind, modelsDir, opsDir } = input;
  const tools = helpers.hostToolsRequired(kind, { opsDir });
  const structural = chain.filter((target) => {
    const pool = rt?.runtimes?.[target];
    return pool && !(Array.isArray(pool.roles) && pool.roles.length && !pool.roles.includes(role) && !pool.roles.includes(orderKey))
      && !helpers.resolveLaunchModel(target, difficulty, { runtimes: rt }).error;
  });
  const toolRefusal = tools.length > 0 && structural.length > 0
    && structural.every((target) => helpers.missingHostTools({ pool: rt.runtimes[target], kind, modelsDir, opsDir }).length > 0);
  if (toolRefusal) {
    const holders = Object.entries(rt?.runtimes ?? {})
      .filter(([, pool]) => !helpers.missingHostTools({ pool, kind, modelsDir, opsDir }).length)
      .map(([target, pool]) => ({ target: pool.target ?? target, difficulties: Object.keys(pool.models ?? {}), roles: pool.roles ?? [] }));
    const missing = [...new Set(structural.flatMap((target) => helpers.missingHostTools({ pool: rt.runtimes[target], kind, modelsDir, opsDir })))];
    return { error: `no ${role} pool at ${difficulty} difficulty has host tool ${(missing.length ? missing : tools).join(', ')}`,
      toolUnavailable: { tools: missing.length ? missing : tools, holders }, role, work: route.work, difficulty,
      measuredDifficulty: measured, floor: route.floor, order: orderKey, chain, tierSource, rejected: admission.rejected,
      admission: admission.admission };
  }
  return { error: `no eligible pool for role '${role}' at ${difficulty} difficulty`, role, work: route.work, difficulty,
    measuredDifficulty: measured, floor: route.floor, chain, tierSource, rejected: admission.rejected, admission: admission.admission };
};

/** Execute one declared pool route using the caller's model and admission policy. */
export function selectPool(input, helpers) {
  const context = prepareSelection(input, helpers);
  if (context.error) return { error: context.error };
  const candidates = collectCandidates(context, helpers);
  const admission = admitCandidates(context, candidates, helpers);
  if (admission.error) return admission;
  const selected = rankCandidates(context, admission, helpers);
  return selected ?? noEligiblePool(context, { ...admission, rejected: candidates.rejected }, helpers);
}
