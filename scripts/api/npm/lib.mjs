// scripts/api/npm/lib.mjs — the runner of npm and npx: on Windows the npm-cli.js / npx-cli.js that ship beside this node
// binary, run by that node (no .cmd shim, no shell); elsewhere the npm / npx on PATH. Utf8 text, a hidden window. The call
// files beside it (ci.mjs, pack-dry-run.mjs, run-npm.mjs, run-npx.mjs) each name one use; nothing outside scripts/api/npm
// imports this runner.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** The `<tool>-cli.js` (npm or npx) of this node install on Windows, or null (another platform, or a node without its bundled npm). */
export const bundledCli = (tool = 'npm', platform = process.platform, execPath = process.execPath) => {
  if (platform !== 'win32') return null;
  const cli = path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', `${tool}-cli.js`);
  return fs.existsSync(cli) ? cli : null;
};

const toolSpawn = (tool, args, options) => {
  const spawn = { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options };
  const cli = bundledCli(tool);
  return cli ? spawnSync(process.execPath, [cli, ...args], spawn) : spawnSync(tool, args, spawn);
};

/** `npm <args>`; options pass through last (cwd, timeout, env, maxBuffer, stdio). */
export const npmSpawn = (args, options = {}) => toolSpawn('npm', args, options);

/** `npx <args>`; options pass through last (cwd, timeout, env, maxBuffer, stdio). */
export const npxSpawn = (args, options = {}) => toolSpawn('npx', args, options);
