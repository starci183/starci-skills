// Concepts 3, 4 and 5 of check-work-consistency.mjs: what records claim about each other - conflicts, provers and
// gap closure. Each rule takes the tree context `{records, refuse, suspect, canon}`.
import { byCodeUnit } from '../../lib/list.mjs';
import { isList, shownFile } from './work-consistency-shared.mjs';

/** Every string anywhere inside `node`, in walk order, appended to `names`. */
function collectStrings(node, names) {
  if (typeof node === 'string') { names.push(node); return; }
  if (Array.isArray(node)) { node.forEach(item => collectStrings(item, names)); return; }
  if (node && typeof node === 'object') Object.values(node).forEach(item => collectStrings(item, names));
}

// ---- concept 3: a contradiction between two records needs a third to settle it ----
// conflictsWith says "these two cannot both be true". The layout's answer to that is a
// work/policy-decision@1 naming both sides (schemas list tension.records for exactly this). Two done records
// that contradict each other with no decision are a tree asserting a contradiction; the same pair with
// a todo side is only an honest outstanding conflict, so it is warned, not refused.
const decisionResolverOf = (records, leftId, rightId) => [...records.values()].find(candidate => {
  if (candidate.schema !== 'work/policy-decision@1') return false;
  if (candidate.data.outcome !== 'decided') return false;
  const names = [];
  collectStrings(candidate.data, names);
  return names.includes(leftId) && names.includes(rightId);
});

/** Why a pair of records declare each other impossible, in the words either side recorded. */
const becauseOf = (edge, other, id, canon) => String(edge.because ?? other.data.conflictsWith?.find(e => e?.record === id || (typeof e?.record === 'string' && canon(e.record) === id))?.because ?? '(no because recorded)').slice(0, 160);

function reportConflict({ records, refuse, suspect, canon }, { id, rec, edge, otherId }) {
  const other = records.get(otherId);
  const bothDone = rec.data.state === 'done' && other.data.state === 'done';
  if (decisionResolverOf(records, id, otherId)) return;
  const message = `${id} (${rec.data.state}) and ${otherId} (${other.data.state}) each declare the other impossible - `
    + `"${becauseOf(edge, other, id, canon)}" `
    + '- and no work/policy-decision@1 naming both sides settles it';
  const file = shownFile(rec);
  if (bothDone) refuse(file, 'CONFLICT_WITHOUT_DECISION', `${message}; two done records cannot both be true of the same product`);
  else suspect(file, 'CONFLICT_WITHOUT_DECISION', `${message}; neither side is done yet, so this is an open conflict rather than a contradiction`);
}

export function checkConflicts(ctx) {
  const { records, canon } = ctx;
  const settledPairs = new Set();
  for (const [id, rec] of records) {
    for (const edge of isList(rec.data.conflictsWith)) {
      const otherId = typeof edge?.record === 'string' ? canon(edge.record) : edge?.record;
      if (!otherId || !records.has(otherId)) continue; // dangling refs belong to the base gate
      const pairKey = [id, otherId].sort(byCodeUnit).join('|');
      if (settledPairs.has(pairKey)) continue;
      settledPairs.add(pairKey);
      reportConflict(ctx, { id, rec, edge, otherId });
    }
  }
}

// ---- concept 4: a prover that has not itself been proven ----
// check-example-work.mjs refuses the loud half of this (a done record proving a todo target). The quiet
// half is the asymmetry this tree actually lives with: a todo uat flow lists done requirements in its
// `proves`, and whatever derives the requirement's provenance from `proves` edges now says it is proven by
// a run that has not happened. The derived index classifies `proves` as an unclassified edge
// (scripts/example/example-derive.mjs's EDGE_FIELD_NAMES), so "is it in the derived provenance" would answer no for
// all 89 edges in both trees and mean nothing - the asymmetry worth naming is the state disagreement.
export function checkProvesAsymmetry({ records, suspect, canon }) {
  for (const [id, rec] of records) {
    if (rec.data?.state !== 'todo' || !Array.isArray(rec.data.proves)) continue;
    const doneTargets = rec.data.proves.filter(targetId => records.get(canon(targetId))?.data?.state === 'done');
    if (!doneTargets.length) continue;
    suspect(shownFile(rec), 'PROVES_ASYMMETRY',
      `${id} is todo but its proves names ${doneTargets.length} record(s) already done (${doneTargets.join(', ')}) - their provenance now rests on a prover that is not itself proven`);
  }
}

// ---- concept 5: gap closure claims ----
// The base gate covers a gap whose closers are not done. What nothing covers is the claim with no evidence
// attached to it at all: `state: done` with no `closedBy`, which reads as "this absence is filled" while
// naming nothing that filled it - and the mirror image, a gap still `todo` whose named closers are all
// done, which is either a stale gap or an overclaimed closer.
export function checkGapClosure({ records, suspect, canon }) {
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/gap@1') continue;
    const closers = isList(rec.data.closedBy);
    const file = shownFile(rec);
    if (rec.data.state === 'done' && !closers.length) {
      suspect(file, 'GAP_CLOSED_BY_NOTHING',
        `${id} records the gap as closed and names no closedBy - nothing in this tree says what closed it, so the claim is unfalsifiable`);
    }
    if (rec.data.state === 'todo' && closers.length && closers.every(closerId => records.get(canon(closerId))?.data?.state === 'done')) {
      suspect(file, 'GAP_CLOSURE_STALE',
        `${id} is still open while every record it names as its closer is done (${closers.join(', ')}) - either the gap is stale or one of those done claims is not`);
    }
  }
}
