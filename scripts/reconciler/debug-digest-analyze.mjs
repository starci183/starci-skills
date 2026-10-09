// debug-digest-analyze.mjs — the pure half of `starci debug digest`: one collected snapshot becomes the digest sections and the
// problems list. It judges the snapshot against the hold policy table (modules/kernel/op-incident-policy.yaml, passed in as
// `policy`) and the numbers of modules/reconciler/debug-digest.yaml (`n`); it reads no store, runs no child and never decides a
// repair. A problem carries a `code` and its `params`; scripts/reconciler/debug-digest-render.mjs words it in the owner's language.
import { byCodeUnit } from '../lib/list.mjs';
import { loadStandard, judgeStandard } from './debug-standard.mjs';
import { classifyAll } from './debug-verdicts.mjs';
import { roleRows } from './debug-roles.mjs';
import { loadQuestions, answerQuestions, standingOf } from './debug-questions.mjs';
import { bootBudget, exceededWakes, supervisorWakeBudget, wakeBudget } from '../kernel/wake-budget.mjs';
import { seatsOverEmptyBound } from './seat-cost.mjs';

const MIN = 60_000;
const LIVE_JOB = new Set(['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown']);
const LIVE_SUP_JOB = new Set(['spawning', 'running', 'dispatched']);
const FAILED_LEG = new Set(['failed', 'blocked', 'cancelled', 'awaiting_owner']);
const DEAD_PROBES = new Set(['restart-needed', 'agent-exit-unconfirmed', 'terminal-unverified', 'terminal-unreadable']);

const minutes = (ms) => Math.max(0, Math.round(ms / MIN));
const SECRET_PROBLEMS = 10;
const problem = (area, blocks, key, code, params = {}, evidence = {}) => ({ area, blocks, key, code, params, evidence });

/** The hold and row lookups over the policy table; `bound` resolves one named bound of an entry to a number or null. */
function policyIndex(policy) {
  const holds = new Map((policy.holds ?? []).map((hold) => [hold.id, hold]));
  const rows = new Map((policy.rows ?? []).map((row) => [row.id, row]));
  const bound = (entry, name) => (entry?.bound?.[name] === undefined ? null : policy.resolve(entry.bound[name]));
  return { holds, rows, bound };
}

/** The first line of the digest: configured controllers that do not run, or null when the engine matches the config. */
function controllersAlarm(engine, leaderAgeMs, n) {
  const stale = engine.leader === null || leaderAgeMs > n.leaderStaleMs;
  const wanted = Object.entries(engine.configured).filter(([, mode]) => mode !== 'off').map(([name]) => name);
  const off = wanted.filter((name) => stale || (engine.modes[name] ?? 'off') === 'off');
  if (off.length === 0) return null;
  return { kind: off.length === wanted.length ? 'all-off' : 'some-off', names: off, leaderMissing: engine.leader === null };
}

function reconcilerSection({ snapshot, n }) {
  const { engine, liveRev, now } = snapshot;
  const leaderAgeMs = engine.leader ? now - Number(engine.leader.heartbeatAt) : null;
  const rev = engine.leader?.rev ?? null;
  const controllers = Object.keys(engine.configured).sort(byCodeUnit).map((name) => ({
    name, configured: engine.configured[name], effective: engine.leader ? engine.modes[name] ?? 'off' : 'off' }));
  const leader = engine.leader ? { pid: engine.leader.pid, epoch: engine.leader.epoch, rev, heartbeatAgeMs: leaderAgeMs,
    alive: leaderAgeMs <= n.leaderStaleMs, revDrift: Boolean(liveRev && rev && rev !== liveRev), liveRev } : null;
  return { alarm: controllersAlarm(engine, leaderAgeMs, n), controllers, safe: engine.safe, failingQueue: engine.failingQueue, leader };
}

function leaderProblem(leader, n) {
  if (!leader) return problem('reconciler', n.blocksEverything, 'leader-missing', 'leader-missing');
  if (!leader.alive) return problem('reconciler', n.blocksEverything, 'leader-stale', 'leader-stale', { pid: leader.pid, min: minutes(leader.heartbeatAgeMs) }, leader);
  if (!leader.revDrift) return null;
  return problem('reconciler', n.revDriftBlocks, 'leader-rev', 'leader-rev', { have: String(leader.rev).slice(0, 9), live: String(leader.liveRev).slice(0, 9) }, leader);
}

function reconcilerProblems(section, n) {
  const { alarm } = section;
  const out = [leaderProblem(section.leader, n)];
  if (alarm) out.push(problem('reconciler', n.blocksEverything, 'controllers-off', 'controllers-off', { names: alarm.names.join(', '), all: alarm.kind === 'all-off' }, alarm));
  if (section.safe.length) out.push(problem('reconciler', n.blocksEverything, 'safe-mode', 'safe-mode', { names: section.safe.join(', ') }));
  for (const q of section.failingQueue) out.push(problem('reconciler', q.n, `queue-${q.controller}`, 'queue-failing', { n: q.n, controller: q.controller }, q));
  return out.filter(Boolean);
}

function supervisorSection({ snapshot }) {
  const { supervisor, now } = snapshot;
  const seat = supervisor.seat;
  const dueDecisions = supervisor.decisions.filter((d) => d.dueAt !== null && Number(d.dueAt) < now)
    .map((d) => ({ ...d, overdueMs: now - Number(d.dueAt), gate: /gate/i.test(d.kind) }));
  const view = seat ? { state: seat.state, terminal: seat.terminalHandle, lastSeenAgeMs: seat.lastSeenAt ? now - Number(seat.lastSeenAt) : null,
    lastInputOkAgeMs: seat.lastInputOkAt ? now - Number(seat.lastInputOkAt) : null, deaf: seat.deaf === true } : null;
  return { enabled: supervisor.enabled, seat: view, health: supervisor.health,
    lastWakeAgeMs: supervisor.lastWakeAt ? now - Number(supervisor.lastWakeAt) : null,
    openDecisions: supervisor.decisions.length, dueDecisions, staleGates: dueDecisions.filter((d) => d.gate),
    overBudgetWakes: exceededWakes(supervisor.wakes ?? [], supervisorWakeBudget()), seatCost: supervisor.seatCost ?? null, revision: supervisor.revision ?? null };
}

function seatProblem(section, n) {
  const { seat, enabled, health } = section;
  if (enabled !== false && seat?.state !== 'live') return problem('supervisor', n.blocksEverything, 'seat-down', 'supervisor-down', { state: seat?.state ?? 'absent' }, { seat });
  if (health?.live === false) return problem('supervisor', n.blocksEverything, 'seat-dead', 'supervisor-dead', { reason: health.reason ?? 'none recorded' }, health);
  return seat?.deaf ? problem('supervisor', n.blocksEverything, 'seat-deaf', 'supervisor-deaf', {}, seat) : null;
}

/** A Supervisor wake that spent more tokens than its budget is a departure of the Supervisor. */
function wakeBudgetProblem(section) {
  const worst = section.overBudgetWakes.at(-1);
  if (!worst) return null;
  return problem('supervisor', 1, 'supervisor-wake-budget', 'supervisor-wake-budget', { turns: worst.turns, tokens: worst.tokens, wakes: section.overBudgetWakes.length, budgetTokens: supervisorWakeBudget().tokens }, section.overBudgetWakes);
}

/** A seat woken with an empty menu more often than the declared bound is a departure of the runtime that woke it (never of the seat). */
function emptyWakeProblem(seatCost, name, key) {
  if (!seatCost || !seatsOverEmptyBound([seatCost]).length) return null;
  return problem('runtime', 1, `seat-empty-wakes-${key}`, 'seat-empty-wakes', { name, empty: seatCost.emptyWakes, wakes: seatCost.wakes, percent: seatCost.emptySharePercent }, seatCost);
}

function supervisorProblems(section, n) {
  const out = [seatProblem(section, n), wakeBudgetProblem(section), emptyWakeProblem(section.seatCost, 'the Supervisor', 'supervisor')];
  for (const d of section.dueDecisions) {
    out.push(problem('supervisor', d.gate ? n.staleGateBlocks : 1, `di-${d.id}`, d.gate ? 'gate-stale' : 'decision-overdue',
      { kind: d.kind, decider: d.decider, min: minutes(d.overdueMs), summary: d.summary ?? '' }, d));
  }
  return out.filter(Boolean);
}

/** What the table says about one queued job: its hold, the handler, the step and the deadline. */
function holdView(job, queued, ctx) {
  const { index, now } = ctx;
  const hold = index.holds.get(queued.queuedBecause) ?? null;
  const deadlineMs = hold ? index.bound(hold, 'deadlineMs') : null;
  const since = Number(job?.updatedAt ?? job?.createdAt ?? now);
  const chain = hold?.chain ?? (hold ? [hold.handler] : []);
  const next = chain[1] ?? index.rows.get(hold?.id)?.next ?? 'owner';
  const deadlineAt = deadlineMs === null ? null : since + deadlineMs;
  const overdue = deadlineAt !== null && now > deadlineAt;
  return { jobId: queued.jobId, op: queued.opId, hold: queued.queuedBecause, handler: hold?.handler ?? null,
    step: overdue ? { kind: 'bound-spent', next } : { kind: 'inside-bound', next }, deadlineAt, overdue,
    overdueMs: overdue ? now - deadlineAt : 0, detail: queued.detail ?? null, listed: hold !== null, blockedBy: queued.blockedBy ?? null };
}

function jobsSection(workflow, ctx) {
  const jobs = workflow.jobs.filter((j) => j.kind === 'op');
  const byId = new Map(jobs.map((j) => [j.jobId, j]));
  const queued = workflow.status?.frontier?.queued ?? [];
  const running = jobs.filter((j) => LIVE_JOB.has(j.status)).map((j) => ({ jobId: j.jobId, op: j.opId, status: j.status, tryNo: j.tryNo,
    ageMs: ctx.now - Number(j.updatedAt), deadlineAt: j.deadline ?? null, pastDeadline: j.status === 'running' && j.deadline !== null && ctx.now > Number(j.deadline) }));
  return { running, held: queued.map((q) => holdView(byId.get(q.jobId), q, ctx)), queuedCount: queued.length };
}

/** Whether the table's next step happened for a failed or blocked leg, from the ledger rows (a successor job, an open Decision Item or incident). */
function stepTaken(leg, workflow) {
  const failed = workflow.jobs.find((j) => j.jobId === leg.jobId);
  const successor = workflow.jobs.find((j) => j.retryOf === leg.jobId || (j.kind === 'op' && j.opId === leg.op && j.createdAt > (failed?.createdAt ?? Infinity)));
  if (successor) return { taken: true, by: { kind: 'retry', id: successor.jobId, detail: successor.status } };
  const decision = workflow.decisions.find((d) => d.jobId === leg.jobId && d.status === 'open');
  if (decision) return { taken: true, by: { kind: 'decision', id: decision.kind, detail: decision.decider } };
  // A gate (supervisor-gate, owner-gate) carries no job_id: it names the jobs it holds in its raising event.
  const incident = workflow.incidents.find((i) => (i.jobId === leg.jobId || i.holds?.includes(leg.jobId)) && i.status === 'open');
  if (incident) return { taken: true, by: { kind: 'incident', id: incident.kind, detail: incident.owner } };
  const peerOp = /^other-op:(.+)$/.exec(leg.why?.owner ?? '')?.[1];
  const peer = peerOp ? workflow.jobs.find((j) => j.opId === peerOp && (LIVE_JOB.has(j.status) || j.status === 'queued')) : null;
  return peer ? { taken: true, by: { kind: 'waits', id: peer.opId, detail: peer.status } } : { taken: false, by: null };
}

/** The verdict code on one stop: whether its cause is recorded and the policy's next step happened inside its window. */
function verdictOf({ cause, step, waitingOnOwner, ageMs, ownerAsk, dueMs }) {
  if (cause === null) return 'no-cause';
  if (waitingOnOwner && !ownerAsk && !step.taken) return 'owner-without-ask';
  if (step.taken || waitingOnOwner) return 'reasonable';
  return ageMs !== null && ageMs > dueMs ? 'step-missing' : 'pending';
}

function legJudgement(leg, workflow, ctx) {
  const job = workflow.jobs.find((j) => j.jobId === leg.jobId);
  const why = leg.why ?? null;
  const step = stepTaken(leg, workflow);
  const ageMs = job ? ctx.now - Number(job.updatedAt) : null;
  const waitingOnOwner = leg.status === 'awaiting_owner' || why?.owner === 'owner';
  const ownerAsk = (workflow.status?.awaitingOwner?.length ?? 0) > 0 || workflow.jobs.some((j) => j.status === 'awaiting_owner')
    || workflow.incidents.some((i) => i.owner === 'owner') || workflow.decisions.some((d) => d.decider === 'owner');
  const verdict = verdictOf({ cause: why?.headline ?? why?.cause ?? null, step, waitingOnOwner, ageMs, ownerAsk, dueMs: ctx.n.decisionDueMs });
  return { op: leg.op, jobId: leg.jobId, status: leg.status, tryNo: job?.tryNo ?? null, cause: why?.headline ?? why?.cause ?? null,
    handler: why?.owner ?? null, next: why?.next ?? null, codes: why?.codes ?? [], stepTaken: step.taken, stepBy: step.by, ageMs, verdict,
    reasonable: verdict === 'reasonable' || verdict === 'pending' };
}

function kernelSection(workflow, ctx) {
  const { kernelJob, kernelSignal, status, lastKernelWakeAt, seatProbe } = workflow;
  const rev = status?.kernelRev ?? null;
  const frontier = status?.frontier ?? {};
  // What waits on the Kernel is its menu; a status without one reads the frontier counts.
  const ready = Array.isArray(status?.menu) ? status.menu.length : (frontier.readyOperations ?? 0) + (frontier.nudgeReadyJobs?.length ?? 0) + (frontier.settleReadyJobs?.length ?? 0);
  const wakeAgeMs = lastKernelWakeAt ? ctx.now - Number(lastKernelWakeAt) : null;
  const probe = seatProbe?.action ?? null;
  const idle = frontier.state === 'idle' || /idle/.test(String(probe ?? ''));
  return { alive: kernelJob?.status === 'running' && Boolean(kernelSignal?.terminal) && !DEAD_PROBES.has(probe),
    job: kernelJob?.status ?? null, terminal: kernelSignal?.terminal ?? null, probe, lastWakeAgeMs: wakeAgeMs,
    revision: status?.revisionNotice?.line ?? null, ackedRev: rev?.acked ?? null, currentRev: rev?.current ?? null, revStale: rev?.stale === true, filesBehind: rev?.fileCount ?? 0,
    frontierState: frontier.state ?? null, readyWork: ready,
    idleWithReady: ready > 0 && idle && wakeAgeMs !== null && wakeAgeMs > ctx.n.kernelIdleWakeMs,
    overBudgetWakes: exceededWakes(workflow.kernelWakes ?? [], wakeBudget(), bootBudget()), seatCost: workflow.seatCost ?? null };
}

function kernelProblems(view, n) {
  const { kernel, name, id } = view;
  const out = [];
  if (!kernel.alive) out.push(problem('kernel', view.openWork + 1, `kernel-dead-${id}`, 'kernel-dead', { name, job: kernel.job ?? 'absent', probe: kernel.probe ?? 'none' }, kernel));
  if (kernel.revStale) out.push(problem('kernel', n.revDriftBlocks, `kernel-rev-${id}`, 'kernel-rev',
    { name, acked: String(kernel.ackedRev).slice(0, 9), current: String(kernel.currentRev).slice(0, 9), files: kernel.filesBehind }, kernel));
  if (kernel.idleWithReady) out.push(problem('kernel', kernel.readyWork, `kernel-idle-${id}`, 'kernel-idle', { name, ready: kernel.readyWork, min: minutes(kernel.lastWakeAgeMs) }, kernel));
  const empty = emptyWakeProblem(kernel.seatCost, `the Kernel of ${name}`, id);
  if (empty) out.push(empty);
  const worst = kernel.overBudgetWakes.at(-1);
  if (worst) out.push(problem('kernel', 1, `kernel-wake-budget-${id}`, 'kernel-wake-budget', { name, turns: worst.turns, tokens: worst.tokens, wakes: kernel.overBudgetWakes.length, budgetTurns: (worst.boot ? bootBudget() : wakeBudget()).turns, budgetTokens: (worst.boot ? bootBudget() : wakeBudget()).tokens }, kernel.overBudgetWakes));
  return out;
}

function stopProblems(view) {
  const out = [];
  const stuck = view.held.filter((h) => h.overdue).length + view.judgements.filter((j) => !j.reasonable).length;
  for (const h of view.held.filter((x) => x.overdue)) out.push(problem('hold', 1 + stuck, `hold-${h.jobId}`, 'hold-overdue',
    { op: h.op, jobId: h.jobId, hold: h.hold, min: minutes(h.overdueMs), handler: h.handler, next: h.step.next }, h));
  for (const h of view.held.filter((x) => !x.listed)) out.push(problem('hold', 1, `hold-unlisted-${h.jobId}`, 'hold-unlisted', { op: h.op, jobId: h.jobId, hold: h.hold }, h));
  for (const j of view.judgements.filter((x) => !x.reasonable)) out.push(problem('op', 1 + stuck, `op-${j.jobId ?? j.op}`, `op-${j.verdict}`,
    { op: j.op, status: j.status, min: j.ageMs === null ? 0 : minutes(j.ageMs), cause: String(j.cause ?? '').slice(0, 120) }, j));
  for (const r of view.running.filter((x) => x.pastDeadline)) out.push(problem('op', 1, `deadline-${r.jobId}`, 'job-past-deadline', { op: r.op, jobId: r.jobId, min: minutes(r.ageMs) }, r));
  return out;
}

function workflowView(workflow, ctx) {
  const jobs = jobsSection(workflow, ctx);
  const legs = (workflow.status?.legs ?? []).filter((l) => FAILED_LEG.has(l.status));
  const view = { id: workflow.id, name: workflow.name ?? workflow.id, ledger: workflow.ledger, repo: workflow.repo, phase: workflow.phase,
    statusError: workflow.statusError ?? null, kernel: kernelSection(workflow, ctx), ...jobs,
    judgements: legs.map((l) => legJudgement(l, workflow, ctx)), openWork: (workflow.status?.frontier?.openOperations ?? 0) + jobs.queuedCount,
    usage: (workflow.status?.usage?.byOp ?? []).map((o) => ({ op: o.opId, tokens: o.tokens, turns: o.turns, attempts: o.attempts, costUsd: o.costUsd }))
      .sort((a, b) => b.tokens - a.tokens),
    incidents: workflow.incidents, decisions: workflow.decisions };
  const failed = view.statusError === null ? [] : [problem('workflow', view.openWork + 1, `status-${view.id}`, 'status-unreadable', { name: view.name, error: view.statusError })];
  return { ...view, problems: [...kernelProblems(view, ctx.n), ...stopProblems(view), ...failed].map((p) => ({ ...p, workflowId: view.id })) };
}

/** A secret that survived redaction in a stored artifact is a departure of the runtime's redaction duty: one problem per artifact and rule, never the text. */
function secretProblems({ snapshot }) {
  const hits = new Map((snapshot.secrets?.hits ?? []).map((h) => [`${h.artifact}|${h.rule}`, h]));
  return [...hits.values()].slice(0, SECRET_PROBLEMS).map((h) => problem('runtime', 1, `secret-${h.artifact}-${h.rule}`, 'secret-survived', { artifact: h.artifact, rule: h.rule, kind: h.kind, count: h.count }, h));
}

/** The seat a reservation serves, named for a person: the Supervisor seat, the Kernel seat of a workflow, else the job or the seat id. */
function reservationOwner(r) {
  if (r.jobId) return r.jobId;
  if (r.kernelWorkflow) return `the Kernel seat of ${r.kernelWorkflow}`;
  if (r.role === 'supervisor') return 'the Supervisor seat';
  return r.seat ?? 'no job';
}

// A Kernel job between two incarnations is `ready`: its new seat's reservation is taken before the job is leased.
const KERNEL_SEAT_JOB = new Set([...LIVE_JOB, 'ready']);
const SUPERVISOR_SEAT_STATES = new Set(['live', 'booting']);

/**
 * Reservations live for a job that is not running, a Supervisor job that ended, or a seat that is gone. A seat's reservation (the Supervisor's, a
 * Kernel's) is not a job's: it is held while the seat it serves stands (the Supervisor seat live or booting, the workflow's Kernel job alive).
 */
function admissionSection({ snapshot }) {
  const running = new Map(snapshot.workflows.flatMap((w) => w.jobs.map((j) => [j.jobId, LIVE_JOB.has(j.status)])));
  const kernelSeats = new Map(snapshot.workflows.flatMap((w) => w.jobs.filter((j) => j.kind === 'kernel').map((j) => [j.jobId, KERNEL_SEAT_JOB.has(j.status)])));
  for (const j of snapshot.supJobs) running.set(j.jobId, LIVE_SUP_JOB.has(j.status));
  const seats = new Set(snapshot.seats);
  const supervisorStands = SUPERVISOR_SEAT_STATES.has(snapshot.supervisor?.seat?.state);
  const live = snapshot.reservations.filter((r) => r.releasedAt === null);
  const held = (r) => {
    if (r.jobId) return running.get(r.jobId) === true;
    if (r.kernelWorkflow) return kernelSeats.get(`kernel-${r.kernelWorkflow}`) === true || running.get(`kernel-${r.kernelWorkflow}`) === true;
    if (r.role === 'supervisor' && !r.seat) return supervisorStands;
    return Boolean(r.seat) && seats.has(r.seat);
  };
  return { live: live.length, leaked: live.filter((r) => !held(r)).map((r) => ({ ...r, ageMs: snapshot.now - Number(r.updatedAt) })) };
}

function admissionProblems(section) {
  return section.leaked.map((r) => problem('admission', 1, `reservation-${r.id}`, 'reservation-leak',
    { provider: r.provider, id: r.id.slice(0, 8), state: r.state, owner: reservationOwner(r), min: minutes(r.ageMs) }, r));
}

/** A snapshot workflow with the ledger rows the standard reads; a workflow collected without them has none. */
const withRows = (w) => ({ ...w, attempts: w.attempts ?? [], events: w.events ?? [] });

let loaded = null;
/** The declared documents the verdicts are judged by, read once: the operating standard and the debug questions. */
const declared = () => (loaded ??= { standard: loadStandard(), questions: loadQuestions() });

/** The digest of one snapshot: sections, the operating-standard answers, the verdict of every role, and the problems (departures only) ordered by how much work each blocks. */
export function analyze(snapshot, policy, n, docs = declared()) {
  const ctx = { snapshot, n, now: snapshot.now, index: policyIndex(policy) };
  const reconciler = reconcilerSection(ctx);
  const supervisor = supervisorSection(ctx);
  const workflows = snapshot.workflows.map((w) => workflowView(w, ctx));
  const admission = admissionSection(ctx);
  const legacy = [...reconcilerProblems(reconciler, n), ...supervisorProblems(supervisor, n), ...workflows.flatMap((w) => w.problems), ...admissionProblems(admission), ...secretProblems(ctx)];
  const views = workflows.map((view, i) => ({ ...view, source: withRows(snapshot.workflows[i]) }));
  const standard = judgeStandard(docs.standard, { now: snapshot.now, n, reconciler, supervisor, admission }, views);
  const verdicts = classifyAll({ n, defs: docs.standard, standard, views, registry: snapshot.registry ?? [], problems: legacy });
  const rows = roleRows({ bugs: verdicts.bugs, happy: verdicts.happy, views });
  const digest = { schema: 'starci/debug-digest@2', at: snapshot.now, ok: verdicts.bugs.length === 0, reconciler, supervisor, workflows, admission, releaseCi: snapshot.releaseCi ?? null, standard, roles: rows, problems: verdicts.bugs };
  const debug = { standing: standingOf(snapshot, n), questions: answerQuestions(docs.questions, { ...digest, bugs: verdicts.bugs }, snapshot, n) };
  return { ...digest, debug };
}
