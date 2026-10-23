import { Test } from "@nestjs/testing"
import { DomainError } from "@modules/platform/errors"
import { ok, refused, unwrapOutcome } from "./outcome.mapper"

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

type CapabilityErrorCode = "CAPABILITY_REFUSED"

class CapabilityError extends DomainError<CapabilityErrorCode> {}

const OUTCOME_MAPPERS: unique symbol = Symbol("primitives.outcome")

type OutcomeMappers = { ok: typeof ok; refused: typeof refused; unwrapOutcome: typeof unwrapOutcome }

describe("outcome mappers", () => {
    let subject: OutcomeMappers

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: OUTCOME_MAPPERS, useFactory: () => ({ ok, refused, unwrapOutcome }) }],
        }).compile()
        subject = moduleRef.get<OutcomeMappers>(OUTCOME_MAPPERS)
    })

    describe("ok", () => {
        it("wraps the produced value as a success", () => {
            const value = { id: "value-1" }

            expect(subject.ok(value)).toEqual({ kind: "ok", value })
        })
    })

    describe("refused", () => {
        it("wraps the capability code and display parameters as a refusal", () => {
            expect(subject.refused("CAPABILITY_REFUSED", { resource: "value-1" })).toEqual({
                kind: "refused",
                code: "CAPABILITY_REFUSED",
                params: { resource: "value-1" },
            })
        })

        it("keeps display parameters optional", () => {
            expect(subject.refused("CAPABILITY_REFUSED")).toEqual({
                kind: "refused",
                code: "CAPABILITY_REFUSED",
                params: undefined,
            })
        })
    })

    describe("unwrapOutcome", () => {
        it("returns the value of a successful outcome", () => {
            expect(subject.unwrapOutcome(subject.ok("value-1"), CapabilityError)).toBe("value-1")
        })

        it("turns a refusal into the capability error with its parameters", () => {
            const outcome = subject.refused<CapabilityErrorCode>("CAPABILITY_REFUSED", { resource: "value-1" })

            expect(thrownBy(() => subject.unwrapOutcome(outcome, CapabilityError))).toMatchObject({
                name: "CapabilityError",
                code: "CAPABILITY_REFUSED",
                params: { resource: "value-1" },
            })
        })
    })
})
