// scripts/connectors/lib.mjs — what the ask gateway, the tunnel manager and the
// Telegram notifier share: the connectors state directory, the repositories
// whose asks go public, the read-only projection of open ask forms, and the
// small file/process helpers. docs/connectors.md is the design note.
//
// Every ledger read here goes through inspectLedger (read-only): the
// connectors observe asks, they never write a ledger.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { inspectLedger, ledgerFileFor, machineFileFor, isRuntimeRoot } from '../../engine/ledger-db.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { loadConfig } from '../../engine/config.mjs';

/**
 * Machine-local connectors state: beside machine.sqlite
 * (%LOCALAPPDATA%/StarCi/runtime/connectors, or ~/.local/state/StarCi/runtime/connectors).
 * Keyed off the environment so a spec can repoint it.
 */
export const stateDir = (env = process.env) => path.join(path.dirname(machineFileFor(env)), 'connectors');
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
    if (Number.isFinite(payload.ttlMs) && row.created_at + payload.ttlMs <= now) continue;
    const nonce = nonceOf(payload.url);
    if (!nonce || !isLoopbackUrl(payload.url)) continue;
    out.push({
      seq: row.seq, workflowId: row.workflow_id, dispatchId, url: payload.url, nonce, pid: payload.pid ?? null,
      fields: payload.fields ?? { files: [], vars: [] }, credential: isCredentialAsk(payload.fields),
      createdAt: row.created_at, expiresAt: Number.isFinite(payload.ttlMs) ? row.created_at + payload.ttlMs : null,
    });
  }
  return out;
}

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
