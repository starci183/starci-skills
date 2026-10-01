// api coverage — every FR, shape and applicable proof case of the workflow's scope with its evidence
// (proof-integrity.mjs coverageOf); read-only. The proof cases of each ui record come from
// ui-proof-brief.mjs buildBrief. Split out of api.mjs (lane slim-04); its help line stays in api.mjs
// usage() (usageInCore).
//
//   coverage --workflow <id>
import { ownerSpecs, specsOff } from '../spec-deferral.mjs';
import { coverageLines, coverageOf } from '../proof-integrity.mjs';

export default {
  verb: 'coverage',
  required: ['workflow'],
  usageInCore: true,
  usage: '  coverage --workflow <id>   every FR, shape and proof case of the workflow\'s scope with its evidence: proven|stale|missing',
  async run({ ledger, args, repo, emit, internals }) {
    if (!internals.getWorkflow(ledger.db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    const { buildBrief, loadKnowledge } = await import('../../work/ui/ui-proof-brief.mjs');
    let knowledge = null;
    const briefCases = (record) => buildBrief({ record, knowledge: (knowledge ??= loadKnowledge()) }).topics.flatMap((t) => t.cases.map((c) => `${c.rule} ${c.case}`));
    const notCounted = specsOff(ownerSpecs(internals.skillRoot));
    const out = { ok: true, ...coverageOf(ledger.db, args.workflow, { repo, briefCases, notCounted }), ...(notCounted.length ? { notCounted: notCounted.map((kind) => `specs.${kind}=false`) } : {}) };
    emit(out, coverageLines(out).join('\n'), args.json);
  },
};
