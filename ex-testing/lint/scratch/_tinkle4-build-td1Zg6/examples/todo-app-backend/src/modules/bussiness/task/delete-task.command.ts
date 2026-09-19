/** Contract naming the delete task command params shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface DeleteTaskCommandParams {
  readonly actorId: string;
  readonly taskId: string;
}

/** Contract naming the delete task command result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface DeleteTaskCommandResult {
  readonly deleted: boolean;
}

/** br.task.delete.final as a CQRS write. */
export class DeleteTaskCommand {
    constructor(readonly params: DeleteTaskCommandParams) {}
}
