// git.mjs — the one spawn the runtime's guard/kernel scripts run git through.
//
// Every copy spelt the same options by hand - encoding:'utf8', windowsHide:true, sometimes a
// timeout - with two shapes: `git args` in a cwd (shim's pathspec scans, footprint-scan,
// safe-remove's prune) and `git -C dir args` (settle-landed, install, terminal-dedupe's worktree
// list). gitSpawn keeps the spawnSync(file, args, options) signature so an injected runner or a
// spec's fake takes the same three arguments; runGit is the `-C` convenience; gitResult folds the
// result into settle-landed's {ok, stdout, error} envelope.
import { spawnSync } from 'node:child_process';

/**
 * Spawn `file` (the git binary) once with `args`: utf8 text, a hidden window, never a shell.
 * Options pass through last, so cwd, timeout, input, env, maxBuffer or encoding:'buffer' land as given.
 */
export const gitSpawn = (file, args, options = {}) =>
  spawnSync(file, args, { encoding: 'utf8', windowsHide: true, ...options });

/** `git args` in `cwd`, or `git -C dir args` when `dir` is given. `git` overrides the binary. */
export const runGit = (args, { cwd = null, dir = null, git = 'git', ...options } = {}) =>
  gitSpawn(git, [...(dir ? ['-C', dir] : []), ...args], cwd ? { cwd, ...options } : options);

/** runGit's result as {ok, stdout, error}: ok only on a clean exit, error from stderr or the spawn. */
export function gitResult(args, options = {}) {
  const r = runGit(args, options);
  return {
    ok: !r.error && r.status === 0,
    stdout: r.stdout ?? '',
    error: (r.stderr ?? '').trim() || String(r.error?.message ?? (r.status == null ? 'timed out' : `exit ${r.status}`)),
  };
}

/**
 * git's C-quoted diff path decoded - `"b\303\251"` a `+++ ` header line prints when core.quotePath
 * covers the name. Octal escapes become \u00XX for JSON.parse (which answers \n, \t, \" and \\);
 * a value not wrapped in quotes passes through unchanged.
 */
export const unquoteDiffPath = (value) =>
  /^".*"$/.test(value)
    ? JSON.parse(value.replace(/\\([0-7]{3})/g, (_, octal) => `\\u00${Number.parseInt(octal, 8).toString(16).padStart(2, '0')}`))
    : value;
