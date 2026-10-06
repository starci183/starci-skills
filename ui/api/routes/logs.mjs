import { sendJson, sendError } from '../envelope.mjs';
import { publicJson } from '../redact-read.mjs';
import { page, readCursor, encodeCursor, cursorScope, ReadCursorError, limitOf } from '../query.mjs';
import { uiState } from '../state.mjs';

const source = (db, ...rels) => rels.map(rel => ({ db, rel }));
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const LIKE_ESCAPE_PERCENT = String.raw`\%`;
const LIKE_ESCAPE_UNDERSCORE = String.raw`\_`;
const projectName = (store, ledgerId) => store.projects().find(row => row.ledgerId === ledgerId)?.name ?? null;
const ref = (kind, id, project = null, namespace = null) => {
  const diParams = new URLSearchParams({ id: String(id) });
  if (project) diParams.set('project', project);
  if (namespace) { diParams.set('store', namespace.store); if (namespace.ledgerId) diParams.set('ledger', namespace.ledgerId); }
  let href = null;
  if (kind === 'attempt' && project && Number.isSafeInteger(Number(id))) href = `#/a/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
  else if (kind === 'workflow' && project) href = `#/w/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
  else if (kind === 'di') href = `#/decisions?${diParams}`;
  if (!href) return null;
  return { kind, ...(project ? { project } : {}), ...namespace, id: String(id), href };
};

function wantedDatabases(store, url) {
  const exactSource = url.searchParams.get('source');
  let scope;
  if (exactSource === 'machine') scope = 'machine';
  else if (exactSource === 'ledger') scope = 'project';
  else scope = url.searchParams.get('scope') ?? 'all';
  const project = url.searchParams.get('project');
  if (project && !store.projects().some(row => row.name === project || row.ledgerId === project)) return null;
  if (!['all', 'machine', 'project'].includes(scope) || exactSource && !['machine', 'ledger'].includes(exactSource) || exactSource === 'ledger' && !project || url.searchParams.has('id') && !exactSource) return null;
  const databases = [];
  if (scope !== 'project' && store.machine) databases.push({ name: 'machine', ledgerId: null, db: store.machine.db, table: 'machine_logs', fts: 'machine_logs_fts' });
  if (scope !== 'machine') for (const row of store.projects()) {
    if (project && row.name !== project && row.ledgerId !== project) continue;
    const ledger = store.ledger(row.name);
    if (ledger) databases.push({ name: row.name, ledgerId: row.ledgerId, db: ledger.db, table: 'logs', fts: 'logs_fts' });
  }
  return databases;
}

function queryRows(dbInfo, url, position = null, afterSeq = null, snapshot = null) {
  const { db, name, table, fts } = dbInfo;
  const terms = [], args = [];
  const add = (sql, value) => { terms.push(sql); args.push(value); };
  if (position) { terms.push('(l.at < ? OR (l.at = ? AND l.seq < ?))'); args.push(position.at, position.at, position.seq); }
  if (afterSeq != null) add('l.seq > ?', afterSeq);
  if (snapshot != null) add('l.seq <= ?', snapshot);
  if (url.searchParams.has('id')) add('l.seq = ?', Number(url.searchParams.get('id')));
  for (const [param, column] of [['wf', 'workflow_id'], ['job', 'job_id'], ['actor', 'actor'], ['level', 'level']]) {
    if (url.searchParams.has(param)) add(`l.${column} = ?`, url.searchParams.get(param));
  }
  if (url.searchParams.has('minLevel')) {
    const levels = LOG_LEVELS.slice(LOG_LEVELS.indexOf(url.searchParams.get('minLevel')));
    terms.push(`l.level IN (${levels.map(() => '?').join(',')})`);
    args.push(...levels);
  }
  if (url.searchParams.has('controller')) {
    if (name !== 'machine') return [];
    add('l.controller = ?', url.searchParams.get('controller'));
  }
  if (url.searchParams.has('kind')) {
    const kind = url.searchParams.get('kind').replaceAll('%', LIKE_ESCAPE_PERCENT).replaceAll('_', LIKE_ESCAPE_UNDERSCORE) + '%';
    add(String.raw`l.kind LIKE ? ESCAPE '\'`, kind);
  }
  if (url.searchParams.has('since')) add('l.at >= ?', Number(url.searchParams.get('since')));
  if (url.searchParams.has('until')) add('l.at <= ?', Number(url.searchParams.get('until')));
  if (name === 'machine' && url.searchParams.has('project')) {
    const project = url.searchParams.get('project');
    const ledgerId = dbInfo.projects?.find(row => row.name === project || row.ledgerId === project)?.ledgerId;
    if (!ledgerId) return [];
    add('l.ledger_id = ?', ledgerId);
  }
  if (url.searchParams.has('q')) {
    const q = url.searchParams.get('q')?.trim();
    if (q) { terms.push(`l.seq IN (SELECT rowid FROM ${fts} WHERE ${fts} MATCH ?)`); args.push(`"${q.replaceAll('"', '""')}"`); }
  }
  const where = terms.length ? ` WHERE ${terms.join(' AND ')}` : '';
  return many(db, `SELECT l.* FROM ${table} l${where} ORDER BY l.at DESC,l.seq DESC`, ...args);
}

function logRow(row, dbName, store) {
  const project = dbName === 'machine' ? projectName(store, row.ledger_id) : dbName;
  const ledgerId = dbName === 'machine' ? row.ledger_id ?? null : store.projects().find(item => item.name === dbName)?.ledgerId ?? null;
  const rawRefs = parse(row.refs_json, []);
  const refs = Array.isArray(rawRefs) ? rawRefs.filter(x => x && typeof x === 'object' && x.kind && x.id != null)
    .map(x => ref(x.kind, x.id, x.project ?? project, (['machine', 'ledger'].includes(x.store) && { store: x.store, ledgerId: x.ledgerId ?? x.ledger ?? null }) || null)).filter(Boolean) : [];
  return { key: `${dbName}:${row.seq}`, db: dbName, store: dbName === 'machine' ? 'machine' : 'ledger', ledgerId, seq: row.seq, at: row.at, actor: row.actor,
    controller: row.controller ?? null, project, wf: row.workflow_id, job: row.job_id,
    level: row.level, kind: row.kind, msg: row.msg, data: parse(row.data_json), refs,
    traceId: row.trace_id, spanId: row.span_id };
}

function orderRows(a, b) { return b.at - a.at || a.db.localeCompare(b.db) || b.seq - a.seq; }
function listLogs(store, url) {
  const databases = wantedDatabases(store, url);
  if (!databases) return null;
  const cursor = readCursor(url);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (cursor && (!object(cursor.positions) || !object(cursor.snapshot))) throw new ReadCursorError();
  const snapshot = cursor?.snapshot ?? Object.fromEntries(databases.map(info => [info.name, one(info.db, `SELECT max(seq) AS seq FROM ${info.table}`)?.seq ?? 0]));
  for (const [name, position] of Object.entries(cursor?.positions ?? {})) if (!position || !Number.isSafeInteger(position.seq) || !Number.isFinite(position.at) || !Object.hasOwn(snapshot, name)) throw new ReadCursorError();
  for (const seq of Object.values(snapshot)) if (!Number.isSafeInteger(seq) || seq < 0) throw new ReadCursorError();
  const scoped = databases.filter(info => Object.hasOwn(snapshot, info.name));
  const rows = scoped.flatMap(info => queryRows({ ...info, projects: store.projects() }, url, cursor?.positions[info.name] ?? null, null, snapshot[info.name])
    .map(row => logRow(row, info.name, store))).sort(orderRows);
  const selected = rows.slice(0, limitOf(url));
  const next = Object.assign(Object.create(null), cursor?.positions ?? {});
  for (const row of selected) next[row.db] = { at: row.at, seq: row.seq };
  return { rows: selected, next: selected.length < rows.length ? encodeCursor({ v: 1, scope: cursorScope(url), positions: next, snapshot }) : null,
    sources: scoped.flatMap(info => source(info.name, info.table, ...(url.searchParams.has('q') ? [info.fts] : []))) };
}

function timeline(store, url) {
  const project = url.searchParams.get('project'), wf = url.searchParams.get('wf'), job = url.searchParams.get('job');
  if (!project) return null;
  const target = store.ledger(project);
  if (!target) return null;
  const { row: ledger, db } = target, machine = store.machine.db;
  const allowed = new Set((url.searchParams.get('sources') ?? 'event,log,attempt,check,decision,violation,action').split(','));
  const since = Number(url.searchParams.get('since')) || -Infinity, until = Number(url.searchParams.get('until')) || Infinity;
  const matchesJob = row => {
    if (!job) return true;
    if (row.source === 'log') return one(db, 'SELECT job_id FROM logs WHERE seq=?', row.seq)?.job_id === job;
    if (row.attempt_id) return one(db, 'SELECT job_id FROM op_attempts WHERE attempt_id=?', row.attempt_id)?.job_id === job;
    return false;
  };
  const rows = many(db, 'SELECT * FROM v_timeline ORDER BY at DESC,source,seq DESC').filter(row => row.source !== 'decision' && (!wf || row.workflow_id === wf)
    && matchesJob(row)
    && allowed.has(row.source) && row.at >= since && row.at <= until).map(row => {
    let recorded = null;
    if (row.source === 'attempt') recorded = one(db, 'SELECT attempt_state,ui FROM v_op_history WHERE attempt_id=?', row.attempt_id);
    else if (row.source === 'check') recorded = one(db, 'SELECT ui FROM v_checks WHERE check_id=?', row.entity_id);
    const nativeUi = recorded?.ui;
    let ui = 'unknown';
    if (['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'].includes(nativeUi)) ui = nativeUi;
    else if (nativeUi === 'awaiting-owner') ui = 'waiting';
    else if (nativeUi === 'rejected') ui = 'warn';
    else if (row.source === 'log' && row.kind.startsWith('error:')) ui = 'bad';
    else if (row.source === 'log' && row.kind.startsWith('warn:')) ui = 'warn';
    let title = row.kind;
    if (row.source === 'check') title = row.kind;
    else if (row.source === 'log') title = row.detail;
    let rowRef = null;
    if (row.source === 'attempt' || row.source === 'check') rowRef = ref('attempt', row.attempt_id, project);
    else if (row.workflow_id) rowRef = ref('workflow', row.workflow_id, ledger.name);
    return { id: `${ledger.ledgerId}:${row.source}:${row.seq}`, ledgerId: ledger.ledgerId, project: ledger.name, at: row.at,
    source: row.source, kind: row.kind, ui,
    title,
    ref: rowRef,
    detail: row.source === 'check' ? null : parse(row.detail, row.detail) };
  });
  if (allowed.has('decision')) rows.push(...many(db, 'SELECT * FROM decisions ORDER BY decided_at DESC,decision_id').filter(row => (!wf || row.workflow_id === wf) && row.decided_at >= since && row.decided_at <= until
    && (!job || row.subject_type === 'job' && row.subject_id === job || row.subject_type === 'attempt' && one(db, 'SELECT job_id FROM op_attempts WHERE attempt_id=?', row.subject_id)?.job_id === job)).map(row => {
      const params = new URLSearchParams({ id: row.di_id, store: 'ledger', ledger: ledger.ledgerId, project: ledger.name });
      let targetRef = null;
      if (row.di_id) targetRef = { kind: 'di', id: row.di_id, project: ledger.name, store: 'ledger', ledgerId: ledger.ledgerId, href: `#/decisions?${params}` };
      else if (row.subject_type === 'attempt') targetRef = ref('attempt', row.subject_id, ledger.name);
      else if (row.workflow_id) targetRef = ref('workflow', row.workflow_id, ledger.name);
      return { id: `${ledger.ledgerId}:decision:${row.decision_id}`, ledgerId: ledger.ledgerId, project: ledger.name, at: row.decided_at, source: 'decision', kind: row.choice, ui: uiState(db, 'decision', 'resolved'), title: row.choice, ref: targetRef, detail: { decisionId: row.decision_id, rationale: row.rationale, result: parse(row.result_json) } };
    }));
  if (allowed.has('violation')) rows.push(...many(machine, 'SELECT * FROM invariant_violations WHERE ledger_id=?', ledger.ledgerId)
    .filter(row => (!wf || row.workflow_id === wf) && (!job || row.entity === `job:${job}`) && row.violated_at >= since && row.violated_at <= until)
    .map(row => ({ id: `machine:violation:${row.violation_id}`, ledgerId: ledger.ledgerId, project: ledger.name, at: row.violated_at, source: 'violation', kind: row.code, ui: row.severity === 'critical' ? 'bad' : 'warn',
      title: row.code, ref: ref('workflow', row.workflow_id, project), detail: parse(row.detail_json) })));
  if (allowed.has('action')) rows.push(...many(machine, 'SELECT * FROM v_engine_actions WHERE ledger_id=?', ledger.ledgerId)
    .filter(row => Number.isFinite(row.started_at) && (!wf || row.workflow_id === wf) && (!job || row.job_id === job) && row.started_at >= since && row.started_at <= until)
    .map(row => ({ id: `machine:action:${row.id}`, ledgerId: ledger.ledgerId, project: ledger.name, at: row.started_at, source: 'action', kind: row.verb ?? row.duty, ui: row.ui,
      title: row.verb ?? row.duty, ref: row.attempt_id ? ref('attempt', row.attempt_id, project) : ref('workflow', row.workflow_id, project),
      detail: parse(row.result_json) })));
  rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  for (const row of rows) row.key = row.id;
  const result = page(rows, url);
  return { rows: result.rows, next: result.next,
    sources: [...source(project, 'v_timeline'), ...source('machine', 'invariant_violations', 'v_engine_actions')] };
}

function streamLogs(request, response, store, url) {
  if (request.method === 'HEAD') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); response.end(); return;
  }
  const dbs = wantedDatabases(store, url);
  if (!dbs) { sendError(request, response, 400, 'BAD_SCOPE', 'Invalid log scope'); return; }
  const lastId = request.headers['last-event-id'];
  let lastKey = null;
  if (lastId) {
    const split = String(lastId).lastIndexOf(':');
    const name = String(lastId).slice(0, split), seq = Number(String(lastId).slice(split + 1));
    const db = dbs.find(item => item.name === name);
    if (db && Number.isSafeInteger(seq)) {
      const row = one(db.db, `SELECT at FROM ${db.table} WHERE seq=?`, seq);
      if (row) lastKey = { at: row.at, db: name, seq };
    }
  }
  response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  if (lastId) response.write('event: invalidate\ndata: {"topic":"logs"}\n\n');
  const marks = new Map(dbs.map(db => [db.name, 0]));
  const poll = () => {
    try {
      const batch = dbs.flatMap(db => queryRows({ ...db, projects: store.projects() }, url, null, marks.get(db.name))
        .map(row => logRow(row, db.name, store))).sort((a, b) => a.at - b.at || a.db.localeCompare(b.db) || a.seq - b.seq);
      for (const item of batch) {
        marks.set(item.db, Math.max(marks.get(item.db), item.seq));
        if (lastKey && (item.at < lastKey.at || item.at === lastKey.at
          && (item.db.localeCompare(lastKey.db) < 0 || item.db === lastKey.db && item.seq <= lastKey.seq))) continue;
        response.write(`id: ${item.db}:${item.seq}\nevent: log\ndata: ${JSON.stringify(publicJson(item))}\n\n`);
      }
      lastKey = null;
    } catch { response.write('event: invalidate\ndata: {"topic":"logs"}\n\n'); }
  };
  poll();
  const interval = setInterval(poll, 2000);
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
  const cleanup = () => { clearInterval(interval); clearInterval(heartbeat); };
  request.once('close', cleanup);
  response.once('close', cleanup);
}

/** C17 log search, merge, timeline and stream. */
export function handleLogs(request, response, store, url) {
  if (['/api/logs', '/api/logs/stream', '/api/timeline'].includes(url.pathname) && !store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
  if (['/api/logs', '/api/logs/stream'].includes(url.pathname) && url.searchParams.has('id') && (!Number.isSafeInteger(Number(url.searchParams.get('id'))) || Number(url.searchParams.get('id')) < 1)) { sendError(request, response, 400, 'BAD_ID', 'Invalid log sequence'); return true; }
  if (['/api/logs', '/api/logs/stream'].includes(url.pathname) && url.searchParams.has('minLevel')
    && !LOG_LEVELS.includes(url.searchParams.get('minLevel'))) {
    sendError(request, response, 400, 'BAD_MIN_LEVEL', 'Invalid minimum log level'); return true;
  }
  if (url.pathname === '/api/logs') {
    if (!store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
    const result = listLogs(store, url);
    if (!result) { sendError(request, response, 400, 'BAD_SCOPE', 'Invalid log scope'); return true; }
    sendJson(request, response, result.rows, { sources: result.sources, stale: [...store.stale], next: result.next }); return true;
  }
  if (url.pathname === '/api/timeline') {
    const result = timeline(store, url);
    if (!result) { sendError(request, response, 404, 'NOT_FOUND', 'Project not found'); return true; }
    sendJson(request, response, result.rows, { sources: result.sources, stale: [...store.stale], next: result.next }); return true;
  }
  if (url.pathname === '/api/logs/stream') { streamLogs(request, response, store, url); return true; }
  return false;
}
