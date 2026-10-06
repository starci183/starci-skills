export function legStatusColorOf({ noRows, inFlight, unresolved, failedRetry, queued, ownerWait, succeeded, rework }) {
  if (noRows()) return 'gray';
  if (inFlight()) return 'yellow';
  if (unresolved()) return 'red';
  if (failedRetry()) return 'red';
  if (queued() || ownerWait()) return 'yellow';
  if (succeeded()) return rework() ? 'red' : 'green';
  return 'red';
}

export function deferredFieldOf(deferred, hasPlanDeferral, plannedReason) {
  if (deferred) return { deferred };
  if (hasPlanDeferral()) return { deferred: plannedReason() };
  return {};
}
