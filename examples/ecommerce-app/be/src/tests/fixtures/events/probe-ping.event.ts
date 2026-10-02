import { BaseEvent } from "@modules/platform/event-bus"
import type { ParsedEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

/** The payload of the probe event the bus specs publish. */
export interface ProbePingPayload {
    /** A text the consumer sees back. */
    readonly note: string
}

/** The event of the probe service of the bus specs: `probe.ping`, version 1. It belongs to no contract of the product. */
export class ProbePingEvent extends BaseEvent {
    static readonly eventName = "probe.ping"
    static readonly version = 1

    readonly eventName = ProbePingEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: ProbePingPayload,
    ) {
        super()
    }

    /** Builds a ping with the given id. */
    static create(eventId: string, payload: ProbePingPayload): ProbePingEvent {
        return new ProbePingEvent(eventId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): ParsedEvent<ProbePingEvent> {
        if (!isRecord(envelope) || typeof envelope.eventId !== "string" || !isRecord(envelope.payload)) return null
        const { note } = envelope.payload
        return typeof note === "string" ? new ProbePingEvent(envelope.eventId, { note }) : null
    }
}
