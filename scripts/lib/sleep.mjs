// sleep.mjs — the waits a loop picks between: `sleep` yields the event loop (async code, polls and
// backoff in the connectors and the watchdog loops), `sleepSync` blocks the thread for synchronous
// code (lock polls, rename retry — the blocking twin lives in ./sleep-sync.mjs).
export { sleepSync } from './sleep-sync.mjs';

/** Resolve after `ms` milliseconds. */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
