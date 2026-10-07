// lib.mjs - the one PowerShell runner for the Task Scheduler API system: one waited call, utf8 text, no shell.
import { spawnSync } from 'node:child_process';

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * Run one Task Scheduler PowerShell script. `powershell -Command` joins every trailing argument into the command text,
 * so a name with a space or a quote would split into several tokens: the arguments reach the script instead as the
 * single-quoted array `$Arguments` defined on its first line.
 */
export const scheduleSpawn = (script, args = [], {
  env = process.env,
  powershell = 'powershell.exe',
  timeout = 30_000,
  run = spawnSync,
} = {}) => run(powershell, [
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `$Arguments = @(${args.map(literal).join(', ')})\n${script}`,
], { encoding: 'utf8', env, windowsHide: true, timeout });
