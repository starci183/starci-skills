import { DomainError } from "@modules/platform/errors"
import { ok, refused, unwrapOutcome } from "./outcome.mapper"

/** A throwaway capability error: the mapper is generic over the error class, so the spec brings its own. */
const SampleError = class extends DomainError<"SAMPLE_MISSING"> {}

describe("unwrapOutcome", () => {
    it("returns the value of a successful outcome", () => {
        expect(unwrapOutcome(ok(42), SampleError)).toBe(42)
    })

    it("throws the capability error carrying the code and params of a refusal", () => {
        const outcome = refused("SAMPLE_MISSING", { id: "a" })
        expect(() => unwrapOutcome(outcome, SampleError)).toThrow(SampleError)
        expect(() => unwrapOutcome(outcome, SampleError)).toThrow(expect.objectContaining({ code: "SAMPLE_MISSING", params: { id: "a" } }))
    })
})
