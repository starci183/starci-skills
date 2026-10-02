import type { BaseEvent, ParsedEvent } from "./event-bus.contracts"
import { isRecord } from "@modules/platform/primitives"

/** What a received envelope carries once its shape is checked: the event id and the payload record. */
export interface ReadEnvelope {
    /** The stable event id. */
    readonly eventId: string
    /** The payload record, its fields still unchecked. */
    readonly payload: Record<string, unknown>
}

/** What reading an envelope answers: the checked envelope, or null when the value does not have the shape. */
export type ReadEnvelopeResult = ReadEnvelope | null

/** What reading the text of a message answers: the event name it carries (empty when none), the parsed value, and the failure when the text is not JSON. */
export interface ReadEnvelopeText {
    /** The event name of the envelope, or an empty text when the value is not an envelope. */
    readonly eventName: string
    /** The parsed value, or null when the text is not JSON. */
    readonly envelope: unknown
    /** Why the text could not be parsed; null when it could. */
    readonly cause: unknown
}

/** Checks the shape every envelope has, `{ eventId, payload }`: what an event class reads its own fields from. */
export const readEnvelope = (envelope: unknown): ReadEnvelopeResult =>
    isRecord(envelope) && typeof envelope.eventId === "string" && isRecord(envelope.payload)
        ? { eventId: envelope.eventId, payload: envelope.payload }
        : null

/** Parses the text of a message and names the event it carries; a text that is not JSON has no name and carries the cause. */
export const readEnvelopeText = (value: string): ReadEnvelopeText => {
    try {
        const envelope: unknown = JSON.parse(value)
        const eventName = isRecord(envelope) && typeof envelope.eventName === "string" ? envelope.eventName : ""
        return { eventName, envelope, cause: null }
    } catch (cause) {
        return { eventName: "", envelope: null, cause }
    }
}

/** Reads an envelope into an event: the shape is checked, `isPayload` proves the payload fields, `build` makes the event; null when either check fails. */
export const readEventOf = <Payload extends object, Event extends BaseEvent>(
    envelope: unknown,
    isPayload: (payload: Record<string, unknown>) => payload is Payload & Record<string, unknown>,
    build: (eventId: string, payload: Payload) => Event,
): ParsedEvent<Event> => {
    const read = readEnvelope(envelope)
    return read !== null && isPayload(read.payload) ? build(read.eventId, read.payload) : null
}
