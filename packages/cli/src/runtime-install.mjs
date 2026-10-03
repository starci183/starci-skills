import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { writeRuntimeShim } from './shim.mjs';

export const RUNTIME_VERSION = '1.0.0-alpha.4';

const writeTo = (target, text) => {
  if (typeof target === 'function') target(text);
  else target.write(text);
};

const npmEntryCandidates = ({ execPath = process.execPath, env = process.env } = {}) => {
  const nodeDirectory = path.dirname(path.resolve(execPath));
  const candidates = [];
  if (typeof env?.npm_execpath === 'string' && path.basename(env.npm_execpath).toLowerCase() === 'npm-cli.js') {
    candidates.push(path.resolve(env.npm_execpath));
  }
  candidates.push(path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  candidates.push(path.join(path.dirname(nodeDirectory), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  return [...new Set(candidates)];
};

/** Find npm's JavaScript entry so Node can execute it without a command shell. */
export function resolveNpmEntry({ execPath = process.execPath, env = process.env, exists = existsSync } = {}) {
  return npmEntryCandidates({ execPath, env }).find((candidate) => exists(candidate)) ?? null;
}

const statusOf = (result, label, report) => {
  if (typeof result === 'number') return result;
  if (result?.error) {
    report(`${label} failed to start: ${result.error.message ?? result.error}`);
    return 1;
  }
  if (result?.status == null) {
    report(`${label} stopped on signal ${result?.signal ?? 'unknown'}`);
    return 1;
  }
  return result.status;
};

/**
 * Install the pinned runtime package and run its own installer.
 * All network/process work is injectable; specs never need npm or the network.
 */
export function installRuntime({ cwd = process.cwd(), home = os.homedir(), force = false, hosts = null, noBootstrap = false, stderr = process.stderr } = {}, deps = {}) {
  const exists = deps.exists ?? existsSync;
  const mkdir = deps.mkdir ?? ((directory) => mkdirSync(directory, { recursive: true }));
  const node = process.execPath;
  const env = deps.env ?? process.env;
  const spawn = deps.spawn ?? spawnSync;
  const report = (message) => writeTo(deps.stderr ?? stderr, `starci: ${message}\n`);
  const npmEntryResolver = deps.resolveNpmEntry ?? resolveNpmEntry;
  const runNpm = deps.runNpm ?? ((args, options) => {
    const npmEntry = npmEntryResolver({ execPath: node, env, exists });
    if (!npmEntry) {
      const probed = npmEntryCandidates({ execPath: node, env }).map((candidate) => `"${candidate}"`).join(', ');
      report(`cannot find npm-cli.js; probed: ${probed}. Install npm alongside Node.js or set npm_execpath to an existing npm-cli.js.`);
      return 1;
    }
    return spawn(node, [npmEntry, ...args], options);
  });
  const runNode = deps.runNode ?? ((args, options) => spawn(node, args, options));
  const installRoot = path.join(home, '.starci', 'runtime');
  const packageSpec = `starci@${deps.runtimeVersion ?? RUNTIME_VERSION}`;
  const fetchRuntime = deps.fetchRuntime ?? (() => runNpm(['install', '--prefix', installRoot, packageSpec], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    shell: false,
  }));

  mkdir(installRoot);
  let fetched;
  try {
    fetched = fetchRuntime({ installRoot, packageSpec, cwd });
  } catch (error) {
    report(`npm install failed to start: ${error?.message ?? error}`);
    return 1;
  }
  const fetchStatus = statusOf(fetched, 'npm install', report);
  if (fetchStatus !== 0) return fetchStatus;

  const runtimeRoot = path.join(installRoot, 'node_modules', 'starci');
  const installer = path.join(runtimeRoot, 'scripts', 'install', 'install.mjs');
  if (!exists(installer)) {
    report(`installed runtime is missing its installer: ${installer}`);
    return 1;
  }
  const verb = exists(path.join(cwd, '.claude')) ? 'update' : 'init';
  const installerArgs = [installer, verb, '--dir', path.resolve(cwd)];
  if (force) installerArgs.push('--force');
  if (hosts) installerArgs.push('--hosts', hosts);
  if (noBootstrap) installerArgs.push('--no-bootstrap');
  let installed;
  try {
    installed = runNode(installerArgs, { cwd, stdio: 'inherit', windowsHide: true, shell: false });
  } catch (error) {
    report(`runtime installer failed to start: ${error?.message ?? error}`);
    return 1;
  }
  const installStatus = statusOf(installed, 'runtime installer', report);
  if (installStatus !== 0) return installStatus;

  writeRuntimeShim({ root: runtimeRoot, home }, deps);
  return 0;
}
