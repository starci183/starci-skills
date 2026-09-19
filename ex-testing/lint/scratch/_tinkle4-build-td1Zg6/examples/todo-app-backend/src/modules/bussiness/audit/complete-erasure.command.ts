/** Contract naming the complete erasure command params shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface CompleteErasureCommandParams {
  readonly requestId: string;
  readonly callerId: string;
}

/** Contract naming the complete erasure command result shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface CompleteErasureCommandResult {
  readonly requestId: string;
  readonly state: string;
}

/** fr.audit.erasure.complete as a CQRS write, dispatched by the GraphQL completeErasure mutation
 * resolver. `callerId` is who is asking, not necessarily who is erased - AuditErasureService.execute
 * refuses when it does not match the request's own subject. */
export class CompleteErasureCommand {
    constructor(readonly params: CompleteErasureCommandParams) {}
}
