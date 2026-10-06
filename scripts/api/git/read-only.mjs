// read-only.mjs — one read-only git command (rev-parse, diff, show, cat-file) of a repository, run WITHOUT blocking the
// calling thread: the harness UI's products view reads an attempt's files at its commit head this way. Never a shell;
// paths are printed unquoted (core.quotepath=off) and the output stays raw bytes. git is spawned by its resolved absolute path.
import { execFile } from 'node:child_process';
import { gitExecutable } from './lib.mjs';

/** Promise<{ok, overflow, out: Buffer, error}> of `git -c core.quotepath=off -C <repo> <args>`; `max` bounds the output. A host without git answers {ok: false, error}. */
export const readOnly = (repo, args, { max = 4 * 1024 * 1024, timeout = 5000, exec = execFile, git = gitExecutable() } = {}) => new Promise((resolve) => {
  if (!git) { resolve({ ok: false, overflow: false, out: Buffer.alloc(0), error: Object.assign(new Error('git was not found on PATH'), { code: 'ENOENT' }) }); return; }
  exec(git, ['-c', 'core.quotepath=off', '-C', repo, ...args], { cwd: repo, timeout, maxBuffer: max, encoding: 'buffer', windowsHide: true },
    (error, stdout) => resolve({ ok: !error, overflow: error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', out: Buffer.from(stdout ?? Buffer.alloc(0)), error }));
});
