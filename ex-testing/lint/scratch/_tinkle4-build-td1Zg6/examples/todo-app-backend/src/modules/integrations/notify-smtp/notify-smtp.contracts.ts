/** Contract naming the notify smtp message shape integrations/notify-smtp code and its consumers share; a second site never retypes it inline. */
export interface NotifySmtpMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

/**
 * integration.notify.smtp's boundary: notify hands a rendered message to this port and afterward owns
 * only the outcome of that handoff. `send` resolves on acceptance, and rejects with
 * `NotifySmtpPermanentRejectionException` (a permanent bounce) or `NotifySmtpTransientFailureException`
 * (the host is unreachable or answers transiently) - never a bare `Error` - so `DeliveryService` can
 * classify the outcome without inspecting transport internals. An abstract class, not an interface,
 * matching this codebase's own convention for ports (`KeycloakClient`'s shape, `CompletionAuthority`).
 */
export abstract class NotifySmtpPort {
  abstract send(message: NotifySmtpMessage): Promise<void>;
}
