import { graphql, type Result } from './graphql';
import { runWrite } from './write-feedback';

/** The one shape a task takes on the wire and in every product-facing list. */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly complete: boolean;
}

/** Every failed GraphQL `Result` this module sees becomes a thrown `Error` here, the one place - so a
 * `useSWR`/`useSWRMutation` caller sees the rejection it already expects, same as the former `ApiError`
 * thrown by `client.ts`'s `apiRequest`. */
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.reason, result.code ? { cause: new Error(result.code) } : undefined);
  }
  return result.data;
};

interface TaskSummary {
  readonly taskId: string;
  readonly title: string;
  readonly complete: boolean;
}

const toTask = (summary: TaskSummary): Task => ({ id: summary.taskId, title: summary.title, complete: summary.complete });

const LIST_TASKS_DOCUMENT = 'query { tasks { taskId title complete } }';

/** Reads the viewer's own tasks; a missing or expired token surfaces as a transport refusal. */
export const listTasks = async (token: string): Promise<ReadonlyArray<Task>> => {
  const result = await graphql<Array<TaskSummary>>(LIST_TASKS_DOCUMENT, undefined, token);
  return unwrap(result).map(toTask);
};

const CREATE_TASK_DOCUMENT = 'mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }';

/** Creates one task from its trimmed title. */
export const createTask = async (token: string, title: string): Promise<Task> => {
  const result = await graphql<{ taskId: string; title: string }>(CREATE_TASK_DOCUMENT, { input: { title } }, token);
  const created = unwrap(result);
  return { id: created.taskId, title: created.title, complete: false };
};

const COMPLETE_TASK_DOCUMENT = 'mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }';
const REOPEN_TASK_DOCUMENT = 'mutation ReopenTask($id: ID!) { reopenTask(id: $id) { taskId complete } }';

/**
 * Sets one task's complete flag (br.task.complete.once: completing twice is a no-op; reopening clears
 * the completion timestamp). The backend exposes these as two separate mutations - `completeTask` and
 * `reopenTask`, neither taking a flag - so this is the one place that turns the boolean this module's
 * own callers already pass into the right document; the public signature is unchanged from the former
 * REST-backed version.
 */
export const setTaskComplete = async (token: string, id: string, complete: boolean): Promise<Task> => {
  const result = complete
    ? await graphql<{ taskId: string; complete: boolean }>(COMPLETE_TASK_DOCUMENT, { id }, token)
    : await graphql<{ taskId: string; complete: boolean }>(REOPEN_TASK_DOCUMENT, { id }, token);
  const updated = unwrap(result);
  return { id: updated.taskId, title: '', complete: updated.complete };
};

const DELETE_TASK_DOCUMENT = 'mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }';

/** Deletes one task permanently (br.task.delete.final: there is no undo). */
export const deleteTask = async (token: string, id: string): Promise<void> => {
  unwrap(await graphql<{ deleted: boolean }>(DELETE_TASK_DOCUMENT, { id }, token));
};

/** The declared feedback site for the create-task write action (FE_WRITE_FEEDBACK_OWNER). */
export const createTaskAndNotify = (token: string, title: string): Promise<Task> => {
  return runWrite(() => createTask(token, title));
};

/** The declared feedback site for the complete-task write action (FE_WRITE_FEEDBACK_OWNER). */
export const setTaskCompleteAndNotify = (token: string, id: string, complete: boolean): Promise<Task> => {
  return runWrite(() => setTaskComplete(token, id, complete));
};

/** The declared feedback site for the delete-task write action (FE_WRITE_FEEDBACK_OWNER). */
export const deleteTaskAndNotify = (token: string, id: string): Promise<void> => {
  return runWrite(() => deleteTask(token, id));
};
