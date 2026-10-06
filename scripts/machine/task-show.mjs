// task-show.mjs - project Windows Task Scheduler query results into stable task show/list data.
import { scheduleList as listScheduledTasks } from '../api/schtasks/schedule-list.mjs';
import { scheduleQuery as queryScheduledTask } from '../api/schtasks/schedule-query.mjs';
import { resultDetail as detail, resultOk } from '../lib/verb-call.mjs';
import { TASK_DEFINITIONS } from './task-register.mjs';

const taskOf = (name) => TASK_DEFINITIONS[String(name ?? '')] ?? null;

function payloadOf(result) {
  if (result?.data != null) return result.data;
  const text = String(result?.stdout ?? '').trim();
  if (!text) return null;
  return JSON.parse(text);
}

const textValue = (value) => value == null || value === '' ? null : String(value);

/** Normalize both the call file's camel-case JSON and canned native Task Scheduler payloads. */
function projectTask(name, row) {
  const definition = taskOf(name);
  return {
    name,
    taskName: textValue(row?.taskName ?? row?.TaskName) ?? definition?.taskName ?? null,
    state: textValue(row?.state ?? row?.State) ?? 'Unknown',
    nextRun: textValue(row?.nextRun ?? row?.NextRunTime),
    lastRun: textValue(row?.lastRun ?? row?.LastRunTime),
    lastResult: row?.lastResult ?? row?.LastTaskResult ?? null,
    action: textValue(row?.action ?? row?.Action ?? row?.Actions),
  };
}

const showText = (task) => [
  `${task.name} (${task.taskName})`,
  `state: ${task.state}`,
  `next run: ${task.nextRun ?? '-'}`,
  `last run: ${task.lastRun ?? '-'}`,
  `last result: ${task.lastResult ?? '-'}`,
  `action: ${task.action ?? '-'}`,
].join('\n');

const unknown = (verb, name) => ({
  code: 2,
  stderr: `starci task ${verb}: unknown task "${name}" (expected harness-tunnel or reconciler)`,
  data: { schema: 'starci/task-show@1', ok: false, name: String(name ?? '') },
});

/** Show one registered runtime task. */
export async function taskShow(ctx, deps = {}) {
  const [name, ...extra] = ctx?.positionals ?? [];
  const definition = taskOf(name);
  if (!definition || extra.length) return unknown('show', name);
  const result = await (deps.queryScheduledTask ?? queryScheduledTask)(definition.taskName, { env: ctx?.env });
  if (!resultOk(result)) {
    return { code: 1, stderr: `starci task show: could not query ${definition.taskName}${detail(result, { limit: 600 }) ? `: ${detail(result, { limit: 600 })}` : ''}`,
      data: { schema: 'starci/task-show@1', ok: false, name, taskName: definition.taskName } };
  }
  let task;
  try { task = projectTask(name, payloadOf(result)); }
  catch (error) {
    return { code: 1, stderr: `starci task show: invalid Task Scheduler response (${error.message})`,
      data: { schema: 'starci/task-show@1', ok: false, name, taskName: definition.taskName } };
  }
  return { code: 0, text: showText(task), data: { schema: 'starci/task-show@1', ok: true, ...task } };
}

/** List the registered subset of the runtime's two known tasks in canonical name order. */
export async function taskList(ctx, deps = {}) {
  const entries = Object.entries(TASK_DEFINITIONS);
  const result = await (deps.listScheduledTasks ?? listScheduledTasks)(entries.map(([, task]) => task.taskName), { env: ctx?.env });
  if (!resultOk(result)) {
    return { code: 1, stderr: `starci task list: could not query Task Scheduler${detail(result, { limit: 600 }) ? `: ${detail(result, { limit: 600 })}` : ''}`,
      data: { schema: 'starci/task-list@1', ok: false, tasks: [] } };
  }
  let rows;
  try {
    const payload = payloadOf(result);
    if (payload == null) rows = [];
    else if (Array.isArray(payload)) rows = payload;
    else rows = [payload];
  } catch (error) {
    return { code: 1, stderr: `starci task list: invalid Task Scheduler response (${error.message})`,
      data: { schema: 'starci/task-list@1', ok: false, tasks: [] } };
  }
  const byTaskName = new Map(rows.map((row) => [String(row?.taskName ?? row?.TaskName ?? '').toLowerCase(), row]));
  const tasks = entries.flatMap(([name, definition]) => {
    const row = byTaskName.get(definition.taskName.toLowerCase());
    return row ? [projectTask(name, row)] : [];
  });
  const text = tasks.length ? tasks.map((task) => `${task.name}\t${task.state}\t${task.nextRun ?? '-'}\t${task.lastRun ?? '-'}\t${task.lastResult ?? '-'}\t${task.action ?? '-'}`).join('\n') : 'no StarCi scheduled tasks registered';
  return { code: 0, text, data: { schema: 'starci/task-list@1', ok: true, tasks } };
}
