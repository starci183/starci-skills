const install = new URL('../../scripts/machine/npm-ci.mjs', import.meta.url).href;
const host = new URL('../../scripts/api/node/exec-node.mjs', import.meta.url).href;
const workflow = new URL('../../scripts/kernel/workflow-startup.mjs', import.meta.url).href;
const shim = new URL('./workflow-startup-shim.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return context.parentURL !== shim && (result.url === install || result.url === host && context.parentURL === workflow)
    ? { url: shim, shortCircuit: true } : result;
}
