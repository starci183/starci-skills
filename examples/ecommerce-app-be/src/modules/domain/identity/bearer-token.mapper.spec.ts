import { bearerTokenOf } from "./bearer-token.mapper"

describe("bearerTokenOf", () => {
    it("extracts the token of a bearer credential", () => {
        expect(bearerTokenOf("Bearer abc")).toBe("abc")
        expect(bearerTokenOf("Bearer   abc  ")).toBe("abc")
    })

    it("answers null for a missing, empty or non-bearer header", () => {
        expect(bearerTokenOf(undefined)).toBeNull()
        expect(bearerTokenOf("Bearer ")).toBeNull()
        expect(bearerTokenOf("Basic abc")).toBeNull()
    })
})
