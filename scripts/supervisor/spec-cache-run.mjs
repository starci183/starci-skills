// spec-cache-run.mjs - the cache in front of the spec runner of `starci test affected --run`: a spec whose key holds a record of a green run is REUSED (no process), any other spec runs for real and a pass is recorded.
// A key that cannot be computed (no git, an unreadable tree) turns the cache off for the run and says so; it never turns into a reuse. `--no-cache` runs every file.
import { openSpecCache } from './spec-cache.mjs';
import { createKeyer } from './spec-cache-key.mjs';

/**
 * `runOne(file)` wrapped in the cache: -> {runOne, off}. `off` is why the cache is not in use ('--no-cache' or the key error), else null. A reused result is
 * {file, pass: true, ms: 0, reused: true, provenAt, tier, tail: [], failedTests: 0}; a real one carries its `tier`.
 */
export function withSpecCache({ root, files, policy, preloads, disabled = false, deps = {}, runOne }) {
  if (disabled) return { runOne, off: '--no-cache' };
  try {
    const cache = deps.specCache ?? openSpecCache({ root, keepDays: policy.specCache.keepDays });
    cache.prune();
    const keyer = (deps.createKeyer ?? createKeyer)({ root, preloads, generated: policy.generated });
    const keys = new Map(files.map((file) => [file, keyer.keyOf(file)]));
    return {
      off: null,
      async runOne(file) {
        const { key, tier } = keys.get(file);
        const hit = cache.lookup(key);
        if (hit) return { file, pass: true, ms: 0, tail: [], failedTests: 0, reused: true, provenAt: hit.at, tier };
        const result = await runOne(file);
        if (result.pass) cache.record(key, { file, tier, ms: result.ms });
        return { ...result, tier };
      },
    };
  } catch (error) {
    return { runOne, off: `the cache key could not be computed (${String(error?.message ?? error).slice(0, 120)})` };
  }
}
