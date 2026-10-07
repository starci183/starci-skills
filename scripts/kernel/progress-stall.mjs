// progress-stall.mjs - the stall reasons and the ETA of one workflow's progress block (progress-rca.mjs progressOf).
export const HOUR = 3_600_000;

/** The earlier of two `since` times, either of which may be absent (null). */
const earlierSince = (a, b) => (a == null ? b : Math.min(a, b));

/** Queued-ready units wait while slots are free: {line, since} or null. */
const underDispatched = ({ core, queuedReady, running, allowed, now }) => {
  const readySince = (core.stuck ?? []).filter((s) => s.kind === 'queued-ready').map((s) => Number(s.since)).filter(Number.isFinite);
  if (queuedReady > 0 && running < allowed) {
    return {
      line: `under-dispatched: ${running} running of ${allowed} allowed with ${queuedReady} queued-ready`,
      since: readySince.length ? Math.min(...readySince) : now,
    };
  }
  return null;
};

/** The completion rate stays under the workflow's floor past the grace window: {line, since} or null. */
const slowRate = ({ now, remaining, minRate, unitsPerHour, priority, lastDoneAt, quietSince, graceMs }) => {
  if (remaining > 0 && minRate > 0 && unitsPerHour < minRate && now - quietSince >= graceMs) {
    const lastAgo = lastDoneAt ? Math.round((now - lastDoneAt) / 60_000) + 'm ago' : 'never';
    return { line: `slow: ${unitsPerHour} units/h < ${minRate}/h${priority ? ' (priority workflow)' : ''}, last unit ${lastAgo}`, since: quietSince };
  }
  return null;
};

/** Reported jobs wait on the Kernel's settle decision: {line, since} or null. */
const awaitingSettle = ({ unsettled }) => {
  if (!unsettled.length) return null;
  return {
    line: `needs-kernel-decision: ${unsettled.length} reported job(s) wait on the Kernel's settle decision (their slots stay held)`,
    since: Math.min(...unsettled.map((r) => Number(r.created_at))),
  };
};

/** The stall reasons of one workflow and the earliest `since` they implicate. */
export const stallOf = (input) => {
  const reasons = [];
  let since = null;
  for (const stall of [underDispatched(input), slowRate(input), awaitingSettle(input)]) {
    if (!stall) continue;
    reasons.push(stall.line);
    since = earlierSince(since, stall.since);
  }
  const { remaining, failedUnits, doneCount } = input;
  if (failedUnits > 0 && failedUnits >= doneCount && remaining > 0) reasons.push(`failing: ${failedUnits} unit(s) parked failed vs ${doneCount} done`);
  return { reasons, since };
};

/** The ETA of the remaining units: {etaHours, eta} (0/now when nothing remains, null when the rate is dead). */
export const etaOf = (remaining, etaRate, now) => {
  if (remaining === 0) return { etaHours: 0, eta: new Date(now).toISOString() };
  if (etaRate <= 0) return { etaHours: null, eta: null };
  return { etaHours: Math.round(remaining / etaRate * 10) / 10, eta: new Date(now + remaining / etaRate * HOUR).toISOString() };
};
