export interface UnsubscribeCommandParams {
  readonly actorId: string;
  readonly channel: string;
}

export interface UnsubscribeCommandResult {
  readonly channel: string;
  readonly unsubscribed: true;
}

/** fr.notify.unsubscribe as a CQRS write, backing the `unsubscribe` GraphQL mutation - a one-purpose
 * shortcut for "set unsubscribed to true" (br.notify.unsubscribe.honored), distinct from
 * `updateNotificationPreferences`'s general patch so an unsubscribe link never has to know the digest
 * window shape at all. */
export class UnsubscribeCommand {
  constructor(readonly params: UnsubscribeCommandParams) {}
}
