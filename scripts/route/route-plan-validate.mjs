// route-plan-validate.mjs — the VALIDATE step of route-plan.mjs: topological order of the legs, the legality ladder over them and the
// owned directories each leg may write.
import { resolveOwnedDirs } from '../work/record-ownership.mjs';
import { stageRankOf } from './route-plan-chain.mjs';

export function topoSort(legs, edges) {
  const indeg = new Map([...legs.keys()].map(k => [k, 0]));
  const adj = new Map([...legs.keys()].map(k => [k, []]));
  for (const [f, t] of edges) {
    if (!legs.has(f) || !legs.has(t) || f === t) continue;
    if (!adj.get(f).includes(t)) { adj.get(f).push(t); indeg.set(t, indeg.get(t) + 1); }
  }
  const ready = () => [...legs.values()]
    .filter(l => indeg.get(l.legId) === 0)
    .sort((a, b) => (a._seq - b._seq) || a.legId.localeCompare(b.legId));
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
        const nl = legs.get(t);
        queue.push(nl);
        queue.sort((a, b) => (a._seq - b._seq) || a.legId.localeCompare(b.legId));
      }
    }
  }
  if (order.length !== legs.size) {
    const remaining = [...legs.keys()].filter(k => !seen.has(k));
    // find a cycle for the report
    const cycle = [];
    const dfs = (n, stack) => {
      if (stack.includes(n)) { cycle.push(...stack.slice(stack.indexOf(n)), n); return true; }
      for (const t of adj.get(n) ?? []) if (remaining.includes(t) && dfs(t, [...stack, n])) return true;
      return false;
    };
    for (const r of remaining) if (dfs(r, [])) break;
    return { order: null, cycle: cycle.length ? cycle : remaining };
  }
  return { order, cycle: null };
}

export function legalityCheck(order, legs, ops, s0) {
  const findings = [];
  const pos = new Map(order.map((l, i) => [l.legId, i]));
  // forward edge: verify-after-implement — a verify leg with no implement leg
  // before it AND no S0/out-of-band satisfaction is illegal.
  for (const leg of order) {
    const phase = ops.get(leg.op)?.route.phase?.[0];
    if (phase !== 'verify') continue;
    const hasImplBefore = order.slice(0, pos.get(leg.legId))
      .some(l => stageRankOf(ops.get(l.op)) === 4);
    const consumesPreExistingDelivery = ['uat.assisted.prepare', 'uat.assisted.verify'].includes(leg.op)
      && leg.conditions.some(c => /served build|controlled-run receipt/i.test(c));
    const s0ok = leg.needsSatisfiedBy.some(n => n.startsWith('S0:')) || leg.assumed.length || consumesPreExistingDelivery || !!leg.deliveredBy;
    if (!hasImplBefore && !s0ok && !legs.get(leg.legId)?.instance) {
      findings.push({ rule: 'verify-after-implement', leg: leg.legId, note: 'proof leg with no delivered slice before it' });
    }
  }
  // forward edge: designGate — interface.implement requires interface.draw before it.
  const impl = order.find(l => l.op === 'interface.implement');
  if (impl) {
    const drawPos = pos.get('interface.draw');
    if (drawPos === undefined || drawPos > pos.get(impl.legId)) {
      const s0ok = impl.needsSatisfiedBy.some(n => /S0.*draw|interface\.draw/.test(n));
      if (!s0ok) findings.push({ rule: 'draw-before-ui-build', leg: impl.legId, note: 'interface.implement without interface.draw (designGate)' });
    }
  }
  // UI proof order: implementation captures first, then read-only audit,
  // then business UAT. The op prerequisites normally produce these edges;
  // retain an explicit legality finding so a hand-authored delta cannot skip
  // the capture/audit boundary.
  const audit = order.find(l => l.op === 'interface.audit');
  const uat = order.find(l => l.op === 'uat.verify');
  if (audit && (!impl || pos.get(impl.legId) > pos.get(audit.legId))) {
    findings.push({ rule: 'capture-before-interface-audit', leg: audit.legId, note: 'interface.audit without a settled interface.implement before it' });
  }
  if (uat && (!audit || pos.get(audit.legId) > pos.get(uat.legId))) {
    findings.push({ rule: 'interface-audit-before-uat', leg: uat.legId, note: 'uat.verify without interface.audit no-actionable-drift before it' });
  }
  // stage-order sanity: no decide/direct leg AFTER an implement leg it does not
  // explicitly follow (registry coarse order — a warning-tier finding).
  // Injected legs (work.author remap, kernel-planned review.verify) carry their
  // own ordering rationale and are exempt.
  for (const leg of order) {
    if (leg.injected) continue;
    const r = stageRankOf(ops.get(leg.op));
    if (r < 4 && order.slice(0, pos.get(leg.legId)).some(l => stageRankOf(ops.get(l.op)) === 4)) {
      findings.push({ rule: 'decide-before-build-general', leg: leg.legId, note: 'pre-implementation leg ordered after a build leg' });
    }
  }
  // split rules: >=2 implement legs — disjointness needs allowlist data from S0.
  const implLegs = order.filter(l => stageRankOf(ops.get(l.op)) === 4);
  if (implLegs.length >= 2) {
    for (const l of implLegs) {
      const dirs = ownedDirsForLeg(l, s0, ops);
      l.parallel = dirs === null ? 'undetermined — no owned-path data to prove disjointness; serial until proven disjoint (legality.yaml serialFallback)'
        : dirs;
    }
  }
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