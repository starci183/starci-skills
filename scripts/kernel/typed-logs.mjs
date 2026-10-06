// typed-logs.mjs — logs as typed rows, not scraped terminal text. The `logs` table of the repository's ledger
// (engine/db/ledger.mjs ledgerFileFor; engine/db/schema/runtime.sql; one RDBMS per project, so a finished
// workflow is archived and deleted as a unit).
// Every write goes through the process's ONE buffered writer (log-writer.mjs: its own connection, short batched
// BEGIN IMMEDIATE transactions, never inside a caller's ledger transaction), so twenty ops logging at once never hold the ledger's write lock for more than milliseconds.
//
//   logs(seq, at, workflow_id -> workflows, job_id?, actor, node_id?, level, kind, msg, data_json, refs_json, src?)
//
// Append-only: a trigger refuses every UPDATE, and a DELETE unless the row's workflow is being purged by the
// owner-approved workflow purge (workflow_purges.state 'deleting', scripts/work/purge-workflow.mjs: archive to a
// verified ZIP first). Nothing in housekeeping removes a row. Rows come from three writers (no log file
// exists anywhere in a repository):
//   - `starci kernel log` (scripts/kernel/cli.mjs cmdLog): a Kernel or an op logs one typed row, no ledger write; the
//     lines an op kept in <STARCI_JOB_SCRATCH>/log.jsonl instead are ingested by starci kernel report (ingestScratchLog)
//     before it deletes the scratch;
//   - the ledger's own events (syncDerivedLogs): dispatch, report, checks, settle, land, incident rows are
//     DERIVED from the events that already record them (rowsOfEvent), never re-written by the code paths
//     that append those events; a cursor per ledger keeps it incremental and `src` keeps it idempotent. So every
//     job has a timeline before any agent logs: a cmd.run per recorded check (command, exit, duration, evidence),
//     and from its artifacts-indexed event a file.edit per changed file of its patch (+/-, diffRef into the
//     <patch>.json) and a render / video / trace row per indexed image / video / Playwright trace (with its
//     job_artifacts subkind). `sync --rederive` walks every event again from seq 0 (a new derivation reaching
//     old events; src dedupes what is already stored);
//   - the per-job cap: past allocation.logs.perJobCap (modules/models/runtimes.yaml, default 2000) rows a
//     job's own writes stop and one final `log.truncated` row says so. Derived rows are never capped.
// Every string is redacted at write (redactText/redactData): the push secret scan's own patterns
// (scripts/lib/secret-patterns.mjs, shared with scripts/supervisor/push-mains.mjs) plus OTPs, bearer tokens and
// secret-named keys. A value is blanked, its key kept.
//
// Internal args (spawned by scripts/kernel/cli.mjs): sync --repo <repo> [--workflow <id>] [--rederive] [--apply] [--json].
//       derive rows from the ledger's events; a dry run (the default) counts
//       what it would insert and writes nothing. --rederive derives from every event again (seq 0), so a new
//       derivation reaches old events; rows already stored are duplicates by src and are not written twice.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { jobResultSql } from '../machine/job-row.mjs';
import { independentChecksOf } from './verbs/shared/check-evidence.mjs';
import { logWriterFor } from '../machine/log-writer.mjs';
import { redactData, redactPath, redactText } from '../lib/redact.mjs';
import { defaultLogLevel, fitPreparedLogData, normalizeLogRefs, numericExitCode, rowsOfEvent, scratchLogSource, syncDerivedLogBatches, typeOk } from './typed-log-row-helpers.mjs';
export { rowsOfEvent };
export const LOG_ACTORS = Object.freeze(['kernel', 'op', 'runtime', 'check', 'land']);
export const LOG_LEVELS = Object.freeze(['info', 'warn', 'error']);
export const LOG_TRUNCATED = 'log.truncated';
const MSG_MAX = 300;
const REFS_MAX = 20;
const REF_MAX = 500;
const DEFAULTS = { perJobCap: 2000, dataMaxBytes: 4096 };

/** allocation.logs (modules/models/runtimes.yaml) with its defaults: {perJobCap, dataMaxBytes}. */
function logSettings() {
  const raw = allocationSettings()?.logs ?? {};
  const positive = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return { perJobCap: positive(raw.perJobCap, DEFAULTS.perJobCap), dataMaxBytes: positive(raw.dataMaxBytes, DEFAULTS.dataMaxBytes) };
}

/** The typed logs live in the repository's ledger (its logs table). */
export const logsFileFor = (repo) => ledgerFileFor(repo);

// ---------------------------------------------------------------------------------------------- kinds
// Each kind names its data fields: required and optional, by type. Extra fields are kept (they count against
// dataMaxBytes); a wrong type or a missing required field refuses the row.
const S = 'string', I = 'int', N = 'number', B = 'bool', A = 'array', O = 'object';
export const LOG_KINDS = Object.freeze({
  'step.start': { req: { name: S }, opt: {} },
  'step.end': { req: { name: S }, opt: { durationMs: N, ok: B } },
  'cmd.run': { req: { cmd: S, exit: I }, opt: { durationMs: N, stdoutRef: S, stderrRef: S, cwd: S, output: S, checkName: S, evidenceRef: S, evidence: S } },
  'file.edit': { req: { path: S }, opt: { added: I, removed: I, diffRef: S, oldPath: S, status: S, binary: B, image: B } },
  'check.result': { req: { name: S, pass: B }, opt: { evidenceRef: S, command: S, exit: I, evidence: S } },
  'test.result': { req: { suite: S, passed: I, failed: I }, opt: { skipped: I, durationMs: N, failures: A } },
  render: { req: { artifactRef: S }, opt: { label: S, subkind: S, bytes: I, mime: S, sha256: S } },
  video: { req: { artifactRef: S }, opt: { label: S, subkind: S, bytes: I, mime: S, sha256: S } },
  trace: { req: { artifactRef: S }, opt: { label: S, subkind: S, bytes: I, sha256: S } },
  warning: { req: { code: S, message: S }, opt: { missing: A, hint: S } },
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
  // The Supervisor's act on an owed action (scripts/machine/sup-log.mjs; supervisor ledger only).
  'supervisor.action': { req: { action: S, item: S }, opt: { reason: S, class: S, workflowId: S, repo: S, delivered: B } },
  // The Supervisor's garbage collection (scripts/supervisor/gc.mjs; supervisor ledger only): one gc.collect per
  // thing closed, removed, archived or refused, one gc.summary per run.
  'gc.collect': { req: { class: S, action: S, target: S }, opt: { owner: S, ok: B, proof: S, reason: S, bytes: N, ramBytes: N, apply: B, leftover: B } },
  'gc.summary': { req: { agents: I, terminals: I, worktrees: I, freedBytes: N }, opt: { apply: B, ramFreedBytes: N, refused: I, errors: I, leftovers: I, evidence: I, tmp: I, tasks: I, line: S } },
  // The reconciler (scripts/reconciler/ctx.mjs; supervisor ledger only): what a shadow controller would have run, and
  // every other engine/controller row (data.kind names it: reconciler.leader-acquired, reconciler.reconcile-failed, ...).
  'reconciler.would': { req: { controller: S }, opt: { verb: S, argv: S, mode: S, digest: S, ledgerId: S, key: S, action: S, target: S } },
  'reconciler.act': { req: { controller: S, verb: S }, opt: { ok: B, key: S, actionId: S, ledgerId: S, argv: S, epoch: I } },
  'reconciler.error': { req: { controller: S }, opt: { kind: S, key: S, name: S, detail: S, attempts: I } },
  'reconciler.event': { req: { controller: S, kind: S }, opt: { key: S, name: S, detail: S } },
  // The SLA/Invariant layer (scripts/reconciler/sla.mjs; DESIGN 8.8): an SLA clock past its limit, and its clear.
  'invariant.violated': { req: { code: S }, opt: { severity: S, dedupeKey: S, owner: S, message: S, state: S, ageMs: N, slaMs: N, entity: O } },
  'invariant.cleared': { req: { code: S }, opt: { severity: S, dedupeKey: S, owner: S, message: S, state: S, entity: O } },
  [LOG_TRUNCATED]: { req: { cap: I }, opt: {} },
});

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
// Redaction is scripts/lib/redact.mjs (the one module); this module re-exports its symbols.
export { SECRET_KEY, redactData, redactText, redactPath } from '../lib/redact.mjs';

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
  const fitted = fitPreparedLogData(redacted, dataMaxBytes, clip, bytesOf, fitData);
  if (!fitted) return fail('log-data-too-large', `data is over ${dataMaxBytes} bytes; put the bulk in a file and name it in --refs`);
  const at = Number.isFinite(Number(row.at)) && Number(row.at) > 0 ? Math.trunc(Number(row.at)) : now;
  const msg = redactText(msgRaw.replace(/\s+/g, ' '));
  return { row: {
    at, workflowId: row.workflowId, jobId: row.jobId || null, actor: row.actor, nodeId: row.nodeId || null,
    level: row.level ?? defaultLogLevel(row.kind, data), kind: row.kind, msg: msg.length > MSG_MAX ? `${msg.slice(0, MSG_MAX - 1)}…` : msg,
    data: fitted.data, refs: normalizeLogRefs(row.refs, { maxItems: REFS_MAX, maxLength: REF_MAX, redactPath }), src: row.src ?? null,
  } };
}

// ------------------------------------------------------------------------------------------- storage
// The `logs` and `log_cursors` tables live in the ledger (created by openLedger from schema/runtime.sql). Every
// write goes through the process's ONE buffered writer (log-writer.mjs); reads use the writer's own connection.
/**
 * The repository's typed logs: {db, file, writer, close()}. `db` reads (the writer's connection to
 * runtime.sqlite); writes go through `writer`. The ledger is created when missing. `close()` releases this
 * handle; the last one flushes and closes the connection.
 */
export function openLogs(repo, { file = logsFileFor(repo) } = {}) {
  if (!fs.existsSync(file)) openLedger({ file }).close();
  const writer = logWriterFor(file).retain();
  let open = true;
  return {
    file, writer, get db() { return writer.db; },
    close() { if (!open) return; open = false; writer.release(); },
  };
}

/**
 * Insert prepared rows (prepareLogRow's `row`) through the buffered writer, flushed before this returns: a job's own
 * rows past `perJobCap` are dropped and one `log.truncated` row is written the first time; a row whose `src` is
 * already stored is a duplicate; a row of a workflow the ledger does not hold is rejected. `cursors` ride on the same
 * short transaction. Returns {inserted, duplicate, dropped, rejected, seqs, deferred?}.
 */
export function insertLogRows(logs, rows, { perJobCap = logSettings().perJobCap, now = Date.now(), cursors = [] } = {}) {
  if (!rows.length && !cursors.length) return { inserted: 0, duplicate: 0, dropped: 0, rejected: 0, seqs: [] };
  const r = logs.writer.write(rows, { perJobCap, now, cursors });
  return { ...r, seqs: r.seqs.filter((seq) => seq != null) };
}

/** Validate, redact and insert one row: {ok, seq?, dropped?} or throws {code}. */
export function appendLog(logs, row, { clip = false, ...options } = {}) {
  const prepared = prepareLogRow(row, { clip, ...options });
  if (prepared.error) throw Object.assign(new Error(prepared.error), { code: prepared.code });
  const r = insertLogRows(logs, [prepared.row], options);
  if (r.rejected) throw Object.assign(new Error(`workflow ${prepared.row.workflowId} is not in the ledger`), { code: 'workflow-unknown' });
  return { ok: true, seq: r.seqs[0] ?? null, ...(r.dropped ? { dropped: true } : {}), ...(r.duplicate ? { duplicate: true } : {}), ...(r.deferred ? { deferred: true } : {}), row: prepared.row };
}

/** The typed-log file an op may keep in its job scratch (never in the repository); starci kernel report ingests it. */
export const SCRATCH_LOG_FILE = 'log.jsonl';
/**
 * Ingest the typed rows an op wrote to <scratch>/log.jsonl (one JSON object per line: {kind, msg, data?, refs?, at?,
 * level?, node?}) into the ledger's logs table through the writer, as actor `op` - what starci kernel report runs before it
 * deletes the scratch, so a row the op kept in a file instead of `starci kernel log` is not lost. Each line is keyed by the hash
 * of the job, its offset and its text (src), so ingesting the same file twice stores nothing twice. A malformed line
 * is counted, never stored. Returns {read, inserted, duplicate, invalid}.
 */
export function ingestScratchLog(logs, { file, workflowId, jobId, now = Date.now() }) {
  const out = { read: 0, inserted: 0, duplicate: 0, invalid: 0 };
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return out; }
  const rows = [];
  let offset = 0;
  for (const line of text.split(/\n/)) {
    const at = offset;
    offset += Buffer.byteLength(line, 'utf8') + 1;
    const body = line.replace(/\r$/, '');
    if (!body.trim()) continue;
    out.read += 1;
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { out.invalid += 1; continue; }
    const prepared = prepareLogRow({ at: parsed.at, workflowId, jobId, actor: 'op', nodeId: parsed.node ?? parsed.nodeId ?? null, level: parsed.level, kind: parsed.kind,
      msg: parsed.msg, data: parsed.data, refs: parsed.refs, src: scratchLogSource(jobId, at, body) }, { now });
    if (prepared.error) { out.invalid += 1; continue; }
    rows.push(prepared.row);
  }
  const r = insertLogRows(logs, rows, { now });
  return { ...out, inserted: r.inserted, duplicate: r.duplicate };
}

// ------------------------------------------------------------------------------------ derived rows
const DERIVED_EVENT_KINDS = Object.freeze(['op-dispatched', 'dispatch-rejected', 'report-filed', 'checks-recorded', 'op-settled',
  'incident-raised', 'incident-resolved', 'incident-auto-resolved', 'worker-failed-no-report', 'job-dropped', 'foundation-landed', 'artifacts-indexed']);
const ledgerKeyOf = (ledgerDb) => {
  try { const id = ledgerDb.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value; if (id) return String(id).slice(0, 12); } catch { /* an old ledger */ }
  return 'l';
};

/**
 * Derive typed rows from every ledger event past this ledger's cursor (DERIVED_EVENT_KINDS), in batches, and move the
 * cursor. `ledgerDb` may be read-only. Returns {events, inserted, duplicate, cursor}. `dryRun` counts only.
 */
export function syncDerivedLogs(logs, ledgerDb, { batch = 1000, maxBatches = 300, dryRun = false, repo = null, rederive = false } = {}) {
  const ledgerKey = ledgerKeyOf(ledgerDb);
  const cursorName = `events:${ledgerKey}`;
  // --rederive starts from seq 0 without lowering the stored cursor (it only ever moves forward).
  const cursor = rederive ? 0 : Number(logs.db.prepare('SELECT value FROM log_cursors WHERE name=?').get(cursorName)?.value ?? 0);
  const kinds = DERIVED_EVENT_KINDS.map(() => '?').join(',');
  const eventsAfter = ledgerDb.prepare(`SELECT seq,workflow_id,entity_type,entity_id,attempt_id,kind,payload_json,created_at FROM events WHERE seq>? AND kind IN (${kinds}) ORDER BY seq LIMIT ?`);
  const jobStmt = ledgerDb.prepare(`SELECT op_id,try_no AS attempt,${jobResultSql('jobs')} AS result_json FROM jobs WHERE job_id=?`);
  const patchDocs = new Map();
  const ctx = {
    ledgerKey,
    jobOf: (id) => jobStmt.get(id) ?? null,
    // The pre-structured diff (<patch>.json) of a repo-relative patch path; null when absent or unreadable.
    patchJsonOf: (rel) => {
      if (!repo) return null;
      if (!patchDocs.has(rel)) {
        let doc = null;
        try { const file = path.resolve(repo, `${rel}.json`); if (fs.statSync(file).size < 64 * 1024 * 1024) doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { doc = null; }
        if (patchDocs.size > 200) patchDocs.clear();
        patchDocs.set(rel, doc);
      }
      return patchDocs.get(rel);
    },
    checksOf: ({ jobId, attemptId = null }) => { try { return independentChecksOf(ledgerDb, attemptId != null ? { attemptId } : { jobId })?.checks ?? []; } catch { return []; } },
  };
  return syncDerivedLogBatches({ logs, eventsAfter, batch, maxBatches, dryRun, cursorName, cursor,
    eventKinds: DERIVED_EVENT_KINDS, ctx, rowsOfEvent, prepareLogRow, insertLogRows });
}

/** Derive the workflow's (or the repo's) rows from the ledger's events: what a read of the logs runs first. */
export function syncLogs(logs, ledgerDb, { repo, dryRun = false, rederive = false } = {}) {
  return { derived: syncDerivedLogs(logs, ledgerDb, { dryRun, repo, rederive }) };
}

// ------------------------------------------------------------------------------------ adoption gate
export const LOG_TYPED_MISSING = 'LOG_TYPED_MISSING';
export const LOG_TYPED_MISSING_EVENT = 'log-typed-missing';
const normCmd = (c) => String(c ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The typed rows an op job owed but never wrote itself (actor op: `starci kernel log`): at least one
 * step.start and one step.end, and a cmd.run for each check its report says it ran (matched by command, else by
 * count). `checks` are the report's [{name, command, exitCode}]. Returns {missing: [...], opRows, kinds}: missing is
 * empty when the job logged what it owed. Read-only.
 */
export function typedLogGaps(logs, { jobId, checks = [] }) {
  const rows = logs.db.prepare("SELECT kind, data_json FROM logs WHERE job_id=? AND actor='op'").all(jobId);
  const kinds = {};
  for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  const missing = [];
  if (!kinds['step.start']) missing.push('step.start');
  if (!kinds['step.end']) missing.push('step.end');
  const ran = rows.filter((r) => r.kind === 'cmd.run').map((r) => { try { return normCmd(JSON.parse(r.data_json ?? '{}')?.cmd); } catch { return ''; } });
  const owed = (Array.isArray(checks) ? checks : []).filter((c) => c && typeof c === 'object');
  const unmatched = owed.filter((c) => {
    const want = normCmd(c.command);
    if (!want) return false;
    const i = ran.findIndex((cmd) => cmd && (cmd === want || cmd.includes(want) || want.includes(cmd)));
    if (i < 0) return true;
    ran.splice(i, 1);
    return false;
  });
  for (const c of unmatched.slice(0, 20)) missing.push(`cmd.run ${String(c.name ?? c.command).slice(0, 120)}`);
  const unnamed = owed.filter((c) => !normCmd(c.command)).length;
  if (unnamed && ran.length < unnamed) missing.push(`cmd.run x${unnamed - ran.length} (checks without a command)`);
  return { missing, opRows: rows.length, kinds };
}

// ----------------------------------------------------------------------------------------------- read
const parseJson = (v, d) => { try { return JSON.parse(v) ?? d; } catch { return d; } };
/** A stored row as the api and ui read it. */
const viewOfRow = (r) => ({ seq: r.seq, at: r.at, workflowId: r.workflow_id, jobId: r.job_id, actor: r.actor, nodeId: r.node_id, level: r.level, kind: r.kind,
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
const argsOf = (argv) => { const a = { _: [] }; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) { a._.push(k); continue; } const name = k.slice(2); if (['apply', 'json', 'dry-run', 'rederive'].includes(name)) a[name] = true; else a[name] = argv[++i]; } return a; };

async function main() {
  const args = argsOf(process.argv.slice(2));
  if (args._[0] !== 'sync' || !args.repo) {
    console.error('args: sync --repo <repo> [--workflow <id>] [--rederive] [--apply] [--json]   (dry run unless --apply)');
    process.exit(2);
  }
  const repo = path.resolve(args.repo);
  const { inspectLedger } = await import('../../engine/db/ledger.mjs');
  const ledger = inspectLedger({ file: ledgerFileFor(repo) });
  const dryRun = !args.apply;
  const logs = openLogs(repo);
  try {
    const out = { ok: true, repo, dryRun, logs: logsFileFor(repo), ...syncLogs(logs, ledger.db, { repo, dryRun, rederive: Boolean(args.rederive) }) };
    if (args.json) console.log(JSON.stringify(out, null, 2));
    else console.log(`${dryRun ? 'dry run: would insert' : 'inserted'} ${out.derived.inserted} derived row(s) from ${out.derived.events} event(s) -> ${out.logs}`);
  } finally {
    logs.close(); ledger.close();
  }
}

if (isMain(import.meta.url)) { try { await main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(1); } }
