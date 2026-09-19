/** Contract naming the list tasks query params shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface ListTasksQueryParams {
  readonly ownerId: string;
}

/** Contract naming the task summary result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface TaskSummaryResult {
  readonly taskId: string;
  readonly title: string;
  readonly complete: boolean;
}

/** Contract naming the list tasks query result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface ListTasksQueryResult {
  readonly tasks: Array<TaskSummaryResult>;
}

/** br.task.list.owned as a CQRS read, dispatched by the GraphQL tasks query resolver. */
export class ListTasksQuery {
    constructor(readonly params: ListTasksQueryParams) {}
}
