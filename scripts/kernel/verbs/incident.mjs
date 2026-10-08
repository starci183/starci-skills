// starci kernel incident: durable waits, resolution and shared-blocker routing.
import path from 'node:path';
import { newToken, openIncident, resolveIncident } from '../../../engine/db/ledger.mjs';
import { parseJson } from '../../lib/json.mjs';
import { csvList, getWorkflow } from './shared/rows.mjs';
import { PEER_WAIT, peerRefusalOf, releaseTypedWaits, writePeerMessage } from './shared/peer-waits.mjs';
import { OWNER_CLAIM_UNPROVEN, RESOLVERS, incidentKindOf, resolutionOwnerCheck } from '../../machine/owner-claim.mjs';
import { CONDITIONS_ATTACHED_EVENT, conditionLabel, parseConditions, sharedBlockerUntil } from '../gate-conditions.mjs';
import { declareDependent, readFoundation, writeFoundation } from '../foundation-registry.mjs';
import { AUTOPILOT_BY, SUPERVISOR_GATE, autopilotOn } from '../autopilot-run.mjs';
import { commitOwnerJobs, followUpMessage, resolveIntroducer } from '../introducer.mjs';
import { wakeKernelForTransition } from '../wake-delivery.mjs';
import { gateStepOf } from './shared/gate-raise.mjs';
import { answerGate } from './shared/gate-resolution.mjs';

export default {
  verb: 'incident',
  required: [],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(args.workflow, 'incident needs --workflow');
    if (!args.resolve && !args.attach) { need(args.kind, 'incident needs --kind (or --resolve <incidentId>)'); need(args.detail, 'incident needs --detail'); }
  },
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow, now = Date.now();
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (args.resolve) { incidentResolveExisting(ledger, db, workflowId, args, now, emit, path.resolve(args.repo ?? process.cwd())); return; }
    // Typed release conditions (scripts/kernel/gate-conditions.mjs): stored on the incident and checked
    // by the runtime, which resolves it once every one holds. An incident raised without them is
    // resolved only by the Kernel. --attach types an incident that is already open.
    const until = parseConditions(db, args.until, { workflowId });
    const typedRepo = path.resolve(args.repo ?? process.cwd());
    if (args.attach) { incidentAttachConditions({ ledger, db, workflowId, args, until, typedRepo, now, emit }); return; }
    const holds = String(args.holds ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    // A peer-wait names the peer workflow it waits on (openPeerWaits): only a running peer of this
    // workflow can land the thing and send the message that wakes it.
    const foundationCond = until.find((cond) => cond.type === 'foundation') ?? null;
    const landedCond = until.find((cond) => cond.type === 'landed') ?? null;
    const { peerWait, foundationWait } = peerWaitOf(db, workflowId, args, { foundationCond, landedCond });
    const incidentId = `inc-${newToken().slice(0, 12)}`;
    // Autopilot (owner ruling 2026-09-28 autopilot-run-to-finish): nothing waits on the owner mid-flow - an owner gate
    // the Kernel raises is a runtime/process wait and is recorded as the Supervisor's (supervisor-gate). An owner-only
    // need is an ask the runtime defers to handover (starci kernel autopilot --defer-to-handover), never a gate.
    const rerouted = internals.OWNER_GATE_KINDS.includes(args.kind) && autopilotOn(db, workflowId) ? { from: args.kind, to: SUPERVISOR_GATE } : null;
    if (rerouted) args = { ...args, kind: SUPERVISOR_GATE };
    // A supervisor-gate is raised after its cause's workaround (policy gateCauses): tried and recorded, or a typed reason there is none.
    const gate = gateStepOf(ledger, { workflowId, args, holds, until });
    if (gate.redirected) { emit(gate.out, gate.text, args.json); return; }
    openRaisedIncident(ledger, { incidentId, workflowId, args, now, rerouted, holds, peerWait, until, foundationWait, workaround: gate.workaround });
    // A condition that already holds resolves the wait now rather than at the next status.
    const released = until.length ? releaseTypedWaits(ledger, { repo: typedRepo, workflowId }).resolved.find((r) => r.incidentId === incidentId) ?? null : null;
    const sharedBlocker = args.kind === SHARED_BLOCKER ? routeSharedBlocker(ledger, { workflowId, incidentId, args, repo: typedRepo }) : null;
    const out = { ok: true, incidentId, workflowId, kind: args.kind, status: released ? 'resolved' : 'open', ...(holds.length ? { holds } : {}), ...(peerWait), ...(until.length ? { until } : {}), ...(released ? { autoResolved: released } : {}), ...(sharedBlocker ? { sharedBlocker } : {}) };
    emit(out, `incident ${incidentId} open on ${workflowId} — ${args.kind}${peerWaitNote(peerWait)}: ${args.detail}`, args.json);
    if (!args.json) printRelease({ until, released, sharedBlocker });
  },
};

// A peer-wait kind names the peer it waits on; a peer, bare --until-message or foundation condition on any other kind is refused.
function peerWaitOf(db, workflowId, args, { foundationCond, landedCond }) {
  if (args.kind === PEER_WAIT) return peerWaitSpecOf(db, workflowId, args, { foundationCond, landedCond });
  if (args.peer || args['until-message'] || foundationCond) {
    // A peer's foundation is waited on as a peer-wait, never an owner-gate (driver-loop.yaml foundations.depend).
    throw Object.assign(new Error('--peer, a bare --until-message and --until-foundation go with --kind peer-wait (an open incident is typed with --attach)'), { code: 'peer-wait-kind-mismatch' });
  }
  return { peerWait: null, foundationWait: null };
}

// The incident row and its raised event, in one transaction; a wait on a foundation makes the waiter its dependent.
function openRaisedIncident(ledger, { incidentId, workflowId, args, now, rerouted, holds, peerWait, until, foundationWait, workaround }) {
  const db = ledger.db;
  ledger.transaction(() => {
    openIncident(db, { incidentId, workflowId, kind: args.kind, opId: args.op ?? null, detail: args.detail, lastProgress: `[${args.kind}] ${args.detail}`, at: now });
    ledger.appendEvent({
      workflowId, entityType: 'incident', entityId: incidentId,
      kind: 'incident-raised', payload: { kind: args.kind, ...(rerouted ? { rerouted, by: AUTOPILOT_BY } : {}), detail: args.detail, opId: args.op ?? null, ...(holds.length ? { holds } : {}), ...(peerWait), ...(until.length ? { until } : {}), ...(workaround ? { workaround } : {}) },
    });
    // A wait on a foundation makes the waiter its dependent, so the landing notifies it.
    if (foundationWait && !(foundationWait.foundation.dependents ?? []).some((d) => d.workflowId === workflowId)) {
      writeFoundation(db, declareDependent(foundationWait.foundation, { name: foundationWait.name, workflowId, detail: args.detail, now }).record, now);
      ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: foundationWait.name, kind: 'foundation-dependent-declared', payload: { name: foundationWait.name, via: incidentId } });
    }
  });
}

function printRelease({ until, released, sharedBlocker }) {
  if (until.length) console.log(`  typed release: ${until.map(conditionLabel).join(' AND ')}${metNote(released)}`);
  if (!sharedBlocker) return;
  if (sharedBlocker.routed) console.log(`  shared blocker routed to ${sharedBlocker.to} as follow-up ${sharedBlocker.key} (introduced by ${sharedBlocker.introducedBy ?? sharedBlocker.to}, via ${sharedBlocker.via})`);
  else console.log(`  shared blocker NOT routed: ${sharedBlocker.why}`);
}

const SHARED_BLOCKER = 'shared-blocker';

const metNote = (released) => released ? ` — already met, resolved: ${released.evidence.join('; ')}` : '';
const peerWaitNote = (peerWait) => {
  if (!peerWait) return '';
  const messageNote = peerWait.untilMessage ? ' (until its next message)' : '';
  const foundationNote = peerWait.untilFoundation ? ` (until foundation ${peerWait.untilFoundation} lands)` : '';
  return ` on ${peerWait.peer}${messageNote}${foundationNote}`;
};

/** The refusal of a resolution that rests on an owner claim no verified owner answer backs. */
function refuseUnprovenOwnerClaim(row, ownerCheck, changed) {
  if (!changed || !ownerCheck.needs || ownerCheck.proven) return;
  const tried = ownerCheck.tried.map((t) => t.reason).join('; ');
  const triedNote = tried ? ` (${tried})` : '';
  throw Object.assign(new Error(`incident ${row.incident_id} not resolved: ${ownerCheck.why}, but no verified owner answer backs it${triedNote}. Name the ask the owner answered with --owner-answer <dispatchId> (its ask-answered event and receipt must both say answeredBy owner). No such answer: keep the incident open and raise or keep an owner ask (the owner answers it); resolved by the Kernel or the supervisor without the owner, say --by kernel|supervisor and state what landed, never that the owner decided`), { code: OWNER_CLAIM_UNPROVEN });
}

function incidentResolveExisting(ledger, db, workflowId, args, now, emit, repo) {
  const row = db.prepare('SELECT incident_id,status,last_progress FROM incidents WHERE incident_id=? AND workflow_id=?').get(args.resolve, workflowId);
  if (!row) throw Object.assign(new Error(`incident ${args.resolve} is not on ${workflowId}`), { code: 'incident-unknown' });
  // Who resolves it, and the owner answer any owner claim rests on (scripts/machine/owner-claim.mjs):
  // free text saying "Owner confirmed" is no owner answer (inc-2474f6593dfe, inc-f19d118298f1).
  const by = typeof args.by === 'string' && args.by.trim() ? args.by.trim() : null;
  if (by && !RESOLVERS.includes(by)) throw Object.assign(new Error(`--by ${by}: a resolution is by ${RESOLVERS.join(', ')}`), { code: 'resolver-invalid' });
  const ownerCheck = resolutionOwnerCheck(db, { kind: incidentKindOf(row.last_progress), detail: args.detail ?? '', by, ownerAnswer: csvList(args['owner-answer']) });
  const changed = row.status === 'open';
  // A supervisor-gate is answered with a typed resolution (gate-resolution.mjs); a `fixed` whose commit has not landed keeps it open for the runtime to resolve.
  const answered = answerGate(ledger, { workflowId, row, args, by: ownerCheck.by, repo, isGate: incidentKindOf(row.last_progress) === SUPERVISOR_GATE });
  if (answered?.waiting) {
    emit({ ok: true, incidentId: row.incident_id, workflowId, status: 'open', changed: false, answered: answered.answer }, `incident ${row.incident_id} answered fixed ${answered.answer.commit.slice(0, 12)}: the runtime resolves it once the live runtime contains the commit`, args.json);
    return;
  }
  refuseUnprovenOwnerClaim(row, ownerCheck, changed);
  if (changed) {
    ledger.transaction(() => {
      resolveIncident(db, { incidentId: row.incident_id, reason: 'answered', at: now });
      ledger.appendEvent({
        workflowId, entityType: 'incident', entityId: row.incident_id,
        kind: 'incident-resolved', payload: { detail: args.detail ?? null, by: ownerCheck.by, ...(answered ? { resolution: answered.answer.resolution } : {}),
          ...(ownerCheck.proof ? { ownerAnswer: { dispatchId: ownerCheck.proof.dispatchId, workflowId: ownerCheck.proof.workflowId, receiptPath: ownerCheck.proof.receiptPath } } : {}) },
      });
    });
  }
  answered?.wake();
  const out = { ok: true, incidentId: row.incident_id, workflowId, status: 'resolved', changed, ...(answered ? { answered: answered.answer } : {}), ...(changed ? { by: ownerCheck.by, ...(ownerCheck.proof ? { ownerAnswer: ownerCheck.proof.dispatchId } : {}) } : {}) };
  emit(out, `incident ${row.incident_id} ${changed ? 'resolved' : 'was already ' + row.status} on ${workflowId}`, args.json);
}

function incidentAttachConditions({ ledger, db, workflowId, args, until, typedRepo, now, emit }) {
  const row = db.prepare('SELECT incident_id,status FROM incidents WHERE incident_id=? AND workflow_id=?').get(args.attach, workflowId);
  if (!row) throw Object.assign(new Error(`incident ${args.attach} is not on ${workflowId}`), { code: 'incident-unknown' });
  if (row.status !== 'open') throw Object.assign(new Error(`incident ${args.attach} is ${row.status}; only an open incident takes release conditions`), { code: 'incident-not-open' });
  if (!until.length) throw Object.assign(new Error('--attach needs at least one --until-<type> condition'), { code: 'until-missing' });
  ledger.transaction(() => {
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: row.incident_id, kind: CONDITIONS_ATTACHED_EVENT,
      payload: { until, detail: args.detail ?? null } });
    // A wait typed on a shared foundation makes its workflow a dependent, so the landing notifies it.
    for (const cond of until.filter((item) => item.type === 'foundation')) {
      const foundation = readFoundation(db, cond.name);
      if (!foundation || (foundation.dependents ?? []).some((d) => d.workflowId === workflowId) || foundation.owner?.workflowId === workflowId) continue;
      writeFoundation(db, declareDependent(foundation, { name: cond.name, workflowId, detail: args.detail ?? null, now }).record, now);
      ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: cond.name, kind: 'foundation-dependent-declared', payload: { name: cond.name, via: row.incident_id } });
    }
  });
  const released = releaseTypedWaits(ledger, { repo: typedRepo, workflowId }).resolved.find((r) => r.incidentId === row.incident_id) ?? null;
  const out = { ok: true, incidentId: row.incident_id, workflowId, status: released ? 'resolved' : 'open', until, ...(released ? { autoResolved: released } : {}) };
  emit(out, `incident ${row.incident_id} on ${workflowId} now releases on ${until.map(conditionLabel).join(' AND ')}${metNote(released)}`, args.json);
}

// The shared foundation a peer-wait is typed on; refuses an unknown, landed or unowned foundation or another owner than the named peer.
function foundationWaitOf(db, name, peer) {
  const foundation = readFoundation(db, name);
  if (!foundation) throw Object.assign(new Error(`no shared foundation ${name} is registered; its owner claims it (starci kernel foundation --claim ${name}) or you declare the need (starci kernel foundation --declare-dependent ${name}) first`), { code: 'foundation-unknown' });
  if (foundation.state === 'landed') throw Object.assign(new Error(`foundation ${name} already landed (${foundation.version ?? 'no version'}: ${foundation.landed?.proof ?? '-'}); there is nothing to wait for`), { code: 'foundation-landed' });
  if (!foundation.owner) throw Object.assign(new Error(`foundation ${name} has no owner yet, so nothing would land it; agree its owner with your peers (starci kernel notify) and have it claimed first`), { code: 'foundation-unowned' });
  if (peer && peer !== foundation.owner.workflowId) throw Object.assign(new Error(`foundation ${name} is owned by ${foundation.owner.workflowId}, not ${peer}`), { code: 'foundation-peer-mismatch' });
  return { name, foundation };
}

// The --peer spec of a peer-wait, resolved through --until-landed / --until-foundation; throws the refusal.
function peerWaitSpecOf(db, workflowId, args, { foundationCond, landedCond }) {
  let peer = typeof args.peer === 'string' ? args.peer.trim() : '';
  // --until-landed <wf>@<repository>: the wait is on that workflow's product land (gate-conditions.mjs); it is the peer.
  if (landedCond) {
    if (peer && peer !== landedCond.workflowId) throw Object.assign(new Error(`--until-landed names ${landedCond.workflowId}, not --peer ${peer}`), { code: 'landed-peer-mismatch' });
    peer = landedCond.workflowId;
  }
  // --until-foundation <name>: a typed wait released when that shared foundation lands (a
  // gate-conditions.mjs condition; starci kernel foundation --land resolves it and wakes this Kernel). Its
  // peer is the foundation's owner.
  const foundationWait = foundationCond ? foundationWaitOf(db, foundationCond.name, peer) : null;
  if (foundationWait) peer = foundationWait.foundation.owner.workflowId;
  if (!peer) throw Object.assign(new Error('a peer-wait names the workflow it waits on: --peer <workflowId>'), { code: 'peer-wait-peer-missing' });
  const refusal = peerRefusalOf(db, getWorkflow(db, workflowId), peer);
  if (refusal) throw Object.assign(new Error(`peer-wait on ${peer} refused: ${refusal.detail}`), { code: refusal.code });
  return { foundationWait, peerWait: { peer, untilMessage: args['until-message'] === true, refs: csvList(args.refs),
    ...(foundationWait ? { untilFoundation: foundationWait.name } : {}),
    ...(landedCond ? { untilLanded: `${landedCond.workflowId}@${landedCond.repository}` } : {}) } };
}

function routeSharedBlocker(ledger, { workflowId, incidentId, args, repo }) {
  const db = ledger.db;
  const self = getWorkflow(db, workflowId);
  const commits = csvList(args['introduced-by']);
  const explicit = typeof args.introducer === 'string' && args.introducer.trim() ? args.introducer.trim() : null;
  if (!commits.length && !explicit) return { routed: false, why: 'no --introduced-by commit or --introducer workflow named' };
  const roots = [...new Set([repo, ...db.prepare('SELECT source_roots_json FROM workflows').all()
    .flatMap((row) => parseJson(row.source_roots_json, []) ?? [])].filter(Boolean).map((r) => path.resolve(r)))];
  const found = resolveIntroducer(db, { commits, roots, explicit });
  const record = (routing) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId,
    kind: 'shared-blocker-routed', payload: routing }));
  if (found.unresolved) { const routing = { routed: false, why: found.why, commit: found.commit ?? null, introducedBy: found.introducedBy ?? null }; record(routing); return routing; }
  if (found.workflowId === workflowId) {
    const routing = { routed: false, why: 'this workflow introduced it: repair it as your own defect', to: workflowId, via: found.via, commit: found.commit };
    record(routing); return routing;
  }
  const refusal = peerRefusalOf(db, self, found.workflowId);
  if (refusal) { const routing = { routed: false, why: refusal.detail, to: found.workflowId, via: found.via, commit: found.commit }; record(routing); return routing; }
  const { subject, body } = followUpMessage({ incidentId, reporter: workflowId, detail: String(args.detail ?? ''), commit: found.commit, via: found.via,
    fix: typeof args.fix === 'string' && args.fix.trim() ? args.fix.trim() : null });
  // The reporter's incident becomes a typed wait on the introducer's repair (gate-conditions.mjs
  // sharedBlockerUntil): the runtime releases it, and it is never OWED on the supervisor.
  const raisedAt = db.prepare("SELECT created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised'").get(workflowId, incidentId)?.created_at ?? Date.now();
  const typed = Array.isArray(args.until) && args.until.length ? null
    : sharedBlockerUntil(db, { to: found.workflowId, text: `${args.detail ?? ''} ${args.fix ?? ''}`, since: raisedAt,
      ownerJobs: commitOwnerJobs(db, { workflowId: found.workflowId, commits: [...new Set([found.commit, ...commits].filter(Boolean))], roots }) });
  let sent;
  ledger.transaction(() => {
    const now = Date.now();
    sent = writePeerMessage(ledger, { from: self, to: found.workflowId, kind: 'follow-up', subject, body,
      refs: [incidentId, ...(found.commit ? [found.commit] : [])], extra: { followUp: { incidentId, commit: found.commit, via: found.via, introducedBy: found.introducedBy } }, now });
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: 'shared-blocker-routed',
      payload: { routed: true, to: found.workflowId, key: sent.key, via: found.via, commit: found.commit, introducedBy: found.introducedBy, ...(found.successorOf ? { successorOf: found.successorOf } : {}), ...(typed ? { until: typed } : {}) } });
  });
  let wake = null;
  try {
    wake = wakeKernelForTransition(ledger, { workflowId: found.workflowId, transition: 'follow-up-received', lines: [
      `${workflowId} routed follow-up ${sent.key} (incident ${incidentId}) to you.`,
      'Re-read canonical starci kernel status and starci kernel inbox now; act on the follow-up in your scope, then ack it.',
    ] });
  } catch { wake = null; }
  return { routed: true, to: found.workflowId, key: sent.key, via: found.via, commit: found.commit, introducedBy: found.introducedBy, ...(found.successorOf ? { successorOf: found.successorOf } : {}), ...(typed ? { until: typed } : {}), ...(wake ? { wake } : {}) };
}
