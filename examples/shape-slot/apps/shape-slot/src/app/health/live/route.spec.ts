import { describe, expect, it } from "vitest"
import { GET } from "./route"

describe("GET /health/live", () => {
    it("answers the { status, info, error, details } shape from process-local state", async () => {
        const response = GET()
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ status: "ok", info: {}, error: {}, details: {} })
    })
})
