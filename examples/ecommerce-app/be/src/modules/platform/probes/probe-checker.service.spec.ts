import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
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
    const timer = mock<Timer>()
    const cancel = jest.fn()
    timer.schedule.mockReturnValue(cancel)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProbeCheckerService,
            { provide: TIMER, useValue: timer },
            { provide: PROBES_OPTIONS, useValue: { service: "order", probes: [] } },
            { provide: PROBES, useValue: [database, cache] },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { checker: moduleRef.get(ProbeCheckerService), database, cache, logger, timer, cancel }
}

describe("ProbeCheckerService", () => {
    it("answers liveness without calling an unavailable dependency", async () => {
        const { checker, database, cache, logger } = await build()

        expect(await checker.live()).toEqual({ status: "ok", service: "order" })
        expect(database.check).not.toHaveBeenCalled()
        expect(cache.check).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

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

    it("refuses readiness within two seconds when a required dependency never settles", async () => {
        jest.useFakeTimers()
        try {
            const { checker, database, cache, logger, timer, cancel } = await build()
            database.check.mockResolvedValue(undefined)
            cache.check.mockReturnValue(new Promise<void>(() => {}))
            const result = checker.check()

            await jest.advanceTimersByTimeAsync(2_000)
            expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), 2_000)
            timer.schedule.mock.calls.at(1)?.[0]()

            expect(await result).toBeRefused({
                code: ProbesErrorCode.DependencyUnavailable,
                params: { database: "ok", cache: "unreachable" },
            })
            expect(logger.error).toHaveBeenCalledWith(ProbesLogEvent.ProbeFailed, expect.any(Error), {
                dependency: "cache",
            })
            expect(await checker.live()).toEqual({ status: "ok", service: "order" })
            expect(jest.getTimerCount()).toBe(0)
            expect(cancel).toHaveBeenCalledTimes(2)
        } finally {
            jest.useRealTimers()
        }
    })

    it("clears probe deadlines after successful readiness", async () => {
        jest.useFakeTimers()
        try {
            const { checker, database, cache, cancel } = await build()
            database.check.mockResolvedValue(undefined)
            cache.check.mockResolvedValue(undefined)

            await checker.check()

            expect(jest.getTimerCount()).toBe(0)
            expect(cancel).toHaveBeenCalledTimes(2)
        } finally {
            jest.useRealTimers()
        }
    })
})
