import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BUFFER = 64 * 1024 * 1024;

const npmInvocation = (args) => {
  const cli = process.platform === 'win32'
    ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : null;
  return cli && fs.existsSync(cli)
    ? { command: process.execPath, args: [cli, ...args] }
    : { command: 'npm', args };
};

/** The asynchronous twin of scripts/api/npm/run-npm.mjs, for independent generated-app commands. */
export function runNpmAsync(args, { timeout, maxBuffer = MAX_BUFFER, ...options } = {}) {
  return new Promise((resolve) => {
    const npm = npmInvocation(args);
    const child = spawn(npm.command, npm.args, { windowsHide: true, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let error;
    let timer;

    const capture = (stream, chunk) => {
      const next = stream === 'stdout' ? stdout + chunk : stderr + chunk;
      if (stream === 'stdout') stdout = next;
      else stderr = next;
      if (!error && stdout.length + stderr.length > maxBuffer) {
        error = Object.assign(new Error(`npm output exceeded ${maxBuffer} bytes`), { code: 'ENOBUFS' });
        child.kill();
      }
    };
    child.stdout.on('data', (chunk) => capture('stdout', chunk));
    child.stderr.on('data', (chunk) => capture('stderr', chunk));
    child.once('error', (spawnError) => { error = spawnError; });
    child.once('close', (status, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ status, signal, stdout, stderr, error });
    });
    if (timeout) {
      timer = setTimeout(() => {
        error = Object.assign(new Error(`npm timed out after ${timeout}ms`), { code: 'ETIMEDOUT' });
        child.kill();
      }, timeout);
      timer.unref();
    }
  });
}
