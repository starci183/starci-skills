/** Contract naming the complete task command params shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface CompleteTaskCommandParams {
  readonly actorId: string;
  readonly taskId: string;
}

/** Contract naming the complete task command result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface CompleteTaskCommandResult {
  readonly taskId: string;
  readonly complete: boolean;
}

/** fr.task.complete as a CQRS write. */
export class CompleteTaskCommand {
    constructor(readonly params: CompleteTaskCommandParams) {}
}
