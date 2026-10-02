import { BaseEvent } from "./event-bus.contracts"
import { readEnvelope, readEnvelopeText, readEventOf } from "./event-envelope.policy"

interface PingPayload {
    readonly note: string
}

class PingEvent extends BaseEvent {
    readonly eventName = "probe.ping"

    constructor(
        readonly eventId: string,
        readonly payload: PingPayload,
    ) {
        super()
    }
}

const isPingPayload = (payload: Record<string, unknown>): payload is PingPayload & Record<string, unknown> =>
    typeof payload.note === "string"
const buildPing = (eventId: string, payload: PingPayload): PingEvent => new PingEvent(eventId, payload)

describe("event envelope policies", () => {
    describe("readEnvelope", () => {
        it("reads the event id and payload of an envelope", () => {
            expect(readEnvelope({ eventId: "event-1", payload: { note: "hello" }, ignored: true })).toEqual({
                eventId: "event-1",
                payload: { note: "hello" },
            })
        })

        it.each([
            [null, "a non-record"],
            [{ eventId: 1, payload: {} }, "a non-text event id"],
            [{ eventId: "event-1", payload: 1 }, "a non-record payload"],
        ])("refuses %s because it is %s", (envelope: unknown, _why: string) => {
            expect(readEnvelope(envelope)).toBeNull()
        })
    })

    describe("readEnvelopeText", () => {
        it("parses an envelope and names its event", () => {
            const envelope = { eventId: "event-1", eventName: "probe.ping", payload: { note: "hello" } }

            expect(readEnvelopeText(JSON.stringify(envelope))).toEqual({
                eventName: "probe.ping",
                envelope,
                cause: null,
            })
        })

        it.each([JSON.stringify([]), JSON.stringify({ eventName: 1 })])(
            "keeps a parsed JSON value without a text event name unnamed",
            (value) => {
                expect(readEnvelopeText(value)).toMatchObject({ eventName: "", cause: null })
            },
        )

        it("returns the parse failure for text that is not JSON", () => {
            const result = readEnvelopeText("not json")

            expect(result.eventName).toBe("")
            expect(result.envelope).toBeNull()
            expect(result.cause).toBeInstanceOf(SyntaxError)
        })
    })

    describe("readEventOf", () => {
        it("builds an event after the envelope and its payload are proven", () => {
            expect(readEventOf({ eventId: "event-1", payload: { note: "hello" } }, isPingPayload, buildPing)).toEqual(
                new PingEvent("event-1", { note: "hello" }),
            )
        })

        it("refuses a value that is not an envelope without checking its payload", () => {
            let checked = false
            const guard = (payload: Record<string, unknown>): payload is PingPayload & Record<string, unknown> => {
                checked = true
                return isPingPayload(payload)
            }

            expect(readEventOf(null, guard, buildPing)).toBeNull()
            expect(checked).toBe(false)
        })

        it("refuses an envelope whose payload does not have the event fields", () => {
            expect(readEventOf({ eventId: "event-1", payload: {} }, isPingPayload, buildPing)).toBeNull()
        })
    })
})
