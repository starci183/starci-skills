// typed-logs.mjs — logs as typed rows, not scraped terminal text. One SQLite file per product repository,
// <repo>/.starciwork/logs.sqlite (runtime custody beside runtime.sqlite, never Work), kept apart from the ledger
// so twenty ops logging at once never wait on the ledger's write lock and the ledger never waits on them.
//
//   logs(seq, at, workflow_id, job_id?, actor, node_id?, level, kind, msg, data_json, refs_json, src?)
//
// Append-only: triggers refuse UPDATE and DELETE, and nothing in housekeeping removes the file
// (scripts/lib/artifact-hold.mjs holds it). Rows come from four writers:
//   - `api log` (scripts/kernel/api.mjs cmdLog): a Kernel or an op logs one typed row, no ledger write;
//   - the per-job sidecar <job dir>/log.jsonl an op may append to directly: ingestSidecar reads it from the
//     byte offset it last reached, keyed by line hash + offset, so a re-read inserts nothing twice and a
//     crashed worker's lines still land (settle ingests; every read of the workflow's logs ingests too);
//   - the ledger's own events (syncDerivedLogs): dispatch, report, checks, settle, land, incident rows are
//     DERIVED from the events that already record them (rowsOfEvent), never re-written by the code paths
//     that append those events; a cursor per ledger keeps it incremental and `src` keeps it idempotent;
//   - the per-job cap: past allocation.logs.perJobCap (modules/models/runtimes.yaml, default 2000) rows a
//     job's own writes stop and one final `log.truncated` row says so. Derived rows are never capped.
// Every string is redacted at write (redactText/redactData): the push secret scan's own patterns
// (scripts/lib/secret-patterns.mjs, shared with scripts/supervisor/push-mains.mjs) plus OTPs, bearer tokens and
// secret-named keys. A value is blanked, its key kept.
//
//   node scripts/kernel/typed-logs.mjs sync --repo <repo> [--workflow <id>] [--apply] [--json]
//       derive rows from the ledger's events and ingest every job sidecar; a dry run (the default) counts
//       what it would insert and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { allocationSettings } from '../../engine/config.mjs';
import { FORBIDDEN_FILES, SECRET_PATTERNS } from '../lib/secret-patterns.mjs';

const require = createRequire(import.meta.url);
export const LOGS_SCHEMA = 'starci/logs-db@1';
export const LOGS_VERSION = 1;
export const LOG_ACTORS = Object.freeze(['kernel', 'op', 'runtime', 'check', 'land']);
export const LOG_LEVELS = Object.freeze(['info', 'warn', 'error']);
export const LOG_TRUNCATED = 'log.truncated';
const MSG_MAX = 300;
const REFS_MAX = 20;
const REF_MAX = 500;
const DEFAULTS = { perJobCap: 2000, dataMaxBytes: 4096 };

/** allocation.logs (modules/models/runtimes.yaml) with its defaults: {perJobCap, dataMaxBytes}. */
export function logSettings() {
  const raw = allocationSettings()?.logs ?? {};
  const positive = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return { perJobCap: positive(raw.perJobCap, DEFAULTS.perJobCap), dataMaxBytes: positive(raw.dataMaxBytes, DEFAULTS.dataMaxBytes) };
}

export const logsFileFor = (repo) => path.join(path.resolve(repo), '.starciwork', 'logs.sqlite');
export const jobLogDirOf = (repo, workflowId, jobId) => path.join(path.resolve(repo), '.starciwork', 'kernel-evidence', workflowId, 'jobs', jobId);
export const sidecarFileOf = (repo, workflowId, jobId) => path.join(jobLogDirOf(repo, workflowId, jobId), 'log.jsonl');

// ---------------------------------------------------------------------------------------------- kinds
// Each kind names its data fields: required and optional, by type. Extra fields are kept (they count against
// dataMaxBytes); a wrong type or a missing required field refuses the row.
const S = 'string', I = 'int', N = 'number', B = 'bool', A = 'array', O = 'object';
export const LOG_KINDS = Object.freeze({
  'step.start': { req: { name: S }, opt: {} },
  'step.end': { req: { name: S }, opt: { durationMs: N, ok: B } },
  'cmd.run': { req: { cmd: S, exit: I }, opt: { durationMs: N, stdoutRef: S, stderrRef: S, cwd: S, output: S } },
  'file.edit': { req: { path: S }, opt: { added: I, removed: I, diffRef: S, oldPath: S } },
  'check.result': { req: { name: S, pass: B }, opt: { evidenceRef: S, command: S, exit: I, evidence: S } },
  'test.result': { req: { suite: S, passed: I, failed: I }, opt: { skipped: I, durationMs: N, failures: A } },
  render: { req: { artifactRef: S }, opt: { label: S } },
  decision: { req: { markdown: S }, opt: {} },
  narration: { req: { markdown: S }, opt: {} },
  ask: { req: { question: S }, opt: { options: A } },
  error: { req: { code: S, message: S }, opt: { hint: S } },
  // Derived from ledger events (rowsOfEvent); a Kernel may write them too.
  dispatch: { req: { op: S }, opt: { attempt: I, model: S, modelId: S, effort: S, dispatchId: S } },
  report: { req: { outcome: S }, opt: { op: S, attempt: I, reportRef: S } },
  settle: { req: { verdict: S }, opt: { status: S, observed: I, passed: I, failed: I, leasesReleased: I } },
  land: { req: { head: S }, opt: { repo: S, headCheck: S, paths: A } },
  incident: { req: { id: S, state: S }, opt: { kind: S, detail: S, holds: A } },
  'job.drop': { req: { reason: S }, opt: { op: S, attempt: I } },
  [LOG_TRUNCATED]: { req: { cap: I }, opt: {} },
});

const typeOk = (type, v) => (type === S ? typeof v === 'string'
  : type === I ? Number.isInteger(v)
    : type === N ? typeof v === 'number' && Number.isFinite(v)
      : type === B ? typeof v === 'boolean'
        : type === A ? Array.isArray(v)
          : v && typeof v === 'object' && !Array.isArray(v));

/** The shape findings of `data` for `kind`: [] when it fits. */
export function validateLogData(kind, data) {
  const spec = LOG_KINDS[kind];
  if (!spec) return [`kind '${kind}' is not a log kind (${Object.keys(LOG_KINDS).join('|')})`];
  if (data != null && (typeof data !== 'object' || Array.isArray(data))) return ['data must be a JSON object'];
  const d = data ?? {};
  const out = [];
  for (const [k, t] of Object.entries(spec.req)) if (d[k] === undefined || d[k] === null) out.push(`data.${k} is required`); else if (!typeOk(t, d[k])) out.push(`data.${k} must be ${t}`);
  for (const [k, t] of Object.entries(spec.opt)) if (d[k] !== undefined && d[k] !== null && !typeOk(t, d[k])) out.push(`data.${k} must be ${t}`);
  if (kind === 'test.result' && Array.isArray(d.failures) && d.failures.some((f) => !f || typeof f !== 'object' || typeof f.name !== 'string')) out.push('data.failures[] must be {name, message?, file?}');
  return out;
}

/** The level a row gets when its writer names none: failures read as errors or warnings. */
export function defaultLevel(kind, data = {}) {
  if (kind === 'error') return 'error';
  if (kind === 'check.result') return data.pass === false ? 'error' : 'info';
  if (kind === 'test.result') return Number(data.failed) > 0 ? 'error' : 'info';
  if (kind === 'cmd.run') return Number(data.exit) !== 0 ? 'warn' : 'info';
  if (kind === 'step.end') return data.ok === false ? 'warn' : 'info';
  if (kind === 'settle') return data.verdict === 'pass' ? 'info' : 'warn';
  if (kind === 'incident') return data.state === 'raised' ? 'warn' : 'info';
  if (kind === 'job.drop' || kind === LOG_TRUNCATED || kind === 'ask') return 'warn';
  return 'info';
}

// ------------------------------------------------------------------------------------------ redaction
const withGlobal = (re) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
const PATTERNS = SECRET_PATTERNS.map((rule) => ({ ...rule, g: withGlobal(rule.re) }));
const MARK = '[redacted]';
// Shapes the push scan has no reason to know (they never sit in a diff) but a log line does.
const EXTRA = [
  { name: 'auth-header', re: /\b(Bearer|Basic|Token)(\s+)[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: 'url-secret', re: /([?&#](?:access_token|refresh_token|id_token|token|key|api_key|apikey|secret|code|password|otp|sig|signature)=)([^&#\s"']+)/gi },
  { name: 'otp', re: /\b(otp|one[-_ ]?time[-_ ]?(?:code|password|pin)|verification[-_ ]?code|2fa[-_ ]?code|mã[ _-]?(?:otp|xác[ _-]?(?:thực|minh)))(\s*[:=]?\s*["']?)(\d{4,8})\b/giu },
  { name: 'keyed-secret', re: /\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|auth[_-]?token|session[_-]?token|private[_-]?key|otp|pin[_-]?code|cookie|set-cookie)(["']?\s*[:=]\s*["']?)((?!\[redacted)[^\s"',;&}]{3,})/gi },
];
/** Keys whose value is a secret whatever it looks like; the key stays, the value goes. */
export const SECRET_KEY = /^(?:password|passwd|pwd|pass|secret|otp|pin|pincode|pin_code|credential|credentials|authorization|cookie|cookies|set-cookie|private[_-]?key|client[_-]?secret|api[_-]?key|apikey|[a-z_-]*token|[a-z_-]*secret)$/i;

/** `text` with every secret value blanked; keys and surrounding words kept. */
export function redactText(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const rule of PATTERNS) {
    rule.g.lastIndex = 0;
    out = out.replace(rule.g, (match, value) => {
      if (rule.name === 'assigned-secret') return rule.placeholder?.test(value ?? '') ? match : match.replace(value, MARK);
      return `[redacted:${rule.name}]`;
    });
  }
  for (const rule of EXTRA) {
    rule.re.lastIndex = 0;
    out = out.replace(rule.re, (match, a, b, c) => (rule.name === 'url-secret' ? `${a}${MARK}` : `${a}${b}${MARK}`));
  }
  return out;
}

/** A path that is a secret by being one (an env file, a key file, .secrets/): blanked, its rule named. */
export function redactPath(p) {
  if (typeof p !== 'string') return p;
  const slashed = p.replace(/\\/g, '/');
  const rule = FORBIDDEN_FILES.find((r) => r.test(slashed));
  return rule ? `[redacted:${rule.name}]` : redactText(p);
}

/** A deep copy of `value` with secret-named keys blanked and every string redacted. */
export function redactData(value, key = null, depth = 0) {
  if (depth > 8) return '[depth]';
  if (key && SECRET_KEY.test(key) && value != null && typeof value !== 'object' && typeof value !== 'boolean') return MARK;
  if (typeof value === 'string') return /(?:path|ref|file)$/i.test(key ?? '') ? redactPath(value) : redactText(value);
  if (Array.isArray(value)) return value.map((v) => redactData(v, null, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactData(v, k, depth + 1)]));
  return value;
}

// ------------------------------------------------------------------------------------------- clipping
const bytesOf = (v) => Buffer.byteLength(JSON.stringify(v ?? {}), 'utf8');
const clipDeep = (value, strMax, arrMax, depth = 0) => {
  if (typeof value === 'string') return value.length > strMax ? `${value.slice(0, strMax)}…` : value;
  if (Array.isArray(value)) { const kept = value.slice(0, arrMax).map((v) => clipDeep(v, strMax, arrMax, depth + 1)); return value.length > arrMax ? [...kept, `…+${value.length - arrMax}`] : kept; }
  if (value && typeof value === 'object' && depth < 8) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clipDeep(v, strMax, arrMax, depth + 1)]));
  return value;
};
/** `data` fitted under `max` bytes by clipping long strings and arrays: {data, clipped}, or null when it cannot fit. */
export function fitData(data, max) {
  if (bytesOf(data) <= max) return { data, clipped: false };
  for (const [s, a] of [[1500, 60], [600, 25], [200, 10], [80, 5]]) {
    const next = { ...clipDeep(data, s, a), _clipped: true };
    if (bytesOf(next) <= max) return { data: next, clipped: true };
  }
  return null;
}

const refsOf = (refs) => (Array.isArray(refs) ? refs : typeof refs === 'string' ? refs.split(',') : [])
  .map((r) => String(r).trim()).filter(Boolean).slice(0, REFS_MAX).map((r) => redactPath(r.slice(0, REF_MAX)));

/**
 * One row validated, redacted and fitted: {row} or {error, code}. `row`: {at?, workflowId, jobId?, actor, nodeId?,
 * level?, kind, msg, data?, refs?, src?}. `clip` false refuses an oversized data object instead of clipping it.
 */
export function prepareLogRow(row, { dataMaxBytes = logSettings().dataMaxBytes, clip = true, now = Date.now() } = {}) {
  const fail = (code, error) => ({ code, error });
  if (typeof row?.workflowId !== 'string' || !row.workflowId.trim()) return fail('log-workflow-missing', 'a log row needs a workflow');
  if (!LOG_ACTORS.includes(row.actor)) return fail('log-actor-unknown', `actor must be ${LOG_ACTORS.join('|')}, got '${row.actor}'`);
  if (!LOG_KINDS[row.kind]) return fail('log-kind-unknown', `kind must be ${Object.keys(LOG_KINDS).join('|')}, got '${row.kind}'`);
  const data = row.data ?? {};
  const findings = validateLogData(row.kind, data);
  if (findings.length) return fail('log-data-invalid', `${row.kind}: ${findings.join('; ')}`);
  if (row.level != null && !LOG_LEVELS.includes(row.level)) return fail('log-level-unknown', `level must be ${LOG_LEVELS.join('|')}, got '${row.level}'`);
  const msgRaw = typeof row.msg === 'string' ? row.msg.trim() : '';
  if (!msgRaw) return fail('log-msg-missing', 'a log row needs a short msg');
  const redacted = redactData(data);
  const fitted = clip ? fitData(redacted, dataMaxBytes) : (bytesOf(redacted) <= dataMaxBytes ? { data: redacted } : null);
  if (!fitted) return fail('log-data-too-large', `data is over ${dataMaxBytes} bytes; put the bulk in a file and name it in --refs`);
  const at = Number.isFinite(Number(row.at)) && Number(row.at) > 0 ? Math.trunc(Number(row.at)) : now;
  const msg = redactText(msgRaw.replace(/\s+/g, ' '));
  return { row: {
    at, workflowId: row.workflowId, jobId: row.jobId || null, actor: row.actor, nodeId: row.nodeId || null,
    level: row.level ?? defaultLevel(row.kind, data), kind: row.kind, msg: msg.length > MSG_MAX ? `${msg.slice(0, MSG_MAX - 1)}…` : msg,
    data: fitted.data, refs: refsOf(row.refs), src: row.src ?? null,
  } };
}

// ------------------------------------------------------------------------------------------- storage
const SCHEMA = `
CREATE TABLE IF NOT EXISTS logs(
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  workflow_id TEXT NOT NULL,
  job_id TEXT,
  actor TEXT NOT NULL CHECK(actor IN ('kernel','op','runtime','check','land')),
  node_id TEXT,
  level TEXT NOT NULL CHECK(level IN ('info','warn','error')),
  kind TEXT NOT NULL,
  msg TEXT NOT NULL,
  data_json TEXT,
  refs_json TEXT,
  src TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS logs_workflow ON logs(workflow_id, seq);
CREATE INDEX IF NOT EXISTS logs_job ON logs(job_id, seq);
CREATE TABLE IF NOT EXISTS log_cursors(name TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS log_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS logs_append_only_update BEFORE UPDATE ON logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
CREATE TRIGGER IF NOT EXISTS logs_append_only_delete BEFORE DELETE ON logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
`;
const OPEN_RETRY_MS = [0, 300, 900];
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * The repository's logs database, created on first open: WAL, busy_timeout, synchronous NORMAL. An established
 * file is opened without a write (the schema runs only while user_version is below LOGS_VERSION).
 * Returns {db, file, transaction(fn), close()}.
 */
export function openLogs(repo, { file = logsFileFor(repo), busyTimeoutMs = 15000 } = {}) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let db, last;
  for (const delay of OPEN_RETRY_MS) {
    if (delay) sleepSync(delay);
    try { db = new DatabaseSync(file, { timeout: busyTimeoutMs }); last = null; break; }
    catch (error) { last = error; if (!/unable to open/i.test(String(error?.message))) throw error; }
  }
  if (!db) throw last;
  try {
    if (String(db.prepare('PRAGMA journal_mode').get().journal_mode).toLowerCase() !== 'wal') db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA synchronous=NORMAL');
    if (Number(db.prepare('PRAGMA user_version').get().user_version) < LOGS_VERSION) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(SCHEMA);
        db.prepare("INSERT OR IGNORE INTO log_meta(key,value) VALUES('schema',?)").run(LOGS_SCHEMA);
        db.exec(`PRAGMA user_version=${LOGS_VERSION}`);
        db.exec('COMMIT');
      } catch (error) { try { db.exec('ROLLBACK'); } catch { /* none open */ } throw error; }
    }
  } catch (error) { try { db.close(); } catch { /* closing */ } throw error; }
  let inside = false;
  const transaction = (fn) => {
    if (inside) return fn(db);
    inside = true;
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(db); db.exec('COMMIT'); return r; } catch (error) { try { db.exec('ROLLBACK'); } catch { /* none open */ } throw error; } finally { inside = false; }
  };
  return { db, file, transaction, close() { db.close(); } };
}

const cappedCount = (db, jobId) => Number(db.prepare(`SELECT count(*) n FROM logs WHERE job_id=? AND kind<>'${LOG_TRUNCATED}' AND (src IS NULL OR src NOT LIKE 'ev:%')`).get(jobId).n);

/**
 * Insert prepared rows (prepareLogRow's `row`) in ONE transaction. A job's own rows past `perJobCap` are dropped
 * and one `log.truncated` row is written the first time. A row whose `src` is already stored is a duplicate.
 * Returns {inserted, duplicate, dropped, seqs}.
 */
export function insertLogRows(logs, rows, { perJobCap = logSettings().perJobCap, now = Date.now() } = {}) {
  const out = { inserted: 0, duplicate: 0, dropped: 0, seqs: [] };
  if (!rows.length) return out;
  logs.transaction((db) => {
    const insert = db.prepare(`INSERT OR IGNORE INTO logs(at,workflow_id,job_id,actor,node_id,level,kind,msg,data_json,refs_json,src)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    const counts = new Map();
    const truncated = db.prepare(`SELECT 1 FROM logs WHERE job_id=? AND kind='${LOG_TRUNCATED}' LIMIT 1`);
    for (const row of rows) {
      const capped = row.jobId && row.kind !== LOG_TRUNCATED && !String(row.src ?? '').startsWith('ev:');
      if (capped) {
        if (row.src && db.prepare('SELECT 1 FROM logs WHERE src=?').get(row.src)) { out.duplicate += 1; continue; }
        if (!counts.has(row.jobId)) counts.set(row.jobId, cappedCount(db, row.jobId));
        if (counts.get(row.jobId) >= perJobCap) {
          out.dropped += 1;
          if (!truncated.get(row.jobId)) {
            insert.run(now, row.workflowId, row.jobId, 'runtime', null, 'warn', LOG_TRUNCATED, `Nhật ký job đã chạm trần ${perJobCap} dòng; các dòng sau bị bỏ`,
              JSON.stringify({ cap: perJobCap }), '[]', null);
          }
          continue;
        }
      }
      const r = insert.run(row.at, row.workflowId, row.jobId, row.actor, row.nodeId, row.level, row.kind, row.msg,
        JSON.stringify(row.data ?? {}), JSON.stringify(row.refs ?? []), row.src ?? null);
      if (r.changes) { out.inserted += 1; out.seqs.push(Number(r.lastInsertRowid)); if (capped) counts.set(row.jobId, counts.get(row.jobId) + 1); }
      else out.duplicate += 1;
    }
  });
  return out;
}

/** Validate, redact and insert one row: {ok, seq?, dropped?} or throws {code}. */
export function appendLog(logs, row, { clip = false, ...options } = {}) {
  const prepared = prepareLogRow(row, { clip, ...options });
  if (prepared.error) throw Object.assign(new Error(prepared.error), { code: prepared.code });
  const r = insertLogRows(logs, [prepared.row], options);
  return { ok: true, seq: r.seqs[0] ?? null, ...(r.dropped ? { dropped: true } : {}), ...(r.duplicate ? { duplicate: true } : {}), row: prepared.row };
}

// ------------------------------------------------------------------------------------------ sidecar
/**
 * Ingest the new tail of one job's log.jsonl: each complete line a JSON object {kind, msg, data?, refs?, at?,
 * level?, node?}, written as actor `op`. Its key is the hash of the job, the line's byte offset and the line, so
 * re-reading the file inserts nothing twice. A malformed or invalid line is counted, never stored.
 */
export function ingestSidecar(logs, { repo, workflowId, jobId, file = sidecarFileOf(repo, workflowId, jobId), dryRun = false, now = Date.now() }) {
  const out = { file, read: 0, inserted: 0, duplicate: 0, dropped: 0, invalid: 0, errors: [] };
  let st;
  try { st = fs.statSync(file); } catch { return out; }
  const cursorName = `jl:${jobId}`;
  const cursor = Number(logs.db.prepare('SELECT value FROM log_cursors WHERE name=?').get(cursorName)?.value ?? 0);
  const from = cursor > st.size ? 0 : cursor;
  if (from === st.size) return out;
  const buf = Buffer.alloc(st.size - from);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, from); } finally { fs.closeSync(fd); }
  const end = buf.lastIndexOf(0x0a);
  if (end < 0) return out;
  const rows = [];
  let offset = from, start = 0;
  while (start <= end) {
    const nl = buf.indexOf(0x0a, start);
    const line = buf.subarray(start, nl).toString('utf8').replace(/\r$/, '');
    const at = offset + start;
    start = nl + 1;
    if (!line.trim()) continue;
    out.read += 1;
    let parsed = null;
    try { parsed = JSON.parse(line); } catch { parsed = null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { out.invalid += 1; if (out.errors.length < 20) out.errors.push({ offset: at, error: 'not a JSON object' }); continue; }
    const prepared = prepareLogRow({ at: parsed.at, workflowId, jobId, actor: 'op', nodeId: parsed.node ?? parsed.nodeId ?? null, level: parsed.level, kind: parsed.kind,
      msg: parsed.msg, data: parsed.data, refs: parsed.refs, src: `jl:${crypto.createHash('sha256').update(`${jobId}\n${at}\n${line}`).digest('hex').slice(0, 40)}` }, { now });
    if (prepared.error) { out.invalid += 1; if (out.errors.length < 20) out.errors.push({ offset: at, code: prepared.code, error: prepared.error }); continue; }
    rows.push(prepared.row);
  }
  if (dryRun) { out.wouldInsert = rows.filter((r) => !logs.db.prepare('SELECT 1 FROM logs WHERE src=?').get(r.src)).length; return out; }
  const r = insertLogRows(logs, rows, { now });
  Object.assign(out, { inserted: r.inserted, duplicate: r.duplicate, dropped: r.dropped });
  logs.transaction((db) => db.prepare('INSERT INTO log_cursors(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run(cursorName, from + end + 1));
  return out;
}

// ------------------------------------------------------------------------------------ derived rows
export const DERIVED_EVENT_KINDS = Object.freeze(['op-dispatched', 'dispatch-rejected', 'report-filed', 'checks-recorded', 'op-settled',
  'incident-raised', 'incident-resolved', 'incident-auto-resolved', 'worker-failed-no-report', 'job-dropped', 'foundation-landed']);
const clipText = (v, n = 240) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const intOr = (v) => (Number.isInteger(v) ? v : undefined);
const strOr = (v) => (typeof v === 'string' && v ? v : undefined);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

/**
 * The typed rows one ledger event stands for, without writing: pure but for `ctx` lookups —
 * ctx.jobOf(jobId) -> {op_id, attempt, result_json}, ctx.checksOf(workflowId, op, attempt) -> [{name, command, exitCode, evidence}].
 * Each row carries src `ev:<ledger>:<seq>[:i]`, so re-deriving stores nothing twice.
 */
export function rowsOfEvent(event, ctx = {}) {
  const p = event.payload ?? (() => { try { return JSON.parse(event.payload_json || '{}') ?? {}; } catch { return {}; } })();
  const base = { at: event.created_at, workflowId: event.workflow_id, actor: 'runtime' };
  const src = (i = null) => `ev:${ctx.ledgerKey ?? 'l'}:${event.seq}${i == null ? '' : `:${i}`}`;
  const jobId = event.entity_type === 'job' ? event.entity_id : (strOr(p.jobId) ?? null);
  const job = jobId && ctx.jobOf ? ctx.jobOf(jobId) : null;
  const op = strOr(p.op) ?? strOr(p.opId) ?? job?.op_id ?? undefined;
  const attempt = intOr(p.attempt) ?? intOr(job?.attempt);
  switch (event.kind) {
    case 'op-dispatched':
      return [{ ...base, jobId, kind: 'dispatch', src: src(), msg: `Giao ${op ?? 'op'}${attempt ? ` (lần ${attempt})` : ''} cho ${p.model ?? 'agent'}${p.modelId ? ` · ${p.modelId}` : ''}`,
        data: compact({ op: op ?? 'op', attempt, model: strOr(p.model), modelId: strOr(p.modelId), effort: strOr(p.effort), dispatchId: strOr(p.dispatch) }) }];
    case 'dispatch-rejected': {
      // The error is often the host's whole JSON reply: its failed stage and last error say what happened.
      const raw = String(p.error ?? '');
      const stage = /"failedStage"\s*:\s*"([^"]+)"/.exec(raw)?.[1], lastError = /"lastError"\s*:\s*"([^"]+)"/.exec(raw)?.[1];
      return [{ ...base, jobId, kind: 'error', level: 'error', src: src(), msg: `Giao ${op ?? 'op'} thất bại ở bước ${p.step ?? '?'}${lastError ? ` (${lastError})` : ''}`,
        data: compact({ code: 'dispatch-rejected', message: stage || lastError ? `${stage ?? '?'}: ${lastError ?? '?'}` : (clipText(raw, 600) || 'dispatch rejected'),
          hint: [p.step ? `step ${p.step}` : null, p.provider ? `provider ${p.provider}` : null].filter(Boolean).join(' · ') || undefined }) }];
    }
    case 'report-filed':
      return [{ ...base, jobId, kind: 'report', src: src(), msg: `Op nộp báo cáo: ${p.outcome ?? '?'}`, refs: strOr(p.report) ? [p.report] : [],
        data: compact({ outcome: String(p.outcome ?? 'unknown'), op, attempt, reportRef: strOr(p.report) }) }];
    case 'checks-recorded': {
      const checks = op && attempt && ctx.checksOf ? ctx.checksOf(event.workflow_id, op, attempt) : [];
      return checks.map((c, i) => {
        const pass = Number(c?.exitCode) === 0;
        return { ...base, actor: 'check', jobId, kind: 'check.result', src: src(i), msg: `${pass ? 'Đạt' : 'Trượt'}: ${clipText(c?.name ?? 'check', 120)}`,
          data: compact({ name: String(c?.name ?? 'check'), pass, command: strOr(c?.command), exit: intOr(c?.exitCode), evidence: strOr(c?.evidence) && clipText(c.evidence, 600) }) };
      });
    }
    case 'op-settled': {
      const e = p.checkEvidence ?? {};
      const rows = [{ ...base, jobId, kind: 'settle', src: src(0), msg: `Kernel chốt verdict ${p.verdict ?? '?'}${e.observed != null ? ` · ${e.passed ?? 0}/${e.observed} check đạt` : ''}`,
        data: compact({ verdict: String(p.verdict ?? 'unknown'), status: strOr(p.status), observed: intOr(e.observed), passed: intOr(e.passed), failed: intOr(e.failed), leasesReleased: intOr(p.leasesReleased) }) }];
      let result = null;
      try { result = JSON.parse(job?.result_json ?? 'null'); } catch { result = null; }
      const landed = result?.landed;
      const head = typeof landed === 'string' ? landed : strOr(landed?.head);
      if (p.verdict === 'pass' && head) {
        const paths = (Array.isArray(landed?.repos) ? landed.repos : []).flatMap((r) => (Array.isArray(r?.paths) ? r.paths : [])).slice(0, 20);
        rows.push({ ...base, actor: 'land', jobId, kind: 'land', src: src(1), msg: `Đã land ${head.slice(0, 10)}${landed?.repo ? ` vào ${path.basename(String(landed.repo))}` : ''}`,
          refs: [`commit:${head}`], data: compact({ head, repo: strOr(landed?.repo), headCheck: strOr(landed?.headCheck), paths: paths.length ? paths : undefined }) });
      }
      return rows;
    }
    case 'incident-raised':
    case 'incident-resolved':
    case 'incident-auto-resolved': {
      const raised = event.kind === 'incident-raised';
      const holds = Array.isArray(p.holds) ? p.holds.filter((h) => typeof h === 'string') : [];
      const heldJob = holds.find((h) => h.startsWith('op-')) ?? null;
      return [{ ...base, jobId: heldJob, kind: 'incident', src: src(), msg: `${raised ? 'Sự cố' : 'Gỡ sự cố'}${p.kind ? ` ${p.kind}` : ''}: ${clipText(p.detail, 200)}`,
        data: compact({ id: event.entity_id, state: raised ? 'raised' : 'resolved', kind: strOr(p.kind), detail: strOr(p.detail) && clipText(p.detail, 800), holds: holds.length ? holds.slice(0, 20) : undefined }) }];
    }
    case 'worker-failed-no-report':
      return [{ ...base, jobId, kind: 'error', level: 'error', src: src(), msg: `Op dừng mà không nộp báo cáo (${p.liveness ?? '?'})`,
        data: compact({ code: 'worker-failed-no-report', message: `liveness ${p.liveness ?? '?'}, effect ${p.effectState ?? '?'}`, hint: Array.isArray(p.evidence) ? clipText(p.evidence.join(', '), 400) : undefined }) }];
    case 'job-dropped':
      return [{ ...base, jobId, kind: 'job.drop', src: src(), msg: `Bỏ job: ${clipText(p.reason, 200)}`, data: compact({ reason: clipText(p.reason ?? 'dropped', 600), op, attempt }) }];
    case 'foundation-landed':
      return [{ ...base, actor: 'land', jobId: null, kind: 'land', src: src(), msg: `Nền móng ${p.name ?? event.entity_id} đã land ${p.version ?? ''}`.trim(),
        refs: Array.isArray(p.refs) ? p.refs.filter((r) => typeof r === 'string').slice(0, 10) : [], data: compact({ head: String(p.version ?? p.name ?? event.entity_id), repo: undefined }) }];
    default:
      return [];
  }
}

const ledgerKeyOf = (ledgerDb) => {
  try { const id = ledgerDb.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value; if (id) return String(id).slice(0, 12); } catch { /* an old ledger */ }
  return 'l';
};

/**
 * Derive typed rows from every ledger event past this ledger's cursor (DERIVED_EVENT_KINDS), in batches, and move the
 * cursor. `ledgerDb` may be read-only. Returns {events, inserted, duplicate, cursor}. `dryRun` counts only.
 */
export function syncDerivedLogs(logs, ledgerDb, { batch = 5000, maxBatches = 60, dryRun = false } = {}) {
  const ledgerKey = ledgerKeyOf(ledgerDb);
  const cursorName = `events:${ledgerKey}`;
  let cursor = Number(logs.db.prepare('SELECT value FROM log_cursors WHERE name=?').get(cursorName)?.value ?? 0);
  const out = { events: 0, rows: 0, inserted: 0, duplicate: 0, invalid: 0, cursor };
  const kinds = DERIVED_EVENT_KINDS.map(() => '?').join(',');
  const eventsAfter = ledgerDb.prepare(`SELECT seq,workflow_id,entity_type,entity_id,kind,payload_json,created_at FROM events WHERE seq>? AND kind IN (${kinds}) ORDER BY seq LIMIT ?`);
  const jobStmt = ledgerDb.prepare('SELECT op_id,attempt,result_json FROM jobs WHERE job_id=?');
  let checksStmt = null;
  try { checksStmt = ledgerDb.prepare('SELECT checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?'); } catch { checksStmt = null; }
  const ctx = {
    ledgerKey,
    jobOf: (id) => jobStmt.get(id) ?? null,
    checksOf: (wf, op, attempt) => { try { const doc = JSON.parse(checksStmt?.get(wf, op, attempt)?.checks_json ?? 'null'); return Array.isArray(doc?.checks) ? doc.checks : Array.isArray(doc) ? doc : []; } catch { return []; } },
  };
  for (let n = 0; n < maxBatches; n++) {
    const events = eventsAfter.all(cursor, ...DERIVED_EVENT_KINDS, batch);
    if (!events.length) break;
    const rows = [];
    for (const event of events) for (const raw of rowsOfEvent(event, ctx)) {
      const prepared = prepareLogRow(raw);
      if (prepared.error) { out.invalid += 1; continue; }
      rows.push(prepared.row);
    }
    out.events += events.length; out.rows += rows.length;
    const last = events.at(-1).seq;
    if (dryRun) { out.inserted += rows.filter((r) => !logs.db.prepare('SELECT 1 FROM logs WHERE src=?').get(r.src)).length; cursor = last; continue; }
    const r = insertLogRows(logs, rows);
    out.inserted += r.inserted; out.duplicate += r.duplicate;
    logs.transaction((db) => db.prepare('INSERT INTO log_cursors(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=max(value,excluded.value)').run(cursorName, last));
    cursor = last;
    if (events.length < batch) break;
  }
  out.cursor = cursor;
  return out;
}

/** The jobs of a workflow (or all workflows) whose sidecar exists: [{workflowId, jobId, file}]. */
export function sidecarsOf(repo, ledgerDb, { workflowId = null } = {}) {
  const rows = ledgerDb.prepare(`SELECT job_id, workflow_id FROM jobs WHERE kind<>'kernel'${workflowId ? ' AND workflow_id=?' : ''}`).all(...(workflowId ? [workflowId] : []));
  return rows.map((r) => ({ workflowId: r.workflow_id, jobId: r.job_id, file: sidecarFileOf(repo, r.workflow_id, r.job_id) })).filter((r) => fs.existsSync(r.file));
}

/** Derive from events and ingest every sidecar of the workflow (or the repo): what a read of the logs runs first. */
export function syncLogs(logs, ledgerDb, { repo, workflowId = null, dryRun = false } = {}) {
  const derived = syncDerivedLogs(logs, ledgerDb, { dryRun });
  const sidecars = sidecarsOf(repo, ledgerDb, { workflowId }).map((s) => ingestSidecar(logs, { repo, workflowId: s.workflowId, jobId: s.jobId, file: s.file, dryRun }));
  return { derived, sidecars: { files: sidecars.length, read: sidecars.reduce((n, s) => n + s.read, 0), inserted: sidecars.reduce((n, s) => n + s.inserted + (s.wouldInsert ?? 0), 0),
    invalid: sidecars.reduce((n, s) => n + s.invalid, 0), errors: sidecars.flatMap((s) => s.errors.map((e) => ({ file: s.file, ...e }))).slice(0, 20) } };
}

// ----------------------------------------------------------------------------------------------- read
const parseJson = (v, d) => { try { return JSON.parse(v) ?? d; } catch { return d; } };
/** A stored row as the api and ui read it. */
export const viewOfRow = (r) => ({ seq: r.seq, at: r.at, workflowId: r.workflow_id, jobId: r.job_id, actor: r.actor, nodeId: r.node_id, level: r.level, kind: r.kind,
  msg: r.msg, data: parseJson(r.data_json, {}), refs: parseJson(r.refs_json, []) });

/**
 * Rows of a workflow, oldest first: after `after` (a seq cursor), of `jobIds` (null = every row, '' in the list =
 * workflow-level rows), of `kinds`. Without a cursor it returns the newest `limit` rows. {rows, cursor, more}.
 */
export function readLogs(logs, { workflowId, jobIds = null, after = 0, kinds = null, limit = 2000 }) {
  const where = ['workflow_id=?'], args = [workflowId];
  if (Array.isArray(jobIds) && jobIds.length) {
    const named = jobIds.filter(Boolean);
    const parts = [...(named.length ? [`job_id IN (${named.map(() => '?').join(',')})`] : []), ...(jobIds.includes('') ? ['job_id IS NULL'] : [])];
    where.push(`(${parts.join(' OR ')})`); args.push(...named);
  }
  if (Array.isArray(kinds) && kinds.length) { where.push(`kind IN (${kinds.map(() => '?').join(',')})`); args.push(...kinds); }
  const take = Math.min(10000, Math.max(1, Number(limit) || 2000));
  const cursor = Number.isSafeInteger(Number(after)) && Number(after) > 0 ? Number(after) : 0;
  let rows;
  if (cursor) rows = logs.db.prepare(`SELECT * FROM logs WHERE ${where.join(' AND ')} AND seq>? ORDER BY seq LIMIT ?`).all(...args, cursor, take + 1);
  else rows = logs.db.prepare(`SELECT * FROM logs WHERE ${where.join(' AND ')} ORDER BY seq DESC LIMIT ?`).all(...args, take + 1).reverse();
  const more = rows.length > take;
  if (more) rows = cursor ? rows.slice(0, take) : rows.slice(1);
  const views = rows.map(viewOfRow);
  return { rows: views, cursor: views.at(-1)?.seq ?? cursor, more };
}

// ------------------------------------------------------------------------------------------------ cli
const argsOf = (argv) => { const a = { _: [] }; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) { a._.push(k); continue; } const name = k.slice(2); if (['apply', 'json', 'dry-run'].includes(name)) a[name] = true; else a[name] = argv[++i]; } return a; };

async function main() {
  const args = argsOf(process.argv.slice(2));
  if (args._[0] !== 'sync' || !args.repo) {
    console.error('use: node scripts/kernel/typed-logs.mjs sync --repo <repo> [--workflow <id>] [--apply] [--json]   (dry run unless --apply)');
    process.exit(2);
  }
  const repo = path.resolve(args.repo);
  const { inspectLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const ledger = inspectLedger({ file: ledgerFileFor(repo) });
  const dryRun = !args.apply;
  // A dry run on a repository without logs.sqlite counts against an in-memory database, so it creates no file.
  const logs = dryRun && !fs.existsSync(logsFileFor(repo)) ? openLogs(repo, { file: ':memory:' }) : openLogs(repo);
  try {
    const out = { ok: true, repo, dryRun, logs: logsFileFor(repo), ...syncLogs(logs, ledger.db, { repo, workflowId: args.workflow ?? null, dryRun }) };
    if (args.json) console.log(JSON.stringify(out, null, 2));
    else console.log(`${dryRun ? 'dry run: would insert' : 'inserted'} ${out.derived.inserted} derived row(s) from ${out.derived.events} event(s); ${out.sidecars.inserted} sidecar row(s) from ${out.sidecars.files} file(s) (${out.sidecars.invalid} invalid) -> ${out.logs}`);
  } finally {
    logs.close(); ledger.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(1); });
