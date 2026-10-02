// shell-foundation.mjs - the layout chain of a product is ONE shared foundation, `shell`, across every workflow of a
// ledger (owner ruling 2026-09-29 draw-from-todo: "interface.draw must start from todo; if the parent is not drawn,
// draw the parent, or tell the supervisor"; the shell/layout ancestors are shared by the five nivo workflows).
//
// interface.draw never refuses because a layout above its record is todo or unsettled. `api dispatch` decides who
// draws the parents (scripts/kernel/verbs/dispatch.mjs):
//   - the chain is settled                        -> nothing to do, the draw only draws its screens;
//   - nobody owns foundation `shell` (or its owner stopped running, or it landed and the tree went unsettled again)
//                                                 -> this workflow CLAIMS it: its draw scans the tree, draws or
//                                                    captures the missing shell + ancestor layouts (and the brand
//                                                    lockup) first, settles them in its own writes, then draws its
//                                                    screens; settle lands the foundation when the tree is settled;
//   - a live workflow owns it                     -> this workflow is declared a DEPENDENT and the dispatch is
//                                                    deferred (`foundation-wait`); it never drafts a second shell;
//   - the owner claimed it longer ago than allocation.drawLoop.shellFoundationStallMs -> a Supervisor Decision Item
//     (kind cross-workflow) asks the Supervisor to re-dispatch a parent draw. No new workflow.
// The wait is judged at dispatch, the RESULT at the op's proof (scripts/work/ui/shell-conformance.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { appNamesOf, appOfUi, isLayoutTree, layoutChainOf, layoutSettlement, loadUiRecords, nodeById, nodesOf, readShellRecord, treeOf } from '../work/layout-tree.mjs';
import { openDecisionRow } from '../machine/decisions.mjs';
import { getWorkflow, workflowRunning } from './verbs/shared/rows.mjs';
import { claimFoundation, declareDependent, landFoundation, readDeclaration, readFoundation, writeDeclaration, writeFoundation } from './foundation-registry.mjs';

export const SHELL_FOUNDATION = 'shell';
export const FOUNDATION_WAIT = 'foundation-wait';
const WORK_ROOT = '.starciwork';
const DEFAULT_STALL_MS = 2 * 60 * 60 * 1000;

const plainPath = (value) => String(typeof value === 'string' ? value : value?.path ?? '')
  .trim().replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, '').replace(/^\.\//, '');
const segments = (value) => value.split('/').filter((part) => part && part !== '.');

/**
 * For every bound path that is a ui record (.../.starciwork/features/<f>/ui/<name>) carrying a `route`, the layout
 * nodes above that route that are not settled. A record that does not exist yet, declares no route, or names a route
 * the tree does not hold and no existing routeParent is `unknown` - the draw and its proof hold those.
 */
export function layoutChainVerdicts(repo, bindings) {
  const verdicts = [];
  const seen = new Set();
  for (const binding of bindings) {
    const parts = segments(plainPath(binding));
    const at = parts.indexOf(WORK_ROOT);
    if (at < 0 || !parts.slice(at + 1).includes('ui')) continue;
    const record = parts.join('/');
    if (seen.has(record)) continue;
    seen.add(record);
    try {
      const workRoot = path.join(repo, ...parts.slice(0, at + 1));
      const file = path.join(repo, ...parts, 'index.yaml');
      if (!fs.existsSync(file)) { verdicts.push({ record, unknown: 'the ui record does not exist yet' }); continue; }
      const ui = parseYaml(fs.readFileSync(file, 'utf8'));
      if (typeof ui?.route !== 'string') { verdicts.push({ record, unknown: 'the ui record declares no route' }); continue; }
      const shell = readShellRecord(workRoot);
      if (!shell || shell.error) { verdicts.push({ record, unknown: 'no readable shell record' }); continue; }
      if (!isLayoutTree(shell.record)) { verdicts.push({ record, route: ui.route, unsettled: [{ node: '(shell)', reasons: [`the shell record is ${shell.record.schema ?? 'unknown'}, not work/layout-tree@1 - starci work layout-tree scan --work <.starciwork> --write`] }] }); continue; }
      const resolved = appOfUi(shell.record, ui);
      if (resolved.error) { verdicts.push({ record, unknown: `${resolved.error.code}: ${resolved.error.message}` }); continue; }
      const tree = resolved.tree;
      const anchor = nodeById(tree, ui.route) ? ui.route : (typeof ui.routeParent === 'string' && nodeById(tree, ui.routeParent) ? ui.routeParent : null);
      if (!anchor) { verdicts.push({ record, unknown: `route ${ui.route} is not in the layout tree and names no existing routeParent` }); continue; }
      const drawingOwn = ui.surface === 'layout' && anchor === ui.route;
      const records = loadUiRecords(workRoot);
      const unsettled = (layoutChainOf(tree, anchor, { self: !drawingOwn }) ?? [])
        .map((node) => ({ node: node.id, ...layoutSettlement(tree, node, { shellDir: shell.dir, uiLoader: (id) => records.get(id) ?? null }) }))
        .filter((s) => !s.settled).map(({ node, reasons }) => ({ node, reasons }));
      verdicts.push({ record, route: ui.route, unsettled });
    } catch (error) {
      verdicts.push({ record, unknown: `layout chain unreadable (${String(error?.message ?? error)})` });
    }
  }
  return verdicts;
}

/**
 * Whether this dispatch has parents to draw: the brief's read marked `layoutFoundation` (interface.draw reads.shell),
 * and a shell that is missing, not a layout tree, or whose layouts above a bound record are unsettled. When the bound
 * record's own chain cannot be read yet (a new record, a route not in the tree) the whole tree is judged: any visible
 * layout not settled. Returns null when the op does not carry the mark, else {needed, reasons}.
 */
export function shellFoundationNeed({ brief, payload, repo }) {
  const read = (Array.isArray(brief?.reads) ? brief.reads : []).find((item) => item?.layoutFoundation === true);
  if (!read) return null;
  const records = (Array.isArray(payload?.records) ? payload.records : []).map(plainPath).filter(Boolean);
  const bindings = [...(Array.isArray(payload?.owned_paths) ? payload.owned_paths : []), ...records];
  const workRoot = (() => {
    for (const binding of bindings) {
      const parts = segments(plainPath(binding));
      const at = parts.indexOf(WORK_ROOT);
      if (at >= 0) return path.join(repo, ...parts.slice(0, at + 1));
    }
    return path.join(repo, WORK_ROOT);
  })();
  const reasons = [];
  const shell = readShellRecord(workRoot);
  if (!shell || shell.error) return { read: read.id, needed: true, reasons: [shell?.error ? `the shell record is unreadable (${shell.error})` : 'the shell record does not exist (todo)'] };
  if (!isLayoutTree(shell.record)) return { read: read.id, needed: true, reasons: [`the shell record is ${shell.record?.schema ?? 'unknown'}, not work/layout-tree@1`] };
  const verdicts = layoutChainVerdicts(repo, bindings);
  for (const verdict of verdicts) for (const item of verdict.unsettled ?? []) reasons.push(`${item.node}: ${item.reasons.join('; ')}`);
  if (verdicts.some((verdict) => verdict.unknown) || !verdicts.length) {
    const uiRecords = loadUiRecords(workRoot);
    for (const name of appNamesOf(shell.record)) {
      const tree = treeOf(shell.record, name);
      for (const node of nodesOf(tree).filter((n) => n.layout?.chrome !== 'passthrough' && n.layout)) {
        const { settled, reasons: why } = layoutSettlement(tree, node, { shellDir: shell.dir, uiLoader: (id) => uiRecords.get(id) ?? null });
        if (!settled) reasons.push(`${appNamesOf(shell.record).length > 1 ? `${name} ` : ''}${node.id}: ${why.join('; ')}`);
      }
    }
  }
  return { read: read.id, needed: reasons.length > 0, reasons };
}

const stallMsOf = (settings) => {
  const value = Number(settings?.drawLoop?.shellFoundationStallMs);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_STALL_MS;
};

/**
 * Decide, for one interface.draw dispatch that has parents to draw, who draws them.
 * -> {action: 'claimed'|'owner'|'wait', foundation, owner?, detail?, decision?}
 */
export function gateShellFoundation(ledger, { job, need, now = Date.now(), settings = {} }) {
  const db = ledger.db, workflowId = job.workflow_id;
  const existing = readFoundation(db, SHELL_FOUNDATION);
  const ownerId = existing?.owner?.workflowId ?? null;
  const ownerRunning = ownerId ? workflowRunning(getWorkflow(db, ownerId)) : false;
  const marker = () => { if (!readDeclaration(db, workflowId)) writeDeclaration(db, workflowId, { none: false, at: now }, now); };
  const why = need.reasons.slice(0, 4).join(' | ');
  if (ownerId === workflowId && existing.state === 'claimed') return { action: 'owner', foundation: SHELL_FOUNDATION };
  if (ownerId && ownerId !== workflowId && ownerRunning && existing.state === 'claimed') {
    const detail = `foundation ${SHELL_FOUNDATION} (the layout chain: shell + ancestor layouts + brand lockup) is claimed by running workflow ${ownerId}, which draws it; this workflow is a dependent and waits for the landing instead of drafting a second shell - the parents above this record are not settled yet (${why})`;
    const declared = declareDependent(existing, { name: SHELL_FOUNDATION, workflowId, detail: `waits on ${job.job_id}: ${why}`.slice(0, 400), now });
    ledger.transaction(() => {
      if (!declared.idempotent) {
        writeFoundation(db, declared.record, now);
        marker();
        ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: SHELL_FOUNDATION, kind: 'foundation-dependent-declared', payload: { name: SHELL_FOUNDATION, detail: `interface.draw ${job.job_id} waits on the shell` } });
      }
    });
    const claimedAt = existing.owner?.claimedAt ?? now;
    let decision = null;
    if (now - claimedAt > stallMsOf(settings)) {
      const summary = `Foundation ${SHELL_FOUNDATION} (shell + ancestor layouts) has been claimed by ${ownerId} for ${Math.round((now - claimedAt) / 60000)} min and is still not landed; interface.draw ${job.job_id} of ${workflowId} waits on it. Re-dispatch a parent draw (interface.draw of the surface-layout record) or hand the foundation to a live workflow (api foundation --claim ${SHELL_FOUNDATION}).`;
      try {
        decision = openDecisionRow(ledger, { workflowId, kind: 'cross-workflow', decider: 'supervisor', summary,
          entity: { type: 'workflow', id: ownerId }, idempotencyKey: `shell-foundation-stalled:${ownerId}:${claimedAt}`,
          evidence: [{ ref: `foundation ${SHELL_FOUNDATION} owner ${ownerId} claimedAt ${new Date(claimedAt).toISOString()}` }, ...need.reasons.slice(0, 6).map((ref) => ({ ref: ref.slice(0, 400) }))],
          by: 'dispatch' }, { now })?.di?.id ?? null;
      } catch { decision = null; }
    }
    return { action: 'wait', foundation: SHELL_FOUNDATION, owner: ownerId, detail, ...(decision ? { decision } : {}) };
  }
  // Nobody owns it, its owner stopped running, or it landed and the tree is unsettled again: this workflow draws the parents.
  const claim = claimFoundation(existing, { name: SHELL_FOUNDATION, workflowId, ownerRunning, kind: 'layout-tree', detail: `the layout chain drawn by ${job.job_id}`, now });
  ledger.transaction(() => {
    writeFoundation(db, claim.record, now);
    marker();
    ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: SHELL_FOUNDATION, kind: 'foundation-claimed',
      payload: { name: SHELL_FOUNDATION, kind: 'layout-tree', by: 'dispatch', job: job.job_id, transferredFrom: claim.transferredFrom, reopened: claim.reopened } });
  });
  return { action: 'claimed', foundation: SHELL_FOUNDATION, ...(claim.transferredFrom ? { transferredFrom: claim.transferredFrom } : {}) };
}

/**
 * After a pass of an interface.draw job: when this workflow owns foundation `shell` and the tree is now settled
 * (nothing left to draw or capture), land it, which releases every dependent. Best effort by design: a landing that
 * cannot be judged leaves the foundation claimed and the Supervisor sees the stall.
 */
export function landShellFoundationIfSettled(ledger, { job, brief, payload, repo, now = Date.now() }) {
  const db = ledger.db, workflowId = job.workflow_id;
  const existing = readFoundation(db, SHELL_FOUNDATION);
  if (!existing || existing.state !== 'claimed' || existing.owner?.workflowId !== workflowId) return null;
  const need = shellFoundationNeed({ brief, payload, repo });
  if (!need || need.needed) return { landed: false, reasons: need?.reasons ?? [] };
  const { record } = landFoundation(existing, { name: SHELL_FOUNDATION, workflowId, proof: `interface.draw ${job.job_id} passed with every layout of the tree settled (shell-conformance)`, now });
  ledger.transaction(() => {
    writeFoundation(db, record, now);
    ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: SHELL_FOUNDATION, kind: 'foundation-landed', payload: { name: SHELL_FOUNDATION, proof: record.landed.proof, by: 'settle', job: job.job_id } });
  });
  return { landed: true, dependents: (record.dependents ?? []).map((d) => d.workflowId) };
}

/** The wait a workflow's interface.draw is under: it is a declared dependent of a claimed foundation `shell` a live peer owns. */
export function shellFoundationWaitOf(db, workflowId) {
  const foundation = readFoundation(db, SHELL_FOUNDATION);
  const ownerId = foundation?.owner?.workflowId ?? null;
  if (!foundation || foundation.state !== 'claimed' || !ownerId || ownerId === workflowId) return null;
  if (!(foundation.dependents ?? []).some((d) => d.workflowId === workflowId)) return null;
  if (!workflowRunning(getWorkflow(db, ownerId))) return null;
  return { owner: ownerId, detail: `foundation ${SHELL_FOUNDATION} (shell + ancestor layouts) is drawn by ${ownerId}; the draw dispatches once it lands (api foundation --land) - never a second shell draft` };
}
