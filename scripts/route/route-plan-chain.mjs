// route-plan-chain.mjs — the CHAIN step of route-plan.mjs: each missing variable backward-chained to the op whose produces covers it, with
// its prerequisites, into the plan's legs and edges.
import { satisfiedByS0 } from './route-plan-survey.mjs';
import { varKey } from './route-plan-parse.mjs';

function legIdFor(opId, instance) { return instance ? `${opId}#${instance}` : opId; }

const STAGE_RANK = { intake: 0, scope: 1, decide: 2, direct: 3, implement: 4, verify: 5, release: 6, operate: 7 };
export const stageRankOf = op => {
  const p = op?.route?.phase?.[0] ?? 'operate';
  return STAGE_RANK[p] ?? 7;
};

const EXTERNAL_OPS = new Set(['request.analyze']); // model/kinds.yaml external: true
const HANDOVER_OP = 'handover.review'; // scripts/kernel/handover.mjs HANDOVER_OP

// Prerequisite phrase -> requirement. route.prerequisites are English; this is
// the fixed phrase table mapping each declared prerequisite to a chain edge, a
// state-variable need, or a non-chain condition (recorded on the leg).
function parsePrerequisite(text, ops) {
  const t = String(text).trim();
  // "<op.id> done ..." — an explicit op dependency
  const opRef = /^([a-z]+(?:\.[a-z]+)+)\b/i.exec(t);
  if (opRef && ops.has(opRef[1])) {
    return { kind: 'op', op: opRef[1], note: t };
  }
  const table = [
    [/^scope defined/i, { kind: 'var', family: 'scope', state: 'defined' }],
    [/^request analyzed/i, { kind: 'op', op: 'request.analyze', note: t }],
    [/^implementation done$/i, { kind: 'var', family: 'impl', state: 'done' }],
    [/^implementation \+ verification evidence/i, { kind: 'compound', needs: [{ family: 'impl', state: 'done' }, { anyPhase: 'verify' }] }],
    [/^decided records\/behavior exist/i, { kind: 'anyPhase', phase: 'decide' }],
    [/^(a delivery to inspect|a delivered slice)/i, { kind: 'anyPhase', phase: 'implement', soft: true }],
    [/^verified served build/i, { kind: 'condition', note: 'served build assumed — runtime.operate leg if the stack is not already up' }],
    [/^delivered code \+ existing regression coverage/i, { kind: 'compound', needs: [{ family: 'impl', state: 'done', soft: true, conditional: 'delivered code is pre-existing — the refactor target, not a chain leg' }, { family: 'tests', state: 'authored', conditional: 'only when coverage is missing (test-gap route -> test.author)' }] }],
    [/^a decidable question/i, { kind: 'condition' }],
    [/^an owner-only input/i, { kind: 'condition', owner: true }],
    [/^no preset workflow matched/i, { kind: 'condition' }],
    [/^evidence challenging a rule/i, { kind: 'condition' }],
    [/^a recorded failed composition/i, { kind: 'condition' }],
    [/^test-gap blocker or code under test/i, { kind: 'condition', note: 'code under test is pre-existing delivered code (S0), not a chain leg' }],
    [/^an approved goal exists/i, { kind: 'condition', owner: true }],
    [/^the scope exists/i, { kind: 'condition' }],
    [/^a declared stack\/environment/i, { kind: 'condition' }],
    [/^repository bound/i, { kind: 'condition' }],
    [/^grammar bound/i, { kind: 'condition' }],
    [/^a settled SDS only when/i, { kind: 'condition' }],
    [/^every other leg of the approved chain settled/i, { kind: 'condition' }],
  ];
  for (const [re, req] of table) if (re.test(t)) return { ...req, note: req.note ?? t };
  return { kind: 'condition', note: `unparsed prerequisite treated as a condition: '${t}'` };
}

export function planChain({ sstar, s0, ops, prodTable, hints, outOfBand = [] }) {
  const settledOutOfBand = v => outOfBand.find(o => o.family === v.family && o.state === v.state) ?? null;
  const legs = new Map();  // legId -> leg
  const edges = [];        // [fromLegId, toLegId]  (from must run first)
  const gaps = [];         // unproducible vars
  const assumptions = [];
  let seqCounter = 0;

  const producersFor = v => prodTable.byVar.filter(p =>
    p.state === v.state && p.family === v.family
    && (p.suffix === 'X' || p.suffix === '' || p.suffix === v.suffix || v.suffix === 'X' || v.suffix === ''));

  function pickProducer(v) {
    let cands = producersFor(v);
    if (!cands.length) return { pick: null, cands };
    if (cands.length === 1) return { pick: cands[0], cands };
    // disambiguation: explicit hint, then impl qualifier, then suffix match
    if (hints.preferProducer) {
      const h = cands.find(c => c.op === hints.preferProducer);
      if (h) return { pick: h, cands };
    }
    if (v.family === 'impl' && (v._qual ?? hints.implQualifier)) {
      const h = cands.find(c => c.qualifier === (v._qual ?? hints.implQualifier));
      if (h) return { pick: h, cands };
    }
    const exact = cands.filter(c => c.suffix === v.suffix && c.suffix !== 'X');
    if (exact.length === 1) return { pick: exact[0], cands };
    // ORDER-tier ambiguity: the agent chooses; record the assumption.
    // Default preference: unqualified, then the backend impl qualifier (the
    // generic build lane), else first table entry.
    const pick = cands.find(c => !c.qualifier) ?? cands.find(c => c.qualifier === 'backend') ?? cands[0];
    assumptions.push(`producer for ${varKey(v)}: ${v.state} is ambiguous — picked ${pick.op}; alternatives: ${cands.map(c => c.op).join(', ')}`);
    return { pick, cands, assumed: true };
  }

  function ensureLeg(opId, { forVar = null, instance = null, injected = null } = {}) {
    const lid = legIdFor(opId, instance);
    if (legs.has(lid)) {
      const existing = legs.get(lid);
      if (forVar) existing.producesCovered.push(varKey(forVar) + ': ' + forVar.state);
      if (injected && !existing.injected) existing.injected = injected;
      return existing;
    }
    const op = ops.get(opId);
    const leg = {
      legId: lid, op: opId, instance,
      producesCovered: forVar ? [`${varKey(forVar)}: ${forVar.state}`] : [],
      needsSatisfiedBy: [], conditions: [], assumed: [], extends: null,
      external: EXTERNAL_OPS.has(opId) || undefined,
      injected: injected ?? undefined,
      yaml: op?.file ?? null,
      missingOp: !op || !!op.error || undefined,
    };
    legs.set(lid, leg);
    leg._seq = seqCounter++;
    expandPrerequisites(leg, op);
    return leg;
  }

  function satisfyVar(v, consumerLeg, { soft = false, conditional = null } = {}) {
    // 1. already produced by an existing leg?
    for (const leg of legs.values()) {
      if (leg === consumerLeg) continue;
      for (const pv of prodTable.byVar.filter(p => p.op === leg.op)) {
        const sameFam = pv.family === v.family;
        const sameState = pv.state === v.state;
        const suffixOk = !v.suffix || v.suffix === 'X' || pv.suffix === 'X' || pv.suffix === '' || pv.suffix === v.suffix;
        const qualifierOk = !v.strictQualifier || pv.qualifier === v._qual;
        if (sameFam && sameState && suffixOk && qualifierOk) {
          consumerLeg.needsSatisfiedBy.push(`${leg.legId} produces ${pv.raw}`);
          edges.push([leg.legId, consumerLeg.legId]);
          return true;
        }
      }
    }
    // 1b. settled by a Work record outside the chain (legality.yaml settledOutOfBand)?
    const oob = settledOutOfBand(v);
    if (oob) {
      consumerLeg.assumed.push(oob.note);
      consumerLeg.needsSatisfiedBy.push(`out-of-band: ${oob.record} (${oob.recordState})`);
      return true;
    }
    // 2. satisfied by S0?
    const s0hit = satisfiedByS0(v, s0, { goal: consumerLeg.legId === '(goal)' });
    if (s0hit?.by === 's0') {
      consumerLeg.needsSatisfiedBy.push(`S0:${s0hit.recordId} (${s0hit.recordState})`);
      return true;
    }
    // 2b. soft needs are satisfiable out-of-band (e.g. "delivered code" for a
    // refactor is the pre-existing target, not a chain leg); a named-target
    // request IS its own scope.
    if (hints.scopeProducer && v.family === 'scope') {
      const producer = ensureLeg(hints.scopeProducer);
      edges.push([producer.legId, consumerLeg.legId]);
      consumerLeg.needsSatisfiedBy.push(`${producer.legId} (its setup entry on the catalog bounds the goal)`);
      return true;
    }
    if (hints.scopeProvided && v.family === 'scope') {
      consumerLeg.needsSatisfiedBy.push('named target IS the scope — scope.define excluded per archetype');
      return true;
    }
    if (soft) {
      consumerLeg.assumed.push(`needs ${varKey(v)}: ${v.state} — satisfied out-of-band (no chain leg)${conditional ? '; ' + conditional : ''}`);
      return true;
    }
    // 3. backward-chain: produce it
    const { pick, cands, assumed } = pickProducer(v);
    if (!pick) {
      if (soft) { consumerLeg.assumed.push(`needs ${varKey(v)}: ${v.state} — satisfied out-of-band (no chain leg)`); return true; }
      // fallback inference: route.prerequisites + goal prose (brief: marked)
      const fb = [...ops.values()].find(o => !o.error && o.route.intent.includes(v.family));
      if (fb) {
        const leg = ensureLeg(fb.id, { forVar: v });
        leg.assumed.push(`produces-inferred: no producesVocabulary entry for ${varKey(v)} — matched by route.intent/goal (marked per brief)`);
        edges.push([leg.legId, consumerLeg.legId]);
        consumerLeg.needsSatisfiedBy.push(`${leg.legId} (produces-inferred)`);
        return true;
      }
      gaps.push({ var: `${varKey(v)}: ${v.state}`, neededBy: consumerLeg.op, candidates: cands.map(c => c.op) });
      return false;
    }
    const leg = ensureLeg(pick.op, { forVar: v });
    if (assumed) leg.assumed.push(`producer ambiguity for ${varKey(v)} — chose ${pick.op} over [${cands.map(c => c.op).join(', ')}]`);
    if (conditional) leg.conditions.push(conditional);
    edges.push([leg.legId, consumerLeg.legId]);
    consumerLeg.needsSatisfiedBy.push(`${leg.legId} produces ${pick.raw}`);
    // extends: S0 has a not-settled/related record for this var
    if (s0hit?.by === 's0-unsettled') leg.extends = s0hit.recordId;
    return true;
  }

  function satisfyPhase(phase, consumerLeg, { soft = false } = {}) {
    const hit = [...legs.values()].find(l => l !== consumerLeg && (ops.get(l.op)?.route.phase ?? []).includes(phase));
    if (hit) {
      consumerLeg.needsSatisfiedBy.push(`${hit.legId} (${phase} leg)`);
      edges.push([hit.legId, consumerLeg.legId]);
      return true;
    }
    const delivery = phase === 'implement' && hints.deliveryOps
      ? [...legs.values()].findLast(l => l !== consumerLeg && hints.deliveryOps.includes(l.op)) : null;
    if (delivery) {
      consumerLeg.needsSatisfiedBy.push(`${delivery.legId} (delivery to inspect: the reconstructed Work and stack roots)`);
      edges.push([delivery.legId, consumerLeg.legId]);
      consumerLeg.deliveredBy = delivery.legId;
      return true;
    }
    if (phase === 'decide') return satisfyVar({ family: 'business', suffix: 'X', state: 'decided' }, consumerLeg);
    if (phase === 'implement') {
      // pick implement op by consumer surface: uat->frontend, e2e/integration->backend
      const qual = /uat/.test(consumerLeg.op) ? 'frontend' : 'backend';
      return satisfyVar({ family: 'impl', suffix: 'X', state: 'done', _qual: qual }, consumerLeg, { soft });
    }
    if (soft) { consumerLeg.assumed.push(`needs a ${phase} leg — satisfied out-of-band`); return true; }
    gaps.push({ var: `<${phase} leg>`, neededBy: consumerLeg.op, candidates: [] });
    return false;
  }

  function expandPrerequisites(leg, op) {
    for (const pre of op?.route?.prerequisites ?? []) {
      const req = parsePrerequisite(pre, ops);
      if (req.kind === 'op') {
        // define-goal is itself the analyzed owner intake for this narrow
        // lifecycle archetype. Do not manufacture a generic request.analyze
        // leg ahead of the explicit canonicalization scope.
        if (hints.workspaceCanonicalization && leg.op === 'scope.define' && req.op === 'request.analyze') {
          leg.needsSatisfiedBy.push('owner goal entry (request analyzed for canonicalization scope)');
          continue;
        }
        // satisfied by S0? else ensure the leg exists
        const prodEntries = prodTable.byVar.filter(p => p.op === req.op);
        const oob = prodEntries.length && prodEntries.every(pe => settledOutOfBand(pe)) ? settledOutOfBand(prodEntries[0]) : null;
        if (oob) {
          leg.assumed.push(oob.note);
          leg.needsSatisfiedBy.push(`out-of-band: ${oob.record} (${oob.recordState})`);
          continue;
        }
        const s0ok = prodEntries.length && prodEntries.every(pe => satisfiedByS0({ family: pe.family, suffix: pe.suffix, state: pe.state }, s0)?.by === 's0');
        if (s0ok) { leg.needsSatisfiedBy.push(`S0 (${req.note})`); continue; }
        const dep = ensureLeg(req.op);
        edges.push([dep.legId, leg.legId]);
        leg.needsSatisfiedBy.push(`${dep.legId} (${req.note})`);
      } else if (req.kind === 'var') {
        // which impl qualifier does this consumer want? uat proofs read the
        // frontend slice; api/integration/perf proofs read the backend one.
        let qual; if (req.family === 'impl') qual = /uat/.test(leg.op) ? 'frontend' : 'backend';
        satisfyVar({ family: req.family, suffix: 'X', state: req.state, _qual: qual }, leg);
      } else if (req.kind === 'compound') {
        for (const n of req.needs) {
          if (n.anyPhase) satisfyPhase(n.anyPhase, leg, { soft: n.soft });
          else satisfyVar({ family: n.family, suffix: 'X', state: n.state }, leg, { conditional: n.conditional ?? null, soft: !!n.soft });
        }
      } else if (req.kind === 'anyPhase') {
        satisfyPhase(req.phase, leg, { soft: req.soft });
      } else {
        leg.conditions.push(req.note);
      }
    }
  }

  // ---- drive the chain from delta vars ----
  // The goal itself consumes S*; a goal variable settled out of band (a done
  // brand record) has no leg to carry its note, so it is reported goal-level.
  const goal = { op: '(goal)', legId: '(goal)', needsSatisfiedBy: [], conditions: [], assumed: [] };
  for (const v of sstar) {
    if (satisfiedByS0(v, s0, { goal: true })?.by === 's0') continue; // already true — delta excludes it
    // when the produced leg extends a done-but-touched surface, the reverify
    // rule (done-record-reverify) is applied in the legality pass below.
    satisfyVar(v, goal);
  }

  // ---- injected legs (business rules that needs/produces alone miss) ----
  const has = pred => [...legs.values()].some((leg) => pred(leg));
  // Workspace canonicalization is a distinct lifecycle scope. It first bounds
  // the migration/quiescence surface, pins behavior with migration tests,
  // refactors path consumers, reconstructs the canonical Work/stack roots,
  // then verifies. Sharing a project ledger with a product/landing workflow is
  // not itself a conflict; actual owned-path overlap and live-workflow custody
  // are evaluated later from the concrete scope.
  if (hints.workspaceCanonicalization) {
    const scope = ensureLeg('scope.define', {
      forVar: { family: 'scope', suffix: 'workspace-canonicalization', state: 'defined' },
      injected: 'canonicalization boundary and quiescence scope before migration effects',
    });
    const tests = ensureLeg('test.author', {
      forVar: { family: 'tests', suffix: 'workspace-canonicalization', state: 'authored' },
      injected: 'migration regression coverage before the behavior-invariant refactor',
    });
    const refactor = ensureLeg('code.refactor', {
      forVar: { family: 'impl', suffix: 'workspace-path-consumers', state: 'done' },
    });
    const workspace = ensureLeg('workspace.manage', {
      forVar: { family: 'workspace', suffix: '', state: 'managed' },
      injected: 'canonical root reconstruction replaces generic Work record remapping',
    });
    edges.push([scope.legId, tests.legId], [tests.legId, refactor.legId], [refactor.legId, workspace.legId]);
    tests.needsSatisfiedBy.push(`${scope.legId} (bounded canonicalization scope)`);
    workspace.needsSatisfiedBy.push(`${refactor.legId} (path consumers migrated before canonical root reconstruction)`);
  }
  // spec-foundation: after the SDS settles, workspace.manage's stacks mode
  // (the leg instance names the mode; the kernel enqueues params.mode=stacks)
  // declares .starcistacks from its component inventory, then review.verify
  // checks the reconstructed Work and stack roots.
  if (hints.specFoundation) {
    const stacks = ensureLeg('workspace.manage', {
      instance: 'stacks',
      forVar: { family: 'workspace', suffix: 'stacks', state: 'managed' },
      injected: 'workspace.manage stacks mode (params.mode=stacks): .starcistacks from the settled SDS component inventory',
    });
    const arch = legs.get('architecture.decide');
    if (arch) {
      edges.push([arch.legId, stacks.legId]);
      stacks.needsSatisfiedBy.push(`${arch.legId} (settled component inventory)`);
    }
    ensureLeg('review.verify', { forVar: { family: 'slice', suffix: 'X', state: 'reviewed' } });
  }
  // feature-build-fullstack: the interface walk runs on an API already proven
  // through its public surface, so e2e.verify precedes uat.verify.
  if (hints.fullstack && legs.has('e2e.verify') && legs.has('uat.verify')) {
    edges.push(['e2e.verify', 'uat.verify']);
    legs.get('uat.verify').needsSatisfiedBy.push('e2e.verify (the API the interface consumes is proven first)');
  }
  // investigate-first: a baseline perf.verify BEFORE scoping, then the closing
  // one after the build: evidence before boundary.
  if (hints.diagnosticFirst) {
    const close = legs.get('perf.verify');
    if (close) {
      const baseline = { ...close, legId: 'perf.verify#baseline', instance: 'baseline', producesCovered: ['perf.X: baseline (diagnostic measurement)'], needsSatisfiedBy: [], conditions: ['diagnostic leg — measures before scoping; its finding IS the scope input'], assumed: ['baseline runs against the existing product — no implementation leg precedes it'], extends: null, injected: 'investigate-first: evidence before boundary', _seq: -1 };
      legs.set('perf.verify#baseline', baseline);
      // closing verify now depends on baseline
      edges.push(['perf.verify#baseline', 'perf.verify']);
      close.needsSatisfiedBy.push('perf.verify#baseline (baseline measurement)');
      // scope.define (if present) depends on the baseline finding
      if (legs.has('scope.define')) {
        edges.push(['perf.verify#baseline', 'scope.define']);
        legs.get('scope.define').needsSatisfiedBy.push('perf.verify#baseline (finding is the scope input)');
      }
    }
  }
  // integration custody: provision.ask is pre-marked before integration.verify
  // (legality.yaml integration-after-custody).
  if (hints.custody || legs.has('integration.verify')) {
    if (legs.has('integration.verify')) {
      const ask = ensureLeg('provision.ask', { injected: 'integration-after-custody: owner credential/account custody before the live proof' });
      edges.push([ask.legId, 'integration.verify']);
      legs.get('integration.verify').needsSatisfiedBy.push('provision.ask (custody)');
    }
  }
  // work.author, two distinct roles:
  //  a) on a scoped feature chain the lanes read authored Work records —
  //     work.author runs BEFORE the implement legs (route prereq "scope defined");
  //  b) after code.refactor it REMAPS the implementation record's source
  //     mapping to the moved code (legality.yaml remap-after-refactor).
  if (!hints.workspaceCanonicalization && legs.has('scope.define') && has(l => stageRankOf(ops.get(l.op)) === 4 && l.op !== 'code.refactor')) {
    const wa = ensureLeg('work.author', { injected: 'lane reads authored Work records — scope.define produced the scope' });
    for (const l of legs.values()) {
      if (stageRankOf(ops.get(l.op)) === 4 && l.op !== 'code.refactor') {
        edges.push([wa.legId, l.legId]);
        l.needsSatisfiedBy.push('work.author (records authored)');
      }
    }
  }
  // canon-conformance: a review.verify lint leg measures the canon debt with canon-scan (the goal's
  // canonFamilies) before test.author pins behaviour; canon-scan's slices are the code.refactor cut, and a
  // canon fix moves no source mapping, so no work.author remap follows.
  if (hints.canonConformance && legs.has('test.author') && legs.has('code.refactor')) {
    const scan = { legId: 'review.verify#lint', op: 'review.verify', instance: 'lint', kernelParams: { mode: 'lint' },
      producesCovered: ['canon.X: measured (canon-scan findings and slices)'], needsSatisfiedBy: [], conditions: [],
      assumed: ['the scan reads the existing repository - no implementation leg precedes it'], extends: null,
      injected: 'canon-conformance: canon-scan measures the findings and cuts the slices before behaviour is pinned',
      yaml: ops.get('review.verify')?.file ?? null, _seq: -1 };
    legs.set(scan.legId, scan);
    edges.push([scan.legId, 'test.author']);
    legs.get('test.author').needsSatisfiedBy.push(`${scan.legId} (canon-scan findings and slices)`);
  }
  if (legs.has('code.refactor') && !hints.workspaceCanonicalization && !hints.canonConformance) {
    const wa = ensureLeg('work.author', { injected: 'remap-after-refactor: evidence pins sourceIdentity — a move without a remap invalidates it' });
    edges.push(['code.refactor', wa.legId]);
    wa.needsSatisfiedBy.push('code.refactor (moved code to remap)');
  }
  // review.verify: the kernel-planned module-tier read closing every build
  // chain (review.verify is not a lane step; modules/models/kinds.yaml plans
  // it at the module tier). Delta alone never produces it.
  if (has(l => stageRankOf(ops.get(l.op)) === 4) && !legs.has('review.verify')) {
    const rv = ensureLeg('review.verify', { injected: 'kernel-planned module-tier proof after the build legs (modules/models/kinds.yaml)' });
    for (const l of legs.values()) {
      if (stageRankOf(ops.get(l.op)) === 4) {
        edges.push([l.legId, rv.legId]);
        rv.needsSatisfiedBy.push(`${l.legId} (a delivery to inspect)`);
      }
    }
  }
  if (hints.workspaceCanonicalization && legs.has('workspace.manage') && legs.has('review.verify')) {
    edges.push(['workspace.manage', 'review.verify']);
    legs.get('review.verify').needsSatisfiedBy.push('workspace.manage (canonical roots reconstructed)');
  }
  // Owner MVP flow: draw the UX/UI first, then code the frontend AND the backend. The backend build waits behind
  // the same draw gate the frontend build does (DESIGN_NOT_SETTLED), so the two lanes start from one settled design.
  if (legs.has('interface.draw') && legs.has('backend.implement')) {
    edges.push(['interface.draw', 'backend.implement']);
    legs.get('backend.implement').needsSatisfiedBy.push('interface.draw (owner MVP flow: draw first, then code frontend and backend)');
  }
  // handover.review: the owner's acceptance closes every chain, after every
  // other leg (modules/ops/ops/handover.review.yaml; legality.yaml
  // producesVocabulary 'handover: approved'). starci kernel finish refuses a workflow
  // the owner has not approved, so no chain is complete without it.
  if (legs.size && !legs.has(HANDOVER_OP)) {
    const others = [...legs.values()];
    const handover = ensureLeg(HANDOVER_OP, {
      forVar: { family: 'handover', suffix: '', state: 'approved' },
      injected: 'owner handover: the final leg of every chain — the workflow is done only when the owner approves it',
    });
    for (const leg of others) edges.push([leg.legId, handover.legId]);
    handover.needsSatisfiedBy.push('every other leg of the chain (the delivery the owner is handed)');
  }

  return { legs, edges, gaps, assumptions, goalAssumed: [...new Set(goal.assumed)] };
}