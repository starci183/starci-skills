import { afterEach, describe, expect, it, vi } from "vitest"
import { apiGraphqlUrl } from "./index"

describe("config", () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("returns the configured GraphQL endpoint", () => {
        vi.stubEnv("NEXT_PUBLIC_API_GRAPHQL_URL", "http://backend.test/graphql")
        expect(apiGraphqlUrl()).toBe("http://backend.test/graphql")
    })

    it("names the missing variable instead of falling back to a default", () => {
        vi.stubEnv("NEXT_PUBLIC_API_GRAPHQL_URL", "")
        expect(() => apiGraphqlUrl()).toThrow("NEXT_PUBLIC_API_GRAPHQL_URL is not set")
    })
})
