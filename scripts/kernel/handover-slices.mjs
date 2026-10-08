// handover-slices.mjs — the slices a defect reported on the handover may name. A slice is the latest settled-green job of a unit that a
// build-family op wrote (modules/models/kinds.yaml `family: build`): the lane build step of the slice the owner's note names. The menu
// (scripts/kernel/kernel-menu.mjs) offers one typed choice per slice, so a choice that names no slice of this workflow is refused by
// `starci kernel decide` before anything is enqueued; the fix is the slice's unit reopened under the note, through the enqueue path.
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { rerunMoveOf } from './next-moves.mjs';
import { jobPayloadOf } from './verbs/shared/rows.mjs';

let buildOps = null;

/** The ops of the build-family kinds. */
const buildOpsOf = () => (buildOps ??= new Set(Object.entries(readModuleJson('modules', 'models', 'kinds.yaml').kinds ?? {})
  .filter(([, kind]) => kind?.family === 'build').map(([id, kind]) => kind.operator ?? id)));

/** A note as one line of at most `max` characters. */
const lineOf = (text, max) => String(text ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, max);

/**
 * The defect the owner reported on a handover ask: {title, slices}. `slices` are [{jobId, op, label, move}], newest first, one per unit; `move`
 * is the enqueue that reopens the slice's unit under the title. A unit whose latest try did not succeed is the retry path's, not a slice.
 */
export function feedbackOfHandover(rows, { dispatchId, note }, { max }) {
  const title = lineOf(`handover feedback ${dispatchId}: ${note}`, 120);
  return { title, slices: slicesOf(rows, { dispatchId, title, max }) };
}

const slicesOf = (rows, { dispatchId, title, max }) => {
  const latest = new Map();
  for (const row of rows.filter((job) => job.kind !== 'kernel' && buildOpsOf().has(job.op_id))) latest.set(row.unit_id ?? row.job_id, row);
  return [...latest.values()].filter((row) => row.status === 'succeeded').reverse().slice(0, max).flatMap((row) => {
    const move = rerunMoveOf(row, { reason: `handover feedback ${dispatchId}` });
    if (!move) return [];
    const label = jobPayloadOf(row).displayWhat ?? move.args.paths;
    return [{ jobId: row.job_id, op: row.op_id, label: lineOf(label, 80), move: { verb: move.verb, args: { ...move.args, title } } }];
  });
};
