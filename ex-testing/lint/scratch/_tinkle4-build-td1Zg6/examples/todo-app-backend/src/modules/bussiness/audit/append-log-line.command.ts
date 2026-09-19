/** Contract naming the append log line command params shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface AppendLogLineCommandParams {
  readonly actorId: string;
  readonly action: string;
  readonly target?: string | null;
}

/** Contract naming the append log line command result shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface AppendLogLineCommandResult {
  readonly lineId: string;
}

/** fr.audit.log.append as a CQRS write, dispatched by AuditEventSubscriber for every PlatformEventBus
 * event this feature subscribes to. */
export class AppendLogLineCommand {
    constructor(readonly params: AppendLogLineCommandParams) {}
}
