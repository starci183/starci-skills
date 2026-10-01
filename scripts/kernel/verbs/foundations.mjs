// api foundations: split from cli.mjs.
import { getWorkflow } from './shared/rows.mjs';
import { openPeerWaits } from './shared/peers.mjs';
import { readFoundations } from '../foundations.mjs';
import { loadContractChanges } from '../contract-version.mjs';

export default {
  verb: 'foundations',
  required: [],
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const db = ledger.db;
    if (args.workflow && !getWorkflow(db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    const foundations = readFoundations(db), registry = loadContractChanges(internals.skillRoot);
    const running = db.prepare("SELECT * FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY created_at,workflow_id").all();
    const phaseOf = (id) => { const wf = getWorkflow(db, id); return wf ? (wf.archived_at != null ? 'archived' : wf.phase ?? null) : 'unknown'; };
    const waits = running.flatMap((wf) => openPeerWaits(db, wf.workflow_id).filter((wait) => wait.untilFoundation)
      .map((wait) => ({ workflowId: wf.workflow_id, incidentId: wait.incidentId, foundation: wait.untilFoundation, holds: wait.holds })));
    const involved = (f) => !args.workflow || f.owner?.workflowId === args.workflow || (f.dependents ?? []).some((d) => d.workflowId === args.workflow);
    const rows = foundations.filter(involved).map((f) => ({
      name: f.name, kind: f.kind, state: f.state, version: f.version ?? null, detail: f.detail ?? null,
      owner: f.owner ? { workflowId: f.owner.workflowId, phase: phaseOf(f.owner.workflowId), claimedAt: f.owner.claimedAt } : null,
      landed: f.landed ?? null,
      dependents: (f.dependents ?? []).map((d) => ({ workflowId: d.workflowId, phase: phaseOf(d.workflowId), detail: d.detail ?? null, at: d.at })),
      waits: waits.filter((wait) => wait.foundation === f.name).map(({ workflowId, incidentId, holds }) => ({ workflowId, incidentId, holds })),
    }));
    const workflows = running.filter((wf) => !args.workflow || wf.workflow_id === args.workflow).map((wf) => {
      const duty = internals.foundationDutyOf(db, wf, { foundations, registry });
      return { workflowId: wf.workflow_id, title: wf.title ?? null, peers: duty.peers.length, declared: duty.declared, none: duty.none,
        owns: duty.owns.map((f) => f.name), needs: duty.needs.map((f) => f.name), required: duty.required, advised: duty.advised };
    });
    const undeclared = workflows.filter((wf) => wf.peers > 0 && !wf.declared).map((wf) => wf.workflowId);
    const out = { ok: true, foundations: rows, workflows, undeclared };
    emit(out, [
      `foundations: ${rows.length} registered${undeclared.length ? `; undeclared running workflow(s) with peers: ${undeclared.join(', ')}` : ''}`,
      ...rows.flatMap((f) => [
        `  ${f.name} [${f.kind}] ${f.state}${f.version ? ` ${f.version}` : ''} owner=${f.owner ? `${f.owner.workflowId} (${f.owner.phase})` : '-'}${f.landed ? ` landed ${new Date(f.landed.at).toISOString()}: ${f.landed.proof}` : ''}`,
        ...f.dependents.map((d) => `    dependent ${d.workflowId} (${d.phase})${d.detail ? `: ${d.detail}` : ''}`),
        ...f.waits.map((w) => `    wait ${w.incidentId} in ${w.workflowId} holds ${w.holds.join(', ') || '-'}`),
      ]),
      ...workflows.map((wf) => `  workflow ${wf.workflowId}: ${wf.declared ? (wf.none ? 'declared none' : `owns ${wf.owns.join(', ') || '-'}; needs ${wf.needs.join(', ') || '-'}`) : wf.peers ? `UNDECLARED (${wf.required ? 'required' : 'advised'})` : 'no running peers'}`),
    ].join('\n'), args.json);
  },
};
