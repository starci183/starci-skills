// gate-workaround.mjs — invariant I6 for a supervisor-gate (modules/kernel/op-incident-policy.yaml `gateCauses`): a gate is raised only after
// the workaround of its cause class was tried and recorded, or with one typed "no workaround because ..." reason from the class's list.
// A raise without either is refused with a typed code that names the workaround; a class the runtime can work around itself
// (`mechanical`) answers {mechanical} so the caller records the workaround and opens no gate.
import { refuse } from '../../engine/refuse.mjs';
import { parseJson } from '../lib/json.mjs';
import { list } from '../lib/list.mjs';
import { incidentPolicy } from './op-incident-policy.mjs';
import { untriedRouteMembers } from './admission-refusal.mjs';

const MIN_ATTEMPT_CHARS = 12;

/** The cause classes of the table: [{id, situation, workaround, noWorkaround{}, verify?, mechanical?}]. */
export const gateCauses = () => list(incidentPolicy().gateCauses);

const causeIds = () => gateCauses().map((cause) => cause.id).join(', ');
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const reasonList = (cause) => Object.entries(cause.noWorkaround ?? {}).map(([id, why]) => `${id} (${why})`).join('; ');

/** The members of the job's last route decision that are neither its current pool nor rejected there: the agents a no-workaround claim overlooks. */
const untriedMembersOf = (db, jobId) => {
  const row = db?.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId);
  return untriedRouteMembers(parseJson(row?.payload_json, {}) ?? {}, null);
};

const refuseCause = (id) => refuse(id
  ? `supervisor-gate: unknown --cause ${id} - the cause classes are ${causeIds()}`
  : `supervisor-gate: name the cause class with --cause (${causeIds()}) and the workaround you tried (--workaround) or why there is none (--no-workaround)`,
'gate-cause-required', { causes: gateCauses().map((cause) => cause.id) });

const refuseWorkaround = (cause) => refuse(`supervisor-gate (${cause.id}): try the workaround first - ${cause.workaround} - and record it with --workaround <what you tried and what came of it>, or state why there is none with --no-workaround <${Object.keys(cause.noWorkaround ?? {}).join('|')}>`,
  'gate-workaround-required', { cause: cause.id, workaround: cause.workaround, noWorkaround: Object.keys(cause.noWorkaround ?? {}) });

const refuseReason = (cause, reason) => refuse(`supervisor-gate (${cause.id}): --no-workaround ${reason} is not one of this cause's reasons: ${reasonList(cause)}`,
  'gate-no-workaround-invalid', { cause: cause.id, noWorkaround: Object.keys(cause.noWorkaround ?? {}) });

const refuseAvailable = (cause, members, jobId) => refuse(`supervisor-gate (${cause.id}): ${jobId} still has ${members.join(', ')} in its route chain, so the workaround is open - ${cause.workaround}`,
  'gate-workaround-available', { cause: cause.id, jobId, members });

/**
 * The workaround record of a raise: {cause, attempt} for a recorded attempt, {cause, none, because} for a typed reason, {cause, mechanical}
 * when the runtime records the workaround itself (only for a caller that passes `mechanical`). `holds` are the job ids the gate would hold; `db` (when given) lets the table's `verify`
 * refuse a reason the job's route chain contradicts. Throws the typed refusal otherwise.
 */
export function gateWorkaroundOf(db, { cause: causeId, workaround, noWorkaround, because, holds = [], mechanical = false }) {
  const cause = gateCauses().find((entry) => entry.id === causeId);
  if (!cause) throw refuseCause(text(causeId));
  const attempt = text(workaround);
  if (attempt.length >= MIN_ATTEMPT_CHARS) return { cause: cause.id, attempt };
  const reason = text(noWorkaround);
  if (reason) {
    if (!Object.hasOwn(cause.noWorkaround ?? {}, reason)) throw refuseReason(cause, reason);
    const jobId = list(holds).find((hold) => hold !== '*');
    const untried = cause.verify === 'other-members' && db && jobId ? untriedMembersOf(db, jobId) : [];
    if (untried.length) throw refuseAvailable(cause, untried, jobId);
    return { cause: cause.id, none: reason, because: text(because) || cause.noWorkaround[reason] };
  }
  if (cause.mechanical && mechanical) return { cause: cause.id, mechanical: cause.mechanical };
  throw refuseWorkaround(cause);
}
