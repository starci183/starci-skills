// pinned.mjs - RT_PINNED_PATH_MOVED (rule R124 of knowledge/hfs/rules.yaml, gate runtime): a pinned path
// (ruleParams.runtime.pinned: persisted outside git in hooks, settings, the scheduled task, prompts) exists.
// Pure: the tracked files come in through ctx.
export const CODES = Object.freeze({ pinned: 'RT_PINNED_PATH_MOVED' });

/** True when `p` (a file, or a directory ending in /) is tracked under `files` / `fileSet`. */
const tracked = (ctx, p) => {
  const clean = p.replace(/\/+$/, '');
  return ctx.fileSet.has(clean) || ctx.files.some((f) => f.startsWith(`${clean}/`));
};

/** RT_PINNED_PATH_MOVED findings. */
export function pinnedFindings(ctx) {
  const found = [];
  for (const pin of ctx.params.pinned) {
    if (/<[^>]+>/.test(pin.path) || tracked(ctx, pin.path)) continue;
    found.push({ code: CODES.pinned, level: 'error', path: pin.path, message: `${pin.path} is pinned (${pin.why}) but is gone` });
  }
  return found;
}
