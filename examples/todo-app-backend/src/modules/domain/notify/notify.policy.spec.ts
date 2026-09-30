import {
    RETRY_BUDGET,
    computeDedupeKey,
    isBlankChannel,
    isValidDigestWindow,
    settleAttempt,
} from "./notify.policy"

describe("notify policy", () => {
    it("derives the dedupe key from kind, source event and recipient, and never from the payload", () => {
        const key = computeDedupeKey("task-complete", "evt-1", "person-1")
        expect(key).toMatch(/^[0-9a-f]{64}$/)
        expect(computeDedupeKey("task-complete", "evt-1", "person-1")).toBe(key)
        expect(computeDedupeKey("task-complete", "evt-2", "person-1")).not.toBe(key)
        expect(computeDedupeKey("task-complete", "evt-1", "person-2")).not.toBe(key)
        expect(computeDedupeKey("new-device", "evt-1", "person-1")).not.toBe(key)
    })

    it("treats a channel with no visible character as blank", () => {
        expect(isBlankChannel("   ")).toBe(true)
        expect(isBlankChannel("")).toBe(true)
        expect(isBlankChannel("email")).toBe(false)
    })

    it("accepts only whole windows of at least one minute", () => {
        expect(isValidDigestWindow(1)).toBe(true)
        expect(isValidDigestWindow(0)).toBe(false)
        expect(isValidDigestWindow(2.5)).toBe(false)
        expect(isValidDigestWindow(-3)).toBe(false)
    })

    it("ends a delivered send without touching the failure class", () => {
        expect(settleAttempt("delivered", 1)).toEqual({ state: "delivered", ends: true })
    })

    it("bounces a permanent rejection at once", () => {
        expect(settleAttempt("permanent-bounce", 1)).toEqual({
            state: "bounced",
            ends: true,
            failureClass: "permanent-bounce",
        })
    })

    it("re-queues a transient failure while the retry budget lasts and gives up when it is spent", () => {
        expect(settleAttempt("transient", RETRY_BUDGET - 1)).toEqual({
            state: "queued",
            ends: false,
            failureClass: "transient",
        })
        expect(settleAttempt("transient", RETRY_BUDGET)).toEqual({
            state: "bounced",
            ends: true,
            failureClass: "retries-exhausted",
        })
    })
})
