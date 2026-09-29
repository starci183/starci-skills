import { describe, expect, it } from "vitest"
import { outcomeOfStatus, statusOfOutcome } from "./outcome"

describe("outcome", () => {
    it("keeps 401 and 403 apart from every other failure", () => {
        expect(outcomeOfStatus(403)).toEqual({ kind: "refused", status: 403, code: "http-403" })
        expect(outcomeOfStatus(401).kind).toBe("refused")
        expect(outcomeOfStatus(404)).toEqual({ kind: "not-found" })
        expect(outcomeOfStatus(422).kind).toBe("invalid")
        expect(outcomeOfStatus(503)).toEqual({ kind: "unavailable", code: "http-503", retryable: true })
        expect(outcomeOfStatus(418)).toEqual({ kind: "unavailable", code: "http-418", retryable: false })
    })

    it("folds an outcome back into the status a slot reads", () => {
        expect(statusOfOutcome(outcomeOfStatus(403))).toBe(403)
        expect(statusOfOutcome(outcomeOfStatus(404))).toBe(404)
        expect(statusOfOutcome(outcomeOfStatus(422))).toBe(422)
        expect(statusOfOutcome(outcomeOfStatus(500))).toBe(503)
    })
})
