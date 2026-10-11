// workflow-purge-ledger.mjs - what the project ledger says about one archived workflow, read only: its phase, the rows
// that would still hold something live, and the evidence that ties host leftovers (Orca Runs, workers, terminals, refs)
// to it. The purge (workflow-purge-plan.mjs) judges its preconditions and its leftovers from this.
import fs from 'node:fs';
import { ledgerFileFor, openLedgerReader } from '../../engine/db/ledger.mjs';
import { artifactRoot } from '../../engine/db/blob.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import { parseJson } from '../lib/json.mjs';
import { jobPayload, jobRunIds, jobTerminalHandles, KERNEL_LAUNCH_EVENTS } from './terminal-ledger.mjs';
import { SETTLED_JOBS } from './worktree-registry.mjs';

// The events whose payload names a host object of the workflow: a failed Kernel launch (terminal, dispatch, Run), a
// Kernel launch that stood (terminal) and the work an op left under preserved/.
const EVIDENCE_EVENTS = Object.freeze(['kernel-start-failed', 'workflow-op-preserved', ...KERNEL_LAUNCH_EVENTS]);
const OPEN_DECISION = "('open','claimed','escalated')";

const countOf = (db, sql, workflowId) => Number(db.prepare(sql).get(workflowId).n);
const stringsOf = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value).map(String))];

// The jobs of the workflow with the terminal handles and Orca Runs their payloads bind.
function jobsOf(db, workflowId) {
  return db.prepare('SELECT job_id, kind, status, worker_id, payload_json FROM jobs WHERE workflow_id=? ORDER BY created_at, job_id').all(workflowId).map((row) => {
    const payload = jobPayload(row);
    return { jobId: row.job_id, kind: row.kind, status: row.status, live: !SETTLED_JOBS.has(row.status), handles: jobTerminalHandles(row, payload), runIds: jobRunIds(payload) };
  });
}

// The payloads of the workflow's evidence events, newest first.
const evidencePayloadsOf = (db, workflowId, root) => db.prepare(`SELECT kind, CASE WHEN payload_sha IS NULL THEN payload_json END AS payload_json, payload_sha FROM events WHERE workflow_id=? AND kind IN (${EVIDENCE_EVENTS.map(() => '?').join(',')}) ORDER BY seq DESC`)
  .all(workflowId, ...EVIDENCE_EVENTS).map((row) => ({ kind: row.kind, payload: eventPayloadOf(row, { root }) ?? {} }));

const kernelSignalOf = (db, workflowId) => {
  const row = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  return row ? { held: true, terminal: parseJson(row.value_json, null)?.terminal ?? null } : { held: false, terminal: null };
};

/** The ledger evidence {handles, runIds, dispatchIds, preservedRefs} of jobs, events and the Kernel signal: each value names a host object this workflow made. */
function evidenceOf({ jobs, events, signal }) {
  const named = events.map((event) => event.payload);
  return {
    handles: stringsOf([...jobs.flatMap((job) => job.handles), signal.terminal, ...named.map((payload) => payload.terminal)]),
    runIds: stringsOf([...jobs.flatMap((job) => job.runIds), ...named.map((payload) => payload.runId)]),
    dispatchIds: stringsOf(named.map((payload) => payload.dispatch ?? payload.dispatchId)),
    preservedRefs: stringsOf(events.filter((event) => event.kind === 'workflow-op-preserved').map((event) => event.payload.preservedRef)),
  };
}

function factsFrom(db, workflowId, root) {
  const wf = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
  if (!wf) return { found: false };
  const jobs = jobsOf(db, workflowId), events = evidencePayloadsOf(db, workflowId, root), signal = kernelSignalOf(db, workflowId);
  let purge = null;
  try { purge = db.prepare('SELECT state FROM workflow_purges WHERE workflow_id=?').get(workflowId)?.state ?? null; } catch { purge = null; }
  return { found: true, phase: wf.phase, archivedAt: wf.archived_at ?? null, purgeState: purge, jobs, signal,
    leases: countOf(db, 'SELECT count(*) n FROM leases WHERE workflow_id=?', workflowId),
    openRows: { inbox: countOf(db, "SELECT count(*) n FROM inbox WHERE workflow_id=? AND status NOT IN ('done','applied')", workflowId),
      incidents: countOf(db, "SELECT count(*) n FROM incidents WHERE workflow_id=? AND status='open'", workflowId),
      decisions: countOf(db, `SELECT count(*) n FROM decision_items WHERE workflow_id=? AND status IN ${OPEN_DECISION}`, workflowId) },
    evidence: evidenceOf({ jobs, events, signal }) };
}

/**
 * The ledger side of a purge, read only through a reader handle that is closed again: {found:false, file} when the repository has no ledger or the
 * workflow is not in it; else {found, file, phase, archivedAt, purgeState, jobs[{jobId, kind, status, live, handles, runIds}], signal{held, terminal},
 * leases, openRows{inbox, incidents, decisions}, evidence{handles, runIds, dispatchIds, preservedRefs}}.
 */
export function purgeLedgerFacts({ repo, workflowId, env = process.env }) {
  const file = ledgerFileFor(repo, { env });
  if (!fs.existsSync(file)) return { found: false, file };
  const db = openLedgerReader(file);
  try { return { file, ...factsFrom(db, workflowId, artifactRoot(env)) }; } finally { db.close(); }
}
