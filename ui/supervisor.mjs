// supervisor.mjs (ui) — what /api/supervisor/logs, /api/supervisor/logs/stream and /api/supervisor/state serve: the
// Supervisor's machine log (typed rows of the supervisor ledger's `logs` table, written by
// scripts/supervisor/sup-log.mjs; same LogRow as /api/logs) and its state (scripts/supervisor/state.mjs
// readSupervisorState). Read-only: the ledger is opened with engine/ledger-db.mjs openLedgerReader and never created or
// synced from here; a machine with no supervisor ledger yet answers an empty page.
import fs from 'node:fs';
import { openLedgerReader } from '../engine/ledger-db.mjs';
import { LOG_KINDS, LOG_LEVELS, viewOfRow } from '../scripts/kernel/typed-logs.mjs';
import { SUPERVISOR_WF, supervisorLedgerFile } from '../scripts/supervisor/home.mjs';
import { readSupervisorState } from '../scripts/supervisor/state.mjs';

const REF = /^(?:workflow|job|repo|commit|item|experiment|signature|proposal):[^\s"%]{1,300}$/;

/** Parse the query of /api/supervisor/logs: {kinds, levels, ref, after, limit}; throws on a bad parameter. */
export function supervisorLogQueryOf(params) {
  const list = (name) => (params.get(name) ?? '').split(',').map((k) => k.trim()).filter(Boolean);
  const kinds = list('kinds');
  if (kinds.some((k) => !LOG_KINDS[k])) throw new Error('Tham số kinds không hợp lệ');
  const levels = list('levels');
  if (levels.some((l) => !LOG_LEVELS.includes(l))) throw new Error('Tham số levels không hợp lệ');
  const ref = params.get('ref') || null;
  if (ref && !REF.test(ref)) throw new Error('Tham số ref không hợp lệ');
  const after = Number(params.get('after') ?? 0);
  return { kinds: kinds.length ? kinds : null, levels: levels.length ? levels : null, ref, after: Number.isSafeInteger(after) && after > 0 ? after : 0,
    limit: Math.min(5000, Math.max(1, Number(params.get('limit')) || 1000)) };
}

/** Rows of the machine log, oldest first (without `after`: the newest `limit`). {workflowId, rows, cursor, more}. */
export function readSupervisorLogs(query, { env = process.env } = {}) {
  const empty = { workflowId: SUPERVISOR_WF, rows: [], cursor: query.after ?? 0, more: false };
  const file = supervisorLedgerFile(env);
  if (!fs.existsSync(file)) return empty;
  const db = openLedgerReader(file);
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='logs'").get()) return empty;
    const where = ['workflow_id=?'], args = [SUPERVISOR_WF];
    if (query.kinds) { where.push(`kind IN (${query.kinds.map(() => '?').join(',')})`); args.push(...query.kinds); }
    if (query.levels) { where.push(`level IN (${query.levels.map(() => '?').join(',')})`); args.push(...query.levels); }
    if (query.ref) { where.push('refs_json LIKE ?'); args.push(`%${JSON.stringify(query.ref)}%`); }
    const take = query.limit;
    let rows;
    if (query.after) rows = db.prepare(`SELECT * FROM logs WHERE ${where.join(' AND ')} AND seq>? ORDER BY seq LIMIT ?`).all(...args, query.after, take + 1);
    else rows = db.prepare(`SELECT * FROM logs WHERE ${where.join(' AND ')} ORDER BY seq DESC LIMIT ?`).all(...args, take + 1).reverse();
    const more = rows.length > take;
    if (more) rows = query.after ? rows.slice(0, take) : rows.slice(1);
    const views = rows.map(viewOfRow);
    return { workflowId: SUPERVISOR_WF, rows: views, cursor: views.at(-1)?.seq ?? query.after ?? 0, more };
  } finally { db.close(); }
}

/** The Supervisor's state (SupervisorState). */
export const readSupervisorStateForUi = ({ env = process.env } = {}) => readSupervisorState({ env });
