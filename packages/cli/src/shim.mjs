import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Write the per-user runtime record and the one StarCi launcher for that runtime. */
export function writeRuntimeShim({ root, home = os.homedir() } = {}, deps = {}) {
  const mkdir = deps.mkdir ?? ((directory) => mkdirSync(directory, { recursive: true }));
  const write = deps.write ?? writeFileSync;
  const chmod = deps.chmod ?? chmodSync;
  const platform = deps.platform ?? process.platform;
  const node = deps.node ?? process.execPath;
  const runtimeRoot = path.resolve(root);
  const starciHome = path.join(home, '.starci');
  const shimDir = path.join(starciHome, 'bin');
  const runtimeJson = path.join(starciHome, 'runtime.json');
  const cli = path.join(runtimeRoot, 'packages', 'cli', 'bin', 'starci.mjs');

  mkdir(shimDir);
  write(runtimeJson, `${JSON.stringify({ root: runtimeRoot }, null, 2)}\n`);
  if (platform === 'win32') {
    const shim = path.join(shimDir, 'starci.cmd');
    write(shim, `@echo off\r\n"${node}" "${cli}" %*\r\n`);
    return { root: runtimeRoot, runtimeJson, shim };
  }

  const shim = path.join(shimDir, 'starci');
  write(shim, `#!/bin/sh\nexec "${node}" "${cli}" "$@"\n`);
  chmod(shim, 0o755);
  return { root: runtimeRoot, runtimeJson, shim };
}
