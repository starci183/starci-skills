// runtime-deploy-verify.mjs - what a deploy proves after the engine restart, from the stores and nothing else:
//   - the engine leader reports the new revision, with a heartbeat written after the restart and still fresh, and it is a new process;
//   - every controller is in the mode it was in before;
//   - no seat is dead, stale, quarantined or being replaced that was not before: the restart killed none.
import { repeatInOrder } from '../lib/in-order.mjs';
import { sleep as sleepFor } from '../lib/sleep.mjs';

const DOWN_SEATS = Object.freeze(['dead', 'stale', 'quarantined', 'replacing']);

/** What the verification compares against: the leader, the effective controller modes and the seat states, read from an open machine store. */
export const snapshotOf = (machine, leader) => ({
  pid: leader.pid ?? null, epoch: leader.epoch ?? null, rev: leader.rev ?? null,
  modes: machine.controllerModes(), seats: Object.fromEntries(machine.seats().map((seat) => [seat.seat_id, seat.state])),
});

/** The problems of `after` against `before` for a deploy of `sha` restarted at `restartedAt`: [] when the host is whole. */
export function verifyProblems({ before, after, leader, sha, restartedAt }) {
  const problems = [];
  if (!leader.fresh || (leader.heartbeatAt ?? 0) < restartedAt) problems.push('the engine has no fresh heartbeat written after the restart');
  else if (leader.rev !== sha) problems.push(`the engine leader reports revision ${String(leader.rev).slice(0, 12)}, not ${sha.slice(0, 12)}`);
  if (leader.pid != null && leader.pid === before.pid) problems.push('the engine leader is still the process that ran before the restart');
  for (const [controller, mode] of Object.entries(before.modes)) {
    if (after.modes[controller] !== mode) problems.push(`controller ${controller} is ${after.modes[controller] ?? 'absent'}, it was ${mode}`);
  }
  for (const [seat, state] of Object.entries(after.seats)) {
    if (DOWN_SEATS.includes(state) && !DOWN_SEATS.includes(before.seats[seat])) problems.push(`seat ${seat} is ${state}, it was ${before.seats[seat] ?? 'absent'}`);
  }
  return problems;
}

/**
 * Reads the host until it is whole or `verifyMs` has passed: {ok, problems, waitedMs}. `read()` returns {leader, after}.
 */
export async function verifyRestart({ read, before, sha, restartedAt, verifyMs, pollMs, now = Date.now, sleep = sleepFor }) {
  const start = now();
  return repeatInOrder(async () => {
    const seen = read();
    const problems = verifyProblems({ before, after: seen.after, leader: seen.leader, sha, restartedAt });
    if (!problems.length || now() - start >= verifyMs) return { ok: problems.length === 0, problems, waitedMs: now() - start, leader: seen.leader };
    await sleep(pollMs);
    return undefined;
  });
}
