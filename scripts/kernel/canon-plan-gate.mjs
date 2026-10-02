// canon-plan-gate.mjs — the canon slice planner is mandatory (H6).
//
// A canon slice (code.refactor with params.canonFamilies, cut, not the canon-wire leg) that owns only the files with
// findings cannot make the moves its findings ask for: fe-canon settled 41 of 110 slices blocked, PATH_NOT_OWNED. The
// planner (scripts/kernel/cut-seam.mjs canonCutPlanOf) grants each slice the relocation destinations its findings need
// and gives contested destinations to the wave's wire leg. This module is the gate over that plan: the first try of a
// canon slice is admitted only with the canon-scan record it was cut from (--canon-scan), and only when its owned paths
// cover the plan's `owned` for its ordinal; api graph-edit recut enqueues through the plan and refuses a slice whose
// moves all landed on another slice (no fix target: it is cut again, never enqueued to block).
import fs from 'node:fs';
import { canonCutPlanOf } from './cut-seam.mjs';
import { sameOrUnder } from '../lib/path-key.mjs';

const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, '');
/** An owned path `q` (maybe repository-prefixed, e.g. todo-app-fe/apps/...) covers the scan-relative path `p`. */
const covers = (q, p) => { const a = norm(q), b = norm(p); return sameOrUnder(b, a) || a.endsWith(`/${b}`) || [...a.split('/').keys()].some((i) => sameOrUnder(b, a.split('/').slice(i).join('/'))); };

/** A canon slice's payload: cut + params.canonFamilies, and not its wire leg. */
export const isCanonSlice = ({ cut = null, params = null } = {}) => Boolean(cut && String(params?.canonFamilies ?? '').trim() && params?.canonWire !== true);

/** The canon-scan record at `file` (schema starci/canon-findings with slices), or a typed refusal. */
export function readCanonScan(file) {
  let scan;
  try { scan = JSON.parse(fs.readFileSync(String(file), 'utf8')); }
  catch (error) { throw Object.assign(new Error(`--canon-scan ${file} is not a readable canon-scan JSON record (${error.message})`), { code: 'canon-scan-invalid' }); }
  if (!Array.isArray(scan?.slices) || !String(scan?.schema ?? '').startsWith('starci/canon-findings')) {
    throw Object.assign(new Error(`--canon-scan ${file} is no canon-scan record (schema starci/canon-findings@1 with slices)`), { code: 'canon-scan-invalid' });
  }
  return scan;
}

/**
 * Slices of a plan with no fix target: a relocation their findings need was given to another slice or the wire and the
 * slice itself was granted nothing. [{ordinal, moves:[reason]}]
 */
export function unfixableSlicesOf(plan) {
  return plan.slices.flatMap((slice) => {
    if (slice.grants.length) return [];
    const moves = plan.wires.filter((w) => w.wave === slice.wave).flatMap((w) => w.reasons)
      .filter((r) => { const moving = /\s(\S+) -> /.exec(r)?.[1]; return moving && slice.paths.some((root) => sameOrUnder(norm(moving), norm(root))); });
    return moves.length ? [{ ordinal: slice.ordinal, moves }] : [];
  });
}

/**
 * The enqueue gate of a canon slice's first try: the plan of `scanFile` for `cut.id`, and the plan's owned paths of
 * `cut.ordinal` that `ownedPaths` misses. Throws canon-slice-unplanned (no scan), canon-slice-unknown (the ordinal is
 * not in the plan), canon-slice-no-fix-target or canon-slice-missing-grants.
 */
export function requirePlannedCanonSlice({ cut, ownedPaths, scanFile }) {
  if (!scanFile) {
    throw Object.assign(new Error(`a canon slice (params.canonFamilies, cut ${cut.id}#${cut.ordinal}) is enqueued from the canon plan: pass --canon-scan <the canon-scan --json record it was cut from> (node scripts/kernel/cut-seam.mjs canon-plan --scan <file> --cut-id ${cut.id} prints the commands)`), { code: 'canon-slice-unplanned' });
  }
  const plan = canonCutPlanOf(readCanonScan(scanFile), { cutId: cut.id });
  const slice = plan.slices.find((s) => Number(s.ordinal) === Number(cut.ordinal));
  if (!slice) throw Object.assign(new Error(`cut ordinal ${cut.ordinal} is not a slice of ${scanFile} (${plan.slices.length} slices)`), { code: 'canon-slice-unknown' });
  const unfixable = unfixableSlicesOf(plan).find((u) => Number(u.ordinal) === Number(cut.ordinal));
  if (unfixable) throw Object.assign(new Error(`canon slice ${cut.ordinal} has no fix target: its moves are held elsewhere (${unfixable.moves.slice(0, 3).join('; ')}); cut it again (api graph-edit --edit scan, then recut)`), { code: 'canon-slice-no-fix-target' });
  const missing = slice.owned.filter((p) => !ownedPaths.some((q) => covers(q, p)));
  if (missing.length) {
    throw Object.assign(new Error(`canon slice ${cut.ordinal} must own the plan's relocation destinations too (paths + grants): missing ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` +${missing.length - 8}` : ''}`), { code: 'canon-slice-missing-grants', missing });
  }
  return { plan: { scan: String(scanFile), cutId: String(cut.id), ordinal: Number(cut.ordinal), grants: slice.grants } };
}
