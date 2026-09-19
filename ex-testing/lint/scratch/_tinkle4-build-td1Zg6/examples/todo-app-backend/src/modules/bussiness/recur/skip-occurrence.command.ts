/** Contract naming the skip occurrence command params shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface SkipOccurrenceCommandParams {
  readonly occurrenceId: string;
  readonly actorId: string;
}

/** Contract naming the skip occurrence command result shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface SkipOccurrenceCommandResult {
  readonly occurrenceId: string;
  readonly status: string;
}

/** sds.recur.occurrence-lifecycle's t-skip transition, as a CQRS write. */
export class SkipOccurrenceCommand {
    constructor(readonly params: SkipOccurrenceCommandParams) {}
}
