// service-events.mjs — the machine.sqlite rows one Host service record write leaves behind: its service_events and its probe.

/** The service_events of one put: a row per fresh restart, else one transition row when the state changed. */
export function recordServiceEvents(m, { name, at, state, fromState, fresh, lastProbe }) {
  for (const t of fresh) m.insert('service_events', { name, at: t, from_state: fromState, to_state: state, action: 'restart' });
  if (!fresh.length && fromState !== state) {
    const action = state === 'quarantined' ? 'quarantine' : (fromState === 'quarantined' && 'release') || null;
    m.insert('service_events', { name, at, from_state: fromState, to_state: state, action, probe_error: lastProbe?.ok === false ? String(lastProbe?.error ?? '').slice(0, 500) || null : null });
  }
}

/** The probe row of a put whose probe is newer than the stored one. */
export function recordNewProbe(m, name, probe, storedProbe) {
  if (probe && Number.isFinite(Number(probe.at)) && Number(probe.at) !== Number(storedProbe?.at)) {
    m.recordProbe({ name, ok: probe.ok === true, latencyMs: Number.isFinite(Number(probe.ms ?? probe.latencyMs)) ? Number(probe.ms ?? probe.latencyMs) : null, detail: probe });
  }
}
