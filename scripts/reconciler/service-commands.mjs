// service-commands.mjs — the `services.mjs` CLI verbs that act on one named service row.

/** Print `value`, and mark the process failed when it is not ok. */
export function outcomeOf(out, value) {
  out(value);
  if (!value.ok) process.exitCode = 1;
}

/** `--reopen <name>`: put a quarantined row back to `declared` with a clean restart history. */
export function reopenCommand(store, a, out) {
  const rec = store.get(a.reopen);
  if (!rec) { out({ ok: false, error: `no row ${a.reopen}` }); process.exitCode = 1; return; }
  store.put({ ...rec, state: 'declared', since: Date.now(), restarts: [], failStreak: 0, nextAttemptAt: null, reopenedAt: Date.now() });
  return out({ ok: true, reopened: a.reopen, was: rec.state });
}

/** `--probe <name>`: run one registry entry's probe. */
export async function probeCommand(registry, a, out) {
  const entry = registry.find((e) => e.name === a.probe);
  if (!entry) { out({ ok: false, error: `no service ${a.probe}` }); process.exitCode = 1; return; }
  return out({ ok: true, name: a.probe, probe: await entry.probe() });
}
