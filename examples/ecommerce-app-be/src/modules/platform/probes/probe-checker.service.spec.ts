import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import { ProbeCheckerService } from "./probe-checker.service"
import { ProbesLogEvent } from "./probes.log-events"
import type { Probe } from "./probes.port"

const probe = (name: string, check: () => Promise<void>): Probe => ({ name, check })

describe("ProbeCheckerService", () => {
    it("reports every dependency ok when all probes answer", async () => {
        const checker = new ProbeCheckerService(
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
        const checker = new ProbeCheckerService(
            { service: "demo", probes: [] },
            [probe("database", () => Promise.reject(new TypeError("down"))), probe("cache", () => Promise.resolve())],
            logger,
        )
        const report = await checker.run()
        expect(report.checks).toEqual({ database: "unreachable", cache: "ok" })
        expect(report.healthy).toBe(false)
        expect(logger.error).toHaveBeenCalledWith(ProbesLogEvent.ProbeFailed, expect.any(TypeError), { dependency: "database" })
    })
})
