const owners = new Set([
  new URL('../../scripts/reconciler/start.mjs', import.meta.url).href,
  new URL('../../scripts/machine/npm-ci.mjs', import.meta.url).href
]);
const shim = new URL('./workflow-startup-shim.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return owners.has(result.url) && context.parentURL !== shim ? { url: shim, shortCircuit: true } : result;
}
