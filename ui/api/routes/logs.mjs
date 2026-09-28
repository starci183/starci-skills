import { sendJson, sendError } from '../envelope.mjs';
import { publicJson } from '../redact-read.mjs';

const source = (db, ...rels) => rels.map(rel => ({ db, rel }));
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
const limitOf = url => Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = value => { try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { return {}; } };
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const projectName = (store, ledgerId) => store.projects().find(row => row.ledgerId === ledgerId)?.name ?? null;
const ref = (kind, id, project = null) => ({ kind, ...(project ? { project } : {}), id: String(id),
  href: kind === 'attempt' ? `#/a/${encodeURIComponent(project ?? '')}/${encodeURIComponent(id)}`
    : kind === 'workflow' ? `#/w/${encodeURIComponent(project ?? '')}/${encodeURIComponent(id)}`
      : kind === 'di' ? `#/decisions?id=${encodeURIComponent(id)}` : '#/logs' });

function wantedDatabases(store, url) {
  const scope = url.searchParams.get('scope') ?? 'all';
  const project = url.searchParams.get('project');
  if (!['all', 'machine', 'project'].includes(scope)) return null;
  const databases = [];
  if (scope !== 'project') databases.push({ name: 'machine', db: store.machine.db, table: 'machine_logs', fts: 'machine_logs_fts' });
  if (scope !== 'machine') for (const row of store.projects()) {
    if (project && row.name !== project) continue;
    const ledger = store.ledger(row.name);
    if (ledger) databases.push({ name: row.name, db: ledger.db, table: 'logs', fts: 'logs_fts' });
  }
  return databases;
}

function queryRows(dbInfo, url, position = null, afterSeq = null) {
  const { db, name, table, fts } = dbInfo;
  const terms = [], args = [];
  const add = (sql, value) => { terms.push(sql); args.push(value); };
  if (position) { terms.push('(l.at < ? OR (l.at = ? AND l.seq < ?))'); args.push(position.at, position.at, position.seq); }
  if (afterSeq != null) add('l.seq > ?', afterSeq);
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
  if (url.searchParams.has('kind')) add("l.kind LIKE ? ESCAPE '\\'", `${url.searchParams.get('kind').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
  if (url.searchParams.has('since')) add('l.at >= ?', Number(url.searchParams.get('since')));
  if (url.searchParams.has('until')) add('l.at <= ?', Number(url.searchParams.get('until')));
  if (name === 'machine' && url.searchParams.has('project')) {
    const project = url.searchParams.get('project');
    const ledgerId = dbInfo.projects?.find(row => row.name === project)?.ledgerId;
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
  const rawRefs = parse(row.refs_json, []);
  const refs = Array.isArray(rawRefs) ? rawRefs.filter(x => x && typeof x === 'object' && x.kind && x.id != null)
    .map(x => ref(x.kind, x.id, x.project ?? project)) : [];
  return { key: `${dbName}:${row.seq}`, db: dbName, seq: row.seq, at: row.at, actor: row.actor,
    controller: row.controller ?? null, project, wf: row.workflow_id, job: row.job_id,
    level: row.level, kind: row.kind, msg: row.msg, data: parse(row.data_json), refs,
    traceId: row.trace_id, spanId: row.span_id };
}

function orderRows(a, b) { return b.at - a.at || a.db.localeCompare(b.db) || b.seq - a.seq; }
function listLogs(store, url) {
  const databases = wantedDatabases(store, url);
  if (!databases) return null;
  const cursor = decode(url.searchParams.get('cursor') ?? '');
  const rows = databases.flatMap(info => queryRows({ ...info, projects: store.projects() }, url, cursor[info.name] ?? null)
    .map(row => logRow(row, info.name, store))).sort(orderRows);
  const selected = rows.slice(0, limitOf(url));
  const next = { ...cursor };
  for (const row of selected) next[row.db] = { at: row.at, seq: row.seq };
  return { rows: selected, next: selected.length < rows.length ? encode(next) : null,
    sources: databases.flatMap(info => source(info.name, info.table, ...(url.searchParams.has('q') ? [info.fts] : []))) };
}

function timeline(store, url) {
  const project = url.searchParams.get('project'), wf = url.searchParams.get('wf'), job = url.searchParams.get('job');
  if (!project) return null;
  const target = store.ledger(project);
  if (!target) return null;
  const { row: ledger, db } = target, machine = store.machine.db;
  const allowed = new Set((url.searchParams.get('sources') ?? 'event,log,attempt,check,decision,violation,action').split(','));
  const since = Number(url.searchParams.get('since')) || -Infinity, until = Number(url.searchParams.get('until')) || Infinity;
  const rows = many(db, 'SELECT * FROM v_timeline ORDER BY at DESC,seq DESC').filter(row => (!wf || row.workflow_id === wf)
    && (!job || (row.source === 'log' ? one(db, 'SELECT job_id FROM logs WHERE seq=?', row.seq)?.job_id === job
      : row.attempt_id ? one(db, 'SELECT job_id FROM op_attempts WHERE attempt_id=?', row.attempt_id)?.job_id === job : false))
    && allowed.has(row.source) && row.at >= since && row.at <= until).map(row => ({ at: row.at,
    source: row.source, kind: row.kind, ui: row.source === 'check' && row.kind.endsWith('fail') ? 'bad'
      : row.source === 'attempt' && row.kind === 'fail' ? 'bad' : row.source === 'attempt' ? 'running' : 'ok',
    title: row.source === 'check' ? row.kind : row.source === 'log' ? row.detail : row.kind,
    ref: row.source === 'attempt' || row.source === 'check' ? ref('attempt', row.attempt_id, project)
      : row.source === 'decision' ? ref('di', row.entity_id, project) : ref('workflow', row.workflow_id, project),
    detail: row.source === 'check' ? null : parse(row.detail, row.detail) }));
  if (allowed.has('violation')) rows.push(...many(machine, 'SELECT * FROM invariant_violations WHERE ledger_id=?', ledger.ledgerId)
    .filter(row => (!wf || row.workflow_id === wf) && (!job || row.entity.endsWith(`:${job}`)) && row.violated_at >= since && row.violated_at <= until)
    .map(row => ({ at: row.violated_at, source: 'violation', kind: row.code, ui: row.severity === 'critical' ? 'bad' : 'warn',
      title: row.code, ref: ref('workflow', row.workflow_id, project), detail: parse(row.detail_json) })));
  if (allowed.has('action')) rows.push(...many(machine, 'SELECT * FROM v_engine_actions WHERE ledger_id=?', ledger.ledgerId)
    .filter(row => (!wf || row.workflow_id === wf) && (!job || row.job_id === job) && row.started_at >= since && row.started_at <= until)
    .map(row => ({ at: row.started_at, source: 'action', kind: row.verb ?? row.duty, ui: row.ui,
      title: row.verb ?? row.duty, ref: row.attempt_id ? ref('attempt', row.attempt_id, project) : ref('workflow', row.workflow_id, project),
      detail: parse(row.result_json) })));
  rows.sort((a, b) => b.at - a.at);
  const offset = Math.max(0, Number(decode(url.searchParams.get('cursor') ?? '').offset) || 0), limit = limitOf(url);
  return { rows: rows.slice(offset, offset + limit), next: offset + limit < rows.length ? encode({ offset: offset + limit }) : null,
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
