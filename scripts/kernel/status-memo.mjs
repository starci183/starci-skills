// status-memo.mjs - `starci kernel status` with its Orca reads prefetched in parallel and its git reads memoised.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSyncOverride } from '../api/process/spawn-sync-override.mjs';
import { execAsSpawnSync } from '../api/process/exec-as-spawn-sync.mjs';
import { JOB_STATUSES } from '../../engine/db/ledger.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { headShaOf } from '../lib/git-dir.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';
import { jobPayloadOf, operationTerminalHandleOf } from './verbs/shared/rows.mjs';
import { JOB_ROW } from '../machine/job-row.mjs';

/* ------------------------------------------------------- status git memo */
// starci kernel status took 26-31 s per workflow under load (8 s idle) on a product ledger, nearly all of it in
// spawnSync: every git call pays a process start (0.1-2.5 s on a loaded Windows host), and status repeated
// the same reads - runtime-rev.mjs re-resolved the current rev once per running job and re-diffed the same
// commit pair on every call, and two typed waits naming the same --until-commit targets ran the same
// rev-parse/ls-tree/log twice. While status runs, spawnSync of a read-only git verb is memoised:
//   - within the call, an identical read (root, argv, input, encoding) answers from memory;
//   - across calls, a read whose every revision is a full commit sha (HEAD is pinned to the sha the git
//     files name, gitHeadShaOf, no spawn) answers from a file under
//     STARCI_GIT_MEMO_DIR (default <tmpdir>/starci-git-memo). Such an answer is immutable, so the memo
//     needs no invalidation; only a clean exit (status 0, no spawn error) is kept, so a timeout or a
//     revision git does not know yet is asked again.
// The Orca reads status makes (terminal show and read per worker terminal) each
// cost 1-3 s of orca.exe start under load and ran one after another; prefetchStatusOrcaReads runs them in
// parallel just before the projection, and the projection's own call takes the prefetched answer once
// (a failed or timed-out prefetch is asked again live). STARCI_STATUS_MEMO=off turns all of it off.
// Every other spawn, and every git verb that reads refs or the worktree, runs live.
const GIT_MEMO_SCHEMA = 'starci/status-git-memo@1';
const GIT_READ_VERBS = new Set(['rev-parse', 'ls-tree', 'log', 'show', 'diff', 'cat-file']);
// The flags a pinned read may carry: each shapes the answer from the named objects alone.
const GIT_PINNED_FLAG_RX = /^(--verify|--quiet|-q|--name-only|--name-status|-r|-z|-\d+|-e|-t|-s|--batch|--batch-check|--format=.*|--pretty=.*)$/s;
const GIT_PINNED_REV_RX = /^(HEAD|[0-9a-f]{40})(\^\{commit\}|:.*)?$/s;
// One entry holds at most GIT_MEMO_MAX_BYTES (a product repo's committed-Work cat-file batch runs ~4 MB); the
// directory is kept under GIT_MEMO_BUDGET_BYTES least-recently-used first (a hit refreshes its mtime), since
// every product commit pins a new HEAD and strands the entries of the old one.
const GIT_MEMO_MAX_BYTES = 16 * 1024 * 1024;
const GIT_MEMO_BUDGET_BYTES = 256 * 1024 * 1024;
const GIT_MEMO_TTL_MS = 14 * 24 * 3600 * 1000;
const gitMemoDirOf = (env = process.env) => (env.STARCI_GIT_MEMO_DIR ? path.resolve(env.STARCI_GIT_MEMO_DIR) : path.join(os.tmpdir(), 'starci-git-memo'));

/**
 * The commit HEAD names in the checkout at `root` (its top level), read from the git files with no spawn; null
 * when it cannot be told that way (not a top level, reftable, an unreadable ref), and the read then runs live.
 * Branch refs are read from the common dir only, as git does for a linked worktree.
 */
const gitHeadShaOf = (root) => headShaOf(root, { headsOnly: true, commonOnly: true });

/** A spawnSync call as a read-only git read {root, verb, args}, or null. */
const gitReadOf = (command, argv, options) => {
  if (!/^git(\.exe)?$/i.test(path.basename(String(command ?? ''))) || !Array.isArray(argv)) return null;
  let root = options?.cwd ?? process.cwd(), rest = argv.map(String);
  if (rest[0] === '-C' && rest.length > 1) { root = rest[1]; rest = rest.slice(2); }
  return GIT_READ_VERBS.has(rest[0]) ? { root: path.resolve(String(root)), verb: rest[0], args: rest.slice(1) } : null;
};

/** The arguments of a pinned git read, each revision pinned: {out, revs}, or null when one is not (pin returns null). */
const pinnedArgsOf = (args, pin) => {
  const out = [];
  let paths = false, revs = 0;
  for (const arg of args) {
    if (paths) { out.push(arg); continue; }
    if (arg === '--') { paths = true; out.push(arg); continue; }
    if (arg.startsWith('-')) { if (!GIT_PINNED_FLAG_RX.test(arg)) { return null; } out.push(arg); continue; }
    const pinned = pin(arg);
    if (!pinned) return null;
    out.push(pinned); revs += 1;
  }
  return { out, revs };
};
/**
 * The cross-call key of a git read whose answer is fixed by commit objects alone, or null: every revision
 * is a full sha (HEAD pinned to its sha), every flag is in GIT_PINNED_FLAG_RX, a diff compares two commits
 * (one would read the worktree), a rev-parse only verifies (--abbrev-ref and the like read refs), and an
 * input is cat-file's list of pinned object names.
 */
const pinnedGitKeyOf = ({ root, verb, args }, input = null) => {
  let head;
  const headSha = () => {
    if (head === undefined) { head = gitHeadShaOf(root); }
    return head;
  };
  const pin = (spec) => {
    const m = GIT_PINNED_REV_RX.exec(spec);
    if (!m) return null;
    const rev = m[1] === 'HEAD' ? headSha() : m[1];
    return rev ? `${rev}${m[2] ?? ''}` : null;
  };
  const pinnedArgs = pinnedArgsOf(args, pin);
  if (!pinnedArgs) return null;
  const { out, revs } = pinnedArgs;
  let lines = null;
  if (input != null) {
    if (verb !== 'cat-file') return null;
    lines = String(input).split('\n').map((line) => (line === '' ? '' : pin(line.replace(/\r$/, ''))));
    if (lines.some((line) => line == null)) return null;
  }
  if (verb === 'diff' && revs !== 2) return null;
  if (verb === 'rev-parse' && !(revs === 1 && args.includes('--verify'))) return null;
  if (revs === 0 && !lines?.some(Boolean)) return null;
  return JSON.stringify([GIT_MEMO_SCHEMA, root, verb, out, lines]);
};

const gitMemoFileOf = (dir, key) => path.join(dir, `${createHash('sha256').update(key).digest('hex').slice(0, 40)}.json`);
const gitMemoResult = (stdout, text) => {
  const out = text ? stdout : Buffer.from(stdout, 'base64'), err = text ? '' : Buffer.alloc(0);
  return { pid: 0, output: [null, out, err], stdout: out, stderr: err, status: 0, signal: null };
};
const readGitMemo = (dir, key, text) => {
  try {
    const file = gitMemoFileOf(dir, key);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (doc?.key !== key || doc.text !== text || typeof doc.stdout !== 'string') return null;
    try { const now = new Date(); fs.utimesSync(file, now, now); } catch { /* recency is best effort */ }
    return gitMemoResult(doc.stdout, text);
  } catch { return null; }
};
const writeGitMemo = (dir, key, stdout, text) => {
  try {
    const body = text ? String(stdout ?? '') : Buffer.from(stdout ?? []).toString('base64');
    if (body.length > GIT_MEMO_MAX_BYTES) return;
    fs.mkdirSync(dir, { recursive: true });
    const file = gitMemoFileOf(dir, key), tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ key, text, stdout: body }));
    try { fs.renameSync(tmp, file); } catch { fs.rmSync(tmp, { force: true }); }
    pruneGitMemo(dir);
  } catch { /* a memo that cannot be written is asked again next call */ }
};
/** Drops entries unused past GIT_MEMO_TTL_MS, then the least recently used until the dir fits `budget`. */
const pruneGitMemo = (dir, { now = Date.now(), budget = GIT_MEMO_BUDGET_BYTES } = {}) => {
  try {
    const entries = [];
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      try {
        const st = fs.statSync(file);
        if (now - st.mtimeMs > GIT_MEMO_TTL_MS) fs.rmSync(file, { force: true });
        else entries.push({ file, size: st.size, used: st.mtimeMs });
      } catch { /* raced */ }
    }
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries.toSorted((a, b) => a.used - b.used)) {
      if (total <= budget) break;
      try { fs.rmSync(entry.file, { force: true }); total -= entry.size; } catch { /* raced */ }
    }
  } catch { /* no memo dir yet */ }
};

const spawnKeyOf = (command, argv) => JSON.stringify([String(command), (Array.isArray(argv) ? argv : []).map(String)]);

/**
 * Runs `fn` with spawnSync answering the `prefetched` spawns ({spawnKeyOf: result}, each once) and
 * memoising read-only git reads (see above); the original is restored after.
 */
export function withStatusSpawnMemo(fn, { prefetched = new Map(), env = process.env } = {}) {
  if (env.STARCI_STATUS_MEMO === 'off') return fn();
  return spawnSyncOverride((original) => (original.statusMemo ? null : statusMemoOf(original, { prefetched, dir: gitMemoDirOf(env) })), fn);
}

/** The memoising spawnSync over `original` (withStatusSpawnMemo). */
function statusMemoOf(original, { prefetched, dir }) {
  const seen = new Map();
  const memoised = function spawnSyncStatusMemo(command, argv, options) {
    const ahead = spawnKeyOf(command, argv);
    if (prefetched.has(ahead)) { const result = prefetched.get(ahead); prefetched.delete(ahead); return result; }
    const read = gitReadOf(command, argv, options);
    if (!read) return original.apply(this, arguments);
    const encoding = options?.encoding ?? null, input = options?.input == null ? null : String(options.input);
    const text = encoding === 'utf8' || encoding === 'utf-8', raw = encoding == null || encoding === 'buffer';
    const local = JSON.stringify([read.root, read.verb, read.args, input, encoding]);
    if (seen.has(local)) return seen.get(local);
    const key = text || raw ? pinnedGitKeyOf(read, input) : null;
    const hit = key ? readGitMemo(dir, key, text) : null;
    if (hit) { seen.set(local, hit); return hit; }
    const result = original.apply(this, arguments);
    if (result && !result.error) {
      seen.set(local, result);
      // A HEAD that moved while git ran may have answered for the new commit: kept only when the pin held.
      if (key && result.status === 0 && pinnedGitKeyOf(read, input) === key) writeGitMemo(dir, key, result.stdout, text);
    }
    return result;
  };
  memoised.statusMemo = true;
  return memoised;
}

/** The jobs whose worker status observes: open, and running, leased or bound to a terminal. */
export const statusWorkerRowsOf = (db, workflowId) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel'
    AND status NOT IN (${JOB_STATUSES.settled.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
  .all(workflowId, ...JOB_STATUSES.settled)
  .filter((job) => job.status === 'running' || job.status === 'leased' || operationTerminalHandleOf(job));

function spawnSyncRecorder(calls, command, argv, options) {
  calls.push({ command, argv: Array.isArray(argv) ? argv : [], options: (Array.isArray(argv) ? options : argv) ?? {} });
  const error = Object.assign(new Error('recorded, not run'), { code: 'ERECORDED' });
  return { pid: 0, output: [null, '', ''], stdout: '', stderr: '', status: null, signal: null, error };
}

/** The spawns `fn` makes, recorded instead of run (each answers a spawn error, which the wrappers absorb). */
const recordSpawns = (fn) => {
  const calls = [];
  spawnSyncOverride(() => (command, argv, options) => spawnSyncRecorder(calls, command, argv, options), () => { try { fn(); } catch { /* a wrapper that throws records what it reached */ } });
  return calls;
};

const STATUS_PREFETCH_CONCURRENCY = 8;
/**
 * The Orca reads status is about to make for `workflowId` - terminal show and read of every observed
 * worker terminal (a released worker is not observed) - run in parallel: {spawnKeyOf: result} for
 * withStatusSpawnMemo. The orchestration check is never prefetched: it consumes a Delivery.
 */
export async function prefetchStatusOrcaReads(db, workflowId, env = process.env) {
  const prefetched = new Map();
  if (env.STARCI_STATUS_MEMO === 'off') return prefetched;
  const rows = statusWorkerRowsOf(db, workflowId).filter((job) => operationTerminalHandleOf(job));
  if (!rows.length) return prefetched;
  const handles = [...new Set(rows.filter((job) => jobPayloadOf(job).workerReleased?.custody?.state !== 'released').map((job) => operationTerminalHandleOf(job)))];
  const calls = recordSpawns(() => {
    for (const terminal of handles) { terminalShow({ terminal }); terminalRead({ terminal, screen: true }); }
  });
  const results = await mapConcurrent(calls, STATUS_PREFETCH_CONCURRENCY, execAsSpawnSync);
  calls.forEach((call, index) => { if (results[index]) prefetched.set(spawnKeyOf(call.command, call.argv), results[index]); });
  return prefetched;
}

/** starci kernel status with its Orca reads prefetched in parallel and its git reads memoised (see status git memo). */
/** `fn` over `items` with at most `limit` in flight; results in item order. */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => repeatInOrder(async () => {
    if (next >= items.length) return true;
    const index = next++;
    results[index] = await fn(items[index]);
    return undefined;
  })));
  return results;
}
