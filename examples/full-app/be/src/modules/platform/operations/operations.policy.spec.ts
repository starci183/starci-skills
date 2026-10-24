import { Test } from "@nestjs/testing"
import { defineOperations, mutation, query } from "./operations.policy"

const SUBJECT: unique symbol = Symbol("operations/operations.policy")
const subjectFunctions = () => ({ defineOperations, mutation, query })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

describe("operations", () => {
    it("declares a query as an operation that changes nothing", async () => {
        const subject = await build()

        expect(subject.query<{ readonly id: string }, { readonly ok: boolean }>()).toEqual({ kind: "query" })
    })

    it("declares a mutation as an operation that changes state", async () => {
        const subject = await build()

        expect(subject.mutation<{ readonly id: string }, { readonly ok: boolean }, "DENIED">()).toEqual({
            kind: "mutation",
        })
    })

    it("registers the table of an app as it is, keyed by name and version", async () => {
        const subject = await build()
        const read = subject.query<{ readonly id: string }, { readonly ok: boolean }>()

        const table = subject.defineOperations({ "plan.read@1": read })

        expect(table).toEqual({ "plan.read@1": { kind: "query" } })
        expect(table["plan.read@1"]).toBe(read)
    })
})
