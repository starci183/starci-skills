// schedule-register.mjs - register one reviewed Windows scheduled-task script in one PowerShell call.
import { scheduleSpawn } from './lib.mjs';

/** Run one generated Register-ScheduledTask script. */
export const scheduleRegister = (script, { timeout = 120_000, ...options } = {}) =>
  scheduleSpawn(script, [], { ...options, timeout });
