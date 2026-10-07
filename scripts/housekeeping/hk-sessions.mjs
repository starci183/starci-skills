// hk-sessions.mjs — the agent-session archive half of host housekeeping
// (handoff-devin/STORAGE-PROMPT.md items 1, 8 and 9).
//
// Agent CLIs pile session data on C: and nothing removes it: ~/.codex/sessions alone
// measured 4.8 GB, Orca's own CODEX_HOME another 4.8 GB. sweepAgentSessions moves
// every file older than allocation.housekeeping.sessionArchiveAfterMs (3 days) out of
// the agents' session/log roots into the archive root (scripts/machine/home.mjs archiveRoot) under
// <archiveRoot>/<agent>/, keeping the path relative to the agent's home
// (~/.codex/sessions/2026/09/rollout-x.jsonl → <archiveRoot>/codex/sessions/2026/09/
// rollout-x.jsonl). It then deletes archive files older than
// allocation.housekeeping.archiveMaxAgeMs (30 days).
//
// archiveSessionFiles is the per-op twin the settle lane calls when `starci kernel settle`
// closes an op: the files it names go to <archiveRoot>/<agent>/<basename-ish> right
// away, no age test — the caller already decided the session is over.
//
// The link rule is the runtime's one rule: nothing is ever moved or deleted through
// a link. Every candidate is checked with isLinkLike, a link-like sweep root refuses
// the whole root, and a link found inside a tree is named in skipped, never followed.
// apply=false touches nothing: the same report is produced from stat data alone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { pathKey, samePath, slash } from '../lib/path-key.mjs';
import { positiveNumber } from '../lib/number.mjs';
import { artifactHoldOf } from '../machine/artifact-hold.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { archiveRoot as archiveRootOf } from '../machine/home.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The windows the spec names; allocation.housekeeping.* wins whenever it is set. */
const HK_SESSION_DEFAULTS = Object.freeze({
  sessionArchiveAfterMs: 3 * DAY_MS,
  archiveMaxAgeMs: 30 * DAY_MS,
});

const message = (error) => String(error?.message ?? error);

const result = () => ({ ok: true, freedBytes: 0, movedBytes: 0, deleted: [], moved: [], skipped: [], errors: [] });

/**
 * The housekeeping block: callers either hand the whole `allocation` object
 * ({housekeeping: {...}} — the shape runtimes.yaml declares) or the housekeeping
 * block itself; absent both, it is read from modules/models/runtimes.yaml.
 */
const housekeepingOf = (allocation) => {
  if (allocation && typeof allocation === 'object') {
    if (allocation.housekeeping && typeof allocation.housekeeping === 'object') return allocation.housekeeping;
    return allocation;
  }
  return allocationSettings()?.housekeeping ?? {};
};


/** Orca's CODEX_HOME, resolved the way Orca does it (scripts/agent/trust.mjs orcaCodexHome). */
const orcaHome = (env, home, platform = process.platform) => {
  if (env.STARCI_ORCA_CODEX_HOME) return env.STARCI_ORCA_CODEX_HOME;
  let appData;
  if (platform === 'win32') appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
  else if (platform === 'darwin') appData = path.join(home, 'Library', 'Application Support');
  else appData = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(appData, 'orca', 'codex-runtime-home', 'home');
};

/* --------------------------------------------------------------- the roots */

/**
 * Every root the sweep archives out of, all resolved from `env` — nothing is
 * hardcoded to this machine. Each entry is {agent, home, dir, include?}: `home`
 * is the base the archived relative path is computed from, `dir` the tree that is
 * walked, `include` an optional predicate on the file's path under `dir`.
 */
export function sessionSweepRoots(env = process.env) {
  const home = env.USERPROFILE || env.HOME || os.homedir();
  const roots = [];
  const seen = new Set();
  const add = (agent, agentHome, dir, include = null) => {
    const abs = path.resolve(agentHome, dir);
    const key = `${agent}:${pathKey(abs)}`;
    if (seen.has(key)) return;
    seen.add(key);
    roots.push({ agent, home: path.resolve(agentHome), dir: abs, include });
  };
  const codexHomes = [path.join(home, '.codex')];
  if (env.CODEX_HOME) codexHomes.push(env.CODEX_HOME);
  for (const codexHome of codexHomes) {
    add('codex', codexHome, 'sessions');
    add('codex', codexHome, 'archived_sessions');
  }
  const orca = orcaHome(env, home);
  add('orca-codex', orca, 'sessions');
  add('orca-codex', orca, 'generated_images');
  return roots;
}

/* ------------------------------------------------------------------ helpers */

/**
 * lstat walk of `root` that never descends into a link. Returns
 * {files: [{path,size,mtimeMs}], dirs, links, special, errors}: links and
 * non-regular entries are named so the caller can report them, never followed.
 */
function scanEntry(p, dirReal, stat, stack, out) {
  if (isLinkLike(p, { parentReal: dirReal, stat })) { out.links.push(p); return; }
  if (stat.isDirectory()) { out.dirs.push(p); stack.push(p); return; }
  if (stat.isFile()) { out.files.push({ path: p, size: stat.size, mtimeMs: stat.mtimeMs }); return; }
  out.special.push(p);
}

function scanTree(root) {
  const out = { files: [], dirs: [], links: [], special: [], errors: [] };
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir); } catch (error) { out.errors.push({ path: dir, error: message(error) }); continue; }
    let dirReal = null;
    try { dirReal = fs.realpathSync.native(dir); } catch { /* isLinkLike falls back to its own realpath */ }
    for (const name of entries) {
      const p = path.join(dir, name);
      let st;
      try { st = fs.lstatSync(p); } catch (error) { if (error?.code !== 'ENOENT') { out.errors.push({ path: p, error: message(error) }); } continue; }
      scanEntry(p, dirReal, st, stack, out);
    }
  }
  return out;
}

/** Move one file, same volume by rename, across volumes by copy+unlink. Parents are made. */
function moveFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try { fs.renameSync(from, to); } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

/** rmdir every empty directory under `root` (never `root` itself, never a link). */
function pruneEmptyDirs(root) {
  const walk = (dir, keep) => {
    let st;
    try { st = fs.lstatSync(dir); } catch { return; }
    if (!st.isDirectory() || isLinkLike(dir, { stat: st })) return;
    let names;
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const name of names) walk(path.join(dir, name), false);
    if (!keep) { try { fs.rmdirSync(dir); } catch { /* still holds something, or refused */ } }
  };
  walk(root, true);
}

function archiveSessionFile(root, file, { apply, now, archiveAfterMs, archiveRoot, out, skip, fail }) {
  const underDir = slash(path.relative(root.dir, file.path));
  if (root.include && !root.include(underDir)) return; // outside the known session/log subdirs
  if (now - file.mtimeMs < archiveAfterMs) { skip(file.path, 'too-new'); return; }
  const rel = path.relative(root.home, file.path);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { skip(file.path, 'outside-home'); return; }
  const dest = path.join(archiveRoot, root.agent, rel);
  if (samePath(file.path, dest)) { skip(file.path, 'already-archived'); return; }
  if (fs.existsSync(dest)) { skip(file.path, 'destination-exists'); return; }
  if (apply) {
    try { moveFile(file.path, dest); } catch (error) { fail(file.path, error); return; }
  }
  out.moved.push({ from: file.path, to: dest });
  out.movedBytes += file.size;
}

function sweepSessionRoot(root, { apply, now, archiveAfterMs, archiveRoot, out, skip, fail }) {
  let stat;
  try { stat = fs.lstatSync(root.dir); } catch (error) {
    if (error?.code === 'ENOENT') skip(root.dir, 'missing'); else fail(root.dir, error);
    return;
  }
  if (isLinkLike(root.dir, { stat })) { skip(root.dir, 'link-like root'); return; }
  if (!stat.isDirectory()) { skip(root.dir, 'not-a-directory'); return; }
  const scan = scanTree(root.dir);
  out.errors.push(...scan.errors);
  for (const p of scan.links) skip(p, 'link');
  for (const p of scan.special) skip(p, 'not-a-file');
  for (const file of scan.files) archiveSessionFile(root, file, { apply, now, archiveAfterMs, archiveRoot, out, skip, fail });
  if (apply) pruneEmptyDirs(root.dir);
}

function deleteArchivedFile(file, { apply, now, archiveMaxAgeMs, env, out, skip, fail }) {
  if (now - file.mtimeMs < archiveMaxAgeMs) { skip(file.path, 'too-new'); return; }
  if (artifactHoldOf(file.path, { env })) { skip(file.path, 'indexed-job-artifact'); return; }
  if (apply) {
    try { fs.unlinkSync(file.path); } catch (error) { fail(file.path, error); return; }
  }
  out.deleted.push(file.path);
  out.freedBytes += file.size;
}

function pruneSessionArchive(archiveRoot, { apply, now, archiveMaxAgeMs, env, out, skip, fail }) {
  let archiveStat;
  try { archiveStat = fs.lstatSync(archiveRoot); } catch (error) {
    if (error?.code !== 'ENOENT') fail(archiveRoot, error);
  }
  if (!archiveStat) return;
  if (isLinkLike(archiveRoot, { stat: archiveStat })) { skip(archiveRoot, 'link-like root'); return; }
  if (!archiveStat.isDirectory()) { skip(archiveRoot, 'not-a-directory'); return; }
  const scan = scanTree(archiveRoot);
  out.errors.push(...scan.errors);
  for (const p of scan.links) skip(p, 'link');
  for (const p of scan.special) skip(p, 'not-a-file');
  for (const file of scan.files) deleteArchivedFile(file, { apply, now, archiveMaxAgeMs, env, out, skip, fail });
  if (apply) pruneEmptyDirs(archiveRoot);
}

function sessionArchiveDestination(src, root, agent, taken) {
  const parts = path.resolve(src).split(path.sep).filter(Boolean);
  for (let depth = 1; depth <= Math.min(parts.length, 4); depth += 1) {
    const name = parts.slice(-depth).join('__');
    const dest = path.join(root, agent, name);
    if (samePath(src, dest)) return { dest, same: true };
    const key = pathKey(dest);
    if (!taken.has(key) && !fs.existsSync(dest)) { taken.add(key); return { dest }; }
  }
  return null;
}

function archiveOneSessionFile(input, { root, agent, apply, taken, out }) {
  const src = path.resolve(String(input));
  let stat;
  try { stat = fs.lstatSync(src); } catch (error) { out.errors.push({ path: src, error: message(error) }); return; }
  if (isLinkLike(src, { stat })) { out.skipped.push({ path: src, reason: 'link' }); return; }
  if (!stat.isFile()) { out.skipped.push({ path: src, reason: 'not-a-file' }); return; }
  const pick = sessionArchiveDestination(src, root, agent, taken);
  if (!pick) { out.skipped.push({ path: src, reason: 'destination-taken' }); return; }
  if (pick.same) { out.skipped.push({ path: src, reason: 'already-archived' }); return; }
  if (apply) {
    try { moveFile(src, pick.dest); } catch (error) { out.errors.push({ path: src, error: message(error) }); return; }
  }
  out.moved.push({ from: src, to: pick.dest });
  out.movedBytes += stat.size;
}

/* ------------------------------------------------------------------ the API */

/**
 * One housekeeping pass over the agent session roots. Reads the windows from
 * `allocation` (the runtimes.yaml allocation object, its .housekeeping block, or
 * the housekeeping block itself); absent `allocation`, allocationSettings()
 * supplies them. `now`/`env` are injected by specs. With apply=false nothing is
 * written — moved/deleted/freedBytes report what an apply run would do.
 * Returns {ok, freedBytes, movedBytes, deleted[], moved[{from,to}], skipped[{path,reason}], errors[{path,error}]}.
 */
export async function sweepAgentSessions({ apply = false, now = Date.now(), env = process.env, allocation } = {}) {
  const out = result();
  const hk = housekeepingOf(allocation);
  const archiveAfterMs = positiveNumber(hk.sessionArchiveAfterMs, HK_SESSION_DEFAULTS.sessionArchiveAfterMs);
  const archiveMaxAgeMs = positiveNumber(hk.archiveMaxAgeMs, HK_SESSION_DEFAULTS.archiveMaxAgeMs);
  const archiveRoot = archiveRootOf({ env });
  const skip = (p, reason) => out.skipped.push({ path: p, reason });
  const fail = (p, error) => out.errors.push({ path: p, error: message(error) });

  // Phase 1: move stale session files into the archive, keeping the path
  // relative to the agent's home so two roots of one agent never collide.
  for (const root of sessionSweepRoots(env)) sweepSessionRoot(root, { apply, now, archiveAfterMs, archiveRoot, out, skip, fail });

  // Phase 2: archive files past archiveMaxAgeMs are gone for good — still never
  // through a link, and a link-like archive root refuses the whole phase.
  pruneSessionArchive(archiveRoot, { apply, now, archiveMaxAgeMs, env, out, skip, fail });

  // Bytes moved out of the swept homes free their drive exactly like bytes deleted.
  out.freedBytes += out.movedBytes;
  out.ok = out.errors.length === 0;
  return out;
}

/**
 * Move the named session files into <archiveRoot>/<agent>/ at settle time — the
 * item-8 per-op release. No age test (the caller already ended the session); the
 * destination is the basename, deepening to <parent>__<base>, <grand>__<parent>__<base>
 * … only when the plain name is taken. Link-like inputs are skipped, never
 * followed; apply=false produces the report and writes nothing.
 * Returns {ok, freedBytes, movedBytes, deleted: [], moved[{from,to}], skipped[{path,reason}], errors[{path,error}]}.
 */
export async function archiveSessionFiles(paths, { archiveRoot, agent, now = Date.now(), apply = false } = {}) {
  // `now` stays in the settle-time signature; no age test applies here.
  if (typeof archiveRoot !== 'string' || !archiveRoot.trim() || typeof agent !== 'string' || !agent.trim()) {
    throw new Error('archiveSessionFiles needs {archiveRoot, agent}');
  }
  const out = result();
  const root = path.resolve(archiveRoot);
  if (isLinkLike(root)) {
    out.errors.push({ path: root, error: 'archive root is link-like' });
    for (const p of paths ?? []) out.skipped.push({ path: String(p), reason: 'archive-root-unusable' });
    out.ok = false;
    return out;
  }
  const taken = new Set();
  for (const input of paths ?? []) archiveOneSessionFile(input, { root, agent, apply, taken, out });
  out.freedBytes = out.movedBytes;
  out.ok = out.errors.length === 0;
  return out;
}
