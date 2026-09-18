export interface RequestErasureCommandParams {
  readonly personId: string;
}

export interface RequestErasureCommandResult {
  readonly requestId: string;
  readonly state: string;
}

/** fr.audit.erasure.request as a CQRS write, dispatched by the GraphQL requestErasure mutation resolver. */
export class RequestErasureCommand {
  constructor(readonly params: RequestErasureCommandParams) {}
}
