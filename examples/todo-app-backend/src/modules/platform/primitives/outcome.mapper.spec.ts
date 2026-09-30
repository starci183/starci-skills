import { DomainError } from "@modules/platform/errors"
import { ok, refused, unwrapOutcome } from "./outcome.mapper"

enum SampleErrorCode {
    Missing = "SAMPLE_MISSING",
}

class SampleError extends DomainError<SampleErrorCode> {}

describe("unwrapOutcome", () => {
    it("returns the value of a successful outcome", () => {
        expect(unwrapOutcome(ok(42), SampleError)).toBe(42)
    })

    it("throws the capability error carrying the code and params of a refusal", () => {
        const outcome = refused(SampleErrorCode.Missing, { id: "a" })
        expect(() => unwrapOutcome(outcome, SampleError)).toThrow(SampleError)
        try {
            unwrapOutcome(outcome, SampleError)
        } catch (error) {
            expect(error).toBeInstanceOf(SampleError)
            if (error instanceof SampleError) {
                expect(error.code).toBe(SampleErrorCode.Missing)
                expect(error.params).toEqual({ id: "a" })
            }
        }
    })
})
