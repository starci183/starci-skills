export interface DeleteTaskParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface DeleteTaskResult {
  readonly deleted: boolean;
}
