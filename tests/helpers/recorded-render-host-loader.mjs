// Record readiness only at dispatch/status; rendering keeps its real tool API.
const consumer = new URL('../../scripts/kernel/host-capabilities.mjs', import.meta.url).href;
const actual = new URL('../../scripts/work/render-tools.mjs', import.meta.url).href;
const recorded = new URL('./recorded-render-host-shim.mjs', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return context.parentURL === consumer && result.url === actual
    ? { url: recorded, shortCircuit: true } : result;
}
