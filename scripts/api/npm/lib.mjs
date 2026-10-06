// scripts/api/npm/lib.mjs — the runner of npm and npx: the npm-cli.js / npx-cli.js that ship with this node install, run by
// that node, or the npm / npx executable beside the node binary (no .cmd shim, no shell, no PATH lookup). Utf8 text, a hidden window. The call
// files beside it (ci.mjs, pack-dry-run.mjs, run-npm.mjs, run-npx.mjs) each name one use; nothing outside scripts/api/npm
// imports this runner.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** The `<tool>-cli.js` (npm or npx) of this node install (Windows: beside node; elsewhere: <prefix>/lib/node_modules) run by node, else the `<tool>` executable beside the node binary: an absolute spawn target fixed by the node install, never a PATH lookup; null when the node has neither. */
const bundledCli = (tool = 'npm', platform = process.platform, execPath = process.execPath, exists = fs.existsSync) => {
  const dir = path.dirname(execPath);
  const cli = path.join(dir, ...(platform === 'win32' ? [] : ['..', 'lib']), 'node_modules', 'npm', 'bin', `${tool}-cli.js`);
  if (exists(cli)) return { file: execPath, args: [cli] };
  const sibling = path.join(dir, tool);
  return platform !== 'win32' && exists(sibling) ? { file: sibling, args: [] } : null;
};

const toolSpawn = (tool, args, options) => {
  const spawn = { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options };
  const run = bundledCli(tool);
  return run ? spawnSync(run.file, [...run.args, ...args], spawn)
    : { status: null, stdout: '', stderr: '', signal: null, error: Object.assign(new Error(`${tool} was not found beside this node binary`), { code: 'ENOENT' }) };
};

/** `npm <args>`; options pass through last (cwd, timeout, env, maxBuffer, stdio). */
export const npmSpawn = (args, options = {}) => toolSpawn('npm', args, options);

/** `npx <args>`; options pass through last (cwd, timeout, env, maxBuffer, stdio). */
export const npxSpawn = (args, options = {}) => toolSpawn('npx', args, options);
