import { Test } from "@nestjs/testing"
import { bearerTokenOf } from "./bearer-token.mapper"

const SUBJECT = Symbol("bearer token mapper")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => bearerTokenOf }],
    }).compile()
    return moduleRef.get<typeof bearerTokenOf>(SUBJECT)
}

describe("bearerTokenOf", () => {
    it.each([
        ["an absent header", undefined],
        ["another authentication scheme", "Basic Zm9vOmJhcg=="],
        ["a differently cased scheme", "bearer token"],
        ["an empty credential", "Bearer "],
        ["a whitespace-only credential", "Bearer    "],
    ])("answers null for %s", async (_case, authorization) => {
        const subject = await build()
        expect(subject(authorization)).toBeNull()
    })

    it("returns the trimmed bearer credential", async () => {
        const subject = await build()
        expect(subject("Bearer   session-token  ")).toBe("session-token")
    })
})
