// read-only.mjs — one read-only git command (rev-parse, diff, show, cat-file) of a repository, run WITHOUT blocking the
// calling thread: the harness UI's products view reads an attempt's files at its commit head this way. Never a shell;
// paths are printed unquoted (core.quotepath=off) and the output stays raw bytes.
import { execFile } from 'node:child_process';

/** Promise<{ok, overflow, out: Buffer, error}> of `git -c core.quotepath=off -C <repo> <args>`; `max` bounds the output. */
export const readOnly = (repo, args, { max = 4 * 1024 * 1024, timeout = 5000 } = {}) => new Promise((resolve) => {
  execFile('git', ['-c', 'core.quotepath=off', '-C', repo, ...args], { cwd: repo, timeout, maxBuffer: max, encoding: 'buffer', windowsHide: true },
    (error, stdout) => resolve({ ok: !error, overflow: error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', out: Buffer.from(stdout ?? Buffer.alloc(0)), error }));
});
