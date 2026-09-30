import { DomainError } from "@modules/platform/errors"
import { ok, refused, unwrapOutcome } from "./outcome.mapper"

enum SampleErrorCode {
    Missing = "SAMPLE_MISSING",
}

class SampleError extends DomainError<SampleErrorCode> {}

const caught = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

describe("unwrapOutcome", () => {
    it("returns the value of a successful outcome", () => {
        expect(unwrapOutcome(ok(42), SampleError)).toBe(42)
    })

    it("throws the capability error carrying the code and params of a refusal", () => {
        const outcome = refused(SampleErrorCode.Missing, { id: "a" })
        const thrown = caught(() => unwrapOutcome(outcome, SampleError))
        expect(thrown).toBeInstanceOf(SampleError)
        expect(thrown).toMatchObject({ code: SampleErrorCode.Missing, params: { id: "a" } })
    })
})
