// start-heal.mjs — the no-quota host heal that `starci reconciler up --services` and the full startup share: the per-user launcher
// shim (`starci runtime link`) and the registration or refresh of the three Windows tasks. A shim costs nothing and a
// registration is per-user, limited-privilege and idempotent, so neither needs the owner's OK; each applied action is one line
// that names what was written. The task script is the one `starci task register <name>` prints, and its hash is recorded.
import path from 'node:path';
import { execNode } from '../api/node/exec-node.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { taskRegister } from '../machine/task-register.mjs';
import { SKILL_ROOT } from './state.mjs';
import { lastJson } from './services.mjs';
import { hasProblem } from './task-health.mjs';

const LINK_TIMEOUT_MS = 120_000;
const needsRegistration = (found) => hasProblem(found, 'missing') || hasProblem(found, 'action-stale');

/** The launcher shim written by `starci runtime link --root <this runtime>`: {ok, shim, error}. Seam of the heal: `api.runtimeLink`; of this function: run. */
export async function runtimeLink({ env = process.env } = {}, { run = execNode } = {}) {
  const args = [path.join(SKILL_ROOT, 'packages', 'cli', 'bin', 'starci.mjs'), 'runtime', 'link', '--root', SKILL_ROOT, '--json'];
  const { error, stdout, stderr } = await run(args, { cwd: SKILL_ROOT, env, timeout: LINK_TIMEOUT_MS });
  const answer = lastJson(stdout);
  if (!error && answer?.shim) return { ok: true, shim: answer.shim };
  return { ok: false, error: String(stderr || error?.message || 'no answer').trim().slice(0, 200) };
}

/** One registration through `starci task register <key> --apply`, non-interactively: {ok, taskName, action, scriptSha256, error}. Seam: `api.registerTask`; of this function: register. */
export async function registerTask(key, { env = process.env } = {}, { register = taskRegister } = {}) {
  const result = await register({ positionals: [key], args: { apply: true }, env });
  const { taskName = null, action = null, scriptSha256 = null } = result.data ?? {};
  return { ok: result.code === 0, taskName, action, scriptSha256, ...(result.code === 0 ? {} : { error: String(result.stderr ?? '').slice(0, 300) }) };
}

const registrationLine = (key, found, made) => {
  if (!made.ok) return `task ${found.taskName} registration FAILED: ${made.error}`;
  const verb = hasProblem(found, 'action-stale') ? 're-registered' : 'registered';
  return `${verb} task ${made.taskName} (${made.action}; script sha256:${made.scriptSha256}; review with starci task register ${key})`;
};

/** The launcher shim and the tasks, healed in that order (a task whose shim is missing cannot work); each applied action is appended to `applied`. */
export async function healLauncherAndTasks(api, { env }, applied) {
  let audit = await api.auditTasks();
  if (!audit.ok) { applied.push(`launcher and tasks not checked: Task Scheduler unreadable (${audit.error})`); return; }
  const shim = Object.values(audit.audits).find((found) => hasProblem(found, 'shim-missing'))?.shim;
  if (shim) {
    const linked = await api.runtimeLink({ env });
    applied.push(linked.ok ? `linked launcher ${linked.shim ?? shim}` : `launcher link FAILED: ${linked.error}`);
    if (!linked.ok) return;
    audit = await api.auditTasks();
    if (!audit.ok) return;
  }
  await eachInOrder(Object.entries(audit.audits), async ([key, found]) => {
    if (needsRegistration(found)) applied.push(registrationLine(key, found, await api.registerTask(key, { env })));
  });
}

/** Whether a checklist row is the launcher shim or a task registration, the rows the no-quota heal repairs. */
export const isLauncherOrTaskRow = (row) => row.status !== 'green' && (row.id === 'launcher-shim' || /^(?:task|sched-task):/.test(row.id));
