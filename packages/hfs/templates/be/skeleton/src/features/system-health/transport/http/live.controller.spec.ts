import { HealthCheckService } from "@nestjs/terminus"
import { mock } from "@starci/jest-preset/mock"
import { LiveController } from "./live.controller"

describe("LiveController", () => {
    it("runs Terminus with no indicator, so liveness never depends on a dependency", async () => {
        const health = mock<HealthCheckService>()
        const result = { status: "ok" as const, info: {}, error: {}, details: {} }
        health.check.mockResolvedValue(result)
        await expect(new LiveController(health).live()).resolves.toEqual(result)
        expect(health.check).toHaveBeenCalledWith([])
    })
})
