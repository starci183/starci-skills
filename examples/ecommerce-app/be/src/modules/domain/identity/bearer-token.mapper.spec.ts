import { bearerTokenOf } from "./bearer-token.mapper"

describe("bearerTokenOf", () => {
    it.each([
        ["an absent header", undefined],
        ["another authentication scheme", "Basic Zm9vOmJhcg=="],
        ["a differently cased scheme", "bearer token"],
        ["an empty credential", "Bearer "],
        ["a whitespace-only credential", "Bearer    "],
    ])("answers null for %s", (_case, authorization) => {
        expect(bearerTokenOf(authorization)).toBeNull()
    })

    it("returns the trimmed bearer credential", () => {
        expect(bearerTokenOf("Bearer   session-token  ")).toBe("session-token")
    })
})
