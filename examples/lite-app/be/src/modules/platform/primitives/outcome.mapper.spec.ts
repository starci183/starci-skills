import { DomainError } from "@modules/platform/errors"
import { ok, refused, unwrapOutcome } from "./outcome.mapper"

type CapabilityErrorCode = "CAPABILITY_REFUSED"

class CapabilityError extends DomainError<CapabilityErrorCode> {}

describe("outcome mappers", () => {
    describe("ok", () => {
        it("wraps the produced value as a success", () => {
            const value = { id: "value-1" }

            expect(ok(value)).toEqual({ kind: "ok", value })
        })
    })

    describe("refused", () => {
        it("wraps the capability code and display parameters as a refusal", () => {
            expect(refused("CAPABILITY_REFUSED", { resource: "value-1" })).toEqual({
                kind: "refused",
                code: "CAPABILITY_REFUSED",
                params: { resource: "value-1" },
            })
        })

        it("keeps display parameters optional", () => {
            expect(refused("CAPABILITY_REFUSED")).toEqual({
                kind: "refused",
                code: "CAPABILITY_REFUSED",
                params: undefined,
            })
        })
    })

    describe("unwrapOutcome", () => {
        it("returns the value of a successful outcome", () => {
            expect(unwrapOutcome(ok("value-1"), CapabilityError)).toBe("value-1")
        })

        it("turns a refusal into the capability error with its parameters", () => {
            const outcome = refused<CapabilityErrorCode>("CAPABILITY_REFUSED", { resource: "value-1" })

            expect(() => unwrapOutcome(outcome, CapabilityError)).toThrow(
                expect.objectContaining({
                    name: "CapabilityError",
                    code: "CAPABILITY_REFUSED",
                    params: { resource: "value-1" },
                }),
            )
        })
    })
})
