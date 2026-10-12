import { HTTP_STATUS_BY_KIND } from "./http-status.policy"

describe("HTTP_STATUS_BY_KIND", () => {
    it.each([
        ["invalid", 400],
        ["unauthenticated", 401],
        ["forbidden", 403],
        ["not-found", 404],
        ["conflict", 409],
        ["rate-limited", 429],
        ["unavailable", 503],
        ["internal", 500],
    ] as const)("answers a %s failure with HTTP %i", (kind, status) => {
        expect(HTTP_STATUS_BY_KIND[kind]).toBe(status)
    })

    it("maps every error kind and nothing else", () => {
        expect(Object.keys(HTTP_STATUS_BY_KIND)).toHaveLength(8)
    })
})
