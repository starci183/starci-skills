import { toCheckHealthResponse } from "./check-health.mapper"

describe("toCheckHealthResponse", () => {
    it("answers ok with the service and the state of each dependency", () => {
        expect(toCheckHealthResponse({ service: "demo", checks: { database: "ok" }, healthy: true })).toEqual({
            status: "ok",
            service: "demo",
            checks: { database: "ok" },
        })
    })
})
