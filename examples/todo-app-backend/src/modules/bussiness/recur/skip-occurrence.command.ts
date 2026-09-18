export interface SkipOccurrenceCommandParams {
  readonly occurrenceId: string;
  readonly actorId: string;
}

export interface SkipOccurrenceCommandResult {
  readonly occurrenceId: string;
  readonly status: string;
}

/** sds.recur.occurrence-lifecycle's t-skip transition, as a CQRS write. */
export class SkipOccurrenceCommand {
  constructor(readonly params: SkipOccurrenceCommandParams) {}
}
