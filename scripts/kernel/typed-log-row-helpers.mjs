import crypto from 'node:crypto';
import path from 'node:path';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { clipLine } from '../lib/clip.mjs';
import { shortHash } from '../lib/hash.mjs';

const DERIVED_ARTIFACT_ROWS_MAX = 300;
const PATHISH = /^(?:[a-z]:)?[\\/]?[\w.@-]+(?:[\\/][\w.@ -]+)+\.[a-z0-9]{1,8}$/i;
const intOr = (value) => (Number.isInteger(value) ? value : undefined);
const strOr = (value) => (typeof value === 'string' && value ? value : undefined);
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null));

export function typeOk(type, value) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'int': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'bool': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    default: return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
}

export function defaultLogLevel(kind, data = {}) {
  switch (kind) {
    case 'error': return 'error';
    case 'check.result': return data.pass === false ? 'error' : 'info';
    case 'test.result': return Number(data.failed) > 0 ? 'error' : 'info';
    case 'cmd.run': return Number(data.exit) !== 0 ? 'warn' : 'info';
    case 'step.end':
    case 'gc.collect': return data.ok === false ? 'warn' : 'info';
    case 'gc.summary': return Number(data.errors) > 0 ? 'warn' : 'info';
    case 'settle': return data.verdict === 'pass' ? 'info' : 'warn';
    case 'incident': return data.state === 'raised' ? 'warn' : 'info';
    case 'job.drop':
    case 'log.truncated':
    case 'ask':
    case 'warning': return 'warn';
    default: return 'info';
  }
}

export function normalizeLogRefs(refs, { maxItems, maxLength, redactPath }) {
  let values = [];
  if (Array.isArray(refs)) values = refs;
  else if (typeof refs === 'string') values = refs.split(',');
  return values.map((ref) => String(ref).trim()).filter(Boolean).slice(0, maxItems).map((ref) => redactPath(ref.slice(0, maxLength)));
}

export function fitPreparedLogData(data, maxBytes, clip, bytesOf, fitData) {
  if (clip) return fitData(data, maxBytes);
  if (bytesOf(data) <= maxBytes) return { data };
  return null;
}

export function numericExitCode(value) {
  if (Number.isInteger(value)) return value;
  if (Number.isInteger(Number(value)) && value !== null && value !== '') return Number(value);
  return -1;
}

function artifactLogKind(kind) {
  if (kind === 'image') return 'render';
  if (kind === 'video') return 'video';
  if (kind === 'trace') return 'trace';
  return null;
}

function artifactNoun(kind, translate) {
  switch (kind) {
    case 'render': return translate('Image');
    case 'video': return translate('Video');
    default: return translate('Trace');
  }
}

function eventContextOf(event, ctx) {
  const tr = translator(ownerLanguage());
  const payload = event.payload ?? (() => { try { return JSON.parse(event.payload_json || '{}') ?? {}; } catch { return {}; } })();
  const base = { at: event.created_at, workflowId: event.workflow_id, actor: 'runtime' };
  const src = (index = null) => `ev:${ctx.ledgerKey ?? 'l'}:${event.seq}${index == null ? '' : ':' + index}`;
  const jobId = event.entity_type === 'job' ? event.entity_id : (strOr(payload.jobId) ?? null);
  const job = jobId && ctx.jobOf ? ctx.jobOf(jobId) : null;
  const op = strOr(payload.op) ?? strOr(payload.opId) ?? job?.op_id ?? undefined;
  const attempt = intOr(payload.attempt) ?? intOr(job?.attempt);
  return { tr, payload, base, src, jobId, job, op, attempt, ctx, event };
}

function dispatchRow(state) {
  const { base, jobId, op, attempt, payload: p, src, tr } = state;
  return [{ ...base, jobId, kind: 'dispatch', src: src(), msg: tr('Dispatch {op}{try} to {model}{modelId}', {
    op: op ?? 'op', try: attempt ? tr(' (try {n})', { n: attempt }) : '', model: p.model ?? 'agent', modelId: p.modelId ? ` · ${p.modelId}` : '',
  }), data: compact({ op: op ?? 'op', attempt, model: strOr(p.model), modelId: strOr(p.modelId), effort: strOr(p.effort), dispatchId: strOr(p.dispatch) }) }];
}

function dispatchRejectedRow(state) {
  const { base, jobId, op, payload: p, src, tr } = state;
  const raw = String(p.error ?? '');
  const stage = /"failedStage"\s*:\s*"([^"]+)"/.exec(raw)?.[1];
  const lastError = /"lastError"\s*:\s*"([^"]+)"/.exec(raw)?.[1];
  const message = stage || lastError ? `${stage ?? '?'}: ${lastError ?? '?'}` : (clipLine(raw, 600) || 'dispatch rejected');
  const stepHint = p.step ? `step ${p.step}` : null;
  const providerHint = p.provider ? `provider ${p.provider}` : null;
  return [{ ...base, jobId, kind: 'error', level: 'error', src: src(),
    msg: tr('Dispatch of {op} failed at step {step}{err}', { op: op ?? 'op', step: p.step ?? '?', err: lastError ? ` (${lastError})` : '' }),
    data: compact({ code: 'dispatch-rejected', message, hint: [stepHint, providerHint].filter(Boolean).join(' · ') || undefined }) }];
}

function reportRow(state) {
  const { base, jobId, op, attempt, payload: p, src, tr } = state;
  return [{ ...base, jobId, kind: 'report', src: src(), msg: tr('The op filed its report: {outcome}', { outcome: p.outcome ?? '?' }),
    refs: strOr(p.report) ? [p.report] : [], data: compact({ outcome: String(p.outcome ?? 'unknown'), op, attempt, reportRef: strOr(p.report) }) }];
}

function checkRows(state) {
  const { base, jobId, ctx, event, src, tr } = state;
  const checks = jobId && ctx.checksOf ? ctx.checksOf({ jobId, attemptId: event.attempt_id ?? null }) : [];
  const results = checks.map((check, index) => {
    const pass = Number(check?.exitCode) === 0;
    return { ...base, actor: 'check', jobId, kind: 'check.result', src: src(index),
      msg: pass ? tr('Pass: {name}', { name: clipLine(check?.name ?? 'check', 120) }) : tr('Fail: {name}', { name: clipLine(check?.name ?? 'check', 120) }),
      data: compact({ name: String(check?.name ?? 'check'), pass, command: strOr(check?.command), exit: intOr(check?.exitCode), evidence: strOr(check?.evidence) && clipLine(check.evidence, 600) }) };
  });
  const commands = checks.flatMap((check, index) => {
    const cmd = strOr(check?.command);
    if (!cmd) return [];
    const evidence = strOr(check?.evidence);
    const evidenceRef = evidence && PATHISH.test(evidence.trim()) ? evidence.trim() : undefined;
    const exit = numericExitCode(check?.exitCode);
    const durationMs = check?.durationMs != null && Number.isFinite(Number(check.durationMs)) ? Number(check.durationMs) : undefined;
    const commandName = clipLine(check?.name ?? cmd, 100);
    const msg = exit === 0 ? tr('Ran {name} (exit {exit})', { name: commandName, exit }) : tr('Failed {name} (exit {exit})', { name: commandName, exit });
    return [{ ...base, actor: 'check', jobId, kind: 'cmd.run', src: `${src()}:cmd:${index}`, msg,
      refs: evidenceRef ? [evidenceRef] : [],
      data: compact({ cmd: clipLine(cmd, 1000), exit, durationMs, checkName: strOr(check?.name), evidenceRef, evidence: !evidenceRef && evidence ? clipLine(evidence, 400) : undefined }) }];
  });
  return [...results, ...commands];
}

function fileEditRow({ base, jobId, tr, ak, patchRef, patchJsonRef, file }) {
  const added = intOr(file.added), removed = intOr(file.removed);
  const statusLabel = ({ A: tr('Added'), D: tr('Deleted'), R: tr('Renamed'), M: tr('Modified') })[file.status] ?? tr('Modified');
  const changeSummary = added != null || removed != null ? ' (+' + (added ?? 0) + ' -' + (removed ?? 0) + ')' : '';
  const source = `ev:${ak}:f:${shortHash(jobId + '\n' + patchRef + '\n' + file.path, { n: 24 })}`;
  return { ...base, jobId, kind: 'file.edit', src: source,
    msg: `${statusLabel} ${clipLine(file.path, 160)}` + changeSummary, refs: [patchJsonRef],
    data: compact({ path: file.path, added, removed, status: strOr(file.status), oldPath: strOr(file.oldPath), binary: file.binary === true ? true : undefined, image: file.image === true ? true : undefined, diffRef: `${patchJsonRef}#${file.path}` }) };
}

function mediaRows({ base, jobId, ctx, payload: p, tr, ak }) {
  const rows = [];
  let media = 0;
  for (const artifact of (Array.isArray(p.artifacts) ? p.artifacts : [])) {
    if (media >= DERIVED_ARTIFACT_ROWS_MAX) break;
    if (typeof artifact?.path !== 'string') continue;
    const kind = strOr(artifact.kind);
    const logKind = artifactLogKind(kind);
    if (!logKind) continue;
    media += 1;
    const subkind = strOr(artifact.subkind);
    const noun = artifactNoun(logKind, tr);
    const source = `ev:${ak}:a:${shortHash(jobId + '\n' + artifact.path + '\n' + (artifact.sha256 ?? ''), { n: 24 })}`;
    rows.push({ ...base, jobId, kind: logKind, src: source,
      msg: `${noun}${subkind ? ' ' + subkind : ''}: ${clipLine(artifact.path.split('/').pop(), 160)}`, refs: [artifact.path],
      data: compact({ artifactRef: artifact.path, subkind, sha256: strOr(artifact.sha256) }) });
  }
  return rows;
}

function artifactRows(state) {
  const { base, jobId, ctx, payload: p, tr } = state;
  const ak = ctx.ledgerKey ?? 'l';
  const patchRef = strOr(p.patch?.path);
  const patchDoc = patchRef && ctx.patchJsonOf ? ctx.patchJsonOf(patchRef) : null;
  const patchJsonRef = patchRef ? `${patchRef}.json` : null;
  const files = (Array.isArray(patchDoc?.files) ? patchDoc.files : []).slice(0, DERIVED_ARTIFACT_ROWS_MAX);
  const rows = [];
  for (const file of files) {
    if (typeof file?.path !== 'string' || !file.path) continue;
    rows.push(fileEditRow({ base, jobId, tr, ak, patchRef, patchJsonRef, file }));
  }
  rows.push(...mediaRows({ base, jobId, ctx, payload: p, tr, ak }));
  return rows;
}

function settlementRows(state) {
  const { base, jobId, job, payload: p, src, tr } = state;
  const evidence = p.checkEvidence ?? {};
  const rows = [{ ...base, jobId, kind: 'settle', src: src(0),
    msg: tr('Kernel settled the verdict {verdict}{ev}', { verdict: p.verdict ?? '?', ev: evidence.observed != null ? tr(' · {passed}/{observed} checks passed', { passed: evidence.passed ?? 0, observed: evidence.observed }) : '' }),
    data: compact({ verdict: String(p.verdict ?? 'unknown'), status: strOr(p.status), observed: intOr(evidence.observed), passed: intOr(evidence.passed), failed: intOr(evidence.failed), leasesReleased: intOr(p.leasesReleased) }) }];
  let result = null;
  try { result = JSON.parse(job?.result_json ?? 'null'); } catch { result = null; }
  const landed = result?.landed;
  const head = typeof landed === 'string' ? landed : strOr(landed?.head);
  if (p.verdict === 'pass' && head) {
    const paths = (Array.isArray(landed?.repos) ? landed.repos : []).flatMap((repo) => (Array.isArray(repo?.paths) ? repo.paths : [])).slice(0, 20);
    const repoLabel = landed?.repo ? tr(' into {repo}', { repo: path.basename(String(landed.repo)) }) : '';
    rows.push({ ...base, actor: 'land', jobId, kind: 'land', src: src(1), msg: tr('Landed {head}{repo}', { head: head.slice(0, 10), repo: repoLabel }),
      refs: [`commit:${head}`], data: compact({ head, repo: strOr(landed?.repo), headCheck: strOr(landed?.headCheck), paths: paths.length ? paths : undefined }) });
  }
  return rows;
}

function incidentRow(state, raised) {
  const { base, event, src, payload: p, tr } = state;
  const holds = Array.isArray(p.holds) ? p.holds.filter((hold) => typeof hold === 'string') : [];
  const heldJob = holds.find((hold) => hold.startsWith('op-')) ?? null;
  const kindLabel = p.kind ? ` ${p.kind}` : '';
  const detail = clipLine(p.detail, 200);
  const msg = raised ? tr('Incident{kind}: {detail}', { kind: kindLabel, detail }) : tr('Incident cleared{kind}: {detail}', { kind: kindLabel, detail });
  return [{ ...base, jobId: heldJob, kind: 'incident', src: src(), msg,
    data: compact({ id: event.entity_id, state: raised ? 'raised' : 'resolved', kind: strOr(p.kind), detail: strOr(p.detail) && clipLine(p.detail, 800), holds: holds.length ? holds.slice(0, 20) : undefined }) }];
}

function rowsForEventKind(state, event) {
  const { base, jobId, op, attempt, payload: p, src, tr } = state;
  switch (event.kind) {
    case 'op-dispatched': return dispatchRow(state);
    case 'dispatch-rejected': return dispatchRejectedRow(state);
    case 'report-filed': return reportRow(state);
    case 'checks-recorded': return checkRows(state);
    case 'artifacts-indexed': return artifactRows(state);
    case 'op-settled': return settlementRows(state);
    case 'incident-raised': return incidentRow(state, true);
    case 'incident-resolved':
    case 'incident-auto-resolved': return incidentRow(state, false);
    case 'worker-failed-no-report':
      return [{ ...base, jobId, kind: 'error', level: 'error', src: src(), msg: tr('The op stopped without filing a report ({liveness})', { liveness: p.liveness ?? '?' }),
        data: compact({ code: 'worker-failed-no-report', message: `liveness ${p.liveness ?? '?'}, effect ${p.effectState ?? '?'}`, hint: Array.isArray(p.evidence) ? clipLine(p.evidence.join(', '), 400) : undefined }) }];
    case 'job-dropped':
      return [{ ...base, jobId, kind: 'job.drop', src: src(), msg: tr('Job dropped: {reason}', { reason: clipLine(p.reason, 200) }), data: compact({ reason: clipLine(p.reason ?? 'dropped', 600), op, attempt }) }];
    case 'op-rev-drift':
      return [{ ...base, jobId, kind: 'warning', level: 'warn', src: src(), msg: tr('The contract of op {op} changed after dispatch ({from} → {to})', { op: op ?? '-', from: String(p.from ?? '').slice(0, 12), to: String(p.to ?? '').slice(0, 12) }),
        data: compact({ code: 'op-rev-drift', message: clipLine(`contract files changed after dispatch: ${(Array.isArray(p.files) ? p.files : []).join(', ')}`, 600) }) }];
    case 'foundation-landed':
      return [{ ...base, actor: 'land', jobId: null, kind: 'land', src: src(), msg: tr('Foundation {name} landed {version}', { name: p.name ?? event.entity_id, version: p.version ?? '' }).trim(),
        refs: Array.isArray(p.refs) ? p.refs.filter((ref) => typeof ref === 'string').slice(0, 10) : [], data: compact({ head: String(p.version ?? p.name ?? event.entity_id), repo: undefined }) }];
    default: return [];
  }
}

export function rowsOfEvent(event, ctx = {}) {
  return rowsForEventKind(eventContextOf(event, ctx), event);
}

export function scratchLogSource(jobId, at, body) {
  const hash = crypto.createHash('sha256').update(`${jobId}\n${at}\n${body}`).digest('hex').slice(0, 40);
  return `jl:${hash}`;
}

export function syncDerivedLogBatches({ logs, eventsAfter, batch, maxBatches, dryRun, cursorName, cursor, eventKinds, ctx, rowsOfEvent, prepareLogRow, insertLogRows }) {
  const out = { events: 0, rows: 0, inserted: 0, duplicate: 0, invalid: 0, cursor };
  let nextCursor = cursor;
  for (let n = 0; n < maxBatches; n++) {
    const events = eventsAfter.all(nextCursor, ...eventKinds, batch);
    if (!events.length) break;
    const rows = [];
    for (const event of events) {
      for (const raw of rowsOfEvent(event, ctx)) {
        const prepared = prepareLogRow(raw);
        if (prepared.error) { out.invalid += 1; continue; }
        rows.push(prepared.row);
      }
    }
    out.events += events.length;
    out.rows += rows.length;
    const last = events.at(-1).seq;
    if (dryRun) {
      out.inserted += rows.filter((row) => !logs.db.prepare('SELECT 1 FROM logs WHERE src=?').get(row.src)).length;
      nextCursor = last;
      continue;
    }
    const result = insertLogRows(logs, rows, { cursors: [{ name: cursorName, value: last, mode: 'max' }] });
    out.inserted += result.inserted;
    out.duplicate += result.duplicate;
    nextCursor = last;
    if (events.length < batch) break;
  }
  out.cursor = nextCursor;
  return out;
}
