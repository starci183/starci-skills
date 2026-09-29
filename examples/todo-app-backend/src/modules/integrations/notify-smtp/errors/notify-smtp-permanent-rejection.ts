import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a permanent SMTP rejection (the provider refuses the address for good, a 5xx). */
export interface NotifySmtpPermanentRejectionExceptionMetadata extends DomainErrorMetadata {
  /** The notification id the delivery attempt was for. */
  notificationId?: string;
  /** The reason string the transport reported. */
  reason?: string;
}

/**
 * br.notify.failure.classified / sds.notify.delivery-lifecycle's t-bounce: the provider permanently
 * rejects the address (a 5xx). Terminal, and does not retry.
 */
export class NotifySmtpPermanentRejectionException extends DomainError {
    constructor({ notificationId, reason, ...metadata }: NotifySmtpPermanentRejectionExceptionMetadata = {
    }) {
        super("NOTIFY_SMTP_PERMANENT_REJECTION_EXCEPTION",
            "The mail host permanently rejected the address.",
            {
                metadata: {
                    notificationId,
                    reason,
                    ...metadata,
                } 
            })
    }
}
