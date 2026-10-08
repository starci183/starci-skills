// debug-standard-probes.mjs — the digest probes of modules/reconciler/operating-standard.yaml: one function per step, reading one
// collected snapshot and answering `done`, `waiting` (inside its bound, or on a party whose wait is the design), `overdue` (the bound
// is spent and the done-state is not observable) or `na` (the precondition does not hold). An overdue answer names the departure
// code of the operating standard; an attempt-scope probe answers one entry per attempt.
const MIN = 60_000;
const minutes = (ms) => Math.max(0, Math.round(ms / MIN));

const done = (evidence) => ({ state: 'done', evidence });
const waiting = (evidence, happy = null) => ({ state: 'waiting', evidence, happy });
const overdue = (evidence, departure) => ({ state: 'overdue', evidence, departure });
const na = (evidence) => ({ state: 'na', evidence });
const within = (c, since) => since !== null && since !== undefined && c.now - Number(since) <= c.bound;

const eventsOf = (w, kind) => (w.events ?? []).filter((e) => e.kind === kind);
const lastAt = (events) => events.reduce((at, e) => Math.max(at, Number(e.at)), 0) || null;
const groupKey = (e) => `${e.op ?? ''}|${e.step ?? ''}|${e.error ?? ''}`;

/** Failures of one kind since the last success of another, and the largest group of them that failed at the same step with the same error. */
function failuresSince(w, failKind, successKind) {
  const since = lastAt(eventsOf(w, successKind)) ?? 0;
  const failures = eventsOf(w, failKind).filter((e) => Number(e.at) > since);
  const groups = new Map();
  for (const e of failures) groups.set(groupKey(e), [...(groups.get(groupKey(e)) ?? []), e]);
  const worst = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  return { count: failures.length, worst: worst.length, step: worst[0]?.step ?? null, error: worst[0]?.error ?? null, op: worst[0]?.op ?? null };
}

const firstLine = (text, size) => String(text ?? '').split('\n')[0].slice(0, size);

function hostReady(c) {
  const r = c.reconciler;
  if (!r.leader) return overdue('no reconciler leader row', 'leader-missing');
  if (!r.leader.alive) return overdue(`the leader beat ${minutes(r.leader.heartbeatAgeMs)} min ago`, 'leader-stale');
  if (r.alarm) return overdue(`controllers off: ${r.alarm.names.join(', ')}`, 'controllers-off');
  if (r.safe.length) return overdue(`controllers in safe mode: ${r.safe.join(', ')}`, 'safe-mode');
  return done(`leader pid ${r.leader.pid} beats; controllers match config`);
}

/** The departure code of a seat that is not serving: the seat is not live, its terminal is dead, or it takes no input. */
function seatDeparture(seat, health) {
  if (seat?.state !== 'live') return 'supervisor-down';
  return health?.live === false ? 'supervisor-dead' : 'supervisor-deaf';
}

function supervisorSeatLive(c) {
  const s = c.supervisor;
  if (s.enabled === false) return na('the Supervisor is disabled');
  if (s.seat?.state === 'live' && !s.seat.deaf && s.health?.live !== false) return done(`seat ${s.seat.state}`);
  const age = s.seat?.lastSeenAgeMs ?? null;
  if (s.seat && age !== null && age <= c.bound) return waiting(`seat ${s.seat.state}, seen ${minutes(age)} min ago: a replacement is inside its bound`, 'seat-replacing');
  const seen = age === null ? '' : `, last seen ${minutes(age)} min ago`;
  return overdue(`seat ${s.seat?.state ?? 'absent'}${seen}`, seatDeparture(s.seat, s.health));
}

const goalApproved = (c) => (c.workflow.phase === 'awaiting-approval' ? waiting('the goal waits for the owner', 'goal-awaiting-approval') : done(`phase ${c.workflow.phase}`));

function workflowStarted(c) {
  const w = c.workflow;
  if (w.phase === 'running') return done('phase running');
  if (w.phase === 'awaiting-approval') return na('the goal is not approved');
  const queued = `queued ${minutes(c.now - Number(w.updatedAt))} min`;
  return within(c, w.updatedAt) ? waiting(queued) : overdue(`${queued} and not started`, 'workflow-not-started');
}

function kernelBooted(c) {
  const w = c.workflow;
  if (w.phase !== 'running') return na(`phase ${w.phase}`);
  const loop = failuresSince(w, 'kernel-start-failed', 'kernel-booted');
  if (loop.worst >= c.n.startLoopMin) return overdue(`${loop.worst} launches failed at ${loop.step}: ${firstLine(loop.error, 90)}`, 'kernel-start-loop');
  if (c.kernel.alive) return done(`Kernel job ${c.kernel.job}, terminal ${c.kernel.terminal}`);
  const since = Math.max(Number(w.kernelJob?.updatedAt ?? 0), Number(w.updatedAt ?? 0)) || null;
  return within(c, since) ? waiting('the Kernel seat is being started', 'kernel-starting') : overdue(`Kernel job ${c.kernel.job ?? 'absent'}, probe ${c.kernel.probe ?? 'none'}`, 'kernel-dead');
}

function kernelAckedRev(c) {
  const k = c.kernel;
  if (!k.alive) return na('no live Kernel');
  if (!k.revStale) return done(`acked ${String(k.ackedRev ?? '').slice(0, 9)}`);
  const since = lastAt(eventsOf(c.workflow, 'runtime-rev-acked')) ?? lastAt(eventsOf(c.workflow, 'kernel-booted'));
  if (within(c, since)) return waiting(`${k.filesBehind} file(s) behind, inside the ack bound`, 'rev-pending');
  return overdue(`acked ${String(k.ackedRev).slice(0, 9)} while ${String(k.currentRev).slice(0, 9)} is current`, 'kernel-rev');
}

function legDispatched(c) {
  const k = c.kernel;
  const loop = failuresSince(c.workflow, 'dispatch-rejected', 'op-dispatched');
  if (loop.worst >= c.n.startLoopMin) return overdue(`${loop.worst} launches of ${loop.op} refused at ${loop.step}: ${firstLine(loop.error, 90)}`, 'dispatch-loop');
  if (k.idleWithReady) return overdue(`${k.readyWork} ready unit(s), Kernel idle, last woken ${minutes(k.lastWakeAgeMs ?? 0)} min ago`, 'kernel-idle');
  return k.readyWork > 0 ? waiting(`${k.readyWork} ready unit(s) inside the wake bound`) : done('no ready leg waits');
}

function workerStarted(c) {
  return c.workflow.attempts.filter((a) => a.dispatchedAt !== null && a.endState === null && a.reportedAt === null).map((a) => {
    const item = { attemptId: a.attemptId, op: a.op };
    if (a.startedAt !== null) return { ...item, ...done('worker ready') };
    const launching = `dispatched ${minutes(c.now - Number(a.dispatchedAt))} min ago`;
    return { ...item, ...(within(c, a.dispatchedAt) ? waiting('worker launching') : overdue(`${launching}, no worker ready`, 'worker-not-started')) };
  });
}

function opWorking(c) {
  const running = new Map(c.running.map((r) => [r.jobId, r]));
  return c.workflow.attempts.filter((a) => running.has(a.jobId) && a.reportedAt === null).map((a) => {
    const r = running.get(a.jobId);
    return { attemptId: a.attemptId, op: a.op, ...(r.pastDeadline ? overdue(`${minutes(r.ageMs)} min past the job deadline`, 'job-past-deadline') : waiting(`running ${minutes(r.ageMs)} min`)) };
  });
}

function reportFiled(c) {
  return c.workflow.attempts.filter((a) => a.settledAt !== null || a.endState !== null).map((a) => {
    const item = { attemptId: a.attemptId, op: a.op };
    if (a.reportedAt !== null) return { ...item, ...done(`report ${a.reportOutcome}`) };
    if (a.endState === null) return { ...item, ...overdue('settled with no report and no typed cause', 'attempt-no-cause') };
    return { ...item, ...done(`ended ${a.endState} with a typed cause`), happy: a.endState === 'worker-dead' ? 'worker-lost' : null };
  });
}

const checksOf = (w, attemptId) => eventsOf(w, 'checks-recorded').filter((e) => e.attemptId === attemptId);

function checksRerun(c) {
  return c.workflow.attempts.filter((a) => a.reportedAt !== null && a.reportOutcome === 'done').map((a) => {
    const item = { attemptId: a.attemptId, op: a.op };
    if (checksOf(c.workflow, a.attemptId).length) return { ...item, ...done('checks recorded') };
    if (within(c, a.reportedAt) || a.settledAt !== null) return { ...item, ...waiting('the checks have not run again yet') };
    return { ...item, ...overdue(`reported ${minutes(c.now - Number(a.reportedAt))} min ago and the checks did not run again`, 'checks-not-rerun') };
  });
}

function settled(c) {
  return c.workflow.attempts.filter((a) => a.reportedAt !== null).map((a) => {
    const item = { attemptId: a.attemptId, op: a.op };
    if (a.settledAt !== null) return { ...item, ...done(`settled ${a.verdict} by ${a.settledBy ?? 'unknown'}`) };
    const byRuntime = a.reportOutcome === 'done';
    const bound = byRuntime ? c.bound + c.boundChecks : c.boundKernel;
    if (c.now - Number(a.reportedAt) <= bound) return { ...item, ...waiting('reported; inside the settle bound') };
    const stuck = `reported ${minutes(c.now - Number(a.reportedAt))} min ago, outcome ${a.reportOutcome}, not settled`;
    if (a.treeExists === false) return { ...item, ...overdue(`${stuck}; the tree it was admitted in is gone: ${a.worktreePath}`, 'placement-lost') };
    return { ...item, ...overdue(stuck, byRuntime ? 'settle-overdue' : 'settle-overdue-kernel') };
  });
}

/** A path with forward slashes, no trailing slash and a lower-case drive letter, so one directory spelled two ways compares equal. */
function normal(p) {
  let out = String(p ?? '').replaceAll('\\', '/');
  while (out.endsWith('/')) out = out.slice(0, -1);
  return /^[A-Za-z]:/.test(out) ? `${out[0].toLowerCase()}${out.slice(1)}` : out;
}
const insideTree = (cwd, tree) => normal(cwd) === normal(tree) || normal(cwd).startsWith(`${normal(tree)}/`);

function settleEvidence(c) {
  return c.workflow.attempts.filter((a) => a.verdict === 'pass').map((a) => {
    const item = { attemptId: a.attemptId, op: a.op };
    const event = eventsOf(c.workflow, 'op-settled').filter((e) => e.attemptId === a.attemptId).pop();
    if (!event?.checkedIn?.length) return { ...item, ...na(event ? 'the settle event names no directory the checks ran in' : 'no settle event') };
    const stray = event.checkedIn.filter((r) => !insideTree(r.cwd, a.worktreePath));
    if (stray.length) return { ...item, ...overdue(`checks ran in ${stray[0].cwd}, the attempt's tree is ${a.worktreePath}`, 'checks-ran-outside-tree') };
    return { ...item, ...done('the checks ran in the attempt tree') };
  });
}

function handover(c) {
  if (c.workflow.status?.frontier?.state !== 'finish-ready') return done('the workflow is not waiting to finish');
  const since = lastAt(eventsOf(c.workflow, 'handover-approved')) ?? c.workflow.updatedAt;
  return within(c, since) ? waiting('finish-ready, inside the bound') : overdue('the handover is approved and the workflow does not finish', 'handover-stuck');
}

function resourcesReleased(c) {
  const leaked = c.admission.leaked;
  if (!leaked.length) return done('no reservation is leaked');
  if (leaked.every((r) => r.ageMs <= c.bound)) return waiting(`${leaked.length} reservation(s) inside the release bound`);
  return overdue(`${leaked.length} reservation(s) live for work that is not running`, 'reservation-leak');
}

export const PROBES = Object.freeze({ 'host-ready': hostReady, 'supervisor-seat-live': supervisorSeatLive, 'goal-approved': goalApproved, 'workflow-started': workflowStarted,
  'kernel-booted': kernelBooted, 'kernel-acked-rev': kernelAckedRev, 'leg-dispatched': legDispatched, 'worker-started': workerStarted, 'op-working': opWorking,
  'report-filed': reportFiled, 'checks-rerun': checksRerun, settled, 'settle-evidence': settleEvidence, handover, 'resources-released': resourcesReleased });
