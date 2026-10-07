// starci kernel coverage — every FR, shape and applicable proof case of the workflow's scope with its evidence
// (proof-integrity.mjs coverageOf); read-only. The proof cases of each ui record come from
// ui-proof-brief.mjs buildBrief. Split out of cli.mjs (lane slim-04); its help line stays in cli.mjs
// usage() (usageInCore).
//
//   coverage --workflow <id>
import { ownerSpecs, specsOff } from '../../route/spec-deferral.mjs';
import { coverageLines, coverageOf, proofAcceptanceOf } from '../proof-integrity.mjs';
import { JOB_STATUSES } from '../../../engine/db/ledger.mjs';
import { HANDOVER_OP, handoverApprovalOf, handoverGateOf } from '../handover.mjs';

export default {
  verb: 'coverage',
  required: ['workflow'],
  usageInCore: true,
  usage: '  coverage --workflow <id>   every FR, shape and proof case of the workflow\'s scope with its evidence: proven|stale|missing',
  async run({ ledger, args, repo, emit, internals }) {
    if (!internals.getWorkflow(ledger.db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    const { buildBrief, loadKnowledge } = await import('../../work/ui/ui-proof-brief.mjs');
    let knowledge = null;
    const briefCases = (record) => {
      const currentKnowledge = knowledge ?? loadKnowledge();
      knowledge = currentKnowledge;
      return buildBrief({ record, knowledge: currentKnowledge }).topics.flatMap((t) => t.cases.map((c) => `${c.rule} ${c.case}`));
    };
    const notCounted = specsOff(ownerSpecs(internals.skillRoot));
    let policy;
    try {
      const jobs = ledger.db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND op_id=? AND kind<>'kernel'").all(args.workflow, HANDOVER_OP);
      const active = jobs.filter(job => !JOB_STATUSES.settled.includes(job.status));
      if (active.length > 1) throw new Error('more than one active handover job has a coverage policy');
      const gate = handoverGateOf(ledger.db, args.workflow), approval = handoverApprovalOf(ledger.db, args.workflow);
      let approvedId = null;
      if (gate.ok && gate.via === 'handover-approved') approvedId = gate.approval?.jobId;
      else if (approval.approved) approvedId = approval.ask?.jobId;
      const job = active[0] ?? jobs.find(row => row.job_id === approvedId);
      if (!job) throw new Error('no active or approved handover job determines coverage policy');
      policy = proofAcceptanceOf(ledger.db, job, internals.skillRoot);
    } catch (error) { throw Object.assign(new Error(`handover-proof-unjudged: ${error.message}`), { code: 'handover-proof-unjudged' }); }
    const out = { ok: true, policy, ...coverageOf(ledger.db, args.workflow, { repo, briefCases, notCounted, qualified: policy.qualified }), ...(notCounted.length ? { notCounted: notCounted.map((kind) => `specs.${kind}=false`) } : {}) };
    emit(out, coverageLines(out).join('\n'), args.json);
  },
};
