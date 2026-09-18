import { apiRequest } from './client';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly complete: boolean;
}

export function listTasks(token: string): Promise<Task[]> {
  return apiRequest<Task[]>('/tasks', { token });
}

export function createTask(token: string, title: string): Promise<Task> {
  return apiRequest<Task>('/tasks', { method: 'POST', token, body: { title } });
}

export function setTaskComplete(token: string, id: string, complete: boolean): Promise<Task> {
  return apiRequest<Task>(`/tasks/${id}/complete`, { method: 'PATCH', token, body: { complete } });
}

export function deleteTask(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/tasks/${id}`, { method: 'DELETE', token });
}
