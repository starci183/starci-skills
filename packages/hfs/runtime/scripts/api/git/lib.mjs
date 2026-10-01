// scripts/api/git/lib.mjs — the one place the runtime spawns git (RT_EXTERNAL_OWNER of scripts/hfs/runtime-rules/external-owner.mjs enforces it).
//
// Every caller spelt the same options by hand - encoding:'utf8', windowsHide:true, sometimes a timeout - with two shapes:
// `git args` in a cwd and `git -C dir args`. gitOutput is the throwing shape (stdout text, or an Error on a non-zero exit).
// gitSpawn keeps the spawnSync(file, args, options) signature so an injected runner or a spec's fake takes the same three
// arguments; runGit is the `-C` convenience; gitResult folds the result into the {ok, stdout, error} envelope; gitRunner
// folds any caller's runner into {ok, stdout, stderr}. The call files beside this one (worktree-*.mjs, rev-parse.mjs, ...)
// each name one git verb.
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
 * A caller's git runner folded to (args, opts) -> {ok, stdout, stderr}. `git`: the caller's runner (args, {cwd}) ->
 * {ok|status, stdout|out, stderr|err} (a spec's fake); null: runGit with a 5-minute timeout and a 64 MB buffer.
 */
export const gitRunner = (git = null) => (args, opts = {}) => {
  const r = git ? git(args, opts) : runGit(args, { timeout: 300_000, maxBuffer: 64 * 1024 * 1024, ...opts });
  return { ok: r?.ok ?? (!r?.error && r?.status === 0), stdout: String(r?.stdout ?? r?.out ?? '').trim(), stderr: String(r?.stderr ?? r?.err ?? r?.error?.message ?? r?.error ?? '').trim() };
};
