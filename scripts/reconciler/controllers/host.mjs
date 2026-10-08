// host.mjs — the reconciler's Host controller (DESIGN 7.7, 8.4, 9.4, 9.5, 9.7, 12; LANES.md Lane D).
//
// Keys:
//   host:boot                     the boot order of DESIGN 7.7, once per HOST boot (schedules host/boot, MB-01) and when Orca comes back
//                                 (failed -> healthy): Orca, harness, tunnels, connectors, terminal dedupe, starci kernel reconcile
//                                 --orphan-kernel-jobs per ledger, then the seats. Seat keys wait for it.
//   service:<name>                one registry service (scripts/reconciler/services.mjs), stepped through the DESIGN 9.7
//                                 state machine; a start is the entry's actuator command through ctx.run.
//   seat:kernel:<ledgerId>:<wf>   one running, unarchived workflow's Kernel seat: scripts/kernel/kernel-watchdog.mjs --once
//                                 --repair (that child proves death twice, respects host outages, replaces,
//                                 presses Enter, repairs titles). In shadow the read-only probe (--once without
//                                 --repair) runs, and a repair is recorded only when the probe says one is needed.
//                                 A workflow whose goal text is missing or unrendered (INV-W4) gets no seat and a DI
//                                 goal-text-missing for the Supervisor. More than maxReplacementsPerHour replacements
//                                 -> quarantined + DI seat-unrecoverable.
//                                 Each pass also retries the close of every replaced Kernel terminal an open
//                                 kernel-stale-terminal-unclosed incident names (staleTerminalStep): start-workflow
//                                 closes the old seat once, and a terminal Orca reads disconnected but still lists
//                                 (a persisted tab) is no proof it is gone. The retry is close-verify.mjs --tree,
//                                 proof is 'gone' or a listing without the handle, and on proof the incident is
//                                 resolved --by supervisor through starci kernel incident. Retries back off (STALE_RETRY_MS
//                                 doubling to STALE_RETRY_MAX_MS); STALE_ESCALATE_TRIES failures -> one DI.
//   seat:supervisor               scripts/supervisor/supervisor-watchdog.mjs --once --json (nothing in config.yaml supervisor.mode chat).
//                                 Both seat kinds carry a TURN BUDGET (turnStep): busy in one turn (its spinner timer)
//                                 past allocation.liveness.kernelTurnBudgetMs (Supervisor: supervisorTurnBudgetMs) ->
//                                 the agent's own interrupt key + the decision doorbell re-wake (services.mjs
//                                 --turn-interrupt) and the KERNEL_TURN_OVERDUE clock; the same turn
//                                 turnInterruptGraceMs later -> the seat terminal is closed (--turn-replace) and the
//                                 seat's watchdog pass replaces it.
//   host:processes                node/git counts over threshold (host-health hostVerdict -> log), orphan runtime loops
//                                 (ORPHAN_PROCESS -> stop), the footprint scan, the Orca terminal count against Orca's
//                                 own active workers over every Run (worker-list; TERMINAL_COUNT_DRIFT).
//   host:transcripts              every 60 s (schedules host/transcripts): scrollback snapshots of every live op attempt
//                                 (scripts/kernel/transcripts.mjs snapshot --repo) and of every live seat (snapshotSeats).
//   host:usage (schedules host/usage, every 5 min, on the transcripts tick) the token meter: scripts/kernel/usage-record.mjs
//                                 sweep records settled attempts' usage and the increment of every Kernel and the Supervisor seat.
//   ledger:<ledgerId>             hourly PRAGMA quick_check (LEDGER_CORRUPT clock + DI), nightly VACUUM INTO backup. An
//                                 absent ledger file is not created yet: no check, no clock (an open one clears), no backup.
//
// Every clock's state is a code of modules/reconciler/sla.yaml (SERVICE_DOWN, SEAT_VACANT, ...): the SLA layer reads the
// code from the state. Every mutation goes through ctx.run / ctx.api / ctx.openDecision, so shadow mode records it and runs nothing.
// Probes are read-only and run in both modes. The factory takes every seam for the specs.
import path from 'node:path';
import {
  SKILL_ROOT, SERVICES_FILE, OUTAGE_STATES, hostSettings, serviceRegistry, servicePorts, openServiceStore, newRecord,
  stepService, runChild, lastJson,
} from '../services.mjs';
import { quickCheck, backupDue } from '../ledger-health.mjs';
import { createLedgerBackup } from '../ledger-identity.mjs';
import { reconcileTurnBudget, turnCustodyHold } from '../turn-budget.mjs';
export { turnStep } from '../turn-budget.mjs';
import { goalTextRefusal } from '../../goal/goal-text.mjs';
import { clocksOf } from '../sla.mjs';
import { allocationMs, allocationSettings } from '../../../engine/config.mjs';
import { claimDue, finishDuty, listSchedules } from '../schedules.mjs';
import { pathKey } from '../../lib/path-key.mjs';
import os from 'node:os';
import { seatStateOf, seatHold } from '../host-seats.mjs';
import { runTerminalDrift, runtimeTerminalCount } from '../terminal-drift.mjs';
import { createStaleTerminalStep } from '../host-stale.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';
export { staleTerminalsOf, STALE_RETRY_MS, STALE_ESCALATE_TRIES, CLOSE_VERIFY } from '../host-stale.mjs'; export { seatStateOf };

/**
 * MB-01: the host's boot identity - the machine's boot minute. The boot order runs once per host boot (and when Orca
 * comes back), not once per engine process: a reload every ~6 min re-ran it 30 times on 2026-09-28.
 */
const hostBootId = ({ now = Date.now(), uptimeS = os.uptime() } = {}) => `boot-${Math.round((now - uptimeS * 1000) / 60_000)}`;
const BOOT_EVERY_MS = 365 * 86_400_000;
export const CONCERNS = Object.freeze(['host.kernel-seat', 'host.supervisor-seat', 'host.services', 'host.orca', 'host.processes', 'host.ledger-health']);
const KERNEL_WATCHDOG = 'scripts/kernel/kernel-watchdog.mjs';
const SUPERVISOR_WATCHDOG = 'scripts/supervisor/supervisor-watchdog.mjs';
const FOOTPRINT_SCAN = 'scripts/guards/footprint-scan.mjs';

// A read-only probe answer that a --repair pass would act on (scripts/kernel/kernel-watchdog.mjs statusTick/kernelTick).
export const NEEDS_REPAIR = new Set(['restart-needed', 'wake-needed', 'queued-input', 'staged-input']);
// Only a completed replacement counts toward seat quarantine.
export const REPLACED = new Set(['restarted']);
const DOWN_BEFORE_BOOT = new Set(['failed', 'backoff', 'starting', 'quarantined']);
const TERMINAL_LIST = 'scripts/api/orca/terminal-list.mjs';

/** The goal problem of a workflow's newest goal text, or null (INV-W4; scripts/goal/goal-text.mjs). */
export function goalProblem(markdown, refusal) {
  if (markdown == null || !String(markdown).trim()) return 'goal-text-missing';
  return refusal(markdown) ? 'goal-text-unresolved' : null;
}
const normRepo = (p) => pathKey(p, { fold: true });
const argOf = (cmd, name) => {
  const m = new RegExp(String.raw`(?:^|\s)--${name}(?:=|\s+)(?:"([^"]*)"|'([^']*)'|(\S+))`).exec(String(cmd ?? ''));
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};
const RUNTIME_SCRIPT = /[\\/](watchdog|start-workflow|serve-ask)\.mjs["']?(?=\s|$)/i, RUNTIME_COMMAND = /(?:^|\s)starci\s+workflow\s+(start)(?=\s|$)/i;
const runtimeLoopOf = (commandLine) => {
  const script = RUNTIME_SCRIPT.exec(commandLine), command = RUNTIME_COMMAND.exec(commandLine);
  if (!script && !command) return null;
  if (script && (!command || script.index <= command.index)) return { script: script[1], command: null };
  return { script: null, command: command[1] };
};
/**
 * Orphan runtime loops: watchdog.mjs / start-workflow.mjs / serve-ask.mjs or `starci workflow start`, whose --repo no managed ledger owns and whose workflow no managed ledger runs, older than
 * minAgeMs. A process with no --repo (the
 * Supervisor's watchdog) and a listed repo are never orphans. Pure.
 */
export function findOrphans(procs, { knownRepos, runningWorkflows, now, minAgeMs, exclude = [] }) {
  const known = new Set([...knownRepos].map(normRepo));
  const out = [];
  for (const p of procs ?? []) {
    const cmd = String(p?.cmd ?? '');
    const loop = runtimeLoopOf(cmd);
    if (!loop || exclude.includes(p.pid)) continue;
    const repo = argOf(cmd, 'repo');
    if (!repo || known.has(normRepo(repo))) continue;
    const workflowId = argOf(cmd, 'workflow') ?? argOf(cmd, 'goal');
    if (workflowId && runningWorkflows.has(workflowId)) continue;
    const ageMs = p.created ? now - p.created : 0;
    if (!p.created || ageMs < minAgeMs) continue;
    out.push({ pid: p.pid, script: loop.script ? `${loop.script}.mjs` : `starci workflow ${loop.command}`, repo, workflowId, ageMs, cmd: cmd.slice(0, 200) });
  }
  return out;
}

/** The JSON a ctx.run/ctx.api answer carries, or null (shadow answers carry none). */
export function outputOf(r) {
  if (r == null || r.shadow) return null;
  if (typeof r === 'string') return lastJson(r);
  return (r.stdout != null ? lastJson(r.stdout) : null) ?? r.value ?? r.json ?? r.result ?? null;
}

const di = (fields) => ({ schema: 'starci/decision-item@1', openedBy: 'host-controller', decider: 'supervisor', escalateTo: 'owner', ...fields });
const brief = (probe) => {
  if (!probe || typeof probe !== 'object') return {};
  const v = probe.value ?? {};
  const pick = { verdict: probe.verdict, status: probe.status, error: probe.error, terminals: probe.terminals, exists: probe.exists,
    taskStatus: probe.status && probe.exists != null ? probe.status : undefined, running: v.running, pid: v.pid, offset: v.offset, port: v.port,
    problems: v.health?.problems?.length ? v.health.problems.slice(0, 3) : undefined };
  return Object.fromEntries(Object.entries(pick).filter(([, x]) => x !== undefined && x !== null));
};

// The engine reads resyncMs/concurrency from modules/reconciler/host.yaml itself; the export mirrors them, and an
// unreadable file never breaks discovery.
const yamlNumber = (key, fallback) => { try { return hostSettings()[key]; } catch { return fallback; } };

// A failed probe whose port still answers within aliveTimeoutMs is slow, not down: never restarted, the pass counts as degraded.
async function degradeIfSlow(ctx, { name, entry, step, next, now }) {
  if (step.act === 'start' && entry.answers && await entry.answers().catch(() => false)) {
    next.restarts = next.restarts.slice(0, -1);
    next.state = 'degraded'; next.since = now; next.nextAttemptAt = null;
    step.act = null; step.to = 'degraded';
    next.lastSlowAt = now;
    await ctx.log('reconciler.host.service-slow', `${name}: probe failed ${next.failStreak}x but it still answers; not restarted`, { name, probe: next.lastProbe });
  }
}

async function startService(ctx, { entry, step, next, now }) {
  if (step.act !== 'start') return;
  const a = entry.start();
  if (a) { next.lastStart = { at: now, cmd: a.cmd, args: a.args }; next.lastStartResult = await ctx.run(a.cmd, a.args, { timeoutMs: entry.startTimeoutMs }); }
}

// The footprint scan, once per footprintEveryMs; true when it ran.
async function scanFootprint(ctx, p, now) {
  if (!claimDue(ctx, { controller: 'host', duty: 'footprint', intervalMs: p.footprintEveryMs, now }).due) return false;
  const r = await ctx.run('node', [FOOTPRINT_SCAN, '--json'], { timeoutMs: 600_000 });
  finishDuty(ctx, { controller: 'host', duty: 'footprint', result: (r?.shadow && 'skipped') || (r?.ok === false && 'failed') || 'done', actionId: r?.actionId ?? null, now: ctx.now() });
  return true;
}

// The open op attempts of a ledger whose newest snapshot is at or before `cutoff`.
async function dueAttempts(ctx, l, cutoff) {
  try {
    return (await ctx.read(l.ledgerId, (db) => db.prepare(`SELECT count(*) AS n FROM op_attempts a WHERE a.settled_at IS NULL AND a.end_state IS NULL AND a.terminal_handle IS NOT NULL
        AND a.terminal_closed_at IS NULL AND COALESCE((SELECT max(at) FROM attempt_transcript_snapshots s WHERE s.attempt_id=a.attempt_id), 0) <= ?`).get(cutoff)))?.n ?? 0;
  } catch { return 0; } // an old-schema ledger has no attempts to snapshot
}

export function createHostController(deps = {}) {
  const lazy = (fn) => { let v; let done = false; return () => { if (!done) { v = fn(); done = true; } return v; }; };
  const settings = lazy(deps.settings ?? (() => hostSettings()));
  const registry = lazy(deps.registry ?? (() => serviceRegistry({ settings: settings(), ports: servicePorts() })));
  const store = lazy(deps.store ?? (() => openServiceStore()));
  const goalRefusal = deps.goalRefusal ?? goalTextRefusal;
  const probeSeat = deps.probeSeat ?? (async ({ repo, workflowId, timeoutMs }) => {
    const r = await runChild(process.execPath, [path.join(SKILL_ROOT, KERNEL_WATCHDOG), '--repo', repo, '--workflow', workflowId, '--once', '--json'], { timeoutMs });
    return lastJson(r.stdout) ?? { ok: false, action: r.timedOut ? 'probe-timeout' : 'probe-failed', error: String(r.stderr).slice(0, 300) };
  });
  const listProcesses = deps.listProcesses ?? (async () => {
    const r = await runChild(process.execPath, [path.join(SKILL_ROOT, SERVICES_FILE), '--processes'], { timeoutMs: 240_000 });
    const v = lastJson(r.stdout);
    return v?.ok ? v.procs : null;
  });
  const hostVerdict = deps.hostVerdict ?? (async (procs) => {
    const [{ hostVerdict: verdict }, { allocationSettings }] = await Promise.all([import('../../supervisor/host-health.mjs'), import('../../../engine/config.mjs')]);
    const h = allocationSettings()?.supervisorTick?.host;
    return h ? verdict(procs, h) : { alert: false };
  });
  const orcaTerminals = deps.orcaTerminals ?? (async () => runtimeTerminalCount(lastJson((await runChild(process.execPath, [path.join(SKILL_ROOT, TERMINAL_LIST), '--include-visual-layouts'], { timeoutMs: settings().services.orca?.probeTimeoutMs ?? 30_000 })).stdout)));
  const supervisorMode = deps.supervisorMode ?? (async () => { try { return (await import('../../machine/home.mjs')).supervisorMode(); } catch { return 'chat'; } });
  // Orca's active workers over every Run (worker-list), or null when Orca does not answer for every Run.
  const activeWorkers = deps.activeWorkers ?? (async () => (await import('../../machine/worker-list-all.mjs')).activeWorkersAllRuns());
  // The handles a responding Orca lists, or null when it does not answer (read-only: runs in both modes).
  const terminalHandles = deps.terminalHandles ?? (async () => {
    const r = await runChild(process.execPath, [path.join(SKILL_ROOT, TERMINAL_LIST)], { timeoutMs: 60_000 });
    const v = lastJson(r.stdout);
    return v?.ok === true ? new Set((v.terminals ?? []).map((t) => t?.handle).filter(Boolean)) : null;
  });
  const checkLedger = deps.quickCheck ?? quickCheck;
  const isBackupDue = deps.backupDue ?? backupDue;

  const bootIdOf = deps.bootId ?? (() => hostBootId());
  const state = { bootPending: null, lastProcessesAt: 0, orphanClocks: new Set(), clocks: new Map(), staleCloses: new Map() };
  const staleTerminalStep = createStaleTerminalStep({ state, terminalHandles, outputOf, di });
  const ledgerBackupStep = createLedgerBackup({ di, outputOf, isBackupDue });
  // SLA clocks are sent on an edge only (ctx.clock when a clock starts, ctx.clear when it stops), as the other
  // controllers do; after an engine restart each clock state is sent once more.
  const clock = async (ctx, entity, st, slaMs, meta) => {
    const k = `${entity}|${st}`;
    if (state.clocks.get(k) === true) return;
    state.clocks.set(k, true);
    await ctx.clock(entity, st, slaMs, meta);
  };
  const clear = async (ctx, entity, st) => {
    const k = `${entity}|${st}`;
    if (state.clocks.get(k) === false) return;
    state.clocks.set(k, false);
    await ctx.clear(entity, st);
  };

  const productLedgers = (ctx) => (ctx.ledgers ?? []).filter((l) => l.ledgerId !== 'supervisor');
  const running = async (ctx, ledgerId) => {
    try {
      return (await ctx.read(ledgerId, (db) => db.prepare("SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all()))
        .map((r) => r.workflow_id);
    } catch { return []; }
  };
  const rowOf = (name, now) => store().get(name) ?? newRecord(name, now);

  /* -------------------------------------------------------- turn budget */

  const turnNumbers = deps.turnNumbers ?? (() => {
    const l = allocationSettings()?.liveness ?? {};
    const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
    return { kernelBudgetMs: n(l.kernelTurnBudgetMs, 1_200_000), supervisorBudgetMs: n(l.supervisorTurnBudgetMs, 1_800_000), graceMs: n(l.turnInterruptGraceMs, 300_000) };
  });
  const probeTurn = deps.probeTurn ?? (async ({ terminal, supervisor }) => {
    const r = await runChild(process.execPath, [path.join(SKILL_ROOT, SERVICES_FILE), '--turn', ...(terminal ? ['--terminal', terminal] : []), ...(supervisor && !terminal ? ['--supervisor'] : []), '--json'],
      { timeoutMs: settings().turnBudget?.probeTimeoutMs ?? 60_000 });
    return lastJson(r.stdout);
  });

  async function endTurn(ctx, key, rec) {
    if (!rec.turn) return null;
    rec.turn = null;
    await clear(ctx, key, 'KERNEL_TURN_OVERDUE');
    return { ended: true };
  }

  const turnBudget = (ctx, input) => reconcileTurnBudget(ctx, { ...input, probeTurn,
    numbers: turnNumbers(), settings: settings(), save: (record) => store().put(record), clock, clear });

  /* -------------------------------------------------------- services */

  async function openServiceDecisions(ctx, { name, entry, step, next, now, s }) {
    if (step.quarantined) {
      await ctx.openDecision(di({
        kind: 'service-quarantined', ledger: 'supervisor', entity: { type: 'service', id: name },
        idempotencyKey: `service-quarantined:${name}:${next.since}`, severity: entry.ownerPath ? 'critical' : 'warn', ownerPath: entry.ownerPath === true,
        summary: `${name}: more than ${s.quarantine.maxRestarts} restarts in ${Math.round(s.quarantine.windowMs / 60000)} min, quarantined`,
        evidence: [{ ref: `probe:${JSON.stringify(next.lastProbe).slice(0, 200)}` }, { ref: `restarts:${next.restarts.length}` }],
        options: [{ key: 'reopen', verb: `node ${SERVICES_FILE} --reopen ${name}`, recommended: true }], allowedVerbs: ['reopen'],
      }));
    }
    if (entry.kind === 'checker' && step.to === 'failed' && next.downSince != null && now - next.downSince >= entry.slaMs) {
      await ctx.openDecision(di({
        kind: 'runtime-defect', ledger: 'supervisor', entity: { type: 'service', id: name }, idempotencyKey: `checker-unavailable:${name}:${next.downSince}`,
        summary: `${name} unavailable for ${Math.round((now - next.downSince) / 60000)} min; legs that need it are deferred`, evidence: [{ ref: `probe:${JSON.stringify(next.lastProbe).slice(0, 200)}` }],
      }));
    }
  }

  async function reconcileService(name, ctx, { force = false } = {}) {
    const now = ctx.now();
    const entry = registry().find((e) => e.name === name);
    if (!entry) return { ok: false, skipped: 'unknown-service' };
    const rec = rowOf(name, now);
    if (!force && rec.lastProbe?.at && now - rec.lastProbe.at < entry.everyMs) return { ok: true, skipped: 'fresh', state: rec.state };
    let probe;
    try { probe = await entry.probe(); } catch (error) { probe = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
    const s = settings();
    const step = stepService(rec, { ok: probe?.ok === true, unmanaged: probe?.unmanaged === true, detail: brief(probe) }, { now, entry, backoff: s.backoff, quarantine: s.quarantine });
    const next = step.rec;
    await degradeIfSlow(ctx, { name, entry, step, next, now });
    await startService(ctx, { entry, step, next, now });
    await openServiceDecisions(ctx, { name, entry, step, next, now, s });
    if (OUTAGE_STATES.has(step.to)) await clock(ctx, `service:${name}`, 'SERVICE_DOWN', entry.slaMs, { code: 'SERVICE_DOWN', owner: 'host-controller', ledgerId: 'supervisor', since: next.downSince, state: step.to });
    else await clear(ctx, `service:${name}`, 'SERVICE_DOWN');
    if (name === 'orca' && DOWN_BEFORE_BOOT.has(step.from) && step.to === 'healthy') state.bootPending = true;
    if (step.from !== step.to) await ctx.log('reconciler.host.service', `${name} ${step.from} -> ${step.to}`, { name, from: step.from, to: step.to, act: step.act, probe: next.lastProbe });
    store().put(next);
    return { ok: true, name, from: step.from, to: step.to, act: step.act, quarantined: step.quarantined };
  }

  /* -------------------------------------------------------- seats */

  // The goal text of an unrendered or missing workflow refuses the seat: one DI to the Supervisor (INV-W4).
  async function refuseGoal(ctx, { ledgerId, workflowId, wf, rec, problem, now }) {
    await ctx.openDecision(di({
      kind: 'goal-text-missing', ledger: ledgerId, workflowId, entity: { type: 'workflow', id: workflowId }, idempotencyKey: `goal-text-missing:${ledgerId}:${workflowId}`,
      summary: `${workflowId}: the goal text is ${problem === 'goal-text-missing' ? 'missing' : 'an unrendered value'}; no Kernel seat is started (INV-W4). Only the owner edits a goal.`,
      evidence: [{ ref: `goal:${String(wf.goal ?? 'null').slice(0, 120)}` }], escalateTo: 'owner',
    }));
    store().put({ ...rec, state: 'refused', since: rec.state === 'refused' ? rec.since : now, lastAction: problem });
    return { ok: true, refused: problem };
  }

  // One watchdog pass over the seat: active runs the repair child, shadow probes and runs the repair only when the probe says one is needed.
  async function runSeatPass(ctx, { ledger, workflowId, s }) {
    const args = [KERNEL_WATCHDOG, '--repo', ledger.repo, '--workflow', workflowId, '--once', '--repair', '--json'];
    if (ctx.mode === 'active') {
      const seatOut = outputOf(await ctx.run('node', args, { timeoutMs: s.timeoutMs }));
      return { seatOut, action: seatOut?.action ?? 'unknown', acted: true };
    }
    const seatOut = await probeSeat({ repo: ledger.repo, workflowId, timeoutMs: s.timeoutMs });
    const action = seatOut?.action ?? 'unknown';
    let acted = false;
    if (NEEDS_REPAIR.has(action)) { await ctx.run('node', args, { timeoutMs: s.timeoutMs }); acted = true; }
    return { seatOut, action, acted };
  }

  // More than maxReplacementsPerHour replacements: the seat is quarantined; the first time, one DI seat-unrecoverable.
  async function quarantineSeat(ctx, { key, rec, next, ledgerId, workflowId, action, now }) {
    if (rec.state === 'quarantined') return;
    await ctx.openDecision(di({
      kind: 'seat-unrecoverable', ledger: ledgerId, workflowId, entity: { type: 'seat', id: key }, idempotencyKey: `seat-unrecoverable:${key}:${now}`,
      summary: `${workflowId}: the Kernel seat was replaced ${next.restarts.length} times in an hour; quarantined`,
      evidence: [{ ref: `action:${action}` }], options: [{ key: 'reopen', verb: `node ${SERVICES_FILE} --reopen ${key}`, recommended: true }], allowedVerbs: ['reopen'],
    }));
  }

  // The seat's SLA clocks: each one runs while the seat is in one of its states and closes otherwise.
  async function seatClocks(ctx, { key, seat, s, ledgerId, workflowId, action }) {
    const clocks = { SEAT_VACANT: [['suspect', 'replacing', 'reserving'], s.vacantSlaMs], KERNEL_GATED: [['gated'], s.gatedSlaMs], ORCA_DOWN: [['hostOutage'], s.hostOutageSlaMs],
      KERNEL_INPUT_STUCK: [['inputPending'], s.inputSlaMs], SEAT_QUARANTINED: [['quarantined'], s.quarantinedSlaMs] };
    await eachInOrder(Object.entries(clocks), async ([code, [states, slaMs]]) => {
      if (states.includes(seat)) await clock(ctx, key, code, slaMs, { code, owner: 'host-controller', ledgerId, workflowId, action });
      else await clear(ctx, key, code);
    });
  }

  // The workflow is not running: every clock of its seat closes and its record goes.
  async function releaseSeat(ctx, key) {
    await eachInOrder(['SEAT_VACANT', 'KERNEL_GATED', 'ORCA_DOWN', 'KERNEL_INPUT_STUCK', 'SEAT_QUARANTINED', 'KERNEL_TURN_OVERDUE'], (st) => clear(ctx, key, st));
    store().remove?.(key);
    return { ok: true, skipped: 'not-running' };
  }

  // The turn budget of a live, not just woken, seat; any other seat ends its turn.
  async function kernelTurn(ctx, { key, seat, action, next, seatOut, ledgerId, workflowId, repo }) {
    if (seat === 'live' && action !== 'woken') return turnBudget(ctx, { key, rec: next, terminal: seatOut?.terminal ?? null, ledgerId, workflowId, repo, supervisor: false });
    return endTurn(ctx, key, next);
  }

  async function reconcileKernelSeat(ledgerId, workflowId, ctx) {
    const now = ctx.now(), key = `seat:kernel:${ledgerId}:${workflowId}`, s = settings().seats.kernel;
    const held = await turnCustodyHold(ctx, key, store().get(key), { ledgerId, workflowId });
    if (held) return held;
    const ledger = (ctx.ledgers ?? []).find((l) => l.ledgerId === ledgerId);
    if (!ledger) return { ok: false, skipped: 'unknown-ledger' };
    const wf = await ctx.read(ledgerId, (db) => {
      const w = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
      const g = db.prepare('SELECT markdown FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
      return w ? { phase: w.phase, archivedAt: w.archived_at, goal: g?.markdown ?? null } : null;
    });
    if (wf?.phase !== 'running' || wf?.archivedAt != null) return releaseSeat(ctx, key);
    const rec = rowOf(key, now);
    const problem = goalProblem(wf.goal, goalRefusal);
    if (problem) return refuseGoal(ctx, { ledgerId, workflowId, wf, rec, problem, now });
    const hold = seatHold(rec, now, s); if (hold) return hold;
    const { seatOut, action, acted } = await runSeatPass(ctx, { ledger, workflowId, s });
    const replaced = ctx.mode === 'active' ? REPLACED.has(action) : acted && action === 'restart-needed';
    const next = { ...rec, restarts: [...(rec.restarts ?? []).filter((t) => now - t < 3_600_000), ...(replaced ? [now] : [])], lastAction: action, lastAt: now, mode: ctx.mode };
    let seat = seatStateOf(action);
    if (next.restarts.length > s.maxReplacementsPerHour) {
      seat = 'quarantined';
      await quarantineSeat(ctx, { key, rec, next, ledgerId, workflowId, action, now });
    }
    if (next.state !== seat) { next.state = seat; next.since = now; }
    await seatClocks(ctx, { key, seat, s, ledgerId, workflowId, action });
    const stale = seat === 'hostOutage' ? null : await staleTerminalStep(ctx, { ledgerId, workflowId, liveHandle: seatOut?.terminal ?? null });
    const turn = await kernelTurn(ctx, { key, seat, action, next, seatOut, ledgerId, workflowId, repo: ledger.repo });
    store().put(next);
    return { ok: turn?.ok !== false, action, seat, acted, replaced, ...(turn ? { turn } : {}), ...(stale?.length ? { staleTerminals: stale } : {}) };
  }

  async function reconcileSupervisorSeat(ctx) {
    const now = ctx.now(), key = 'seat:supervisor';
    const held = await turnCustodyHold(ctx, key, store().get(key));
    if (held) return held;
    if ((await supervisorMode()) === 'chat') { store().remove?.(key); return { ok: true, skipped: 'chat-mode' }; }
    const r = await ctx.run('node', [SUPERVISOR_WATCHDOG, '--once', '--json'], { timeoutMs: settings().seats.supervisor.timeoutMs });
    const action = outputOf(r)?.action ?? (r?.shadow ? 'shadow' : 'unknown');
    const rec = rowOf(key, now);
    const seat = action === 'shadow' ? rec.state : seatStateOf((action === 'replace-failed' && 'restart-failed') || action);
    const next = { ...rec, state: seat, since: rec.state === seat ? rec.since : now, lastAction: action, lastAt: now };
    // MB-05: consecutive refused inputs (the watchdog replaces the seat at SEAT_DEAF_MAX) ride on the SEAT_DEAF clock.
    const failures = Number(outputOf(r)?.inputFailures);
    if (Number.isFinite(failures)) {
      if (failures > 0) await clock(ctx, key, 'SEAT_DEAF', 900_000, { code: 'SEAT_DEAF', owner: 'host-controller', ledgerId: 'supervisor', failures });
      else await clear(ctx, key, 'SEAT_DEAF');
    }
    // The Supervisor's pass reports `busy` for a running turn; in shadow the pass did not run, so the seat is read.
    const turn = ['busy', 'shadow', 'idle'].includes(action) || seat === 'live'
      ? await turnBudget(ctx, { key, rec: next, terminal: outputOf(r)?.terminal ?? null, supervisor: true }) : await endTurn(ctx, key, next);
    store().put(next);
    return { ok: turn?.ok !== false, action, seat, ...(turn ? { turn } : {}) };
  }

  /* -------------------------------------------------------- boot (DESIGN 7.7) */

  /**
   * MB-01: whether the boot order is owed. A new engine process owes it only when the host itself booted since the
   * last recorded boot order (schedules host/boot, digest = hostBootId), or when the last one ran in shadow and this
   * engine runs active. Orca coming back sets it again (reconcileService).
   */
  function bootPending(ctx) {
    if (state.bootPending == null) {
      const row = listSchedules(ctx).find((r) => r.controller === 'host' && r.duty === 'boot');
      const done = row && row.last_result_digest === bootIdOf() && (row.last_result === 'done' || (row.last_result === 'skipped' && ctx.mode !== 'active'));
      state.bootPending = !done;
    }
    return state.bootPending;
  }

  async function boot(ctx) {
    const steps = [];
    const orca = await reconcileService('orca', ctx, { force: true });
    steps.push({ step: 'orca', ...orca });
    if (orca.to !== 'healthy') return { ok: false, waiting: 'orca', steps };
    await eachInOrder(['harness-ui', 'harness-tunnel', 'ask-gateway', 'ask-tunnel', 'telegram-bridge'], async (name) => { steps.push({ step: name, ...(await reconcileService(name, ctx, { force: true })) }); });
    // Terminal dedupe before any seat: Orca restores old tabs as duplicate Kernels (FMEA 15).
    const dedupeArgs = [SERVICES_FILE, '--dedupe', '--json'];
    if (ctx.mode === 'active') steps.push({ step: 'dedupe', result: outputOf(await ctx.run('node', dedupeArgs, { timeoutMs: 600_000 })) });
    else {
      const dry = deps.dedupeDryRun ? await deps.dedupeDryRun() : lastJson((await runChild(process.execPath, [path.join(SKILL_ROOT, SERVICES_FILE), '--dedupe', '--dry-run', '--json'], { timeoutMs: 600_000 })).stdout);
      if ((dry?.closed ?? []).length) await ctx.run('node', dedupeArgs, { timeoutMs: 600_000 });
      steps.push({ step: 'dedupe', dryRun: true, wouldClose: (dry?.closed ?? []).length, ok: dry?.ok !== false });
    }
    await eachInOrder(productLedgers(ctx), async (l) => {
      const r = await ctx.api(l.ledgerId, 'reconcile', ['--orphan-kernel-jobs'], { timeoutMs: 600_000 });
      steps.push({ step: 'reconcile --orphan-kernel-jobs', ledgerId: l.ledgerId, ok: r?.ok !== false });
    });
    state.bootPending = false;
    claimDue(ctx, { controller: 'host', duty: 'boot', intervalMs: BOOT_EVERY_MS, now: ctx.now(), force: true });
    finishDuty(ctx, { controller: 'host', duty: 'boot', result: ctx.mode === 'active' ? 'done' : 'skipped', digest: bootIdOf(), now: ctx.now() });
    await eachInOrder(productLedgers(ctx), async (l) => eachInOrder(await running(ctx, l.ledgerId), async (wf) => { steps.push({ step: 'seat', ledgerId: l.ledgerId, workflowId: wf, ...(await reconcileKernelSeat(l.ledgerId, wf, ctx)) }); }));
    steps.push({ step: 'seat:supervisor', ...(await reconcileSupervisorSeat(ctx)) });
    await ctx.log('reconciler.host.boot', `boot order done (${ctx.mode})`, { steps: steps.map((x) => ({ step: x.step, ok: x.ok, to: x.to, action: x.action })) });
    return { ok: true, steps };
  }

  /* -------------------------------------------------------- processes */

  // The ids of every workflow some managed ledger runs.
  async function runningIdsOf(ctx) {
    const ids = new Set();
    await eachInOrder(ctx.ledgers ?? [], async (l) => { for (const wf of await running(ctx, l.ledgerId)) ids.add(wf); });
    return ids;
  }

  // Each orphan runs an ORPHAN_PROCESS clock and is killed; the clock of a process that is gone closes.
  async function reapOrphans(ctx, orphans, p) {
    const seen = new Set();
    await eachInOrder(orphans, async (o) => {
      const entity = `process:${o.pid}`;
      seen.add(entity);
      await clock(ctx, entity, 'ORPHAN_PROCESS', p.orphanSlaMs, { code: 'ORPHAN_PROCESS', owner: 'host-controller', ledgerId: 'supervisor', repo: o.repo, workflowId: o.workflowId, script: o.script });
      await ctx.run('taskkill.exe', ['/F', '/T', '/PID', String(o.pid)], { timeoutMs: 120_000 });
    });
    await eachInOrder(state.orphanClocks, async (entity) => { if (!seen.has(entity)) await clear(ctx, entity, 'ORPHAN_PROCESS'); });
    state.orphanClocks = seen;
  }

  // INV-H2: Orca's terminals against the workers Orca itself holds active (every seat, op and [Worker] is a
  // worker-start worker; worker-list is the one count). An Orca that does not answer for every Run proves nothing (null).
  const terminalDrift = (ctx, p) => runTerminalDrift({ ctx, p, state, orcaTerminals, activeWorkers, clock, clear, dedupeArgs: [SERVICES_FILE, '--dedupe', '--json'] });

  async function processes(ctx) {
    const now = ctx.now(), p = settings().processes;
    if (now - state.lastProcessesAt < p.everyMs) return { ok: true, skipped: 'fresh' };
    state.lastProcessesAt = now;
    const procs = await listProcesses();
    if (!procs) return { ok: false, error: 'process table unreadable' };
    const out = { orphans: [] };
    const verdict = await hostVerdict(procs);
    if (verdict.alert) await ctx.log('reconciler.host.runaway', 'process counts over threshold', { counts: verdict.counts, topParents: verdict.topParents });
    const known = [...(ctx.ledgers ?? []).map((l) => l.repo).filter(Boolean)];
    const runningIds = await runningIdsOf(ctx);
    const orphans = findOrphans(procs, { knownRepos: known, runningWorkflows: runningIds, now, minAgeMs: p.orphanMinAgeMs, exclude: [process.pid, process.ppid] });
    await reapOrphans(ctx, orphans, p);
    out.orphans.push(...orphans);
    if (await scanFootprint(ctx, p, now)) out.footprint = true;
    const terminals = await terminalDrift(ctx, p);
    if (terminals) out.terminals = terminals;
    return { ok: true, ...out };
  }

  /* -------------------------------------------------------- transcripts (ui/CONTRACT.md) */

  /**
   * host:transcripts, every TRANSCRIPT_SNAPSHOT_MS (60 s; schedules host/transcripts): a scrollback snapshot of every
   * live op attempt of every ledger (scripts/kernel/transcripts.mjs snapshot --repo, a child per ledger that has an
   * open attempt due one) and of every live Kernel/Supervisor seat (transcripts.mjs snapshotSeats over machine.sqlite).
   * Snapshots write rows, so shadow records the runs (would-rows) and writes nothing.
   */
  async function transcripts(ctx) {
    const now = ctx.now();
    const everyMs = deps.transcriptEveryMs ?? 60_000;
    if (!claimDue(ctx, { controller: 'host', duty: 'transcripts', intervalMs: everyMs, now }).due) return { ok: true, skipped: 'fresh' };
    const out = { ledgers: [], seats: null };
    await eachInOrder(productLedgers(ctx), async (l) => {
      const due = await dueAttempts(ctx, l, now - everyMs);
      if (!due) return;
      const r = await ctx.run('node', ['scripts/kernel/transcripts.mjs', 'snapshot', '--repo', l.repo, '--every-ms', String(everyMs), '--json'], { timeoutMs: 120_000 });
      out.ledgers.push({ ledgerId: l.ledgerId, due, ok: r?.ok ?? null, shadow: Boolean(r?.shadow), written: r?.value?.written ?? null });
    });
    if (ctx.mode === 'active') {
      try {
        const [{ withMachine }, { snapshotSeats }] = await Promise.all([import('../../../engine/db/machine.mjs'), import('../../kernel/transcripts.mjs')]);
        out.seats = withMachine((m) => snapshotSeats(m, { now, everyMs }), { env: ctx.env ?? process.env });
      } catch (error) { out.seats = { error: String(error?.message ?? error).slice(0, 200) }; }
    } else ctx.log('reconciler.would', 'host would snapshot the live seat transcripts (transcripts.mjs snapshotSeats)', { controller: 'host', action: 'snapshotSeats' });
    finishDuty(ctx, { controller: 'host', duty: 'transcripts', result: ctx.mode === 'active' ? 'done' : 'skipped', now: ctx.now() });
    out.usage = await usageSweep(ctx, now);
    return { ok: true, ...out };
  }

  /**
   * host:usage, every 5 minutes (schedules host/usage), riding the transcripts tick: the token meter. One child
   * (scripts/kernel/usage-record.mjs sweep) records the usage of every settled op attempt that has none yet, and the
   * increment of every live Kernel session and of the Supervisor seat over what llm_usage already holds for that session,
   * so a re-run never counts twice. Shadow records the run and writes nothing.
   */
  async function usageSweep(ctx, now) {
    const everyMs = deps.usageEveryMs ?? allocationMs('usageEveryMs');
    if (!claimDue(ctx, { controller: 'host', duty: 'usage', intervalMs: everyMs, now }).due) return { skipped: 'fresh' };
    const r = await ctx.run('node', ['scripts/kernel/usage-record.mjs', 'sweep', '--json'], { timeoutMs: 180_000 });
    finishDuty(ctx, { controller: 'host', duty: 'usage', result: (r?.ok === false && 'failed') || (ctx.mode === 'active' && 'done') || 'skipped', now: ctx.now() });
    return { ok: r?.ok ?? null, shadow: Boolean(r?.shadow), attempts: r?.value?.attempts ?? null, kernels: r?.value?.kernels ?? null, supervisor: r?.value?.supervisor ?? null };
  }

  /* -------------------------------------------------------- ledger health */

  // The file does not exist yet (a repo with no workflow): not corrupt and nothing to restore or back up. Any episode
  // closes; the ledger is checked like any other once its file appears.
  async function absentLedger(ctx, { key, rec, r, now }) {
    rec.lastCheckAt = 0; rec.state = 'absent'; rec.since = now;
    await clear(ctx, key, 'LEDGER_CORRUPT');
    store().put(rec);
    return { ok: true, skipped: 'absent', check: r };
  }

  async function flagCorrupt(ctx, { key, r, ledgerId, was, now }) {
    await clock(ctx, key, 'LEDGER_CORRUPT', 0, { code: 'LEDGER_CORRUPT', severity: 'critical', owner: 'host-controller', ledgerId, result: r.result.slice(0, 5) });
    if (was === 'corrupt') return;
    await ctx.openDecision(di({
      kind: 'runtime-defect', ledger: 'supervisor', productLedger: ledgerId, entity: { type: 'ledger', id: ledgerId }, idempotencyKey: `ledger-corrupt:${ledgerId}:${now}`, severity: 'critical',
      summary: `${ledgerId}: database integrity failed; preserve the database and WAL, then inspect a verified ${settings().ledgerHealth.backupDir} snapshot and its loss window with the owner before restoration`,
      evidence: r.result.slice(0, 5).map((x) => ({ ref: `quick_check:${x}` })), escalateTo: 'owner',
    }));
  }

  async function flagUnhealthy(ctx, { r, reason, ledgerId, now }) {
    const remedy = ((reason === 'schema-incompatible' || reason === 'sqlite-downgrade') && 'use a compatible runtime and SQLite version')
      || (reason === 'identity-mismatch' && 'resolve the registry and database identity with the owner') || 'resolve storage access or locking';
    await ctx.openDecision(di({
      kind: 'runtime-defect', ledger: 'supervisor', productLedger: ledgerId, entity: { type: 'ledger', id: ledgerId }, idempotencyKey: `ledger-health:${ledgerId}:${reason}:${now}`, severity: 'high',
      summary: `${ledgerId}: ${reason}; preserve the database and WAL and ${remedy}`,
      evidence: r.result.slice(0, 5).map((x) => ({ ref: `ledger_health:${x}` })),
    }));
  }

  // One quick_check result: the record's state follows it, the LEDGER_CORRUPT clock and the Decision Items on an edge.
  async function judgeCheck(ctx, { key, rec, r, ledgerId, now }) {
    const was = rec.state;
    const reason = r.ok ? null : r.reason ?? 'integrity-failed';
    const next = (r.ok && 'ok') || (reason === 'integrity-failed' && 'corrupt') || reason;
    if (rec.state !== next) { rec.state = next; rec.since = now; }
    if (next !== 'corrupt') await clear(ctx, key, 'LEDGER_CORRUPT');
    if (next === 'corrupt') await flagCorrupt(ctx, { key, r, ledgerId, was, now });
    else if (!r.ok && was !== next) await flagUnhealthy(ctx, { r, reason, ledgerId, now });
  }

  async function ledgerHealth(ledgerId, ctx) {
    const now = ctx.now(), lh = settings().ledgerHealth, key = `ledger:${ledgerId}`;
    const ledger = (ctx.ledgers ?? []).find((l) => l.ledgerId === ledgerId);
    if (!ledger?.file) {
      // The ledger left the registry (or has no file): whatever episode it had cannot go on, so it closes now.
      await clear(ctx, key, 'LEDGER_CORRUPT');
      return { ok: true, skipped: 'unknown-ledger' };
    }
    const rec = rowOf(key, now);
    const out = { ok: rec.lastCheck?.ok !== false && rec.state !== 'backup-failed' };
    if (!rec.lastCheckAt || now - rec.lastCheckAt >= lh.quickCheckEveryMs) {
      const r = checkLedger(ledger.file);
      rec.lastCheckAt = now; rec.lastCheck = r;
      if (r.absent) return absentLedger(ctx, { key, rec, r, now });
      await judgeCheck(ctx, { key, rec, r, ledgerId, now });
      out.ok = r.ok;
      out.check = r;
    }
    await ledgerBackupStep(ctx, { rec, ledger, ledgerId, lh, now, out });
    store().put(rec);
    return out;
  }

  /* -------------------------------------------------------- the controller */

  return {
    name: 'host',
    concerns: [...CONCERNS],
    resyncMs: yamlNumber('resyncMs', 60_000),
    concurrency: yamlNumber('concurrency', 1),
    routes: {
      'kernel-start-failed': (ev) => (ev.workflowId ? `seat:kernel:${ev.ledgerId}:${ev.workflowId}` : null),
      'kernel-exited-terminal-closed': (ev) => (ev.workflowId ? `seat:kernel:${ev.ledgerId}:${ev.workflowId}` : null),
      'workflow-finished': (ev) => (ev.workflowId ? `seat:kernel:${ev.ledgerId}:${ev.workflowId}` : null),
    },
    async list(ctx) {
      const keys = bootPending(ctx) ? ['host:boot'] : [];
      keys.push(...registry().map((e) => `service:${e.name}`), 'host:processes', 'host:transcripts');
      for (const l of ctx.ledgers ?? []) if (l.file) keys.push(`ledger:${l.ledgerId}`);
      // An open LEDGER_CORRUPT clock of a ledger no longer listed (its file absent, or it left supervisor.repos) gets
      // the pass that clears it.
      let openCorrupt = [];
      try { if (ctx.machine) openCorrupt = clocksOf(ctx, { prefixes: ['ledger:'] }).filter((c) => c.state === 'LEDGER_CORRUPT').map((c) => c.entity); } catch { openCorrupt = []; }
      for (const k of openCorrupt) if (!keys.includes(k)) keys.push(k);
      await eachInOrder(productLedgers(ctx), async (l) => { for (const wf of await running(ctx, l.ledgerId)) keys.push(`seat:kernel:${l.ledgerId}:${wf}`); });
      keys.push('seat:supervisor');
      return keys;
    },
    async reconcile(key, ctx) {
      if (key === 'host:boot') return bootPending(ctx) ? boot(ctx) : { ok: true, skipped: 'booted' };
      if (key.startsWith('service:')) return reconcileService(key.slice('service:'.length), ctx);
      if (key === 'host:processes') return processes(ctx);
      if (key === 'host:transcripts') return transcripts(ctx);
      if (key.startsWith('ledger:')) return ledgerHealth(key.slice('ledger:'.length), ctx);
      if (key.startsWith('seat:')) {
        if (bootPending(ctx)) return { ok: true, deferred: 'boot' };
        if (key === 'seat:supervisor') return reconcileSupervisorSeat(ctx);
        const rest = key.slice('seat:kernel:'.length), cut = rest.lastIndexOf(':');
        return reconcileKernelSeat(rest.slice(0, cut), rest.slice(cut + 1), ctx);
      }
      return { ok: false, skipped: 'unknown-key' };
    },
    _state: state,
  };
}

export default createHostController();
