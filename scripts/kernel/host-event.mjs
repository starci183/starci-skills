// host-event.mjs — a worker death inside a host-wide terminal disconnect is the environment's, not the op's.
//
// 2026-09-27 13:20-13:30Z every Kernel terminal of the nivo and starci-next ledgers was cleared
// 'terminal disconnected' within ten minutes (Orca's terminal daemon dropped them), and the five op
// workers alive then - nivo app-auth uat.verify a3, collab backend.implement a9, modules-agentos
// interface.draw a3; starci-next learn-content and foundation backend.implement a2 - settled
// failed-no-report as the ops' own deaths: a business attempt spent each, their pools demoted, the
// dead-worker pattern fed. The host samples around it (13:02Z 23.7% free RAM, 13:36Z 16.6%) show
// pressure but no OOM floor; the signature is the simultaneous disconnect. cli.mjs hostTerminalWipeOf
// already recognised a wipe proven by the worker's OWN Kernel terminal being gone; a disconnect seen
// through other workflows' Kernels was missed.
//
// hostWideDisconnectOf(db, now) -> [workflowId] | null: Kernel seats cleared for gone or disconnected
// terminals, and worker terminals found disconnected or stale, in this ledger and the configured Supervisor
// ledgers inside HOST_EVENT_WINDOW_MS. Three distinct workflows on the host prove a wipe, including when
// their deaths are spread across ledgers. hostEventAround (below) reads the same proof in hindsight.
import fs from 'node:fs';
import path from 'node:path';
import { ledgerFileFor, openLedgerReader } from '../../engine/db/ledger.mjs';
import { productRepos } from '../machine/home.mjs';
import { parseJsonOr } from '../lib/json.mjs';

export const HOST_EVENT_WINDOW_MS = 20 * 60_000;
export const HOST_EVENT_MIN_WORKFLOWS = 3;
export const HOST_DEAD_REASON = /^(?:terminal_handle_stale|terminal (?:disconnected|not in the Orca listing|listed disconnected)\b)/;


// A dead worker terminal is host evidence too: a worker Orca calls disconnected, or gone with a stale handle
// (the dead-worker sweep's dead-worker-requeued and worker-failed-no-report rows). Its workflow counts once,
// like a Kernel clear.
const WORKER_DEATH_KINDS = ['dead-worker-requeued', 'worker-failed-no-report'];
export const hostDeadWorker = (worker) => worker?.liveness === 'disconnected'
  || (worker?.liveness === 'gone' && HOST_DEAD_REASON.test(String(worker.errorCode ?? '')));

const SQL = `SELECT workflow_id, kind, payload_json, created_at FROM events WHERE kind IN ('kernel-stale-cleared',${WORKER_DEATH_KINDS.map((k) => `'${k}'`).join(',')})
  AND created_at>=? AND created_at<=?`;
const hostDeathOf = (row) => {
  const p = parseJsonOr(row.payload_json) ?? {};
  if (row.kind === 'kernel-stale-cleared') return HOST_DEAD_REASON.test(String(p.reason ?? ''));
  return hostDeadWorker(p.worker ?? { liveness: p.liveness, errorCode: p.errorCode });
};

// Every host death in [from, to] of this ledger and the configured peers: [{source, workflowId, at}].
// `enough(deaths)` stops the peer walk early once the caller's proof is met.
function hostDeathsIn(db, from, to, { repos = null, enough = () => false } = {}) {
  const deaths = [];
  const add = (source, rows) => { for (const row of rows) if (hostDeathOf(row)) deaths.push({ source, workflowId: row.workflow_id, at: Number(row.created_at) }); };
  const localFile = db.prepare('PRAGMA database_list').all().find((row) => row.name === 'main')?.file;
  const source = localFile ? path.resolve(localFile) : ':memory:';
  add(source, db.prepare(SQL).all(from, to));
  if (enough(deaths)) return deaths;
  // An in-memory ledger has no host/repository identity. Tests can name peers explicitly.
  if (!localFile && repos === null) return deaths;

  // Product ledgers are only inspected read-only. A missing or unavailable peer cannot erase the
  // caller's local evidence, and a repo listed twice cannot count the same Kernel twice.
  let configured;
  try { configured = repos ?? productRepos(); } catch { return deaths; }
  const read = new Set([source]);
  for (const repo of configured) {
    let peer = null;
    try {
      const file = path.resolve(ledgerFileFor(repo));
      if (read.has(file) || !fs.existsSync(file)) continue;
      read.add(file);
      peer = openLedgerReader(file);
      add(file, peer.prepare(SQL).all(from, to));
      if (enough(deaths)) return deaths;
    } catch { /* an unreadable peer contributes no proof */ }
    finally { try { peer?.close(); } catch { /* closed */ } }
  }
  return deaths;
}

// The distinct workflows (per ledger) of `deaths` inside [from, to], in first-seen order.
const workflowsIn = (deaths, from, to) => {
  const seen = new Set(), workflows = [];
  for (const d of deaths) {
    if (d.at < from || d.at > to) continue;
    const key = `${d.source}\0${d.workflowId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    workflows.push(d.workflowId);
  }
  return workflows;
};

export function hostWideDisconnectOf(db, now = Date.now(), { repos = null } = {}) {
  const from = now - HOST_EVENT_WINDOW_MS;
  const enough = (deaths) => workflowsIn(deaths, from, now).length >= HOST_EVENT_MIN_WORKFLOWS;
  const deaths = hostDeathsIn(db, from, now, { repos, enough });
  return enough(deaths) ? workflowsIn(deaths, from, now) : null;
}

// hostEventAround(db, at) -> [workflowId] | null: the same proof read in hindsight. 2026-09-28 04:19Z
// (nivo wf-nivo-fe-canon) Orca dropped every terminal at once - four devin code.refactor workers of the
// Run and the module-studio Kernel gone terminal_handle_stale within 13 s, the collab and fe-canon Kernels
// unwritable then cleared 'terminal disconnected' by 04:35Z. The first worker reconciled
// (op-code.refactor-b7f1b77a67, dirty tree) settled at 04:19:33, before any other death was in a ledger,
// so hostWideDisconnectOf saw nothing and the death spent a business attempt and demoted devin for its
// retry. A death is a host event when some HOST_EVENT_WINDOW_MS span containing it holds
// HOST_EVENT_MIN_WORKFLOWS workflows' host deaths, the proof landing before or after it.
export function hostEventAround(db, at, { repos = null } = {}) {
  const t = Number(at);
  if (!Number.isFinite(t)) return null;
  const deaths = hostDeathsIn(db, t - HOST_EVENT_WINDOW_MS, t + HOST_EVENT_WINDOW_MS, { repos });
  // Every window holding t starts in [t-W, t]; one starting or ending on a death is the widest candidate.
  const starts = [t - HOST_EVENT_WINDOW_MS, t, ...deaths.flatMap((d) => [d.at, d.at - HOST_EVENT_WINDOW_MS])]
    .filter((s) => s >= t - HOST_EVENT_WINDOW_MS && s <= t);
  for (const start of starts) {
    const workflows = workflowsIn(deaths, start, start + HOST_EVENT_WINDOW_MS);
    if (workflows.length >= HOST_EVENT_MIN_WORKFLOWS) return workflows;
  }
  return null;
}
