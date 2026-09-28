// api plan: split from api.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { setInboxStatusByKey, updateGoalJson } from '../../../engine/ledger-db.mjs';
import { getWorkflow, goalJsonOf, latestGoal } from '../api-lib/rows.mjs';
import { HANDOVER_OP } from '../handover.mjs';
import { legOpsOf } from '../../route/plan-edges.mjs';
import { deferredTestsOf, ownerSpecs, planLegDeferral, specsOff } from '../spec-deferral.mjs';

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
    if (!plan || !Array.isArray(plan.legs) || plan.legs.some((l) => !l || typeof l.op !== 'string' || !l.op)
      || (plan.edges !== undefined && (!Array.isArray(plan.edges) || plan.edges.some((e) => !Array.isArray(e) || e.length !== 2 || e.some((label) => typeof label !== 'string' || !label))))) {
      throw Object.assign(new Error(`invalid plan file ${file} — expected {legs:[{op,paths?,notes?}], edges?:[[fromLeg,toLeg]]}`), { code: 'plan-file-invalid' });
    }
    const legs = plan.legs.map((l) => ({ op: l.op, ...(l.paths ? { paths: l.paths } : {}), ...(l.notes ? { notes: l.notes } : {}) }));
    const planOps = legs.map((l) => l.op);

    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const g = latestGoal(db, workflowId);
    const storedLegs = goalJsonOf(g)?.opChain?.legs ?? null;
    const storedOps = storedLegs ? storedLegs.map((l) => l?.op ?? l).filter(Boolean) : null;
    // A chain approved before the owner handover existed lacks its final leg.
    // Appending handover.review as the LAST leg is the one addition the Kernel
    // makes without the owner (api finish requires it), so it is no divergence.
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
        // The plan's own edges, else the recorded ones while the leg set is unchanged (scripts/route/plan-edges.mjs reads them).
        const prior = gj.derivedPlan ?? null;
        const edges = Array.isArray(plan.edges) ? plan.edges
          : Array.isArray(prior?.edges) && JSON.stringify(legOpsOf(prior.legs).sort()) === JSON.stringify([...new Set(planOps)].sort()) ? prior.edges : null;
        gj.derivedPlan = { legs, ...(edges ? { edges } : {}), divergence, lineage, derivedAt: now };
        updateGoalJson(db, { goalSeq: g.goal_seq, goal: gj, at: now });
        inboxApplied = setInboxStatusByKey(db, { workflowId, kind: 'goal-revision', key: `${workflowId}:${g.revision}`, onlyStatus: 'pending', status: 'applied',
          disposition: { action: 'plan-derived', revision: g.revision, lineage }, at: now });
      }
      ledger.appendEvent({
        workflowId, entityType: 'workflow', entityId: workflowId,
        kind: 'plan-derived', payload: { goal_revision: g?.revision ?? null, legs, divergence, lineage, inboxApplied, file },
      });
    });

    // The legs the owner's config.yaml specs switches defer (never dispatched; api run-deferred-tests runs them later).
    const specs = ownerSpecs(internals.skillRoot);
    const deferredLegs = legs.map((leg) => ({ op: leg.op, deferral: planLegDeferral({ skillRoot: internals.skillRoot, op: leg.op, settings: specs }) })).filter((leg) => leg.deferral)
      .map((leg) => ({ op: leg.op, reason: leg.deferral.reason }));
    const testsDeferred = { off: specsOff(specs), legs: deferredLegs, jobs: deferredTestsOf(db, workflowId) };
    const out = { ok: true, workflowId, goalRevision: g?.revision ?? null, divergence, lineage, inboxApplied, legs, testsDeferred };
    emit(out,
      `plan-derived for ${workflowId}: ${legs.length} legs — diverged=${divergence.diverged}` +
      (deferredLegs.length ? ` tests-deferred=[${deferredLegs.map((leg) => `${leg.op}:${leg.reason}`).join(',')}]` : '') +
      (divergence.missing.length ? ` missing=[${divergence.missing.join(',')}]` : '') +
      (divergence.extra.length ? ` extra=[${divergence.extra.join(',')}]` : '') +
      (divergence.reordered ? ' reordered' : '') +
      (divergence.noStoredChain ? ' (no stored opChain to diff)' : ''),
      args.json);
  },
};
