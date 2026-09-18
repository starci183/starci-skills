import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a permanent SMTP rejection (the provider refuses the address for good, a 5xx). */
export interface NotifySmtpPermanentRejectionExceptionMetadata extends AbstractExceptionMetadata {
  /** The notification id the delivery attempt was for. */
  notificationId?: string;
  /** The reason string the transport reported. */
  reason?: string;
}

/**
 * br.notify.failure.classified / sds.notify.delivery-lifecycle's t-bounce: the provider permanently
 * rejects the address (a 5xx). Terminal, and does not retry.
 */
export class NotifySmtpPermanentRejectionException extends AbstractException {
  constructor({ notificationId, reason, ...metadata }: NotifySmtpPermanentRejectionExceptionMetadata = {}) {
    super('The mail host permanently rejected the address.', 'NOTIFY_SMTP_PERMANENT_REJECTION', {
      notificationId,
      reason,
      ...metadata,
    });
  }
}
