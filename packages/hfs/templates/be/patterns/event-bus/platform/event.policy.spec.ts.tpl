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

describe("event policies", () => {
    it("declares the delivery and wire constants", () => {
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

    it.each([
        ["order.created", "order"],
        ["order", "order"],
        ["", ""],
    ])("reads the service of %s", (eventName, service) => {
        expect(serviceOf(eventName)).toBe(service)
    })

    it("builds the main topic from the prefix and event service", () => {
        expect(topicOf("run-1.", "order.created")).toBe("run-1.events.order")
    })

    it("builds the retry topic from the main topic", () => {
        expect(retryTopicOf("run-1.", "order.created")).toBe("run-1.events.order.retry")
    })

    it("builds the dead-letter topic from the main topic", () => {
        expect(deadLetterTopicOf("run-1.", "order.created")).toBe("run-1.events.order.dlq")
    })

    it.each([
        [1, 500],
        [2, 1000],
        [4, 4000],
    ])("doubles the backoff after delivery %i", (attempt, delay) => {
        expect(backoffMs(attempt)).toBe(delay)
    })
})
