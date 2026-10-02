// sleep-sync.mjs — the blocking wait synchronous code (lock polls, retry backoff) uses.

/**
 * Test seam: STARCI_SLEEP_SCALE (a number >= 0, default 1) multiplies every wait. A spec that drives a real
 * dispatch/boot against a fake host sets it small so the card's settle/attestation windows (seconds of pure
 * waiting, counted logically by their callers, not by the wall clock) cost milliseconds and the run no longer
 * depends on machine load. Unset in production.
 */
import { readEnv } from './env.mjs';
const scaleOf = () => {
  const raw = readEnv('STARCI_SLEEP_SCALE');
  if (raw === undefined || raw === '') return 1;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 1;
};

/** Block the thread for `ms` milliseconds (scaled by STARCI_SLEEP_SCALE). */
export const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.round(ms * scaleOf()));
