// This replay models fake Orca resource processes separately from real CLI/helper child hygiene.
import { resolve as workerResolve } from './worker-close-loader.mjs';
const api = new URL('../../scripts/api/process/process-env.mjs', import.meta.url).href;
const consumer = new URL('../../scripts/machine/workflow-purge-apply.mjs', import.meta.url).href;
const shim = new URL('./purge-process-shim.mjs', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  const result = await workerResolve(specifier, context, nextResolve);
  return result.url === api && context.parentURL === consumer
    ? { url: shim, shortCircuit: true } : result;
}
