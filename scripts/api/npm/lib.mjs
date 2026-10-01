// scripts/api/npm/lib.mjs — the runner of npm: on Windows the npm-cli.js that ships beside this node binary, run by that
// node (no .cmd shim, no shell); elsewhere the npm on PATH. Utf8 text, a hidden window. The call files beside it
// (ci.mjs, pack-dry-run.mjs) each name one npm command; nothing outside scripts/api/npm imports this runner.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** The npm-cli.js of this node install on Windows, or null (another platform, or a node without its bundled npm). */
export const bundledNpmCli = (platform = process.platform, execPath = process.execPath) => {
  if (platform !== 'win32') return null;
  const cli = path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return fs.existsSync(cli) ? cli : null;
};

/** `npm <args>`; options pass through last (cwd, timeout, env, maxBuffer, stdio). */
export const npmSpawn = (args, options = {}) => {
  const spawn = { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options };
  const cli = bundledNpmCli();
  return cli ? spawnSync(process.execPath, [cli, ...args], spawn) : spawnSync('npm', args, spawn);
};
