// Restart recovery of provider receipts: a receipt with no terminal handle and no process (reserved, launching, unknown) has nothing
// the terminal reaper can look at. After a reboot or an Orca restart it is released on the proof that the host incarnation that wrote it
// is over, and a receipt no proof reaches opens the PROVIDER_RESERVATION_HELD clock once it has been held past its declared bound.
import os from 'node:os';
import { allocationMs } from '../../engine/config.mjs';
import { status as orcaStatus } from '../api/orca/status.mjs';
import { requestShow } from '../api/orca/request-show.mjs';
import { processList } from '../api/process/process-list.mjs';
import { processEnv } from '../api/process/process-env.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { ENDED_DISPATCH_STATES } from '../../engine/db/provider-reservations.mjs';
import { terminalTree } from './worker-close.mjs';

export const HELD_CLOCK = 'PROVIDER_RESERVATION_HELD';
export const heldEntity = (id) => `provider-reservation:${id}`;

const createdKnown = (value) => Number.isSafeInteger(value) && value > 0;

/**
 * The instant the current host incarnation began, or why it cannot be told. Both witnesses are read: the operating system's boot instant
 * (a fast-startup shutdown leaves it older than the real boot) and the creation instant of Orca's desktop app process; the later one is the
 * incarnation start. An Orca that does not answer or a process table that cannot be read proves nothing. Never throws.
 * io seams: status, table, bootAt.
 */
export function hostIncarnation(io = {}) {
  let status = null, table = null;
  try { status = (io.status ?? orcaStatus)(); table = (io.table ?? (() => processList({ cmdMax: 40 })))(); } catch { return { ok: false, why: 'host-unavailable' }; }
  if (!status?.reachable) return { ok: false, why: 'host-unavailable' };
  if (!Array.isArray(table)) return { ok: false, why: 'census-unreadable' };
  const bootAt = (io.bootAt ?? (() => Date.now() - os.uptime() * 1000))();
  const app = table.find((row) => row.pid === status.appPid);
  const orcaStartedAt = createdKnown(app?.created) ? app.created : null;
  return { ok: true, table, bootAt, orcaStartedAt, startedAt: Math.max(bootAt, orcaStartedAt ?? 0) };
}

/** A receipt whose launch can still be running: no handle and no process recorded. Pure. */
export const handleless = (row) => !row.handle && !row.pid;

/** What the current runtime answers for the host request of a receipt: 'absent', 'completed', 'pending' or null when it cannot say. */
function requestStateOf(row, io) {
  if (!row.hostRequestId) return { state: 'none' };
  try {
    const shown = (io.request ?? requestShow)({ request: row.hostRequestId });
    return shown?.ok === true ? { state: shown.state, dispatchId: shown.dispatchId ?? null } : { state: null };
  } catch { return { state: null }; }
}

function proofOf(row, incarnation, request) {
  return { kind: 'host-restarted', confirmed: true, source: 'reservation-reap', restartedAt: incarnation.startedAt,
    bootAt: incarnation.bootAt, orcaStartedAt: incarnation.orcaStartedAt, receiptUpdatedAt: row.updatedAt,
    hostRequestId: row.hostRequestId ?? null, requestState: request.state === 'none' ? null : request.state };
}

const HANDLE_ENV = 'ORCA_TERMINAL_HANDLE';

/** The terminal listing and the handle environments, read at most once per pass: {terminals, envRows} or null when either cannot be read. */
function censusReader(io) {
  let cached;
  return () => {
    if (cached !== undefined) return cached;
    try {
      const listed = (io.list ?? terminalList)();
      const envRows = (io.env ?? (() => processEnv({ names: [HANDLE_ENV] })))();
      cached = listed?.ok && !listed.hostUnavailable && Array.isArray(envRows) ? { terminals: listed.terminals ?? [], envRows } : null;
    } catch { cached = null; }
    return cached;
  };
}

/** What the current runtime reports of the Dispatch a known host request resolved to: {dispatchId, status, handle} or {why}. */
function dispatchOf(request, io) {
  if (!request.dispatchId) return { why: 'request-known' };
  let shown = null;
  try { shown = (io.worker ?? workerShow)({ dispatch: request.dispatchId }); } catch { shown = null; }
  if (shown?.hostUnavailable || !shown?.ok) return { why: shown?.hostUnavailable ? 'host-unavailable' : 'request-known' };
  const dispatch = shown.result?.dispatch;
  if (!ENDED_DISPATCH_STATES.includes(dispatch?.status)) return { why: 'dispatch-active' };
  return { dispatchId: request.dispatchId, status: dispatch.status, handle: dispatch.assigneeHandle ?? null };
}

/** A receipt whose host request the runtime knows: released when its Dispatch ended and its terminal is gone with no process under it. */
function endedDispatchVerdict(row, request, ctx) {
  const dispatch = dispatchOf(request, ctx.io);
  if (dispatch.why) return { id: row.id, why: dispatch.why };
  const census = ctx.census();
  if (!census) return { id: row.id, why: 'census-unreadable' };
  const listed = census.terminals.find((terminal) => terminal?.handle === dispatch.handle);
  if (dispatch.handle && listed && listed.connected !== false) return { id: row.id, why: 'terminal-connected' };
  if (dispatch.handle && terminalTree(dispatch.handle, { table: ctx.table, envRows: census.envRows }).members.length) return { id: row.id, why: 'process-alive' };
  return { row, why: 'dispatch-ended', proof: { kind: 'dispatch-ended', confirmed: true, source: 'reservation-reap', hostRequestId: row.hostRequestId,
    dispatchId: dispatch.dispatchId, dispatchStatus: dispatch.status, handle: dispatch.handle,
    terminalProof: listed ? 'disconnected' : 'gone', processVerdict: 'none' } };
}

/** One receipt's verdict: {row, proof, why} to release, or {id, why} to keep. */
function verdictOf(row, ctx) {
  const request = requestStateOf(row, ctx.io);
  if (request.state === null) return { id: row.id, why: 'host-unavailable' };
  if (request.state === 'completed' || request.state === 'pending') return endedDispatchVerdict(row, request, ctx);
  if (ctx.incarnation.startedAt - ctx.toleranceMs <= Number(row.updatedAt)) return { id: row.id, why: 'host-not-restarted' };
  return { row, why: 'host-restarted', proof: proofOf(row, ctx.incarnation, request) };
}

/**
 * The handle-less receipts whose launch has ended: {proven: [{row, proof, why}], kept: [{id, why}]}. No Orca or census read is made for an empty
 * set; an unreachable Orca or an unreadable table keeps every slot. A receipt whose host request the current runtime records is judged by its
 * Dispatch (ended, terminal gone, no process under it: dispatch-ended); one it has no record of is released once the host restarted after the
 * receipt's last update (host-restarted).
 */
export function restartedReleases(rows, io = {}) {
  if (!rows.length) return { proven: [], kept: [] };
  const incarnation = hostIncarnation(io);
  if (!incarnation.ok) return { proven: [], kept: rows.map((row) => ({ id: row.id, why: incarnation.why })) };
  const ctx = { io, incarnation, table: incarnation.table, toleranceMs: allocationMs('providerReservation.restartToleranceMs'), census: censusReader(io) };
  const verdicts = rows.map((row) => verdictOf(row, ctx));
  return { proven: verdicts.filter((verdict) => verdict.row), kept: verdicts.filter((verdict) => !verdict.row) };
}

/** The handle-less receipts held longer than their declared bound since their last update. Pure. */
export function heldPastBound(rows, now) {
  const boundMs = allocationMs('providerReservation.unknownHeldMs');
  return rows.filter((row) => now - Number(row.updatedAt) >= boundMs);
}

/** Open the held clock of each receipt (one episode per receipt); the reaper clears it on release. */
export function openHeldClocks(m, rows) {
  const boundMs = allocationMs('providerReservation.unknownHeldMs');
  for (const row of rows) {
    m.openSlaEpisode({ entity: heldEntity(row.id), state: HELD_CLOCK, code: HELD_CLOCK, severity: 'warn', slaMs: boundMs, enteredAt: Number(row.updatedAt) });
  }
  return rows.map((row) => row.id);
}
