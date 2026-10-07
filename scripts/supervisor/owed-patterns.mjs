// owed-patterns.mjs - the OWED patterns that have no incident (scripts/supervisor/owed.mjs patternFindings). One probe per
// systemic failure: it reads one workflow of a ledger and reports each finding through `cx.put`. A probe whose data is
// absent or malformed throws; the caller treats that as no finding. `cx` is {db, wf, now, root, repo, staleOf, put, ownerClass}.
import fs from 'node:fs';
import path from 'node:path';
import { retryDisposition } from '../../engine/admission.mjs';
import { staleOperationsOf } from '../kernel/input-digests.mjs';
import { ownerGates, openAskDispatches, heldBy } from './stall.mjs';
import { guardReceiptErrors } from '../guards/hook-install.mjs';
import { clipLine } from '../lib/clip.mjs';
import { parseJsonOr, withPayload } from '../lib/json.mjs';
import { shortHash } from '../lib/hash.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const RETRY_LOOP_MIN = 4;
const REROUTE_MIN = 4;
const WORKER_DIED_WINDOW_MS = 6 * 60 * 60_000;
const REJECT_WINDOW_MS = 2 * 60 * 60_000;
// A reserve refusal whose every reason is a path lease another job holds (the overlap itself, or the
// capacity-1 path row it fills) is a wait, not a launcher failure; repeat-reject never counts it.
const LEASE_OVERLAP_REASON = /^resource path:.+? (?:overlaps durable lease path:.+ held by \S+|capacity \d+ has \d+ used and needs \d+)$/;
export const isLeaseOverlapRefusal = (payload) => {
  if (payload?.step !== 'reserve') return false;
  const reasons = String(payload.error ?? '').split('; ').map((r) => r.trim()).filter(Boolean);
  return reasons.some((r) => /overlaps durable lease/.test(r)) && reasons.every((r) => LEASE_OVERLAP_REASON.test(r));
};
/** A failed retry chain older than this is history, not a pattern. */
const CHAIN_WINDOW_MS = 24 * 60 * 60_000;
const OPEN_JOB = new Set(['queued', 'leased', 'running', 'answering']);

const parse = parseJsonOr;
const hash = (s) => shortHash(s, { algo: 'sha1', n: 8 });
const stalePathOf = (p, root, repo) => {
  if (path.isAbsolute(p)) return p;
  if (p.startsWith('.starciwork/') && repo) return path.join(repo, p);
  return path.join(root, p);
};
const ownedPaths = (payload) => (Array.isArray(payload?.owned_paths) ? payload.owned_paths : []).map(String);
const pathsKey = (payload) => JSON.stringify([...ownedPaths(payload)].sort(byCodeUnit));
const TRAILING_SLASHES = new RegExp(['/', '+', '$'].join(''));
const bare = (p) => p.replaceAll('\\', '/').replace(/(?:\/\*{1,2})+$/, '').replace(TRAILING_SLASHES, '');
// Every owned path of `tail` lies under (or is) a path some job in `jobs` owns: a cut set that re-sliced it.
const pathsCovered = (tail, jobs) => {
  const want = ownedPaths(tail.payload).map(bare);
  const have = jobs.flatMap((j) => ownedPaths(j.payload).map(bare)).filter(Boolean);
  return want.length > 0 && want.every((p) => have.some((q) => p === q || p.startsWith(`${q}/`)));
};

/** When the newest failure of jobs settled: its op-settled event, else the failed row's updated_at; null with none. */
const lastFailureOf = (db, wf, jobs) => {
  let at = null;
  for (const j of jobs.filter((x) => x.status === 'failed')) {
    let settled = null;
    try { settled = db.prepare("SELECT MAX(created_at) at FROM events WHERE workflow_id=? AND entity_id=? AND kind='op-settled'").get(wf, j.job_id)?.at ?? null; } catch { settled = null; }
    at = Math.max(at ?? 0, settled ?? j.updated_at ?? 0);
  }
  return at;
};

/** Open owner asks of one workflow by the job that filed them: Map<jobId, dispatchId>. */
function openAskJobs(db, wf) {
  const out = new Map();
  try {
    for (const a of openAskDispatches(db, wf)) {
      const r = db.prepare('SELECT job_id FROM reports WHERE workflow_id=? AND dispatch_id=?').get(wf, a.dispatch_id);
      if (r) out.set(r.job_id, a.dispatch_id);
    }
  } catch { /* no reports */ }
  return out;
}

const jobOfId = (db, byId, id) => {
  const known = byId.get(id);
  if (known) return known;
  try { return withPayload(db.prepare('SELECT job_id, op_id, status, payload_json FROM jobs WHERE job_id=?').get(id)); } catch { return null; }
};

/**
 * What holds a lineage's newest job for the OWNER, or null: an open owner gate holding it (by job or
 * op), or an open owner ask filed by it or by a job its --after chain reaches (or a gate holding one of
 * those). Only a job still waiting to run counts (queued, or answering its own ask).
 */
function ownerHoldOf(db, wf, tail, { byId = new Map(), gates = null, askJobs = null } = {}) {
  if (!tail || !['queued', 'answering'].includes(tail.status)) return null;
  const openGates = gates ?? ownerGates(db, wf);
  const asks = askJobs ?? openAskJobs(db, wf);
  const seen = new Set();
  for (let queue = [tail]; queue.length;) {
    const j = queue.shift();
    if (!j || seen.has(j.job_id)) continue;
    seen.add(j.job_id);
    if (asks.has(j.job_id)) return { kind: 'owner-ask', jobId: tail.job_id, via: j.job_id, dispatchId: asks.get(j.job_id) };
    const gate = openGates.find((g) => heldBy(g, j));
    if (gate) return { kind: 'owner-gate', jobId: tail.job_id, via: j.job_id, incidentId: gate.incidentId };
    for (const id of Array.isArray(j.payload?.after) ? j.payload.after : []) queue.push(jobOfId(db, byId, id));
  }
  return null;
}

/* ------------------------------------------------------------ retry chains */

const chainJobs = (db, wf) => db.prepare(`SELECT job_id, op_id, try_no AS attempt, status, payload_json,
        (SELECT settle_json FROM op_attempts a WHERE a.job_id=jobs.job_id ORDER BY attempt_id DESC LIMIT 1) AS result_json,
        created_at, updated_at FROM jobs WHERE workflow_id=? AND kind='op' ORDER BY created_at, job_id`).all(wf)
  .map((j) => withPayload(j));

// An attempt settled peer-blocked (starci kernel settle: every red check was a peer's change) is not a failure of the chain,
// nor one whose settle spent no business retry (engine/admission.mjs retryDisposition: a host terminal wipe's
// retryClass environment, a proven no-effect launch, an owner answer).
// Nor one nobody ever tried to run: settled with no dispatch and no dispatch reject (a stranded --after chain
// the Kernel settled blocked; a launcher that kept refusing is repeat-reject's, and still counts here).
const notAFailureOf = (db, wf, jobs) => {
  const notAFailure = new Set(jobs.filter((j) => j.status === 'failed' && (parse(j.result_json)?.peerBlocked || !retryDisposition(j).consumesBusinessRetry)).map((j) => j.job_id));
  const dispatched = new Set(db.prepare("SELECT DISTINCT entity_id FROM events WHERE workflow_id=? AND kind IN ('op-dispatched','dispatch-rejected')").all(wf).map((r) => r.entity_id));
  for (const r of db.prepare("SELECT DISTINCT entity_id FROM events WHERE workflow_id=? AND kind='op-settled'").all(wf)) if (!dispatched.has(r.entity_id)) notAFailure.add(r.entity_id);
  return notAFailure;
};

const failedChecksOf = (db, wf) => {
  const checks = new Map();
  for (const c of db.prepare(`SELECT c.job_id,c.name,c.exit_code,c.status,c.attribution_json
        FROM check_runs c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE c.workflow_id=?`).all(wf)) {
    const key = c.job_id;
    if (!checks.has(key)) checks.set(key, { checks: [] });
    checks.get(key).checks.push({ name: c.name, exitCode: c.exit_code ?? (c.status === 'fail' ? 1 : null), peerBlocked: parse(c.attribution_json)?.peerBlocked ?? false });
  }
  return checks;
};

/** A chain whose tail is finished work or was taken over: history, not a pattern. */
const chainIsHistory = (tail, jobs, now) => {
  if (tail.status === 'succeeded' || tail.status === 'cancelled') return true;
  if (OPEN_JOB.has(tail.status)) return false;
  if (now - tail.updated_at > CHAIN_WINDOW_MS) return true;
  // A later job of the same op over the same paths took the work over: this chain is history.
  const later = jobs.filter((j) => j.op_id === tail.op_id && j.created_at > tail.created_at);
  if (later.some((j) => pathsKey(j.payload) === pathsKey(tail.payload))) return true;
  // The Kernel re-cut it into a cut set whose settled successes together cover every owned path: history too.
  return pathsCovered(tail, later.filter((j) => j.status === 'succeeded'));
};

/** The failure streak of a chain, oldest first: the attempts since its last success that actually failed or ran. */
const streakOf = (tail, byId, askReports, notAFailure) => {
  const streak = [];
  for (let j = tail, guard = 0; j && j.status !== 'succeeded' && guard < 200; j = byId.get(j.payload?.retry?.retryOf), guard++) {
    if (j.status !== 'cancelled' && !askReports.has(j.job_id) && !notAFailure.has(j.job_id)) streak.unshift(j);
  }
  return streak;
};

const addLoop = (loops, streak, failed, tail) => {
  if (failed.length >= RETRY_LOOP_MIN - 1 && streak.length >= RETRY_LOOP_MIN) {
    const id = streak[0].job_id;
    const loop = loops.get(id) ?? { streak, tails: [] };
    loop.tails.push(tail);
    if (streak.length > loop.streak.length) loop.streak = streak;
    loops.set(id, loop);
  }
};

const isIgnoredCheck = (c) => {
  const code = c?.exitCode;
  return code === 0 || code === null || code === undefined || !c?.name || c.peerBlocked;
};

const addRepeats = (repeats, checks, streak, failed, tail) => {
  for (const j of failed) {
    for (const c of checks.get(j.job_id)?.checks ?? []) {
      if (isIgnoredCheck(c)) continue;
      const id = `${streak[0].job_id}:${c.name}`;
      const r = repeats.get(id) ?? { name: c.name, op: tail.op_id, jobs: new Map(), tails: new Set(), tailJobs: new Map(), lineage: new Map() };
      r.jobs.set(j.job_id, j); r.tails.add(`${tail.job_id} ${tail.status}`); r.tailJobs.set(tail.job_id, tail);
      for (const x of streak) r.lineage.set(x.job_id, x);
      repeats.set(id, r);
    }
  }
};

// The newest job of a lineage decides whether it waits on the owner (ownerHoldOf).
const waitingOnOwner = ({ db, wf, ownerClass }, tails, owner) => {
  const newest = [...tails].sort((a, b) => b.created_at - a.created_at || String(b.job_id).localeCompare(String(a.job_id)))[0];
  const hold = ownerHoldOf(db, wf, newest, owner);
  if (!hold) return {};
  const ownerItem = hold.kind === 'owner-gate' ? 'owner gate ' + hold.incidentId : 'owner ask ' + hold.dispatchId;
  const via = hold.via !== hold.jobId ? ' (via ' + hold.via + ')' : '';
  return { class: ownerClass, reason: 'waiting on the owner: newest job ' + hold.jobId + ' is ' + newest.status + ' behind ' + ownerItem + via, ownerHold: hold };
};

const reportLoop = (cx, id, { streak, tails }, owner) => {
  const { db, wf, put } = cx;
  put(wf, 'retry-loop', id, streak[0].created_at, `${streak[0].op_id}: ${streak.filter((j) => j.status === 'failed').length} failed attempt(s) in a row since the last success (${streak.map((j) => 'a' + j.attempt + ' ' + j.status).join(', ')}); now ${tails.map((t) => t.job_id + ' ' + t.status).join(', ')}`,
    { jobs: streak.map((j) => j.job_id), lastFailureAt: lastFailureOf(db, wf, streak), ...waitingOnOwner(cx, tails, owner) });
};

const reportRepeat = (cx, id, r, owner) => {
  const { db, wf, put } = cx;
  const list = [...r.jobs.values()].sort((a, b) => a.attempt - b.attempt);
  if (list.length < 2) return;
  put(wf, 'repeat-check', id, list[0].updated_at, `check ${r.name} failed on ${list.length} attempts of ${r.op} (${list.map((j) => 'a' + j.attempt).join(', ')}); now ${[...r.tails].join(', ')}`,
    { jobs: list.map((j) => j.job_id), lastFailureAt: lastFailureOf(db, wf, [...r.lineage.values()]), ...waitingOnOwner(cx, r.tailJobs.values(), owner) });
};

/** Retry chains (payload.retry.retryOf): a chain whose tail is still unfinished work. */
export function retryChainFindings(cx) {
  const { db, wf, now } = cx;
  const jobs = chainJobs(db, wf);
  const notAFailure = notAFailureOf(db, wf, jobs);
  const byId = new Map(jobs.map((j) => [j.job_id, j]));
  const retried = new Set(jobs.map((j) => j.payload?.retry?.retryOf).filter(Boolean));
  const checks = failedChecksOf(db, wf);
  // An attempt that filed an ask waited on the owner; it is not a failure of the chain.
  const askReports = new Set(db.prepare("SELECT job_id FROM reports WHERE workflow_id=? AND outcome='ask'").all(wf).map((r) => r.job_id));
  // Chains branch (one job retried by several successors) and pass through successes (a redo of
  // settled work): what counts is the failure streak since the chain's last success, reported
  // once per streak however many tails share it.
  const loops = new Map(), repeats = new Map();
  const owner = { byId, gates: ownerGates(db, wf), askJobs: openAskJobs(db, wf) };
  for (const tail of jobs.filter((j) => !retried.has(j.job_id))) {
    if (chainIsHistory(tail, jobs, now)) continue;
    const streak = streakOf(tail, byId, askReports, notAFailure);
    const failed = streak.filter((j) => j.status === 'failed');
    addLoop(loops, streak, failed, tail);
    addRepeats(repeats, checks, streak, failed, tail);
  }
  for (const [id, loop] of loops) reportLoop(cx, id, loop, owner);
  for (const [id, r] of repeats) reportRepeat(cx, id, r, owner);
}

/* ------------------------------------------------------------ events */

/** Workers that died without a report, per provider, inside the window. */
export function workerDiedFindings({ db, wf, now, put }) {
  const died = db.prepare(`SELECT entity_id job, created_at FROM events WHERE workflow_id=? AND created_at>? AND (
          kind='dead-worker-fenced' OR (kind='op-settled' AND json_extract(payload_json,'$.reportFiled')=0))`).all(wf, now - WORKER_DIED_WINDOW_MS);
  const byModel = new Map();
  for (const d of died) {
    const disp = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='op-dispatched' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(wf, d.job);
    const model = parse(disp?.payload_json).model ?? 'unknown';
    if (!byModel.has(model)) byModel.set(model, new Map());
    const m = byModel.get(model);
    if (!m.has(d.job)) m.set(d.job, d.created_at);
  }
  for (const [model, m] of byModel) {
    if (m.size < 2) continue;
    put(wf, 'worker-died', `${wf}:${model}`, Math.min(...m.values()), `${m.size} ${model} worker(s) ended without a report in the last ${WORKER_DIED_WINDOW_MS / 3_600_000} h: ${[...m.keys()].join(', ')}`, { jobs: [...m.keys()], lastFailureAt: Math.max(...m.values()) });
  }
}

const rejectGroupsOf = (rejects) => {
  const groups = new Map();
  for (const r of rejects) {
    const p = parse(r.payload_json);
    // A write set another job's lease still owns is a wait, not a launcher failure: starci kernel dispatch
    // leaves such a job queued path-lease, and refusals recorded before that do not
    // count either. Real launcher/host failures (any other reserve reason) still do.
    if (isLeaseOverlapRefusal(p)) continue;
    const step = p.step ?? '?', error = clipLine(p.error || p.signal || '', 80);
    const sig = `${step}\0${error}`;
    if (!groups.has(sig)) groups.set(sig, { step, error, at: r.created_at, last: r.created_at, jobs: [], providers: new Set() });
    const g = groups.get(sig); g.jobs.push(r.job); g.providers.add(p.provider ?? p.model ?? '?'); g.last = Math.max(g.last, r.created_at);
  }
  return groups;
};

/** Identical dispatch rejects inside the window. */
export function repeatRejectFindings({ db, wf, now, put }) {
  const rejects = db.prepare("SELECT entity_id job, payload_json, created_at FROM events WHERE workflow_id=? AND kind='dispatch-rejected' AND created_at>? ORDER BY seq").all(wf, now - REJECT_WINDOW_MS);
  for (const [sig, g] of rejectGroupsOf(rejects)) {
    if (g.jobs.length < 2) continue;
    put(wf, 'repeat-reject', `${wf}:${hash(sig)}`, g.at, `${g.jobs.length} dispatch rejects at step ${g.step} (${[...g.providers].join(', ')})${g.error ? ': ' + g.error : ''}`, { jobs: [...new Set(g.jobs)], lastFailureAt: g.last });
  }
}

/** Dispatches whose guard receipt says a layer did not install: the worker ran without it. */
export function guardFailedFindings({ db, wf, now, put }) {
  const unguarded = db.prepare("SELECT entity_id job, json_extract(payload_json,'$.guard') guard, created_at FROM events WHERE workflow_id=? AND kind='op-dispatched' AND created_at>? ORDER BY seq")
    .all(wf, now - WORKER_DIED_WINDOW_MS).map((r) => ({ ...r, errors: guardReceiptErrors(parse(r.guard, null)) })).filter((r) => r.errors.length);
  if (!unguarded.length) return;
  const layers = [...new Set(unguarded.flatMap((r) => r.errors))];
  put(wf, 'guard-failed', wf, unguarded[0].created_at, `${unguarded.length} dispatch(es) launched without their full guard: ${layers.join('; ')} (${[...new Set(unguarded.map((r) => r.job))].join(', ')})`,
    { jobs: [...new Set(unguarded.map((r) => r.job))], lastFailureAt: unguarded.at(-1).created_at });
}

/** A queued job routed again and again without dispatch. */
export function rerouteLoopFindings({ db, wf, put }) {
  for (const r of db.prepare(`SELECT e.entity_id job, COUNT(*) n, MIN(e.created_at) since, MAX(e.created_at) last FROM events e JOIN jobs j ON j.job_id=e.entity_id
          WHERE e.workflow_id=? AND e.kind='route-decided' AND j.status='queued' GROUP BY e.entity_id HAVING n>=?`).all(wf, REROUTE_MIN)) {
    put(wf, 'reroute-loop', r.job, r.since, `queued job ${r.job} routed ${r.n} times without a dispatch`, { jobs: [r.job], lastFailureAt: r.last });
  }
}

/**
 * Settled work that really owes work (starci kernel status staleOperations): an owner-declared breaking change or an
 * unattributed edit of an owned record. A peer's rewrite of a shared record is advisory peerDrift and never
 * counts (work-ownership.mjs).
 */
export function staleInputFindings({ db, wf, now, root, repo, staleOf, put }) {
  const ops = staleOperationsOf(staleOf(db, wf, { root, repo }));
  if (!ops.length) return;
  const mtimeOf = (p) => { try { return fs.statSync(stalePathOf(p, root, repo)).mtimeMs; } catch { return now; } };
  const paths = [...new Set(ops.flatMap((o) => o.paths))];
  const since = Math.min(...paths.map(mtimeOf));
  const source = paths.some((p) => !p.startsWith('.starciwork/'));
  const followUps = ops.filter((o) => o.followUp).length;
  put(wf, 'stale-input', wf, since, `${ops.length} settled job(s) owe work for changed input(s) ${clipLine(paths.join(', '), 120)}${followUps ? ' (' + followUps + ' owner-declared breaking follow-up(s))' : ''} (e.g. ${ops.slice(0, 3).map((o) => o.jobId).join(', ')})`,
    { jobs: ops.map((o) => o.jobId), paths, labels: [source ? 'knowledge-churn' : 'cross-workflow'] });
}
