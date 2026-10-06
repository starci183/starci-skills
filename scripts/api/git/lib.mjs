// scripts/api/git/lib.mjs — the one place the runtime spawns git (RT_EXTERNAL_OWNER of scripts/hfs/runtime-rules/external-owner.mjs enforces it).
//
// Every caller spelt the same options by hand - encoding:'utf8', windowsHide:true, sometimes a timeout - with two shapes:
// `git args` in a cwd and `git -C dir args`. gitSpawn keeps the spawnSync(file, args, options) signature so an injected
// runner or a spec's fake takes the same three arguments; runGit is the `-C` / `-c` convenience; gitRunner folds any
// caller's runner into {ok, stdout, stderr}. Only the call files beside this one import it: each names one git verb
// (diff.mjs, ls-files.mjs, worktree-*.mjs, ...), and a caller folds the spawn result it gets back with the pure
// helpers of scripts/lib/git.mjs (gitResultOf, gitOutputOf).
import { assertMutationFence } from '../../lib/mutation-fence.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../lib/git.mjs';

/**
 * Spawn `file` (the git binary) once with `args`: utf8 text, a hidden window, never a shell.
 * Options pass through last, so cwd, timeout, input, env or maxBuffer land as given. encoding:'buffer'
 * is a request for raw bytes, not an encoding: spawnSync encodes a string `input` with it and throws
 * ERR_UNKNOWN_ENCODING, so it reaches spawnSync as encoding:null (Buffer output either way).
 */
export const gitSpawn = (file, args, options = {}) => {
  assertMutationFence({ kind: 'git-effect', args });
  const spawn = { encoding: 'utf8', windowsHide: true, ...options };
  if (spawn.encoding === 'buffer') spawn.encoding = null;
  if (spawn.env) spawn.env = { ...spawn.env }; // node adds NODE_V8_COVERAGE to the env object it is given: a frozen caller env must not throw under coverage
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

let cachedGit;
/**
 * The absolute path of the real git binary, or null: the first PATH directory holding git (git.exe on Windows) that is not
 * the StarCi shim directory <home>/.starci/bin (a seat's guard shim is never the git the runtime itself runs). A bare name is never
 * spawned, so a writable directory cannot be reached by name lookup at spawn time. Resolved once per process; options (env,
 * platform, home, exists) are for a spec and bypass the cache.
 */
export const gitExecutable = (options = null) => {
  if (!options && cachedGit !== undefined) return cachedGit;
  const { env = process.env, platform = process.platform, home = os.homedir(), exists = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true } = options ?? {};
  const p = platform === 'win32' ? path.win32 : path.posix;
  const pathKey = Object.keys(env).find((name) => name.toLowerCase() === 'path');
  const shim = p.join(home, '.starci', 'bin');
  const same = (a, b) => (platform === 'win32' ? p.resolve(a).toLowerCase() === p.resolve(b).toLowerCase() : p.resolve(a) === p.resolve(b));
  let found = null;
  for (const raw of String(pathKey ? env[pathKey] : '').split(platform === 'win32' ? ';' : ':')) {
    const dir = raw.replace(/^"(.*)"$/, '$1');
    const file = dir && p.isAbsolute(dir) && !same(dir, shim) ? p.join(dir, platform === 'win32' ? 'git.exe' : 'git') : null;
    if (file && exists(file)) { found = file; break; }
  }
  if (!options) cachedGit = found;
  return found;
};
