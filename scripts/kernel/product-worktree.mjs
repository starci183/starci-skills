#!/usr/bin/env node
// product-worktree.mjs — the reap of a payload.productWorktree and its duty (the per-op land is deleted: part B).
//
// SUPERSEDED (owner decision WFWT, final): one Orca-owned worktree per Kernel workflow replaces the per-op worktree
// (scripts/kernel/workflow-worktree.mjs). Part A deleted the per-op CREATION (ensureOpWorktree, its layout, the
// node_modules junction overlay, the isolation policy): no dispatch makes a payload.productWorktree any more. Part B
// deleted integrateOp (the workflow lands once, at api finish: scripts/kernel/workflow-checkpoint.mjs); the reap and the
// duty below remain for payload.productWorktree records an earlier runtime wrote.
//
// Lifecycle (job state machine: reported -> settled -> released -> worktree-removed):
//   settle     no land: the work lands into main only at its workflow's finish (workflow-checkpoint.mjs finishWorkflow)
//   released   removeOpWorktree right after the worker is released (api settle spawns `reap`; the settler's
//              productWorktreeDuty is the backstop): evidence salvaged, a failed/blocked op's work preserved to
//              refs/heads/preserved/<job>, junctions removed, tree removed and verified, branch deleted (`branch -d`
//              once landed). SLA: <= opRemoveSlaMs (1 min) after settle.
//   leftovers  the reconciler GC controller's gc:worktrees pass (scripts/lib/worktrees.mjs gcWorktrees), always active.
//
//   node scripts/kernel/product-worktree.mjs reap --repo <ledger repo> [--job <id>] [--json]   the duty for one ledger/job
//   node scripts/kernel/product-worktree.mjs status --repo <ledger repo> [--json]              live product worktrees
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runGit } from '../lib/git.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { isLinkLike } from '../lib/safe-remove.mjs';
import { claimManager } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { isWorktreesPath } from '../lib/worktree-exclude.mjs';
import { removeScratchWorktree, registeredAt, worktreesRootOf, PRESERVED_PREFIX } from '../lib/worktrees.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';

export { worktreesRootOf };
const selfFile = fileURLToPath(import.meta.url);
export const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..');
export const SETTINGS_FILE = path.join(SKILL_ROOT, 'modules', 'kernel', 'product-land.yaml');
export const EVENTS = Object.freeze({
  created: 'product-worktree-created',
  removed: 'job-worktree-removed',
  removeFailed: 'job-worktree-remove-failed',
  slaMissed: 'product-worktree-sla-missed',
});
const SETTLED = SETTLED_JOB_LIST;

/* ------------------------------------------------------------ settings */

const DEFAULTS = Object.freeze({
  worktrees: { capPerRepo: 10, ownerGoneMs: 1_800_000, gcEveryMs: 300_000, opRemoveSlaMs: 60_000, commandMs: 300_000 },
  invariant: { importsCacheMs: 300_000 },
});
const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b ?? a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
  return out;
};
/** modules/kernel/product-land.yaml over the defaults. */
export function productSettings(file = SETTINGS_FILE) {
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { doc = null; }
  return merge(DEFAULTS, doc ?? {});
}

/* ------------------------------------------------------------ git */

/** git in `cwd`: {ok, status, stdout, stderr}. */
export function git(cwd, args, { env = null, timeout = 300_000, input = undefined } = {}) {
  const r = runGit(args, { cwd, timeout, input, env: env ? { ...process.env, ...env } : process.env, maxBuffer: 256 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
}
const revParse = (cwd, ref) => { const r = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return r.ok && r.stdout ? r.stdout : null; };
export const isAncestor = (cwd, a, b) => git(cwd, ['merge-base', '--is-ancestor', a, b]).ok;
const posix = (p) => String(p).replace(/\\/g, '/');

/* ------------------------------------------------------------ ids */

export const hashIdOf = (id, len = 8) => crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, len);

/* ------------------------------------------------------------ locks */

/** Hold the named host lock around fn (poll until waitMs). {ok:false, holder} when it never frees. */
export function withLock(name, fn, { waitMs = 600_000, pollMs = 1000, env = process.env } = {}) {
  const end = Date.now() + waitMs;
  for (;;) {
    const held = claimManager(name, { env });
    if (held.ok) { try { return fn(); } finally { held.release(); } }
    if (Date.now() >= end) return { ok: false, reason: 'lock-busy', lock: name, holder: held.holder ?? null };
    sleepSync(pollMs);
  }
}
const repoKey = (repoRoot) => hashIdOf(posix(path.resolve(repoRoot)).toLowerCase(), 10);
/** The per-repository land lock: one workflow lands into a repository's main at a time (workflow-checkpoint.mjs). */
export const landLockName = (repoRoot) => `product-land-${repoKey(repoRoot)}`;

/* ------------------------------------------------------------ the op worktree */

/** The preserved work of `jobId` (a failed/blocked op's uncommitted changes and unlanded commits), or null. */
export function preservedOpRef(repoRoot, jobId) {
  const ref = `refs/heads/${PRESERVED_PREFIX}/${jobId}`;
  const sha = revParse(repoRoot, ref);
  return sha ? { ref, sha } : null;
}

/** payload.productWorktree of a job payload, or null. */
export const jobWorktreeOf = (jobOrPayload) => {
  const payload = typeof jobOrPayload?.payload_json === 'string' ? (() => { try { return JSON.parse(jobOrPayload.payload_json); } catch { return {}; } })() : (jobOrPayload?.payload ?? jobOrPayload);
  const rec = payload?.productWorktree;
  return rec && rec.repoRoot && rec.op?.path && rec.op?.branch ? rec : null;
};

/* ------------------------------------------------------------ removal */

/**
 * Salvage what the worktree holds that no commit carries, before it is deleted: every dirty or untracked file under
 * .starciwork/ is copied to `dest` and verified byte-equal; other uncommitted tracked changes are kept as
 * dest/uncommitted.patch. {ok, copied: [rel], patch: file|null, missing: [rel]} - ok only when every .starciwork file
 * was copied and verified.
 */
export function salvageEvidence(worktree, dest) {
  const out = { ok: true, copied: [], patch: null, missing: [] };
  if (!fs.existsSync(worktree)) return out;
  const st = git(worktree, ['status', '--porcelain', '-z', '--untracked-files=all']);
  if (!st.ok) return { ...out, ok: false, reason: 'status-failed', detail: st.stderr.slice(0, 200) };
  const recs = st.stdout.split('\0');
  const files = [];
  for (let i = 0; i < recs.length; i++) {
    if (!recs[i]) continue;
    const code = recs[i].slice(0, 2), rel = recs[i].slice(3);
    if (/[RC]/.test(code)) i++;
    if (isWorktreesPath(rel)) continue;
    files.push({ code, rel: posix(rel) });
  }
  const evidence = files.filter((f) => f.rel === '.starciwork' || f.rel.startsWith('.starciwork/'));
  for (const f of evidence) {
    const src = path.join(worktree, f.rel);
    const walk = (abs, rel) => {
      let s; try { s = fs.lstatSync(abs); } catch { return; }
      if (s.isDirectory() && !isLinkLike(abs, { stat: s })) { for (const n of fs.readdirSync(abs)) walk(path.join(abs, n), `${rel}/${n}`); return; }
      if (!s.isFile()) return;
      const to = path.join(dest, 'worktree-salvage', ...rel.split('/'));
      try {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(abs, to);
        if (!fs.readFileSync(abs).equals(fs.readFileSync(to))) throw Error('copy differs');
        out.copied.push(rel);
      } catch { out.missing.push(rel); }
    };
    walk(src, f.rel.replace(/\/+$/, ''));
  }
  const tracked = files.filter((f) => f.code !== '??' && !(f.rel.startsWith('.starciwork/')));
  if (tracked.length) {
    const diff = git(worktree, ['diff', 'HEAD', '--binary']);
    if (diff.stdout) {
      const file = path.join(dest, 'worktree-salvage', 'uncommitted.patch');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${diff.stdout}\n`);
      out.patch = file;
    }
  }
  out.ok = out.missing.length === 0;
  return out;
}

/**
 * Remove a job's op worktree and branch (released -> worktree-removed): evidence salvaged (when `salvageTo`); with
 * `preserve` (every op that did not succeed: failed, blocked, cancelled) its uncommitted work and the commits main lacks
 * go to refs/heads/preserved/<job> first (nothing to keep: no ref; a continuation starts from it),
 * then scripts/lib/worktrees.mjs removeScratchWorktree - junctions first, the tree, prune, verified - and the branch deleted
 * (`branch -d` once landed in main; `-D` only after the preserve). Nothing is left: no tree, no op branch.
 */
export function removeOpWorktree({ record, salvageTo = null, preserve = true, env = process.env }) {
  const { repoRoot } = record;
  const main = record.main ?? 'main';
  const out = { ok: false, path: record.op.path };
  if (salvageTo && fs.existsSync(record.op.path)) {
    out.salvage = salvageEvidence(record.op.path, salvageTo);
    if (!out.salvage.ok) return { ...out, reason: 'evidence-unsalvaged' };
  }
  const tip = revParse(repoRoot, `refs/heads/${record.op.branch}`);
  const mainTip = revParse(repoRoot, main);
  const landed = Boolean(tip && mainTip && isAncestor(repoRoot, tip, mainTip));
  const r = removeScratchWorktree({ repoRoot, dir: record.op.path, branch: record.op.branch, deleteBranch: landed ? 'merged' : 'force', preserve: preserve ? { name: record.jobId } : null, main, env });
  return { ...r, salvage: out.salvage, landed };
}

/* ------------------------------------------------------------ the duty (settler backstop) */

const parse = (t) => { try { return JSON.parse(t); } catch { return null; } };
const hasEvent = (db, jobId, kind) => Boolean(db.prepare('SELECT 1 FROM events WHERE entity_id=? AND kind=? LIMIT 1').get(jobId, kind));
const releasedOf = (db, row, payload) => hasEvent(db, row.job_id, 'job-settle-released')
  || payload?.terminalClosed?.verified?.ok === true || payload?.terminalClosed?.custody?.state === 'released'
  || payload?.workerReleased?.custody?.state === 'closed-verified' || payload?.managedWorker?.custody?.state === 'released'
  || (!row.worker_id && !payload?.orca?.agentTerminalHandle && !payload?.managed);

/**
 * A workflow's end as the ledger sees it: {ended, refused}. `refused` - archived: events_refuse_archived refuses every
 * event of it, so a write would throw on every pass. `ended` - archived or finished: its jobs' worktrees are still
 * removed and verified, but no job event is written for them (nothing reads it any more, and a refused write retried
 * each pass is a hot loop).
 */
export function workflowEndOf(db, workflowId) {
  const w = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
  const refused = w?.phase === 'archived' || Boolean(w?.archived_at);
  return { ended: refused || w?.phase === 'finished', refused };
}

/** Where a job's worktree salvage goes: the ledger repo's durable evidence dir of the job. */
export const salvageDirOf = (ledgerRepo, workflowId, jobId) => path.join(ledgerRepo, '.starciwork', 'evidence', workflowId, jobId);

/**
 * Remove one settled job's op worktree now (api settle's detached `reap`, the settler's duty). Idempotent: a job with a
 * job-worktree-removed event is done. Records the transition released -> worktree-removed (or a typed failure).
 */
export function reapJobWorktree({ ledger, ledgerRepo, jobId, now = Date.now(), force = false, settings = productSettings(), env = process.env }) {
  const db = ledger.db;
  const row = db.prepare('SELECT job_id, workflow_id, status, worker_id, payload_json, updated_at FROM jobs WHERE job_id=?').get(jobId);
  if (!row) return { jobId, skipped: 'job-unknown' };
  const payload = parse(row.payload_json) ?? {};
  const record = jobWorktreeOf(payload);
  if (!record || (record.jobId && record.jobId !== jobId)) return { jobId, skipped: 'not-isolated' };
  if (!SETTLED.includes(row.status)) return { jobId, skipped: `job-${row.status}` };
  if (hasEvent(db, jobId, EVENTS.removed)) return { jobId, skipped: 'already-removed' };
  const { ended } = workflowEndOf(db, row.workflow_id);
  // An ended workflow's job records no event, so "done" is the disk: folder, registration and branch all gone.
  if (ended && !fs.existsSync(record.op.path) && !registeredAt(record.repoRoot, record.op.path) && !revParse(record.repoRoot, `refs/heads/${record.op.branch}`))
    return { jobId, skipped: 'workflow-ended' };
  const released = releasedOf(db, row, payload);
  const settledAgo = now - Number(row.updated_at ?? now);
  if (!released && !force && settledAgo < settings.worktrees.opRemoveSlaMs) return { jobId, skipped: 'awaiting-release' };
  const r = removeOpWorktree({ record, salvageTo: salvageDirOf(ledgerRepo, row.workflow_id, jobId), preserve: row.status !== 'succeeded', env });
  if (ended) return r.ok ? { jobId, removed: true, workflowEnded: true, branch: r.branch, preserved: r.preserved ?? null, verified: r.verified, settledAgoMs: settledAgo }
    : { jobId, removed: false, workflowEnded: true, reason: r.reason, errors: r.errors ?? null };
  const ev = (kind, p) => ledger.transaction(() => ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: jobId, kind, payload: p }));
  if (!r.ok) {
    const prior = db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(jobId, EVENTS.removeFailed);
    if (parse(prior?.payload_json)?.reason !== r.reason) ev(EVENTS.removeFailed, { path: record.op.path, reason: r.reason, errors: r.errors ?? null, salvage: r.salvage ?? null });
    return { jobId, removed: false, reason: r.reason };
  }
  ev(EVENTS.removed, { from: released ? 'released' : 'settled', to: 'worktree-removed', status: row.status, path: record.op.path, branch: r.branch, landed: r.landed,
    preserved: r.preserved ?? null, verified: r.verified, links: r.links ?? 0, salvaged: r.salvage ? { copied: r.salvage.copied.length, patch: Boolean(r.salvage.patch) } : null, settledAgoMs: settledAgo });
  if (settledAgo > settings.worktrees.opRemoveSlaMs) ev(EVENTS.slaMissed, { path: record.op.path, settledAgoMs: settledAgo, slaMs: settings.worktrees.opRemoveSlaMs, released });
  return { jobId, removed: true, branch: r.branch, preserved: r.preserved ?? null, settledAgoMs: settledAgo };
}

/** Isolated jobs of one ledger: [{row, payload, record}] (status filter optional). */
export function isolatedJobs(db, { statuses = null, workflowId = null } = {}) {
  const where = ["json_extract(payload_json,'$.productWorktree.op.path') IS NOT NULL"];
  const args = [];
  if (statuses) { where.push(`status IN (${statuses.map(() => '?').join(',')})`); args.push(...statuses); }
  if (workflowId) { where.push('workflow_id=?'); args.push(workflowId); }
  return db.prepare(`SELECT job_id, workflow_id, status, worker_id, payload_json, updated_at FROM jobs WHERE ${where.join(' AND ')}`).all(...args)
    .map((row) => { const payload = parse(row.payload_json) ?? {}; return { row, payload, record: jobWorktreeOf(payload) }; })
    // A retry's payload may carry its predecessor's record: only a job's OWN record counts.
    .filter((j) => j.record && (!j.record.jobId || j.record.jobId === j.row.job_id));
}

/**
 * One pass for a ledger (the settler calls it every allocation.settler.everyMs): reap every released isolated op
 * worktree. Trees nothing reaped are the reconciler GC's (scripts/lib/worktrees.mjs gcWorktrees).
 */
export function productWorktreeDuty({ ledger, ledgerRepo, now = Date.now(), settings = productSettings(), env = process.env } = {}) {
  const db = ledger.db;
  const out = { reaped: [], errors: [] };
  for (const { row, record } of isolatedJobs(db, { statuses: SETTLED })) {
    if (hasEvent(db, row.job_id, EVENTS.removed)) continue;
    // An ended workflow's job writes no event: its folder gone is its done mark (no git call per pass for history).
    if (!fs.existsSync(record.op.path) && workflowEndOf(db, row.workflow_id).ended) continue;
    try { const r = reapJobWorktree({ ledger, ledgerRepo, jobId: row.job_id, now, settings, env }); if (!r.skipped) out.reaped.push(r); }
    catch (error) { out.errors.push({ jobId: row.job_id, error: String(error?.message ?? error).slice(0, 300) }); }
  }
  return out;
}

/* ------------------------------------------------------------ cli */

async function main(argv) {
  const [verb, ...rest] = argv;
  const flag = (name) => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  const json = rest.includes('--json');
  const repo = flag('repo') ? path.resolve(flag('repo')) : null;
  if (!['reap', 'status'].includes(verb) || !repo) {
    console.error('use: product-worktree.mjs reap --repo <ledger repo> [--job <id>] [--json] | status --repo <ledger repo> [--json]');
    return 2;
  }
  const { openLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    if (verb === 'status') {
      const jobs = isolatedJobs(ledger.db).map(({ row, record }) => ({ jobId: row.job_id, workflowId: row.workflow_id, status: row.status, path: record.op.path,
        exists: fs.existsSync(record.op.path), removed: hasEvent(ledger.db, row.job_id, EVENTS.removed) }));
      const out = { ok: true, repo, jobs, live: jobs.filter((j) => j.exists).length };
      console.log(json ? JSON.stringify(out) : `${out.live} live product worktree(s)\n${jobs.filter((j) => j.exists).map((j) => `  ${j.jobId} ${j.status} ${j.path}`).join('\n')}`);
      return 0;
    }
    const out = flag('job') ? { reaped: [reapJobWorktree({ ledger, ledgerRepo: repo, jobId: flag('job'), force: rest.includes('--force') })] } : productWorktreeDuty({ ledger, ledgerRepo: repo });
    console.log(json ? JSON.stringify(out) : JSON.stringify(out, null, 2));
    return 0;
  } finally { ledger.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
