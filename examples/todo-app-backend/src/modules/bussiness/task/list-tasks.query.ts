export interface ListTasksQueryParams {
  readonly ownerId: string;
}

export interface TaskSummaryResult {
  readonly taskId: string;
  readonly title: string;
  readonly complete: boolean;
}

export interface ListTasksQueryResult {
  readonly tasks: TaskSummaryResult[];
}

/** br.task.list.owned as a CQRS read, dispatched by the GraphQL tasks query resolver. */
export class ListTasksQuery {
  constructor(readonly params: ListTasksQueryParams) {}
}
