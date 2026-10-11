// Only the workflow startup host boundary is recorded; launch and install remain native.
const host = new URL('../../scripts/api/node/exec-node.mjs', import.meta.url).href;
const workflow = new URL('../../scripts/kernel/workflow-startup.mjs', import.meta.url).href;
const shim = new URL('./replay-kernel-host-shim.mjs', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return result.url === host && context.parentURL === workflow
    ? { url: shim, shortCircuit: true } : result;
}
