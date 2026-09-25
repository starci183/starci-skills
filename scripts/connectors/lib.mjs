// scripts/connectors/lib.mjs — what the ask gateway, the tunnel manager and the
// Telegram notifier share: the connectors state directory, the repositories
// whose asks go public, the read-only projection of open ask forms, and the
// small file/process helpers. docs/connectors.md is the design note.
//
// Every ledger read here goes through inspectLedger (read-only): the
// connectors observe asks, they never write a ledger.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { inspectLedger, ledgerFileFor, runtimeRootFor, isRuntimeRoot } from '../../engine/ledger-db.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { loadConfig } from '../../engine/config.mjs';

/**
 * Machine-local connectors state: beside machine.sqlite
 * (%LOCALAPPDATA%/StarCi/runtime/connectors, or ~/.local/state/StarCi/runtime/connectors).
 * Keyed off the environment so a spec can repoint it.
 */
export const stateDir = (env = process.env) => path.join(runtimeRootFor(env), 'connectors');
export const stateFile = (name, env = process.env) => path.join(stateDir(env), name);

export const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
/** Write JSON through a temp file and a rename, so a reader never sees half a file. */
export const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
};

export const pidAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
};

/** When this host last booted (ms). */
export const hostBootAt = () => Date.now() - os.uptime() * 1000;
/**
 * Whether the process a state record names ({pid, startedAt}) is still that process: its pid is
 * live AND it started in this boot. After a reboot the recorded pid may name an unrelated process,
 * and a connector that trusted it would never start again.
 */
export const recordAlive = (record) => {
  if (!record?.pid || !pidAlive(record.pid)) return false;
  const started = Date.parse(record.startedAt ?? '');
  return !Number.isFinite(started) || started >= hostBootAt() - 60_000;
};

/**
 * Claim the single-manager lock <state>/<name>.lock for this process, created exclusively ('wx').
 * `current` is the manager's state record (tunnel.json, gateway.json): a live one that is not this
 * process owns the state even without the lock (a manager started before the lock existed).
 * A lock whose holder is dead or from an earlier boot is stale and taken over; an unreadable lock
 * younger than 5s is one being written. Returns {ok:true, release} or {ok:false, holder}.
 */
export function claimManager(name, { current = null, env = process.env } = {}) {
  if (current && current.pid !== process.pid && recordAlive(current)) return { ok: false, holder: current };
  const file = stateFile(`${name}.lock`, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' });
      const release = () => { try { if (readJson(file)?.pid === process.pid) fs.rmSync(file, { force: true }); } catch { /* gone */ } };
      return { ok: true, release, file };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const held = readJson(file);
      if (held && held.pid !== process.pid && recordAlive(held)) return { ok: false, holder: held };
      if (!held) {
        let age = Infinity;
        try { age = Date.now() - fs.statSync(file).mtimeMs; } catch { /* vanished: retry */ }
        if (age < 5000) return { ok: false, holder: null };
      }
      // Stale: move it aside under a unique name, so two claimants cannot both delete a fresh lock.
      try { fs.renameSync(file, `${file}.stale-${process.pid}-${Date.now()}`); } catch { continue; }
      for (const leftover of fs.readdirSync(path.dirname(file)).filter((f) => f.startsWith(`${name}.lock.stale-`))) {
        try { fs.rmSync(path.join(path.dirname(file), leftover), { force: true }); } catch { /* best effort */ }
      }
    }
  }
  return { ok: false, holder: readJson(file) };
}

/**
 * Claim a manager lock that may be handed over (scripts/lib/self-reload.mjs): a loop that re-execs itself
 * spawns its replacement with `from` = its own pid and waits, still holding the lock, until the lock names
 * the replacement. The replacement rewrites the lock only while it still names `from`, so there is no moment
 * the lock is free for a third claimant. Without `from`, or when the lock no longer names it, this is
 * claimManager. Returns {ok:true, release, file, takenOver?} or {ok:false, holder}.
 */
export function claimOrTakeOver(name, { from = null, env = process.env } = {}) {
  const file = stateFile(`${name}.lock`, env);
  const fromPid = Number(from);
  if (Number.isInteger(fromPid) && fromPid > 0 && readJson(file)?.pid === fromPid) {
    writeJson(file, { pid: process.pid, startedAt: new Date().toISOString(), handedOverFrom: fromPid });
    if (readJson(file)?.pid === process.pid) {
      const release = () => { try { if (readJson(file)?.pid === process.pid) fs.rmSync(file, { force: true }); } catch { /* gone */ } };
      return { ok: true, release, file, takenOver: true };
    }
  }
  return claimManager(name, { env });
}

/** Write a manager lock naming this process again (a handover that failed after the replacement took it). */
export const reassertManager = (name, { env = process.env } = {}) => {
  writeJson(stateFile(`${name}.lock`, env), { pid: process.pid, startedAt: new Date().toISOString() });
  return readJson(stateFile(`${name}.lock`, env))?.pid === process.pid;
};

/** The live holder of a manager lock, or null. */
export const lockHolder = (name, env = process.env) => {
  const held = readJson(stateFile(`${name}.lock`, env));
  return held && recordAlive(held) ? held : null;
};

/**
 * A manager a starter just launched but that has not claimed its lock yet (node takes a while to
 * start on a loaded host). `start` records `<state>/<name>.starting.json` {pid, at} right after the
 * spawn, and every liveness test counts it for STARTING_MS while that pid lives, so two starters in
 * that window do not both launch a manager.
 */
export const STARTING_MS = 30_000;
export const markStarting = (name, pid, env = process.env) => {
  if (Number.isInteger(pid) && pid > 0) writeJson(stateFile(`${name}.starting.json`, env), { pid, at: Date.now(), startedAt: new Date().toISOString() });
};
export const startingHolder = (name, env = process.env, { windowMs = STARTING_MS, now = Date.now() } = {}) => {
  const rec = readJson(stateFile(`${name}.starting.json`, env));
  return rec && Number.isFinite(rec.at) && now - rec.at < windowMs && pidAlive(rec.pid) ? rec : null;
};

/** Launch `node <script> ...args` detached from this process, output discarded. */
export const spawnDetached = (script, args = [], { env = process.env } = {}) => {
  const child = spawn(process.execPath, [script, ...args], { detached: true, stdio: 'ignore', windowsHide: true, cwd: skillRoot, env });
  child.unref();
  return child.pid ?? null;
};

// The source root: the directory holding this skill (target-repo.mjs sourceRootOf, same seam).
export const sourceRootOf = (env = process.env) => (env.STARCI_SOURCE_ROOT ? path.resolve(env.STARCI_SOURCE_ROOT) : path.dirname(skillRoot));

const hasLedger = (root) => {
  try { return !isRuntimeRoot(root) && fs.existsSync(ledgerFileFor(root)); } catch { return false; }
};

/**
 * The repositories whose ledgers the connectors read. `connectors.repos` when the owner listed any
 * (relative entries resolve against the source root); otherwise the source root itself plus the Work
 * owner of every .workspaces/projects/<p>/work.json binding — each kept only when it holds a ledger.
 */
export function askRepos(connectors, { env = process.env, extra = [] } = {}) {
  const source = sourceRootOf(env);
  const listed = (connectors?.repos ?? []).map((repo) => path.resolve(source, repo));
  let candidates = listed;
  if (!listed.length) {
    candidates = [source];
    const projects = path.join(source, '.workspaces', 'projects');
    let entries = [];
    try { entries = fs.readdirSync(projects, { withFileTypes: true }); } catch { /* no bindings */ }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const doc = readJson(path.join(projects, entry.name, 'work.json'));
      const owner = doc?.repositories?.[doc?.work?.ownerRole ?? 'be'];
      if (typeof owner?.pathFromSource === 'string' && owner.pathFromSource.trim()) candidates.push(path.resolve(source, owner.pathFromSource));
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

const parse = (text, fallback = null) => { try { return JSON.parse(text); } catch { return fallback; } };

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
  const report = db.prepare("SELECT op_id, report_json FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' ORDER BY report_id DESC LIMIT 1").get(workflowId, dispatchId);
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
    workflowId, dispatchId, opId: report.op_id ?? null, title: db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId)?.title ?? null,
    question: rj.question ?? { text: rj.summary ?? '', options: [] }, closed, serving,
  };
}

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

/** The repos the Telegram store names (asks notified from any ledger), so the gateway can route their forms. */
export const notifiedRepos = (env = process.env) =>
  [...new Set(Object.values(readJson(stateFile('telegram-sent.json', env))?.asks ?? {}).map((a) => a?.repo).filter((r) => typeof r === 'string' && r))];

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
