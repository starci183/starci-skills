// worker-context.mjs — the thread a module runs on: whether it is the main thread and, inside a worker thread, the
// port to its parent and the data it was started with.
import { isMainThread, parentPort, workerData } from 'node:worker_threads';

/** {isMainThread, parentPort, workerData} of the calling thread (parentPort and workerData are null on the main thread). */
export const workerContext = () => ({ isMainThread, parentPort, workerData });
