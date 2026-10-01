#!/usr/bin/env node
// product-worktree.mjs — the per-op land of a product job (integrateOp, the reap of a payload.productWorktree, the duty).
//
// SUPERSEDED (owner decision WFWT, final): one Orca-owned worktree per Kernel workflow replaces the per-op worktree
// (scripts/kernel/workflow-worktree.mjs). Part A deleted the per-op CREATION (ensureOpWorktree, its layout, the
// node_modules junction overlay, the isolation policy): no dispatch makes a payload.productWorktree any more. Part B
// deletes what is left here (integrateOp per op, the reap and the duty) with the workflow checkpoints that replace it.
//
// Lifecycle (job state machine: reported -> settled -> released -> worktree-removed):
//   settle     integrateOp under the per-repository land lock: op/<op> rebased onto main's tip (merge-tree chain, main's
//              side is never overwritten: a conflict is a refusal with files + hunks), the op worktree moved to it, the
//              land gate (scripts/checks/gate.mjs) over the rebased tree against main, then main compare-and-swap
//              fast-forwarded (the live checkout's changed paths with it), then main pushed to origin
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
import { spawnSync } from 'node:child_process';
import { runGit } from '../lib/git.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { isLinkLike } from '../lib/safe-remove.mjs';
import { claimManager } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { isWorktreesPath } from '../lib/worktree-exclude.mjs';
import { removeScratchWorktree, registeredAt, worktreesRootOf, PRESERVED_PREFIX } from '../lib/worktrees.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { fastForwardLive } from '../supervisor/land.mjs';
import { mergeGuard } from '../checks/gate.mjs';
import { brokenImports } from './import-scan.mjs';
import { checkVerdictOf } from '../reconcile/check-verdict.mjs';
import { launchFor } from '../uat/launch.mjs';

export { worktreesRootOf };
const selfFile = fileURLToPath(import.meta.url);
export const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..');
export const SETTINGS_FILE = path.join(SKILL_ROOT, 'modules', 'kernel', 'product-land.yaml');
export const EVENTS = Object.freeze({
  created: 'product-worktree-created',
  landed: 'product-op-landed',
  landRefused: 'product-land-refused',
  removed: 'job-worktree-removed',
  removeFailed: 'job-worktree-remove-failed',
  slaMissed: 'product-worktree-sla-missed',
});
const SETTLED = SETTLED_JOB_LIST;

/* ------------------------------------------------------------ settings */

const DEFAULTS = Object.freeze({
  worktrees: { capPerRepo: 10, ownerGoneMs: 1_800_000, gcEveryMs: 300_000, opRemoveSlaMs: 60_000, commandMs: 300_000 },
  land: { lockWaitMs: 1_800_000, gateTimeoutMs: 1_800_000, push: true, pushTimeoutMs: 600_000, maxMainRetries: 3,
    recheck: 'declared', recheckTimeoutMs: 300_000, importCheck: 'changed-files', checks: [],
    depsFiles: ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'npm-shrinkwrap.json', 'pnpm-workspace.yaml'] },
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
/** The per-repository land lock: one op lands into a repository's main at a time. */
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

/* ------------------------------------------------------------ the land (settle pass) */

const authorEnvOf = (repoRoot, sha) => {
  const r = git(repoRoot, ['log', '-1', '--format=%an%x00%ae%x00%aI%x00%B', sha]);
  const [name, email, date, ...body] = r.stdout.split('\0');
  return { env: { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date }, message: body.join('\0').trim() || `op commit ${sha}` };
};

/** The conflict-marker regions of a merged text (2 lines of context, capped) - land.mjs conflictHunks' shape. */
export function conflictHunksOf(text, { perFile = 4, maxLines = 40 } = {}) {
  const lines = String(text ?? '').split(/\r?\n/);
  const hunks = [];
  for (let i = 0; i < lines.length && hunks.length < perFile; i += 1) {
    if (!lines[i].startsWith('<<<<<<< ')) continue;
    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith('>>>>>>> ')) end += 1;
    const body = lines.slice(Math.max(0, i - 2), Math.min(lines.length, end + 3)).map((l) => (l.length > 300 ? `${l.slice(0, 300)}...` : l));
    hunks.push({ line: i + 1, text: (body.length > maxLines ? [...body.slice(0, maxLines), `... (${body.length - maxLines} more lines)`] : body).join('\n') });
    i = end;
  }
  return hunks;
}
const conflictFilesOf = (stdout) => [...new Set(String(stdout).split(/\r?\n\r?\n/)[0].split(/\r?\n/).slice(1).map((l) => l.split('\t')[1]).filter(Boolean))].slice(0, 20);

/**
 * Rebase `commits` (oldest first) onto `onto` without a working tree: a merge-tree chain, each rebased commit keeping its
 * author and message. A 3-way merge per commit: main's side is never overwritten - a conflict stops the chain.
 * {ok, head, map: [{from, to}]} | {ok:false, conflicts: [{commit, file, hunks}]}
 */
export function rebaseChain(repoRoot, commits, onto, { hunksOf = conflictHunksOf } = {}) {
  let cur = onto;
  const map = [];
  for (const c of commits) {
    const parent = revParse(repoRoot, `${c}^`);
    const r = git(repoRoot, ['merge-tree', '--write-tree', ...(parent ? ['--merge-base', parent] : []), cur, c]);
    const tree = r.stdout.split(/\r?\n/)[0]?.trim();
    if (r.status === 1 && /^[0-9a-f]{40,64}$/.test(tree ?? '')) {
      const files = conflictFilesOf(r.stdout);
      return { ok: false, conflicts: files.map((file) => ({ commit: c, file, hunks: hunksOf ? hunksOf(git(repoRoot, ['cat-file', '-p', `${tree}:${file}`]).stdout) : [] })), onto: cur };
    }
    if (!r.ok || !/^[0-9a-f]{40,64}$/.test(tree ?? '')) return { ok: false, reason: 'merge-tree-failed', detail: r.stderr.slice(0, 300) };
    const curTree = git(repoRoot, ['rev-parse', `${cur}^{tree}`]).stdout;
    if (tree === curTree) { map.push({ from: c, to: null, empty: true }); continue; }
    const a = authorEnvOf(repoRoot, c);
    const next = git(repoRoot, ['commit-tree', tree, '-p', cur], { env: a.env, input: a.message }).stdout;
    if (!next) return { ok: false, reason: 'commit-tree-failed' };
    map.push({ from: c, to: next });
    cur = next;
  }
  return { ok: true, head: cur, map };
}

/** `git cherry <upstream> <head> <limit>` as Map<sha, '+'|'-'> ('-': an equivalent patch is already upstream). */
export function cherryOf(repoRoot, upstream, head, limit = null) {
  const r = git(repoRoot, ['cherry', upstream, head, ...(limit ? [limit] : [])]);
  const out = new Map();
  for (const line of r.stdout.split(/\r?\n/).filter(Boolean)) { const [mark, sha] = line.trim().split(/\s+/); if (sha) out.set(sha, mark); }
  return out;
}

const GATE_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'checks', 'gate.mjs');
/**
 * The land gate: scripts/checks/gate.mjs over the op worktree's whole delta since `base` (no --changed), the same gate the op
 * forced in its loop. Returns its starci/gate@1 report; a gate that printed none is exit 2 with the reason.
 */
export function runLandGate({ root, base, timeoutMs }) {
  if (!root || !fs.existsSync(root)) return { exit: 2, errors: [`the op worktree ${root ?? '(none)'} is gone: nothing to gate`], findings: [], counts: { new: 0 } };
  const run = spawnSync(process.execPath, [GATE_SCRIPT, '--root', root, '--base', base], { cwd: root, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  try { return JSON.parse(run.stdout); } catch { return { exit: 2, errors: [`gate.mjs printed no report (exit ${run.status ?? 'timeout'}): ${String(run.stderr || run.error?.message || '').trim().split(/\r?\n/).slice(-1)[0]}`], findings: [], counts: { new: 0 } }; }
}

/** `git push origin <main>` from the product checkout when it has an origin: {pushed, skipped?, detail?}. */
function pushMain(repoRoot, main, timeoutMs) {
  if (!git(repoRoot, ['remote', 'get-url', 'origin']).ok) return { pushed: false, skipped: 'no-origin' };
  const p = git(repoRoot, ['push', 'origin', `refs/heads/${main}:refs/heads/${main}`], { timeout: timeoutMs });
  return p.ok ? { pushed: true } : { pushed: false, detail: p.stderr.slice(-300) };
}

/** One configured land check (product-land.yaml land.checks: {name, argv}) in `cwd`, no shell. */
function runLandCheck(check, cwd, timeoutMs) {
  const argv = Array.isArray(check?.argv) ? check.argv.map(String) : [];
  if (!argv.length) return { name: String(check?.name ?? 'land-check'), exitCode: null, status: 'unavailable', tail: 'no argv' };
  const { file, args } = launchFor(argv);
  const r = spawnSync(file, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  const exitCode = r.error ? (r.error.code === 'ETIMEDOUT' ? 124 : 127) : r.status;
  return { name: String(check.name ?? argv[0]), exitCode, ...(r.error ? { status: 'unavailable' } : {}), tail: String(r.stderr || r.stdout || r.error?.message || '').trim().split(/\r?\n/).slice(-2).join(' ').slice(0, 300) };
}

/**
 * Land one op into its repository's main (the settle-pass step), under the per-repository land lock:
 *   1. the merge guard (scripts/checks/gate.mjs mergeGuard) over the op's own history before anything is rebased away: a
 *      merge on the op branch that kept the lane side over a main change is land-merge-dropped-main;
 *   2. op/<op>'s commits up to `head` rebased onto main's tip (a merge-tree chain: main's side is never overwritten, a
 *      conflict is product-land-conflict with files + hunks) and the op worktree put on the rebased head (reset --hard of
 *      a tree with no tracked change), so what is gated is exactly what lands;
 *   3. THE GATE on that tree against main (runLandGate; exit 1 land-gate-red, 2 land-gate-unavailable);
 *   4. pre-land verify in the same tree: the op's re-runnable declared checks, land.checks and the import check of its
 *      changed files; red is product-integrate-red, a continuation on the new main (never a failure);
 *   5. main compare-and-swap fast-forwarded - the live checkout's changed paths with it when main is checked out there
 *      (land.mjs fastForwardLive; refused: land-main-refused) - the whole land rerun when main moved (land.maxMainRetries);
 *   6. main pushed to origin (land.push; a failed push is reported, main stays advanced, push-mains retries it).
 * Any refusal after step 2 puts the op worktree back on its own head: main never moves on a refusal.
 * Seams: guard(root, {base, head, mainTip}), gate({root, base, timeoutMs}), recheck(checks, {cwd, from, to, timeoutMs}),
 * fastForward({root, base, head, rows}), push(repoRoot, main).
 * Returns {ok, already?, before, after, map, changed, gate, verify, push} or a refusal {ok:false, reason, ...}.
 */
export function integrateOp({ record, head = null, checks = [], recheck = null, hunksOf = conflictHunksOf, gate = runLandGate, guard = mergeGuard,
  fastForward = fastForwardLive, push = null, settings = productSettings(), env = process.env }) {
  const { repoRoot } = record;
  const main = record.main ?? 'main';
  return withLock(landLockName(repoRoot), () => {
    let last = null;
    for (let attempt = 1; attempt <= settings.land.maxMainRetries; attempt += 1) {
      last = landOnce({ record, head, checks, recheck, hunksOf, gate, guard, fastForward, settings });
      if (last.reason !== 'main-moved') break;
    }
    if (last.reason === 'main-moved') return { ok: false, reason: 'main-moving', detail: `main moved under the land ${settings.land.maxMainRetries} times` };
    if (!last.ok || last.already) return last;
    // The op branch names what landed, so `git branch -d` deletes it at removal.
    if (revParse(repoRoot, `refs/heads/${record.op.branch}`) !== last.after) git(repoRoot, ['update-ref', `refs/heads/${record.op.branch}`, last.after]);
    last.push = settings.land.push ? (push ?? ((root, m) => pushMain(root, m, settings.land.pushTimeoutMs)))(repoRoot, main) : { pushed: false, skipped: 'land.push off' };
    const depsChanged = (last.changed ?? []).filter((f) => settings.land.depsFiles.includes(path.posix.basename(f)));
    if (depsChanged.length) Object.assign(last, { depsChanged, hint: `main's dependency manifests changed (${depsChanged.join(', ')}): run the install in the live checkout ${repoRoot} so new worktree overlays mirror it` });
    return last;
  }, { waitMs: settings.land.lockWaitMs, env });
}

function landOnce({ record, head, checks, recheck, hunksOf, gate, guard, fastForward, settings }) {
  const { repoRoot } = record;
  const op = record.op, main = record.main ?? 'main';
  const M = revParse(repoRoot, `refs/heads/${main}`);
  if (!M) return { ok: false, reason: 'main-unresolved', branch: main };
  const opTip = revParse(repoRoot, `refs/heads/${op.branch}`);
  const tip = head ? revParse(repoRoot, head) : opTip;
  if (!tip) return { ok: false, reason: 'head-unresolved', head };
  if (opTip && tip !== opTip && !isAncestor(repoRoot, tip, opTip)) return { ok: false, reason: 'head-not-on-op-branch', head: tip, branch: op.branch };
  if (isAncestor(repoRoot, tip, M)) return { ok: true, already: true, before: M, after: M, map: [] };
  const base = git(repoRoot, ['merge-base', M, tip]).stdout;
  // 1. the merge guard, on the op's own history.
  const guarded = guard(repoRoot, { base, head: tip, mainTip: M });
  if (guarded.errors?.length) return { ok: false, reason: 'land-gate-unavailable', gate: { exit: 2, base, errors: guarded.errors, findings: [], counts: { new: 0 } },
    hint: `the merge guard could not recompute a merge of ${op.branch} (${guarded.errors[0]}): fix the environment and settle again` };
  if (guarded.findings?.length) return { ok: false, reason: 'land-merge-dropped-main', dropped: guarded.findings.slice(0, 40).map((f) => f.path), merges: guarded.checked,
    hint: `a merge on ${op.branch} kept the lane side over main's change of ${guarded.findings.length} path(s) (${guarded.findings.slice(0, 3).map((f) => f.path).join(', ')}): redo the merge taking main's changes (git merge ${main} in ${posix(op.path)}, resolve each path by hand), commit, report the new head` };
  const commits = git(repoRoot, ['rev-list', '--reverse', '--no-merges', tip, `^${M}`]).stdout.split(/\r?\n/).filter(Boolean);
  const cherry = cherryOf(repoRoot, main, tip, M);
  const pending = commits.filter((c) => cherry.get(c) !== '-');
  if (!pending.length) return { ok: true, already: true, before: M, after: M, map: [], viaPatchId: true };
  const changed = git(repoRoot, ['diff', '--name-only', base, tip]).stdout.split(/\r?\n/).filter(Boolean);
  // 2. rebase onto main's tip (a no-op when the op is already on it).
  let landHead = tip, map = [];
  if (!isAncestor(repoRoot, M, tip)) {
    const chain = rebaseChain(repoRoot, pending, M, { hunksOf });
    if (!chain.ok && !chain.conflicts) return { ok: false, reason: chain.reason, onto: M, detail: chain.detail ?? null };
    if (!chain.ok) return { ok: false, reason: 'product-land-conflict', conflicts: chain.conflicts, onto: M,
      continuation: { base: M, resumeFrom: tip, branch: op.branch, note: 'the op is green on its own base and conflicts with main: a continuation on the new main, never a failure' },
      hint: `rebase ${op.branch} onto ${main} (git rebase ${main} in ${posix(op.path)}), resolve the files, commit, report the new head; or re-cut the slice` };
    if (chain.head === M) return { ok: true, already: true, before: M, after: M, map: chain.map, viaPatchId: true };
    landHead = chain.head; map = chain.map;
  }
  const tree = fs.existsSync(op.path) ? op.path : null;
  if (!tree) return { ok: false, reason: 'land-gate-unavailable', gate: { exit: 2, base: M, errors: [`the op worktree ${posix(op.path)} is gone: nothing to gate`], findings: [], counts: { new: 0 } } };
  if (git(tree, ['status', '--porcelain', '--untracked-files=no']).stdout) return { ok: false, reason: 'op-worktree-dirty', path: op.path,
    hint: `commit or discard the tracked changes in ${posix(op.path)}, report the new head, settle again` };
  const own = revParse(tree, 'HEAD');
  const restore = () => { if (revParse(tree, 'HEAD') !== own) git(tree, ['reset', '--hard', own]); };
  if (landHead !== own && !git(tree, ['reset', '--hard', landHead]).ok) return { ok: false, reason: 'op-worktree-reset-failed', path: op.path };
  try {
    // 3. the gate, on exactly the tree that lands.
    const gated = gate({ root: tree, base: M, timeoutMs: settings.land.gateTimeoutMs });
    const gateSummary = { exit: gated.exit, base: M, head: gated.head ?? landHead, counts: gated.counts ?? null, findings: (gated.findings ?? []).slice(0, 40), errors: gated.errors ?? [] };
    if (gated.exit === 1) { restore(); return { ok: false, reason: 'land-gate-red', gate: gateSummary, hint: `the op branch carries findings main does not have: fix them in ${posix(op.path)} (node scripts/checks/gate.mjs --root ${posix(op.path)} --base ${main}), commit, report the new head` }; }
    if (gated.exit !== 0) { restore(); return { ok: false, reason: 'land-gate-unavailable', gate: gateSummary, hint: `the land gate could not run a tool (${gateSummary.errors[0] ?? 'no report'}): fix the environment and settle again; a land without its gate never happens` }; }
    // 4. pre-land verify: the op's re-runnable checks, land.checks and the import check, in the same tree.
    const verify = { checks: [], imports: null, unavailable: [] };
    const failures = [];
    if (settings.land.recheck === 'declared' && recheck && checks.length) verify.checks.push(...recheck(checks, { cwd: tree, from: op.path, to: tree, timeoutMs: settings.land.recheckTimeoutMs }));
    for (const c of settings.land.checks ?? []) verify.checks.push(runLandCheck(c, tree, settings.land.recheckTimeoutMs));
    // H7: only a RED re-run refuses the land; a checker that could not run is tooling (verify.unavailable).
    const verdictOf = (c) => checkVerdictOf(c).verdict;
    verify.unavailable = verify.checks.filter((c) => verdictOf(c) === 'unavailable').map((c) => `${c.name}:${c.exitCode ?? '-'}${c.status ? ` ${c.status}` : ''}`);
    failures.push(...verify.checks.filter((c) => verdictOf(c) === 'red').map((c) => `${c.name}:${c.exitCode} ${c.tail ?? ''}`.trim()));
    if (settings.land.importCheck === 'changed-files') {
      const present = changed.filter((f) => fs.existsSync(path.join(tree, f)));
      try { verify.imports = present.length ? brokenImports(tree, { only: present, limit: 20 }) : { count: 0, files: 0, broken: [] }; }
      catch (error) { verify.imports = { error: String(error?.message ?? error).slice(0, 200) }; }
      if (verify.imports?.count) failures.push(`IMPORTS_BROKEN_AFTER_MOVE:${verify.imports.count} ${verify.imports.broken.slice(0, 3).map((b) => `${b.from} -> ${b.spec}`).join('; ')}`);
    }
    if (failures.length) {
      restore();
      return { ok: false, reason: 'product-integrate-red', failures, verify, gate: gateSummary,
        continuation: { base: M, resumeFrom: tip, branch: op.branch, note: 'the op is green on its own base and breaks on main: a continuation on the new main, never a failure' } };
    }
    // 5. compare-and-swap fast-forward of main (and the live checkout's changed paths when main is checked out there).
    const rows = git(repoRoot, ['diff', '--name-status', '--no-renames', M, landHead]).stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
    const checkedOut = git(repoRoot, ['symbolic-ref', '-q', 'HEAD']).stdout === `refs/heads/${main}`;
    const ff = checkedOut ? fastForward({ root: repoRoot, base: M, head: landHead, rows })
      : (git(repoRoot, ['update-ref', '-m', `land ${op.branch}`, `refs/heads/${main}`, landHead, M]).ok ? { ok: true } : { ok: false, reason: 'main-moved' });
    if (!ff.ok && ff.reason === 'main-moved') { restore(); return { ok: false, reason: 'main-moved', detail: ff.detail ?? null }; }
    if (!ff.ok) { restore(); return { ok: false, reason: 'land-main-refused', detail: ff.reason ?? ff.detail ?? null, dirty: ff.dirty ?? null, gate: gateSummary,
      hint: `main could not be fast-forwarded (${ff.reason ?? 'refused'}${ff.dirty ? `: the live checkout is dirty on ${ff.dirty.slice(0, 3).join(', ')}` : ''}): clean the live checkout or put it on ${main}, then settle again` }; }
    return { ok: true, before: M, after: landHead, map, changed, gate: gateSummary, verify };
  } catch (error) { restore(); throw error; }
}

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
