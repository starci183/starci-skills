// hk-logs.mjs — the housekeeping sweep's log/transcript cap (STORAGE-PROMPT "StarCi logs"
// and item 9 "Orca-owned dirs"). One pass, never through a link, never inside a checkout,
// never into a file family the runtime already rotates.
//
//   sweepStarciLogs({ apply, now, env, allocation })
//
// Roots:
//   <LOCALAPPDATA>/StarCi     (runtimeRootFor's parent: runtime/, archive/, runtime-v6/)
//   <USERPROFILE>/.starci     (supervisor home, redundancy handoffs, backups; lanes/ and
//                             supervisor staging/land are git worktrees — skipped on the
//                             .git marker, the lanes lane owns them)
//   <APPDATA>/orca            terminal-history/ and logs/ capped by age; orchestration.db
//                             is REPORTED ONLY — Orca owns it, never opened/touched.
//
// Families that already rotate (rename-to-.1 at a byte cap) are skipped, not given a
// second mechanism:
//   runtime/watchdog-logs/*.log(.N)   rotateLog on spawn (resume-all.mjs spawnWatchdog)
//                                     and on self-reload (self-reload.mjs reexecSelf)
//   runtime/connectors/{telegram-bridge,telegram-media,cloudflared,stall-alert}.log(.N)
//                                     each writer self-rotates (self-reload rotateLog 5 MB;
//                                     telegram-media.mjs 1 MB; tunnel.mjs 5 MB; stall-alert.mjs 2 MB)
//   ~/.starci/supervisor/logs/*.log(.N)  supervisorLog rotates through rotateLog (home.mjs)
//
// Cap for the rest: a covered *.log/*.jsonl (and their .N siblings) older than
// allocation.housekeeping.logMaxAgeMs is deleted; a younger one past logCapBytes is
// rotated to <file>.1 the same way the codebase's own rotateLog does (keep-tail
// truncation exists nowhere in this codebase — rename-rotate is the established cap, and
// the .1 it makes becomes age-deletable on a later sweep). A file a process still holds
// (EBUSY/EPERM/EACCES) or that vanished mid-sweep is skipped, never an error.
//
// Not logs, never touched: *.inbox.jsonl / *.outbox.jsonl — the supervisor Telegram
// channel's message queues (scripts/supervisor/channel.mjs); deleting one drops owner asks.
// Orca CLI 1.4.209 exposes no retention/prune command for orchestration.db, logs or
// terminal-history (`orchestration reset` exists but wipes state — not a retention tool).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { runtimeRootFor } from '../../engine/ledger-db.mjs';
import { isLinkLike } from './safe-remove.mjs';
import { rotateLog, LOG_CAP_BYTES } from './self-reload.mjs';
import { pathKey } from './path-key.mjs';

/** Spec-agreed window and cap. logMaxAgeMs: runtimes.yaml allocation.housekeeping.logMaxAgeMs (14d). */
export const DEFAULT_LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** The codebase's declared log cap (self-reload.mjs LOG_CAP_BYTES); housekeeping.logCapBytes overrides. */
export const DEFAULT_LOG_CAP_BYTES = LOG_CAP_BYTES;

const COVERED = /\.(log|jsonl)(\.\d+)?$/i;       // *.log, *.jsonl and their .N rotated siblings
const BASE = /\.(log|jsonl)$/i;                 // a cap-rotate target: never a .N sibling
const CHANNEL_QUEUE = /\.(inbox|outbox)\.jsonl$/i;
const BUSY = new Set(['EBUSY', 'EPERM', 'EACCES']);
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const LIST_MAX = 500;

const realOf = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };
const sizeOf = (p) => { try { return fs.statSync(p).size; } catch { return null; } };

/** The directories whose *.log the runtime already rotates (see header); each entry also owns the .N siblings. */
export const rotatedLogFamilies = (starciRoot, starciHome) => [
  { name: 'watchdog-logs', dir: path.join(starciRoot, 'runtime', 'watchdog-logs'), match: /\.log(\.\d+)?$/i,
    why: 'rotated by rotateLog on watchdog spawn (scripts/kernel/resume-all.mjs spawnWatchdog) and on self-reload (scripts/lib/self-reload.mjs reexecSelf)' },
  { name: 'connector-logs', dir: path.join(starciRoot, 'runtime', 'connectors'), match: /^(telegram-bridge|telegram-media|cloudflared|stall-alert)\.log(\.\d+)?$/i,
    why: 'self-rotated by their writers (telegram-bridge rotateLog 5 MB; telegram-media.mjs 1 MB; tunnel.mjs cloudflared 5 MB; stall-alert.mjs 2 MB)' },
  { name: 'supervisor-logs', dir: path.join(starciHome, 'supervisor', 'logs'), match: /\.log(\.\d+)?$/i,
    why: 'rotated by supervisorLog through rotateLog at LOG_CAP_BYTES (scripts/supervisor/home.mjs)' },
];

/**
 * Sweep the log roots. `allocation` is the runtimes.yaml allocation block (default: the real one);
 * only housekeeping.logMaxAgeMs / housekeeping.logCapBytes are read from it. With apply=false nothing
 * changes and deleted/truncated are the plan (each entry marked dry:true).
 * Returns { ok, apply, freedBytes, deleted, truncated, skipped, errors, report }.
 */
export async function sweepStarciLogs({ apply = false, now = Date.now(), env = process.env, allocation } = {}) {
  const hk = (allocation ?? allocationSettings())?.housekeeping ?? {};
  const maxAgeMs = Number(hk.logMaxAgeMs) > 0 ? Number(hk.logMaxAgeMs) : DEFAULT_LOG_MAX_AGE_MS;
  const capBytes = Number(hk.logCapBytes) > 0 ? Number(hk.logCapBytes) : DEFAULT_LOG_CAP_BYTES;
  const cutoff = now - maxAgeMs;
  const home = env.USERPROFILE || env.HOME || os.homedir();
  const starciRoot = path.dirname(runtimeRootFor(env));
  const starciHome = path.join(home, '.starci');
  const orcaRoot = path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'orca');

  const out = { ok: true, apply, freedBytes: 0, deleted: [], truncated: [], skipped: [], errors: [],
    report: { roots: { starci: starciRoot, starciHome, orca: orcaRoot }, logMaxAgeMs: maxAgeMs, logCapBytes: capBytes,
      orchestrationDbBytes: null, orchestrationDbWalBytes: null, orchestrationDbShmBytes: null,
      rotatedFamilies: [], notes: [] } };
  const overflow = { deleted: 0, truncated: 0, skipped: 0, errors: 0 };
  const push = (key, entry) => { (out[key].length < LIST_MAX ? out[key].push(entry) : overflow[key] += 1); };

  const skip = (p, reason) => push('skipped', { path: p, reason });
  const fail = (p, error) => { out.ok = false; push('errors', { path: p, code: error?.code ?? 'ERROR', message: String(error?.message ?? error) }); };
  const unlink = (p, st) => {
    const entry = { path: p, bytes: st.size, ...(apply ? {} : { dry: true }) };
    if (!apply) { push('deleted', entry); out.freedBytes += st.size; return; }
    try { fs.unlinkSync(p); push('deleted', entry); out.freedBytes += st.size; }
    catch (error) { error?.code === 'ENOENT' ? skip(p, 'gone') : BUSY.has(error?.code) ? skip(p, error.code) : fail(p, error); }
  };
  // The established cap: rename to <file>.1 like rotateLog (keep-tail truncation is used nowhere in
  // this codebase). The bytes move to the sibling — freedBytes counts only the .1 it replaces.
  const rotate = (p, st) => {
    const sibling = `${p}.1`;
    const replaced = sizeOf(sibling) ?? 0;
    const entry = { path: p, fromBytes: st.size, toBytes: 0, via: 'rename-.1', rotatedTo: sibling, freedBytes: replaced, ...(apply ? {} : { dry: true }) };
    if (!apply) { push('truncated', entry); out.freedBytes += replaced; return; }
    try { rotateLog(p, { cap: capBytes }); push('truncated', entry); out.freedBytes += replaced; }
    catch (error) { error?.code === 'ENOENT' ? skip(p, 'gone') : BUSY.has(error?.code) ? skip(p, error.code) : fail(p, error); }
  };

  // One recursive walk: never into a link, never into .git/node_modules, never inside a git
  // checkout (a dir holding a .git entry — lane worktrees, supervisor staging/land).
  const walk = (dir, parentReal, onFile, dirs = null) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { fail(dir, error); return; }
    if (entries.some((e) => e.name === '.git')) { skip(dir, 'git-checkout'); return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      let st;
      try { st = fs.lstatSync(p); } catch (error) { if (error?.code !== 'ENOENT') fail(p, error); continue; }
      if (st.isDirectory()) {
        if (isLinkLike(p, { parentReal, stat: st })) { skip(p, 'link'); continue; }
        if (SKIP_DIRS.has(e.name)) { skip(p, `excluded-dir:${e.name}`); continue; }
        dirs?.push(p);
        walk(p, realOf(p) ?? parentReal, onFile, dirs);
      } else onFile(p, st);
    }
  };
  const sweepRoot = (root, onFile, dirs = null) => {
    const resolved = path.resolve(root);
    let st;
    try { st = fs.lstatSync(resolved); } catch { return; }   // absent root: nothing to do
    if (isLinkLike(resolved, { stat: st }) || !st.isDirectory()) { skip(resolved, 'link-or-not-a-dir'); return; }
    walk(resolved, realOf(resolved) ?? resolved, onFile, dirs);
  };

  const families = rotatedLogFamilies(starciRoot, starciHome).map((f) => ({ ...f, dirKey: pathKey(f.dir) }));
  out.report.rotatedFamilies = families.map(({ name, dir, why }) => ({ name, dir, why }));
  const starciFile = (p, st) => {
    const name = path.basename(p);
    if (st.isSymbolicLink()) { skip(p, 'link'); return; }
    if (!COVERED.test(name)) return;
    if (CHANNEL_QUEUE.test(name)) { skip(p, 'channel-queue'); return; }
    const dirKey = pathKey(path.dirname(p));
    const family = families.find((f) => f.dirKey === dirKey);
    if (family && family.match.test(name)) { skip(p, `rotated:${family.name}`); return; }
    if (st.mtimeMs < cutoff) { unlink(p, st); return; }
    if (BASE.test(name) && st.size > capBytes) rotate(p, st);
  };
  sweepRoot(starciRoot, starciFile);
  sweepRoot(starciHome, starciFile);

  // Orca-owned dirs (item 9): terminal-history/ and logs/ capped by the same age — every aged file
  // goes (Orca's own rotated daemon.log.N / main.trace.ndjson.N included); emptied dirs are removed
  // (a dead terminal's history dir). No cap-rotate here: Orca rotates its logs itself, and a live
  // Orca file answers EBUSY -> skipped. orchestration.db is reported, never opened.
  const orcaDirs = [];
  const orcaFile = (p, st) => {
    if (st.isSymbolicLink()) { skip(p, 'link'); return; }
    if (st.mtimeMs < cutoff) unlink(p, st);
  };
  for (const name of ['terminal-history', 'logs']) sweepRoot(path.join(orcaRoot, name), orcaFile, orcaDirs);
  for (let i = orcaDirs.length - 1; i >= 0; i -= 1) {
    const dir = orcaDirs[i];
    if (!apply) continue;
    try { fs.rmdirSync(dir); } catch { /* not empty or not ours to remove */ }
  }

  const db = path.join(orcaRoot, 'orchestration.db');
  out.report.orchestrationDbBytes = sizeOf(db);
  out.report.orchestrationDbWalBytes = sizeOf(`${db}-wal`);
  out.report.orchestrationDbShmBytes = sizeOf(`${db}-shm`);
  out.report.notes = [
    'orchestration.db is Orca-owned: size reported only, never opened/edited/vacuumed; orca CLI 1.4.209 has no retention or prune command (`orchestration reset` wipes state — not used).',
    'cap mechanism: rename to <file>.1 through rotateLog (the codebase\'s one cap convention); keep-tail truncation exists nowhere here; the .1 sibling is age-deleted on a later sweep.',
    '*.inbox.jsonl/*.outbox.jsonl are the supervisor channel\'s message queues (data, not logs): never touched.',
    'gap: append-only runtime jsonl under <skillRoot>/runtime/guards/ (refusals.jsonl, footprint.jsonl) lives in the checkout, outside these roots — uncapped by this sweep.',
  ];
  if (Object.values(overflow).some((n) => n)) out.report.overflow = overflow;
  return out;
}
