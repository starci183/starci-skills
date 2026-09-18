export interface ReopenTaskParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface ReopenTaskResult {
  readonly taskId: string;
  readonly complete: boolean;
}
