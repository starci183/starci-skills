// host-lock.mjs — the ONE host lock of the heavy runtime work (a land's gate run, a release cut): one holder at a time on this host.
//
// The primitive is the one the external lock used: the atomic mkdir of a single lock directory. What changed is the owner
// file, which is JSON (schema starci/host-lock@1) naming who holds it: token, pid, role, purpose, the Orca terminal handle,
// the host and the start time. That makes three things possible that a plain text file never allowed:
//   - a dead holder is detected (its pid is gone) and the lock is taken over atomically instead of blocking everyone;
//   - a release is refused for a stranger (the token must match), so one actor never drops another's lock;
//   - the rights guard (scripts/guards/rights.mjs) reads the owner (hostLockOwner) and decides who may do what meanwhile.
// A lock whose owner file is ownerless plain text (no pid to test) is held, never stale, until its file is older than
// legacyStaleMs. The release cut (scripts/supervisor/release-cut.mjs, GOVERNANCE lane) runs under
// withHostLock({role: 'release', purpose: 'release-cut'}); the land gate under withHostLock({role: 'coordinator', purpose: 'land'}).
//
// Every function is synchronous and pure fs; the seams {fs, now, isAlive, pid, host, env, dir, newToken, remove} are injectable.
import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pidAlive, starciLocalRoot } from '../../engine/db/machine.mjs';
import { readEnv } from '../lib/env.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';

export const HOST_LOCK_SCHEMA = 'starci/host-lock@1';
export const ROLES = Object.freeze(['release', 'coordinator', 'lead', 'worker']);
const LEGACY_STALE_MS = 6 * 60 * 60 * 1000;
const OWNER_FILE = 'owner';
const LEGACY_TEXT_CLIP = 500;

/** The lock directory: STARCI_HOST_LOCK_DIR, else <starci local root>/host-lock. */
export function hostLockDir({ env = process.env } = {}) {
  const set = readEnv('STARCI_HOST_LOCK_DIR', env);
  return set ? path.resolve(set) : path.join(starciLocalRoot(env), 'host-lock');
}

// The lock directory as found on disk: {kind: 'free'} | {kind: 'json', owner} | {kind: 'plain', text, mtimeMs}.
// A directory without a readable owner file (a holder between its mkdir and its write, or a crash there) is 'plain' with
// the directory's own age, so it too expires through legacyStaleMs.
function readRaw(dir, fs) {
  let st;
  try { st = fs.statSync(dir); } catch (error) {
    if (error?.code === 'ENOENT') return { kind: 'free' };
    throw error;
  }
  let text = '';
  try { text = String(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8')); } catch { /* no owner file yet */ }
  try {
    const owner = JSON.parse(text);
    if (owner && typeof owner === 'object' && owner.schema === HOST_LOCK_SCHEMA && typeof owner.token === 'string') return { kind: 'json', owner };
  } catch { /* plain text */ }
  return { kind: 'plain', text, mtimeMs: st.mtimeMs };
}

// The owner object a raw lock stands for, with `stale` set: a JSON owner is stale when its ttl ran out, or when it is on this
// host and its pid is gone; a plain-text owner is stale only past legacyStaleMs.
function viewOf(raw, { now, isAlive, host, legacyStaleMs }) {
  if (raw.kind === 'free') return null;
  const at = now();
  if (raw.kind === 'plain') {
    return { schema: 'legacy', legacy: true, text: raw.text.slice(0, LEGACY_TEXT_CLIP), token: null, pid: null, role: null, purpose: null, handle: null, host: null,
      since: new Date(raw.mtimeMs).toISOString(), ttlMs: null, stale: at - raw.mtimeMs >= legacyStaleMs };
  }
  const owner = raw.owner;
  const since = Date.parse(owner.since);
  const expired = Number.isFinite(owner.ttlMs) && owner.ttlMs > 0 && Number.isFinite(since) && at - since >= owner.ttlMs;
  const dead = owner.host === host && !isAlive(owner.pid);
  return { ...owner, stale: expired || dead };
}

const seamsOf = ({ fs = nodeFs, now = Date.now, isAlive = pidAlive, host = os.hostname(), legacyStaleMs = LEGACY_STALE_MS } = {}) => ({ fs, now, isAlive, host, legacyStaleMs });
const sameLock = (raw, view) => (raw.kind === 'json' ? view.token === raw.owner.token : raw.kind === 'plain' && view.legacy === true && view.text === raw.text.slice(0, LEGACY_TEXT_CLIP));
const removeTree = (target, remove) => { try { const r = remove(target); return r !== false && r?.ok !== false; } catch { return false; } };
const defaultRemove = (target) => safeRemove(target, { hold: () => null });

// Move the lock directory aside (an atomic rename, so exactly one contender wins), then check that what moved is the lock
// the caller judged (`expected`, a view). When it is not - another actor re-took the lock between the judgement and the
// rename - the directory is put back if its place is still free. Returns {moved: true, aside} | {moved: false, gone} where
// `gone` says the lock was already absent.
function moveAside(dir, expected, { fs, newToken }) {
  const aside = `${dir}.aside-${newToken().slice(0, 12)}`;
  try { fs.renameSync(dir, aside); } catch (error) {
    if (error?.code === 'ENOENT') return { moved: false, gone: true };
    throw error;
  }
  const raw = readRaw(aside, fs);
  if (!sameLock(raw, expected)) {
    try { fs.renameSync(aside, dir); } catch { /* the place was re-taken: the moved lock stays aside, never deleted */ }
    return { moved: false, gone: false };
  }
  return { moved: true, aside };
}

/**
 * The owner of the lock: null when it is free, else {schema, token, pid, role, purpose, handle, host, since, ttlMs, stale}.
 * `stale` is true for a holder whose process is gone (or whose ttl ran out): callers report it, acquireHostLock takes it over.
 * An ownerless plain-text owner reads {legacy: true, text, since: <file time>, stale} with null token/pid/role.
 */
export function hostLockOwner({ dir, env = process.env, ...seams } = {}) {
  const s = seamsOf(seams);
  return viewOf(readRaw(dir ?? hostLockDir({ env }), s.fs), s);
}

/**
 * Take the lock. {ok: true, token, owner} (plus tookOverFrom: <the stale owner> when a dead holder's lock was replaced) or
 * {ok: false, reason: 'held', owner} or {ok: false, reason: 'bad-role', role}. A role outside ROLES is refused.
 */
export function acquireHostLock({ role, purpose = null, handle, pid = process.pid, ttlMs = null, env = process.env, dir, newToken = () => randomBytes(16).toString('hex'), remove = defaultRemove, ...seams } = {}) {
  if (!ROLES.includes(role)) return { ok: false, reason: 'bad-role', role: role ?? null, roles: ROLES };
  const s = seamsOf(seams);
  const lockDir = dir ?? hostLockDir({ env });
  const token = newToken();
  const owner = { schema: HOST_LOCK_SCHEMA, token, pid, role, purpose: purpose ?? null, handle: handle ?? readEnv('ORCA_TERMINAL_HANDLE', env) ?? null,
    host: s.host, since: new Date(s.now()).toISOString(), ttlMs: ttlMs ?? null };
  s.fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  let tookOverFrom = null;
  let seen = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      s.fs.mkdirSync(lockDir);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      seen = viewOf(readRaw(lockDir, s.fs), s);
      if (!seen) continue;
      if (!seen.stale) return { ok: false, reason: 'held', owner: seen };
      const moved = moveAside(lockDir, seen, { fs: s.fs, newToken });
      if (moved.moved) { tookOverFrom = seen; removeTree(moved.aside, remove); }
      continue;
    }
    try { s.fs.writeFileSync(path.join(lockDir, OWNER_FILE), `${JSON.stringify(owner, null, 2)}\n`, { flag: 'wx' }); } catch (error) {
      try { remove(lockDir); } catch { /* a directory without an owner expires through legacyStaleMs */ }
      throw error;
    }
    return { ok: true, token, owner, ...(tookOverFrom ? { tookOverFrom } : {}) };
  }
  return { ok: false, reason: 'held', owner: seen };
}

/**
 * Release the lock `token` holds: {ok: true, released: true}; {ok: true, released: false} when there is no lock;
 * {ok: false, reason: 'not-owner', owner} when someone else (or an ownerless owner) holds it - a stranger's release never removes it.
 */
export function releaseHostLock({ token, env = process.env, dir, newToken = () => randomBytes(16).toString('hex'), remove = defaultRemove, ...seams } = {}) {
  const s = seamsOf(seams);
  const lockDir = dir ?? hostLockDir({ env });
  const raw = readRaw(lockDir, s.fs);
  if (raw.kind === 'free') return { ok: true, released: false };
  const view = viewOf(raw, s);
  if (!token || raw.kind !== 'json' || raw.owner.token !== token) return { ok: false, reason: 'not-owner', owner: view };
  const moved = moveAside(lockDir, view, { fs: s.fs, newToken });
  if (!moved.moved) {
    if (moved.gone) return { ok: true, released: false };
    return { ok: false, reason: 'not-owner', owner: hostLockOwner({ dir: lockDir, ...seams }) };
  }
  const left = !removeTree(moved.aside, remove);
  return { ok: true, released: true, ...(left ? { leftover: moved.aside } : {}) };
}

/**
 * Run `fn({token, owner})` under the lock and always release it. Returns fn's result, or the refusal of acquireHostLock
 * ({ok: false, reason: 'held', owner}) without running fn. An async fn holds the lock until its promise settles.
 */
export function withHostLock(options, fn) {
  const got = acquireHostLock(options);
  if (!got.ok) return got;
  const release = () => releaseHostLock({ token: got.token, env: options?.env, dir: options?.dir, fs: options?.fs, now: options?.now, isAlive: options?.isAlive, host: options?.host, remove: options?.remove });
  let out;
  try { out = fn(got); } catch (error) { release(); throw error; }
  if (out && typeof out.then === 'function') return out.finally(release);
  release();
  return out;
}
