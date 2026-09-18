import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a transient SMTP failure (the host is unreachable or answers with a 4xx). */
export interface NotifySmtpTransientFailureExceptionMetadata extends AbstractExceptionMetadata {
  /** The notification id the delivery attempt was for. */
  notificationId?: string;
  /** The reason string the transport reported. */
  reason?: string;
}

/**
 * br.notify.failure.classified / sds.notify.delivery-lifecycle's t-retry|t-give-up: the mail host is
 * unreachable or answers with a temporary refusal (4xx). Thrown by the SMTP port so DeliveryService can
 * tell it apart from a permanent rejection without inspecting transport internals itself.
 */
export class NotifySmtpTransientFailureException extends AbstractException {
  constructor({ notificationId, reason, ...metadata }: NotifySmtpTransientFailureExceptionMetadata = {}) {
    super('The mail host could not be reached or asked to be retried.', 'NOTIFY_SMTP_TRANSIENT_FAILURE', {
      notificationId,
      reason,
      ...metadata,
    });
  }
}
