import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the event-bus capability. */
export enum EventBusErrorCode {
    /** A delivered envelope does not have the shape its consumer's event class reads. */
    EnvelopeInvalid = "EVENT_BUS_ENVELOPE_INVALID",
}

/** How each event-bus code travels. */
export const EVENT_BUS_ERROR_KINDS: Record<EventBusErrorCode, ErrorKind> = {
    [EventBusErrorCode.EnvelopeInvalid]: "internal",
}

/** The one error class of the event-bus capability. */
export class EventBusError extends DomainError<EventBusErrorCode> {}
