/** The display verdict of a workflow that is not running. */
const nonRunningState = (phase, phaseUi, phaseReason) => ({
  ui: phaseUi ?? (phase === 'paused' || phase === 'queued' || phase === 'awaiting-approval' ? 'waiting' : 'done'),
  reason: phaseReason ? { code: 'PHASE_REASON', params: { phase }, raw: phaseReason } : { code: `PHASE_${String(phase).toUpperCase().replaceAll('-', '_')}`, params: {} } });

/** The first 'bad' gate a running workflow hits, or null. */
const badGate = ({ openDIs, openViolations, seat, running, open, quietSince, now, supervisorGraceMs }) => {
  if (openDIs.some(row => row.decider === 'owner' && ['open', 'claimed', 'escalated'].includes(row.status))) {
    return { ui: 'bad', reason: { code: 'OWNER_DECISION_OPEN', params: {} } };
  }
  if (seat && ['dead', 'empty'].includes(seat.state)) {
    return { ui: 'bad', reason: { code: 'SEAT_VACANT', params: { state: seat.state } } };
  }
  if (openViolations.some(row => row.severity === 'critical' && (row.ui === 'bad' || row.violated_at != null))) {
    return { ui: 'bad', reason: { code: 'SLA_CRITICAL', params: {} } };
  }
  if ((running === 0 && open > 0) || (quietSince != null && now - quietSince > supervisorGraceMs)) {
    return { ui: 'bad', reason: { code: 'STALLED', params: { running, open } } };
  }
  return null;
};

/** One ordered workflow display verdict for the Kernel controller and the read-only UI. */
export function workflowStateOf(progress, {
  openDIs = [], openViolations = [], seat = null, phaseUi = null,
  now = Date.now(), supervisorGraceMs = 3_600_000,
} = {}) {
  const phase = progress.phase;
  if (phase !== 'running') return nonRunningState(phase, phaseUi, progress.phaseReason);

  const total = Number(progress.unitsTotal ?? progress.units_total ?? 0);
  const done = Number(progress.unitsDone ?? progress.units_done ?? 0);
  const dropped = Number(progress.unitsDropped ?? progress.units_dropped ?? 0);
  const open = Math.max(0, total - done - dropped);
  if (open === 0) return { ui: 'done', reason: null };

  const running = Number(progress.running ?? progress.unitsActive ?? progress.units_active ?? 0);
  const lastUnitAt = progress.lastUnitAt ?? progress.last_unit_at ?? null;
  const startedAt = progress.startedAt ?? progress.createdAt ?? null;
  const quietSince = lastUnitAt ?? startedAt;
  const bad = badGate({ openDIs, openViolations, seat, running, open, quietSince, now, supervisorGraceMs });
  if (bad) return bad;

  const rate = Number(progress.ratePerHour ?? 0);
  const minRate = progress.minRatePerHour == null ? null : Number(progress.minRatePerHour);
  if (minRate != null && rate < minRate) {
    return { ui: 'warn', reason: { code: 'SLOW', params: { ratePerHour: rate, minRatePerHour: minRate } } };
  }
  const queuedReady = Number(progress.queuedReady ?? 0);
  const allowedParallel = progress.allowedParallel == null ? null : Number(progress.allowedParallel);
  if (queuedReady > 0 && allowedParallel != null && running < allowedParallel) {
    return { ui: 'warn', reason: { code: 'UNDER_DISPATCHED', params: { running, allowedParallel, queuedReady } } };
  }
  return { ui: 'running', reason: null };
}
