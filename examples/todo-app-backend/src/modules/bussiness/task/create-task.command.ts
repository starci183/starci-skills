export interface CreateTaskCommandParams {
  readonly ownerId: string;
  readonly title: string;
}

export interface CreateTaskCommandResult {
  readonly taskId: string;
  readonly title: string;
}

/** fr.task.create as a CQRS write, dispatched by the GraphQL createTask mutation resolver. */
export class CreateTaskCommand {
  constructor(readonly params: CreateTaskCommandParams) {}
}
