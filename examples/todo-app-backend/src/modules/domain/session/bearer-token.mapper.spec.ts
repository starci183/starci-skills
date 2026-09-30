import { bearerTokenOf } from "./bearer-token.mapper"

describe("bearerTokenOf", () => {
    it("reads the token of a bearer header", () => {
        expect(bearerTokenOf("Bearer abc")).toBe("abc")
    })

    it("answers null for an absent header, another scheme or an empty token", () => {
        expect(bearerTokenOf(undefined)).toBeNull()
        expect(bearerTokenOf("Basic abc")).toBeNull()
        expect(bearerTokenOf("Bearer   ")).toBeNull()
    })
})
