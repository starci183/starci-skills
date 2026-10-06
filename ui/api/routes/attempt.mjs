import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { artifactRoot, blobPath, getBlob } from '../../../engine/db/blob.mjs';
import { decodeText, textEncodingOf, publicText, publicJson } from '../redact-read.mjs';
import { attemptProducts } from '../products.mjs';
import { usageDetail, usageSince, mergeUsage } from './work.mjs';
import { redactText } from '../../../scripts/lib/redact.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { transcriptWindow } from '../transcript-search.mjs';
import { sendJson, sendError } from '../envelope.mjs';
import { source, many, one, parse, staleOf, page } from '../query.mjs';
import { whyFor } from '../why.mjs';
import { admissionObserved, attemptAdmission } from '../admission-read.mjs';
import { attemptRow, checkKey, checkObservation, checkPairsOf, dispatchCapture, currentInputOf } from '../attempt-read.mjs';
import { workflowCheckpoint, workflowLand } from '../land-read.mjs';
import { actionRow } from '../action-read.mjs';

const DAY = 86_400_000;
const slaCatalogue = parseYaml(readFileSync(new URL('../../../modules/reconciler/sla.yaml', import.meta.url), 'utf8'));
const runtimeAllocation = parseYaml(readFileSync(new URL('../../../modules/models/runtimes.yaml', import.meta.url), 'utf8')).allocation;
function slaMs(code) {
  const entry = slaCatalogue.codes[code];
  if (!entry) return null;
  const keyed = entry.slaKey?.split('.').reduce((value, key) => value?.[key], runtimeAllocation);
  return (keyed ?? entry.slaMs ?? null) == null ? null : (keyed ?? entry.slaMs) + (entry.plusMs ?? 0);
}
// Owner ruling 2026-09-29: host paths, commands and cwd are public (secrets stay redacted).
const safePath = value => value ? String(value) : null;
function ref(kind, id, project = null) {
  const p = encodeURIComponent(project ?? '');
  const key = encodeURIComponent(String(id));
  const href = (kind === 'attempt' && `#/a/${p}/${key}`) || (kind === 'unit' && `#/w/${p}?tab=units&unit=${key}`)
    || (kind === 'di' && `#/decisions?id=${key}`) || (kind === 'workflow' && `#/w/${p}/${key}`) || '#/system';
  return { kind, ...(project ? { project } : {}), id: String(id), href };
}
function blobLink(db, sha) {
  if (!sha) return null;
  const row = one(db, 'SELECT sha256,bytes,media_type,archived_at FROM blobs WHERE sha256=?', sha);
  return row ? { sha: row.sha256, bytes: row.bytes, mediaType: row.media_type,
    href: `/api/blob/${row.sha256}`, archived: row.archived_at != null } : null;
}
function mediaItem(item, project) {
  return { artifactId: item.artifact_id, project, wf: item.workflow_id, job: item.job_id,
    attempt: item.attempt_id, role: item.role, kind: item.kind, subkind: item.subkind,
    name: item.name, label: item.label, scopeRef: item.scope_ref, round: item.round,
    blob: { sha: item.sha256, bytes: item.bytes, mediaType: item.media_type, href: item.http_path, archived: item.archived_at != null },
    createdAt: item.created_at };
}
function checkRow(db, check) {
  const result = { id: check.check_id, name: check.name, phase: check.phase, runner: check.runner, authority: check.authority,
    inputDigest: check.input_digest ?? null,
    runSeq: check.run_seq, command: check.command ?? null, cwd: safePath(check.cwd), exitCode: check.exit_code,
    declaredExitCode: check.declared_exit_code, status: check.status, ui: check.ui,
    startedAt: check.started_at, finishedAt: check.finished_at, wallMs: check.wall_ms,
    stdout: blobLink(db, check.stdout_sha), stderr: blobLink(db, check.stderr_sha), output: blobLink(db, check.output_sha),
    summary: parse(check.summary_json), attribution: parse(check.attribution_json), note: check.note };
  return { ...result, key: checkKey(result), observation: checkObservation(result) };
}
function tail(db, sha) {
  if (!sha || !blobLink(db, sha)) return null;
  try { return redactText(decodeText(getBlob(sha)).split(/\r?\n/).slice(-200).join('\n')); } catch { return null; }
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
    return { step, at, ...(max ? { slaMs: max, late: at != null && previous != null && at - previous > max } : {}) };
  });
}
const RUNTIME_ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');
const joinHost = (root, rel) => root && rel ? path.join(root, rel) : null;
const hostNorm = value => value ? path.normalize(String(value)) : null;
function whereOf(ledger, raw, job, capture) {
  const hierarchy = capture.dispatchContext?.hierarchy, runtime = hierarchy?.runtime ?? {};
  const repoRoot = raw.repo_root ?? null;
  return { repo: hostNorm(repoRoot), worktree: hostNorm(raw.worktree_path), mainCheckout: raw.worktree_path && repoRoot ? hostNorm(raw.worktree_path) === hostNorm(repoRoot) : null, branch: raw.branch,
    baseSha: raw.base_sha, headSha: raw.head_sha, integratedSha: raw.integrated_sha, worktreeRemovedAt: raw.worktree_removed_at,
    scopeSource: capture.ownedPaths == null ? 'unobserved' : 'contract',
    ownedPaths: (capture.ownedPaths ?? []).map(item => ({ rel: item.rel, abs: item.unresolved ? null : joinHost(item.root ?? raw.worktree_path ?? repoRoot, item.rel) })),
    ledgerFile: ledger.file ?? null, blobRoot: artifactRoot(), runtimeRoot: RUNTIME_ROOT,
    host: raw.host ?? runtime.host ?? null, agent: raw.agent ?? runtime.agent ?? null, provider: raw.provider ?? runtime.provider ?? null,
    profile: raw.model_profile ?? runtime.profile ?? null, pool: raw.pool ?? runtime.runtimePool ?? null,
    terminalHandle: raw.terminal_handle ?? runtime.terminalHandle ?? null, runId: raw.run_id ?? runtime.runId ?? null,
    taskId: raw.task_id ?? runtime.taskId ?? null, dispatchId: raw.dispatch_id ?? runtime.dispatchId ?? null,
    parentAgent: hierarchy?.parentNodeId ?? null, agentNode: hierarchy?.nodeId ?? null,
    traceSpan: raw.span_id ?? null, job: raw.job_id ?? null, jobStatus: job?.status ?? null, currentJobStatus: job?.status ?? null };
}
// Evidence files grouped by what they are, not by raw prefix. 'evidence' is the op's submitted
// evidence folder (attachments/evidence/).
function groupOf(name, role) {
  if (/^attachments\/evidence\//.test(name)) return 'evidence';
  if (/^checks\//.test(name) || role.startsWith('check-')) return 'check';
  if (role === 'patch' || role === 'diff') return 'diff';
  if (['screenshot', 'capture', 'render', 'video', 'uat-run', 'trace', 'dom', 'direction', 'redline'].includes(role)) return 'media';
  if (/^attachments\//.test(name) || role === 'report-attachment') return 'op-run';
  if (role === 'log') return 'log';
  return 'other';
}
function kindOf(name, mediaType) {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('video/')) return 'video';
  if (mediaType.startsWith('audio/')) return 'audio';
  if (mediaType === 'application/pdf') return 'pdf';
  if (mediaType.includes('json') || ext === 'json' || ext === 'jsonl') return 'json';
  if (mediaType.includes('yaml') || ext === 'yaml' || ext === 'yml') return 'yaml';
  if (mediaType.includes('markdown') || ext === 'md') return 'markdown';
  if (mediaType.includes('diff') || ext === 'diff' || ext === 'patch') return 'diff';
  if (mediaType.startsWith('text/') || ['stdout', 'stderr', 'log', 'txt'].includes(ext)) return 'text';
  return 'binary';
}
function encodingOf(sha, mediaType) {
  if (!/^(text\/|application\/(json|x-yaml|yaml|x-ndjson))/.test(mediaType)) return null;
  if (!blobPath(sha)) return null;
  try { return textEncodingOf(getBlob(sha).subarray(0, 4)); } catch { return null; }
}
const textBySha = new Map();
function blobText(sha, limit) {
  const key = `${sha}:${limit}`;
  if (textBySha.has(key)) return textBySha.get(key);
  let text = null;
  try { const bytes = getBlob(sha); if (bytes.length <= limit) text = decodeText(bytes); } catch { /* archived or missing blob */ }
  if (textBySha.size > 300) textBySha.delete(textBySha.keys().next().value);
  if (text != null) textBySha.set(key, text);
  return text;
}
const schemaBySha = new Map();
function jsonSchemaOf(sha) {
  if (schemaBySha.has(sha)) return schemaBySha.get(sha);
  const text = blobText(sha, 2 * 1024 * 1024);
  let schema = null;
  if (text) { const value = parse(text); if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.schema === 'string') schema = value.schema.slice(0, 120); }
  schemaBySha.set(sha, schema);
  return schema;
}
// attachments/evidence/manifest.yaml -> { outcome, assertions, assets, provenance } (null when absent or unreadable).
function manifestOf(artifactRows) {
  const item = artifactRows.find(x => /^attachments\/evidence\/manifest\.ya?ml$/.test(x.name));
  if (!item) return null;
  const base = { folder: path.posix.dirname(item.name), manifest: null,
    read: { state: 'unavailable', artifactId: item.artifact_id, sha: item.sha256 } };
  const text = blobText(item.sha256, 512 * 1024);
  if (text == null) return base;
  let doc;
  try { doc = parseYaml(publicText(text)); } catch { return { ...base, read: { ...base.read, state: 'invalid' } }; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ...base, read: { ...base.read, state: 'invalid' } };
  const outcomeOf = a => {
    if (a.outcome != null) return a.outcome;
    if (a.passed === true) return 'passed';
    if (a.passed === false) return 'failed';
    return null;
  };
  return { ...base, read: { ...base.read, state: 'ready' }, manifest: {
    outcome: doc.outcome ?? null,
    assertions: (Array.isArray(doc.assertions) ? doc.assertions : []).filter(a => a && typeof a === 'object')
      .map(a => ({ id: String(a.id ?? ''), outcome: outcomeOf(a), ...(a.detail != null ? { detail: String(a.detail) } : {}) })),
    assets: (Array.isArray(doc.assets) ? doc.assets : []).map(a => typeof a === 'string' ? a : a?.path).filter(a => typeof a === 'string'),
    provenance: publicJson(doc.provenance ?? null) } };
}
const VALIDATOR_SCHEMA = /validat|starci\/[a-z-]*report@/i;
function filesOf(db, artifactRows, checks, project, manifestInfo) {
  const firstBySha = new Map();
  const assetNames = manifestInfo?.manifest ? new Set(manifestInfo.manifest.assets.map(a => path.posix.normalize(`${manifestInfo.folder}/${a.replaceAll('\\', '/')}`))) : null;
  return artifactRows.map(x => {
    const group = groupOf(x.name, x.role);
    const checkName = group === 'check' ? (x.name.match(/^checks\/(?:\d+-)?([^/]+)\//)?.[1] ?? null) : null;
    const bound = checks.filter(check => [check.stdout?.sha, check.stderr?.sha, check.output?.sha].includes(x.sha256));
    const check = bound.length === 1 ? bound[0] : null;
    const blob = one(db, 'SELECT file_uri,redaction FROM blobs WHERE sha256=?', x.sha256);
    const kind = kindOf(x.name, x.media_type);
    const schema = kind === 'json' && x.bytes > 0 && x.bytes <= 2 * 1024 * 1024 && blobPath(x.sha256) ? jsonSchemaOf(x.sha256) : null;
    const first = firstBySha.get(x.sha256);
    if (first == null) firstBySha.set(x.sha256, x.artifact_id);
    const key = group === 'evidence' && (assetNames ? assetNames.has(path.posix.normalize(x.name))
      : x.bytes > 0 && (kind === 'markdown' || (kind === 'json' && !(schema && VALIDATOR_SCHEMA.test(schema)))));
    let checkInfo = null;
    if (check) checkInfo = { id: check.id, name: check.name, status: check.status, ui: check.ui, binding: 'sha', runner: check.runner, phase: check.phase, authority: check.authority };
    else if (checkName || bound.length) checkInfo = { id: null, name: checkName ?? bound[0].name, status: null, ui: 'unknown', binding: bound.length ? 'sha' : 'unbound', runner: null, phase: null, authority: null };
    return { artifactId: x.artifact_id, name: x.name, base: x.name.split('/').pop(), group, role: x.role, kind, subkind: x.subkind,
      mediaType: x.media_type, bytes: x.bytes, sha: x.sha256, href: `/api/blob/${x.sha256}`, hostPath: hostNorm(blob?.file_uri ?? blobPath(x.sha256)),
      encoding: encodingOf(x.sha256, x.media_type), redaction: blob?.redaction ?? null, origin: x.origin, label: x.label, scopeRef: x.scope_ref, round: x.round,
      check: checkInfo,
      archived: x.archived_at != null, createdAt: x.created_at, project,
      dupOf: first ?? null, empty: x.bytes === 0, key, schema };
  });
}
function priorOf(db, raw, project) {
  if (!raw.unit_id) return null;
  const row = one(db, 'SELECT * FROM v_op_history WHERE workflow_id=? AND unit_id=? AND attempt_id<? ORDER BY attempt_id DESC LIMIT 1', raw.workflow_id, raw.unit_id, raw.attempt_id);
  if (!row) return null;
  const settle = one(db, 'SELECT settle_json,next_step FROM op_attempts WHERE attempt_id=?', row.attempt_id);
  const reason = parse(settle?.settle_json);
  return { id: row.attempt_id, try: row.try_no, verdict: row.verdict, reportOutcome: row.report_outcome, ui: row.ui, why: whyFor(db, row), summary: row.report_summary == null ? null : publicText(String(row.report_summary)),
    settleReason: reason == null ? null : publicJson(reason), nextStep: settle?.next_step == null ? null : publicText(String(settle.next_step)),
    href: ref('attempt', row.attempt_id, project).href };
}
function attemptDetail(store, ledger, db, row) {
  const machine = store.machine.db;
  const raw = one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', row.attempt_id);
  const job = one(db, 'SELECT * FROM jobs WHERE job_id=?', row.job_id);
  const report = one(db, 'SELECT * FROM reports WHERE attempt_id=?', row.attempt_id);
  const payload = parse(job?.payload_json, {}) ?? {};
  const capture = dispatchCapture(db, row.attempt_id);
  const checks = many(db, 'SELECT * FROM v_checks WHERE attempt_id=? ORDER BY created_at,check_id', row.attempt_id).map(c => checkRow(db, c));
  const artifactRows = many(db, 'SELECT x.*,b.http_path,b.archived_at FROM job_artifacts x JOIN blobs b ON b.sha256=x.sha256 WHERE x.attempt_id=? ORDER BY x.created_at,x.artifact_id', row.attempt_id);
  const mediaRows = many(db, 'SELECT * FROM v_media WHERE attempt_id=? ORDER BY created_at,artifact_id', row.attempt_id).map(x => mediaItem(x, ledger.name));
  const mediaIds = new Set(mediaRows.map(x => x.artifactId));
  const nonMedia = artifactRows.filter(x => !mediaIds.has(x.artifact_id)).map(x => mediaItem(x, ledger.name));
  const actions = many(machine, 'SELECT * FROM v_engine_actions WHERE ledger_id=? AND workflow_id=? AND job_id=? ORDER BY started_at', ledger.ledgerId, row.workflow_id, row.job_id).map(x => actionRow(machine, x, { project: ledger.name, ref, blob: blobLink }));
  const decisions = many(db, "SELECT d.*,di.attempt_id AS di_attempt FROM decisions d LEFT JOIN decision_items di ON di.di_id=d.di_id AND di.workflow_id=d.workflow_id WHERE d.workflow_id=? AND ((d.subject_type='attempt' AND d.subject_id=?) OR (d.subject_type='job' AND d.subject_id=?) OR di.attempt_id=? OR di.job_id=?) ORDER BY d.decided_at DESC", row.workflow_id, String(row.attempt_id), row.job_id, row.attempt_id, row.job_id)
    .map(d => ({ id: d.decision_id, decider: d.decider, choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at,
      association: d.di_attempt === row.attempt_id || (d.subject_type === 'attempt' && d.subject_id === String(row.attempt_id)) ? 'attempt' : 'job' }));
  // The attempt's agent terminal is the ledger's own record of its dispatch (op_attempts); Orca accounts for the worker.
  const terminal = raw?.terminal_handle ? { handle: raw.terminal_handle, closed_at: raw.terminal_closed_at ?? null } : null;
  const snapshots = one(db, 'SELECT count(*) AS n,max(at) AS last_at FROM attempt_transcript_snapshots WHERE attempt_id=?', row.attempt_id);
  const transcript = raw.transcript_sha ?? one(db, 'SELECT sha256 FROM attempt_transcript_snapshots WHERE attempt_id=? ORDER BY at DESC,snapshot_id DESC LIMIT 1', row.attempt_id)?.sha256;
  const lessons = many(machine, 'SELECT * FROM sup_learning WHERE kind IN (\'lesson\',\'experiment\',\'experiment-result\') ORDER BY updated_at DESC')
    .filter(item => [item.source_ref, item.item_id, item.title, item.detail_json].some(value => value && [row.op_id, row.failure_class].filter(Boolean).some(key => String(value).includes(key))))
    .map(item => ({ id: item.item_id, title: item.title, state: item.state, landedSha: item.landed_sha }));
  const manifest = manifestOf(artifactRows);
  const previousJobAttempt = jobId => jobId ? one(db, 'SELECT attempt_id FROM op_attempts WHERE workflow_id=? AND job_id=? AND attempt_id<? ORDER BY dispatch_seq DESC,attempt_id DESC LIMIT 1', row.workflow_id, jobId, row.attempt_id) : null;
  const retryOf = previousJobAttempt(job?.retry_of), resumeOf = previousJobAttempt(job?.resume_of);
  const redispatchOf = previousJobAttempt(row.job_id);
  const next = one(db, 'SELECT attempt_id FROM op_attempts WHERE workflow_id=? AND attempt_id>? AND (job_id=? OR job_id IN (SELECT job_id FROM jobs WHERE workflow_id=? AND (retry_of=? OR resume_of=?))) ORDER BY attempt_id LIMIT 1', row.workflow_id, row.attempt_id, row.job_id, row.workflow_id, row.job_id, row.job_id);
  return { ...attemptRow(row, ledger.name, db, ledger.ledgerId), timeline: timeline(raw),
    requestedModel: raw.request_model ?? null, attestedAt: raw.attested_at ?? null,
    modelAuthority: raw.model != null && raw.attested_at != null ? 'attested' : 'unobserved',
    admission: attemptAdmission(db, machine, row.attempt_id),
    route: { by: raw.routed_by, chain: parse(raw.route_chain_json), rejected: parse(raw.route_rejected_json) },
    where: whereOf(ledger, raw, job, capture), input: capture.input, dispatchContext: capture.dispatchContext,
    currentInput: currentInputOf(payload, job), capturedGoal: capture.capturedGoal,
    files: filesOf(db, artifactRows, checks, ledger.name, manifest),
    manifest: manifest?.manifest ?? null, manifestRead: manifest?.read ?? { state: 'missing', artifactId: null, sha: null },
    prior: priorOf(db, raw, ledger.name), checkPairs: checkPairsOf(checks),
    usage: usageDetail(db, { attempt: row.attempt_id }),
    why: whyFor(db, row), usageSource: raw.usage_source ?? null, usageReason: raw.usage_reason == null ? null : publicText(String(raw.usage_reason)),
    tryBudget: row.unit_id ? one(db, 'SELECT try_budget FROM work_units WHERE workflow_id=? AND unit_id=?', row.workflow_id, row.unit_id)?.try_budget ?? null : null,
    checkpoint: workflowCheckpoint(db, raw), land: workflowLand(db, raw),
    report: report ? { id: report.report_id, outcome: report.outcome, json: parse(report.report_json),
      attachments: many(db, 'SELECT m.* FROM v_media m JOIN report_attachments ra ON ra.artifact_id=m.artifact_id WHERE ra.report_id=?', report.report_id).map(m => mediaItem(m, ledger.name)) } : null,
    checks, artifacts: mediaRows, nonMedia,
    settle: raw.settled_at ? { by: raw.settled_by, json: parse(raw.settle_json), decision: (raw.decision_id && ref('di', raw.decision_id, ledger.name)) || null, nextStep: raw.next_step } : null,
    lessons, decisions, actions, relatedScope: { actions: 'job', decisions: 'mixed', lessons: 'global-heuristic', logs: 'job' },
    terminal: terminal ? { handle: terminal.handle, live: terminal.closed_at == null,
      transcript: blobLink(db, transcript), snapshots: snapshots?.n ?? 0, lastSnapshotAt: snapshots?.last_at ?? null,
      href: `#/a/${encodeURIComponent(ledger.name)}/${row.attempt_id}?step=run` } : null,
    retry: { retryOf: retryOf ? ref('attempt', retryOf.attempt_id, ledger.name) : null,
      resumeOf: resumeOf ? ref('attempt', resumeOf.attempt_id, ledger.name) : null,
      redispatchOf: redispatchOf ? ref('attempt', redispatchOf.attempt_id, ledger.name) : null,
      class: job?.retry_class ?? null, next: next ? ref('attempt', next.attempt_id, ledger.name) : null },
  };
}
function allLedgers(store, project, fn) {
  return store.forEachLedger(({ row, db }) => project && row.name !== project && row.ledgerId !== project ? [] : fn(row, db))
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
    ? 'SELECT * FROM v_op_history WHERE dispatched_at IS NOT NULL AND settled_at IS NULL AND end_state IS NULL ORDER BY attempt_id DESC'
    : 'SELECT * FROM v_op_history ORDER BY attempt_id DESC').map(row => attemptRow(row, ledger.name, db, ledger.ledgerId)));
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
  const until = Date.now(), since = until - (url.searchParams.get('window') === '24h' ? DAY : 7 * DAY);
  const rows = allLedgers(store, project, (_ledger, db) => many(db, 'SELECT * FROM v_op_history WHERE dispatched_at>=? AND dispatched_at<=?', since, until));
  const buckets = new Map();
  for (const row of rows) {
    const key = `${row.op_id}\u0000${row.agent}\u0000${row.model}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.values()].map(group => {
    const settled = group.filter(row => ['pass', 'fail', 'partial', 'blocked'].includes(row.verdict));
    const measured = key => group.map(row => row[key]).filter(Number.isFinite);
    const sum = key => { const values = measured(key); return values.length ? values.reduce((total, value) => total + value, 0) : null; };
    const cycles = group.map(x => x.cycle_ms).filter(Number.isFinite).sort((a, b) => a - b);
    const queues = group.map(x => x.dispatched_at != null && x.routed_at != null ? x.dispatched_at - x.routed_at : null).filter(Number.isFinite).sort((a, b) => a - b);
    const failures = new Map(); for (const x of settled) if (x.verdict !== 'pass' && x.failure_class) failures.set(x.failure_class, (failures.get(x.failure_class) ?? 0) + 1);
    return { op: group[0].op_id, agent: group[0].agent, model: group[0].model,
      attempts: group.length, pass: group.filter(x => x.verdict === 'pass').length,
      fail: group.filter(x => x.verdict === 'fail').length, blocked: group.filter(x => x.verdict === 'blocked').length,
      workerDead: group.filter(x => x.end_state === 'worker-dead').length,
      settled: settled.length, passRate: settled.length ? settled.filter(x => x.verdict === 'pass').length / settled.length : null,
      cohort: { since, until, basis: 'dispatch' },
      p50CycleMs: quantile(cycles, 0.5), p90QueueMs: quantile(queues, 0.9),
      topFailure: [...failures].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([failureClass, count]) => ({ class: failureClass, n: count })),
      tokensIn: sum('tokens_in'), tokensOut: sum('tokens_out'), costUsd: sum('cost_usd'),
      usageCoverage: { rows: group.length, tokensIn: measured('tokens_in').length, tokensOut: measured('tokens_out').length,
        costUsd: measured('cost_usd').length, complete: ['tokens_in', 'tokens_out', 'cost_usd'].every(key => measured(key).length === group.length) } };
  });
}

/** Token usage in a window: per model, op, day (cost per day) and provider, merged across ledgers. Empty lists mean nothing recorded. */
function metricsUsage(store, url) {
  const project = url.searchParams.get('project');
  const win = url.searchParams.get('window') === '24h' ? '24h' : '7d';
  const parts = allLedgers(store, project, (_ledger, db) => [usageSince(db, Date.now() - (win === '24h' ? DAY : 7 * DAY))]);
  const merged = key => mergeUsage(parts.map(part => part[key]));
  const byDay = merged('byDay').sort((a, b) => String(a.k).localeCompare(String(b.k)));
  const rank = (a, b) => (b.input + b.output) - (a.input + a.output);
  return { window: win, recorded: parts.some(part => part.byModel.length > 0),
    byModel: merged('byModel').sort(rank), byOp: merged('byOp').sort(rank), byProvider: merged('byProvider').sort(rank),
    byDay, sources: [...new Set(parts.flatMap(part => part.sources))] };
}

/** Domain routes for dispatch, attempt, report, checks, verdict, and product land. */
export async function handleAttempt(request, response, store, url) {
  const pathname = url.pathname;
  if (!store.machine) {
    if (pathname.startsWith('/api/attempts') || pathname === '/api/media' || pathname === '/api/metrics/ops' || pathname === '/api/metrics/usage') {
      sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true;
    }
    return false;
  }
  if (pathname === '/api/attempts') {
    const result = page(listedAttempts(store, url), url);
    sendJson(request, response, result.rows, { sources: store.projects().flatMap(ledger => source(ledger.name, 'v_op_history', 'op_attempts', 'check_runs')), stale: staleOf(store), next: result.next }); return true;
  }
  if (pathname === '/api/media') {
    const result = page(listedMedia(store, url), url);
    sendJson(request, response, result.rows, { sources: store.projects().flatMap(ledger => source(ledger.name, 'v_media')), stale: staleOf(store), next: result.next }); return true;
  }
  if (pathname === '/api/metrics/usage') {
    sendJson(request, response, metricsUsage(store, url), { sources: store.projects().flatMap(ledger => source(ledger.name, 'llm_usage', 'op_attempts')), stale: staleOf(store) }); return true;
  }
  if (pathname === '/api/metrics/ops') {
    sendJson(request, response, metricsOps(store, url), { sources: store.projects().flatMap(ledger => source(ledger.name, 'v_op_history')), stale: staleOf(store) }); return true;
  }
  const match = /^\/api\/attempts\/([^/]+)\/(\d+)(?:\/(checks\/(\d+)|diff|products|transcript(?:\/snapshots)?))?$/.exec(pathname);
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
      ...source(ledger.name, 'v_op_history', 'op_attempts', 'jobs', 'contracts', 'reports', 'check_runs', 'v_checks', 'v_media', 'job_artifacts', 'blobs', 'report_attachments', 'decisions', 'decision_items', 'work_units', 'attempt_transcript_snapshots', 'events', 'llm_usage'),
      ...source('machine', 'v_engine_actions', 'action_steps', 'sup_learning'),
      ...source('runtime', 'modules/reconciler/sla.yaml', 'modules/models/runtimes.yaml', 'modules/kernel/failure-codes.yaml'),
      ...(admissionObserved(store.machine.db) ? source('machine', 'provider_reservations') : [])], stale: staleOf(store) }); return true;
  }
  if (route.startsWith('checks/')) {
    const check = one(db, 'SELECT * FROM v_checks WHERE check_id=? AND attempt_id=?', Number(match[4]), id);
    if (!check) { sendError(request, response, 404, 'NOT_FOUND', 'Check not found'); return true; }
    sendJson(request, response, { ...checkRow(db, check), stdoutTail: tail(db, check.stdout_sha), stderrTail: tail(db, check.stderr_sha) },
      { sources: source(ledger.name, 'v_checks', 'blobs'), stale: staleOf(store) }); return true;
  }
  if (route === 'products') {
    const raw = one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', id);
    const report = parse(one(db, 'SELECT report_json FROM reports WHERE attempt_id=?', id)?.report_json);
    const products = await attemptProducts(raw?.repo_root ?? null, report, { checkpoint: workflowCheckpoint(db, raw) });
    sendJson(request, response, products,
      { sources: [...source(ledger.name, 'op_attempts', 'reports', 'events'), ...(products.head ? [{ db: 'git', rel: `${products.repo ?? ''}@${products.head}` }] : [])], stale: staleOf(store) }); return true;
  }
  if (route === 'diff') {
    const artifact = one(db, "SELECT * FROM job_artifacts WHERE attempt_id=? AND role='diff' AND subkind='patch-json' ORDER BY artifact_id DESC LIMIT 1", id);
    let diff = null;
    if (artifact) {
      try { diff = parse(decodeText(getBlob(artifact.sha256))); }
      catch { sendError(request, response, 410, 'DIFF_UNAVAILABLE', 'Recorded diff bytes unavailable'); return true; }
      if (!diff || !Array.isArray(diff.files)) { sendError(request, response, 422, 'DIFF_INVALID', 'Recorded diff payload is invalid'); return true; }
    }
    if (diff && Array.isArray(diff.files)) {
      const assets = new Map(many(db, "SELECT name,sha256 FROM job_artifacts WHERE attempt_id=? AND role='diff' AND name LIKE 'patch.assets/%'", id)
        .map(item => [item.name, item.sha256]));
      const indexed = new Set(many(db, 'SELECT sha256 FROM job_artifacts WHERE attempt_id=?', id).map(item => item.sha256));
      diff = { ...diff, files: diff.files.map(file => {
        const resolveSide = side => {
          if (!side) return null;
          const assetName = typeof side.asset === 'string' ? `patch.assets/${path.posix.basename(side.asset.replaceAll('\\', '/'))}` : null;
          let sha = null;
          if (assetName) sha = assets.get(assetName);
          else if (indexed.has(side.blob)) sha = side.blob;
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
    try { text = decodeText(getBlob(sha)); } catch { sendError(request, response, 410, 'TRANSCRIPT_ARCHIVED', 'Transcript bytes unavailable'); return true; }
    if (blob.redaction !== 'v1') text = redactText(text);
    let window;
    try { window = await transcriptWindow(text, { q: url.searchParams.get('q'), around: url.searchParams.get('around'),
      from: url.searchParams.get('from'), to: url.searchParams.get('to') }); }
    catch (error) { sendError(request, response, 400, error.code ?? 'BAD_REGEX', error.message); return true; }
    let timeSource = 'snapshot';
    if (final) timeSource = blob.created_at == null ? null : 'blob';
    sendJson(request, response, { final, snapshotId: final ? null : snapshot.snapshot_id,
      at: final ? blob.created_at ?? null : snapshot.at, timeSource,
      totalLines: window.totalLines, bytes: blob.bytes, blob: blobLink(db, sha), redaction: blob.redaction ?? 'stream-v1',
      lines: window.lines, hits: window.hits, hitCount: window.hitCount },
    { sources: source(ledger.name, 'op_attempts', 'attempt_transcript_snapshots', 'blobs'), stale: staleOf(store) }); return true;
  }
  return false;
}
