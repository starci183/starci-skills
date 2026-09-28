// host-event.mjs — a worker death inside a host-wide terminal disconnect is the environment's, not the op's.
//
// 2026-09-27 13:20-13:30Z every Kernel terminal of the nivo and starci-next ledgers was cleared
// 'terminal disconnected' within ten minutes (Orca's terminal daemon dropped them), and the five op
// workers alive then - nivo app-auth uat.verify a3, collab backend.implement a9, modules-agentos
// interface.draw a3; starci-next learn-content and foundation backend.implement a2 - settled
// failed-no-report as the ops' own deaths: a business attempt spent each, their pools demoted, the
// dead-worker pattern fed. The host samples around it (13:02Z 23.7% free RAM, 13:36Z 16.6%) show
// pressure but no OOM floor; the signature is the simultaneous disconnect. api.mjs hostTerminalWipeOf
// already recognised a wipe proven by the worker's OWN Kernel terminal being gone; a disconnect seen
// through other workflows' Kernels was missed.
//
// hostWideDisconnectOf(db, now) -> [workflowId] | null: Kernel seats cleared for gone or disconnected
// terminals in this ledger and the configured Supervisor ledgers inside HOST_EVENT_WINDOW_MS. Three
// distinct Kernels on the host prove a wipe, including when their clears are spread across ledgers.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ledgerFileFor } from '../../engine/ledger-db.mjs';
import { productRepos } from '../supervisor/home.mjs';
import { parseJsonOr } from '../lib/json.mjs';

export const HOST_EVENT_WINDOW_MS = 20 * 60_000;
export const HOST_EVENT_MIN_WORKFLOWS = 3;
export const HOST_DEAD_REASON = /^(?:terminal_handle_stale|terminal (?:disconnected|not in the Orca listing|listed disconnected)\b)/;

export function hostWideDisconnectOf(db, now = Date.now(), { repos = null } = {}) {
  const sql = "SELECT workflow_id, payload_json FROM events WHERE kind='kernel-stale-cleared' AND created_at>=? AND created_at<=?";
  const workflows = [], seen = new Set();
  const add = (source, rows) => {
    for (const row of rows) {
      if (!HOST_DEAD_REASON.test(String(parseJsonOr(row.payload_json).reason ?? ''))) continue;
      const key = `${source}\0${row.workflow_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      workflows.push(row.workflow_id);
    }
  };
  const localFile = db.prepare('PRAGMA database_list').all().find((row) => row.name === 'main')?.file;
  const source = localFile ? path.resolve(localFile) : ':memory:';
  add(source, db.prepare(sql).all(now - HOST_EVENT_WINDOW_MS, now));
  if (workflows.length >= HOST_EVENT_MIN_WORKFLOWS) return workflows;
  // An in-memory ledger has no host/repository identity. Tests can name peers explicitly.
  if (!localFile && repos === null) return null;

  // Product ledgers are only inspected read-only. A missing or unavailable peer cannot erase the
  // caller's local evidence, and a repo listed twice cannot count the same Kernel twice.
  let configured;
  try { configured = repos ?? productRepos(); } catch { return null; }
  for (const repo of configured) {
    let peer = null;
    try {
      const file = path.resolve(ledgerFileFor(repo));
      if (file === source || !fs.existsSync(file)) continue;
      peer = new DatabaseSync(file, { readOnly: true });
      add(file, peer.prepare(sql).all(now - HOST_EVENT_WINDOW_MS, now));
      if (workflows.length >= HOST_EVENT_MIN_WORKFLOWS) return workflows;
    } catch { /* an unreadable peer contributes no proof */ }
    finally { try { peer?.close(); } catch { /* closed */ } }
  }
  return null;
}
