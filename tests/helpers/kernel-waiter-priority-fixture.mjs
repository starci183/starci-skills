import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../scripts/kernel/cli.mjs', import.meta.url));
const MAX_PROCESSES = 2;
let active = 0;
const waiting = [];

const acquire = () => active < MAX_PROCESSES
  ? (active += 1, Promise.resolve())
  : new Promise(resolve => waiting.push(resolve));

const release = () => {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
};

export const runKernelCli = async ({ args, repo, env, cwd, timeout = 120_000 }) => {
  await acquire();
  try {
    return await new Promise(resolve => {
      execFile(process.execPath, [CLI, ...args, '--repo', repo, '--json'], {
        cwd,
        encoding: 'utf8',
        windowsHide: true,
        timeout,
        env,
      }, (error, stdout, stderr) => resolve({ status: error ? error.code : 0, stdout, stderr }));
    });
  } finally {
    release();
  }
};
