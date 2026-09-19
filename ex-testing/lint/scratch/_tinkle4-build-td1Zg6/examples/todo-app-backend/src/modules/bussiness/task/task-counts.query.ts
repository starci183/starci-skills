/** Contract naming the task counts query params shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface TaskCountsQueryParams {
  readonly ownerId: string;
}

/** Contract naming the task counts query result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface TaskCountsQueryResult {
  readonly open: number;
  readonly complete: number;
}

/**
 * contract.task.list-for-dashboard's `countsFor (personId) -> {open, complete}` as a CQRS read: two
 * integers for one person, never the tasks themselves. The query's own shape is the ownership
 * enforcement - it counts through TaskService.listOwnedBy, so the result covers exactly the reader's
 * own tasks (br.task.list.owned), and a caller cannot ask for another person's counts by passing a
 * different id: the resolver passes the session actor, never a client-supplied person.
 */
export class TaskCountsQuery {
    constructor(readonly params: TaskCountsQueryParams) {}
}
