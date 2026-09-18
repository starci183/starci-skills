export interface CreateTaskParams {
  readonly ownerId: string;
  readonly title: string;
}

export interface CreateTaskResult {
  readonly taskId: string;
  readonly title: string;
}
