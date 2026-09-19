/** Contract naming the request erasure command params shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface RequestErasureCommandParams {
  readonly personId: string;
}

/** Contract naming the request erasure command result shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface RequestErasureCommandResult {
  readonly requestId: string;
  readonly state: string;
}

/** fr.audit.erasure.request as a CQRS write, dispatched by the GraphQL requestErasure mutation resolver. */
export class RequestErasureCommand {
    constructor(readonly params: RequestErasureCommandParams) {}
}
