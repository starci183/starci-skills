// supervisor-sign-of-life.mjs — when the Supervisor seat last showed it is working. The seat row's last_seen_at is written once, at boot, and nothing
// refreshes it; the seat's own acts are on record: a Supervisor decision (sup_decisions, decider supervisor) and the action the verb logged
// (machine_logs, kind supervisor.action). The digest reads the newest of these, so a seat that answered three items in one minute is not "seen 270 minutes ago".

/** The newest of the seat row's last_seen_at, the Supervisor's latest decision and its latest logged action (epoch ms), or null when none is on record. `ask(sql, args)` returns rows. */
export function supervisorLastSeenAt(seatLastSeenAt, ask) {
  const decided = ask("SELECT MAX(decided_at) AS at FROM sup_decisions WHERE decider='supervisor'")[0]?.at ?? null;
  const logged = ask("SELECT MAX(at) AS at FROM machine_logs WHERE kind='supervisor.action'")[0]?.at ?? null;
  const times = [seatLastSeenAt, decided, logged].filter((at) => at != null).map(Number).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}
