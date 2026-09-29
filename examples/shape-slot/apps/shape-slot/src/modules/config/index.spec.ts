import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

describe("config", () => {
    it("reads the API base URL from the environment", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api")
        const { config } = await import("./index")
        expect(config).toEqual({ apiBaseUrl: "/api", requestTimeoutMs: 10_000 })
    })

    it("fails at load when the API base URL is missing", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "")
        await expect(import("./index")).rejects.toThrow("NEXT_PUBLIC_API_BASE_URL is required")
    })
})
