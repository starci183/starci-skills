// gate-runtime-conditions.mjs — the release conditions of a supervisor-gate (invariant I3; modules/kernel/op-incident-policy.yaml `gateCauses`),
// evaluated read-only with the other typed conditions of gate-conditions.mjs on every status and reconciler pass:
//   --until-runtime-has <commit>        the live runtime checkout contains the fix commit (it is an ancestor of the runtime's HEAD)
//   --until-admission <jobId>           no provider receipt (reserved or unknown) of the job's attempt scope holds a slot, so admission can take the job
//   --until-check <jobId>:<checkName>   the newest Kernel-recorded run of that check for the job's newest attempt is green
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { independentChecksOf } from './verbs/shared/check-evidence.mjs';

const SHA = /^[0-9a-f]{7,40}$/i;
const HELD_STATES = new Set(['reserved', 'unknown']);
const short = (sha) => String(sha ?? '').slice(0, 12);
const invalid = (detail) => Object.assign(new Error(detail), { code: 'until-invalid' });

/** The condition types this module owns. */
export const GATE_CONDITION_TYPES = Object.freeze(['runtime-has', 'admission', 'check']);

/** Raw `--until-<type> <spec>` into a stored condition. */
export const GATE_CONDITION_PARSERS = new Map([
  ['runtime-has', (type, spec) => {
    if (!SHA.test(spec)) throw invalid(`--until-runtime-has ${spec}: the value is a commit hash of 7 to 40 hex digits`);
    return { type, commit: spec.toLowerCase() };
  }],
  ['admission', (type, spec) => ({ type, jobId: spec })],
  ['check', (type, spec) => {
    const at = spec.indexOf(':');
    if (at <= 0 || at === spec.length - 1) throw invalid(`--until-check ${spec}: the form is <jobId>:<checkName>`);
    return { type, jobId: spec.slice(0, at).trim(), name: spec.slice(at + 1).trim() };
  }],
]);

const LABELS = {
  'runtime-has': (cond) => `the live runtime contains ${short(cond.commit)}`,
  admission: (cond) => `admission holds no receipt for ${cond.jobId}`,
  check: (cond) => `check ${cond.name} of ${cond.jobId} is green`,
};
/** The label of one of this module's conditions. */
export const gateConditionLabel = (cond) => LABELS[cond.type](cond);

/** The refusal of a condition that names a job this ledger does not hold, else null. */
export const gateConditionProblem = (db, cond) => {
  if (!cond.jobId || db.prepare('SELECT 1 FROM jobs WHERE job_id=?').get(cond.jobId)) return null;
  return Object.assign(new Error(`--until-${cond.type} names no job ${cond.jobId} in this ledger`), { code: 'until-job-unknown' });
};

const runtimeHas = (cond) => {
  const contained = isAncestor(skillRoot, cond.commit, 'HEAD');
  const head = revParseQuery(['--verify', '--quiet', 'HEAD'], { dir: skillRoot, timeout: 10_000 });
  const at = short(head.stdout?.toString().trim());
  return { met: contained, evidence: contained ? `the live runtime (${at}) contains ${short(cond.commit)}` : `the live runtime (${at || 'unreadable'}) does not contain ${short(cond.commit)} yet` };
};

const admission = (cond) => {
  const held = readMachine((m) => m.providerReservations({ activeOnly: true }), [])
    .filter((row) => HELD_STATES.has(row.state) && String(row.scope?.scopeId ?? '').includes(`:${cond.jobId}:attempt:`));
  if (!held.length) return { met: true, evidence: `no provider receipt of ${cond.jobId} holds a slot` };
  const receipts = held.map((row) => `${row.id.slice(0, 8)} ${row.state}`).join(', ');
  return { met: false, evidence: `${held.length} provider receipt(s) of ${cond.jobId} hold a slot: ${receipts}` };
};

const checkGreen = (db, cond) => {
  const row = (independentChecksOf(db, { jobId: cond.jobId })?.checks ?? []).find((check) => check.name === cond.name);
  if (!row) return { met: false, evidence: `no recorded run of check ${cond.name} for ${cond.jobId}` };
  return { met: row.exitCode === 0, evidence: `check ${cond.name} of ${cond.jobId} exit ${row.exitCode}` };
};

/** Evaluators keyed by type: (db, cond) -> {met, evidence}. */
export const GATE_CONDITION_EVALUATORS = Object.freeze({
  'runtime-has': (db, cond) => runtimeHas(cond),
  admission: (db, cond) => admission(cond),
  check: (db, cond) => checkGreen(db, cond),
});
