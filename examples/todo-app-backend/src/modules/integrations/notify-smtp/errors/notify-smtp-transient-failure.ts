import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a transient SMTP failure (the host is unreachable or answers with a 4xx). */
export interface NotifySmtpTransientFailureExceptionMetadata extends DomainErrorMetadata {
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
export class NotifySmtpTransientFailureException extends DomainError {
    constructor({ notificationId, reason, ...metadata }: NotifySmtpTransientFailureExceptionMetadata = {
    }) {
        super("NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION",
            "The mail host could not be reached or asked to be retried.",
            {
                metadata: {
                    notificationId,
                    reason,
                    ...metadata,
                } 
            })
    }
}
