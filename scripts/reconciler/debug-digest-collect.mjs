// debug-digest-collect.mjs — gathers the snapshot `starci debug digest` analyses. Every read is read only: the machine store and
// each ledger are opened through their readers, and the children are the existing read verbs (`kernel status`, the Kernel
// watchdog probe without --repair, the Supervisor seat status), each with a timeout. A failing read becomes a field of the snapshot.
import path from 'node:path';
import { ciLine, latestCiRecord } from '../supervisor/release-ci-status.mjs';
import { fileURLToPath } from 'node:url';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { runtimeShaOf } from '../machine/contract-version.mjs';
import { child, firstJson } from './core-watch.mjs';
import { machineFacts, refusalFacts } from './debug-digest-machine.mjs';
import { attemptFacts, eventFacts, historyFacts } from './debug-digest-ledger.mjs';
import { registryFacts, endCriteria } from './debug-docs.mjs';
import { wakeUsageOf } from '../kernel/wake-budget.mjs';
import { kernelSeatOf } from './seat-cost.mjs';
import { digestNumbers } from './debug-digest-numbers.mjs';
import { mergeScans, scanBlobs } from './debug-secret-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPEN_PHASES = new Set(['queued', 'running']);

const jobOf = (r) => ({ jobId: r.job_id, kind: r.kind, opId: r.op_id, status: r.status, tryNo: r.try_no, retryOf: r.retry_of ?? null,
  workerId: r.worker_id, deadline: r.deadline ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  // The dispatch refusal the push remembered on the job (scripts/kernel/dispatch-refusal-memo.mjs): the cause that keeps a ready job from launching.
  refusal: parseJsonOr(r.payload_json, {})?.dispatchRefusal ?? null });
const incidentOf = (r, holds = []) => ({ id: r.incident_id, kind: r.kind, owner: r.owner, dueAt: r.due_at ?? null, jobId: r.job_id, opId: r.op_id, status: r.status, detail: r.detail, holds });
/** The job ids (or op ids) a gate incident holds, from its raising event: a gate names the jobs it holds there and carries no job_id of its own. */
const heldBy = (db, row) => {
  const raised = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq LIMIT 1").get(row.workflow_id, row.incident_id);
  const holds = parseJsonOr(raised?.payload_json, null)?.holds;
  return Array.isArray(holds) ? holds.filter((hold) => typeof hold === 'string') : [];
};
const decisionOf = (r) => ({ id: r.di_id, kind: r.kind, decider: r.decider, status: r.status, dueAt: r.due_at ?? null, openedAt: r.opened_at, jobId: r.job_id, summary: r.summary });

/** The ledger rows of one repository: its workflows, and per workflow its jobs, open incidents, open Decision Items and Kernel facts. */
/** The newest failed Kernel launch of a workflow ({at, step, reason, error}), or null: why a dead Kernel is not being restarted. */
function lastStartFailureOf(db, workflowId) {
  const row = db.prepare("SELECT created_at, payload_json FROM events WHERE workflow_id=? AND kind='kernel-start-failed' ORDER BY seq DESC LIMIT 1").get(workflowId);
  const p = parseJsonOr(row?.payload_json, null);
  return row && p ? { at: Number(row.created_at), step: p.step ?? null, reason: p.reason ?? null, error: String(p.error ?? '').slice(0, 160) } : null;
}

export function ledgerFacts(file, workflowIds = null, { since = 0 } = {}) {
  const db = openLedgerReader(file);
  try {
    const workflows = db.prepare("SELECT workflow_id, display_name, title, phase, created_at, updated_at FROM workflows WHERE archived_at IS NULL AND phase NOT IN ('finished','archived')").all()
      .filter((w) => OPEN_PHASES.has(w.phase) && (!workflowIds?.length || workflowIds.includes(w.workflow_id)));
    return workflows.map((w) => {
      const kernelJob = db.prepare('SELECT status, updated_at FROM jobs WHERE job_id=?').get(`kernel-${w.workflow_id}`) ?? null;
      const signal = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(w.workflow_id);
      const woken = db.prepare("SELECT MAX(occurred_at) AS at FROM events WHERE workflow_id=? AND kind='kernel-woken'").get(w.workflow_id)?.at ?? null;
      return { id: w.workflow_id, name: w.display_name ?? w.title ?? w.workflow_id, phase: w.phase, createdAt: w.created_at, updatedAt: w.updated_at,
        attempts: attemptFacts(db, w.workflow_id), events: eventFacts(db, w.workflow_id),
        jobs: db.prepare('SELECT * FROM jobs WHERE workflow_id=?').all(w.workflow_id).map(jobOf),
        incidents: db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open'").all(w.workflow_id).map((row) => incidentOf(row, heldBy(db, row))),
        decisions: db.prepare("SELECT * FROM decision_items WHERE workflow_id=? AND status='open'").all(w.workflow_id).map(decisionOf),
        kernelJob: kernelJob ? { status: kernelJob.status, updatedAt: kernelJob.updated_at } : null,
        kernelSignal: parseJsonOr(signal?.value_json, null), lastStartFailure: lastStartFailureOf(db, w.workflow_id), lastKernelWakeAt: woken, kernelWakes: wakeUsageOf(db, w.workflow_id).filter((wake) => wake.at >= since), seatCost: kernelSeatOf(db, { workflowId: w.workflow_id, name: w.display_name ?? w.title ?? w.workflow_id, since }) };
    });
  } finally { db.close(); }
}

/** The final transcripts of the newest `limit` op attempts of the running workflows, as artifacts to scan. */
function attemptTranscripts(workflows, limit) {
  return workflows.flatMap((w) => (w.attempts ?? []).filter((a) => a.transcriptSha).map((a) => ({ artifact: `attempt-transcript:${w.name}/${a.attemptId}`, kind: 'transcript', sha: a.transcriptSha, at: a.settledAt ?? a.dispatchedAt ?? 0 })))
    .sort((a, b) => b.at - a.at).slice(0, limit);
}

/** The finished workflows of one ledger (the history the end condition counts). */
function ledgerHistory(file) {
  const db = openLedgerReader(file);
  try { return historyFacts(db); } finally { db.close(); }
}

/** One child read of a JSON verb: the first JSON object, or null with the reason. */
async function jsonChild(args, timeoutMs, run) {
  const r = await run(args, { timeoutMs });
  const json = r.ok || r.stdout ? firstJson(r.stdout) : null;
  return { json, error: json ? null : (r.error ?? 'no json') };
}

/** The Kernel status and the read-only watchdog probe of one workflow. */
async function workflowReads(w, repo, { timeoutMs, run }) {
  const status = await jsonChild(['scripts/kernel/cli.mjs', 'status', '--repo', repo, '--workflow', w.id, '--json'], timeoutMs, run);
  const probe = await jsonChild(['scripts/kernel/kernel-watchdog.mjs', '--repo', repo, '--workflow', w.id, '--once', '--json'], timeoutMs, run);
  return { status: status.json, statusError: status.error, seatProbe: probe.json };
}

async function supervisorHealth({ timeoutMs, run }) {
  const read = await jsonChild(['scripts/supervisor/start-supervisor.mjs', '--status', '--json'], timeoutMs, run);
  return read.json?.health ?? null;
}

/**
 * The snapshot: {now, liveRev, engine, supervisor, reservations, seats, supJobs, workflows}, or {unavailable} when there is no
 * machine store. Filters: `repos` (ledger-owner paths) and `workflowIds`. Seams: machine, ledger, run, now.
 */
/** The last release's CI verdict as one line (`tag state (suite: mode)`), or null when no release was cut in this checkout or its record cannot be read. */
function releaseCiLine(env) {
  try { return ciLine(latestCiRecord({ repo: env.STARCI_KERNEL_REV_ROOT ?? ROOT })); } catch { return null; }
}

export async function collectSnapshot({ env = process.env, repos = [], workflowIds = [], timeoutMs = 90_000, now = Date.now(),
  machine = machineFacts, ledger = ledgerFacts, history = ledgerHistory, run: runChild = child, numbers = digestNumbers(), readBlob = undefined, liveRev = () => runtimeShaOf(env.STARCI_KERNEL_REV_ROOT ?? ROOT) } = {}) {
  // The read verbs run as the digest: a stranger to every workflow, so `kernel status` projects through a read-only ledger and writes nothing.
  const run = (args, options) => runChild(args, { ...options, env: { ...env, STARCI_ACTOR: 'debug-digest' } });
  const facts = machine({ env, numbers, ...(readBlob ? { readBlob } : {}) });
  if (!facts) return { unavailable: 'machine store' };
  const wanted = facts.ledgers.filter((l) => !repos.length || repos.includes(l.repo_root));
  const workflows = [];
  const finished = [];
  const historyErrors = [];
  await eachInOrder(wanted, async (l) => {
    let found;
    try { found = ledger(l.file, workflowIds, { since: facts.engine?.revSince ?? 0 }); } catch (e) { workflows.push({ id: null, name: l.name, ledger: l.name, repo: l.repo_root, phase: null, jobs: [], incidents: [], decisions: [], statusError: `ledger unreadable: ${String(e.message).slice(0, 100)}` }); return; }
    await eachInOrder(found, async (w) => { workflows.push({ ...w, ledger: l.name, repo: l.repo_root, ...(await workflowReads(w, l.repo_root, { timeoutMs, run })) }); });
    try { finished.push(...history(l.file).map((h) => ({ ...h, ledger: l.name }))); } catch (e) { historyErrors.push(`${l.name}: ${String(e.message).slice(0, 100)}`); }
  });
  const health = await supervisorHealth({ timeoutMs, run });
  const attemptScan = scanBlobs(attemptTranscripts(workflows, numbers.secretScanArtifacts), { maxBytes: numbers.secretScanBytes, ...(readBlob ? { readBlob } : {}) });
  return { now, liveRev: liveRev(), releaseCi: releaseCiLine(env), engine: facts.engine, supervisor: { ...facts.supervisor, health }, reservations: facts.reservations,
    seats: facts.seats, supJobs: facts.supJobs, lands: facts.lands ?? [], refusals: refusalFacts(env), workflows, history: finished, historyErrors, registry: registryFacts(), criteria: endCriteria(),
    providerEvents: facts.providerEvents ?? [], runtimeChanges: facts.runtimeChange ?? [], hostDrift: facts.hostDrift ?? [], portClaims: facts.portClaim ?? [], secrets: mergeScans(facts.secrets ?? { scanned: 0, unreadable: 0, hits: [] }, attemptScan) };
}
