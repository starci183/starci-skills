// run-real-tool.mjs - execute one already-resolved host tool with inherited stdio and no shell-mediated lookup.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readEnv } from '../../lib/env.mjs';

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;
const escapeCommand = (value) => String(value).replace(CMD_META, '^$1');
const escapeArgument = (value) => {
  let escaped = String(value).replace(/(?=(\\+?)?)\1"/g, String.raw`$1$1\"`);
  escaped = escaped.replace(/(?=(\\+?)?)\1$/, '$1$1');
  return `"${escaped}"`.replace(CMD_META, '^$1');
};

const cmdInvocation = (target, args) => {
  const command = [escapeCommand(path.normalize(target)), ...args.map(escapeArgument)].join(' ');
  return ['/d', '/s', '/c', `"${command}"`];
};

/** Run an absolute tool path and return its exit code (127 when it could not start, 1 after a signal). */
export function runRealTool(target, args = [], { cwd = process.cwd(), env = process.env, platform = process.platform,
  spawn = spawnSync, comspec = readEnv('ComSpec', env ?? {}) ?? readEnv('COMSPEC', { COMSPEC: env?.COMSPEC }) ?? 'cmd.exe' } = {}) {
  const commandScript = platform === 'win32' && /\.(?:cmd|bat)$/i.test(target);
  const command = commandScript ? comspec : target;
  const argv = commandScript ? cmdInvocation(target, args.map(String)) : args.map(String);
  const result = spawn(command, argv, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    ...(commandScript ? { windowsVerbatimArguments: true } : {}),
  });
  if (result?.error) return result.error.code === 'ENOENT' ? 127 : 1;
  return result?.status ?? 1;
}
