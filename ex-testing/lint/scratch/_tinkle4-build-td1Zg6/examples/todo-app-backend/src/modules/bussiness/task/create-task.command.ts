/** Contract naming the create task command params shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface CreateTaskCommandParams {
  readonly ownerId: string;
  readonly title: string;
}

/** Contract naming the create task command result shape bussiness/task code and its consumers share; a second site never retypes it inline. */
export interface CreateTaskCommandResult {
  readonly taskId: string;
  readonly title: string;
}

/** fr.task.create as a CQRS write, dispatched by the GraphQL createTask mutation resolver. */
export class CreateTaskCommand {
    constructor(readonly params: CreateTaskCommandParams) {}
}
