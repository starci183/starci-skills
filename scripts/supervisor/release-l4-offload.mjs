// release-l4-offload.mjs - run one blocking release task (a plan step: spawnSync to a log file; the Linux parity container: docker run) in a worker thread, so the rows the schedule
// (release-l4-schedule.mjs) runs together really run together. The worker (release-l4-worker.mjs) calls the same runStep and runParity the sequential cut called, so a row keeps its own
// log, its own verdict and its own timing. Returns a promise of the task's result; a worker that dies without a result is an error.
import { Worker } from 'node:worker_threads';

/** Run `task` ('step' | 'parity') with the plain-data `payload` in a worker thread: a Promise of its result. */
export function offload(task, payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./release-l4-worker.mjs', import.meta.url), { workerData: { task, payload } });
    let answered = false;
    worker.once('message', (result) => { answered = true; resolve(result); });
    worker.once('error', reject);
    worker.once('exit', (code) => { if (!answered) reject(new Error(`release worker (${task}) ended with code ${code} and no result`)); });
  });
}

/** A plan step run in a worker: same arguments and result as runStep (scripts/supervisor/push-git.mjs). */
export const stepInWorker = (step, options) => offload('step', { step, options });

/** The Linux parity container run in a worker: same row as runParity (scripts/supervisor/release-linux-parity.mjs). `deps.prepareOnly` runs only the workflow steps the spec leg needs. */
export const parityInWorker = (repo, deps = {}) => offload('parity', { repo, apps: deps.apps?.(repo) ?? [], specs: deps.specs ?? [], prepareOnly: deps.prepareOnly === true });

/** The parity steps the spec leg prepares with: every workflow step before the first one that runs the declared marker (all steps when none does). */
export function prepareSelect(marker) {
  return (step, index, all) => {
    const stop = all.findIndex((candidate) => candidate.run.includes(marker));
    return stop < 0 || index < stop;
  };
}
