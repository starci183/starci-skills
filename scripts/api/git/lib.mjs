// scripts/api/git/lib.mjs — the one place the runtime spawns git (RT_EXTERNAL_OWNER of scripts/hfs/runtime-rules/external-owner.mjs enforces it).
//
// Every caller spelt the same options by hand - encoding:'utf8', windowsHide:true, sometimes a timeout - with two shapes:
// `git args` in a cwd and `git -C dir args`. gitSpawn keeps the spawnSync(file, args, options) signature so an injected
// runner or a spec's fake takes the same three arguments; runGit is the `-C` / `-c` convenience; gitRunner folds any
// caller's runner into {ok, stdout, stderr}. Only the call files beside this one import it: each names one git verb
// (diff.mjs, ls-files.mjs, worktree-*.mjs, ...), and a caller folds the spawn result it gets back with the pure
// helpers of scripts/lib/git.mjs (gitResultOf, gitOutputOf).
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../lib/git.mjs';

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

/**
 * `git args` in `cwd`, or `git -C dir args` when `dir` is given. `git` overrides the binary; `config` ({key: value})
 * prefixes one `-c key=value` per entry (core.quotepath=off, a committer identity). Scoped calls discard ambient
 * hook repository variables; an explicit env remains authoritative, including an intentional temporary index.
 */
export const runGit = (args, { cwd = null, dir = null, git = 'git', config = null, ...options } = {}) =>
  gitSpawn(git, [...(dir ? ['-C', dir] : []), ...Object.entries(config ?? {}).flatMap(([key, value]) => ['-c', `${key}=${value}`]), ...args], {
    ...(cwd ? { cwd } : {}), ...options,
    ...((cwd || dir) && options.env === undefined ? { env: withoutGitLocalEnv(process.env) } : {}),
  });

/**
 * A caller's git runner folded to (args, opts) -> {ok, stdout, stderr}. `git`: the caller's runner (args, {cwd}) ->
 * {ok|status, stdout|out, stderr|err} (a spec's fake); null: runGit with a 5-minute timeout and a 64 MB buffer.
 */
export const gitRunner = (git = null) => (args, opts = {}) => {
  const r = git ? git(args, opts) : runGit(args, { timeout: 300_000, maxBuffer: 64 * 1024 * 1024, ...opts });
  return { ok: r?.ok ?? (!r?.error && r?.status === 0), stdout: String(r?.stdout ?? r?.out ?? '').trim(), stderr: String(r?.stderr ?? r?.err ?? r?.error?.message ?? r?.error ?? '').trim() };
};
