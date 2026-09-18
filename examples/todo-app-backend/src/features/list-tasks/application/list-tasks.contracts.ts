export interface ListTasksParams {
  readonly ownerId: string;
}

export interface TaskSummaryResult {
  readonly taskId: string;
  readonly title: string;
  readonly complete: boolean;
}

export interface ListTasksResult {
  readonly tasks: TaskSummaryResult[];
}
