// retired.mjs - two laws over modules/kernel/retired-paths.yaml (knowledge/hfs/rules.yaml, gate runtime).
//   RT_RETIRED_PRESENT    no path of retired[] and no `from` of moved[] is tracked again, and no symbol of retiredSymbols[] is
//                         declared in runtime production code: what was replaced (the Orca built-in replacements included)
//                         stays replaced
//   RT_PINNED_PATH_MOVED  a pinned path (ruleParams.runtime.pinned: persisted outside git in hooks, settings, the scheduled
//                         task, prompts) exists, or it moved through a moved[] entry marked `quiesced: true` (landed with the
//                         fleet stopped); a moved[] entry from a pinned path without `quiesced: true` is refused
// Pure: the registry, the tracked files and the parsed sources come in through ctx.
import { globExpression } from '../../lib/glob.mjs';
import { declaredNames } from './source-ast.mjs';

export const CODES = Object.freeze({ retired: 'RT_RETIRED_PRESENT', pinned: 'RT_PINNED_PATH_MOVED' });
export const RETIRED_PATHS_FILE = 'modules/kernel/retired-paths.yaml';

/** The rows of moved[] as [from, to] pairs; a `from` ending in / moved a directory and everything below it. */
const pairsOf = (moved) => (moved ?? []).filter((m) => m?.from && m?.to).map((m) => [String(m.from), String(m.to)]);
/** Maps `p` through the first row whose side `a` covers it (exactly, or below a directory row) to side `b`. */
const through = (pairs, p, a, b) => {
  for (const pair of pairs) {
    const from = pair[a];
    if (from === p) return pair[b];
    if (from.endsWith('/') && pair[b].endsWith('/') && p.startsWith(from)) return `${pair[b]}${p.slice(from.length)}`;
  }
  return null;
};
/** (path) -> its new path under moved[], or null when it did not move. */
export const movedTo = (moved) => { const pairs = pairsOf(moved); return (p) => through(pairs, p, 0, 1); };
/** (path) -> the old path a moved file had, or null when it did not move here. */
export const movedFrom = (moved) => { const pairs = pairsOf(moved); return (p) => through(pairs, p, 1, 0); };

/** True when `p` (a file, or a directory ending in /) is tracked under `files` / `fileSet`. */
const tracked = (ctx, p) => {
  const clean = p.replace(/\/+$/, '');
  return ctx.fileSet.has(clean) || ctx.files.some((f) => f.startsWith(`${clean}/`));
};

/** RT_RETIRED_PRESENT findings. */
export function retiredFindings(ctx) {
  const { retired = [], moved = [], retiredSymbols = [] } = ctx.retiredPaths;
  const found = [];
  for (const entry of retired) {
    if (entry?.path && tracked(ctx, entry.path)) found.push({ code: CODES.retired, level: 'error', path: entry.path, message: `${entry.path} is retired (${RETIRED_PATHS_FILE}${entry.replacedBy ? `: ${entry.replacedBy}` : ''}) but is tracked again: delete it, or remove the registry entry in the commit that deliberately restores it` });
  }
  for (const entry of moved) {
    if (entry?.from && tracked(ctx, entry.from)) found.push({ code: CODES.retired, level: 'error', path: entry.from, message: `${entry.from} moved to ${entry.to} (${RETIRED_PATHS_FILE} moved[], ${entry.movedIn}) but is tracked again: no alias or forwarding copy is left behind` });
  }
  const symbols = new Map(retiredSymbols.filter((s) => s?.symbol).map((s) => [s.symbol, s]));
  if (symbols.size) {
    for (const { path: file, text } of ctx.sources) {
      if (![...symbols.keys()].some((name) => text.includes(name))) continue;
      for (const { name, line } of declaredNames(ctx.parsed(file))) {
        const s = symbols.get(name);
        if (s) found.push({ code: CODES.retired, level: 'error', path: file, line, message: `${file}:${line} declares ${name}, a retired symbol (${RETIRED_PATHS_FILE} retiredSymbols: replaced by ${s.replacedBy}): use the replacement, do not write it again` });
      }
    }
  }
  return found;
}

/** RT_PINNED_PATH_MOVED findings. */
export function pinnedFindings(ctx) {
  const { moved = [] } = ctx.retiredPaths;
  const found = [];
  const pins = ctx.params.pinned.map((p) => ({ ...p, pattern: /<[^>]+>/.test(p.path) ? globExpression(p.path.replace(/<[^>]+>/g, '*')) : null }));
  const isPinned = (p) => pins.find((pin) => (pin.pattern ? pin.pattern.test(p) : pin.path === p));
  for (const pin of pins) {
    if (pin.pattern || tracked(ctx, pin.path)) continue;
    const via = moved.find((m) => m?.from === pin.path);
    if (!via) found.push({ code: CODES.pinned, level: 'error', path: pin.path, message: `${pin.path} is pinned (${pin.why}) but is gone and no ${RETIRED_PATHS_FILE} moved[] entry records where it went` });
  }
  for (const entry of moved) {
    const pin = entry?.from && isPinned(entry.from);
    if (pin && entry.quiesced !== true) found.push({ code: CODES.pinned, level: 'error', path: entry.from, message: `${entry.from} is pinned (${pin.why}) and moved to ${entry.to} without quiesced: true: a pinned path moves only in a land with the fleet stopped (chunk C7/C8), then the persisted copies are rewritten` });
  }
  return found;
}
