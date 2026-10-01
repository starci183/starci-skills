// start-worker.mjs — a node worker thread: `new Worker(file, options)` (a module URL or path, or eval source with
// {eval: true}). Returns the Worker; the caller listens for its messages, errors and exit.
import { Worker } from 'node:worker_threads';

/** Starts a worker thread on `file`; options (workerData, env, name, eval, execArgv, resourceLimits) pass through. */
export const startWorker = (file, options = {}) => new Worker(file, options);
