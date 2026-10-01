// api survey: split from cli.mjs.
import { parseJson } from '../../lib/json.mjs';
import { JOB_ROW } from '../../machine/job-row.mjs';
import { getWorkflow, goalJsonOf, jobPayloadOf, latestGoal } from './shared/rows.mjs';
import { deliveriesOf } from '../handover.mjs';
import { autopilotBundle, autopilotOn } from '../autopilot-run.mjs';
import { workflowDisplayName } from '../../lib/display-names.mjs';
import { staleOperationsOf, sourceDriftSummaryOf, peerDriftSummaryOf } from '../input-digests.mjs';
import { providerCircuits } from '../../machine/provider-circuit.mjs';

export default {
  verb: 'survey',
  required: ['workflow'],
  usageInCore: true,
  run({ ledger, args, repo, emit, need, internals }) {
    const db = ledger.db, workflowId = args.workflow, now = Date.now();
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const g = latestGoal(db, workflowId), gj = goalJsonOf(g);
    const openJobs = db.prepare(
      `SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND status NOT IN (${internals.FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
    ).all(workflowId, ...internals.FINAL_SETTLED)
      .map((r) => ({ job_id: r.job_id, op_id: r.op_id, kind: r.kind, status: r.status, attempt: r.attempt, generation: r.generation, worker_id: r.worker_id, payload: jobPayloadOf(r), created_at: r.created_at, updated_at: r.updated_at }));
    const inbox = db.prepare('SELECT * FROM inbox WHERE workflow_id=? ORDER BY inbox_id').all(workflowId)
      .map((r) => ({ ...r, payload: parseJson(r.payload_json), disposition: parseJson(r.disposition_json) }));
    const signals = db.prepare(
      `SELECT scope,key,holder_pid,token,value_json,at,expires_at FROM signals
       WHERE (scope=? OR key=?) AND (expires_at IS NULL OR expires_at>?) ORDER BY scope,key`
    ).all(workflowId, workflowId, now).map((r) => ({ ...r, value: parseJson(r.value_json) }))
      // Provider circuits are machine rows now (scripts/machine/provider-circuit.mjs), shown in the same list.
      .concat(providerCircuits().filter((c) => c.expiresAt == null || c.expiresAt > now)
        .map((c) => ({ scope: 'provider-health', key: c.provider, value: c.value, at: c.at, expires_at: c.expiresAt })));
    const events = db.prepare('SELECT seq,event_id,generation,entity_type,entity_id,kind,payload_json,created_at FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 10')
      .all(workflowId).reverse().map((r) => ({ ...r, payload: parseJson(r.payload_json) }));
    const incidents = db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId);
    const stale = internals.staleInputProjection(db, wf, repo);
    const out = {
      ok: true, workflowId,
      workflow: wf,
      goal: g ? {
        revision: g.revision, identity: g.goal_identity, markdown: g.markdown,
        opChain: gj.opChain ?? null, derivedPlan: gj.derivedPlan ?? null, json: gj,
      } : null,
      jobs: openJobs,
      inbox, signals, events,
      incidentsOpen: incidents,
      eventsHead: ledger.eventsHead(workflowId),
      ...stale,
      // --deliveries: what a handover package is assembled from - every settled
      // job's filed report and the earlier handover answers. A read projection,
      // so an op terminal may call it (modules/ops/ops/handover.review.yaml).
      ...(args.deliveries ? { ...deliveriesOf(db, workflowId), ...(autopilotOn(db, workflowId) ? { autopilot: autopilotBundle(db, workflowId) } : {}) } : {}),
    };
    emit(out, [
      `workflow ${workflowId} — phase=${wf.phase ?? '-'} title=${workflowDisplayName(wf) ?? '-'}${wf.display_name && wf.title ? ` (slug ${wf.title})` : ''}`,
      `goal rev ${g?.revision ?? '-'} (${g?.goal_identity ?? '-'}) chain: ${(gj.opChain?.legs ?? []).map((l) => l.op).join(' → ') || '(none stored)'}`,
      `open jobs: ${openJobs.length} (${openJobs.map((j) => `${j.job_id}:${j.status}`).join(', ') || 'none'})`,
      `inbox: ${inbox.length} rows (${inbox.filter((i) => i.status === 'pending').length} pending) | live signals: ${signals.length} | open incidents: ${incidents.length}`,
      `last events: ${events.map((e) => `${e.seq}:${e.kind}`).join(', ') || 'none'}`,
      ...staleOperationsOf(stale.staleInput).map(internals.staleOperationLine),
      ...internals.sourceDriftLines(sourceDriftSummaryOf(stale.sourceDrift)),
      ...internals.peerDriftLines(peerDriftSummaryOf(stale.peerDrift)),
      ...(out.deliveries ? [
        `deliveries: ${out.deliveries.length} settled job(s); credentialPending: ${out.credentialPending.join(', ') || 'none'}; handover asks: ${out.handoverHistory.length}`,
        ...out.deliveries.map((d) => `  ${d.jobId} ${d.op} a${d.attempt} ${d.status}${d.outcome ? ` outcome=${d.outcome}` : ''}${d.head ? ` head=${d.head}` : ''}${d.summary ? ` — ${d.summary}` : ''}`),
        ...out.handoverHistory.map((h) => `  handover ${h.dispatchId} a${h.attempt} ${h.state}${h.decision ? ` ${h.decision} by ${h.answeredBy ?? '-'}` : ''}${h.note ? ` — ${h.note}` : ''}`),
      ] : []),
    ].join('\n'), args.json);
  },
};
