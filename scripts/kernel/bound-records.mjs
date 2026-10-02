// bound-records.mjs — the bound-path scan the kernel's record checks share: which of a job's `bindings`
// (payload.owned_paths entries or record refs) name a record under a `.starciwork` tree, and where that
// tree sits inside the path.

import { normRel } from '../lib/path-key.mjs';

export const WORK_ROOT = '.starciwork';

/** The non-empty, non-`.` segments of a slashed path. */
export const segments = (value) => value.split('/').filter((part) => part && part !== '.');

/**
 * The `.starciwork` record paths `bindings` name that reach `kind` ('ui', 'impl', ...), as
 * {record (the slashed path), parts (its segments), workParts (the segments through .starciwork)},
 * in binding order; `unique` keeps one yield per record path.
 */
export function* boundRecordPaths(bindings, kind, { unique = true } = {}) {
  const seen = new Set();
  for (const binding of bindings) {
    const parts = segments(normRel(binding));
    const at = parts.indexOf(WORK_ROOT);
    if (at < 0 || !parts.slice(at + 1).includes(kind)) continue;
    const record = parts.join('/');
    if (unique && seen.has(record)) continue;
    seen.add(record);
    yield { record, parts, workParts: parts.slice(0, at + 1) };
  }
}
