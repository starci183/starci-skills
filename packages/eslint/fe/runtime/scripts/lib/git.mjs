// git.mjs — the one spawn the runtime's guard/kernel scripts run git through.
//
// Every copy spelt the same options by hand - encoding:'utf8', windowsHide:true, sometimes a
// timeout - with two shapes: `git args` in a cwd (shim's pathspec scans, footprint-scan,
// safe-remove's prune) and `git -C dir args` (settle-landed, install, terminal-dedupe's worktree
// list). gitOutput is the throwing shape (stdout text, or an Error on a non-zero exit). gitSpawn keeps the spawnSync(file, args, options) signature so an injected runner or a
// spec's fake takes the same three arguments; runGit is the `-C` convenience; gitResult folds the
// result into settle-landed's {ok, stdout, error} envelope.
import { spawnSync } from 'node:child_process';

/**
 * Spawn `file` (the git binary) once with `args`: utf8 text, a hidden window, never a shell.
 * Options pass through last, so cwd, timeout, input, env or maxBuffer land as given. encoding:'buffer'
 * is a request for raw bytes, not an encoding: spawnSync encodes a string `input` with it and throws
 * ERR_UNKNOWN_ENCODING, so it reaches spawnSync as encoding:null (Buffer output either way).
 */
export const gitSpawn = (file, args, options = {}) => {
  const spawn = { encoding: 'utf8', windowsHide: true, ...options };
  if (spawn.encoding === 'buffer') spawn.encoding = null;
  return spawnSync(file, args, spawn);
};

/** `git args` in `cwd`, or `git -C dir args` when `dir` is given. `git` overrides the binary. */
export const runGit = (args, { cwd = null, dir = null, git = 'git', ...options } = {}) =>
  gitSpawn(git, [...(dir ? ['-C', dir] : []), ...args], cwd ? { cwd, ...options } : options);

/** runGit's stdout as text; throws the spawn error, or an Error carrying git's stderr and exit status, unless git exits 0. */
export function gitOutput(args, options = {}) {
  const r = runGit(args, options);
  if (r.error) throw r.error;
  if (r.status !== 0) throw Object.assign(new Error(`git ${args.join(' ')} exited ${r.status}: ${(r.stderr ?? '').trim()}`), { status: r.status, stderr: r.stderr });
  return r.stdout;
}

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
