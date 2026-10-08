function collectionRoute(request, response, store, url, pathname, helpers) {
  const { sendJson, source, staleOf, workers, projects, workflowRows, pageData, decisionLog } = helpers;
  if (pathname === '/api/workers') {
    sendJson(request, response, workers(store, url), { sources: [
      ...source('machine', 'v_engine_health', 'v_sla_open', 'invariant_violations', 'sup_decision_items', 'v_open_sup_decisions', 'v_seats', 'metrics_snapshots'),
      ...store.projects().flatMap(row => source(row.name, 'v_workflow_progress', 'workflows', 'v_units', 'v_decision_rows', 'jobs', 'goals', 'work_graph_versions', 'logs', 'events', 'v_op_history', 'op_attempts', 'check_runs', 'llm_usage')),
      ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml')], stale: staleOf(store) });
    return true;
  }
  if (pathname === '/api/projects') {
    sendJson(request, response, projects(store), { sources: [...source('machine', 'ledgers', 'repositories'),
      ...store.projects().flatMap(row => source(row.name, 'workflows'))], stale: staleOf(store) });
    return true;
  }
  if (pathname === '/api/workflows') {
    let rows = workflowRows(store, { project: url.searchParams.get('project') });
    const phase = url.searchParams.get('phase') ?? 'running';
    if (phase !== 'all') rows = rows.filter(row => row.phase === phase);
    const ui = url.searchParams.get('ui'), q = url.searchParams.get('q')?.toLowerCase();
    if (ui) rows = rows.filter(row => row.ui === ui);
    if (q) rows = rows.filter(row => `${row.name} ${row.id} ${row.project}`.toLowerCase().includes(q));
    rows.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    const result = pageData(rows, url);
    sendJson(request, response, result.data, { sources: [...source('machine', 'metrics_snapshots', 'v_seats', 'v_sla_open'),
      ...store.projects().flatMap(row => source(row.name, 'v_workflow_progress', 'workflows', 'v_units', 'v_decision_rows', 'jobs', 'goals', 'work_graph_versions', 'logs', 'events', 'v_op_history', 'op_attempts', 'check_runs')),
      ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml')], stale: staleOf(store), next: result.next });
    return true;
  }
  if (pathname === '/api/decisions/log') {
    const result = pageData(decisionLog(store, url), url);
    sendJson(request, response, result.data, { sources: [source('machine', 'sup_decisions')[0], ...store.projects().flatMap(row => source(row.name, 'decisions'))], stale: staleOf(store), next: result.next });
    return true;
  }
  return false;
}

function workflowDetailRoute(request, response, store, row, db, wf, helpers) {
  const { sendJson, source, staleOf, detail } = helpers;
  sendJson(request, response, detail(store, row, db, wf), { sources: [
    ...source(row.name, 'workflows', 'lifecycle_changes', 'goals', 'v_workflow_progress', 'v_units', 'v_blocking', 'v_decision_rows', 'incidents', 'v_op_history', 'op_attempts', 'check_runs', 'jobs', 'work_graph_versions', 'logs', 'events', 'llm_usage'),
    ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml'),
    ...source('machine', 'metrics_snapshots', 'v_seats', 'v_sla_open')], stale: staleOf(store) });
  return true;
}
function workflowGraphRoute(request, response, store, row, db, wf, helpers) {
  const { sendJson, source, staleOf, graph } = helpers;
  sendJson(request, response, graph(db, row.name, wf), { sources: source(row.name, 'v_units', 'unit_edges', 'v_op_history'), stale: staleOf(store) });
  return true;
}
function workflowPipelineRoute(request, response, store, row, db, wf, helpers) {
  const { sendJson, source, staleOf, pipelineOf, usageDetail } = helpers;
  sendJson(request, response, { ...pipelineOf(db, row.name, wf), usage: usageDetail(db, { wf }) }, { sources: [...source(row.name, 'goals', 'work_units', 'v_op_history', 'op_attempts', 'check_runs', 'jobs', 'work_graph_versions', 'logs', 'events', 'llm_usage'), ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml')], stale: staleOf(store) });
  return true;
}
function workflowUnitsRoute(request, response, store, url, { row, db, wf, extra }, helpers) {
  const { sendJson, sendError, unitDetail, source, staleOf, many, unitRow, pageData } = helpers;
  if (extra) {
    const item = unitDetail(db, row.name, wf, extra);
    if (!item) { sendError(request, response, 404, 'NOT_FOUND', 'Unit not found'); return true; }
    sendJson(request, response, item, { sources: source(row.name, 'v_units', 'v_op_history', 'op_attempts', 'check_runs', 'unit_edges', 'decisions', 'v_blocking'), stale: staleOf(store) }); return true;
  }
  let rows = many(db, 'SELECT * FROM v_units WHERE workflow_id=? ORDER BY updated_at DESC,unit_id', wf).map(unit => unitRow(db, unit, row.name));
  const state = url.searchParams.get('state'), op = url.searchParams.get('op'), ui = url.searchParams.get('ui'), q = url.searchParams.get('q')?.toLowerCase();
  if (state) rows = rows.filter(item => item.state === state);
  if (op) rows = rows.filter(item => item.op === op);
  if (ui) rows = rows.filter(item => item.ui === ui);
  if (q) rows = rows.filter(item => `${item.unit} ${item.title} ${item.op}`.toLowerCase().includes(q));
  const result = pageData(rows, url);
  sendJson(request, response, result.data, { sources: source(row.name, 'v_units', 'v_op_history', 'op_attempts', 'check_runs'), stale: staleOf(store), next: result.next }); return true;
}
function workflowWorktreesRoute(request, response, store, url, row, wf, helpers) {
  const { sendJson, source, staleOf, many, hostPath, worktreeUi, pageData } = helpers;
  const all = url.searchParams.get('all') === '1';
  const rows = many(store.machine.db, 'SELECT * FROM worktrees WHERE ledger_id=? AND workflow_id=? ORDER BY created_at DESC', row.ledgerId, wf)
    .filter(item => all || item.removed_at == null).map(item => ({ path: hostPath(item.path), repoRoot: hostPath(item.repo_root), lane: item.lane, port: item.port, attempt: item.attempt_id, kind: item.kind,
      branch: item.branch, baseSha: item.base_sha, headSha: item.head_sha, jobId: item.job_id,
      createdAt: item.created_at, removedAt: item.removed_at, removeError: item.remove_error,
      ui: worktreeUi(item) }));
  const result = pageData(rows, url, { identity: item => item.path });
  sendJson(request, response, result.data, { sources: source('machine', 'worktrees'), stale: staleOf(store), next: result.next }); return true;
}
function workflowMetricRoute(request, response, store, row, wf, route, helpers) {
  const { sendJson, sendError, source, staleOf, readMetricSnapshot, metricPayload } = helpers;
  try {
    const recorded = readMetricSnapshot(store.machine, route, row.ledgerId, wf);
    const schemas = { rca: 'starci/rca@1', coverage: 'starci/proof-coverage@1', verify: 'starci/proof-verify@1' };
    if (recorded) metricPayload(recorded, schemas[route]);
    sendJson(request, response, recorded, { sources: [...source('machine', 'metrics_snapshots', 'blobs')], stale: staleOf(store) });
  } catch (error) { sendError(request, response, 502, 'METRIC_SOURCE_FAILED', String(error?.message ?? error)); }
  return true;
}
function workflowPathContext(request, response, store, match, helpers) {
  let project, wf, extra;
  try { project = decodeURIComponent(match[1]); wf = decodeURIComponent(match[2]); extra = match[4] ? decodeURIComponent(match[4]) : null; }
  catch { helpers.sendError(request, response, 400, 'BAD_PATH', 'Invalid path encoding'); return null; }
  const target = store.ledger(project);
  if (!target) {
    const registered = store.projects().some(row => row.name === project || row.ledgerId === project);
    helpers.sendError(request, response, registered ? 503 : 404, registered ? 'LEDGER_UNAVAILABLE' : 'NOT_FOUND', registered ? 'Registered project ledger is unavailable' : 'Project not found');
    return null;
  }
  const { row, db } = target;
  if (!helpers.one(db, 'SELECT workflow_id FROM workflows WHERE workflow_id=?', wf)) { helpers.sendError(request, response, 404, 'NOT_FOUND', 'Workflow not found'); return null; }
  return { wf, extra, row, db, route: match[3] ?? 'detail' };
}
function workflowPathRoute(request, response, store, url, match, helpers) {
  const context = workflowPathContext(request, response, store, match, helpers);
  if (!context) return true;
  const { wf, row, db, route } = context;
  if (route === 'detail') return workflowDetailRoute(request, response, store, row, db, wf, helpers);
  if (route === 'graph') return workflowGraphRoute(request, response, store, row, db, wf, helpers);
  if (route === 'pipeline') return workflowPipelineRoute(request, response, store, row, db, wf, helpers);
  if (route === 'units') return workflowUnitsRoute(request, response, store, url, context, helpers);
  if (route === 'worktrees') return workflowWorktreesRoute(request, response, store, url, row, wf, helpers);
  if (['rca', 'coverage', 'verify'].includes(route)) return workflowMetricRoute(request, response, store, row, wf, route, helpers);
  return false;
}

export function dispatchWorkRoute(request, response, store, url, helpers) {
  const pathname = url.pathname;
  if (!store.machine) {
    if (pathname.startsWith('/api/workers') || pathname.startsWith('/api/projects') || pathname.startsWith('/api/workflows') || pathname === '/api/decisions/log') {
      helpers.sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true;
    }
    return false;
  }
  if (collectionRoute(request, response, store, url, pathname, helpers)) return true;
  const match = /^\/api\/workflows\/([^/]+)\/([^/]+)(?:\/(graph|pipeline|units|rca|worktrees|coverage|verify)(?:\/([^/]+))?)?$/.exec(pathname);
  if (!match) return false;
  return workflowPathRoute(request, response, store, url, match, helpers);
}
