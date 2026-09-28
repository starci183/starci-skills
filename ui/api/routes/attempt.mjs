import path from 'node:path';
import { readFileSync } from 'node:fs';
import { getBlob } from '../../../scripts/lib/artifact-store.mjs';
import { redactText } from '../../../scripts/lib/redact.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { transcriptWindow } from '../transcript-search.mjs';
import { sendJson, sendError } from '../envelope.mjs';

const DAY = 86_400_000;
const slaCatalogue = parseYaml(readFileSync(new URL('../../../modules/reconciler/sla.yaml', import.meta.url), 'utf8'));
const runtimeAllocation = parseYaml(readFileSync(new URL('../../../modules/models/runtimes.yaml', import.meta.url), 'utf8')).allocation;
function slaMs(code) {
  const entry = slaCatalogue.codes[code];
  if (!entry) return null;
  const keyed = entry.slaKey?.split('.').reduce((value, key) => value?.[key], runtimeAllocation);
  return (keyed ?? entry.slaMs ?? null) == null ? null : (keyed ?? entry.slaMs) + (entry.plusMs ?? 0);
}
const source = (db, ...rels) => rels.map(rel => ({ db, rel }));
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
const staleOf = store => [...store.stale];
const limitOf = url => Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
const cursorOf = url => { try { return Math.max(0, Number(JSON.parse(Buffer.from(url.searchParams.get('cursor') ?? '', 'base64url').toString()).offset) || 0); } catch { return 0; } };
const page = (rows, url) => { const offset = cursorOf(url), limit = limitOf(url); return { rows: rows.slice(offset, offset + limit), next: offset + limit < rows.length ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString('base64url') : null }; };
function safePath(value, root = null) {
  if (!value) return null;
  const text = String(value).replaceAll('\\', '/');
  if (!path.isAbsolute(value) && !/^[A-Za-z]:\//.test(text)) return text;
  if (root) {
    const rel = path.relative(root, value).replaceAll('\\', '/');
    if (rel && !rel.startsWith('../') && rel !== '..' && !path.isAbsolute(rel)) return rel;
  }
  return text.split('/').filter(Boolean).slice(-2).join('/');
}
function ref(kind, id, project = null) {
  const p = encodeURIComponent(project ?? '');
  const key = encodeURIComponent(String(id));
  const href = kind === 'attempt' ? `#/a/${p}/${key}` : kind === 'unit' ? `#/w/${p}?tab=units&unit=${key}`
    : kind === 'di' ? `#/decisions?id=${key}` : kind === 'workflow' ? `#/w/${p}/${key}` : '#/system';
  return { kind, ...(project ? { project } : {}), id: String(id), href };
}
function blobLink(db, sha) {
  if (!sha) return null;
  const row = one(db, 'SELECT sha256,bytes,media_type,archived_at FROM blobs WHERE sha256=?', sha);
  return row ? { sha: row.sha256, bytes: row.bytes, mediaType: row.media_type,
    href: `/api/blob/${row.sha256}`, archived: row.archived_at != null } : null;
}
function attemptRow(row, project) {
  return { project, id: row.attempt_id, wf: row.workflow_id, unit: row.unit_id, job: row.job_id, op: row.op_id,
    attempt: row.try_no, dispatchSeq: row.dispatch_seq, agent: row.agent, model: row.model, pool: row.pool, effort: row.effort,
    dispatchedAt: row.dispatched_at, reportedAt: row.reported_at, settledAt: row.settled_at, cycleMs: row.cycle_ms,
    reportOutcome: row.report_outcome, verdict: row.verdict, settledBy: row.settled_by,
    failureClass: row.failure_class, endState: row.end_state, ui: row.ui,
    checks: row.checks, checksRed: row.checks_red, artifacts: row.artifacts,
    tokensIn: row.tokens_in, tokensOut: row.tokens_out, costUsd: row.cost_usd,
    summary: row.report_summary, href: ref('attempt', row.attempt_id, project).href };
}
function mediaItem(item, project) {
  return { artifactId: item.artifact_id, project, wf: item.workflow_id, job: item.job_id,
    attempt: item.attempt_id, role: item.role, kind: item.kind, subkind: item.subkind,
    name: item.name, label: item.label, scopeRef: item.scope_ref, round: item.round,
    blob: { sha: item.sha256, bytes: item.bytes, mediaType: item.media_type, href: item.http_path, archived: item.archived_at != null },
    createdAt: item.created_at };
}
function checkRow(db, check, root) {
  return { id: check.check_id, name: check.name, phase: check.phase, runner: check.runner, authority: check.authority,
    runSeq: check.run_seq, command: null, cwd: safePath(check.cwd, root), exitCode: check.exit_code,
    declaredExitCode: check.declared_exit_code, status: check.status, ui: check.ui,
    startedAt: check.started_at, finishedAt: check.finished_at, wallMs: check.wall_ms,
    stdout: blobLink(db, check.stdout_sha), stderr: blobLink(db, check.stderr_sha), output: blobLink(db, check.output_sha),
    summary: parse(check.summary_json), attribution: parse(check.attribution_json), note: check.note };
}
function tail(db, sha) {
  if (!sha || !blobLink(db, sha)) return '';
  try { return redactText(getBlob(sha).toString('utf8').split(/\r?\n/).slice(-200).join('\n')); } catch { return ''; }
}
function actionRow(machine, action) {
  return { id: action.id, controller: action.controller, duty: action.duty, key: action.key, verb: action.verb,
    state: action.state, ui: action.ui, mode: action.mode, epoch: action.epoch,
    startedAt: action.started_at, finishedAt: action.finished_at, exitCode: action.exit_code,
    errorSignature: action.error_signature, target: action.attempt_id ? ref('attempt', action.attempt_id) : action.job_id ? ref('workflow', action.workflow_id) : null,
    result: parse(action.result_json), resultBlob: blobLink(machine, action.result_sha),
    stdout: blobLink(machine, action.stdout_sha), stderr: blobLink(machine, action.stderr_sha),
    steps: many(machine, 'SELECT * FROM action_steps WHERE action_id=? ORDER BY step_no', action.id).map(step => ({
      stepNo: step.step_no, step: step.step, startedAt: step.started_at, ms: step.ms, ok: step.ok == null ? null : Boolean(step.ok) })) };
}
function timeline(attempt) {
  const steps = [
    ['routed', 'routed_at', null], ['dispatched', 'dispatched_at', 'READY_UNDISPATCHED'],
    ['started', 'started_at', 'WORKER_START_STUCK'], ['attested', 'attested_at', null],
    ['reported', 'reported_at', 'WORKER_SILENT'], ['consumed', 'consumed_at', 'CONSUME_OVERDUE'],
    ['checked', 'checked_at', 'CHECK_OVERDUE'], ['settled', 'settled_at', 'SETTLE_OVERDUE'],
    ['released', 'released_at', 'WORKER_RELEASE_LEAK'], ['terminal-closed', 'terminal_closed_at', 'TERMINAL_LEAK'],
    ['worktree-removed', 'worktree_removed_at', null],
  ];
  return steps.map(([step, field, code], index) => {
    const at = attempt[field];
    const previous = index ? attempt[steps[index - 1][1]] : null;
    const max = code ? slaMs(code) : null;
    return { step, at, ...(max ? { slaMs: max, late: at != null && previous != null ? at - previous > max : false } : {}) };
  });
}
function latestLand(db, wf) {
  const land = one(db, 'SELECT * FROM product_lands WHERE workflow_id=? ORDER BY land_id DESC LIMIT 1', wf);
  return land ? { result: land.result, mergedSha: land.merged_sha, reason: land.reason,
    output: blobLink(db, land.output_sha), at: land.finished_at ?? land.started_at } : null;
}
function attemptDetail(store, ledger, db, row) {
  const machine = store.machine.db;
  const raw = one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', row.attempt_id);
  const job = one(db, 'SELECT * FROM jobs WHERE job_id=?', row.job_id);
  const report = one(db, 'SELECT * FROM reports WHERE attempt_id=?', row.attempt_id);
  const checks = many(db, 'SELECT * FROM v_checks WHERE attempt_id=? ORDER BY created_at,check_id', row.attempt_id).map(c => checkRow(db, c, raw.repo_root));
  const artifactRows = many(db, 'SELECT x.*,b.http_path,b.archived_at FROM job_artifacts x JOIN blobs b ON b.sha256=x.sha256 WHERE x.attempt_id=? ORDER BY x.created_at,x.artifact_id', row.attempt_id);
  const mediaRows = many(db, 'SELECT * FROM v_media WHERE attempt_id=? ORDER BY created_at,artifact_id', row.attempt_id).map(x => mediaItem(x, ledger.name));
  const mediaIds = new Set(mediaRows.map(x => x.artifactId));
  const nonMedia = artifactRows.filter(x => !mediaIds.has(x.artifact_id)).map(x => mediaItem(x, ledger.name));
  const actions = many(machine, 'SELECT * FROM v_engine_actions WHERE ledger_id=? AND workflow_id=? AND job_id=? ORDER BY started_at', ledger.ledgerId, row.workflow_id, row.job_id).map(x => actionRow(machine, x));
  const decisions = many(db, 'SELECT * FROM decisions WHERE workflow_id=? AND (subject_id=? OR subject_id=? OR di_id IN (SELECT di_id FROM decision_items WHERE attempt_id=? OR job_id=?)) ORDER BY decided_at DESC', row.workflow_id, String(row.attempt_id), row.job_id, row.attempt_id, row.job_id)
    .map(d => ({ id: d.decision_id, decider: d.decider, choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at }));
  const terminal = one(machine, 'SELECT handle,closed_at FROM terminals WHERE ledger_id=? AND attempt_id=? ORDER BY opened_at DESC LIMIT 1', ledger.ledgerId, row.attempt_id);
  const snapshots = one(db, 'SELECT count(*) AS n,max(at) AS last_at FROM attempt_transcript_snapshots WHERE attempt_id=?', row.attempt_id);
  const transcript = raw.transcript_sha ?? one(db, 'SELECT sha256 FROM attempt_transcript_snapshots WHERE attempt_id=? ORDER BY at DESC,snapshot_id DESC LIMIT 1', row.attempt_id)?.sha256;
  const lessons = many(machine, 'SELECT * FROM sup_learning WHERE kind IN (\'lesson\',\'experiment\',\'experiment-result\') ORDER BY updated_at DESC')
    .filter(item => [item.source_ref, item.item_id, item.title, item.detail_json].some(value => value && [row.op_id, row.failure_class].filter(Boolean).some(key => String(value).includes(key))))
    .map(item => ({ id: item.item_id, title: item.title, state: item.state, landedSha: item.landed_sha }));
  const next = one(db, 'SELECT attempt_id FROM op_attempts WHERE job_id IN (SELECT job_id FROM jobs WHERE retry_of=? OR resume_of=?) ORDER BY attempt_id LIMIT 1', job?.job_id, job?.job_id);
  return { ...attemptRow(row, ledger.name), timeline: timeline(raw),
    route: { by: raw.routed_by, chain: parse(raw.route_chain_json), rejected: parse(raw.route_rejected_json) },
    where: { repo: raw.repo_root ? safePath(raw.repo_root) : null, worktree: safePath(raw.worktree_path, raw.repo_root), branch: raw.branch,
      baseSha: raw.base_sha, headSha: raw.head_sha, integratedSha: raw.integrated_sha, worktreeRemovedAt: raw.worktree_removed_at },
    land: latestLand(db, row.workflow_id),
    report: report ? { id: report.report_id, outcome: report.outcome, json: parse(report.report_json),
      attachments: many(db, 'SELECT m.* FROM v_media m JOIN report_attachments ra ON ra.artifact_id=m.artifact_id WHERE ra.report_id=?', report.report_id).map(m => mediaItem(m, ledger.name)) } : null,
    checks, artifacts: mediaRows, nonMedia,
    settle: raw.settled_at ? { by: raw.settled_by, json: parse(raw.settle_json), decision: raw.decision_id ? ref('di', raw.decision_id, ledger.name) : null, nextStep: raw.next_step } : null,
    lessons, decisions, actions,
    terminal: terminal ? { handle: terminal.handle, live: terminal.closed_at == null,
      transcript: blobLink(db, transcript), snapshots: snapshots?.n ?? 0, lastSnapshotAt: snapshots?.last_at ?? null,
      href: `#/a/${encodeURIComponent(ledger.name)}/${row.attempt_id}?step=run` } : null,
    retry: { retryOf: job?.retry_of ? ref('attempt', job.retry_of, ledger.name) : null,
      resumeOf: job?.resume_of ? ref('attempt', job.resume_of, ledger.name) : null,
      class: job?.retry_class ?? null, next: next ? ref('attempt', next.attempt_id, ledger.name) : null },
  };
}
function allLedgers(store, project, fn) {
  return store.forEachLedger(({ row, db }) => project && row.name !== project ? [] : fn(row, db))
    .flatMap(entry => entry.error ? [] : entry.result ?? []);
}
function listedAttempts(store, url) {
  const active = url.searchParams.get('active') === '1';
  const filters = { project: url.searchParams.get('project'), wf: url.searchParams.get('wf'), unit: url.searchParams.get('unit'),
    op: url.searchParams.get('op'), agent: url.searchParams.get('agent'), model: url.searchParams.get('model'),
    verdict: url.searchParams.get('verdict'), outcome: url.searchParams.get('outcome'), failureClass: url.searchParams.get('failureClass'),
    endState: url.searchParams.get('endState'), ui: url.searchParams.get('ui'), since: Number(url.searchParams.get('since')) || null,
    until: Number(url.searchParams.get('until')) || null };
  const rows = allLedgers(store, filters.project, (ledger, db) => many(db, active
    ? 'SELECT * FROM v_op_history WHERE dispatched_at IS NOT NULL AND settled_at IS NULL ORDER BY attempt_id DESC'
    : 'SELECT * FROM v_op_history ORDER BY attempt_id DESC').map(row => attemptRow(row, ledger.name)));
  return rows.filter(row => (!filters.wf || row.wf === filters.wf) && (!filters.unit || row.unit === filters.unit)
    && (!filters.op || row.op === filters.op) && (!filters.agent || row.agent === filters.agent)
    && (!filters.model || row.model === filters.model) && (!filters.verdict || row.verdict === filters.verdict)
    && (!filters.outcome || row.reportOutcome === filters.outcome) && (!filters.failureClass || row.failureClass === filters.failureClass)
    && (!filters.endState || row.endState === filters.endState) && (!filters.ui || row.ui === filters.ui)
    && (!filters.since || row.dispatchedAt >= filters.since) && (!filters.until || row.dispatchedAt <= filters.until))
    .sort((a, b) => (b.dispatchedAt ?? 0) - (a.dispatchedAt ?? 0) || b.id - a.id);
}
function listedMedia(store, url) {
  const project = url.searchParams.get('project'), wf = url.searchParams.get('wf'), job = url.searchParams.get('job');
  const attempt = Number(url.searchParams.get('attempt')) || null, role = url.searchParams.get('role');
  const scopeRef = url.searchParams.get('scopeRef'), round = Number(url.searchParams.get('round')) || null;
  const q = url.searchParams.get('q')?.toLowerCase();
  return allLedgers(store, project, (ledger, db) => many(db, 'SELECT * FROM v_media ORDER BY created_at DESC,artifact_id DESC').map(item => mediaItem(item, ledger.name)))
    .filter(item => (!wf || item.wf === wf) && (!job || item.job === job) && (!attempt || item.attempt === attempt)
      && (!role || item.role === role) && (!scopeRef || item.scopeRef === scopeRef) && (!round || item.round === round)
      && (!q || `${item.name} ${item.label ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt || b.artifactId - a.artifactId);
}
const quantile = (values, ratio) => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))] : null;
function metricsOps(store, url) {
  const project = url.searchParams.get('project');
  const since = Date.now() - (url.searchParams.get('window') === '24h' ? DAY : 7 * DAY);
  const rows = allLedgers(store, project, (_ledger, db) => many(db, 'SELECT * FROM v_op_history WHERE dispatched_at>=?', since));
  const buckets = new Map();
  for (const row of rows) {
    const key = `${row.op_id}\u0000${row.agent}\u0000${row.model}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.values()].map(group => {
    const cycles = group.map(x => x.cycle_ms).filter(Number.isFinite).sort((a, b) => a - b);
    const queues = group.map(x => x.dispatched_at != null && x.routed_at != null ? x.dispatched_at - x.routed_at : null).filter(Number.isFinite).sort((a, b) => a - b);
    const failures = new Map(); for (const x of group) if (x.failure_class) failures.set(x.failure_class, (failures.get(x.failure_class) ?? 0) + 1);
    return { op: group[0].op_id, agent: group[0].agent, model: group[0].model,
      attempts: group.length, pass: group.filter(x => x.verdict === 'pass').length,
      fail: group.filter(x => x.verdict === 'fail').length, blocked: group.filter(x => x.verdict === 'blocked').length,
      workerDead: group.filter(x => x.end_state === 'worker-dead').length,
      passRate: group.filter(x => x.verdict != null).length ? group.filter(x => x.verdict === 'pass').length / group.filter(x => x.verdict != null).length : null,
      p50CycleMs: quantile(cycles, 0.5), p90QueueMs: quantile(queues, 0.9),
      topFailure: [...failures].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([failureClass, count]) => ({ class: failureClass, n: count })),
      tokensIn: group.reduce((sum, x) => sum + (x.tokens_in ?? 0), 0), tokensOut: group.reduce((sum, x) => sum + (x.tokens_out ?? 0), 0),
      costUsd: group.some(x => x.cost_usd != null) ? group.reduce((sum, x) => sum + (x.cost_usd ?? 0), 0) : null };
  });
}

/** Domain routes for dispatch, attempt, report, checks, verdict, and product land. */
export async function handleAttempt(request, response, store, url) {
  const pathname = url.pathname;
  if (!store.machine) {
    if (pathname.startsWith('/api/attempts') || pathname === '/api/media' || pathname === '/api/metrics/ops') {
      sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true;
    }
    return false;
  }
  if (pathname === '/api/attempts') {
    const result = page(listedAttempts(store, url), url);
    sendJson(request, response, result.rows, { sources: store.projects().flatMap(ledger => source(ledger.name, 'v_op_history')), stale: staleOf(store), next: result.next }); return true;
  }
  if (pathname === '/api/media') {
    const result = page(listedMedia(store, url), url);
    sendJson(request, response, result.rows, { sources: store.projects().flatMap(ledger => source(ledger.name, 'v_media')), stale: staleOf(store), next: result.next }); return true;
  }
  if (pathname === '/api/metrics/ops') {
    sendJson(request, response, metricsOps(store, url), { sources: store.projects().flatMap(ledger => source(ledger.name, 'v_model_scorecard', 'v_op_history')), stale: staleOf(store) }); return true;
  }
  const match = /^\/api\/attempts\/([^/]+)\/(\d+)(?:\/(checks\/(\d+)|diff|transcript(?:\/snapshots)?))?$/.exec(pathname);
  if (!match) return false;
  let project;
  try { project = decodeURIComponent(match[1]); } catch { sendError(request, response, 400, 'BAD_PATH', 'Invalid project encoding'); return true; }
  const target = store.ledger(project);
  if (!target) { sendError(request, response, 404, 'NOT_FOUND', 'Project not found'); return true; }
  const { row: ledger, db } = target;
  const id = Number(match[2]);
  const row = one(db, 'SELECT * FROM v_op_history WHERE attempt_id=?', id);
  if (!row) { sendError(request, response, 404, 'NOT_FOUND', 'Attempt not found'); return true; }
  const route = match[3] ?? 'detail';
  if (route === 'detail') {
    sendJson(request, response, attemptDetail(store, ledger, db, row), { sources: [
      ...source(ledger.name, 'v_op_history', 'op_attempts', 'jobs', 'contracts', 'reports', 'v_checks', 'v_media', 'job_artifacts', 'blobs', 'report_attachments', 'artifact_proofs', 'v_decision_rows', 'decisions', 'conditions', 'settle_tails', 'product_lands', 'llm_usage'),
      ...source('machine', 'terminals', 'worktrees', 'v_engine_actions', 'action_steps', 'sup_learning')], stale: staleOf(store) }); return true;
  }
  if (route.startsWith('checks/')) {
    const check = one(db, 'SELECT * FROM v_checks WHERE check_id=? AND attempt_id=?', Number(match[4]), id);
    if (!check) { sendError(request, response, 404, 'NOT_FOUND', 'Check not found'); return true; }
    const root = one(db, 'SELECT repo_root FROM op_attempts WHERE attempt_id=?', id)?.repo_root;
    sendJson(request, response, { ...checkRow(db, check, root), stdoutTail: tail(db, check.stdout_sha), stderrTail: tail(db, check.stderr_sha) },
      { sources: source(ledger.name, 'v_checks', 'blobs'), stale: staleOf(store) }); return true;
  }
  if (route === 'diff') {
    const artifact = one(db, "SELECT * FROM job_artifacts WHERE attempt_id=? AND role='diff' AND subkind='patch-json' ORDER BY artifact_id DESC LIMIT 1", id);
    let diff = null;
    if (artifact) { try { diff = parse(getBlob(artifact.sha256).toString('utf8')); } catch { /* missing archived blob */ } }
    if (diff && Array.isArray(diff.files)) {
      const assets = new Map(many(db, "SELECT name,sha256 FROM job_artifacts WHERE attempt_id=? AND role='diff' AND name LIKE 'patch.assets/%'", id)
        .map(item => [item.name, item.sha256]));
      diff = { ...diff, files: diff.files.map(file => {
        const resolveSide = side => {
          if (!side) return null;
          const assetName = typeof side.asset === 'string' ? `patch.assets/${path.posix.basename(side.asset.replaceAll('\\', '/'))}` : null;
          const sha = assetName ? assets.get(assetName) : /^[a-f0-9]{64}$/i.test(side.blob ?? '') ? side.blob : null;
          return sha ? blobLink(db, sha) : null;
        };
        return { ...file, before: resolveSide(file.before), after: resolveSide(file.after) };
      }) };
    }
    sendJson(request, response, diff, { sources: source(ledger.name, 'job_artifacts', 'blobs'), stale: staleOf(store) }); return true;
  }
  if (route === 'transcript/snapshots') {
    const snapshots = many(db, 'SELECT * FROM attempt_transcript_snapshots WHERE attempt_id=? ORDER BY at DESC,snapshot_id DESC', id)
      .map(s => ({ id: s.snapshot_id, at: s.at, lines: s.lines, bytes: s.bytes, blob: blobLink(db, s.sha256) }));
    sendJson(request, response, snapshots, { sources: source(ledger.name, 'attempt_transcript_snapshots', 'blobs'), stale: staleOf(store) }); return true;
  }
  if (route === 'transcript') {
    const raw = one(db, 'SELECT transcript_sha,settled_at FROM op_attempts WHERE attempt_id=?', id);
    const requested = url.searchParams.get('snapshot');
    const snapshot = requested ? one(db, 'SELECT * FROM attempt_transcript_snapshots WHERE attempt_id=? AND snapshot_id=?', id, Number(requested))
      : one(db, 'SELECT * FROM attempt_transcript_snapshots WHERE attempt_id=? ORDER BY at DESC,snapshot_id DESC LIMIT 1', id);
    const final = !requested && Boolean(raw.transcript_sha);
    const sha = final ? raw.transcript_sha : snapshot?.sha256;
    if (!sha) { sendError(request, response, 404, 'TRANSCRIPT_MISSING', 'Transcript unavailable'); return true; }
    const blob = one(db, 'SELECT * FROM blobs WHERE sha256=?', sha);
    if (!blob) { sendError(request, response, 404, 'TRANSCRIPT_MISSING', 'Transcript blob unavailable'); return true; }
    let text;
    try { text = getBlob(sha).toString('utf8'); } catch { sendError(request, response, 410, 'TRANSCRIPT_ARCHIVED', 'Transcript bytes unavailable'); return true; }
    if (blob.redaction !== 'v1') text = redactText(text);
    let window;
    try { window = await transcriptWindow(text, { q: url.searchParams.get('q'), around: url.searchParams.get('around'),
      from: url.searchParams.get('from'), to: url.searchParams.get('to') }); }
    catch (error) { sendError(request, response, 400, error.code ?? 'BAD_REGEX', error.message); return true; }
    sendJson(request, response, { final, snapshotId: final ? null : snapshot.snapshot_id,
      at: final ? raw.settled_at ?? snapshot?.at ?? Date.now() : snapshot.at,
      totalLines: window.totalLines, bytes: blob.bytes, blob: blobLink(db, sha), redaction: blob.redaction ?? 'stream-v1',
      lines: window.lines, hits: window.hits, hitCount: window.hitCount },
    { sources: source(ledger.name, 'op_attempts', 'attempt_transcript_snapshots', 'blobs'), stale: staleOf(store) }); return true;
  }
  return false;
}
