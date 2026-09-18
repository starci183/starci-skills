export interface CompleteTaskParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface CompleteTaskResult {
  readonly taskId: string;
  readonly complete: boolean;
}
