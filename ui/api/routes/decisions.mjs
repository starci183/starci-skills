import { sendJson, sendError } from '../envelope.mjs';
import { source, many, one, parse, staleOf, page } from '../query.mjs';
import { uiState } from '../state.mjs';

const DEFAULT_NAMESPACE = Object.freeze({ store: 'machine', ledgerId: null });

function hrefForRef(kind, p, key, project, wf, params) {
  let href = null;
  if (kind === 'di') href = `#/decisions?${params}`;
  else if (kind === 'attempt' && project) href = `#/a/${p}/${key}`;
  else if (kind === 'unit' && project && wf) href = `#/w/${p}/${encodeURIComponent(wf)}?tab=units&unit=${key}`;
  else if (kind === 'workflow' && project) href = `#/w/${p}/${key}`;
  else if (kind === 'incident' && project) {
    const workflowParam = wf ? '&wf=' + encodeURIComponent(wf) : '';
    href = `#/decisions?tab=incidents&incident=${key}&project=${p}${workflowParam}`;
  }
  return href;
}
function ref(kind, id, project = null, namespace = null, wf = null) {
  const p = encodeURIComponent(project ?? '');
  const key = encodeURIComponent(String(id));
  const params = new URLSearchParams({ id: String(id) });
  if (namespace) { params.set('store', namespace.store); if (namespace.ledgerId) params.set('ledger', namespace.ledgerId); }
  if (project) params.set('project', project);
  const href = hrefForRef(kind, p, key, project, wf, params);
  if (!href) return null;
  return { kind, ...(project ? { project } : {}), ...namespace, id: String(id), href };
}
function evidence(value, project, namespace, wf) {
  const items = (Array.isArray(value) && value) || (value == null && []) || [value];
  return items.map(item => {
    if (typeof item === 'string') return { text: item };
    const kind = item?.kind ?? item?.type ?? item?.entity_type;
    const id = item?.id ?? item?.ref ?? item?.entity_id;
    const explicitNamespace = ['machine', 'ledger'].includes(item?.store) ? { store: item.store, ledgerId: item.ledgerId ?? item.ledger ?? null } : null;
    // Evidence links carry their recorded scope. A DI reference without a namespace
    // is resolved by the detail endpoint; the containing DI's store is not proof.
    if (!kind || id == null || !['workflow', 'unit', 'attempt', 'di', 'incident'].includes(kind)) return { text: JSON.stringify(item) };
    const targetNamespace = kind === 'di' ? explicitNamespace : namespace;
    return ref(kind, id, item.project ?? project, targetNamespace, item.workflowId ?? item.wf ?? wf) ?? { text: JSON.stringify(item) };
  });
}
function channel(machine, item, ledgerId) {
  const ask = one(machine, 'SELECT channel FROM ask_requests WHERE di_id=? AND ledger_id IS ? ORDER BY asked_at DESC,ask_id DESC LIMIT 1', item.di_id, ledgerId);
  if (ask?.channel === 'telegram' || ask?.channel === 'serve-ask') return ask.channel;
  const delivery = one(machine, "SELECT channel FROM deliveries WHERE message_kind='decision' AND message_ref=? AND ledger_id IS ? ORDER BY delivery_id DESC LIMIT 1", item.di_id, ledgerId);
  if (delivery?.channel === 'telegram' || delivery?.channel === 'serve-ask') return delivery.channel;
  return (item.decider === 'kernel' && 'kernel-seat') || (item.decider === 'supervisor' && 'supervisor-seat') || null;
}
/** Public Decision Item identity and text; preserve the native namespace and suppress credential summaries across read surfaces. */
export function decisionPresentation(item, project = null, namespace = DEFAULT_NAMESPACE) {
  return { id: item.di_id, key: JSON.stringify([namespace.store, namespace.ledgerId, item.di_id]), project, ...namespace,
    href: ref('di', item.di_id, project, namespace).href, wf: item.workflow_id ?? null, kind: item.kind, decider: item.decider,
    status: item.status, summary: item.kind === 'credential-missing' ? 'Credential content hidden.' : item.summary };
}
function decisionRow(machine, item, project = null, namespace = DEFAULT_NAMESPACE) {
  const now = Date.now();
  const expiry = item.claim_at != null && item.claim_ttl_ms != null ? item.claim_at + item.claim_ttl_ms : null;
  const overdue = Boolean(item.overdue ?? (item.due_at != null && item.due_at < now && ['open', 'claimed', 'escalated'].includes(item.status)));
  const ui = item.ui ?? (overdue || item.escalations >= 2 ? 'bad' : uiState(machine, 'decision', item.status));
  return { ...decisionPresentation(item, project, namespace), ui,
    entity: item.entity_type && item.entity_id ? ref(item.entity_type, item.entity_id, project, namespace, item.workflow_id) : null,
    openedBy: item.opened_by ?? null, openedAt: item.opened_at, dueAt: item.due_at, overdue,
    escalations: item.escalations ?? 0,
    claim: item.claim_by ? { by: item.claim_by, at: item.claim_at, expiresAt: expiry } : null,
    resolvedAt: item.resolved_at ?? null, channel: channel(machine, item, namespace.ledgerId) };
}
function scopedLedgers(store, project) { return store.projects().filter(row => !project || row.name === project || row.ledgerId === project); }
function allLedgers(store, project, fn, rel = 'meta') {
  return scopedLedgers(store, project).flatMap(row => {
    const opened = store.ledger(row.ledgerId);
    if (!opened) return [];
    try { return fn(row, opened.db) ?? []; } catch { store.failSource?.(row.name, rel); return []; }
  });
}
function filterDecisions(rows, url, project, wf, status, decider, kind) {
  return rows.filter(item => (!project || item.project === project || item.ledgerId === project) && (!wf || item.wf === wf)
    && (!decider || item.decider === decider) && (!kind || item.kind === kind)
    && (status === 'all' || (status ? item.status === status : ['open', 'claimed', 'escalated'].includes(item.status)))
    && (url.searchParams.get('overdue') !== '1' || item.overdue));
}
function suppressAmbiguousChannels(filtered, rows) {
  for (const item of filtered) if (rows.some(other => other.id === item.id && other.ledgerId === item.ledgerId && other.store !== item.store)) item.channel = null;
}
function listedDecisions(store, url) {
  const machine = store.machine.db;
  const project = url.searchParams.get('project');
  const status = url.searchParams.get('status');
  const wf = url.searchParams.get('wf');
  const rows = allLedgers(store, project, (ledger, db) => many(db, 'SELECT * FROM v_decision_rows ORDER BY opened_at DESC,di_id').map(item => decisionRow(machine, item, ledger.name, { store: 'ledger', ledgerId: ledger.ledgerId })), 'v_decision_rows');
  const projects = new Map(store.projects().map(item => [item.ledgerId, item.name]));
  rows.push(...many(machine, 'SELECT d.*,v.ui,v.overdue FROM sup_decision_items d LEFT JOIN (SELECT di_id,ui,(due_at IS NOT NULL AND due_at<?) AS overdue FROM v_open_sup_decisions) v ON v.di_id=d.di_id ORDER BY d.opened_at DESC', Date.now())
    .map(item => decisionRow(machine, item, projects.get(item.ledger_id) ?? null, { store: 'machine', ledgerId: item.ledger_id ?? null })));
  const decider = url.searchParams.get('decider'), kind = url.searchParams.get('kind');
  const filtered = filterDecisions(rows, url, project, wf, status, decider, kind);
  suppressAmbiguousChannels(filtered, rows);
  return filtered.sort((a, b) => Number(b.ui === 'bad') - Number(a.ui === 'bad') || a.openedAt - b.openedAt || `${a.store}:${a.ledgerId}:${a.id}`.localeCompare(`${b.store}:${b.ledgerId}:${b.id}`));
}
function decisionCandidates(store, machine, id, requestedStore, requestedLedger) {
  const candidates = [];
  if (!requestedStore || requestedStore === 'machine') {
    const item = one(machine, 'SELECT * FROM sup_decision_items WHERE di_id=?', id);
    const registry = item && store.projects().find(row => row.ledgerId === item.ledger_id);
    if (item && (!requestedLedger || requestedLedger === item.ledger_id || requestedLedger === registry?.name)) candidates.push({ item, project: registry?.name ?? null, ledgerId: item.ledger_id ?? null, supervisor: true });
  }
  if (!requestedStore || requestedStore === 'ledger') candidates.push(...allLedgers(store, requestedLedger, (row, ledgerDb) => {
    const item = one(ledgerDb, 'SELECT * FROM decision_items WHERE di_id=?', id);
    return item ? [{ item, project: row.name, ledgerId: row.ledgerId, supervisor: false }] : [];
  }, 'decision_items'));
  return candidates;
}
function deliveryAmbiguous(store, machine, { supervisor, ledgerId, id }) {
  if (!supervisor) return Boolean(one(machine, 'SELECT di_id FROM sup_decision_items WHERE di_id=? AND ledger_id IS ?', id, ledgerId));
  const counterpart = ledgerId ? store.ledger(ledgerId) : null;
  return Boolean(ledgerId && (!counterpart || one(counterpart.db, 'SELECT di_id FROM decision_items WHERE di_id=?', id)));
}
function decisionEvents(machine, db, supervisor, id) {
  if (supervisor) return many(machine, "SELECT kind,created_at AS at,payload_json FROM sup_events WHERE entity_id=? AND kind LIKE 'decision-%' ORDER BY seq", id);
  return many(db, "SELECT kind,created_at AS at,payload_json FROM events WHERE entity_id=? AND kind LIKE 'decision-%' ORDER BY seq", id);
}
function latestResolution(machine, db, supervisor, id) {
  if (supervisor) return one(machine, 'SELECT * FROM sup_decisions WHERE di_id=? ORDER BY decided_at DESC LIMIT 1', id);
  return one(db, 'SELECT * FROM decisions WHERE di_id=? ORDER BY decided_at DESC LIMIT 1', id);
}
const optionsOf = options => Array.isArray(options) ? options.map(option => ({ key: option.key, verb: option.verb, recommended: Boolean(option.recommended) })) : [];
function historyOf(events, deliveries, item) {
  return [...events.map(event => {
    const payload = parse(event.payload_json, {});
    return { kind: event.kind, at: event.at, by: payload.decider ?? payload.from ?? item.opened_by,
      from: payload.from ?? null, to: payload.to ?? null };
  }), ...deliveries]
    .sort((a, b) => a.at - b.at);
}
function detail(store, id, url) {
  const machine = store.machine.db;
  const requestedStore = url.searchParams.get('store'), requestedLedger = url.searchParams.get('ledger') ?? url.searchParams.get('project');
  const candidates = decisionCandidates(store, machine, id, requestedStore, requestedLedger);
  if (store.stale.size && requestedStore !== 'machine') return { unavailable: true };
  if (candidates.length > 1) return { ambiguous: true };
  if (!candidates.length) return null;
  const { item, project, ledgerId, supervisor } = candidates[0];
  const db = supervisor ? machine : store.ledger(ledgerId)?.db;
  if (!item || !db) return null;
  const namespace = { store: supervisor ? 'machine' : 'ledger', ledgerId };
  const row = decisionRow(machine, supervisor ? { ...item, ...one(machine, 'SELECT ui FROM v_open_sup_decisions WHERE di_id=?', id) } : { ...item, ...one(db, 'SELECT ui,overdue FROM v_decision_rows WHERE di_id=?', id) }, project, namespace);
  const events = decisionEvents(machine, db, supervisor, id);
  const ambiguous = deliveryAmbiguous(store, machine, { supervisor, ledgerId, id });
  if (ambiguous) row.channel = null;
  const deliveries = ambiguous ? [] : many(machine, "SELECT message_kind AS kind,attempted_at AS at,COALESCE(seat_id,channel) AS by FROM deliveries WHERE message_kind='decision' AND message_ref=? AND ledger_id IS ? ORDER BY delivery_id", id, ledgerId);
  const history = historyOf(events, deliveries, item);
  const resolution = latestResolution(machine, db, supervisor, id);
  const options = parse(item.options_json, []);
  const credential = item.kind === 'credential-missing';
  const resolutionResult = resolution && (credential ? null : parse(resolution.result_json));
  return { ...row, evidence: evidence(parse(item.evidence_json), project, namespace, item.workflow_id).map(entry => credential && 'text' in entry ? { text: 'Credential content hidden.' } : entry),
    options: optionsOf(options),
    allowedVerbs: parse(item.allowed_verbs_json, []), history,
    resolution: resolution ? { by: resolution.decider, verb: item.resolution_verb ?? resolution.choice,
      decision: ref('di', id, project, namespace), result: resolutionResult } : null,
    payload: credential ? null : parse(item.payload_json) };
}
function listedAsks(store, url) {
  const machine = store.machine.db;
  const project = url.searchParams.get('project'), state = url.searchParams.get('state'), wf = url.searchParams.get('wf');
  const projects = new Map(store.projects().map(item => [item.ledgerId, item.name]));
  const rows = many(machine, 'SELECT * FROM ask_requests ORDER BY asked_at DESC');
  return rows.filter(ask => (!state || ask.state === state) && (!project || projects.get(ask.ledger_id) === project || ask.ledger_id === project) && (!wf || ask.workflow_id === wf))
    .map(ask => {
      const name = projects.get(ask.ledger_id) ?? null;
      const ledger = name ? store.ledger(name) : null;
      const supervisorDI = ask.di_id ? one(machine, 'SELECT kind FROM sup_decision_items WHERE di_id=? AND ledger_id IS ?', ask.di_id, ask.ledger_id) : null;
      const ledgerDI = ask.di_id && ledger ? one(ledger.db, 'SELECT kind FROM decision_items WHERE di_id=?', ask.di_id) : null;
      const di = supervisorDI ?? ledgerDI;
      // ask_requests has no incident_id. Suppress text when the workflow has a credential incident.
      const credentialIncident = ledger && ask.workflow_id ? one(ledger.db,
        "SELECT incident_id FROM incidents WHERE workflow_id=? AND kind='credential-missing' LIMIT 1", ask.workflow_id) : null;
      const credential = di?.kind === 'credential-missing' || Boolean(credentialIncident);
      const credentialObserved = !(ask.ledger_id && !ledger) && !(ask.di_id && (!di || supervisorDI && ledgerDI));
      const contentSuppressed = credential || !credentialObserved;
      return { id: ask.ask_id, store: 'machine', ledgerId: ask.ledger_id ?? null, project: name, wf: ask.workflow_id, di: ask.di_id && di && !(supervisorDI && ledgerDI) ? ref('di', ask.di_id, name, { store: (supervisorDI && 'machine') || 'ledger', ledgerId: ask.ledger_id ?? null }) : null,
        channel: ask.channel, question: contentSuppressed ? null : ask.question, credential, credentialObserved, contentSuppressed,
        askedAt: ask.asked_at, answeredAt: ask.answered_at, state: ask.state };
    });
}
function listedIncidents(store, url) {
  const project = url.searchParams.get('project'), wf = url.searchParams.get('wf');
  const status = url.searchParams.get('status') ?? 'open';
  return allLedgers(store, project, (ledger, db) => many(db, 'SELECT * FROM incidents ORDER BY updated_at DESC').map(item => ({
    id: item.incident_id, store: 'ledger', ledgerId: ledger.ledgerId, project: ledger.name, wf: item.workflow_id, op: item.op_id, kind: item.kind,
    owner: item.owner, status: item.status, resolvedReason: item.kind === 'credential-missing' ? null : item.resolved_reason,
    ui: uiState(db, 'incident', item.status), dueAt: item.due_at, attempts: item.attempts,
    modelCalls: item.model_calls, tokens: item.tokens, elapsedMs: item.elapsed_ms,
    lastProgress: item.kind === 'credential-missing' ? null : item.last_progress, updatedAt: item.updated_at })), 'incidents')
    .filter(item => (!wf || item.wf === wf) && (!url.searchParams.get('id') || item.id === url.searchParams.get('id')) && (status === 'all' || item.status === status))
    .sort((a, b) => b.updatedAt - a.updatedAt || `${a.ledgerId}:${a.id}`.localeCompare(`${b.ledgerId}:${b.id}`));
}

const LISTINGS = new Map([
  ['/api/decisions', { list: listedDecisions, sources: ledgers => [...source('machine', 'sup_decision_items', 'v_open_sup_decisions', 'ask_requests', 'deliveries'),
    ...ledgers.flatMap(ledger => source(ledger.name, 'v_decision_rows'))] }],
  ['/api/asks', { list: listedAsks, sources: ledgers => [...source('machine', 'ask_requests', 'sup_decision_items'),
    ...ledgers.flatMap(ledger => source(ledger.name, 'decision_items', 'incidents'))] }],
  ['/api/incidents', { list: listedIncidents, sources: ledgers => ledgers.flatMap(ledger => source(ledger.name, 'incidents')) }],
]);
function sendDecision(request, response, store, url, pathname) {
  let id;
  try { id = decodeURIComponent(pathname.slice('/api/decisions/'.length)); } catch { sendError(request, response, 400, 'BAD_PATH', 'Invalid decision id'); return; }
  if (url.searchParams.has('store') && !['machine', 'ledger'].includes(url.searchParams.get('store'))) { sendError(request, response, 400, 'BAD_SCOPE', 'Invalid decision namespace'); return; }
  const item = detail(store, id, url);
  if (item?.unavailable) { sendError(request, response, 503, 'READ_FAILED', 'Decision source is unavailable; exact identity cannot be established.'); return; }
  if (item?.ambiguous) { sendError(request, response, 400, 'AMBIGUOUS_DECISION', 'Decision ID occurs in multiple stores. Specify store and ledger.'); return; }
  if (!item) { sendError(request, response, 404, 'NOT_FOUND', 'Decision Item not found'); return; }
  sendJson(request, response, item, { sources: [...source('machine', 'deliveries', 'ask_requests', ...(item.store === 'machine' ? ['sup_decision_items', 'v_open_sup_decisions', 'sup_events', 'sup_decisions'] : [])),
    ...(item.store === 'ledger' ? source(item.project, 'decision_items', 'v_decision_rows', 'events', 'decisions') : [])], stale: staleOf(store) });
}

/** C12 read-only Decision Items, asks, and incidents. */
export function handleDecisions(request, response, store, url) {
  const pathname = url.pathname;
  if (pathname === '/api/decisions/log') return false;
  if (!LISTINGS.has(pathname) && !/^\/api\/decisions\/[^/]+$/.test(pathname)) return false;
  if (!store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
  if (url.searchParams.get('project') && !scopedLedgers(store, url.searchParams.get('project')).length) { sendError(request, response, 404, 'NOT_FOUND', 'Project not found'); return true; }
  const listing = LISTINGS.get(pathname);
  if (!listing) { sendDecision(request, response, store, url, pathname); return true; }
  const result = page(listing.list(store, url), url);
  sendJson(request, response, result.rows, { sources: listing.sources(scopedLedgers(store, url.searchParams.get('project'))), stale: staleOf(store), next: result.next });
  return true;
}
