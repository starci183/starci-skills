import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Test } from "@nestjs/testing"
import { ProbesErrorCode } from "./errors/probes.error"
import { ProbeCheckerService } from "./probe-checker.service"
import { PROBES, PROBES_OPTIONS } from "./probes.decorators"
import { ProbesLogEvent } from "./probes.log-events"
import type { Probe } from "./probes.port"

const build = async () => {
    const database = mock<Probe>({ name: "database" })
    const cache = mock<Probe>({ name: "cache" })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProbeCheckerService,
            { provide: PROBES_OPTIONS, useValue: { service: "order", probes: [] } },
            { provide: PROBES, useValue: [database, cache] },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { checker: moduleRef.get(ProbeCheckerService), database, cache, logger }
}

describe("ProbeCheckerService", () => {
    it("succeeds with the report when every dependency answers", async () => {
        const { checker, database, cache, logger } = await build()
        database.check.mockResolvedValue(undefined)
        cache.check.mockResolvedValue(undefined)

        expect(await checker.check()).toSucceedWith({
            service: "order",
            checks: { database: "ok", cache: "ok" },
            healthy: true,
        })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("refuses with the state of each dependency and logs the one that failed", async () => {
        const { checker, database, cache, logger } = await build()
        const failure = new Error("redis down")
        database.check.mockResolvedValue(undefined)
        cache.check.mockRejectedValue(failure)

        expect(await checker.check()).toBeRefused({
            code: ProbesErrorCode.DependencyUnavailable,
            params: { database: "ok", cache: "unreachable" },
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ProbesLogEvent.ProbeFailed, failure, { dependency: "cache" })
    })
})
