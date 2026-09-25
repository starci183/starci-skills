// host-outage.mjs — what a kernel terminal probe proves, with an Orca outage
// kept apart from a dead kernel.
//
// 2026-09-24 02:37: Orca auto-updated (1.4.188 -> 1.4.209) and restarted. For
// about a minute every CLI call answered runtime_unavailable or failed to spawn
// orca.exe (ENOENT) while the terminal daemon kept every kernel alive. The
// watchdogs read `terminal show` failing as a dead kernel: start-workflow
// cleared five kernel seats (job stopped, signal deleted) and failed to launch
// into the outage, and a sixth launched a second kernel beside the live one.
// A kernel is dead only when a RESPONDING Orca says so, twice.
//
// kernelTerminalVerdict -> {verdict, shown, reason, errorCode}
//   live              connected + writable on a responding host
//   host-unavailable  Orca did not answer (runtime_unavailable, ENOENT, timeout)
//   gone              a responding Orca does not know the handle
//   disconnected      a responding Orca lists the terminal disconnected/unwritable
//   unverified        Orca answered something else and the listing cannot settle it
// Only gone/disconnected may lead to a replacement.
import { terminalShow as defaultShow, TERMINAL_GONE_CODES } from '../api/orca/terminal-show.mjs';
import { terminalList as defaultList } from '../api/orca/terminal-list.mjs';
import { sleepSync } from '../api/orca/lib.mjs';
import { allocationMs } from '../../engine/config.mjs';

// The windows are modules/models/runtimes.yaml allocation.hostOutage; the env names are a spec's seam.
const envMs = (name, key) => {
  const declared = allocationMs(key), value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : declared;
};
// How long one watchdog tick waits for an unavailable Orca to answer again.
export const HOST_WAIT_MS = envMs('STARCI_HOST_WAIT_MS', 'hostOutage.waitMs');
// A responding Orca that calls the kernel dead is asked again after this long:
// an Orca app that just restarted re-attaches its panes to the daemon.
export const DEATH_SETTLE_MS = envMs('STARCI_KERNEL_DEATH_SETTLE_MS', 'hostOutage.deathSettleMs');
export const DEAD_VERDICTS = new Set(['gone', 'disconnected']);

export function kernelTerminalVerdict(terminal, { show = defaultShow, list = defaultList } = {}) {
  if (!terminal) return { verdict: 'gone', shown: null, reason: 'no terminal handle', errorCode: null };
  const shown = show({ terminal });
  if (shown.hostUnavailable)
    return { verdict: 'host-unavailable', shown, errorCode: shown.errorCode ?? null,
      reason: `host-unavailable: ${shown.error || shown.errorCode || 'Orca did not answer'}` };
  if (shown.ok && shown.connected && shown.writable) return { verdict: 'live', shown, reason: 'terminal connected', errorCode: null };
  if (shown.ok) return { verdict: 'disconnected', shown, errorCode: null,
    reason: shown.exitCause ? `terminal disconnected (${shown.exitCause})` : 'terminal disconnected' };
  if (TERMINAL_GONE_CODES.has(shown.errorCode)) return { verdict: 'gone', shown, reason: shown.errorCode, errorCode: shown.errorCode };
  // Any other refusal: the listing decides, and an unreadable listing proves nothing.
  const listed = list();
  if (listed?.hostUnavailable)
    return { verdict: 'host-unavailable', shown, errorCode: shown.errorCode ?? null,
      reason: `host-unavailable: ${listed.error || 'terminal list did not answer'}` };
  if (!listed?.ok)
    return { verdict: 'unverified', shown, errorCode: shown.errorCode ?? null,
      reason: `terminal show and terminal list both failed: ${shown.error || shown.errorCode || 'no reason'}` };
  const row = (listed.terminals ?? []).find((t) => t?.handle === terminal);
  if (!row) return { verdict: 'gone', shown, errorCode: shown.errorCode ?? null, reason: 'terminal not in the Orca listing' };
  if (row.connected !== false && row.writable !== false)
    return { verdict: 'live', shown: { ...shown, ok: true, terminal: row, connected: true, writable: true }, reason: 'terminal listed connected', errorCode: null };
  return { verdict: 'disconnected', shown, errorCode: shown.errorCode ?? null, reason: 'terminal listed disconnected' };
}

/**
 * Wait with backoff (1s, 2s, 4s ... capped at 15s) until Orca answers a
 * terminal listing again, for at most `waitMs`. {available, waitedMs, probes}.
 */
export function awaitOrcaHost({ waitMs = HOST_WAIT_MS, list = defaultList, sleep = sleepSync } = {}) {
  let waited = 0, delay = 1000, probes = 0;
  for (;;) {
    probes += 1;
    const listed = list();
    if (!listed?.hostUnavailable) return { available: true, waitedMs: waited, probes };
    if (waited >= waitMs) return { available: false, waitedMs: waited, probes, error: listed?.error ?? null };
    const step = Math.min(delay, waitMs - waited);
    sleep(step);
    waited += step;
    delay = Math.min(delay * 2, 15_000);
  }
}

/**
 * The verdict a replacement may act on: an outage is waited out and the probe
 * repeated once Orca answers; a death is confirmed by a second probe after
 * `settleMs`. Returns the final verdict plus `hostWait` / `confirmed` notes.
 */
export function settledKernelVerdict(terminal, { waitMs = HOST_WAIT_MS, settleMs = DEATH_SETTLE_MS,
  show = defaultShow, list = defaultList, sleep = sleepSync } = {}) {
  let result = kernelTerminalVerdict(terminal, { show, list });
  let hostWait = null;
  if (result.verdict === 'host-unavailable') {
    hostWait = awaitOrcaHost({ waitMs, list, sleep });
    if (!hostWait.available) return { ...result, hostWait };
    result = kernelTerminalVerdict(terminal, { show, list });
    if (result.verdict === 'host-unavailable') return { ...result, hostWait };
  }
  if (!DEAD_VERDICTS.has(result.verdict)) return { ...result, ...(hostWait ? { hostWait } : {}) };
  if (settleMs > 0) sleep(settleMs);
  const again = kernelTerminalVerdict(terminal, { show, list });
  return { ...again, ...(hostWait ? { hostWait } : {}), confirmed: DEAD_VERDICTS.has(again.verdict), firstVerdict: result.verdict };
}
