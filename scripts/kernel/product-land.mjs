#!/usr/bin/env node
// product-land.mjs — the serial, per-REPOSITORY land of a workflow branch into a product repository's main
// (DESIGN §16.7; the product-side twin of scripts/supervisor/land.mjs). The Kernel decides WHEN (per wave, or when a
// leg completes: `api product-land --workflow <wf>`); cross-workflow conflicts at this level are the Supervisor's.
//
//   node scripts/kernel/product-land.mjs --repo <ledger repo> --workflow <wf> [--repository <role|path>] [--dry-run] [--push] [--json]
//
// 1. Lock-free preflight, BEFORE the queue: `git merge-tree --write-tree main wf/<wf>`. A conflict lands nothing and names
//    every file with its hunks ({ok:false, reason:'product-land-conflict', conflicts:[{file, hunks}]}); main untouched.
// 2. Host lock `product-land:<repoName>`, served in request order by ticket (like land.mjs).
// 3. Apply in a detached scratch worktree of current main (<repo>/.starciwork/worktrees/_land-<pid>, node_modules overlay):
//    `git merge --no-ff wf/<wf>`.
// 4. Checks on the result: product-land.yaml land.checks (argv, no shell, cwd = scratch) and the import scan - red only
//    when the candidate has MORE broken imports than main had (a pre-existing breakage never blocks an unrelated land).
// 5. Compare-and-swap `git update-ref refs/heads/main <new> <base>` plus a working-tree + index update of exactly the
//    changed paths in the live checkout (land.mjs fastForwardLive: refused when the live checkout is not on main or is
//    dirty on those paths). main moved under the gate -> the whole land reruns (land.maxMainRetries).
// 6. Push main only when asked (--push, or land.push) - the op policies' commitPolicy.push.
// 7. Fast-forward wf/<wf> (and its _wf tree) to the new main, so the workflow continues from what landed.
// Events (on the product ledger, through the api verb): product-land-queued | product-land-landed | product-land-failed.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { claimManager, lockHolder, readJson, recordAlive, writeJson, stateFile } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { conflictHunks, fastForwardLive } from '../supervisor/land.mjs';
import {
  git, isAncestor, layoutOf, productSettings, worktreesRootOf, buildOverlay, removeWorktreeVerified, withLock,
  workflowLockName, workflowLanded, ensureRepoSetup,
} from './product-worktree.mjs';
import { brokenImports } from './import-scan.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const EVENTS = Object.freeze({ queued: 'product-land-queued', landed: 'product-land-landed', failed: 'product-land-failed' });
const TICKET = /^\d{15}-\d+\.json$/;
const revParse = (cwd, ref) => { const r = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return r.ok && r.stdout ? r.stdout : null; };
export const repoNameOf = (repoRoot) => path.basename(path.resolve(repoRoot)).replace(/[^A-Za-z0-9._-]/g, '_');
export const landLockName = (repoRoot) => `product-land-${repoNameOf(repoRoot)}`;

/* ------------------------------------------------------------ preflight */

/** Lock-free: can wf/<wf> merge into main? {ok, conflicts: [{file, hunks}], main, workflow} */
export function landPreflight({ repoRoot, branch, main = 'main' }) {
  const M = revParse(repoRoot, main), W = revParse(repoRoot, branch);
  if (!M || !W) return { ok: false, reason: 'ref-unresolved', main: M, workflow: W };
  const r = git(repoRoot, ['merge-tree', '--write-tree', M, W]);
  const tree = r.stdout.split(/\r?\n/)[0]?.trim();
  if (r.status === 1 && /^[0-9a-f]{40,64}$/.test(tree ?? '')) {
    const files = [...new Set(r.stdout.split(/\r?\n\r?\n/)[0].split(/\r?\n/).slice(1).map((l) => l.split('\t')[1]).filter(Boolean))].slice(0, 20);
    return { ok: false, reason: 'product-land-conflict', main: M, workflow: W,
      conflicts: files.map((file) => ({ file, hunks: conflictHunks(git(repoRoot, ['cat-file', '-p', `${tree}:${file}`]).stdout) })) };
  }
  if (!r.ok) return { ok: false, reason: 'merge-tree-failed', detail: r.stderr.slice(0, 300) };
  return { ok: true, conflicts: [], main: M, workflow: W };
}

/* ------------------------------------------------------------ the queue */

const queueDir = (repoRoot, env) => stateFile(`${landLockName(repoRoot)}.queue`, env);
function liveTickets(dir, now = Date.now()) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => TICKET.test(n)).sort(); } catch { return []; }
  return names.filter((name) => {
    const rec = readJson(path.join(dir, name));
    if (rec && recordAlive(rec)) return true;
    let age = Infinity;
    try { age = now - fs.statSync(path.join(dir, name)).mtimeMs; } catch { return false; }
    if (!rec && age < 5000) return true;
    try { fs.rmSync(path.join(dir, name), { force: true }); } catch { /* gone */ }
    return false;
  });
}
/** Wait for `product-land:<repo>` in request order. {ok, release} | {ok:false, holder, ahead} */
export function acquireProductLand({ repoRoot, env = process.env, waitMs = 1_800_000, pollMs = 2000 }) {
  const dir = queueDir(repoRoot, env);
  fs.mkdirSync(dir, { recursive: true });
  const requestedAt = Date.now();
  const name = `${String(requestedAt).padStart(15, '0')}-${process.pid}.json`;
  const ticket = path.join(dir, name);
  writeJson(ticket, { pid: process.pid, startedAt: new Date().toISOString(), requestedAt });
  const drop = () => { try { fs.rmSync(ticket, { force: true }); } catch { /* gone */ } };
  try {
    for (const end = requestedAt + waitMs; ;) {
      const ahead = liveTickets(dir).filter((t) => t < name);
      const held = ahead.length ? null : claimManager(landLockName(repoRoot), { env });
      if (held?.ok) return held;
      if (Date.now() >= end) return { ok: false, holder: held?.holder ?? lockHolder(landLockName(repoRoot), env), ahead: ahead.length };
      sleepSync(pollMs);
    }
  } finally { drop(); }
}

/* ------------------------------------------------------------ checks */

/** One declared land check: argv (array or space-free string list), no shell, cwd = scratch. */
function runLandCheck(check, cwd, timeoutMs) {
  const argv = Array.isArray(check.argv) ? check.argv.map(String) : String(check.command ?? '').split(/\s+/).filter(Boolean);
  if (!argv.length) return { name: check.name ?? '?', ok: false, output: 'empty check' };
  const bin = argv[0] === 'node' ? process.execPath : argv[0];
  const r = spawnSync(bin, argv.slice(1), { cwd, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { name: check.name ?? argv.join(' ').slice(0, 80), ok: !r.error && r.status === 0, exitCode: r.status, output: String(r.stderr || r.stdout || r.error?.message || '').trim().split(/\r?\n/).slice(-3).join(' / ').slice(0, 400) };
}

/* ------------------------------------------------------------ land */

/**
 * Land wf/<wf> of `workflowId` into `repoRoot`'s main. Seams: onEvent(kind, payload), deps {runCheck, imports,
 * fastForward, push}. Returns {ok, landed?, already?, base, head, changed, checks} or a refusal {ok:false, reason, ...}.
 */
export function productLand({ repoRoot, workflowId, dryRun = false, push = null, env = process.env, settings = productSettings(), onEvent = null, deps = {} }) {
  const lay = layoutOf({ repoRoot, workflowId, settings });
  const branch = lay.workflow.branch;
  const emitEvent = (kind, payload) => { try { onEvent?.(kind, { repoRoot, branch, ...payload }); } catch { /* the result is the record */ } };
  if (!revParse(repoRoot, branch)) return { ok: false, reason: 'workflow-branch-missing', branch };
  const landed0 = workflowLanded(repoRoot, branch);
  if (landed0.landed) return { ok: true, already: true, why: landed0.why, branch };
  const pre = landPreflight({ repoRoot, branch });
  if (!pre.ok) {
    emitEvent(EVENTS.failed, { reason: pre.reason, preflight: true, conflicts: (pre.conflicts ?? []).map((c) => c.file), main: pre.main ?? null });
    return { ...pre, preflight: true, branch, hint: pre.reason === 'product-land-conflict' ? `merge main into ${branch} in ${lay.workflow.path}, resolve the files (cross-workflow: the Supervisor decides the order), then land again` : undefined };
  }
  if (dryRun) return { ok: true, dryRun: true, branch, preflight: pre };
  emitEvent(EVENTS.queued, { main: pre.main, workflow: pre.workflow });
  const lock = (deps.acquire ?? acquireProductLand)({ repoRoot, env, waitMs: settings.land.lockWaitMs });
  if (!lock.ok) { emitEvent(EVENTS.failed, { reason: 'land-busy', holder: lock.holder ?? null }); return { ok: false, reason: 'land-busy', holder: lock.holder ?? null, ahead: lock.ahead ?? null }; }
  try {
    ensureRepoSetup(repoRoot);
    for (let attempt = 1; attempt <= settings.land.maxMainRetries; attempt += 1) {
      const base = revParse(repoRoot, 'refs/heads/main');
      const W = revParse(repoRoot, branch);
      const scratch = path.join(worktreesRootOf(repoRoot), `_land-${process.pid}`);
      removeWorktreeVerified({ repoRoot, dir: scratch, settings });
      const added = git(repoRoot, ['worktree', 'add', '--detach', scratch, base]);
      if (!added.ok) { emitEvent(EVENTS.failed, { reason: 'scratch-failed' }); return { ok: false, reason: 'scratch-failed', detail: added.stderr.slice(0, 300) }; }
      try {
        const needsNode = (settings.land.checks ?? []).length > 0;
        if (needsNode) buildOverlay({ repoRoot, worktree: scratch, settings });
        const importsOf = deps.imports ?? ((dir) => brokenImports(dir, { limit: 20 }));
        const before = settings.land.importScan ? importsOf(scratch) : null;
        const m = git(scratch, ['merge', '--no-ff', '--no-edit', '-m', `land ${branch} (${workflowId})`, W]);
        if (!m.ok) {
          git(scratch, ['merge', '--abort']);
          const again = landPreflight({ repoRoot, branch });
          emitEvent(EVENTS.failed, { reason: 'product-land-conflict', conflicts: (again.conflicts ?? []).map((c) => c.file) });
          return { ok: false, reason: 'product-land-conflict', base, conflicts: again.conflicts ?? [], detail: m.stderr.slice(0, 300) };
        }
        const head = revParse(scratch, 'HEAD');
        const rows = git(scratch, ['diff', '--name-status', '--no-renames', base, head]).stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
        const changed = rows.map((r) => r[r.length - 1]);
        const checks = [];
        for (const c of settings.land.checks ?? []) checks.push((deps.runCheck ?? runLandCheck)(c, scratch, settings.integrate.recheckTimeoutMs));
        if (before) {
          const after = importsOf(scratch);
          checks.push({ name: 'imports-broken-after-move', ok: (after.count ?? 0) <= (before.count ?? 0), exitCode: (after.count ?? 0) <= (before.count ?? 0) ? 0 : 1,
            output: `broken imports main ${before.count ?? 0} -> candidate ${after.count ?? 0}${after.broken?.length ? `: ${after.broken.slice(0, 3).map((b) => `${b.from} -> ${b.spec}`).join('; ')}` : ''}` });
        }
        const red = checks.filter((c) => !c.ok);
        if (red.length) {
          emitEvent(EVENTS.failed, { reason: 'product-land-red', checks: red.map((c) => ({ name: c.name, output: c.output })) });
          return { ok: false, reason: 'product-land-red', base, head, checks, changed };
        }
        const ff = (deps.fastForward ?? fastForwardLive)({ root: repoRoot, base, head, rows });
        if (!ff.ok) {
          if (ff.reason === 'main-moved') continue;
          emitEvent(EVENTS.failed, { reason: ff.reason, dirty: ff.dirty ?? null });
          return { ok: false, reason: ff.reason, base, head, dirty: ff.dirty ?? null, detail: ff.detail ?? null, checks };
        }
        const out = { ok: true, landed: head, base, head, branch, changed, checks };
        // A deps unit's manifests reached main: the live checkout's install (every overlay's source) is now behind them.
        const depsChanged = changed.filter((f) => settings.integrate.depsFiles.includes(path.posix.basename(f)));
        if (depsChanged.length) Object.assign(out, { depsChanged, hint: `main's dependency manifests changed (${depsChanged.join(', ')}): run the install in the live checkout ${repoRoot} so new worktree overlays mirror it` });
        if (push ?? settings.land.push) {
          const p = (deps.push ?? ((root) => git(root, ['push', 'origin', 'main'])))(repoRoot);
          out.push = { pushed: p.ok, detail: p.ok ? null : String(p.stderr ?? '').slice(0, 300) };
        }
        if (settings.land.syncWorkflowAfterLand) {
          out.workflowSync = withLock(workflowLockName(repoRoot, lay.workflow.short), () => {
            if (fs.existsSync(lay.workflow.path)) {
              if (git(lay.workflow.path, ['status', '--porcelain', '--untracked-files=no']).stdout) return { ok: false, reason: 'workflow-worktree-dirty' };
              const r = git(lay.workflow.path, ['merge', '--ff-only', head]);
              return { ok: r.ok, ...(r.ok ? {} : { detail: r.stderr.slice(0, 200) }) };
            }
            return { ok: isAncestor(repoRoot, W, head) && git(repoRoot, ['update-ref', `refs/heads/${branch}`, head, W]).ok };
          }, { waitMs: 60_000 });
        }
        emitEvent(EVENTS.landed, { base, head, changed: changed.length, pushed: out.push?.pushed ?? false, ...(out.depsChanged ? { depsChanged: out.depsChanged } : {}) });
        return out;
      } finally { removeWorktreeVerified({ repoRoot, dir: scratch, settings }); }
    }
    emitEvent(EVENTS.failed, { reason: 'main-moving' });
    return { ok: false, reason: 'main-moving', detail: `main moved under the land ${settings.land.maxMainRetries} times` };
  } finally { lock.release(); }
}

/* ------------------------------------------------------------ cli */

async function main(argv) {
  const flag = (name) => { const at = argv.indexOf(`--${name}`); return at >= 0 ? argv[at + 1] : undefined; };
  const has = (name) => argv.includes(`--${name}`);
  if (!flag('repo') || !flag('workflow')) { console.error('use: product-land.mjs --repo <ledger repo> --workflow <wf> [--repository <role|path>] [--dry-run] [--push] [--json]'); return 2; }
  // The CLI is the api verb (events on the ledger): api product-land.
  const api = path.join(path.dirname(selfFile), 'api.mjs');
  const r = spawnSync(process.execPath, [api, 'product-land', '--repo', path.resolve(flag('repo')), '--workflow', flag('workflow'),
    ...(flag('repository') ? ['--repository', flag('repository')] : []), ...(has('dry-run') ? ['--dry-run'] : []), ...(has('push') ? ['--push'] : []), ...(has('json') ? ['--json'] : [])],
  { stdio: 'inherit', windowsHide: true });
  return r.status ?? 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
