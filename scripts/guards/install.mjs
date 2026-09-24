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
//     ref update, whoever the caller is — managed agents and humans included):
//     a protected branch only moves forward and is never deleted, and an op's
//     commit (STARCI_GUARD_FILE set) carries only its owned paths. (refs/stash
//     stays writable: lint-staged's pre-commit backup stores one; the op shim
//     refuses a sweeping stash.)
// config.yaml `guards: {shims: false}` / `{historyHook: false}` switches a layer off.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const guardsRoot = (skillRoot = path.resolve(here, '..', '..')) => path.join(skillRoot, 'runtime', 'guards');
export const SHIM_TOOLS = Object.freeze(['git', 'npm']);
export const HOOK_MARKER = 'starci-history-guard';
export const HOOK_VERSION = 2;

const CSC_CANDIDATES = [
  'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
  'C:/Windows/Microsoft.NET/Framework/v4.0.30319/csc.exe',
];

const tryLock = (file) => { try { fs.writeFileSync(file, String(process.pid), { flag: 'wx' }); return true; } catch { return false; } };
const mtime = (file) => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } };

/** The shim directory for this runtime, built when missing or older than its sources. */
export function ensureGuardBin({ skillRoot = path.resolve(here, '..', '..'), platform = process.platform, nodePath = process.execPath, binDir = null } = {}) {
  const dir = binDir ?? path.join(guardsRoot(skillRoot), 'bin');
  const shim = path.join(skillRoot, 'scripts', 'guards', 'shim.mjs');
  fs.mkdirSync(dir, { recursive: true });
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
    return { ok: true, dir, built: stale };
  } finally { fs.rmSync(lock, { force: true }); }
}

const normOwned = (p) => path.resolve(p).replace(/\\/g, '/');

/** runtime/guards/jobs/<job>.json — who the worker is and which absolute paths it owns. */
export function writeJobGuard({ skillRoot = path.resolve(here, '..', '..'), jobId, workflowId, ledgerRepo, owned }) {
  const dir = path.join(guardsRoot(skillRoot), 'jobs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(jobId).replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
  const body = { schema: 'starci/op-guard@1', jobId, workflowId, ledgerRepo: ledgerRepo ? path.resolve(ledgerRepo) : null,
    owned: [...new Set((owned ?? []).filter(Boolean).map(normOwned))], writtenAt: new Date().toISOString() };
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  // A job's guard file outlives its worker only as history; a week later it is nobody's.
  try {
    const cutoff = Date.now() - JOB_GUARD_TTL_MS;
    for (const name of fs.readdirSync(dir)) {
      const other = path.join(dir, name);
      if (other !== file && name.endsWith('.json') && fs.statSync(other).mtimeMs < cutoff) fs.rmSync(other, { force: true });
    }
  } catch { /* pruning is housekeeping */ }
  return file;
}
const JOB_GUARD_TTL_MS = 7 * 24 * 3600_000;

const git = (cwd, args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout: 20_000 });

export function historyHookBody({ branches = [], shim, nodePath = process.execPath }) {
  const protectedList = [...new Set(['main', 'master', ...branches.filter((b) => /^[A-Za-z0-9._/-]+$/.test(b))])].join(' ');
  const q = (s) => `'${String(s).replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`;
  return `#!/bin/sh
# ${HOOK_MARKER} v${HOOK_VERSION} — installed by the StarCi runtime (scripts/guards/install.mjs); rewritten on every op dispatch.
# The shared branch is append-only (modules/ops/_common.yaml "Evidence, completion and commits"):
# a protected branch only moves forward and is never deleted, and
# an op's commit (STARCI_GUARD_FILE set) carries only that op's owned paths (scripts/guards/shim.mjs
# verify-commit). The owner may override ONE command: STARCI_HISTORY_GUARD=owner-override git ...
if [ "$1" != "prepared" ]; then cat >/dev/null; exit 0; fi
PROTECTED=" ${protectedList} "
status=0
while read -r old new ref; do
  case "$ref" in
    refs/heads/*)
      b="\${ref#refs/heads/}"
      case "$PROTECTED" in *" $b "*) ;; *) continue ;; esac
      [ "$STARCI_HISTORY_GUARD" = "owner-override" ] && continue
      case "$new" in *[!0]*) ;; *)
        echo "starci history guard: refused deleting protected branch $b" >&2; status=1; continue ;; esac
      case "$old" in *[!0]*) ;; *) old=$(git rev-parse -q --verify "$ref^{commit}" 2>/dev/null) ;; esac
      [ -z "$old" ] && continue
      if ! git merge-base --is-ancestor "$old" "$new" 2>/dev/null; then
        echo "starci history guard: refused moving protected branch $b from $old to $new - not a fast-forward (reset/amend/rebase rewrite a branch other workflows commit on; undo a commit with git revert)" >&2
        status=1; continue
      fi
      if [ -n "$STARCI_GUARD_FILE" ] && [ -f "$STARCI_GUARD_FILE" ]; then
        ${q(nodePath)} ${q(shim)} verify-commit "$old" "$new" || status=1
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
  const body = historyHookBody({ branches, shim: path.join(skillRoot, 'scripts', 'guards', 'shim.mjs'), nodePath });
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
 * guardLaunch({jobId, workflowId, ledgerRepo, owned, repos, config}) ->
 *   {env, pathPrefix, receipt}
 * env and pathPrefix go into the op launch command (scripts/agent/lib.mjs
 * buildSpawnCommand); receipt rides on the dispatch record.
 */
export function guardLaunch({ skillRoot = path.resolve(here, '..', '..'), jobId, workflowId, ledgerRepo, owned = [], repos = [], config = null }) {
  const settings = guardSettings(config);
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
      if (bin.ok) { pathPrefix = bin.dir; env.STARCI_GUARD_BIN = bin.dir; }
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
