// Turn planning and the existing Host seat record own actuator custody across controller ticks.
import { lastJson, SERVICES_FILE } from './services.mjs';
import { workerClosureProven } from '../machine/worker-close.mjs';

/** Calculate intent only. Confirmed timestamps are written after the actuator's numeric and typed receipt. */
export function turnStep(prev, obs, { now, budgetMs, graceMs, sameTurnSlackMs }) {
  if (!obs?.busy) return { turn: null, act: null, overdue: false, ended: prev != null };
  const est = Number.isFinite(obs.minutes) ? now - obs.minutes * 60_000 : null;
  const same = prev != null && (!prev.terminal || !obs.terminal || prev.terminal === obs.terminal)
    && (est == null || Math.abs(est - prev.startedAt) <= sameTurnSlackMs);
  const turn = same ? { ...prev, startedAt: est == null ? prev.startedAt : Math.min(prev.startedAt, est) }
    : { startedAt: est ?? now, interruptedAt: null, replacedAt: null };
  const overdue = now - turn.startedAt > budgetMs;
  const act = turn.effect?.state === 'unknown' || turn.closedAt != null ? null
    : overdue && turn.interruptedAt == null ? 'interrupt'
    : turn.interruptedAt != null && turn.replacedAt == null && now - turn.interruptedAt >= graceMs ? 'replace' : null;
  return { turn, act, overdue, ended: prev != null && !same };
}

/** An unresolved actuator retains the original seat's authority even if a later screen or workflow looks idle. */
export async function turnCustodyHold(ctx, key, rec, { ledgerId = 'supervisor', workflowId = 'wf-supervisor' } = {}) {
  if (rec?.turn?.effect?.state !== 'unknown') return null;
  const effect = rec.turn.effect;
  await ctx.openDecision({ schema: 'starci/decision-item@1', openedBy: 'host-controller', decider: 'supervisor',
    kind: 'runtime-defect', ledger: ledgerId, workflowId, entity: { type: 'seat', id: key },
    idempotencyKey: `turn-custody:${key}:${effect.at}:${effect.act}`,
    summary: 'An overdue seat actuator has no verified outcome; reconcile its original worker before another watchdog mutation.',
    evidence: [{ ref: `terminal:${effect.terminal}` }], payload: { effect }, allowedVerbs: [] });
  return { ok: false, held: 'turn-custody-unknown', turn: { act: null, custody: effect } };
}

/** Run one overdue-turn action, persisting intent before it and allowing a watchdog only after verified custody. */
export async function reconcileTurnBudget(ctx, { key, rec, terminal, ledgerId = 'supervisor', workflowId = 'wf-supervisor',
  repo = null, supervisor, probeTurn, numbers, settings, save, clock, clear }) {
  const now = ctx.now(), budgetMs = supervisor ? numbers.supervisorBudgetMs : numbers.kernelBudgetMs;
  const obs = await probeTurn({ terminal, supervisor });
  if (obs?.ok !== true) return { ok: false, held: 'turn-probe-unavailable' };
  const step = turnStep(rec.turn ?? null, obs, { now, budgetMs, graceMs: numbers.graceMs,
    sameTurnSlackMs: settings.turnBudget?.sameTurnSlackMs ?? 180_000 });
  rec.turn = step.turn;
  const meta = { code: 'KERNEL_TURN_OVERDUE', owner: 'host-controller', ledgerId, workflowId,
    terminal: obs.terminal, agent: obs.agent, budgetMs, enteredAt: step.turn?.startedAt };
  if (step.ended || !step.overdue) await clear(ctx, key, 'KERNEL_TURN_OVERDUE');
  if (step.overdue) await clock(ctx, key, 'KERNEL_TURN_OVERDUE', budgetMs, meta);
  const minutes = step.turn ? Math.round((now - step.turn.startedAt) / 60_000) : 0;
  if (!step.act) return { ok: true, state: obs.state, minutes, act: null, overdue: step.overdue };
  const watchdog = supervisor ? ['scripts/supervisor/supervisor-watchdog.mjs', '--once', '--json']
    : ['scripts/kernel/kernel-watchdog.mjs', '--repo', repo, '--workflow', workflowId, '--once', '--repair', '--json'];
  const args = [SERVICES_FILE, `--turn-${step.act}`, '--terminal', obs.terminal, '--agent', obs.agent,
    ...(step.act === 'interrupt' ? supervisor ? ['--supervisor'] : ['--repo', repo, '--workflow', workflowId] : []), '--json'];
  if (ctx.mode !== 'active') {
    await ctx.run('node', args, { timeoutMs: step.act === 'interrupt' ? 120_000 : 180_000 });
    return { ok: true, shadow: true, state: obs.state, minutes, act: step.act, overdue: step.overdue };
  }
  rec.turn.terminal = obs.terminal;
  rec.turn.effect = { state: 'unknown', act: step.act, at: now, terminal: obs.terminal, agent: obs.agent, result: null };
  save(rec); // If the process disappears after mutation, the original intent still prevents blind replay.
  let native;
  try { native = await ctx.run('node', args, { timeoutMs: step.act === 'interrupt' ? 120_000 : 180_000 }); }
  catch (error) { native = { ok: false, error: String(error?.message ?? error) }; }
  const data = lastJson(native?.stdout ?? '');
  const complete = native?.ok === true && native.code === 0 && !native.error && !native.signal && !native.timedOut
    && !native.fenced && !native.recoveryRequired && data?.ok === true && data.terminal === obs.terminal;
  const verified = complete && (step.act === 'interrupt'
    ? data.schema === 'starci/turn-interrupt@1' && data.effectState === 'requested'
    : data.schema === 'starci/turn-replace@1' && data.effectState === 'closed'
      && data.dispatch && data.closure?.dispatch === data.dispatch && workerClosureProven(data.closure, obs.terminal));
  const noEffect = native?.fenced === true || native?.effectState === 'none'
    || Number.isInteger(native?.code) && !native.signal && !native.timedOut && data?.ok === false
      && data.terminal === obs.terminal && data.effectState === 'none';
  rec.turn.effect = { ...rec.turn.effect, state: verified ? 'confirmed' : noEffect ? 'none' : 'unknown',
    result: { code: native?.code ?? null, signal: native?.signal ?? null, error: native?.error ?? null,
      actionId: native?.actionId ?? null, receipt: data } };
  if (verified) {
    if (step.act === 'interrupt') rec.turn.interruptedAt = now;
    else rec.turn.closedAt = now;
  }
  save(rec);
  await ctx.log('reconciler.host.turn-budget', `${key}: overdue turn ${step.act} ${rec.turn.effect.state}`,
    { key, act: step.act, minutes, agent: obs.agent, terminal: obs.terminal, result: rec.turn.effect.result });
  if (!verified) {
    const hold = await turnCustodyHold(ctx, key, rec, { ledgerId, workflowId });
    return { ok: false, state: obs.state, minutes, act: step.act, overdue: step.overdue,
      effectState: rec.turn.effect.state, ...(hold ? { held: hold.held } : {}) };
  }
  const pass = await ctx.run('node', watchdog, { timeoutMs: supervisor ? settings.seats.supervisor.timeoutMs : settings.seats.kernel.timeoutMs });
  const outcome = lastJson(pass?.stdout ?? '');
  const restarted = pass?.ok === true && pass.code === 0 && !pass.error && !pass.signal && !pass.timedOut
    && outcome?.ok === true && outcome.action === 'restarted';
  if (step.act === 'replace' && restarted) {
    rec.turn.replacedAt = now;
    if (!supervisor) rec.restarts = [...(rec.restarts ?? []), now];
    save(rec);
  }
  return { ok: true, state: obs.state, minutes, act: step.act, overdue: step.overdue,
    effectState: rec.turn.effect.state, ...(step.act === 'replace' ? { replaced: restarted } : {}) };
}
