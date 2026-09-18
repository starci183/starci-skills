export interface ReopenTaskCommandParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface ReopenTaskCommandResult {
  readonly taskId: string;
  readonly complete: boolean;
}

/** The reopen half of br.task.complete.once as a CQRS write. */
export class ReopenTaskCommand {
  constructor(readonly params: ReopenTaskCommandParams) {}
}
