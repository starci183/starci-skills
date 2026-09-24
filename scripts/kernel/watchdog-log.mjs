// scripts/kernel/watchdog-log.mjs — where a kernel watchdog loop logs: resume-all starts it with stdout/stderr
// appended here, and a loop that re-execs itself (scripts/lib/self-reload.mjs) keeps appending to the same file.
import path from 'node:path';
import { runtimeRootFor } from '../../engine/ledger-db.mjs';

export const watchdogLogFile = (workflowId, env = process.env) =>
  path.join(runtimeRootFor(env), 'watchdog-logs', `${String(workflowId).replace(/[^A-Za-z0-9._-]/g, '_')}.log`);
