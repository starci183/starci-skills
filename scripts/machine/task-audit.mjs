// task-audit.mjs - the read-only audit of the runtime's Windows scheduled tasks: is each task registered, enabled, running the
// action a registration writes today, and does the per-user shim that action calls exist. It reads the same Task Scheduler
// list as `starci task list` and changes nothing; the reconciler's host readiness rows and start diagnosis are built on it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEnv } from '../lib/env.mjs';
import { readTasks } from './task-show.mjs';
import { TASK_DEFINITIONS, registeredAction, starciShimPath } from './task-register.mjs';

const DEFAULT_SYSTEM_ROOT = ['C:', 'Windows'].join(path.win32.sep);
const sameText = (a, b) => String(a ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === String(b ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** A Task Scheduler result code as the hex Windows documents it (0x41303), or null when none is recorded. */
export const resultCodeText = (code) => (Number.isFinite(Number(code)) && code != null ? `0x${(Number(code) >>> 0).toString(16)}` : null);

const fixOf = (name, { shim, task }) => {
  const register = `starci task register ${name} --apply`;
  if (shim && task) return `starci runtime link, then ${register}`;
  return shim ? 'starci runtime link' : register;
};

/**
 * The audit of one task from its Task Scheduler row (null when unregistered): {name, taskName, ok, problem, state, lastResult,
 * action, expected, shim, reason, fix}. `problem` is the first of missing, disabled, shim-missing, action-stale, or null.
 * `reason` says why the task cannot work and `fix` is the exact command, both null while it can. Pure over its inputs.
 */
export function auditTask(name, row, { shim, shimExists, systemRoot }) {
  const { taskName } = TASK_DEFINITIONS[name];
  const expected = registeredAction(name, { systemRoot, starci: shim });
  const base = { name, taskName, state: row?.state ?? null, lastResult: row?.lastResult ?? null, action: row?.action ?? null, expected, shim };
  const found = [];
  if (!row) found.push({ problem: 'missing', reason: `Windows task '${taskName}' is not registered`, task: true });
  else if (row.state === 'Disabled') found.push({ problem: 'disabled', reason: `Windows task '${taskName}' is disabled`, task: true });
  if (!shimExists) found.push({ problem: 'shim-missing', reason: `the per-user shim ${shim} does not exist, so the task action cannot start starci`, shim: true });
  if (row && !sameText(row.action, expected)) {
    found.push({ problem: 'action-stale', reason: `Windows task '${taskName}' runs "${row.action ?? ''}" but a registration today writes "${expected}"`, task: true });
  }
  if (!found.length) return { ...base, ok: true, problem: null, reason: null, fix: null };
  const fix = fixOf(name, { shim: found.some((f) => f.shim), task: found.some((f) => f.task) });
  return { ...base, ok: false, problem: found[0].problem, problems: found.map((f) => f.problem), reason: found.map((f) => f.reason).join('; '), fix };
}

/** Task state and last result as one clause for a row or a start line ("state Ready, last result 0x0"). */
export const taskFacts = (audit) => [audit.state ? `state ${audit.state}` : null, resultCodeText(audit.lastResult) ? `last result ${resultCodeText(audit.lastResult)}` : null].filter(Boolean).join(', ');

/**
 * Audit every known task through one Task Scheduler list call: {ok: true, audits} keyed by task name, or {ok: false, error}
 * when the scheduler could not be read. Seams: listScheduledTasks, exists (the shim probe), home, systemRoot.
 */
export async function auditTasks({ env = process.env, listScheduledTasks, exists = fs.existsSync, home = os.homedir(), systemRoot = readEnv('SystemRoot', env) ?? DEFAULT_SYSTEM_ROOT } = {}) {
  const read = await readTasks({ env, listScheduledTasks });
  if (!read.ok) return { ok: false, error: read.reason };
  const shim = starciShimPath({ home, platform: 'win32' });
  const shimExists = exists(shim);
  const byName = new Map(read.tasks.map((task) => [task.name, task]));
  return { ok: true, audits: Object.fromEntries(Object.keys(TASK_DEFINITIONS).map((name) => [name, auditTask(name, byName.get(name) ?? null, { shim, shimExists, systemRoot })])) };
}
