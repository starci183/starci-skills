// Machine-owned closure of provider slots whose launch can no longer be alive. A reservation is released only on
// the proof its owner would have supplied (releaseProviderReservation): a terminal Orca no longer lists (or lists
// disconnected) whose process census carries no member, a `reserved` receipt that never crossed worker-start, or
// an `unknown` receipt whose job ledger already recorded every launch of its attempt settled to no effect.
import { withMachine, readMachine } from '../../engine/db/machine.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { parseJson } from '../lib/json.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { processList } from '../api/process/process-list.mjs';
import { processEnv } from '../api/process/process-env.mjs';
import { terminalTree } from './worker-close.mjs';
import { providerBudgetClock, providerBudgetOptions } from './provider-budget-release.mjs';

const HANDLE_ENV = 'ORCA_TERMINAL_HANDLE';
const LAUNCHED = new Set(['launching', 'live', 'unknown']);

/** What the terminal listing proves about `handle`: 'gone' (a responding Orca lists nothing), 'disconnected' or 'connected'. Pure. */
const listedState = (terminals, handle) => {
  const row = terminals.find((terminal) => terminal?.handle === handle);
  if (!row) return 'gone';
  return row.connected === false ? 'disconnected' : 'connected';
};

/** A `reserved` receipt is consumed (moved to `launching`) before worker-start runs: one that stayed `reserved` held no launch. Pure. */
const neverLaunched = (row, now, staleMs) => row.state === 'reserved' && !row.handle && !row.pid && now - Number(row.updatedAt) >= staleMs;

// An op launch scopes its receipt `<ledger>:<job>:attempt:<n>` (scripts/kernel/verbs/shared/dispatch-agent.mjs).
const ATTEMPT_SCOPE = /^(.*):([^:]+):attempt:(\d+)$/;

/** The job's recorded proof that every named launch of `attempt` ended with no effect, or null. Pure reads of an open ledger. */
function jobNoEffectProof(db, jobId, attempt) {
  const job = db.prepare('SELECT try_no,payload_json FROM jobs WHERE job_id=?').get(jobId);
  if (!job || Number(job.try_no) !== attempt) return null;
  const entries = parseJson(job.payload_json, {})?.rejectedDispatches;
  if (!Array.isArray(entries) || !entries.length || !entries.every((entry) => entry?.effectState === 'none')) return null;
  const dispatches = entries.map((entry) => entry?.dispatchId).filter(Boolean);
  if (!dispatches.length) return null;
  // A dispatch-rejected event without a dispatch identity is a launch no reconcile could settle: its slot stays.
  const unsettled = db.prepare("SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND kind='dispatch-rejected'").all(jobId)
    .some((row) => { const payload = parseJson(row?.payload_json); return !payload?.terminal && payload?.effectState !== 'none'; });
  return unsettled ? null : { jobId, attempt, dispatches };
}

/**
 * The attempt-scoped 'unknown' receipts whose owning job's ledger proves every recorded launch of the attempt
 * settled to no effect: [{row, proof, why}]. The reconcile that returned the job to ready marked each rejected
 * dispatch entry effectState 'none'; a scope with any entry still unsettled — or an unattributable rejection —
 * keeps its receipts held. kept: [{id, why}] for every receipt no ledger proves.
 */
function recordedNoEffect(rows, settings) {
  const wanted = new Map(), kept = [], proven = [], found = new Set();
  for (const row of rows) {
    const match = ATTEMPT_SCOPE.exec(String(row.scope?.scopeId ?? ''));
    if (match) wanted.set(match[1], [...(wanted.get(match[1]) ?? []), { row, jobId: match[2], attempt: Number(match[3]) }]);
    else kept.push({ id: row.id, why: 'effect-unproven' });
  }
  if (wanted.size) for (const entry of readMachine((m) => m.forEachLedger(({ ledger, db }) => {
    const group = wanted.get(ledger.ledgerId) ?? wanted.get(ledger.file);
    return group ? group.map((item) => ({ ...item, proof: jobNoEffectProof(db, item.jobId, item.attempt) })) : null;
  }), [], settings)) {
    for (const item of entry?.result ?? []) {
      found.add(item.row.id);
      if (!item.proof) { kept.push({ id: item.row.id, why: 'effect-unproven' }); continue; }
      proven.push({ row: item.row, why: 'no-effect-recorded', proof: { kind: 'reconciled-no-effect', confirmed: true,
        source: 'reservation-reap', dispatchId: item.proof.dispatches.at(-1), dispatches: item.proof.dispatches,
        scopeId: item.row.scope.scopeId, jobId: item.proof.jobId, effectState: 'none' } });
    }
  }
  for (const row of rows) if (!found.has(row.id) && !kept.some((entry) => entry.id === row.id)) kept.push({ id: row.id, why: 'ledger-unproven' });
  return { proven, kept };
}

const censusOf = (io) => {
  let table = null, envRows = null;
  try { table = (io.table ?? (() => processList({ cmdMax: 200 })))(); envRows = (io.env ?? (() => processEnv({ names: [HANDLE_ENV] })))(); } catch { return null; }
  return Array.isArray(table) && Array.isArray(envRows) ? { table, envRows } : null;
};

/** The ended terminals among the launched receipts: [{row, state}] and why the rest stay held. */
function endedTerminals(launched, io) {
  if (!launched.length) return { ended: [], kept: [] };
  let listed = null;
  try { listed = (io.list ?? terminalList)(); } catch { listed = null; }
  if (!listed?.ok || listed.hostUnavailable) return { ended: [], kept: launched.map((row) => ({ id: row.id, why: 'host-unavailable' })) };
  const states = launched.map((row) => ({ row, state: listedState(listed.terminals ?? [], row.handle) }));
  return { ended: states.filter(({ state }) => state !== 'connected'), kept: states.filter(({ state }) => state === 'connected').map(({ row }) => ({ id: row.id, why: 'terminal-connected' })) };
}

/** Receipts whose terminal ended AND whose terminal census holds no process: [{row, proof}]; the others with their reason. */
function provenClosed(ended, io) {
  if (!ended.length) return { closed: [], kept: [] };
  const census = censusOf(io);
  if (!census) return { closed: [], kept: ended.map(({ row }) => ({ id: row.id, why: 'census-unreadable' })) };
  const closed = [], kept = [];
  for (const { row, state } of ended) {
    if (terminalTree(row.handle, census).members.length) { kept.push({ id: row.id, why: 'process-alive' }); continue; }
    closed.push({ row, proof: { kind: 'closed', confirmed: true, handle: row.handle, source: 'reservation-reap', terminalProof: state, processVerdict: 'none' } });
  }
  return { closed, kept };
}

/**
 * Release every provider receipt that provably holds no launch. Capacity that nobody uses (a worker whose job reported or was cancelled, a
 * replaced seat, a launch that died before worker-start) no longer refuses later starts. Never throws; a probe that cannot answer keeps the slot.
 * io seams: list, table, env. {released: [{id, fence, attemptId, role, why}], kept: [{id, why}]}
 */
export function reapProviderReservations(options = {}, io = {}) {
  const out = { released: [], kept: [] };
  try {
    const now = providerBudgetClock(options)();
    const settings = providerBudgetOptions(options);
    const active = readMachine((m) => m.providerReservations({ activeOnly: true }), [], settings);
    const staleMs = allocationMs('providerReservation.reservedStaleMs');
    const stale = active.filter((row) => neverLaunched(row, now, staleMs)).map((row) => ({ row, why: 'never-launched',
      proof: { kind: 'failed-before-launch', confirmed: true, source: 'reservation-reap' } }));
    const recorded = recordedNoEffect(active.filter((row) => row.state === 'unknown' && !row.handle), settings);
    const { ended, kept } = endedTerminals(active.filter((row) => row.handle && LAUNCHED.has(row.state)), io);
    const proven = provenClosed(ended, io);
    const releases = [...stale, ...recorded.proven, ...proven.closed.map(({ row, proof }) => ({ row, proof, why: `terminal-${proof.terminalProof}` }))];
    out.kept.push(...kept, ...proven.kept, ...recorded.kept);
    if (!releases.length) return out;
    withMachine((m) => {
      for (const { row, proof, why } of releases) {
        const result = m.releaseProviderReservation({ ...row, proof });
        if (result.ok && !result.reused) out.released.push({ id: row.id, fence: row.fence, attemptId: row.attemptId, role: row.role, why });
        else if (!result.ok) out.kept.push({ id: row.id, why: result.reason });
      }
    }, settings);
  } catch (error) { out.kept.push({ id: null, why: `reap-failed: ${String(error?.message ?? error).slice(0, 160)}` }); }
  return out;
}
