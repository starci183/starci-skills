// lib.mjs - the one PowerShell runner for the Task Scheduler API system: one waited call, utf8 text, no shell.
import { spawnSync } from 'node:child_process';

/** Run one Task Scheduler PowerShell script with positional arguments. */
export const scheduleSpawn = (script, args = [], {
  env = process.env,
  powershell = 'powershell.exe',
  timeout = 30_000,
  run = spawnSync,
} = {}) => run(powershell, [
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, ...args,
], { encoding: 'utf8', env, windowsHide: true, timeout });
