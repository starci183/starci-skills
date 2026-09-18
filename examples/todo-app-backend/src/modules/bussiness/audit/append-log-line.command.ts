export interface AppendLogLineCommandParams {
  readonly actorId: string;
  readonly action: string;
  readonly target?: string | null;
}

export interface AppendLogLineCommandResult {
  readonly lineId: string;
}

/** fr.audit.log.append as a CQRS write, dispatched by AuditEventSubscriber for every PlatformEventBus
 * event this feature subscribes to. */
export class AppendLogLineCommand {
  constructor(readonly params: AppendLogLineCommandParams) {}
}
