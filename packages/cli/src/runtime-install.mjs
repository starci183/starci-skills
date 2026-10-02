import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

export const RUNTIME_VERSION = '1.0.0-alpha.3';

const statusOf = (result) => typeof result === 'number' ? result : result?.error ? 1 : (result?.status ?? 1);

/**
 * Install the pinned runtime package and run its own installer.
 * All network/process work is injectable; specs never need npm or the network.
 */
export function installRuntime({ cwd = process.cwd(), home = os.homedir(), force = false, hosts = null, noBootstrap = false } = {}, deps = {}) {
  const exists = deps.exists ?? existsSync;
  const mkdir = deps.mkdir ?? ((directory) => mkdirSync(directory, { recursive: true }));
  const write = deps.write ?? writeFileSync;
  const chmod = deps.chmod ?? chmodSync;
  const runNpm = deps.runNpm ?? ((args, options) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, options));
  const runNode = deps.runNode ?? ((args, options) => spawnSync(process.execPath, args, options));
  const installRoot = path.join(home, '.starci', 'runtime');
  const packageSpec = `starci@${deps.runtimeVersion ?? RUNTIME_VERSION}`;
  const fetchRuntime = deps.fetchRuntime ?? (() => runNpm(['install', '--prefix', installRoot, packageSpec], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  }));

  mkdir(installRoot);
  const fetched = fetchRuntime({ installRoot, packageSpec, cwd });
  if (statusOf(fetched) !== 0) return statusOf(fetched);

  const runtimeRoot = path.join(installRoot, 'node_modules', 'starci');
  const installer = path.join(runtimeRoot, 'scripts', 'install', 'install.mjs');
  if (!exists(installer)) return 1;
  const verb = exists(path.join(cwd, '.claude')) ? 'update' : 'init';
  const installerArgs = [installer, verb, '--dir', path.resolve(cwd)];
  if (force) installerArgs.push('--force');
  if (hosts) installerArgs.push('--hosts', hosts);
  if (noBootstrap) installerArgs.push('--no-bootstrap');
  const installed = runNode(installerArgs, { cwd, stdio: 'inherit', windowsHide: true });
  if (statusOf(installed) !== 0) return statusOf(installed);

  const starciHome = path.join(home, '.starci');
  const shimDir = path.join(starciHome, 'bin');
  const cli = path.join(runtimeRoot, 'packages', 'cli', 'bin', 'starci.mjs');
  mkdir(shimDir);
  write(path.join(starciHome, 'runtime.json'), `${JSON.stringify({ root: runtimeRoot }, null, 2)}\n`);
  if ((deps.platform ?? process.platform) === 'win32') {
    write(path.join(shimDir, 'starci.cmd'), `@echo off\r\n"${process.execPath}" "${cli}" %*\r\n`);
  } else {
    const shim = path.join(shimDir, 'starci');
    write(shim, `#!/bin/sh\nexec "${process.execPath}" "${cli}" "$@"\n`);
    chmod(shim, 0o755);
  }
  return 0;
}
