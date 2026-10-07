// task-show.mjs - project Windows Task Scheduler query results into stable task show/list data.
import { scheduleList as listScheduledTasksCall } from '../api/schtasks/schedule-list.mjs';
import { scheduleQuery as queryScheduledTask } from '../api/schtasks/schedule-query.mjs';
import { resultDetail as detail, resultOk } from '../lib/verb-call.mjs';
import { KNOWN_TASKS_TEXT, TASK_DEFINITIONS, taskOf } from './task-register.mjs';

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
  stderr: `starci task ${verb}: unknown task "${name}" (expected ${KNOWN_TASKS_TEXT})`,
  data: { schema: 'starci/task-show@1', ok: false, name: String(name ?? '') },
});

/** Show one registered runtime task. */
export async function taskShow(ctx, deps = {}) {
  const [name, ...extra] = ctx?.positionals ?? [];
  const definition = taskOf(name);
  if (!definition || extra.length) return unknown('show', name);
  const result = await (deps.queryScheduledTask ?? queryScheduledTask)(definition.taskName, { env: ctx?.env });
  if (!resultOk(result)) {
    const suffix = detail(result, { limit: 600 });
    return { code: 1, stderr: `starci task show: could not query ${definition.taskName}${suffix ? ': ' + suffix : ''}`,
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

/**
 * One Task Scheduler list call for the runtime's known tasks: {ok: true, tasks} with the registered subset in canonical
 * name order, or {ok: false, reason} naming why the answer could not be read.
 */
export async function readTasks({ env, listScheduledTasks = listScheduledTasksCall } = {}) {
  const entries = Object.entries(TASK_DEFINITIONS);
  const result = await listScheduledTasks(entries.map(([, task]) => task.taskName), { env });
  if (!resultOk(result)) {
    const suffix = detail(result, { limit: 600 });
    return { ok: false, reason: `could not query Task Scheduler${suffix ? ': ' + suffix : ''}` };
  }
  let rows;
  try {
    const payload = payloadOf(result);
    if (payload == null) rows = [];
    else if (Array.isArray(payload)) rows = payload;
    else rows = [payload];
  } catch (error) {
    return { ok: false, reason: `invalid Task Scheduler response (${error.message})` };
  }
  const byTaskName = new Map(rows.map((row) => [String(row?.taskName ?? row?.TaskName ?? '').toLowerCase(), row]));
  const tasks = entries.flatMap(([name, definition]) => {
    const row = byTaskName.get(definition.taskName.toLowerCase());
    return row ? [projectTask(name, row)] : [];
  });
  return { ok: true, tasks };
}

/** List the registered subset of the runtime's known tasks in canonical name order. */
export async function taskList(ctx, deps = {}) {
  const read = await readTasks({ env: ctx?.env, listScheduledTasks: deps.listScheduledTasks });
  if (!read.ok) return { code: 1, stderr: `starci task list: ${read.reason}`, data: { schema: 'starci/task-list@1', ok: false, tasks: [] } };
  const { tasks } = read;
  const text = tasks.length ? tasks.map((task) => `${task.name}\t${task.state}\t${task.nextRun ?? '-'}\t${task.lastRun ?? '-'}\t${task.lastResult ?? '-'}\t${task.action ?? '-'}`).join('\n') : 'no StarCi scheduled tasks registered';
  return { code: 0, text, data: { schema: 'starci/task-list@1', ok: true, tasks } };
}
