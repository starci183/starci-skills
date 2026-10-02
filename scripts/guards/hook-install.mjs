// install.mjs — puts the shared-checkout guard around an op or [Worker] agent.
//
// api dispatch (opGuardLaunch), the [Worker] launch (workers.mjs workerGuard) and the Kernel launch
// (scripts/kernel/start-workflow.mjs, role 'kernel') call guardLaunch() for every agent they start
// (modules/kernel/api.yaml conventions.sharedCheckout). Each layer is idempotent and best effort - a
// guard that cannot be installed is reported on the dispatch receipt, never a reason to refuse the launch:
//  1. <guards root>/jobs/<job>.json — the job's identity and owned paths as absolute paths. worker-start owns the
//     agent's environment, so the launch binds it to the agent's Orca terminal (bindGuardTerminal ->
//     <guards root>/terminals/<handle>.json, unbound when that terminal closes). The agent's host runs
//     scripts/guards/command-guard.mjs as a PreToolUse hook (registered by launch trust, scripts/agent/trust.mjs):
//     it finds the guard by ORCA_TERMINAL_HANDLE and refuses a shell command the policy forbids before it runs.
//  2. the target repository's reference-transaction hook (git runs it for every ref update, whoever the caller is):
//     a protected branch only moves forward and is never deleted; an op (its Orca terminal bound to a guard) creates
//     no worktree and lands only its owned paths. (refs/stash stays writable: lint-staged's pre-commit backup stores
//     one; the command guard refuses a sweeping stash.)
//  3. the target repository's pre-commit hook (ensureWorkHook): a commit that stages files under .starciwork/ or
//     .starcistacks/ is refused when a YAML does not parse, a record the commit touches fails its scoped strict
//     validation, or a non-.enc file carries a secret (scripts/work/validate/work-hygiene.mjs; e2e never runs there).
// config.yaml `guards: {historyHook: false}` / `{workHook: false}` switches a hook layer off.
import fs from 'node:fs';
import path from 'node:path';
import { guardsRoot } from './guards-root.mjs';
import { fileURLToPath } from 'node:url';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { checkIgnore } from '../api/git/check-ignore.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { worktreeListQuery } from '../api/git/worktree-list-query.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { allocationMs } from '../../engine/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export { guardsRoot };
export const HOOK_MARKER = 'starci-history-guard';
export const HOOK_VERSION = 6;
export const WORK_HOOK_MARKER = 'starci-work-guard';
export const WORK_HOOK_VERSION = 1;

const normOwned = (p) => path.resolve(p).replace(/\\/g, '/');
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');
export const JOB_GUARD_TTL_MS = allocationMs('jobGuard.ttlMs');
export const terminalsDir = (skillRoot = path.resolve(here, '..', '..')) => path.join(guardsRoot(skillRoot), 'terminals');

// tmp + rename: a reader never sees a torn guard file. Files of the directory older than JOB_GUARD_TTL_MS are pruned: a
// guard outlives its worker only as history.
function writeGuardFile(dir, name, body) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safeName(name)}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  fs.renameSync(tmp, file);
  try {
    const cutoff = Date.now() - JOB_GUARD_TTL_MS;
    for (const other of fs.readdirSync(dir)) {
      const full = path.join(dir, other);
      if (full !== file && fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true });
    }
  } catch { /* pruning is housekeeping */ }
  return file;
}

/**
 * The roles a job guard is written for. 'op' is an op or [Worker] agent. 'kernel' is the Kernel: its shell commands meet
 * the same command guard (PreToolUse) as an op's, but the history hook does not apply its op rules to a kernel guard,
 * because the runtime's own git (checkpoints, land scratch trees) runs as children of the Kernel's api calls and
 * inherits its ORCA_TERMINAL_HANDLE (contract change kernel-guard-file).
 */
export const GUARD_ROLES = Object.freeze(['op', 'kernel']);

/** <guards root>/jobs/<job>.json — who the worker is, its role and which absolute paths it owns. */
export function writeJobGuard({ skillRoot = path.resolve(here, '..', '..'), jobId, workflowId, ledgerRepo, owned, workflowWorktree = null, role = 'op' }) {
  if (!GUARD_ROLES.includes(role)) throw new Error(`unknown guard role ${role}`);
  return writeGuardFile(path.join(guardsRoot(skillRoot), 'jobs'), jobId, { schema: 'starci/op-guard@1', role, jobId, workflowId,
    ledgerRepo: ledgerRepo ? path.resolve(ledgerRepo) : null, owned: [...new Set((owned ?? []).filter(Boolean).map(normOwned))],
    // The workflow worktree the op works in (scripts/kernel/workflow-worktree.mjs), or null: the guard refuses git history
    // and ref changes inside it - only the runtime's checkpoint commits there.
    workflowWorktree: workflowWorktree ? path.resolve(workflowWorktree) : null, writtenAt: new Date().toISOString() });
}

/**
 * <guards root>/terminals/<handle>.json — the job guard of a managed op, keyed by the Orca terminal its agent runs
 * in. worker-start owns a managed agent's environment; Orca exports ORCA_TERMINAL_HANDLE into that terminal, and the
 * command guard (PreToolUse hook) and the history hook find the op's guard by it.
 */
export function bindGuardTerminal({ skillRoot = path.resolve(here, '..', '..'), handle, jobFile }) {
  const guard = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  return writeGuardFile(terminalsDir(skillRoot), handle, { ...guard, terminal: handle, boundAt: new Date().toISOString() });
}

/**
 * <guards root>/seats/<handle>.json — the tools a seat's agent may not use, keyed by the Orca terminal it runs in.
 * worker-start takes no provider argv, so a seat's tool denial (the [Supervisor]'s Agent/Task, start-supervisor.mjs
 * SEAT_DENIED_TOOLS) is enforced by the project PreToolUse hook (.claude/settings.json -> scripts/guards/seat-tools.mjs),
 * which denies a tool only for the terminal bound here.
 */
export const seatsDir = (skillRoot = path.resolve(here, '..', '..')) => path.join(guardsRoot(skillRoot), 'seats');
export function bindSeatGuard({ skillRoot = path.resolve(here, '..', '..'), handle, role, deniedTools }) {
  return writeGuardFile(seatsDir(skillRoot), handle, { schema: 'starci/seat-guard@1', role, terminal: handle,
    deniedTools: [...new Set((deniedTools ?? []).map(String))], boundAt: new Date().toISOString() });
}

/** Remove the guard bound to terminal `handle` once that terminal is closed; true when a file was removed. */
export function unbindGuardTerminal({ skillRoot = path.resolve(here, '..', '..'), handle }) {
  if (!handle) return false;
  const file = path.join(terminalsDir(skillRoot), `${safeName(handle)}.json`);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

/** One git call (a scripts/api/git call file) in the repository at `cwd`. */
const git = (call, cwd, args) => call(args, { dir: cwd, timeout: 20_000 });

export function historyHookBody({ branches = [], verify, nodePath = process.execPath, terminals = terminalsDir() }) {
  const protectedList = [...new Set(['main', 'master', ...branches.filter((b) => /^[A-Za-z0-9._/-]+$/.test(b))])].join(' ');
  const q = (s) => `'${String(s).replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`;
  return `#!/bin/sh
# ${HOOK_MARKER} v${HOOK_VERSION} — installed by the StarCi runtime (scripts/guards/hook-install.mjs); rewritten on every op dispatch.
# The shared branch is append-only (modules/ops/_common.yaml "Evidence, completion and commits"):
# a protected branch only moves forward and is never deleted. An op - named by the Orca terminal it runs in
# (<guards root>/terminals/<handle>.json) - never creates a worktree, and the commits it lands carry only its
# owned paths (scripts/guards/verify-commit.mjs).
if [ "$1" != "prepared" ]; then cat >/dev/null; exit 0; fi
PROTECTED=" ${protectedList} "
guard=""
if [ -n "\${ORCA_TERMINAL_HANDLE:-}" ]; then
  guard=${q(terminals)}/"$(printf '%s' "$ORCA_TERMINAL_HANDLE" | tr -c 'A-Za-z0-9._-' '_')".json
fi
[ -n "$guard" ] && [ -f "$guard" ] || guard=""
# A kernel guard (role "kernel", writeJobGuard) is the command guard's alone: the runtime's own git under the Kernel's
# api calls inherits its terminal, so the op rules below never read it.
if [ -n "$guard" ] && grep -q '"role": "kernel"' "$guard"; then guard=""; fi
status=0
op_worktree_refused=0
while read -r old new ref; do
  case "$ref" in
    HEAD)
      # An op worker never creates a git worktree. \`git worktree add\` writes the new
      # worktree's HEAD from the checkout it runs in, whose own HEAD is not locked: however the worker ran git, the
      # new worktree's first ref update is refused here.
      if [ -n "$guard" ] && [ "$op_worktree_refused" = 0 ]; then
        gd=$(git rev-parse --git-dir 2>/dev/null)
        fmt=$(git rev-parse --show-ref-format 2>/dev/null)
        if [ -n "$gd" ] && [ "$fmt" = "files" ] && [ ! -e "$gd/HEAD.lock" ]; then
          echo "starci history guard: refused - an op worker never creates a git worktree; work in the checkout you were dispatched to (a private worktree with links into the live repository deleted live files)" >&2
          op_worktree_refused=1; status=1
        fi
      fi ;;
    refs/heads/*)
      b="\${ref#refs/heads/}"
      case "$PROTECTED" in *" $b "*) ;; *) continue ;; esac
      case "$new" in *[!0]*) ;; *)
        echo "starci history guard: refused deleting protected branch $b" >&2; status=1; continue ;; esac
      case "$old" in *[!0]*) ;; *) old=$(git rev-parse -q --verify "$ref^{commit}" 2>/dev/null) ;; esac
      [ -z "$old" ] && continue
      if ! git merge-base --is-ancestor "$old" "$new" 2>/dev/null; then
        echo "starci history guard: refused moving protected branch $b from $old to $new - not a fast-forward (reset/amend/rebase rewrite a branch other workflows commit on; undo a commit with git revert)" >&2
        status=1; continue
      fi
      if [ -n "$guard" ]; then
        STARCI_GUARD_FILE="$guard" ${q(nodePath)} ${q(verify)} "$old" "$new" || status=1
      fi ;;
  esac
done
exit $status
`;
}

/**
 * hookTarget(repoRoot, name) -> {root, hooksDir, file} | {installed: false, reason, path?}
 * Resolves where hook `name` goes: into the repository's effective hooks
 * directory (core.hooksPath, e.g. husky's .husky/_, else .git/hooks). A foreign
 * hook of that name is never overwritten; a hooks directory whose new file git
 * would offer for tracking is left alone (no foreign file in a product repo),
 * except an absent, untracked one (husky's .husky/_ in a linked worktree), which
 * gets husky's own self-ignoring `.gitignore` of `*`.
 */
function hookTarget(repoRoot, name) {
  const top = git(revParseQuery, repoRoot, ['--show-toplevel']);
  if (top.status !== 0) return { installed: false, reason: 'not-a-git-checkout' };
  const root = path.resolve(top.stdout.trim());
  const hooks = git(revParseQuery, root, ['--git-path', 'hooks']);
  if (hooks.status !== 0) return { installed: false, reason: 'no-hooks-path' };
  const hooksDir = path.resolve(root, hooks.stdout.trim());
  const file = path.join(hooksDir, name);
  const inside = (parent, child) => { const rel = path.relative(parent, child); return !rel.startsWith('..') && !path.isAbsolute(rel); };
  const inWorktree = inside(root, hooksDir) && !inside(path.join(root, '.git'), hooksDir);
  if (inWorktree && !fs.existsSync(file)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const isIgnored = () => git(checkIgnore, root, ['-q', '--no-index', '--', rel]).status === 0;
    if (!isIgnored()) {
      // A relative core.hooksPath (husky's .husky/_) resolves per checkout: husky generates that directory, with
      // its own `.gitignore` of `*`, only where `npm install` ran, so a linked worktree has none. A hooks directory
      // that does not exist yet, holds no file and has nothing tracked
      // is given husky's own self-ignoring layout; anything else stays refused.
      const relDir = path.relative(root, hooksDir).replace(/\\/g, '/');
      const absent = !fs.existsSync(hooksDir);
      const empty = absent || (fs.statSync(hooksDir).isDirectory() && fs.readdirSync(hooksDir).length === 0);
      const tracked = git(lsFiles, root, ['--', relDir]);
      if (!empty || tracked.status !== 0 || tracked.stdout.trim()) return { installed: false, reason: 'hooks-dir-tracked', path: file };
      fs.mkdirSync(hooksDir, { recursive: true });
      fs.writeFileSync(path.join(hooksDir, '.gitignore'), '*\n');
      if (!isIgnored()) {
        if (absent) safeRemove(hooksDir, { hold: artifactHoldReason });
        else fs.rmSync(path.join(hooksDir, '.gitignore'), { force: true });
        return { installed: false, reason: 'hooks-dir-tracked', path: file };
      }
    }
  }
  return { root, hooksDir, file };
}

/**
 * ensureHistoryHook(repoRoot) -> {installed, path?, reason?}
 * Writes the reference-transaction hook into the repository's effective hooks directory (hookTarget).
 * A foreign hook of that name is never overwritten.
 */
export function ensureHistoryHook(repoRoot, { skillRoot = path.resolve(here, '..', '..'), nodePath = process.execPath } = {}) {
  const target = hookTarget(repoRoot, 'reference-transaction');
  if (target.installed === false) return target;
  const { root, hooksDir, file } = target;
  const branches = [];
  const list = git(worktreeListQuery, root, ['--porcelain']);
  if (list.status === 0) for (const line of list.stdout.split(/\r?\n/)) if (line.startsWith('branch refs/heads/')) branches.push(line.slice('branch refs/heads/'.length));
  const body = historyHookBody({ branches, verify: path.join(skillRoot, 'scripts', 'guards', 'verify-commit.mjs'), nodePath, terminals: terminalsDir(skillRoot) });
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (!current.includes(HOOK_MARKER)) return { installed: false, reason: 'foreign-hook', path: file };
    if (current === body) return { installed: true, path: file, changed: false };
  }
  fs.mkdirSync(hooksDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o755 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o755); } catch { /* windows */ }
  return { installed: true, path: file, changed: true };
}

/**
 * The pre-commit hook body. The check runs only when the index holds a file under .starciwork/ or .starcistacks/ (a
 * commit of anything else costs one git call). A husky dispatcher that shared the hook's place is chained after it.
 */
export function workHookBody({ check, nodePath = process.execPath }) {
  const q = (s) => `'${String(s).replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`;
  return `#!/bin/sh
# ${WORK_HOOK_MARKER} v${WORK_HOOK_VERSION} - installed by the StarCi runtime (scripts/guards/hook-install.mjs); rewritten on every op dispatch.
# Staged Work and stack files are checked before the commit exists: YAML that parses, records that pass their scoped
# strict validation, and no secret outside an .enc file (scripts/work/validate/work-hygiene.mjs). e2e never runs here.
if git diff --cached --name-only --diff-filter=ACMR | grep -Eq '(^|/)\\.(starciwork|starcistacks)/'; then
  ${q(nodePath)} ${q(check)} staged --repo "$(git rev-parse --show-toplevel)" || exit 1
fi
# husky's generated dispatcher (.husky/_/h) keeps running the repository's own pre-commit
if [ -f "$(dirname "$0")/h" ]; then . "$(dirname "$0")/h"; fi
`;
}
// husky 9 writes this two-line dispatcher into .husky/_/<hook>; it is generated output, so it may be wrapped.
const HUSKY_DISPATCHER = /^#!\/usr\/bin\/env sh\s+\.\s+"\$\(dirname "\$0"\)\/h"\s*$/;

/**
 * ensureWorkHook(repoRoot) -> {installed, path?, reason?, changed?}
 * Writes the pre-commit hook next to ensureHistoryHook's, by the same hookTarget rules. A foreign hook is never
 * overwritten, except husky's generated dispatcher, which the new hook wraps.
 */
export function ensureWorkHook(repoRoot, { skillRoot = path.resolve(here, '..', '..'), nodePath = process.execPath } = {}) {
  const target = hookTarget(repoRoot, 'pre-commit');
  if (target.installed === false) return target;
  const { hooksDir, file } = target;
  const body = workHookBody({ check: path.join(skillRoot, 'scripts', 'work', 'validate', 'work-hygiene.mjs'), nodePath });
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (current.includes(WORK_HOOK_MARKER)) { if (current === body) return { installed: true, path: file, changed: false }; }
    else if (!HUSKY_DISPATCHER.test(current)) return { installed: false, reason: 'foreign-hook', path: file };
  }
  fs.mkdirSync(hooksDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o755 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o755); } catch { /* windows */ }
  return { installed: true, path: file, changed: true };
}

const guardSettings = (config) => ({
  historyHook: config?.guards?.historyHook !== false,
  workHook: config?.guards?.workHook !== false,
});

/**
 * guardLaunch({jobId, workflowId, ledgerRepo, owned, repos, config, workflowWorktree, role}) -> {receipt}
 * receipt rides on the dispatch record. The caller binds receipt.jobFile to the agent's Orca terminal once
 * worker-start returns it (bindGuardTerminal), which is what the command guard and the history hook read.
 */
export function guardLaunch({ skillRoot = path.resolve(here, '..', '..'), jobId, workflowId, ledgerRepo, owned = [], repos = [], config = null, workflowWorktree = null, role = 'op' }) {
  const settings = guardSettings(config);
  const receipt = { jobFile: null, hooks: [] };
  try { receipt.jobFile = writeJobGuard({ skillRoot, jobId, workflowId, ledgerRepo, owned, workflowWorktree, role }); }
  catch (e) { receipt.jobFile = { error: String(e?.message ?? e) }; }
  if (settings.historyHook) {
    for (const repo of [...new Set(repos.filter(Boolean).map((r) => path.resolve(r)))]) {
      try { receipt.hooks.push({ repo, ...ensureHistoryHook(repo, { skillRoot }) }); }
      catch (e) { receipt.hooks.push({ repo, installed: false, reason: String(e?.message ?? e) }); }
    }
  } else receipt.hooks = [{ disabled: true }];
  if (settings.workHook) {
    receipt.workHooks = [];
    for (const repo of [...new Set(repos.filter(Boolean).map((r) => path.resolve(r)))]) {
      try { receipt.workHooks.push({ repo, ...ensureWorkHook(repo, { skillRoot }) }); }
      catch (e) { receipt.workHooks.push({ repo, installed: false, reason: String(e?.message ?? e) }); }
    }
  } else receipt.workHooks = [{ disabled: true }];
  return { receipt };
}

/**
 * The layers a dispatch receipt (guardLaunch's, as api dispatch records it on op-dispatched `guard`) says did not
 * install: [] for a whole guard. A switched-off layer is not a failure.
 */
export function guardReceiptErrors(receipt) {
  if (!receipt || typeof receipt !== 'object') return [];
  const out = [];
  const err = (layer, value) => { if (value) out.push(`${layer}: ${String(value).slice(0, 160)}`); };
  err('guard', receipt.error);
  err('jobFile', receipt.jobFile?.error);
  err('terminal', receipt.terminal?.error);
  for (const hook of Array.isArray(receipt.hooks) ? receipt.hooks : []) if (hook?.installed === false) err(`history hook ${hook.repo ?? ''}`.trim(), hook.reason ?? 'not installed');
  for (const hook of Array.isArray(receipt.workHooks) ? receipt.workHooks : []) if (hook?.installed === false) err(`work hook ${hook.repo ?? ''}`.trim(), hook.reason ?? 'not installed');
  return out;
}
