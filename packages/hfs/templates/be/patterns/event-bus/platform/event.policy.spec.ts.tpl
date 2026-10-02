import {
    ATTEMPTS,
    ATTEMPT_HEADER,
    BACKOFF_MS,
    DEAD_LETTER_ID_SEPARATOR,
    NOT_BEFORE_HEADER,
    ORIGIN_HEADER,
    REASON_HEADER,
    REQUEUED_HEADER,
    backoffMs,
    deadLetterTopicOf,
    retryTopicOf,
    serviceOf,
    topicOf,
} from "./event.policy"

describe("event policy", () => {
    it("declares the delivery budget and protocol headers", () => {
        expect({
            attempts: ATTEMPTS,
            backoffMs: BACKOFF_MS,
            attemptHeader: ATTEMPT_HEADER,
            notBeforeHeader: NOT_BEFORE_HEADER,
            reasonHeader: REASON_HEADER,
            originHeader: ORIGIN_HEADER,
            requeuedHeader: REQUEUED_HEADER,
            deadLetterIdSeparator: DEAD_LETTER_ID_SEPARATOR,
        }).toEqual({
            attempts: 5,
            backoffMs: 500,
            attemptHeader: "attempt",
            notBeforeHeader: "not-before",
            reasonHeader: "reason",
            originHeader: "origin-topic",
            requeuedHeader: "requeued",
            deadLetterIdSeparator: "|",
        })
    })

    it("derives the service and every topic from the event name", () => {
        expect(serviceOf("orders.placed")).toBe("orders")
        expect(serviceOf("orders")).toBe("orders")
        expect(topicOf("run-1.", "orders.placed")).toBe("run-1.events.orders")
        expect(retryTopicOf("run-1.", "orders.placed")).toBe("run-1.events.orders.retry")
        expect(deadLetterTopicOf("run-1.", "orders.placed")).toBe("run-1.events.orders.dlq")
    })

    it("doubles the retry backoff after every failed attempt", () => {
        expect(backoffMs(1)).toBe(500)
        expect(backoffMs(2)).toBe(1000)
        expect(backoffMs(4)).toBe(4000)
    })
})
