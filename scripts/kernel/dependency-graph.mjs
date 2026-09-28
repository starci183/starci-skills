// dependency-graph.mjs — the cross-workflow dependency graph of one ledger, its findings, and the
// Supervisor's bridging records (owner mandate 2026-09-28: the [Supervisor] "adds supplementary
// workflows when two workflows depend on each other, and reorganizes workflows").
//
// Cross-workflow dependencies surfaced one at a time - a peer-wait, a foundation's dependents, a typed
// --until-job on a peer's job, a foreign-file incident, a record-change refused because another
// workflow owns the record - and stalled both sides (nivo module-studio and collab-group-chat both
// peer-waited on workspace-provision's queued repair op-e2e.verify-9fb01b4fe6 while workspace-provision
// sat behind its own owner-gates). This read-only projection puts them in one graph:
//
//   node     every live workflow (phase running or queued, not archived)
//   edge     waiter -> blocker, one per piece of evidence:
//              peer-wait         an open [peer-wait] incident names --peer            (hard)
//              until-*           a typed release condition names a peer's job, record,
//                                message, incident or foundation (gate-conditions.mjs) (hard)
//              gate-names        an open gate names a peer's job (waiter-priority.mjs)  (hard)
//              peer-request      a pending peer request names a peer's job or record     (soft)
//              foundation        a dependent of a foundation that has not landed          (soft)
//              foreign-file      an open [foreign-file-committed] incident names a file a
//                                peer owns                                                (hard)
//              record-owner      api record-change was refused: the record is a peer's    (soft)
//              work-graph-read   a work-graph node reads a path a peer's node owns        (soft)
//   finding  circular-wait   a cycle over hard edges
//            unowned-need    a need nobody live owns: a foundation with live dependents whose owner
//                            is missing or stopped, a wait on a stopped peer, a shared blocker the
//                            runtime could not route
//            hub-blocker     one workflow holds >= 2 other live workflows over hard edges
//            duplicate-work  two live workflows build the same thing: open jobs owning intersecting
//                            paths, work-graph nodes owning intersecting paths, or two foundations
//                            that are one foundation under two names (nivo.brand ~ brand)
//   proposal each finding carries the Supervisor's action (scripts/supervisor/bridge.mjs): bridge,
//            transfer, revise or designate, with clearCut true only when the evidence leaves no
//            judgement (the rule is stated on the proposal).
//
// Bridging records live in the ledger's `signals` table (no schema migration), scope
// 'supervisor-bridge', key <bridgeId>, value BRIDGE_SCHEMA; a path/record ownership transfer is scope
// 'ownership-transfer', key <normalized path> (read by work-ownership.mjs ownerOf, rule 0).
import { blockingJobs } from './waiter-priority.mjs';
import { typedIncidents } from './gate-conditions.mjs';
import { readFoundations } from './foundations.mjs';
import { TRANSFER_SCHEMA, TRANSFER_SCOPE, createOwnership, normWork, ownedOf, readTransfers } from './work-ownership.mjs';
import { latestVersion } from '../work/work-graph-store.mjs';
import { parseJson } from '../lib/json.mjs';
import { list } from '../lib/list.mjs';

export const BRIDGE_SCOPE = 'supervisor-bridge';
export const BRIDGE_SCHEMA = 'starci/supervisor-bridge@1';
export const BRIDGE_ACTIONS = Object.freeze(['bridge', 'transfer', 'revise', 'designate']);
export const FINDING_KINDS = Object.freeze(['circular-wait', 'unowned-need', 'hub-blocker', 'duplicate-work']);
export const RECORD_CHANGE_REFUSED = 'record-change-refused';
// A blocking job queued at least this long with >= 2 workflows on it is stuck, not merely next.
export const HUB_STUCK_MS = 2 * 3_600_000;
// A refused record-change older than this no longer counts as a live dependency.
const REFUSAL_WINDOW_MS = 7 * 86_400_000;
const HARD = 'hard', SOFT = 'soft';
const OPEN_JOB = ['queued', 'leased', 'running', 'answering', 'effect_unknown'];
// Names that are one foundation under two spellings: a dotted project prefix and a starci- prefix
// drop, and the shell is the layout tree (work-ownership.mjs FOUNDATION_ROOTS).
const FOUNDATION_SYNONYMS = { shell: 'layout-tree', layout: 'layout-tree', 'layout-shell': 'layout-tree' };
// Registration points every feature touches (a Nest root module, a manifest, the Work catalog): two
// workflows owning one of them is shared wiring, not duplicated work.
const SHARED_WIRING = /(?:^|\/)(?:app\.module\.ts|package\.json|package-lock\.json|pnpm-lock\.yaml|architecture\.json|\.starciwork\/index\.yaml)$/;

const kindOf = (text) => /^\[([^\]]+)\]/.exec(String(text ?? ''))?.[1] ?? null;
const clip = (s, n = 200) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const pathForm = (p) => normWork(typeof p === 'string' ? p : p?.path).toLowerCase();
const within = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
export const shortWorkflow = (wf) => String(wf ?? '').replace(/^wf-/, '').replace(/-[a-z0-9]{8}$/i, '');

/** The alias key of a foundation name: `nivo.brand` and `brand` are one foundation, `shell` is `layout-tree`. */
export function foundationAliasKey(name) {
  const stripped = String(name ?? '').toLowerCase().replace(/^[a-z0-9-]+\./, '').replace(/^starci-/, '');
  return FOUNDATION_SYNONYMS[stripped] ?? stripped;
}

const readScope = (db, scope, schema) => db.prepare('SELECT key,value_json FROM signals WHERE scope=? ORDER BY key').all(scope)
  .map((row) => parseJson(row.value_json)).filter((value) => value?.schema === schema);
/** Every bridging record of the ledger, oldest first. */
export const readBridges = (db) => readScope(db, BRIDGE_SCOPE, BRIDGE_SCHEMA).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
export const readBridge = (db, id) => { const v = parseJson(db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(BRIDGE_SCOPE, id)?.value_json); return v?.schema === BRIDGE_SCHEMA ? v : null; };
export const writeBridge = (db, record, now = Date.now()) => db.prepare(
  'INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,NULL,NULL,?,?,NULL)',
).run(BRIDGE_SCOPE, record.id, JSON.stringify(record), now);
export const writeTransfer = (db, record, now = Date.now()) => db.prepare(
  'INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,NULL,NULL,?,?,NULL)',
).run(TRANSFER_SCOPE, record.path, JSON.stringify(record), now);

/** One bridge record as a status/peers row. */
export const bridgeBrief = (b) => ({ id: b.id, action: b.action, state: b.state ?? null, provisional: b.provisional === true, reason: clip(b.reason, 300),
  ...(b.workflowId ? { workflowId: b.workflowId } : {}), ...(b.foundation ? { foundation: b.foundation } : {}), ...(b.blocker ? { blocker: b.blocker } : {}),
  ...(b.dependents ? { dependents: b.dependents } : {}), ...(b.owner ? { owner: b.owner } : {}), ...(b.waiter ? { waiter: b.waiter } : {}),
  ...(b.to ? { to: b.to } : {}), ...(b.from ? { from: b.from } : {}), ...(b.target ? { target: b.target } : {}), at: b.at ?? null });

/** Strongly connected components with >= 2 nodes (Tarjan), each sorted. */
function cyclesOf(nodes, edges) {
  const out = new Map(nodes.map((n) => [n, []]));
  for (const e of edges) out.get(e.from)?.push(e.to);
  let index = 0;
  const idx = new Map(), low = new Map(), stack = [], on = new Set(), sccs = [];
  const visit = (v) => {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v);
    for (const w of out.get(v) ?? []) {
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const scc = [];
      let w;
      do { w = stack.pop(); on.delete(w); scc.push(w); } while (w !== v);
      if (scc.length > 1) sccs.push(scc.sort());
    }
  };
  for (const n of nodes) if (!idx.has(n)) visit(n);
  return sccs;
}

/**
 * The dependency graph of one ledger: {nodes, edges, findings, bridges, transfers}. `light` skips the
 * work-graph and foreign-file reads (api status). Never throws on one source: a source that fails is
 * named in `errors`.
 */
export function dependencyGraph(db, { repo = null, now = Date.now(), light = false } = {}) {
  const errors = [];
  const safe = (name, fn, fallback) => { try { return fn(); } catch (error) { errors.push(`${name}: ${clip(error?.message ?? error, 160)}`); return fallback; } };
  const rows = db.prepare("SELECT workflow_id,title,phase,archived_at,created_at FROM workflows ORDER BY created_at,workflow_id").all();
  const byId = new Map(rows.map((row) => [row.workflow_id, row]));
  const liveRow = (row) => Boolean(row) && row.archived_at == null && ['running', 'queued'].includes(row.phase);
  const live = new Set(rows.filter(liveRow).map((row) => row.workflow_id));
  const bridges = safe('bridges', () => readBridges(db), []);
  const transfers = safe('transfers', () => readTransfers(db), []);
  const bridgeOfWorkflow = new Map(bridges.filter((b) => b.action === 'bridge' && b.workflowId).map((b) => [b.workflowId, b.id]));
  const nodes = rows.filter(liveRow).map((row) => ({ workflowId: row.workflow_id, title: row.title ?? null, phase: row.phase, createdAt: row.created_at, bridge: bridgeOfWorkflow.get(row.workflow_id) ?? null }));

  const edges = [];
  const seen = new Set();
  const edge = (e) => {
    if (!e.from || !e.to || e.from === e.to || !live.has(e.from)) return;
    const k = `${e.from}|${e.to}|${e.via}|${e.ref}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ from: e.from, to: e.to, via: e.via, ref: e.ref ?? null, strength: e.strength ?? HARD, since: e.since ?? null,
      ...(e.job ? { job: e.job } : {}), ...(e.item ? { item: e.item } : {}), ...(e.detail ? { detail: clip(e.detail) } : {}), toLive: live.has(e.to) });
  };
  const jobRow = (jobId) => db.prepare('SELECT job_id,workflow_id,op_id,status,payload_json,created_at,updated_at FROM jobs WHERE job_id=?').get(jobId);
  const ownerOf = safe('ownership', () => createOwnership(db, { repo }), null);

  // Job-level waits: typed until-job/until-record, gates naming a peer's job, peer requests, --after. A typed
  // incident's conditions are authoritative: the job ids its free text names (gate-names) are history, not waits
  // (a wait the Supervisor re-typed onto a bridge still quotes the old job).
  const typed = safe('typed', () => typedIncidents(db), []);
  const typedIds = new Set(typed.map((incident) => incident.incidentId));
  const blocking = safe('waiter-priority', () => blockingJobs(db, { now }), new Map());
  for (const entry of blocking.values()) {
    for (const w of entry.waiters) {
      if (w.workflowId === entry.workflowId || (w.via === 'gate-names' && typedIds.has(w.ref))) continue;
      edge({ from: w.workflowId, to: entry.workflowId, via: w.via, ref: w.ref, since: w.since, job: entry.jobId,
        strength: w.via === 'peer-request' ? SOFT : HARD, item: { kind: 'job', jobId: entry.jobId, opId: entry.opId, status: entry.status } });
    }
  }

  // Peer-waits (the peer itself, whatever the wait types) and the typed conditions the job view does not cover.
  const incidents = db.prepare("SELECT incident_id,workflow_id,op_id,last_progress,updated_at FROM incidents WHERE status='open' ORDER BY updated_at").all()
    .filter((row) => live.has(row.workflow_id));
  const raisedOf = (row) => {
    const ev = db.prepare("SELECT payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(row.workflow_id, row.incident_id);
    return { payload: parseJson(ev?.payload_json, {}) ?? {}, at: ev?.created_at ?? row.updated_at };
  };
  const deadWaits = [];
  for (const row of incidents.filter((r) => kindOf(r.last_progress) === 'peer-wait')) {
    const { payload, at } = raisedOf(row);
    if (typeof payload.peer !== 'string') continue;
    const e = { from: row.workflow_id, to: payload.peer, via: 'peer-wait', ref: row.incident_id, since: at, detail: payload.detail ?? row.last_progress,
      item: { kind: 'incident', incidentId: row.incident_id, holds: list(payload.holds) } };
    edge(e);
    if (!live.has(payload.peer)) deadWaits.push({ ...e, peerPhase: byId.get(payload.peer) ? (byId.get(payload.peer).archived_at != null ? 'archived' : byId.get(payload.peer).phase) : 'unknown' });
  }
  const foundations = safe('foundations', () => readFoundations(db), []);
  const foundationByName = new Map(foundations.map((f) => [f.name, f]));
  for (const incident of typed) {
    for (const cond of incident.until) {
      let to = null, item = null;
      if (cond.type === 'message') { to = cond.peer; item = { kind: 'message', peer: cond.peer }; }
      else if (cond.type === 'incident') { to = db.prepare('SELECT workflow_id FROM incidents WHERE incident_id=?').get(cond.incidentId)?.workflow_id ?? null; item = { kind: 'incident', incidentId: cond.incidentId }; }
      else if (cond.type === 'landed') { to = cond.workflowId; item = { kind: 'landed', repository: cond.repository }; }
      else if (cond.type === 'foundation') { const f = foundationByName.get(cond.name); to = f?.owner?.workflowId ?? null; item = { kind: 'foundation', name: cond.name }; }
      else if (cond.type === 'job') { const j = jobRow(cond.jobId); to = j?.workflow_id ?? null; item = { kind: 'job', jobId: cond.jobId, status: j?.status ?? null }; }
      else if (cond.type === 'record' && ownerOf) { to = ownerOf(normWork(cond.path))?.workflowId ?? null; item = { kind: 'record', path: normWork(cond.path) }; }
      if (to) edge({ from: incident.workflowId, to, via: `until-${cond.type}`, ref: incident.incidentId, since: incident.since, item });
    }
  }

  // Foundations: a dependent of a foundation that has not landed waits on its owner.
  const unowned = [];
  for (const f of foundations) {
    if (f.state === 'landed' || f.mergedInto) continue;
    const dependents = list(f.dependents).map((d) => d.workflowId).filter((wf) => live.has(wf));
    const owner = f.owner?.workflowId ?? null;
    for (const dep of dependents) if (owner) edge({ from: dep, to: owner, via: 'foundation', ref: f.name, strength: SOFT, since: f.updatedAt ?? null, item: { kind: 'foundation', name: f.name } });
    if (dependents.length && (!owner || !live.has(owner))) unowned.push({ foundation: f, dependents, owner });
  }

  // Foreign files: a file committed by one workflow that another owns.
  if (!light) for (const row of incidents.filter((r) => kindOf(r.last_progress) === 'foreign-file-committed')) {
    const { payload, at } = raisedOf(row);
    const text = `${row.last_progress} ${payload.detail ?? ''}`;
    const files = [...new Set((text.match(/[\w@.-]+(?:\/[\w@.[\]()-]+)+/g) ?? []).map(normWork))].slice(0, 40);
    for (const file of files) {
      let owner = null;
      if (file.startsWith('.starciwork/') && ownerOf) owner = ownerOf(file)?.workflowId ?? null;
      if (!owner) {
        const hit = db.prepare(`SELECT workflow_id,payload_json FROM jobs WHERE kind='op' AND workflow_id<>? AND status NOT IN ('cancelled') ORDER BY updated_at DESC LIMIT 400`).all(row.workflow_id)
          .find((j) => live.has(j.workflow_id) && ownedOf(parseJson(j.payload_json)).some((p) => within(pathForm(p), file.toLowerCase())));
        owner = hit?.workflow_id ?? null;
      }
      if (owner) edge({ from: row.workflow_id, to: owner, via: 'foreign-file', ref: row.incident_id, since: at, item: { kind: 'path', path: file } });
    }
  }

  // Refused record-change declarations: the record is a peer's (api.mjs record-change-refused).
  for (const ev of db.prepare('SELECT workflow_id,payload_json,created_at FROM events WHERE kind=? AND created_at>=? ORDER BY seq').all(RECORD_CHANGE_REFUSED, now - REFUSAL_WINDOW_MS)) {
    const p = parseJson(ev.payload_json, {}) ?? {};
    for (const owner of [...new Set(list(p.owners).map((o) => o?.workflowId).filter(Boolean))]) {
      edge({ from: ev.workflow_id, to: owner, via: 'record-owner', ref: p.record ?? null, strength: SOFT, since: ev.created_at, item: { kind: 'record', path: p.record ?? null } });
    }
  }

  // Work graphs: a node reads what a peer's node owns (soft), two workflows' nodes own one path (duplicate).
  const graphs = light ? [] : safe('work-graph', () => nodes.map((n) => ({ workflowId: n.workflowId, graph: latestVersion(db, n.workflowId)?.graph ?? null })).filter((g) => g.graph), []);
  const graphOwned = graphs.flatMap((g) => list(g.graph.nodes).map((node) => ({ workflowId: g.workflowId, node: node.id, owned: list(node.ownedPaths).map(pathForm).filter(Boolean), reads: list(node.reads).map(pathForm).filter(Boolean) })));
  for (const a of graphOwned) for (const b of graphOwned) {
    if (a.workflowId === b.workflowId) continue;
    const read = a.reads.find((r) => b.owned.some((o) => within(r, o)));
    if (read) edge({ from: a.workflowId, to: b.workflowId, via: 'work-graph-read', ref: `${a.node}->${b.node}`, strength: SOFT, item: { kind: 'path', path: read } });
  }

  // ---------------------------------------------------------------- findings
  const findings = [];
  const hard = edges.filter((e) => e.strength === HARD && e.toLive);
  const titleOf = (wf) => byId.get(wf)?.title ?? shortWorkflow(wf);

  for (const scc of cyclesOf([...live], hard)) {
    const cycleEdges = hard.filter((e) => scc.includes(e.from) && scc.includes(e.to));
    // The owner side: the workflow the most live workflows wait on overall, then the oldest.
    const waitedBy = (wf) => new Set(hard.filter((e) => e.to === wf).map((e) => e.from)).size;
    const owner = [...scc].sort((a, b) => waitedBy(b) - waitedBy(a) || (byId.get(a).created_at - byId.get(b).created_at))[0];
    const waiters = scc.filter((wf) => wf !== owner);
    const release = cycleEdges.filter((e) => e.from === owner);
    findings.push({
      key: `circular-wait|${scc.join('+')}`, kind: 'circular-wait', workflows: scc,
      summary: `circular wait ${scc.map(shortWorkflow).join(' <-> ')}: ${cycleEdges.map((e) => `${shortWorkflow(e.from)} waits on ${shortWorkflow(e.to)} (${e.via} ${e.ref})`).join('; ')}`,
      evidence: cycleEdges,
      proposal: { action: 'designate', owner, waiter: waiters[0], releases: release.map((e) => e.ref).filter(Boolean),
        clearCut: scc.length === 2 && release.every((e) => /^inc-/.test(String(e.ref))),
        why: `${shortWorkflow(owner)} is waited on by the most workflows${scc.length === 2 ? '' : ' (a cycle of more than two needs judgement)'}; its own waits into the cycle (${release.map((e) => e.ref).join(', ') || '-'}) are released and the others keep waiting on it` },
    });
  }

  for (const { foundation: f, dependents, owner } of unowned) {
    const aliasLive = (o) => Boolean(o.owner?.workflowId && live.has(o.owner.workflowId));
    const alias = foundations.filter((o) => o.name !== f.name && foundationAliasKey(o.name) === foundationAliasKey(f.name) && (aliasLive(o) || o.state === 'landed'))
      .sort((a, b) => Number(aliasLive(b)) - Number(aliasLive(a)))[0] ?? null;
    const proposal = alias
      ? { action: 'transfer', target: { foundation: f.name }, mergeInto: alias.name, to: alias.owner?.workflowId ?? null, clearCut: true,
        why: `${f.name} is ${alias.name} under another name (${alias.state}, owner ${shortWorkflow(alias.owner?.workflowId ?? '-')}${aliasLive(alias) ? '' : ', not running'}): merge it - its dependents become dependents of ${alias.name}${alias.state === 'landed' ? ', which already landed (each re-checks it in its own preflight)' : ''}` }
      : dependents.length >= 2
        ? { action: 'bridge', dependents, foundation: f.name, clearCut: false, why: `${dependents.length} live workflows need ${f.name} and no live workflow owns it: a bridging workflow owns it` }
        : { action: 'transfer', target: { foundation: f.name }, to: dependents[0], clearCut: false, why: `the one live workflow that needs ${f.name} owns it (judge whether it can build it)` };
    findings.push({
      key: `unowned-need|foundation:${f.name}`, kind: 'unowned-need', workflows: dependents,
      summary: `foundation ${f.name} (${f.state}) is needed by ${dependents.map(shortWorkflow).join(', ')} and ${owner ? `its owner ${shortWorkflow(owner)} is not running` : 'nobody owns it'}`,
      evidence: [{ foundation: f.name, state: f.state, owner, dependents }], proposal,
    });
  }
  for (const wait of deadWaits) {
    findings.push({
      key: `unowned-need|wait:${wait.ref}`, kind: 'unowned-need', workflows: [wait.from],
      summary: `${shortWorkflow(wait.from)} waits (${wait.ref}) on ${shortWorkflow(wait.to)}, which is ${wait.peerPhase}: nothing live will land it`,
      evidence: [wait],
      proposal: { action: 'bridge', dependents: [wait.from], blocker: wait.to, clearCut: false, why: 'the awaited workflow stopped; the Kernel re-checks the prerequisite first (frontier.peerWaitsDead) - a bridge only when the need is real and shared' },
    });
  }
  for (const row of incidents.filter((r) => kindOf(r.last_progress) === 'shared-blocker')) {
    const routed = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='shared-blocker-routed' ORDER BY seq DESC LIMIT 1").get(row.workflow_id, row.incident_id);
    const p = parseJson(routed?.payload_json, null);
    if (!p || p.routed) continue;
    findings.push({
      key: `unowned-need|shared-blocker:${row.incident_id}`, kind: 'unowned-need', workflows: [row.workflow_id],
      summary: `shared blocker ${row.incident_id} of ${shortWorkflow(row.workflow_id)} could not be routed (${clip(p.why, 120)}): no workflow owns its repair`,
      evidence: [{ incidentId: row.incident_id, why: p.why ?? null, detail: clip(row.last_progress, 300) }],
      proposal: { action: 'bridge', dependents: [row.workflow_id], clearCut: false, why: 'the Supervisor assigns the repair an owner: the introducer when known (transfer), else a bridging workflow' },
    });
  }

  const blockers = new Map();
  for (const e of hard) {
    if (!blockers.has(e.to)) blockers.set(e.to, []);
    blockers.get(e.to).push(e);
  }
  for (const [blocker, into] of blockers) {
    const waiters = [...new Set(into.map((e) => e.from))];
    // A bridging workflow exists to be waited on: its dependents' waits are the resolution, not a finding.
    if (waiters.length < 2 || bridgeOfWorkflow.has(blocker)) continue;
    // The one item most of them wait on: a job, else an incident or record they share.
    const itemKey = (e) => e.job ? `job:${e.job}` : e.item?.jobId ? `job:${e.item.jobId}` : e.item?.name ? `foundation:${e.item.name}` : e.item?.path ? `path:${e.item.path}` : null;
    const byItem = new Map();
    for (const e of into) { const k = itemKey(e); if (!k) continue; if (!byItem.has(k)) byItem.set(k, []); byItem.get(k).push(e); }
    const [sharedKey, sharedEdges] = [...byItem.entries()].map(([k, es]) => [k, es, new Set(es.map((e) => e.from)).size]).sort((a, b) => b[2] - a[2])[0] ?? [null, []];
    const sharedWaiters = [...new Set(sharedEdges.map((e) => e.from))];
    const job = sharedKey?.startsWith('job:') ? jobRow(sharedKey.slice(4)) : null;
    const since = Math.min(...sharedEdges.map((e) => e.since ?? now));
    const stuck = Boolean(job) && job.status === 'queued' && now - since >= HUB_STUCK_MS;
    const clearCut = sharedWaiters.length >= 2 && stuck;
    // Waiting on a foundation its owner builds is foundation planning working: the owner is told, nothing is bridged.
    const foundationItem = sharedKey?.startsWith('foundation:') && foundationByName.get(sharedKey.slice(11))?.owner?.workflowId === blocker;
    const title = job ? (parseJson(job.payload_json, {})?.title ?? null) : null;
    findings.push({
      key: `hub-blocker|${blocker}${sharedKey ? `|${sharedKey}` : ''}`, kind: 'hub-blocker', workflows: [blocker, ...waiters],
      summary: `${shortWorkflow(blocker)} blocks ${waiters.length} workflows (${waiters.map(shortWorkflow).join(', ')})${sharedKey ? `; ${sharedWaiters.length} of them on ${sharedKey}${job ? ` (${job.op_id ?? '-'} ${job.status}${job.status === 'queued' ? ` ${Math.round((now - since) / 60_000)}m` : ''})` : ''}` : ''}`,
      evidence: into, blocker, waiters, sharedItem: sharedKey, sharedWaiters,
      proposal: foundationItem ? { action: 'notify', blocker, item: sharedKey, clearCut: false,
        why: `${sharedKey} is a foundation ${shortWorkflow(blocker)} owns and builds: the dependents wait on its landing by design; notify it when it does not move` } : {
        action: 'bridge', blocker, dependents: sharedWaiters.length >= 2 ? sharedWaiters : waiters, item: sharedKey,
        foundation: `bridge-${shortWorkflow(blocker).replace(/[^a-z0-9-]/g, '').slice(0, 30)}-${(job?.op_id ?? sharedKey ?? 'shared').replace(/[^a-z0-9.-]/gi, '-').toLowerCase().slice(0, 30)}`,
        goalDraft: `Bridging workflow (Supervisor, provisional): own and land the shared prerequisite ${sharedKey ?? '-'} that ${sharedWaiters.map((wf) => titleOf(wf)).join(' and ')} wait on and ${titleOf(blocker)} has not moved${job ? ` (${job.op_id} ${job.job_id}${title ? `: ${clip(title, 160)}` : ''})` : ''}. Waits: ${[...new Set(sharedEdges.map((e) => e.ref))].map((ref) => `${ref}: ${clip(into.find((e) => e.ref === ref && e.detail)?.detail ?? '-', 240)}`).join(' | ')}. Build only that shared part, commit it, verify it, then land the bridge foundation with its proof.`,
        clearCut,
        why: clearCut
          ? `${sharedWaiters.length} workflows wait on the one ${sharedKey} of ${shortWorkflow(blocker)}, queued ${Math.round((now - since) / 60_000)}m (>= ${HUB_STUCK_MS / 60_000}m): a bridging workflow owns it and both dependents wait on the bridge`
          : job && job.status !== 'queued' ? `${sharedKey} is ${job.status}: it moves; notify ${shortWorkflow(blocker)} rather than bridge`
            : 'the waits do not share one stuck item: notify the blocker first; bridge only when the shared part is concrete',
      },
    });
  }

  // Duplicate work: open jobs of two live workflows owning one path; two work-graph nodes owning one path; one foundation under two names.
  const openJobs = db.prepare(`SELECT job_id,workflow_id,op_id,status,payload_json FROM jobs WHERE kind<>'kernel' AND status IN (${OPEN_JOB.map(() => '?').join(',')})`).all(...OPEN_JOB)
    .filter((j) => live.has(j.workflow_id)).map((j) => ({ ...j, owned: ownedOf(parseJson(j.payload_json)).map((p) => p.toLowerCase()) }));
  const dupPairs = new Map();
  const addDup = (a, b, detail) => {
    const pair = [a.workflowId, b.workflowId].sort();
    const k = pair.join('+');
    if (!dupPairs.has(k)) dupPairs.set(k, { workflows: pair, items: [] });
    if (dupPairs.get(k).items.length < 12) dupPairs.get(k).items.push(detail);
  };
  for (let i = 0; i < openJobs.length; i++) for (let j = i + 1; j < openJobs.length; j++) {
    const a = openJobs[i], b = openJobs[j];
    if (a.workflow_id === b.workflow_id) continue;
    const hit = a.owned.find((p) => !SHARED_WIRING.test(p) && b.owned.some((q) => within(p, q)));
    if (hit) addDup({ workflowId: a.workflow_id }, { workflowId: b.workflow_id }, { via: 'open-jobs', path: hit, jobs: [a.job_id, b.job_id] });
  }
  for (let i = 0; i < graphOwned.length; i++) for (let j = i + 1; j < graphOwned.length; j++) {
    const a = graphOwned[i], b = graphOwned[j];
    if (a.workflowId === b.workflowId) continue;
    const hit = a.owned.find((p) => !SHARED_WIRING.test(p) && b.owned.some((q) => within(p, q)));
    if (hit) addDup(a, b, { via: 'work-graph', path: hit, nodes: [a.node, b.node] });
  }
  for (const { workflows, items } of dupPairs.values()) {
    const [older, younger] = [...workflows].sort((a, b) => byId.get(a).created_at - byId.get(b).created_at);
    findings.push({
      key: `duplicate-work|${workflows.join('+')}`, kind: 'duplicate-work', workflows,
      summary: `${shortWorkflow(workflows[0])} and ${shortWorkflow(workflows[1])} build the same thing: ${items.slice(0, 3).map((it) => `${it.path} (${it.via}${it.jobs ? ` ${it.jobs.join(' / ')}` : it.nodes ? ` ${it.nodes.join(' / ')}` : ''})`).join('; ')}`,
      evidence: items,
      proposal: { action: 'revise', workflow: younger, keeps: older, paths: [...new Set(items.map((it) => it.path))], clearCut: false,
        why: `the older ${shortWorkflow(older)} keeps the shared part; ${shortWorkflow(younger)} is revised to park (or merge) its duplicating legs - which legs is a judgement on the goal texts` },
    });
  }
  const aliasGroups = new Map();
  for (const f of foundations.filter((item) => !item.mergedInto)) {
    const k = foundationAliasKey(f.name);
    if (!aliasGroups.has(k)) aliasGroups.set(k, []);
    aliasGroups.get(k).push(f);
  }
  for (const [k, group] of aliasGroups) {
    const owned = group.filter((f) => f.owner?.workflowId && live.has(f.owner.workflowId) && f.state !== 'landed');
    const owners = [...new Set(owned.map((f) => f.owner.workflowId))];
    if (owners.length < 2) continue;
    findings.push({
      key: `duplicate-work|foundation:${k}`, kind: 'duplicate-work', workflows: owners,
      summary: `foundation ${k} is claimed under ${group.map((f) => f.name).join(', ')} by ${owners.map(shortWorkflow).join(', ')}: two owners build one foundation`,
      evidence: group.map((f) => ({ foundation: f.name, state: f.state, owner: f.owner?.workflowId ?? null })),
      proposal: { action: 'transfer', target: { foundation: owned.slice(1).map((f) => f.name)[0] }, to: owned[0].owner.workflowId, clearCut: false,
        why: 'one foundation, one owner: the older claim keeps it, the other claim transfers to it and its legs are revised' },
    });
  }

  return {
    ok: true, at: now, nodes, edges, findings,
    bridges: bridges.map(bridgeBrief), transfers: transfers.map((t) => ({ path: t.path, to: t.to, from: t.from ?? null, reason: clip(t.reason, 200), provisional: t.provisional === true, at: t.at })),
    counts: { workflows: nodes.length, edges: edges.length, hard: hard.length, findings: findings.length, clearCut: findings.filter((f) => f.proposal?.clearCut).length },
    ...(errors.length ? { errors } : {}),
  };
}

/** The part of the graph that touches one workflow (api peers / api status). */
export function dependenciesOf(graph, workflowId) {
  const edges = graph.edges.filter((e) => e.from === workflowId || e.to === workflowId);
  return {
    waitsOn: [...new Set(edges.filter((e) => e.from === workflowId && e.strength === HARD).map((e) => e.to))],
    waitedBy: [...new Set(edges.filter((e) => e.to === workflowId && e.strength === HARD).map((e) => e.from))],
    edges: edges.map(({ from, to, via, ref, strength, job }) => ({ from, to, via, ref, strength, ...(job ? { job } : {}) })),
    findings: graph.findings.filter((f) => f.workflows.includes(workflowId)).map(({ key, kind, summary, proposal }) => ({ key, kind, summary, action: proposal?.action ?? null, clearCut: Boolean(proposal?.clearCut) })),
    bridges: graph.bridges.filter((b) => [b.workflowId, b.blocker, b.owner, b.waiter, b.to, b.from, ...list(b.dependents)].includes(workflowId)),
  };
}

/** One line per finding (supervisor digests). */
export const findingLine = (f) => `${f.kind.toUpperCase()} ${f.summary} -> ${f.proposal?.action ?? '-'}${f.proposal?.clearCut ? ' (clear-cut)' : ''}: ${f.proposal?.why ?? ''}`;
