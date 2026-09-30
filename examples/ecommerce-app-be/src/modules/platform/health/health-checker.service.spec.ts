import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import { HealthChecker } from "./health-checker.service"
import { HealthLogEvent } from "./health.log-events"
import type { HealthProbe } from "./health.port"

const probe = (name: string, check: () => Promise<void>): HealthProbe => ({ name, check })

describe("HealthChecker", () => {
    it("reports every dependency ok when all probes answer", async () => {
        const checker = new HealthChecker(
            { service: "demo", probes: [] },
            [probe("database", () => Promise.resolve()), probe("cache", () => Promise.resolve())],
            mock<Logger>(),
        )
        await expect(checker.run()).resolves.toEqual({
            service: "demo",
            checks: { database: "ok", cache: "ok" },
            healthy: true,
        })
    })

    it("marks a failing dependency unreachable, logs it and reports the service unhealthy", async () => {
        const logger = mock<Logger>()
        const checker = new HealthChecker(
            { service: "demo", probes: [] },
            [probe("database", () => Promise.reject(new TypeError("down"))), probe("cache", () => Promise.resolve())],
            logger,
        )
        const report = await checker.run()
        expect(report.checks).toEqual({ database: "unreachable", cache: "ok" })
        expect(report.healthy).toBe(false)
        expect(logger.warn).toHaveBeenCalledWith(HealthLogEvent.ProbeFailed, expect.objectContaining({ dependency: "database" }))
    })
})
