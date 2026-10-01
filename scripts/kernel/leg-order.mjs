// leg-order.mjs — which pending earlier-leg jobs do NOT hold a later leg in the approved order.
//
// api status reads a queued job `dependency` while a plan ancestor still has a job in flight or
// queued (api.mjs queuedBecauseOf). One kind of pending row is not a predecessor in that sense:
//
//   gate-waits-on-job
//                 the row's settle (or dispatch) is held by a wait of this workflow whose typed
//                 --until-job conditions name the queued job (through its retry lineage). The Kernel
//                 declared "this waits on that job"; holding that job behind the row as well is a
//                 cycle nothing can break - the same override afterChainReaches gives a declared
//                 --after edge (inc-df38ecef1927).
//
// nivo wf-nivo-workspace-provision-mujek7cb (2026-09-27): a deferred settle, inc-a158db5dc9b7 on
// op-business.decide-660a4d3e9a, waited until-job op-interface.draw-9f387aad28 succeeded, while that
// draw read `dependency` behind the very business.decide job the gate held, a hold that could never release it.

export const GATE_WAITS_ON_JOB = 'gate-waits-on-job';

/**
 * Why `row` (a pending job of an earlier leg) does not hold `job` in leg order, or null when it does.
 * typedGates: gate-conditions.mjs typedIncidents of the workflow ({incidentId, holds[], until[]}).
 * headOf: jobId -> the job id at the head of its retry lineage (a named failed job's open retry).
 */
export function legOrderExemption({ row, rowPayload = null, job, typedGates = [], headOf = (id) => id }) {
  if (!row || !job) return null;
  const rowOp = row.op_id ?? rowPayload?.opId ?? null;
  for (const gate of typedGates ?? []) {
    const holds = Array.isArray(gate?.holds) ? gate.holds : [];
    if (!holds.includes(row.job_id) && !(rowOp && holds.includes(rowOp))) continue;
    const names = (gate.until ?? []).some((cond) => cond?.type === 'job' && typeof cond.jobId === 'string'
      && (cond.jobId === job.job_id || headOf(cond.jobId) === job.job_id));
    if (names) return { why: GATE_WAITS_ON_JOB, incident: gate.incidentId };
  }
  return null;
}
