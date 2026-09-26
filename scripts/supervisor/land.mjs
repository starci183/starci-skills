#!/usr/bin/env node
// land.mjs — the ONE land gate of the live runtime (modules/supervisor/supervise.yaml landGate, docs/supervisor.md).
// Serialized by a host lock; a change reaches live main only through all of it, or not at all.
//
//   node scripts/supervisor/land.mjs --job <jobId> [--specs <csv>] [--no-push] [--notify] [--json]
//   node scripts/supervisor/land.mjs --commit <sha>[,<sha>...] [--specs <csv>] [--lane <name>] [--no-push] [--notify] [--json]
//   node scripts/supervisor/land.mjs --status [--json]
//
// 1. Lock 'supervisor-land', served in request order: each waiter files a ticket and only the oldest live
//    ticket claims the lock (waits up to --wait-ms, default runtimes.yaml allocation.landGate.waitMs).
// 2. Rebase-free apply: a scratch worktree (detached) of current main under <lanesRoot>/land
//    (scripts/lib/hk-lanes.mjs lanesRoot: allocation.housekeeping.lanesRoot, default D:/starci-lanes), then
//    `git cherry-pick` of the commit(s). A conflict lands nothing; a pick with no diff against main is
//    already landed and moves nothing.
// 3. Checks on the result, each red one refusing the land:
//      node --check of every changed .mjs; YAML/JSON parse of every changed .yaml/.yml/.json;
//      check-module-yaml, check-contract-cites, check-api-surface (red only when red on the candidate and not
//        the same on main, so a lane's pre-existing breakage never blocks an unrelated land);
//      the specs named by the worker/--specs plus every spec that names a changed file (node --test,
//        --test-concurrency allocation.landGate.specConcurrency, timeout specsBaseMs + perSpecMs per spec);
//      contract-changes: every changed contract/schema/knowledge/op file (CONTRACT_PREFIXES) is covered by
//        `paths` of an entry the change itself adds or edits in modules/kernel/contract-changes.yaml.
// 4. Fast-forward live main: main must still be the scratch's base (else the whole gate reruns on the new main,
//    at most 3 times), the live checkout must be on main and clean for the changed paths; then
//    `git update-ref refs/heads/main <new> <base>` (compare-and-swap) and a working-tree + index update of just
//    those paths. A failed tree update rolls the ref and the paths back.
// 5. Push main (secret scan of origin/main..main first, hooks on) unless --no-push or config
//    supervisor.landGate.push is false. A push the remote refuses leaves the land in place and is reported.
// A worker job lands as `succeeded` and its staging checkout and temp branch are removed - so does a self job
// (workers.mjs stage --self) whose branch --commit landed in full (selfJobsLandedBy); a red gate records
// `land-failed` and, with --notify, tells the Supervisor through its inbox. Nothing half-lands.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { claimManager, lockHolder, readJson, recordAlive, writeJson, stateFile } from '../connectors/lib.mjs';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { git, jobOf, jobsOf, reportOf, finishLanded, normPath, unlinkNodeModulesLink } from './workers.mjs';
import { scanRange } from './push-mains.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { SKILL_ROOT, SUPERVISOR_ID, landRoot, openSupervisorLedger, supervisorEvent, supervisorSettings, supervisorLog } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const LOCK_NAME = 'supervisor-land';
export const CONTRACT_CHANGES = 'modules/kernel/contract-changes.yaml';
export const CONTRACT_PREFIXES = Object.freeze(['knowledge/', 'modules/schemas/', 'modules/ops/', 'modules/kernel/', 'modules/supervisor/', 'modules/models/code-patterns.yaml']);
export const TREE_CHECKS = Object.freeze(['scripts/checks/check-module-yaml.mjs', 'scripts/checks/check-contract-cites.mjs', 'scripts/checks/check-api-surface.mjs']);
export const MAX_MAIN_RETRIES = 3;
const currentFile = (env = process.env) => stateFile('supervisor-land.current.json', env);
const queueDir = (env = process.env) => stateFile('supervisor-land.queue', env);
export const LAND_WAIT_MS = allocationMs('landGate.waitMs');
/** The spec run's timeout: a base plus a share per spec, so a 70-spec engine change is not cut off under load. */
export const specConcurrency = () => { const n = Number(allocationSettings()?.landGate?.specConcurrency); if (!Number.isInteger(n) || n < 1) throw Error('modules/models/runtimes.yaml allocation.landGate.specConcurrency must be a positive integer'); return n; };
export const specTimeoutMs = (count) => allocationMs('landGate.specsBaseMs') + count * allocationMs('landGate.perSpecMs');

/* ------------------------------------------------------------ pure pieces */

/** The changed files a contract-changes entry must cover. */
export const governedPaths = (changed) => changed.map(normPath)
  .filter((f) => f !== CONTRACT_CHANGES && CONTRACT_PREFIXES.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));

const entryKey = (e) => JSON.stringify(e);
/**
 * Contract-change enforcement: the entries of `after` that are new or edited against `before` must cover, by
 * their `paths` (a directory covers what is inside it), every governed changed file. Returns {ok, governed,
 * uncovered, entries}.
 */
export function contractCoverage({ changed, before, after }) {
  const governed = governedPaths(changed);
  if (!governed.length) return { ok: true, governed, uncovered: [], entries: [] };
  const old = new Map((before?.changes ?? []).map((e) => [e?.id, entryKey(e)]));
  const touched = (after?.changes ?? []).filter((e) => e?.id && old.get(e.id) !== entryKey(e));
  const paths = touched.flatMap((e) => (Array.isArray(e.paths) ? e.paths : [])).map((p) => normPath(p));
  const covers = (file) => paths.some((p) => file === p || file.startsWith(`${p}/`));
  const uncovered = governed.filter((f) => !covers(f));
  return { ok: uncovered.length === 0, governed, uncovered, entries: touched.map((e) => e.id) };
}

/** Specs that name a changed file (its last two path segments, or its name for a top-level file) plus changed specs. */
export function specsTouching(changed, { specs }) {
  const needles = changed.map(normPath).filter((f) => !f.startsWith('tests/')).map((f) => f.split('/').slice(-2).join('/'));
  const own = changed.map(normPath).filter((f) => /^tests\/[^/]+\.spec\.mjs$/.test(f));
  const hits = specs.filter(({ file, text }) => needles.some((n) => text.includes(n)) && file).map((s) => s.file);
  return [...new Set([...own, ...hits])];
}

/* ------------------------------------------------------------ scratch */

const run = (cmd, args, { cwd, timeout = 1_200_000, env = process.env } = {}) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, env, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? ''), error: r.error?.message ?? null };
};
const tail = (text, n = 25) => String(text ?? '').trim().split(/\r?\n/).slice(-n).join('\n');

export function removeScratch(dir, { root }) {
  // Never remove a scratch whose node_modules link to the live tree is still there.
  if (!unlinkNodeModulesLink(dir)) return false;
  // Never `git worktree remove --force`: it follows junctions (nivo-fe inc-c8fbf76aa499). The tree goes
  // through safeRemoveTree, which never descends into a link; prune drops the registration.
  if (fs.existsSync(dir)) safeRemoveTree(dir);
  git(['worktree', 'prune'], { cwd: root });
  return !fs.existsSync(dir);
}

function makeScratch({ root, base, env }) {
  const dir = path.join(landRoot(env), `scratch-${process.pid}`);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  removeScratch(dir, { root });
  const added = git(['worktree', 'add', '--detach', dir, base], { cwd: root });
  if (!added.ok) return { ok: false, error: added.stderr || 'git worktree add failed' };
  const nm = path.join(root, 'node_modules');
  try { if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(dir, 'node_modules'), 'junction'); } catch { /* specs without deps */ }
  try { const cfg = path.join(root, 'config.yaml'); if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(dir, 'config.yaml')); } catch { /* optional */ }
  return { ok: true, dir };
}

/* ------------------------------------------------------------ checks */

function treeCheck(dir, script) {
  if (!fs.existsSync(path.join(dir, script))) return { ok: true, skipped: true };
  const r = run(process.execPath, [script], { cwd: dir, timeout: 600_000 });
  return { ok: r.ok, output: tail(r.stdout + r.stderr, 15) };
}

const readSpecs = (dir) => {
  const tests = path.join(dir, 'tests');
  let names = [];
  try { names = fs.readdirSync(tests).filter((n) => n.endsWith('.spec.mjs')); } catch { return []; }
  return names.map((n) => ({ file: `tests/${n}`, text: (() => { try { return fs.readFileSync(path.join(tests, n), 'utf8'); } catch { return ''; } })() }));
};

/** Every check of step 3 over the scratch `dir` at candidate `head` against `base`. Returns {ok, checks:[...]}. */
export function runChecks({ dir, base, head, specs = [], baseline = null, runSpecs = true }) {
  const checks = [];
  const changedOut = git(['diff', '--name-status', `${base}..${head}`], { cwd: dir });
  const rows = changedOut.stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
  const changed = rows.map((r) => normPath(r[r.length - 1]));
  const present = changed.filter((f) => fs.existsSync(path.join(dir, f)));
  for (const f of present.filter((x) => x.endsWith('.mjs'))) {
    const r = run(process.execPath, ['--check', f], { cwd: dir, timeout: 60_000 });
    checks.push({ name: `node --check ${f}`, ok: r.ok, ...(r.ok ? {} : { output: tail(r.stderr, 10) }) });
  }
  for (const f of present.filter((x) => /\.(ya?ml|json)$/i.test(x))) {
    let ok = true, error = null;
    try { const text = fs.readFileSync(path.join(dir, f), 'utf8'); if (/\.json$/i.test(f)) JSON.parse(text); else parseYaml(text); } catch (e) { ok = false; error = String(e?.message ?? e).slice(0, 300); }
    checks.push({ name: `parse ${f}`, ok, ...(error ? { output: error } : {}) });
  }
  for (const script of TREE_CHECKS) {
    const r = treeCheck(dir, script);
    if (r.skipped) continue;
    const pre = baseline?.[script];
    const ok = r.ok || (pre && !pre.ok && pre.output === r.output);
    checks.push({ name: path.basename(script), ok, ...(r.ok ? {} : { output: r.output, ...(ok ? { note: 'red on main too, unchanged by this land' } : {}) }) });
  }
  let coverage;
  try {
    const show = (rev) => { const s = git(['show', `${rev}:${CONTRACT_CHANGES}`], { cwd: dir }); return s.ok ? parseYaml(s.stdout) : null; };
    coverage = contractCoverage({ changed, before: show(base), after: show(head) });
  } catch (e) { coverage = { ok: false, governed: [], uncovered: [], error: String(e?.message ?? e) }; }
  checks.push({ name: 'contract-changes paths', ok: coverage.ok, governed: coverage.governed, ...(coverage.ok ? { entries: coverage.entries } : { uncovered: coverage.uncovered, output: coverage.error ?? `no added/edited ${CONTRACT_CHANGES} entry names ${coverage.uncovered.join(', ')} in its paths` }) });
  const allSpecs = [...new Set([...specs.map(normPath), ...specsTouching(changed, { specs: readSpecs(dir) })])].filter((f) => fs.existsSync(path.join(dir, f)));
  const missing = specs.map(normPath).filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) checks.push({ name: 'named specs exist', ok: false, output: `missing: ${missing.join(', ')}` });
  if (runSpecs && allSpecs.length) {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    // The candidate's own test preload points the machine registry at a per-run temp file, so no spec it
    // runs enrols a ledger on this host's registry (a candidate from before the preload runs without it).
    const preload = path.join(dir, 'tests', 'setup', 'isolated-registry.mjs');
    const importArgs = fs.existsSync(preload) ? ['--import', pathToFileURL(preload).href] : [];
    const r = run(process.execPath, [...importArgs, '--test', `--test-concurrency=${specConcurrency()}`, ...allSpecs], { cwd: dir, timeout: specTimeoutMs(allSpecs.length), env });
    checks.push({ name: `specs (${allSpecs.length})`, ok: r.ok, specs: allSpecs, output: tail(r.stdout + r.stderr, r.ok ? 6 : 40) });
  }
  return { ok: checks.every((c) => c.ok), checks, changed, rows, specs: allSpecs };
}

/* ------------------------------------------------------------ fast-forward */

/**
 * Move live main from `base` to `head` and update the working tree and index of exactly `rows`
 * (name-status rows of base..head). Refuses when main moved, HEAD is not main, or a path is dirty.
 * Returns {ok, reason?, dirty?, moved?}.
 */
export function fastForwardLive({ root, base, head, rows }) {
  const branch = git(['symbolic-ref', '-q', 'HEAD'], { cwd: root }).stdout;
  if (branch !== 'refs/heads/main') return { ok: false, reason: 'live-not-on-main', detail: branch || 'detached' };
  const live = git(['rev-parse', 'refs/heads/main'], { cwd: root }).stdout;
  if (live !== base) return { ok: false, reason: 'main-moved', moved: live };
  const paths = [...new Set(rows.flatMap((r) => r.slice(1)).map(normPath))];
  // No paths, nothing to be dirty: `git status --` with an empty pathspec lists the whole tree.
  const dirty = paths.length ? git(['status', '--porcelain', '--untracked-files=all', '--', ...paths], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean) : [];
  if (dirty.length) return { ok: false, reason: 'live-paths-dirty', dirty };
  const cas = git(['update-ref', '-m', 'supervisor land gate', 'refs/heads/main', head, base], { cwd: root });
  if (!cas.ok) return { ok: false, reason: 'main-moved', detail: cas.stderr };
  const deleted = rows.filter((r) => r[0].startsWith('D')).map((r) => normPath(r[1]));
  const renamedFrom = rows.filter((r) => r[0].startsWith('R')).map((r) => normPath(r[1]));
  const written = rows.filter((r) => !r[0].startsWith('D')).map((r) => normPath(r[r.length - 1]));
  const gone = [...deleted, ...renamedFrom];
  try {
    if (written.length) { const co = git(['checkout', head, '--', ...written], { cwd: root }); if (!co.ok) throw Error(co.stderr || 'checkout failed'); }
    if (gone.length) {
      const rm = git(['rm', '--cached', '--quiet', '--ignore-unmatch', '--', ...gone], { cwd: root });
      if (!rm.ok) throw Error(rm.stderr || 'git rm --cached failed');
      for (const f of gone) { try { fs.rmSync(path.join(root, f), { force: true }); } catch { /* already gone */ } }
    }
    return { ok: true, written, removed: gone };
  } catch (error) {
    // Roll back: the ref first (compare-and-swap on our own head), then the paths to base.
    git(['update-ref', '-m', 'supervisor land gate rollback', 'refs/heads/main', base, head], { cwd: root });
    const back = rows.flatMap((r) => (r[0].startsWith('A') ? [] : [normPath(r[1])]));
    if (back.length) git(['checkout', base, '--', ...back], { cwd: root });
    for (const r of rows.filter((x) => x[0].startsWith('A') || x[0].startsWith('R'))) {
      const f = normPath(r[r.length - 1]);
      git(['rm', '--cached', '--quiet', '--ignore-unmatch', '--', f], { cwd: root });
      try { fs.rmSync(path.join(root, f), { force: true }); } catch { /* best effort */ }
    }
    return { ok: false, reason: 'tree-update-failed', detail: String(error?.message ?? error), rolledBack: true };
  }
}

/* ------------------------------------------------------------ the gate */

/**
 * Land `commits` (in order) on live main of `root`. `deps.runChecks` / `deps.push` replace the checks and the
 * push in specs. Returns {ok, landed?, base, head?, checks, reason?, push?}.
 */
export function landCommits({ commits, specs = [], root = SKILL_ROOT, env = process.env, push = true, deps = {} }) {
  const check = deps.runChecks ?? runChecks;
  const result = { ok: false, commits, attempts: [] };
  for (let attempt = 1; attempt <= MAX_MAIN_RETRIES; attempt += 1) {
    const base = git(['rev-parse', 'refs/heads/main'], { cwd: root }).stdout;
    const scratch = makeScratch({ root, base, env });
    if (!scratch.ok) return { ...result, reason: 'scratch-failed', detail: scratch.error };
    const step = { attempt, base };
    try {
      const baseline = {};
      if (!deps.runChecks) for (const script of TREE_CHECKS) baseline[script] = treeCheck(scratch.dir, script);
      const pick = git(['cherry-pick', '--allow-empty', '--keep-redundant-commits', ...commits], { cwd: scratch.dir });
      if (!pick.ok) {
        git(['cherry-pick', '--abort'], { cwd: scratch.dir });
        result.attempts.push({ ...step, reason: 'conflict' });
        return { ...result, base, reason: 'conflict', detail: tail(pick.stderr || pick.stdout, 12) };
      }
      const head = git(['rev-parse', 'HEAD'], { cwd: scratch.dir }).stdout;
      // The pick changes nothing: main already carries the change (a re-land of a landed commit).
      if (git(['diff', '--quiet', base, head], { cwd: scratch.dir }).ok) {
        result.attempts.push({ ...step, reason: 'already-landed' });
        return { ...result, ok: true, alreadyLanded: base, landed: null, base, head: base, checks: [], changed: [] };
      }
      const checked = check({ dir: scratch.dir, base, head, specs, baseline });
      step.head = head;
      step.checks = checked.checks;
      if (!checked.ok) {
        result.attempts.push({ ...step, reason: 'checks-red' });
        return { ...result, base, head, reason: 'checks-red', checks: checked.checks, changed: checked.changed };
      }
      const ff = fastForwardLive({ root, base, head, rows: checked.rows });
      if (!ff.ok) {
        result.attempts.push({ ...step, reason: ff.reason });
        if (ff.reason === 'main-moved') continue;
        return { ...result, base, head, reason: ff.reason, detail: ff.detail ?? null, dirty: ff.dirty ?? null, checks: checked.checks };
      }
      const landed = { ...result, ok: true, landed: head, base, head, checks: checked.checks, changed: checked.changed };
      if (push) landed.push = (deps.push ?? pushLive)({ root });
      return landed;
    } finally { removeScratch(scratch.dir, { root }); }
  }
  return { ...result, reason: 'main-moving', detail: `main moved under the gate ${MAX_MAIN_RETRIES} times` };
}

/** Push live main after a secret scan of origin/main..main. */
export function pushLive({ root = SKILL_ROOT } = {}) {
  const hasRemote = git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: root }).ok;
  if (!hasRemote) return { pushed: false, skipped: 'no origin/main' };
  const scan = scanRange({ cwd: root, from: 'origin/main', to: 'main' });
  if (!scan.ok) return { pushed: false, refused: 'secret scan', findings: scan.findings };
  const r = git(['push', 'origin', 'main'], { cwd: root });
  return r.ok ? { pushed: true } : { pushed: false, error: (r.stderr || r.error || '').split(/\r?\n/).slice(-4).join(' | ').slice(0, 400) };
}

/**
 * The running self jobs (workers.mjs stage --self) a `--commit` land just completed: a landed commit is on the
 * job's branch sup/<job> beyond its base, and `git cherry main <branch> <base>` finds no commit of that branch
 * still missing from main. A branch only partly landed stays open ({jobId, pending}).
 */
export function selfJobsLandedBy(db, commits, { root = SKILL_ROOT } = {}) {
  const shas = commits.map((c) => git(['rev-parse', '--verify', '--quiet', `${c}^{commit}`], { cwd: root }).stdout).filter(Boolean);
  const done = [], partial = [];
  for (const job of jobsOf(db, ['running', 'leased']).filter((j) => j.payload.self && j.payload.staging?.branch && j.payload.staging?.base)) {
    const { branch, base } = job.payload.staging;
    if (!git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root }).ok) continue;
    const onBranch = (sha) => git(['merge-base', '--is-ancestor', sha, branch], { cwd: root }).ok && !git(['merge-base', '--is-ancestor', sha, base], { cwd: root }).ok;
    if (!shas.some(onBranch)) continue;
    const pending = git(['cherry', 'refs/heads/main', branch, base], { cwd: root }).stdout.split(/\r?\n/).filter((l) => l.startsWith('+')).map((l) => l.slice(2).trim());
    (pending.length ? partial : done).push({ jobId: job.job_id, pending });
  }
  return { done: done.map((d) => d.jobId), partial };
}

const TICKET = /^\d+-\d+\.json$/;
/** The live waiters' tickets, oldest first ({name, pid, requestedAt}); a dead waiter's ticket is removed. */
export function landQueue({ env = process.env, now = Date.now() } = {}) {
  const dir = queueDir(env);
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => TICKET.test(n)).sort(); } catch { return []; }
  const live = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const rec = readJson(file);
    if (rec && recordAlive(rec)) { live.push({ name, pid: rec.pid, requestedAt: rec.requestedAt ?? null }); continue; }
    let age = Infinity;
    try { age = now - fs.statSync(file).mtimeMs; } catch { continue; }
    if (!rec && age < 5000) { live.push({ name, pid: null, requestedAt: null }); continue; }   // being written
    try { fs.rmSync(file, { force: true }); } catch { /* another waiter removed it */ }
  }
  return live;
}

/**
 * Wait for the lock in request order: a ticket <requestedAt>-<pid>.json joins the queue and only the oldest live
 * ticket claims. The ticket is removed on return. {ok, release} or {ok:false, holder, ahead}.
 */
export function acquireLand({ env = process.env, waitMs = LAND_WAIT_MS, pollMs = 5000, claim = () => claimManager(LOCK_NAME, { env }) } = {}) {
  const dir = queueDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const requestedAt = Date.now();
  const name = `${String(requestedAt).padStart(15, '0')}-${process.pid}.json`;
  const ticket = path.join(dir, name);
  writeJson(ticket, { pid: process.pid, startedAt: new Date().toISOString(), requestedAt });
  const drop = () => { try { fs.rmSync(ticket, { force: true }); } catch { /* gone */ } };
  process.on('exit', drop);
  try {
    const end = requestedAt + waitMs;
    for (;;) {
      const ahead = landQueue({ env }).filter((t) => t.name < name);
      const held = ahead.length ? null : claim();
      if (held?.ok) return held;
      if (Date.now() >= end) return { ok: false, holder: held?.holder ?? lockHolder(LOCK_NAME, env), ahead: ahead.length };
      sleepSync(pollMs);
    }
  } finally { drop(); process.removeListener('exit', drop); }
}

/** The full gate for one job or commit list, with the lock, the ledger records and the optional inbox notice. */
export async function land({ jobId = null, commits = null, specs = [], lane = null, push = null, notify = false, waitMs = LAND_WAIT_MS, root = SKILL_ROOT, env = process.env, deps = {} } = {}) {
  const settings = supervisorSettings();
  const doPush = push ?? settings.landGate.push;
  let job = null, report = null;
  const ledger = openSupervisorLedger({ env });
  try {
    if (jobId) {
      job = jobOf(ledger.db, jobId);
      report = reportOf(ledger.db, jobId)?.report ?? null;
      if (!job) return { ok: false, reason: 'no-job', detail: jobId };
      if (job.payload.self && !commits) {
        const staging = job.payload.staging;
        const list = staging ? git(['rev-list', '--reverse', `${staging.base}..${staging.branch}`], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean) : [];
        commits = list;
      } else if (!commits) {
        if (!report || report.outcome !== 'done' || !report.commit) return { ok: false, reason: 'no-done-report', detail: `${jobId} has no done report with a commit` };
        const list = report.base ? git(['rev-list', '--reverse', `${report.base}..${report.commit}`], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean) : [report.commit];
        commits = list.length ? list : [report.commit];
      }
      specs = [...new Set([...specs, ...(report?.specs ?? []), ...(job.payload.specs ?? [])])];
    }
  } finally { ledger.close(); }
  if (!commits?.length) return { ok: false, reason: 'nothing-to-land' };
  const lock = acquireLand({ env, waitMs });
  if (!lock.ok) return { ok: false, reason: 'gate-busy', holder: lock.holder ?? null, ahead: lock.ahead ?? 0 };
  const startedAt = new Date().toISOString();
  try {
    writeJson(currentFile(env), { pid: process.pid, jobId, commits, lane, startedAt });
    const result = landCommits({ commits, specs, root, env, push: doPush, deps });
    const w = openSupervisorLedger({ env });
    try {
      w.transaction(() => supervisorEvent(w, { entityType: 'land', entityId: jobId ?? commits[commits.length - 1], kind: result.ok ? 'land-passed' : 'land-failed',
        payload: { jobId, lane, commits, landed: result.landed ?? null, base: result.base ?? null, reason: result.reason ?? null, detail: result.detail ?? null,
          push: result.push ?? null, failed: (result.checks ?? []).filter((c) => !c.ok).map((c) => c.name), startedAt } }));
      if (result.ok && job) result.finished = finishLanded(w, { jobId, landedSha: result.landed ?? result.alreadyLanded, root, env });
      // --commit of a self checkout's commits closes that self job as --job would: succeeded, leases released,
      // checkout and branch removed. Left open, it kept its file leases and blocked every worker needing them.
      if (result.ok && !job) {
        const self = selfJobsLandedBy(w.db, commits, { root });
        if (self.done.length) result.finished = self.done.map((id) => finishLanded(w, { jobId: id, landedSha: result.landed ?? result.alreadyLanded, root, env }));
        if (self.partial.length) result.selfPending = self.partial;
      }
      if (!result.ok && job) w.db.prepare('UPDATE jobs SET result_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify({ landFailed: result.reason, at: startedAt }), Date.now(), jobId);
    } finally { w.close(); }
    if (notify) {
      try {
        const { appendInbox } = await import('../connectors/telegram-bridge.mjs');
        appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'land-gate', text: describe(result, { jobId }) }, { env });
      } catch { /* the event is the record */ }
    }
    return result;
  } finally {
    try { fs.rmSync(currentFile(env), { force: true }); } catch { /* gone */ }
    lock.release();
  }
}

/** The gate's queue for /status: {busy, current, queued}. */
export function landStatus({ env = process.env } = {}) {
  const holder = lockHolder(LOCK_NAME, env);
  return { busy: Boolean(holder), current: holder ? readJson(currentFile(env)) : null, queued: landQueue({ env }).length };
}

export function describe(r, { jobId = null } = {}) {
  const who = jobId ?? (r.commits ?? []).map((c) => String(c).slice(0, 9)).join(',');
  if (r.ok && r.alreadyLanded) return `LAND already-landed ${who}: main has it at ${String(r.alreadyLanded).slice(0, 9)}, nothing moved`;
  if (r.ok) return `LAND passed ${who}: main -> ${String(r.landed).slice(0, 9)}${r.push ? ` (push ${r.push.pushed ? 'ok' : r.push.skipped ?? r.push.refused ?? r.push.error})` : ''}`;
  const red = (r.checks ?? []).filter((c) => !c.ok).map((c) => `${c.name}${c.output ? `: ${String(c.output).split(/\r?\n/).slice(-3).join(' / ').slice(0, 300)}` : ''}`);
  return `LAND FAILED ${who}: ${r.reason}${r.detail ? ` (${String(r.detail).slice(0, 300)})` : ''}${r.dirty ? ` dirty: ${r.dirty.join(', ')}` : ''}${red.length ? `\n  ${red.join('\n  ')}` : ''}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  if (has('status')) console.log(JSON.stringify(landStatus()));
  else if (!value('job') && !value('commit')) { console.error('use: land.mjs --job <id> | --commit <sha>[,<sha>] [--specs <csv>] [--lane <name>] [--no-push] [--notify] [--json]'); process.exitCode = 2; }
  else {
    const r = await land({ jobId: value('job'), commits: value('commit') ? csv(value('commit')) : null, specs: csv(value('specs')), lane: value('lane'),
      push: has('no-push') ? false : null, notify: has('notify'), waitMs: Number(value('wait-ms')) || LAND_WAIT_MS });
    supervisorLog('land', describe(r, { jobId: value('job') }));
    console.log(has('json') ? JSON.stringify(r) : describe(r, { jobId: value('job') }));
    if (!r.ok) process.exitCode = 1;
  }
}
