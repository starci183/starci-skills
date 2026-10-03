import { mkdirSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Programs whose PATH entries enforce the shared command policy before reaching the host tool. */
const TOOL_WRAPPERS = Object.freeze(['git', 'npm', 'npx', 'node', 'docker', 'supabase', 'gh', 'schtasks']);

const wrapperName = (program, platform) => platform === 'win32' ? `${program}.cmd` : program;
const wrapperText = ({ program, platform, node, cli }) => platform === 'win32'
  ? `@echo off\r\n"${node}" "${cli}" guard raw ${program} -- %*\r\n`
  : `#!/bin/sh\nexec "${node}" "${cli}" guard raw ${program} -- "$@"\n`;

/** Write the per-user runtime record, StarCi launcher and guarded PATH tool wrappers for that runtime. */
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
    for (const program of TOOL_WRAPPERS) {
      write(path.join(shimDir, wrapperName(program, platform)), wrapperText({ program, platform, node, cli }));
    }
    return { root: runtimeRoot, runtimeJson, shim };
  }

  const shim = path.join(shimDir, 'starci');
  write(shim, `#!/bin/sh\nexec "${node}" "${cli}" "$@"\n`);
  chmod(shim, 0o755);
  for (const program of TOOL_WRAPPERS) {
    const wrapper = path.join(shimDir, wrapperName(program, platform));
    write(wrapper, wrapperText({ program, platform, node, cli }));
    chmod(wrapper, 0o755);
  }
  return { root: runtimeRoot, runtimeJson, shim };
}

/** Remove only the guarded tool wrappers; a missing wrapper is already unlinked. */
export function removeToolWrappers({ home = os.homedir() } = {}, deps = {}) {
  const platform = deps.platform ?? process.platform;
  const unlink = deps.unlink ?? unlinkSync;
  const shimDir = path.join(home, '.starci', 'bin');
  const removed = [];
  for (const program of TOOL_WRAPPERS) {
    const wrapper = path.join(shimDir, wrapperName(program, platform));
    try {
      unlink(wrapper);
      removed.push(wrapper);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return removed;
}

/**
 * The environment a runtime process runs in: the same as the caller's, without the guarded wrapper directory on PATH.
 * An agent's own `git` or `npm` meets the wrappers; the runtime verbs that agent started act with the real tools, so a
 * verb can do what its role allows. Nothing the agent can set changes this: the launcher always strips it.
 */
export function runtimeEnv(env = process.env, { home = os.homedir(), platform = process.platform } = {}) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === 'path');
  if (!key) return env;
  const same = (entry) => {
    const left = path.resolve(String(entry).replace(/^"(.*)"$/, '$1'));
    const right = path.resolve(home, '.starci', 'bin');
    return platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
  };
  const separator = platform === 'win32' ? ';' : ':';
  return { ...env, [key]: String(env[key]).split(separator).filter((entry) => entry && !same(entry)).join(separator) };
}
