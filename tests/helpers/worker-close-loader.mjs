const owner = new URL('../../scripts/machine/worker-close.mjs', import.meta.url).href;
const shim = new URL('./worker-close-shim.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return result.url === owner && context.parentURL !== shim ? { url: shim, shortCircuit: true } : result;
}
