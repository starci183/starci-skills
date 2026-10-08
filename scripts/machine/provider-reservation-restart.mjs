// Restart recovery of provider receipts: a receipt with no terminal handle and no process (reserved, launching, unknown) has nothing
// the terminal reaper can look at. After a reboot or an Orca restart it is released on the proof that the host incarnation that wrote it
// is over, and a receipt no proof reaches opens the PROVIDER_RESERVATION_HELD clock once it has been held past its declared bound.
import os from 'node:os';
import { allocationMs } from '../../engine/config.mjs';
import { status as orcaStatus } from '../api/orca/status.mjs';
import { requestShow } from '../api/orca/request-show.mjs';
import { processList } from '../api/process/process-list.mjs';

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
  return { ok: true, bootAt, orcaStartedAt, startedAt: Math.max(bootAt, orcaStartedAt ?? 0) };
}

/** A receipt whose launch can still be running: no handle and no process recorded. Pure. */
export const handleless = (row) => !row.handle && !row.pid;

/** What the current runtime answers for the host request of a receipt: 'absent', 'completed', 'pending' or null when it cannot say. */
function requestStateOf(row, io) {
  if (!row.hostRequestId) return { state: 'none' };
  try {
    const shown = (io.request ?? requestShow)({ request: row.hostRequestId });
    return shown?.ok === true ? { state: shown.state } : { state: null };
  } catch { return { state: null }; }
}

function proofOf(row, incarnation, request) {
  return { kind: 'host-restarted', confirmed: true, source: 'reservation-reap', restartedAt: incarnation.startedAt,
    bootAt: incarnation.bootAt, orcaStartedAt: incarnation.orcaStartedAt, receiptUpdatedAt: row.updatedAt,
    hostRequestId: row.hostRequestId ?? null, requestState: request.state === 'none' ? null : request.state };
}

/** One receipt's verdict against the incarnation: {row, proof, why} to release, or {id, why} to keep. */
function verdictOf(row, incarnation, io, toleranceMs) {
  if (incarnation.startedAt - toleranceMs <= Number(row.updatedAt)) return { id: row.id, why: 'host-not-restarted' };
  const request = requestStateOf(row, io);
  if (request.state === null) return { id: row.id, why: 'host-unavailable' };
  if (request.state !== 'none' && request.state !== 'absent') return { id: row.id, why: 'request-known' };
  return { row, why: 'host-restarted', proof: proofOf(row, incarnation, request) };
}

/**
 * The handle-less receipts whose launch the host restart ended: {proven: [{row, proof, why}], kept: [{id, why}]}. No Orca or census read is made
 * for an empty set; an unreachable Orca or an unreadable table keeps every slot; a receipt whose host request the current runtime still knows
 * (completed or pending) is a launch it ran and stays held.
 */
export function restartedReleases(rows, io = {}) {
  if (!rows.length) return { proven: [], kept: [] };
  const incarnation = hostIncarnation(io);
  if (!incarnation.ok) return { proven: [], kept: rows.map((row) => ({ id: row.id, why: incarnation.why })) };
  const toleranceMs = allocationMs('providerReservation.restartToleranceMs');
  const verdicts = rows.map((row) => verdictOf(row, incarnation, io, toleranceMs));
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
