export interface CompleteTaskCommandParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface CompleteTaskCommandResult {
  readonly taskId: string;
  readonly complete: boolean;
}

/** fr.task.complete as a CQRS write. */
export class CompleteTaskCommand {
  constructor(readonly params: CompleteTaskCommandParams) {}
}
