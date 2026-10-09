// debug-questions.mjs — answers the questions of modules/reconciler/debug-questions.yaml that the stores can answer today, lists the
// ones that need a signal the runtime does not record yet, and works out the standing of the debug role against its end condition
// (modules/kernel/roles.yaml, the debug role). Pure over the analysed digest and the snapshot it came from.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { SIGNAL_CHECKS } from './debug-signal-checks.mjs';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'reconciler', 'debug-questions.yaml');

// A criterion of the end condition that is a ceiling: the count may not exceed `min`.
const AT_MOST = new Set(['no-open-edge-case']);

const ok = (evidence) => ({ state: 'ok', evidence });
const attention = (evidence) => ({ state: 'attention', evidence });
const unknown = (evidence) => ({ state: 'unknown', evidence });
const verdictOf = (bad, evidence, good = 'nothing departs') => (bad ? attention(evidence) : ok(good));

const hasBug = (d, codes) => d.bugs.filter((b) => codes.includes(b.code === 'departure' ? b.params.departure : b.code));
const stepsNamed = (d, id) => d.standard.workflows.flatMap((w) => w.steps.filter((s) => s.id === id).map((s) => ({ ...s, workflow: w.name })));
const sum = (list) => list.reduce((total, n) => total + n, 0);
const attemptsOf = (snapshot) => snapshot.workflows.flatMap((w) => (w.attempts ?? []).map((a) => ({ ...a, workflow: w.name })));
const eventsOf = (snapshot, kind) => snapshot.workflows.flatMap((w) => (w.events ?? []).filter((e) => e.kind === kind));

/** The host restarts the boot rows name: [{at, bootAt}] where the host booted again between two engine starts. */
function hostRestarts(engine, jitterMs) {
  const boots = [...(engine.boots ?? [])].reverse();
  return boots.filter((b, i) => i > 0 && Math.abs(Number(b.bootAt) - Number(boots[i - 1].bootAt)) > jitterMs).map((b) => ({ at: Number(b.at), bootAt: Number(b.bootAt) }));
}

function restartRecovered(d, snapshot, n) {
  const boots = snapshot.engine.boots ?? [];
  if (!boots.length) return unknown('no reconciler.boot row on record yet: the signal is written from this runtime on');
  const restarts = hostRestarts(snapshot.engine, n.bootJitterMs);
  const evidence = `${boots.length} engine start(s) on record, ${restarts.length} after a host restart; ${d.admission.leaked.length} reservation(s) leaked`;
  return verdictOf(d.admission.leaked.length > 0, evidence, evidence);
}

function doneOnEvidence(d) {
  const items = stepsNamed(d, 'settle-evidence').flatMap((s) => s.items ?? []);
  const outside = items.filter((i) => i.state === 'overdue');
  const proven = items.filter((i) => i.state === 'done');
  if (!items.length) return unknown('no pass settled in the running workflows');
  const text = `${proven.length} pass(es) proven, ${outside.length} ran the checks outside the attempt tree, ${items.length - proven.length - outside.length} settled before the signal existed (unproven)`;
  return verdictOf(outside.length > 0, text, text);
}

function claimVsRerun(d, snapshot) {
  const mismatched = attemptsOf(snapshot).filter((a) => a.claimMismatch > 0);
  const passed = mismatched.filter((a) => a.verdict === 'pass');
  const text = `${mismatched.length} attempt(s) claimed a check result the re-run contradicted; ${passed.length} of them passed`;
  return verdictOf(passed.length > 0, text, text);
}

function tokenBurn(d) {
  const usage = d.workflows.flatMap((w) => w.usage);
  if (!usage.length) return unknown('no usage row');
  const top = usage[0];
  return ok(`${sum(usage.map((u) => u.tokens))} tokens over ${usage.length} op(s); largest ${top.op} with ${top.tokens} in ${top.turns} turn(s)`);
}

function queueLength(d) {
  const held = d.workflows.flatMap((w) => w.held);
  const kinds = [...new Set(held.map((h) => h.hold))];
  const named = kinds.length ? `: ${kinds.join(', ')}` : '';
  return ok(`${held.length} held job(s)${named}`);
}

function placementExists(d, snapshot) {
  const lost = attemptsOf(snapshot).filter((a) => a.treeExists === false);
  const names = lost.map((a) => `${a.op}#${a.attemptId}`).join(', ');
  return verdictOf(lost.length > 0, `${lost.length} unsettled attempt(s) name a tree that is not on disk: ${names}`, 'every unsettled attempt names a tree on disk');
}

function interventions(d, snapshot) {
  const live = eventsOf(snapshot, 'ledger-written-outside-seat').length;
  const past = sum((snapshot.history ?? []).map((h) => h.interventions));
  return verdictOf(live + past > 0, `${live + past} ledger write(s) by a person outside a seat`, 'no ledger write by a person on record');
}

function capacityHolds(d) {
  const kinds = new Set(['pool-full', 'path-lease', 'foundation-wait', 'host-resources-low', 'max-ops', 'circuit-open']);
  const held = d.workflows.flatMap((w) => w.held).filter((h) => kinds.has(h.hold));
  const overdue = held.filter((h) => h.overdue);
  return verdictOf(overdue.length > 0, `${overdue.length} capacity hold(s) past their bound`, `${held.length} capacity hold(s), all inside their bound`);
}

function openEdgeCases(d, snapshot) {
  const open = (snapshot.registry ?? []).filter((c) => c.status === 'open');
  return verdictOf(open.length > 0, `${open.length} open: ${open.map((c) => c.id).join(', ')}`, 'no edge case is open');
}

const REFUSED_RUNTIME_CHANGE = 'RUNTIME_CHANGE_OWNED_BY_DEBUG';

function runtimeChangeRefused(d, snapshot) {
  const hits = (snapshot.refusals ?? []).filter((r) => r.code === REFUSED_RUNTIME_CHANGE);
  const roles = [...new Set(hits.map((r) => r.role ?? 'unknown'))].join(', ');
  return ok(hits.length ? `${hits.length} runtime change(s) asked by ${roles} and refused by the guard` : 'no runtime change was asked of the guard');
}

function gateLooseningLands(d, snapshot) {
  const lands = snapshot.lands ?? [];
  const unapprovedLanded = lands.filter((l) => l.result === 'passed' && !l.approved);
  const text = `${lands.length} land(s) loosened a gate: ${lands.filter((l) => l.approved).length} approved by the owner, ${lands.filter((l) => !l.approved && l.result !== 'passed').length} refused`;
  return verdictOf(unapprovedLanded.length > 0, `${unapprovedLanded.length} land(s) loosened a gate without the owner's approval (${unapprovedLanded.map((l) => l.runId).join(', ')})`, text);
}

/** One line per runtime Critic run: who judged, the model, the time, the tokens (unmeasured when the run recorded none) and the verdict or the hold. */
function runtimeRunLine(r) {
  let verdict = 'hold ' + (r.code ?? '');
  if (r.runOutcome === 'verdict') verdict = r.runPass ? 'pass' : 'fail';
  return `${r.entityId} ${r.criticProvider ?? '?'}/${r.criticModel ?? '?'} ${r.durationMs ?? '?'}ms tokens ${r.tokens ?? 'unmeasured'} ${verdict.trim()} (try ${r.runTry ?? 1})`;
}

function criticIndependent(d, snapshot) {
  const runs = [...eventsOf(snapshot, 'critic-run'), ...eventsOf(snapshot, 'runtime-critic-run')];
  if (!runs.length) return unknown('no critic-run or runtime-critic-run event on record yet: the events are written when a draw pass settles and when the settler runs the Critic of a decision leg');
  const shared = runs.filter((r) => r.criticProvider && r.opProvider && !r.independent);
  const unknownMaker = runs.filter((r) => !r.criticProvider || !r.opProvider);
  const own = eventsOf(snapshot, 'runtime-critic-run').map(runtimeRunLine);
  const ownText = own.length ? '; runtime runs: ' + own.join('; ') : '';
  const text = `${runs.length} Critic run(s), ${runs.length - shared.length - unknownMaker.length} on another provider than the op, ${unknownMaker.length} with a provider not recorded${ownText}`;
  return verdictOf(shared.length > 0, `${shared.length} Critic run(s) on the op's own provider; ${text}`, text);
}

/** The Kernel wakes that no turn of the agent followed: older than the grace, not followed by another wake inside wakeActMs. */
function ignoredWakes(wakes, now, n) {
  return wakes.filter((wake, index) => wake.turns === 0 && now - wake.at > n.wakeGraceMs && !(wakes[index + 1] && wakes[index + 1].at - wake.at < n.wakeActMs));
}

function wakeActed(d, snapshot, n) {
  const measured = snapshot.workflows.filter((w) => (w.kernelWakes ?? []).some((wake) => wake.turns > 0));
  if (!measured.length) return unknown('no Kernel wake has measured turns yet: the usage rows tag each wake from this runtime on');
  const ignored = measured.flatMap((w) => ignoredWakes(w.kernelWakes, snapshot.now, n).map((wake) => ({ workflow: w.name, ...wake })));
  const total = sum(measured.map((w) => w.kernelWakes.length));
  return verdictOf(ignored.length > 0, `${ignored.length} of ${total} wake(s) were followed by no turn of the agent: ${ignored.map((w) => w.workflow).join(', ')}`, `${total} wake(s), each followed by a turn of the agent`);
}

/** The finished workflows that ran clean, newest last: no person's write, no runtime-defect incident, no failed Kernel launch. */
const cleanFinished = (history) => (history ?? []).filter((h) => h.interventions === 0 && h.runtimeDefects === 0 && h.startFailures === 0);

/** The number of consecutive most recent finished workflows that ran clean. */
export function cleanRun(history) {
  let run = 0;
  for (const h of [...(history ?? [])].reverse()) {
    if (h.interventions + h.runtimeDefects + h.startFailures > 0) break;
    run += 1;
  }
  return run;
}

function cleanRunCheck(d, snapshot) {
  const total = (snapshot.history ?? []).length;
  if (!total) return unknown('no finished workflow on record');
  return ok(`${cleanRun(snapshot.history)} consecutive clean of ${total} finished workflow(s)`);
}

const byStep = (id, text) => (d) => {
  const bad = stepsNamed(d, id).filter((s) => s.state === 'overdue');
  const named = bad.map((s) => `${s.workflow}: ${s.evidence}`).join('; ');
  return verdictOf(bad.length > 0, `${bad.length} workflow(s): ${named}`, text);
};
const byCodes = (codes, text) => (d) => {
  const found = hasBug(d, codes);
  return verdictOf(found.length > 0, `${found.length} departure(s): ${found.map((b) => b.key).join(', ')}`, text);
};

const CHECKS = Object.freeze({
  'engine-leads': (d) => verdictOf(d.standard.host.find((s) => s.id === 'host-ready')?.state === 'overdue', d.standard.host.find((s) => s.id === 'host-ready')?.evidence ?? '', 'the reconciler leads in its configured modes'),
  'seats-live': (d) => verdictOf(d.standard.host.find((s) => s.id === 'supervisor-seat-live')?.state === 'overdue' || d.workflows.some((w) => !w.kernel.alive && w.problems.length > 0),
    'a seat is not live', 'the Supervisor and every Kernel seat are live'),
  'restart-recovered': restartRecovered,
  'ledgers-readable': (d) => verdictOf(d.workflows.some((w) => w.statusError !== null), 'a ledger or its status could not be read', 'every ledger and status reads'),
  'engine-rev': (d) => verdictOf(d.reconciler.leader?.revDrift === true, 'the engine runs an older revision than the live tree', 'the engine runs the live revision'),
  'kernel-rev': byStep('kernel-acked-rev', 'every Kernel acked the current revision inside its bound'),
  'hold-steps': byCodes(['hold-overdue', 'hold-unlisted', 'op-no-cause', 'op-step-missing', 'op-owner-without-ask', 'attempt-no-cause'], 'every stop has its policy next step inside the bound'),
  'stale-decisions': byCodes(['gate-stale', 'decision-overdue'], 'no gate or Decision Item is past due'),
  'retry-loops': byCodes(['kernel-start-loop', 'dispatch-loop'], 'no launch repeats the same failure'),
  'queue-failing': byCodes(['queue-failing'], 'no reconciler queue key keeps failing'),
  'op-deadline': byCodes(['job-past-deadline'], 'no op runs past its deadline'),
  'done-on-evidence': doneOnEvidence,
  'claim-vs-rerun': claimVsRerun,
  'ready-dispatched': byCodes(['kernel-idle'], 'no ready leg waits behind an idle Kernel'),
  'token-burn': tokenBurn,
  'queue-length': queueLength,
  'reservations-backed': byCodes(['reservation-leak'], 'every live reservation is backed by running work'),
  'placement-exists': placementExists,
  'op-refusals': (d, snapshot) => ok(`${eventsOf(snapshot, 'op-caller-refused').length} refusal(s) of an op that addressed beyond its Kernel`),
  interventions,
  'capacity-holds': capacityHolds,
  handover: byStep('handover', 'every approved handover ends in a finished workflow'),
  'resources-released': (d) => verdictOf(d.standard.host.find((s) => s.id === 'resources-released')?.state === 'overdue', d.standard.host.find((s) => s.id === 'resources-released')?.evidence ?? '', 'no reservation outlives its work'),
  'open-edge-cases': openEdgeCases,
  'clean-run': cleanRunCheck,
  'runtime-change-refused': runtimeChangeRefused,
  'gate-loosening-lands': gateLooseningLands,
  'critic-independent': criticIndependent,
  'wake-acted': wakeActed,
  ...SIGNAL_CHECKS,
});

/** The declared questions with the checks resolved; a question answerable today whose check does not exist is refused. */
export function loadQuestions(file = FILE) {
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  for (const q of doc.groups.flatMap((g) => g.questions)) {
    if (q.answerable === 'today' && !CHECKS[q.check]) throw new Error(`debug-questions.yaml ${q.id} names the check ${q.check}, which does not exist`);
    if (q.answerable === 'gap' && !q.signal) throw new Error(`debug-questions.yaml ${q.id} is a gap and names no signal`);
  }
  return doc.groups;
}

/** Every question with its answer: a check's {state, evidence} for a question answerable today, `gap` and its signal for the rest. */
export function answerQuestions(groups, d, snapshot, n) {
  return groups.map((g) => ({ id: g.id, title: g.title, questions: g.questions.map((q) => {
    const base = { id: q.id, ask: q.ask, answerable: q.answerable, ...(q.signalAdded ? { signalAdded: q.signalAdded } : {}) };
    return q.answerable === 'today' ? { ...base, ...CHECKS[q.check](d, snapshot, n) } : { ...base, state: 'gap', signal: q.signal, why: q.why };
  }) }));
}

/** The workflows that finished across a host restart, clean. */
function survivedRestarts(snapshot, n) {
  const restarts = hostRestarts(snapshot.engine, n.bootJitterMs);
  return cleanFinished(snapshot.history).filter((h) => restarts.some((r) => r.at > h.createdAt && r.at < h.finishedAt)).length;
}

/** The debug role's standing against each criterion of its end condition. */
export function standingOf(snapshot, n) {
  const have = { 'clean-workflows': cleanRun(snapshot.history), 'no-open-edge-case': (snapshot.registry ?? []).filter((c) => c.status === 'open').length,
    'survived-restart': survivedRestarts(snapshot, n) };
  const criteria = (snapshot.criteria ?? []).map((c) => {
    const count = have[c.id] ?? null;
    const atMost = AT_MOST.has(c.id);
    return { id: c.id, min: c.min, atMost, have: count, rule: c.rule, holds: count !== null && (atMost ? count <= c.min : count >= c.min) };
  });
  return { criteria, met: criteria.length > 0 && criteria.every((c) => c.holds) };
}
