// sleep-sync.mjs — the blocking wait synchronous code (lock polls, retry backoff) uses.

/** Block the thread for `ms` milliseconds. */
export const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
