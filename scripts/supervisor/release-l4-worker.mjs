// release-l4-worker.mjs - the body of a worker thread that runs ONE blocking release task (a plan step or the Linux parity container) so the cut's other rows keep running beside it
// (scripts/supervisor/release-l4-offload.mjs starts it). The task and its plain-data payload come in `workerData`; the result goes back as the one message.
import { workerContext } from '../api/node/worker-context.mjs';
import { scheduleSettings } from './release-l4-schedule.mjs';
import { prepareSelect } from './release-l4-offload.mjs';

async function runTask({ task, payload }) {
  if (task === 'step') return (await import('./push-git.mjs')).runStep(payload.step, payload.options);
  if (task === 'parity') {
    const { runParity } = await import('./release-linux-parity.mjs');
    return runParity(payload.repo, { apps: () => payload.apps, specs: payload.specs, ...(payload.prepareOnly ? { select: prepareSelect(scheduleSettings().parityPrepareUntil) } : {}) });
  }
  throw new Error(`release worker: unknown task ${task}`);
}

const { parentPort, workerData } = workerContext();
parentPort.postMessage(await runTask(workerData));
