// scripts/connectors/lib.mjs — what the ask gateway, the tunnel manager and the
// Telegram notifier share: the host locks every singleton manager claims, the
// connectors rows (machine.sqlite `connectors`: gateway, tunnel,
// telegram-bridge, telegram-route, supervisor-channel:<id>), the repositories
// whose asks go public, the read-only projection of open ask forms, and the
// small process helpers. docs/connectors.md is the design note.
//
// Every ledger read here goes through inspectLedger (read-only): the
// connectors observe asks, they never write a ledger. Every piece of host state
// lives in machine.sqlite (engine/db/machine.mjs): a manager lock is a
// host_locks row, a launch still starting is that row in state 'starting'.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnNode } from '../api/node/spawn-node.mjs';
import { inspectLedger, ledgerFileFor, isRuntimeRoot, hasLedger } from '../../engine/db/ledger.mjs';
import { machineLog, pidAlive, readMachine, withMachine } from '../../engine/db/machine.mjs';
import { skillRoot, starciSourceRoot } from '../../engine/runtime-root.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { parseJson, readJsonFile } from '../lib/json.mjs';
import { jobDisplayNameOf, workflowNameOf } from '../lib/display-names.mjs';
import { sleep } from '../lib/sleep.mjs';


/** When this host last booted (ms). */
export const hostBootAt = () => Date.now() - os.uptime() * 1000;
/**
 * Whether the process a state record names ({pid, startedAt}) is still that process: its pid is
 * live AND it started in this boot. After a reboot the recorded pid may name an unrelated process,
 * and a connector that trusted it would never start again. `startedAt` is an ISO time or epoch ms.
 */
export const recordAlive = (record) => {
  if (!record?.pid || !pidAlive(record.pid)) return false;
  const started = typeof record.startedAt === 'number' ? record.startedAt : Date.parse(record.startedAt ?? '');
  return !Number.isFinite(started) || started >= hostBootAt() - 60_000;
};

/* ------------------------------------------------------------ host locks (machine.sqlite host_locks) */

/**
 * How long a held manager lock stays unexpired without a renewal. The holder renews it every LOCK_RENEW_MS from an
 * unref'd timer, so an expired lock (v_leaks) is one whose holder stopped renewing. Who holds a lock is decided by its
 * holder pid (recordAlive: live and of this boot), never by the expiry: a busy holder that missed a renewal keeps it.
 */
export const LOCK_TTL_MS = 10 * 60_000;
export const LOCK_RENEW_MS = 3 * 60_000;
const holderLabel = () => (process.argv[1] ? path.basename(process.argv[1]) : 'node');
/** A host_locks row as the record callers read: {pid, startedAt (ISO), at, handedOverFrom, state, holder}. */
const lockRecord = (row) => (row ? { pid: row.holder_pid, startedAt: new Date(row.started_at).toISOString(), at: row.started_at,
  handedOverFrom: row.handed_over_from ?? null, state: row.state, holder: row.holder ?? null } : null);
const liveRow = (row) => Boolean(row) && row.state !== 'released' && recordAlive({ pid: row.holder_pid, startedAt: row.started_at });

// The renewal timers of the locks this process holds, by name.
const renewals = new Map();
const stopRenewal = (name) => { clearInterval(renewals.get(name)); renewals.delete(name); };
function startRenewal(name, env) {
  stopRenewal(name);
  const timer = setInterval(() => {
    let still = true;
    try { still = withMachine((m) => m.renewHostLock({ name, ttlMs: LOCK_TTL_MS }), { env }); } catch { /* a busy store: the next tick tries again */ }
    if (!still) stopRenewal(name);
  }, LOCK_RENEW_MS);
  timer.unref?.();
  renewals.set(name, timer);
}
/** The handle a successful claim returns: release() frees the lock only while it still names this process. */
function heldBy(name, env, extra = {}) {
  startRenewal(name, env);
  const release = () => {
    stopRenewal(name);
    try { withMachine((m) => m.releaseHostLock({ name }), { env }); } catch { /* the store is gone: nothing left to free */ }
  };
  return { ok: true, release, name, ...extra };
}

/**
 * Take `name` for this process inside one transaction on `m`: refused while another live process of this boot holds
 * it (state 'held'); a dead holder, one from an earlier boot, or a launch still 'starting' is replaced. Returns
 * {ok:true} or {ok:false, holder}.
 */
function takeLock(m, name) {
  return m.transaction(() => {
    const cur = m.hostLock(name);
    if (cur && cur.state === 'held' && cur.holder_pid !== process.pid && liveRow(cur)) return { ok: false, holder: lockRecord(cur) };
    if (cur && cur.state !== 'released' && cur.holder_pid !== process.pid) m.releaseHostLock({ name, force: true });
    const got = m.acquireHostLock({ name, holder: holderLabel(), ttlMs: LOCK_TTL_MS, state: 'held' });
    return got.ok ? { ok: true } : { ok: false, holder: lockRecord(got.holder) };
  });
}

/**
 * Claim the single-manager host lock `name` for this process. `current` is the manager's own record (its connectors
 * row: gateway, tunnel): a live one that is not this process owns the state even without the lock. A lock whose
 * holder is dead or from an earlier boot is stale and taken over. Returns {ok:true, release} or {ok:false, holder}.
 */
export function claimManager(name, { current = null, env = process.env } = {}) {
  if (current && current.pid !== process.pid && recordAlive(current)) return { ok: false, holder: current };
  const got = withMachine((m) => takeLock(m, name), { env });
  return got.ok ? heldBy(name, env) : { ok: false, holder: got.holder ?? null };
}

/**
 * Claim a manager lock that may be handed over (scripts/machine/self-reload.mjs): a loop that re-execs itself
 * spawns its replacement with `from` = its own pid and waits, still holding the lock, until the lock names
 * the replacement. The replacement takes the row over only while it still names `from`, in one transaction,
 * so there is no moment the lock is free for a third claimant. Without `from`, or when the lock no longer
 * names it, this is claimManager. Returns {ok:true, release, takenOver?} or {ok:false, holder}.
 */
export function claimOrTakeOver(name, { from = null, env = process.env } = {}) {
  const fromPid = Number(from);
  if (Number.isInteger(fromPid) && fromPid > 0) {
    const took = withMachine((m) => m.transaction(() => {
      const cur = m.hostLock(name);
      if (!cur || cur.state === 'released' || cur.holder_pid !== fromPid) return false;
      const at = m.now();
      return m.update('host_locks', { holder_pid: process.pid, holder: holderLabel(), started_at: at, heartbeat_at: at, expires_at: at + LOCK_TTL_MS,
        handed_over_from: fromPid, state: 'held' }, { name, holder_pid: fromPid }).changes > 0;
    }), { env });
    if (took) return heldBy(name, env, { takenOver: true });
  }
  return claimManager(name, { env });
}

/** Make the lock name this process again (a handover that failed after the replacement took it). */
export const reassertManager = (name, { env = process.env } = {}) => {
  const ok = withMachine((m) => m.transaction(() => {
    const cur = m.hostLock(name);
    if (cur && cur.state !== 'released' && cur.holder_pid !== process.pid) m.releaseHostLock({ name, force: true });
    return m.acquireHostLock({ name, holder: holderLabel(), ttlMs: LOCK_TTL_MS, state: 'held' }).ok;
  }), { env });
  if (ok) startRenewal(name, env);
  return ok;
};

/** The live holder of a manager lock ({pid, startedAt, handedOverFrom, ...}), or null. A launch still starting is not one. */
export const lockHolder = (name, env = process.env) => {
  const row = readMachine((m) => m.hostLock(name), null, { env });
  return row?.state === 'held' && liveRow(row) ? lockRecord(row) : null;
};

/**
 * A manager a starter just launched but that has not claimed its lock yet (node takes a while to
 * start on a loaded host). `start` marks the lock row 'starting' with the launched pid right after the
 * spawn, and every liveness test counts it for STARTING_MS while that pid lives, so two starters in
 * that window do not both launch a manager. The launched manager's claim turns the row 'held'.
 */
export const STARTING_MS = 30_000;
export const markStarting = (name, pid, env = process.env) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  return withMachine((m) => m.transaction(() => {
    const cur = m.hostLock(name);
    // A live holder (the launched manager already claimed, or another one) is never overwritten.
    if (cur && cur.state === 'held' && liveRow(cur)) return false;
    if (cur && cur.state !== 'released' && cur.holder_pid !== pid) m.releaseHostLock({ name, force: true });
    return m.acquireHostLock({ name, holder: 'starting', pid, ttlMs: STARTING_MS, state: 'starting' }).ok;
  }), { env });
};
export const startingHolder = (name, env = process.env, { windowMs = STARTING_MS, now = Date.now() } = {}) => {
  const row = readMachine((m) => m.hostLock(name), null, { env });
  return row?.state === 'starting' && now - row.started_at < windowMs && pidAlive(row.holder_pid)
    ? { pid: row.holder_pid, at: row.started_at, startedAt: new Date(row.started_at).toISOString() } : null;
};

/**
 * Run async `fn` while holding the host lock `name` (a short cross-process mutex: the Telegram notice store, the
 * media dedupe). Waits up to `waitMs`, then resolves {ok:false, skipped} without running `fn`. Calls from one
 * process are chained, since a host lock is per pid.
 */
const chains = new Map();
export function withHostMutex(name, fn, { env = process.env, waitMs = 10_000, stepMs = 100 } = {}) {
  const prior = chains.get(name) ?? Promise.resolve();
  const run = prior.catch(() => {}).then(async () => {
    const end = Date.now() + waitMs;
    for (;;) {
      let got;
      try { got = withMachine((m) => takeLock(m, name), { env }); } catch { got = { ok: false }; }
      if (got.ok) break;
      if (Date.now() > end) return { ok: false, skipped: `${name} is locked` };
      await sleep(stepMs);
    }
    try { return await fn(); } finally { try { withMachine((m) => m.releaseHostLock({ name }), { env }); } catch { /* gone */ } }
  });
  chains.set(name, run);
  run.catch(() => {}).finally(() => { if (chains.get(name) === run) chains.delete(name); });
  return run;
}

/* ------------------------------------------------------------ connectors rows (machine.sqlite connectors) */

const recordOf = (row) => (row ? { ...(row.config ?? {}), pid: row.pid ?? row.config?.pid ?? null, port: row.port ?? row.config?.port ?? null,
  publicUrl: row.public_url ?? null, state: row.state ?? null, cursor: row.cursor ?? null, updatedAt: row.updated_at } : null);
/**
 * One connector's record, or null: its config_json spread, with the row's pid, port, publicUrl, state, cursor and
 * updatedAt. `name`: gateway | tunnel | telegram-bridge | telegram-route | supervisor-channel:<id>.
 */
export const connectorState = (name, env = process.env) => readMachine((m) => recordOf(m.connectorOf(name)), null, { env });
/** Every connector row whose name starts with `prefix`, as connectorState records with their `name`. */
export const connectorStates = (prefix, env = process.env) => readMachine((m) => m.db.prepare('SELECT name FROM connectors WHERE substr(name,1,length(?))=? ORDER BY name')
  .all(prefix, prefix).map((r) => ({ name: r.name, ...recordOf(m.connectorOf(r.name)) })), [], { env });
/**
 * Write one connector row: only the fields given change (`config` and `cursor` replace their column whole). Returns
 * true. No secret ever goes here (the token lives in .starcistacks / the secrets file).
 */
export const writeConnectorState = (name, { kind, state, pid, port, publicUrl, config, cursor } = {}, env = process.env) => withMachine((m) => {
  const row = { name, updated_at: m.now(), kind, state, pid, port, public_url: publicUrl, config_json: config, cursor_json: cursor };
  m.upsert('connectors', Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)), ['name']);
  return true;
}, { env });

/** One connector log line in machine_logs (actor connector, kind `<source>.<kind>`). Never throws. */
export const connectorLog = (source, msg, { env = process.env, level = 'info', kind = 'log', data = null } = {}) =>
  machineLog({ actor: 'connector', kind: `${source}.${kind}`, msg: String(msg), level, data }, { env });

/** Launch `node <script> ...args` detached from this process, output discarded. */
export const spawnDetached = (script, args = [], { env = process.env } = {}) => {
  const child = spawnNode([script, ...args], { detached: true, stdio: 'ignore', cwd: skillRoot, env });
  child.unref();
  return child.pid ?? null;
};




/**
 * The repositories whose ledgers the connectors read. `connectors.repos` when the owner listed any
 * (relative entries resolve against the source root); otherwise the source root itself plus the Work
 * owner of every .workspaces/projects/<p>/work.json binding — each kept only when it holds a ledger.
 */
export function askRepos(connectors, { env = process.env, extra = [] } = {}) {
  const source = starciSourceRoot(env);
  const listed = (connectors?.repos ?? []).map((repo) => path.resolve(source, repo));
  let candidates = listed;
  if (!listed.length) {
    candidates = [source];
    const projects = path.join(source, '.workspaces', 'projects');
    let entries = [];
    try { entries = fs.readdirSync(projects, { withFileTypes: true }); } catch { /* no bindings */ }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const doc = readJsonFile(path.join(projects, entry.name, 'work.json'));
      const rel = doc?.schema === 'starci/workspace-binding@2' ? doc?.repository?.pathFromSource : null;
      if (typeof rel === 'string' && rel.trim()) candidates.push(path.resolve(source, rel));
    }
  }
  const seen = new Set(), out = [];
  for (const repo of [...candidates, ...extra.map((r) => path.resolve(r))]) {
    const key = process.platform === 'win32' ? repo.toLowerCase() : repo;
    if (seen.has(key) || !hasLedger(repo)) continue;
    seen.add(key); out.push(repo);
  }
  return out;
}

/** The nonce path segment serve-ask binds (`/a-<hex>`). */
export const NONCE = /^a-[0-9a-f]{8,64}$/;
export const nonceOf = (url) => {
  try { const first = new URL(url).pathname.split('/')[1] ?? ''; return NONCE.test(first) ? first : null; } catch { return null; }
};
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
export const isLoopbackUrl = (url) => {
  try { const u = new URL(url); return u.protocol === 'http:' && LOOPBACK.has(u.hostname); } catch { return false; }
};
/** A credential ask names custody files or env variables to fill (serve-ask payload.fields). */
export const isCredentialAsk = (fields) => Boolean((fields?.files?.length ?? 0) + (fields?.vars?.length ?? 0));

const parse = parseJson;

/**
 * Every ask whose serve-ask form is still open in one ledger, newest serving per dispatch:
 * not answered, not expired or superseded after it was served, and inside its ttl.
 */
export function servingAsks(db, { now = Date.now() } = {}) {
  const rows = db.prepare(`SELECT seq, workflow_id, payload_json, created_at FROM events WHERE kind='ask-serving' ORDER BY seq DESC`).all();
  const seen = new Set(), out = [];
  const closedAfter = db.prepare(`SELECT 1 FROM events WHERE workflow_id=? AND json_extract(payload_json,'$.dispatchId')=?
    AND (kind='ask-answered' OR (kind IN ('ask-serving-expired','ask-superseded') AND seq>?)) LIMIT 1`);
  for (const row of rows) {
    const payload = parse(row.payload_json, {}) ?? {};
    const dispatchId = payload.dispatchId;
    if (!dispatchId || seen.has(`${row.workflow_id}\u0000${dispatchId}`)) continue;
    seen.add(`${row.workflow_id}\u0000${dispatchId}`);
    if (closedAfter.get(row.workflow_id, dispatchId, row.seq)) continue;
    const ask = servingRecord(row, payload, now);
    if (ask) out.push(ask);
  }
  return out;
}

// One ask-serving row as an open form, or null: past its ttl, not a loopback nonce URL, or its
// recorded serve-ask process is gone (the form stops being served the moment its process exits).
function servingRecord(row, payload, now) {
  if (Number.isFinite(payload.ttlMs) && row.created_at + payload.ttlMs <= now) return null;
  const nonce = nonceOf(payload.url);
  if (!nonce || !isLoopbackUrl(payload.url)) return null;
  if (Number.isInteger(payload.pid) && !pidAlive(payload.pid)) return null;
  return {
    seq: row.seq, workflowId: row.workflow_id, dispatchId: payload.dispatchId, url: payload.url, nonce, pid: payload.pid ?? null,
    fields: payload.fields ?? { files: [], vars: [] }, credential: isCredentialAsk(payload.fields), onDemand: payload.onDemand === true,
    createdAt: row.created_at, expiresAt: Number.isFinite(payload.ttlMs) ? row.created_at + payload.ttlMs : null,
  };
}

/**
 * One filed ask as the owner-facing connectors see it (read-only on `db`): {workflowId, dispatchId,
 * opId, title, question, closed, serving}, or null when no ask report was filed for it. `closed` is
 * 'answered', 'superseded' (retired, and not re-parked since: a later ask-notified or ask-serving
 * reopens it), else null. `serving` is the live form (servingAsks' rules) or null: an open ask
 * with no live form is healthy, its link is generated on demand from Telegram.
 */
export function askState(db, workflowId, dispatchId, { now = Date.now() } = {}) {
  const report = db.prepare("SELECT a.op_id,r.job_id,r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.dispatch_id=? AND r.outcome='ask' ORDER BY r.report_id DESC LIMIT 1").get(workflowId, dispatchId);
  if (!report) return null;
  const last = (kinds) => db.prepare(`SELECT seq, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (${kinds.map(() => '?').join(',')})
    AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, ...kinds, dispatchId) ?? null;
  const answered = last(['ask-answered']), superseded = last(['ask-superseded']), reopened = last(['ask-serving', 'ask-notified']);
  const closed = answered ? 'answered' : superseded && !(reopened && reopened.seq > superseded.seq) ? 'superseded' : null;
  let serving = null;
  const row = last(['ask-serving']);
  if (!closed && row) {
    const ended = last(['ask-serving-expired', 'ask-superseded']);
    if (!(ended && ended.seq > row.seq)) serving = servingRecord({ ...row, workflow_id: workflowId }, parse(row.payload_json, {}) ?? {}, now);
  }
  const rj = parse(report.report_json, {}) ?? {};
  return {
    // title: the workflow's display name (api rename / define-goal), else its goal slug; jobName: the asking
    // op job's `<op label> · <what> · <workflow name>` (scripts/lib/display-names.mjs).
    workflowId, dispatchId, opId: report.op_id ?? null, title: workflowNameOf(db, workflowId), jobName: askJobName(db, workflowId, report),
    question: rj.question ?? { text: rj.summary ?? '', options: [] }, closed, serving,
  };
}

/** The display name of the op job that filed an ask report, or null. */
const askJobName = (db, workflowId, report) => {
  try {
    const job = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND job_id=? AND kind<>'kernel' LIMIT 1")
      .get(workflowId, report.job_id);
    return job ? jobDisplayNameOf(db, job) : null;
  } catch { return null; }
};

/** Every open ask of one ledger (askState with closed null), newest report first, in live workflows only. */
export function openAskList(db, { now = Date.now() } = {}) {
  const rows = db.prepare(`SELECT r.workflow_id, r.dispatch_id FROM reports r JOIN workflows w ON w.workflow_id=r.workflow_id
    WHERE r.outcome='ask' AND w.archived_at IS NULL AND (w.phase IS NULL OR w.phase<>'finished') ORDER BY r.report_id DESC`).all();
  const seen = new Set(), out = [];
  for (const row of rows) {
    const id = `${row.workflow_id}\u0000${row.dispatch_id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const state = askState(db, row.workflow_id, row.dispatch_id, { now });
    if (state && !state.closed) out.push(state);
  }
  return out;
}

/** The repos the Telegram ask notices name (notifications kind 'ask'), so the gateway can route their forms. */
export const notifiedRepos = (env = process.env) => readMachine((m) => [...new Set(m.db.prepare("SELECT json_extract(ref,'$.repo') repo FROM notifications WHERE kind='ask' AND json_valid(ref)").all()
  .map((r) => r.repo).filter((r) => typeof r === 'string' && r))], [], { env });

/** Open one repo's ledger read-only for `fn`, always closing it; a missing or unreadable ledger yields `fallback`. */
export function withLedgerRead(repo, fn, fallback = null) {
  let handle = null;
  try { handle = inspectLedger({ file: ledgerFileFor(repo) }); } catch { return fallback; }
  try { return fn(handle.db); } finally { try { handle.close(); } catch { /* closed */ } }
}

/** Open asks across repos, each tagged with its repo. */
export const servingAsksAcross = (repos, opts = {}) =>
  repos.flatMap((repo) => withLedgerRead(repo, (db) => servingAsks(db, opts).map((ask) => ({ ...ask, repo })), []));

/** The owner config, or null when it cannot be read (a connector never dies on a broken file it only observes). */
export const ownerConfig = () => { try { return loadConfig(); } catch { return null; } };

export const argsOf = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { out._.push(k); continue; }
    const key = k.slice(2), next = argv[i + 1];
    let value = true;
    if (next !== undefined && !next.startsWith('--')) { value = next; i++; }
    out[key] = key in out ? [].concat(out[key], value) : value;
  }
  return out;
};
