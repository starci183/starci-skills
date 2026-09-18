export interface DeleteTaskCommandParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface DeleteTaskCommandResult {
  readonly deleted: boolean;
}

/** br.task.delete.final as a CQRS write. */
export class DeleteTaskCommand {
  constructor(readonly params: DeleteTaskCommandParams) {}
}
