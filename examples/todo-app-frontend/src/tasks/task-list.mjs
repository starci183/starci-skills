/**
 * The list screen of ui.task.list. It renders the four states that record names - empty, one-task,
 * many-tasks, refused - and nothing else, so a state with no design is a missing branch rather than an
 * improvised one. Colours come from the brand tokens; none is written here.
 */
export const STATES = ['empty', 'one-task', 'many-tasks', 'refused'];

export function renderTaskList({tasks = [], refusal = null} = {}) {
  if (refusal) return {state: 'refused', message: refusal, rows: []};
  if (tasks.length === 0) return {state: 'empty', message: 'No tasks yet. Add the first one.', rows: []};
  return {
    state: tasks.length === 1 ? 'one-task' : 'many-tasks',
    rows: tasks.map(task => ({id: task.id, title: task.title, complete: Boolean(task.complete)}))
  };
}

