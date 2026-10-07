// task-health.mjs - what the reconciler says about the Windows scheduled tasks behind its services: the registry probe of the
// StarCi-Reconciler task, the host readiness rows of the harness app and tunnel tasks, the clause a down service row carries,
// and the outcome line of a requested task start. Every answer is read from scripts/machine/task-audit.mjs (read-only).
import { repeatInOrder } from '../lib/in-order.mjs';
import { taskFacts } from '../machine/task-audit.mjs';
import { TASK_DEFINITIONS } from '../machine/task-register.mjs';
import { green, red, warn } from './checklist-items.mjs';

export const RECONCILER_SERVICE = `sched-task:${TASK_DEFINITIONS.reconciler.taskName}`;
/** The runtime task (a TASK_DEFINITIONS key) behind each service that runs through one. */
export const SERVICE_TASKS = Object.freeze({ 'harness-ui': 'harness-app', 'harness-tunnel': 'harness-tunnel', [RECONCILER_SERVICE]: 'reconciler' });
const START_POLL_MS = 3000;
/** The no-quota heal that links the launcher, registers the tasks and starts the services that are down. */
export const HEAL_SERVICES = 'starci reconciler up --services';
const healFix = (manual) => `${HEAL_SERVICES} (or ${manual})`;

/** The registry probe of the reconciler task: healthy when registered, enabled, on today's action with its shim present. */
export async function reconcilerTaskProbe({ audit, allowTaskRepair, env }) {
  const result = await audit({ env });
  const found = result.audits?.reconciler;
  if (!found) return { ok: false, error: result.error, ...(allowTaskRepair ? {} : { unmanaged: true }) };
  const probe = { ok: found.ok, exists: found.problem !== 'missing', status: found.state, audit: found };
  return found.problem === 'missing' && !allowTaskRepair ? { ...probe, unmanaged: true } : probe;
}

/** The checklist row of the reconciler task, from its registry probe. */
export function reconcilerTaskItem(probe) {
  const name = `scheduled task ${TASK_DEFINITIONS.reconciler.taskName}`;
  const found = probe.detail?.audit;
  if (probe.ok) return green('services', probe.name, name, `registered, action current, shim present (${taskFacts(found)})`, { required: false });
  if (probe.unmanaged && (!found || found.problem === 'missing')) return warn('services', probe.name, name, found ? 'missing (unmanaged)' : `unreadable (unmanaged): ${probe.detail?.error}`, healFix('starci task register reconciler --apply'));
  if (found) return red('services', probe.name, name, found.reason, healFix(found.fix), { required: false });
  return warn('services', probe.name, name, `unreadable: ${probe.detail?.error ?? 'not healthy'}`, 'starci task list');
}

/** The readiness rows of the harness app and tunnel tasks from one audit ({ok, audits} or {ok: false, error}); none when no audit was made. */
export function taskItems(result) {
  if (!result) return [];
  if (!result.ok) return [warn('services', 'task:scheduler', 'Windows scheduled tasks', `unreadable: ${result.error}`, 'starci task list')];
  return ['harness-app', 'harness-tunnel'].map((key) => {
    const found = result.audits[key];
    const name = `scheduled task ${found.taskName}`;
    return found.ok ? green('services', `task:${key}`, name, `registered, action current, shim present (${taskFacts(found)})`) : red('services', `task:${key}`, name, found.reason, healFix(found.fix), { required: false });
  });
}

/** Whether one task audit lists `problem` (the first problem, or any of its `problems`). */
export const hasProblem = (found, problem) => (found.problems ?? [found.problem]).includes(problem);

/** The launcher shim row from one audit (the input of `taskItems`): the per-user shim every task action calls; none when no audit was made. */
export function launcherItem(result) {
  if (!result?.ok) return [];
  const found = Object.values(result.audits).find((audit) => hasProblem(audit, 'shim-missing'));
  if (!found) return [green('services', 'launcher-shim', 'launcher shim', `present (${Object.values(result.audits)[0].shim})`)];
  return [red('services', 'launcher-shim', 'launcher shim', `${found.shim} does not exist, so no task action can start starci`, healFix('starci runtime link'), { required: false })];
}

/** For a service that runs through a task: {note, fix} to add to its row (the task's problem, or its state and last result), else null. */
export function serviceTaskNote(service, audits) {
  const found = audits?.[SERVICE_TASKS[service]];
  if (!found) return null;
  return found.ok ? { note: `task '${found.taskName}' ${taskFacts(found)}`, fix: null } : { note: found.reason, fix: healFix(found.fix) };
}

const notHealthyWhy = (last) => last.detail?.error ?? (last.detail?.status ? `HTTP ${last.detail.status}` : 'no answer');

/**
 * The outcome of a task start that was requested: says at once when the task cannot work (missing, stale action, missing shim),
 * otherwise waits up to the service's startTimeoutMs for it to answer and reports the task state and last result when it does not.
 * Seams of `api`: auditTasks, probeServices, sleep.
 */
export async function startOutcome(api, probe) {
  const key = SERVICE_TASKS[probe.name];
  if (!key) return 'start requested';
  const result = await api.auditTasks();
  const found = result.audits?.[key];
  if (found && !found.ok) return `start requested, but the task cannot work: ${found.reason}; fix: ${found.fix}`;
  const startedAt = Date.now();
  const deadline = startedAt + probe.entry.startTimeoutMs;
  let last = probe;
  await repeatInOrder(async () => {
    const [fresh] = await api.probeServices({ names: [probe.name] });
    last = fresh ?? last;
    if (last.ok || Date.now() >= deadline) return true;
    await api.sleep(START_POLL_MS);
    return undefined;
  });
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  if (last.ok) return `start requested, healthy after ${seconds}s`;
  const after = await api.auditTasks();
  const now = after.audits?.[key] ?? found;
  const task = now ? `task '${now.taskName}' ${taskFacts(now)}${now.state === 'Running' ? '' : ', so its process is not running'}` : `Task Scheduler unreadable: ${after.error ?? result.error}`;
  return `start requested, NOT healthy after ${seconds}s (${notHealthyWhy(last)}); ${task}`;
}
