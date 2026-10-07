// route-plan-validate.mjs — the VALIDATE step of route-plan.mjs: topological order of the legs, the legality ladder over them and the
// owned directories each leg may write.
import { resolveOwnedDirs } from '../work/record-ownership.mjs';
import { stageRankOf } from './route-plan-chain.mjs';

const bySeq = (a, b) => (a._seq - b._seq) || a.legId.localeCompare(b.legId);

// The edges between known, distinct legs: each leg's in-degree and its successors (an edge counts once).
function dependencyGraph(legs, edges) {
  const indeg = new Map([...legs.keys()].map(k => [k, 0]));
  const adj = new Map([...legs.keys()].map(k => [k, []]));
  for (const [f, t] of edges) {
    if (!legs.has(f) || !legs.has(t) || f === t) continue;
    if (!adj.get(f).includes(t)) { adj.get(f).push(t); indeg.set(t, indeg.get(t) + 1); }
  }
  return { indeg, adj };
}

// A cycle among the legs that never became ready, for the report: the first one found, else all of them.
function cycleOf(adj, remaining) {
  const cycle = [];
  const dfs = (n, stack) => {
    if (stack.includes(n)) { cycle.push(...stack.slice(stack.indexOf(n)), n); return true; }
    for (const t of adj.get(n) ?? []) if (remaining.includes(t) && dfs(t, [...stack, n])) return true;
    return false;
  };
  for (const r of remaining) if (dfs(r, [])) break;
  return cycle.length ? cycle : remaining;
}

export function topoSort(legs, edges) {
  const { indeg, adj } = dependencyGraph(legs, edges);
  const ready = () => [...legs.values()]
    .filter(l => indeg.get(l.legId) === 0)
    .sort(bySeq);
  // stable pick: earliest insertion (delta order) wins; stage rank is a
  // legality check afterwards, not a sort key — wrong order is a finding.
  const order = [];
  const seen = new Set();
  const queue = [...ready()];
  while (queue.length) {
    const l = queue.shift();
    if (seen.has(l.legId)) continue;
    seen.add(l.legId);
    order.push(l);
    for (const t of adj.get(l.legId)) {
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) {
        queue.push(legs.get(t));
        queue.sort(bySeq);
      }
    }
  }
  if (order.length === legs.size) return { order, cycle: null };
  return { order: null, cycle: cycleOf(adj, [...legs.keys()].filter(k => !seen.has(k))) };
}

const buildBefore = (order, pos, ops, leg) => order.slice(0, pos.get(leg.legId)).some(l => stageRankOf(ops.get(l.op)) === 4);

// forward edge: verify-after-implement — a verify leg with no implement leg
// before it AND no S0/out-of-band satisfaction is illegal.
function verifyAfterImplement(order, pos, legs, ops) {
  const findings = [];
  for (const leg of order) {
    const phase = ops.get(leg.op)?.route.phase?.[0];
    if (phase !== 'verify') continue;
    const consumesPreExistingDelivery = ['uat.assisted.prepare', 'uat.assisted.verify'].includes(leg.op)
      && leg.conditions.some(c => /served build|controlled-run receipt/i.test(c));
    const s0ok = leg.needsSatisfiedBy.some(n => n.startsWith('S0:')) || leg.assumed.length || consumesPreExistingDelivery || !!leg.deliveredBy;
    if (!buildBefore(order, pos, ops, leg) && !s0ok && !legs.get(leg.legId)?.instance) {
      findings.push({ rule: 'verify-after-implement', leg: leg.legId, note: 'proof leg with no delivered slice before it' });
    }
  }
  return findings;
}

// forward edge: designGate — interface.implement requires interface.draw before it.
function designGate(order, pos) {
  const impl = order.find(l => l.op === 'interface.implement');
  if (!impl) return [];
  const drawPos = pos.get('interface.draw');
  if (drawPos !== undefined && drawPos <= pos.get(impl.legId)) return [];
  const s0ok = impl.needsSatisfiedBy.some(n => /S0.*draw|interface\.draw/.test(n));
  return s0ok ? [] : [{ rule: 'draw-before-ui-build', leg: impl.legId, note: 'interface.implement without interface.draw (designGate)' }];
}

// UI proof order: implementation captures first, then read-only audit,
// then business UAT. The op prerequisites normally produce these edges;
// retain an explicit legality finding so a hand-authored delta cannot skip
// the capture/audit boundary.
function uiProofOrder(order, pos) {
  const findings = [];
  const impl = order.find(l => l.op === 'interface.implement');
  const audit = order.find(l => l.op === 'interface.audit');
  const uat = order.find(l => l.op === 'uat.verify');
  if (audit && (!impl || pos.get(impl.legId) > pos.get(audit.legId))) {
    findings.push({ rule: 'capture-before-interface-audit', leg: audit.legId, note: 'interface.audit without a settled interface.implement before it' });
  }
  if (uat && (!audit || pos.get(audit.legId) > pos.get(uat.legId))) {
    findings.push({ rule: 'interface-audit-before-uat', leg: uat.legId, note: 'uat.verify without interface.audit no-actionable-drift before it' });
  }
  return findings;
}

// stage-order sanity: no decide/direct leg AFTER an implement leg it does not
// explicitly follow (registry coarse order — a warning-tier finding).
// Injected legs (work.author remap, kernel-planned review.verify) carry their
// own ordering rationale and are exempt.
function stageOrderSanity(order, pos, ops) {
  const findings = [];
  for (const leg of order) {
    if (leg.injected) continue;
    if (stageRankOf(ops.get(leg.op)) < 4 && buildBefore(order, pos, ops, leg)) {
      findings.push({ rule: 'decide-before-build-general', leg: leg.legId, note: 'pre-implementation leg ordered after a build leg' });
    }
  }
  return findings;
}

// split rules: >=2 implement legs — disjointness needs allowlist data from S0.
function markParallelLegs(order, ops, s0) {
  const implLegs = order.filter(l => stageRankOf(ops.get(l.op)) === 4);
  if (implLegs.length < 2) return;
  for (const l of implLegs) {
    const dirs = ownedDirsForLeg(l, s0, ops);
    l.parallel = dirs === null ? 'undetermined — no owned-path data to prove disjointness; serial until proven disjoint (legality.yaml serialFallback)'
      : dirs;
  }
}

export function legalityCheck(order, legs, ops, s0) {
  const pos = new Map(order.map((l, i) => [l.legId, i]));
  const findings = [
    ...verifyAfterImplement(order, pos, legs, ops),
    ...designGate(order, pos),
    ...uiProofOrder(order, pos),
    ...stageOrderSanity(order, pos, ops),
  ];
  markParallelLegs(order, ops, s0);
  return findings;
}

/** Owned dirs for an implement leg, resolved from S0 records matching the leg's
 *  produced surface. null when no record/ownership data exists. */
function ownedDirsForLeg(leg, s0, ops) {
  if (!s0?.recordsById) return null;
  const dirs = [];
  for (const rec of s0.records) {
    if (rec.schema !== 'work/implementation@1') continue;
    for (const d of resolveOwnedDirs(rec.id, { data: s0.recordsById.get(rec.id).data }, s0.recordsById, s0.workspaceDoc, s0.root)) {
      dirs.push(d.rel);
    }
  }
  return dirs.length ? { ownedDirs: [...new Set(dirs)], note: 'disjointness check requires per-leg allowlists — listed dirs are the surfaces touched' } : null;
}