// install.mjs — puts the shared-checkout guard in front of an op worker.
//
// api dispatch calls guardLaunch() for every op it launches (modules/kernel/api.yaml
// conventions.sharedCheckout). Three layers, each idempotent and best effort — a
// guard that cannot be installed is reported on the dispatch receipt, never a
// reason to refuse the launch:
//  1. runtime/guards/bin — `git` and `npm` shims (scripts/guards/shim.mjs) the op
//     launch puts FIRST on the worker's PATH. On Windows each is a native exe built
//     from scripts/guards/launcher.cs (a .cmd drops arguments after a newline, a
//     .ps1 drops `--`); elsewhere a sh script.
//  2. runtime/guards/jobs/<job>.json — the job's identity and owned paths as
//     absolute paths, named to the worker's shell by STARCI_GUARD_FILE.
//  3. the target repository's reference-transaction hook (git runs it for every
//     ref update, whoever the caller is): a protected branch only moves forward
//     and is never deleted; an op (STARCI_GUARD_FILE, or for a managed op its
//     Orca terminal bound by bindGuardTerminal, unbound when that terminal closes) creates no worktree and lands
//     only its owned paths. (refs/stash stays writable: lint-staged's pre-commit
//     backup stores one; the op shim refuses a sweeping stash.)
// config.yaml `guards: {shims: false}` / `{historyHook: false}` switches a layer off.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationMs } from '../../engine/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const guardsRoot = (skillRoot = path.resolve(here, '..', '..')) => path.join(skillRoot, 'runtime', 'guards');
export const SHIM_TOOLS = Object.freeze(['git', 'npm']);
export const HOOK_MARKER = 'starci-history-guard';
export const HOOK_VERSION = 4;
export const BASH_ENV_FILE = 'bash-env.sh';

const CSC_CANDIDATES = [
  'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
  'C:/Windows/Microsoft.NET/Framework/v4.0.30319/csc.exe',
];

const tryLock = (file) => { try { fs.writeFileSync(file, String(process.pid), { flag: 'wx' }); return true; } catch { return false; } };
const mtime = (file) => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } };

/** A Windows path as Git Bash (MSYS) spells it: D:\x\y -> /d/x/y. */
export const msysPath = (p) => String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):(?=\/|$)/, (_, drive) => `/${drive.toLowerCase()}`);

/**
 * bash-env.sh — named by BASH_ENV in every op launch, so EVERY non-interactive bash the worker's agent runs sources it
 * first. Git Bash (Git for Windows bin/bash.exe, and every login shell through /etc/profile) puts /mingw64/bin and
 * /usr/bin IN FRONT of the PATH the worker was launched with, so in Git Bash a worker's `git` was the real git and the
 * guard never saw it: nivo-fe inc-c8fbf76aa499, a Devin op worker (Devin runs its commands through Git Bash) created a
 * worktree with node_modules junctions into live nivo-fe and removed it with `git worktree remove --force` - unrefused,
 * no refusal logged - and git followed the junctions and deleted 674 live files. This file puts the shim directory back
 * first, and refuses the link-making commands a shell can be stopped at: `ln`, `cmd /c mklink`, and PowerShell's
 * `New-Item -ItemType Junction|SymbolicLink|HardLink` (inline or in a `-File` script). A refusal exits 3 and is logged.
 */
export function bashEnvBody({ dir, shim, nodePath = process.execPath, platform = process.platform }) {
  const q = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
  const bin = platform === 'win32' ? msysPath(dir) : String(dir);
  const node = platform === 'win32' ? String(nodePath).replace(/\\/g, '/') : String(nodePath);
  const shimFile = platform === 'win32' ? String(shim).replace(/\\/g, '/') : String(shim);
  return `# ${HOOK_MARKER} bash env - written by the StarCi runtime (scripts/guards/install.mjs); named by BASH_ENV in an op launch.
# Git Bash puts /mingw64/bin and /usr/bin before the launch PATH, so the op's git/npm guard is put back first here
# (nivo-fe inc-c8fbf76aa499), and the commands that make a junction, symlink or hard link are refused.
[ -n "\${BASH_VERSION:-}" ] || return 0 2>/dev/null || exit 0
starci_guard_bin=${q(bin)}
case ":\${PATH}:" in ":\${starci_guard_bin}:"*) ;; *) PATH="\${starci_guard_bin}:\${PATH}"; export PATH ;; esac
starci_guard_link() { ${q(node)} ${q(shimFile)} refuse-link "$@"; return 3; }
ln() { starci_guard_link ln "$@"; }
starci_guard_cmd() { local tool="$1"; shift; case " $* " in *[Mm][Kk][Ll][Ii][Nn][Kk]*) starci_guard_link "$tool" "$@"; return 3 ;; esac; command "$tool" "$@"; }
starci_guard_ps() {
  local tool="$1" body prev="" arg; shift; body="$*"
  for arg in "$@"; do case "$prev" in -[Ff]|-[Ff][Ii][Ll][Ee]) [ -f "$arg" ] && body="$body $(cat -- "$arg" 2>/dev/null)" ;; esac; prev="$arg"; done
  if printf '%s' "$body" | grep -Eiq '(new-item|(^|[^a-z0-9_-])ni[[:space:]])[^;|]*(junction|symboliclink|hardlink)|mklink|create(symbolic|hard)link'; then starci_guard_link "$tool" "$@"; return 3; fi
  command "$tool" "$@"
}
cmd() { starci_guard_cmd cmd "$@"; }
powershell() { starci_guard_ps powershell "$@"; }
pwsh() { starci_guard_ps pwsh "$@"; }
case ":\${SHELLOPTS:-}:" in *:posix:*) ;; *) eval 'cmd.exe() { starci_guard_cmd cmd.exe "$@"; }; powershell.exe() { starci_guard_ps powershell.exe "$@"; }; pwsh.exe() { starci_guard_ps pwsh.exe "$@"; }' ;; esac
`;
}
export function writeBashEnv({ dir, shim, nodePath = process.execPath, platform = process.platform }) {
  const file = path.join(dir, BASH_ENV_FILE);
  const body = bashEnvBody({ dir, shim, nodePath, platform });
  try { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) fs.writeFileSync(file, body); } catch { return null; }
  return file;
}

/** The shim directory for this runtime, built when missing or older than its sources. */
export function ensureGuardBin({ skillRoot = path.resolve(here, '..', '..'), platform = process.platform, nodePath = process.execPath, binDir = null } = {}) {
  const dir = binDir ?? path.join(guardsRoot(skillRoot), 'bin');
  const shim = path.join(skillRoot, 'scripts', 'guards', 'shim.mjs');
  fs.mkdirSync(dir, { recursive: true });
  writeBashEnv({ dir, shim, nodePath, platform });
  if (platform !== 'win32') {
    for (const tool of SHIM_TOOLS) {
      const file = path.join(dir, tool);
      const body = `#!/bin/sh\n# ${HOOK_MARKER} shim (scripts/guards/install.mjs)\nexec '${nodePath}' '${shim}' ${tool} "$@"\n`;
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) { fs.writeFileSync(file, body); fs.chmodSync(file, 0o755); }
    }
    return { ok: true, dir };
  }
  const cfg = path.join(dir, 'shim.cfg');
  const cfgBody = `${nodePath}\r\n${shim}\r\n`;
  if (!fs.existsSync(cfg) || fs.readFileSync(cfg, 'utf8') !== cfgBody) fs.writeFileSync(cfg, cfgBody);
  const source = path.join(skillRoot, 'scripts', 'guards', 'launcher.cs');
  const stale = SHIM_TOOLS.filter((tool) => mtime(path.join(dir, `${tool}.exe`)) < mtime(source));
  if (!stale.length) return { ok: true, dir };
  const csc = CSC_CANDIDATES.find((c) => fs.existsSync(c));
  if (!csc) return { ok: false, dir, error: 'no .NET Framework csc.exe to build the guard launcher' };
  const lock = path.join(dir, '.build.lock');
  if (!tryLock(lock)) {
    // another dispatch is building it right now; a launch without the shim is refused nothing.
    if (Date.now() - mtime(lock) > 120_000) fs.rmSync(lock, { force: true });
    return { ok: false, dir, error: 'guard launcher build in progress' };
  }
  try {
    const built = path.join(dir, `.launcher-${process.pid}.exe`);
    const r = spawnSync(csc, ['-nologo', '-target:exe', `-out:${built}`, source], { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
    if (r.status !== 0 || !fs.existsSync(built)) return { ok: false, dir, error: `csc failed: ${(r.stdout || r.stderr || r.error?.message || '').trim().slice(0, 300)}` };
    for (const tool of stale) {
      const target = path.join(dir, `${tool}.exe`);
      try { fs.copyFileSync(built, target); }
      catch (e) {
        // an exe a running worker holds open cannot be replaced; move it aside first
        try { fs.renameSync(target, path.join(dir, `.${tool}-${Date.now()}.old`)); fs.copyFileSync(built, target); }
        catch { return { ok: false, dir, error: `could not replace ${tool}.exe: ${e.message}` }; }
      }
    }
    fs.rmSync(built, { force: true });
    // an exe moved aside above is freed once its worker exits
    for (const name of fs.readdirSync(dir)) if (/^\..+\.old$/.test(name)) { try { fs.rmSync(path.join(dir, name), { force: true }); } catch { /* still held */ } }
    return { ok: true, dir, built: stale };
  } finally { fs.rmSync(lock, { force: true }); }
}

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

/** runtime/guards/jobs/<job>.json — who the worker is and which absolute paths it owns. */
export function writeJobGuard({ skillRoot = path.resolve(here, '..', '..'), jobId, workflowId, ledgerRepo, owned }) {
  return writeGuardFile(path.join(guardsRoot(skillRoot), 'jobs'), jobId, { schema: 'starci/op-guard@1', jobId, workflowId,
    ledgerRepo: ledgerRepo ? path.resolve(ledgerRepo) : null, owned: [...new Set((owned ?? []).filter(Boolean).map(normOwned))], writtenAt: new Date().toISOString() });
}

/**
 * runtime/guards/terminals/<handle>.json — the job guard of a managed op, keyed by the Orca terminal its agent runs
 * in. worker-start owns a managed agent's environment, so STARCI_GUARD_FILE cannot reach it; Orca exports
 * ORCA_TERMINAL_HANDLE into that terminal, and the history hook finds the op's guard by it.
 */
export function bindGuardTerminal({ skillRoot = path.resolve(here, '..', '..'), handle, jobFile }) {
  const guard = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  return writeGuardFile(terminalsDir(skillRoot), handle, { ...guard, terminal: handle, boundAt: new Date().toISOString() });
}

/** Remove the guard bound to terminal `handle` once that terminal is closed; true when a file was removed. */
export function unbindGuardTerminal({ skillRoot = path.resolve(here, '..', '..'), handle }) {
  if (!handle) return false;
  const file = path.join(terminalsDir(skillRoot), `${safeName(handle)}.json`);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

const git = (cwd, args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout: 20_000 });

export function historyHookBody({ branches = [], shim, nodePath = process.execPath, terminals = terminalsDir() }) {
  const protectedList = [...new Set(['main', 'master', ...branches.filter((b) => /^[A-Za-z0-9._/-]+$/.test(b))])].join(' ');
  const q = (s) => `'${String(s).replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`;
  return `#!/bin/sh
# ${HOOK_MARKER} v${HOOK_VERSION} — installed by the StarCi runtime (scripts/guards/install.mjs); rewritten on every op dispatch.
# The shared branch is append-only (modules/ops/_common.yaml "Evidence, completion and commits"):
# a protected branch only moves forward and is never deleted. An op - named by STARCI_GUARD_FILE, or by the Orca
# terminal a managed op runs in (runtime/guards/terminals/<handle>.json) - never creates a worktree, and the
# commits it lands carry only its owned paths (scripts/guards/shim.mjs verify-commit).
if [ "$1" != "prepared" ]; then cat >/dev/null; exit 0; fi
PROTECTED=" ${protectedList} "
guard="\${STARCI_GUARD_FILE:-}"
if [ -z "$guard" ] && [ -n "\${ORCA_TERMINAL_HANDLE:-}" ]; then
  guard=${q(terminals)}/"$(printf '%s' "$ORCA_TERMINAL_HANDLE" | tr -c 'A-Za-z0-9._-' '_')".json
fi
[ -n "$guard" ] && [ -f "$guard" ] || guard=""
status=0
op_worktree_refused=0
while read -r old new ref; do
  case "$ref" in
    HEAD)
      # An op worker never creates a git worktree (nivo-fe inc-c8fbf76aa499). \`git worktree add\` writes the new
      # worktree's HEAD from the checkout it runs in, whose own HEAD is not locked: whatever git binary the worker
      # used (Git Bash's own git bypasses the PATH shim), the new worktree's first ref update is refused here.
      if [ -n "$guard" ] && [ "$op_worktree_refused" = 0 ]; then
        gd=$(git rev-parse --git-dir 2>/dev/null)
        fmt=$(git rev-parse --show-ref-format 2>/dev/null)
        if [ -n "$gd" ] && [ "$fmt" = "files" ] && [ ! -e "$gd/HEAD.lock" ]; then
          echo "starci history guard: refused - an op worker never creates a git worktree; work in the checkout you were dispatched to (a private worktree with links into the live repository deleted live files, nivo-fe inc-c8fbf76aa499)" >&2
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
        STARCI_GUARD_FILE="$guard" ${q(nodePath)} ${q(shim)} verify-commit "$old" "$new" || status=1
      fi ;;
  esac
done
exit $status
`;
}

/**
 * ensureHistoryHook(repoRoot) -> {installed, path?, reason?}
 * Writes the reference-transaction hook into the repository's effective hooks
 * directory (core.hooksPath, e.g. husky's .husky/_, else .git/hooks). A foreign
 * hook of that name is never overwritten; a hooks directory whose new file git
 * would offer for tracking is left alone (no foreign file in a product repo).
 */
export function ensureHistoryHook(repoRoot, { skillRoot = path.resolve(here, '..', '..'), nodePath = process.execPath } = {}) {
  const top = git(repoRoot, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) return { installed: false, reason: 'not-a-git-checkout' };
  const root = path.resolve(top.stdout.trim());
  const hooks = git(root, ['rev-parse', '--git-path', 'hooks']);
  if (hooks.status !== 0) return { installed: false, reason: 'no-hooks-path' };
  const hooksDir = path.resolve(root, hooks.stdout.trim());
  const file = path.join(hooksDir, 'reference-transaction');
  const inside = (parent, child) => { const rel = path.relative(parent, child); return !rel.startsWith('..') && !path.isAbsolute(rel); };
  const inWorktree = inside(root, hooksDir) && !inside(path.join(root, '.git'), hooksDir);
  if (inWorktree && !fs.existsSync(file)) {
    const ignored = git(root, ['check-ignore', '-q', '--no-index', '--', path.relative(root, file).replace(/\\/g, '/')]);
    if (ignored.status !== 0) return { installed: false, reason: 'hooks-dir-tracked', path: file };
  }
  const branches = [];
  const list = git(root, ['worktree', 'list', '--porcelain']);
  if (list.status === 0) for (const line of list.stdout.split(/\r?\n/)) if (line.startsWith('branch refs/heads/')) branches.push(line.slice('branch refs/heads/'.length));
  const body = historyHookBody({ branches, shim: path.join(skillRoot, 'scripts', 'guards', 'shim.mjs'), nodePath, terminals: terminalsDir(skillRoot) });
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

const guardSettings = (config) => ({
  shims: config?.guards?.shims !== false,
  historyHook: config?.guards?.historyHook !== false,
});

/**
 * guardLaunch({jobId, workflowId, ledgerRepo, owned, repos, config, shims}) ->
 *   {env, pathPrefix, receipt}
 * env and pathPrefix go into the op launch command (scripts/agent/lib.mjs
 * buildSpawnCommand); receipt rides on the dispatch record. `shims: false`: the
 * launch sets no environment (a managed worker-start agent), so no shim layer.
 */
export function guardLaunch({ skillRoot = path.resolve(here, '..', '..'), jobId, workflowId, ledgerRepo, owned = [], repos = [], config = null, shims = true }) {
  const settings = guardSettings(config);
  if (!shims) settings.shims = false;
  const receipt = { shims: null, jobFile: null, hooks: [] };
  const env = {};
  let pathPrefix = null;
  try {
    const file = writeJobGuard({ skillRoot, jobId, workflowId, ledgerRepo, owned });
    env.STARCI_GUARD_FILE = file;
    receipt.jobFile = file;
  } catch (e) { receipt.jobFile = { error: String(e?.message ?? e) }; }
  if (settings.shims) {
    try {
      const bin = ensureGuardBin({ skillRoot });
      receipt.shims = bin.ok ? { dir: bin.dir, ...(bin.built ? { built: bin.built } : {}) } : { error: bin.error };
      if (bin.ok) {
        pathPrefix = bin.dir; env.STARCI_GUARD_BIN = bin.dir;
        // Git Bash re-prepends its own bin directories; BASH_ENV puts the guard back first in every bash the worker runs.
        const bashEnv = path.join(bin.dir, BASH_ENV_FILE);
        if (fs.existsSync(bashEnv)) env.BASH_ENV = bashEnv.replace(/\\/g, '/');
      }
    } catch (e) { receipt.shims = { error: String(e?.message ?? e) }; }
  } else receipt.shims = { disabled: true };
  if (settings.historyHook) {
    for (const repo of [...new Set(repos.filter(Boolean).map((r) => path.resolve(r)))]) {
      try { receipt.hooks.push({ repo, ...ensureHistoryHook(repo, { skillRoot }) }); }
      catch (e) { receipt.hooks.push({ repo, installed: false, reason: String(e?.message ?? e) }); }
    }
  } else receipt.hooks = [{ disabled: true }];
  return { env, pathPrefix, receipt };
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
  err('shims', receipt.shims?.error);
  err('terminal', receipt.terminal?.error);
  for (const hook of Array.isArray(receipt.hooks) ? receipt.hooks : []) if (hook?.installed === false) err(`history hook ${hook.repo ?? ''}`.trim(), hook.reason ?? 'not installed');
  return out;
}
