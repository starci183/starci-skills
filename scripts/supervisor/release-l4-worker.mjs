// release-l4-worker.mjs - the body of a worker thread that runs ONE blocking release task (a plan step or the Linux parity container) so the cut's other rows keep running beside it
// (scripts/supervisor/release-l4-offload.mjs starts it). The task and its plain-data payload come in `workerData`; the result goes back as the one message.
import { workerContext } from '../api/node/worker-context.mjs';

async function runTask({ task, payload }) {
  if (task === 'step') return (await import('./push-git.mjs')).runStep(payload.step, payload.options);
  if (task === 'parity') {
    const { runParity } = await import('./release-linux-parity.mjs');
    return runParity(payload.repo, { apps: () => payload.apps });
  }
  if (task === 'examples-lint') {
    const { runExamplesLint } = await import('./release-examples-lint.mjs');
    return runExamplesLint(payload.repo, { apps: () => payload.apps });
  }
  throw new Error(`release worker: unknown task ${task}`);
}

const { parentPort, workerData } = workerContext();
parentPort.postMessage(await runTask(workerData));
