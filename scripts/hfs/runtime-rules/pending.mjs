// pending.mjs - the one allowlist of the runtime check, the `pending` list of knowledge/hfs/runtime-slots.yaml, and its
// ratchet (rule R123 of knowledge/hfs/rules.yaml, gate runtime).
//   an entry {path, rule, lane, since, reason} allows every finding whose code is `rule` and whose path its `path` glob
//   matches (`**`, `*`, `{a,b}`; a trailing / covers a directory): such a finding reports at level pending, never failing
//   RT_PENDING_STALE   an entry that allows no finding, or names a code no runtime rule reports: the debt is paid, delete it
//   RT_PENDING_ADDED   an entry that allows a finding the base revision's list did not allow (a path moved through
//                      modules/kernel/retired-paths.yaml moved[], a file or a whole directory, keeps its allowance): the
//                      list only shrinks, so a new
//                      violation is fixed, never listed
// Pure: the base revision's list comes in as `basePending` (null when the base has no runtime manifest: nothing to compare).
import { braceVariants, globExpression } from '../../lib/glob.mjs';

export const CODES = Object.freeze({ stale: 'RT_PENDING_STALE', added: 'RT_PENDING_ADDED' });

/** The matcher of one pending path glob. */
export function pendingMatcher(glob) {
  const variants = braceVariants(String(glob)).map((v) => (v.endsWith('/') ? { prefix: v } : { rx: globExpression(v) }));
  return (p) => Boolean(p) && variants.some((v) => (v.prefix ? p.startsWith(v.prefix) || `${p}/` === v.prefix : v.rx.test(p)));
}

/**
 * Judges `findings` against `pending`: {errors, allowed}. `errors` are the findings no entry allows plus the ratchet's own
 * findings; `allowed` are the findings an entry allows, each with level pending and the entry's lane and reason.
 * `codes` is the set of finding codes the runtime rules report; `oldPathOf` maps a moved path to its old one (null when it
 * did not move: scripts/hfs/runtime-rules/retired.mjs movedFrom).
 */
export function applyPending({ findings, pending = [], basePending = null, oldPathOf = () => null, codes, manifestFile = 'knowledge/hfs/runtime-slots.yaml' }) {
  const entries = pending.map((entry, index) => ({ entry, index, match: pendingMatcher(entry.path), used: 0, unbased: [] }));
  const base = basePending === null ? null : basePending.map((entry) => ({ entry, match: pendingMatcher(entry.path) }));
  const allowedByBase = (f) => base.some(({ entry, match }) => entry.rule === f.code && (match(f.path) || (oldPathOf(f.path) !== null && match(oldPathOf(f.path)))));
  const errors = [];
  const allowed = [];
  for (const f of findings) {
    const hit = f.level === 'error' ? entries.find((e) => e.entry.rule === f.code && e.match(f.path)) : null;
    if (!hit) { errors.push(f); continue; }
    hit.used += 1;
    if (base && !allowedByBase(f)) hit.unbased.push(f.path);
    allowed.push({ ...f, level: 'pending', lane: hit.entry.lane, since: hit.entry.since, reason: hit.entry.reason });
  }
  for (const e of entries) {
    const label = `pending[${e.index}] {path: ${e.entry.path}, rule: ${e.entry.rule}, lane: ${e.entry.lane}}`;
    if (codes && !codes.has(e.entry.rule)) errors.push({ code: CODES.stale, level: 'error', path: manifestFile, message: `${label} names ${e.entry.rule}, which no runtime rule reports: delete the entry` });
    else if (!e.used) errors.push({ code: CODES.stale, level: 'error', path: manifestFile, message: `${label} allows no finding any more: the debt is paid, delete the entry` });
    if (e.unbased.length) errors.push({ code: CODES.added, level: 'error', path: manifestFile, message: `${label} allows ${e.unbased.length} finding(s) the base revision's pending list did not allow (${e.unbased.slice(0, 3).join(', ')}${e.unbased.length > 3 ? ', ...' : ''}): the list only shrinks - fix the new violation instead of listing it` });
  }
  return { errors, allowed };
}
