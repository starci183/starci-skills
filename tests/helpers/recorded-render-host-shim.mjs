// Dispatch readiness is recorded; no browser install or real capture is claimed.
export { RENDER_CAPABILITY_HINT, RENDER_TOOL_UNAVAILABLE, renderToolFix } from '../../scripts/work/render-tools.mjs';
export function renderToolStatus() {
  return { ok: true, missing: [], playwright: null, esbuild: null };
}
