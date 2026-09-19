/** Contract naming the reopen task command params shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface ReopenTaskCommandParams {
  readonly actorId: string;
  readonly taskId: string;
}

/** Contract naming the reopen task command result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface ReopenTaskCommandResult {
  readonly taskId: string;
  readonly complete: boolean;
}

/** The reopen half of br.task.complete.once as a CQRS write. */
export class ReopenTaskCommand {
    constructor(readonly params: ReopenTaskCommandParams) {}
}
