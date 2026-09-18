import { apiRequest } from './client';
import { runWrite } from './write-feedback';

/** The one shape a task takes on the wire and in every product-facing list. */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly complete: boolean;
}

/** Reads the viewer's own tasks; a missing or expired token surfaces as a transport refusal. */
export const listTasks = (token: string): Promise<ReadonlyArray<Task>> => {
  return apiRequest<ReadonlyArray<Task>>('/tasks', { token });
};

/** Creates one task from its trimmed title. */
export const createTask = (token: string, title: string): Promise<Task> => {
  return apiRequest<Task>('/tasks', { method: 'POST', token, body: { title } });
};

/** Sets one task's complete flag (br.task.complete.once: completing twice is a no-op). */
export const setTaskComplete = (token: string, id: string, complete: boolean): Promise<Task> => {
  return apiRequest<Task>(`/tasks/${id}/complete`, { method: 'PATCH', token, body: { complete } });
};

/** Deletes one task permanently (br.task.delete.final: there is no undo). */
export const deleteTask = (token: string, id: string): Promise<void> => {
  return apiRequest<void>(`/tasks/${id}`, { method: 'DELETE', token });
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
