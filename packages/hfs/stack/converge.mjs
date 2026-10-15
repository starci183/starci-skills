// converge.mjs - observes whether a stack deploy has converged: desired versus running replicas, the update state of every service and
// failed or rejected tasks created since the deploy began (`docker stack deploy --detach` returns before any of this is true).
// Two consecutive agreeing observations are required, so a task that starts and immediately exits is caught by the second look.
// Read-only: every call is a docker query. Time comes from ctx.now(), waits from ctx.sleep(), tools through ctx.spawn.
import { repeatInOrder } from '../runtime/scripts/lib/in-order.mjs';
import { lines as splitLines, toolOutput } from './context.mjs';
import { refusal } from './errors.mjs';

const POLL_MS = 5000;
const TASK_FORMAT = '{{.DesiredState}}|{{.Status.State}}|{{.Status.Timestamp}}|{{.Status.Err}}';

const docker = (ctx, args) => toolOutput(ctx, 'docker', args);

/** Failed or rejected tasks created since the deploy began, and how many tasks run as desired. */
function readTasks(ctx, name, sinceMs) {
  const ids = splitLines(docker(ctx, ['service', 'ps', name, '--no-trunc', '-q']));
  const rows = ids.length === 0 ? [] : splitLines(docker(ctx, ['inspect', '--type', 'task', '--format', TASK_FORMAT, ...ids]));
  const out = { running: 0, failed: [] };
  for (const row of rows) {
    const [wanted, state, timestamp, ...rest] = row.split('|');
    if (wanted === 'running' && state === 'running') out.running += 1;
    if ((state === 'failed' || state === 'rejected') && Date.parse(timestamp) >= sinceMs) out.failed.push(`${name}: task ${state}: ${rest.join('|')}`);
  }
  return out;
}

/** One service: { pending, failed } lines. A rolled back or paused update since the deploy began fails it at once. */
function observeService(ctx, name, sinceMs) {
  const inspect = JSON.parse(docker(ctx, ['service', 'inspect', name, '--format', '{{json .}}']));
  const desired = inspect.Spec?.Mode?.Replicated?.Replicas ?? 1;
  const update = inspect.UpdateStatus;
  const recentUpdate = Boolean(update) && (update.StartedAt ? Date.parse(update.StartedAt) : 0) >= sinceMs;
  if (recentUpdate && /rollback|paused/u.test(update.State)) return { pending: [], failed: [`${name}: update ${update.State}: ${update.Message ?? ''}`] };
  const pending = recentUpdate && update.State === 'updating' ? [`${name}: update in progress`] : [];
  const tasks = readTasks(ctx, name, sinceMs);
  if (tasks.running !== desired) pending.push(`${name}: ${tasks.running}/${desired} running`);
  return { pending, failed: tasks.failed };
}

/** One observation over every service of the stack: { ok, pending, failed, services }. */
function observe(ctx, config, sinceMs) {
  const services = splitLines(docker(ctx, ['service', 'ls', '--filter', `label=com.docker.stack.namespace=${config.stack}`, '--format', '{{.Name}}']));
  const result = { pending: services.length === 0 ? [`no service of stack ${config.stack} yet`] : [], failed: [], services };
  for (const name of services) {
    const found = observeService(ctx, name, sinceMs);
    result.pending.push(...found.pending);
    result.failed.push(...found.failed);
  }
  return { ...result, ok: result.pending.length === 0 && result.failed.length === 0 };
}

/** The observation, or a pending line when docker failed (a thrown docker error is never a crash). */
function tryObserve(ctx, config, sinceMs, previous) {
  try {
    return observe(ctx, config, sinceMs);
  } catch (error) {
    return { ok: false, pending: [String(error.message)], failed: [], services: previous.services };
  }
}

const result = (ok, lines, last) => ({ ok, lines, data: { services: last.services, failed: last.failed, pending: last.pending } });

/**
 * Waits until the stack converged. `since` is the ISO instant the deploy began (required). Returns { ok, lines, data: { services, failed, pending } };
 * on failure the lines name the service and the Swarm task error text.
 */
export async function convergeStack(ctx, config, { since, timeoutSeconds = 600 } = {}) {
  const sinceMs = Date.parse(since);
  if (Number.isNaN(sinceMs)) throw refusal('STACK_CONVERGE_SINCE', '--since must be an ISO instant such as 2026-01-31T10:00:00Z');
  const deadline = ctx.now() + timeoutSeconds * 1000;
  let last = { pending: ['not observed'], failed: [], services: [] };
  let stable = 0;
  const outcome = await repeatInOrder(async () => {
    if (ctx.now() >= deadline) return 'timeout';
    last = tryObserve(ctx, config, sinceMs, last);
    if (last.failed.length > 0) return 'failed';
    stable = last.ok ? stable + 1 : 0;
    if (stable >= 2) return 'converged';
    await ctx.sleep(POLL_MS);
    return undefined;
  });
  if (outcome === 'converged') return result(true, [`converge: ${last.services.join(', ')}: desired replicas running, no failed task`], last);
  const reasons = [...last.failed, ...last.pending].map((line) => `  ${line}`);
  return result(false, [`converge: ${last.failed.length > 0 ? 'FAILED' : 'TIMEOUT'}`, ...reasons], last);
}
