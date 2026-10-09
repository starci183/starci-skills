// affected-concurrency.mjs - the file limit of a long `starci test affected --run`, sampled again while it goes. The runner sampled the host ONCE at the start: a run that began while other lanes held the CPU
// resolved to 1 and stayed at 1 for hours although the host was free minutes later. `liveLimit` answers the current limit to the pool each time a file ends, re-reading the host at most every
// `resampleMs` (modules/supervisor/test-concurrency.yaml); an explicit --concurrency never changes. A failed sample keeps the last limit.
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { resolveTestConcurrency } from '../machine/test-concurrency.mjs';

/** The limit function for a run that began at `decision` (resolveTestConcurrency); `onChange(next, previous)` is told each change. */
export function liveLimit({ decision, deps = {}, onChange = () => {}, now = Date.now, intervalMs = readModuleJson('modules', 'supervisor', 'test-concurrency.yaml').resampleMs }) {
  let current = decision.concurrency;
  let sampledAt = now();
  return () => {
    if (decision.mode === 'explicit' || now() - sampledAt < intervalMs) return current;
    sampledAt = now();
    try {
      const sampled = resolveTestConcurrency(undefined, deps);
      if (sampled.reason) return current;
      if (sampled.concurrency !== current) onChange(sampled.concurrency, current);
      current = sampled.concurrency;
    } catch { /* keep the last limit */ }
    return current;
  };
}
