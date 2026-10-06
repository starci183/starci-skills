// starci kernel plan: split from cli.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { setInboxStatusByKey, updateGoalJson } from '../../../engine/db/ledger.mjs';
import { getWorkflow, goalJsonOf, latestGoal } from './shared/rows.mjs';
import { HANDOVER_OP } from '../handover.mjs';
import { planGraphOf } from '../../route/plan-edges.mjs';
import { deferredTestsOf, ownerSpecs, planLegDeferral, specsOff } from '../../route/spec-deferral.mjs';

const planShapeInvalid = (plan) => !plan || !Array.isArray(plan.legs)
  || plan.legs.some((l) => !l || typeof l.op !== 'string' || !l.op)
  || (plan.edges !== undefined && (!Array.isArray(plan.edges) || plan.edges.some((e) => !Array.isArray(e) || e.length !== 2 || e.some((label) => typeof label !== 'string' || !label))));

export default {
  verb: 'plan',
  required: ['workflow', 'file'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    const now = Date.now();
    const file = path.resolve(args.file);
    if (!fs.existsSync(file)) throw Object.assign(new Error(`plan file missing: ${file}`), { code: 'plan-file-missing' });
    const plan = parseJson(fs.readFileSync(file, 'utf8'));
    if (planShapeInvalid(plan)) {
      throw Object.assign(new Error(`invalid plan file ${file} — expected {legs:[{op,paths?,notes?}], edges:[[fromLeg,toLeg]]}`), { code: 'plan-file-invalid' });
    }
    const legs = plan.legs.map((l) => ({ op: l.op, ...(l.paths ? { paths: l.paths } : {}), ...(l.notes ? { notes: l.notes } : {}) }));
    const planOps = legs.map((l) => l.op);
    // Edges are required and must be provable over the legs (absent, partial, unknown or cyclic: plan-edges-missing).
    planGraphOf({ legs, edges: plan.edges });

    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const g = latestGoal(db, workflowId);
    const storedLegs = goalJsonOf(g)?.opChain?.legs ?? null;
    const storedOps = storedLegs ? storedLegs.map((l) => l?.op ?? l).filter(Boolean) : null;
    // A chain approved before the owner handover existed lacks its final leg.
    // Appending handover.review as the LAST leg is the one addition the Kernel
    // makes without the owner (starci kernel finish requires it), so it is no divergence.
    const handoverAppended = Boolean(storedOps) && !storedOps.includes(HANDOVER_OP) && planOps.at(-1) === HANDOVER_OP
      && planOps.indexOf(HANDOVER_OP) === planOps.length - 1;
    const comparedOps = handoverAppended ? planOps.slice(0, -1) : planOps;
    // Structural diff only: which stored legs the plan dropped, which plan ops
    // were never in the approved chain, whether shared ops changed order.
    const divergence = {
      storedOps: storedOps ?? null,
      planOps,
      missing: storedOps ? storedOps.filter((o) => !planOps.includes(o)) : [],
      extra: storedOps ? comparedOps.filter((o) => !storedOps.includes(o)) : [...planOps],
      reordered: storedOps
        ? JSON.stringify(storedOps.filter((o) => comparedOps.includes(o))) !== JSON.stringify(comparedOps.filter((o) => storedOps.includes(o)))
        : false,
      noStoredChain: storedOps === null,
      ...(handoverAppended ? { handoverAppended: true } : {}),
    };
    divergence.diverged = divergence.missing.length > 0 || divergence.extra.length > 0 || divergence.reordered;

    const lineage = {
      replannedFrom: args['replanned-from'] ?? null,
      blocker: args.blocker ?? null,
      pathDelta: args['path-delta'] ?? null,
      routingReason: args['routing-reason'] ?? null,
    };
    let inboxApplied = 0;

    ledger.transaction(() => {
      if (g) {
        const gj = goalJsonOf(g);
        // The plan's own edges (scripts/route/plan-edges.mjs reads them), proven above.
        gj.derivedPlan = { legs, edges: plan.edges ?? [], divergence, lineage, derivedAt: now };
        updateGoalJson(db, { goalSeq: g.goal_seq, goal: gj, at: now });
        inboxApplied = setInboxStatusByKey(db, { workflowId, kind: 'goal-revision', key: `${workflowId}:${g.revision}`, onlyStatus: 'pending', status: 'applied',
          disposition: { action: 'plan-derived', revision: g.revision, lineage }, at: now });
      }
      ledger.appendEvent({
        workflowId, entityType: 'workflow', entityId: workflowId,
        kind: 'plan-derived', payload: { goal_revision: g?.revision ?? null, legs, divergence, lineage, inboxApplied, file },
      });
    });

    // The legs the owner's config.yaml specs switches defer (never dispatched; starci kernel run-deferred-tests runs them later).
    const specs = ownerSpecs(internals.skillRoot);
    const deferredLegs = legs.map((leg) => ({ op: leg.op, deferral: planLegDeferral({ skillRoot: internals.skillRoot, op: leg.op, settings: specs, goalText: g?.markdown ?? null }) })).filter((leg) => leg.deferral)
      .map((leg) => ({ op: leg.op, reason: leg.deferral.reason }));
    const testsDeferred = { off: specsOff(specs), legs: deferredLegs, jobs: deferredTestsOf(db, workflowId) };
    const out = { ok: true, workflowId, goalRevision: g?.revision ?? null, divergence, lineage, inboxApplied, legs, testsDeferred };
    const deferredList = deferredLegs.map((leg) => `${leg.op}:${leg.reason}`).join(',');
    emit(out,
      `plan-derived for ${workflowId}: ${legs.length} legs — diverged=${divergence.diverged}` +
      (deferredLegs.length ? ` tests-deferred=[${deferredList}]` : '') +
      (divergence.missing.length ? ` missing=[${divergence.missing.join(',')}]` : '') +
      (divergence.extra.length ? ` extra=[${divergence.extra.join(',')}]` : '') +
      (divergence.reordered ? ' reordered' : '') +
      (divergence.noStoredChain ? ' (no stored opChain to diff)' : ''),
      args.json);
  },
};
