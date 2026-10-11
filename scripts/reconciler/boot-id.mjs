// boot-id.mjs — which host boot an engine process started in. The instant the host booted is now minus its uptime; two engine
// starts within one boot name nearly the same instant (the uptime clock and the wall clock differ by a second at most), and a
// reboot names a later one. `starci debug digest` reads the `reconciler.boot` rows to tell a restart of the host from a restart
// of the engine alone.
import os from 'node:os';
import { createHash } from 'node:crypto';

const MS_PER_MINUTE = 60_000;

/** {bootAt, uptimeMs, bootId} of the host at `now`; bootId is the minute the host booted in, hashed, so a log line can name it. */
export function bootIdentity({ now = Date.now(), uptimeSec = os.uptime() } = {}) {
  const uptimeMs = Math.round(uptimeSec * 1000);
  const bootAt = now - uptimeMs;
  const bootId = createHash('sha256').update(String(Math.floor(bootAt / MS_PER_MINUTE))).digest('hex').slice(0, 12);
  return { bootAt, uptimeMs, bootId };
}
