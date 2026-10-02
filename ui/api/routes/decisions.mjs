import { sendJson, sendError } from '../envelope.mjs';
import { source, many, one, parse, staleOf, page } from '../query.mjs';
import { uiState } from '../state.mjs';

function ref(kind, id, project = null) {
  const p = encodeURIComponent(project ?? '');
  const key = encodeURIComponent(String(id));
  const href = kind === 'di' ? `#/decisions?id=${key}` : kind === 'attempt' ? `#/a/${p}/${key}`
    : kind === 'unit' ? `#/w/${p}?tab=units&unit=${key}` : kind === 'workflow' ? `#/w/${p}/${key}` : '#/system';
  return { kind, ...(project ? { project } : {}), id: String(id), href };
}
function evidence(value, project) {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return items.map(item => {
    if (typeof item === 'string') return { text: item };
    const kind = item?.kind ?? item?.type ?? item?.entity_type;
    const id = item?.id ?? item?.ref ?? item?.entity_id;
    return kind && id && ['workflow', 'unit', 'attempt', 'di', 'incident'].includes(kind) ? ref(kind, id, project)
      : { text: JSON.stringify(item) };
  });
}
function channel(machine, item) {
  const ask = one(machine, 'SELECT channel FROM ask_requests WHERE di_id=? ORDER BY asked_at DESC LIMIT 1', item.di_id);
  if (ask?.channel === 'telegram' || ask?.channel === 'serve-ask') return ask.channel;
  const delivery = one(machine, "SELECT channel FROM deliveries WHERE message_kind='decision' AND message_ref=? ORDER BY delivery_id DESC LIMIT 1", item.di_id);
  if (delivery?.channel === 'telegram' || delivery?.channel === 'serve-ask') return delivery.channel;
  return item.decider === 'kernel' ? 'kernel-seat' : item.decider === 'supervisor' ? 'supervisor-seat' : 'telegram';
}
function decisionRow(machine, item, project = null) {
  const now = Date.now();
  const expiry = item.claim_at != null && item.claim_ttl_ms != null ? item.claim_at + item.claim_ttl_ms : null;
  const overdue = Boolean(item.overdue ?? (item.due_at != null && item.due_at < now && ['open', 'claimed', 'escalated'].includes(item.status)));
  const ui = item.ui ?? (overdue || item.escalations >= 2 ? 'bad' : uiState(machine, 'decision', item.status));
  return { id: item.di_id, project, wf: item.workflow_id ?? null, kind: item.kind, decider: item.decider,
    status: item.status, ui, summary: item.summary,
    entity: item.entity_type && item.entity_id ? ref(item.entity_type === 'job' ? 'workflow' : item.entity_type, item.entity_id, project) : null,
    openedBy: item.opened_by ?? null, openedAt: item.opened_at, dueAt: item.due_at, overdue,
    escalations: item.escalations ?? 0,
    claim: item.claim_by ? { by: item.claim_by, at: item.claim_at, expiresAt: expiry } : null,
    resolvedAt: item.resolved_at ?? null, channel: channel(machine, item) };
}
function allLedgers(store, project, fn) {
  return store.forEachLedger(({ row, db }) => project && row.name !== project ? [] : fn(row, db))
    .flatMap(entry => entry.error ? [] : entry.result ?? []);
}
function listedDecisions(store, url) {
  const machine = store.machine.db;
  const project = url.searchParams.get('project');
  const status = url.searchParams.get('status');
  const wf = url.searchParams.get('wf');
  const rows = allLedgers(store, project, (ledger, db) => many(db, 'SELECT * FROM v_decision_rows ORDER BY opened_at DESC').map(item => decisionRow(machine, item, ledger.name)));
  const projects = new Map(store.projects().map(item => [item.ledgerId, item.name]));
  rows.push(...many(machine, 'SELECT d.*,v.ui,v.overdue FROM sup_decision_items d LEFT JOIN (SELECT di_id,ui,(due_at IS NOT NULL AND due_at<?) AS overdue FROM v_open_sup_decisions) v ON v.di_id=d.di_id ORDER BY d.opened_at DESC', Date.now())
    .map(item => decisionRow(machine, item, projects.get(item.ledger_id) ?? null)));
  const decider = url.searchParams.get('decider'), kind = url.searchParams.get('kind');
  const filtered = rows.filter(item => (!project || item.project === project) && (!wf || item.wf === wf)
    && (!decider || item.decider === decider) && (!kind || item.kind === kind)
    && (status === 'all' || (status ? item.status === status : ['open', 'claimed', 'escalated'].includes(item.status)))
    && (url.searchParams.get('overdue') !== '1' || item.overdue));
  return filtered.sort((a, b) => Number(b.ui === 'bad') - Number(a.ui === 'bad') || a.openedAt - b.openedAt);
}
function detail(store, id) {
  const machine = store.machine.db;
  let item = one(machine, 'SELECT * FROM sup_decision_items WHERE di_id=?', id);
  let project = null, db = machine, supervisor = Boolean(item);
  if (!item) {
    for (const result of store.forEachLedger(({ row, db: ledgerDb }) => ({ row, item: one(ledgerDb, 'SELECT * FROM decision_items WHERE di_id=?', id) }))) {
      if (result.error || !result.result?.item) continue;
      item = result.result.item; project = result.result.row.name; db = store.ledger(project)?.db ?? null; break;
    }
  }
  if (!item || !db) return null;
  const row = decisionRow(machine, supervisor ? { ...item, ...one(machine, 'SELECT ui FROM v_open_sup_decisions WHERE di_id=?', id) } : { ...item, ...one(db, 'SELECT ui,overdue FROM v_decision_rows WHERE di_id=?', id) }, project);
  const events = supervisor
    ? many(machine, "SELECT kind,created_at AS at,payload_json FROM sup_events WHERE entity_id=? AND kind LIKE 'decision-%' ORDER BY seq", id)
    : many(db, "SELECT kind,created_at AS at,payload_json FROM events WHERE entity_id=? AND kind LIKE 'decision-%' ORDER BY seq", id);
  const deliveries = many(machine, "SELECT message_kind AS kind,attempted_at AS at,COALESCE(seat_id,channel) AS by FROM deliveries WHERE message_kind='decision' AND message_ref=? ORDER BY delivery_id", id);
  const history = [...events.map(event => {
    const payload = parse(event.payload_json, {});
    return { kind: event.kind, at: event.at, by: payload.decider ?? payload.from ?? item.opened_by,
      from: payload.from ?? null, to: payload.to ?? null };
  }), ...deliveries]
    .sort((a, b) => a.at - b.at);
  const resolution = supervisor ? one(machine, 'SELECT * FROM sup_decisions WHERE di_id=? ORDER BY decided_at DESC LIMIT 1', id)
    : one(db, 'SELECT * FROM decisions WHERE di_id=? ORDER BY decided_at DESC LIMIT 1', id);
  const options = parse(item.options_json, []);
  return { ...row, evidence: evidence(parse(item.evidence_json), project),
    options: Array.isArray(options) ? options.map(option => ({ key: option.key, verb: option.verb, recommended: Boolean(option.recommended) })) : [],
    allowedVerbs: parse(item.allowed_verbs_json, []), history,
    resolution: resolution ? { by: resolution.decider, verb: item.resolution_verb ?? resolution.choice,
      decision: ref('di', resolution.decision_id, project), result: parse(resolution.result_json) } : null,
    payload: parse(item.payload_json) };
}
function listedAsks(store, url) {
  const machine = store.machine.db;
  const project = url.searchParams.get('project'), state = url.searchParams.get('state');
  const projects = new Map(store.projects().map(item => [item.ledgerId, item.name]));
  const rows = many(machine, 'SELECT * FROM ask_requests ORDER BY asked_at DESC');
  return rows.filter(ask => (!state || ask.state === state) && (!project || projects.get(ask.ledger_id) === project))
    .map(ask => {
      const name = projects.get(ask.ledger_id) ?? null;
      const ledger = name ? store.ledger(name) : null;
      const di = ask.di_id ? one(machine, 'SELECT kind FROM sup_decision_items WHERE di_id=?', ask.di_id)
        ?? (ledger ? one(ledger.db, 'SELECT kind FROM decision_items WHERE di_id=?', ask.di_id) : null) : null;
      // ask_requests has no incident_id. Suppress text when the workflow has a credential incident.
      const credentialIncident = ledger && ask.workflow_id ? one(ledger.db,
        "SELECT incident_id FROM incidents WHERE workflow_id=? AND kind='credential-missing' LIMIT 1", ask.workflow_id) : null;
      const credential = di?.kind === 'credential-missing' || Boolean(credentialIncident);
      return { id: ask.ask_id, project: name, wf: ask.workflow_id, di: ask.di_id ? ref('di', ask.di_id, name) : null,
        channel: ask.channel, question: credential ? null : ask.question, credential,
        askedAt: ask.asked_at, answeredAt: ask.answered_at, state: ask.state };
    });
}
function listedIncidents(store, url) {
  const project = url.searchParams.get('project'), wf = url.searchParams.get('wf');
  const status = url.searchParams.get('status') ?? 'open';
  return allLedgers(store, project, (ledger, db) => many(db, 'SELECT * FROM incidents ORDER BY updated_at DESC').map(item => ({
    id: item.incident_id, project: ledger.name, wf: item.workflow_id, op: item.op_id, kind: item.kind,
    owner: item.owner, status: item.status, resolvedReason: item.resolved_reason,
    ui: uiState(db, 'incident', item.status), dueAt: item.due_at, attempts: item.attempts,
    modelCalls: item.model_calls, tokens: item.tokens, elapsedMs: item.elapsed_ms,
    lastProgress: item.last_progress, updatedAt: item.updated_at })))
    .filter(item => (!wf || item.wf === wf) && (status === 'all' || item.status === status))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** C12 read-only Decision Items, asks, and incidents. */
export function handleDecisions(request, response, store, url) {
  const pathname = url.pathname;
  if (pathname === '/api/decisions/log') return false;
  if (!['/api/decisions', '/api/asks', '/api/incidents'].includes(pathname) && !/^\/api\/decisions\/[^/]+$/.test(pathname)) return false;
  if (!store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
  if (pathname === '/api/decisions') {
    const result = page(listedDecisions(store, url), url);
    sendJson(request, response, result.rows, { sources: [...source('machine', 'sup_decision_items', 'v_open_sup_decisions', 'ask_requests', 'deliveries'),
      ...store.projects().flatMap(ledger => source(ledger.name, 'v_decision_rows'))], stale: staleOf(store), next: result.next }); return true;
  }
  if (pathname === '/api/asks') {
    sendJson(request, response, listedAsks(store, url), { sources: [...source('machine', 'ask_requests', 'sup_decision_items'),
      ...store.projects().flatMap(ledger => source(ledger.name, 'decision_items', 'incidents'))], stale: staleOf(store) }); return true;
  }
  if (pathname === '/api/incidents') {
    const result = page(listedIncidents(store, url), url);
    sendJson(request, response, result.rows, { sources: store.projects().flatMap(ledger => source(ledger.name, 'incidents')), stale: staleOf(store), next: result.next }); return true;
  }
  let id;
  try { id = decodeURIComponent(pathname.slice('/api/decisions/'.length)); } catch { sendError(request, response, 400, 'BAD_PATH', 'Invalid decision id'); return true; }
  const item = detail(store, id);
  if (!item) { sendError(request, response, 404, 'NOT_FOUND', 'Decision Item not found'); return true; }
  sendJson(request, response, item, { sources: [...source('machine', 'sup_decision_items', 'v_open_sup_decisions', 'sup_events', 'deliveries', 'sup_decisions', 'ask_requests'),
    ...store.projects().flatMap(ledger => source(ledger.name, 'decision_items', 'v_decision_rows', 'events', 'decisions'))], stale: staleOf(store) }); return true;
}
