import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the event-bus capability. */
export enum EventBusErrorCode {
    /** A delivered envelope does not have the shape its consumer's event class reads. */
    EnvelopeInvalid = "EVENT_BUS_ENVELOPE_INVALID",
    /** The broker did not answer a call within its deadline, or refused it. */
    BrokerUnavailable = "EVENT_BUS_BROKER_UNAVAILABLE",
    /** A dead letter id does not name a message the dead-letter topic holds. */
    DeadLetterUnknown = "EVENT_BUS_DEAD_LETTER_UNKNOWN",
}

/** How each event-bus code travels. */
export const EVENT_BUS_ERROR_KINDS: Record<EventBusErrorCode, ErrorKind> = {
    [EventBusErrorCode.EnvelopeInvalid]: "internal",
    [EventBusErrorCode.BrokerUnavailable]: "unavailable",
    [EventBusErrorCode.DeadLetterUnknown]: "not-found",
}

/** The one error class of the event-bus capability. */
export class EventBusError extends DomainError<EventBusErrorCode> {}
